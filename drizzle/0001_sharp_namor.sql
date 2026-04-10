ALTER TABLE "eligibility_conditions" ADD COLUMN "priority_rank" integer;--> statement-breakpoint
ALTER TABLE "eligibility_conditions" ADD COLUMN "child_age_max" integer;--> statement-breakpoint
ALTER TABLE "eligibility_conditions" ADD COLUMN "work_duration_months" integer;--> statement-breakpoint
ALTER TABLE "eligibility_conditions" ADD COLUMN "max_residence_years" integer;--> statement-breakpoint
ALTER TABLE "eligibility_conditions" ADD COLUMN "parent_income_included" boolean;--> statement-breakpoint
ALTER TABLE "eligibility_conditions" ADD COLUMN "scoring_criteria" jsonb;