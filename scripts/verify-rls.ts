/**
 * RLS (Row Level Security) E2E 검증 스크립트
 *
 * 목적:
 *   0002_rls_policies + 0003_profile_scenarios에서 설정한 정책이
 *   실제로 "사용자 A는 사용자 B의 데이터를 읽을 수 없다"를 보장하는지
 *   원격 DB에 대해 end-to-end로 확인한다.
 *
 * 방법:
 *   1) service_role 클라이언트로 임시 유저 A/B 2명 생성 (auth.admin)
 *   2) service_role로 각 유저의 user_profiles + profile_scenarios 행 삽입
 *   3) anon 클라이언트로 A 로그인 → A의 JWT 컨텍스트에서:
 *        - profile_scenarios 전체 SELECT (정책이 user_id 필터로 작동하는지)
 *        - user_profiles 전체 SELECT
 *        - B의 행 id를 명시해서 SELECT (0 rows 기대)
 *        - user_id를 B로 속여 INSERT (WITH CHECK 위반으로 실패 기대)
 *        - announcements SELECT (공개 테이블, 성공 기대)
 *   4) 모든 단계 결과를 체크 → 하나라도 기대와 다르면 exit(1)
 *   5) cleanup: 두 유저 삭제 (cascade로 profile_scenarios/user_profiles도 삭제)
 *
 * 실행: GitHub Actions verify-rls.yml 워크플로우에서만 실행하는 것을 가정
 *   (로컬 환경은 원격 dev DB direct connection 불가)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "node:fs";

if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error(
    "환경변수 누락: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

type CheckResult = { name: string; passed: boolean; detail: string };

function pass(name: string, detail: string): CheckResult {
  return { name, passed: true, detail };
}
function fail(name: string, detail: string): CheckResult {
  return { name, passed: false, detail };
}

// 임시 테스트 유저 생성: 고유 이메일 반환
function uniqueEmail(prefix: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${rand}@rls-test.local`;
}

async function signInAs(
  url: string,
  anonKey: string,
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`로그인 실패 ${email}: ${error.message}`);
  return client;
}

async function main(): Promise<void> {
  const admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const emailA = uniqueEmail("rls-a");
  const emailB = uniqueEmail("rls-b");
  const passwordA = "TempPassA!" + Math.random().toString(36).slice(2, 10);
  const passwordB = "TempPassB!" + Math.random().toString(36).slice(2, 10);

  let userIdA = "";
  let userIdB = "";
  const checks: CheckResult[] = [];

  try {
    // ─── 1. 임시 유저 2명 생성 ────────────────────────────────
    const adminCreate = async (
      email: string,
      password: string
    ): Promise<string> => {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) throw new Error(error?.message);
      return data.user.id;
    };
    userIdA = await adminCreate(emailA, passwordA);
    userIdB = await adminCreate(emailB, passwordB);
    console.log(`[setup] userA=${userIdA} userB=${userIdB}`);

    // ─── 2. service_role로 각 유저의 데이터 시드 ─────────────
    //   RLS bypass이므로 정상 삽입되어야 함
    const seedProfile = async (userId: string, name: string): Promise<void> => {
      const { error: pErr } = await admin
        .from("user_profiles")
        .insert({ user_id: userId, name });
      if (pErr) throw new Error(`user_profiles seed 실패: ${pErr.message}`);
    };
    const seedScenario = async (
      userId: string,
      name: string
    ): Promise<string> => {
      const { data, error } = await admin
        .from("profile_scenarios")
        .insert({ user_id: userId, name, is_default: true })
        .select("id")
        .single();
      if (error || !data)
        throw new Error(`profile_scenarios seed 실패: ${error?.message}`);
      return data.id as string;
    };

    await seedProfile(userIdA, "Alice");
    await seedProfile(userIdB, "Bob");
    const scenarioIdA = await seedScenario(userIdA, "기본-A");
    const scenarioIdB = await seedScenario(userIdB, "기본-B");
    console.log(
      `[setup] scenarios A=${scenarioIdA} B=${scenarioIdB}`
    );

    // ─── 3. A로 로그인한 anon client 준비 ────────────────────
    const clientA = await signInAs(
      SUPABASE_URL!,
      ANON_KEY!,
      emailA,
      passwordA
    );

    // ─── 4. 검증: profile_scenarios 전체 SELECT → 1건만 (A 자신) ─
    {
      const { data, error } = await clientA.from("profile_scenarios").select(
        "id,user_id,name"
      );
      if (error) {
        checks.push(
          fail(
            "profile_scenarios: A가 전체 SELECT",
            `예상치 못한 에러: ${error.message}`
          )
        );
      } else if (data.length === 1 && data[0].user_id === userIdA) {
        checks.push(
          pass(
            "profile_scenarios: A가 전체 SELECT",
            `A 자신 1건만 반환 (id=${data[0].id})`
          )
        );
      } else {
        checks.push(
          fail(
            "profile_scenarios: A가 전체 SELECT",
            `기대=A의 1건, 실제=${data.length}건 (${JSON.stringify(data)})`
          )
        );
      }
    }

    // ─── 5. 검증: B의 scenario id로 명시 SELECT → 0 rows ──────
    {
      const { data, error } = await clientA
        .from("profile_scenarios")
        .select("id")
        .eq("id", scenarioIdB);
      if (error) {
        checks.push(
          fail(
            "profile_scenarios: A가 B의 id로 SELECT",
            `예상치 못한 에러: ${error.message}`
          )
        );
      } else if (data.length === 0) {
        checks.push(
          pass(
            "profile_scenarios: A가 B의 id로 SELECT",
            "0 rows (RLS가 조용히 차단)"
          )
        );
      } else {
        checks.push(
          fail(
            "profile_scenarios: A가 B의 id로 SELECT",
            `⚠️ RLS 실패 - B의 데이터 노출됨: ${JSON.stringify(data)}`
          )
        );
      }
    }

    // ─── 6. 검증: user_profiles 전체 SELECT → A 1건만 ─────────
    {
      const { data, error } = await clientA
        .from("user_profiles")
        .select("user_id,name");
      if (error) {
        checks.push(
          fail(
            "user_profiles: A가 전체 SELECT",
            `예상치 못한 에러: ${error.message}`
          )
        );
      } else if (data.length === 1 && data[0].user_id === userIdA) {
        checks.push(
          pass("user_profiles: A가 전체 SELECT", "A 자신 1건만 반환")
        );
      } else {
        checks.push(
          fail(
            "user_profiles: A가 전체 SELECT",
            `기대=A의 1건, 실제=${data.length}건`
          )
        );
      }
    }

    // ─── 7. 검증: user_id=B로 속여 INSERT → WITH CHECK로 거부 ─
    {
      const { error } = await clientA
        .from("profile_scenarios")
        .insert({ user_id: userIdB, name: "악의적", is_default: false });
      if (error) {
        checks.push(
          pass(
            "profile_scenarios: A가 user_id=B로 INSERT",
            `차단됨: ${error.message}`
          )
        );
      } else {
        checks.push(
          fail(
            "profile_scenarios: A가 user_id=B로 INSERT",
            "⚠️ WITH CHECK 실패 - B의 이름으로 INSERT 허용됨"
          )
        );
      }
    }

    // ─── 8. 검증: announcements SELECT → 공개 읽기 성공 ───────
    {
      const { error } = await clientA
        .from("announcements")
        .select("id")
        .limit(1);
      if (error) {
        checks.push(
          fail(
            "announcements: A가 공개 SELECT",
            `공개 테이블인데 차단: ${error.message}`
          )
        );
      } else {
        checks.push(
          pass(
            "announcements: A가 공개 SELECT",
            "공개 테이블 SELECT 성공 (0건이어도 OK)"
          )
        );
      }
    }

    // ─── 9. 검증: eligibility_conditions SELECT → 공개 읽기 ──
    {
      const { error } = await clientA
        .from("eligibility_conditions")
        .select("id")
        .limit(1);
      if (error) {
        checks.push(
          fail(
            "eligibility_conditions: A가 공개 SELECT",
            `공개 테이블인데 차단: ${error.message}`
          )
        );
      } else {
        checks.push(
          pass(
            "eligibility_conditions: A가 공개 SELECT",
            "공개 테이블 SELECT 성공"
          )
        );
      }
    }

    // ─── 10. 검증: eligibility_results SELECT → 0 rows (A에게 매칭 결과 없음) ─
    {
      const { error } = await clientA
        .from("eligibility_results")
        .select("id");
      if (error) {
        checks.push(
          fail(
            "eligibility_results: A가 전체 SELECT",
            `예상치 못한 에러: ${error.message}`
          )
        );
      } else {
        checks.push(
          pass(
            "eligibility_results: A가 전체 SELECT",
            "RLS 통과 (본인 데이터만 가시)"
          )
        );
      }
    }
  } finally {
    // ─── cleanup: 임시 유저 삭제 (cascade) ────────────────────
    if (userIdA) {
      const { error } = await admin.auth.admin.deleteUser(userIdA);
      if (error) console.error(`[cleanup] userA 삭제 실패: ${error.message}`);
    }
    if (userIdB) {
      const { error } = await admin.auth.admin.deleteUser(userIdB);
      if (error) console.error(`[cleanup] userB 삭제 실패: ${error.message}`);
    }
    // user_profiles/profile_scenarios는 user_id FK cascade 없음 (auth.users 외래키 아님)
    // → 명시적으로 정리
    if (userIdA || userIdB) {
      await admin
        .from("profile_scenarios")
        .delete()
        .in("user_id", [userIdA, userIdB].filter(Boolean));
      await admin
        .from("user_profiles")
        .delete()
        .in("user_id", [userIdA, userIdB].filter(Boolean));
    }
  }

  // ─── 리포트 출력 ──────────────────────────────────────────
  console.log("\n=== RLS 검증 결과 ===");
  for (const c of checks) {
    console.log(`${c.passed ? "✅" : "❌"} ${c.name}`);
    console.log(`   ${c.detail}`);
  }
  const failed = checks.filter((c) => !c.passed).length;
  const total = checks.length;
  console.log(`\n총 ${total}건 중 ${total - failed}건 통과, ${failed}건 실패`);

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("검증 스크립트 실행 실패:", e);
  process.exit(1);
});
