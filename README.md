# Zone-D Landlord Management App

A full-stack estate administration platform for **Achievers 1 Estate - Zone D (AECA)**. It helps estate administrators manage landlord records, onboarding, payments, receipts, financial reporting, projects, pledges, celebrations, and a resident-facing transparency portal.

The project is a React single-page application backed by Supabase Auth, Postgres, Storage, Row Level Security, Postgres RPCs, and Deno Edge Functions.

---

## Table of Contents

- [Why this project](#why-this-project)
- [Feature Highlights](#feature-highlights)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Roles and Access](#roles-and-access)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Supabase Setup](#supabase-setup)
- [Email and WhatsApp Setup](#email-and-whatsapp-setup)
- [Available Scripts](#available-scripts)
- [Routes](#routes)
- [Security Design](#security-design)
- [Data Model](#data-model)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Repository Notes](#repository-notes)
- [License](#license)

---

## Why this project

Estate administration often lives in spreadsheets, chat messages, and paper receipts. This platform centralizes the operational workflow:

1. Register or import landlords.
2. Track onboarding tasks.
3. Assign expected payment obligations by frequency.
4. Record payments and confirm them through an atomic database transaction.
5. Generate and deliver receipts.
6. Monitor income, expenses, projects, pledges, and debts.
7. Publish selected financial information to residents.
8. Keep an audit trail of administrative actions.

The result is a practical, role-based management system with financial controls, a public transparency portal, and a responsive interface for desktop and mobile.

---

## Feature Highlights

### Landlord management

- Create, edit, search, filter, sort, activate, and deactivate landlord records.
- Track title, contact details, address, occupancy type, occupation, birthday, anniversary, and notes.
- Preserve payment and receipt history when a landlord is deactivated.
- View a landlord profile with payment history, expected obligations, outstanding balance, and transactions.
- Customize visible table columns.

### Onboarding

- Nine standard onboarding tasks per landlord.
- Complete tasks individually or in bulk with optional notes.
- Automatically move a landlord to active onboarding status when all required tasks are complete.
- Block payment recording until onboarding is complete or at least four tasks have been completed.
- Keep a separate onboarding activity trail.

### Financial overview

- Assign payment types to landlords individually or in bulk.
- Support monthly, yearly, and one-time obligations.
- Compare expected, paid, and outstanding amounts per landlord.
- Identify paid, partial, pending, and needs-review accounts.
- Export financial summaries to CSV and PDF.
- Record partial payments against outstanding balances.

### Payments and receipts

- Record bank-transfer and cash payments as pending.
- Detect duplicate payments unless an explicit obligation description is provided.
- Confirm payments through a Postgres RPC that atomically creates the matching ledger entry and updates the account balance.
- Track confirmation, receipt generation, and delivery status.
- Generate receipt PDFs with `@react-pdf/renderer`.
- Download, email, or WhatsApp receipts.
- Track email and WhatsApp delivery separately.

### Transactions and accounting

- Credit and debit ledger with configurable categories.
- Approval threshold for debits.
- Role-based transaction approval and rejection.
- Account balance recomputed from approved transactions, never edited directly.
- Search, filter, paginate, export, and bulk-import transactions.

### Celebrations

- Birthday and wedding-anniversary tracking.
- Opt-in and onboarding eligibility rules.
- Queued celebrations, editable message templates, approval, sending, and skip reasons.
- WhatsApp and email delivery.
- Daily admin reminder emails with delivery tracking.

### Projects, pledges, and debts

- Track zone projects and milestones.
- Record pledges and donations, optionally linked to a landlord.
- Track project funding shortfalls and debt repayments.
- Show selected projects and financial totals on the public portal.

### Public transparency portal

- Public page at `/zone-info` with no login required.
- Shows account balance, total outstanding, project budget, project debt, active projects, recent payments, pledges, and top outstanding balances.
- Allows residents to check their outstanding balance by phone number.
- Accepts anonymous feedback, suggestions, bug reports, and compliments.
- Rate-limited public endpoints.

### Administration

- Role-based admin accounts: Chairman, Secretary, Treasurer, Officer.
- Per-feature permissions managed by the Chairman.
- User creation and deletion through protected Edge Functions.
- Audit log for key actions.
- Chairman-only settings, transaction categories, approval rules, and data reset.
- Dark and light themes.
- Responsive sidebar and mobile navigation.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| UI | React 19, React Router 7, Lucide React |
| Build | Vite 7, Terser |
| Data fetching | Supabase JS, TanStack Query |
| Styling | CSS with responsive layouts and CSS variables |
| Auth | Supabase Auth |
| Database | Supabase Postgres with Row Level Security |
| Business logic | Postgres functions and RPCs |
| File storage | Supabase Storage, private receipts bucket |
| Serverless | Supabase Edge Functions (Deno) |
| Email | EmailJS |
| WhatsApp | WhatsApp Cloud API through an Edge Function |
| PDF | `@react-pdf/renderer` |
| CSV | Papa Parse |
| Dates | date-fns |
| Testing | Vitest |
| Linting | ESLint |
| Production server | Express static server |

---

## Architecture

```text
Browser
  |
  |-- React SPA
  |     |-- React Router pages
  |     |-- Auth and toast contexts
  |     |-- Feature components
  |     |-- Service modules
  |     |-- Supabase client
  |     `-- EmailJS browser SDK
  |
  `-- Supabase
        |-- Auth
        |-- Postgres + RLS + RPCs
        |-- Storage: private receipts bucket
        `-- Edge Functions
              |-- Admin lifecycle
              |-- WhatsApp delivery
              |-- Celebration queue
              |-- Public dashboard
              |-- Public landlord lookup
              |-- Feedback submission
              `-- Protected data reset
```

Key design choices:

- **Service layer:** UI components call modules in `src/services`, keeping pages focused on presentation and state.
- **Atomic financial writes:** Payment confirmation, transaction creation, approval, rejection, and balance recalculation run through Postgres RPCs.
- **Defense in depth:** Feature permissions are checked in the UI and enforced again with RLS and server-side authorization.
- **Private storage:** Receipt PDFs live in a private Supabase Storage bucket.
- **No service-role key in the browser:** Privileged operations run only inside Edge Functions.

---

## Roles and Access

| Role | Scope |
| --- | --- |
| Chairman | Full access. Manages admin users, permissions, transaction categories, approval settings, and data reset. |
| Secretary | Record keeping and operational access controlled by feature permissions. |
| Treasurer | Financial access controlled by feature permissions and transaction approval roles. |
| Officer | General administrative access controlled by feature permissions. |

The Chairman can enable or disable individual features for other admins. Database policies enforce the important write operations independently of the UI.

---

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm
- A Supabase project
- An EmailJS account for email delivery
- Optional: Supabase CLI
- Optional: WhatsApp Cloud API credentials

### 1. Install dependencies

```bash
npm install
```

### 2. Create the environment file

```bash
cp .env.example .env
```

Fill in the values described in [Environment Variables](#environment-variables).

### 3. Start the development server

```bash
npm run dev
```

Vite prints the local URL, usually `http://localhost:5173`.

### 4. Build for production

```bash
npm run build
```

Production assets are written to `dist/`.

---

## Environment Variables

Only variables prefixed with `VITE_` are exposed to the browser. Never put a service-role key, SMTP password, or WhatsApp access token in a `VITE_` variable.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `VITE_EMAILJS_SERVICE_ID` | For email | EmailJS service ID |
| `VITE_EMAILJS_TEMPLATE_RECEIPT` | For receipts | EmailJS receipt template |
| `VITE_EMAILJS_TEMPLATE_CELEBRATION` | For celebrations | EmailJS celebration template |
| `VITE_EMAILJS_TEMPLATE_NOTIFICATION` | For notifications | EmailJS notification template |
| `VITE_EMAILJS_PUBLIC_KEY` | For email | EmailJS public key |
| `VITE_ESTATE_NAME` | Optional | Estate name used in messages and PDFs |
| `VITE_ESTATE_ZONE` | Optional | Zone label used on PDFs |

For the Express production server, also set `VITE_SUPABASE_URL` or `SUPABASE_URL` in the process environment so the Content-Security-Policy can allow Supabase requests.

---

## Supabase Setup

### 1. Create a project

Create a Supabase project, then copy the project URL and anon key into `.env`.

### 2. Apply the public schema

The repository includes the base schema at `supabase/schema.sql`. Run it in the Supabase SQL Editor, or apply it with the Supabase CLI.

The full production migration history is maintained privately and is not published in this repository. The base schema is included so reviewers can understand the core data model and run the frontend against a compatible project.

### 3. Create the receipts bucket

Create a **private** Storage bucket named `receipts`.

### 4. Create the first Chairman

Create a user in **Authentication > Users**, copy the user UUID, then insert the matching admin profile:

```sql
insert into public.admin_profiles (id, full_name, role, zone)
values (
  '<auth-user-uuid>',
  'Chairman Full Name',
  'chairman',
  'Zone D'
);
```

After the first Chairman exists, additional Secretary, Treasurer, and Officer accounts can be created from **Settings > User Management**.

### 5. Deploy the Edge Functions

Deploy the functions used by the app:

```bash
supabase functions deploy create-admin-user
supabase functions deploy delete-admin-user
supabase functions deploy check-celebrations
supabase functions deploy send-whatsapp
supabase functions deploy send-celebration
supabase functions deploy wipe-all-data
supabase functions deploy public-dashboard
supabase functions deploy public-landlord-lookup
supabase functions deploy submit-feedback --no-verify-jwt
```

Optional functions included in the repository:

```bash
supabase functions deploy send-email
supabase functions deploy bulk-import-landlords
```

`submit-feedback` must accept anonymous requests because it is used by the public portal.

### 6. Set Edge Function secrets

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` automatically.

Set the optional delivery and branding secrets you use:

```bash
supabase secrets set \
  WHATSAPP_API_URL=https://graph.facebook.com/v17.0 \
  WHATSAPP_PHONE_NUMBER_ID=<your-phone-number-id> \
  WHATSAPP_ACCESS_TOKEN=<your-access-token> \
  ESTATE_NAME="Achievers 1 Estate - Zone D"
```

For the optional SMTP-based email function, also set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS`.

---

## Email and WhatsApp Setup

### EmailJS

1. Create an EmailJS account.
2. Connect an email provider.
3. Create templates for receipts, celebrations, and notifications.
4. Add the service ID, public key, and template IDs to `.env`.

Receipt template fields used by the app:

- `to_email`
- `to_name`
- `subject`
- `receipt_number`
- `amount`
- `payment_type`
- `payment_date`
- `estate_name`
- `pdf_url`

### WhatsApp

WhatsApp delivery is handled server-side by the `send-whatsapp` and `send-celebration` Edge Functions. Keep the WhatsApp access token in Supabase secrets only; do not add it to `.env` or any `VITE_` variable.

---

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build production assets into `dist/` |
| `npm run preview` | Preview the production build |
| `npm run production` | Build and preview |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `node server.js` | Serve `dist/` with the Express production server |

---

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/login` | Public | Admin sign-in |
| `/dashboard` | Authenticated | Metrics, alerts, recent activity |
| `/landlords` | Authenticated | Landlord records and profiles |
| `/onboarding` | Authenticated | Onboarding tasks |
| `/bulk-import` | Authenticated | Landlord, financial, and transaction CSV imports |
| `/payments` | Authenticated | Payment recording and confirmation |
| `/receipts` | Authenticated | Receipt generation and delivery |
| `/financial-overview` | Authenticated | Expected vs paid balances and exports |
| `/transactions` | Authenticated | Estate ledger and approvals |
| `/celebrations` | Authenticated | Birthday and anniversary workflow |
| `/audit-log` | Authenticated | Administrative activity trail |
| `/settings` | Authenticated | Profile, notifications, messaging, security, and Chairman tools |
| `/zone-management` | Authenticated | Projects, pledges, and project debts |
| `/feedback` | Authenticated | Public feedback inbox |
| `/zone-info` | Public | Resident transparency portal |

---

## Security Design

- Supabase Auth with email/password authentication.
- Admin accounts require a matching `admin_profiles` record.
- Feature permissions enforced in the UI and again through RLS.
- Chairman-only operations protected in the UI, database, and Edge Functions.
- Financial mutations executed through Postgres functions that derive the actor from `auth.uid()`.
- Public data endpoints use service-role queries inside Edge Functions so private tables are not exposed directly.
- Public feedback and balance lookup are rate-limited by hashed IP address.
- Receipt files are stored in a private bucket.
- Security headers and a Content-Security-Policy are applied by the Express server.
- No service-role key, SMTP password, or WhatsApp token is committed to the repository.

---

## Data Model

Core tables in `supabase/schema.sql`:

| Table | Purpose |
| --- | --- |
| `admin_profiles` | Admin identity, role, zone, and permissions |
| `landlords` | Landlord identity, contact, address, occupancy, and onboarding status |
| `payment_types` | Payment obligation types |
| `payments` | Logged payments and confirmation state |
| `receipts` | Receipt records and delivery status |
| `celebrations_queue` | Birthday and anniversary events |
| `celebration_templates` | Editable message templates |
| `onboarding_tasks` | Per-landlord onboarding checklist |
| `onboarding_activity_log` | Onboarding audit trail |
| `activity_logs` | Administrative action log |

The private production schema extends these with assignments, transactions, account balances, projects, pledges, debts, feedback, and rate limiting.

---

## Testing

```bash
npm test
```

The Vitest suite covers reference generation, receipt number formatting, validation helpers, and payment and transaction service behavior.

Linting:

```bash
npm run lint
```

---

## Deployment

### Static hosting

Build the app and deploy `dist/` to Netlify, Vercel, Cloudflare Pages, or any static host. Configure an SPA fallback so all routes resolve to `index.html`:

```text
/*    /index.html   200
```

### Express server

```bash
npm run build
VITE_SUPABASE_URL=https://your-project.supabase.co PORT=3000 node server.js
```

The server serves the built app, adds security headers, and applies a Content-Security-Policy using the configured Supabase host.

### Deployment checklist

1. Apply the database schema.
2. Create the first Chairman profile.
3. Deploy the required Edge Functions.
4. Set Edge Function secrets for WhatsApp and optional SMTP.
5. Set frontend environment variables.
6. Create the private `receipts` bucket.
7. Verify login, payment confirmation, receipt delivery, and the public portal.
8. Confirm the production CSP allows your Supabase project and EmailJS.

---

## Project Structure

```text
.
|-- public/                  # Static assets and SPA redirects
|-- src/
|   |-- components/          # Feature and layout components
|   |-- context/             # Auth and toast providers
|   |-- lib/                 # Supabase client
|   |-- pages/               # Route-level screens
|   |-- services/            # Supabase and API data access
|   `-- utils/               # Formatting, helpers, and tests
|-- supabase/
|   |-- functions/           # Deno Edge Functions
|   |-- migrations/          # Private local migrations (ignored by Git)
|   `-- schema.sql           # Public base schema
|-- .env.example
|-- eslint.config.js
|-- index.html
|-- package.json
|-- server.js
|-- vite.config.js
`-- README.md
```

---

## Repository Notes

- The root `README.md` is the only tracked Markdown document.
- Production migrations are intentionally kept out of the public repository.
- Local environment files, Supabase CLI state, build output, and agent tooling are ignored.
- The public repository contains no production credentials or landlord data.

---

## License

MIT License. See [LICENSE](LICENSE).
