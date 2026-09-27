// Tests the guardrails themselves: break a temporary COPY of the site in specific ways and confirm the right
// check catches each one (and that the allowed cases stay allowed). Run: npm run test:guardrails
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, appendFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync, execSync } from "node:child_process";

const SRC = process.cwd();
let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

function scenario(name, mutate, expectId) {
  const dir = mkdtempSync(join(tmpdir(), "guardrail-"));
  for (const d of ["app", "components", "lib", "scripts", "public"]) if (existsSync(join(SRC, d))) cpSync(join(SRC, d), join(dir, d), { recursive: true });
  for (const f of ["package.json", ".gitignore", ".env.local.example"]) if (existsSync(join(SRC, f))) cpSync(join(SRC, f), join(dir, f));
  const quiet = { cwd: dir, stdio: ["ignore", "pipe", "ignore"] };
  execSync("git init -q", quiet);
  mutate(dir);
  execSync("git add -A -f", quiet);   // -f: also simulates someone force-adding an ignored env file
  const r = spawnSync("node", ["scripts/guardrails.mjs"], { cwd: dir, encoding: "utf8" });
  const out = (r.stdout || "") + (r.stderr || "");
  if (expectId === null) ok(r.status === 0, `${name}: allowed (exit ${r.status})`);
  else ok(r.status === 1 && out.includes(`[${expectId}]`), `${name}: caught by [${expectId}]${r.status === 1 ? "" : " (but it PASSED)"}`);
  rmSync(dir, { recursive: true, force: true });
}
const edit = (dir, f, fn) => writeFileSync(join(dir, f), fn(readFileSync(join(dir, f), "utf8")));

scenario("clean copy", () => {}, null);
scenario('"lawyer" in copy', (d) => appendFileSync(join(d, "lib/content.ts"), '\nexport const X = "Our lawyers fight for you";\n'), "copy-lawyer");
scenario("win-rate claim", (d) => appendFileSync(join(d, "lib/content.ts"), '\nexport const X = "98% win rate";\n'), "copy-win-rate");
scenario("dismissed-charge claim", (d) => appendFileSync(join(d, "lib/content.ts"), '\nexport const X = "Your charge will be dismissed";\n'), "copy-dismissed");
scenario('"upload your ticket"', (d) => appendFileSync(join(d, "lib/content.ts"), '\nexport const X = "Upload your ticket";\n'), "copy-upload");
scenario('wrong business name', (d) => appendFileSync(join(d, "lib/content.ts"), '\nexport const X = "Welcome to Blottman Law";\n'), "copy-brand-name");
scenario("phone constant changed", (d) => edit(d, "lib/content.ts", (s) => s.replace('"+12894015322"', '"+16477947750"')), "phone-tel");
scenario("phone hardcoded elsewhere", (d) => appendFileSync(join(d, "components/Footer.tsx"), '\nconst p = "(647) 794-7750";\n'), "phone-hardcoded");
scenario("route deleted", (d) => rmSync(join(d, "app/speeding"), { recursive: true }), "route-speeding");
scenario("honeypot removed", (d) => edit(d, "components/QuoteForm.tsx", (s) => s.replace('name="company"', 'name="x"')), "form-honeypot-components/QuoteForm.tsx");
scenario("second conversion call", (d) => appendFileSync(join(d, "lib/lead-client.ts"), "\nfireConversion();\n"), "conversion-once");
scenario("twilio signature dropped", (d) => edit(d, "app/api/voice/screen/route.ts", (s) => s.replaceAll("verifyTwilio(", "skipVerify(")), "twilio-signature-screen/route");
scenario("email made required", (d) => edit(d, "app/api/lead/route.ts", (s) => s.replace("if (!lead.phone || !lead.charge) {", "if (!lead.email) return bad('x');\n  if (!lead.phone || !lead.charge) {")), "lead-required-fields");
scenario("env file tracked", (d) => writeFileSync(join(d, ".env.local"), "X=1\n"), "secret-envfile");
scenario("token in source", (d) => appendFileSync(join(d, "lib/content.ts"), '\nexport const T = "' + "eyJ" + "hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdefghijkl" + '";\n'), "secret-token");

// things that MUST stay allowed
scenario("comment mentioning the banned word", (d) => appendFileSync(join(d, "lib/content.ts"), "\n// the old site said lawyer; we do not\n"), null);
scenario("explicit override with a reason", (d) => appendFileSync(join(d, "lib/content.ts"), '\nexport const Q = "a lawyer said so"; // guardrail-ok: verbatim third-party review\n'), null);
scenario("parking scope question", (d) => appendFileSync(join(d, "lib/content.ts"), '\nexport const Q = "Do you handle parking tickets?";\n'), null);

console.log(fails ? `FAILED ${fails}` : "ALL PASS");
process.exit(fails ? 1 : 0);
