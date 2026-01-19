import { router } from "./trpc";
import { authRouter } from "./auth";
import { configRouter } from "./config";
import { cyclesRouter } from "./cycles";
import { docsRouter } from "./docs";
import { issuesRouter } from "./issues";
import { labelsRouter } from "./labels";
import { meRouter } from "./me";
import { projectsRouter } from "./projects";
import { searchRouter } from "./search";
import { teamsRouter } from "./teams";

export const appRouter = router({
  ...authRouter._def.procedures,
  ...configRouter._def.procedures,
  ...cyclesRouter._def.procedures,
  ...docsRouter._def.procedures,
  ...issuesRouter._def.procedures,
  ...labelsRouter._def.procedures,
  ...meRouter._def.procedures,
  ...projectsRouter._def.procedures,
  ...searchRouter._def.procedures,
  ...teamsRouter._def.procedures,
});

export type AppRouter = typeof appRouter;

export { router, procedure } from "./trpc";
