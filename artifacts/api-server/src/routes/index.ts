import { Router, type IRouter } from "express";
import healthRouter from "./health";
import businessRouter from "./businesses";
import workspaceRouter from "./workspace";
import dashboardRouter from "./dashboard";
import commandRouter from "./commands";
import deploymentRouter from "./deployments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(businessRouter);
router.use(workspaceRouter);
router.use(dashboardRouter);
router.use(commandRouter);
router.use(deploymentRouter);

export default router;
