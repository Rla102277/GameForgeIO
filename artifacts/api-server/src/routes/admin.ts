import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, appUsersTable } from "@workspace/db";

const router: IRouter = Router();

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const userId = req.auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return false; }
  const [user] = await db.select().from(appUsersTable).where(eq(appUsersTable.clerkId, userId));
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return false; }
  return true;
}

router.get("/admin/users", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  const users = await db.select().from(appUsersTable).orderBy(desc(appUsersTable.createdAt));
  res.json(users);
});

router.put("/admin/users/:clerkId/role", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  const { clerkId } = req.params;
  const { role } = req.body as { role: string };
  if (!["user", "admin"].includes(role)) { res.status(400).json({ error: "Role must be 'user' or 'admin'" }); return; }
  const [updated] = await db.update(appUsersTable).set({ role, updatedAt: new Date() }).where(eq(appUsersTable.clerkId, clerkId)).returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json(updated);
});

router.delete("/admin/users/:clerkId", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  const { clerkId } = req.params;
  await db.delete(appUsersTable).where(eq(appUsersTable.clerkId, clerkId));
  res.json({ success: true });
});

export default router;
