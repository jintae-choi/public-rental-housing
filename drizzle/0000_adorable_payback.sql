CREATE TYPE "public"."announcement_status" AS ENUM('UPCOMING', 'OPEN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."eligibility_result" AS ENUM('ELIGIBLE', 'CHECK_NEEDED', 'INELIGIBLE');--> statement-breakpoint
CREATE TYPE "public"."marital_status" AS ENUM('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('EMAIL');--> statement-breakpoint
CREATE TYPE "public"."notification_frequency" AS ENUM('IMMEDIATE', 'DAILY_SUMMARY');--> statement-breakpoint
CREATE TYPE "public"."notification_level" AS ENUM('ELIGIBLE_ONLY', 'ELIGIBLE_AND_CHECK');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('SENT', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('NEW_ANNOUNCEMENT', 'DEADLINE_REMINDER');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('SH', 'LH', 'MYHOME');--> statement-breakpoint
CREATE TYPE "public"."subscription_type" AS ENUM('GENERAL', 'FIRST_TIME', 'NONE');--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"source" "source" NOT NULL,
	"title" text NOT NULL,
	"status" "announcement_status" DEFAULT 'UPCOMING' NOT NULL,
	"housing_type" text,
	"region" text,
	"district" text,
	"supply_count" integer,
	"area_sqm" real[],
	"deposit" text,
	"monthly_rent" text,
	"application_start" date,
	"application_end" date,
	"announcement_date" date,
	"winner_date" date,
	"contract_start" date,
	"contract_end" date,
	"detail_url" text,
	"pdf_url" text,
	"pdf_text" text,
	"raw_html" text,
	"is_modified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "announcements_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "eligibility_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" uuid NOT NULL,
	"target_group" text,
	"income_limit" jsonb,
	"asset_limit" integer,
	"car_limit" integer,
	"age_min" integer,
	"age_max" integer,
	"homeless_months" integer,
	"region_requirement" text[],
	"subscription_months" integer,
	"subscription_payments" integer,
	"household_type" text[],
	"marriage_condition" text,
	"special_conditions" jsonb,
	"raw_analysis" text,
	"analyzed_at" timestamp,
	"parser_version" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eligibility_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"announcement_id" uuid NOT NULL,
	"condition_id" uuid NOT NULL,
	"result" "eligibility_result" NOT NULL,
	"details" jsonb,
	"matched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"announcement_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"channel" "notification_channel" DEFAULT 'EMAIL' NOT NULL,
	"status" "notification_status" NOT NULL,
	"is_read" boolean DEFAULT false,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text,
	"birth_date" date,
	"household_types" text[],
	"marital_status" "marital_status",
	"planned_marriage_date" date,
	"household_members" integer,
	"is_householder" boolean,
	"homeless_months" integer,
	"monthly_income" integer,
	"total_assets" integer,
	"car_value" integer,
	"subscription_type" "subscription_type",
	"subscription_start" date,
	"subscription_payments" integer,
	"address" text,
	"interested_regions" text[],
	"email" text,
	"spouse_birth_date" date,
	"spouse_income" integer,
	"spouse_assets" integer,
	"spouse_workplace" text,
	"preferred_area_min" real,
	"preferred_area_max" real,
	"workplace" text,
	"max_commute_minutes" integer,
	"max_deposit" integer,
	"max_monthly_rent" integer,
	"notification_enabled" boolean DEFAULT false,
	"notification_level" "notification_level" DEFAULT 'ELIGIBLE_ONLY',
	"notification_frequency" "notification_frequency" DEFAULT 'IMMEDIATE',
	"deadline_reminder_days" integer[] DEFAULT '{3,1,0}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "eligibility_conditions" ADD CONSTRAINT "eligibility_conditions_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_results" ADD CONSTRAINT "eligibility_results_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_results" ADD CONSTRAINT "eligibility_results_condition_id_eligibility_conditions_id_fk" FOREIGN KEY ("condition_id") REFERENCES "public"."eligibility_conditions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;