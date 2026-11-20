/**
 * Shared API types.
 *
 * These mirror the server DTOs exactly. Money is always an integer-poisha
 * string plus a pre-formatted taka string; dates are `YYYY-MM-DD` strings and
 * timestamps are ISO strings.
 */

export type MealType = "BREAKFAST" | "LUNCH" | "DINNER";
export type MealRecordStatus = "ON" | "OFF";
export type MessRole = "MANAGER" | "MEMBER";
export type MembershipStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "REMOVED";
export type MonthStatus = "OPEN" | "CLOSED";
export type Unit = "KG" | "GRAM" | "LITRE" | "ML" | "PIECE" | "DOZEN" | "PACKET" | "BOTTLE";
export type PaymentMethod = "CASH" | "BKASH" | "NAGAD" | "CARD" | "ROCKET" | "BANK" | "OTHER";
export type DepositStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type UtilityPaymentStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type ExpenseStatus = "PENDING" | "APPROVED" | "REJECTED" | "REVERSED";
export type ExpenseCategory =
  | "MEAL_BAZAR"
  | "RENT"
  | "ELECTRICITY"
  | "GAS"
  | "WATER"
  | "MAID"
  | "GARBAGE"
  | "WIFI"
  | "CLEANING"
  | "OTHER_SHARED"
  | "MEMBER_SPECIFIC"
  | "REFUND_ADJUSTMENT";
export type AllocationMethod = "EQUAL" | "MEAL_COUNT" | "CUSTOM";
export type BazarStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
export type DutyStatus = "SCHEDULED" | "COMPLETED" | "SKIPPED";
export type PriceSource =
  | "MANAGER_ENTRY"
  | "VERIFIED_PURCHASE"
  | "ADMIN_REFERENCE"
  | "RETAILER_FEED"
  | "AI_ESTIMATE";
export type PriceVerification = "UNVERIFIED" | "VERIFIED" | "OUTDATED";
export type MediaKind = "BAZAR_PHOTO" | "RECEIPT" | "AVATAR" | "PROOF" | "OTHER";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  image: string | null;
  locale: string;
  platformRole: string;
  createdAt: string;
}

export interface MessSummary {
  messId: string;
  name: string;
  area: string | null;
  archived: boolean;
  role: MessRole;
  status: MembershipStatus;
  membershipId: string;
}

export interface Mess {
  id: string;
  name: string;
  area: string | null;
  address: string | null;
  currency: string;
  timezone: string;
  archived: boolean;
  myRole: string;
  createdAt: string;
}

export interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: MessRole;
  status: MembershipStatus;
  displayName: string | null;
  phone: string | null;
  isDutyEligible: boolean;
  joinedAt: string;
  leftAt: string | null;
}

export interface Invitation {
  id: string;
  messId: string;
  email: string | null;
  phone: string | null;
  role: MessRole;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  token?: string;
  inviteUrl?: string;
}

export interface InvitationPreview {
  messId: string;
  messName: string;
  area: string | null;
  invitedByName: string | null;
  role: MessRole;
  email: string | null;
  phone: string | null;
  status: string;
  expiresAt: string;
  alreadyMember: boolean;
  canAccept: boolean;
}

export interface MealSetting {
  id: string;
  mealType: MealType;
  enabled: boolean;
  cutoffMinutes: number;
  cutoff: string;
}

export interface MessMonth {
  id: string;
  year: number;
  month: number;
  label: string;
  status: MonthStatus;
  openingCashPoisha: string;
  budgetPoisha: string;
  mealRatePolicy: string;
  daysInMonth: number;
  closedAt: string | null;
  createdAt: string;
  mealSettings?: MealSetting[];
}

export interface MealRecord {
  id: string;
  memberId: string;
  date: string;
  mealType: MealType;
  status: MealRecordStatus;
  source: string;
  changedById: string | null;
  updatedAt: string;
}

export interface GuestMeal {
  memberId: string;
  date: string;
  mealType: MealType;
  guestCount: number;
}

export interface DayMealStatus {
  date: string;
  settings: {
    mealType: MealType;
    enabled: boolean;
    cutoff: string;
    cutoffMinutes: number;
    closed: boolean;
  }[];
}

export interface MemberMealCount {
  memberId: string;
  total: number;
  breakfast: number;
  lunch: number;
  dinner: number;
  guestMeals: number;
  activeDays: number;
}

export interface MemberMealTimelineDay {
  day: number;
  date: string;
  breakfast: number;
  lunch: number;
  dinner: number;
  breakfastOn: boolean;
  lunchOn: boolean;
  dinnerOn: boolean;
  breakfastGuests: number;
  lunchGuests: number;
  dinnerGuests: number;
}

export interface MemberMealTimeline {
  memberId: string;
  memberName: string;
  days: MemberMealTimelineDay[];
}

export interface Menu {
  id: string;
  date: string;
  mealType: MealType;
  menuText: string;
  noticeText: string | null;
  updatedById: string | null;
}

export interface GroceryItem {
  id: string;
  nameEn: string;
  nameBn: string;
  aliases: string[];
  category: string;
  unit: Unit;
  brand: string | null;
  isActive: boolean;
  isCustom: boolean;
  latestPricePoisha: string | null;
  latestPriceSource: string | null;
  latestPriceObservedOn: string | null;
  masterPrice: {
    sourceItemId: string;
    unitLabel: string;
    minPricePoisha: string;
    maxPricePoisha: string;
    referencePricePoisha: string;
    sourceNote: string;
    sourceUrl: string;
    checkedOn: string;
    priceType: string;
    isActive: boolean;
    notes: string;
  } | null;
}

export interface GroceryPrice {
  id: string;
  groceryItemId: string;
  itemNameEn: string | null;
  itemNameBn: string | null;
  pricePoisha: string;
  priceTaka: string;
  unit: Unit;
  source: PriceSource;
  verification: PriceVerification;
  shopName: string | null;
  location: string | null;
  observedOn: string;
  enteredById: string;
  createdAt: string;
}

export interface AdminGroceryMasterItem {
  id: string;
  sourceItemId: string | null;
  nameEn: string;
  nameBn: string;
  category: string;
  unit: Unit;
  isActive: boolean;
  masterPrice: {
    unitLabel: string;
    minPricePoisha: string;
    maxPricePoisha: string;
    referencePricePoisha: string;
    sourceNote: string;
    sourceUrl: string;
    checkedOn: string;
    priceType: string;
    isActive: boolean;
    notes: string;
  } | null;
}

export interface Deposit {
  id: string;
  messId: string;
  monthId: string;
  memberId: string;
  memberName: string | null;
  amountPoisha: string;
  amountTaka: string;
  method: PaymentMethod;
  reference: string | null;
  status: DepositStatus;
  note: string | null;
  submittedById: string;
  verifiedById: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface ExpenseAllocation {
  memberId: string;
  memberName: string | null;
  amountPoisha: string;
  mealCount: number | null;
}

export interface Expense {
  id: string;
  messId: string;
  monthId: string;
  category: ExpenseCategory;
  amountPoisha: string;
  amountTaka: string;
  description: string;
  allocationMethod: AllocationMethod;
  status: ExpenseStatus;
  incurredOn: string;
  note: string | null;
  createdById: string;
  approvedById: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  reversalOfId: string | null;
  bazarEntryId: string | null;
  allocations?: ExpenseAllocation[];
  createdAt: string;
}

export interface UtilityPayment {
  id: string;
  amountPoisha: string;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
  status: UtilityPaymentStatus;
  submittedById: string;
  verifiedById: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface UtilityShare {
  memberId: string;
  memberName: string | null;
  amountPoisha: string;
  payment: UtilityPayment | null;
}

export interface UtilityBill extends Omit<Expense, "allocations"> {
  utilityBillPaid: boolean;
  utilityBillPaidById: string | null;
  utilityBillPaidAt: string | null;
  shares: UtilityShare[];
}

export interface BazarItem {
  id: string;
  groceryItemId: string | null;
  itemNameSnapshot: string;
  itemNameBnSnapshot: string | null;
  unitSnapshot: Unit;
  quantity: string;
  unitPricePoisha: string;
  unitPriceTaka: string;
  lineTotalPoisha: string;
  lineTotalTaka: string;
  confidence: number | null;
  source: PriceSource | null;
}

export interface BazarEntry {
  id: string;
  messId: string;
  monthId: string;
  buyerMemberId: string;
  buyerName: string | null;
  purchaseDate: string;
  shopName: string | null;
  totalPoisha: string;
  totalTaka: string;
  paymentMethod: PaymentMethod;
  notes: string | null;
  status: BazarStatus;
  submittedAt: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  expenseId: string | null;
  itemCount: number;
  items?: BazarItem[];
  createdAt: string;
}

export interface Duty {
  id: string;
  date: string;
  assigneeMemberId: string | null;
  assigneeName: string | null;
  status: DutyStatus;
  isManualOverride: boolean;
  overrideReason: string | null;
  completedAt: string | null;
}

export interface CategoryTotal {
  category: string;
  amountPoisha: string;
  amountTaka: string;
}

export interface MemberBalanceRow {
  memberId: string;
  memberName: string | null;
  role: string;
  status: string;
  mealCount: number;
  mealCostPoisha: string;
  mealCostTaka: string;
  verifiedDepositsPoisha: string;
  verifiedDepositsTaka: string;
  allocatedChargesPoisha: string;
  allocatedChargesTaka: string;
  creditsPoisha: string;
  debitsPoisha: string;
  adjustmentsPoisha: string;
  balancePoisha: string;
  balanceTaka: string;
}

export interface MonthlyReport {
  month: { id: string; year: number; month: number; label: string; status: string; daysInMonth: number };
  meal: {
    totalMealCount: number;
    mealExpensePoisha: string;
    mealExpenseTaka: string;
    mealRatePoisha: string;
    mealRateTaka: string;
  };
  expenses: {
    totalApprovedPoisha: string;
    totalApprovedTaka: string;
    approvedCount: number;
    pendingCount: number;
    rejectedCount: number;
    byCategory: CategoryTotal[];
  };
  deposits: {
    verifiedTotalPoisha: string;
    verifiedTotalTaka: string;
    pendingTotalPoisha: string;
    pendingTotalTaka: string;
    verifiedCount: number;
    pendingCount: number;
  };
  cash: {
    openingCashPoisha: string;
    openingCashTaka: string;
    confirmedInflowsPoisha: string;
    approvedPaymentsPoisha: string;
    closingCashPoisha: string;
    closingCashTaka: string;
  };
  budget: {
    budgetPoisha: string;
    budgetTaka: string;
    spentPoisha: string;
    remainingPoisha: string;
    remainingTaka: string;
    utilisationPercent: number;
  };
  members: MemberBalanceRow[];
  totals: {
    memberMealCostPoisha: string;
    memberAllocatedPoisha: string;
    memberBalancePoisha: string;
    outstandingPoisha: string;
    advancePoisha: string;
  };
  generatedAt: string;
}

export interface MonthSummary {
  month: { id: string; label: string; status: string };
  totalMealCount: number;
  mealRatePoisha: string;
  mealRateTaka: string;
  verifiedDepositsPoisha: string;
  approvedExpensesPoisha: string;
  closingCashPoisha: string;
  budgetRemainingPoisha: string;
  pendingDepositsCount: number;
  pendingExpensesCount: number;
  activeMembersCount: number;
}

export interface MemberBalances {
  month: { id: string; label: string; status: string };
  members: MemberBalanceRow[];
  totals: {
    outstandingPoisha: string;
    advancePoisha: string;
    netPoisha: string;
  };
}

export interface AuditLog {
  id: string;
  messId: string | null;
  actorUserId: string | null;
  actorName: string | null;
  entityType: string;
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface MediaAsset {
  id: string;
  messId: string | null;
  kind: MediaKind;
  provider: string;
  resourceType: string;
  publicId: string;
  mimeType: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  bazarEntryId: string | null;
  uploadedById: string;
  createdAt: string;
}

export interface AiDraftItem {
  name: string;
  nameBn: string | null;
  quantity: number;
  unit: string;
  /** Total price (in Taka) paid for this line item. */
  totalPriceTaka: number | null;
  confidence: number;
  needsReview: boolean;
  matchedGroceryItemId: string | null;
  matchScore: number | null;
  matchedOn: string | null;
  notes: string | null;
}

export interface AiDraftResult<T> {
  status: "SUCCEEDED" | "FAILED" | "SKIPPED";
  provider: string | null;
  model: string | null;
  extractionId: string | null;
  data: T | null;
  errorMessage: string | null;
  manualFallbackRequired: boolean;
}

export interface BazarDraft {
  shopName?: string;
  purchaseDate?: string;
  totalTaka?: number;
  overallConfidence: number;
  items: AiDraftItem[];
  /** The draft is never posted automatically; the user must review and submit. */
  isDraftOnly: true;
}

export interface PriceEstimate {
  priceTaka: number;
  lowTaka?: number;
  highTaka?: number;
  confidence: number;
  rationale?: string;
}

export interface ReportSummary {
  summary: string;
  highlights: string[];
  concerns: string[];
}

export interface AiUsage {
  configured: boolean;
  todayCount: number;
  last7DaysCount: number;
  byTask: { taskType: string; count: number }[];
}

export interface AdminOverview {
  users: number;
  admins: number;
  messes: number;
  archivedMesses: number;
  activeMemberships: number;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  platformRole: "USER" | "ADMIN";
  blockedAt: string | null;
  createdAt: string;
  _count: { memberships: number; createdMesses: number };
}

export interface AdminUserDetails extends AdminUserRow {
  memberships: {
    id: string;
    role: MessRole;
    status: MembershipStatus;
    joinedAt: string;
    leftAt: string | null;
    mess: { id: string; name: string; area: string | null; archived: boolean };
  }[];
}

export interface AdminMessCounts {
  memberships: number;
  invitations: number;
  months: number;
  groceryItems: number;
  groceryPrices: number;
  deposits: number;
  expenses: number;
  bazarEntries: number;
  duties: number;
  menus: number;
  mealRecords: number;
  media: number;
  aiExtractions: number;
  adjustments: number;
  auditLogs: number;
}

export interface AdminMessRow {
  id: string;
  name: string;
  area: string | null;
  archivedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
  _count: AdminMessCounts;
}

export interface AdminMessDetails extends AdminMessRow {
  address: string | null;
  currency: string;
  timezone: string;
  archived: boolean;
  memberships: {
    id: string;
    role: MessRole;
    status: MembershipStatus;
    joinedAt: string;
    leftAt: string | null;
    user: { id: string; name: string; email: string; image: string | null; phone: string | null };
  }[];
  months: {
    id: string;
    year: number;
    month: number;
    status: MonthStatus;
    _count: {
      mealSettings: number;
      mealRecords: number;
      menus: number;
      deposits: number;
      expenses: number;
      bazarEntries: number;
      duties: number;
      adjustments: number;
    };
  }[];
  totals: { depositsPoisha: string; expensesPoisha: string; bazarPoisha: string };
}
