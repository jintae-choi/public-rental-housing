"use client";
import React, { useState, useTransition } from "react";

// 시나리오 목록 컴포넌트 — CRUD 상태 관리 및 액션 호출

import { Button } from "@/components/ui/button";
import { deleteScenario } from "@/app/profile/actions";
import { ScenarioFormDialog } from "./scenario-form-dialog";
import type { ProfileScenario } from "@/types/profile";
import { MAX_SCENARIOS_PER_USER } from "@/types/profile";

interface ScenarioListProps {
  scenarios: ProfileScenario[];
}

/**
 * 시나리오 요약 텍스트 생성 (가구 구성 + 소득 간략 표시)
 */
function buildSummary(scenario: ProfileScenario): string {
  const parts: string[] = [];

  if (scenario.householdTypes && scenario.householdTypes.length > 0) {
    parts.push(scenario.householdTypes.join(", "));
  }
  if (scenario.householdMembers) {
    parts.push(`${scenario.householdMembers}인 가구`);
  }
  if (scenario.maritalStatus) {
    const statusMap: Record<string, string> = {
      SINGLE: "미혼",
      MARRIED: "기혼",
      DIVORCED: "이혼",
      WIDOWED: "사별",
    };
    parts.push(statusMap[scenario.maritalStatus] ?? scenario.maritalStatus);
  }
  if (scenario.monthlyIncome) {
    parts.push(`월 ${scenario.monthlyIncome.toLocaleString()}만 원`);
  }

  return parts.length > 0 ? parts.join(" · ") : "조건 미입력";
}

export function ScenarioList({ scenarios: initialScenarios }: ScenarioListProps): React.ReactElement {
  const [scenarios, setScenarios] = useState<ProfileScenario[]>(initialScenarios);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProfileScenario | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isAtMax = scenarios.length >= MAX_SCENARIOS_PER_USER;
  const canDelete = scenarios.length > 1;

  const handleAdd = (): void => {
    setEditTarget(null);
    setDialogOpen(true);
  };

  const handleEdit = (scenario: ProfileScenario): void => {
    setEditTarget(scenario);
    setDialogOpen(true);
  };

  const handleDelete = (scenarioId: string): void => {
    if (!canDelete) {
      setDeleteError("마지막 시나리오는 삭제할 수 없습니다.");
      return;
    }
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteScenario(scenarioId);
      if (result.error) {
        setDeleteError(result.error);
      } else {
        // 낙관적 업데이트 — 서버 revalidatePath가 최종 동기화
        setScenarios((prev) => prev.filter((s) => s.id !== scenarioId));
      }
    });
  };

  // 저장 완료 후 페이지 새로고침 (revalidatePath로 최신 데이터 반영)
  const handleSaved = (): void => {
    window.location.reload();
  };

  if (scenarios.length === 0) {
    return (
      <div className="text-center py-10 border-2 border-dashed border-border rounded-lg">
        <p className="text-muted-foreground mb-1">등록된 시나리오가 없습니다.</p>
        <p className="text-sm text-muted-foreground mb-4">
          시나리오를 추가하면 각 상황에 맞는 자격 조건을 별도로 확인할 수 있습니다.
        </p>
        <Button onClick={handleAdd} size="sm">
          첫 시나리오 만들기
        </Button>
        <ScenarioFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initialData={editTarget}
          onSaved={handleSaved}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {scenarios.map((scenario) => (
        <div
          key={scenario.id}
          className="flex items-start justify-between gap-4 p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium truncate">{scenario.name}</span>
              {scenario.isDefault && (
                <span className="shrink-0 inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ring-primary/20">
                  기본
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {buildSummary(scenario)}
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleEdit(scenario)}
              disabled={isPending}
            >
              수정
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => handleDelete(scenario.id)}
              disabled={isPending || !canDelete}
              title={!canDelete ? "마지막 시나리오는 삭제할 수 없습니다" : undefined}
            >
              삭제
            </Button>
          </div>
        </div>
      ))}

      {deleteError && (
        <p className="text-sm text-destructive">{deleteError}</p>
      )}

      <div className="flex items-center justify-between pt-1">
        {isAtMax ? (
          <p className="text-sm text-muted-foreground">
            최대 {MAX_SCENARIOS_PER_USER}개까지 생성 가능합니다. (현재 {scenarios.length}개)
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {scenarios.length} / {MAX_SCENARIOS_PER_USER}개 사용 중
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={isAtMax || isPending}
        >
          + 새 시나리오 추가
        </Button>
      </div>

      <ScenarioFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={editTarget}
        onSaved={handleSaved}
      />
    </div>
  );
}
