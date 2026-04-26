import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, entitiesTable, propertiesTable, changeLogTable } from "@workspace/db";
import {
  ListEntitiesParams,
  CreateEntityParams,
  CreateEntityBody,
  GetEntityParams,
  UpdateEntityParams,
  UpdateEntityBody,
  DeleteEntityParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/projects/:projectId/entities", async (req, res): Promise<void> => {
  const params = ListEntitiesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const entities = await db.select().from(entitiesTable).where(eq(entitiesTable.projectId, params.data.projectId));
  res.json(entities);
});

router.post("/projects/:projectId/entities", async (req, res): Promise<void> => {
  const params = CreateEntityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateEntityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [entity] = await db.insert(entitiesTable).values({ ...parsed.data, projectId: params.data.projectId }).returning();
  await db.insert(changeLogTable).values({
    projectId: params.data.projectId,
    entityType: "entity",
    entityId: entity.id,
    action: "created",
    description: `Created entity "${entity.name}" (${entity.type})`,
    newValue: entity,
  }).catch(() => {});
  res.status(201).json(entity);
});

router.get("/projects/:projectId/entities/:id", async (req, res): Promise<void> => {
  const params = GetEntityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [entity] = await db.select().from(entitiesTable).where(
    and(eq(entitiesTable.id, params.data.id), eq(entitiesTable.projectId, params.data.projectId))
  );
  if (!entity) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }
  const properties = await db.select().from(propertiesTable).where(eq(propertiesTable.entityId, entity.id));
  res.json({ ...entity, properties });
});

router.patch("/projects/:projectId/entities/:id", async (req, res): Promise<void> => {
  const params = UpdateEntityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateEntityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [before] = await db.select().from(entitiesTable).where(
    and(eq(entitiesTable.id, params.data.id), eq(entitiesTable.projectId, params.data.projectId))
  );
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== null && v !== undefined) updateData[k] = v;
  }
  const [entity] = await db.update(entitiesTable).set(updateData).where(
    and(eq(entitiesTable.id, params.data.id), eq(entitiesTable.projectId, params.data.projectId))
  ).returning();
  if (!entity) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }
  await db.insert(changeLogTable).values({
    projectId: params.data.projectId,
    entityType: "entity",
    entityId: entity.id,
    action: "updated",
    description: `Updated entity "${entity.name}"`,
    previousValue: before ?? null,
    newValue: entity,
  }).catch(() => {});
  res.json(entity);
});

router.delete("/projects/:projectId/entities/:id", async (req, res): Promise<void> => {
  const params = DeleteEntityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(entitiesTable).where(
    and(eq(entitiesTable.id, params.data.id), eq(entitiesTable.projectId, params.data.projectId))
  ).returning();
  if (!deleted) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }
  await db.insert(changeLogTable).values({
    projectId: params.data.projectId,
    entityType: "entity",
    entityId: deleted.id,
    action: "deleted",
    description: `Deleted entity "${deleted.name}" (${deleted.type})`,
    previousValue: deleted,
  }).catch(() => {});
  res.sendStatus(204);
});

export default router;
