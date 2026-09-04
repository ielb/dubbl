"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Lock } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CurrencySelect } from "@/components/ui/currency-select";
import { cn } from "@/lib/utils";
import { COUNTRIES as ALL_COUNTRIES } from "@/lib/countries";
import { PAYMENT_TERMS } from "@/lib/payment-terms";
import {
  COUNTRIES as BUSINESS_COUNTRIES,
  getBusinessTypesForCountry,
  getCountryByCode,
} from "@/lib/data/business-types";
import { Section } from "@/components/dashboard/section";

interface OrgSettings {
  id: string;
  name: string;
  country: string | null;
  businessType: string | null;
  defaultCurrency: string;
  fiscalYearStartMonth: number;
  countryCode: string | null;
  taxId: string | null;
  businessRegistrationNumber: string | null;
  legalEntityType: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactWebsite: string | null;
  defaultPaymentTerms: string | null;
  industrySector: string | null;
}

export default function SettingsPage() {
  const t = useTranslations("Settings");
  const locale = useLocale();
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2000, i, 1))
      ),
    [locale]
  );
  const [, setOrg] = useState<OrgSettings | null>(null);
  const [form, setForm] = useState({
    name: "",
    country: "" as string,
    businessType: "" as string,
    defaultCurrency: "USD",
    fiscalYearStartMonth: "1",
    countryCode: "",
    taxId: "",
    businessRegistrationNumber: "",
    legalEntityType: "",
    addressStreet: "",
    addressCity: "",
    addressState: "",
    addressPostalCode: "",
    addressCountry: "",
    contactPhone: "",
    contactEmail: "",
    contactWebsite: "",
    defaultPaymentTerms: "",
    industrySector: "",
  });
  const [saving, setSaving] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [lockDate, setLockDate] = useState("");
  const [lockSaving, setLockSaving] = useState(false);
  const [peppolId, setPeppolId] = useState("");
  const [peppolScheme, setPeppolScheme] = useState("");

  useDocumentTitle(t("documentTitle"));

  const businessTypes = useMemo(
    () => (form.countryCode ? getBusinessTypesForCountry(form.countryCode) : []),
    [form.countryCode]
  );

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    // Fetch period lock
    fetch("/api/v1/period-lock", {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.lock?.lockDate) setLockDate(data.lock.lockDate);
      })
      .catch(() => {});

    fetch("/api/v1/organization", {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.organization) {
          const o = data.organization;
          setOrg(o);
          setPeppolId(o.peppolId || "");
          setPeppolScheme(o.peppolScheme || "");
          setForm({
            name: o.name,
            country: o.country ?? "",
            businessType: o.businessType ?? "",
            defaultCurrency: o.defaultCurrency,
            fiscalYearStartMonth: String(o.fiscalYearStartMonth),
            countryCode: o.countryCode || "",
            taxId: o.taxId || "",
            businessRegistrationNumber: o.businessRegistrationNumber || "",
            legalEntityType: o.legalEntityType || "",
            addressStreet: o.addressStreet || "",
            addressCity: o.addressCity || "",
            addressState: o.addressState || "",
            addressPostalCode: o.addressPostalCode || "",
            addressCountry: o.addressCountry || "",
            contactPhone: o.contactPhone || "",
            contactEmail: o.contactEmail || "",
            contactWebsite: o.contactWebsite || "",
            defaultPaymentTerms: o.defaultPaymentTerms || "",
            industrySector: o.industrySector || "",
          });
        }
      });
  }, []);

  function handleCountryChange(countryCode: string) {
    const country = getCountryByCode(countryCode);
    setForm((prev) => ({
      ...prev,
      country: country?.name ?? countryCode,
      businessType: "",
      countryCode: countryCode,
      ...(country ? { defaultCurrency: country.defaultCurrency } : {}),
    }));
    setCountryOpen(false);
  }

  async function save() {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/organization", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          name: form.name,
          country: form.country || null,
          businessType: form.businessType || null,
          defaultCurrency: form.defaultCurrency,
          fiscalYearStartMonth: parseInt(form.fiscalYearStartMonth),
          countryCode: form.countryCode || null,
          taxId: form.taxId || null,
          businessRegistrationNumber: form.businessRegistrationNumber || null,
          legalEntityType: form.legalEntityType || null,
          addressStreet: form.addressStreet || null,
          addressCity: form.addressCity || null,
          addressState: form.addressState || null,
          addressPostalCode: form.addressPostalCode || null,
          addressCountry: form.addressCountry || null,
          contactPhone: form.contactPhone || null,
          contactEmail: form.contactEmail || null,
          contactWebsite: form.contactWebsite || null,
          defaultPaymentTerms: form.defaultPaymentTerms || null,
          industrySector: form.industrySector || null,
          peppolId: peppolId || null,
          peppolScheme: peppolScheme || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(t("toastSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toastSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const selectedCountry = form.countryCode
    ? getCountryByCode(form.countryCode)
    : null;

  return (
    <div className="space-y-10">
      {/* Organization */}
      <Section title={t("organizationTitle")} description={t("organizationDesc")}>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("name")}</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t("namePlaceholder")}
          />
        </div>
      </Section>

      <div className="h-px bg-border" />

      {/* Legal */}
      <Section title={t("legalTitle")} description={t("legalDesc")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("country")}</Label>
            <Popover open={countryOpen} onOpenChange={setCountryOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={countryOpen}
                  className={cn(
                    "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors",
                    "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    !selectedCountry && "text-muted-foreground"
                  )}
                >
                  {selectedCountry
                    ? `${selectedCountry.flag} ${selectedCountry.name}`
                    : t("selectCountry")}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Command>
                  <CommandInput placeholder={t("searchCountry")} />
                  <CommandList>
                    <CommandEmpty>{t("noCountryFound")}</CommandEmpty>
                    <CommandGroup>
                      {BUSINESS_COUNTRIES.map((country) => (
                        <CommandItem
                          key={country.code}
                          value={`${country.name} ${country.code}`}
                          onSelect={() => handleCountryChange(country.code)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              form.countryCode === country.code
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {country.flag} {country.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-[11px] text-muted-foreground">
              {t("countryHelp")}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("businessStructure")}</Label>
            {form.countryCode ? (
              <Select
                value={form.businessType}
                onValueChange={(v) => setForm({ ...form, businessType: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectType")} />
                </SelectTrigger>
                <SelectContent>
                  {businessTypes.map((bt) => (
                    <SelectItem key={bt.code} value={bt.code}>
                      <span>{bt.localName}</span>
                      {bt.localName !== bt.englishName && (
                        <span className="ml-1 text-muted-foreground">
                          ({bt.englishName})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex h-9 items-center rounded-md border border-input px-3 text-xs text-muted-foreground">
                {t("selectCountryFirst")}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("taxId")}</Label>
            <Input
              value={form.taxId}
              onChange={(e) => setForm({ ...form, taxId: e.target.value })}
              placeholder="e.g. US12-3456789"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("registrationNumber")}</Label>
            <Input
              value={form.businessRegistrationNumber}
              onChange={(e) =>
                setForm({ ...form, businessRegistrationNumber: e.target.value })
              }
              placeholder="e.g. 12345678"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("industry")}</Label>
            <Input
              value={form.industrySector}
              onChange={(e) =>
                setForm({ ...form, industrySector: e.target.value })
              }
              placeholder="e.g. Technology"
            />
          </div>
        </div>
      </Section>

      <div className="h-px bg-border" />

      {/* Address */}
      <Section title={t("addressTitle")} description={t("addressDesc")}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("street")}</Label>
            <Input
              value={form.addressStreet}
              onChange={(e) =>
                setForm({ ...form, addressStreet: e.target.value })
              }
              placeholder="123 Main Street"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("city")}</Label>
              <Input
                value={form.addressCity}
                onChange={(e) =>
                  setForm({ ...form, addressCity: e.target.value })
                }
                placeholder="San Francisco"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("state")}</Label>
              <Input
                value={form.addressState}
                onChange={(e) =>
                  setForm({ ...form, addressState: e.target.value })
                }
                placeholder="California"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("postalCode")}</Label>
              <Input
                value={form.addressPostalCode}
                onChange={(e) =>
                  setForm({ ...form, addressPostalCode: e.target.value })
                }
                placeholder="94105"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("addressCountry")}</Label>
              <Select
                value={form.addressCountry}
                onValueChange={(v) => setForm({ ...form, addressCountry: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectCountryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {ALL_COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Section>

      <div className="h-px bg-border" />

      {/* Contact */}
      <Section title={t("contactTitle")} description={t("contactDesc")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("phone")}</Label>
            <Input
              value={form.contactPhone}
              onChange={(e) =>
                setForm({ ...form, contactPhone: e.target.value })
              }
              placeholder="+1 (555) 123-4567"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("email")}</Label>
            <Input
              type="email"
              value={form.contactEmail}
              onChange={(e) =>
                setForm({ ...form, contactEmail: e.target.value })
              }
              placeholder="billing@company.com"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">{t("website")}</Label>
            <Input
              value={form.contactWebsite}
              onChange={(e) =>
                setForm({ ...form, contactWebsite: e.target.value })
              }
              placeholder="https://company.com"
            />
          </div>
        </div>
      </Section>

      <div className="h-px bg-border" />

      {/* Financials */}
      <Section title={t("financialsTitle")} description={t("financialsDesc")}>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("defaultCurrency")}</Label>
            <CurrencySelect
              value={form.defaultCurrency}
              onValueChange={(v) =>
                setForm({ ...form, defaultCurrency: v })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("fiscalYearStart")}</Label>
            <Select
              value={form.fiscalYearStartMonth}
              onValueChange={(v) =>
                setForm({ ...form, fiscalYearStartMonth: v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("paymentTerms")}</Label>
            <Select
              value={form.defaultPaymentTerms}
              onValueChange={(v) =>
                setForm({ ...form, defaultPaymentTerms: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("selectTerms")} />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TERMS.map((pt) => (
                  <SelectItem key={pt.value} value={pt.value}>
                    {pt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      <div className="h-px bg-border" />

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={save}
          disabled={saving}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {saving ? t("saving") : t("saveChanges")}
        </Button>
      </div>

      <div className="h-px bg-border" />

      {/* E-Invoicing / PEPPOL */}
      <Section title={t("peppolTitle")} description={t("peppolDesc")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("peppolId")}</Label>
            <Input
              value={peppolId}
              onChange={(e) => setPeppolId(e.target.value)}
              placeholder="e.g. 0088:1234567890"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("peppolScheme")}</Label>
            <Select
              value={peppolScheme}
              onValueChange={setPeppolScheme}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("selectScheme")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0088">0088 - EAN/GLN</SelectItem>
                <SelectItem value="0007">0007 - SE Org Nr</SelectItem>
                <SelectItem value="0009">0009 - FR SIRET</SelectItem>
                <SelectItem value="0088">0088 - GLN</SelectItem>
                <SelectItem value="9925">9925 - IT VAT</SelectItem>
                <SelectItem value="9930">9930 - DE VAT</SelectItem>
                <SelectItem value="9944">9944 - GB VAT</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {t("peppolHelp")}
        </p>
      </Section>

      <div className="h-px bg-border" />

      {/* Period Lock */}
      <Section title={t("lockTitle")} description={t("lockDesc")}>
        <div className="flex items-end gap-3">
          <div className="space-y-1.5 flex-1 max-w-xs">
            <Label className="text-xs">{t("lockUpTo")}</Label>
            <Input
              type="date"
              value={lockDate}
              onChange={(e) => setLockDate(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={lockSaving}
            onClick={async () => {
              const orgId = localStorage.getItem("activeOrgId");
              if (!orgId || !lockDate) return;
              setLockSaving(true);
              try {
                const res = await fetch("/api/v1/period-lock", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json", "x-organization-id": orgId },
                  body: JSON.stringify({ lockDate }),
                });
                if (!res.ok) {
                  const data = await res.json();
                  toast.error(data.error || t("toastLockFailed"));
                  return;
                }
                toast.success(t("toastLocked"));
              } finally {
                setLockSaving(false);
              }
            }}
          >
            <Lock className="size-3.5" />
            {lockSaving ? t("saving") : t("lockDates")}
          </Button>
        </div>
        {lockDate && (
          <p className="text-xs text-amber-600 mt-2">
            {t("lockHelp", { date: lockDate })}
          </p>
        )}
      </Section>

      <div className="h-px bg-border" />

      {/* Danger zone */}
      <Section title={t("dangerTitle")} description={t("dangerDesc")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/20">
          <div>
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{t("deleteOrg")}</p>
            <p className="text-[12px] text-muted-foreground">
              {t("deleteOrgDesc")}
            </p>
          </div>
          <Button variant="destructive" size="sm" className="w-fit">
            {t("delete")}
          </Button>
        </div>
      </Section>
    </div>
  );
}
