import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MobileNav } from "@/components/layout/mobile-nav";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

// 사이트 헤더 — 서버 컴포넌트 (모바일 메뉴는 MobileNav 클라이언트 컴포넌트로 분리)
export async function Header(): Promise<React.ReactElement> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="flex h-14 items-center justify-between">
          {/* 로고 / 앱 이름 */}
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-lg hover:opacity-80 transition-opacity"
          >
            공공임대 알리미
          </Link>

          {/* 데스크톱 네비게이션 */}
          <nav className="hidden md:flex items-center gap-1">
            <Button variant="ghost" render={<Link href="/" />}>
              공고 목록
            </Button>
            <Button variant="ghost" render={<Link href="/profile" />}>
              내 프로필
            </Button>
            <Separator orientation="vertical" className="mx-2 h-5" />
            {user ? (
              <form action={signOut}>
                <Button variant="outline" type="submit">
                  로그아웃
                </Button>
              </form>
            ) : (
              <Button variant="outline" render={<Link href="/login" />}>
                로그인
              </Button>
            )}
          </nav>

          {/* 모바일 햄버거 메뉴 */}
          <MobileNav isLoggedIn={!!user} />
        </div>
      </div>
    </header>
  );
}
