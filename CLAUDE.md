# Accounting ERP — Project Memory

Persian (RTL, Jalali calendar) web accounting/ERP for small–medium businesses. Monorepo: `backend/` (Express + Prisma + PostgreSQL) and `frontend/` (React SPA). UI text, comments, error messages and design docs are in **Persian** — keep new user-facing text and code comments in Persian, consistent with the surrounding code.

Last refreshed: 2026-09-20 (branch `master`; main branch for PRs is `main`).

## Stack & run

- Backend: Node + Express 4 + TypeScript, Prisma 5, PostgreSQL 16, JWT (`jsonwebtoken`, `bcryptjs`), `zod`, `express-async-errors`. Port 4000, all routes under `/api`.
- Frontend: React 18 + TS + Vite 5, `react-router-dom` 6, `react-multi-date-picker` (Jalali), `recharts`, `xlsx`. No UI kit — hand-written components and one `styles.css`. Dev port 5173 (Docker maps 5174).
- Docker: `docker compose up --build` (db on host 5433, backend 4000, frontend 5174; source bind-mounted, watch mode). Frontend derives API URL from `window.location.hostname` unless `VITE_API_URL` is set.
- Backend scripts: `npm run dev` (tsx watch), `build` (tsc), `seed`, `prisma:migrate`, plus maintenance scripts in `backend/src/scripts/` (cleanup-orphans, recompute-has-transactions, goods backfill/backup/restore/delete).
- Frontend: `npm run dev`, `npm run build` (`tsc -b && vite build`). `backend/dist` and `frontend/dist` are untracked build output.
- Default seed login: mobile `0999999999`, password `Admin@123`.
- No test suite exists; verify with `tsc` builds and by using the feature in the browser.
- Migrations: `backend/prisma/migrations/` (~70, timestamped `2026MMDD...`). Schema is `backend/prisma/schema.prisma` (~3000 lines, ~134 models, ~55 enums). Add a new migration for every schema change.

## Modules (mirror `frontend/src/navConfig.ts`)

تنظیمات (roles, users, currencies, rates, fiscal periods, org structure, geo regions, detail types) · اطلاعات پایه (parties, cash boxes, banking, cost centers, org units, reporting periods) · حسابداری (reporting levels, accounts tree, document types, journal entries, account closing, opening/closing, document confirmation, account review reports) · کالا و خدمت (goods/services, groups, attributes, units, pricing, requests, supply requests, initial inventory) · مدیریت موجودی و انبار (warehouse receipts/issues/transfers in-out/returns/adjustments/counting shortages, confirmation, warehouse accounting/JE issuance, warehouse review report, batches, serials, physical locations) · زنجیره تامین (purchase types, purchase invoices, service purchase invoices, purchase chain, supplier returns) · فروش (sales types/centers, quote→order→invoice, deliveries, sales return invoice, sales review report) · خزانه‌داری (receipts, payments, cheques, deposits, deposit returns, clearing receivable/payable, receipt types).

## Backend layout (`backend/src`)

- `index.ts`: registers ~79 route files. Order: public `/api/auth` → `requireAuth` → `fiscalScopeContext` → everything else. Global error middleware at the end.
- `routes/`: one file per form/group; call Prisma directly (no repository layer). Shared business logic lives in `services/` (`journalEntryService` = the single entry point for issuing journal entries, `goodsPricingService`, `warehouseMovementService`, `warehouseStockService`, `warehouseConfirmationService`, `serialLifecycleService`, `batchService`, `documentEffectsService`, `salesReviewService`, `importJobService`, …).
- `utils/`: pure helpers (`coding.ts` auto detail codes, `concurrency.ts`, `currencyConversion.ts`, `vatCalculation.ts`, `jalaliDate.ts`, `tableFilters.ts`, `warehouseTracking.ts`, …).
- `authz/`: RBAC. `registry.ts` is the **single source of truth** for modules/forms/actions (base actions view/create/edit/delete + custom). Routes use `can("module.sub.form.action")` from `guard.ts`; an unregistered key crashes the server at boot. `sync.ts` syncs the registry to DB; the admin permission tree comes from `GET /api/authz/tree`. To add a form/action, edit `registry.ts` (and `navConfig.ts` for menu).
- `middleware/fiscalScope.ts` + `lib/prisma.ts`: frontend sends `x-fiscal-period-id`; the Prisma client wrapper **automatically scopes list queries** of every model having `fiscalPeriodId` to the current fiscal period (fallback: latest period). `bypassFiscalScope` exists in request context for exceptions. Dates of documents must fall in the current fiscal period (`utils/fiscalPeriodValidation.ts`).
- `utils/concurrency.ts`: lost-update protection — GET/:id returns `updatedAt`; PUT/:id calls `assertRecordNotStale(existing.updatedAt, req.body.updatedAt, label)` right after the not-found check. Frontend `lib/api.ts` remembers and re-sends it automatically.
- `importProcessors/` + `ImportJob`: async Excel import per record type.
- `lib/bulkError.ts`: structured bulk-failure errors (`details`) rendered by frontend `BulkErrorDialog`.
- `data/warehouseDocNatureMatrix.ts`: warehouse document nature rules.

## Frontend layout (`frontend/src`)

- `App.tsx` routes (list/new/edit per form), `navConfig.ts` menu, `pages/` (~95 files, one per form/report), `components/` shared (DataTable, Modal, FormPage, TreeView, RecordPicker, JalaliDatePicker, AmountInput, FxAmountDialog, Wizard, TabsBar, …), `lib/` (api, AuthContext, TabsContext, `useCrud`, `useDocumentForm`, `usePermissions`, formatters, review-report caches, `currencyConversion`, `vatCalculation`, `costAllocation`).
- Server is the source of truth; frontend only does display-side helper calculations.

## Domain conventions & gotchas

- Dates stored Gregorian in DB, shown Jalali. Amounts are `Decimal`, never float. Foreign-currency lines carry a rate and base-currency equivalents (`baseDebit/baseCredit`, base-currency VAT); FX gain/loss (تسعیر) is centralized.
- Journal entries: 3 numbers (per-fiscal-period number, global ref number, daily number); must balance in base currency; status DRAFT/REVIEW/APPROVED; `JournalEntrySource` links back to the issuing document; `IssuingSystem` enum marks the issuing module. Account-specific validations (mandatory detail, level, FX) are the caller's job.
- Detail codes (تفصیلی) are globally unique across all detail types via `DetailCodeUsage`.
- `hasTransactions` flag on base entities blocks deletion of records with activity.
- Soft "warning" pattern: HTTP 409 with `{error, warning:true}`; client re-sends with `confirmDuplicate: true`.
- Errors are returned as `{ error: "Persian message" }`. Business rules go inside handlers; `can()` only checks permission.
- Warehouse documents have a status lifecycle, confirmation, date-lock (`assertDateNotConfirmed`, `assertWarehouseOpenForDate`), serial/batch tracking, pricing engine (see docs), and separate JE issuance from warehouse documents.
- Treasury: masters live in خزانه‌داری > تنظیمات (receipt/payment types, received/payable cheque types, "تعیین حسابهای معین" = TreasuryAccountSetting mapping bank account / cash box / cheque type / receipt-payment subject / FX_GAIN_LOSS to a last-level account, "دسته چک" = ChequeBookLeaf per-leaf cheque-book register). Receipt journal entry = manual "issue" action on an APPROVED receipt (`services/receiptJournalEntryService.ts`, issuingSystem TREASURY, doc type RECEIPT): debit per instrument row, credit per settlement row by basis, FX gain/loss on one FX_GAIN_LOSS account; the receipt is locked (no unapprove/edit-approved) until the entry is deleted. The Payment form mirrors the Receipt form (per-row currency/rate, settlement rows with payment types and base documents, FX gain/loss, payable cheque types, issue/revert journal entry via `services/paymentJournalEntryService.ts`, doc type PAYMENT); its cheque rows can also endorse an existing receivable cheque (ChequeItem stores receivableChequeTypeId/payableChequeTypeId for accounting). "دسته چک" (`routes/chequeBookLeaves.ts`): bank accounts whose `BankAccountType.hasChequeBook` is true require picking a RAW leaf (not free-text) when issuing a new cheque in Payments; the leaf flips RAW→ISSUED when the ChequeItem is created (approve / edit-approved) and back to RAW when it's deleted (unapprove / edit-approved); voiding (RAW→VOID) is a separate manual action, only from RAW.
- Purchase/sales invoices issue journal entries; purchase cost lines are unified/shared; receivable/payable accounts can be groupless; receipt types drive receipt settlement (موضوعات دریافت).

## Documentation in repo

- `README.md` (original setup, phase 1), `architecture-report.md` (dated 2026-08-04, **outdated** — pre-warehouse/sales/treasury), `stockAnalysis.md`.
- `Documents/*.md`: Persian design specs (warehouse pricing algorithm and reverse-mode engine, warehouse confirmation, JE issuance, FX rounding/تسعیر, receipt changes/types, sales review report, sale invoice voucher, reporting period, tracking model, serial/batch selection, service purchase vs stock receipt). Read the relevant doc before changing that area. `~$…`/`~…bak` files there are Office/editor temp files — ignore.
- Root `fix-issuing-system-data.sql` (also in `backend/`) is a one-off data fix.

## Working rules for this repo

- Match existing patterns: new route file + register in `index.ts` + `authz/registry.ts` + `navConfig.ts` + `App.tsx` + page; schema change ⇒ Prisma migration.
- Reuse `journalEntryService`, `assertRecordNotStale`, fiscal scoping, and shared components instead of re-implementing.
- Don't commit `dist/`, `~$` temp files, or `.env`.
