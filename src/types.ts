export interface Event {
  id: string;
  name: string;
  createdAt: string;
}

export interface Day {
  id: string; // e.g. '2026-08-01'
  eventId?: string; // Optional for backwards compatibility, but required for new days
  date: string; // ISO format or just yyyy-mm-dd
}

export interface Shift {
  id: string;
  dayId: string;
  name: string; // e.g., '10:00 - 14:00'
  startTime: string;
  endTime: string;
  disableSelfSignup?: boolean;
}

export interface TaskComment {
  id: string;
  text: string;
  createdAt: string;
  authorName?: string;
}

export type TaskStatus = 'ledig' | 'taget' | 'udført';

export interface Task {
  id: string;
  shiftId: string;
  title: string;
  description: string;
  assignedTo: string | null;
  assignees?: string[];
  maxHelpers?: number | null;
  comments: TaskComment[];
  status?: TaskStatus;
  startTime?: string;
  endTime?: string;
}
