export enum Subject {
  MATHS = 'Maths',
  PHYSICS = 'Physics',
  CHEMISTRY = 'Chemistry',
  OTHER = 'Other'
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED_ON_TIME = 'COMPLETED_ON_TIME',
  COMPLETED_DELAYED = 'COMPLETED_DELAYED',
  SKIPPED = 'SKIPPED'
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  subject: Subject;
  estimatedMinutes: number;
  actualMinutes: number;
  status: TaskStatus;
  createdAt: number;
  completedAt?: number;
}

export interface User {
  id: string;
  username: string;
  name: string;
  avatar?: string;
  stats: {
    totalTasks: number;
    successRate: number; // percentage
    studyHours: number;
    streak: number;
  };
  currentTaskId?: string | null; // ID of task currently being worked on
}

export interface DaySummary {
  id: string;
  userId: string;
  date: string;
  mathsProblems: number;
  physicsProblems: number;
  chemistryProblems: number;
  topicsCovered: string;
  rating: number; // 1-5
  totalHours: number;
  notes: string;
  tasksCompleted: number;
  totalTasks: number;
  successRate: number;
}

// For live feed simulation
export interface FriendActivity {
  user: User;
  activeTask?: Task;
  lastActive: string;
}