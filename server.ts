/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import webpush from "web-push";

dotenv.config();

// Helper to get Firestore Admin Database
let firestoreDb: any = null;

function getFirestoreDb() {
  if (firestoreDb) return firestoreDb;
  try {
    const configPath = './firebase-applet-config.json';
    if (!fs.existsSync(configPath)) {
      console.warn("Firebase Admin: firebase-applet-config.json not found.");
      return null;
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!config.projectId) return null;

    // Initialize Firebase Admin if not already initialized
    if (getApps().length === 0) {
      initializeApp({
        projectId: config.projectId,
      });
    }

    // Use the custom firestoreDatabaseId from configuration with 'tasktr' as fallback
    const dbId = config.firestoreDatabaseId || 'tasktr';
    const app = getApps()[0];
    firestoreDb = app ? getFirestore(app, dbId) : getFirestore();
    return firestoreDb;
  } catch (err) {
    console.warn("Failed to initialize Firestore Admin SDK:", err);
    return null;
  }
}

// Web Push configuration and notification triggers
let vapidKeys: { publicKey: string; privateKey: string } | null = null;

async function getOrCreateVapidKeys() {
  if (vapidKeys) return vapidKeys;
  const fdb = getFirestoreDb();
  if (!fdb) {
    console.warn("Firestore not ready, generating temporary VAPID keys.");
    const keys = webpush.generateVAPIDKeys();
    vapidKeys = keys;
    return keys;
  }

  try {
    const docRef = fdb.collection('config').doc('vapid_keys');
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      vapidKeys = docSnap.data() as { publicKey: string; privateKey: string };
    } else {
      const keys = webpush.generateVAPIDKeys();
      await docRef.set(keys);
      vapidKeys = keys;
      console.log("Generated and saved new persistent VAPID keys to Firestore.");
    }
    
    webpush.setVapidDetails(
      'mailto:minami23o49@gmail.com',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
    
    return vapidKeys;
  } catch (err) {
    console.error("Error setting up VAPID keys:", err);
    const keys = webpush.generateVAPIDKeys();
    vapidKeys = keys;
    return keys;
  }
}

async function sendPushToUser(userId: string, payload: { title: string; body: string; data?: any }) {
  const fdb = getFirestoreDb();
  if (!fdb) return;

  try {
    const subSnap = await fdb.collection('push_subscriptions').where('userId', '==', userId).get();
    if (subSnap.empty) {
      console.log(`No push subscriptions found for user: ${userId}`);
      return;
    }

    const payloadStr = JSON.stringify(payload);

    subSnap.forEach(async (doc: any) => {
      const subData = doc.data();
      if (subData && subData.subscription) {
        try {
          await webpush.sendNotification(subData.subscription, payloadStr);
          console.log(`Successfully sent web push notification to user ${userId} on subscription ${doc.id}`);
        } catch (err: any) {
          console.error(`Error sending push to subscription ${doc.id}:`, err);
          if (err.statusCode === 410 || err.statusCode === 404) {
            await doc.ref.delete();
            console.log(`Deleted stale/expired subscription: ${doc.id}`);
          }
        }
      }
    });
  } catch (error) {
    console.error(`Failed to dispatch push notification to user ${userId}:`, error);
  }
}

async function handleNewAnnouncementPush(ann: any) {
  const fdb = getFirestoreDb();
  if (!fdb || !ann.groupId) return;

  try {
    const groupDoc = await fdb.collection('groups').doc(ann.groupId).get();
    const groupName = groupDoc.exists ? groupDoc.data().name : 'Classroom';

    const membersSnap = await fdb.collection('groupMemberships').where('groupId', '==', ann.groupId).get();
    
    membersSnap.forEach((doc: any) => {
      const member = doc.data();
      if (member && member.userId && member.userId !== ann.userId) {
        sendPushToUser(member.userId, {
          title: `Announcement in ${groupName} 📢`,
          body: `${ann.userName || 'Someone'}: ${ann.content || 'Check the announcement board.'}`,
          data: {
            url: '/',
            type: 'announcement',
            groupId: ann.groupId
          }
        });
      }
    });
  } catch (err) {
    console.error("Error in handleNewAnnouncementPush:", err);
  }
}

async function handleNewTaskPush(task: any) {
  const fdb = getFirestoreDb();
  if (!fdb || !task.groupId || !task.isSynced) return;

  try {
    const groupDoc = await fdb.collection('groups').doc(task.groupId).get();
    const groupName = groupDoc.exists ? groupDoc.data().name : 'Classroom';

    const membersSnap = await fdb.collection('groupMemberships').where('groupId', '==', task.groupId).get();

    membersSnap.forEach((doc: any) => {
      const member = doc.data();
      if (member && member.userId && member.userId !== task.createdById) {
        sendPushToUser(member.userId, {
          title: `New Workload in ${groupName} 📝`,
          body: `"${task.title || 'Untitled Task'}" has been published.`,
          data: {
            url: '/',
            type: 'task',
            groupId: task.groupId,
            taskId: task.id
          }
        });
      }
    });
  } catch (err) {
    console.error("Error in handleNewTaskPush:", err);
  }
}

async function handleNewCommentPush(comment: any) {
  const fdb = getFirestoreDb();
  if (!fdb || !comment.taskId) return;

  try {
    const taskDoc = await fdb.collection('tasks').doc(comment.taskId).get();
    if (!taskDoc.exists) return;
    const task = taskDoc.data();
    if (!task.isSynced || !task.groupId) return;

    const groupDoc = await fdb.collection('groups').doc(task.groupId).get();
    const groupName = groupDoc.exists ? groupDoc.data().name : 'Classroom';

    const membersSnap = await fdb.collection('groupMemberships').where('groupId', '==', task.groupId).get();

    membersSnap.forEach((doc: any) => {
      const member = doc.data();
      if (member && member.userId && member.userId !== comment.userId) {
        sendPushToUser(member.userId, {
          title: `[${groupName}] New Comment: ${task.title || 'Task'} 💬`,
          body: `${comment.userName || 'Someone'}: ${comment.content || 'New comment.'}`,
          data: {
            url: '/',
            type: 'comment',
            groupId: task.groupId,
            taskId: comment.taskId
          }
        });
      }
    });
  } catch (err) {
    console.error("Error in handleNewCommentPush:", err);
  }
}

function setupPushListeners() {
  const fdb = getFirestoreDb();
  if (!fdb) {
    console.warn("Firestore Admin not available. Real-time background push notification system paused.");
    return;
  }

  console.log("Setting up Firestore Real-time background push notification listeners...");

  // 1. Announcements Listener
  let isInitialAnnouncements = true;
  fdb.collection('announcements').onSnapshot((snapshot: any) => {
    if (isInitialAnnouncements) {
      isInitialAnnouncements = false;
      return;
    }
    snapshot.docChanges().forEach((change: any) => {
      if (change.type === 'added') {
        const ann = change.doc.data();
        handleNewAnnouncementPush(ann);
      }
    });
  }, (err: any) => console.warn("Server Announcement background push error:", err));

  // 2. Tasks Listener
  let isInitialTasks = true;
  fdb.collection('tasks').onSnapshot((snapshot: any) => {
    if (isInitialTasks) {
      isInitialTasks = false;
      return;
    }
    snapshot.docChanges().forEach((change: any) => {
      if (change.type === 'added') {
        const task = change.doc.data();
        handleNewTaskPush(task);
      }
    });
  }, (err: any) => console.warn("Server Tasks background push error:", err));

  // 3. Comments Listener
  let isInitialComments = true;
  fdb.collection('taskComments').onSnapshot((snapshot: any) => {
    if (isInitialComments) {
      isInitialComments = false;
      return;
    }
    snapshot.docChanges().forEach((change: any) => {
      if (change.type === 'added') {
        const comment = change.doc.data();
        handleNewCommentPush(comment);
      }
    });
  }, (err: any) => console.warn("Server Comments background push error:", err));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable permissive CORS for mobile apps, APK wrapper WebViews, and cross-origin systems
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Custom body-parser error handler to prevent HTML response when parsing fails or payload is too large
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err) {
      console.error("Express middleware error caught:", err);
      const statusCode = err.status || err.statusCode || 500;
      if (statusCode === 413) {
        return res.status(413).json({ error: "Payload too large. Please upload an image under 10MB." });
      }
      return res.status(statusCode).json({ error: err.message || "Failed to parse request content." });
    }
    next();
  });

  // --- API ROUTE HANDLERS (POWERED EXCLUSIVELY BY FIRESTORE) ---

  // Password Recovery - Fetch Security Question
  app.post("/api/auth/forgot-password", async (req, res) => {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "Username is required." });
    }

    try {
      const cleanId = id.toLowerCase().trim();
      const fdb = getFirestoreDb();
      if (!fdb) {
        return res.status(500).json({ error: "Database connection not available." });
      }

      // Check by doc ID (uid) first
      let profileDoc = await fdb.collection('profiles').doc(cleanId).get();
      let profileData = profileDoc.exists ? profileDoc.data() : null;

      // If not found, check by username field
      if (!profileData) {
        const querySnap = await fdb.collection('profiles').where('username', '==', cleanId).get();
        if (!querySnap.empty) {
          profileDoc = querySnap.docs[0];
          profileData = profileDoc.data();
        }
      }

      if (!profileData) {
        return res.status(404).json({ error: "Username not found." });
      }

      return res.json({
        id: profileDoc.id,
        securityQuestion: profileData.securityQuestion || "What is your favorite school subject?"
      });
    } catch (error: any) {
      console.error("Fetch security question error:", error);
      return res.status(500).json({ error: "Recovery system helper error." });
    }
  });

  // Password Recovery - Submit Recovery & Reset Password
  app.post("/api/auth/reset-password", async (req, res) => {
    const { id, securityAnswer, newPassword } = req.body;
    if (!id || !securityAnswer || !newPassword) {
      return res.status(400).json({ error: "All inputs are required to reset security credentials." });
    }

    try {
      const cleanId = id.toLowerCase().trim();
      const fdb = getFirestoreDb();
      if (!fdb) {
        return res.status(500).json({ error: "Database connection not available." });
      }

      // Find profile doc
      let profileDoc = await fdb.collection('profiles').doc(cleanId).get();
      let profileData = profileDoc.exists ? profileDoc.data() : null;

      if (!profileData) {
        const querySnap = await fdb.collection('profiles').where('username', '==', cleanId).get();
        if (!querySnap.empty) {
          profileDoc = querySnap.docs[0];
          profileData = profileDoc.data();
        }
      }

      if (!profileData) {
        return res.status(404).json({ error: "Username not found." });
      }

      if (!profileData.securityAnswer) {
        return res.status(400).json({ error: "No security configuration found for this user account. Resetting not possible." });
      }

      const cleanAnswerInput = securityAnswer.trim().toLowerCase();
      const expectedAnswer = String(profileData.securityAnswer).trim().toLowerCase();

      if (cleanAnswerInput !== expectedAnswer) {
        return res.status(403).json({ error: "Incorrect security recovery answer." });
      }

      // Correct answer! Reset the user's password using Firebase Admin Auth
      const uid = profileDoc.id;
      await getAuth().updateUser(uid, { password: newPassword });

      return res.json({ success: true, message: "Your password has been updated. You can now login safely." });
    } catch (error: any) {
      console.error("Reset password recovery failed:", error);
      return res.status(500).json({ error: "Recovery process failed. Details: " + error.message });
    }
  });

  // Secure endpoint to fetch real server time and date to prevent client clock manipulation
  app.get("/api/time", (req, res) => {
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return res.json({ 
      timestamp: d.getTime(), 
      dateStr: dateStr 
    });
  });

  // Fetch real Student statistics, streaks, and upcoming deadlines for widget synching
  app.get("/api/data", async (req, res) => {
    const { userId } = req.query;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: "userId parameter is required." });
    }

    try {
      const fdb = getFirestoreDb();
      if (!fdb) {
        return res.status(500).json({ error: "Database connection not available." });
      }

      // 1. Fetch Profile
      const profileDoc = await fdb.collection('profiles').doc(userId).get();
      if (!profileDoc.exists) {
        return res.status(404).json({ error: `Student profile not found for ID: ${userId}` });
      }
      const profile = profileDoc.data() || {};

      // 2. Fetch Attendance Logs
      const attendanceSnap = await fdb.collection('attendance_logs').where('classmateId', '==', userId).get();
      const attendanceLogs: any[] = [];
      attendanceSnap.forEach((doc: any) => {
        attendanceLogs.push(doc.data());
      });

      const totalAttendance = attendanceLogs.length;
      const presentOrLate = attendanceLogs.filter(a => a.status === 'Present' || a.status === 'Late').length;
      const attendanceRate = totalAttendance > 0 ? Math.round((presentOrLate / totalAttendance) * 100) : 100;

      // 3. Fetch Tasks
      const tasksSnap = await fdb.collection('tasks').where('classmateId', '==', userId).get();
      const tasks: any[] = [];
      tasksSnap.forEach((doc: any) => {
        const data = doc.data();
        if (!data.completed) {
          tasks.push(data);
        }
      });

      // Sort tasks by due date ascending
      tasks.sort((a, b) => {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return da - db;
      });

      return res.json({
        api_endpoint: `${req.protocol}://${req.get('host')}/api/data?userId=${userId}`,
        profile_id: userId,
        student_name: profile.name || "Student",
        active_role: profile.role || "Student",
        login_streak: profile.dailyLoginStreak || 0,
        assignment_streak: profile.assignmentStreak || 0,
        study_streak: profile.studyStreak || 0,
        attendance_rate: `${attendanceRate}%`,
        total_attendance_logs: totalAttendance,
        next_deadlines: tasks.slice(0, 3).map(t => ({
          title: t.title,
          due: t.dueDate || "N/A",
          priority: t.priority || "normal"
        }))
      });
    } catch (error: any) {
      console.error("Fetch widget API error:", error);
      return res.status(500).json({ error: "Failed to fetch student live synchronization data." });
    }
  });

  // --- WEB PUSH SYSTEM API ENDPOINTS ---

  // Get VAPID Public Key for client-side registration
  app.get("/api/push/vapid-public-key", async (req, res) => {
    try {
      const keys = await getOrCreateVapidKeys();
      return res.json({ publicKey: keys.publicKey });
    } catch (error: any) {
      console.error("VAPID public key fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch push notification key." });
    }
  });

  // Register modern push subscription for a user device (Android, mobile browsers, desktop)
  app.post("/api/push/register", async (req, res) => {
    const { userId, subscription } = req.body;
    if (!userId || !subscription) {
      return res.status(400).json({ error: "userId and subscription details are required." });
    }

    try {
      const fdb = getFirestoreDb();
      if (!fdb) {
        return res.status(500).json({ error: "Database connection not available." });
      }

      // Hash endpoint to produce a clean, deterministic document key
      const endpointHash = Buffer.from(subscription.endpoint || '').toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 50);
      const docId = `${userId}_${endpointHash}`;

      await fdb.collection('push_subscriptions').doc(docId).set({
        userId,
        subscription,
        updatedAt: new Date().toISOString()
      });

      console.log(`Registered push subscription for user ${userId} with key ${docId}`);
      return res.json({ success: true, message: "Android push subscription registered successfully." });
    } catch (error: any) {
      console.error("Register push subscription error:", error);
      return res.status(500).json({ error: "Failed to register mobile device subscription." });
    }
  });

  // Direct script serving of Service Worker for zero-bundler setup at scope root
  app.get("/service-worker.js", (req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.send(`/**
 * CampusTrack Service Worker
 * Powered by Web Push Protocol
 */

self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'CampusTrack Alert 🔔', body: event.data.text() };
    }
  }

  const title = data.title || 'CampusTrack Update 🔔';
  const options = {
    body: data.body || 'Something new is happening in your classroom!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: data.data || {},
    vibrate: [150, 80, 150],
    tag: 'campustrack-push-notification',
    renotify: true,
    actions: [
      { action: 'open', title: 'Open CampusTrack 🚀' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.indexOf('/') !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
`);
  });

  // Boot background push notifications
  try {
    await getOrCreateVapidKeys();
    setupPushListeners();
  } catch (err) {
    console.warn("Background push notification setup failed during boot, will retry on demand:", err);
  }

  // --- VITE MIDDLEWARE HANDLING & PRODUCTION STATIC SERVING ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express custom server listening on port ${PORT}`);
  });
}

startServer();
