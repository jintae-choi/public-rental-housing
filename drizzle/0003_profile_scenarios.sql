-- Phase 3: 프로필 시나리오 테이블 도입 (옵션 A)
--
-- 목표:
--   1) profile_scenarios 테이블 신설 — 사용자당 최대 3개 (앱 레벨 enforce)
--   2) user_profiles에서 시나리오 레벨 컬럼을 이관 (기본 시나리오로 자동 백필)
--   3) eligibility_results에 scenario_id 컬럼 추가
--   4) RLS 정책 추가 (profile_scenarios 본인만)
--
-- 이관 대상 컬럼:
--   household_types, marital_status, planned_marriage_date, household_members,
--   monthly_income, total_assets, car_value,
--   spouse_birth_date, spouse_income, spouse_assets, spouse_workplace

-- ─── 1. profile_scenarios 테이블 생성 ──────────────────────────────────────
CREATE TABLE "profile_scenarios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "household_types" text[],
  "marital_status" "marital_status",
  "planned_marriage_date" date,
  "household_members" integer,
  "monthly_income" integer,
  "total_assets" integer,
  "car_value" integer,
  "spouse_birth_date" date,
  "spouse_income" integer,
  "spouse_assets" integer,
  "spouse_workplace" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ─── 2. 기존 user_profiles 데이터 → 기본 시나리오로 백필 ────────────────────
-- 모든 기존 프로필에 대해 "기본" 시나리오 1개 생성 (is_default=true)
INSERT INTO "profile_scenarios" (
  "user_id", "name", "is_default",
  "household_types", "marital_status", "planned_marriage_date", "household_members",
  "monthly_income", "total_assets", "car_value",
  "spouse_birth_date", "spouse_income", "spouse_assets", "spouse_workplace"
)
SELECT
  "user_id", '기본', true,
  "household_types", "marital_status", "planned_marriage_date", "household_members",
  "monthly_income", "total_assets", "car_value",
  "spouse_birth_date", "spouse_income", "spouse_assets", "spouse_workplace"
FROM "user_profiles";
--> statement-breakpoint

-- ─── 3. user_profiles에서 이관된 컬럼 드랍 ─────────────────────────────────
ALTER TABLE "user_profiles" DROP COLUMN "household_types";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "marital_status";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "planned_marriage_date";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "household_members";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "monthly_income";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "total_assets";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "car_value";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "spouse_birth_date";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "spouse_income";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "spouse_assets";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "spouse_workplace";--> statement-breakpoint

-- ─── 4. eligibility_results에 scenario_id 컬럼 추가 ────────────────────────
-- 기존 결과는 scenario_id를 backfill할 방법이 없어 전부 삭제 (Phase 3 전 개발 데이터만 있음)
DELETE FROM "eligibility_results";--> statement-breakpoint
ALTER TABLE "eligibility_results"
  ADD COLUMN "scenario_id" uuid NOT NULL
  REFERENCES "profile_scenarios"("id") ON DELETE CASCADE;--> statement-breakpoint

-- ─── 5. 인덱스 ─────────────────────────────────────────────────────────────
CREATE INDEX "profile_scenarios_user_id_idx" ON "profile_scenarios" ("user_id");--> statement-breakpoint
CREATE INDEX "eligibility_results_scenario_id_idx" ON "eligibility_results" ("scenario_id");--> statement-breakpoint
CREATE INDEX "eligibility_results_user_scenario_announcement_idx"
  ON "eligibility_results" ("user_id", "scenario_id", "announcement_id");--> statement-breakpoint

-- ─── 6. profile_scenarios RLS 정책 ─────────────────────────────────────────
ALTER TABLE "profile_scenarios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "profile_scenarios_select_own"
  ON "profile_scenarios"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);--> statement-breakpoint

CREATE POLICY "profile_scenarios_insert_own"
  ON "profile_scenarios"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);--> statement-breakpoint

CREATE POLICY "profile_scenarios_update_own"
  ON "profile_scenarios"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);--> statement-breakpoint

CREATE POLICY "profile_scenarios_delete_own"
  ON "profile_scenarios"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
