"use client";

import { Package, ClipboardList, Warehouse, BarChart3, ArrowLeftRight } from "lucide-react";
import { TabLayout } from "@/components/dashboard/tab-layout";
import { useTranslations } from "next-intl";

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("Inventory");
  const tabs = [
    { href: "/inventory", label: t("tabs.items"), icon: Package, exact: true },
    { href: "/inventory/stock-takes", label: t("tabs.stocktakes"), icon: ClipboardList },
    { href: "/inventory/warehouses", label: t("tabs.locations"), icon: Warehouse },
    { href: "/inventory/transfers", label: t("tabs.transfers"), icon: ArrowLeftRight },
    { href: "/inventory/valuation", label: t("tabs.stockValue"), icon: BarChart3 },
  ];
  return <TabLayout tabs={tabs}>{children}</TabLayout>;
}
