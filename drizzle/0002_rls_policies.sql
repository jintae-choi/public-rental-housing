-- Phase 3 진입 전 RLS(Row Level Security) 기본 정책
-- 목적:
--   1) user_profiles / eligibility_results / notifications: 사용자 본인 데이터만 접근
--   2) announcements / eligibility_conditions: 모두 읽기 가능 (공개 데이터), 쓰기는 service_role만
--
-- 주의사항:
--   - Supabase에서 auth.uid() 는 JWT에 담긴 user id 반환
--   - service_role key로 접근하면 RLS를 bypass 하므로 서버사이드 스크립트(analyze/match/scrape)는 영향 없음
--   - 프론트엔드는 anon / authenticated role 사용 → 반드시 RLS 정책 거침
--   - Phase 3에서 profile_scenarios 테이블 추가 시 이 파일에 이어서 정책 추가

-- ─── 공개 테이블: announcements ──────────────────────────────────────────────
ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_select_all"
  ON "announcements"
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- INSERT/UPDATE/DELETE는 service_role만 (RLS bypass로 자동 허용)

-- ─── 공개 테이블: eligibility_conditions ────────────────────────────────────
ALTER TABLE "eligibility_conditions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eligibility_conditions_select_all"
  ON "eligibility_conditions"
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- ─── 사용자 전용: user_profiles ─────────────────────────────────────────────
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles_select_own"
  ON "user_profiles"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_profiles_insert_own"
  ON "user_profiles"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_profiles_update_own"
  ON "user_profiles"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_profiles_delete_own"
  ON "user_profiles"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── 사용자 전용: eligibility_results ───────────────────────────────────────
-- 쓰기는 매처(service_role)만, 읽기는 본인만
ALTER TABLE "eligibility_results" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eligibility_results_select_own"
  ON "eligibility_results"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── 사용자 전용: notifications ─────────────────────────────────────────────
-- 쓰기는 알림 발송 스크립트(service_role)만, 읽기/삭제(읽음 처리)는 본인만
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own"
  ON "notifications"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own"
  ON "notifications"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
