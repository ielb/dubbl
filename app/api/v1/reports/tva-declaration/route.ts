import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoice } from "@/lib/db/schema";
import { eq, and, gte, lte, isNull, sql, notInArray } from "drizzle-orm";
import { getAuthContext } from "@/lib/api/auth-context";
import { requireRole } from "@/lib/api/require-role";
import { handleError } from "@/lib/api/response";
import { getOrgTaxConfig, resolveBasis, controlAccountMovement } from "@/lib/reports/tax-return";

/**
 * Moroccan TVA declaration for a period.
 *
 * Box 2 (TVA facturee) and box 3 (TVA deductible) come from the ledger control
 * accounts (4455 / 3455 — see the MA chart-of-accounts template) so they
 * reflect every posting source, not just invoiceLine/billLine.taxAmount.
 * Unlike the UK/EU-style VAT return, there are no reverse-charge / EC-sales
 * boxes here — Morocco's TVA declaration has no cross-border equivalent.
 *
 * Box numbering approximates the DGI "Declaration de la TVA" layout and is
 * not verified against the official form; confirm before relying on this for
 * actual tax filing.
 */
export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    requireRole(ctx, "view:data");
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate") || "";
    const endDate = url.searchParams.get("endDate") || "";

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
    }

    const config = await getOrgTaxConfig(ctx.organizationId);
    const basis = resolveBasis(url.searchParams.get("basis"), config);

    const outputMovement = await controlAccountMovement(
      ctx.organizationId,
      "4455",
      startDate,
      endDate,
      basis
    );
    const inputMovement = await controlAccountMovement(
      ctx.organizationId,
      "3455",
      startDate,
      endDate,
      basis
    );

    const totalSales = await db
      .select({ total: sql<number>`COALESCE(SUM(${invoice.subtotal}), 0)`.mapWith(Number) })
      .from(invoice)
      .where(and(
        eq(invoice.organizationId, ctx.organizationId),
        gte(invoice.issueDate, startDate),
        lte(invoice.issueDate, endDate),
        notInArray(invoice.status, ["draft", "void"]),
        isNull(invoice.deletedAt)
      ));

    const box1 = totalSales[0]?.total || 0;
    const box2 = outputMovement.credits - outputMovement.debits;
    const box3 = inputMovement.debits - inputMovement.credits;
    const box4 = box2 - box3;

    const boxes = [
      { box: "1", label: "Chiffre d'affaires imposable (base imposable)", amount: box1 },
      { box: "2", label: "TVA facturee (output TVA)", amount: box2 },
      { box: "3", label: "TVA deductible / recuperable (input TVA)", amount: box3 },
      { box: "4", label: "TVA due / Credit de TVA (Box 2 - Box 3)", amount: box4 },
    ];

    return NextResponse.json({
      boxes,
      period: { startDate, endDate },
      basis,
    });
  } catch (err) {
    return handleError(err);
  }
}
