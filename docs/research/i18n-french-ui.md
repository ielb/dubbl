# Research: Phase 2 — French UI (i18n infrastructure + core slice)

Source issue: `gh issue view 3 --repo ielb/dubbl`. This doc is research only — no implementation plan.

---

## 1. Issue scope (from the fetched issue body + AI triage comment)

**Title:** Phase 2: French UI (i18n infrastructure + core slice)
**Part of:** the Moroccan market adaptation epic (follows on from the currency/country-picker work already merged — see recent PRs #7/#9/#11 on `master`).

### Goal
Introduce i18n infrastructure and ship a real French-translated slice of the UI. **Arabic/RTL is explicitly out of scope** for this whole epic (separate future effort — the triage comment notes ~894 physical-direction Tailwind classes would need auditing to logical equivalents).

### Decided approach (stated directly in the issue body)
`next-intl` in **no-URL-prefix mode** — locale resolved from a `NEXT_LOCALE` cookie, **no** `app/[locale]/...` restructuring. Rationale given in the issue: API routes, `.well-known` OAuth metadata, and public token routes (`/pay`, `/portal`, `/sign`) must stay outside any locale segment, and the dashboard doesn't need localized URLs. The issue explicitly states: *"No existing `middleware.ts` to conflict with."*

### Subtasks (issue checklist, verbatim)
- [ ] Install `next-intl`, wrap `next.config.ts`'s `withMDX` with `createNextIntlPlugin()`
- [ ] `i18n/request.ts` — `getRequestConfig` reads locale from the `NEXT_LOCALE` cookie (default `en`)
- [ ] `app/layout.tsx` — dynamic `lang`, wrap children in `NextIntlClientProvider` (outermost, inside `<body>`, so `Toaster` gets translated strings too)
- [ ] Seed `messages/en.json` + `messages/fr.json`
- [ ] Add a locale toggle (account menu or settings) that sets the `NEXT_LOCALE` cookie
- [ ] Translate a core slice into `useTranslations`: dashboard shell/sidebar nav, dashboard home, org settings (incl. the Morocco country picker), sign-in/sign-up, shared UI strings/toasts

### Explicitly not doing (issue body + triage comment)
- Full string extraction across the other ~200 dashboard files (invoices, payroll, CRM, inventory, projects, report pages) — stays English until touched; convert opportunistically later with the same pattern.
- Arabic/RTL support.
- Persisting locale preference to a user/organization DB record — a cookie is sufficient for now.

### Acceptance criteria (from the AI triage comment, which elaborates the issue body)
- Switching the locale control renders primary nav, dashboard home, org settings, and sign-in/sign-up in French; switching back renders English.
- Pages outside the translated slice remain English regardless of locale (expected, not a regression).
- API routes, OAuth discovery endpoints, and public token-based links are unaffected by locale selection — no locale segment in their URLs, behavior unchanged.
- Locale choice persists across a full page reload (cookie-based).
- `npx tsc --noEmit` passes.

### Verification (issue body)
`npx tsc --noEmit`; manually toggle locale in dev and confirm the translated slice renders in French while untouched pages stay English (expected, not a bug). No mention of automated tests being required.

---

## 2. next-intl no-prefix setup requirements (primary sources)

Fetched via `next-intl.dev` docs (WebFetch) and cross-checked against the **official example app** in the `amannn/next-intl` GitHub repo at `examples/example-app-router-without-i18n-routing` (fetched via `gh api` / raw.githubusercontent.com, next-intl version pinned there: `^4.0.0`). The GitHub example is the more authoritative/concrete source since it's runnable code rather than paraphrased docs, and it directly matches this issue's approach (the issue's own subtask list reads like a paraphrase of this example).

### `next.config.ts` composition
Official example (`examples/example-app-router-without-i18n-routing/next.config.ts`):
```ts
import {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const config: NextConfig = {};
export default withNextIntl(config);
```
Source: `createNextIntlPlugin` (`packages/next-intl/src/plugin/createNextIntlPlugin.tsx` in the next-intl repo) is a higher-order function — `createNextIntlPlugin(pathOrConfig?)` returns `withNextIntl(nextConfig?) => NextConfig`. Internally (`getNextConfig.tsx`) it resolves the `i18n/request.ts` file path (checking `./i18n/request.{ts,tsx,js,jsx}` then `./src/i18n/request.*` by default) and adds a webpack/turbopack **alias** so `next-intl/config` resolves to that file, plus optional experimental extraction/watch behavior. It does not delete or overwrite arbitrary `NextConfig` keys, so composing with another config-mutating HOC (like fumadocs' `createMDX()`) is additive — apply `withNextIntl` as the outermost wrapper around the already-`withMDX`-wrapped config, i.e. `withNextIntl(withMDX(nextConfig))`, matching how the official examples always apply `createNextIntlPlugin()` last/outermost.

It also warns if `nextConfig.i18n` (the legacy Pages Router i18n key) is set — not relevant here, this repo has no such key (`next.config.ts` full current content is only `{ output: "standalone" }`, see §3.1).

### `i18n/request.ts`
Official example (`src/i18n/request.ts`):
```ts
import {getRequestConfig} from 'next-intl/server';
import {cookies} from 'next/headers';

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = store.get('locale')?.value || 'en';
  const messages = (await import(`../../messages/${locale}.json`)).default;

  return {
    locale,
    messages
  };
});
```
Since this repo has no `src/` directory (confirmed — see §3.6), the file should live at repo-root `i18n/request.ts` (next-intl's default resolution checks that path first). The issue's cookie name is `NEXT_LOCALE` rather than the example's `locale` — see §4 for why that's actually the more correct choice.

### Is `middleware.ts` required in no-prefix/cookie mode?
**No.** Confirmed two ways:
1. The official `example-app-router-without-i18n-routing` repo directory has **no `middleware.ts` file at all** (full file listing: `.gitignore`, `README.md`, `eslint.config.mjs`, `messages/`, `next-env.d.ts`, `next.config.ts`, `package.json`, `src/`, `tsconfig.json`).
2. `next-intl`'s middleware (`next-intl/middleware`) is purely for **routing mode** — negotiating/rewriting the `[locale]` URL segment, `Accept-Language` header detection, and setting the locale cookie automatically on prefix-based navigation. None of that applies when there's no `[locale]` segment to negotiate. The `next-intl.dev/docs/routing/middleware` page only discusses middleware in the context of routing/prefix strategies and static export; it never states an opt-out for no-routing mode because the whole page presumes routing is in use.

Locale switching without middleware is done via a **Server Action that sets the cookie directly**, wired up in the root layout (see next section) and invoked from a client "LocaleSwitcher" component — not via middleware.

### `NextIntlClientProvider` in the root layout
Official example (`src/app/layout.tsx`, trimmed to the relevant parts):
```tsx
import {Locale, NextIntlClientProvider} from 'next-intl';
import {getLocale, getTranslations} from 'next-intl/server';
import {cookies} from 'next/headers';

export default async function LocaleLayout({children}: LayoutProps<'/'>) {
  const locale = await getLocale();

  async function changeLocaleAction(locale: Locale) {
    'use server';
    const store = await cookies();
    store.set('locale', locale);
  }

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          {children}
          <LocaleSwitcher changeLocaleAction={changeLocaleAction} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```
Key facts:
- `RootLayout` must become an **async Server Component** (it already effectively is one here — no `"use client"` in the current `app/layout.tsx`, see §3.2).
- `NextIntlClientProvider` needs **no explicit `locale`/`messages` props** when rendered from a Server Component — per `next-intl.dev/docs/usage/configuration`: *"These props are inherited if you're rendering `NextIntlClientProvider` from a Server Component"* (locale, messages, `now`, `timeZone`, `formats` all flow automatically from `i18n/request.ts`'s `getRequestConfig` return value via React's server/client boundary serialization). Only `onError`/`getMessageFallback` are NOT inherited and would need to be set explicitly if customized — not required for this issue's scope.
- `<html lang={locale}>` — the issue's own subtask ("dynamic `lang`") matches this: replace the hardcoded `lang="en"` (repo currently has this — see §3.2) with `lang={locale}` where `locale = await getLocale()`.
- The cookie-setting Server Action (`'use server'`) is defined inline in the layout and passed down to a client `LocaleSwitcher` component, which calls it via `useLocale()` (client hook, from `next-intl`) to read the current value for highlighting the active option.

Official `LocaleSwitcher.tsx`:
```tsx
'use client';
import {Locale, useLocale} from 'next-intl';

type Props = {changeLocaleAction: (locale: Locale) => Promise<void>};

export default function LocaleSwitcher({changeLocaleAction}: Props) {
  const locale = useLocale();
  return (
    <div>
      {['en', 'de'].map((cur) => (
        <button key={cur} onClick={() => changeLocaleAction(cur as Locale)}>
          {cur.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
```

### The `NEXT_LOCALE` cookie name is next-intl's own convention
Not from the docs pages, but confirmed directly in source: `packages/next-intl/src/routing/config.tsx` in the next-intl repo defines the **default locale cookie** used by next-intl's own routing/middleware as:
```ts
name: 'NEXT_LOCALE',
sameSite: 'lax',
```
So even though the official *no-routing* example uses a cookie literally named `locale`, the issue's choice of `NEXT_LOCALE` aligns with next-intl's own library-wide default cookie name (just applied manually here since middleware isn't in play). No conflict — just note that reading/writing it must be done by hand (own Server Action + own `cookies().get('NEXT_LOCALE')` read in `i18n/request.ts`), since without middleware nothing sets it automatically.

### `useTranslations` / message files
Standard `next-intl` usage, confirmed via the example: `messages/en.json` and `messages/fr.json` (flat or nested JSON keyed by namespace), consumed via `useTranslations('Namespace')` in both Server and Client Components once wrapped in `NextIntlClientProvider`.

---

## 3. Current repo state

### 3.1 `next.config.ts` (full file, `/Users/ielb/Develop/Personal/dubbl/next.config.ts`)
```ts
import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const nextConfig: NextConfig = {
  output: "standalone",
};

const withMDX = createMDX();

export default withMDX(nextConfig);
```
Single wrapper today: `fumadocs-mdx`'s `createMDX()`. `createNextIntlPlugin()` needs to be composed around this — per §2, apply it as the outermost wrapper: `export default withNextIntl(withMDX(nextConfig));`.

### 3.2 `app/layout.tsx` (full file, `/Users/ielb/Develop/Personal/dubbl/app/layout.tsx`)
Already an async-capable Server Component (no `"use client"`, default export is a plain function — can trivially become `async`). Structure top to bottom:
- Line 109: `<html lang="en" className="scroll-smooth" suppressHydrationWarning>` — the hardcoded `lang="en"` that needs to become dynamic.
- Lines 113–115: `<body className={...fonts...}>`
- Provider nesting inside `<body>` (lines 116–122):
  ```
  <ThemeProvider>
    <RootProvider>              (fumadocs-ui/provider/next)
      <SessionProvider>{children}</SessionProvider>   (next-auth/react)
    </RootProvider>
    <Toaster richColors position="bottom-right" />     (sonner)
  </ThemeProvider>
  ```
  Note `<Toaster />` is a **sibling** of `<RootProvider>`, not nested inside it — both are children of `<ThemeProvider>`. For `Toaster`'s rendered toast content to see translated strings, `NextIntlClientProvider` must wrap `<ThemeProvider>` itself (i.e., be the direct/outermost child of `<body>`), not be inserted only around `{children}`. This exactly matches the issue's own instruction: *"wrap children in `NextIntlClientProvider` (outermost, inside `<body>`, so `Toaster` gets translated strings too)"*.
- No existing i18n-related imports or logic anywhere in this file.

### 3.3 `app/(dashboard)/layout.tsx` (full file, `/Users/ielb/Develop/Personal/dubbl/app/(dashboard)/layout.tsx`)
This file is a **Client Component** (`"use client"` at the top). Structure:
```
<OrgLoader>
  <SidebarProvider>
    <CreateDrawerProvider>
      <AppSidebar />
      <SidebarInset>
        <Topbar />
        <div>{children}</div>
      </SidebarInset>
      <CommandPalette />
    </CreateDrawerProvider>
  </SidebarProvider>
</OrgLoader>
```
Being a Client Component doesn't block `useTranslations`/`useLocale` usage inside it or its descendants (`AppSidebar`, `Topbar`, etc.) — `NextIntlClientProvider` is itself a client-side React Context Provider mounted higher up in the tree (in root `app/layout.tsx`), so any client component anywhere below it, including this whole dashboard layout subtree, has access automatically. No special nesting relative to `OrgLoader` is required — they're independent contexts (`OrganizationContext` vs. next-intl's internal context) and don't need to nest in any particular order relative to each other, only both need to be **descendants** of `NextIntlClientProvider`, which they already will be since it wraps the entire `<body>`.

### 3.4 `components/dashboard/org-loader.tsx` (full file read)
Confirms `OrganizationContext` / `useOrganization()` exist exactly as described:
```ts
export interface OrganizationData {
  id: string;
  name: string;
  defaultCurrency: string;
  countryCode: string | null;
  onboardingCompletedAt: string | null;
}
const OrganizationContext = createContext<OrganizationData | null>(null);
export function useOrganization(): OrganizationData | null { return useContext(OrganizationContext); }
export function OrgLoader({ children }) { ... }
```
`OrgLoader` is a `"use client"` component that client-fetches `/api/v1/organization`, shows a branded loading overlay, then renders `<OrganizationContext.Provider value={org}>{children}</OrganizationContext.Provider>`. It redirects to `/onboarding` if the org has no country set. This is unrelated to locale — no interaction/ordering requirement with `NextIntlClientProvider` beyond both being ancestors somewhere above the dashboard pages (which they will be, given `NextIntlClientProvider` sits at the root layout, above `OrgLoader` in `app/(dashboard)/layout.tsx`).

### 3.5 `middleware.ts`
**Does not exist.** `find . -maxdepth 2 -iname "middleware.ts" -not -path "*/node_modules/*"` returned nothing. This matches the issue's own claim ("No existing `middleware.ts` to conflict with") and means no coexistence concerns — a new `middleware.ts` is not needed at all for this approach (see §2), so this is moot either way.

### 3.6 `package.json`
- `next-intl` is **not** currently a dependency (confirmed absent from both `dependencies` and `devDependencies`).
- Next.js version: `"next": "16.1.6"` (App Router).
- Config file is `next.config.ts` (TypeScript), not `.mjs`.
- `"type": "module"` at the package level.
- No `src/` directory exists at repo root (`app/`, `lib/`, `components/` etc. all live at the repo root) — relevant for where `i18n/request.ts` should be placed (repo root `i18n/`, not `src/i18n/`).
- Package manager: `pnpm@10.30.3`.
- Relevant existing deps: `next-auth@^5.0.0-beta.30`, `sonner@^2.0.7`, `next-themes@^0.4.6`, `fumadocs-mdx@^14.2.9` / `fumadocs-ui@^16.6.8`.

### 3.7 Dashboard sidebar/nav — `components/dashboard/sidebar.tsx`
`AppSidebar` (Client Component) renders `sections: NavSection[]` and `footerItems: NavItem[]`, all hardcoded English `label` strings. Full inventory of user-facing nav labels needing translation:
- Section labels: `"Financials"`, `"Operations"` (two sections have empty `""` labels, no header rendered).
- Nav items (11 total across sections): `Dashboard`, `Contacts`, `Sales`, `Purchases`, `Accounting`, `Tax`, `Teams`, `Inventory`, `Payroll`, `CRM`, `Documents`, `Reports`.
- Footer items (2): `Settings`, `Help`.
- Plus a dynamically-rendered `"Projects"` collapsible section (hardcoded `<span>Projects</span>` at line 213) and a `"New project"` button (line 258) inside `ProjectsCollapsible`.
- Total distinct hardcoded label strings: **~16** (11 nav items + 2 footer + 2 section labels + "Projects" collapsible label + "New project").
- Renders `<OrgSwitcher />` (org picker) and `<UserMenu />` in the footer — `UserMenu` (see §3.10) is a plausible home for the locale toggle since the issue says "account menu or settings."

### 3.8 Dashboard home — `app/(dashboard)/dashboard/page.tsx`
Large (`~886` line) Client Component. Visible string content requiring translation, by category:
- **Greeting banner:** time-of-day-randomized greeting arrays (`GREETINGS_MORNING`, `GREETINGS_AFTERNOON`, `GREETINGS_EVENING`, `GREETINGS_ANYTIME` — 4 arrays, ~15 strings total) plus `DAY_NAMES` (7 day names) plus the static tagline "Here is your financial overview. Jump into any section to get started or continue where you left off."
- **Quick action buttons** in the greeting banner: `Accounts`, `New entry`, `New invoice`, `Contacts`.
- **Getting-started checklist:** heading `"Getting started"`, subtext, 4 step labels+descriptions (`Add a bank account`, `Set opening balances`, `Set up tax`, `Create your first invoice`, each with a `desc`), and a `"Dismiss / All done"` / `"Saving…"` button.
- **Budget Alerts banner:** heading `"Budget Alerts"`.
- **KPI/Stat cards (5):** titles `Revenue`, `Expenses`, `Net Income`, `Receivables`, `Payables` (plus `"{n} outstanding"` change text).
- **Revenue vs Expenses card:** heading, `Revenue`, `Expenses`, `Net Income` row labels, `"Top Expenses"` subheading.
- **Aging Summary card:** heading, `Receivables`/`Payables` column titles (via `AgingColumn`).
- **Financial KPIs card:** heading, 6 `KpiItem` labels (`Current Ratio`, `Quick Ratio`, `Gross Margin`, `Net Margin`, `DSO`, `DPO`).
- **Quick Actions alert tiles (4):** `Overdue Invoices`, `Overdue Bills`, `Uncategorized Transactions` (+"Need categorization"), `Needs Reconciliation` (+ pluralized "bank account(s)"), plus amount-suffix strings (`"outstanding"`, `"to pay"`).
- **Recent Entries table:** heading `"Recent Entries"`, `"View all"` button, table column headers (`#`, `Date`, `Description`, `Status`, `Amount`), empty-state (`"No journal entries yet."`, `"Create your first entry"`), and status badge text (raw enum values `draft`/`posted`/`void` rendered directly).
- **Loading/error states:** delegated to `<BrandLoader />` / `<ErrorState message=... />` (not read in this pass — separate shared components, likely also carry hardcoded strings, e.g. the passed error message `"Failed to load dashboard data. Please check your connection."`).
- Document title set imperatively via `useDocumentTitle("Dashboard · Overview")` (not a rendered string but still user-facing, via the `<title>` tag).
- Rough total: **50+ distinct hardcoded strings** on this single page — this is the single largest string surface among the "core slice" pages named in the issue.

### 3.9 Org settings — `app/(dashboard)/settings/page.tsx` + `app/(dashboard)/settings/layout.tsx`
- **`settings/layout.tsx`**: Client Component rendering a left nav (`GROUPS: NavGroup[]`) with 5 group labels (`Organization`, `Automation`, `Integrations`, `Preferences`, `Developer`) and 19 nav item labels (`General`, `Members`, `Roles`, `Billing`, `Advisors`, `Templates`, `Import & Export`, `Trash`, `Backups`, `Pipelines`, `Bank Rules`, `Approvals`, `Bill Matching`, `Webhooks`, `Stripe`, `Notifications`, `Reminders`, `Cost Centers`, `Tags`, `API Keys`, `Audit Log`) — same nav rendered twice (desktop sidebar + mobile horizontal tabs). Only `/settings` itself ("General") is in scope per the issue; the other 21 settings sub-pages are out of scope for this ticket but their **nav labels** are part of the always-rendered `settings/layout.tsx` shell, so a decision is needed on whether to translate all of them (cheap — it's just an array of labels) or only "General."
- **`settings/page.tsx`** (the "General" org settings page, ~633 lines, Client Component) is exactly where the **Morocco country/currency picker** work lives:
  - Country picker (lines 236–284): a `Command`/`Popover` combobox over `BUSINESS_COUNTRIES` (from `@/lib/data/business-types`, which includes Morocco: `{ code: "MA", name: "Morocco", flag: "🇲🇦", defaultCurrency: "MAD" }` at `lib/data/business-types.ts:69`, with a Morocco business-types block at `lib/data/business-types.ts:519`). Strings: `"Country (sets your tax rules)"`, `"Select country..."`, `"Search country..."`, `"No country found."`, plus the helper text `"Picks the right tax rules and forms for where your business is based (for example VAT, GST or sales tax)."`.
  - `getBusinessTypesForCountry(countryCode)` populates a dependent "Business structure" `<Select>` (localized business entity types with `localName`/`englishName` — this data itself may already carry French-relevant local names for some countries, worth checking during implementation, but is separate from UI-chrome translation).
  - Currency picker: `<CurrencySelect>` component at `components/ui/currency-select.tsx` (not read in depth this pass — a separate reusable component, likely used elsewhere too).
  - Page is organized into `<Section>` blocks, each with a hardcoded `title`+`description`: Organization, Legal, Address, Contact, Financials, "Send invoices electronically" (PEPPOL), "Lock past dates" (period lock), "Danger zone" — ~8 sections × (title + description + several field `<Label>`s + placeholders) — call it **60+ distinct strings** on this one page (labels, placeholders, helper text, toasts like `"Settings saved"` / `"Failed to save"` / `"Period locked"`, button text `"Saving..."` / `"Save changes"` / `"Delete"`).
  - Uses `sonner`'s `toast.success(...)` / `toast.error(...)` directly (imported `{ toast } from "sonner"`) — confirms the toast-string-translation concern from the issue is real and present on this exact page.

### 3.10 Sign-in / sign-up — `app/(auth)/sign-in/page.tsx`, `app/(auth)/sign-up/page.tsx`, `app/(auth)/layout.tsx`
- Both pages are Client Components with hardcoded English copy: headings (`"Welcome back"` / `"Create your account"`), subtext, form `<Label>`s (`Email`, `Password`, `Name`, `Authentication code`), placeholders, button states (`"Signing in..."` / `"Sign in"`, `"Creating account..."` / `"Create account"`, `"Dev Login (test account)"`, `"Setting up..."`), inline error strings (`"Invalid email or password"`, `"Invalid authentication code"`, `"Failed to seed dev user"`, `"Dev sign-in failed"`, registration-mode notices), OAuth button labels (`Google`, `Apple`), separators (`"or"`, `"or continue with email"`), footer links (`"Don't have an account? Sign up"` / `"Already have an account? Sign in"`), and a shared tagline (`"Open source · Self-hosted option · Apache 2.0"`).
- `app/(auth)/layout.tsx` (also Client Component) wraps both pages with the marketing-style split panel; visible strings there are mostly decorative/marketing (network node labels like "Invoices", "Accounts", feature badges "Double-entry"/"Self-hosted"/"API-first", footer "Home"/"Trusted by teams worldwide") — arguably lower priority than the actual form UI but technically part of the rendered auth surface.
- Rough total across sign-in + sign-up + auth layout: **~40 distinct strings**.

### 3.11 Toaster / notification pattern
Confirmed: `<Toaster richColors position="bottom-right" />` from `sonner` is mounted once, in `app/layout.tsx:120`, as a sibling to `<RootProvider>` inside `<ThemeProvider>` (see §3.2). Call sites use the imperative `toast.success("...")` / `toast.error("...")` API (e.g. `app/(dashboard)/settings/page.tsx:203,205,595,598`) — meaning translated toast copy must be resolved to plain strings **before** calling `toast.success()/error()`, i.e. via `useTranslations()` inside the component that calls `toast`, not via any special sonner/next-intl integration. This is straightforward but is a real pattern worth calling out: every `toast.success("Settings saved")`-style call site in the "core slice" pages needs to become `toast.success(t("settingsSaved"))` or similar.

### 3.12 `messages/` directory / existing locale files
**Do not exist.** `find . -iname "messages" -not -path "*/node_modules/*"` and searches for locale JSON returned nothing in the app source. No prior i18n scaffolding of any kind. `grep -rl "next-intl"` across `.ts`/`.tsx` files also returned nothing — confirms a fully greenfield setup.

### 3.13 Public/locale-agnostic routes that must stay unaffected (confirms issue's premise)
Confirmed via directory listing:
- `app/api/**` (all API routes)
- `app/.well-known/oauth-authorization-server/[[...path]]/route.ts`, `app/.well-known/oauth-protected-resource/[[...path]]/route.ts`
- `app/pay/[token]/page.tsx`
- `app/portal/[token]/{page,layout}.tsx` + `payments/`, `invoices/`, `quotes/`, `statements/` sub-pages
- `app/sign/[token]/page.tsx` (+ `signature-canvas.tsx`)

All of these sit outside `app/(dashboard)` and `app/(auth)` route groups and are unaffected by a cookie-based, no-prefix locale scheme by construction — there's no `[locale]` segment for them to be nested under in the first place, so no special exclusion logic is needed (unlike prefix-based i18n routing, which would require an explicit route-group carve-out).

---

## 4. Gaps / decisions needed

1. **Cookie name mismatch between the issue and the official no-routing example.** The issue mandates `NEXT_LOCALE`; the official next-intl example for this exact mode uses a cookie literally named `locale`. Not a real conflict — `NEXT_LOCALE` is next-intl's own internal default cookie name (see §2) — but it means the implementer must **manually** name the cookie `NEXT_LOCALE` in both `i18n/request.ts`'s read and the Server Action's `cookies().set(...)` call; nothing in the library enforces or defaults to that name outside of routing/middleware mode. Worth flagging so whoever implements doesn't just copy-paste the example's `'locale'` cookie name.

2. **`app/layout.tsx` must become `async`.** It's currently a plain (non-async) function component. This is a small, low-risk, but real code change (needed to call `await getLocale()` per the official pattern), not just an additive wrapper — worth calling out explicitly in the implementation plan rather than treating the layout change as "just add a provider."

3. **`Toaster` placement requires moving it, not just wrapping it.** Per §3.2, `<Toaster />` currently sits as a *sibling* of `<RootProvider>` inside `<ThemeProvider>` — both are children of `ThemeProvider`, itself the sole child of `<body>`. Simply inserting `NextIntlClientProvider` around `{children}` (the naive reading of "wrap children") would **not** cover `Toaster`. `NextIntlClientProvider` needs to become the direct child of `<body>`, wrapping `<ThemeProvider>` entirely (i.e., go one level higher than "children" literally means). The issue text anticipates this ("outermost, inside `<body>`") but an implementer skimming quickly could miss that `Toaster` is a sibling, not a descendant, of the part that obviously needs wrapping.

4. **Settings nav shell (`app/(dashboard)/settings/layout.tsx`) is always rendered but not explicitly scoped.** The issue says translate "org settings (incl. the Morocco country picker)" — ambiguous whether that means just the General page's content, or also the persistent settings sub-nav with its 21 item labels across 5 groups (rendered on *every* settings sub-route, including untranslated ones like Billing/Roles/Webhooks). Translating just the nav labels is cheap (it's a flat array) and would look inconsistent if left English while the General page content is French — recommend treating the nav shell's labels as in-scope even though the destination pages aren't, but this needs an explicit decision rather than being inferred.

5. **No decision recorded on where the locale toggle physically lives.** The issue says "account menu or settings" (either works). Repo state supports both: `components/dashboard/user-menu.tsx` has an existing dropdown (`Account`, `Upgrade to Pro`, `Sign out`) that a `Language` item could slot into; `app/(dashboard)/settings/page.tsx` also has room in its Section-based layout. Also relevant: the sign-in/sign-up pages (`app/(auth)/**`) are in the translated core slice but have **no account menu** (unauthenticated) — if a visitor should be able to switch language pre-login (e.g. from the `(auth)` layout header, which currently only has a `ThemeToggle` next to the logo, `app/(auth)/layout.tsx:75`), that's a second, separate toggle placement not mentioned in the issue. Needs a decision: is pre-auth locale switching in scope, or only post-login?

6. **Dashboard home page (`dashboard/page.tsx`) has by far the largest string surface (~50+ strings) of the four "core slice" pages**, including randomized greeting-copy arrays that don't map cleanly to a single translation key each (e.g. picking one of ~15 greeting variants) — the issue doesn't specify whether the French version needs equivalent randomized variety or whether it's acceptable to collapse to fewer/simpler French variants. Worth deciding before writing `messages/fr.json` for this page, since a literal 1:1 translation of idiomatic English variants ("Rise and shine", "Top of the morning") into French may read oddly and a native-quality French pass may intentionally use a different (possibly shorter) list.

7. **Shared components not read in this pass may also need translation** for the "core slice" pages to look fully translated: `components/dashboard/stat-card.tsx`, `components/dashboard/data-table.tsx`, `components/dashboard/activity-feed.tsx`, `components/dashboard/brand-loader.tsx`, `components/dashboard/error-state.tsx`, `components/dashboard/cash-flow-widget.tsx`, `components/dashboard/topbar.tsx`, `components/dashboard/org-switcher.tsx`, `components/dashboard/command-palette.tsx`, `components/ui/currency-select.tsx`, and `components/dashboard/edit-profile-dialog.tsx` (the `AccountDialog` opened from `UserMenu`) — none of these were opened in this research pass, so their string surface is unknown and should be audited during implementation, since several are rendered directly on the dashboard-home/sidebar/settings pages that are in scope.

8. **`getBusinessTypesForCountry` / `lib/data/business-types.ts` already stores `localName` vs `englishName` per business type** (seen at `lib/data/business-types.ts` for Morocco's block at line 519) — this is a separate, pre-existing localization axis (legal-entity naming per country) that is orthogonal to UI-chrome i18n and should not be conflated with `next-intl` message catalogs during implementation; flagging only so it isn't accidentally "double-translated" or confused with the `messages/fr.json` effort.
