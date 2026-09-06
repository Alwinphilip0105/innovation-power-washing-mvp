"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { VoiceDemo } from "@/components/demo/voice-demo";

/**
 * The "Call" buttons on the marketing site.
 *
 * A demo site cannot usefully dial a phone: nobody answers, and on a desktop
 * browser a `tel:` link does nothing at all. So the call buttons place a call
 * to the AI agent instead, in the page, and the real number stays available
 * next to them for anyone who actually wants to ring the business.
 *
 * The button and the dialog talk over a window event rather than context or
 * props. The buttons sit inside server-rendered marketing sections scattered
 * across seven pages; threading a callback down to each one would mean turning
 * those sections into client components for no other reason.
 */
const DEMO_CALL_EVENT = "ipw:demo-call";

export function DemoCallButton({
  className,
  children,
  label = "Call the AI agent — a demo call in your browser",
}: {
  className?: string;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={className}
      onClick={() => window.dispatchEvent(new Event(DEMO_CALL_EVENT))}
    >
      {children}
    </button>
  );
}

/**
 * Mounted once, in the marketing layout. A native <dialog> is used so focus
 * trapping, Escape and the backdrop are the browser's job rather than ours.
 */
export function DemoCallHost({
  assistantName,
  businessName,
  greeting,
  phoneDisplay,
  phoneHref,
}: {
  assistantName: string;
  businessName: string;
  greeting: string;
  phoneDisplay: string;
  phoneHref: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(DEMO_CALL_EVENT, handler);
    return () => window.removeEventListener(DEMO_CALL_EVENT, handler);
  }, []);

  // Drive the dialog element from state. `showModal` is what gives us the
  // backdrop and focus trap, and it cannot be expressed as a prop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <dialog
      ref={dialogRef}
      onClose={close}
      // Clicking the backdrop is the element itself; clicking the panel is not.
      onClick={(event) => {
        if (event.target === dialogRef.current) close();
      }}
      className="m-auto max-h-[85vh] w-[min(38rem,92vw)] overflow-hidden rounded-lg border border-line bg-surface p-0 text-body shadow-card backdrop:bg-ink-900/50"
    >
      {open ? (
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="font-display text-lg font-bold text-ink-900">
                Calling {businessName}
              </h2>
              <p className="mt-1 text-sm text-body-muted">
                A demo call to the AI agent, handled in your browser. To reach a person
                instead, dial{" "}
                <a href={phoneHref} className="font-semibold text-brand-600 hover:underline">
                  {phoneDisplay}
                </a>
                .
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="End the demo call and close"
              className="rounded-md p-1.5 text-body-muted hover:bg-surface-muted hover:text-ink-900"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Mounted only while open, so each call starts from a clean slate. */}
          <div className="overflow-y-auto">
            <VoiceDemo
              autoStart
              assistantName={assistantName}
              businessName={businessName}
              greeting={greeting}
            />
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
