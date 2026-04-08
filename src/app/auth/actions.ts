"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// 로그아웃 처리 후 홈으로 리다이렉트
export async function signOut(): Promise<never> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[Auth] 로그아웃 실패:", error.message);
    }
  } catch (err) {
    console.error("[Auth] 로그아웃 중 예상치 못한 오류:", err);
  }

  redirect("/");
}
