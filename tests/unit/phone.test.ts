import { describe, expect, it } from "vitest";

import { formatPhone, isValidPhone, normalizeEmail, normalizePhone } from "@/lib/utils/phone";

describe("normalizePhone", () => {
  it("normalizes every common US format to the same E.164 key", () => {
    const variants = [
      "9085550142",
      "908-555-0142",
      "(908) 555-0142",
      "908.555.0142",
      " 908 555 0142 ",
      "19085550142",
      "+1 (908) 555-0142",
    ];

    for (const variant of variants) {
      expect(normalizePhone(variant), variant).toBe("+19085550142");
    }
  });

  it("rejects input that is not a plausible phone number", () => {
    for (const value of ["", "   ", "abc", "555", "12345", "0123456789012345678", null, undefined]) {
      expect(normalizePhone(value)).toBeNull();
    }
  });

  it("does not silently coerce a 9-digit number into a 10-digit one", () => {
    expect(normalizePhone("908555014")).toBeNull();
  });

  it("keeps an explicitly international number", () => {
    expect(normalizePhone("+442071234567")).toBe("+442071234567");
  });

  it("formats US numbers for display and leaves others alone", () => {
    expect(formatPhone("9085550142")).toBe("(908) 555-0142");
    expect(formatPhone("+442071234567")).toBe("+442071234567");
    expect(formatPhone(null)).toBe("");
  });

  it("agrees with isValidPhone", () => {
    expect(isValidPhone("(732) 555-0137")).toBe(true);
    expect(isValidPhone("nope")).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims so duplicates collapse", () => {
    expect(normalizeEmail("  Karen.Whitfield@Example.COM ")).toBe("karen.whitfield@example.com");
  });

  it("treats blank input as absent", () => {
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});
