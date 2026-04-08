import React from "react";
// 프로필 페이지 — 서버 컴포넌트
// 인증 확인 후 DB에서 프로필 로드하여 ProfileForm에 전달

import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/db/queries/profile";
import { ProfileForm } from "@/components/profile/profile-form";

export const metadata = {
  title: "내 프로필 — 공공임대주택 대시보드",
  description: "자격 조건 분석을 위한 프로필 정보를 관리합니다.",
};

export default async function ProfilePage(): Promise<React.ReactElement> {
  // 인증 확인
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 프로필 데이터 로드
  let profile = null;
  try {
    profile = await getProfile(user.id);
  } catch (error) {
    console.error("[ProfilePage] 프로필 로드 실패:", error);
    // 로드 실패 시에도 빈 폼으로 렌더링
  }

  return (
    <main className="container max-w-3xl mx-auto py-10 px-4">
      <Card>
        <CardHeader>
          <CardTitle>내 프로필</CardTitle>
          <CardDescription>
            공공임대주택 자격 조건 분석에 사용되는 정보를 입력해주세요.
            입력한 정보는 안전하게 보관되며, 분석 결과 제공 목적으로만 사용됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm initialData={profile} />
        </CardContent>
      </Card>
    </main>
  );
}
