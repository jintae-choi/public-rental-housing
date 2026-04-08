import React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignupForm } from "./SignupForm";

// 에러 메시지 매핑
const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "모든 필드를 입력해주세요.",
  password_mismatch: "비밀번호가 일치하지 않습니다.",
  password_too_short: "비밀번호는 최소 8자 이상이어야 합니다.",
  email_exists: "이미 가입된 이메일 주소입니다.",
  signup_failed: "회원가입에 실패했습니다. 다시 시도해주세요.",
  unexpected: "오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
};

interface SignupPageProps {
  searchParams: Promise<{ error?: string; success?: string }>;
}

export default async function SignupPage({
  searchParams,
}: SignupPageProps): Promise<React.ReactElement> {
  const { error, success } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "오류가 발생했습니다.") : null;
  const isEmailSent = success === "check_email";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            공공임대주택 대시보드
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>회원가입</CardTitle>
            <CardDescription>
              계정을 만들어 맞춤 공고 알림을 받아보세요.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* 이메일 발송 완료 안내 */}
            {isEmailSent ? (
              <div className="rounded-md bg-green-50 px-4 py-6 text-center">
                <p className="text-sm font-medium text-green-800">
                  가입 확인 이메일을 발송했습니다.
                </p>
                <p className="mt-1 text-sm text-green-700">
                  이메일함을 확인하여 가입을 완료해주세요.
                </p>
              </div>
            ) : (
              <>
                {/* 에러 메시지 표시 */}
                {errorMessage && (
                  <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </div>
                )}

                <SignupForm />
              </>
            )}
          </CardContent>

          <CardFooter className="justify-center">
            <p className="text-sm text-zinc-500">
              이미 계정이 있으신가요?{" "}
              <Link
                href="/login"
                className="font-medium text-zinc-900 underline-offset-4 hover:underline"
              >
                로그인
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
