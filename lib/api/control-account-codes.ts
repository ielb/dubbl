import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Per-country chart-account codes for the roles journal-automation.ts posts
 * to. journal-automation.ts historically hardcoded the GENERIC_ACCOUNTS
 * codes (AR "1200", AP "2100", output VAT "2200", input VAT "1500")
 * everywhere, which only matches orgs on the generic chart (US/GB/ZA/AU/CA/
 * IE/IN/NL). Every localized chart-of-accounts template (lib/db/chart-
 * templates/*) uses different real codes, so those orgs' invoices/bills
 * silently failed to post (AR/AP lookup miss -> null return) and their VAT
 * silently posted to a manufactured generic account instead of their real one.
 *
 * Codes below are read directly off each template file's own AR/AP/VAT rows.
 */
export interface ControlAccountCodes {
  ar: string;
  ap: string;
  outputVat?: string;
  inputVat?: string;
}

const GENERIC_CONTROL_CODES: ControlAccountCodes = {
  ar: "1200",
  ap: "2100",
  outputVat: "2200",
  inputVat: "1500",
};

/**
 * Country-specific overrides, layered on top of GENERIC_CONTROL_CODES.
 *
 * AT has a domestic/EU receivable split (2000/2100) — the domestic code is
 * used as the single AR default, same simplification every other
 * single-account country already has.
 *
 * SE's BAS chart splits output VAT by rate (25%/12%/6%) — 2610 (25%,
 * standard rate) is used as the default; still correct more often than the
 * prior status quo of posting to a nonexistent 2200.
 *
 * BR has no unified VAT concept (ICMS/ISS/PIS/COFINS are separate itemized
 * taxes) — only ar/ap are mapped here; VAT-style control-account posting for
 * Brazil is a separate, larger gap.
 */
const COUNTRY_CONTROL_CODES: Record<string, Partial<ControlAccountCodes>> = {
  FR: { ar: "411", ap: "401", outputVat: "4457", inputVat: "4456" },
  ES: { ar: "430", ap: "400", outputVat: "477", inputVat: "472" },
  BE: { ar: "400", ap: "440", outputVat: "451", inputVat: "411" },
  DE: { ar: "1400", ap: "1600", outputVat: "1776", inputVat: "1576" },
  IT: { ar: "1401", ap: "2401", outputVat: "2403", inputVat: "1404" },
  PT: { ar: "21", ap: "22", outputVat: "2433", inputVat: "2432" },
  AT: { ar: "2000", ap: "3300", outputVat: "3500", inputVat: "2500" },
  SE: { ar: "1510", ap: "2440", outputVat: "2610", inputVat: "2640" },
  BR: { ar: "1.1.04", ap: "2.1.01" },
  MA: { ar: "3421", ap: "4411", outputVat: "4455", inputVat: "3455" },
};

/** Resolve control-account codes for a country code (case-insensitive). */
export function getControlCodes(countryCode: string | null | undefined): ControlAccountCodes {
  const override = countryCode ? COUNTRY_CONTROL_CODES[countryCode.trim().toUpperCase()] : undefined;
  return { ...GENERIC_CONTROL_CODES, ...override };
}

/**
 * Resolve control-account codes for an org by looking up its countryCode.
 * Always reads through the pool (not a caller's transaction) — countryCode
 * isn't mutated concurrently with a journal-entry post, so there's no
 * consistency reason to read it inside the same transaction.
 */
export async function getControlCodesForOrg(organizationId: string): Promise<ControlAccountCodes> {
  const org = await db.query.organization.findFirst({
    where: eq(organization.id, organizationId),
    columns: { countryCode: true },
  });
  return getControlCodes(org?.countryCode);
}
