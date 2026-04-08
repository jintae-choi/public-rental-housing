"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

interface SignupFormData {
  email: string;
  password: string;
  confirmPassword: string;
}

// 이메일/비밀번호 회원가입 처리
export async function signup(formData: FormData): Promise<never> {
  const data: SignupFormData = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  if (!data.email || !data.password || !data.confirmPassword) {
    redirect("/signup?error=missing_fields");
  }

  if (data.password !== data.confirmPassword) {
    redirect("/signup?error=password_mismatch");
  }

  if (data.password.length < 8) {
    redirect("/signup?error=password_too_short");
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        // 이메일 확인 후 앱의 auth/callback 라우트로 리다이렉트
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback`,
      },
    });

    if (error) {
      console.error("[Signup] 회원가입 실패:", error.message);

      if (error.message.includes("already registered")) {
        redirect("/signup?error=email_exists");
      }
      redirect("/signup?error=signup_failed");
    }
  } catch (err) {
    console.error("[Signup] 예상치 못한 오류:", err);
    redirect("/signup?error=unexpected");
  }

  // 이메일 확인 안내 페이지로 이동
  redirect("/signup?success=check_email");
}
