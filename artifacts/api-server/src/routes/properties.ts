import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, propertiesTable } from "@workspace/db";
import {
  ListPropertiesParams,
  CreatePropertyParams,
  CreatePropertyBody,
  UpdatePropertyParams,
  UpdatePropertyBody,
  DeletePropertyParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/projects/:projectId/entities/:entityId/properties", async (req, res): Promise<void> => {
  const params = ListPropertiesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const properties = await db.select().from(propertiesTable).where(eq(propertiesTable.entityId, params.data.entityId));
  res.json(properties);
});

router.post("/projects/:projectId/entities/:entityId/properties", async (req, res): Promise<void> => {
  const params = CreatePropertyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreatePropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [property] = await db.insert(propertiesTable).values({ ...parsed.data, entityId: params.data.entityId }).returning();
  res.status(201).json(property);
});

router.patch("/projects/:projectId/entities/:entityId/properties/:id", async (req, res): Promise<void> => {
  const params = UpdatePropertyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdatePropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== null && v !== undefined) updateData[k] = v;
  }
  const [property] = await db.update(propertiesTable).set(updateData).where(
    and(eq(propertiesTable.id, params.data.id), eq(propertiesTable.entityId, params.data.entityId))
  ).returning();
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  res.json(property);
});

router.delete("/projects/:projectId/entities/:entityId/properties/:id", async (req, res): Promise<void> => {
  const params = DeletePropertyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(propertiesTable).where(
    and(eq(propertiesTable.id, params.data.id), eq(propertiesTable.entityId, params.data.entityId))
  ).returning();
  if (!deleted) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
