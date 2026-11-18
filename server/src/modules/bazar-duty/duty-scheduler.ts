/**
 * Deterministic bazar-duty scheduler.
 *
 * Rules (from the master prompt):
 *   base = floor(numberOfDays / eligibleMembers)
 *   - every eligible member gets `base` assignments
 *   - the remainder is distributed one at a time
 *   - the "extra" assignment rotates between members across months
 *   - avoid assigning the same member on adjacent dates where possible
 *
 * The function is pure and has no randomness: identical inputs always produce
 * identical output, which makes it fully testable.
 */

export interface DutySlot {
  date: string;
  memberIndex: number | null;
}

/** Member indices (into the eligible list) that receive one extra assignment. */
export function extraAssignmentIndices(memberCount: number, remainder: number, rotationOffset: number): number[] {
  if (memberCount === 0 || remainder <= 0) return [];
  const offset = ((rotationOffset % memberCount) + memberCount) % memberCount;
  return Array.from({ length: remainder }, (_, i) => (offset + i) % memberCount);
}

/** Per-member assignment counts for a month. */
export function assignmentCounts(memberCount: number, slotCount: number, rotationOffset: number): number[] {
  if (memberCount === 0) return [];
  const base = Math.floor(slotCount / memberCount);
  const remainder = slotCount % memberCount;
  const counts = new Array<number>(memberCount).fill(base);
  for (const index of extraAssignmentIndices(memberCount, remainder, rotationOffset)) {
    counts[index] = (counts[index] ?? 0) + 1;
  }
  return counts;
}

/**
 * Builds the ordered list of assignments by cycling through members
 * round-robin, skipping members whose quota is exhausted. Round-robin ordering
 * keeps the same member from appearing on adjacent dates whenever more than one
 * member is eligible.
 */
export function buildDutySequence(counts: number[]): number[] {
  const remaining = [...counts];
  const total = remaining.reduce((sum, value) => sum + value, 0);
  const sequence: number[] = [];
  let guard = 0;
  const guardLimit = total * remaining.length + 1;

  while (sequence.length < total && guard < guardLimit) {
    guard += 1;
    for (let index = 0; index < remaining.length; index += 1) {
      if ((remaining[index] ?? 0) > 0) {
        sequence.push(index);
        remaining[index] = (remaining[index] ?? 0) - 1;
      }
    }
  }
  return sequence;
}

/**
 * Plans assignments for a set of dates. `rotationOffset` should be derived from
 * the calendar month so extra duties rotate fairly from month to month.
 */
export function planDuties(memberIds: string[], dates: string[], rotationOffset: number): DutySlot[] {
  if (memberIds.length === 0) return dates.map((date) => ({ date, memberIndex: null }));
  const counts = assignmentCounts(memberIds.length, dates.length, rotationOffset);
  const sequence = buildDutySequence(counts);
  return dates.map((date, index) => ({ date, memberIndex: sequence[index] ?? null }));
}

/** Stable rotation seed for a calendar month: e.g. 2026-03 -> 24315. */
export function rotationOffsetForMonth(year: number, month: number): number {
  return year * 12 + (month - 1);
}
