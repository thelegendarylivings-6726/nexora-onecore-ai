import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  auditLogsTable,
  db,
  organizationBusinessesTable,
} from "@workspace/db";
import {
  ActivateBusinessParams,
  ActivateBusinessResponse,
  DeactivateBusinessParams,
  DeactivateBusinessResponse,
  GetWorkspaceResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { ensureBusinessCatalog } from "./businesses";
import { getWorkspaceSnapshot } from "../lib/workspace";
import { businessesTable } from "@workspace/db";
import { activityLogsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/workspace", requireAuth, async (req, res): Promise<void> => {
  const workspace = await getWorkspaceSnapshot(req.clerkUserId!);
  res.json(GetWorkspaceResponse.parse(workspace));
});

router.put(
  "/workspace/businesses/:slug",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = ActivateBusinessParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    await ensureBusinessCatalog();
    const [business] = await db
      .select()
      .from(businessesTable)
      .where(eq(businessesTable.slug, params.data.slug))
      .limit(1);
    if (!business) {
      res.status(404).json({ error: "Business not found" });
      return;
    }

    const workspace = await getWorkspaceSnapshot(req.clerkUserId!);
    await db.transaction(async (tx) => {
      const [activated] = await tx
        .insert(organizationBusinessesTable)
        .values({
          organizationId: workspace.id,
          businessSlug: business.slug,
        })
        .onConflictDoNothing()
        .returning();
      if (!activated) return;

      const detail = `${business.name} was enabled for this organization.`;
      await tx.insert(activityLogsTable).values({
        organizationId: workspace.id,
        actorClerkUserId: req.clerkUserId!,
        type: "business_activated",
        title: "Business module enabled",
        detail,
      });
      await tx.insert(auditLogsTable).values({
        organizationId: workspace.id,
        actorClerkUserId: req.clerkUserId!,
        action: "business.activate",
        resourceType: "business",
        resourceId: business.slug,
      });
    });

    const updated = await getWorkspaceSnapshot(req.clerkUserId!);
    res.json(ActivateBusinessResponse.parse(updated));
  },
);

router.delete(
  "/workspace/businesses/:slug",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = DeactivateBusinessParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    await ensureBusinessCatalog();
    const [business] = await db
      .select()
      .from(businessesTable)
      .where(eq(businessesTable.slug, params.data.slug))
      .limit(1);
    if (!business) {
      res.status(404).json({ error: "Business not found" });
      return;
    }

    const workspace = await getWorkspaceSnapshot(req.clerkUserId!);
    await db.transaction(async (tx) => {
      const [deactivated] = await tx
        .delete(organizationBusinessesTable)
        .where(
          and(
            eq(organizationBusinessesTable.organizationId, workspace.id),
            eq(organizationBusinessesTable.businessSlug, business.slug),
          ),
        )
        .returning();
      if (!deactivated) return;

      await tx.insert(activityLogsTable).values({
        organizationId: workspace.id,
        actorClerkUserId: req.clerkUserId!,
        type: "business_deactivated",
        title: "Business module disabled",
        detail: `${business.name} was disabled for this organization.`,
      });
      await tx.insert(auditLogsTable).values({
        organizationId: workspace.id,
        actorClerkUserId: req.clerkUserId!,
        action: "business.deactivate",
        resourceType: "business",
        resourceId: business.slug,
      });
    });

    const updated = await getWorkspaceSnapshot(req.clerkUserId!);
    res.json(DeactivateBusinessResponse.parse(updated));
  },
);

export default router;
