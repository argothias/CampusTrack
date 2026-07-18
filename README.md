# CampusTrack 🎓✨

CampusTrack is a highly polished, secure, and collaborative academic planner designed for students and study groups. It blends private personal task management with cloud-synchronized group tasks, real-time announcements, deep focus tracking, and a peer study point leaderboard.

CampusTrack features a robust, **real-time, offline-first sync engine** using Firebase Firestore persistence, allowing you to view and edit your data even when disconnected from the internet.

---

## 🚀 Key Features & Capabilities

### 1. Adaptive View Modes (List & Kanban)
* **High-Fidelity List View**: Sort, group, and filter assignments with ease. Enjoy a compact, structured layout featuring customizable priorities, scopes, and subject categories.
* **Interactive Kanban Board View**: Track tasks from *To Do* through *In Progress* to *Completed* using real-time drag/action boards designed with clean responsive columns.

### 2. Premium Theme Engine & High-Contrast Readability
* **Perfect White/Light & Dark Modes**: Enjoy a beautiful, high-contrast, eye-safe light interface and sleek dark backgrounds. Text contrast and legibility are protected across all color configurations.
* **Custom Color Scheme Presets**: Personalize the app's visual identity using predefined presets (Indigo, Emerald, Rose, Violet, Amber, Slate) or specify your own custom colors for background, sidebar, cards, and text with robust persistent overrides.

### 3. Responsive, Dynamically Scaling UI
* **Widescreen & Mobile Harmony**: Built to look amazing on everything from compact smartphones to ultra-wide desktop monitors.
* **Fluid Layout Anchors**: Structural components like the real-time **Classroom Announcements Banner** and **Classmate Sync Filter Box** dynamically scale and self-adjust to make the best use of larger screen resolutions.

### 4. Real-Time Study Groups & Collaboration
* **Interactive Groups**: Create or join multiple study cohorts using secure access invite keys.
* **Coordinator & Classmate Roles**: Coordinators can publish group tasks, attach materials, broadcast announcements, and review student task submissions.
* **Task Submissions**: Submit completed work with attachments or notes directly within the app for coordinator verification.
* **Shared Task Milestones**: Break tasks into subtask checkpoints. Custom checklists and synced completions are tracked individually per student so you can check off items at your own pace.

### 5. Deep Focus Pomodoro Timer
* **Customizable Study Blocks**: Train your focus with a fully functional Pomodoro timer equipped with customized interval configurations (Study Sprints, Short Breaks, Long Breaks).
* **Focus Streaks**: Track your daily study milestones with motivational streak metrics.
* **State Preservation**: The focus timer interface remains active and consistent across navigation tabs so your progress is never interrupted.

### 6. Automated Completed Task Cleanup
* **Smart Background Purges**: Control storage clutter by enabling the **Auto-Delete Completed Tasks** utility.
* **Custom Retention Intervals**: Configure deletion parameters to purge completed assignments immediately or after set retention intervals (e.g., 1, 3, 5, or 7 days).

### 7. Leaderboards & Study Points Metrics
* **Gamified Motivation**: Students earn visual experience points (⭐ pts) automatically upon completing shared group assignments.
* **Study Cohort Leaderboard**: Compare academic progress with group members in real-time, encouraging friendly study motivation.

---

## 🛠️ Built With

* **Frontend Framework**: [React 18](https://react.dev/) + [Vite](https://vite.dev/) (Client-Side SPA Architecture)
* **Programming Language**: [TypeScript](https://www.typescriptlang.org/) (Strict type-safe interfaces)
* **Styling**: [Tailwind CSS](https://tailwindcss.com/) (Responsive layouts, smooth responsive cards, and visual grid adjustments)
* **Database & Auth**: [Firebase (Firestore & Authentication)](https://firebase.google.com/) (Real-time sync, native IndexedDB persistence caching)
* **Animations**: [Motion](https://motion.dev/) (`motion/react` for micro-animations and staggered transitions)
* **Icons**: [Lucide React](https://lucide.dev/)

---

## 📦 Local Installation & Setup

1. **Clone the Repository**:
   ```bash
   git clone <your-repository-url>
   cd <your-repository-folder>
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add your Firebase credentials:
   ```env
   # .env
   # Setup your standard Firestore environment variables here
   ```

4. **Run Dev Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

5. **Build for Production**:
   ```bash
   npm run build
   ```

---

## 🔒 Security & Rules

CampusTrack is backed by comprehensive **Firestore Security Rules** ensuring strict access controls:
* Users can only read and write their own student profile information.
* Study group tasks, submissions, comments, and milestones are restricted exclusively to authorized members of those respective groups.
* Direct deletion rights are limited to creators of individual tasks and group Coordinators.
