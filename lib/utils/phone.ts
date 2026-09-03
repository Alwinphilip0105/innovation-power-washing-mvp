/**
 * Phone normalization. Used as the de-duplication key for customers, so it has
 * to be deterministic and lossless for US numbers.
 */

/** Returns E.164 (`+1XXXXXXXXXX`) for US numbers, or null when unparseable. */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = String(input).trim();
  if (!trimmed) return null;

  const hadPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (!hadPlus) {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    // Not a shape we recognise as US — reject rather than guess.
    return null;
  }

  // Explicit international number: keep it, but sanity-check the length.
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

export function isValidPhone(input: string | null | undefined): boolean {
  return normalizePhone(input) !== null;
}

/** `+15551234567` -> `(555) 123-4567`. Falls back to the input when not US. */
export function formatPhone(input: string | null | undefined): string {
  const normalized = normalizePhone(input);
  if (!normalized) return input ?? "";

  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(normalized);
  if (!match) return normalized;
  return `(${match[1]}) ${match[2]}-${match[3]}`;
}

/** Lowercased + trimmed. Used as a secondary de-duplication key. */
export function normalizeEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  return normalized || null;
}
