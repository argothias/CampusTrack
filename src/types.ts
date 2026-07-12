/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  mimeType?: string;
  source: 'google-drive' | 'local';
}

export interface ObjectiveQuestion {
  id: string;
  question: string;
  options: string[]; // e.g. A, B, C, D text
  correctAnswer: string; // e.g. "A", "B", "C", "D"
}

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  isSynced: boolean;
  createdBy: string;
  createdById: string;
  groupId: string | null;
  completed?: boolean;
  classmateId?: string | null;
  subtasks?: Subtask[];
  attachments?: Attachment[];
  isArchived?: boolean;
  completedAt?: string | null;
  isPinned?: boolean;
  points?: number;
  status?: 'todo' | 'in_progress' | 'completed';
  createdAt?: string;
  
  // Asynchronous Task submission parameters
  submissionType?: 'none' | 'subjective' | 'objective';
  maxScore?: number;
  subjectivePrompt?: string;
  objectiveQuestions?: ObjectiveQuestion[];
}

export interface StudentProfile {
  id: string; // ID here acts as unique username key
  name: string;
  avatar: string;
  tagline: string;
  autoDeleteCompleted?: boolean;
  autoDeleteInterval?: string;
  securityQuestion?: string;
  securityAnswer?: string;
  username?: string;
  appMode?: string;
  role?: string; // User role: Student, Teacher, Class, School Department, Administrative Office, School
  onboardingCompleted?: boolean;
  dailyLoginStreak?: number;
  lastLoginDate?: string;
  studyStreak?: number;
  lastStudyDate?: string;
  assignmentStreak?: number;
  lastSubmitDate?: string;
  badges?: string;
  points?: number;
  equippedBadge?: string;
  groupId?: string | null;
  googleToken?: string;
  googleEmail?: string;
  googleTokenUpdatedAt?: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  creatorId: string;
}

export interface GroupMembership {
  id: string;
  groupId: string;
  userId: string;
  role: 'leader' | 'classmate';
  canSyncTasks: boolean;
  canAnnounce: boolean;
}

export interface Announcement {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  createdAt: string;
  imageAttachment?: string | null;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  createdAt: string;
  imageAttachment?: string | null;
}

export interface SyncedTaskCompletion {
  id?: string;
  classmateId: string;
  taskId: string;
  completed: boolean;
  completedAt?: string;
  completedSubtaskIds?: string[];
  status?: 'todo' | 'in_progress' | 'completed';
}

export interface AttendanceLog {
  id?: string;
  classmateId: string;
  date: string;
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  subject: string;
  groupId?: string | null;
}

export interface TaskSubmission {
  id: string; // unique ID, e.g. `${classmateId}-${taskId}`
  taskId: string;
  classmateId: string;
  classmateName: string;
  classmateAvatar: string;
  submittedAt: string;
  submissionType: 'subjective' | 'objective';
  
  // For subjective task
  subjectiveAnswer?: string;
  
  // For objective task
  objectiveAnswers?: { [questionId: string]: string }; // questionId -> chosenOption
  
  score?: number; // assigned manually for subjective, automatically computed for objective
  status: 'pending' | 'graded';
  feedback?: string;
  gradedBy?: string;
  gradedAt?: string;
}
