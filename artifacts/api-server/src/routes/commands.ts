import { Router, type IRouter } from "express";
import {
  SubmitCommandBody,
  SubmitCommandResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { ensureWorkspace } from "../lib/workspace";

const router: IRouter = Router();

router.post("/commands", requireAuth, async (req, res): Promise<void> => {
  const parsed = SubmitCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await ensureWorkspace(req.clerkUserId!);
  res.json(
    SubmitCommandResponse.parse({
      status: "unavailable",
      message:
        "AI integration required. The command was not run or stored. Connect an AI provider before using OneCore commands.",
    }),
  );
});

export default router;
