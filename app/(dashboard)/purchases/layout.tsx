"use client";

import { Receipt, CreditCard, ClipboardList, ClipboardCheck, PackageOpen, Undo2, PackageCheck, Repeat } from "lucide-react";
import { TabLayout } from "@/components/dashboard/tab-layout";
import { useTranslations } from "next-intl";

export default function PurchasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("Purchases");
  const tabs = [
    { href: "/purchases", label: t("tabs.bills"), icon: Receipt, exact: true },
    { href: "/purchases/bills/recurring", label: t("tabs.recurringBills"), icon: Repeat, title: t("tabs.recurringBillsHelp") },
    { href: "/purchases/debit-notes", label: t("tabs.supplierCredits"), icon: Undo2, title: t("tabs.supplierCreditsHelp") },
    { href: "/purchases/expenses", label: t("tabs.expenses"), icon: CreditCard },
    { href: "/purchases/orders", label: t("tabs.purchaseOrders"), icon: ClipboardList },
    { href: "/purchases/goods-receipts", label: t("tabs.goodsReceived"), icon: PackageCheck, title: t("tabs.goodsReceivedHelp") },
    { href: "/purchases/requisitions", label: t("tabs.requisitions"), icon: ClipboardCheck },
    { href: "/purchases/landed-costs", label: t("tabs.landedCosts"), icon: PackageOpen, title: t("tabs.landedCostsHelp") },
  ];
  return <TabLayout tabs={tabs}>{children}</TabLayout>;
}
