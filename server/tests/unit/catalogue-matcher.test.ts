import { describe, expect, it } from "vitest";

import {
  matchCatalogueItem,
  matchCatalogueItems,
  nameSimilarity,
  normalizeName,
  type MatchableItem,
} from "../../src/ai/catalogue-matcher.ts";

const catalogue: MatchableItem[] = [
  { id: "rice", nameEn: "Miniket Rice", nameBn: "মিনিকেট চাল", aliases: ["miniket", "chal"], unit: "KG" },
  { id: "potato", nameEn: "Potato", nameBn: "আলু", aliases: ["alu", "aloo"], unit: "KG" },
  { id: "onion", nameEn: "Onion", nameBn: "পিঁয়াজ", aliases: ["piyaj", "peyaj"], unit: "KG" },
  { id: "oil", nameEn: "Soybean Oil", nameBn: "সয়াবিন তেল", aliases: ["soyabin tel"], unit: "LITRE" },
];

describe("normalizeName", () => {
  it("lowercases, strips punctuation and collapses whitespace", () => {
    expect(normalizeName("  Soybean-Oil, 1L  ")).toBe("soybean oil 1l");
  });

  it("keeps Bangla letters intact", () => {
    expect(normalizeName("আলু")).toBe("আলু");
  });
});

describe("nameSimilarity", () => {
  it("returns 1 for an exact (normalised) match", () => {
    expect(nameSimilarity("Potato", "potato")).toBe(1);
  });

  it("scores partial overlap above zero but below 1", () => {
    const score = nameSimilarity("chicken", "broiler chicken");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("returns 0 when either side is empty", () => {
    expect(nameSimilarity("", "potato")).toBe(0);
    expect(nameSimilarity("   ", "potato")).toBe(0);
  });
});

describe("matchCatalogueItem", () => {
  it("matches on the English name", () => {
    expect(matchCatalogueItem("potato", catalogue)?.item.id).toBe("potato");
  });

  it("matches on the Bangla name", () => {
    expect(matchCatalogueItem("আলু", catalogue)?.item.id).toBe("potato");
  });

  it("matches on an alias", () => {
    expect(matchCatalogueItem("miniket", catalogue)?.item.id).toBe("rice");
    expect(matchCatalogueItem("piyaj", catalogue)?.item.id).toBe("onion");
  });

  it("matches a longer descriptive name containing the item", () => {
    expect(matchCatalogueItem("fresh soybean oil", catalogue)?.item.id).toBe("oil");
  });

  it("returns null when nothing crosses the threshold", () => {
    expect(matchCatalogueItem("toothpaste", catalogue)).toBeNull();
  });

  it("respects a custom threshold", () => {
    // "oil" alone is a weak match for "Soybean Oil" at 0.9 but fine at 0.5.
    expect(matchCatalogueItem("oil", catalogue, 0.9)).toBeNull();
    expect(matchCatalogueItem("oil", catalogue, 0.5)?.item.id).toBe("oil");
  });
});

describe("matchCatalogueItems", () => {
  it("preserves input order and returns nulls for unmatched names", () => {
    const results = matchCatalogueItems(["potato", "unknown-thing", "onion"], catalogue);
    expect(results).toHaveLength(3);
    expect(results[0]?.item.id).toBe("potato");
    expect(results[1]).toBeNull();
    expect(results[2]?.item.id).toBe("onion");
  });
});
