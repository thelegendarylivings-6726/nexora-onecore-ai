import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./identity";

export const businessesTable = pgTable(
  "businesses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sortOrder: integer("sort_order").notNull(),
    slug: text("slug").notNull().unique("businesses_slug_unique"),
    name: text("name").notNull(),
    description: text("description").notNull(),
    industry: text("industry").notNull(),
    functionCategory: text("function_category").notNull(),
    capabilities: text("capabilities").array().notNull(),
    workflow: text("workflow").notNull(),
    phase: text("phase").$type<"catalog" | "flagship">().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const organizationBusinessesTable = pgTable(
  "organization_businesses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    businessSlug: text("business_slug").notNull(),
    enabledAt: timestamp("enabled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("organization_businesses_org_slug_unique").on(
      table.organizationId,
      table.businessSlug,
    ),
  ],
);

export const insertBusinessSchema = createInsertSchema(businessesTable).omit({
  createdAt: true,
});
export const insertOrganizationBusinessSchema = createInsertSchema(
  organizationBusinessesTable,
).omit({ id: true, enabledAt: true });
export type BusinessRecord = typeof businessesTable.$inferSelect;
export type OrganizationBusiness = typeof organizationBusinessesTable.$inferSelect;
export type InsertBusiness = typeof businessesTable.$inferInsert;
