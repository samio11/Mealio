# Mealio — Mess Management

Mealio is a web application for organizing the finances and day-to-day operations of shared
living groups in Bangladesh. It brings meal tracking, shared expenses, deposits, bazar
purchases, shopping duties, member balances, and monthly reports into one place.

## What it solves

In a student mess, bachelor mess, or shared apartment, important information is often spread
across chat messages, spreadsheets, receipts, and personal notes. That makes it difficult to
answer basic questions reliably:

- Who is eating which meals, and how many meals should each person pay for?
- Which expenses have been approved, and which deposits have actually been received?
- How much does each member owe at the end of the month?
- Who is responsible for bazar, and what was purchased?
- Can members and managers review changes and understand where the numbers came from?

Mealio keeps these records together, scopes them to each mess, and generates monthly summaries
from recorded activity. It is designed for Bangladesh-specific needs such as BDT/poisha
accounting, Bangla and English grocery names, and the `Asia/Dhaka` timezone.

## Who it is for

- **Mess managers** who coordinate members, monthly settings, meals, menus, verification, duties,
  and reports.
- **Members** who record their own meals, view menus and duties, submit activity, and track their
  personal balance.
- **Bazar assignees** who record purchases and submit them for manager review.
- **Platform administrators** who manage platform-level support and administration.

A user can belong to more than one mess and can have a different role in each one. Permissions
are enforced by the API for the requested mess.

## Main capabilities

### Mess and member management

- Create and manage multiple messes.
- Invite members and accept invitations.
- Assign manager or member roles within each mess.
- Remove members without deleting the financial history associated with them.
- Keep an audit trail for important manager actions.

### Months, meals, and menus

- Manage calendar months and per-month meal settings, including meal enablement and cut-off
  times.
- Let members turn their own meals on or off before the configured cut-off; manager overrides
  are audited.
- Record guest meals against a member, date, and meal period (breakfast, lunch, or dinner).
  Guest meals remain separate from the member's own on/off choice, but count toward the meal
  totals.
- Review a responsive monthly timeline for each member, showing daily breakfast, lunch, and
  dinner counts, including guests.
- Edit a member's meals across a month without clearing unrelated records.
- Publish daily menus and notices.
- Close and reopen months; closing preserves a snapshot of the relevant settings.

### Shared finances

- Record member deposits and verify them before including them as confirmed funds.
- Record shared expenses and approve them before including them in official reports.
- Allocate approved expenses and produce member balances.
- Distinguish budget remaining from closing cash.
- Correct approved expenses through reversals rather than silently deleting financial history.
- Export monthly reports as CSV.

Financial amounts are stored as integer **poisha** (100 poisha = ৳1) to avoid floating-point
rounding errors. The application formats and displays amounts in Bangladeshi Taka.

### Grocery and bazar operations

- Maintain a shared grocery catalogue with Bangla and English names, aliases, categories, and
  common units.
- Record grocery price history and identify the source and verification status of prices.
- Create bazar entries with line-item snapshots so later catalogue edits do not rewrite purchase
  history.
- Submit bazar entries for manager review and approval.
- Upload and review purchase photos when private Cloudinary storage is configured.
- Generate, swap, or manually reassign bazar duties while preserving completed assignments.

### Optional AI assistance

When an AI provider is configured, the application can assist with bazar receipt extraction,
price estimates, and report summaries. AI output is treated as a draft: it is validated and must
be reviewed by a person. AI does not approve expenses or post financial transactions.

## Technology

| Area | Technology |
|---|---|
| Web client | Next.js 15 App Router, React 19, TypeScript |
| UI | Tailwind CSS 4, Radix-based UI components, Lucide icons |
| Client data and forms | TanStack Query, React Hook Form, Zod |
| Charts | Recharts |
| API | Node.js, Express 5, TypeScript |
| Authentication | Better-Auth with cookie-based sessions |
| Database | PostgreSQL |
| ORM | Prisma 7 with the PostgreSQL driver adapter |
| Logging | Pino and pino-http |
| Optional media | Cloudinary |
| Optional AI | OpenRouter primary; Gemini and Groq keys are also supported by configuration |
| Package management | npm workspaces |

The application is a modular monolith: the Next.js client communicates with a versioned
Express API, and the API owns authorization, validation, business rules, and database access.
The browser uses a same-origin Next.js proxy for `/api/*` and `/health`, so authentication
cookies can be sent with client requests.

## Repository layout

```text
.
├── README.md
├── context.md                       # Detailed project development memory
├── ai_master_development_prompt_mess_saas.md
├── package.json                     # npm workspaces and root commands
├── client/
│   ├── app/                         # Public, auth, and mess-management pages
│   ├── components/                  # UI primitives and shared components
│   └── lib/                         # API client, types, hooks, and app context
└── server/
    ├── prisma/                      # PostgreSQL schema, migrations, and seed
    ├── src/app/                     # Express setup, configuration, middleware, utilities
    ├── src/modules/                 # Auth, meals, finances, bazar, reports, and other domains
    └── tests/                       # Unit and database-backed integration tests
```

## Getting started

### Requirements

- Node.js 20 or newer.
- npm (the repository uses npm workspaces).
- A PostgreSQL database that the API can connect to.

### 1. Install dependencies

Run this from the repository root:

```sh
npm install
```

### 2. Configure environment variables

Copy the example files:

```sh
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```

In PowerShell, use:

```powershell
Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env.local
```

At minimum, set `DATABASE_URL` to your PostgreSQL connection string and set a strong
`BETTER_AUTH_SECRET` in `server/.env`. The secret must be at least 16 characters. Generate a
random value with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

The client proxy defaults to `http://localhost:5000`; set `API_PROXY_TARGET` in
`client/.env.local` only if the API runs at a different address.

Optional integrations are described below. Keep real secrets in local environment files or a
deployment secret store; never commit them.

### 3. Generate the Prisma client and apply migrations

Run from the repository root:

```sh
npm run prisma:generate --workspace server
npm run prisma:deploy --workspace server
```

`prisma:deploy` applies all migrations that have not yet been applied to the database selected
by `DATABASE_URL`. Before using it against a shared or production database, verify the target
database, inspect pending migrations, and take an appropriate backup.

For a local development database with a configured shadow database, Prisma's development
migration command is available:

```sh
npm run prisma:migrate --workspace server
```

### 4. (Optional) Seed platform data

The seed command adds the shared grocery catalogue and creates or promotes a platform
administrator only when `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` are set in `server/.env`.
It is safe to rerun:

```sh
npm run db:seed
```

### 5. Start the application

Run these commands in separate terminals from the repository root:

```sh
npm run dev:server
```

```sh
npm run dev:client
```

The client is available at [http://localhost:3000](http://localhost:3000). The API health
endpoint is [http://localhost:5000/health](http://localhost:5000/health); the client also
proxies `/health` to the API.

## Environment variables

The complete, current examples are in [`server/.env.example`](./server/.env.example) and
[`client/.env.example`](./client/.env.example).

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | PostgreSQL connection used by Prisma. |
| `BETTER_AUTH_SECRET` | Yes | Secret used by Better-Auth; use a strong random value of at least 16 characters. |
| `NODE_ENV` | No | `development`, `test`, or `production`; defaults to `development`. |
| `PORT` | No | API port; defaults to `5000`. |
| `FRONTEND_URL` | No | Trusted client origin; defaults to `http://localhost:3000`. |
| `BETTER_AUTH_URL` | No | Better-Auth server URL; defaults to `http://localhost:5000`. |
| `API_PROXY_TARGET` | No | Client-side Next.js proxy destination; defaults to `http://localhost:5000`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | No | Enable Google OAuth sign-in when both are configured. |
| `EMAIL_SENDER_SMTP_*` | No | SMTP configuration for email features. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | No | Enable private media and profile-photo uploads. |
| `OPENROUTER_API_KEY` | No | Enables the primary AI integration. |
| `OPENROUTER_BASE_URL`, `AI_EMBEDDING_MODEL`, `AI_TEXT_MODEL` | No | Configure the OpenRouter endpoint and model choices. |
| `GEMINI_API_KEY`, `GROQ_API_KEY` | No | Optional additional AI-provider credentials. |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` | No | Optional credentials used by the seed command to create a platform admin. |

## Useful commands

| Command | Description |
|---|---|
| `npm run dev:server` | Start the Express API in watch mode. |
| `npm run dev:client` | Start the Next.js development server. |
| `npm run build:server` | Build the API. |
| `npm run build:client` | Build the client. |
| `npm run typecheck:server` | Type-check the API. |
| `npm run typecheck --workspace client` | Type-check the client. |
| `npm run test:server` | Run server unit and integration tests. |
| `npm run prisma:generate --workspace server` | Generate Prisma client code from the schema. |
| `npm run prisma:deploy --workspace server` | Apply pending migrations. |
| `npx prisma migrate status` (from `server/`) | Inspect migration status for the configured database. |
| `npm run db:seed` | Seed the grocery catalogue and optional platform administrator. |

## API and data integrity

- API routes are versioned under `/api/v1`.
- Successful responses use a consistent JSON envelope; invalid input is validated with Zod.
- Authentication and mess-level role checks happen on the server.
- Mess-owned queries are scoped to the requested mess and an active membership.
- Writes that affect important records are audited with actor and change details.
- Approved expenses and verified deposits are treated differently from pending or rejected
  records in official reports.
- Meal cut-offs and date/month calculations use `Asia/Dhaka`.
- Money is serialized to clients as strings representing integer poisha; avoid floating-point
  arithmetic for financial calculations.

## Testing

Server tests include unit tests for money, date/time, duty scheduling, catalogue matching, and
CSV output, plus integration tests for financial reporting and tenant isolation.

> **Use a dedicated test database.** Server integration tests create and modify database
> fixtures. Do not run them against a production database or a database containing data you
> cannot safely test with.

Run the server suite with:

```sh
npm run test:server
```

The client currently has type-checking and production-build checks; a browser automation test
runner is not configured.

## Current scope and limitations

- The initial product scope is free; subscription billing and paid-plan gating are not
  implemented.
- Live grocery price feeds are not implemented. Prices are entered or verified by people, or
  provided as clearly identified estimates.
- AI and Cloudinary-backed features are optional and require their provider credentials.
- AI assistance produces drafts and estimates; it does not approve or post financial activity.
- A database and valid server environment configuration are required to run the application.
