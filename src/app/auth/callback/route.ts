import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // 로그인 후 리다이렉트할 경로 (기본값: 홈)
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    console.error("[Auth Callback] code 파라미터가 없습니다.");
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          },
        },
      }
    );

    // OAuth/Magic Link code를 세션으로 교환
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[Auth Callback] 세션 교환 실패:", error.message);
      return NextResponse.redirect(`${origin}/login?error=session_exchange`);
    }

    return NextResponse.redirect(`${origin}${next}`);
  } catch (err) {
    console.error("[Auth Callback] 예상치 못한 오류:", err);
    return NextResponse.redirect(`${origin}/login?error=unexpected`);
  }
}
