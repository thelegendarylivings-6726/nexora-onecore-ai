import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";
import { organizationsTable } from "./identity";

export const leadsTable = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  businessSlug: text("business_slug"),
  name: text("name").notNull(),
  email: text("email"),
  source: text("source"),
  status: text("status")
    .$type<"new" | "qualified" | "contacted" | "converted" | "closed">()
    .notNull()
    .default("new"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const customersTable = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  businessSlug: text("business_slug"),
  name: text("name").notNull(),
  email: text("email"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const messagesTable = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customersTable.id, {
    onDelete: "set null",
  }),
  leadId: uuid("lead_id").references(() => leadsTable.id, {
    onDelete: "set null",
  }),
  channel: text("channel").notNull(),
  direction: text("direction")
    .$type<"inbound" | "outbound">()
    .notNull(),
  body: text("body").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({
  id: true,
  createdAt: true,
});
export const insertCustomerSchema = createInsertSchema(customersTable).omit({
  id: true,
  createdAt: true,
});
export const insertMessageSchema = createInsertSchema(messagesTable).omit({
  id: true,
  createdAt: true,
});
export type Lead = typeof leadsTable.$inferSelect;
export type Customer = typeof customersTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
