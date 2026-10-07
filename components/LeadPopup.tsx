"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHARGE_OPTIONS, PHONE_DISPLAY, PHONE_TEL } from "@/lib/content";
import { newLeadId, submitLead } from "@/lib/lead-client";
import ChargeSelect from "@/components/ChargeSelect";

type Status = "idle" | "submitting" | "done" | "error";

// Long enough that a visitor who came to call or to use the hero form has
// already done so; the popup is for the ones still reading without acting.
const DELAY_MS = 10000;
const SEEN_KEY = "bl_popup_seen";
// Set by lib/lead-client.ts once this tab has delivered a lead.
const LEAD_SENT_KEY = "bl_lead_sent";

function storageGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* storage blocked: the popup may show again on the next page, which is acceptable */
  }
}

// Small "free consultation" form that opens DELAY_MS after landing, as a
// centred gold-bordered card on every screen size.
//
// It is shown at most once per tab session, and never to a visitor who has
// already sent a lead or who has started typing in one of the page's forms
// before the timer fires: interrupting someone mid-form would cost the lead it
// is meant to win. Nothing is rendered until it opens, so it adds no layout shift
// and nothing to the first paint.
//
// Same three fields the API requires (name, phone, charge), posted through the
// shared submitLead() so the click id, the dedupe and the single Ads conversion
// all behave exactly as they do for the other two forms.
export default function LeadPopup({ defaultCharge = "" }: { defaultCharge?: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [charge, setCharge] = useState(defaultCharge);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [chargeMissing, setChargeMissing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (storageGet(SEEN_KEY) || storageGet(LEAD_SENT_KEY)) return;

    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };
    // Typing anywhere in a page form means the visitor is already converting.
    document.addEventListener("input", cancel, { once: true });

    const timer = window.setTimeout(() => {
      document.removeEventListener("input", cancel);
      const active = document.activeElement;
      const busy = active instanceof HTMLElement && active.closest("form") !== null;
      if (cancelled || busy || storageGet(LEAD_SENT_KEY)) return;
      storageSet(SEEN_KEY, "1");
      returnFocus.current = active instanceof HTMLElement ? active : null;
      setOpen(true);
    }, DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("input", cancel);
    };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    returnFocus.current?.focus?.();
  }, []);

  // Escape closes; focus moves to the dialog itself, not an input, so a phone
  // keyboard does not pop up over the page uninvited.
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Freeze the page behind the popup. The scrollbar's width is padded back in
  // so the page does not jump sideways on desktop when the scrollbar disappears.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const scrollbar = window.innerWidth - root.clientWidth;
    const prev = { overflow: root.style.overflow, paddingRight: root.style.paddingRight };
    root.style.overflow = "hidden";
    if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;
    return () => {
      root.style.overflow = prev.overflow;
      root.style.paddingRight = prev.paddingRight;
    };
  }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // The custom charge picker is not a native field, so check it by hand.
    if (!charge) {
      setChargeMissing(true);
      e.currentTarget.querySelector<HTMLElement>("[role=combobox]")?.focus();
      return;
    }
    setStatus("submitting");
    setError("");

    const fd = new FormData();
    fd.set("leadId", newLeadId());
    fd.set("stage", "complete");
    fd.set("name", name);
    fd.set("phone", phone);
    fd.set("charge", charge);
    // Lets popup leads be counted apart from the two page forms.
    fd.set("source", "popup");
    const company = new FormData(e.currentTarget).get("company");
    if (typeof company === "string" && company) fd.set("company", company);

    try {
      await submitLead(fd);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please call us.");
      setStatus("error");
    }
  }

  if (!open) return null;

  const field =
    "h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-[14px] sm:h-[52px] sm:pl-12 sm:text-[15px] text-white placeholder-white/50 outline-none transition focus:border-gold/50 focus:bg-white/[0.07]";
  const fieldIcon = "pointer-events-none absolute inset-y-0 left-3.5 flex items-center sm:left-4 text-white/85";

  return (
    // z-[55] sits under FloatingActions (z-[60]) on purpose: the Call button
    // must stay visible and tappable while the popup is open.
    <div className="fixed inset-0 z-[55] overflow-y-auto overscroll-contain">
      <div className="fixed inset-0 bg-black/70 animate-fade-in motion-reduce:animate-none" aria-hidden="true" />

      {/* Scrolls on very short screens; the card itself never clips, so the
          charge list can hang past its edge. Tapping outside the card closes.
          Bottom padding below md keeps the card clear of the sticky Call bar. */}
      <div
        className="relative flex min-h-full items-center justify-center p-3 pb-24 sm:p-6 sm:pb-24 md:pb-6"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-popup-title"
        tabIndex={-1}
        className="relative w-full max-w-[440px] rounded-3xl border border-gold/45 bg-[linear-gradient(180deg,#1b1b1b_0%,#0f0f0f_100%)] px-5 pb-5 pt-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95),0_0_40px_-12px_rgba(231,172,64,0.25)] outline-none animate-fade-up motion-reduce:animate-none sm:rounded-[28px] sm:px-7 sm:pb-7 sm:pt-10"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-2 top-2 grid h-10 w-10 sm:right-3 sm:top-3 place-items-center rounded-full text-white/70 transition hover:bg-white/5 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {status === "done" ? (
          <div className="pb-1 pr-8">
            <p id="lead-popup-title" className="font-display text-[1.95rem] uppercase leading-[0.95] tracking-tight text-gold-sheen sm:text-[2.6rem]">
              Thank you.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-white/80">
              We&apos;ll call you shortly at {phone}. Want to talk now?{" "}
              <a href={`tel:${PHONE_TEL}`} className="font-semibold text-gold hover:text-gold-soft">
                Call {PHONE_DISPLAY}
              </a>
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-6 text-[12px] font-semibold uppercase tracking-[0.15em] text-white/50 hover:text-white"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2
              id="lead-popup-title"
              className="pr-8 font-display text-[1.95rem] uppercase leading-[0.95] tracking-tight text-white sm:text-[2.9rem]"
            >
              Enter your details to get a <span className="text-gold-sheen">consultation.</span>
            </h2>
            <p className="mt-2.5 text-[13.5px] leading-snug text-white/80 sm:mt-4 sm:text-[15px] sm:leading-relaxed">
              Tell us a little about your situation, and we&apos;ll be in touch with you.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 grid gap-2.5 sm:mt-6 sm:gap-3.5">
              <div className="relative">
                <span className={fieldIcon}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                    <path d="M12 12a4.75 4.75 0 100-9.5 4.75 4.75 0 000 9.5zM3.75 20.4C3.75 16.6 7.4 14 12 14s8.25 2.6 8.25 6.4c0 .6-.45 1.1-1.05 1.1H4.8c-.6 0-1.05-.5-1.05-1.1z" />
                  </svg>
                </span>
                <input
                  name="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  aria-label="Full name"
                  autoComplete="name"
                  className={field}
                />
              </div>

              <div className="relative">
                <span className={fieldIcon}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                    <path d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" />
                  </svg>
                </span>
                <input
                  name="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  aria-label="Phone number"
                  autoComplete="tel"
                  inputMode="tel"
                  pattern="[0-9\(\)\+\-\.\s]{7,}"
                  title="Please enter a valid phone number"
                  className={field}
                />
              </div>

              <ChargeSelect
                value={charge}
                onChange={(v) => {
                  setCharge(v);
                  setChargeMissing(false);
                }}
                invalid={chargeMissing}
                className={field}
                icon={
                  <span className={fieldIcon}>
                    {/* Receipt: the ticket / charge */}
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" fillRule="evenodd" aria-hidden="true">
                      <path d="M6 2h12a1 1 0 011 1v19l-2.33-1.5L14.33 22 12 20.5 9.67 22l-2.34-1.5L5 22V3a1 1 0 011-1zM8.5 6.5h7V8h-7zM8.5 10h7v1.5h-7zM8.5 13.5h4.5V15H8.5z" />
                    </svg>
                  </span>
                }
              />
              {chargeMissing && <p className="-mt-1 px-1 text-[12.5px] text-red-300">Please choose what you were charged with.</p>}
              {/* Honeypot: real users never fill "company". */}
              <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

              <button
                type="submit"
                disabled={status === "submitting"}
                className="btn-sheen mt-1 inline-flex h-[50px] items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[linear-gradient(103deg,#f5c03d_0%,#fadd99_45%,#f5c03d_100%)] px-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink sm:mt-2 sm:h-[54px] sm:gap-3 sm:px-6 sm:text-[14px] sm:tracking-[0.14em] shadow-[0_10px_34px_-6px_rgba(245,192,61,0.55)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_-6px_rgba(245,192,61,0.7)] disabled:opacity-60"
              >
                {status === "submitting" ? (
                  "Sending…"
                ) : (
                  <>
                    Get My Free Consultation
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h15m-6-6l6 6-6 6" />
                    </svg>
                  </>
                )}
              </button>

              {status === "error" && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
                  {error}
                </p>
              )}

              <p className="text-center text-[12.5px] leading-relaxed text-white/60">
                Prefer to talk?{" "}
                <a href={`tel:${PHONE_TEL}`} className="font-semibold text-gold hover:text-gold-soft">
                  Call {PHONE_DISPLAY}
                </a>
              </p>
            </form>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
