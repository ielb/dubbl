"use client";

import Link from "next/link";
import {
  BarChart3,
  Scale,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BookOpen,
  Target,
  Clock,
  ArrowDownUp,
  Receipt,
  ArrowLeftRight,
  Gauge,
  Layers,
  Compass,
  Users,
  CalendarDays,
  GitCompareArrows,
  ShoppingBag,
  Timer,
  Copy,
  Building2,
  FileText,
  Sparkles,
  Package2,
  FileCheck2,
} from "lucide-react";
import { Section } from "@/components/dashboard/section";
import { ContentReveal } from "@/components/ui/content-reveal";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { useTranslations } from "next-intl";

function useReportCategories() {
  const t = useTranslations("Reports");

  return [
  {
    title: t("categories.bigPicture.title"),
    description: t("categories.bigPicture.description"),
    reports: [
      {
        title: t("items.health.title"),
        description: t("items.health.description"),
        href: "/reports/executive-summary",
        icon: Sparkles,
      },
      {
        title: t("items.profitLoss.title"),
        description: t("items.profitLoss.description"),
        href: "/reports/profit-and-loss",
        icon: TrendingUp,
      },
      {
        title: t("items.balanceSheet.title"),
        description: t("items.balanceSheet.description"),
        href: "/reports/balance-sheet",
        icon: BarChart3,
      },
      {
        title: t("items.cashFlow.title"),
        description: t("items.cashFlow.description"),
        href: "/reports/cash-flow",
        icon: ArrowDownUp,
      },
      {
        title: t("items.pack.title"),
        description: t("items.pack.description"),
        href: "/reports/pack",
        icon: Package2,
      },
    ],
  },
  {
    title: t("categories.profitSpending.title"),
    description: t("categories.profitSpending.description"),
    reports: [
      {
        title: t("items.tracking.title"),
        description: t("items.tracking.description"),
        href: "/reports/tracking",
        icon: Layers,
      },
      {
        title: t("items.pnlComparison.title"),
        description: t("items.pnlComparison.description"),
        href: "/reports/pnl-comparison",
        icon: ArrowLeftRight,
      },
      {
        title: t("items.budgetActual.title"),
        description: t("items.budgetActual.description"),
        href: "/reports/budget-vs-actual",
        icon: Target,
      },
      {
        title: t("items.expenseAnalytics.title"),
        description: t("items.expenseAnalytics.description"),
        href: "/reports/expense-analytics",
        icon: TrendingDown,
      },
      {
        title: t("items.profitability.title"),
        description: t("items.profitability.description"),
        href: "/reports/profitability",
        icon: Users,
      },
      {
        title: t("items.vendorSpend.title"),
        description: t("items.vendorSpend.description"),
        href: "/reports/vendor-spend",
        icon: ShoppingBag,
      },
    ],
  },
  {
    title: t("categories.gettingPaid.title"),
    description: t("categories.gettingPaid.description"),
    reports: [
      {
        title: t("items.agedReceivables.title"),
        description: t("items.agedReceivables.description"),
        href: "/reports/aged-receivables",
        icon: Clock,
      },
      {
        title: t("items.agedPayables.title"),
        description: t("items.agedPayables.description"),
        href: "/reports/aged-payables",
        icon: DollarSign,
      },
      {
        title: t("items.paymentPerformance.title"),
        description: t("items.paymentPerformance.description"),
        href: "/reports/payment-performance",
        icon: Timer,
      },
      {
        title: t("items.duplicates.title"),
        description: t("items.duplicates.description"),
        href: "/reports/duplicate-detection",
        icon: Copy,
      },
    ],
  },
  {
    title: t("categories.taxTime.title"),
    description: t("categories.taxTime.description"),
    reports: [
      {
        title: t("items.vatReturn.title"),
        description: t("items.vatReturn.description"),
        href: "/reports/vat-return",
        icon: FileCheck2,
      },
      {
        title: t("items.taxSummary.title"),
        description: t("items.taxSummary.description"),
        href: "/reports/tax-summary",
        icon: Receipt,
      },
      {
        title: t("items.vendor1099.title"),
        description: t("items.vendor1099.description"),
        href: "/reports/1099",
        icon: FileText,
      },
    ],
  },
  {
    title: t("categories.planning.title"),
    description: t("categories.planning.description"),
    reports: [
      {
        title: t("items.forecast.title"),
        description: t("items.forecast.description"),
        href: "/reports/cash-flow-forecast",
        icon: Compass,
      },
      {
        title: t("items.calendar.title"),
        description: t("items.calendar.description"),
        href: "/reports/financial-calendar",
        icon: CalendarDays,
      },
      {
        title: t("items.ratios.title"),
        description: t("items.ratios.description"),
        href: "/reports/financial-ratios",
        icon: Gauge,
      },
    ],
  },
  {
    title: t("categories.accountant.title"),
    description: t("categories.accountant.description"),
    reports: [
      {
        title: t("items.trialBalance.title"),
        description: t("items.trialBalance.description"),
        href: "/reports/trial-balance",
        icon: Scale,
      },
      {
        title: t("items.ledger.title"),
        description: t("items.ledger.description"),
        href: "/reports/general-ledger",
        icon: BookOpen,
      },
      {
        title: t("items.comparativeBalance.title"),
        description: t("items.comparativeBalance.description"),
        href: "/reports/comparative-balance-sheet",
        icon: GitCompareArrows,
      },
      {
        title: t("items.consolidation.title"),
        description: t("items.consolidation.description"),
        href: "/reports/consolidation",
        icon: Building2,
      },
    ],
  },
  {
    title: t("categories.operations.title"),
    description: t("categories.operations.description"),
    reports: [
      {
        title: t("items.reconciliation.title"),
        description: t("items.reconciliation.description"),
        href: "/reports/bank-reconciliation-status",
        icon: FileCheck2,
      },
      {
        title: t("items.bankCashFlow.title"),
        description: t("items.bankCashFlow.description"),
        href: "/reports/bank-cash-flow",
        icon: ArrowDownUp,
      },
      {
        title: t("items.saved.title"),
        description: t("items.saved.description"),
        href: "/reports/saved",
        icon: FileText,
      },
      {
        title: t("items.schedules.title"),
        description: t("items.schedules.description"),
        href: "/reports/schedules",
        icon: CalendarDays,
      },
    ],
  },
  ];
}

export default function ReportsPage() {
  const t = useTranslations("Reports");
  const reportCategories = useReportCategories();
  useDocumentTitle(t("documentTitle"));
  return (
    <ContentReveal>
      <div className="space-y-6 sm:space-y-10">
        {reportCategories.map((category, i) => (
          <div key={category.title}>
            {i > 0 && <div className="mb-6 sm:mb-10 h-px bg-border" />}
            <Section title={category.title} description={category.description}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                {category.reports.map((report) => (
                  <Link
                    key={report.href}
                    href={report.href}
                    className="group rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 sm:p-6 shadow-sm transition-all duration-150 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5"
                  >
                    <div className="flex size-9 sm:size-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                      <report.icon className="size-4 sm:size-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="mt-3 sm:mt-4 text-sm font-semibold">{report.title}</h3>
                    <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                      {report.description}
                    </p>
                  </Link>
                ))}
              </div>
            </Section>
          </div>
        ))}
      </div>
    </ContentReveal>
  );
}
