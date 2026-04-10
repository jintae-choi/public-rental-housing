import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  date,
  timestamp,
  jsonb,
  pgEnum,
  real,
} from "drizzle-orm/pg-core";

// --- Enums ---

export const sourceEnum = pgEnum("source", ["SH", "LH", "MYHOME"]);

export const announcementStatusEnum = pgEnum("announcement_status", [
  "UPCOMING",
  "OPEN",
  "CLOSED",
]);

export const maritalStatusEnum = pgEnum("marital_status", [
  "SINGLE",
  "MARRIED",
  "DIVORCED",
  "WIDOWED",
]);

export const subscriptionTypeEnum = pgEnum("subscription_type", [
  "GENERAL",
  "FIRST_TIME",
  "NONE",
]);

export const eligibilityResultEnum = pgEnum("eligibility_result", [
  "ELIGIBLE",
  "CHECK_NEEDED",
  "INELIGIBLE",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "NEW_ANNOUNCEMENT",
  "DEADLINE_REMINDER",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "EMAIL",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "SENT",
  "FAILED",
]);

export const notificationLevelEnum = pgEnum("notification_level", [
  "ELIGIBLE_ONLY",
  "ELIGIBLE_AND_CHECK",
]);

export const notificationFrequencyEnum = pgEnum("notification_frequency", [
  "IMMEDIATE",
  "DAILY_SUMMARY",
]);

// --- Tables ---

export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  externalId: text("external_id").unique().notNull(),
  source: sourceEnum("source").notNull(),
  title: text("title").notNull(),
  status: announcementStatusEnum("status").notNull().default("UPCOMING"),
  housingType: text("housing_type"),
  region: text("region"),
  district: text("district"),
  supplyCount: integer("supply_count"),
  areaSqm: real("area_sqm").array(),
  deposit: text("deposit"),
  monthlyRent: text("monthly_rent"),
  applicationStart: date("application_start"),
  applicationEnd: date("application_end"),
  announcementDate: date("announcement_date"),
  winnerDate: date("winner_date"),
  contractStart: date("contract_start"),
  contractEnd: date("contract_end"),
  detailUrl: text("detail_url"),
  pdfUrl: text("pdf_url"),
  pdfText: text("pdf_text"),
  rawHtml: text("raw_html"),
  isModified: boolean("is_modified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const eligibilityConditions = pgTable("eligibility_conditions", {
  id: uuid("id").defaultRandom().primaryKey(),
  announcementId: uuid("announcement_id")
    .references(() => announcements.id, { onDelete: "cascade" })
    .notNull(),
  targetGroup: text("target_group"),
  priorityRank: integer("priority_rank"),
  incomeLimit: jsonb("income_limit"),
  assetLimit: integer("asset_limit"),
  carLimit: integer("car_limit"),
  ageMin: integer("age_min"),
  ageMax: integer("age_max"),
  childAgeMax: integer("child_age_max"),
  homelessMonths: integer("homeless_months"),
  regionRequirement: text("region_requirement").array(),
  subscriptionMonths: integer("subscription_months"),
  subscriptionPayments: integer("subscription_payments"),
  householdType: text("household_type").array(),
  marriageCondition: text("marriage_condition"),
  workDurationMonths: integer("work_duration_months"),
  maxResidenceYears: integer("max_residence_years"),
  parentIncomeIncluded: boolean("parent_income_included"),
  scoringCriteria: jsonb("scoring_criteria"),
  specialConditions: jsonb("special_conditions"),
  rawAnalysis: text("raw_analysis"),
  analyzedAt: timestamp("analyzed_at"),
  parserVersion: text("parser_version"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// user_profiles: 사용자 고정 정보 (본인 기준, 시나리오 무관)
//   - 시나리오별로 달라지는 필드(가구 구성/소득/자산/배우자)는 profile_scenarios로 이관
export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").unique().notNull(),
  name: text("name"),
  birthDate: date("birth_date"),
  isHouseholder: boolean("is_householder"),
  homelessMonths: integer("homeless_months"),
  // 청약통장 (본인 계좌)
  subscriptionType: subscriptionTypeEnum("subscription_type"),
  subscriptionStart: date("subscription_start"),
  subscriptionPayments: integer("subscription_payments"),
  // 주소/연락처
  address: text("address"),
  interestedRegions: text("interested_regions").array(),
  email: text("email"),
  // 주거 선호 조건
  preferredAreaMin: real("preferred_area_min"),
  preferredAreaMax: real("preferred_area_max"),
  workplace: text("workplace"),
  maxCommuteMinutes: integer("max_commute_minutes"),
  maxDeposit: integer("max_deposit"),
  maxMonthlyRent: integer("max_monthly_rent"),
  // 알림 설정
  notificationEnabled: boolean("notification_enabled").default(false),
  notificationLevel: notificationLevelEnum("notification_level").default(
    "ELIGIBLE_ONLY"
  ),
  notificationFrequency: notificationFrequencyEnum(
    "notification_frequency"
  ).default("IMMEDIATE"),
  deadlineReminderDays: integer("deadline_reminder_days")
    .array()
    .default([3, 1, 0]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// profile_scenarios: 사용자당 최대 3개의 자격 시나리오 (예: "1인가구", "예비신혼")
//   - 하나의 사용자가 동시에 복수 가구 구성에 해당할 수 있어 매칭은 시나리오별로 수행
//   - 최대 3개 제약은 앱 레벨(server action)에서 enforce
export const profileScenarios = pgTable("profile_scenarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  // 가구 구성
  householdTypes: text("household_types").array(),
  maritalStatus: maritalStatusEnum("marital_status"),
  plannedMarriageDate: date("planned_marriage_date"),
  householdMembers: integer("household_members"),
  // 소득/자산 (시나리오 기준 가구 합산)
  monthlyIncome: integer("monthly_income"),
  totalAssets: integer("total_assets"),
  carValue: integer("car_value"),
  // 배우자(예정자) 정보
  spouseBirthDate: date("spouse_birth_date"),
  spouseIncome: integer("spouse_income"),
  spouseAssets: integer("spouse_assets"),
  spouseWorkplace: text("spouse_workplace"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const eligibilityResults = pgTable("eligibility_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  scenarioId: uuid("scenario_id")
    .references(() => profileScenarios.id, { onDelete: "cascade" })
    .notNull(),
  announcementId: uuid("announcement_id")
    .references(() => announcements.id, { onDelete: "cascade" })
    .notNull(),
  conditionId: uuid("condition_id")
    .references(() => eligibilityConditions.id, { onDelete: "cascade" })
    .notNull(),
  result: eligibilityResultEnum("result").notNull(),
  details: jsonb("details"),
  matchedAt: timestamp("matched_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  announcementId: uuid("announcement_id")
    .references(() => announcements.id, { onDelete: "cascade" })
    .notNull(),
  type: notificationTypeEnum("type").notNull(),
  channel: notificationChannelEnum("channel").notNull().default("EMAIL"),
  status: notificationStatusEnum("status").notNull(),
  isRead: boolean("is_read").default(false),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
