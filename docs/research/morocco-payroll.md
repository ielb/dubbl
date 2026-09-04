# Research: Phase 3 — Moroccan payroll (CNSS/AMO/IR)

Source issue: `gh issue view 4 --repo ielb/dubbl`. This doc is research only — no implementation plan.

---

## 1. Issue scope (from the fetched issue body + AI triage comment, verbatim)

**Title:** Phase 3: Moroccan payroll (CNSS/AMO/IR)
**Part of:** the Moroccan market adaptation epic (Phase 1 currency/tax/COA and Phase 2 French UI already merged).

### Goal
> Add Moroccan CNSS/AMO/IR payroll support alongside the existing US-shaped payroll.

### Approach (issue body)
> `computePeriodWithholding` (the progressive-bracket engine in `lib/api/payroll-tax.ts`) is already country-agnostic and directly reusable for Moroccan IR. `computeFica`/`computeEmployerTaxes` are hardcoded to the US FICA shape and aren't reusable for CNSS's multi-contribution structure — new parallel functions are needed.

### Subtasks (issue checklist, verbatim)
- [ ] Add a `country` field (default `"US"`) plus CNSS (retraite / allocations familiales / risque professionnel) / AMO / TFP rate columns to `payrollSettings` in `lib/db/schema/payroll.ts`; generate + commit the migration (`npx drizzle-kit generate`)
- [ ] Implement `computeCnss()` / `computeAmo()`, reusing the capped-wage-slice primitive already used inside `computeFica`/`computeEmployerTaxes`
- [ ] Branch `computeEmployeeWithholding` (`lib/api/payroll-withholding.ts`) on `payrollSettings.country === "MA"`; seed Moroccan IR `taxBracket` rows
- [ ] Fix `deductionsBreakdown` population in `app/api/v1/payroll/runs/[id]/generate-payslips/route.ts` (currently hardcoded empty for every country) so CNSS/AMO lines actually show up on payslips
- [ ] Add `tests/payroll-tax-ma.test.ts` covering CNSS/AMO amounts for a known gross salary plus one IR withholding case

### Not doing (issue body, verbatim)
> A Moroccan payroll-settings UI — the US FICA rate columns aren't exposed in the settings UI today either (statutory defaults, not user-editable); Morocco mirrors that existing behavior rather than getting new UI neither country currently has. Moroccan tax-form generation (CNSS declaration / IR annual summary) — the US W-2/1099 equivalent is JSON-classification only with no PDF today, so a Moroccan equivalent is out of scope unless requested.

### Note (issue body, verbatim)
> Moroccan IR bracket values will be seeded from the current schedule but tax brackets change with each Finance Law — verify against the current law before relying on this for real payroll.

### AI triage comment — Agent Brief (verbatim, key sections)

**Category:** enhancement

**Current behavior:**
> Payroll withholding today assumes a single country's statutory shape baked into named settings fields (US Social Security, Medicare, Additional Medicare, FUTA, SUTA) and a corresponding calculation path with a fixed three-component result shape. Separately, there's already a generic, country-agnostic progressive-bracket withholding calculator driven by database-configurable bracket/allowance rows — that part isn't US-specific and doesn't need to change. There's no notion of "which country's payroll rules apply to this org" anywhere in the schema.

**Desired behavior** (rates, per the triage comment, "sourced from multiple independent Moroccan payroll providers, not the primary regulatory text" — verify before production use):
- CNSS+AMO totals 27.83% of gross: **6.74% employee** (pension 3.96%, AMO 2.26%, "CT" 0.33%, IPE 0.19%) + **21.09% employer** (allocations familiales 6.40%, pension 7.93%, AMO 4.11%, TFP 1.60%, CT 0.67%, IPE 0.38%).
- A monthly wage ceiling of 6,000 MAD applies only to pension/CT/IPE (both sides); AMO and allocations familiales are uncapped, on full gross wages.
- Moroccan IR via the existing generic progressive-bracket calculator, seeded with the 2026 schedule (Loi de Finances 2026 / Law 50-25, DGI circular note 737): 0% to 40,000 MAD/year, then 10%/20%/30%/34%/37% at 60k/80k/100k/180k MAD; 35% professional-expense deduction (25% beyond 78,000 MAD/year) capped at 35,000 MAD/year; 600 MAD/year per-dependent deduction, up to 6 dependents.
- Same per-employee tax-breakdown line-item shape as US orgs get today, so they render on payslips the same way. Notes explicitly: *"as of now, generated payslips don't actually surface any breakdown lines for any country ... so fixing that gap is in scope here."*

**Key interfaces (verbatim):**
> - Whatever setting currently distinguishes payroll configuration per org (rates, wage bases) needs a country selector alongside it, defaulting to the current behavior (US) for existing orgs.
> - A CNSS/AMO calculation function parallel to the existing FICA-equivalent one, but shaped for Morocco's multiple independently-capped/uncapped contributions rather than the fixed 3-field US result shape — reuse the underlying "capped wage slice vs. year-to-date consumed base" primitive, don't duplicate it.
> - The existing generic progressive-bracket withholding calculator, called with Moroccan brackets/deduction inputs instead of US ones — no new calculator needed for IR.
> - The single orchestration function that all payroll-run code paths already funnel through for withholding should branch by the org's country rather than requiring changes at each call site.
> - Whatever produces payslip line items from the computed tax breakdown needs to actually populate them ... the payslip data shape and its rendering are already generic and don't need to change.

**Acceptance criteria (verbatim):**
- [ ] Running payroll for an employee at a Moroccan-configured org produces correct CNSS (capped) and AMO/allocations-familiales (uncapped) employee and employer amounts for a known gross salary, matching hand-calculated expected values at the rates above.
- [ ] The same run produces correct IR withholding for at least one case spanning more than one bracket, using the seeded Moroccan brackets and deductions.
- [ ] Existing US-org payroll runs are unaffected (same results as before this change).
- [ ] Generated payslips for both US and Moroccan orgs show their respective tax/contribution line items (closing the current gap where breakdown lines are computed but never surfaced).
- [ ] A runnable test (matching this repo's existing test convention) asserts the CNSS/AMO and IR figures above.
- [ ] `npx tsc --noEmit` passes.

**Out of scope (verbatim):**
> - Any Moroccan payroll settings UI ...
> - Moroccan tax-form/declaration generation ...
> - Treating the rates above as final — they must be verified against the primary DGI/CNSS source before this is used for real payroll; note this prominently in the PR description.

---

## 2. `lib/api/payroll-tax.ts` — the pure tax-math engine

Pure functions, no DB access (`lib/api/payroll-tax.ts:1-6`). All amounts integer cents; all rates basis points (10000bp = 100%).

### `computePeriodWithholding` — confirmed country-agnostic

Signature (`lib/api/payroll-tax.ts:37-66, 112-114`):
```ts
export interface ComputePeriodWithholdingInput {
  annualTaxableWage: number;
  brackets: MarginalBracket[];
  filingStatus?: string | null;
  payPeriodsPerYear: number;
  allowances?: number;
  allowanceValueCents?: number;
  standardDeductionCents?: number;
  additionalWithholding?: number;
}
export interface PeriodWithholdingResult {
  periodWithholding: number; // this period, cents, includes additionalWithholding
  annualTax: number;         // tentative full-year tax, cents
  taxableAfterDeductions: number; // annual wage after deduction+allowances, never negative
}
export function computePeriodWithholding(
  input: ComputePeriodWithholdingInput
): PeriodWithholdingResult
```
`MarginalBracket` (`lib/api/payroll-tax.ts:21-35`):
```ts
export interface MarginalBracket {
  minIncome: number;           // annual floor, cents, inclusive
  maxIncome?: number | null;   // annual ceiling, cents; null = no limit
  rate: number;                // basis points
  baseAmountCents?: number | null; // cumulative tax below minIncome; derived if omitted
}
```
Confirmed country-agnostic: nothing in `normalizeBrackets` (`:80-106`) or `computePeriodWithholding` (`:112-153`) references US-specific constants, jurisdictions, or bracket counts — it walks an arbitrary array of `{minIncome, maxIncome, rate, baseAmountCents}` rows, annualizes `periodWage × payPeriodsPerYear` (done by the caller, passed in as `annualTaxableWage`), subtracts `standardDeductionCents + allowances × allowanceValueCents`, then applies the single highest-reached marginal bracket plus its precomputed/derived base. `filingStatus` is accepted "for symmetry/logging" only (`:45`) — bracket *selection* by filing status is the caller's job (done in `payroll-withholding.ts`, see §3). This function needs **zero changes** to support Moroccan IR — it will be called with MA brackets/deductions instead of US ones, exactly as the issue states.

Moroccan-specific caveat for planning: IR's 35%-of-gross professional-expense deduction (25% beyond 78,000 MAD/year) is *not* a flat `standardDeductionCents` — it's a percentage-of-income deduction with its own bracket-dependent rate and a 35,000 MAD/year cap. `computePeriodWithholding`'s deduction inputs (`standardDeductionCents`, `allowances × allowanceValueCents`) are both flat cents amounts, not percentages. The 35%/25% professional-expense deduction and the 600 MAD/dependent deduction will each need to be **pre-computed by the caller** (in `computeEmployeeWithholding` or a new MA-specific helper) into a flat `standardDeductionCents`-equivalent number before calling `computePeriodWithholding` — the engine itself has no percentage-deduction concept.

### `computeFica` — US-specific, employee side

Signature (`lib/api/payroll-tax.ts:155-217`):
```ts
export interface ComputeFicaInput {
  periodWage: number; ytdWage: number;
  ssWageBaseCents: number; ssRateBp: number;
  medicareRateBp: number;
  addlMedicareThresholdCents: number; addlMedicareRateBp: number;
}
export interface FicaResult {
  socialSecurity: number; medicare: number; additionalMedicare: number; total: number;
}
export function computeFica(input: ComputeFicaInput): FicaResult
```
Fixed 3-component result shape, as the issue states. Internally, the SS cap logic is written out inline (`:196-201`), **not** via a shared helper:
```ts
const ssBase = Math.max(0, input.ssWageBaseCents);
const remainingSsRoom = Math.max(0, ssBase - ytdWage);
const ssTaxable = Math.min(periodWage, remainingSsRoom);
const socialSecurity = Math.round((ssTaxable * Math.max(0, input.ssRateBp)) / 10000);
```

### `computeEmployerTaxes` — US-specific, employer side

Signature (`lib/api/payroll-tax.ts:219-292`):
```ts
export interface ComputeEmployerTaxesInput {
  periodWage: number; ytdWage: number; employerFicaEnabled: boolean;
  ssWageBaseCents: number; ssRateBp: number; medicareRateBp: number;
  futaRateBp: number; futaWageBaseCents: number;
  sutaRateBp: number; sutaWageBaseCents: number;
}
export interface EmployerTaxResult {
  socialSecurity: number; medicare: number; futa: number; suta: number; total: number;
}
export function computeEmployerTaxes(input: ComputeEmployerTaxesInput): EmployerTaxResult
```
Fixed 4-component result shape. **This is where the "capped wage slice vs. YTD consumed base" primitive actually lives**, as a private local closure (`lib/api/payroll-tax.ts:272-277`):
```ts
const cappedTax = (wageBaseCents: number, rateBp: number): number => {
  const base = Math.max(0, wageBaseCents);
  const room = Math.max(0, base - ytdWage);
  const taxable = Math.min(periodWage, room);
  return Math.round((taxable * Math.max(0, rateBp)) / 10000);
};
```
It is used twice inside `computeEmployerTaxes` (for SS and, via the same shape, FUTA/SUTA at `:287-288`), and the *same logic* is duplicated by hand (not called as a shared function) inside `computeFica` for employee SS (`:196-201` above). **It is not exported and not a standalone module-level function** — it's an inline closure scoped to one call of `computeEmployerTaxes`, so nothing outside that function body can currently import/reuse it.

**Reusability for CNSS — important mismatch:** `cappedTax`'s model is *"annual wage base minus YTD wages consumed so far, this period's taxable slice is whatever room remains."* That model fits US Social Security/FUTA/SUTA, which are annual caps accumulated via YTD tracking across many pay periods in a year. Morocco's CNSS pension/CT/IPE ceiling is **6,000 MAD per month**, not an annual cap — for a monthly-paid employee each period simply caps at 6,000 MAD independent of YTD; there is no YTD accumulation concept for this cap at all (unlike the US wage bases, which are consumed once per year and then stay maxed out). If `payFrequency` is non-monthly (weekly/biweekly — see `payFrequencyEnum`, `lib/db/schema/payroll.ts:19-23`), the 6,000 MAD figure would need to be interpreted per pay period, not annualized/YTD-consumed the way `ssWageBaseCents` is. So the *shape* of `cappedTax(wageBaseCents, rateBp)` (cap a period wage against a wage base using `Math.min`/`Math.max`) is reusable as a primitive, but the *semantics* callers feed it (an annual base depleted by `ytdWage`) do not directly transfer to a recurring monthly cap — see §8 (Gaps).

### `payPeriodsPerYear`

`lib/api/payroll-tax.ts:294-305` — maps `payFrequency` string → periods/year: `"weekly"` → 52, `"biweekly"` → 26, `"monthly"` (default) → 12. Country-agnostic; reusable as-is for MA (monthly is Morocco's typical payroll cadence).

---

## 3. `lib/api/payroll-withholding.ts` — `computeEmployeeWithholding` orchestration

DB-aware orchestration layer (`:1-13`) that loads persisted tax config and calls the pure functions from §2.

### Line-item shapes (exact, `:38-61`)
```ts
export interface TaxBreakdownLine {
  jurisdictionLevel: "federal" | "state" | "local";
  jurisdiction: string | null;
  taxKind: string; // "income_tax" | "social_security" | "medicare" | "additional_medicare"
  amount: number; // cents
}
export interface EmployerTaxLine {
  jurisdictionLevel: "federal" | "state" | "local";
  jurisdiction: string | null;
  taxKind: string; // "employer_social_security" | "employer_medicare" | "futa" | "suta"
  amount: number; // cents
}
export interface EmployeeWithholding {
  totalTax: number;
  breakdown: TaxBreakdownLine[];
  employerBreakdown: EmployerTaxLine[];
}
```
**`taxKind` is a plain `string`, not a union/enum** — comments list the current US values as examples only. This means new MA-specific `taxKind` values (e.g. `"cnss_pension"`, `"cnss_amo"`, `"cnss_ct"`, `"cnss_ipe"`, `"cnss_allocations_familiales"`, `"employer_tfp"`) can be added without any type change to these interfaces.

### Signature (`:199-207`)
```ts
export async function computeEmployeeWithholding(
  organizationId: string,
  emp: EmployeeRow,                       // typeof payrollEmployee.$inferSelect
  settings: PayrollSettingsRow | undefined, // typeof payrollSettings.$inferSelect
  taxableIncome: number,                  // this period, cents
  ytdWage: number,                        // before this period, cents
  periodStart: string,
  exec: DbOrTx = db
): Promise<EmployeeWithholding>
```

### Current branching logic (exact, `:222-309`)
1. **Income tax** (`:222-266`): if employee not `exempt`, loads federal marginal brackets for `(organizationId, "federal", filingStatus, year)` via `loadBrackets` (`:118-160`, queries `taxBracket` filtered by `organizationId`, `jurisdictionLevel="federal"`, `isActive=true`, then filters in-memory by `filingStatus` (null = applies to all) and `taxYear`, falling back to year-agnostic rows). If brackets exist, calls `computePeriodWithholding` with `annualTaxableWage: taxableIncome * periods`. **If no brackets are configured for the org, falls back to the employee's flat `emp.taxRate` basis-points field** (`:252-256`) — "so we never silently withhold zero income tax for un-migrated orgs." Pushes one `income_tax` breakdown line if `> 0`.
2. **Employee FICA** (`:271-286`): only runs `if (settings && !exempt)` — calls `computeFica` with the org's `ssWageBaseCents`/`ssRateBp`/`medicareRateBp`/`addlMedicareThresholdCents`/`addlMedicareRateBp` straight off the `settings` row, pushes up to 3 breakdown lines (`social_security`, `medicare`, `additional_medicare`), each only if `> 0`.
3. **Employer taxes** (`:288-308`): same `if (settings && !exempt)` guard, calls `computeEmployerTaxes` with the org's FICA/FUTA/SUTA settings fields, pushes up to 4 `employerBreakdown` lines.
4. `totalTax` = sum of employee `breakdown` amounts only (`:311`) — employer amounts never touch the employee's tax total, matching the doc comment "Employer taxes are NOT deducted from the employee."

**There is currently no country branch at all** — steps 2–3 unconditionally use FICA-shaped settings fields whenever a `settings` row exists at all, regardless of country. Any Morocco branch has to intercept before step 2/3 (or replace them) based on `settings.country` (or whatever the new column is named).

### Call sites (exact, via grep)
| File:line | Context |
|---|---|
| `app/api/v1/payroll/runs/route.ts:304` | Regular payroll-run creation loop, per employee item |
| `app/api/v1/payroll/runs/bonus-only/route.ts:99` | Bonus-only run, per employee (bonus gross, no pre-tax deductions) |
| `app/api/v1/payroll/runs/termination/route.ts:85` | Termination run, once on combined final-pay gross |
| `lib/mcp/tools/payroll.ts:438` | MCP tool equivalent of the regular-run creation path |

All four call sites pass the same 6 positional args and only consume `.totalTax`, `.breakdown`, `.employerBreakdown` generically (they iterate/sum, never branch on specific `taxKind` values) — confirming the issue's claim that a single internal branch inside `computeEmployeeWithholding` is sufficient; **no call site needs to change**.

---

## 4. `lib/db/schema/payroll.ts` — schema shapes

### `payrollSettings` (exact, `:172-212`) — one row per organization
```ts
export const payrollSettings = pgTable("payroll_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().unique()
    .references(() => organization.id, { onDelete: "cascade" }),
  defaultTaxRate: integer("default_tax_rate").notNull().default(2000), // bp
  overtimeThresholdHours: real("overtime_threshold_hours").notNull().default(40),
  overtimeMultiplier: real("overtime_multiplier").notNull().default(1.5),
  defaultCurrency: text("default_currency").notNull().default("USD"),
  salaryExpenseAccountCode: text("salary_expense_account_code").default("5100"),
  taxPayableAccountCode: text("tax_payable_account_code").default("2200"),
  bankAccountCode: text("bank_account_code").default("1100"),
  autoApprovalEnabled: boolean("auto_approval_enabled").notNull().default(false),
  ssWageBaseCents: integer("ss_wage_base_cents").notNull().default(16810000), // $168,100
  ssRateBp: integer("ss_rate_bp").notNull().default(620),        // 6.2%
  medicareRateBp: integer("medicare_rate_bp").notNull().default(145), // 1.45%
  addlMedicareThresholdCents: integer("addl_medicare_threshold_cents").notNull().default(20000000), // $200k
  addlMedicareRateBp: integer("addl_medicare_rate_bp").notNull().default(90), // 0.9%
  employerFicaEnabled: boolean("employer_fica_enabled").notNull().default(true),
  futaRateBp: integer("futa_rate_bp").notNull().default(60),     // 0.6%
  futaWageBaseCents: integer("futa_wage_base_cents").notNull().default(70000), // $7,000
  sutaRateBp: integer("suta_rate_bp").notNull().default(0),
  sutaWageBaseCents: integer("suta_wage_base_cents").notNull().default(0),
  defaultTaxYear: integer("default_tax_year"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const payrollSettingsRelations = relations(payrollSettings, ({ one }) => ({
  organization: one(organization, {
    fields: [payrollSettings.organizationId],
    references: [organization.id],
  }),
}));
```
**Confirmed one-row-per-org**: `organizationId` carries both `.notNull()` and `.unique()` (`:174-177`), with a `references(() => organization.id, { onDelete: "cascade" })` FK, and the `payrollSettingsRelations` `one(...)` relation (`:795-800`) matches. There is **no `country` column today** — the issue's plan to add one is confirmed necessary. No CNSS/AMO/TFP columns exist either.

**Note on redundancy** — the `organization` table (`lib/db/schema/auth.ts`) already carries two country-shaped fields:
- `country: text("country")` (`auth.ts:119`)
- `countryCode: text("country_code")` (`auth.ts:126`, added for "bookkeeping compliance")

`countryCode` is already actively used for country-conditional behavior in Phase 1's `getControlCodesForOrg` (`lib/api/control-account-codes.ts:71-77`, queries `organization.countryCode` and already has an `"MA"` entry at `control-account-codes.ts:56`). See §8 for whether `payrollSettings` should get its own independent `country` column (as the issue specifies) vs. deriving from `organization.countryCode`.

### `taxBracket` (exact, `:588-611`)
```ts
export const taxBracket = pgTable("tax_bracket", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  jurisdictionLevel: taxJurisdictionLevelEnum("jurisdiction_level").notNull().default("federal"), // "federal"|"state"|"local"
  jurisdiction: text("jurisdiction"),        // e.g. "CA", "NY"
  filingStatus: filingStatusEnum("filing_status"), // null = all statuses; "single"|"married_joint"|"married_separate"|"head_of_household"
  taxYear: integer("tax_year"),              // null = any year
  minIncome: integer("min_income").notNull(),  // cents, annual, floor
  maxIncome: integer("max_income"),            // cents, null = no limit
  rate: integer("rate").notNull(),             // basis points
  baseAmountCents: integer("base_amount_cents"), // null = derive from lower brackets
  standardDeductionCents: integer("standard_deduction_cents"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
});
```
**Scoping: by `organizationId` + `jurisdictionLevel` + optional `jurisdiction`/`filingStatus`/`taxYear`.** No country column, and none is needed for correctness *within a single org* — `loadBrackets` (`payroll-withholding.ts:118-160`) always filters by `organizationId` first, so as long as a Moroccan org's `taxBracket` rows are scoped to that org's `organizationId` with `jurisdictionLevel: "federal"`, they will never collide with a US org's federal brackets (different orgs, different rows). **No new discriminator column is required on `taxBracket` to seed Moroccan IR brackets** — they slot in as ordinary rows for the MA org(s), using `filingStatus: null` (issue's brackets aren't filing-status-split) and `taxYear: 2026`. See §8 for the one real ambiguity (how `computeEmployeeWithholding` picks which org's brackets are "Moroccan" — it already does, implicitly, via `organizationId`).

### `payrollItemTaxBreakdown` / `payrollItemEmployerTax` (exact, `:633-660`) — already persisted correctly today
```ts
export const payrollItemTaxBreakdown = pgTable("payroll_item_tax_breakdown", {
  id: uuid("id").primaryKey().defaultRandom(),
  payrollItemId: uuid("payroll_item_id").notNull()
    .references(() => payrollItem.id, { onDelete: "cascade" }),
  jurisdictionLevel: taxJurisdictionLevelEnum("jurisdiction_level").notNull().default("federal"),
  jurisdiction: text("jurisdiction"),
  taxKind: text("tax_kind").notNull(),
  amount: integer("amount").notNull(), // cents withheld this period
});
// payrollItemEmployerTax is identical in shape, for the employer side.
```
Confirmed (`app/api/v1/payroll/runs/route.ts:404-416`) that when a payroll run is *created*, `computeEmployeeWithholding`'s `breakdown`/`employerBreakdown` **are** correctly inserted into these two tables, one row per line, keyed by the newly-inserted `payrollItem.id`:
```ts
items.forEach((item, idx) => {
  const payrollItemId = insertedItems[idx].id;
  for (const line of item.taxBreakdown) taxRows.push({ payrollItemId, ...line });
  for (const line of item.employerTaxBreakdown) employerRows.push({ payrollItemId, ...line });
});
if (taxRows.length > 0) await tx.insert(payrollItemTaxBreakdown).values(taxRows);
if (employerRows.length > 0) await tx.insert(payrollItemEmployerTax).values(employerRows);
```
**The data is not lost at run-creation time** — the bug (§6) is specifically that payslip *generation* never reads these two tables back out.

### `payslip` (exact, `:734-756`)
```ts
export const payslip = pgTable("payslip", {
  id: uuid("id").primaryKey().defaultRandom(),
  payrollRunId: uuid("payroll_run_id").notNull().references(() => payrollRun.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").notNull().references(() => payrollEmployee.id),
  payrollItemId: uuid("payroll_item_id").notNull().references(() => payrollItem.id),
  status: payslipStatusEnum("status").notNull().default("generated"),
  grossAmount: integer("gross_amount").notNull(),
  netAmount: integer("net_amount").notNull(),
  taxAmount: integer("tax_amount").notNull(),
  deductionsBreakdown: jsonb("deductions_breakdown"), // [{name, amount, category}]
  ytdGross: integer("ytd_gross").notNull().default(0),
  ytdNet: integer("ytd_net").notNull().default(0),
  ytdTax: integer("ytd_tax").notNull().default(0),
  generatedAt: timestamp("generated_at", { mode: "date" }).defaultNow().notNull(),
  sentAt: timestamp("sent_at", { mode: "date" }),
  viewedAt: timestamp("viewed_at", { mode: "date" }),
});
```
Column comment declares the intended shape `[{name, amount, category}]` — **note this does NOT match `TaxBreakdownLine`'s shape** (`{jurisdictionLevel, jurisdiction, taxKind, amount}`); a mapping step is required, not a raw copy (see §6, §8).

---

## 5. `app/api/v1/payroll/runs/[id]/generate-payslips/route.ts` — the bug

Full current file is 75 lines (`app/api/v1/payroll/runs/[id]/generate-payslips/route.ts:1-75`). The relevant loop:
```ts
for (const item of run.items) {
  const [ytd] = await db.select({ ... }).from(payrollItem)...; // YTD gross/net/tax only

  payslips.push({
    payrollRunId: run.id,
    employeeId: item.employeeId,
    payrollItemId: item.id,
    grossAmount: item.grossAmount,
    netAmount: item.netAmount,
    taxAmount: item.taxAmount,
    deductionsBreakdown: [],        // ← line 58: hardcoded empty, for every country
    ytdGross: ytd?.ytdGross || 0,
    ytdNet: ytd?.ytdNet || 0,
    ytdTax: ytd?.ytdTax || 0,
  });
}
if (payslips.length > 0) await db.insert(payslip).values(payslips);
```
`deductionsBreakdown: []` at **line 58** is the exact bug location. The route never queries `payrollItemTaxBreakdown` (or `payrollItemEmployerTax`, or `payrollItemDeduction`) at all — it only re-aggregates `payrollItem.grossAmount/netAmount/taxAmount` for YTD totals. The per-jurisdiction/per-kind lines inserted at run-creation time (§4) are simply never read back.

**Second, independent copy of the same bug**: `lib/mcp/tools/payroll.ts`'s `generate_payslips` MCP tool (`:604-658`) is a near-identical duplicate of this route and has the exact same `deductionsBreakdown: []` at `lib/mcp/tools/payroll.ts:650`. Both call sites need the fix, or the fix needs to be extracted into one shared function both call.

**Dead code already shaped for the fix**: `lib/payroll/payslip-generator.ts` defines a `buildPayslipData()` helper (`:32-46`) with exactly the JSDoc-promised `{name, amount, category}[]` shape:
```ts
interface PayslipInput {
  employeeId: string; grossAmount: number; netAmount: number; taxAmount: number;
  deductions: { name: string; amount: number; category: string }[];
}
export interface PayslipData {
  employeeId: string; grossAmount: number; netAmount: number; taxAmount: number;
  deductionsBreakdown: { name: string; amount: number; category: string }[];
  ytdGross: number; ytdNet: number; ytdTax: number;
}
export function buildPayslipData(input: PayslipInput, ytd: YtdValues): PayslipData { ... }
```
Confirmed via grep (`buildPayslipData` and `payslip-generator` only appear in that one file — `:32`) that **this helper is never imported or called anywhere in the codebase**. It's dead code that predates (or was written in anticipation of, but disconnected from) both the REST route and the MCP tool.

**UI consumer** (`app/(dashboard)/payroll/runs/[id]/payslips/page.tsx:27-31, 268-293`) already expects and renders the `{name, amount, category}` shape:
```ts
interface DeductionLine { name?: string; amount?: number; category?: string; }
// ...
{ps.deductionsBreakdown.map((d, i) => (
  <div key={i} className="flex items-center justify-between px-3 py-2">
    <span className="text-xs capitalize">{d.name || d.category || "Deduction"}</span>
    <span className="text-xs font-mono tabular-nums">{formatMoney(d.amount || 0)}</span>
  </div>
))}
```
So the rendering side is generic and needs no changes (matches the issue's claim) — the fix is purely: query `payrollItemTaxBreakdown` (mapping `taxKind` → `name`, `amount` → `amount`, and something → `category`, e.g. `"tax"` or the `jurisdictionLevel`) per `payrollItemId`, and insert that into `deductionsBreakdown` instead of `[]`. Whether employer-side (`payrollItemEmployerTax`) and pre/post-tax deduction rows (`payrollItemDeduction`, which has its own `{name via deductionType, amount, category}` shape already used elsewhere — see `app/api/v1/payroll/tax-forms/generate/route.ts:160-175`) should also be folded into `deductionsBreakdown`, or just the employee tax breakdown, is a decision — see §8.

---

## 6. Migration conventions

Current migrations in `drizzle/` (5 files, sequential): `0000_baseline.sql`, `0001_parity_build.sql`, `0002_old_nightcrawler.sql`, `0003_same_frog_thor.sql`, `0004_faithful_paper_doll.sql`. `drizzle/meta/_journal.json`'s last entry: `{idx: 4, version: "7", tag: "0004_faithful_paper_doll", breakpoints: true}`.

**Filename pattern**: `NNNN_<random-two-word-slug>.sql`, zero-padded 4-digit sequence number, slug auto-generated by `drizzle-kit generate` (adjective_noun, e.g. `faithful_paper_doll`, `same_frog_thor`) — not hand-named, not descriptive of content.

**SQL style**, from the most recent additive migration (`drizzle/0003_same_frog_thor.sql`, full contents):
```sql
CREATE TYPE "public"."invoice_type" AS ENUM('standard', 'deposit', 'retainer');--> statement-breakpoint
ALTER TYPE "public"."invoice_status" ADD VALUE 'pending_approval';--> statement-breakpoint
ALTER TYPE "public"."invoice_status" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "onboarding_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "invoice_type" "invoice_type" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "deposit_percent" integer;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "dunning_level" integer DEFAULT 0 NOT NULL;
```
Pattern for a new nullable/defaulted column: `ALTER TABLE "table_name" ADD COLUMN "column_name" <type> [DEFAULT '<value>'] [NOT NULL];--> statement-breakpoint` (every statement except the last ends with `--> statement-breakpoint`, drizzle-kit's marker for splitting multi-statement migrations). Confirms the exact form a new `payroll_settings` migration would take, e.g.:
```sql
ALTER TABLE "payroll_settings" ADD COLUMN "country" text DEFAULT 'US' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD COLUMN "cnss_pension_employee_rate_bp" integer DEFAULT 396 NOT NULL;--> statement-breakpoint
...
```
Command to generate: `npx drizzle-kit generate` (also aliased as `npm run db:generate`, `package.json:14`), reading `schema: "./lib/db/schema/index.ts"` per `drizzle.config.ts`, output to `./drizzle`. Per project CLAUDE.md: **never** use `drizzle-kit push`; the generated `.sql` file must be committed alongside the schema change.

---

## 7. Test conventions

`package.json`'s `"test"` script (confirmed, `package.json:13`): `node --import tsx --test tests/*.test.ts` — **Node's built-in `node:test` + `node:assert/strict`**, no Jest/Vitest/Mocha. No existing payroll- or tax-specific test file (`grep -rl "payroll\|tax" tests/*.test.ts` → no hits); the issue's planned `tests/payroll-tax-ma.test.ts` would be the first.

`tests/control-account-codes.test.ts` (full contents, 38 lines) is the best model — it tests exactly the kind of pure, country-keyed function this issue needs (`getControlCodes` from `lib/api/control-account-codes.ts`, §4's redundancy note):
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { getControlCodes } from "../lib/api/control-account-codes";

test("getControlCodes falls back to generic codes for US and unmapped countries", () => {
  for (const cc of [null, undefined, "US", "GB", "ZZ"]) {
    const codes = getControlCodes(cc);
    assert.equal(codes.ar, "1200");
    assert.equal(codes.ap, "2100");
    assert.equal(codes.outputVat, "2200");
    assert.equal(codes.inputVat, "1500");
  }
});

test("getControlCodes returns MA's real PCGE codes", () => {
  const codes = getControlCodes("ma");
  assert.equal(codes.ar, "3421");
  assert.equal(codes.ap, "4411");
  assert.equal(codes.outputVat, "4455");
  assert.equal(codes.inputVat, "3455");
});
// ...
```
Conventions to match: plain `test(name, () => {...})` blocks (no `describe`), `assert.equal`/`assert.deepEqual` from `node:assert/strict`, relative `../lib/...` imports (no `@/` alias inside `tests/`), one file per subsystem, lowercase-hyphenated filename matching the module under test. Since `computeCnss`/`computeAmo` (planned, pure functions in `payroll-tax.ts`) and `computeEmployeeWithholding`'s MA branch (DB-aware, in `payroll-withholding.ts`) sit in different layers, `tests/payroll-tax-ma.test.ts` will likely need to either import the DB-touching orchestration function (requiring a DB connection / seeded `taxBracket` rows for a test org) or test the pure `computeCnss`/`computeAmo`/`computePeriodWithholding`-with-MA-brackets pieces in isolation and leave the DB-wired integration untested at this layer — worth deciding (§8). No existing test in this repo exercises `computeFica`/`computeEmployerTaxes`/`computePeriodWithholding` today (no `payroll-tax.test.ts` exists), so there's no established precedent for whether DB access is mocked, uses a real test DB, or is avoided by testing pure functions only.

---

## 8. Gaps / decisions needed

1. **New `payrollSettings` column names, types, defaults.** The issue only says "a `country` field (default `US`) plus CNSS/AMO/TFP rate columns." Concretely, matching the existing column-naming convention (`ssRateBp`, `ssWageBaseCents`, etc. — always `<thing>RateBp` for basis-point rates, `<thing>Cents` for cent amounts) and the 6 employee + 6 employer sub-components named in the issue, something like:
   - `country: text("country").notNull().default("US")` — or possibly `countryCode` to match `organization.countryCode`'s naming (see point 2).
   - Employee side: `cnssPensionEmployeeRateBp` (396), `cnssAmoEmployeeRateBp` (226), `cnssCtEmployeeRateBp` (33), `cnssIpeEmployeeRateBp` (19).
   - Employer side: `cnssAllocationsFamilialesRateBp` (640), `cnssPensionEmployerRateBp` (793), `cnssAmoEmployerRateBp` (411), `cnssTfpRateBp` (160), `cnssCtEmployerRateBp` (67), `cnssIpeEmployerRateBp` (38).
   - The 6,000 MAD/month ceiling: `cnssMonthlyCeilingCents` (600000) — a single shared cap for pension/CT/IPE, per the issue.
   This is a naming decision, not a research fact — flagging so the implementation plan picks exact names before generating the migration (renaming later means a second migration).

2. **Redundant country signal**: `organization.country` (`auth.ts:119`) and `organization.countryCode` (`auth.ts:126`, already used by Phase 1's `getControlCodesForOrg`) already exist at the org level, and Phase 1 already has an `"MA"` entry keyed off `countryCode`. The issue explicitly wants a *separate* `payrollSettings.country` column rather than reading `organization.countryCode`. Decide: (a) truly independent column (org could theoretically want a different payroll-country than invoicing-country — e.g., a US-HQ'd org with all-Moroccan payroll), seeded from `organization.countryCode` only as a UI/onboarding default, or (b) drop the new column and have `computeEmployeeWithholding` join to `organization.countryCode` directly, avoiding a second source of truth that can drift. The issue text is explicit enough ("no notion of which country's payroll rules apply to this org anywhere in the schema") that (a) — a dedicated column — appears to be the intended design; worth confirming this reading before implementation, since it does create two country fields that could disagree.

3. **The capped-wage-slice primitive is not currently reusable as an imported function.** It exists only as (i) a private closure `cappedTax` inside `computeEmployerTaxes` (`payroll-tax.ts:272-277`) and (ii) hand-duplicated inline logic for SS inside `computeFica` (`:196-201`). To satisfy the issue's explicit instruction ("reuse the underlying primitive, don't duplicate it"), it needs to become a **module-level exported function** in `payroll-tax.ts` (e.g. `export function cappedWageSlice(periodWage: number, ytdWage: number, wageBaseCents: number, rateBp: number): number`), then `computeFica`, `computeEmployerTaxes`, and the new `computeCnss`/`computeAmo` would all call it. This is a small refactor of existing US code, not purely additive — worth flagging since the issue frames it as "reuse," but the current code has nothing to reuse without first extracting it.

4. **The extracted primitive's YTD-consumed-annual-base semantics don't map cleanly onto Morocco's monthly cap.** `cappedTax`/`computeFica`'s model consumes an *annual* wage base via `ytdWage` carried across pay periods within the year (`room = annualBase - ytdWage`). CNSS's 6,000 MAD ceiling is *per month*, resetting every period regardless of YTD — for a monthly-paid employee this collapses to a trivial `Math.min(periodWage, 600000)` with no YTD input needed at all, and for non-monthly pay frequencies (weekly/biweekly — `payFrequencyEnum`, `payroll.ts:19-23`) it's unclear from the issue whether the 6,000 MAD cap should be prorated per period or applied as a genuine monthly rolling cap requiring within-month YTD tracking (a different accumulation window than the existing annual `getEmployeeYtdWage`, `payroll-withholding.ts:69-111`, which sums by calendar year). Given the issue's examples and acceptance criteria only mention a single "known gross salary" test (implying monthly pay, single period), this ambiguity may not block a first implementation, but should be called out explicitly rather than silently assumed. Two shapes are possible for `cappedWageSlice`: keep the existing `(periodWage, ytdWage, wageBaseCents, rateBp)` signature and pass `ytdWage: 0, wageBaseCents: monthlyCeilingCents` for CNSS each period (works correctly for monthly pay, degrades to "prorated-away" for other frequencies since a fresh 6,000 MAD room re-opens every period regardless of prior periods this month), or add a genuinely separate simpler helper for period-only caps. Recommend the plan pick one explicitly.

5. **`computeEmployeeWithholding`'s branch point and return-shape stability.** The function already returns `breakdown: TaxBreakdownLine[]` / `employerBreakdown: EmployerTaxLine[]` with `taxKind: string` (not a union), so **no interface change is structurally required** to carry Morocco's ~10 CNSS/AMO/TFP lines plus IR — confirmed in §3. The open decision is only *where* the country branch goes: replace steps 2–3 (current unconditional FICA/employer-tax block, `:271-309`) with an `if (settings?.country === "MA") { ...cnss/amo... } else if (settings) { ...existing fica/employer... }`, and whether step 1 (income tax) needs any MA-specific pre-processing before calling `computePeriodWithholding` (the 35%/25% professional-expense deduction and 600 MAD/dependent deduction both need to be computed into a single `standardDeductionCents`-equivalent number first — see §2 — since neither is natively expressible in `ComputePeriodWithholdingInput`). Where the professional-expense/dependent-deduction math itself should live (inlined in `computeEmployeeWithholding`'s MA branch vs. a new small exported helper in `payroll-tax.ts` alongside `computeCnss`/`computeAmo`) is undecided; the latter keeps `payroll-tax.ts` as the single home for all pure MA math, consistent with how `computeFica`/`computeEmployerTaxes` are pure and DB-agnostic today.

6. **`taxBracket` needs no new discriminator column** — confirmed in §4, rows are already scoped by `organizationId` (+ `jurisdictionLevel`/`filingStatus`/`taxYear`), so Moroccan IR brackets are just ordinary rows for MA-configured orgs. The only decision is **how/where they get seeded** — presumably a script or migration-adjacent seed (not itself a schema migration) that inserts 6 rows (`jurisdictionLevel: "federal"`, `filingStatus: null`, `taxYear: 2026`, `minIncome`/`rate` per the issue's bracket table) for a given `organizationId`, and *when* that seeding happens (on org creation when `country === "MA"` is selected, via a manual admin action, or only in the test fixture) — the issue's "Not doing" section rules out a settings UI, so there's currently no UI path that would trigger this seeding for a real org; worth flagging as a real usability gap even though it's explicitly out of scope for *this* issue (someone will need a way to get MA `taxBracket` rows into a real org's data, whether that's a seed script, a future admin UI, or a one-time support action).

7. **`deductionsBreakdown` mapping and scope.** The JSON shape needed (`{name, amount, category}[]`, confirmed by both the `payslip` column comment and the UI consumer in §5) does not match `TaxBreakdownLine`'s shape (`{jurisdictionLevel, jurisdiction, taxKind, amount}`) or `payrollItemDeduction`'s shape (`{deductionTypeId, amount, category}`, needs a join to `deductionType` for `name` — see the existing join pattern at `app/api/v1/payroll/tax-forms/generate/route.ts:160-175`). Decisions needed: (a) map `taxKind` → `name` verbatim (e.g. `"cnss_pension"` shown as-is) or humanize it (e.g. `"CNSS - Retraite"`) — the UI's fallback `d.name || d.category || "Deduction"` (page.tsx:284) suggests raw `taxKind` strings would render acceptably but not prettily; (b) what value fills `category` — candidates are a constant like `"tax"`, or `jurisdictionLevel`, or a new grouping the issue doesn't specify; (c) whether `deductionsBreakdown` should include **only** the employee `payrollItemTaxBreakdown` rows (income tax + CNSS/AMO employee side), or also fold in `payrollItemDeduction` (pre/post-tax deductions like 401k/benefits) which currently has zero payslip surfacing either — the issue's acceptance criteria only mentions "tax/contribution line items," suggesting `payrollItemTaxBreakdown` alone may be sufficient scope, leaving `payrollItemDeduction` a separate (currently also-broken, but out-of-scope-per-issue-wording) gap; (d) whether to also fix the dead `buildPayslipData()` helper by wiring it in (making it the single mapping function both `generate-payslips/route.ts` and `lib/mcp/tools/payroll.ts`'s `generate_payslips` tool call), versus leaving it dead and duplicating the query/mapping logic in both places as today.

8. **Two independent copies of the payslip-generation bug.** Both `app/api/v1/payroll/runs/[id]/generate-payslips/route.ts:58` (REST) and `lib/mcp/tools/payroll.ts:650` (MCP tool) hardcode `deductionsBreakdown: []` with near-duplicate surrounding logic (YTD query, payslip-row construction). Per this repo's CLAUDE.md ("Keep MCP tools updated when REST API routes change"), both need the fix; whether that's done by extracting one shared function (e.g. into `lib/payroll/payslip-generator.ts`, replacing/completing the currently-dead `buildPayslipData`) or by independently patching both call sites is an implementation decision, but leaving only one fixed would violate the acceptance criteria ("Generated payslips for both US and Moroccan orgs show their respective tax/contribution line items") if a user exercises the MCP path.

9. **Test-layer decision** (expanded from §7): the issue's planned `tests/payroll-tax-ma.test.ts` needs to decide whether it tests pure MA math only (`computeCnss`, `computeAmo`, `computePeriodWithholding` fed MA brackets/deductions directly — no DB, matching every existing `tests/*.test.ts` file's style, all of which import pure functions with zero DB dependency) or also exercises `computeEmployeeWithholding`'s new MA branch end-to-end (which requires `db` access, seeded `taxBracket`/`payrollSettings` rows for a test org, and is a heavier test than anything currently in `tests/`). Given every existing test file in this repo tests pure, DB-free functions, the lower-friction and convention-matching choice is likely pure-function-only coverage of `computeCnss`/`computeAmo`/(MA-bracket-fed)`computePeriodWithholding`, with the DB-wired orchestration branch left to manual/integration verification — but this should be an explicit choice in the plan, not a default.

10. **§4's out-of-scope W-2 call site still reads `settings.ssWageBaseCents` unconditionally.** `app/api/v1/payroll/tax-forms/generate/route.ts:119` (`const ssWageBase = settings?.ssWageBaseCents ?? 16810000;`) only runs inside the `formType === "w2"` branch, which is a US-specific document type a Moroccan org would have no reason to request — so no code change is likely needed here, but it's the one other call site in the codebase (besides `payroll-tax.ts`/`payroll-withholding.ts` themselves) that reads a FICA-shaped `payrollSettings` column, confirmed via a full-codebase grep for every US-rate-column name (`ssRateBp|ssWageBaseCents|medicareRateBp|futaRateBp|sutaRateBp|addlMedicareRateBp|addlMedicareThresholdCents|employerFicaEnabled|futaWageBaseCents|sutaWageBaseCents`) — no other files besides `payroll-tax.ts`, `payroll-withholding.ts`, `lib/db/schema/payroll.ts`, and this one W-2 route reference any of them. Confirms the issue's "not doing tax-form generation" scope cut is safe to leave untouched.
