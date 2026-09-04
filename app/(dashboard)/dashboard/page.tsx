"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  BookOpen,
  FileText,
  Users,
  AlertTriangle,
  Gauge,
  Rocket,
  CheckCircle2,
  ChevronRight,
  X,
} from "lucide-react";
import { GrainGradient } from "@paper-design/shaders-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { devDelay } from "@/lib/dev-delay";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ErrorState } from "@/components/dashboard/error-state";
import { cn } from "@/lib/utils";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";
import { CashFlowWidget } from "@/components/dashboard/cash-flow-widget";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { useOrganization } from "@/components/dashboard/org-loader";

interface GreetingPools {
  morning: string[];
  afternoon: string[];
  evening: string[];
  anytime: string[];
  days: string[];
  happyDay: (day: string) => string;
}

function pickGreeting(pools: GreetingPools): string {
  const now = new Date();
  const hour = now.getHours();
  const day = pools.days[now.getDay()];

  const timePool =
    hour >= 5 && hour < 12
      ? pools.morning
      : hour >= 12 && hour < 17
      ? pools.afternoon
      : pools.evening;

  const allOptions = [
    ...timePool,
    ...pools.anytime,
    pools.happyDay(day),
  ];

  return allOptions[Math.floor(Math.random() * allOptions.length)];
}

interface Entry {
  id: string;
  entryNumber: number;
  date: string;
  description: string;
  status: "draft" | "posted" | "void";
  totalDebit: string;
}

interface PnLAccount {
  accountName: string;
  balance: number;
}

interface PnLData {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  expenses: PnLAccount[];
}

interface AgingBucket {
  label: string;
  total: number;
  count: number;
}

interface AgingData {
  buckets: AgingBucket[];
  grandTotal: number;
}

const BUCKET_COLORS = [
  "bg-emerald-500",
  "bg-amber-500",
  "bg-orange-500",
  "bg-red-400",
  "bg-red-600",
];

function AgingColumn({
  title,
  total,
  buckets,
}: {
  title: string;
  total: number;
  buckets: AgingBucket[];
}) {
  const maxBucket = Math.max(...buckets.map((b) => b.total), 1);

  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-0.5 font-mono text-lg font-bold tabular-nums">
        {formatMoney(total)}
      </p>
      <div className="mt-3 space-y-2">
        {buckets.map((bucket, i) => {
          const pct = (bucket.total / maxBucket) * 100;
          return (
            <div key={bucket.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{bucket.label}</span>
                <span className="font-mono tabular-nums">
                  {formatMoney(bucket.total)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    BUCKET_COLORS[i]
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiItem({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="text-center">
      <p className={cn(
        "text-lg font-bold font-mono tabular-nums",
        good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
      )}>
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const router = useRouter();
  const { open: openDrawer } = useCreateDrawer();
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] || "";
  const greeting = useMemo(
    () =>
      pickGreeting({
        morning: t.raw("greetings.morning") as string[],
        afternoon: t.raw("greetings.afternoon") as string[],
        evening: t.raw("greetings.evening") as string[],
        anytime: t.raw("greetings.anytime") as string[],
        days: t.raw("greetings.days") as string[],
        happyDay: (day: string) => t("greetings.happyDay", { day }),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  );
  const columns: Column<Entry>[] = [
    {
      key: "number",
      header: t("recentEntries.columnNumber"),
      className: "w-16",
      render: (r) => (
        <span className="font-mono text-xs text-muted-foreground">
          {r.entryNumber}
        </span>
      ),
    },
    {
      key: "date",
      header: t("recentEntries.columnDate"),
      className: "w-28",
      render: (r) => <span className="text-sm">{r.date}</span>,
    },
    {
      key: "description",
      header: t("recentEntries.columnDescription"),
      render: (r) => <span className="text-sm font-medium">{r.description}</span>,
    },
    {
      key: "status",
      header: t("recentEntries.columnStatus"),
      className: "w-24",
      render: (r) => (
        <Badge
          variant="outline"
          className={
            r.status === "posted"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
              : r.status === "void"
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
              : ""
          }
        >
          {r.status}
        </Badge>
      ),
    },
    {
      key: "amount",
      header: t("recentEntries.columnAmount"),
      className: "w-28 text-right",
      render: (r) => (
        <span className="font-mono text-sm tabular-nums">
          {formatMoney(Math.round(parseFloat(r.totalDebit) * 100))}
        </span>
      ),
    },
  ];
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pnl, setPnl] = useState<PnLData>({
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    expenses: [],
  });
  const [receivables, setReceivables] = useState<AgingData>({
    buckets: [],
    grandTotal: 0,
  });
  const [payables, setPayables] = useState<AgingData>({
    buckets: [],
    grandTotal: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sparklines, setSparklines] = useState<{
    revenue: number[];
    expenses: number[];
    netIncome: number[];
  }>({ revenue: [], expenses: [], netIncome: [] });
  const [budgetAlerts, setBudgetAlerts] = useState<
    { accountName: string; pct: number; budgeted: number; actual: number }[]
  >([]);
  const [ratios, setRatios] = useState<{
    currentRatio: number | null;
    quickRatio: number | null;
    grossMargin: number | null;
    netMargin: number | null;
    dso: number | null;
    dpo: number | null;
  } | null>(null);
  const [actionAlerts, setActionAlerts] = useState<{
    overdueInvoices: { count: number; total: number };
    overdueBills: { count: number; total: number };
    uncategorizedTransactions: number;
    accountsNeedingReconciliation: { bankAccountName: string; lastReconDate: string | null }[];
  } | null>(null);
  // Getting-started checklist: show while the org has never completed onboarding.
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dismissingOnboarding, setDismissingOnboarding] = useState(false);
  const org = useOrganization();
  const currency = org?.defaultCurrency ?? "USD";

  useDocumentTitle(t("documentTitle"));

  useEffect(() => {
    const id = localStorage.getItem("activeOrgId");
    const headers: Record<string, string> = {};
    if (id) headers["x-organization-id"] = id;

    Promise.all([
      fetch("/api/v1/entries?limit=10", { headers }).then((r) => r.json()),
      fetch("/api/v1/reports/profit-and-loss", { headers })
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/v1/reports/aged-receivables", { headers })
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/v1/reports/aged-payables", { headers })
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([entriesData, pnlData, arData, apData]) => {
        if (entriesData.entries) {
          setEntries(
            entriesData.entries.map((e: Record<string, string | number>) => ({
              ...e,
              totalDebit: (e.totalDebit as string) || "0.00",
            }))
          );
        }
        if (pnlData) {
          setPnl({
            totalRevenue: pnlData.totalRevenue || 0,
            totalExpenses: pnlData.totalExpenses || 0,
            netIncome: pnlData.netIncome || 0,
            expenses: pnlData.expenses || [],
          });
        }
        if (arData?.buckets) setReceivables(arData);
        if (apData?.buckets) setPayables(apData);
      })
      .then(() => devDelay())
      .catch(() => setError(t("errorLoad")))
      .finally(() => setLoading(false));

    // Load sparkline trends in background
    fetch("/api/v1/reports/monthly-trends?months=6", { headers })
      .then((r) => r.json())
      .then((data) => {
        if (data.revenueSparkline) {
          setSparklines({
            revenue: data.revenueSparkline,
            expenses: data.expenseSparkline,
            netIncome: data.netIncomeSparkline,
          });
        }
      })
      .catch(() => {});

    // Load budget alerts in background
    fetch("/api/v1/reports/budget-vs-actual", { headers })
      .then((r) => r.json())
      .then((data) => {
        if (data.comparisons) {
          const alerts = data.comparisons
            .filter(
              (c: { budgeted: number; actual: number }) =>
                c.budgeted > 0 && c.actual / c.budgeted >= 0.9
            )
            .map((c: { accountName: string; budgeted: number; actual: number }) => ({
              accountName: c.accountName,
              pct: Math.round((c.actual / c.budgeted) * 100),
              budgeted: c.budgeted,
              actual: c.actual,
            }));
          setBudgetAlerts(alerts);
        }
      })
      .catch(() => {});

    // Load financial ratios in background
    fetch("/api/v1/reports/financial-ratios", { headers })
      .then((r) => r.json())
      .then((data) => {
        if (data.ratios) setRatios(data.ratios);
      })
      .catch(() => {});

    // Load action alerts in background
    fetch("/api/v1/dashboard/alerts", { headers })
      .then((r) => r.json())
      .then((data) => setActionAlerts(data))
      .catch(() => {});

  }, []);

  // Show the getting-started checklist while the org has never completed
  // onboarding (org comes from the shared OrgLoader context, no extra fetch).
  useEffect(() => {
    if (org && !org.onboardingCompletedAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowOnboarding(true);
    }
  }, [org]);

  const dismissOnboarding = () => {
    setDismissingOnboarding(true);
    const id = localStorage.getItem("activeOrgId");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (id) headers["x-organization-id"] = id;
    fetch("/api/v1/organization", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ onboardingCompleted: true }),
    })
      .then(() => setShowOnboarding(false))
      .catch(() => {})
      .finally(() => setDismissingOnboarding(false));
  };

  const receivablesCount = receivables.buckets.reduce(
    (sum, b) => sum + b.count,
    0
  );
  const payablesCount = payables.buckets.reduce(
    (sum, b) => sum + b.count,
    0
  );

  const maxRevExp = Math.max(pnl.totalRevenue, pnl.totalExpenses, 1);
  const revenuePct = (pnl.totalRevenue / maxRevExp) * 100;
  const expensesPct = (pnl.totalExpenses / maxRevExp) * 100;

  const topExpenses = [...pnl.expenses]
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 4);

  return (
    <MotionConfig reducedMotion="never">
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loader"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <BrandLoader />
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <ErrorState message={error} onRetry={() => window.location.reload()} />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 12, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            {/* Section A: Greeting Banner */}
            <div className="relative overflow-hidden rounded-2xl">
              <GrainGradient
                className="pointer-events-none !absolute !inset-0 !rounded-none"
                width="100%"
                height="100%"
                colors={[
                  "#d1fae5",
                  "#a7f3d0",
                  "#6ee7b7",
                  "#34d399",
                  "#10b981",
                  "#34d399",
                  "#a7f3d0",
                ]}
                colorBack="#34d399"
                softness={1}
                intensity={0.8}
                noise={0.9}
                shape="wave"
                scale={3.5}
                speed={0.2}
              />
              <div className="relative p-5 sm:p-8">
                <h2 className="text-xl sm:text-2xl font-bold text-emerald-950">
                  {greeting}{firstName ? `, ${firstName}` : ""}
                </h2>
                <p className="mt-1 max-w-lg text-sm text-emerald-950/70">
                  {t("tagline")}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-950 text-white hover:bg-emerald-900"
                    onClick={() => router.push("/accounting/accounts")}
                  >
                    <Landmark className="mr-1.5 size-3.5" />
                    {t("quickActions.accounts")}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-950/10 text-emerald-950 hover:bg-emerald-950/20 border-0"
                    onClick={() => openDrawer("entry")}
                  >
                    <BookOpen className="mr-1.5 size-3.5" />
                    {t("quickActions.newEntry")}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-950/10 text-emerald-950 hover:bg-emerald-950/20 border-0"
                    onClick={() => openDrawer("invoice")}
                  >
                    <FileText className="mr-1.5 size-3.5" />
                    {t("quickActions.newInvoice")}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-950/10 text-emerald-950 hover:bg-emerald-950/20 border-0"
                    onClick={() => router.push("/contacts")}
                  >
                    <Users className="mr-1.5 size-3.5" />
                    {t("quickActions.contacts")}
                  </Button>
                </div>
              </div>
            </div>

            {/* Getting started checklist */}
            {showOnboarding && (
              <div className="relative rounded-lg border bg-card p-5">
                <button
                  onClick={dismissOnboarding}
                  disabled={dismissingOnboarding}
                  aria-label={t("onboarding.dismissAria")}
                  className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <X className="size-4" />
                </button>
                <div className="flex items-center gap-2">
                  <Rocket className="size-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold">{t("onboarding.heading")}</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("onboarding.subtext")}
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {[
                    {
                      label: t("onboarding.bankAccountLabel"),
                      desc: t("onboarding.bankAccountDesc"),
                      href: "/accounting/banking",
                    },
                    {
                      label: t("onboarding.openingBalancesLabel"),
                      desc: t("onboarding.openingBalancesDesc"),
                      href: "/accounting/opening-balances",
                    },
                    {
                      label: t("onboarding.taxLabel"),
                      desc: t("onboarding.taxDesc"),
                      href: "/tax",
                    },
                    {
                      label: t("onboarding.firstInvoiceLabel"),
                      desc: t("onboarding.firstInvoiceDesc"),
                      href: "/sales",
                    },
                  ].map((step) => (
                    <button
                      key={step.href}
                      onClick={() => router.push(step.href)}
                      className="flex items-start gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    >
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{step.label}</p>
                        <p className="text-xs text-muted-foreground">{step.desc}</p>
                      </div>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" />
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={dismissOnboarding}
                    disabled={dismissingOnboarding}
                  >
                    {dismissingOnboarding ? t("onboarding.saving") : t("onboarding.dismiss")}
                  </Button>
                </div>
              </div>
            )}

            {/* Budget Alerts */}
            {budgetAlerts.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-600" />
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    {t("budgetAlerts.heading")}
                  </p>
                </div>
                <div className="space-y-1">
                  {budgetAlerts.slice(0, 3).map((alert) => (
                    <div
                      key={alert.accountName}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-amber-700 dark:text-amber-400">
                        {alert.accountName}
                      </span>
                      <span
                        className={cn(
                          "font-mono tabular-nums font-medium",
                          alert.pct >= 100
                            ? "text-red-600"
                            : "text-amber-700 dark:text-amber-400"
                        )}
                      >
                        {t("budgetAlerts.used", {
                          pct: alert.pct,
                          actual: formatMoney(alert.actual),
                          budgeted: formatMoney(alert.budgeted),
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section B: Stat Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <StatCard
                title={t("stats.revenue")}
                value={formatMoney(pnl.totalRevenue, currency)}
                icon={TrendingUp}
                sparklineData={sparklines.revenue.length > 1 ? sparklines.revenue : undefined}
              />
              <StatCard
                title={t("stats.expenses")}
                value={formatMoney(pnl.totalExpenses, currency)}
                icon={TrendingDown}
                sparklineData={sparklines.expenses.length > 1 ? sparklines.expenses : undefined}
              />
              <StatCard
                title={t("stats.netIncome")}
                value={formatMoney(pnl.netIncome, currency)}
                icon={DollarSign}
                changeType={pnl.netIncome >= 0 ? "positive" : "negative"}
                sparklineData={sparklines.netIncome.length > 1 ? sparklines.netIncome : undefined}
              />
              <StatCard
                title={t("stats.receivables")}
                value={formatMoney(receivables.grandTotal, currency)}
                icon={ArrowDownLeft}
                change={t("stats.outstanding", { count: receivablesCount })}
                changeType="neutral"
              />
              <StatCard
                title={t("stats.payables")}
                value={formatMoney(payables.grandTotal, currency)}
                icon={ArrowUpRight}
                change={t("stats.outstanding", { count: payablesCount })}
                changeType="neutral"
              />
            </div>

            {/* Section C: Financial Health */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Revenue vs Expenses */}
              <div className="rounded-lg border bg-card p-5">
                <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("revenueVsExpenses.heading")}
                </h3>
                <div className="mt-4 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t("revenueVsExpenses.revenue")}</span>
                      <span className="font-mono text-sm tabular-nums font-medium">
                        {formatMoney(pnl.totalRevenue)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${revenuePct}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t("revenueVsExpenses.expenses")}</span>
                      <span className="font-mono text-sm tabular-nums font-medium">
                        {formatMoney(pnl.totalExpenses)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-red-500 transition-all"
                        style={{ width: `${expensesPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-sm text-muted-foreground">
                      {t("revenueVsExpenses.netIncome")}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-sm tabular-nums font-semibold",
                        pnl.netIncome >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {formatMoney(pnl.netIncome)}
                    </span>
                  </div>
                </div>
                {topExpenses.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
                      {t("revenueVsExpenses.topExpenses")}
                    </p>
                    <div className="space-y-2">
                      {topExpenses.map((exp) => (
                        <div
                          key={exp.accountName}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="truncate text-muted-foreground">
                            {exp.accountName}
                          </span>
                          <span className="ml-2 shrink-0 font-mono text-xs tabular-nums">
                            {formatMoney(exp.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Aging Summary */}
              <div className="rounded-lg border bg-card p-5">
                <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("agingSummary.heading")}
                </h3>
                <div className="mt-4 grid grid-cols-2 gap-6">
                  <AgingColumn
                    title={t("agingSummary.receivables")}
                    total={receivables.grandTotal}
                    buckets={receivables.buckets}
                  />
                  <AgingColumn
                    title={t("agingSummary.payables")}
                    total={payables.grandTotal}
                    buckets={payables.buckets}
                  />
                </div>
              </div>
            </div>

            {/* Cash Flow Forecast */}
            <CashFlowWidget />

            {/* Financial KPIs */}
            {ratios && Object.values(ratios).some((v) => v !== null) && (
              <div className="rounded-lg border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("financialKpis.heading")}
                  </h3>
                  <Gauge className="size-4 text-muted-foreground/50" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {ratios.currentRatio !== null && (
                    <KpiItem label={t("financialKpis.currentRatio")} value={`${ratios.currentRatio}x`} good={ratios.currentRatio >= 1} />
                  )}
                  {ratios.quickRatio !== null && (
                    <KpiItem label={t("financialKpis.quickRatio")} value={`${ratios.quickRatio}x`} good={ratios.quickRatio >= 1} />
                  )}
                  {ratios.grossMargin !== null && (
                    <KpiItem label={t("financialKpis.grossMargin")} value={`${ratios.grossMargin}%`} good={ratios.grossMargin > 0} />
                  )}
                  {ratios.netMargin !== null && (
                    <KpiItem label={t("financialKpis.netMargin")} value={`${ratios.netMargin}%`} good={ratios.netMargin > 0} />
                  )}
                  {ratios.dso !== null && (
                    <KpiItem label={t("financialKpis.dso")} value={`${ratios.dso}d`} good={ratios.dso <= 45} />
                  )}
                  {ratios.dpo !== null && (
                    <KpiItem label={t("financialKpis.dpo")} value={`${ratios.dpo}d`} good={ratios.dpo <= 60} />
                  )}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            {actionAlerts && (actionAlerts.overdueInvoices?.count > 0 || actionAlerts.overdueBills?.count > 0 || actionAlerts.uncategorizedTransactions > 0 || (actionAlerts.accountsNeedingReconciliation?.length ?? 0) > 0) && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {actionAlerts.overdueInvoices?.count > 0 && (
                  <button
                    onClick={() => router.push("/sales")}
                    className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-left transition-colors hover:bg-red-100 dark:hover:bg-red-950/50"
                  >
                    <p className="text-xs font-medium text-red-800 dark:text-red-300">{t("alerts.overdueInvoices")}</p>
                    <p className="text-lg font-bold font-mono tabular-nums text-red-600 mt-0.5">{actionAlerts.overdueInvoices.count}</p>
                    <p className="text-[11px] text-red-600/70 font-mono tabular-nums">{t("alerts.overdueInvoicesOutstanding", { amount: formatMoney(actionAlerts.overdueInvoices.total) })}</p>
                  </button>
                )}
                {actionAlerts.overdueBills?.count > 0 && (
                  <button
                    onClick={() => router.push("/purchases")}
                    className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-3 text-left transition-colors hover:bg-orange-100 dark:hover:bg-orange-950/50"
                  >
                    <p className="text-xs font-medium text-orange-800 dark:text-orange-300">{t("alerts.overdueBills")}</p>
                    <p className="text-lg font-bold font-mono tabular-nums text-orange-600 mt-0.5">{actionAlerts.overdueBills.count}</p>
                    <p className="text-[11px] text-orange-600/70 font-mono tabular-nums">{t("alerts.overdueBillsToPay", { amount: formatMoney(actionAlerts.overdueBills.total) })}</p>
                  </button>
                )}
                {actionAlerts.uncategorizedTransactions > 0 && (
                  <button
                    onClick={() => router.push("/accounting/banking")}
                    className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3 text-left transition-colors hover:bg-blue-100 dark:hover:bg-blue-950/50"
                  >
                    <p className="text-xs font-medium text-blue-800 dark:text-blue-300">{t("alerts.uncategorizedTransactions")}</p>
                    <p className="text-lg font-bold font-mono tabular-nums text-blue-600 mt-0.5">{actionAlerts.uncategorizedTransactions}</p>
                    <p className="text-[11px] text-blue-600/70">{t("alerts.needsCategorization")}</p>
                  </button>
                )}
                {actionAlerts.accountsNeedingReconciliation?.length > 0 && (
                  <button
                    onClick={() => router.push("/accounting/banking")}
                    className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-3 text-left transition-colors hover:bg-violet-100 dark:hover:bg-violet-950/50"
                  >
                    <p className="text-xs font-medium text-violet-800 dark:text-violet-300">{t("alerts.needsReconciliation")}</p>
                    <p className="text-lg font-bold font-mono tabular-nums text-violet-600 mt-0.5">{actionAlerts.accountsNeedingReconciliation.length}</p>
                    <p className="text-[11px] text-violet-600/70">{t("alerts.bankAccountCount", { count: actionAlerts.accountsNeedingReconciliation.length })}</p>
                  </button>
                )}
              </div>
            )}

            {/* Section D: Recent Activity */}
            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold">{t("recentEntries.heading")}</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => router.push("/accounting")}
                  >
                    {t("recentEntries.viewAll")}
                  </Button>
                </div>
                <DataTable
                  columns={columns}
                  data={entries}
                  loading={loading}
                  emptyMessage={t("recentEntries.empty")}
                  emptyAction={{
                    label: t("recentEntries.createFirst"),
                    onClick: () => openDrawer("entry"),
                  }}
                  onRowClick={(r) => router.push(`/accounting/${r.id}`)}
                />
              </div>
              <div>
                <ActivityFeed />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
