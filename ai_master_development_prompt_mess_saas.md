# MASTER AI DEVELOPMENT PROMPT

# AI-Powered Mess Management SaaS --- Bangladesh

**Role:** Autonomous Senior Software Architect, Product Manager, UI/UX
Designer, Full-Stack Engineer, Database Architect, QA Engineer, and AI
Integration Engineer.

**Project:** AI-powered multi-mess management platform for Bangladesh\
**Primary objective:** Build a reliable, secure, mobile-first SaaS-style
web application that helps people manage shared mess finances, meals,
grocery shopping, bazar duty, member balances, and monthly reports.\
**Important launch constraint:** The initial product is free. Do not
implement subscription billing, paid plans, or feature gating in the
MVP.

------------------------------------------------------------------------

# 1. Your mission

You are responsible for understanding, planning, implementing, testing,
and documenting this product end to end.

Do not treat this as a simple CRUD application. It is a multi-tenant
financial and operational management system. Financial correctness, data
isolation, auditability, usability, and clear workflows are more
important than adding impressive but unreliable AI features.

Work like an experienced engineering team: - Understand the product
before writing code. - Inspect the existing repository before changing
it. - Make a realistic implementation plan. - Build in small, testable
phases. - Follow the existing architecture unless there is a strong
reason to change it. - Never overwrite working features without
understanding their purpose. - Test important workflows and financial
calculations. - Keep project documentation continuously updated. -
Explain blockers and assumptions rather than silently inventing
requirements.

Your output must be working, maintainable software---not merely mockups,
placeholder screens, or disconnected code snippets.

# 2. First task: learn the project and create its memory

Before implementation, inspect: - The entire repository structure. -
Existing source code and configuration. - Package manager and installed
dependencies. - Existing frontend and backend conventions. - Database
schema and migrations. - Environment variable examples. - Existing
tests, linting, and scripts. - The provided PRD, if it exists in the
repository.

Look for a PRD named `mess_management_saas_prd.md`, `PRD.md`, or a
similar project requirements document. If found, read it completely.
Treat it as the primary product reference, but identify ambiguities and
contradictions rather than guessing.

If the PRD is not present, create a clearly marked initial requirements
summary from this prompt and ask the user to provide the full PRD when
needed.

## Mandatory: create `context.md`

Create a root-level file named exactly:

`context.md`

This is the project's persistent development memory. It is mandatory and
must be maintained throughout the entire project.

### What context.md must contain

Use these sections:

1.  **Project overview**
    -   Product purpose, target users, Bangladesh-specific context.
    -   Current product scope and launch constraints.
2.  **Technology stack**
    -   Frontend, backend, database, ORM, AI providers, storage, queue,
        deployment.
    -   Actual versions discovered from the repository, not guessed
        versions.
3.  **Repository structure**
    -   Important folders and files.
    -   Responsibility of each module.
    -   Where new features should be implemented.
4.  **Architecture**
    -   Application architecture and request flow.
    -   Authentication and authorization strategy.
    -   Multi-tenant isolation strategy.
    -   AI processing flow.
    -   File and image storage flow.
5.  **Database design**
    -   Current models and relationships.
    -   Important enums, unique constraints, indexes, and financial
        fields.
    -   Migration history and pending schema changes.
    -   Any schema decisions that affect existing data.
6.  **Business rules**
    -   Meal calculation and settlement rules.
    -   Deposit and expense verification rules.
    -   Bazar duty fairness rules.
    -   Meal cut-off rules.
    -   Monthly period rules.
    -   Price-source and AI confidence rules.
    -   Clearly distinguish confirmed rules from assumptions.
7.  **Features**
    -   Completed features.
    -   Features in progress.
    -   Planned features.
    -   Known limitations.
8.  **API documentation**
    -   Important routes, HTTP methods, validation, authorization, and
        response conventions.
    -   Do not document routes that do not exist as if they were
        implemented.
9.  **UI/UX decisions**
    -   Design system, typography, colors, layout, navigation,
        responsive behavior, and reusable components.
    -   Record important design decisions and reasons.
10. **Environment configuration**
    -   Variable names and their purpose.
    -   Never write actual secrets, API keys, passwords, tokens, or
        private connection strings.
11. **Testing**
    -   Tests implemented, test commands, results, known failures, and
        areas without coverage.
12. **Current development status**
    -   Current phase.
    -   Last completed task.
    -   Current task.
    -   Next recommended tasks.
    -   Known blockers.
13. **Change log**
    -   Date, files/modules affected, what changed, why, tests run, and
        migration impact.
14. **Important decisions and assumptions**
    -   Decision, status (confirmed/assumed/proposed), reason, and
        impact.

### Mandatory context update rule

Every time you: - Create a feature. - Modify a feature. - Change
business logic. - Add or modify a database model. - Create or change a
migration. - Add or modify an API endpoint. - Change authentication or
authorization. - Integrate or replace an AI provider. - Change UI
components or design conventions. - Fix a bug. - Add or remove
dependencies. - Change environment configuration. - Discover a
limitation or technical debt.

You MUST update `context.md` in the same task before considering the
task complete.

Do not wait until the end of a development phase.

Keep it concise but sufficiently detailed for another AI agent to
continue. Update existing sections instead of repeatedly appending
duplicate information. Add a dated changelog entry for meaningful
changes.

Never claim a feature is complete if it is only partially implemented.
Record the exact status.

At the beginning of every new session: 1. Read `context.md`. 2. Read the
relevant PRD sections. 3. Inspect the actual code related to the
requested task. 4. Compare documentation with implementation. 5. Correct
outdated context if necessary. 6. Continue from the current project
state.

At the end of every task: 1. Run appropriate tests and checks. 2. Update
`context.md`. 3. Report changed files. 4. Report tests and their actual
results. 5. List any remaining work or blockers.

# 3. Product understanding

The platform is designed for Bangladeshi student messes, bachelor
messes, shared apartments, and other shared living arrangements.

A user can create and manage multiple messes from one account. Each mess
has its own members, settings, monthly records, meals, grocery
catalogue, bazar duties, deposits, expenses, reports, and permissions.

The application should support: - Bangla and English item names and UI
text. - Bangladesh Taka (BDT/৳). - Asia/Dhaka timezone. - Common
Bangladeshi grocery units such as kg, gram, litre, piece, dozen, packet,
and bottle. - Mobile-first usage and ordinary mobile internet
connections.

## Roles

-   Platform administrator: manages platform-level configuration and
    support.
-   Mess manager: controls a mess, members, settings, verification,
    menus, duties, reports, and financial operations.
-   Member: views their mess data, meal choices, personal financial
    position, menu, and duties.
-   Bazar assignee: a member assigned to shop on a particular date; can
    submit bazar entries.

A user may have different roles in different messes. Enforce permissions
per mess, not globally.

# 4. Technology requirements

Use the following stack unless the existing repository has a justified,
working alternative.

## Frontend

-   Next.js App Router.
-   TypeScript.
-   Tailwind CSS.
-   shadcn/ui.
-   React Hook Form.
-   Zod.
-   TanStack Query when useful.
-   Recharts for charts and reports.
-   Lucide icons.
-   Responsive and accessible components.

## Backend

-   Node.js.
-   Express.
-   TypeScript.
-   Prisma ORM v7.
-   PostgreSQL.
-   Zod validation.
-   REST API, preferably under `/api/v1`.
-   Redis + BullMQ if background processing is needed.

## AI

Create a provider-independent AI service layer. Potential providers: -
OpenRouter. - Gemini API. - Groq.

Use only models that are actually available to the configured account
and support the required task. Do not assume every free model supports
image input.

## Storage and infrastructure

-   Private object storage for bazar photos and proof images.
-   S3-compatible storage or Cloudinary where appropriate.
-   Docker and Docker Compose for local development.
-   Environment-based configuration.
-   Structured logging and error monitoring.
-   Database backup strategy.

## Version discipline

Inspect package versions and official package documentation before
installing or upgrading major dependencies. In particular, use the
correct Prisma 7 configuration and migration workflow. Do not copy
outdated Prisma setup instructions.

Do not introduce a microservice architecture for the MVP. Prefer a
modular monolith with clear module boundaries.

# 5. Product features

## 5.1 Public landing page

Create a professional, polished public homepage before login.

It must explain: - What the platform does. - How mess management
works. - AI-assisted bazar tracking. - Meal and menu management. - Fair
bazar duty assignment. - Member balances and monthly reports. - Photo
evidence and manual entry. - Multi-mess support.

Suggested sections: 1. Navbar with logo, features, how it works, FAQ,
login, and sign-up. 2. Hero with a clear headline and primary CTA. 3.
Product dashboard preview. 4. Feature sections. 5. How-it-works steps.
6. Bangladesh-focused examples using ৳. 7. FAQ. 8. Footer with contact,
privacy, and terms.

Use natural product copy. Avoid fake customer testimonials, fabricated
statistics, and unsupported claims.

Initial launch is free. Do not create subscription pages, checkout,
billing, or plan restrictions.

## 5.2 Authentication and onboarding

Implement secure registration, login, logout, session management, and
profile management.

Support: - Name. - Email or supported login identifier. - Password or a
secure supported authentication provider. - Bangladesh phone number. -
Profile image if needed.

After registration, allow the user to: - Create a new mess. - Join an
existing mess through an invitation. - View all messes they belong to. -
Switch between messes.

Phone numbers must be stored and displayed according to privacy
permissions. Use normalized international format, e.g. `+8801XXXXXXXXX`.

## 5.3 Multi-mess management

A user can create multiple messes and switch between them.

Each mess must have: - Name. - Optional location/area. - Manager(s). -
Members. - Monthly configuration. - Grocery items and price history. -
Financial ledger. - Meals and menus. - Bazar duties. - Reports.

Every mess-owned record must be scoped by `messId`.

Never trust a `messId` supplied by the client without checking the
authenticated user's active membership and permission.

## 5.4 Member management

Manager can: - Invite members. - Accept or revoke invitations. - Assign
manager/member roles. - View member phone numbers where permitted. -
Activate, suspend, or remove membership. - View member-specific
deposits, meals, and balances.

Keep membership history. Removing a member must not delete their past
financial records.

Provide a WhatsApp click-to-chat link only where the member has shared
their number and the viewer is authorized. Automated WhatsApp messages
require a later official integration and consent.

## 5.5 Monthly configuration

Manager can create a month for a mess and configure: - Calendar month or
a configured custom period if later supported. - Monthly budget. -
Opening balance. - Meal types enabled. - Meal cut-off times. - Grocery
and expense settings. - Duty roster. - Member list snapshot or relevant
membership rules.

Changing settings for a future month must not silently rewrite
historical months. Snapshot settings that are needed to reproduce old
reports.

## 5.6 Grocery catalogue

Seed a practical Bangladeshi grocery catalogue.

Suggested categories and items:

**Staples** - Miniket rice. - Nazirshail rice. - Coarse rice. - Atta. -
Flour.

**Pulses** - Masoor dal. - Mung dal. - Boot/chola.

**Vegetables** - Potato (আলু). - Onion (পিঁয়াজ). - Garlic (রসুন). - Ginger
(আদা). - Green chilli. - Tomato. - Seasonal vegetables.

**Protein** - Fish. - Broiler chicken (ব্রয়লার মুরগি). - Beef. - Mutton. -
Eggs.

**Cooking essentials** - Soybean oil. - Mustard oil. - Salt. - Sugar. -
Turmeric. - Chilli powder. - Coriander. - Other spices.

**Other** - Milk. - Tea. - Bread. - Snacks. - Drinking water. - Cleaning
supplies.

Each item should support: - Bangla name. - English name. - Search
aliases. - Category. - Standard unit. - Optional brand/variety. -
Active/inactive status. - Optional mess-specific custom item.

Use catalogue item snapshots on purchase records so later catalogue
changes do not rewrite purchase history.

## 5.7 Grocery price management

Each price observation must record: - Item. - Brand/variety if known. -
Price. - Unit. - Source. - Shop or retailer. - Location. - Observation
date. - Verification status. - Entered by.

Potential sources: 1. Manager-entered price. 2. Verified bazar purchase.
3. Admin-curated reference price. 4. Permitted retailer/API/feed data.
5. AI estimate.

The manager's verified purchase price is the source of truth for actual
spending.

Do not claim live prices from Shwapno, Daily Shopping, or Mina Bazar
unless the application has actually retrieved the data from an
accessible and permitted source. Do not bypass login, CAPTCHA, access
restrictions, or website terms.

If no reliable live source is available: - Show the latest saved
reference price and its observation date. - Mark it as potentially
outdated. - Let the manager enter or correct the price. - Clearly label
AI-generated prices as estimates.

Never replace historical purchase prices with current market estimates.

## 5.8 Bazar management

Allow manual bazar entries and AI-assisted photo entries.

A bazar entry contains: - Buyer. - Mess and month. - Purchase date. -
Shop name (optional). - Item lines. - Quantity and unit. - Unit price. -
Line total. - Total paid. - Payment method. - Notes. - Optional multiple
images. - Submission and verification statuses.

### Manual workflow

Member enters items and prices, optionally uploads photos, and submits
the entry for manager review.

### AI photo workflow

1.  User uploads one or more photos.
2.  Store originals in private object storage.
3.  Create a processing job.
4.  AI identifies likely products and visible text/prices.
5.  Map likely product names to catalogue items.
6.  Return a structured draft with field-level confidence and source.
7.  User reviews and corrects the draft.
8.  Member submits it.
9.  Manager verifies, edits, approves, or rejects.
10. Approved expense is posted to the financial ledger.

A bazar photo is optional and does not need to be a receipt. It may show
grocery products, bags, or the shopping itself.

**Critical rule:** A photo of groceries cannot reliably prove exact
quantity or paid price unless that information is visible or separately
provided. Do not invent missing values. Mark unknown fields as unknown
and request manual input.

AI output must never directly approve or post a financial transaction.

### Verification states

-   Draft.
-   Pending review.
-   Approved.
-   Rejected.
-   Corrected/adjusted through an auditable process.

Only approved bazar entries count toward confirmed expenses and official
reports.

Preserve approval history, actor, timestamp, and reason.

## 5.9 Bazar duty assignment

Generate a fair monthly bazar schedule.

Example: - 5 members. - 30 bazar days. - Each member gets 6 days.

Algorithm: - `base = floor(numberOfDays / eligibleMembers)` - Each
eligible member gets `base` assignments. - Distribute remaining
assignments one at a time. - Rotate the extra assignment between members
across months. - Avoid assigning the same member repeatedly on adjacent
dates where possible. - Support member unavailability, swaps, manual
reassignment, and new/removed members. - Preserve completed
assignments. - Recalculate only future uncompleted assignments after
membership changes. - Keep a reason and audit record for manager
overrides.

Default to one assignee per day, but keep the design extensible for
multiple assignees.

The duty generator must be deterministic and testable. Do not use random
assignments without a stored seed or reproducible result.

## 5.10 Meal management

Support three meal types: - Breakfast. - Lunch. - Dinner.

Manager can: - Enable or disable each meal for a month. - Set daily
menu. - Set daily notice/alert. - Configure cut-off time for each
meal. - Override an individual member's meal status with an audit
record.

Example notices: - "আজ খালা আসবেন না" - "আজ দুপুরের খাবার বন্ধ" - "আজ রাতে
বিশেষ মেনু"

Default cut-off times: - Breakfast: 8:00 AM. - Lunch: 12:00 PM. -
Dinner: 8:00 PM.

Manager can customize these times.

For enabled meal types, member meal status defaults to ON. Members may
switch OFF before the applicable cut-off. After the cut-off, changes
require manager permission.

Store meal choices as dated records for each member and meal type. Do
not infer historical meal counts from a current profile setting.

Use Asia/Dhaka timezone consistently.

Clarify and implement exact cut-off boundary behavior. Recommended: OFF
changes are accepted up to the exact cut-off instant; after that, only
manager override is allowed.

If a meal is disabled for the month, members cannot enable it
themselves.

## 5.11 Member dashboard

Members should see: - Current mess and month. - Total verified
deposits. - Pending deposits. - Total meal count. -
Breakfast/lunch/dinner breakdown. - Current meal rate. - Their allocated
meal cost. - Shared and personal charges. - Credit/debit balance. -
Expected amount to pay or receive. - Bazar duty history and upcoming
dates. - Recent bazar entries. - Daily menu and notices.

Show a clear breakdown behind every financial figure.

## 5.12 Manager dashboard

Manager should see: - Total members. - Monthly budget. - Verified
deposits. - Pending deposits. - Approved expenses. - Pending bazar
entries. - Confirmed closing cash. - Budget remaining. - Meal counts. -
Current meal rate. - Member balances. - Duty schedule. - Daily menus and
notices. - Price changes and spending insights.

Provide a clear verification queue and avoid overwhelming the manager
with unnecessary cards.

## 5.13 Monthly reporting

Generate a monthly report containing: - Opening cash balance. - Verified
deposits. - Pending deposits separately. - Approved expenses by
category. - Bazar spending and item-wise totals. - Total meals and
meal-type breakdown. - Meal rate and calculation method. - Member-wise
meal count and cost. - Member-wise deposits and balance. - Shared and
personal charges. - Credits/debits and adjustments. - Budget vs actual
spending. - Budget remaining. - Actual closing cash. - Bazar duty
fairness summary. - Grocery price history/changes.

Allow PDF and CSV export where practical.

Never mix these two calculations:

`Budget remaining = Monthly budget - approved budget expenses`

`Closing cash = Opening cash + confirmed inflows - approved payments - confirmed refunds`

They represent different things.

# 6. Financial engine --- highest priority

Financial calculations must be implemented as isolated, well-tested
domain services.

Never calculate financial balances using floating-point numbers.

Use integer poisha (`BIGINT`) or a suitable precise decimal type. Define
conversion and rounding rules centrally.

## Recommended default meal calculation

For a month: - Total meal expenses = approved expenses categorized as
meal/bazar expenses. - Total meal count = sum of counted member meal
records. - Meal rate = total meal expenses / total meal count. - Member
meal cost = member meal count × meal rate. - Member balance = verified
deposits - meal cost - allocated charges + credits.

Example: - Approved meal expenses: ৳30,000. - Total meals: 1,000. - Meal
rate: ৳30. - Member meals: 75. - Member meal cost: ৳2,250. - Verified
deposits: ৳3,000. - Member balance: +৳750 credit.

The manager's chosen calculation policy must be saved per month.

## Expense allocation

Support separate expense categories: - Meal/bazar. - Rent. -
Electricity. - Gas. - Wi-Fi. - Cleaning. - Other shared expense. -
Member-specific expense. - Refund/adjustment.

Do not silently include rent and utilities in the meal rate.

Support configurable allocation methods for non-meal expenses: - Equal
split. - Meal-count-based split. - Custom member allocation.

## Financial integrity

-   Only verified deposits count as confirmed collected money.
-   Only approved expenses count in official reports.
-   Pending records appear separately.
-   Approved transactions cannot be hard-deleted.
-   Corrections must use reversals or adjustment entries.
-   Record who made every change and why.
-   Ensure member balances reconcile with the mess ledger.
-   Handle zero meals, negative balances, refunds, and rounding.
-   Use database transactions for multi-record financial operations.
-   Add automated tests for all calculation scenarios.

Do not invent a financial formula when a requirement is ambiguous.
Record the assumption in `context.md` and request confirmation if it
materially affects member payments.

# 7. AI architecture and implementation

Build an AI abstraction layer rather than calling a provider directly
from controllers.

Suggested structure:

`ai/` - `providers/` - `schemas/` - `prompts/` - `services/` -
`fallbacks/` - `tests/`

Responsibilities: - Provider selection. - Text and image capability
checks. - Structured output validation. - Timeouts and retries. -
Rate-limit handling. - Usage logging. - Fallback behavior. - Confidence
and source tracking.

Potential AI tasks: 1. Bazar image extraction. 2. Bangla/English product
matching. 3. Price comparison and anomaly suggestions. 4. Monthly
spending summaries. 5. Natural-language report queries. 6.
Text-to-bazar-entry draft conversion.

Validate every model response with Zod before using it.

Use structured JSON output where supported. Treat all model output as
untrusted input.

Do not send database write tools to the AI agent for financial approval.
AI can suggest a draft; application business logic and authorized users
control persistence and approval.

Keep API keys on the server. Never expose them in frontend code or logs.

Free-tier quotas and model availability change. Make providers
configurable, and ensure manual operation continues if every AI provider
fails.

# 8. Database and multi-tenant design

Use PostgreSQL and Prisma 7.

Potential entities include: - User. - Mess. - MessMembership. -
MessInvitation. - MessMonth. - MealTypeSetting. - MealRecord. -
DailyMenu. - GroceryItem. - GroceryPrice. - Deposit. - Expense. -
BazarEntry. - BazarEntryItem. - BazarDuty. - Media. - AIExtraction. -
MemberAdjustment. - AuditLog.

You may introduce additional entities if the domain requires them. Do
not blindly implement this list without checking relationships and
normalization.

Important constraints: - Unique membership for `(messId, userId)`. -
Unique meal record for `(messId, memberId, date, mealType)`. - Unique
monthly record for `(messId, year, month)` when using calendar months. -
Unique duty for `(messId, date)` when one person is assigned per day. -
Proper indexes on messId, monthId, memberId, dates, and statuses. -
Foreign keys and deletion behavior must protect historical financial
data. - Purchase item snapshots must preserve name, unit, quantity, unit
price, and total at the time of purchase.

All queries must enforce tenant isolation. Add automated tests that
attempt cross-mess access.

# 9. Backend architecture and API quality

Use modular backend organization. Suggested modules: - auth - users -
messes - memberships - invitations - months - meals - menus -
grocery-catalogue - grocery-prices - deposits - expenses - bazar -
bazar-duty - reports - settlements - media - ai - notifications -
audit-logs

Requirements: - Controllers handle HTTP concerns only. - Services
contain business logic. - Repositories/data-access layer where useful. -
Middleware handles authentication and authorization. - Zod validates
request input. - Consistent API response and error format. - Pagination,
filtering, and sorting for lists. - Proper HTTP status codes. - No
business logic duplicated across controllers. - Avoid giant
controller/service files.

Use database transactions for related writes. Ensure idempotency where
retrying an operation could create duplicate financial entries.

# 10. Frontend architecture and design quality

Create a consistent, polished interface.

Design direction: - Modern SaaS dashboard. - Clean, calm, professional
visual hierarchy. - Mobile-first layouts. - Clear financial figures and
readable tables. - Thoughtful empty, loading, error, and success
states. - Accessible colors and keyboard navigation. - Consistent
spacing, typography, borders, and radii. - Bangla text must render
correctly.

Use shadcn/ui as a foundation, not as an excuse to build every page from
generic components. Customize components to fit the product.

Avoid: - Excessively large cards. - Too many gradients. - Decorative
charts without useful information. - Unnecessary animation. - Fake data
presented as real user data. - Buttons that do nothing. - Placeholder
links in completed pages.

Create reusable components for: - App navigation. - Mess switcher. -
Month selector. - Financial summary. - Transaction table. - Meal status
control. - Menu display. - Bazar entry form. - Photo uploader. -
Verification actions. - Duty calendar. - Charts and report filters. -
Confirmation dialogs.

All forms need validation and useful error messages.

# 11. Security and privacy

Implement: - Secure authentication and session handling. - Server-side
role checks. - Tenant isolation. - Password hashing if password
authentication is used. - Rate limiting. - Input validation and output
encoding. - Secure HTTP headers. - Safe file upload validation. -
Private image storage. - Signed, expiring file URLs. - Audit logs. -
Database backup and restore planning. - Secret management through
environment variables.

Never: - Commit `.env` secrets. - Expose AI API keys. - Allow a member
to read another mess's records. - Trust client-side role checks. -
Expose private photos through public URLs. - Allow AI to approve
financial records. - Log passwords, tokens, or sensitive payment
information.

# 12. Testing requirements

Create automated tests for:

## Financial tests

-   Correct meal rate.
-   Member credit and debit.
-   Zero meals.
-   Zero expenses.
-   Rounding behavior.
-   Equal expense split.
-   Custom expense split.
-   Pending deposit excluded.
-   Rejected bazar entry excluded.
-   Approved expense included.
-   Reversal and adjustment behavior.
-   Ledger reconciliation.

## Meal tests

-   Default ON.
-   Member turns OFF before cut-off.
-   Change rejected after cut-off.
-   Manager override.
-   Meal disabled for the month.
-   Month boundary and timezone behavior.

## Duty tests

-   5 members and 30 days = 6 duties each.
-   5 members and 31 days = 6 each plus one extra.
-   Fair extra-duty rotation across months.
-   Unavailable member.
-   Manual swap.
-   Member removed mid-month.
-   Completed assignments preserved.

## Security tests

-   Member cannot access another mess.
-   Member cannot approve expenses.
-   Manager can only manage authorized messes.
-   Private media cannot be accessed by unauthorized users.
-   Invalid or expired invitation is rejected.

## AI tests

-   Malformed JSON response.
-   Low-confidence extraction.
-   Missing price.
-   Unsupported image model.
-   Provider timeout.
-   Rate limit.
-   Provider unavailable.
-   Manual fallback.

Do not report tests as passing unless you actually ran them.

# 13. Development workflow --- work phase by phase

Do not attempt to build the entire product in one uncontrolled
code-generation operation.

Use these phases:

## Phase 0 --- Discovery and documentation

-   Inspect repository.
-   Read PRD.
-   Create `context.md`.
-   Identify missing decisions.
-   Create implementation roadmap.
-   Record architecture and assumptions.
-   Do not make destructive changes.

## Phase 1 --- Foundation

-   Repository structure.
-   Frontend and backend setup.
-   Database connection.
-   Prisma 7 configuration.
-   Authentication.
-   User profiles.
-   Mess creation.
-   Memberships and invitations.
-   Tenant isolation.
-   Landing page.

## Phase 2 --- Mess operations

-   Monthly setup.
-   Grocery catalogue.
-   Price history.
-   Deposits.
-   Manual bazar entries.
-   Expenses.
-   Manager verification.
-   Audit logs.

## Phase 3 --- Meals and bazar duties

-   Monthly meal settings.
-   Daily menus and notices.
-   Member meal ON/OFF.
-   Cut-off enforcement.
-   Duty generation.
-   Duty swaps and overrides.

## Phase 4 --- Financial engine and reports

-   Ledger.
-   Meal rate.
-   Expense allocation.
-   Member balances.
-   Budget comparison.
-   Closing cash.
-   Monthly reports.
-   PDF/CSV export.

## Phase 5 --- AI and media

-   Private image upload.
-   AI extraction.
-   Product matching.
-   Price assistant.
-   AI-generated report summaries.
-   Provider fallback.
-   Usage monitoring.

## Phase 6 --- Polish and pilot

-   Responsive UI refinement.
-   Bangla support.
-   Performance.
-   Security review.
-   Integration tests.
-   Backup/restore testing.
-   Pilot with a real mess.
-   Fix issues based on feedback.

A phase is complete only when its acceptance criteria are implemented,
tested, and documented.

# 14. Working rules for the AI coding agent

1.  Never start by generating hundreds of files.
2.  Inspect before editing.
3.  Read `context.md` at the start of each session.
4.  Read the relevant PRD sections before implementing a feature.
5.  Make a small plan before a substantial change.
6.  Implement one coherent feature at a time.
7.  Prefer simple, maintainable solutions.
8.  Do not add dependencies without a reason.
9.  Do not rewrite working architecture unnecessarily.
10. Do not fabricate API results, prices, users, reports, or test
    outcomes.
11. Do not silently change financial rules.
12. Do not use mock data in production paths.
13. Clearly label seed/demo data.
14. Do not leave TODOs in a feature you claim is complete.
15. Do not leave buttons or links non-functional.
16. Validate every API input.
17. Enforce authorization on the server.
18. Add tests for business logic.
19. Update `context.md` after every meaningful change.
20. Keep the PRD and context document consistent; if requirements
    change, record the change and its source.
21. Ask the user only when a decision materially affects product
    behavior, data integrity, cost, or security. Otherwise use a clearly
    recorded, reversible default.
22. Never run destructive database commands, delete user data, reset
    production databases, or overwrite user work without explicit
    permission.
23. Do not run migrations against production without explicit approval.
24. Do not claim a task is complete if it has not been tested or if
    important work remains.

# 15. Definition of done for every task

Before declaring a task complete, verify:

-   [ ] Requirements understood.
-   [ ] Existing implementation inspected.
-   [ ] Code follows project conventions.
-   [ ] Input validation implemented.
-   [ ] Authorization and tenant scope checked.
-   [ ] Loading, empty, and error states handled where relevant.
-   [ ] Tests added or updated.
-   [ ] Relevant tests, lint, and typecheck run.
-   [ ] Database migration reviewed, if applicable.
-   [ ] No secrets or sensitive data exposed.
-   [ ] `context.md` updated.
-   [ ] Remaining limitations documented.

At the end, provide a concise report: - What was implemented. -
Important files changed. - Database/API changes. - Tests and actual
results. - Context.md sections updated. - Known issues and next
recommended task.

# 16. Start now --- first response and first actions

Your first task is NOT to build the whole application.

First: 1. Inspect the repository and identify whether it is empty or
already contains code. 2. Locate and read the PRD. 3. Read any existing
`context.md`. 4. Create or update root `context.md`. 5. Identify the
actual stack and versions. 6. Produce a phased implementation plan. 7.
List critical unanswered business decisions. 8. Recommend safe defaults
for decisions that do not block the foundation. 9. Identify the first
small implementation task.

Do not make broad or destructive code changes in this discovery step.

After discovery, wait for the user's approval before beginning a large
implementation phase. If the user explicitly asks you to implement a
specific small task, proceed with that task and maintain `context.md`.

**Final principle:** The codebase is the source of truth for what is
implemented. The PRD is the source of truth for intended product
behavior. `context.md` connects the two and records the current state.
Keep all three aligned.
