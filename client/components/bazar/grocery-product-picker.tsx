"use client";

import { Check, ChevronDown, Plus, Search, Tag, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GroceryItem, Unit } from "@/lib/api/types";
import { formatPoishaCompact } from "@/lib/format";

/**
 * Common Banglish phonetic words mapped to English / Bangla terms.
 * Allows users to type in English letters with Bangla meaning (e.g. "alu" -> Potato / আলু).
 */
export const BANGLISH_MAP: Record<string, string[]> = {
  alu: ["potato", "আলু"],
  aloo: ["potato", "আলু"],
  peyaj: ["onion", "পিয়াজ", "পেঁয়াজ"],
  peaj: ["onion", "পিয়াজ", "পেঁয়াজ"],
  piyaj: ["onion", "পিয়াজ", "পেঁয়াজ"],
  peyajkoli: ["onion", "পেঁয়াজকলি"],
  dim: ["egg", "ডিম"],
  deem: ["egg", "ডিম"],
  murgi: ["chicken", "মুরগি"],
  morog: ["chicken", "মুরগি"],
  murga: ["chicken", "মুরগি"],
  goru: ["beef", "গরু", "গরুর মাংস"],
  gorur: ["beef", "গরু", "গরুর মাংস"],
  mangsho: ["beef", "mutton", "meat", "মাংস"],
  mangso: ["beef", "mutton", "meat", "মাংস"],
  gosht: ["beef", "mutton", "meat", "মাংস"],
  khasi: ["mutton", "খাসি", "খাসির মাংস"],
  khashi: ["mutton", "খাসি", "খাসির মাংস"],
  khasir: ["mutton", "খাসি", "খাসির মাংস"],
  mach: ["fish", "মাছ"],
  maach: ["fish", "মাছ"],
  mas: ["fish", "মাছ"],
  rui: ["rui", "রুই"],
  ruhi: ["rui", "রুই"],
  ilish: ["hilsa", "ইলিশ"],
  hilsha: ["hilsa", "ইলিশ"],
  katla: ["katla", "কাতলা"],
  telapia: ["tilapia", "তেলাপিয়া"],
  pangash: ["pangash", "পাঙ্গাস"],
  shing: ["shing", "শিং"],
  koi: ["koi", "কৈ"],
  pabda: ["pabda", "পাবদা"],
  chingri: ["prawn", "shrimp", "চিংড়ি"],
  chal: ["rice", "চাল"],
  chaal: ["rice", "চাল"],
  bhat: ["rice", "ভাত", "চাল"],
  dal: ["lentil", "dal", "ডাল"],
  daal: ["lentil", "dal", "ডাল"],
  dhal: ["lentil", "dal", "ডাল"],
  masoor: ["masoor", "মসুর"],
  mung: ["mung", "moog", "মুগ"],
  khesari: ["khesari", "খেসারি"],
  tel: ["oil", "তেল"],
  tael: ["oil", "তেল"],
  soyabean: ["soybean", "সয়াবিন"],
  shorisha: ["mustard", "সরিষা"],
  sorisha: ["mustard", "সরিষা"],
  dudh: ["milk", "দুধ"],
  doodh: ["milk", "দুধ"],
  roshun: ["garlic", "রসুন"],
  rosun: ["garlic", "রসুন"],
  roshon: ["garlic", "রসুন"],
  ada: ["ginger", "আদা"],
  morich: ["chilli", "chili", "pepper", "মরিচ"],
  moris: ["chilli", "chili", "pepper", "মরিচ"],
  kacha: ["green", "কাঁচা"],
  shukna: ["dry", "শুকনা"],
  sukna: ["dry", "শুকনা"],
  gura: ["powder", "গুঁড়া"],
  holud: ["turmeric", "হলুদ"],
  halud: ["turmeric", "হলুদ"],
  dhone: ["coriander", "ধনে"],
  dhoniya: ["coriander", "ধনে"],
  jira: ["cumin", "জিরা"],
  jeera: ["cumin", "জিরা"],
  lobon: ["salt", "লবণ"],
  noon: ["salt", "লবণ"],
  nun: ["salt", "লবণ"],
  chini: ["sugar", "চিনি"],
  cha: ["tea", "চা"],
  tsa: ["tea", "চা"],
  shobji: ["vegetables", "সবজি"],
  sobji: ["vegetables", "সবজি"],
  begun: ["brinjal", "eggplant", "বেগুন"],
  potol: ["pointed gourd", "পটল"],
  shosha: ["cucumber", "শসা"],
  sosa: ["cucumber", "শসা"],
  gajor: ["carrot", "গাজর"],
  gajar: ["carrot", "গাজর"],
  tomato: ["tomato", "টমেটো"],
  tamato: ["tomato", "টমেটো"],
  fulkopi: ["cauliflower", "ফুলকপি"],
  phulkopi: ["cauliflower", "ফুলকপি"],
  badhakopi: ["cabbage", "বাঁধাকপি"],
  badakopi: ["cabbage", "বাঁধাকপি"],
  shim: ["bean", "শিম"],
  seem: ["bean", "শিম"],
  lau: ["bottle gourd", "লাউ"],
  lao: ["bottle gourd", "লাউ"],
  lebu: ["lemon", "lime", "লেবু"],
  shak: ["spinach", "greens", "শাক"],
  saak: ["spinach", "greens", "শাক"],
  shaak: ["spinach", "greens", "শাক"],
  palong: ["spinach", "পালং"],
  lal: ["red", "লাল"],
  kolmi: ["water spinach", "কলমি"],
  pui: ["malabar", "পুঁই"],
  dhonpata: ["coriander", "ধনেপাতা"],
  pauruti: ["bread", "পাউরুটি"],
  ruti: ["bread", "flour", "রুটি", "পাউরুটি"],
  makhan: ["butter", "মাখন"],
  makhon: ["butter", "মাখন"],
  chiz: ["cheese", "চিজ"],
  cheese: ["cheese", "চিজ"],
  doi: ["yogurt", "curd", "দই"],
  dahi: ["yogurt", "দই"],
  ghee: ["ghee", "ঘি"],
  ghi: ["ghee", "ঘি"],
  ata: ["atta", "flour", "আটা"],
  atta: ["atta", "flour", "আটা"],
  moyda: ["flour", "maida", "ময়দা"],
  maida: ["flour", "maida", "ময়দা"],
  suji: ["semolina", "সুজি"],
  shuji: ["semolina", "সুজি"],
  biscuit: ["biscuit", "বিস্কুট"],
  biskut: ["biscuit", "বিস্কুট"],
  kola: ["banana", "কলা"],
  aam: ["mango", "আম"],
  pepe: ["papaya", "পেঁপে"],
  pepey: ["papaya", "পেঁপে"],
  komola: ["orange", "কমলা"],
  anaros: ["pineapple", "আনারস"],
  sabun: ["soap", "সাবান"],
  shampoo: ["shampoo", "শ্যাম্পু"],
  surf: ["detergent", "সার্ফ", "ডিটারজেন্ট"],
  tishu: ["tissue", "টিস্যু"],
  tissue: ["tissue", "টিস্যু"],
  mombati: ["candle", "মোমবাতি"],
  coil: ["coil", "কয়েল"],
  chola: ["chickpea", "ছোলা"],
  boot: ["chickpea", "বুট"],
  muri: ["puffed rice", "মুড়ি"],
  chira: ["flattened rice", "চিড়া"],
  shemai: ["vermicelli", "সেমাই"],
  semai: ["vermicelli", "সেমাই"],
  elach: ["cardamom", "এলাচ"],
  elachi: ["cardamom", "এলাচ"],
  daruchini: ["cinnamon", "দারুচিনি"],
  darchini: ["cinnamon", "দারুচিনি"],
  lobongo: ["clove", "লবঙ্গ"],
  long: ["clove", "লবঙ্গ"],
  tejpata: ["bay leaf", "তেজপাতা"],
  gol: ["black pepper", "গোল"],
  khejur: ["date", "dates", "খেজুর"],
  badam: ["nut", "peanut", "বাদাম"],
  chinabadam: ["peanut", "চিনাবাদাম"],
};

/**
 * Checks if a grocery item matches a search query across:
 * 1. English name
 * 2. Bangla name
 * 3. Aliases
 * 4. Category
 * 5. Banglish phonetic/meaning transliteration
 */
export function matchesGroceryItem(item: GroceryItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  // 1. Direct English match
  if (item.nameEn.toLowerCase().includes(q)) return true;

  // 2. Direct Bangla match
  if (item.nameBn.includes(query.trim())) return true;

  // 3. Aliases match
  if (item.aliases?.some((alias) => alias.toLowerCase().includes(q))) return true;

  // 4. Category match
  if (item.category.toLowerCase().includes(q)) return true;

  // 5. Banglish phonetic tokens match
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const matchesAllTokens = tokens.every((token) => {
    // Directly in English or Bangla
    if (item.nameEn.toLowerCase().includes(token) || item.nameBn.includes(token)) {
      return true;
    }
    // Directly in aliases
    if (item.aliases?.some((alias) => alias.toLowerCase().includes(token))) {
      return true;
    }
    // Check Banglish mapping
    const mappedTerms = BANGLISH_MAP[token];
    if (mappedTerms) {
      return mappedTerms.some(
        (target) =>
          item.nameEn.toLowerCase().includes(target.toLowerCase()) ||
          item.nameBn.includes(target) ||
          item.aliases?.some((a) => a.toLowerCase().includes(target.toLowerCase())),
      );
    }
    return false;
  });

  return matchesAllTokens;
}

interface GroceryProductPickerProps {
  value: string | null;
  nameSnapshot: string;
  nameBnSnapshot?: string;
  items: GroceryItem[];
  isLoading?: boolean;
  onSelect: (selected: {
    groceryItemId: string | null;
    nameSnapshot: string;
    nameBnSnapshot?: string;
    unit?: Unit;
  }) => void;
  className?: string;
}

export function GroceryProductPicker({
  value,
  nameSnapshot,
  nameBnSnapshot,
  items,
  isLoading,
  onSelect,
  className,
}: GroceryProductPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    return items.filter((item) => matchesGroceryItem(item, query));
  }, [items, query]);

  // Selected item object if matched
  const selectedItem = useMemo(() => {
    if (!value) return null;
    return items.find((item) => item.id === value) ?? null;
  }, [items, value]);

  // Display text when closed / selected
  const displayText = useMemo(() => {
    if (selectedItem) {
      return `${selectedItem.nameEn} · ${selectedItem.nameBn}`;
    }
    if (nameSnapshot.trim()) {
      return nameBnSnapshot ? `${nameSnapshot} · ${nameBnSnapshot}` : nameSnapshot;
    }
    return "";
  }, [selectedItem, nameSnapshot, nameBnSnapshot]);

  const handleSelectItem = (item: GroceryItem) => {
    onSelect({
      groceryItemId: item.id,
      nameSnapshot: item.nameEn,
      nameBnSnapshot: item.nameBn,
      unit: item.unit,
    });
    setOpen(false);
    setQuery("");
  };

  const handleSelectCustom = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    onSelect({
      groceryItemId: null,
      nameSnapshot: trimmed,
      nameBnSnapshot: undefined,
    });
    setOpen(false);
    setQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect({
      groceryItemId: null,
      nameSnapshot: "",
      nameBnSnapshot: undefined,
    });
    setQuery("");
    setOpen(false);
  };

  const handleOpenDropdown = () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className ?? ""}`}>
      {/* If an item is already selected and dropdown is closed, show comfortable summary box */}
      {!open && displayText ? (
        <div
          role="button"
          tabIndex={0}
          onClick={handleOpenDropdown}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleOpenDropdown();
            }
          }}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors hover:bg-muted/40 cursor-pointer"
        >
          <span className="truncate font-medium text-foreground">
            {displayText}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Clear product"
            >
              <X className="size-3.5" />
            </button>
            <ChevronDown className="size-3.5 text-muted-foreground opacity-60" />
          </div>
        </div>
      ) : (
        /* Search Input */
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter" && filteredItems.length > 0) {
                e.preventDefault();
                handleSelectItem(filteredItems[0]);
              } else if (e.key === "Enter" && query.trim()) {
                e.preventDefault();
                handleSelectCustom();
              }
            }}
            placeholder="Search product (e.g. potato, আলু, alu)..."
            className="pl-8 pr-7 text-sm"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
              title="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : (
            <ChevronDown className="absolute right-2.5 top-2.5 size-4 text-muted-foreground opacity-50 pointer-events-none" />
          )}
        </div>
      )}

      {/* Autocomplete Dropdown Popover */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-full min-w-[18rem] overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95">
          {isLoading ? (
            <div className="p-3 text-center text-xs text-muted-foreground">
              Loading grocery catalogue…
            </div>
          ) : (
            <>
              {/* Option to use custom item if typed something */}
              {query.trim() && (
                <button
                  type="button"
                  onClick={handleSelectCustom}
                  className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-xs font-medium text-primary hover:bg-primary/10 border-b mb-1"
                >
                  <Plus className="size-3.5 shrink-0" />
                  <span className="truncate">Use &quot;{query.trim()}&quot; as custom item</span>
                </button>
              )}

              {filteredItems.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  <p>No exact catalogue match for &quot;{query}&quot;.</p>
                  <button
                    type="button"
                    onClick={handleSelectCustom}
                    className="mt-1.5 font-medium text-primary underline"
                  >
                    Click here to use &quot;{query.trim()}&quot; anyway
                  </button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Products ({filteredItems.length})
                  </div>
                  {filteredItems.map((item) => {
                    const isSelected = value === item.id;
                    const rawPoisha = item.masterPrice?.referencePricePoisha ?? item.latestPricePoisha;
                    const refPrice = rawPoisha ? formatPoishaCompact(rawPoisha) : null;

                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => handleSelectItem(item)}
                        className={`flex w-full items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-left text-xs transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground font-medium"
                            : "hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">
                            {item.nameEn} <span className="opacity-80">· {item.nameBn}</span>
                          </span>
                          <span
                            className={`text-[10px] truncate ${
                              isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                            }`}
                          >
                            {item.category} · Default: {item.unit}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {refPrice ? (
                            <span
                              className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                                isSelected
                                  ? "bg-primary-foreground/20 text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                              title="Reference price"
                            >
                              ~{refPrice}৳
                            </span>
                          ) : null}
                          {isSelected ? <Check className="size-3.5" /> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
