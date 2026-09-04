ALTER TABLE "payroll_settings" ADD COLUMN "country" text DEFAULT 'US' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD COLUMN "cnss_monthly_ceiling_cents" integer DEFAULT 600000 NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD COLUMN "cnss_pension_employee_rate_bp" integer DEFAULT 396 NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD COLUMN "cnss_ct_employee_rate_bp" integer DEFAULT 33 NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD COLUMN "cnss_ipe_employee_rate_bp" integer DEFAULT 19 NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD COLUMN "cnss_amo_employee_rate_bp" integer DEFAULT 226 NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD COLUMN "cnss_allocations_familiales_rate_bp" integer DEFAULT 640 NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD COLUMN "cnss_pension_employer_rate_bp" integer DEFAULT 793 NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD COLUMN "cnss_ct_employer_rate_bp" integer DEFAULT 67 NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD COLUMN "cnss_ipe_employer_rate_bp" integer DEFAULT 38 NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD COLUMN "cnss_amo_employer_rate_bp" integer DEFAULT 411 NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD COLUMN "cnss_tfp_rate_bp" integer DEFAULT 160 NOT NULL;