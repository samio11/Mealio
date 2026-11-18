/**
 * Deterministic catalogue matching for AI-extracted item names.
 *
 * Deliberately dependency-free and free of randomness so it is unit-testable and
 * never burns AI quota. Embeddings may be layered on later, but exact/near-exact
 * matching on names + aliases covers the common case.
 */

export interface MatchableItem {
  id: string;
  nameEn: string;
  nameBn: string;
  aliases: string[];
  unit: string;
}

export interface CatalogueMatch {
  item: MatchableItem;
  score: number;
  matchedOn: string;
}

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    // Keep letters, digits and combining marks. `\p{M}` is essential: Bangla
    // vowel signs (e.g. the "ু" in আলু) and nukta are marks, and dropping them
    // would corrupt every Bangla item name.
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeName(value).split(" ").filter(Boolean));
}

/** Jaccard similarity over word tokens, with a substring bonus. */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ta = tokenSet(a);
  const tb = tokenSet(b);
  let intersection = 0;
  for (const token of ta) if (tb.has(token)) intersection += 1;
  const union = ta.size + tb.size - intersection;
  const jaccard = union === 0 ? 0 : intersection / union;

  const substringBonus = na.includes(nb) || nb.includes(na) ? 0.25 : 0;
  return Math.min(1, jaccard + substringBonus);
}

/**
 * Finds the best catalogue match for a free-text item name.
 * Returns `null` when nothing scores at or above `threshold`.
 */
export function matchCatalogueItem(
  name: string,
  items: MatchableItem[],
  threshold = 0.5,
): CatalogueMatch | null {
  let best: CatalogueMatch | null = null;

  for (const item of items) {
    const candidates = [item.nameEn, item.nameBn, ...item.aliases];
    for (const candidate of candidates) {
      const score = nameSimilarity(name, candidate);
      if (score >= threshold && (!best || score > best.score)) {
        best = { item, score, matchedOn: candidate };
      }
    }
  }

  return best;
}

/** Convenience: match many extracted names, preserving input order. */
export function matchCatalogueItems(
  names: string[],
  items: MatchableItem[],
  threshold = 0.5,
): (CatalogueMatch | null)[] {
  return names.map((name) => matchCatalogueItem(name, items, threshold));
}
