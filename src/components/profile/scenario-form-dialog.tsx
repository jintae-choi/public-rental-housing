"use client";
import React, { useRef, useState, useTransition } from "react";

// 시나리오 생성/수정 Dialog 컴포넌트
// initialData가 있으면 수정 모드, 없으면 생성 모드

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveScenario } from "@/app/profile/actions";
import { HOUSEHOLD_TYPES } from "@/types/profile";
import type { ProfileScenario, ScenarioFormData, MaritalStatus } from "@/types/profile";

interface ScenarioFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: ProfileScenario | null;
  onSaved: () => void;
}

/**
 * 만 원 단위 숫자를 입력받아 원화 표기 보조 텍스트 생성
 */
function formatWon(value: number | null | undefined): string {
  if (!value) return "";
  if (value >= 10000) return `약 ${(value / 10000).toFixed(1)}억 원`;
  return `${value.toLocaleString()}만 원`;
}

function buildInitialForm(data?: ProfileScenario | null): ScenarioFormData {
  return {
    name: data?.name ?? "",
    isDefault: data?.isDefault ?? false,
    householdTypes: data?.householdTypes ?? [],
    maritalStatus: data?.maritalStatus ?? null,
    plannedMarriageDate: data?.plannedMarriageDate ?? null,
    householdMembers: data?.householdMembers ?? null,
    monthlyIncome: data?.monthlyIncome ?? null,
    totalAssets: data?.totalAssets ?? null,
    carValue: data?.carValue ?? null,
    spouseBirthDate: data?.spouseBirthDate ?? null,
    spouseIncome: data?.spouseIncome ?? null,
    spouseAssets: data?.spouseAssets ?? null,
    spouseWorkplace: data?.spouseWorkplace ?? null,
  };
}

export function ScenarioFormDialog({
  open,
  onOpenChange,
  initialData,
  onSaved,
}: ScenarioFormDialogProps): React.ReactElement {
  const [form, setForm] = useState<ScenarioFormData>(() =>
    buildInitialForm(initialData)
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Dialog가 열릴 때 폼 초기화
  React.useEffect(() => {
    if (open) {
      setForm(buildInitialForm(initialData));
      setError(null);
    }
  }, [open, initialData]);

  const handleChange = (field: keyof ScenarioFormData, value: unknown): void => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleHouseholdTypeToggle = (type: string): void => {
    const current = form.householdTypes ?? [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    handleChange("householdTypes", updated);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const htmlForm = formRef.current;
    if (!htmlForm) return;

    startTransition(async () => {
      const fd = new FormData(htmlForm);
      const result = await saveScenario(fd);

      if (result.error) {
        setError(result.error);
        return;
      }

      onOpenChange(false);
      onSaved();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "시나리오 수정" : "새 시나리오 추가"}
          </DialogTitle>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* 수정 시 scenarioId 전달 */}
          {initialData && (
            <input type="hidden" name="scenarioId" value={initialData.id} />
          )}

          {/* 시나리오 이름 */}
          <div className="space-y-2">
            <Label htmlFor="scenario-name">
              시나리오 이름 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="scenario-name"
              name="name"
              required
              placeholder="예: 1인가구, 예비신혼, 청년"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
            />
          </div>

          {/* 기본 시나리오 여부 */}
          <div className="flex items-center gap-3">
            <input
              id="scenario-isDefault"
              name="isDefault"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={form.isDefault}
              onChange={(e) => handleChange("isDefault", e.target.checked)}
            />
            <Label htmlFor="scenario-isDefault">기본 시나리오로 설정</Label>
          </div>

          {/* 가구 유형 (다중 선택) */}
          <div className="space-y-2">
            <Label>가구 유형 (해당 항목 모두 선택)</Label>
            <div className="flex flex-wrap gap-2">
              {HOUSEHOLD_TYPES.map((type) => {
                const selected = (form.householdTypes ?? []).includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleHouseholdTypeToggle(type)}
                    className={`rounded-full px-3 py-1 text-sm border transition-colors ${
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:bg-muted"
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
            {/* FormData 전송용 hidden inputs */}
            {(form.householdTypes ?? []).map((type) => (
              <input key={type} type="hidden" name="householdTypes" value={type} />
            ))}
          </div>

          {/* 혼인 상태 */}
          <div className="space-y-2">
            <Label htmlFor="scenario-maritalStatus">혼인 상태</Label>
            <Select
              name="maritalStatus"
              value={form.maritalStatus ?? ""}
              onValueChange={(v) =>
                handleChange("maritalStatus", (v as MaritalStatus) || null)
              }
            >
              <SelectTrigger id="scenario-maritalStatus">
                <SelectValue placeholder="선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SINGLE">미혼</SelectItem>
                <SelectItem value="MARRIED">기혼</SelectItem>
                <SelectItem value="DIVORCED">이혼</SelectItem>
                <SelectItem value="WIDOWED">사별</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 예비 혼인 예정일 (미혼 선택 시) */}
          {form.maritalStatus === "SINGLE" && (
            <div className="space-y-2">
              <Label htmlFor="scenario-plannedMarriageDate">
                예정 혼인일 (예비신혼부부)
              </Label>
              <Input
                id="scenario-plannedMarriageDate"
                name="plannedMarriageDate"
                type="date"
                value={form.plannedMarriageDate ?? ""}
                onChange={(e) =>
                  handleChange("plannedMarriageDate", e.target.value || null)
                }
              />
            </div>
          )}

          {/* 가구원 수 */}
          <div className="space-y-2">
            <Label htmlFor="scenario-householdMembers">가구원 수</Label>
            <Input
              id="scenario-householdMembers"
              name="householdMembers"
              type="number"
              min={1}
              max={20}
              placeholder="1"
              value={form.householdMembers ?? ""}
              onChange={(e) =>
                handleChange(
                  "householdMembers",
                  e.target.value ? parseInt(e.target.value, 10) : null
                )
              }
            />
          </div>

          {/* 월 소득 */}
          <div className="space-y-2">
            <Label htmlFor="scenario-monthlyIncome">월 소득 (만 원)</Label>
            <Input
              id="scenario-monthlyIncome"
              name="monthlyIncome"
              type="number"
              min={0}
              placeholder="300"
              value={form.monthlyIncome ?? ""}
              onChange={(e) =>
                handleChange(
                  "monthlyIncome",
                  e.target.value ? parseInt(e.target.value, 10) : null
                )
              }
            />
            {form.monthlyIncome && (
              <p className="text-sm text-muted-foreground">
                {formatWon(form.monthlyIncome)}
              </p>
            )}
          </div>

          {/* 총 자산 */}
          <div className="space-y-2">
            <Label htmlFor="scenario-totalAssets">총 자산 (만 원)</Label>
            <Input
              id="scenario-totalAssets"
              name="totalAssets"
              type="number"
              min={0}
              placeholder="5000"
              value={form.totalAssets ?? ""}
              onChange={(e) =>
                handleChange(
                  "totalAssets",
                  e.target.value ? parseInt(e.target.value, 10) : null
                )
              }
            />
            {form.totalAssets && (
              <p className="text-sm text-muted-foreground">
                {formatWon(form.totalAssets)}
              </p>
            )}
          </div>

          {/* 차량 가액 */}
          <div className="space-y-2">
            <Label htmlFor="scenario-carValue">차량 가액 (만 원)</Label>
            <Input
              id="scenario-carValue"
              name="carValue"
              type="number"
              min={0}
              placeholder="0"
              value={form.carValue ?? ""}
              onChange={(e) =>
                handleChange(
                  "carValue",
                  e.target.value ? parseInt(e.target.value, 10) : null
                )
              }
            />
            <p className="text-xs text-muted-foreground">차량이 없으면 0을 입력하세요.</p>
          </div>

          {/* 배우자 정보 (기혼 시) */}
          {form.maritalStatus === "MARRIED" && (
            <>
              <div className="pt-2 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-4">배우자 정보</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scenario-spouseBirthDate">배우자 생년월일</Label>
                <Input
                  id="scenario-spouseBirthDate"
                  name="spouseBirthDate"
                  type="date"
                  value={form.spouseBirthDate ?? ""}
                  onChange={(e) =>
                    handleChange("spouseBirthDate", e.target.value || null)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scenario-spouseIncome">배우자 월 소득 (만 원)</Label>
                <Input
                  id="scenario-spouseIncome"
                  name="spouseIncome"
                  type="number"
                  min={0}
                  placeholder="200"
                  value={form.spouseIncome ?? ""}
                  onChange={(e) =>
                    handleChange(
                      "spouseIncome",
                      e.target.value ? parseInt(e.target.value, 10) : null
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scenario-spouseAssets">배우자 자산 (만 원)</Label>
                <Input
                  id="scenario-spouseAssets"
                  name="spouseAssets"
                  type="number"
                  min={0}
                  placeholder="3000"
                  value={form.spouseAssets ?? ""}
                  onChange={(e) =>
                    handleChange(
                      "spouseAssets",
                      e.target.value ? parseInt(e.target.value, 10) : null
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scenario-spouseWorkplace">배우자 근무지</Label>
                <Input
                  id="scenario-spouseWorkplace"
                  name="spouseWorkplace"
                  placeholder="서울특별시 마포구..."
                  value={form.spouseWorkplace ?? ""}
                  onChange={(e) =>
                    handleChange("spouseWorkplace", e.target.value || null)
                  }
                />
              </div>
            </>
          )}

          {/* 에러 메시지 */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* 제출 버튼 */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "저장 중..." : initialData ? "수정" : "추가"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
