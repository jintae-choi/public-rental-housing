import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, Clock, MapPin, Home, FileText } from "lucide-react";

interface AnnouncementDetailPageProps {
  params: Promise<{ id: string }>;
}

// 공고 상세 페이지 — 정적 레이아웃 뼈대
export default async function AnnouncementDetailPage({
  params,
}: AnnouncementDetailPageProps): Promise<React.ReactElement> {
  const { id } = await params;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="secondary">행복주택</Badge>
          <Badge variant="outline" className="text-green-600 border-green-300">
            접수중
          </Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          [더미] 2024년 행복주택 입주자 모집 공고
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">공고 ID: {id}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 왼쪽 메인 컬럼 */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* 기본 정보 카드 */}
          <BasicInfoCard />

          {/* 자격 조건 카드 */}
          <EligibilityCard />
        </div>

        {/* 오른쪽 사이드바 */}
        <div className="flex flex-col gap-6">
          {/* D-Day 카운트다운 */}
          <DDayCard />

          {/* 일정 타임라인 카드 */}
          <ScheduleCard />
        </div>
      </div>
    </div>
  );
}

// 기본 정보 카드
function BasicInfoCard(): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          기본 정보
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <InfoRow icon={<Home className="h-4 w-4" />} label="주택유형" value="행복주택" />
        <InfoRow icon={<MapPin className="h-4 w-4" />} label="공급 지역" value="서울특별시 강남구" />
        <InfoRow icon={<Home className="h-4 w-4" />} label="공급 세대수" value="120세대" />
        <InfoRow icon={<FileText className="h-4 w-4" />} label="공고 기관" value="한국토지주택공사(LH)" />
      </CardContent>
    </Card>
  );
}

// 자격 조건 카드
function EligibilityCard(): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          자격 조건
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <ul className="space-y-2 list-disc list-inside">
          {/* 더미 자격 조건 — 파서 연동 후 실제 데이터로 교체 예정 */}
          <li>무주택 세대구성원</li>
          <li>소득 기준: 전년도 도시근로자 월평균 소득 100% 이하</li>
          <li>자산 기준: 총자산 3억 2,500만 원 이하</li>
          <li>청약통장 가입 후 6개월 이상 경과</li>
        </ul>
        <Separator className="my-4" />
        <p className="text-xs text-muted-foreground/70">
          ※ 자동 분석 결과는 참고용이며, 정확한 자격 여부는 공고문을 직접 확인하세요.
        </p>
      </CardContent>
    </Card>
  );
}

// D-Day 카운트다운 카드
function DDayCard(): React.ReactElement {
  return (
    <Card className="text-center">
      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          접수 마감
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 더미 D-Day — 실제 날짜 계산 로직 연동 예정 */}
        <p className="text-4xl font-bold text-primary">D-14</p>
        <p className="mt-1 text-xs text-muted-foreground">2024년 12월 31일 마감</p>
      </CardContent>
    </Card>
  );
}

// 일정 타임라인 카드
function ScheduleCard(): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4" />
          주요 일정
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {/* 더미 일정 — 공고 파싱 후 실제 데이터로 교체 예정 */}
        <ScheduleItem label="입주자 모집 공고" date="2024.12.01" done />
        <ScheduleItem label="청약 접수" date="2024.12.15 ~ 12.31" active />
        <ScheduleItem label="당첨자 발표" date="2025.01.15" />
        <ScheduleItem label="서류 제출" date="2025.01.20 ~ 01.24" />
        <ScheduleItem label="계약 체결" date="2025.02.10 ~ 02.14" />
      </CardContent>
    </Card>
  );
}

// 일정 항목 컴포넌트
interface ScheduleItemProps {
  label: string;
  date: string;
  done?: boolean;
  active?: boolean;
}

function ScheduleItem({ label, date, done, active }: ScheduleItemProps): React.ReactElement {
  return (
    <div className="flex items-start gap-3 py-2">
      {/* 타임라인 점 */}
      <div className="mt-0.5 flex flex-col items-center">
        <div
          className={`h-2.5 w-2.5 rounded-full border-2 ${
            active
              ? "border-primary bg-primary"
              : done
                ? "border-muted-foreground bg-muted-foreground"
                : "border-muted-foreground bg-background"
          }`}
        />
      </div>
      {/* 일정 내용 */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium ${done ? "text-muted-foreground line-through" : ""}`}>
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{date}</p>
      </div>
    </div>
  );
}

// 정보 행 컴포넌트
interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground">{icon}</span>
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
