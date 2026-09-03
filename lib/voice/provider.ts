import { env } from "@/lib/env";
import { logger } from "@/lib/logging/logger";
import { verifyHmacSignature } from "@/lib/sms/providers";

export interface VoiceCallSummary {
  providerCallId: string;
  status: "in_progress" | "completed" | "missed" | "failed" | "voicemail";
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  transcript: string | null;
  summary: string | null;
  recordingUrl: string | null;
}

export interface StartCallInput {
  to: string;
  from: string;
  /** Context handed to the voice agent so it can greet the caller correctly. */
  metadata?: Record<string, string>;
}

/**
 * Telephony surface. The application never imports Vapi/Retell/Twilio types —
 * webhooks are normalized into `VoiceCallSummary` before anything downstream
 * sees them, so the AI agent, CRM and booking code are vendor-agnostic.
 */
export interface VoiceProvider {
  readonly name: string;
  startOutboundCall(input: StartCallInput): Promise<VoiceCallSummary>;
  getCall(providerCallId: string): Promise<VoiceCallSummary | null>;
  /** Hands the live call to a human. */
  transferCall(providerCallId: string, toNumber: string): Promise<void>;
  verifyWebhook(rawBody: string, headers: Headers): boolean;
}

/**
 * Development transport. Real outbound dialling is explicitly out of scope for
 * this build; the mock keeps an in-process call log so the webhook path,
 * missed-call automation and CRM timeline are all exercisable end to end.
 */
export class MockVoiceProvider implements VoiceProvider {
  readonly name = "mock";

  private readonly calls = new Map<string, VoiceCallSummary>();
  private counter = 0;

  async startOutboundCall(input: StartCallInput): Promise<VoiceCallSummary> {
    this.counter += 1;
    const providerCallId = `mock-call-${Date.now()}-${this.counter}`;
    const call: VoiceCallSummary = {
      providerCallId,
      status: "in_progress",
      direction: "outbound",
      from: input.from,
      to: input.to,
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationSeconds: null,
      transcript: null,
      summary: null,
      recordingUrl: null,
    };
    this.calls.set(providerCallId, call);

    logger.info("outbound call started", {
      provider: this.name,
      event: "voice.start",
      to: input.to,
      providerCallId,
    });

    return call;
  }

  async getCall(providerCallId: string): Promise<VoiceCallSummary | null> {
    return this.calls.get(providerCallId) ?? null;
  }

  async transferCall(providerCallId: string, toNumber: string): Promise<void> {
    logger.info("call transferred", {
      provider: this.name,
      event: "voice.transfer",
      providerCallId,
      to: toNumber,
    });
  }

  verifyWebhook(rawBody: string, headers: Headers): boolean {
    return verifyHmacSignature(rawBody, headers, env.VOICE_WEBHOOK_SECRET);
  }
}

/**
 * Vendor seats. Selecting one without an implementation fails loudly at call
 * time rather than pretending a call was placed — see `docs/VOICE.md` for what
 * each adapter needs.
 */
abstract class UnconfiguredVoiceProvider implements VoiceProvider {
  abstract readonly name: string;
  protected abstract readonly setupHint: string;

  private fail(): never {
    throw new Error(
      `Voice provider "${this.name}" is selected but outbound telephony is not implemented in this build. ${this.setupHint} ` +
        "Set VOICE_PROVIDER=mock to run without a telephony vendor.",
    );
  }

  async startOutboundCall(): Promise<VoiceCallSummary> {
    this.fail();
  }
  async getCall(): Promise<VoiceCallSummary | null> {
    this.fail();
  }
  async transferCall(): Promise<void> {
    this.fail();
  }
  verifyWebhook(rawBody: string, headers: Headers): boolean {
    // Inbound webhooks are still verifiable without the outbound API.
    return verifyHmacSignature(rawBody, headers, env.VOICE_WEBHOOK_SECRET);
  }
}

export class VapiVoiceProvider extends UnconfiguredVoiceProvider {
  readonly name = "vapi";
  protected readonly setupHint =
    "Implement against the Vapi /call endpoints with VOICE_PROVIDER_API_KEY and an assistant configured to call this app's tool endpoints.";
}

export class RetellVoiceProvider extends UnconfiguredVoiceProvider {
  readonly name = "retell";
  protected readonly setupHint =
    "Implement against the Retell create-phone-call API with VOICE_PROVIDER_API_KEY.";
}

export class TwilioVoiceProvider extends UnconfiguredVoiceProvider {
  readonly name = "twilio";
  protected readonly setupHint =
    "Implement against the Twilio Calls resource plus a media-stream bridge to the AI agent.";
}

const globalRef = globalThis as unknown as { __ipwVoiceProvider?: VoiceProvider };

export function getVoiceProvider(): VoiceProvider {
  if (!globalRef.__ipwVoiceProvider) {
    switch (env.VOICE_PROVIDER) {
      case "vapi":
        globalRef.__ipwVoiceProvider = new VapiVoiceProvider();
        break;
      case "retell":
        globalRef.__ipwVoiceProvider = new RetellVoiceProvider();
        break;
      case "twilio":
        globalRef.__ipwVoiceProvider = new TwilioVoiceProvider();
        break;
      default:
        globalRef.__ipwVoiceProvider = new MockVoiceProvider();
    }
  }
  return globalRef.__ipwVoiceProvider;
}

export function setVoiceProvider(provider: VoiceProvider) {
  globalRef.__ipwVoiceProvider = provider;
}
