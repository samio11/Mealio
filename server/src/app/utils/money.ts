/**
 * Money is ALWAYS handled as integer poisha (1 BDT = 100 poisha).
 * Floating point is never used for financial arithmetic.
 */

export const POISHA_PER_TAKA = 100n;

/** Parse a taka amount (string or number) into integer poisha, half-up on the third decimal. */
export function takaToPoisha(value: string | number): bigint {
  const raw = typeof value === "number" ? value.toString() : value.trim().replace(/,/g, "");
  if (raw === "" || !/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`Invalid taka amount: ${String(value)}`);
  }
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const fractionPadded = (fraction + "00").slice(0, 3);
  const poisha = BigInt(whole) * POISHA_PER_TAKA + BigInt(fractionPadded.slice(0, 2));
  const remainder = Number(fractionPadded[2] ?? "0");
  const rounded = remainder >= 5 ? poisha + 1n : poisha;
  return negative ? -rounded : rounded;
}

/** Render integer poisha as a plain taka string with exactly 2 decimals, e.g. "1234.50". */
export function poishaToTakaString(poisha: bigint): string {
  const negative = poisha < 0n;
  const abs = negative ? -poisha : poisha;
  const whole = abs / POISHA_PER_TAKA;
  const paisa = abs % POISHA_PER_TAKA;
  return `${negative ? "-" : ""}${whole}.${paisa.toString().padStart(2, "0")}`;
}

/** Human-readable BDT string for UI/notifications, e.g. "৳1,234.50". */
export function formatTaka(poisha: bigint): string {
  const value = poishaToTakaString(poisha);
  const negative = value.startsWith("-");
  const [whole = "0", fraction = "00"] = (negative ? value.slice(1) : value).split(".");
  const withSeparators = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}৳${withSeparators}.${fraction}`;
}

/** Integer division with half-up rounding (used for meal rate and allocations). */
export function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error("Division by zero");
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const quotient = n / d;
  const remainder = n % d;
  const rounded = remainder * 2n >= d ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

/**
 * Multiply a poisha unit price by a (possibly fractional) quantity, rounding half-up.
 * Quantity is expressed in the item's unit (e.g. kg, litre) and may have up to 3 decimals.
 */
export function multiplyPoishaByQuantity(unitPricePoisha: bigint, quantity: number | string): bigint {
  const raw = typeof quantity === "number" ? quantity.toString() : quantity.trim();
  if (raw === "" || !/^\d+(\.\d{1,3})?$/.test(raw)) {
    throw new Error(`Invalid quantity: ${String(quantity)}`);
  }
  const [whole = "0", fraction = ""] = raw.split(".");
  const fractionPadded = (fraction + "000").slice(0, 3);
  const scale = 1000n;
  const scaledQuantity = BigInt(whole) * scale + BigInt(fractionPadded);
  const product = unitPricePoisha * scaledQuantity;
  return divideRoundHalfUp(product, scale);
}

/** Distribute a total across weights so the parts sum EXACTLY to the total (largest-remainder method). */
export function allocateByWeights(total: bigint, weights: bigint[]): bigint[] {
  const positive = weights.map((w) => (w > 0n ? w : 0n));
  const totalWeight = positive.reduce((a, b) => a + b, 0n);
  if (totalWeight === 0n) return weights.map(() => 0n);

  const raw = positive.map((w) => (total * w) / totalWeight);
  let distributed = raw.reduce((a, b) => a + b, 0n);
  let remainder = total - distributed;

  // Hand out leftover poisha one at a time, largest fractional part first.
  const order = positive
    .map((w, index) => ({ index, frac: (total * w) % totalWeight }))
    .sort((a, b) => (b.frac === a.frac ? a.index - b.index : b.frac > a.frac ? 1 : -1));

  const result = [...raw];
  let cursor = 0;
  const step = remainder < 0n ? -1n : 1n;
  while (remainder !== 0n && order.length > 0) {
    const target = order[cursor % order.length];
    if (target) {
      result[target.index] = (result[target.index] ?? 0n) + step;
      remainder -= step;
    }
    cursor += 1;
  }
  distributed = result.reduce((a, b) => a + b, 0n);
  return result;
}
