import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./identity";
import { businessesTable } from "./businesses";

export const agentsTable = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  businessSlug: text("business_slug"),
  name: text("name").notNull(),
  status: text("status").$type<"inactive" | "active" | "paused">().notNull().default("inactive"),
  configuration: jsonb("configuration").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const projectsTable = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  businessSlug: text("business_slug"),
  name: text("name").notNull(),
  status: text("status").$type<"active" | "archived">().notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tasksTable = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  businessSlug: text("business_slug"),
  title: text("title").notNull(),
  status: text("status")
    .$type<"queued" | "running" | "completed" | "failed">()
    .notNull()
    .default("queued"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const workflowsTable = pgTable("workflows", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  businessSlug: text("business_slug"),
  name: text("name").notNull(),
  definition: jsonb("definition").$type<Record<string, unknown>>().notNull().default({}),
  status: text("status").$type<"draft" | "active" | "paused">().notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const approvalsTable = pgTable("approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasksTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  status: text("status")
    .$type<"required" | "approved" | "rejected">()
    .notNull()
    .default("required"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const deploymentRequestsTable = pgTable("deployment_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  requestedBy: text("requested_by").notNull(),
  businessSlug: text("business_slug").notNull(),
  message: text("message"),
  status: text("status").$type<"submitted" | "in_review" | "complete">().notNull().default("submitted"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const appointmentsTable = pgTable("appointments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  businessSlug: text("business_slug"),
  title: text("title").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  status: text("status")
    .$type<"scheduled" | "completed" | "cancelled">()
    .notNull()
    .default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const supportRequestsTable = pgTable("support_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  businessSlug: text("business_slug"),
  subject: text("subject").notNull(),
  status: text("status")
    .$type<"open" | "waiting" | "closed">()
    .notNull()
    .default("open"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const activityLogsTable = pgTable("activity_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  actorClerkUserId: text("actor_clerk_user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const usageRecordsTable = pgTable("usage_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  metric: text("metric").notNull(),
  quantity: integer("quantity").notNull().default(0),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAgentSchema = createInsertSchema(agentsTable).omit({
  id: true,
  createdAt: true,
});
export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
});
export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertWorkflowSchema = createInsertSchema(workflowsTable).omit({
  id: true,
  createdAt: true,
});
export const insertApprovalSchema = createInsertSchema(approvalsTable).omit({
  id: true,
  createdAt: true,
});
export const insertDeploymentRequestSchema = createInsertSchema(
  deploymentRequestsTable,
).omit({ id: true, createdAt: true });
export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({
  id: true,
  createdAt: true,
});
export const insertSupportRequestSchema = createInsertSchema(
  supportRequestsTable,
).omit({ id: true, createdAt: true });
export const insertActivityLogSchema = createInsertSchema(activityLogsTable).omit({
  id: true,
  createdAt: true,
});
export const insertUsageRecordSchema = createInsertSchema(usageRecordsTable).omit({
  id: true,
  recordedAt: true,
});
export type Task = typeof tasksTable.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
