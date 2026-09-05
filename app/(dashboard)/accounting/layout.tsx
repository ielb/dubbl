"use client";

import { ArrowLeftRight, BookOpen, Landmark, Building2, PiggyBank, HandCoins, Scale, CalendarRange, Repeat, Layers } from "lucide-react";
import { TabLayout } from "@/components/dashboard/tab-layout";
import { useTranslations } from "next-intl";

export default function AccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("Accounting");
  const tabs = [
    { href: "/accounting", label: t("tabs.transactions"), icon: ArrowLeftRight, exact: true },
    { href: "/accounting/accounts", label: t("tabs.accounts"), icon: BookOpen },
    { href: "/accounting/banking", label: t("tabs.banking"), icon: Landmark },
    { href: "/accounting/loans", label: t("tabs.loans"), icon: HandCoins, title: t("tabs.loansHelp") },
    { href: "/accounting/fixed-assets", label: t("tabs.fixedAssets"), icon: Building2 },
    { href: "/accounting/asset-categories", label: t("tabs.assetCategories"), icon: Layers, title: t("tabs.assetCategoriesHelp") },
    { href: "/accounting/budgets", label: t("tabs.budgets"), icon: PiggyBank },
    { href: "/accounting/opening-balances", label: t("tabs.openingBalances"), icon: Scale, title: t("tabs.openingBalancesHelp") },
    { href: "/accounting/accruals", label: t("tabs.accruals"), icon: CalendarRange, title: t("tabs.accrualsHelp") },
    { href: "/accounting/recurring-journals", label: t("tabs.recurringJournals"), icon: Repeat, title: t("tabs.recurringJournalsHelp") },
  ];
  return <TabLayout tabs={tabs}>{children}</TabLayout>;
}
