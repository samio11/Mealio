import { describe, expect, it } from "vitest";

import {
  assignmentCounts,
  buildDutySequence,
  extraAssignmentIndices,
  planDuties,
  rotationOffsetForMonth,
} from "../../src/modules/bazar-duty/duty-scheduler.ts";

const members = (count: number): string[] => Array.from({ length: count }, (_, i) => `member-${i + 1}`);

const monthDates = (year: number, month: number): string[] => {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`);
};

describe("duty scheduler — counts", () => {
  it("gives every member the same share when days divide evenly (5 members / 30 days)", () => {
    const counts = assignmentCounts(5, 30, 0);
    expect(counts).toEqual([6, 6, 6, 6, 6]);
  });

  it("distributes the remainder one at a time (5 members / 31 days)", () => {
    const counts = assignmentCounts(5, 31, 0);
    expect(counts).toEqual([7, 6, 6, 6, 6]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(31);
    expect(Math.max(...counts) - Math.min(...counts)).toBe(1);
  });

  it("rotates the extra assignment between members across months", () => {
    expect(assignmentCounts(5, 31, 0)[0]).toBe(7);
    expect(assignmentCounts(5, 31, 1)[1]).toBe(7);
    expect(assignmentCounts(5, 31, 2)[2]).toBe(7);
    // A full lap wraps back to the first member.
    expect(assignmentCounts(5, 31, 5)[0]).toBe(7);
  });

  it("returns no extra indices when nothing remains", () => {
    expect(extraAssignmentIndices(5, 0, 3)).toEqual([]);
    expect(extraAssignmentIndices(0, 2, 0)).toEqual([]);
  });

  it("handles negative rotation offsets without producing a negative index", () => {
    const indices = extraAssignmentIndices(5, 2, -1);
    expect(indices).toEqual([4, 0]);
  });

  it("returns an empty plan when there are no members", () => {
    expect(assignmentCounts(0, 30, 0)).toEqual([]);
  });
});

describe("duty scheduler — sequence", () => {
  it("cycles members round-robin so the same member is never adjacent", () => {
    const sequence = buildDutySequence([6, 6, 6, 6, 6]);
    expect(sequence).toHaveLength(30);
    for (let i = 1; i < sequence.length; i += 1) {
      expect(sequence[i]).not.toBe(sequence[i - 1]);
    }
  });

  it("consumes exactly the requested quotas", () => {
    const sequence = buildDutySequence([7, 6, 6, 6, 6]);
    const tally = [0, 0, 0, 0, 0];
    for (const index of sequence) tally[index] = (tally[index] ?? 0) + 1;
    expect(tally).toEqual([7, 6, 6, 6, 6]);
    expect(sequence).toHaveLength(31);
  });
});

describe("duty scheduler — planDuties", () => {
  it("assigns every date exactly once for 5 members over a 30-day month", () => {
    const dates = monthDates(2026, 4); // April = 30 days
    const plan = planDuties(members(5), dates, rotationOffsetForMonth(2026, 4));

    expect(plan).toHaveLength(30);
    expect(plan.map((slot) => slot.date)).toEqual(dates);

    const tally = [0, 0, 0, 0, 0];
    for (const slot of plan) {
      expect(slot.memberIndex).not.toBeNull();
      tally[slot.memberIndex as number] = (tally[slot.memberIndex as number] ?? 0) + 1;
    }
    expect(tally).toEqual([6, 6, 6, 6, 6]);
  });

  it("gives one member an extra duty in a 31-day month", () => {
    const plan = planDuties(members(5), monthDates(2026, 12), rotationOffsetForMonth(2026, 12));
    const tally = [0, 0, 0, 0, 0];
    for (const slot of plan) tally[slot.memberIndex as number] = (tally[slot.memberIndex as number] ?? 0) + 1;
    expect(plan).toHaveLength(31);
    expect(Math.max(...tally)).toBe(7);
    expect(Math.min(...tally)).toBe(6);
  });

  it("is deterministic: identical inputs always produce identical output", () => {
    const dates = monthDates(2026, 3);
    const first = planDuties(members(4), dates, rotationOffsetForMonth(2026, 3));
    const second = planDuties(members(4), dates, rotationOffsetForMonth(2026, 3));
    expect(second).toEqual(first);
  });

  it("leaves an excluded (unavailable) member without assignments", () => {
    // Member 3 is unavailable for the month, so they are simply not eligible.
    const eligible = [members(5)[0], members(5)[1], members(5)[3], members(5)[4]] as string[];
    const plan = planDuties(eligible, monthDates(2026, 12), 0);
    expect(plan.every((slot) => slot.memberIndex !== null && slot.memberIndex < 4)).toBe(true);
    // 31 days / 4 members = 7 each + 3 extras.
    const tally = [0, 0, 0, 0];
    for (const slot of plan) tally[slot.memberIndex as number] = (tally[slot.memberIndex as number] ?? 0) + 1;
    expect(tally.reduce((a, b) => a + b, 0)).toBe(31);
    expect(Math.max(...tally) - Math.min(...tally)).toBe(1);
  });

  it("marks every date unassigned when no member is eligible", () => {
    const dates = monthDates(2026, 4);
    const plan = planDuties([], dates, 0);
    expect(plan).toEqual(dates.map((date) => ({ date, memberIndex: null })));
  });
});

describe("rotationOffsetForMonth", () => {
  it("is stable and strictly increases month over month", () => {
    expect(rotationOffsetForMonth(2026, 1)).toBe(2026 * 12);
    expect(rotationOffsetForMonth(2026, 2)).toBe(rotationOffsetForMonth(2026, 1) + 1);
    expect(rotationOffsetForMonth(2026, 12)).toBe(rotationOffsetForMonth(2027, 1) - 1);
  });
});
