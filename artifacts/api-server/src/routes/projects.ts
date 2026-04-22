import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, projectsTable, entitiesTable, propertiesTable, rulesTable, assetsTable, simulationsTable } from "@workspace/db";
import {
  CreateProjectBody,
  UpdateProjectParams,
  UpdateProjectBody,
  DeleteProjectParams,
  GetProjectParams,
  GetProjectStatsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/projects", async (_req, res): Promise<void> => {
  const projects = await db.select().from(projectsTable).orderBy(projectsTable.updatedAt);
  res.json(projects.reverse());
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [project] = await db.insert(projectsTable).values(parsed.data).returning();
  res.status(201).json(project);
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const entities = await db.select().from(entitiesTable).where(eq(entitiesTable.projectId, params.data.id));
  const entityIds = entities.map((e) => e.id);

  let propertiesByEntity: Record<number, typeof propertiesTable.$inferSelect[]> = {};
  if (entityIds.length > 0) {
    const allProps = await db.select().from(propertiesTable).where(
      sql`${propertiesTable.entityId} = ANY(${sql.raw(`ARRAY[${entityIds.join(",")}]`)})`
    );
    for (const prop of allProps) {
      if (!propertiesByEntity[prop.entityId]) propertiesByEntity[prop.entityId] = [];
      propertiesByEntity[prop.entityId].push(prop);
    }
  }

  const rules = await db.select().from(rulesTable).where(eq(rulesTable.projectId, params.data.id)).orderBy(rulesTable.priority);

  res.json({
    ...project,
    entities: entities.map((e) => ({ ...e, properties: propertiesByEntity[e.id] ?? [] })),
    rules,
  });
});

router.patch("/projects/:id", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== null && v !== undefined) updateData[k] = v;
  }

  const [project] = await db.update(projectsTable).set(updateData).where(eq(projectsTable.id, params.data.id)).returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

router.delete("/projects/:id", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(projectsTable).where(eq(projectsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/projects/:id/stats", async (req, res): Promise<void> => {
  const params = GetProjectStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const projectId = params.data.id;

  const [entityCount] = await db.select({ count: sql<number>`count(*)::int` }).from(entitiesTable).where(eq(entitiesTable.projectId, projectId));
  const [ruleCount] = await db.select({ count: sql<number>`count(*)::int` }).from(rulesTable).where(eq(rulesTable.projectId, projectId));
  const [assetCount] = await db.select({ count: sql<number>`count(*)::int` }).from(assetsTable).where(eq(assetsTable.projectId, projectId));
  const [simulationCount] = await db.select({ count: sql<number>`count(*)::int` }).from(simulationsTable).where(eq(simulationsTable.projectId, projectId));

  let propertyCount = 0;
  const entities = await db.select({ id: entitiesTable.id }).from(entitiesTable).where(eq(entitiesTable.projectId, projectId));
  if (entities.length > 0) {
    const entityIds = entities.map((e) => e.id);
    const [pc] = await db.select({ count: sql<number>`count(*)::int` }).from(propertiesTable).where(
      sql`${propertiesTable.entityId} = ANY(${sql.raw(`ARRAY[${entityIds.join(",")}]`)})`
    );
    propertyCount = pc?.count ?? 0;
  }

  res.json({
    projectId,
    entityCount: entityCount?.count ?? 0,
    propertyCount,
    ruleCount: ruleCount?.count ?? 0,
    assetCount: assetCount?.count ?? 0,
    simulationCount: simulationCount?.count ?? 0,
  });
});

export default router;
