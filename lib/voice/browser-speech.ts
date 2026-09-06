/**
 * Web Speech API wrapper - browser only.
 *
 * The one piece of the voice stack that is not a vendor integration: Chrome and
 * Edge ship speech recognition and speech synthesis, so a spoken demo costs
 * nothing and needs no account. It is not a substitute for telephony - nobody
 * dials anything - but everything downstream of the words is the real path.
 *
 * Recognition is Chromium-only and sends audio to Google for transcription.
 * `speechSupport()` reports what the current browser can actually do so the UI
 * can offer typing instead of silently failing.
 */

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

function recognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export interface SpeechSupport {
  recognition: boolean;
  synthesis: boolean;
}

/** What the server must assume: it has no browser to ask. */
const SERVER_SUPPORT: SpeechSupport = { recognition: false, synthesis: false };

/**
 * Cached because `useSyncExternalStore` compares snapshots by identity - a new
 * object every read would re-render forever. Capabilities cannot change within
 * a page load, so one probe is enough.
 */
let cachedSupport: SpeechSupport | null = null;

export function speechSupport(): SpeechSupport {
  if (typeof window === "undefined") return SERVER_SUPPORT;
  cachedSupport ??= {
    recognition: recognitionConstructor() !== null,
    synthesis: typeof window.speechSynthesis !== "undefined",
  };
  return cachedSupport;
}

export function serverSpeechSupport(): SpeechSupport {
  return SERVER_SUPPORT;
}

/** Capabilities never change mid-page, so there is nothing to subscribe to. */
export function subscribeSpeechSupport(): () => void {
  return () => {};
}

export interface ListenerHandlers {
  /** Best guess so far. Fires repeatedly while the caller is still talking. */
  onInterim(text: string): void;
  /** The caller stopped talking and this is what they said. */
  onFinal(text: string): void;
  /** A recognition error the UI should explain, already in plain English. */
  onError(message: string): void;
  /** Recognition stopped, for any reason including a normal end of speech. */
  onEnd(): void;
}

export interface Listener {
  start(): void;
  stop(): void;
  abort(): void;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow the mic in your browser and start the call again.",
  "service-not-allowed": "This browser will not allow speech recognition here. Try Chrome, or type instead.",
  "audio-capture": "No microphone was found. Plug one in, or type instead.",
  network: "Speech recognition needs an internet connection and could not reach the service.",
  aborted: "",
  "no-speech": "",
};

/**
 * A single-utterance listener.
 *
 * Deliberately not `continuous`: the agent speaks back between turns, and a
 * continuously open mic transcribes the agent's own voice as if the caller had
 * said it. The caller talks, the mic closes, the agent replies, the mic reopens.
 */
export function createListener(handlers: ListenerHandlers): Listener | null {
  const Recognition = recognitionConstructor();
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const text = result[0]?.transcript ?? "";
      if (result.isFinal) {
        const finalText = text.trim();
        if (finalText) handlers.onFinal(finalText);
      } else {
        interim += text;
      }
    }
    if (interim.trim()) handlers.onInterim(interim.trim());
  };

  recognition.onerror = (event) => {
    // "no-speech" and "aborted" are normal turn-taking, not failures worth
    // putting in front of someone being shown a demo.
    const message = ERROR_MESSAGES[event.error];
    if (message === undefined) handlers.onError("Speech recognition stopped unexpectedly. Try again, or type instead.");
    else if (message) handlers.onError(message);
  };

  recognition.onend = () => handlers.onEnd();

  let running = false;

  return {
    start() {
      if (running) return;
      try {
        recognition.start();
        running = true;
      } catch {
        // Chrome throws if start() races an in-flight session; the next turn
        // opens the mic again, so this is safe to swallow.
      }
    },
    stop() {
      running = false;
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    },
    abort() {
      running = false;
      try {
        recognition.abort();
      } catch {
        /* already stopped */
      }
    },
  };
}

/** Picks a natural-sounding English voice when the browser offers one. */
function preferredVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const english = voices.filter((voice) => voice.lang.startsWith("en"));
  const pool = english.length > 0 ? english : voices;

  return (
    pool.find((voice) => /natural|neural|google us english|samantha/i.test(voice.name)) ??
    pool.find((voice) => voice.lang === "en-US") ??
    pool[0]
  );
}

/**
 * Speaks text and resolves when the browser has finished saying it.
 *
 * Always resolves - a synthesis failure must not strand the call, since the
 * reply is on screen anyway.
 */
export function speak(text: string): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve();

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = preferredVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? "en-US";
    utterance.rate = 1.02;
    utterance.pitch = 1;

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    utterance.onend = finish;
    utterance.onerror = finish;

    // Chrome silently drops long utterances often enough that a hard ceiling is
    // cheaper than a call that never hands the mic back.
    const ceiling = Math.min(60_000, 2_000 + text.length * 90);
    window.setTimeout(finish, ceiling);

    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

/**
 * Voice lists load asynchronously in Chrome; without this the first reply of a
 * call uses the default robotic voice.
 */
export function warmUpVoices(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
}
