"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

interface LoginFormData {
  email: string;
  password: string;
  redirectTo?: string;
}

// 이메일/비밀번호 로그인 처리
export async function login(formData: FormData): Promise<never> {
  const data: LoginFormData = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    redirectTo: (formData.get("redirectTo") as string) || "/",
  };

  if (!data.email || !data.password) {
    redirect("/login?error=missing_fields");
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      console.error("[Login] 로그인 실패:", error.message);
      redirect(`/login?error=invalid_credentials`);
    }
  } catch (err) {
    console.error("[Login] 예상치 못한 오류:", err);
    redirect("/login?error=unexpected");
  }

  redirect(data.redirectTo ?? "/");
}
