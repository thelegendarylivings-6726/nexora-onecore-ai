import { and, count, desc, eq, ne } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  activityLogsTable,
  agentsTable,
  approvalsTable,
  appointmentsTable,
  customersTable,
  db,
  leadsTable,
  organizationBusinessesTable,
  supportRequestsTable,
  tasksTable,
  workflowsTable,
} from "@workspace/db";
import {
  GetDashboardActivityResponse,
  GetDashboardSummaryResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { ensureWorkspace } from "../lib/workspace";

const router: IRouter = Router();

router.get(
  "/dashboard/summary",
  requireAuth,
  async (req, res): Promise<void> => {
    const workspace = await ensureWorkspace(req.clerkUserId!);
    const organizationId = workspace.id;

    const [
      activeAgents,
      businessesEnabled,
      tasksRunning,
      tasksCompleted,
      leads,
      customers,
      appointments,
      supportRequests,
      automations,
      approvalsRequired,
    ] = await Promise.all([
      db
        .select({ total: count() })
        .from(agentsTable)
        .where(
          and(
            eq(agentsTable.organizationId, organizationId),
            eq(agentsTable.status, "active"),
          ),
        ),
      db
        .select({ total: count() })
        .from(organizationBusinessesTable)
        .where(eq(organizationBusinessesTable.organizationId, organizationId)),
      db
        .select({ total: count() })
        .from(tasksTable)
        .where(
          and(
            eq(tasksTable.organizationId, organizationId),
            eq(tasksTable.status, "running"),
          ),
        ),
      db
        .select({ total: count() })
        .from(tasksTable)
        .where(
          and(
            eq(tasksTable.organizationId, organizationId),
            eq(tasksTable.status, "completed"),
          ),
        ),
      db
        .select({ total: count() })
        .from(leadsTable)
        .where(eq(leadsTable.organizationId, organizationId)),
      db
        .select({ total: count() })
        .from(customersTable)
        .where(eq(customersTable.organizationId, organizationId)),
      db
        .select({ total: count() })
        .from(appointmentsTable)
        .where(eq(appointmentsTable.organizationId, organizationId)),
      db
        .select({ total: count() })
        .from(supportRequestsTable)
        .where(
          and(
            eq(supportRequestsTable.organizationId, organizationId),
            ne(supportRequestsTable.status, "closed"),
          ),
        ),
      db
        .select({ total: count() })
        .from(workflowsTable)
        .where(
          and(
            eq(workflowsTable.organizationId, organizationId),
            eq(workflowsTable.status, "active"),
          ),
        ),
      db
        .select({ total: count() })
        .from(approvalsTable)
        .where(
          and(
            eq(approvalsTable.organizationId, organizationId),
            eq(approvalsTable.status, "required"),
          ),
        ),
    ]);

    res.json(
      GetDashboardSummaryResponse.parse({
        activeAgents: activeAgents[0]?.total ?? 0,
        businessesEnabled: businessesEnabled[0]?.total ?? 0,
        tasksRunning: tasksRunning[0]?.total ?? 0,
        tasksCompleted: tasksCompleted[0]?.total ?? 0,
        leads: leads[0]?.total ?? 0,
        customers: customers[0]?.total ?? 0,
        appointments: appointments[0]?.total ?? 0,
        supportRequests: supportRequests[0]?.total ?? 0,
        automations: automations[0]?.total ?? 0,
        approvalsRequired: approvalsRequired[0]?.total ?? 0,
      }),
    );
  },
);

router.get(
  "/dashboard/activity",
  requireAuth,
  async (req, res): Promise<void> => {
    const workspace = await ensureWorkspace(req.clerkUserId!);
    const rows = await db
      .select()
      .from(activityLogsTable)
      .where(eq(activityLogsTable.organizationId, workspace.id))
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(20);
    res.json(
      GetDashboardActivityResponse.parse(
        rows.map((activity) => ({
          id: activity.id,
          type: activity.type,
          title: activity.title,
          detail: activity.detail,
          createdAt: activity.createdAt,
        })),
      ),
    );
  },
);

export default router;
