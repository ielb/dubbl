"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { setLocale } from "@/lib/actions/set-locale";
import type { Locale } from "@/i18n/request";
import { useRouter } from "next/navigation";

export function LocaleSwitcher() {
  const t = useTranslations("UserMenu");
  const locale = useLocale();
  const router = useRouter();
  const [, startTransition] = useTransition();

  function handleChange(value: string) {
    const next = value as Locale;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2.5 rounded-lg px-2.5 py-2 text-[13px]">
        <Globe className="size-4 text-muted-foreground" />
        {t("language")}
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup value={locale} onValueChange={handleChange}>
            <DropdownMenuRadioItem value="en" className="text-[13px]">
              {t("english")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="fr" className="text-[13px]">
              {t("french")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
