import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import entitiesRouter from "./entities";
import propertiesRouter from "./properties";
import rulesRouter from "./rules";
import simulationRouter from "./simulation";
import assetsRouter from "./assets";
import exportRouter from "./export";
import anthropicRouter from "./anthropic-routes";
import openaiRouter from "./openai-routes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(entitiesRouter);
router.use(propertiesRouter);
router.use(rulesRouter);
router.use(simulationRouter);
router.use(assetsRouter);
router.use(exportRouter);
router.use(anthropicRouter);
router.use(openaiRouter);

export default router;
