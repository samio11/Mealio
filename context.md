# context.md — Project Development Memory

> Persistent memory for this project. **Mandatory:** update this file in the same task
> whenever you create/modify a feature, change business logic, alter the DB schema,
> add/change an API endpoint, change auth, integrate an AI provider, change UI
> conventions, fix a bug, add/remove a dependency, or change environment configuration.
>
> Source of truth hierarchy: **code** = what is implemented · **PRD/master prompt** = intended
> behaviour · **this file** = current state connecting the two.

---

## 1. Project overview

**Product:** AI-powered multi-mess management SaaS for Bangladesh.
**Purpose:** Help shared-mess residents (student messes, bachelor messes, shared apartments)
manage shared finances, meals, grocery/bazar purchases, bazar duty, member balances, and
monthly reports.

**Target users:** Mess managers and members in Bangladesh.

**Bangladesh-specific context**
- Languages: Bangla (বাংলা) + English item names and UI text.
- Currency: Bangladesh Taka (BDT / ৳). Financial values stored as integer **poisha** (1 ৳ = 100 poisha).
- Timezone: `Asia/Dhaka` used consistently for meal cut-offs, dates, and month boundaries.
- Grocery units: kg, gram, litre, piece, dozen, packet, bottle.
- Mobile-first, works on ordinary mobile internet.

**Scope & launch constraints**
- **Initial launch is FREE.** No subscription billing, no paid plans, no feature gating, no checkout.
- Multi-tenant: one account may belong to multiple messes with different roles per mess.
- Modular monolith (no microservices for MVP).

**Roles:** Platform administrator · Mess manager · Member · Bazar assignee (member assigned to shop on a date).
Permissions are enforced **per mess**, never globally.

---

## 2. Technology stack

**STATUS (2026-11-20):** Server Phases 1–5, utility-bill APIs, profile-photo settings, WhatsApp contacts, branded invitation email, and ordered AI-provider fallback are implemented. The full server suite last passed 92/92 on 2026-11-18; focused feature tests, including the AI-provider fallback tests, passed individually. Server typecheck passes.

| Layer | Target technology | Actual version | Notes |
|---|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | next `^15.1.4`, react/react-dom `^19.0.0`, typescript `^5.7.3` | `client/`, ESM (`"type":"module"`) |
| Styling | Tailwind CSS + shadcn/ui | tailwindcss `^4.0.0` (+ `@tailwindcss/postcss`), Radix primitives `^1.x`/`^2.x` | shadcn/ui components hand-placed in `components/ui/` |
| Forms/validation | React Hook Form + Zod | react-hook-form `^7.54.2`, `@hookform/resolvers` `^3.10.0`, zod `^4.6.7` | ⚠️ resolver v3 + zod v4 pairing is unofficial — see §14 D16 |
| Client data | TanStack Query | `@tanstack/react-query` `^5.62.11` | key factory `qk` in `lib/hooks/queries.ts` |
| Charts | Recharts | `^2.15.0` | reports/dashboard charts |
| Icons | Lucide | `lucide-react` `^0.469.0` | |
| Toasts | sonner | `^1.7.2` | mutation feedback |
| Auth client | Better-Auth browser client | `better-auth` `^1.7.25` | `lib/auth-client.ts` (same-origin cookies) |
| Backend | Node.js + Express + TypeScript | express `^5.3.0` | `server/`, ESM (`"type":"module"`) |
| ORM / DB | Prisma 7 + PostgreSQL | prisma / @prisma/client `^7.10.1` | `prisma-client` generator + `@prisma/adapter-pg` |
| Validation (server) | Zod | `^4.6.7` | |
| Auth | Better-Auth | `^1.7.25` | prismaAdapter, email/password, Google, emailOTP |
| Queue (if needed) | Redis + BullMQ | not installed | only if background jobs required |
| AI | Provider-agnostic layer (OpenRouter primary; Gemini/Groq optional) | **OpenRouter verified 2026-11-17** | see §4 |
| Storage | Cloudinary (private) / S3-compatible | `cloudinary ^2.7.0` | wired for private profile and bazar media uploads |
| Logging | pino + pino-http | `pino ^9.9.4`, `pino-http ^10.5.0` | request logging + redaction |
| Local infra | Docker + Docker Compose | not installed | |
| Package manager | npm workspaces (root `package.json`) | npm `11.20.0` | decision D6 |

**Local toolchain detected (2026-11-17):** Node `v26.13.1`, npm `11.20.0`, git `2.56.1.windows.1`. `pnpm` not found on PATH.

**Prisma 7 specifics (learned the hard way — do not re-discover):**
- Config file is `server/prisma7.config.ts` (not `prisma.config.ts`); it supplies `datasource.url`.
- Generator is the new `prisma-client` provider (output `src/generated/prisma`), `moduleFormat = "esm"`,
  `runtime = "nodejs"`. Generated files import with `.ts` extensions → server tsconfig sets
  `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`.
- No Rust query engine; the `pg` adapter owns the pool.
- `migrate dev` needs a **shadow database** (not permitted on this Neon plan). Use
  `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` to generate SQL
  into `prisma/migrations/<ts>_init/migration.sql`, then `prisma migrate deploy`.
- npm 11 blocks postinstall scripts by default → `npm install-scripts approve @prisma/engines esbuild prisma`.
- `migration_lock.toml` must be **UTF-8 without BOM** (PowerShell `Set-Content -Encoding utf8` adds a BOM → P3019).

---

## 3. Repository structure

**Current (2026-11-20, after AI-provider fallback work):**
```
d:/Web/Mess_Managment/
├── ai_master_development_prompt_mess_saas.md   # master prompt / requirements
├── README.md                                    # product overview, setup, commands, and limitations
├── context.md                                   # this file
├── package.json                                 # npm workspaces root
├── .gitignore
├── client/                                      # Next.js 15 App Router frontend
│   ├── package.json / tsconfig.json / next.config.ts / next-env.d.ts / postcss? (via @tailwindcss/postcss)
│   ├── app/
│   │   ├── layout.tsx · globals.css · page.tsx   # root layout (fonts, providers) + landing page
│   │   ├── error.tsx · not-found.tsx
│   │   ├── (auth)/layout.tsx · (auth)/sign-in/page.tsx · (auth)/sign-up/page.tsx
│   │   ├── (app)/layout.tsx                      # AuthGuard + AppShell + MonthProvider
│   │   ├── (app)/dashboard/page.tsx              # pick/create a mess (my messes)
│   │   ├── (app)/onboarding/page.tsx · (app)/settings/page.tsx
│   │   ├── invitations/[token]/page.tsx          # public invitation preview + accept
│   │   └── (app)/m/[messId]/
│   │       ├── layout.tsx · page.tsx             # mess overview
│   │       ├── dashboard/page.tsx · months/page.tsx · members/page.tsx
│   │       ├── meals/page.tsx (meals + menus) · bazar/page.tsx · duties/page.tsx
│   │       ├── deposits/page.tsx · expenses/page.tsx · utilities/page.tsx · grocery/page.tsx
│   │       ├── reports/page.tsx · audit/page.tsx
│   ├── components/
│   │   ├── ui/            # shadcn-derived primitives (button, card, dialog, select, table, …)
│   │   ├── app-shell/     # app-shell, nav-config, nav-links, user-menu, mess-switcher, month-selector
│   │   ├── shared/        # money, stat-card, status-badge, error-state, empty-state, page-header,
│   │   │                  #   skeletons, no-month, confirm-dialog, pagination
│   │   ├── auth/auth-guard.tsx
│   │   ├── landing/{site-nav,product-preview}.tsx
│   │   └── providers.tsx  # TanStack Query + Toaster
│   └── lib/
│       ├── api/{client,endpoints,types}.ts       # typed fetch wrapper + endpoint modules + DTOs
│       ├── hooks/{queries,use-my-membership}.ts  # qk key factory + read hooks
│       ├── context/active-month.tsx              # app-wide active month (localStorage)
│       ├── bangladesh-phone.ts · profile-photo.ts · format.ts · utils.ts · auth-client.ts
└── server/
    ├── package.json / tsconfig.json / tsconfig.build.json
    ├── prisma7.config.ts                        # Prisma 7 config (datasource url)
    ├── .env / .env.example
    ├── prisma/
    │   ├── schema.prisma                        # Prisma models; money is BigInt poisha
    │   ├── seed.ts                              # idempotent super-admin seed
    │   └── migrations/20261117141313_init/      # deployed to Neon (24 public tables)
    ├── vitest.config.ts
    ├── tests/
    │   ├── helpers/http.ts                      # cookie-aware TestClient
    │   ├── unit/{money,date,duty-scheduler,catalogue-matcher,reports-csv}.test.ts
    │   ├── financial/{financial-engine,utility-bill-status}.test.ts
    │   └── security/{tenant-isolation,whatsapp-contact}.test.ts
    └── src/
        ├── server.ts                            # entry: BigInt serializer, listen, graceful shutdown
        ├── types/express.d.ts
        ├── app/
        │   ├── app.ts                           # Express wiring (order matters — see §4)
        │   ├── config/{env.ts,constants.ts}
        │   ├── db/prisma.ts                     # PrismaPg adapter
        │   ├── middlewares/{auth,tenant,validate,error,not-found}.ts
        │   └── utils/{money,date,json,logger,app-error,api-response,async-handler,
        │              zod-helpers,pagination,audit,mailer}.ts
        ├── generated/prisma/                    # Prisma 7 generated client (committed)
        └── modules/
            ├── auth/auth.ts
            ├── users/ · messes/ · memberships/ · invitations/
            ├── months/ · meals/ (meals + menus) · grocery-catalogue/ · grocery-prices/
            ├── deposits/ · expenses/ · utilities/ · bazar/ · bazar-duty/ (+ duty-scheduler.ts)
            ├── reports/ · media/ · ai/ · audit-logs/
```

**Where new features go:** server business logic in `server/src/modules/<module>/`;
AI logic in `server/src/ai/`; UI pages in `client/app/(app)/m/[messId]/<feature>/page.tsx`
with reusable pieces in `client/components/shared/` and data access in
`client/lib/api/endpoints.ts` (+ `client/lib/api/types.ts`).

---

## 4. Architecture

**Application architecture:** Modular monolith.
`Route → Middleware (auth → tenant scope → rbac → validation) → Controller (HTTP only) →
Service (business logic) → Repository → Prisma → PostgreSQL`.
Controllers never contain business logic; services never touch `req`/`res`.

**Request flow:** REST under `/api/v1`. Zod validates every input. Uniform success/error
envelope. Proper status codes. Pagination/filtering/sorting on lists.

**AuthN / AuthZ strategy:** Better-Auth for sessions/identity (server-side, HTTP-only
cookies); server-side role checks per mess. Never trust client-side role checks.

**Multi-tenant isolation:** Every mess-owned row carries `messId`. Middleware resolves the
authenticated user's active membership for the requested mess and attaches it to the request.
Services filter by `messId`. Cross-mess access must fail. Automated tests will attempt
cross-mess access.

**AI processing flow (provider-independent):**
`upload → private storage → processing job → provider call (structured JSON) → Zod validation →
catalogue matching → structured draft w/ field-level confidence + source → user review/correct →
member submit → manager verify/approve → post to ledger`.
AI **never** approves or posts financial transactions; it only produces drafts. Validate all
model output with Zod; treat it as untrusted. Server-only API keys; manual workflow always
available if all providers fail. Chat fallback order is OpenRouter (`AI_TEXT_MODEL`, default
`baidu/ernie-5.5-flash-preview:free`) → Groq (`llama-3.3-70b-versatile`) → Gemini
(`gemini-3.5-flash-lite`). Manager report summaries also fall through when a provider returns
invalid JSON or a response that fails the summary schema.

**Media flow:** Originals in private storage; access via signed, expiring URLs; never public URLs.

**Implemented conventions (server, 2026-11-17) — follow these when adding modules:**
- Response envelope: success `{success:true, data, meta?}`; failure `{success:false, error:{code,message,details?}}`.
- Error codes: `VALIDATION_ERROR · UNAUTHORIZED · FORBIDDEN · NOT_FOUND · CONFLICT · RATE_LIMITED ·`
  `BUSINESS_RULE_VIOLATION · AI_PROVIDER_ERROR · INTERNAL_ERROR`.
- `AppError` (`server/src/app/utils/app-error.ts`) is the only error type services throw.
  `errorHandler` is the single place that formats errors (AppError, ZodError, malformed JSON, Prisma P-codes).
- `validate({body,query,params})` middleware. **Express 5 gotcha:** `req.query` is a getter, so the parsed
  query object is written to **`req.listQuery`** (typed in `types/express.d.ts`).
- Tenant guard `requireMessAccess({manager?, allowInactive?})` reads messId from `:messId` param →
  `x-mess-id` header → query → body, and grants access **only** via an ACTIVE `messMembership` row.
- Express wiring order in `app.ts` (do not reorder — it breaks auth): helmet → cors(credentials) →
  pino-http → **Better-Auth handler `app.all("/api/auth/*splat", toNodeHandler(auth))` BEFORE any body
  parser** → `express.json` → `express.urlencoded` → `cookieParser` → rate limit (skipped when `NODE_ENV=test`)
  → `/health` → feature routers → `notFoundHandler` → `errorHandler`. Express 5 needs the named wildcard `*splat`.
- Sub-resource routers must use `Router({ mergeParams: true })` to see `:messId` from the mount path.
- Better-Auth rejects requests with a missing/untrusted `Origin` (`MISSING_OR_NULL_ORIGIN`); non-browser
  clients (tests/scripts) must send `Origin: <FRONTEND_URL>`.
- Money: BigInt poisha everywhere; `installBigIntSerializer()` runs before the server starts listening.
- Every write that touches money or membership goes through `db.$transaction` and calls
  `writeAuditLog(tx, {...})` inside that same transaction.
- Membership rows are **never hard-deleted** (financial history references them) — removal sets
  `status=REMOVED` + `leftAt`.
- Invariant enforced in code: a mess must always keep ≥ 1 `ACTIVE` `MANAGER`.

**Implemented conventions (client, 2026-11-17) — follow these when adding pages:**
- **Same-origin API proxying.** [`client/next.config.ts`](file:///d:/Web/Mess_Managment/client/next.config.ts) `rewrites()`
  maps `/api/:path*` → `${API_PROXY_TARGET ?? "http://localhost:5000"}/api/:path*` and `/health` → the same
  target, so the Better-Auth session cookie is **first-party** and `credentials: "include"` works with no CORS.
- **Typed fetch wrapper.** [`client/lib/api/client.ts`](file:///d:/Web/Mess_Managment/client/lib/api/client.ts)
  exposes `API_BASE = "/api/v1"`, `api.get/post/patch/put/delete`, an `ApiError` (carrying `code`/`message`/`details`)
  and `buildQuery`. Every endpoint module in `lib/api/endpoints.ts` returns the unwrapped `data` and never
  touches `fetch` directly.
- **Money is a string.** The server serialises BigInt poisha as **strings**; the client never does float math.
  `formatPoisha` uses `BigInt`; renders go through `<Money>`; tables use the `.tabular` util. Inputs convert
  poisha→taka with `BigInt` division (`poishaToTaka`) and send **taka strings** back (server `zTaka` → poisha).
- **Dates.** `@db.Date` values are Dhaka calendar dates; `formatDate`/`formatDateTime` use
  `Intl.DateTimeFormat` with `timeZone: "Asia/Dhaka"` (date-only values use `"UTC"`); `todayInDhaka()` for "today".
- **Active month is app-wide state.** [`client/lib/context/active-month.tsx`](file:///d:/Web/Mess_Managment/client/lib/context/active-month.tsx)
  (`MonthProvider` + `useActiveMonth`) persists the selection under `localStorage` key `mm:activeMonth:<messId>`;
  `months/page.tsx` and the shell's `month-selector` both write it, so switching months switches every page.
- **TanStack Query.** Key factory `qk` (`lib/hooks/queries.ts`): `qk.months/qk.month/qk.audit(...)`, etc.
  Mutations invalidate the affected resource key and toast through `sonner`.
- **Feature-page pattern.** `"use client"` → `useParams` → manager gate via `useMyMembership`
  (`{isManager}`; non-managers get an `Alert` card) → `useQuery` → `PageHeader` → `BlockSkeleton` while
  loading → `ErrorState` (retry) on failure → `EmptyState` when empty → data. Statuses render via
  `<StatusBadge>`; destructive actions always go through `<ConfirmDialog>`; lists use `<Pagination meta=…>`.
- **No fabricated data.** Nothing on the client invents figures, testimonials or statistics; missing values
  render as “—”. No placeholder links or dead buttons on finished pages.

---

## 5. Database design

**STATUS: schema deployed; all tracked migrations applied on 2026-11-19** — migrations
`20261117141313_init`, `20261118000000_default_meals_off`, `20261118190000_guest_meals`,
`20261119100000_utility_bills`, and `20261119170000_utility_bill_paid_status`; tables in
`public` (`users, sessions, accounts, verifications, messes, mess_memberships, mess_invitations,`
`mess_months, meal_type_settings, meal_records, guest_meal_records, daily_menus, grocery_items, grocery_prices, deposits,`
`expenses, expense_allocations, utility_payments, member_adjustments, bazar_entries, bazar_entry_items, bazar_duties,`
`media, ai_extractions, audit_logs, _prisma_migrations`). `neon_auth.*` was **not** touched.

**Entities implemented:** `User`, `Session`, `Account`, `Verification` (Better-Auth contract — model
names must stay exactly these), `Mess`, `MessMembership`, `MessInvitation`, `MessMonth`,
`MealTypeSetting`, `MealRecord`, `GuestMealRecord`, `DailyMenu`, `GroceryItem`, `GroceryPrice`, `Deposit`, `Expense`,
`ExpenseAllocation`, `UtilityPayment`, `MemberAdjustment`, `BazarEntry`, `BazarEntryItem`, `BazarDuty`, `Media`,
`AIExtraction`, `AuditLog`.

**Enums:** `PlatformRole`, `MessRole`, `MembershipStatus`, `InvitationStatus`, `MonthStatus`,
`MealRatePolicy`, `MealType`, `MealRecordStatus`, `MealChangeSource`, `Unit`, `PriceSource`,
`PriceVerification`, `DepositStatus`, `PaymentMethod`, `ExpenseCategory`, `ExpenseStatus`,
`AllocationMethod`, `UtilityPaymentStatus`, `AdjustmentType`, `BazarStatus`, `DutyStatus`, `MediaKind`,
`AIExtractionStatus`.

**Constraints actually enforced in Prisma:**
- Unique membership `(messId, userId)`; unique month `(messId, year, month)`; unique meal record
  `(messId, memberId, date, mealType)` and guest meal `(messId, memberId, date, mealType)`; unique daily menu `(messId, date, mealType)`; unique duty
  `(messId, date)`; unique `meal_type_setting (monthId, mealType)`; unique `expense_allocation
  (expenseId, memberId)`; unique `utility_payments (expenseId, memberId)` and
  `deposits.utilityPaymentId`; unique `expense.reversalOfId` (an expense can be reversed only once).
- Indexes on `messId`, `monthId`, `memberId`, dates and statuses as declared per model.
- Deletion behaviour protects history: deposits, expenses, bazar records, allocations, adjustments,
  meal records, and guest meal records restrict deletion of referenced memberships. Financial
  records restrict deletion of referenced months; meal and guest meal records cascade with their
  month. `Expense.bazarEntryId → BazarEntry` and `AuditLog.actorUserId → User` use `SetNull`.
  Utility payment rows cascade with their expense; service-level safeguards prevent deletion of a
  bill with member payment history or a recorded provider payment.
- Cascade is used for rows that cannot outlive their parent mess, including sessions, accounts,
  invitations, meals, guest meals, media, AI extractions, and audit logs.

**Financial fields:** all money is `BigInt` **poisha** (`amountPoisha`, `openingCashPoisha`,
`budgetPoisha`, `pricePoisha`, `unitPricePoisha`, `lineTotalPoisha`). `BazarEntryItem.quantity` is
`Decimal(12,3)` — quantity is not money, so Decimal is correct there. `@db.Date` columns store the
**Dhaka calendar date** (implemented as UTC midnight of that date — see `utils/date.ts`).
`MessMonth.settingsSnapshot` (Json) exists so historical reports can be reproduced after settings change.

**Snapshots:** `BazarEntryItem` snapshots `itemNameSnapshot`, `itemNameBnSnapshot`, `unitSnapshot`,
`quantity`, `unitPricePoisha`, `lineTotalPoisha` at purchase time, so catalogue edits never rewrite history.

**Migrations:** applied via `prisma migrate deploy` (no shadow DB). All five tracked migrations are applied
to the configured database. Generated SQL via
`prisma migrate diff --from-empty`. **Do not run `prisma migrate dev`** — this Neon plan cannot create a
shadow database.

---

## 6. Business rules

Legend: **[C]** confirmed from master prompt · **[A]** assumed (recorded, reversible) · **[?]** needs user confirmation.

**Meal calculation** [C]
- Total meal expenses = approved expenses categorised as meal/bazar.
- Total meal count = member meals marked ON plus guest meals assigned to members.
- Meal rate = total meal expenses ÷ total meal count.
- Member meal cost = member meal count × meal rate.
- Member balance = verified deposits − meal cost − allocated charges + credits.
- Calculation policy saved **per month**.
- **[?]** Rounding policy for meal rate (assumed: store poisha integers; round half-up at the
  final member-cost step only, so the sum of member costs still reconciles to total expenses).

**Deposits / expenses** [C]
- Only **verified** deposits count as confirmed collected money. Pending shown separately.
- Only **approved** expenses count in official reports.
- Approved transactions are never hard-deleted; corrections use reversals/adjustment entries.
- Record actor + reason for every change.

**Bazar** [C]
- States: Draft → Pending review → Approved / Rejected; corrections via auditable adjustments.
- Only approved bazar entries count toward confirmed expenses.
- A grocery photo cannot prove exact quantity/price unless visible/provided; unknown fields stay
  unknown and require manual input. AI output never directly approves/posts a transaction.

**Bazar duty** [C]
- `base = floor(days ÷ eligibleMembers)`; each eligible member gets `base`; distribute the
  remainder one at a time; rotate the "extra" across months; avoid adjacent same-member
  assignments where possible; support unavailability, swaps, manual reassignment, member changes;
  preserve completed assignments; recalculate only future uncompleted assignments; keep reason +
  audit for overrides.
- Generator must be **deterministic and testable** (no unseeded randomness).

**Meal cut-off** [C]
- Defaults: Breakfast 08:00, Lunch 12:00, Dinner 20:00 (Asia/Dhaka), manager-customisable.
- New/open-month meals default to OFF; members may switch ON or OFF up to the configured cut-off
  instant; after that only a manager override (with audit) is allowed.
- If a meal type is disabled for the month, members cannot enable it themselves.
- Guest meals are stored independently from member ON/OFF records and are counted as additional
  meals. Setting a guest count to zero removes that guest entry without changing the member's meal.
- Store dated per-member per-meal choice records; closed legacy months retain their frozen
  defaults so finalized reports remain stable.

**Monthly period** [C]
- Calendar month by default; unique `(messId, year, month)`. Changing a future month's settings
  must not rewrite historical months; snapshot the settings needed for old reports.

**Price source / AI confidence** [?]
- Sources: manager-entered · verified bazar purchase · admin-curated reference · permitted
  retailer/feed · AI estimate. Manager's verified purchase price is the source of truth.
- Never claim live retailer prices unless actually retrieved from a permitted source.
- **[?]** Confidence threshold below which an AI field is treated as "unknown" (assumed default: 0.6).

**Financial integrity** [C]
- Distinguish `Budget remaining = budget − approved budget expenses` from
  `Closing cash = opening cash + confirmed inflows − approved payments − confirmed refunds`.
- Balance rules: `[?]` rounding + who bears residual poisha (assumed: allocate residual to the
  largest balance, recorded in the month policy).

**Utility bills**
- Supported categories: electricity, gas, water, garbage, and optional maid. Managers create them
  through the expense flow; each bill is equally allocated among active members when approved.
- Members submit a share-payment request using cash, bKash, Nagad, or card; managers verify or
  reject each request. A verified share is linked to a deposit so financial reports count it once.
- Provider payment is a separate manager-only paid/not-paid status. Marking the provider bill paid
  does not mark member shares as paid or create member deposits.
- Only the manager who created a utility bill may delete it; deletion is blocked once member
  payment history, provider payment, or reversal makes deletion unsafe.

**Contact and profile privacy**
- Users can view and update their profile photo and contact details in account settings.
- Accept Bangladeshi local and international mobile-number formats and normalize valid values to
  `+880…`. WhatsApp contact links are shown only for active opposite-role users in the same mess;
  same-role and inactive-member contact numbers are not returned.

---

## 7. Features

**Completed (server) — Phases 1–5 plus utility bills and contact privacy:**
- Bootstrap: Express wiring, `/health`, central error handling, rate limiting, logging, graceful shutdown.
- Auth (Better-Auth: email+password, Google OAuth when configured, email OTP for verify/reset).
- User profile: read/update own profile; list own messes.
- Mess creation + update/archive (creator becomes first MANAGER, audited, transactional).
- Memberships: list/read/update/remove, role & status changes, last-manager invariant, soft removal.
- Invitations: create (email and/or phone), list, revoke, public preview by token, accept by token,
  expiry handling, identity match, branded responsive HTML email with Mealio logo, acceptance link,
  fallback code, and plain-text version (best-effort delivery).
- **Months:** create/list/detail/update (opening cash, budget, meal-rate policy), per-meal settings
  (`enabled`/`defaultOn`/`cutoff`), close/reopen (snapshots settings on close), auto-create helpers
  (`ensureMonth` / `ensureCurrentMonth` / `ensureMonthForDate`).
- **Meals:** day status, counts, records list, set record, manager override (post cut-off), bulk set,
  delete; independent guest meal records; monthly per-member meal timelines; audited month-wide
  status overrides; **Menus:** list/upsert/delete daily menus.
- **Grocery catalogue:** CRUD items (Bangla + English names, unit, category). **Grocery prices:**
  history list, `/latest`, create/update/delete, `PriceSource` + `PriceVerification`.
- **Deposits:** create/list/detail, verify, reject, delete (statuses `PENDING/VERIFIED/REJECTED`).
- **Expenses:** create/list/detail, approve, reject, reverse (via `reversalOfId`, unique), delete;
  `ExpenseAllocation` splits.
- **Utility bills:** electricity, gas, water, garbage, and optional maid expenses; equal active-member
  allocations; member share payments by cash/bKash/Nagad/card; manager verification/rejection;
  separate provider paid/not-paid status; creator-only deletion with financial-history safeguards.
- **Profile and contact:** account profile/photo updates; role-aware WhatsApp contact links for
  valid Bangladeshi numbers, with same-mess active-membership privacy filtering.
- **Bazar entries:** create/list/detail/update, submit → review → approve/reject, delete; line-item
  snapshots (`itemNameSnapshot`, `unitPricePoisha`, `lineTotalPoisha`) so catalogue edits don't rewrite history.
- **Bazar duty:** deterministic generator (floor + remainder rotation, no unseeded randomness), list,
  swap two duties, manual reassign, status updates.
- **Reports:** `monthly` (full report), `summary` (budget vs actual, closing cash), `balances`
  (per-member), `monthly.csv` (CSV export).
- **Media:** signed upload (`/sign`), confirm upload, list, signed expiring URL, delete (private storage).
- **AI:** `bazar-extract` (photo → structured draft), `price-estimate`, `report-summary`, `usage`;
  chat requests try OpenRouter, Groq, then Gemini; report summaries fall through on provider errors
  and invalid schema output; all output is Zod-validated and never auto-approves or posts a transaction.
- **Audit logs:** manager-only paginated trail (filters: entityType/entityId/actor/action/from/to) with
  before/after snapshots.
- Seed: idempotent super-admin (`prisma/seed.ts`).

**Completed (client) — Next.js app:**
- Landing page (`/`), auth pages (`/sign-in`, `/sign-up`) with email/password; optional Google
  sign-in is offered on the sign-in page only. Registration includes an optional profile photo,
  invitation accept (`/invitations/[token]`), onboarding + settings + mess picker (`/dashboard`).
  Settings includes a dashboard back link, profile-photo preview/upload, and Bangladeshi phone
  validation/normalization.
- Mess shell (`/m/[messId]`): overview, **dashboard**, **months**, **members**, **meals** (guest
  meals, responsive monthly per-member timelines, non-destructive manager month editor, and menus),
  **bazar** (incl. a **Photos** dialog: upload/thumbnail/delete against private Cloudinary storage),
  **duties**, **deposits**, **expenses**, **utilities** (equal shares, member payment requests,
  manager verification and provider paid/unpaid status), **grocery** (catalogue + prices),
  **reports**, **audit**. The members page offers WhatsApp links only when contact/privacy rules pass.
- Shell chrome: mess switcher, month selector (writes the app-wide active month), user menu, manager-only
  nav items.
- Reusable pieces: `<Money>`, `<StatCard>`, `<StatusBadge>`, `<PageHeader>`, `<ErrorState>`, `<EmptyState>`,
  `<Pagination>`, `<ConfirmDialog>`, `<NoMonth>`, skeleton loaders, charts via Recharts.

**Known limitations:** no live grocery price source (prices are manager-entered / AI-estimated and labelled
as such); AI free tier = 50 requests/day (manual entry always works); Stripe/billing intentionally absent
(free launch); client has no browser test runner — verification is `typecheck` + `build` (see §11).

---

## 8. API documentation

**Base:** `/api/v1` (auth is `/api/auth/*`, owned by Better-Auth).
All responses use the envelope in §4. All `/api/v1/*` routes require a session cookie unless noted.

**Health**
| Method | Path | Notes |
|---|---|---|
| GET | `/health` | public; `{status, env, uptime}` |

**Auth (Better-Auth — do not hand-roll)**
| Method | Path |
|---|---|
| POST | `/api/auth/sign-up/email` · `/api/auth/sign-in/email` · `/api/auth/sign-out` |
| GET | `/api/auth/get-session` |
| POST | `/api/auth/email-otp/send-verification-otp` · `/api/auth/email-otp/verify-email` |
| POST | `/api/auth/forget-password/email-otp` · `/api/auth/reset-password` |
| GET | `/api/auth/callback/google` (only when Google is configured) |

**Users** (`/api/v1/users`)
| Method | Path | Notes |
|---|---|---|
| GET | `/me` | own profile |
| PATCH | `/me` | name, phone (Bangladeshi local/international formats normalized to `+8801XXXXXXXXX`), locale `bn\|en`, image; phone uniqueness enforced |
| GET | `/me/messes` | messes the caller belongs to; returns `{ messId, name, area, archived, role, status, membershipId }` per mess |

Profile photos are uploaded directly to Cloudinary using the signed profile-image upload flow,
then saved through `PATCH /me`; photo preview and editing are available in `/settings`.

**Messes** (`/api/v1/messes`)
| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/` | auth | same data as `/users/me/messes` |
| POST | `/` | auth | creates mess + creator's MANAGER membership + audit (transaction) |
| GET | `/:messId` | ACTIVE membership | 403 (not 404) if not a member |
| PATCH | `/:messId` | MANAGER | name, area, address, `archived` (snapshots before/after to audit) |

**Memberships** (`/api/v1/messes/:messId/members`)
| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/` | member | filters: `status`, `includeRemoved`, `search`, pagination; phone is returned only to an active opposite-role member/manager of the same mess |
| GET | `/:memberId` | member | |
| PATCH | `/:memberId` | member (self profile fields) / MANAGER (role, status) | `role`, `status`, `displayName`, `phone`, `isDutyEligible`; 422 if it would remove the last active manager |
| DELETE | `/:memberId` | MANAGER | soft removal → `status=REMOVED`, `leftAt`; 422 if last active manager |

**Invitations** (`/api/v1/messes/:messId/invitations` — MANAGER only)
| Method | Path | Notes |
|---|---|---|
| GET | `/` | filter `status`; token never exposed |
| POST | `/` | `{email? , phone?, role?='MEMBER'}`; at least one of email/phone; returns `token` + `inviteUrl` once; 409 on duplicate PENDING for the same target, or if already an ACTIVE member; emails the link (best-effort) |
| DELETE | `/:invitationId` | only a PENDING invitation can be revoked (else 409) |

**Invitations (public token)** (`/api/v1/invitations`, auth required to preview/accept)
| Method | Path | Notes |
|---|---|---|
| GET | `/:token` | preview: mess name/area, inviter, role, `alreadyMember`, `canAccept`; 422 if revoked/used/expired |
| POST | `/:token/accept` | 403 if the invitation targets a different account; 409 if already an ACTIVE member; reactivates a previously removed/suspended membership; marks invitation `ACCEPTED` |

Invitation TTL = 7 days (`INVITATION_TTL_DAYS`). Expired PENDING invitations are transitioned to
`EXPIRED` lazily on the next preview/accept.

**Mess sub-resources** — each mounted under `/api/v1/messes/:messId/…`, all behind
`requireAuth` + `requireMessAccess` (manager-only rows are marked). Mount order in `app.ts`
matters: every `:messId` sub-resource is registered **before** the generic `messesRouter`.

**Months** (`/months`)
| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/` | member | filters `year`, `status` |
| POST | `/` | MANAGER | `{year, month, openingCashTaka?, budgetTaka?, mealRatePolicy?, mealSettings?}`; 409 if the month exists |
| GET | `/:monthId` | member | detail incl. `daysInMonth`, meal settings |
| PATCH | `/:monthId` | MANAGER | ≥1 field; rejected when the month is CLOSED |
| PATCH | `/:monthId/meal-settings/:mealType` | MANAGER | `mealType ∈ BREAKFAST\|LUNCH\|DINNER`; `{enabled?, defaultOn?, cutoff?}` ≥1 field; `cutoff` = `"HH:MM"` |
| POST | `/:monthId/close` | MANAGER | sets `CLOSED`, snapshots settings; 409 if already CLOSED |
| POST | `/:monthId/reopen` | MANAGER | sets `OPEN`; 409 if already OPEN |

**Meals** (`/meals`) and **Menus** (`/menus`)
| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/meals/status` | member | per-member meal on/off for a day, vs cut-off |
| GET | `/meals/counts` | member | counted member and guest meals per member/meal type |
| GET | `/meals/timeline` | member | monthly daily breakfast/lunch/dinner totals; members see only their own timeline |
| GET | `/meals/records` | member | list (filters: month/date/member/mealType) |
| PUT | `/meals/records` | member (self, pre-cut-off) | set one record |
| POST | `/meals/records/override` | MANAGER | override after cut-off (audited) |
| PUT | `/meals/records/bulk` | MANAGER | bulk set for a date; returns `{updated}` |
| PUT | `/meals/records/guests` | MANAGER | set or clear a guest count for a member/date/meal without changing the member's own meal record |
| POST | `/meals/records/month-override` | MANAGER | update only the submitted member/date/meal statuses for an open month; audited |
| DELETE | `/meals/records/:recordId` | MANAGER | |
| GET | `/menus` | member | list daily menus |
| PUT | `/menus` | MANAGER | upsert a menu (`date` + `mealType` unique) |
| DELETE | `/menus/:menuId` | MANAGER | |

**Grocery items** (`/grocery-items`) and **prices** (`/grocery-prices`)
| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/grocery-items` | member | catalogue list (search/category/unit) |
| GET | `/grocery-items/:itemId` | member | |
| POST | `/grocery-items` | MANAGER | create (Bangla + English names, unit, category) |
| PATCH | `/grocery-items/:itemId` | MANAGER | |
| DELETE | `/grocery-items/:itemId` | MANAGER | |
| GET | `/grocery-prices` | member | price history (filter by item/date) |
| GET | `/grocery-prices/latest` | member | latest price per item |
| POST | `/grocery-prices` | MANAGER | create (`pricePoisha`, `source`, `verification`) |
| PATCH | `/grocery-prices/:priceId` | MANAGER | |
| DELETE | `/grocery-prices/:priceId` | MANAGER | |

**Deposits** (`/deposits`)
| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/` | member | filters: member, status, month |
| POST | `/` | member | record a deposit (`PENDING`) |
| GET | `/:depositId` | member | |
| POST | `/:depositId/verify` | MANAGER | `PENDING → VERIFIED` (only verified counts as collected) |
| POST | `/:depositId/reject` | MANAGER | reason required |
| DELETE | `/:depositId` | MANAGER | |

**Expenses** (`/expenses`)
| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/` | member | filters: month, category, status |
| POST | `/` | MANAGER | create (`PENDING`); utility categories use equal allocation |
| GET | `/:expenseId` | member | incl. allocations |
| POST | `/:expenseId/approve` | MANAGER | `PENDING → APPROVED` (counts in official reports) |
| POST | `/:expenseId/reject` | MANAGER | reason required |
| POST | `/:expenseId/reverse` | MANAGER | creates a reversal expense (`reversalOfId` unique) |
| DELETE | `/:expenseId` | MANAGER | |

**Utilities** (`/utilities`)
| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/` | member | filters: `monthId`; members see only their own share, managers see all shares |
| POST | `/:expenseId/payments` | member | submit own share payment `{method: CASH\|BKASH\|NAGAD\|CARD, reference?, note?}` |
| PATCH | `/:expenseId/payment-status` | MANAGER | `{paid: boolean}` tracks manager payment to provider, separately from member payments |
| DELETE | `/:expenseId` | MANAGER | only creator; blocked if payment history, provider-paid status, or reversal exists |
| POST | `/payments/:paymentId/verify` | MANAGER | verifies member share and links it to a deposit |
| POST | `/payments/:paymentId/reject` | MANAGER | `{reason}` required |

**Bazar entries** (`/bazar-entries`)
| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/` | member | filters: month, status, duty/date |
| POST | `/` | member | create with line items (Draft) |
| GET | `/:entryId` | member | incl. snapshotted items |
| PATCH | `/:entryId` | member (Draft/Rejected) | update items/meta |
| POST | `/:entryId/submit` | member | `DRAFT → PENDING_REVIEW` |
| POST | `/:entryId/approve` | MANAGER | `PENDING_REVIEW → APPROVED` (counts toward confirmed expenses) |
| POST | `/:entryId/reject` | MANAGER | reason required |
| DELETE | `/:entryId` | member (Draft) / MANAGER | |

**Duties** (`/duties`)
| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/` | member | list by month/date/status |
| POST | `/generate` | MANAGER | deterministic generation for a month; preserves completed assignments |
| POST | `/swap` | MANAGER | swap two duties |
| PATCH | `/:dutyId` | MANAGER | manual reassign (member) |
| PATCH | `/:dutyId/status` | MANAGER/Member | e.g. `PENDING → COMPLETED` |

**Reports** (`/reports`)
| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/monthly` | member | full month report |
| GET | `/summary` | member | budget vs actual, closing cash |
| GET | `/balances` | member | per-member balances |
| GET | `/monthly.csv` | member | CSV export (attachment) |

**Media** (`/media`)
| Method | Path | Guard | Notes |
|---|---|---|---|
| POST | `/sign` | member | returns a signed upload target |
| POST | `/` | member | confirm upload (stores private `Media`) |
| GET | `/` | member | list media |
| GET | `/:mediaId/url` | member | signed, expiring URL (never public) |
| DELETE | `/:mediaId` | member/MANAGER | |

**AI** (`/ai`) — drafts only, never approves/posts
| Method | Path | Guard | Notes |
|---|---|---|---|
| POST | `/bazar-extract` | member | photo/key → structured bazar draft (Zod-validated) |
| POST | `/price-estimate` | member | estimated price + confidence (labelled as an estimate) |
| POST | `/report-summary` | MANAGER | natural-language month summary |
| GET | `/usage` | member | AI request usage (free tier 50/day) |

**Audit logs** (`/audit-logs`)
| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/` | MANAGER | filters: `entityType, entityId, actorUserId, action, from, to, page, pageSize`; returns `{items, meta}` with before/after |

Route tally: **97** authenticated feature routes under `/api/v1` (plus `/health` and the
Better-Auth `/api/auth/*` surface above).

**Verified by live smoke test on 2026-11-17** (server boots, 401/403/404 envelopes correct,
sign-up → create mess → invite → accept → promote → remove → last-manager blocks all behave as designed).

---

## 9. UI/UX decisions

**Direction:** modern SaaS dashboard; clean/calm/professional hierarchy; mobile-first; clear
financial figures and readable tables; thoughtful empty/loading/error/success states; accessible
colors + keyboard nav; consistent spacing/typography/borders/radii; correct Bangla rendering.
shadcn/ui as a foundation, customised to the product.

**Avoid:** oversized cards, heavy gradients, decorative charts, gratuitous animation, fake data
shown as real, non-functional buttons, placeholder links on finished pages.

**Implemented reusable components:** `AppShell` (sidebar/topbar + mobile nav), `MessSwitcher`,
`MonthSelector`, `UserMenu`, `AuthGuard`, `<Money>`, `<StatCard>`, `<StatusBadge>`, `<PageHeader>`,
`<ErrorState>`, `<EmptyState>`, `<Pagination>`, `<ConfirmDialog>`, `<NoMonth>`, skeleton loaders
(`TableSkeleton`/`BlockSkeleton`), and a shadcn-derived `components/ui/*` primitive set
(button, card, dialog, select, table, switch, tabs, tooltip, dropdown-menu, popover, badge, alert,
input, label, textarea, separator, checkbox, avatar, skeleton). Reports/dashboard charts use Recharts.

**Client route map (21 routes at last build):** `/` · `/sign-in` · `/sign-up` · `/dashboard` ·
`/onboarding` · `/settings` · `/invitations/[token]` · `/m/[messId]` · `/m/[messId]/dashboard` ·
`/m/[messId]/months` · `/m/[messId]/members` · `/m/[messId]/meals` · `/m/[messId]/bazar` ·
`/m/[messId]/duties` · `/m/[messId]/deposits` · `/m/[messId]/expenses` · `/m/[messId]/grocery` ·
`/m/[messId]/utilities` · `/m/[messId]/reports` · `/m/[messId]/audit`.

---

## 10. Environment configuration

> **Never write real secrets, keys, passwords, tokens, or connection strings in this file.**

Backend variables (from the user-provided `.env`, names only):
`NODE_ENV`, `PORT`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`,
`BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN`, `BETTER_AUTH_SESSION_TOKEN_UPDATE_AGE`,
`EMAIL_SENDER_SMTP_HOST`, `EMAIL_SENDER_SMTP_PORT`, `EMAIL_SENDER_SMTP_USER`, `EMAIL_SENDER_SMTP_PASS`,
`EMAIL_SENDER_SMTP_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`,
`FRONTEND_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`.

**AI variables:**
`OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `AI_EMBEDDING_MODEL`, `AI_TEXT_MODEL`,
`GROQ_API_KEY`, and `GEMINI_API_KEY`. Chat provider order is OpenRouter → Groq → Gemini; Groq and
Gemini use `llama-3.3-70b-versatile` and `gemini-3.5-flash-lite`, respectively.

**Client variables:** `API_PROXY_TARGET` (optional; defaults to `http://localhost:5000`) — the
upstream the Next.js `/api/:path*` + `/health` rewrites proxy to. No secrets live in the client env.

**AI provider verified (2026-11-17, live call to OpenRouter with the user's key):**
- Embeddings: `nvidia/nemotron-3.5-embed-1b:free` → returns **2048-dim** vectors. Works.
- Text: `baidu/ernie-5.5-flash-preview:free` → returns valid JSON. Works. It emits
  **reasoning tokens** (≈57 reasoning tokens for a 70-token reply), so budget `max_tokens` generously
  and tolerate a `reasoning` field in responses.
- Account is **free tier**: **50 free-model requests/day** (`free_model_daily_requests` limit 50).
  → The AI layer must degrade gracefully to manual entry, and heavy AI usage needs a paid key later.

**Decisions confirmed by user (2026-11-17):** use the provided Neon DB as-is · npm workspaces ·
Better-Auth · verify OpenRouter models (done, above).

**Notes / risks:**
- The provided `.env` originates from a *different* ("PH Healthcare Management System") template.
  Its `DATABASE_URL` may be a shared/foreign Neon database — see §14 (open decision). Do not
  migrate it until confirmed.
- Stripe vars are present in the template but **Stripe billing is out of scope** for the free MVP.
- `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` values in the template are weak and must be
  regenerated before any non-local use.
- `.env` must remain git-ignored and never committed.

---

## 11. Testing

**STATUS (server):** The full suite last passed 8 suites / **92 tests** — `npm test --workspace server`,
re-run **2026-11-18**. Focused utility, contact, invitation-email, and AI-provider tests passed
individually; the full suite has not been rerun since those additions.
Config: [`server/vitest.config.ts`](file:///d:/Web/Mess_Managment/server/vitest.config.ts) —
`include: ["tests/**/*.test.ts"]`, `fileParallelism: false` (shared remote Neon DB → files run
sequentially), `testTimeout: 30_000`, `hookTimeout: 60_000`, `env.NODE_ENV = "test"`.
The integration suites create and modify records; use a dedicated test database and never point
them at production or data that cannot safely be used for testing.
Helper: [`server/tests/helpers/http.ts`](file:///d:/Web/Mess_Managment/server/tests/helpers/http.ts) —
cookie-aware `TestClient` that always sends `Origin: FRONTEND_URL` (Better-Auth rejects a missing
origin) + a `signUp()` helper.

| Suite | File | Tests | Covers |
|---|---|---|---|
| Tenant isolation / security | [`tests/security/tenant-isolation.test.ts`](file:///d:/Web/Mess_Managment/server/tests/security/tenant-isolation.test.ts) | 16 | own-mess read; unauthenticated 401; cross-mess 403 (not 404); every sub-resource blocked; list non-leakage; member cannot administer; no self-escalation; last-active-manager invariant; member leave/rejoin; invitation validity |
| Platform administration | [`tests/security/platform-admin.test.ts`](file:///d:/Web/Mess_Managment/server/tests/security/platform-admin.test.ts) | 1 | platform-admin authorization, user role management, mess inspection, confirmed deletion and recreation |
| Financial engine (integration) | [`tests/financial/financial-engine.test.ts`](file:///d:/Web/Mess_Managment/server/tests/financial/financial-engine.test.ts) | 13 | meal count + rate from approved meal expenses; approved-only expenses; verified-only deposits; cash vs budget; balances and settlements; dashboard summary; CSV; reversals; member authorization; month close and meal correction |
| Utility-bill status (integration) | [`tests/financial/utility-bill-status.test.ts`](file:///d:/Web/Mess_Managment/server/tests/financial/utility-bill-status.test.ts) | 2 | creator-only safe deletion; provider paid/not-paid toggles; manager authorization; provider status remains separate from member payment status; member sees only own share |
| WhatsApp contact (integration) | [`tests/security/whatsapp-contact.test.ts`](file:///d:/Web/Mess_Managment/server/tests/security/whatsapp-contact.test.ts) | 1 | Bangladeshi local/international phone normalization; cross-role contact visibility and same-role number hiding |
| AI provider fallback (unit) | [`tests/unit/ai-providers.test.ts`](file:///d:/Web/Mess_Managment/server/tests/unit/ai-providers.test.ts) | 2 | OpenRouter → Groq → Gemini priority; fallback after invalid summary output and provider errors |
| Invitation email (unit) | [`tests/unit/invitation-email.test.ts`](file:///d:/Web/Mess_Managment/server/tests/unit/invitation-email.test.ts) | 2 | branded HTML/text render, inline logo attachment, and HTML escaping |
| Money (unit) | [`tests/unit/money.test.ts`](file:///d:/Web/Mess_Managment/server/tests/unit/money.test.ts) | 19 | taka↔poisha round-half-up, formatting, divide half-up, multiply-by-quantity, `allocateByWeights` exact-sum |
| Date/timezone (unit) | [`tests/unit/date.test.ts`](file:///d:/Web/Mess_Managment/server/tests/unit/date.test.ts) | 12 | Dhaka UTC-midnight `@db.Date` storage, +06:00 boundaries, `dhakaInstant` cut-off instants, month ranges, `daysInMonth` leap, `eachDateOfMonth`, `hhmmToMinutes`/`minutesToHhmm` |
| Duty scheduler (unit) | [`tests/unit/duty-scheduler.test.ts`](file:///d:/Web/Mess_Managment/server/tests/unit/duty-scheduler.test.ts) | 14 | floor shares (5/30), remainder rotation (5/31), extra rotates across months, no-negative index, empty member set; round-robin sequence with no adjacent repeat; every date assigned once; **deterministic output**; unavailable member excluded; all-unassigned when nobody eligible; `rotationOffsetForMonth` stable & increasing |
| Catalogue matcher (unit) | [`tests/unit/catalogue-matcher.test.ts`](file:///d:/Web/Mess_Managment/server/tests/unit/catalogue-matcher.test.ts) | 12 | `normalizeName` (punctuation/whitespace, **Bangla letters preserved**); `nameSimilarity` exact/partial/empty; `matchCatalogueItem` via English name, Bangla name, alias, descriptive substring, below-threshold null, custom threshold; `matchCatalogueItems` preserves order + nulls |
| Reports CSV (unit) | [`tests/unit/reports-csv.test.ts`](file:///d:/Web/Mess_Managment/server/tests/unit/reports-csv.test.ts) | 5 | leading UTF-8 BOM (Excel Bangla + ৳), CRLF endings, headline figures present, comma and double-quote cell escaping |

**Bug found & fixed by the suite (2026-11-17):** `multiplyPoishaByQuantity` accepted over-precise
quantities (`"1.2345"`) and silently truncated them. Regex tightened from `/^\d+(\.\d+)?$/` to
`/^\d+(\.\d{1,3})?$/` in [`server/src/app/utils/money.ts`](file:///d:/Web/Mess_Managment/server/src/app/utils/money.ts).

**STATUS (client):** no browser test runner is configured. The latest client typecheck and production
build passed on **2026-11-19**; the build emits **21** routes, including
`/m/[messId]/utilities`, `/m/[messId]/months`, and `/m/[messId]/audit`.

**Live end-to-end verification (2026-11-17, both servers running):**
- Auth: `POST /api/auth/sign-in/email` with the seeded super admin (`samiohasan6@gmail.com`) → **200**
  plus a session cookie; `npm run prisma:seed --workspace server` → exit 0.
- Cloudinary media round-trip (**no multer involved** — see §14 D20): `POST …/media/sign` → uploaded a
  real PNG to `https://api.cloudinary.com/v1_1/<cloud>/image/upload` using the signed params → **200**
  with `public_id` and `bytes=246` → `POST …/media` confirmed the row → `GET …/media/:id/url` returned
  an expiring signed URL → fetching that URL returned **200 `image/png`, 246 bytes**. Deleting the row
  also removed the remote asset.
- Same-origin proxy: `http://localhost:3000/health` returned the API's health payload.
- Routes compiled by Next.js with no errors: `/`, `/sign-in`, `/sign-up`, `/dashboard`, `/onboarding`,
  `/m/[messId]/dashboard`.

**Manual verification performed (2026-11-17)** — via `curl`/`fetch` against the running dev server
(`npm run dev --workspace server`), results recorded in §8:
`/health` 200 · unauthenticated `/api/v1/users/me` 401 · unknown route 404 · sign-up 200 ·
get-session 200 · create mess 201 · list/patch members 200 · invite 201 · duplicate invite 409 ·
preview/accept invitation 200 · re-accept 422 · wrong-account accept 403 · cross-mess access 403 ·
last-manager demote/remove 422. (`pnpm`-free; the smoke scripts lived in the OS temp dir and were
removed; the rows they created were deleted from the dev DB.)

**Still not covered by automated tests** (candidates for the next testing pass): meal cut-off
enforcement end-to-end (default OFF, explicit ON/OFF before the cut-off, rejection after it,
manager override, disabled meal, month-boundary TZ); guest-meal record create/update/clear
aggregation; the duty **service** routes (swap, mid-month removal,
completed-assignment preservation) — only the pure `duty-scheduler` is unit-tested; media
private-access (signed-URL expiry, cross-mess media); and AI adapter failure modes beyond the tested
provider fallback chain (low confidence, missing price, unsupported image, timeout and manual
fallback). Tests must be actually run before being reported as passing.

---

## 12. Current development status

**Current phase:** Phase 6 — Polish & pilot (server Phases 1–5, utility bills, profile-photo settings,
WhatsApp contacts, branded invitation email, and AI provider fallback are implemented).
**Last completed task:** Added Gemini to the ordered OpenRouter → Groq → Gemini fallback chain and
made manager-summary requests retry providers when a response fails JSON/schema validation. Focused
provider tests and server typecheck pass; the full suite has not been rerun since these additions.
**Next:** pilot hardening (see still-untested list in §11).
**Known blockers:** none blocking. Out-of-band notes: AI free tier is 50 requests/day;
`migrate dev` unusable (no shadow DB); `@hookform/resolvers@3` + zod v4 pairing is unofficial (§14 D16).

**Roadmap:**
- **Phase 0 — Discovery/docs:** DONE (repo inspected · `context.md` created · decisions recorded · roadmap).
- **Phase 1 — Foundation:** repo structure ✔ · server setup ✔ · DB connection ✔ · Prisma 7 config ✔ ·
  auth ✔ · profiles/photos ✔ · mess creation ✔ · memberships/WhatsApp contacts ✔ · invitations ✔ · tenant isolation ✔ ·
  seed ✔ · automated tests ✔ (92/92) · landing page ✔ (`client/`).
- **Phase 2 — Mess operations:** DONE (months ✔ · grocery catalogue ✔ · price history ✔ · deposits ✔ ·
  expenses ✔ · utility bills/member payment verification/provider status ✔ · bazar entries ✔ ·
  manager verification/approval ✔ · audit logs ✔ — server + client).
- **Phase 3 — Meals & duties:** DONE (monthly meal settings ✔ · menus ✔ · member ON/OFF + cut-off
  enforcement ✔ · separate guest meal records ✔ · monthly member timelines/month editor ✔ · duty
  generation/swaps/overrides ✔ — server + client).
- **Phase 4 — Financial engine & reports:** DONE (meal rate ✔ · expense allocation ✔ · member
  balances ✔ · budget vs actual ✔ · closing cash ✔ · monthly report ✔ · CSV export ✔ — server + client).
- **Phase 5 — AI & media:** DONE (private upload ✔ · AI extraction ✔ · product matching ✔ · price
  assistant ✔ · AI report summary ✔ · usage monitoring ✔ — server; client surfaces contracts only).
- **Phase 6 — Polish & pilot:** IN PROGRESS — responsive refinement · Bangla rendering · performance ·
  security review · remaining integration tests (§11) · backup/restore · pilot with a real mess.

---

## 13. Change log

| Date | Files / modules | Change | Why | Tests | Migration |
|---|---|---|---|---|---|
| 2026-11-17 | `context.md` | Created project memory; recorded greenfield discovery, planned stack, planned schema, business rules, roadmap, open decisions. | Phase 0 of master prompt (mandatory) | none | none |
| 2026-11-17 | `context.md` | Recorded OpenRouter verification (embedding 2048-dim OK, text model OK, free tier 50 req/day) and the user's confirmed decisions (DB as-is, npm workspaces, Better-Auth). | Close §14 open decisions | live API smoke test | none |
| 2026-11-17 | `server/prisma/schema.prisma`, `server/prisma/migrations/20261117141313_init/` | Full Prisma 7 schema (24 models, all money `BigInt` poisha, tenant FKs, Restrict-on-financial-history) generated via `migrate diff --from-empty` and applied with `migrate deploy`. | Phase 1 data foundation | `migrate deploy` OK (24 tables) | **yes — init** |
| 2026-11-17 | `server/src/app/{config,db,middlewares,utils}/*` | env validation, constants, Prisma client w/ pg adapter, money/date/json/logger/error/response/zod-helpers/pagination/audit/mailer utils, auth+tenant+validate+error+not-found middlewares, Express `Request` augmentation. | Phase 1 foundation | `tsc --noEmit` clean | none |
| 2026-11-17 | `server/src/modules/auth/auth.ts` | Better-Auth instance (prismaAdapter, email/password, conditional Google, emailOTP plugin, additionalFields phone/locale). | Phase 1 auth | live sign-up + get-session OK | none |
| 2026-11-17 | `server/src/modules/users/*` | Profile read/update (BD phone normalisation + uniqueness), list-my-messes. | Phase 1 profiles | live OK | none |
| 2026-11-17 | `server/src/modules/messes/*` | Mess create (transaction: mess + creator MANAGER membership + audit), read, update/archive. | Phase 1 mess creation | live 201/200 OK | none |
| 2026-11-17 | `server/src/app/app.ts`, `server/src/server.ts` | Express wiring (order-sensitive), Better-Auth mounted before body parser on `/api/auth/*splat`, rate limit, `/health`; entry with BigInt serializer + graceful shutdown. | Phase 1 bootstrap | server boots; 401/404 envelopes verified | none |
| 2026-11-17 | `server/src/modules/memberships/*` | List/read/update/remove memberships; MANAGER-only role/status; self-service profile fields; **last-active-manager invariant**; soft removal. | Phase 1 memberships | live OK incl. 422 invariant | none |
| 2026-11-17 | `server/src/modules/invitations/*` | Invite by email/phone, list, revoke, token preview + accept, 7-day TTL, lazy EXPIRED transition, identity match, best-effort email. | Phase 1 invitations | live OK incl. 403/409/422 paths | none |
| 2026-11-17 | `server/src/app/config/env.ts` | Added missing `GOOGLE_CALLBACK_URL` to the env schema (auth.ts referenced it → TS2339). | Fix typecheck failure | `tsc --noEmit` clean | none |
| 2026-11-17 | `server/prisma/seed.ts` | Idempotent super-admin seed (skips/promotes/signs-up per env `SUPER_ADMIN_EMAIL`/`PASSWORD`; sets `platformRole: ADMIN`, `emailVerified: true`). | Phase 1 seed (master prompt) | ran twice; 2nd run = "already present" | none |
| 2026-11-17 | `server/vitest.config.ts`, `server/tests/helpers/http.ts` | Vitest config (sequential files, test/hook timeouts, `NODE_ENV=test`) + cookie-aware `TestClient` (always sends trusted `Origin`). | Phase 1 automated testing | infra used by all suites | none |
| 2026-11-17 | `server/tests/unit/{money,date}.test.ts`, `server/tests/security/tenant-isolation.test.ts` | 43 automated tests: money (19), date/TZ (11), tenant isolation + roles + invitation validity (13). | §12 testing requirement (master prompt) | **43/43 pass** | none |
| 2026-11-17 | `server/src/app/utils/money.ts` | **Bug fix:** `multiplyPoishaByQuantity` now rejects quantities with >3 decimals instead of silently truncating (`/^\d+(\.\d{1,3})?$/`). | Suite exposed silent truncation | covered by money.test.ts | none |
| 2026-11-17 | `server/src/modules/{months,meals(+menus),grocery-catalogue,grocery-prices,deposits,expenses,bazar,bazar-duty(+duty-scheduler),reports,media,ai,audit-logs}/` | Phase 2–5 modules implemented (schemas + services + routes) and mounted in `app.ts` under `/api/v1/messes/:messId/…` before the generic mess router. | Master prompt Phases 2–5 | see suite table in §11 | none |
| 2026-11-17 | `server/tests/{financial/financial-engine,unit/{duty-scheduler,catalogue-matcher,reports-csv}}` | Extended the suite from 43 → **86 tests** (7 suites): financial engine (12), duty scheduler (14), catalogue matcher (12), reports CSV (5). | Cover the new modules | `npm test --workspace server` → **86/86 pass**, exit 0 | none |
| 2026-11-17 | `client/**` (whole app) | Next.js 15 App Router frontend: landing, auth, onboarding/settings, mess picker, invitation accept, and all 12 mess pages (dashboard, months, members, meals, bazar, duties, deposits, expenses, grocery, reports, audit, overview) + shell (mess switcher, month selector, user menu) + shared/UI component library. | Master prompt §10 frontend | `typecheck` exit 0 · `build` exit 0 (20 routes) | none |
| 2026-11-17 | `client/lib/api/endpoints.ts` | Added an index signature to `ReportQuery` so it can be passed to `buildQuery`; fixed `mealsApi.bulk` return type to `{updated:number}`. | TS2322 on report queries | `tsc --noEmit` clean | none |
| 2026-11-17 | `client/package.json` | Bumped `zod` `^3.24.1` → `^4.6.7` to match the hoisted zod 4 and satisfy `@hookform/resolvers@3.10.0`'s generic constraint. | 4 × TS2345 on `zodResolver(schema)` across auth/settings/onboarding forms | `tsc --noEmit` clean; build clean | none |
| 2026-11-17 | `client/components/auth/google-button.tsx` (new) + auth pages | Added Google OAuth entry points; the current UI keeps Google sign-in on `/sign-in` only. Registration uses email/password and optional profile photo. | Complete auth UX; later adjusted to the requested registration flow | typecheck exit 0 | none |
| 2026-11-17 | `client/components/shared/image-upload.tsx` (new), `client/lib/hooks/queries.ts` (`qk.media`, `qk.mediaUrl`), `client/lib/api/endpoints.ts` (`UploadSignature` gained `provider/type/allowedFormats`), `client/app/(app)/m/[messId]/bazar/page.tsx` | **Image upload wired end-to-end.** Reusable `ImageUpload` signs with the API, `XMLHttpRequest`-uploads the bytes **directly to Cloudinary** (progress reported), then confirms the asset with the API. Bazar rows gained a **Photos** dialog: upload, signed-URL thumbnails, delete. | `mediaApi` existed but nothing used it — the feature was unreachable from the UI | `npm run typecheck --workspace client` exit 0; live round-trip verified (see §11) | none |
| 2026-11-17 | Server seed configuration | Confirmed idempotent platform administrator seeding and email/password sign-in. Credentials are intentionally not recorded in project documentation. | Validate the seed workflow | Seed command and sign-in smoke test passed | none |
| 2026-11-17 | `server/src/modules/users/users.service.ts` (`listMyMesses`), `client/components/app-shell/mess-switcher.tsx` | **Bug fix — “Something went wrong” after creating a mess.** The `GET /api/v1/users/me/messes` endpoint returned `messName` but every client consumer (`MessSummary` type, onboarding list, mess switcher) expected `name`. The undefined `name` then crashed `MessSwitcher` at `messName.slice(0, 2)`. Aligned the server DTO to emit `name` (matching the client contract) and made both `.slice(0, 2)` calls in the switcher defensive with `(x ?? "?").slice(0, 2)` so a missing name never throws the error boundary. | Server→client field-name mismatch | client `typecheck` exit 0; server `typecheck` exit 0; `npm test` → 86/86 pass; dashboard renders after mess creation | none |
| 2026-11-17 | `client/lib/api/types.ts` (`MessSummary`) | Tightened `MessSummary` to include `archived: boolean` and `membershipId: string`, matching the server `listMyMesses` DTO. Both fields were already returned by the API but untyped on the client. | Keep client types in sync with the server DTO | client `typecheck` exit 0 | none |
| 2026-11-17 | `server/src/modules/auth/auth.ts` (`socialProviders.google`) | **Bug fix — Google account chooser not shown after logout.** Added `prompt: "select_account"` to the Google OAuth provider config. Without it, Google silently reused the browser's active Google session after the user logged out of the app, so clicking “Continue with Google” again auto-signed in with the same email and the user could not pick a different account. `select_account` forces Google to show the account picker every time. App-level `signOut()` already clears the Better-Auth session cookie correctly; the issue was purely the Google-side session reuse. | OAuth auto-login after app logout | server `typecheck` exit 0 | none |
| 2026-11-17 | `server/src/modules/meals/meals.routes.ts` (`dayStatusQuerySchema`, `countsQuerySchema`) | **Bug fix — Meals & menu page showed “Invalid query parameters”.** Both `dayStatusQuerySchema` and `countsQuerySchema` required `messId: zUuid` in the **query** string, but `messId` is in the URL path (already validated by `messIdParamOnlySchema` params). The client sends only `date` (status) and `monthId` (counts) in the query, so validation always failed. Removed `messId` from both query schemas. Scanned all other modules: `grocery-prices.latestQuerySchema` uses `messId` as a **params** schema (correct), and all other query schemas correctly omit `messId`. | Query schema required a path param | server `typecheck` exit 0; `npm test` → 86/86 pass; live `GET /meals/status?date=2026-11-17` → 200; `GET /meals/counts?monthId=…` → 404 Month not found (validation now passes) | none |
| 2026-11-18 | `client/app/(app)/m/[messId]/meals/page.tsx`, `client/lib/api/{types,endpoints}.ts`, `server/src/modules/meals/meals.service.ts`, `server/prisma/{schema.prisma,migrations/*}`, root `README.md` | Added independent guest-meal records, guest-inclusive counts/timelines, and non-destructive manager month editing; documented the project, setup, environment, commands, and safety notes. Updated project memory to match implementation. | Complete meal-management behavior and provide project onboarding documentation | Client/server typechecks pass; server tests **92/92 pass**; migration status up to date | **yes** — default meals off + guest-meal table; applied after user approval |
| 2026-11-19 | `server/src/modules/utilities/*`, `server/prisma/{schema.prisma,migrations/*}`, `client/app/(app)/m/[messId]/utilities/page.tsx` | Added equal-split utility bills, per-member cash/bKash/Nagad/card payment requests, manager verification/rejection, separate provider paid/not-paid status, and safe creator-only bill deletion. | Track shared utilities and member payment status without conflating them with provider payment | Utility integration tests **2/2 pass**; full server suite not rerun after addition | **yes** — utility-payment records and provider payment status; applied |
| 2026-11-19 | `client/app/(app)/settings/page.tsx`, `client/app/(app)/m/[messId]/members/page.tsx`, `client/lib/{profile-photo,bangladesh-phone}.ts`, `server/src/modules/memberships/*`, `server/src/app/utils/zod-helpers.ts` | Added settings back link and profile-photo preview/upload; normalized Bangladeshi mobile formats; exposed WhatsApp contact links only between active opposite-role users in the same mess. | Complete account settings and enable privacy-filtered manager/member contact | WhatsApp contact integration test **1/1 pass**; client build and typechecks pass | none |
| 2026-11-19 | `server/src/modules/invitations/{invitation-email.ts,mealio-logo.ts,invitations.service.ts}`, `server/src/app/utils/mailer.ts`, `server/tests/unit/invitation-email.test.ts` | Replaced external logo loading with an inline PNG CID attachment derived from the website mark; aligned email colors with the site's green theme and kept inviter/mess/role details, CTA, expiry, fallback link/code, and text alternative. Escapes user-controlled HTML content. | Ensure the logo displays in Gmail and email colors match the website | Server typecheck passed; invitation email tests **2/2 pass** | none |
| 2026-11-19 | `README.md`, `context.md` | Updated product overview, features, business rules, API routes, UI route map, schema/migrations, test status, and development status for utility bills, profile photos, and WhatsApp contacts. | Keep onboarding and project memory aligned with implemented behavior | `git diff --check` | none |

---

## 14. Important decisions & assumptions

| # | Decision | Status | Reason | Impact |
|---|---|---|---|---|
| D1 | `client/` = Next.js App Router; `server/` = Express + Prisma 7 API on port 5000; client on 3000. | Assumed | Matches master prompt + `.env` ports | Sets repo layout |
| D2 | Money stored as integer poisha (BIGINT); central conversion/rounding util. | Confirmed (prompt) | Avoid float errors | Affects all financial code |
| D3 | Multi-tenant isolation enforced server-side via membership middleware; `messId` never trusted from client. | Confirmed (prompt) | Security | Core of every query |
| D4 | AI is provider-independent; chat fallback order is OpenRouter (`AI_TEXT_MODEL`, free default `baidu/ernie-5.5-flash-preview:free`) → Groq (`llama-3.3-70b-versatile`) → Gemini (`gemini-3.5-flash-lite`). Embedding `nvidia/nemotron-3.5-embed-1b:free` (2048-dim). | **OpenRouter verified 2026-11-17; fallback chain implemented 2026-11-20** | Provider outage, rate limit, and invalid summary output should not block report summaries when a later key is configured | Keep the manual workflow when every configured provider fails |
| D5 | Use the user-provided Neon `DATABASE_URL` as-is. | **Confirmed by user** | User chose "use as-is" | ⚠️ DB inspected 2026-11-17: `public` schema is **empty**; only `neon_auth.*` tables exist (Neon-managed auth: account, invitation, jwks, member, organization, project_config, session, user, verification). Prisma targets `public`, so migrations are safe and do not touch `neon_auth`. No healthcare data found. |
| D6 | Package manager: npm workspaces at repo root. | **Confirmed by user** | npm 11 installed; pnpm absent | Root `package.json` with workspaces `client`, `server` |
| D7 | Auth via Better-Auth (email/password + Google OAuth + email OTP, cookie sessions). | **Confirmed by user** | `.env` implies Better-Auth | Phase 1 auth module |
| D8 | No Stripe/billing in MVP. | Confirmed (prompt) | Launch is free | Ignore Stripe vars |
| D9 | Redis + BullMQ only if a real background-job need appears (e.g. AI extraction queue). | Proposed | Avoid unnecessary infra | Phase 5 |
| D10 | Meal-rate rounding: poisha integers; round half-up at the final member-cost step. | Assumed | Keeps member sum ≈ total ± residual | Needs confirmation (§6) |
| D11 | Better-Auth mounts at `/api/auth/*splat` **before** the JSON body parser; Express 5 requires the named wildcard. | Confirmed (implemented) | Session handler needs the raw stream | Reordering `app.ts` breaks all auth |
| D12 | A mess must always keep ≥ 1 ACTIVE MANAGER; membership removal is a soft delete (`REMOVED` + `leftAt`). | Confirmed (implemented) | Otherwise a mess becomes unmanageable / history breaks | Enforced in `memberships.service.ts` + tests |
| D13 | Membership/invitation list responses never expose the invitation `token` except in the create response. | Confirmed (implemented) | Token is a bearer credential | Leak prevention |
| D14 | Invitations target email and/or phone; acceptance requires the signed-in account to match one of them. | Assumed (implemented) | Prevents link-forwarding to a third party | Reversible if product wants open links |
| D15 | The client proxies the API **same-origin**: `next.config.ts` rewrites `/api/:path*` and `/health` to `${API_PROXY_TARGET ?? "http://localhost:5000"}`. | Confirmed (implemented) | Makes the Better-Auth session cookie first-party → `credentials:"include"` works with no CORS headaches | All client API calls use relative `/api/...` URLs; `API_PROXY_TARGET` is the only env knob |
| D16 | Client uses `zod@^4.6.7` with `@hookform/resolvers@^3.10.0` (an **unofficial** pairing). | Confirmed (implemented, exit 0 typecheck+build) | npm hoists zod 4 (via `better-auth`), so a v3 zod on the client gets deduped away and breaks the resolver's v3 generic constraint | ⚠️ Risk: bumping the resolver or zod again may reintroduce the type error. Follow-up candidate: migrate to `@hookform/resolvers` v5 (standard-schema) and replace deprecated zod-v4 APIs (`.email()`, `{message:}` → `error:`) |
| D17 | Server serialises all BigInt poisha as **strings**; the client formats/parses with `BigInt` only (never float math). | Confirmed (implemented) | JSON has no BigInt; float math would corrupt money | `formatPoisha`/`<Money>`/`poishaToTaka`; inputs send taka strings that the server's `zTaka` converts back to poisha |
| D18 | The **active month** is app-wide client state (`MonthProvider` + `localStorage` `mm:activeMonth:<messId>`), not per-page. | Confirmed (implemented) | Users expect switching the month on one page to switch every page | Month selector and `months/page.tsx` both write it; pages read `useActiveMonth` |
| D19 | Client money/date rendering is centralised (`lib/format.ts`) with `Asia/Dhaka` for timestamps and `UTC` for `@db.Date` values. | Confirmed (implemented) | Avoid off-by-one-day and TZ drift in a BD-only product | All dates/money go through the shared formatters |
| D20 | **No multer / no multipart upload endpoint.** Uploads are signed by the API and the browser sends the bytes **directly to Cloudinary**; the API only records the resulting `publicId` and hands back short-lived signed URLs (15 min, private assets). | Confirmed (implemented + verified live) | Files never transit the API → no request-size limits, no disk/buffer pressure, no streaming bugs; the API is stateless about media bytes | `ImageUpload` in the client; `media.service.ts` on the server. Adding a multer route would duplicate storage logic, so avoid it. |
| D21 | Google OAuth is **server-side only** (Better-Auth `socialProviders.google`); the client just calls `signIn.social`. The OAuth `redirect_uri` points at the API (`/api/auth/callback/google`). | Confirmed (implemented + verified sign-in) | Works without exposing a client secret; cookies are host-scoped (`localhost`, port-agnostic) so the session set during the callback at `:5000` is also sent to `:3000` in local dev | `GoogleButton`; add the API callback URL to the Google Cloud console's authorised redirect URIs for any non-localhost deployment |
