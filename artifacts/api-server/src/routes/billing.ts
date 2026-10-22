import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, subscriptionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { ensureWorkspace } from "../lib/workspace";

const router: IRouter = Router();

router.get("/billing/status", requireAuth, async (req, res): Promise<void> => {
  const workspace = await ensureWorkspace(req.clerkUserId!);
  const [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.organizationId, workspace.id))
    .limit(1);

  const active = subscription?.status === "active";

  res.json({
    configured: process.env.BILLING_PROVIDER !== undefined,
    active,
    planCode: subscription?.plan ?? "onecore_monthly",
    status: subscription?.status ?? "inactive",
    provider: subscription?.provider ?? null,
    externalSubscriptionId: subscription?.externalSubscriptionId ?? null,
  });
});

router.post("/billing/checkout", requireAuth, async (_req, res): Promise<void> => {
  if (!process.env.BILLING_PROVIDER) {
    res.status(503).json({
      error: "Automatic billing is not configured yet.",
      requiresProviderSetup: true,
    });
    return;
  }

  res.status(501).json({
    error: "Billing provider adapter is not connected yet.",
    requiresProviderSetup: true,
  });
});

router.post("/billing/webhook", async (_req, res): Promise<void> => {
  res.status(503).json({
    error: "Billing webhook is disabled until a provider and signature verification are configured.",
  });
});

export default router;
