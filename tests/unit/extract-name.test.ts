import { describe, expect, it } from "vitest";

import { extractName } from "@/lib/ai/extract";

/**
 * Spoken callers open with a greeting far more often than typed ones, and the
 * bare-name pattern is anchored at the start of a line - so an unguarded
 * "Hi, ..." books a customer called Hi.
 */
describe("extractName", () => {
  it("reads a name introduced explicitly", () => {
    expect(extractName("My name is Dana Alvarez and I need a quote")).toEqual({
      firstName: "Dana",
      lastName: "Alvarez",
    });
  });

  it("reads a name introduced at the start of a sentence", () => {
    // Speech recognition capitalizes every sentence, so the lead-in has to
    // match regardless of case.
    expect(extractName("my name is Dana Alvarez")).toEqual({
      firstName: "Dana",
      lastName: "Alvarez",
    });
  });

  it("does not treat the words after a lead-in as a name when they are not one", () => {
    expect(extractName("This is great, thanks").firstName).toBeNull();
    expect(extractName("I'm looking for a quote").firstName).toBeNull();
  });

  it("reads a bare name at the start of a line", () => {
    expect(extractName("Dana Alvarez, 973-555-0190.")).toEqual({
      firstName: "Dana",
      lastName: "Alvarez",
    });
  });

  it.each([
    "Hi, I'd like to book a house wash.",
    "Hello, how much for the roof?",
    "Hey, are you open Saturday?",
    "Yes, that works.",
    "Okay, thanks.",
    "Sure, go ahead.",
    "Thanks, I'll think about it.",
    "Good morning, do you do gutters?",
  ])("does not read the greeting in %j as a name", (line) => {
    expect(extractName(line).firstName).toBeNull();
  });

  it("still finds the name after a greeting", () => {
    expect(extractName("Hi, Dana Alvarez, 973-555-0190.")).toEqual({
      firstName: "Dana",
      lastName: "Alvarez",
    });
  });

  it("returns nothing when there is no name", () => {
    expect(extractName("how much to wash a two storey colonial")).toEqual({
      firstName: null,
      lastName: null,
    });
  });
});
