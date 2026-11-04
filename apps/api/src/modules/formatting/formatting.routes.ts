import { Router } from "express";
import { FormattingController } from "./formatting.controller";
import { formatRequestSchema } from "./formatting.schema";
import { validate } from "../../middleware/validate.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";

export const formattingRouter = Router();

// All formatting requests require authentication
formattingRouter.use(authMiddleware);

// POST /api/format - Format source code using allowlisted formatters
formattingRouter.post("/", validate({ body: formatRequestSchema }), FormattingController.format);
