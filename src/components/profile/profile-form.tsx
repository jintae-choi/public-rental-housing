"use client";
import React from "react";

// 프로필 폼 메인 컴포넌트 — Tabs로 섹션 분리, Server Action으로 저장
// Phase 3: 시나리오 관리 섹션 추가, 시나리오 필드는 ProfileFormData에서 제거됨

import { useRef, useState, useTransition } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { saveProfile } from "@/app/profile/actions";
import { BasicInfoTab } from "./basic-info-tab";
import { HousingTab } from "./housing-tab";
import { PreferencesTab } from "./preferences-tab";
import { NotificationTab } from "./notification-tab";
import { ScenarioList } from "./scenario-list";
import type { ProfileFormData, ProfileScenario, UserProfile } from "@/types/profile";

interface ProfileFormProps {
  initialData: UserProfile | null;
  initialScenarios: ProfileScenario[];
}

// ProfileFormData 기본값 생성
function buildDefaultData(profile: UserProfile | null): ProfileFormData {
  return {
    name: profile?.name ?? null,
    birthDate: profile?.birthDate ?? null,
    isHouseholder: profile?.isHouseholder ?? null,
    homelessMonths: profile?.homelessMonths ?? null,
    subscriptionType: profile?.subscriptionType ?? null,
    subscriptionStart: profile?.subscriptionStart ?? null,
    subscriptionPayments: profile?.subscriptionPayments ?? null,
    address: profile?.address ?? null,
    email: profile?.email ?? null,
    interestedRegions: profile?.interestedRegions ?? null,
    preferredAreaMin: profile?.preferredAreaMin ?? null,
    preferredAreaMax: profile?.preferredAreaMax ?? null,
    workplace: profile?.workplace ?? null,
    maxCommuteMinutes: profile?.maxCommuteMinutes ?? null,
    maxDeposit: profile?.maxDeposit ?? null,
    maxMonthlyRent: profile?.maxMonthlyRent ?? null,
    notificationEnabled: profile?.notificationEnabled ?? false,
    notificationLevel: profile?.notificationLevel ?? "ELIGIBLE_ONLY",
    notificationFrequency: profile?.notificationFrequency ?? "IMMEDIATE",
    deadlineReminderDays: profile?.deadlineReminderDays ?? [3, 1, 0],
  };
}

export function ProfileForm({ initialData, initialScenarios }: ProfileFormProps): React.ReactElement {
  const [formData, setFormData] = useState<ProfileFormData>(
    buildDefaultData(initialData)
  );
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // 개별 필드 업데이트 핸들러
  const handleChange = (field: keyof ProfileFormData, value: unknown): void => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // 폼 제출 처리 (Server Action 호출)
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;

    startTransition(async () => {
      const fd = new FormData(form);
      const result = await saveProfile(fd);

      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "프로필이 저장되었습니다." });
      }

      // 3초 후 메시지 자동 제거
      setTimeout(() => setMessage(null), 3000);
    });
  };

  return (
    <div className="space-y-8">
      {/* ── 시나리오 관리 섹션 ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">내 자격 시나리오</CardTitle>
          <CardDescription>
            가족 구성 가능성을 최대 3개까지 등록하면, 각 시나리오별로 자격 조건을 별도 계산합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScenarioList scenarios={initialScenarios} />
        </CardContent>
      </Card>

      {/* ── 사용자 고정 정보 폼 ────────────────────────────────────── */}
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        <Tabs defaultValue="basic">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="basic">기본 정보</TabsTrigger>
            <TabsTrigger value="housing">주거 조건</TabsTrigger>
            <TabsTrigger value="preferences">선호 조건</TabsTrigger>
            <TabsTrigger value="notifications">알림 설정</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="mt-6">
            <BasicInfoTab data={formData} onChange={handleChange} />
          </TabsContent>

          <TabsContent value="housing" className="mt-6">
            <HousingTab data={formData} onChange={handleChange} />
          </TabsContent>

          <TabsContent value="preferences" className="mt-6">
            <PreferencesTab data={formData} onChange={handleChange} />
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <NotificationTab data={formData} onChange={handleChange} />
          </TabsContent>
        </Tabs>

        {/* 저장 버튼 및 피드백 메시지 */}
        <div className="flex items-center gap-4 pt-4 border-t">
          <Button type="submit" disabled={isPending}>
            {isPending ? "저장 중..." : "저장"}
          </Button>

          {message && (
            <p
              className={`text-sm ${
                message.type === "success"
                  ? "text-green-600"
                  : "text-destructive"
              }`}
            >
              {message.text}
            </p>
          )}
        </div>

        {/* 면책 고지 */}
        <p className="text-xs text-muted-foreground">
          * 입력된 정보는 자격 조건 분석에만 사용되며, 자동 분석 결과는 참고용입니다.
          최종 자격 여부는 공고문 및 담당 기관을 통해 확인하세요.
        </p>
      </form>
    </div>
  );
}
