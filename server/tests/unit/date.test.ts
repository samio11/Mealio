import { describe, expect, it } from "vitest";

import {
  daysInMonth,
  dhakaInstant,
  dhakaMonthRange,
  eachDateOfMonth,
  fromDateOnly,
  hasDhakaCutoffPassed,
  hhmmToMinutes,
  minutesToHhmm,
  toDateOnly,
  toDhakaDateString,
} from "../../src/app/utils/date.ts";

describe("Dhaka calendar dates", () => {
  it("stores a calendar date as UTC midnight", () => {
    expect(toDateOnly("2026-11-17").toISOString()).toBe("2026-11-17T00:00:00.000Z");
  });

  it("round-trips a @db.Date value", () => {
    expect(fromDateOnly(toDateOnly("2026-02-01"))).toBe("2026-02-01");
  });

  it("shifts an instant across the +06:00 boundary into the correct Dhaka date", () => {
    // 19:00 UTC on the 17th is 01:00 on the 18th in Dhaka.
    expect(toDhakaDateString(new Date("2026-11-17T19:00:00Z"))).toBe("2026-11-18");
    // 17:59 UTC is still the 17th in Dhaka.
    expect(toDhakaDateString(new Date("2026-11-17T17:59:59Z"))).toBe("2026-11-17");
  });
});

describe("meal cut-off instants", () => {
  it("maps a Dhaka wall-clock time to the exact UTC instant", () => {
    // 08:00 Dhaka = 02:00 UTC
    expect(dhakaInstant("2026-11-17", 8 * 60).toISOString()).toBe("2026-11-17T02:00:00.000Z");
    // 20:00 Dhaka = 14:00 UTC
    expect(dhakaInstant("2026-11-17", 20 * 60).toISOString()).toBe("2026-11-17T14:00:00.000Z");
  });

  it("treats midnight Dhaka as the previous day 18:00 UTC", () => {
    expect(dhakaInstant("2026-11-17", 0).toISOString()).toBe("2026-11-16T18:00:00.000Z");
  });

  it("uses Dhaka wall-clock time when determining whether a cut-off has passed", () => {
    const cutoff = 8 * 60;
    expect(hasDhakaCutoffPassed("2026-11-18", cutoff, new Date("2026-11-18T01:59:59Z"))).toBe(false);
    expect(hasDhakaCutoffPassed("2026-11-18", cutoff, new Date("2026-11-18T02:00:00Z"))).toBe(false);
    expect(hasDhakaCutoffPassed("2026-11-18", cutoff, new Date("2026-11-18T02:00:01Z"))).toBe(true);
  });
});

describe("month boundaries", () => {
  it("covers a Dhaka month with start inclusive / end exclusive", () => {
    const { start, end } = dhakaMonthRange(2026, 11);
    expect(start.toISOString()).toBe("2026-10-31T18:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-30T18:00:00.000Z");
  });

  it("rolls December over into the next year", () => {
    const { end } = dhakaMonthRange(2026, 12);
    expect(end.toISOString()).toBe("2026-12-31T18:00:00.000Z");
  });

  it("knows month lengths including leap Februaries", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 11)).toBe(30);
  });

  it("lists every calendar date of a month", () => {
    const days = eachDateOfMonth(2026, 2);
    expect(days).toHaveLength(28);
    expect(days[0]).toBe("2026-02-01");
    expect(days[27]).toBe("2026-02-28");
  });
});

describe("HH:MM helpers", () => {
  it("converts both ways", () => {
    expect(hhmmToMinutes("08:00")).toBe(480);
    expect(hhmmToMinutes("20:00")).toBe(1200);
    expect(minutesToHhmm(1200)).toBe("20:00");
    expect(minutesToHhmm(0)).toBe("00:00");
  });

  it("rejects invalid times", () => {
    expect(() => hhmmToMinutes("24:00")).toThrow();
    expect(() => hhmmToMinutes("8:00")).toThrow();
    expect(() => hhmmToMinutes("08:60")).toThrow();
  });
});
