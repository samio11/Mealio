import { api, type ApiEnvelope, type PaginationMeta, type QueryValue } from "./client";
import type {
  AiDraftResult,
  AiUsage,
  AdminMessDetails,
  AdminMessRow,
  AdminOverview,
  AdminUserDetails,
  AdminUserRow,
  AuditLog,
  BazarDraft,
  BazarEntry,
  DayMealStatus,
  Deposit,
  Duty,
  Expense,
  GuestMeal,
  GroceryItem,
  GroceryPrice,
  Invitation,
  InvitationPreview,
  MealRecord,
  MediaAsset,
  MealSetting,
  MealType,
  Member,
  MemberBalances,
  MemberMealCount,
  MemberMealTimeline,
  Menu,
  Mess,
  MessMonth,
  MessSummary,
  MonthSummary,
  MonthlyReport,
  PriceEstimate,
  ReportSummary,
  UserProfile,
  UtilityBill,
  UtilityPayment,
} from "./types";

/**
 * Every REST endpoint the client needs, grouped by resource. Each function
 * returns the unwrapped payload; list functions return `{ items, meta }`.
 */

export interface ListResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface ProfileImageUploadSignature {
  provider: "cloudinary";
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  uploadUrl: string;
  folder: string;
  type: string;
  allowedFormats: string[];
}

async function list<T>(promise: Promise<ApiEnvelope<T[]>>): Promise<ListResult<T>> {
  const { data, meta } = await promise;
  return {
    items: data,
    meta: meta ?? { page: 1, pageSize: data.length, total: data.length, totalPages: 1 },
  };
}

/* -------------------------------------------------------------------------- */
/* Users                                                                      */
/* -------------------------------------------------------------------------- */

export const usersApi = {
  me: () => api.get<UserProfile>("/users/me").then((r) => r.data),
  updateMe: (body: { name?: string; phone?: string | null; locale?: "bn" | "en"; image?: string | null }) =>
    api.patch<UserProfile>("/users/me", body).then((r) => r.data),
  profileImageUploadSignature: () =>
    api.post<ProfileImageUploadSignature>("/users/me/image-upload-sign").then((r) => r.data),
  myMesses: () => api.get<MessSummary[]>("/users/me/messes").then((r) => r.data),
};

/* -------------------------------------------------------------------------- */
/* Platform administration                                                   */
/* -------------------------------------------------------------------------- */

export const adminApi = {
  overview: () => api.get<AdminOverview>("/admin/overview").then((r) => r.data),
  users: (query?: { q?: string; page?: number; pageSize?: number }) =>
    list<AdminUserRow>(api.get<AdminUserRow[]>("/admin/users", { query })),
  user: (userId: string) => api.get<AdminUserDetails>(`/admin/users/${userId}`).then((r) => r.data),
  updateUserRole: (userId: string, platformRole: "USER" | "ADMIN") =>
    api.patch<{ id: string; platformRole: "USER" | "ADMIN" }>(`/admin/users/${userId}/role`, { platformRole }).then((r) => r.data),
  messes: (query?: { q?: string; page?: number; pageSize?: number }) =>
    list<AdminMessRow>(api.get<AdminMessRow[]>("/admin/messes", { query })),
  mess: (messId: string) => api.get<AdminMessDetails>(`/admin/messes/${messId}`).then((r) => r.data),
  deleteMess: (messId: string, confirmationName: string) =>
    api.delete<{ id: string; name: string; deleted: true; storageCleanupFailures: number }>(
      `/admin/messes/${messId}`,
      { confirmationName },
    ).then((r) => r.data),
};

/* -------------------------------------------------------------------------- */
/* Messes                                                                     */
/* -------------------------------------------------------------------------- */

export const messesApi = {
  list: () => api.get<Mess[]>("/messes").then((r) => r.data),
  create: (body: { name: string; area?: string; address?: string }) =>
    api.post<Mess>("/messes", body).then((r) => r.data),
  get: (messId: string) => api.get<Mess>(`/messes/${messId}`).then((r) => r.data),
  update: (
    messId: string,
    body: { name?: string; area?: string | null; address?: string | null; archived?: boolean },
  ) => api.patch<Mess>(`/messes/${messId}`, body).then((r) => r.data),
};

/* -------------------------------------------------------------------------- */
/* Members                                                                    */
/* -------------------------------------------------------------------------- */

export const membersApi = {
  list: (
    messId: string,
    query?: { status?: string; includeRemoved?: boolean; search?: string; page?: number; pageSize?: number },
  ) => list<Member>(api.get<Member[]>(`/messes/${messId}/members`, { query })),
  get: (messId: string, memberId: string) =>
    api.get<Member>(`/messes/${messId}/members/${memberId}`).then((r) => r.data),
  update: (
    messId: string,
    memberId: string,
    body: {
      role?: "MANAGER" | "MEMBER";
      status?: "ACTIVE" | "SUSPENDED";
      displayName?: string | null;
      phone?: string | null;
      isDutyEligible?: boolean;
    },
  ) => api.patch<Member>(`/messes/${messId}/members/${memberId}`, body).then((r) => r.data),
  remove: (messId: string, memberId: string) =>
    api.delete<Member>(`/messes/${messId}/members/${memberId}`).then((r) => r.data),
  leave: (messId: string) => api.delete<Member>(`/messes/${messId}/members/me`).then((r) => r.data),
};

/* -------------------------------------------------------------------------- */
/* Invitations                                                                */
/* -------------------------------------------------------------------------- */

export const invitationsApi = {
  list: (messId: string, query?: { status?: string }) =>
    api.get<Invitation[]>(`/messes/${messId}/invitations`, { query }).then((r) => r.data),
  create: (messId: string, body: { email?: string; phone?: string; role?: "MANAGER" | "MEMBER" }) =>
    api.post<Invitation>(`/messes/${messId}/invitations`, body).then((r) => r.data),
  revoke: (messId: string, invitationId: string) =>
    api.delete<Invitation>(`/messes/${messId}/invitations/${invitationId}`).then((r) => r.data),
  preview: (token: string) => api.get<InvitationPreview>(`/invitations/${token}`).then((r) => r.data),
  accept: (token: string) =>
    api.post<{ messId: string; messName: string; role: string; membershipId: string }>(
      `/invitations/${token}/accept`,
    ).then((r) => r.data),
};

/* -------------------------------------------------------------------------- */
/* Months                                                                     */
/* -------------------------------------------------------------------------- */

export const monthsApi = {
  list: (messId: string, query?: { year?: number; status?: "OPEN" | "CLOSED" }) =>
    api.get<MessMonth[]>(`/messes/${messId}/months`, { query }).then((r) => r.data),
  get: (messId: string, monthId: string) =>
    api.get<MessMonth>(`/messes/${messId}/months/${monthId}`).then((r) => r.data),
  create: (
    messId: string,
    body: {
      year: number;
      month: number;
      openingCashTaka?: string | number;
      budgetTaka?: string | number;
      mealRatePolicy?: "EXPENSES_OVER_MEALS";
      mealSettings?: { mealType: MealType; enabled?: boolean; cutoff?: string }[];
    },
  ) => api.post<MessMonth>(`/messes/${messId}/months`, body).then((r) => r.data),
  update: (
    messId: string,
    monthId: string,
    body: { openingCashTaka?: string | number; budgetTaka?: string | number },
  ) => api.patch<MessMonth>(`/messes/${messId}/months/${monthId}`, body).then((r) => r.data),
  updateMealSetting: (
    messId: string,
    monthId: string,
    mealType: MealType,
    body: { enabled?: boolean; cutoff?: string },
  ) =>
    api
      .patch<MealSetting>(`/messes/${messId}/months/${monthId}/meal-settings/${mealType}`, body)
      .then((r) => r.data),
  close: (messId: string, monthId: string) =>
    api.post<MessMonth>(`/messes/${messId}/months/${monthId}/close`).then((r) => r.data),
  reopen: (messId: string, monthId: string) =>
    api.post<MessMonth>(`/messes/${messId}/months/${monthId}/reopen`).then((r) => r.data),
};

/* -------------------------------------------------------------------------- */
/* Meals & menus                                                              */
/* -------------------------------------------------------------------------- */

export const mealsApi = {
  dayStatus: (messId: string, date?: string) =>
    api.get<DayMealStatus>(`/messes/${messId}/meals/status`, { query: { date } }).then((r) => r.data),
  counts: (messId: string, monthId: string) =>
    api.get<MemberMealCount[]>(`/messes/${messId}/meals/counts`, { query: { monthId } }).then((r) => r.data),
  timeline: (messId: string, monthId: string) =>
    api.get<MemberMealTimeline[]>(`/messes/${messId}/meals/timeline`, { query: { monthId } }).then((r) => r.data),
  records: (
    messId: string,
    query?: {
      monthId?: string;
      memberId?: string;
      date?: string;
      mealType?: MealType;
      page?: number;
      pageSize?: number;
    },
  ) => list<MealRecord>(api.get<MealRecord[]>(`/messes/${messId}/meals/records`, { query })),
  setRecord: (messId: string, body: { date: string; mealType: MealType; status: "ON" | "OFF" }) =>
    api.put<MealRecord>(`/messes/${messId}/meals/records`, body).then((r) => r.data),
  override: (
    messId: string,
    body: { memberId: string; date: string; mealType: MealType; status: "ON" | "OFF"; reason: string },
  ) => api.post<MealRecord>(`/messes/${messId}/meals/records/override`, body).then((r) => r.data),
  bulk: (
    messId: string,
    body: {
      memberIds: string[];
      date: string;
      mealType: MealType;
      status: "ON" | "OFF";
      reason?: string;
    },
  ) => api.put<{ updated: number }>(`/messes/${messId}/meals/records/bulk`, body).then((r) => r.data),
  setGuestMeals: (
    messId: string,
    body: { memberId: string; date: string; mealType: MealType; guestCount: number; reason?: string },
  ) => api.put<GuestMeal>(`/messes/${messId}/meals/records/guests`, body).then((r) => r.data),
  overrideMonth: (
    messId: string,
    body: {
      monthId: string;
      memberId: string;
      records: { date: string; mealType: MealType; status: "ON" | "OFF" }[];
      reason: string;
    },
  ) => api.post<{ updated: number }>(`/messes/${messId}/meals/records/month-override`, body).then((r) => r.data),
  deleteRecord: (messId: string, recordId: string) =>
    api.delete<{ id: string }>(`/messes/${messId}/meals/records/${recordId}`).then((r) => r.data),
};

export const menusApi = {
  list: (messId: string, query?: { monthId?: string; from?: string; to?: string; mealType?: MealType }) =>
    api.get<Menu[]>(`/messes/${messId}/menus`, { query }).then((r) => r.data),
  upsert: (
    messId: string,
    body: { monthId?: string; date: string; mealType: MealType; menuText: string; noticeText?: string | null },
  ) => api.put<Menu>(`/messes/${messId}/menus`, body).then((r) => r.data),
  remove: (messId: string, menuId: string) =>
    api.delete<{ id: string }>(`/messes/${messId}/menus/${menuId}`).then((r) => r.data),
};

/* -------------------------------------------------------------------------- */
/* Grocery catalogue & prices                                                 */
/* -------------------------------------------------------------------------- */

export const groceryApi = {
  listItems: (
    messId: string,
    query?: {
      category?: string;
      search?: string;
      includeInactive?: boolean;
      customOnly?: boolean;
      page?: number;
      pageSize?: number;
    },
  ) => list<GroceryItem>(api.get<GroceryItem[]>(`/messes/${messId}/grocery-items`, { query })),
  getItem: (messId: string, itemId: string) =>
    api.get<GroceryItem>(`/messes/${messId}/grocery-items/${itemId}`).then((r) => r.data),
  createItem: (
    messId: string,
    body: {
      nameEn: string;
      nameBn: string;
      aliases?: string[];
      category: string;
      unit?: string;
      brand?: string | null;
    },
  ) => api.post<GroceryItem>(`/messes/${messId}/grocery-items`, body).then((r) => r.data),
  updateItem: (
    messId: string,
    itemId: string,
    body: {
      nameEn?: string;
      nameBn?: string;
      aliases?: string[];
      category?: string;
      unit?: string;
      brand?: string | null;
      isActive?: boolean;
    },
  ) => api.patch<GroceryItem>(`/messes/${messId}/grocery-items/${itemId}`, body).then((r) => r.data),
  deleteItem: (messId: string, itemId: string) =>
    api.delete<{ id: string }>(`/messes/${messId}/grocery-items/${itemId}`).then((r) => r.data),

  listPrices: (
    messId: string,
    query?: {
      groceryItemId?: string;
      source?: string;
      verification?: string;
      from?: string;
      to?: string;
      page?: number;
      pageSize?: number;
    },
  ) => list<GroceryPrice>(api.get<GroceryPrice[]>(`/messes/${messId}/grocery-prices`, { query })),
  latestPrices: (messId: string) =>
    api.get<GroceryPrice[]>(`/messes/${messId}/grocery-prices/latest`).then((r) => r.data),
  createPrice: (
    messId: string,
    body: {
      groceryItemId: string;
      priceTaka: string | number;
      unit: string;
      source?: string;
      shopName?: string | null;
      location?: string | null;
      observedOn: string;
    },
  ) => api.post<GroceryPrice>(`/messes/${messId}/grocery-prices`, body).then((r) => r.data),
  updatePrice: (
    messId: string,
    priceId: string,
    body: {
      priceTaka?: string | number;
      unit?: string;
      verification?: string;
      shopName?: string | null;
      location?: string | null;
      observedOn?: string;
    },
  ) => api.patch<GroceryPrice>(`/messes/${messId}/grocery-prices/${priceId}`, body).then((r) => r.data),
  deletePrice: (messId: string, priceId: string) =>
    api.delete<{ id: string }>(`/messes/${messId}/grocery-prices/${priceId}`).then((r) => r.data),
};

/* -------------------------------------------------------------------------- */
/* Deposits                                                                   */
/* -------------------------------------------------------------------------- */

export const depositsApi = {
  list: (
    messId: string,
    query?: {
      status?: string;
      memberId?: string;
      monthId?: string;
      page?: number;
      pageSize?: number;
    },
  ) => list<Deposit>(api.get<Deposit[]>(`/messes/${messId}/deposits`, { query })),
  get: (messId: string, depositId: string) =>
    api.get<Deposit>(`/messes/${messId}/deposits/${depositId}`).then((r) => r.data),
  create: (
    messId: string,
    body: {
      memberId?: string;
      monthId?: string;
      amountTaka: string | number;
      method?: string;
      reference?: string | null;
      note?: string | null;
    },
  ) => api.post<Deposit>(`/messes/${messId}/deposits`, body).then((r) => r.data),
  verify: (messId: string, depositId: string) =>
    api.post<Deposit>(`/messes/${messId}/deposits/${depositId}/verify`).then((r) => r.data),
  reject: (messId: string, depositId: string, reason: string) =>
    api.post<Deposit>(`/messes/${messId}/deposits/${depositId}/reject`, { reason }).then((r) => r.data),
  remove: (messId: string, depositId: string) =>
    api.delete<{ id: string }>(`/messes/${messId}/deposits/${depositId}`).then((r) => r.data),
};

/* -------------------------------------------------------------------------- */
/* Expenses                                                                   */
/* -------------------------------------------------------------------------- */

export const expensesApi = {
  list: (
    messId: string,
    query?: {
      status?: string;
      category?: string;
      monthId?: string;
      page?: number;
      pageSize?: number;
    },
  ) => list<Expense>(api.get<Expense[]>(`/messes/${messId}/expenses`, { query })),
  get: (messId: string, expenseId: string) =>
    api.get<Expense>(`/messes/${messId}/expenses/${expenseId}`).then((r) => r.data),
  create: (
    messId: string,
    body: {
      monthId?: string;
      category: string;
      amountTaka: string | number;
      description: string;
      allocationMethod?: string;
      incurredOn: string;
      note?: string | null;
      allocations?: { memberId: string; amountTaka: string | number }[];
    },
  ) => api.post<Expense>(`/messes/${messId}/expenses`, body).then((r) => r.data),
  approve: (messId: string, expenseId: string) =>
    api.post<Expense>(`/messes/${messId}/expenses/${expenseId}/approve`).then((r) => r.data),
  reject: (messId: string, expenseId: string, reason: string) =>
    api.post<Expense>(`/messes/${messId}/expenses/${expenseId}/reject`, { reason }).then((r) => r.data),
  reverse: (messId: string, expenseId: string, reason: string) =>
    api.post<Expense>(`/messes/${messId}/expenses/${expenseId}/reverse`, { reason }).then((r) => r.data),
  remove: (messId: string, expenseId: string) =>
    api.delete<{ id: string }>(`/messes/${messId}/expenses/${expenseId}`).then((r) => r.data),
};

/* -------------------------------------------------------------------------- */
/* Utility bills                                                              */
/* -------------------------------------------------------------------------- */

export const utilitiesApi = {
  list: (messId: string, query?: { monthId?: string; page?: number; pageSize?: number }) =>
    list<UtilityBill>(api.get<UtilityBill[]>(`/messes/${messId}/utilities`, { query })),
  remove: (messId: string, expenseId: string) =>
    api.delete<{ id: string }>(`/messes/${messId}/utilities/${expenseId}`).then((r) => r.data),
  setBillPaid: (messId: string, expenseId: string, paid: boolean) =>
    api.patch<{ id: string; paid: boolean; paidById: string | null; paidAt: string | null }>(
      `/messes/${messId}/utilities/${expenseId}/payment-status`,
      { paid },
    ).then((r) => r.data),
  submitPayment: (
    messId: string,
    expenseId: string,
    body: { method: string; reference?: string | null; note?: string | null },
  ) => api.post<UtilityPayment>(`/messes/${messId}/utilities/${expenseId}/payments`, body).then((r) => r.data),
  verifyPayment: (messId: string, paymentId: string) =>
    api.post<UtilityPayment>(`/messes/${messId}/utilities/payments/${paymentId}/verify`).then((r) => r.data),
  rejectPayment: (messId: string, paymentId: string, reason: string) =>
    api.post<UtilityPayment>(`/messes/${messId}/utilities/payments/${paymentId}/reject`, { reason }).then((r) => r.data),
};

/* -------------------------------------------------------------------------- */
/* Bazar                                                                      */
/* -------------------------------------------------------------------------- */

export interface BazarItemPayload {
  groceryItemId?: string;
  nameSnapshot?: string;
  nameBnSnapshot?: string;
  unit: string;
  quantity: string | number;
  unitPriceTaka: string | number;
  confidence?: number;
  source?: string;
}

export const bazarApi = {
  list: (
    messId: string,
    query?: {
      status?: string;
      monthId?: string;
      buyerMemberId?: string;
      mine?: boolean;
      page?: number;
      pageSize?: number;
    },
  ) => list<BazarEntry>(api.get<BazarEntry[]>(`/messes/${messId}/bazar-entries`, { query })),
  get: (messId: string, entryId: string) =>
    api.get<BazarEntry>(`/messes/${messId}/bazar-entries/${entryId}`).then((r) => r.data),
  create: (
    messId: string,
    body: {
      monthId?: string;
      purchaseDate: string;
      shopName?: string | null;
      paymentMethod?: string;
      notes?: string | null;
      items: BazarItemPayload[];
      submit?: boolean;
    },
  ) => api.post<BazarEntry>(`/messes/${messId}/bazar-entries`, body).then((r) => r.data),
  update: (
    messId: string,
    entryId: string,
    body: {
      purchaseDate?: string;
      shopName?: string | null;
      paymentMethod?: string;
      notes?: string | null;
      items?: BazarItemPayload[];
    },
  ) => api.patch<BazarEntry>(`/messes/${messId}/bazar-entries/${entryId}`, body).then((r) => r.data),
  submit: (messId: string, entryId: string) =>
    api.post<BazarEntry>(`/messes/${messId}/bazar-entries/${entryId}/submit`).then((r) => r.data),
  approve: (messId: string, entryId: string) =>
    api.post<BazarEntry>(`/messes/${messId}/bazar-entries/${entryId}/approve`).then((r) => r.data),
  reject: (messId: string, entryId: string, reason: string) =>
    api.post<BazarEntry>(`/messes/${messId}/bazar-entries/${entryId}/reject`, { reason }).then((r) => r.data),
  remove: (messId: string, entryId: string) =>
    api.delete<{ id: string }>(`/messes/${messId}/bazar-entries/${entryId}`).then((r) => r.data),
};

/* -------------------------------------------------------------------------- */
/* Bazar duties                                                               */
/* -------------------------------------------------------------------------- */

export const dutiesApi = {
  list: (messId: string, query?: { monthId?: string; status?: string }) =>
    api.get<Duty[]>(`/messes/${messId}/duties`, { query }).then((r) => r.data),
  generate: (
    messId: string,
    body: {
      monthId?: string;
      dates?: string[];
      eligibleMemberIds?: string[];
      preserveOverrides?: boolean;
    },
  ) => api.post<Duty[]>(`/messes/${messId}/duties/generate`, body).then((r) => r.data),
  swap: (messId: string, body: { fromDutyId: string; toDutyId: string; reason?: string }) =>
    api.post<Duty[]>(`/messes/${messId}/duties/swap`, body).then((r) => r.data),
  assign: (messId: string, dutyId: string, body: { assigneeMemberId: string | null; reason: string }) =>
    api.patch<Duty>(`/messes/${messId}/duties/${dutyId}`, body).then((r) => r.data),
  setStatus: (messId: string, dutyId: string, body: { status: string; reason?: string }) =>
    api.patch<Duty>(`/messes/${messId}/duties/${dutyId}/status`, body).then((r) => r.data),
};

/* -------------------------------------------------------------------------- */
/* Reports                                                                    */
/* -------------------------------------------------------------------------- */

export interface ReportQuery {
  monthId?: string;
  year?: number;
  month?: number;
  /** Index signature so the object can be handed straight to `buildQuery`. */
  [key: string]: QueryValue;
}

export const reportsApi = {
  monthly: (messId: string, query: ReportQuery) =>
    api.get<MonthlyReport>(`/messes/${messId}/reports/monthly`, { query }).then((r) => r.data),
  summary: (messId: string, query: ReportQuery) =>
    api.get<MonthSummary>(`/messes/${messId}/reports/summary`, { query }).then((r) => r.data),
  balances: (messId: string, query: ReportQuery) =>
    api.get<MemberBalances>(`/messes/${messId}/reports/balances`, { query }).then((r) => r.data),
};

/* -------------------------------------------------------------------------- */
/* Audit logs                                                                 */
/* -------------------------------------------------------------------------- */

export const auditApi = {
  list: (
    messId: string,
    query?: { entityType?: string; action?: string; actorUserId?: string; page?: number; pageSize?: number },
  ) => list<AuditLog>(api.get<AuditLog[]>(`/messes/${messId}/audit-logs`, { query })),
};

/* -------------------------------------------------------------------------- */
/* Media                                                                      */
/* -------------------------------------------------------------------------- */

export interface UploadSignature {
  provider: string;
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
  type: string;
  uploadUrl: string;
  allowedFormats: string[];
}

export const mediaApi = {
  sign: (messId: string, kind = "BAZAR_PHOTO") =>
    api.post<UploadSignature>(`/messes/${messId}/media/sign`, { kind }).then((r) => r.data),
  confirm: (
    messId: string,
    body: {
      publicId: string;
      kind?: string;
      bazarEntryId?: string | null;
      secureUrl?: string | null;
      bytes?: number;
      mimeType?: string;
      width?: number;
      height?: number;
      resourceType?: string;
    },
  ) => api.post<MediaAsset>(`/messes/${messId}/media`, body).then((r) => r.data),
  list: (messId: string, query?: { kind?: string; bazarEntryId?: string }) =>
    api.get<MediaAsset[]>(`/messes/${messId}/media`, { query }).then((r) => r.data),
  signedUrl: (messId: string, mediaId: string, ttl?: number) =>
    api
      .get<{ url: string; expiresAt: string }>(`/messes/${messId}/media/${mediaId}/url`, { query: { ttl } })
      .then((r) => r.data),
  remove: (messId: string, mediaId: string) =>
    api.delete<{ id: string }>(`/messes/${messId}/media/${mediaId}`).then((r) => r.data),
};

/* -------------------------------------------------------------------------- */
/* AI                                                                         */
/* -------------------------------------------------------------------------- */

export const aiApi = {
  bazarExtract: (messId: string, body: { mediaIds?: string[]; imageUrls?: string[]; bazarEntryId?: string }) =>
    api.post<AiDraftResult<BazarDraft>>(`/messes/${messId}/ai/bazar-extract`, body).then((r) => r.data),
  priceEstimate: (
    messId: string,
    body: { groceryItemId?: string; nameEn?: string; nameBn?: string; unit?: string },
  ) => api.post<AiDraftResult<PriceEstimate>>(`/messes/${messId}/ai/price-estimate`, body).then((r) => r.data),
  reportSummary: (messId: string, monthId: string) =>
    api
      .post<AiDraftResult<ReportSummary>>(`/messes/${messId}/ai/report-summary`, { monthId })
      .then((r) => r.data),
  usage: (messId: string) => api.get<AiUsage>(`/messes/${messId}/ai/usage`).then((r) => r.data),
};
