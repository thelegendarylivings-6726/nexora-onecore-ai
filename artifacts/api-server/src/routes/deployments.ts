import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  activityLogsTable,
  auditLogsTable,
  businessesTable,
  db,
  deploymentRequestsTable,
} from "@workspace/db";
import {
  CreateDeploymentRequestBody,
  CreateDeploymentRequestResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { ensureWorkspace } from "../lib/workspace";
import { ensureBusinessCatalog } from "./businesses";

const router: IRouter = Router();

router.post(
  "/deployment-requests",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = CreateDeploymentRequestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    await ensureBusinessCatalog();
    const [business] = await db
      .select()
      .from(businessesTable)
      .where(eq(businessesTable.slug, parsed.data.businessSlug))
      .limit(1);
    if (!business) {
      res.status(404).json({ error: "Business not found" });
      return;
    }

    const workspace = await ensureWorkspace(req.clerkUserId!);
    const created = await db.transaction(async (tx) => {
      const [request] = await tx
        .insert(deploymentRequestsTable)
        .values({
          organizationId: workspace.id,
          requestedBy: req.clerkUserId!,
          businessSlug: business.slug,
          message: parsed.data.message ?? null,
        })
        .returning();
      if (!request) {
        throw new Error("The deployment request could not be recorded.");
      }

      await tx.insert(activityLogsTable).values({
        organizationId: workspace.id,
        actorClerkUserId: req.clerkUserId!,
        type: "deployment_requested",
        title: "Deployment request recorded",
        detail: `${business.name} deployment request recorded in this workspace.`,
      });
      await tx.insert(auditLogsTable).values({
        organizationId: workspace.id,
        actorClerkUserId: req.clerkUserId!,
        action: "deployment.request",
        resourceType: "deployment_request",
        resourceId: request.id,
      });
      return request;
    });

    res.status(201).json(
      CreateDeploymentRequestResponse.parse({
        id: created.id,
        businessSlug: created.businessSlug,
        status: "submitted",
        createdAt: created.createdAt,
      }),
    );
  },
);

export default router;
