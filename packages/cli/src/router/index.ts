import { router } from "./trpc";
import { authRouter } from "./auth";
import { configRouter } from "./config";
import { cyclesRouter } from "./cycles";
import { viewsRouter } from "./views";
import { generatedDocsRouter } from "../generated/doc";
import { generatedIssuesRouter } from "../generated/issue";
import { generatedProjectsRouter } from "../generated/project";
import { generatedLabelsRouter } from "../generated/label";
import { generatedTemplatesRouter } from "../generated/template";
import { meRouter } from "./me";
import { searchRouter } from "./search";
import { teamsRouter } from "./teams";
import { usersRouter } from "./users";
import { notificationsRouter } from "./notifications";

export const appRouter = router({
  ...authRouter._def.procedures,
  ...configRouter._def.procedures,
  ...cyclesRouter._def.procedures,
  ...viewsRouter._def.procedures,
  ...generatedDocsRouter._def.procedures,
  ...generatedIssuesRouter._def.procedures,
  ...generatedProjectsRouter._def.procedures,
  ...generatedLabelsRouter._def.procedures,
  ...generatedTemplatesRouter._def.procedures,
  ...meRouter._def.procedures,
  ...searchRouter._def.procedures,
  ...teamsRouter._def.procedures,
  ...usersRouter._def.procedures,
  ...notificationsRouter._def.procedures,
});

export type AppRouter = typeof appRouter;

export { router, procedure } from "./trpc";
