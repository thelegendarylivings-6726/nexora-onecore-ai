import { and, asc, count, eq, gte, isNotNull, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  DecideCommandApprovalBody,
  DecideCommandApprovalParams,
  DecideCommandApprovalResponse,
  GetPendingCommandApprovalsResponse,
  SubmitCommandBody,
  SubmitCommandResponse,
} from "@workspace/api-zod";
import {
  activityLogsTable,
  approvalsTable,
  auditLogsTable,
  commandRunsTable,
  db,
  usageRecordsTable,
} from "@workspace/db";
import { createOneCorePlan, isOneCoreAIConfigured } from "../lib/onecore-ai";
import { ensureWorkspace } from "../lib/workspace";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
const COMMAND_RATE_LIMIT = 10;
const COMMAND_RATE_WINDOW_MS = 15 * 60 * 1000;
const COMMAND_REQUEST_METRIC = "onecore.command.request";

async function reserveCommand(
  organizationId: string,
  clerkUserId: string,
  prompt: string | null,
): Promise<
  | { limited: true; retryAfterSeconds: number }
  | { limited: false; commandId: string | null }
> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`onecore:${clerkUserId}`})::bigint)`,
    );
    const windowStart = new Date(Date.now() - COMMAND_RATE_WINDOW_MS);
    const [recentUsage] = await tx
      .select({ total: count() })
      .from(usageRecordsTable)
      .where(
        and(
          eq(usageRecordsTable.actorClerkUserId, clerkUserId),
          eq(usageRecordsTable.metric, COMMAND_REQUEST_METRIC),
          gte(usageRecordsTable.recordedAt, windowStart),
        ),
      );

    if ((recentUsage?.total ?? 0) >= COMMAND_RATE_LIMIT) {
      const [oldestRequest] = await tx
        .select({ recordedAt: usageRecordsTable.recordedAt })
        .from(usageRecordsTable)
        .where(
          and(
            eq(usageRecordsTable.actorClerkUserId, clerkUserId),
            eq(usageRecordsTable.metric, COMMAND_REQUEST_METRIC),
            gte(usageRecordsTable.recordedAt, windowStart),
          ),
        )
        .orderBy(asc(usageRecordsTable.recordedAt))
        .limit(1);
      await tx.insert(auditLogsTable).values({
        organizationId,
        actorClerkUserId: clerkUserId,
        action: "command.rate_limited",
        resourceType: "command",
        properties: { windowMinutes: 15, limit: COMMAND_RATE_LIMIT },
      });
      return {
        limited: true,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(
            ((oldestRequest?.recordedAt.getTime() ?? Date.now()) +
              COMMAND_RATE_WINDOW_MS -
              Date.now()) /
              1000,
          ),
        ),
      };
    }

    await tx.insert(usageRecordsTable).values({
      organizationId,
      actorClerkUserId: clerkUserId,
      metric: COMMAND_REQUEST_METRIC,
      quantity: 1,
    });
    if (prompt === null) {
      await tx.insert(auditLogsTable).values({
        organizationId,
        actorClerkUserId: clerkUserId,
        action: "command.unavailable",
        resourceType: "command",
        properties: { reason: "ai_integration_required" },
      });
      return { limited: false, commandId: null };
    }

    const [command] = await tx
      .insert(commandRunsTable)
      .values({ organizationId, requestedBy: clerkUserId, prompt })
      .returning({ id: commandRunsTable.id });
    if (!command) {
      throw new Error("Unable to reserve a OneCore command.");
    }
    await tx.insert(auditLogsTable).values({
      organizationId,
      actorClerkUserId: clerkUserId,
      action: "command.submitted",
      resourceType: "command_run",
      resourceId: command.id,
    });
    return { limited: false, commandId: command.id };
  });
}

router.post("/commands", requireAuth, async (req, res): Promise<void> => {
  const parsed = SubmitCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const prompt = parsed.data.prompt.trim();
  if (!prompt) {
    res.status(400).json({ error: "Command prompt cannot be empty." });
    return;
  }

  const clerkUserId = req.clerkUserId!;
  const workspace = await ensureWorkspace(clerkUserId);
  const aiConfigured = isOneCoreAIConfigured();
  const reservation = await reserveCommand(
    workspace.id,
    clerkUserId,
    aiConfigured ? prompt : null,
  );
  if (reservation.limited) {
    res.setHeader("Retry-After", String(reservation.retryAfterSeconds));
    res.status(429).json({
      error: "Command limit reached. Wait before submitting another command.",
      retryAfterSeconds: reservation.retryAfterSeconds,
    });
    return;
  }
  const commandId = reservation.commandId;
  if (!aiConfigured || !commandId) {
    res.json(
      SubmitCommandResponse.parse({
        status: "unavailable",
        message:
          "AI integration required. The command was not run or stored. Connect an AI provider before using OneCore commands.",
      }),
    );
    return;
  }

  try {
    const plan = await createOneCorePlan(prompt);
    const approvalRequired = plan.actions.length > 0;
    const message = approvalRequired
      ? "Proposal ready. An organization owner or administrator must review it. No external action has been executed."
      : "OneCore response ready. No action was executed.";

    await db.transaction(async (tx) => {
      await tx
        .update(commandRunsTable)
        .set({
          response: plan.response,
          proposedActions: plan.actions,
          status: approvalRequired ? "pending_approval" : "completed",
          inputTokens: plan.inputTokens,
          outputTokens: plan.outputTokens,
        })
        .where(eq(commandRunsTable.id, commandId));

      if (approvalRequired) {
        await tx.insert(approvalsTable).values({
          organizationId: workspace.id,
          commandRunId: commandId,
          requestedBy: clerkUserId,
          title: "Review proposed OneCore actions",
        });
      }

      if (plan.inputTokens > 0) {
        await tx.insert(usageRecordsTable).values({
          organizationId: workspace.id,
          actorClerkUserId: clerkUserId,
          metric: "onecore.command.input_tokens",
          quantity: plan.inputTokens,
        });
      }
      if (plan.outputTokens > 0) {
        await tx.insert(usageRecordsTable).values({
          organizationId: workspace.id,
          actorClerkUserId: clerkUserId,
          metric: "onecore.command.output_tokens",
          quantity: plan.outputTokens,
        });
      }

      await tx.insert(auditLogsTable).values({
        organizationId: workspace.id,
        actorClerkUserId: clerkUserId,
        action: approvalRequired
          ? "command.proposal_created"
          : "command.completed",
        resourceType: "command_run",
        resourceId: commandId,
        properties: { actionCount: plan.actions.length },
      });
      await tx.insert(activityLogsTable).values({
        organizationId: workspace.id,
        actorClerkUserId: clerkUserId,
        type: approvalRequired ? "command_proposed" : "command_completed",
        title: approvalRequired
          ? "OneCore proposal ready for review"
          : "OneCore response prepared",
        detail: approvalRequired
          ? "Proposed actions are waiting for an organization owner or administrator. Nothing was executed."
          : "OneCore prepared an administrative response. No action was executed.",
      });
    });

    res.json(
      SubmitCommandResponse.parse({
        status: approvalRequired ? "pending_approval" : "completed",
        message,
        commandId,
        response: plan.response,
        actions: plan.actions,
      }),
    );
  } catch (error) {
    req.log.error(
      {
        commandId: reservation.commandId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      },
      "OneCore command generation failed",
    );
    await db.transaction(async (tx) => {
      await tx
        .update(commandRunsTable)
        .set({ status: "failed" })
        .where(eq(commandRunsTable.id, commandId));
      await tx.insert(auditLogsTable).values({
        organizationId: workspace.id,
        actorClerkUserId: clerkUserId,
        action: "command.failed",
        resourceType: "command_run",
        resourceId: commandId,
      });
    });
    res.status(502).json({
      error: "OneCore could not prepare a reliable response. No actions were executed.",
    });
  }
});

router.get(
  "/commands/approvals/pending",
  requireAuth,
  async (req, res): Promise<void> => {
    const workspace = await ensureWorkspace(req.clerkUserId!);
    const rows = await db
      .select({
        id: approvalsTable.id,
        commandId: commandRunsTable.id,
        prompt: commandRunsTable.prompt,
        response: commandRunsTable.response,
        actions: commandRunsTable.proposedActions,
        requestedBy: commandRunsTable.requestedBy,
        createdAt: approvalsTable.createdAt,
      })
      .from(approvalsTable)
      .innerJoin(
        commandRunsTable,
        eq(approvalsTable.commandRunId, commandRunsTable.id),
      )
      .where(
        and(
          eq(approvalsTable.organizationId, workspace.id),
          eq(approvalsTable.status, "required"),
          isNotNull(approvalsTable.commandRunId),
          ...(workspace.role === "owner" || workspace.role === "admin"
            ? []
            : [
                eq(
                  commandRunsTable.requestedBy,
                  req.clerkUserId!,
                ),
              ]),
        ),
      )
      .orderBy(asc(approvalsTable.createdAt));

    res.json(GetPendingCommandApprovalsResponse.parse(rows));
  },
);

router.post(
  "/commands/approvals/:approvalId/decision",
  requireAuth,
  async (req, res): Promise<void> => {
    const approvalId = Array.isArray(req.params.approvalId)
      ? req.params.approvalId[0]
      : req.params.approvalId;
    const params = DecideCommandApprovalParams.safeParse({ approvalId });
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const body = DecideCommandApprovalBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const clerkUserId = req.clerkUserId!;
    const workspace = await ensureWorkspace(clerkUserId);
    if (workspace.role !== "owner" && workspace.role !== "admin") {
      await db.insert(auditLogsTable).values({
        organizationId: workspace.id,
        actorClerkUserId: clerkUserId,
        action: "command.approval_denied",
        resourceType: "command_approval",
        resourceId: params.data.approvalId,
        properties: { role: workspace.role },
      });
      res.status(403).json({ error: "Owner or administrator review required." });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [approval] = await tx
        .select()
        .from(approvalsTable)
        .where(
          and(
            eq(approvalsTable.id, params.data.approvalId),
            eq(approvalsTable.organizationId, workspace.id),
            isNotNull(approvalsTable.commandRunId),
          ),
        )
        .for("update");
      if (!approval) return { kind: "not_found" as const };
      if (approval.status !== "required" || !approval.commandRunId) {
        return { kind: "already_reviewed" as const };
      }

      const status = body.data.decision === "approve" ? "approved" : "rejected";
      const reviewedAt = new Date();
      await tx
        .update(approvalsTable)
        .set({ status, reviewedBy: clerkUserId, reviewedAt })
        .where(eq(approvalsTable.id, approval.id));
      await tx
        .update(commandRunsTable)
        .set({ status })
        .where(eq(commandRunsTable.id, approval.commandRunId));
      await tx.insert(auditLogsTable).values({
        organizationId: workspace.id,
        actorClerkUserId: clerkUserId,
        action: `command.approval_${body.data.decision}`,
        resourceType: "command_run",
        resourceId: approval.commandRunId,
        properties: { approvalId: approval.id },
      });
      await tx.insert(activityLogsTable).values({
        organizationId: workspace.id,
        actorClerkUserId: clerkUserId,
        type: `command_${status}`,
        title:
          status === "approved"
            ? "OneCore proposal approved"
            : "OneCore proposal rejected",
        detail:
          status === "approved"
            ? "Approval was recorded. No external system or business record was changed."
            : "The proposal was rejected. No action was executed.",
      });
      return { kind: "decided" as const, status, id: approval.id };
    });

    if (result.kind === "not_found") {
      res.status(404).json({ error: "Approval not found in this organization." });
      return;
    }
    if (result.kind === "already_reviewed") {
      res.status(409).json({ error: "This proposal has already been reviewed." });
      return;
    }

    res.json(
      DecideCommandApprovalResponse.parse({
        id: result.id,
        status: result.status,
        message:
          result.status === "approved"
            ? "Approval recorded. No external action was executed."
            : "Proposal rejected. No action was executed.",
      }),
    );
  },
);

export default router;
