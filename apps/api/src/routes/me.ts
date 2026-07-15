import { Router } from "express";
import { requireUser } from "../middleware/auth";

export const meRouter = Router();

meRouter.use(requireUser);

meRouter.get("/", (req, res) => {
  res.json(req.user);
});
