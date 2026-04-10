// 프로필 시나리오 DB 쿼리 — 사용자당 최대 3개, 앱 레벨에서 제약 enforce

import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { profileScenarios } from "@/lib/db/schema";
import type {
  MAX_SCENARIOS_PER_USER,
  ProfileScenario,
  ScenarioFormData,
} from "@/types/profile";
import { MAX_SCENARIOS_PER_USER as MAX_COUNT } from "@/types/profile";

type Row = typeof profileScenarios.$inferSelect;

// 참고: MAX_SCENARIOS_PER_USER는 @/types/profile에서 import — 중앙 정의
void (MAX_COUNT satisfies typeof MAX_SCENARIOS_PER_USER);

function toScenario(row: Row): ProfileScenario {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    isDefault: row.isDefault,
    householdTypes: row.householdTypes,
    maritalStatus: row.maritalStatus as ProfileScenario["maritalStatus"],
    plannedMarriageDate: row.plannedMarriageDate,
    householdMembers: row.householdMembers,
    monthlyIncome: row.monthlyIncome,
    totalAssets: row.totalAssets,
    carValue: row.carValue,
    spouseBirthDate: row.spouseBirthDate,
    spouseIncome: row.spouseIncome,
    spouseAssets: row.spouseAssets,
    spouseWorkplace: row.spouseWorkplace,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * 사용자의 모든 시나리오 조회 (기본 시나리오 우선, 생성일 순)
 */
export async function listScenarios(
  userId: string
): Promise<ProfileScenario[]> {
  try {
    const rows = await db
      .select()
      .from(profileScenarios)
      .where(eq(profileScenarios.userId, userId))
      .orderBy(sql`${profileScenarios.isDefault} desc`, asc(profileScenarios.createdAt));
    return rows.map(toScenario);
  } catch (error) {
    console.error("[listScenarios] 시나리오 조회 실패:", error);
    throw error;
  }
}

/**
 * 단일 시나리오 조회 (본인 소유 검증 포함)
 */
export async function getScenario(
  userId: string,
  scenarioId: string
): Promise<ProfileScenario | null> {
  try {
    const rows = await db
      .select()
      .from(profileScenarios)
      .where(
        and(
          eq(profileScenarios.id, scenarioId),
          eq(profileScenarios.userId, userId)
        )
      )
      .limit(1);
    return rows.length > 0 ? toScenario(rows[0]) : null;
  } catch (error) {
    console.error("[getScenario] 시나리오 조회 실패:", error);
    throw error;
  }
}

/**
 * 시나리오 생성 — 최대 개수 초과 시 에러
 * 첫 시나리오는 자동으로 isDefault=true
 */
export async function createScenario(
  userId: string,
  data: ScenarioFormData
): Promise<ProfileScenario> {
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: profileScenarios.id, isDefault: profileScenarios.isDefault })
        .from(profileScenarios)
        .where(eq(profileScenarios.userId, userId));

      if (existing.length >= MAX_COUNT) {
        throw new Error(
          `시나리오는 최대 ${MAX_COUNT}개까지 생성할 수 있습니다.`
        );
      }

      // 첫 시나리오면 자동 기본
      const isFirst = existing.length === 0;
      const willBeDefault = isFirst || data.isDefault;

      // 다른 시나리오를 기본 해제
      if (willBeDefault && existing.some((e) => e.isDefault)) {
        await tx
          .update(profileScenarios)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(profileScenarios.userId, userId));
      }

      const [row] = await tx
        .insert(profileScenarios)
        .values({
          userId,
          ...data,
          isDefault: willBeDefault,
          updatedAt: new Date(),
        })
        .returning();

      return toScenario(row);
    });
  } catch (error) {
    console.error("[createScenario] 시나리오 생성 실패:", error);
    throw error;
  }
}

/**
 * 시나리오 업데이트 — 본인 소유만
 */
export async function updateScenario(
  userId: string,
  scenarioId: string,
  data: ScenarioFormData
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      // isDefault 전환 시 다른 시나리오 해제
      if (data.isDefault) {
        await tx
          .update(profileScenarios)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            and(
              eq(profileScenarios.userId, userId),
              sql`${profileScenarios.id} <> ${scenarioId}`
            )
          );
      }

      await tx
        .update(profileScenarios)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(profileScenarios.id, scenarioId),
            eq(profileScenarios.userId, userId)
          )
        );
    });
  } catch (error) {
    console.error("[updateScenario] 시나리오 수정 실패:", error);
    throw error;
  }
}

/**
 * 시나리오 삭제 — 마지막 1개는 삭제 불가, 기본 시나리오 삭제 시 다른 것으로 승격
 */
export async function deleteScenario(
  userId: string,
  scenarioId: string
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(profileScenarios)
        .where(eq(profileScenarios.userId, userId));

      if (rows.length <= 1) {
        throw new Error("마지막 시나리오는 삭제할 수 없습니다.");
      }

      const target = rows.find((r) => r.id === scenarioId);
      if (!target) {
        throw new Error("시나리오를 찾을 수 없습니다.");
      }

      await tx
        .delete(profileScenarios)
        .where(
          and(
            eq(profileScenarios.id, scenarioId),
            eq(profileScenarios.userId, userId)
          )
        );

      // 기본 시나리오였다면 가장 오래된 다른 시나리오를 기본으로 승격
      if (target.isDefault) {
        const remaining = rows
          .filter((r) => r.id !== scenarioId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        if (remaining.length > 0) {
          await tx
            .update(profileScenarios)
            .set({ isDefault: true, updatedAt: new Date() })
            .where(eq(profileScenarios.id, remaining[0].id));
        }
      }
    });
  } catch (error) {
    console.error("[deleteScenario] 시나리오 삭제 실패:", error);
    throw error;
  }
}
