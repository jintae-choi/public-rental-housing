"use server";

// 프로필 & 시나리오 저장 Server Actions

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { upsertProfile } from "@/lib/db/queries/profile";
import {
  createScenario,
  deleteScenario as deleteScenarioQuery,
  updateScenario,
} from "@/lib/db/queries/profile-scenario";
import type {
  MaritalStatus,
  NotificationFrequency,
  NotificationLevel,
  ProfileFormData,
  ScenarioFormData,
  SubscriptionType,
} from "@/types/profile";

// ─── 파싱 헬퍼 ─────────────────────────────────────────────────────────────

function parseIntOrNull(value: FormDataEntryValue | null): number | null {
  if (!value || value === "") return null;
  const n = parseInt(String(value), 10);
  return isNaN(n) ? null : n;
}

function parseFloatOrNull(value: FormDataEntryValue | null): number | null {
  if (!value || value === "") return null;
  const n = parseFloat(String(value));
  return isNaN(n) ? null : n;
}

function parseStringOrNull(value: FormDataEntryValue | null): string | null {
  if (!value || value === "") return null;
  return String(value);
}

function parseBool(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

function parseReminderDays(formData: FormData): number[] {
  return formData
    .getAll("deadlineReminderDays")
    .map((v) => parseInt(String(v), 10))
    .filter((n) => !isNaN(n));
}

// ─── 인증 헬퍼 ─────────────────────────────────────────────────────────────

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return user.id;
}

// ─── 프로필(사용자 고정 정보) 저장 ─────────────────────────────────────────

export async function saveProfile(
  formData: FormData
): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();

    const profileData: ProfileFormData = {
      name: parseStringOrNull(formData.get("name")),
      birthDate: parseStringOrNull(formData.get("birthDate")),
      isHouseholder: parseBool(formData.get("isHouseholder")),
      homelessMonths: parseIntOrNull(formData.get("homelessMonths")),
      subscriptionType:
        (formData.get("subscriptionType") as SubscriptionType) || null,
      subscriptionStart: parseStringOrNull(formData.get("subscriptionStart")),
      subscriptionPayments: parseIntOrNull(
        formData.get("subscriptionPayments")
      ),
      address: parseStringOrNull(formData.get("address")),
      email: parseStringOrNull(formData.get("email")),
      interestedRegions:
        formData.getAll("interestedRegions").map(String) || null,
      preferredAreaMin: parseFloatOrNull(formData.get("preferredAreaMin")),
      preferredAreaMax: parseFloatOrNull(formData.get("preferredAreaMax")),
      workplace: parseStringOrNull(formData.get("workplace")),
      maxCommuteMinutes: parseIntOrNull(formData.get("maxCommuteMinutes")),
      maxDeposit: parseIntOrNull(formData.get("maxDeposit")),
      maxMonthlyRent: parseIntOrNull(formData.get("maxMonthlyRent")),
      notificationEnabled: parseBool(formData.get("notificationEnabled")),
      notificationLevel:
        (formData.get("notificationLevel") as NotificationLevel) ??
        "ELIGIBLE_ONLY",
      notificationFrequency:
        (formData.get("notificationFrequency") as NotificationFrequency) ??
        "IMMEDIATE",
      deadlineReminderDays: parseReminderDays(formData),
    };

    await upsertProfile(userId, profileData);
    revalidatePath("/profile");
    return {};
  } catch (error) {
    console.error("[saveProfile] 프로필 저장 실패:", error);
    return { error: "프로필 저장 중 오류가 발생했습니다." };
  }
}

// ─── 시나리오 CRUD ─────────────────────────────────────────────────────────

function parseScenarioFormData(formData: FormData): ScenarioFormData {
  return {
    name: String(formData.get("name") ?? "").trim() || "시나리오",
    isDefault: parseBool(formData.get("isDefault")),
    householdTypes: formData.getAll("householdTypes").map(String) || null,
    maritalStatus:
      (formData.get("maritalStatus") as MaritalStatus) || null,
    plannedMarriageDate: parseStringOrNull(formData.get("plannedMarriageDate")),
    householdMembers: parseIntOrNull(formData.get("householdMembers")),
    monthlyIncome: parseIntOrNull(formData.get("monthlyIncome")),
    totalAssets: parseIntOrNull(formData.get("totalAssets")),
    carValue: parseIntOrNull(formData.get("carValue")),
    spouseBirthDate: parseStringOrNull(formData.get("spouseBirthDate")),
    spouseIncome: parseIntOrNull(formData.get("spouseIncome")),
    spouseAssets: parseIntOrNull(formData.get("spouseAssets")),
    spouseWorkplace: parseStringOrNull(formData.get("spouseWorkplace")),
  };
}

export async function saveScenario(
  formData: FormData
): Promise<{ error?: string; scenarioId?: string }> {
  try {
    const userId = await requireUserId();
    const scenarioId = parseStringOrNull(formData.get("scenarioId"));
    const data = parseScenarioFormData(formData);

    if (scenarioId) {
      await updateScenario(userId, scenarioId, data);
      revalidatePath("/profile");
      return { scenarioId };
    }

    const created = await createScenario(userId, data);
    revalidatePath("/profile");
    return { scenarioId: created.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "시나리오 저장 실패";
    console.error("[saveScenario] 실패:", error);
    return { error: message };
  }
}

export async function deleteScenario(
  scenarioId: string
): Promise<{ error?: string }> {
  try {
    const userId = await requireUserId();
    await deleteScenarioQuery(userId, scenarioId);
    revalidatePath("/profile");
    return {};
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "시나리오 삭제 실패";
    console.error("[deleteScenario] 실패:", error);
    return { error: message };
  }
}
