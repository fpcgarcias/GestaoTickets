CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"domain" text,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"cnpj" text,
	"phone" text
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"department_id" integer,
	"company_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notification_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"new_ticket_assigned" boolean DEFAULT true,
	"ticket_status_changed" boolean DEFAULT true,
	"new_reply_received" boolean DEFAULT true,
	"ticket_escalated" boolean DEFAULT true,
	"ticket_due_soon" boolean DEFAULT true,
	"new_customer_registered" boolean DEFAULT true,
	"new_user_created" boolean DEFAULT true,
	"system_maintenance" boolean DEFAULT true,
	"email_notifications" boolean DEFAULT true,
	"browser_notifications" boolean DEFAULT true,
	"push_notifications" boolean DEFAULT false,
	"notification_hours_start" integer DEFAULT 9,
	"notification_hours_end" integer DEFAULT 18,
	"weekend_notifications" boolean DEFAULT false,
	"digest_frequency" text DEFAULT 'never',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "incident_types" DROP CONSTRAINT "incident_types_value_unique";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'customer'::text;--> statement-breakpoint
DROP TYPE "public"."user_role";--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'customer', 'support', 'manager', 'supervisor', 'viewer', 'company_admin', 'triage', 'quality', 'integration_bot');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'customer'::"public"."user_role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";--> statement-breakpoint
ALTER TABLE "official_departments" ALTER COLUMN "department" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "incident_types" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "incident_types" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "officials" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "sla_definitions" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ad_user" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_settings" ADD CONSTRAINT "user_notification_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_types" ADD CONSTRAINT "incident_types_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "officials" ADD CONSTRAINT "officials_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_definitions" ADD CONSTRAINT "sla_definitions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;