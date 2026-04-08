import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";

// 메인 대시보드 페이지 — 공고 목록 (FR-009 기반)
export default function HomePage(): React.ReactElement {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">공고 목록</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          내 조건에 맞는 공공임대주택 공고를 확인하세요.
        </p>
      </div>

      {/* 필터 영역 */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* 지역 필터 */}
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="지역 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="seoul">서울</SelectItem>
            <SelectItem value="gyeonggi">경기</SelectItem>
            <SelectItem value="incheon">인천</SelectItem>
            <SelectItem value="busan">부산</SelectItem>
            <SelectItem value="daegu">대구</SelectItem>
            <SelectItem value="gwangju">광주</SelectItem>
            <SelectItem value="daejeon">대전</SelectItem>
          </SelectContent>
        </Select>

        {/* 주택유형 필터 */}
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="주택유형 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="national-rental">국민임대</SelectItem>
            <SelectItem value="public-rental">공공임대</SelectItem>
            <SelectItem value="youth-rental">청년임대</SelectItem>
            <SelectItem value="newlywed-rental">신혼부부임대</SelectItem>
            <SelectItem value="happy-house">행복주택</SelectItem>
          </SelectContent>
        </Select>

        {/* 상태 필터 */}
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="공고 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="open">접수중</SelectItem>
            <SelectItem value="upcoming">접수예정</SelectItem>
            <SelectItem value="closed">마감</SelectItem>
          </SelectContent>
        </Select>

        {/* 검색 */}
        <Input placeholder="공고명 검색..." />
      </div>

      {/* 공고 카드 리스트 — 빈 상태 UI */}
      <EmptyAnnouncementState />
    </div>
  );
}

// 빈 상태 UI 컴포넌트
function EmptyAnnouncementState(): React.ReactElement {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="mb-4 h-12 w-12 text-muted-foreground/40" />
        <p className="text-base font-medium text-muted-foreground">등록된 공고가 없습니다.</p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          데이터 수집이 진행되면 이곳에 공고가 표시됩니다.
        </p>
      </CardContent>
    </Card>
  );
}
