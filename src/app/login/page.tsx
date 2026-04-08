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
import { LoginForm } from "./LoginForm";

// 에러 메시지 매핑
const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
  missing_fields: "이메일과 비밀번호를 모두 입력해주세요.",
  missing_code: "인증 코드가 없습니다. 다시 시도해주세요.",
  session_exchange: "인증에 실패했습니다. 다시 시도해주세요.",
  unexpected: "오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
};

interface LoginPageProps {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}

export default async function LoginPage({
  searchParams,
}: LoginPageProps): Promise<React.ReactElement> {
  const { error, redirectTo } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "오류가 발생했습니다.") : null;

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
            <CardTitle>로그인</CardTitle>
            <CardDescription>
              계정에 로그인하여 맞춤 공고를 확인하세요.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* 에러 메시지 표시 */}
            {errorMessage && (
              <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            <LoginForm redirectTo={redirectTo} />
          </CardContent>

          <CardFooter className="justify-center">
            <p className="text-sm text-zinc-500">
              계정이 없으신가요?{" "}
              <Link
                href="/signup"
                className="font-medium text-zinc-900 underline-offset-4 hover:underline"
              >
                회원가입
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
