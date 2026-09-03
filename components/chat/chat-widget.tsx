"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageSquare, Send, X } from "lucide-react";

import { cn } from "@/lib/utils/cn";

interface ChatLine {
  id: string;
  from: "customer" | "assistant";
  body: string;
}

const QUICK_REPLIES = [
  "How much for a house wash?",
  "Do you clean paver driveways?",
  "Is the solution safe for plants?",
  "Can someone call me?",
];

let lineCounter = 0;
function nextId(prefix: string) {
  lineCounter += 1;
  return `${prefix}-${lineCounter}`;
}

export function ChatWidget({
  assistantName,
  businessName,
  greeting,
}: {
  assistantName: string;
  businessName: string;
  greeting: string;
}) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<ChatLine[]>([
    { id: "greeting", from: "assistant", body: greeting },
  ]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, open, pending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    setDraft("");
    setError(null);
    setLines((current) => [...current, { id: nextId("c"), from: "customer", body: trimmed }]);
    setPending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversationId, channel: "web" }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: { reply: string; conversationId: string };
      };

      if (!response.ok || !payload.ok || !payload.data) {
        setError(payload.error ?? "Something went wrong. Please try again.");
        return;
      }

      setConversationId(payload.data.conversationId);
      setLines((current) => [
        ...current,
        { id: nextId("a"), from: "assistant", body: payload.data!.reply },
      ]);
    } catch {
      setError("We could not reach the assistant. Please call the office and we will help right away.");
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="chat-panel"
        className={cn(
          "fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full px-5 py-3.5 font-semibold text-white shadow-lift transition-colors",
          open ? "bg-ink-900 hover:bg-ink-800" : "bg-brand-500 hover:bg-brand-600",
        )}
      >
        {open ? (
          <>
            <X className="h-5 w-5" aria-hidden="true" />
            Close
          </>
        ) : (
          <>
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
            Chat with {assistantName}
          </>
        )}
      </button>

      {open ? (
        <div
          id="chat-panel"
          role="dialog"
          aria-label={`Chat with ${assistantName} at ${businessName}`}
          className="fixed inset-x-3 bottom-20 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lift sm:inset-x-auto sm:right-4 sm:w-[26rem]"
        >
          <header className="flex items-center gap-3 border-b border-line bg-ink-900 px-4 py-3 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 font-display font-bold">
              {assistantName.charAt(0)}
            </span>
            <span>
              <span className="block font-display font-bold leading-tight">{assistantName}</span>
              <span className="block text-xs text-white/70">{businessName} &middot; usually replies instantly</span>
            </span>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {lines.map((line) => (
              <div
                key={line.id}
                className={cn("flex", line.from === "customer" ? "justify-end" : "justify-start")}
              >
                <p
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    line.from === "customer"
                      ? "rounded-br-sm bg-brand-500 text-white"
                      : "rounded-bl-sm bg-surface-muted text-body",
                  )}
                >
                  {line.body}
                </p>
              </div>
            ))}

            {pending ? (
              <div className="flex justify-start">
                <p className="rounded-2xl rounded-bl-sm bg-surface-muted px-3.5 py-3">
                  <span className="sr-only">{assistantName} is typing</span>
                  <span className="flex gap-1" aria-hidden="true">
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        className="h-2 w-2 animate-bounce rounded-full bg-body-muted/60"
                        style={{ animationDelay: `${dot * 120}ms` }}
                      />
                    ))}
                  </span>
                </p>
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
                {error}
              </p>
            ) : null}

            {lines.length === 1 && !pending ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {QUICK_REPLIES.map((reply) => (
                  <button
                    key={reply}
                    type="button"
                    onClick={() => void send(reply)}
                    className="rounded-full border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink-900 hover:bg-surface-muted"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-line p-3">
            <label htmlFor="chat-input" className="sr-only">
              Your message
            </label>
            <input
              ref={inputRef}
              id="chat-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about pricing, availability, anything"
              maxLength={1500}
              className="flex-1 rounded-md border border-line-strong px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={pending || draft.trim().length === 0}
              className="rounded-md bg-brand-500 p-2.5 text-white hover:bg-brand-600 disabled:opacity-50"
            >
              <span className="sr-only">Send message</span>
              <Send className="h-5 w-5" aria-hidden="true" />
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
