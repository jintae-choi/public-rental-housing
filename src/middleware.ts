import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

// 로그인 없이 접근 불가한 보호 경로
const PROTECTED_ROUTES = ["/profile", "/settings"];
// 로그인 상태에서 접근하면 홈으로 리다이렉트할 경로
const AUTH_ROUTES = ["/login", "/signup"];

export async function middleware(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // 요청 쿠키 설정
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          // 응답 재생성 후 쿠키 반영
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // 세션 갱신 및 사용자 인증 상태 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 미인증 사용자가 보호 경로 접근 시 /login으로 리다이렉트
  if (!user && PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 인증된 사용자가 /login, /signup 접근 시 홈으로 리다이렉트
  if (user && AUTH_ROUTES.includes(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.delete("redirectTo");
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
