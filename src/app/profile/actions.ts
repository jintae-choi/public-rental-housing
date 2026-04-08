"use server";

// 프로필 저장 Server Action

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { upsertProfile } from "@/lib/db/queries/profile";
import type {
  ProfileFormData,
  MaritalStatus,
  SubscriptionType,
  NotificationLevel,
  NotificationFrequency,
} from "@/types/profile";

/**
 * FormData에서 정수를 파싱 (빈 값은 null 반환)
 */
function parseIntOrNull(value: FormDataEntryValue | null): number | null {
  if (!value || value === "") return null;
  const n = parseInt(String(value), 10);
  return isNaN(n) ? null : n;
}

/**
 * FormData에서 실수를 파싱 (빈 값은 null 반환)
 */
function parseFloatOrNull(value: FormDataEntryValue | null): number | null {
  if (!value || value === "") return null;
  const n = parseFloat(String(value));
  return isNaN(n) ? null : n;
}

/**
 * FormData에서 날짜 문자열을 파싱 (빈 값은 null 반환)
 */
function parseDateOrNull(value: FormDataEntryValue | null): string | null {
  if (!value || value === "") return null;
  return String(value);
}

/**
 * FormData에서 boolean을 파싱 (체크박스는 "on" 또는 null)
 */
function parseBool(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

/**
 * 마감 리마인더 일수 파싱 (체크박스 다중 선택)
 */
function parseReminderDays(formData: FormData): number[] {
  const values = formData.getAll("deadlineReminderDays");
  return values
    .map((v) => parseInt(String(v), 10))
    .filter((n) => !isNaN(n));
}

/**
 * 프로필 저장 Server Action
 */
export async function saveProfile(formData: FormData): Promise<{ error?: string }> {
  try {
    // 인증 확인
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    // FormData 파싱 및 타입 변환
    const profileData: ProfileFormData = {
      // 기본 정보
      name: parseDateOrNull(formData.get("name")) ,
      birthDate: parseDateOrNull(formData.get("birthDate")),
      householdTypes: formData.getAll("householdTypes").map(String) || null,
      maritalStatus:
        (formData.get("maritalStatus") as MaritalStatus) || null,
      plannedMarriageDate: parseDateOrNull(
        formData.get("plannedMarriageDate")
      ),
      householdMembers: parseIntOrNull(formData.get("householdMembers")),
      isHouseholder: parseBool(formData.get("isHouseholder")),
      homelessMonths: parseIntOrNull(formData.get("homelessMonths")),

      // 소득/자산
      monthlyIncome: parseIntOrNull(formData.get("monthlyIncome")),
      totalAssets: parseIntOrNull(formData.get("totalAssets")),
      carValue: parseIntOrNull(formData.get("carValue")),

      // 청약통장
      subscriptionType:
        (formData.get("subscriptionType") as SubscriptionType) || null,
      subscriptionStart: parseDateOrNull(formData.get("subscriptionStart")),
      subscriptionPayments: parseIntOrNull(
        formData.get("subscriptionPayments")
      ),

      // 주소/연락처
      address: parseDateOrNull(formData.get("address")),
      email: parseDateOrNull(formData.get("email")),

      // 배우자 정보
      spouseBirthDate: parseDateOrNull(formData.get("spouseBirthDate")),
      spouseIncome: parseIntOrNull(formData.get("spouseIncome")),
      spouseAssets: parseIntOrNull(formData.get("spouseAssets")),
      spouseWorkplace: parseDateOrNull(formData.get("spouseWorkplace")),

      // 선호 조건
      interestedRegions:
        formData.getAll("interestedRegions").map(String) || null,
      preferredAreaMin: parseFloatOrNull(formData.get("preferredAreaMin")),
      preferredAreaMax: parseFloatOrNull(formData.get("preferredAreaMax")),
      workplace: parseDateOrNull(formData.get("workplace")),
      maxCommuteMinutes: parseIntOrNull(formData.get("maxCommuteMinutes")),
      maxDeposit: parseIntOrNull(formData.get("maxDeposit")),
      maxMonthlyRent: parseIntOrNull(formData.get("maxMonthlyRent")),

      // 알림 설정
      notificationEnabled: parseBool(formData.get("notificationEnabled")),
      notificationLevel:
        (formData.get("notificationLevel") as NotificationLevel) ??
        "ELIGIBLE_ONLY",
      notificationFrequency:
        (formData.get("notificationFrequency") as NotificationFrequency) ??
        "IMMEDIATE",
      deadlineReminderDays: parseReminderDays(formData),
    };

    await upsertProfile(user.id, profileData);

    revalidatePath("/profile");
    return {};
  } catch (error) {
    console.error("[saveProfile] 프로필 저장 실패:", error);
    return { error: "프로필 저장 중 오류가 발생했습니다." };
  }
}
