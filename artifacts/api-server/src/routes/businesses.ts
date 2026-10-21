import { asc, and, eq, ilike, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  businessesTable,
  db,
} from "@workspace/db";
import {
  ListBusinessesQueryParams,
  ListBusinessesResponse,
} from "@workspace/api-zod";
import { businessCatalog } from "../lib/businessCatalog";

const router: IRouter = Router();
let catalogSeed: Promise<void> | undefined;

export function ensureBusinessCatalog(): Promise<void> {
  if (!catalogSeed) {
    catalogSeed = db
      .insert(businessesTable)
      .values(businessCatalog)
      .onConflictDoNothing()
      .then(() => undefined)
      .catch((error: unknown) => {
        catalogSeed = undefined;
        throw error;
      });
  }
  return catalogSeed;
}

router.get("/businesses", async (req, res): Promise<void> => {
  const params = ListBusinessesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await ensureBusinessCatalog();
  const { search, industry, function: functionCategory } = params.data;
  const filters = [];
  if (search) {
    const pattern = `%${search}%`;
    filters.push(
      or(
        ilike(businessesTable.name, pattern),
        ilike(businessesTable.description, pattern),
        ilike(businessesTable.industry, pattern),
        ilike(businessesTable.functionCategory, pattern),
        sql`array_to_string(${businessesTable.capabilities}, ' ') ILIKE ${pattern}`,
      ),
    );
  }
  if (industry) filters.push(eq(businessesTable.industry, industry));
  if (functionCategory) {
    filters.push(eq(businessesTable.functionCategory, functionCategory));
  }

  const rows =
    filters.length > 0
      ? await db
          .select()
          .from(businessesTable)
          .where(and(...filters))
          .orderBy(asc(businessesTable.sortOrder))
      : await db
          .select()
          .from(businessesTable)
          .orderBy(asc(businessesTable.sortOrder));

  res.json(
    ListBusinessesResponse.parse(
      rows.map((business) => ({
        slug: business.slug,
        name: business.name,
        description: business.description,
        industry: business.industry,
        function: business.functionCategory,
        capabilities: business.capabilities,
        workflow: business.workflow,
        phase: business.phase,
      })),
    ),
  );
});

export default router;
