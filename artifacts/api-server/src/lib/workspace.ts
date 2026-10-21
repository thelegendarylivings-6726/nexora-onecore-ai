import { and, eq } from "drizzle-orm";
import {
  db,
  membershipsTable,
  organizationBusinessesTable,
  organizationsTable,
  usersTable,
} from "@workspace/db";

export type WorkspaceMembership = {
  id: string;
  name: string;
  role: "owner" | "admin" | "user";
  userId: string;
};

export async function ensureWorkspace(
  clerkUserId: string,
): Promise<WorkspaceMembership> {
  const findMembership = async () => {
    const [membership] = await db
      .select({
        id: organizationsTable.id,
        name: organizationsTable.name,
        role: membershipsTable.role,
        userId: usersTable.id,
      })
      .from(membershipsTable)
      .innerJoin(
        organizationsTable,
        eq(membershipsTable.organizationId, organizationsTable.id),
      )
      .innerJoin(usersTable, eq(membershipsTable.userId, usersTable.id))
      .where(eq(usersTable.clerkUserId, clerkUserId))
      .limit(1);
    return membership;
  };

  const existing = await findMembership();
  if (existing) return existing;

  return db.transaction(async (tx) => {
    const [createdUser] = await tx
      .insert(usersTable)
      .values({ clerkUserId })
      .onConflictDoNothing()
      .returning();
    const [user] = createdUser
      ? [createdUser]
      : await tx
          .select()
          .from(usersTable)
          .where(eq(usersTable.clerkUserId, clerkUserId))
          .limit(1);

    if (!user) {
      throw new Error("Unable to provision the signed-in user.");
    }

    const [existingMembership] = await tx
      .select({
        id: organizationsTable.id,
        name: organizationsTable.name,
        role: membershipsTable.role,
        userId: usersTable.id,
      })
      .from(membershipsTable)
      .innerJoin(
        organizationsTable,
        eq(membershipsTable.organizationId, organizationsTable.id),
      )
      .innerJoin(usersTable, eq(membershipsTable.userId, usersTable.id))
      .where(
        and(
          eq(usersTable.clerkUserId, clerkUserId),
          eq(membershipsTable.userId, user.id),
        ),
      )
      .limit(1);

    if (existingMembership) return existingMembership;

    const [organization] = await tx
      .insert(organizationsTable)
      .values({ name: "My organization" })
      .returning();
    if (!organization) {
      throw new Error("Unable to create the organization workspace.");
    }

    const [membership] = await tx
      .insert(membershipsTable)
      .values({
        organizationId: organization.id,
        userId: user.id,
        role: "owner",
      })
      .onConflictDoNothing()
      .returning();

    if (!membership) {
      await tx
        .delete(organizationsTable)
        .where(eq(organizationsTable.id, organization.id));
      return null;
    }

    return {
      id: organization.id,
      name: organization.name,
      role: membership.role,
      userId: user.id,
    };
  }).then(async (membership) => {
    if (membership) return membership;
    const recovered = await findMembership();
    if (recovered) return recovered;
    throw new Error("Unable to create the organization membership.");
  });
}

export async function getWorkspaceSnapshot(clerkUserId: string) {
  const workspace = await ensureWorkspace(clerkUserId);
  const enabledRows = await db
    .select({ slug: organizationBusinessesTable.businessSlug })
    .from(organizationBusinessesTable)
    .where(eq(organizationBusinessesTable.organizationId, workspace.id));

  return {
    id: workspace.id,
    name: workspace.name,
    role: workspace.role,
    enabledBusinesses: enabledRows.map((row) => row.slug),
  };
}
