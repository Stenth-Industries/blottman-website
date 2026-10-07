// Guardrails: cheap automatic checks for the mistakes that have actually cost this business money,
// and that fail SILENTLY in production (a broken phone number or form looks fine on screen).
// Run:  npm run guardrails        (also runs on every pull request via .github/workflows/checks.yml)
//
// A check that fails here is a question for the site owner, not an obstacle to route around.
// If a flagged line is genuinely fine, add a comment on that same line: // guardrail-ok: <why>
// and say so in the pull request. Changing this file to make a check pass is a red flag for the reviewer.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const failures = [];
const fail = (id, msg) => failures.push({ id, msg });
let checks = 0;
const check = (id, ok, msg) => { checks++; if (!ok) fail(id, msg); };

const read = (p) => readFileSync(join(root, p), "utf8");
const has = (p) => existsSync(join(root, p));

function walk(dir, out = []) {
  if (!existsSync(join(root, dir))) return out;
  for (const name of readdirSync(join(root, dir))) {
    const rel = join(dir, name);
    const st = statSync(join(root, rel));
    if (st.isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx|mjs|js|jsx)$/.test(name)) out.push(rel.replace(/\\/g, "/"));
  }
  return out;
}
const SRC = [...walk("app"), ...walk("components"), ...walk("lib")];

// Executable/visible lines only: skip comment lines, and lines carrying an explicit override.
const codeLines = (file) =>
  read(file).split("\n").map((text, i) => ({ text, n: i + 1 })).filter(({ text }) => {
    const t = text.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*")) return false;
    return !text.includes("guardrail-ok");
  });

// ---- 1. Law Society of Ontario copy rules (set by the client, 2026-06 and 2026-09) -------------------------
// Leslie is a licensed PARALEGAL. No "lawyer", no outcome promises or statistics, no ticket upload,
// and the business name is "Blottman Legal Services".
const BANNED = [
  { id: "copy-lawyer", re: /\b(lawyers?|attorneys?)\b/i, why: 'Never "lawyer"/"attorney": she is a licensed paralegal (LSO).' },
  { id: "copy-win-rate", re: /98\s?%|win[- ]rate|success rate/i, why: "No win-rate or success statistics: unverifiable outcome claim (LSO; got the ads flagged Clickbait)." },
  { id: "copy-guarantee", re: /\bguarantee[ds]?\b/i, why: "No guarantees or promised outcomes (LSO)." },
  { id: "copy-dismissed", re: /\bdismiss(ed|al|als)?\b/i, why: "No outcome claims such as dismissed/withdrawn charges authored by the firm (LSO)." },
  { id: "copy-upload", re: /\bupload\b/i, why: 'No "upload your ticket": she cannot review a ticket before a conflict check and signed retainer (LSO).' },
  { id: "copy-brand-name", re: /Blottman Law\b/, why: 'The business name is "Blottman Legal Services".',
    allow: (line) => line.includes("I retained Blottman Law") /* verbatim third-party Google reviews, cannot be edited */ },
  { id: "copy-parking", re: /parking (ticket|fine)s?/i, why: "Parking is out of scope and attracts junk leads.",
    // a QUESTION ("Do you handle parking tickets?") or an explicit exclusion clarifies scope; it does not advertise it
    allow: (line) => line.includes("?") || /(not|don'?t|do not|no|except)\b[^.]{0,40}parking|parking[^.]{0,40}(not|out of scope)/i.test(line) },
];
for (const file of SRC) {
  for (const { text, n } of codeLines(file)) {
    for (const b of BANNED) {
      checks++;
      if (b.re.test(text) && !(b.allow && b.allow(text))) fail(b.id, `${file}:${n}  ${b.why}\n      > ${text.trim().slice(0, 140)}`);
    }
  }
}

// ---- 2. Live ads point at these exact URLs: never rename, move or delete a route ---------------------------
const ROUTES = ["", "speeding", "careless-driving", "stunt-driving", "fail-to-stop", "disobey-sign", "no-insurance",
  "driving-under-suspension", "no-licence", "cell-phone", "privacy"];
for (const r of ROUTES) check("route-" + (r || "home"), has(`app/${r ? r + "/" : ""}page.tsx`), `Missing page for /${r}. Live Google Ads land on it; removing it 404s a paid click.`);
for (const p of ["app/api/lead/route.ts", "app/api/version/route.ts", "app/api/voice/route.ts", "app/api/voice/screen/route.ts",
  "app/api/voice/complete/route.ts", "app/api/voice/rescue/route.ts", "app/api/voice/recording/route.ts"])
  check("api-" + p, has(p), `Missing ${p}. The forms, the phone screening and the deploy monitor depend on it.`);

// ---- 3. The phone number: one source of truth, and it is the call-SCREENING line ---------------------------
const content = has("lib/content.ts") ? read("lib/content.ts") : "";
check("phone-display", /export const PHONE_DISPLAY = "\(289\) 401-5322"/.test(content), "PHONE_DISPLAY changed. It is the Twilio screening line, and the Google call-conversion number swap derives from it. Do not change without the owner.");
check("phone-tel", /export const PHONE_TEL = "\+12894015322"/.test(content), "PHONE_TEL changed. See PHONE_DISPLAY.");
for (const file of SRC.filter((f) => f !== "lib/content.ts")) {
  for (const { text, n } of codeLines(file)) {
    checks++;
    if (/\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}|tel:\+?\d{7,}/.test(text)) fail("phone-hardcoded", `${file}:${n}  Hardcoded phone number. Use PHONE_DISPLAY / PHONE_TEL from lib/content.ts so tracking stays correct.\n      > ${text.trim().slice(0, 140)}`);
  }
}

// ---- 4. Forms and conversion tracking ----------------------------------------------------------------------
for (const f of ["components/QuickForm.tsx", "components/QuoteForm.tsx", "components/LeadPopup.tsx"])
  check("form-honeypot-" + f, has(f) && read(f).includes('name="company"'), `${f}: the hidden honeypot field name="company" is gone. Bots will flood the leads.`);
const lc = has("lib/lead-client.ts") ? read("lib/lead-client.ts") : "";
check("gclid", lc.includes("getGclid("), "lib/lead-client.ts no longer captures the Google click id. Leads can no longer be tied to the ad that produced them.");
const calls = (lc.match(/\bfireConversion\(\)/g) || []).length - (lc.match(/function fireConversion\(\)/g) || []).length;
check("conversion-once", calls === 1, `fireConversion() is called ${calls} times in lib/lead-client.ts (expected exactly 1). A second call double-counts conversions and skews Google's bidding.`);
const leadRoute = has("app/api/lead/route.ts") ? read("app/api/lead/route.ts") : "";
check("lead-required-fields", !/if\s*\(\s*!lead\.(email|message)\b/.test(leadRoute) && !/!lead\.(email|message)\s*\)\s*\{?\s*return bad/.test(leadRoute),
  "app/api/lead/route.ts makes email or the message required. In Aug 2026 extra required fields coincided with the Search conversion rate falling from about 5% to under 1%.");
const layout = has("app/layout.tsx") ? read("app/layout.tsx") : "";
check("gtag", layout.includes("phone_conversion_number") && /NEXT_PUBLIC_GADS_ID/.test(layout), "app/layout.tsx: the Google Ads tag or the call-conversion number swap was removed.");

// ---- 5. Phone screening endpoints must verify Twilio's signature --------------------------------------------
for (const f of ["route", "screen/route", "complete/route", "rescue/route", "recording/route"]) {
  const p = `app/api/voice/${f}.ts`;
  check("twilio-signature-" + f, has(p) && read(p).includes("verifyTwilio("), `${p} no longer verifies the Twilio signature. Anyone on the internet could then drive the call flow.`);
}

// ---- 6. No secrets, no env files ---------------------------------------------------------------------------
let tracked = [];
try { tracked = execSync("git ls-files", { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean); } catch { /* not a git checkout */ }
for (const f of tracked) {
  checks++;
  if (/(^|\/)\.env(\.|$)/.test(f) && !f.endsWith(".example")) fail("secret-envfile", `${f} is tracked. Environment files hold production keys and must never be committed.`);
}
const SECRET = /eyJ[A-Za-z0-9_-]{25,}|AKfycb[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]+|-----BEGIN [A-Z ]*PRIVATE KEY|\/webhook\/blottman-[a-z-]*[0-9a-f]{16,}|AC[0-9a-f]{32}|[0-9]{8,12}:[A-Za-z0-9_-]{30,}/;
for (const f of tracked.filter((x) => /\.(ts|tsx|mjs|js|json|md|yml|yaml|txt|env|example)$/.test(x) && !x.endsWith("package-lock.json"))) {
  checks++;
  if (has(f) && SECRET.test(read(f))) fail("secret-token", `${f} contains something that looks like a key, token or secret webhook URL. Remove it and tell the owner so it can be rotated.`);
}

// ---- report ------------------------------------------------------------------------------------------------
if (failures.length) {
  console.error(`\nGUARDRAILS FAILED: ${failures.length} problem(s) (${checks} checks run)\n`);
  for (const f of failures) console.error(` x [${f.id}] ${f.msg}\n`);
  console.error("These protect live client traffic. Ask the site owner before changing anything they flag.\n");
  process.exit(1);
}
console.log(`Guardrails passed (${checks} checks).`);
