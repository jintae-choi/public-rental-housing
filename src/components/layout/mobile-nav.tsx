"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { signOut } from "@/app/auth/actions";

interface MobileNavProps {
  isLoggedIn: boolean;
}

// 모바일 햄버거 메뉴 (클라이언트 컴포넌트)
export function MobileNav({ isLoggedIn }: MobileNavProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="메뉴 열기">
            <Menu className="h-5 w-5" />
          </Button>
        }
      />
      <SheetContent side="right" className="w-64">
        <SheetHeader>
          <SheetTitle className="text-left">공공임대 알리미</SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-2">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            공고 목록
          </Link>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            내 프로필
          </Link>
          {isLoggedIn ? (
            <form action={signOut}>
              <button
                type="submit"
                onClick={() => setOpen(false)}
                className="w-full text-left rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                로그아웃
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              로그인
            </Link>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
