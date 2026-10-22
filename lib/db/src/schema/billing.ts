import { boolean, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizationsTable } from "./identity";

export const subscriptionsTable = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("unconfigured"),
  providerCustomerId: text("provider_customer_id"),
  providerSubscriptionId: text("provider_subscription_id"),
  planCode: text("plan_code").notNull().default("onecore_monthly"),
  status: text("status")
    .$type<"inactive" | "active" | "past_due" | "cancelled" | "expired">()
    .notNull()
    .default("inactive"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  uniqueIndex("subscriptions_org_unique").on(table.organizationId),
  uniqueIndex("subscriptions_provider_subscription_unique").on(table.providerSubscriptionId),
]);

export type Subscription = typeof subscriptionsTable.$inferSelect;
