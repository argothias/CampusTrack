import { db } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  writeBatch 
} from 'firebase/firestore';
import { 
  Task, 
  StudentProfile, 
  SyncedTaskCompletion, 
  Group, 
  GroupMembership, 
  Announcement, 
  TaskComment,
  AttendanceLog,
  TaskSubmission
} from '../types';

// Helper: Profiles
export async function getProfileById(profileId: string): Promise<StudentProfile | null> {
  const docRef = doc(db, 'profiles', profileId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as StudentProfile;
  }
  return null;
}

export async function createProfile(profile: StudentProfile): Promise<void> {
  const docRef = doc(db, 'profiles', profile.id);
  await setDoc(docRef, JSON.parse(JSON.stringify(profile)), { merge: true });
}

export async function updateProfile(profileId: string, updates: Partial<StudentProfile>): Promise<void> {
  const docRef = doc(db, 'profiles', profileId);
  await updateDoc(docRef, JSON.parse(JSON.stringify(updates)));
}

// Helper: Groups
export async function createGroup(group: Group, membership: GroupMembership): Promise<void> {
  const batch = writeBatch(db);
  const groupRef = doc(db, 'groups', group.id);
  const memRef = doc(db, 'groupMemberships', membership.id);

  batch.set(groupRef, JSON.parse(JSON.stringify(group)));
  batch.set(memRef, JSON.parse(JSON.stringify(membership)));

  await batch.commit();
}

export async function getGroupById(groupId: string): Promise<Group | null> {
  const docRef = doc(db, 'groups', groupId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as Group;
  }
  return null;
}

// Helper: Memberships
export async function createMembership(membership: GroupMembership): Promise<void> {
  const docRef = doc(db, 'groupMemberships', membership.id);
  await setDoc(docRef, JSON.parse(JSON.stringify(membership)), { merge: true });
}

export async function updateMembership(membershipId: string, updates: Partial<GroupMembership>): Promise<void> {
  const docRef = doc(db, 'groupMemberships', membershipId);
  await updateDoc(docRef, JSON.parse(JSON.stringify(updates)));
}

export async function deleteMembership(membershipId: string): Promise<void> {
  const docRef = doc(db, 'groupMemberships', membershipId);
  await deleteDoc(docRef);
}

// Helper: Announcements
export async function createAnnouncement(announcement: Announcement): Promise<void> {
  const docRef = doc(db, 'announcements', announcement.id);
  await setDoc(docRef, JSON.parse(JSON.stringify(announcement)));
}

// Helper: Comments
export async function createComment(comment: TaskComment): Promise<void> {
  const docRef = doc(db, 'taskComments', comment.id);
  await setDoc(docRef, JSON.parse(JSON.stringify(comment)));
}

// Helper: Tasks
export async function createTask(task: Task): Promise<void> {
  const docRef = doc(db, 'tasks', task.id);
  await setDoc(docRef, JSON.parse(JSON.stringify(task)));
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
  const docRef = doc(db, 'tasks', taskId);
  await updateDoc(docRef, JSON.parse(JSON.stringify(updates)));
}

export async function deleteTask(taskId: string): Promise<void> {
  const docRef = doc(db, 'tasks', taskId);
  await deleteDoc(docRef);
}

// Helper: Completions
export async function saveCompletion(completion: SyncedTaskCompletion): Promise<void> {
  // Use a unique ID: classmateId-taskId
  const id = `${completion.classmateId}-${completion.taskId}`;
  const docRef = doc(db, 'completions', id);
  await setDoc(docRef, JSON.parse(JSON.stringify(completion)), { merge: true });
}

// Helper: Reset Database
export async function resetDatabase(userId: string): Promise<void> {
  const batch = writeBatch(db);

  // We only delete user's own data to keep it secure and safe
  // 1. Delete comments by user
  const commentsQ = query(collection(db, 'taskComments'), where('userId', '==', userId));
  const commentsSnap = await getDocs(commentsQ);
  commentsSnap.forEach(d => batch.delete(d.ref));

  // 2. Delete tasks created by or assigned to user
  const tasksQ1 = query(collection(db, 'tasks'), where('createdById', '==', userId));
  const tasksSnap1 = await getDocs(tasksQ1);
  tasksSnap1.forEach(d => batch.delete(d.ref));

  // 3. Delete tasks where user is assignee
  const tasksQ2 = query(collection(db, 'tasks'), where('classmateId', '==', userId));
  const tasksSnap2 = await getDocs(tasksQ2);
  tasksSnap2.forEach(d => batch.delete(d.ref));

  // 4. Delete announcements by user
  const annQ = query(collection(db, 'announcements'), where('userId', '==', userId));
  const annSnap = await getDocs(annQ);
  annSnap.forEach(d => batch.delete(d.ref));

  // 5. Delete memberships
  const memQ = query(collection(db, 'groupMemberships'), where('userId', '==', userId));
  const memSnap = await getDocs(memQ);
  memSnap.forEach(d => batch.delete(d.ref));

  // 6. Delete completions
  const compQ = query(collection(db, 'completions'), where('classmateId', '==', userId));
  const compSnap = await getDocs(compQ);
  compSnap.forEach(d => batch.delete(d.ref));

  // 7. Delete attendance logs
  const attQ = query(collection(db, 'attendance_logs'), where('classmateId', '==', userId));
  const attSnap = await getDocs(attQ);
  attSnap.forEach(d => batch.delete(d.ref));

  await batch.commit();
}

// Helper: Attendance
export async function getAttendanceByClassmate(classmateId: string): Promise<AttendanceLog[]> {
  const q = query(collection(db, 'attendance_logs'), where('classmateId', '==', classmateId));
  const snap = await getDocs(q);
  const logs: AttendanceLog[] = [];
  snap.forEach(d => {
    logs.push({ id: d.id, ...d.data() } as AttendanceLog);
  });
  // Sort by date descending
  return logs.sort((a, b) => b.date.localeCompare(a.date));
}

export async function saveAttendanceLog(log: Omit<AttendanceLog, 'id'> & { id?: string }): Promise<AttendanceLog[]> {
  const classmateId = log.classmateId;
  const date = log.date;
  const subject = log.subject || 'General';

  // Delete duplicates first to avoid duplicate records on the same day/subject
  const q = query(
    collection(db, 'attendance_logs'),
    where('classmateId', '==', classmateId),
    where('date', '==', date),
    where('subject', '==', subject)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.forEach(d => {
    batch.delete(d.ref);
  });
  await batch.commit();

  // Create new record
  const logId = log.id || String(Date.now());
  const docRef = doc(db, 'attendance_logs', logId);
  await setDoc(docRef, JSON.parse(JSON.stringify({ ...log, id: logId })));

  // Return the full updated logs
  return getAttendanceByClassmate(classmateId);
}

export async function deleteAttendanceLog(logId: string): Promise<void> {
  const docRef = doc(db, 'attendance_logs', logId);
  await deleteDoc(docRef);
}

// Helper: Task Submissions
export async function saveTaskSubmission(submission: TaskSubmission): Promise<void> {
  const docRef = doc(db, 'taskSubmissions', submission.id);
  await setDoc(docRef, JSON.parse(JSON.stringify(submission)), { merge: true });
}

export async function deleteTaskSubmission(submissionId: string): Promise<void> {
  const docRef = doc(db, 'taskSubmissions', submissionId);
  await deleteDoc(docRef);
}
