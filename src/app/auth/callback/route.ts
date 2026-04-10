import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    console.error("[Auth Callback] code 파라미터가 없습니다.");
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  // 리다이렉트 응답을 먼저 생성하고 여기에 쿠키를 직접 설정
  const redirectUrl = new URL(next, request.url);
  const response = NextResponse.redirect(redirectUrl);

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
      }
    );

    // OAuth/Magic Link/이메일 확인 code를 세션으로 교환
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[Auth Callback] 세션 교환 실패:", error.message);
      return NextResponse.redirect(
        new URL("/login?error=session_exchange", request.url)
      );
    }

    return response;
  } catch (err) {
    console.error("[Auth Callback] 예상치 못한 오류:", err);
    return NextResponse.redirect(
      new URL("/login?error=unexpected", request.url)
    );
  }
}
