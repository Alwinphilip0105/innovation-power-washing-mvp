"use client";
import { callApi, serverHref } from "@/lib/api/client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Loader2, Mic, MicOff, PhoneCall, PhoneOff, Send, Volume2 } from "lucide-react";

import {
  createListener,
  serverSpeechSupport,
  speak,
  speechSupport,
  stopSpeaking,
  subscribeSpeechSupport,
  warmUpVoices,
  type Listener,
} from "@/lib/voice/browser-speech";
import { cn } from "@/lib/utils/cn";

type CallStatus = "idle" | "greeting" | "listening" | "thinking" | "speaking" | "ended";

interface Line {
  id: string;
  from: "caller" | "agent";
  body: string;
}

interface CallSummary {
  outcome: string | null;
  summary: string | null;
  durationSeconds: number | null;
}

interface TurnResponse {
  ok: boolean;
  error?: string;
  data?: { conversationId: string; reply: string; escalated: boolean; tools: string[] };
}

interface EndResponse {
  ok: boolean;
  error?: string;
  data?: { callId: string; summary: string | null; outcome: string | null; durationSeconds: number | null };
}

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: "Not connected",
  greeting: "Connecting",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  ended: "Call ended",
};

const OUTCOME_LABEL: Record<string, string> = {
  booked: "Job booked",
  lead_captured: "Lead captured",
  escalated: "Escalated to the owner",
  enquiry: "Enquiry only",
};

let lineCounter = 0;
function nextId(prefix: string) {
  lineCounter += 1;
  return `${prefix}-${lineCounter}`;
}

/**
 * A spoken call, in the browser.
 *
 * The microphone and the voice are the only demo parts. Every turn goes through
 * the same assistant, tools and CRM writes as the telephony path, so anything
 * the agent says it did, it actually did.
 */
export function VoiceDemo({
  assistantName,
  businessName,
  greeting,
  autoStart = false,
}: {
  assistantName: string;
  businessName: string;
  greeting: string;
  /**
   * Place the call as soon as this mounts. Set by the Call buttons, which
   * mount this inside a dialog: the click that opened the dialog is the user
   * gesture the browser requires before it will open a microphone, and it is
   * still in effect here. Starting from a bare page load would not be.
   */
  autoStart?: boolean;
}) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [interim, setInterim] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [muted, setMuted] = useState(false);

  // What this browser can actually do. Read through the external-store hook so
  // the server renders the typing fallback and the client corrects it on
  // hydration, rather than the two disagreeing.
  const support = useSyncExternalStore(subscribeSpeechSupport, speechSupport, serverSpeechSupport);

  const callIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const listenerRef = useRef<Listener | null>(null);
  const activeRef = useRef(false);
  const mutedRef = useRef(false);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Chrome loads its voice list asynchronously; without an early nudge the
  // first line of the first call comes out in the default robotic voice.
  useEffect(() => {
    warmUpVoices();
  }, []);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, interim, status]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Leaving the page mid-call must not leave the mic open or the agent talking.
  useEffect(() => {
    return () => {
      activeRef.current = false;
      listenerRef.current?.abort();
      stopSpeaking();
    };
  }, []);

  const addLine = useCallback((from: Line["from"], body: string) => {
    setLines((current) => [...current, { id: nextId(from), from, body }]);
  }, []);

  /**
   * Hands the turn back to the caller. The status change is not conditional on
   * there being a microphone: a browser that cannot listen still has to leave
   * the call in a state where the caller can type the next line.
   */
  const listen = useCallback(() => {
    if (!activeRef.current) return;
    setStatus("listening");
    listenerRef.current?.start();
  }, []);

  /** One turn: send what was heard, show the reply, say it, hand the mic back. */
  const sendTurn = useCallback(
    async (text: string) => {
      if (!activeRef.current || !callIdRef.current) return;

      listenerRef.current?.stop();
      setInterim("");
      addLine("caller", text);
      setStatus("thinking");

      let reply: string | null = null;

      try {
        const response = await callApi("/api/demo/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "turn",
            callId: callIdRef.current,
            conversationId: conversationIdRef.current,
            message: text,
          }),
        });

        const payload = (await response.json()) as TurnResponse;

        if (!response.ok || !payload.ok || !payload.data) {
          setError(payload.error ?? "The assistant could not be reached.");
        } else {
          conversationIdRef.current = payload.data.conversationId;
          reply = payload.data.reply;
        }
      } catch {
        setError("The assistant could not be reached. Check that the server is running.");
      }

      if (!activeRef.current) return;

      // A failed turn keeps the call alive - the caller can simply say it again.
      if (!reply) {
        listen();
        return;
      }

      addLine("agent", reply);
      setError(null);

      if (mutedRef.current) {
        listen();
        return;
      }

      setStatus("speaking");
      await speak(reply);
      if (activeRef.current) listen();
    },
    [addLine, listen],
  );

  const startCall = useCallback(async () => {
    setLines([]);
    setInterim("");
    setError(null);
    setSummary(null);

    callIdRef.current = crypto.randomUUID();
    conversationIdRef.current = null;
    startedAtRef.current = Date.now();
    activeRef.current = true;

    listenerRef.current = createListener({
      onInterim: (text) => setInterim(text),
      onFinal: (text) => void sendTurn(text),
      onError: (message) => setError(message),
      onEnd: () => setInterim(""),
    });

    setStatus("greeting");
    addLine("agent", greeting);

    if (!mutedRef.current) await speak(greeting);
    if (!activeRef.current) return;

    listen();
  }, [addLine, greeting, listen, sendTurn]);

  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStarted.current) return;
    // Guarded by a ref rather than the dep list: startCall is rebuilt whenever
    // its own callbacks are, and a second call mid-conversation would wipe the
    // transcript.
    autoStarted.current = true;
    void startCall();
  }, [autoStart, startCall]);

  const endCall = useCallback(async () => {
    if (!activeRef.current || !callIdRef.current) return;

    activeRef.current = false;
    listenerRef.current?.abort();
    listenerRef.current = null;
    stopSpeaking();
    setInterim("");
    setStatus("ended");

    const durationSeconds = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));

    try {
      const response = await callApi("/api/demo/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "end",
          callId: callIdRef.current,
          conversationId: conversationIdRef.current,
          durationSeconds,
        }),
      });

      const payload = (await response.json()) as EndResponse;

      if (response.ok && payload.ok && payload.data) {
        setSummary({
          outcome: payload.data.outcome,
          summary: payload.data.summary,
          durationSeconds: payload.data.durationSeconds ?? durationSeconds,
        });
      } else {
        setError(payload.error ?? "The call ended but could not be written to the CRM.");
      }
    } catch {
      setError("The call ended but could not be written to the CRM.");
    }
  }, []);

  const live = status !== "idle" && status !== "ended";
  const busy = status === "thinking" || status === "speaking" || status === "greeting";

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-lift">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-ink-900 px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 font-display font-bold">
            {assistantName.charAt(0)}
          </span>
          <span>
            <span className="block font-display font-bold leading-tight">{assistantName}</span>
            <span className="block text-xs text-white/70">{businessName} &middot; AI phone agent</span>
          </span>
        </div>

        <span
          aria-live="polite"
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold"
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              status === "listening" && "animate-pulse bg-good",
              (status === "thinking" || status === "speaking" || status === "greeting") &&
                "animate-pulse bg-brand-400",
              (status === "idle" || status === "ended") && "bg-white/40",
            )}
            aria-hidden="true"
          />
          {STATUS_LABEL[status]}
        </span>
      </header>

      {!support.recognition ? (
        <p className="border-b border-line bg-surface-muted px-5 py-3 text-sm text-body-muted">
          This browser cannot listen &mdash; speech recognition only works in Chrome and Edge. The demo
          still runs: type what the caller would say and the agent answers out loud.
        </p>
      ) : null}

      <div ref={transcriptRef} className="h-[min(26rem,42vh)] space-y-3 overflow-y-auto px-5 py-5">
        {lines.length === 0 && !live ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <PhoneCall className="mb-3 h-10 w-10 text-body-muted" aria-hidden="true" />
            <p className="max-w-sm text-sm text-body-muted">
              Start the call and talk the way a customer would &mdash; say what you need cleaned and
              where. The agent quotes from the real price list, offers real open slots, and books a
              real appointment.
            </p>
          </div>
        ) : null}

        {lines.map((line) => (
          <div key={line.id} className={cn("flex", line.from === "caller" ? "justify-end" : "justify-start")}>
            <p
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                line.from === "caller"
                  ? "rounded-br-sm bg-brand-500 text-white"
                  : "rounded-bl-sm bg-surface-muted text-body",
              )}
            >
              {line.body}
            </p>
          </div>
        ))}

        {interim ? (
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl rounded-br-sm border border-dashed border-line-strong px-3.5 py-2.5 text-sm italic text-body-muted">
              {interim}
            </p>
          </div>
        ) : null}

        {busy && status !== "greeting" ? (
          <div className="flex justify-start">
            <p className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm bg-surface-muted px-3.5 py-2.5 text-sm text-body-muted">
              {status === "speaking" ? (
                <>
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                  Speaking
                </>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Checking the calendar
                </>
              )}
            </p>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        ) : null}

        {summary ? (
          <div className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm">
            <p className="font-display font-bold text-ink-900">Call written to the CRM</p>
            <dl className="mt-2 space-y-1 text-body-muted">
              <div className="flex gap-2">
                <dt className="font-semibold text-body">Outcome:</dt>
                <dd>{summary.outcome ? (OUTCOME_LABEL[summary.outcome] ?? summary.outcome) : "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold text-body">Length:</dt>
                <dd>{summary.durationSeconds ?? 0} seconds</dd>
              </div>
              {summary.summary ? (
                <div className="flex gap-2">
                  <dt className="font-semibold text-body">Summary:</dt>
                  <dd>{summary.summary}</dd>
                </div>
              ) : null}
            </dl>
            <a
              href={serverHref("/dashboard/calls")}
              className="mt-3 inline-block font-semibold text-brand-600 underline underline-offset-2"
            >
              Open it in the dashboard
            </a>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 border-t border-line px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {live ? (
            <button
              type="button"
              onClick={() => void endCall()}
              className="inline-flex items-center gap-2 rounded-full bg-bad px-5 py-3 font-semibold text-white hover:opacity-90"
            >
              <PhoneOff className="h-5 w-5" aria-hidden="true" />
              Hang up
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startCall()}
              className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-3 font-semibold text-white hover:bg-brand-600"
            >
              <PhoneCall className="h-5 w-5" aria-hidden="true" />
              {status === "ended" ? "Start another call" : "Start the call"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            aria-pressed={muted}
            className="inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-3 text-sm font-semibold text-ink-900 hover:bg-surface-muted"
          >
            {muted ? (
              <>
                <MicOff className="h-4 w-4" aria-hidden="true" />
                Voice off
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" aria-hidden="true" />
                Voice on
              </>
            )}
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const text = draft.trim();
            if (!text || !live || busy) return;
            setDraft("");
            void sendTurn(text);
          }}
          className="flex items-center gap-2"
        >
          <label htmlFor="voice-fallback" className="sr-only">
            Type what the caller says
          </label>
          <input
            id="voice-fallback"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={!live || busy}
            placeholder={live ? "…or type what the caller would say" : "Start the call first"}
            maxLength={1500}
            className="flex-1 rounded-md border border-line-strong px-3 py-2.5 text-sm disabled:bg-surface-muted"
          />
          <button
            type="submit"
            disabled={!live || busy || draft.trim().length === 0}
            className="rounded-md bg-ink-900 p-2.5 text-white hover:bg-ink-800 disabled:opacity-50"
          >
            <span className="sr-only">Send</span>
            <Send className="h-5 w-5" aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
}
