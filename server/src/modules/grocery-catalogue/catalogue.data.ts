import type { Unit } from "../../generated/prisma/enums.ts";

/**
 * Canonical Bangladeshi grocery catalogue.
 *
 * These rows are seeded with `messId = null` (global / shared) and
 * `isCustom = false`. Messes may add their own custom items, which are stored
 * with a `messId` and `isCustom = true`.
 *
 * `aliases` exist so Bangla/English/transliterated searches and AI product
 * matching all resolve to the same item.
 */
export interface CatalogueSeedItem {
  nameEn: string;
  nameBn: string;
  aliases: string[];
  category: string;
  unit: Unit;
  brand?: string;
}

export const CATALOGUE_CATEGORIES = [
  "Staples",
  "Pulses",
  "Vegetables",
  "Protein",
  "Cooking Essentials",
  "Dairy & Breakfast",
  "Other",
] as const;

export const CATALOGUE_SEED: CatalogueSeedItem[] = [
  // Staples
  { nameEn: "Miniket rice", nameBn: "মিনিকেট চাল", aliases: ["miniket", "miniket chal", "মিনিকেট"], category: "Staples", unit: "KG" },
  { nameEn: "Nazirshail rice", nameBn: "নাজিরশাইল চাল", aliases: ["nazirshail", "nazirshail chal"], category: "Staples", unit: "KG" },
  { nameEn: "Coarse rice", nameBn: "মোটা চাল", aliases: ["mota chal", "coarse rice", "atap chal"], category: "Staples", unit: "KG" },
  { nameEn: "Atta (whole wheat flour)", nameBn: "আটা", aliases: ["atta", "ata", "আটা"], category: "Staples", unit: "KG" },
  { nameEn: "Flour (maida)", nameBn: "ময়দা", aliases: ["maida", "ময়দা", "flour"], category: "Staples", unit: "KG" },
  { nameEn: "Suji (semolina)", nameBn: "সুজি", aliases: ["suji", "semolina", "সুজি"], category: "Staples", unit: "KG" },

  // Pulses
  { nameEn: "Masoor dal (red lentil)", nameBn: "মসুর ডাল", aliases: ["masoor", "masur dal", "মসুর ডাল"], category: "Pulses", unit: "KG" },
  { nameEn: "Mung dal", nameBn: "মুগ ডাল", aliases: ["mung dal", "moog dal", "মুগ ডাল"], category: "Pulses", unit: "KG" },
  { nameEn: "Boot (chickpea)", nameBn: "বুট", aliases: ["chola", "boot", "chickpea", "ছোলা"], category: "Pulses", unit: "KG" },
  { nameEn: "Khesari dal", nameBn: "খেসারি ডাল", aliases: ["khesari", "খেসারি"], category: "Pulses", unit: "KG" },

  // Vegetables
  { nameEn: "Potato", nameBn: "আলু", aliases: ["aloo", "alu", "আলু"], category: "Vegetables", unit: "KG" },
  { nameEn: "Onion", nameBn: "পিয়াজ", aliases: ["piyaj", "peyaj", "onion", "পিঁয়াজ"], category: "Vegetables", unit: "KG" },
  { nameEn: "Garlic", nameBn: "রসুন", aliases: ["rosun", "garlic", "রসুন"], category: "Vegetables", unit: "KG" },
  { nameEn: "Ginger", nameBn: "আদা", aliases: ["ada", "ginger", "আদা"], category: "Vegetables", unit: "KG" },
  { nameEn: "Green chilli", nameBn: "কাঁচা মরিচ", aliases: ["kacha morich", "green chilli", "কাঁচা মরিচ"], category: "Vegetables", unit: "KG" },
  { nameEn: "Tomato", nameBn: "টমেটো", aliases: ["tomato", "টমেটো"], category: "Vegetables", unit: "KG" },
  { nameEn: "Brinjal", nameBn: "বেগুন", aliases: ["begun", "brinjal", "eggplant", "বেগুন"], category: "Vegetables", unit: "KG" },
  { nameEn: "Seasonal vegetables", nameBn: "সবজি", aliases: ["shobji", "sobji", "seasonal", "সবজি"], category: "Vegetables", unit: "KG" },
  { nameEn: "Lemon", nameBn: "লেবু", aliases: ["lebu", "lemon", "লেবু"], category: "Vegetables", unit: "PIECE" },
  { nameEn: "Coriander leaves", nameBn: "ধনেপাতা", aliases: ["dhone pata", "coriander", "ধনেপাতা"], category: "Vegetables", unit: "KG" },

  // Protein
  { nameEn: "Fish", nameBn: "মাছ", aliases: ["mach", "maach", "fish", "মাছ"], category: "Protein", unit: "KG" },
  { nameEn: "Broiler chicken", nameBn: "ব্রয়লার মুরগি", aliases: ["broiler", "murga", "chicken", "মুরগি"], category: "Protein", unit: "KG" },
  { nameEn: "Beef", nameBn: "গরুর মাংস", aliases: ["gorur mangsho", "beef", "গরুর মাংস"], category: "Protein", unit: "KG" },
  { nameEn: "Mutton", nameBn: "খাসির মাংস", aliases: ["khashi", "mutton", "খাসি"], category: "Protein", unit: "KG" },
  { nameEn: "Eggs", nameBn: "ডিম", aliases: ["dim", "egg", "ডিম"], category: "Protein", unit: "DOZEN" },

  // Cooking essentials
  { nameEn: "Soybean oil", nameBn: "সয়াবিন তেল", aliases: ["soybean oil", "tel", "সয়াবিন তেল"], category: "Cooking Essentials", unit: "LITRE" },
  { nameEn: "Mustard oil", nameBn: "সরিষার তেল", aliases: ["sorishar tel", "mustard oil", "সরিষার তেল"], category: "Cooking Essentials", unit: "LITRE" },
  { nameEn: "Salt", nameBn: "লবণ", aliases: ["lobon", "salt", "লবণ"], category: "Cooking Essentials", unit: "KG" },
  { nameEn: "Sugar", nameBn: "চিনি", aliases: ["chini", "sugar", "চিনি"], category: "Cooking Essentials", unit: "KG" },
  { nameEn: "Turmeric powder", nameBn: "হলুদ গুঁড়া", aliases: ["holud", "turmeric", "হলুদ"], category: "Cooking Essentials", unit: "GRAM" },
  { nameEn: "Chilli powder", nameBn: "মরিচ গুঁড়া", aliases: ["morich gura", "chilli powder", "মরিচ গুঁড়া"], category: "Cooking Essentials", unit: "GRAM" },
  { nameEn: "Coriander powder", nameBn: "ধনে গুঁড়া", aliases: ["dhone gura", "coriander powder"], category: "Cooking Essentials", unit: "GRAM" },
  { nameEn: "Cumin powder", nameBn: "জিরা গুঁড়া", aliases: ["jira", "cumin", "জিরা"], category: "Cooking Essentials", unit: "GRAM" },
  { nameEn: "Other spices", nameBn: "অন্যান্য মসলা", aliases: ["moshla", "spices", "মসলা"], category: "Cooking Essentials", unit: "GRAM" },

  // Dairy & breakfast
  { nameEn: "Milk", nameBn: "দুধ", aliases: ["dudh", "milk", "দুধ"], category: "Dairy & Breakfast", unit: "LITRE" },
  { nameEn: "Tea leaves", nameBn: "চা পাতা", aliases: ["cha pata", "tea", "চা"], category: "Dairy & Breakfast", unit: "PACKET" },
  { nameEn: "Bread", nameBn: "পাউরুটি", aliases: ["pauruti", "bread", "পাউরুটি"], category: "Dairy & Breakfast", unit: "PIECE" },
  { nameEn: "Powdered milk", nameBn: "গুঁড়া দুধ", aliases: ["gura dudh", "powder milk"], category: "Dairy & Breakfast", unit: "PACKET" },

  // Other
  { nameEn: "Snacks", nameBn: "স্ন্যাকস", aliases: ["snacks", "nasta", "নাস্তা"], category: "Other", unit: "PACKET" },
  { nameEn: "Drinking water", nameBn: "খাবার পানি", aliases: ["khawbar pani", "water", "পানি"], category: "Other", unit: "BOTTLE" },
  { nameEn: "Cleaning supplies", nameBn: "পরিষ্কারক সামগ্রী", aliases: ["cleaning", "saban", "সাবান", "পরিষ্কার"], category: "Other", unit: "PIECE" },
];
