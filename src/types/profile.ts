// 프로필 폼 데이터 타입 정의 (userProfiles 스키마 기반, 메타 필드 제외)

export type MaritalStatus = "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED";
export type SubscriptionType = "GENERAL" | "FIRST_TIME" | "NONE";
export type NotificationLevel = "ELIGIBLE_ONLY" | "ELIGIBLE_AND_CHECK";
export type NotificationFrequency = "IMMEDIATE" | "DAILY_SUMMARY";

export interface ProfileFormData {
  // 기본 정보
  name: string | null;
  birthDate: string | null;
  householdTypes: string[] | null;
  maritalStatus: MaritalStatus | null;
  plannedMarriageDate: string | null;
  householdMembers: number | null;
  isHouseholder: boolean | null;
  homelessMonths: number | null;

  // 소득/자산
  monthlyIncome: number | null;
  totalAssets: number | null;
  carValue: number | null;

  // 청약통장
  subscriptionType: SubscriptionType | null;
  subscriptionStart: string | null;
  subscriptionPayments: number | null;

  // 주소/연락처
  address: string | null;
  email: string | null;

  // 배우자 정보
  spouseBirthDate: string | null;
  spouseIncome: number | null;
  spouseAssets: number | null;
  spouseWorkplace: string | null;

  // 선호 조건
  interestedRegions: string[] | null;
  preferredAreaMin: number | null;
  preferredAreaMax: number | null;
  workplace: string | null;
  maxCommuteMinutes: number | null;
  maxDeposit: number | null;
  maxMonthlyRent: number | null;

  // 알림 설정
  notificationEnabled: boolean;
  notificationLevel: NotificationLevel;
  notificationFrequency: NotificationFrequency;
  deadlineReminderDays: number[];
}

// DB에서 조회한 프로필 전체 타입
export interface UserProfile extends ProfileFormData {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// 관심 지역 선택지
export const REGIONS = [
  "서울",
  "경기",
  "인천",
  "부산",
  "대구",
  "대전",
  "광주",
  "울산",
  "세종",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
] as const;

// 가구 유형 선택지
export const HOUSEHOLD_TYPES = [
  "청년",
  "신혼부부",
  "예비신혼부부",
  "한부모가족",
  "다자녀가구",
  "고령자",
  "장애인",
  "국가유공자",
  "일반",
] as const;
