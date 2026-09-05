import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taxForm } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAuthContext } from "@/lib/api/auth-context";
import { handleError, notFound, validationError } from "@/lib/api/response";
import { isMoroccanTaxFormType } from "@/lib/payroll/morocco-tax-forms";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    const { id } = await params;
    const form = await db.query.taxForm.findFirst({
      where: eq(taxForm.id, id),
      with: { generation: true },
    });
    if (!form || form.generation.organizationId !== ctx.organizationId) {
      return notFound("Tax form");
    }
    if (isMoroccanTaxFormType(form.formType)) {
      return validationError("PDF export is not available for Moroccan filing documents");
    }

    return NextResponse.json({
      formType: form.formType,
      taxYear: form.taxYear,
      recipientName: form.recipientName,
      recipientTaxId: form.recipientTaxId,
      formData: form.formData,
      note: "PDF generation requires pdf-lib package. Form data returned as JSON.",
    });
  } catch (err) {
    return handleError(err);
  }
}
