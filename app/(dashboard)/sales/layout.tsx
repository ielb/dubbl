"use client";

import { FileText, ScrollText, CreditCard, RefreshCw, Banknote, Wallet, CalendarClock, Coins } from "lucide-react";
import { TabLayout } from "@/components/dashboard/tab-layout";
import { useTranslations } from "next-intl";

export default function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("Sales");
  const tabs = [
    { href: "/sales", label: t("tabs.invoices"), icon: FileText, exact: true },
    { href: "/sales/quotes", label: t("tabs.quotes"), icon: ScrollText },
    { href: "/sales/receipts", label: t("tabs.cashSales"), icon: Banknote },
    { href: "/sales/credit-notes", label: t("tabs.creditNotes"), icon: CreditCard },
    { href: "/sales/payments", label: t("tabs.payments"), icon: Coins, title: t("tabs.paymentsHelp") },
    { href: "/sales/customer-prepayments", label: t("tabs.prepayments"), icon: Wallet, title: t("tabs.prepaymentsHelp") },
    { href: "/sales/revenue-schedules", label: t("tabs.revenueSchedules"), icon: CalendarClock, title: t("tabs.revenueSchedulesHelp") },
    { href: "/sales/recurring", label: t("tabs.recurring"), icon: RefreshCw },
  ];
  return <TabLayout tabs={tabs}>{children}</TabLayout>;
}
