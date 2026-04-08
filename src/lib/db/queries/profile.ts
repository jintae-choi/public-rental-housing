// 사용자 프로필 DB 쿼리 함수

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import type { ProfileFormData, UserProfile } from "@/types/profile";

/**
 * userId로 프로필 조회
 */
export async function getProfile(userId: string): Promise<UserProfile | null> {
  try {
    const rows = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      birthDate: row.birthDate,
      householdTypes: row.householdTypes,
      maritalStatus: row.maritalStatus as UserProfile["maritalStatus"],
      plannedMarriageDate: row.plannedMarriageDate,
      householdMembers: row.householdMembers,
      isHouseholder: row.isHouseholder,
      homelessMonths: row.homelessMonths,
      monthlyIncome: row.monthlyIncome,
      totalAssets: row.totalAssets,
      carValue: row.carValue,
      subscriptionType: row.subscriptionType as UserProfile["subscriptionType"],
      subscriptionStart: row.subscriptionStart,
      subscriptionPayments: row.subscriptionPayments,
      address: row.address,
      email: row.email,
      spouseBirthDate: row.spouseBirthDate,
      spouseIncome: row.spouseIncome,
      spouseAssets: row.spouseAssets,
      spouseWorkplace: row.spouseWorkplace,
      interestedRegions: row.interestedRegions,
      preferredAreaMin: row.preferredAreaMin,
      preferredAreaMax: row.preferredAreaMax,
      workplace: row.workplace,
      maxCommuteMinutes: row.maxCommuteMinutes,
      maxDeposit: row.maxDeposit,
      maxMonthlyRent: row.maxMonthlyRent,
      notificationEnabled: row.notificationEnabled ?? false,
      notificationLevel:
        (row.notificationLevel as UserProfile["notificationLevel"]) ??
        "ELIGIBLE_ONLY",
      notificationFrequency:
        (row.notificationFrequency as UserProfile["notificationFrequency"]) ??
        "IMMEDIATE",
      deadlineReminderDays: row.deadlineReminderDays ?? [3, 1, 0],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  } catch (error) {
    console.error("[getProfile] 프로필 조회 실패:", error);
    throw error;
  }
}

/**
 * 프로필 insert or update (userId 기준 upsert)
 */
export async function upsertProfile(
  userId: string,
  data: ProfileFormData
): Promise<void> {
  try {
    await db
      .insert(userProfiles)
      .values({
        userId,
        ...data,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error("[upsertProfile] 프로필 저장 실패:", error);
    throw error;
  }
}
