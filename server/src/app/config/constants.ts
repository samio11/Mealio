/** Shared product defaults. Cut-offs are Dhaka wall-clock times in minutes from midnight. */
export const DEFAULT_MEAL_CUTOFFS = {
  BREAKFAST: 8 * 60, // 08:00
  LUNCH: 12 * 60, // 12:00
  DINNER: 20 * 60, // 20:00
} as const;

export const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER"] as const;

export const DEFAULT_TIMEZONE = "Asia/Dhaka";
export const DEFAULT_CURRENCY = "BDT";

/** AI fields below this confidence must be treated as "unknown" and require manual input. */
export const AI_CONFIDENCE_THRESHOLD = 0.6;

/** Invitation default lifetime in days. */
export const INVITATION_TTL_DAYS = 7;
