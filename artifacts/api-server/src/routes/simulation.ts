import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, simulationsTable } from "@workspace/db";
import {
  RunSimulationParams,
  RunSimulationBody,
  ListSimulationsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function runMonteCarlo(config: {
  iterations: number;
  turns: number;
  goldPerTurn: number;
  goldSpendPerTurn: number;
  incomeVariance?: number;
  spendVariance?: number;
  startingGold?: number;
}) {
  const {
    iterations,
    turns,
    goldPerTurn,
    goldSpendPerTurn,
    incomeVariance = 0.2,
    spendVariance = 0.2,
    startingGold = 0,
  } = config;

  // Run all simulations
  const allRuns: number[][] = [];
  for (let i = 0; i < iterations; i++) {
    const run: number[] = [];
    let gold = startingGold;
    for (let t = 0; t < turns; t++) {
      const incomeNoise = 1 + (Math.random() * 2 - 1) * incomeVariance;
      const spendNoise = 1 + (Math.random() * 2 - 1) * spendVariance;
      gold += goldPerTurn * incomeNoise - goldSpendPerTurn * spendNoise;
      run.push(gold);
    }
    allRuns.push(run);
  }

  // Compute turn-by-turn percentiles
  const turnData = [];
  for (let t = 0; t < turns; t++) {
    const turnValues = allRuns.map((r) => r[t]).sort((a, b) => a - b);
    const p10 = turnValues[Math.floor(iterations * 0.1)];
    const p50 = turnValues[Math.floor(iterations * 0.5)];
    const p90 = turnValues[Math.floor(iterations * 0.9)];
    const mean = turnValues.reduce((a, b) => a + b, 0) / iterations;
    turnData.push({ turn: t + 1, p10, p50, p90, mean });
  }

  // Final turn stats
  const finalValues = allRuns.map((r) => r[turns - 1]).sort((a, b) => a - b);
  const p10Final = finalValues[Math.floor(iterations * 0.1)];
  const p50Final = finalValues[Math.floor(iterations * 0.5)];
  const p90Final = finalValues[Math.floor(iterations * 0.9)];
  const meanFinal = finalValues.reduce((a, b) => a + b, 0) / iterations;
  const variance = finalValues.reduce((a, b) => a + Math.pow(b - meanFinal, 2), 0) / iterations;
  const stdDev = Math.sqrt(variance);

  // Economy health score: checks if gold stays positive and stable
  // >70 balanced (positive P10, low variance relative to mean)
  // 40-70 watch (P10 borderline or high variance)
  // <40 broken (negative P10 or extreme variance)
  let healthScore = 100;
  if (p10Final < 0) healthScore -= 40;
  else if (p10Final < startingGold * 0.5) healthScore -= 20;

  const relativeStdDev = meanFinal !== 0 ? stdDev / Math.abs(meanFinal) : 1;
  if (relativeStdDev > 1.5) healthScore -= 30;
  else if (relativeStdDev > 0.8) healthScore -= 15;

  const netPerTurn = goldPerTurn - goldSpendPerTurn;
  if (netPerTurn < 0) healthScore -= 20;
  else if (netPerTurn > goldPerTurn * 2) healthScore -= 10; // runaway economy

  healthScore = Math.max(0, Math.min(100, healthScore));

  return { p10Final, p50Final, p90Final, meanFinal, stdDev, healthScore, turnData };
}

router.post("/projects/:projectId/simulate", async (req, res): Promise<void> => {
  const params = RunSimulationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = RunSimulationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const config = parsed.data;
  const result = runMonteCarlo({
    iterations: config.iterations,
    turns: config.turns,
    goldPerTurn: config.goldPerTurn,
    goldSpendPerTurn: config.goldSpendPerTurn,
    incomeVariance: config.incomeVariance ?? 0.2,
    spendVariance: config.spendVariance ?? 0.2,
    startingGold: config.startingGold ?? 0,
  });

  const [simulation] = await db.insert(simulationsTable).values({
    projectId: params.data.projectId,
    label: config.label ?? null,
    config: config as unknown as Record<string, unknown>,
    percentile10: result.p10Final,
    percentile50: result.p50Final,
    percentile90: result.p90Final,
    mean: result.meanFinal,
    stdDev: result.stdDev,
    economyHealthScore: result.healthScore,
    turnData: result.turnData as unknown as Record<string, unknown>[],
  }).returning();

  res.json({
    ...simulation,
    config,
    turnData: result.turnData,
  });
});

router.get("/projects/:projectId/simulation-history", async (req, res): Promise<void> => {
  const params = ListSimulationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const simulations = await db.select({
    id: simulationsTable.id,
    projectId: simulationsTable.projectId,
    label: simulationsTable.label,
    economyHealthScore: simulationsTable.economyHealthScore,
    mean: simulationsTable.mean,
    createdAt: simulationsTable.createdAt,
  }).from(simulationsTable).where(eq(simulationsTable.projectId, params.data.projectId)).orderBy(desc(simulationsTable.createdAt));
  res.json(simulations);
});

export default router;
