import { describe, expect, it } from "vitest";

import {
  allocateByWeights,
  divideRoundHalfUp,
  formatTaka,
  multiplyPoishaByQuantity,
  poishaToTakaString,
  takaToPoisha,
} from "../../src/app/utils/money.ts";

describe("takaToPoisha", () => {
  it("converts whole taka", () => {
    expect(takaToPoisha("1000")).toBe(100000n);
    expect(takaToPoisha(1000)).toBe(100000n);
  });

  it("converts two-decimal taka exactly", () => {
    expect(takaToPoisha("1234.50")).toBe(123450n);
    expect(takaToPoisha("0.01")).toBe(1n);
  });

  it("rounds a third decimal half-up", () => {
    expect(takaToPoisha("1.005")).toBe(101n);
    expect(takaToPoisha("1.004")).toBe(100n);
  });

  it("handles negatives and thousands separators", () => {
    expect(takaToPoisha("-2.50")).toBe(-250n);
    expect(takaToPoisha("1,234.00")).toBe(123400n);
  });

  it("rejects nonsense", () => {
    expect(() => takaToPoisha("abc")).toThrow();
    expect(() => takaToPoisha("")).toThrow();
    expect(() => takaToPoisha("1.2.3")).toThrow();
  });
});

describe("poisha rendering", () => {
  it("renders exactly two decimals", () => {
    expect(poishaToTakaString(123450n)).toBe("1234.50");
    expect(poishaToTakaString(5n)).toBe("0.05");
    expect(poishaToTakaString(-5n)).toBe("-0.05");
  });

  it("formats with the taka sign and separators", () => {
    expect(formatTaka(123450n)).toBe("৳1,234.50");
    expect(formatTaka(0n)).toBe("৳0.00");
  });
});

describe("divideRoundHalfUp", () => {
  it("rounds half up", () => {
    expect(divideRoundHalfUp(10n, 4n)).toBe(3n); // 2.5 -> 3
    expect(divideRoundHalfUp(10n, 3n)).toBe(3n); // 3.33 -> 3
    expect(divideRoundHalfUp(10000n, 3n)).toBe(3333n);
  });

  it("keeps the sign of the result", () => {
    expect(divideRoundHalfUp(-10n, 4n)).toBe(-3n);
    expect(divideRoundHalfUp(10n, -4n)).toBe(-3n);
  });

  it("still rounds exact divisions", () => {
    expect(divideRoundHalfUp(9n, 3n)).toBe(3n);
  });

  it("throws on division by zero", () => {
    expect(() => divideRoundHalfUp(1n, 0n)).toThrow();
  });
});

describe("multiplyPoishaByQuantity", () => {
  it("multiplies a unit price by a fractional quantity", () => {
    // ৳125.50 per kg × 1.750 kg = 219.625 taka -> 21963 poisha
    expect(multiplyPoishaByQuantity(12550n, "1.750")).toBe(21963n);
  });

  it("is exact for whole quantities", () => {
    expect(multiplyPoishaByQuantity(12550n, 2)).toBe(25100n);
    expect(multiplyPoishaByQuantity(12550n, "0.5")).toBe(6275n);
  });

  it("rejects invalid quantities", () => {
    expect(() => multiplyPoishaByQuantity(100n, "1.2345")).toThrow();
    expect(() => multiplyPoishaByQuantity(100n, "-1")).toThrow();
  });
});

describe("allocateByWeights", () => {
  it("splits an indivisible total without losing poisha", () => {
    const parts = allocateByWeights(100n, [1n, 1n, 1n]);
    expect(parts.reduce((a, b) => a + b, 0n)).toBe(100n);
    expect(parts).toEqual([34n, 33n, 33n]);
  });

  it("never loses or invents poisha for awkward ratios", () => {
    const cases: { total: bigint; weights: bigint[] }[] = [
      { total: 1000n, weights: [1n, 2n, 3n, 4n] },
      { total: 7n, weights: [5n, 5n, 5n] },
      { total: 1n, weights: [1n, 1n] },
      { total: 99999n, weights: [13n, 17n, 19n, 23n, 29n] },
    ];
    for (const { total, weights } of cases) {
      const parts = allocateByWeights(total, weights);
      expect(parts.reduce((a, b) => a + b, 0n)).toBe(total);
      expect(parts).toHaveLength(weights.length);
    }
  });

  it("treats non-positive weights as zero", () => {
    const parts = allocateByWeights(100n, [1n, 0n, -5n]);
    expect(parts).toEqual([100n, 0n, 0n]);
  });

  it("returns zeros when every weight is zero (no meals recorded)", () => {
    expect(allocateByWeights(100n, [0n, 0n])).toEqual([0n, 0n]);
  });

  it("is proportional when the split is exact", () => {
    expect(allocateByWeights(600n, [1n, 2n, 3n])).toEqual([100n, 200n, 300n]);
  });
});
