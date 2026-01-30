export interface Issue {
  id: string;
  identifier: string;
  title: string;
  description?: string | null;
  state?: string | null;
  assignee?: string | null;
  priority?: number;
  createdAt: Date;
  updatedAt: Date;
  url: string;
  parentId?: string | null;
  branchName: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  state?: string | null;
  progress?: number | null;
  targetDate?: Date | null;
  startDate?: Date | null;
  createdAt: Date;
}

export interface Team {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  private: boolean;
  timezone?: string | null;
}

export interface TeamMember {
  id: string;
  name: string;
  email?: string | null;
  displayName?: string | null;
  active: boolean;
}

export interface Cycle {
  id: string;
  number: number;
  name?: string | null;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  completedAt?: Date | null;
  progress?: number | null;
}

export interface CreateCycleInput {
  teamId: string;
  name?: string;
  description?: string;
  startsAt: string;
  endsAt: string;
}

export interface UpdateCycleInput {
  name?: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  completedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email?: string | null;
  displayName?: string | null;
  active: boolean;
  admin: boolean;
}

export interface ListIssuesFilter {
  team?: string;
  state?: string;
  assignee?: string;
  label?: string;
  project?: string;
}

export interface CreateIssueInput {
  teamId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  priority?: number;
  labelIds?: string[];
  parentId?: string;
  projectId?: string;
}

export interface UpdateIssueInput {
  stateId?: string;
  assigneeId?: string;
  priority?: number;
  labelIds?: string[];
  parentId?: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  teamIds?: string[];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  content?: string;
  statusId?: string;
  startDate?: string;
  targetDate?: string;
  priority?: number;
  leadId?: string;
  teamIds?: string[];
}

export interface Activity {
  id: string;
  identifier: string;
  title: string;
  state?: string | null;
  updatedAt: Date;
  url: string;
}

export interface ProjectMilestone {
  id: string;
  name: string;
  description?: string | null;
  targetDate?: Date | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectMilestoneInput {
  name: string;
  projectId: string;
  description?: string;
  targetDate?: string;
}

export interface UpdateProjectMilestoneInput {
  name?: string;
  description?: string;
  targetDate?: string;
  sortOrder?: number;
}

export interface CustomView {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  filterData: Record<string, unknown>;
  shared: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomViewInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  filterData: Record<string, unknown>;
  shared?: boolean;
}

export interface UpdateCustomViewInput {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  filterData?: Record<string, unknown>;
  shared?: boolean;
}

export interface ProjectUpdate {
  id: string;
  body: string;
  health: "onTrack" | "atRisk" | "offTrack";
  createdAt: Date;
  updatedAt: Date;
  url: string;
  userId?: string;
  userName?: string;
}

export interface Notification {
  id: string;
  type: string;
  category: string;
  createdAt: Date;
  readAt?: Date | null;
  snoozedUntilAt?: Date | null;
  archivedAt?: Date | null;
  actorId?: string | null;
  actorName?: string | null;
}
