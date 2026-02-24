import type { AnyOperationSpec } from "./operation-spec";

import { issueOperationSpec } from "../generated/issue";
import { projectOperationSpec } from "../generated/project";
import { labelOperationSpec } from "../generated/label";
import { docOperationSpec } from "../generated/doc";
import { cycleOperationSpec } from "../router/cycles";
import { viewOperationSpec } from "../router/views";
import { gitAutomationStateOperationSpec } from "../router/git-automation-states";
import { gitAutomationTargetBranchOperationSpec } from "../router/git-automation-target-branches";

export const allOperationSpecs: readonly AnyOperationSpec[] = [
  issueOperationSpec,
  projectOperationSpec,
  labelOperationSpec,
  docOperationSpec,
  cycleOperationSpec,
  viewOperationSpec,
  gitAutomationStateOperationSpec,
  gitAutomationTargetBranchOperationSpec,
];
