import type { Business, Service } from "@/lib/db/types";
import { normalizePhone } from "@/lib/utils/phone";
import type { AiMessage, ExtractedLeadData } from "@/lib/ai/types";

/**
 * Deterministic extraction over a transcript.
 *
 * Used by the mock assistant to decide what it still needs, and by
 * `extractLeadData` so a conversation that never reached a booking still
 * produces a usable lead. Everything here is conservative: it would rather
 * return null and have the assistant ask again than guess wrong.
 */

const STREET_SUFFIX =
  "(?:street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|way|place|pl|terrace|ter|circle|cir|boulevard|blvd|highway|hwy|route|rt|trail|trl)";

const PHONE_PATTERN = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const ZIP_PATTERN = /\b(0[6-9]\d{3}|1\d{4})\b/g;
const STREET_PATTERN = new RegExp(`\\b\\d{1,6}\\s+[A-Za-z0-9'.\\-]+(?:\\s+[A-Za-z0-9'.\\-]+){0,3}\\s+${STREET_SUFFIX}\\b`, "i");

/**
 * Case-insensitive on the lead-in only. "My name is Dana" has to match as
 * readily as "my name is Dana" - speech recognition capitalizes the start of
 * every sentence - while the name itself is still required to be capitalized,
 * checked after the match so "this is great" is not read as a name.
 */
const NAME_INTRO_PATTERN =
  /(?:my name is|this is|i am|i'm|it's|its|name:)\s+([A-Za-z][a-zA-Z'-]+(?:\s+[A-Za-z][a-zA-Z'-]+)?)/i;
const BARE_NAME_PATTERN = /^([A-Z][a-zA-Z'-]+)(?:\s+([A-Z][a-zA-Z'-]+))?\s*[,.]/;

/**
 * Openers that look exactly like a bare name to the pattern above.
 *
 * "Hi, I'd like a house wash." would otherwise capture a customer called Hi.
 * People open a phone call with one of these almost every time, so a greeting
 * is stripped before a bare name is read, and rejected if it survives.
 */
const GREETING_PREFIX_PATTERN =
  /^(?:hi|hey|hello|yeah|yes|yep|no|nope|ok|okay|sure|thanks|thank you|please|sorry|well|so|good (?:morning|afternoon|evening))\b[\s,.!-]*/i;

const NON_NAME_WORDS = new Set([
  "hi",
  "hey",
  "hello",
  "yeah",
  "yes",
  "yep",
  "no",
  "nope",
  "ok",
  "okay",
  "sure",
  "thanks",
  "please",
  "sorry",
  "well",
  "so",
  "morning",
  "afternoon",
  "evening",
  "actually",
  "um",
  "uh",
]);

const HUMAN_REQUEST = [
  "speak to a human",
  "talk to a human",
  "talk to a person",
  "speak to someone",
  "real person",
  "actual person",
  "call me back",
  "have someone call",
  "someone call me",
  "manager",
  "supervisor",
  "representative",
];

const COMPLAINT_SIGNALS = [
  "complaint",
  "complain",
  "refund",
  "damaged",
  "damage to",
  "ruined",
  "terrible",
  "awful",
  "unacceptable",
  "furious",
  "angry",
  "lawyer",
  "sue",
  "scam",
  "ripped me off",
  "overcharged",
  "dispute",
];

const BOOKING_SIGNALS = [
  "book",
  "schedule",
  "appointment",
  "come out",
  "availability",
  "available",
  "when can you",
  "get on the schedule",
  "set something up",
  "estimate visit",
  "slot",
];

const AFFIRMATIVE = [
  "yes",
  "yep",
  "yeah",
  "sure",
  "please",
  "sounds good",
  "that works",
  "works for me",
  "perfect",
  "great",
  "ok",
  "okay",
  "book it",
  "lets do it",
  "let's do it",
  "go ahead",
];

function lastUserMessage(messages: AiMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") return messages[index].content;
  }
  return "";
}

function userText(messages: AiMessage[]): string {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n");
}

export function includesAny(haystack: string, needles: readonly string[]): boolean {
  const lowered = haystack.toLowerCase();
  return needles.some((needle) => lowered.includes(needle));
}

export function isAffirmative(message: string): boolean {
  const cleaned = message.toLowerCase().replace(/[^a-z' ]/g, " ").trim();
  if (!cleaned) return false;
  if (AFFIRMATIVE.includes(cleaned)) return true;
  return AFFIRMATIVE.some((phrase) => cleaned.startsWith(`${phrase} `) || cleaned === phrase);
}

/** Keywords that map free text onto a configured service. */
function serviceKeywords(service: Service): string[] {
  const base = service.name.toLowerCase();
  const extra: Record<string, string[]> = {
    "house-washing": ["house wash", "house washing", "siding", "vinyl", "stucco", "exterior of my house", "wash my house", "home wash"],
    "pressure-washing": ["pressure wash", "pressure washing"],
    "power-washing": ["power wash", "power washing"],
    "painting-staining": ["paint", "painting", "stain", "staining", "deck stain"],
    "roof-cleaning": ["roof", "shingle", "black streak", "streaks on my roof", "moss", "lichen", "algae on the roof", "roof clean"],
    "window-cleaning": ["window", "windows", "window cleaning", "glass"],
    "concrete-cleaning": ["driveway", "concrete", "sidewalk", "walkway", "paver", "pavers", "patio", "coolcrete"],
    "gutter-cleaning": ["gutter", "gutters", "downspout"],
    "fence-cleaning": ["fence", "cedar fence", "vinyl fence"],
    "graffiti-removal": ["graffiti"],
    "commercial-pressure-washing": ["commercial", "storefront", "property manager", "office", "warehouse"],
    "christmas-light-installation": ["christmas light", "holiday light", "christmas lights"],
  };

  return [base, service.slug.replace(/-/g, " "), ...(extra[service.slug] ?? [])];
}

export function matchService(text: string, services: Service[]): Service | null {
  const lowered = text.toLowerCase();
  let best: { service: Service; score: number } | null = null;

  for (const service of services) {
    if (!service.active) continue;
    for (const keyword of serviceKeywords(service)) {
      if (lowered.includes(keyword)) {
        const score = keyword.length;
        if (!best || score > best.score) best = { service, score };
      }
    }
  }

  return best?.service ?? null;
}

export function extractPhone(text: string): string | null {
  const matches = text.match(PHONE_PATTERN) ?? [];
  for (const match of matches) {
    const normalized = normalizePhone(match);
    if (normalized) return normalized;
  }
  return null;
}

export function extractEmail(text: string): string | null {
  const match = text.match(EMAIL_PATTERN);
  return match ? match[0].toLowerCase() : null;
}

export function extractZip(text: string): string | null {
  // Strip phone numbers first so their digits cannot masquerade as a ZIP.
  const withoutPhones = text.replace(PHONE_PATTERN, " ");
  const match = withoutPhones.match(ZIP_PATTERN);
  return match ? match[0] : null;
}

export function extractStreet(text: string): string | null {
  const match = text.match(STREET_PATTERN);
  if (!match) return null;
  return match[0].replace(/\s+/g, " ").trim();
}

export function extractTown(text: string, business: Business): string | null {
  const lowered = text.toLowerCase();
  const towns = business.settings.serviceArea.towns;
  // Longest town name first so "Basking Ridge" beats a substring match.
  const sorted = [...towns].sort((a, b) => b.length - a.length);
  return sorted.find((town) => lowered.includes(town.toLowerCase())) ?? null;
}

export function extractName(text: string): { firstName: string | null; lastName: string | null } {
  const intro = NAME_INTRO_PATTERN.exec(text);
  if (intro) {
    const [first, last] = intro[1].split(/\s+/);
    const capitalized = Boolean(first) && /^[A-Z]/.test(first);
    if (capitalized && !NON_NAME_WORDS.has(first.toLowerCase())) {
      return { firstName: first, lastName: last && /^[A-Z]/.test(last) ? last : null };
    }
  }

  for (const line of text.split("\n")) {
    const bare = BARE_NAME_PATTERN.exec(line.trim().replace(GREETING_PREFIX_PATTERN, ""));
    if (!bare) continue;
    if (NON_NAME_WORDS.has((bare[1] ?? "").toLowerCase())) continue;
    return { firstName: bare[1] ?? null, lastName: bare[2] ?? null };
  }

  return { firstName: null, lastName: null };
}

export interface ConversationState extends ExtractedLeadData {
  wantsHuman: boolean;
  isComplaint: boolean;
  wantsBooking: boolean;
  affirmative: boolean;
  lastUserMessage: string;
  service: Service | null;
}

export function deriveState(
  messages: AiMessage[],
  business: Business,
  services: Service[],
): ConversationState {
  const all = userText(messages);
  const latest = lastUserMessage(messages);
  const { firstName, lastName } = extractName(all);
  const service = matchService(all, services);
  const town = extractTown(all, business);

  return {
    firstName,
    lastName,
    phone: extractPhone(all),
    email: extractEmail(all),
    town,
    street: extractStreet(all),
    zip: extractZip(all),
    serviceSlug: service?.slug ?? null,
    notes: latest.slice(0, 500) || null,
    service,
    wantsHuman: includesAny(all, HUMAN_REQUEST),
    isComplaint: includesAny(all, COMPLAINT_SIGNALS),
    wantsBooking: includesAny(all, BOOKING_SIGNALS),
    affirmative: isAffirmative(latest),
    lastUserMessage: latest,
  };
}
