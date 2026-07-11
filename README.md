# CampusTrack

CampusTrack is a highly polished, secure, and collaborative academic planner designed for students and study groups. It blends private personal task management with cloud-synchronized group tasks, real-time announcements, deep focus tracking, and a peer study point leaderboard.

CampusTrack features a robust, **real-time, offline-first sync engine** using Firebase Firestore persistence, allowing you to view and edit your data even when disconnected from the internet.

---

## Key Features & Capabilities

### 1. Unified Task & Assignment Engine
* **Private vs. Shared Sync Tasks**: Manage personal private tasks alongside shared group assignments assigned by group Coordinators.
* **Smart Categorization & Visual Tags**: Organize your workload with high-contrast customizable category labels, priority badges, and subject markers.
* **Subtasks & Milestone Checklists**: Break large assignments down into manageable checkpoints with nested progress tracking.
* **Rich Interactions**: Post task comments, upload links/attachments, track due dates, and mark progress.

### 2. Real-Time Study Groups & Collaboration
* **Interactive Groups**: Create or join multiple study cohorts using invite codes.
* **Coordinator & Classmate Roles**: Coordinators can publish group tasks, attach materials, broadcast announcements, and review student task submissions.
* **Classroom Announcements**: Broadcast real-time notifications with important pinning capabilities for top-priority news.
* **Task Submissions**: Submit completed work directly within the app for coordinator review.

### 3. Real-Time Offline-First Synchronization
* **Automatic Offline Mode**: Seamlessly transition to offline cached mode when network connections are severed.
* **Local Persistence**: Powered by client-side IndexedDB, allowing reading, writing, and completion of tasks offline.
* **Visual Connection Banners**: Dynamic UI warnings inform the user that their device is offline and cached content is being displayed.
* **Smart Background Syncing**: Offline actions are automatically queued and immediately dispatched to Firebase once the connection is restored.
* **Swipe-to-Sync (Pull down to refresh)**: Experience smooth touch interactions. Drag down on mobile/tablet screens to manually trigger network reconnections, refresh retrieved data, and verify synchronized queues.

### 4. Deep Focus Pomodoro Timer
* **Customizable Study Blocks**: Train your focus with a fully functional Pomodoro timer equipped with customized interval configurations (Study Sprints, Short Breaks, Long Breaks).
* **Focus Streaks**: Track your daily focus milestones with motivational streak metrics.
* **State Preservation**: The focus interface remains consistent across navigation tabs so your progress is never lost.

### 5. Automated Completed Task Cleanup
* **Smart Background Purges**: Control storage clutter by enabling the **Auto-Delete Completed Tasks** utility.
* **Custom Retention Intervals**: Configure deletion parameters to purge completed assignments immediately or after set retention intervals (e.g., 1, 3, 5, or 7 days).

### 6. Leaderboards & Study Points Metrics
* **Gamified Motivation**: Students earn visual experience points (â­ pts) automatically upon completing shared group assignments.
* **Study Cohort Leaderboard**: Compare academic progress with group members in real-time, encouraging friendly study motivation.

---

## Built With

* **Frontend Framework**: [React 18](https://react.dev/) + [Vite](https://vite.dev/) (Client-Side SPA Architecture)
* **Programming Language**: [TypeScript](https://www.typescriptlang.org/) (Strict type-safe interfaces)
* **Styling**: [Tailwind CSS](https://tailwindcss.com/) (Responsive layouts, smooth responsive cards, and visual grid adjustments)
* **Database & Auth**: [Firebase (Firestore & Authentication)](https://firebase.google.com/) (Real-time sync, native IndexedDB persistence caching)
* **Animations**: [Motion](https://motion.dev/) (`motion/react` for micro-animations and staggered transitions)
* **Icons**: [Lucide React](https://lucide.dev/)

---

## Security & Rules

CampusTrack is backed by comprehensive **Firestore Security Rules** ensuring strict access controls:
* Users can only read and write their own student profile information.
* Study group tasks, submissions, comments, and milestones are restricted exclusively to authorized members of those respective groups.
* Direct deletion rights are limited to creators of individual tasks and group Coordinators.
