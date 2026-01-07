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
  startsAt: Date;
  endsAt: Date;
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

export interface Activity {
  id: string;
  identifier: string;
  title: string;
  state?: string | null;
  updatedAt: Date;
  url: string;
}
