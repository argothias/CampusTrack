/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Interactive Streaks and Achievements component with interactive badge detail,
 * guiding flow, manual point-claiming system, and equipped badges displayed dynamically.
 */

import React, { useState, useEffect } from 'react';
import { 
  Flame, Trophy, Award, Calendar, Check,
  Smartphone, Sparkles, AlertCircle,
  CheckCircle2, Compass, X, Palette, Zap, Star, Search,
  Lock, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { AttendanceLog, StudentProfile, Task } from '../types';
import { db } from '../firebase';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { getTodayString, getYesterdayString } from '../utils/date';

const BadgeVisualIcon = ({ emoji, className = "w-5 h-5", unlocked = true }: { emoji: string; className?: string; unlocked?: boolean }) => {
  if (!unlocked) {
    return <Lock className={`${className} text-slate-400`} />;
  }
  switch (emoji) {
    case '🔥': return <Flame className={`${className} text-orange-500`} />;
    case '🌟': return <Star className={`${className} text-amber-500 animate-pulse`} />;
    case '⚡': return <Zap className={`${className} text-yellow-500`} />;
    case '🧘': return <Sparkles className={`${className} text-rose-500`} />;
    case '🎒': return <Trophy className={`${className} text-indigo-500`} />;
    case '🛠️': return <Settings className={`${className} text-sky-500`} />;
    case '🎨': return <Palette className={`${className} text-violet-500`} />;
    default: return <Award className={`${className} text-indigo-500`} />;
  }
};

interface BadgeEvalContext {
  completedCount: number;
  totalTasksCount: number;
  dailyLoginStreak: number;
  presentCount: number;
  studyStreak: number;
  groupId: string | null | undefined;
  hasSubtaskCompleted: boolean;
  isCustomTheme: boolean;
}

interface BadgeInfo {
  id: string;
  title: string;
  emoji: string;
  description: string;
  badgeClass: string;
  color: string;
  pointsAward: number;
  checkUnlock: (ctx: BadgeEvalContext) => boolean;
  progress: (ctx: BadgeEvalContext) => string;
  progressPercent: (ctx: BadgeEvalContext) => number;
  lore: string;
  tabRedirect: 'tasks' | 'streaks' | 'focus' | 'classroom' | 'create' | 'settings' | 'productivity' | 'profile' | 'admin' | 'super_admin';
}

interface Badge extends Omit<BadgeInfo, 'progressPercent'> {
  unlocked: boolean;
  claimed: boolean;
  equipped: boolean;
  progressPercent: number;
  progressLabel: string;
}

interface StreaksAchievementsProps {
  activeProfile: StudentProfile | null;
  tasks: Task[];
  onUpdateProfile: (updatedData: Partial<StudentProfile>) => Promise<void>;
  apiUrlHelper: (path: string) => string;
  setActiveTab?: (tab: 'tasks' | 'create' | 'classroom' | 'focus' | 'archive' | 'streaks' | 'settings' | 'productivity' | 'profile' | 'admin' | 'super_admin') => void;
  activeGroupId?: string | null;
}

// 7 Fully-featured Interactive Achievements Definition
const BADGES_INFO: BadgeInfo[] = [
  {
    id: 'deadline_master',
    title: 'Deadline Master',
    emoji: '🔥',
    description: 'Submit 10 tasks successfully to lock down timeliness.',
    badgeClass: 'bg-orange-50 border-orange-200 text-orange-600',
    color: 'from-orange-50 to-amber-50',
    pointsAward: 100,
    checkUnlock: (ctx: any) => ctx.completedCount >= 10,
    progress: (ctx: any) => `${Math.min(ctx.completedCount, 10)}/10 completed`,
    progressPercent: (ctx: any) => Math.min((ctx.completedCount / 10) * 100, 100),
    lore: "Legend says you've never missed a deadline. Classmates whisper of your legendary time-management skills.",
    tabRedirect: 'tasks' as const
  },
  {
    id: 'perfect_week',
    title: 'Perfect Week',
    emoji: '🌟',
    description: 'Submit all available workspace assignments (min 3 tasks).',
    badgeClass: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    color: 'from-emerald-50 to-teal-50',
    pointsAward: 150,
    checkUnlock: (ctx: any) => ctx.totalTasksCount >= 3 && ctx.completedCount === ctx.totalTasksCount,
    progress: (ctx: any) => ctx.totalTasksCount >= 3 ? `${ctx.completedCount}/${ctx.totalTasksCount} completed` : 'Min 3 tasks required',
    progressPercent: (ctx: any) => ctx.totalTasksCount >= 3 ? (ctx.completedCount / ctx.totalTasksCount) * 100 : 0,
    lore: "Flawless execution! A full workload completed without a single checkbox left unchecked. Peak efficiency.",
    tabRedirect: 'tasks' as const
  },
  {
    id: 'active_learner',
    title: 'Active Learner',
    emoji: '⚡',
    description: 'Maintain a 3-day login streak or check in attendance 3 times.',
    badgeClass: 'bg-amber-50 border-amber-200 text-amber-600',
    color: 'from-amber-50 to-yellow-50',
    pointsAward: 100,
    checkUnlock: (ctx: any) => (ctx.dailyLoginStreak >= 3) || (ctx.presentCount >= 3),
    progress: (ctx: any) => `Login: ${ctx.dailyLoginStreak}d | Present: ${ctx.presentCount}/3`,
    progressPercent: (ctx: any) => Math.min((Math.max(ctx.dailyLoginStreak, ctx.presentCount) / 3) * 100, 100),
    lore: "Your dedication is shocking. You have established a consistent learning habit that powers your academic journey.",
    tabRedirect: 'streaks' as const
  },
  {
    id: 'focus_cadet',
    title: 'Focus Cadet',
    emoji: '🧘',
    description: 'Complete at least 1 Pomodoro study sprint cycle.',
    badgeClass: 'bg-rose-50 border-rose-200 text-rose-600',
    color: 'from-rose-50 to-red-50',
    pointsAward: 120,
    checkUnlock: (ctx: any) => (ctx.studyStreak || 0) >= 1,
    progress: (ctx: any) => `Study Sessions: ${(ctx.studyStreak || 0)}/1`,
    progressPercent: (ctx: any) => Math.min(((ctx.studyStreak || 0) / 1) * 100, 100),
    lore: "Quiet mind, grand achievements. You've harnessed the scientific Pomodoro rhythm to study distraction-free.",
    tabRedirect: 'focus' as const
  },
  {
    id: 'classroom_pioneer',
    title: 'Classroom Pioneer',
    emoji: '🎒',
    description: 'Join a shared peer classroom group to synchronize workloads.',
    badgeClass: 'bg-indigo-50 border-indigo-200 text-indigo-600',
    color: 'from-indigo-50 to-violet-50',
    pointsAward: 100,
    checkUnlock: (ctx: any) => !!ctx.groupId,
    progress: (ctx: any) => ctx.groupId ? 'Joined Classroom ✓' : 'Not in a classroom',
    progressPercent: (ctx: any) => ctx.groupId ? 100 : 0,
    lore: "No student is an island! You have successfully linked up with your cohort to embark on collaborative learning.",
    tabRedirect: 'classroom' as const
  },
  {
    id: 'task_architect',
    title: 'Task Architect',
    emoji: '🛠️',
    description: 'Complete a workload with 3 or more detailed subtask checkpoints.',
    badgeClass: 'bg-sky-50 border-sky-200 text-sky-600',
    color: 'from-sky-50 to-blue-50',
    pointsAward: 120,
    checkUnlock: (ctx: any) => ctx.hasSubtaskCompleted,
    progress: (ctx: any) => ctx.hasSubtaskCompleted ? 'Architected ✓' : 'Complete 1 task with 3+ subtasks',
    progressPercent: (ctx: any) => ctx.hasSubtaskCompleted ? 100 : 0,
    lore: "Master of breakdown! You understand that big mountains are climbed one step at a time, carving out checklists.",
    tabRedirect: 'create' as const
  },
  {
    id: 'theme_sculptor',
    title: 'Theme Sculptor',
    emoji: '🎨',
    description: 'Personalize your workspace dashboard by setting a custom theme.',
    badgeClass: 'bg-violet-50 border-violet-200 text-violet-600',
    color: 'from-violet-50 to-purple-50',
    pointsAward: 80,
    checkUnlock: (ctx: any) => ctx.isCustomTheme,
    progress: (ctx: any) => ctx.isCustomTheme ? 'Customized ✓' : 'Default colors active',
    progressPercent: (ctx: any) => ctx.isCustomTheme ? 100 : 0,
    lore: "Esthetics enthusiast! You have sculpted your learning environment to perfectly reflect your cognitive headspace.",
    tabRedirect: 'settings' as const
  }
];

export default function StreaksAchievements({ 
  activeProfile, 
  tasks, 
  onUpdateProfile, 
  apiUrlHelper: _apiUrlHelper,
  setActiveTab,
  activeGroupId
}: StreaksAchievementsProps) {
  
  // Local state for attendance logs
  const [attendance, setAttendance] = useState<AttendanceLog[]>([]);
  const [_isLoadingAtt, setIsLoadingAtt] = useState(false);



  // Dynamic filter and search states for Interactive Badge Board
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'ready' | 'claimed' | 'locked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  // Dynamic Reward Claim Particles Effects
  const [sparkles, setSparkles] = useState<{ id: number; text: string; x: number; y: number }[]>([]);

  // Fetch Attendance logs
  useEffect(() => {
    if (!activeProfile?.id) return;
    
    setIsLoadingAtt(true);
    const q = query(
      collection(db, 'attendance_logs'),
      where('classmateId', '==', activeProfile.id)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs: AttendanceLog[] = [];
      snapshot.forEach(docSnap => {
        logs.push({ id: docSnap.id, ...docSnap.data() } as AttendanceLog);
      });
      // Sort by date descending
      logs.sort((a, b) => b.date.localeCompare(a.date));
      setAttendance(logs);
      setIsLoadingAtt(false);
    }, err => {
      console.error("Failed to load real-time attendance", err);
      setIsLoadingAtt(false);
    });
    
    return () => unsubscribe();
  }, [activeProfile?.id]);

  // Helper: check and trigger a Study Streak update (counts as a study session check-in)
  const _triggerStudyCheck = async () => {
    if (!activeProfile) return;
    const today = getTodayString();
    const yesterday = getYesterdayString();

    let newStreak = activeProfile.studyStreak || 0;
    if (activeProfile.lastStudyDate !== today) {
      if (activeProfile.lastStudyDate === yesterday) {
        newStreak += 1;
      } else {
        newStreak = 1;
      }
      await onUpdateProfile({
        name: activeProfile.name,
        studyStreak: newStreak,
        lastStudyDate: today
      });
    }
  };

  // CALCULATE ACTIVE USER STATE CONTEXT
  const completedTasks = tasks.filter(t => t.completed);
  const totalTasksCount = tasks.length;
  const presentCount = attendance.filter(a => a.status === 'Present').length;
  
  const hasSubtaskCompleted = tasks.some(t => 
    t.completed && 
    t.subtasks && 
    t.subtasks.length >= 3
  );

  const isCustomTheme = !!(
    localStorage.getItem('tasktrack_custom_color') || 
    localStorage.getItem('tasktrack_color_scheme') || 
    localStorage.getItem('tasktrack_theme_mode') !== 'light' ||
    localStorage.getItem('studysync_committed_color') ||
    localStorage.getItem('studysync_custom_color')
  );

  const evalContext = {
    completedCount: completedTasks.length,
    totalTasksCount,
    dailyLoginStreak: activeProfile?.dailyLoginStreak || 0,
    presentCount,
    studyStreak: activeProfile?.studyStreak || 0,
    groupId: activeGroupId || activeProfile?.groupId,
    hasSubtaskCompleted,
    isCustomTheme
  };

  // Claimed IDs stored in JSON format inside activeProfile.badges
  const claimedBadgeIds: string[] = JSON.parse(activeProfile?.badges || '[]');

  // Map our BADGES_INFO with live context evaluations
  const computedBadges = BADGES_INFO.map(badge => {
    const unlocked = badge.checkUnlock(evalContext);
    const claimed = claimedBadgeIds.includes(badge.id);
    const progressPercent = badge.progressPercent(evalContext);
    const progressLabel = badge.progress(evalContext);
    const equipped = activeProfile?.equippedBadge === badge.emoji;

    return {
      ...badge,
      unlocked,
      claimed,
      equipped,
      progressPercent,
      progressLabel
    };
  });

  // Calculate stats
  const unlockedCount = computedBadges.filter(b => b.unlocked).length;
  const claimedCount = computedBadges.filter(b => b.claimed).length;
  const readyToClaimCount = computedBadges.filter(b => b.unlocked && !b.claimed).length;

  // Filter and search computation
  const filteredBadges = computedBadges.filter(badge => {
    // Search
    if (searchQuery && !badge.title.toLowerCase().includes(searchQuery.toLowerCase()) && !badge.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Tab
    if (activeTabFilter === 'ready') return badge.unlocked && !badge.claimed;
    if (activeTabFilter === 'claimed') return badge.claimed;
    if (activeTabFilter === 'locked') return !badge.unlocked;
    return true; // all
  });

  // Handle Reward Claim
  const handleClaimReward = async (badge: any, e?: React.MouseEvent) => {
    if (!activeProfile) return;
    if (!badge.unlocked || badge.claimed) return;

    // Trigger visual confetti effect
    const clientX = e ? e.clientX : window.innerWidth / 2;
    const clientY = e ? e.clientY : window.innerHeight / 2;
    
    const id = Date.now();
    setSparkles(prev => [...prev, { id, text: `+${badge.pointsAward} Study Pts! 🏆`, x: clientX, y: clientY }]);
    setTimeout(() => {
      setSparkles(prev => prev.filter(s => s.id !== id));
    }, 2000);

    try {
      const updatedBadges = [...claimedBadgeIds];
      if (!updatedBadges.includes(badge.id)) {
        updatedBadges.push(badge.id);
      }
      
      const currentPoints = activeProfile.points || 0;
      await onUpdateProfile({
        name: activeProfile.name,
        points: currentPoints + badge.pointsAward,
        badges: JSON.stringify(updatedBadges)
      });

      // Update selected modal view if open
      if (selectedBadge && selectedBadge.id === badge.id) {
        setSelectedBadge((prev: any) => prev ? { ...prev, claimed: true } : null);
      }
    } catch (err) {
      console.error("Failed to claim badge reward:", err);
    }
  };

  // Handle Equip Badge
  const handleEquipBadge = async (badge: any) => {
    if (!activeProfile) return;
    try {
      const equipValue = activeProfile.equippedBadge === badge.emoji ? "" : badge.emoji;
      await onUpdateProfile({
        name: activeProfile.name,
        equippedBadge: equipValue
      });
      
      // Update modal state
      if (selectedBadge && selectedBadge.id === badge.id) {
        setSelectedBadge((prev: any) => prev ? { ...prev, equipped: equipValue !== "" } : null);
      }
    } catch (err) {
      console.error("Failed to equip badge:", err);
    }
  };

  // Nav redirection helper
  const handleRedirect = (tab: any) => {
    if (setActiveTab) {
      setActiveTab(tab);
      setSelectedBadge(null);
    }
  };

  // Attendance statistics
  const totalAttendanceCount = attendance.length;
  const presentRate = totalAttendanceCount > 0 
    ? Math.round((attendance.filter(a => a.status === 'Present' || a.status === 'Late').length / totalAttendanceCount) * 100) 
    : 100;

  // Android Native Widget code generation helpers



  return (
    <div className="space-y-6 text-left relative">
      
      {/* Dynamic claimable confetti floating items */}
      <AnimatePresence>
        {sparkles.map(s => (
          <motion.div
            key={s.id}
            initial={{ opacity: 1, scale: 0.6, y: s.y, x: s.x }}
            animate={{ opacity: 0, scale: 1.6, y: s.y - 120, x: s.x + (Math.random() * 80 - 40) }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="fixed z-50 pointer-events-none select-none font-sans font-black text-xs sm:text-sm text-slate-900 bg-white border-2 border-amber-400 p-3 rounded-2xl shadow-xl flex items-center gap-1.5"
            style={{ left: 0, top: 0, transform: 'translate(-50%, -50%)' }}
          >
            <span className="text-sm">✨</span>
            <span className="font-mono text-indigo-755">{s.text}</span>
            <span className="text-sm">✨</span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Pulsing prompt if there are rewards awaiting claim */}
      {readyToClaimCount > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-50 via-yellow-100 to-amber-100 border border-amber-350 p-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-3xs shrink-0">
              <Award className="w-5 h-5 text-amber-650 animate-pulse" />
            </div>
            <div className="text-left">
              <h5 className="font-sans font-black text-xs text-amber-950">Claim Unlocked Rewards!</h5>
              <p className="text-[10.5px] text-amber-800">You have completed <strong>{readyToClaimCount}</strong> interactive achievement challenges! Claim your bonus Study Points now.</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTabFilter('ready')}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10.5px] px-3.5 py-1.5 rounded-xl flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            Show Ready to Claim
            <Zap className="w-3 h-3 fill-white" />
          </button>
        </motion.div>
      )}

      {/* 1. DYNAMIC STREAKS STATUS HEADER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Daily Login Streak */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-gradient-to-br from-amber-50 to-orange-50/70 border border-amber-200/80 rounded-3xl p-5 flex items-center justify-between shadow-3xs"
        >
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-600/90 tracking-wider block font-mono">Daily Check-In</span>
            <h4 className="text-slate-800 font-sans font-black text-sm tracking-tight">Daily Login Streak</h4>
            <p className="text-[11px] text-slate-500 leading-tight">Log in consecutive days to grow your streak!</p>
          </div>
          <div className="flex flex-col items-center justify-center bg-white border border-amber-200/60 rounded-2xl p-3 shadow-3xs shrink-0 w-16 h-16">
            <Flame className={`w-7 h-7 text-orange-500 animate-bounce ${(activeProfile?.dailyLoginStreak || 0) > 0 ? 'fill-orange-500' : 'opacity-40'}`} />
            <span className="text-xs font-mono font-black text-slate-900 mt-0.5">{activeProfile?.dailyLoginStreak || 0}d</span>
          </div>
        </motion.div>

        {/* Assignment Submission Streak */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-gradient-to-br from-indigo-50 to-blue-50/70 border border-indigo-150 rounded-3xl p-5 flex items-center justify-between shadow-3xs"
        >
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-indigo-650 tracking-wider block font-mono">Task Master</span>
            <h4 className="text-slate-800 font-sans font-black text-sm tracking-tight">Submission Streak</h4>
            <p className="text-[11px] text-slate-500 leading-tight">Complete tasks daily to keep the fire hot!</p>
          </div>
          <div className="flex flex-col items-center justify-center bg-white border border-indigo-100 rounded-2xl p-3 shadow-3xs shrink-0 w-16 h-16">
            <Sparkles className={`w-7 h-7 text-indigo-600 ${(activeProfile?.assignmentStreak || 0) > 0 ? 'animate-pulse' : 'opacity-40'}`} />
            <span className="text-xs font-mono font-black text-slate-900 mt-0.5">{activeProfile?.assignmentStreak || 0}d</span>
          </div>
        </motion.div>

        {/* Study Sprints Streak */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-gradient-to-br from-emerald-50 to-teal-50/70 border border-emerald-200 rounded-3xl p-5 flex items-center justify-between shadow-3xs"
        >
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider block font-mono">Focus Station</span>
            <h4 className="text-slate-800 font-sans font-black text-sm tracking-tight">Study Sprint Streak</h4>
            <p className="text-[11px] text-slate-500 leading-tight">Complete Pomodoro study timer cycles!</p>
          </div>
          <div className="flex flex-col items-center justify-center bg-white border border-emerald-100 rounded-2xl p-3 shadow-3xs shrink-0 w-16 h-16">
            <Trophy className={`w-7 h-7 text-emerald-600 ${(activeProfile?.studyStreak || 0) > 0 ? 'animate-bounce' : 'opacity-40'}`} />
            <span className="text-xs font-mono font-black text-slate-900 mt-0.5">{activeProfile?.studyStreak || 0}d</span>
          </div>
        </motion.div>

      </div>

      {/* 2. MAIN ACHIEVEMENTS BOARD & BADGES CASE */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-3xs">
        
        {/* Header and statistics */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h4 className="font-sans font-black text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
              <Award className="w-4.5 h-4.5 text-indigo-600" />
              Interactive Achievements Case
            </h4>
            <p className="text-[10.5px] text-slate-400">Unlock custom badges and claim study point rewards to show off on the leaderboard.</p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl text-[10.5px] font-mono font-extrabold text-slate-700 flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-slate-650" />
              <span>Unlocked: {unlockedCount}/{computedBadges.length}</span>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-xl text-[10.5px] font-mono font-extrabold text-indigo-705 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-indigo-650" />
              <span>Claimed: {claimedCount}/{unlockedCount}</span>
            </div>
          </div>
        </div>

        {/* Filters, search, and category list */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          
          {/* Quick Tabs Filters */}
          <div className="flex gap-1.5 bg-slate-50 p-1 rounded-2xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTabFilter('all')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer ${
                activeTabFilter === 'all' ? 'bg-white text-slate-900 shadow-3xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All Badges ({computedBadges.length})
            </button>
            <button
              onClick={() => setActiveTabFilter('ready')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer relative ${
                activeTabFilter === 'ready' ? 'bg-white text-amber-700 shadow-3xs border border-amber-100' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Ready ({readyToClaimCount})
              {readyToClaimCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
              )}
            </button>
            <button
              onClick={() => setActiveTabFilter('claimed')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer ${
                activeTabFilter === 'claimed' ? 'bg-white text-emerald-700 shadow-3xs border border-emerald-100' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Claimed ({claimedCount})
            </button>
            <button
              onClick={() => setActiveTabFilter('locked')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer ${
                activeTabFilter === 'locked' ? 'bg-white text-slate-655 shadow-3xs border border-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Locked ({computedBadges.length - unlockedCount})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search challenges..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-800 focus:outline-hidden focus:border-indigo-400 focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

        </div>

        {/* Dynamic Achievements Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
          {filteredBadges.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6">
              <AlertCircle className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-slate-400 text-xs font-semibold mt-1">No achievements found matching your selection.</p>
              <button 
                onClick={() => { setActiveTabFilter('all'); setSearchQuery(''); }}
                className="mt-2 text-[10.5px] text-indigo-600 font-bold underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            filteredBadges.map((badge) => {
              const activeEquipped = activeProfile?.equippedBadge === badge.emoji;
              return (
                <motion.div
                  layout
                  key={badge.id}
                  whileHover={{ y: -3, scale: 1.01 }}
                  onClick={() => setSelectedBadge(badge)}
                  className={`relative p-4 rounded-3xl border transition-all flex flex-col justify-between space-y-3 cursor-pointer group text-left ${
                    badge.claimed
                      ? 'bg-gradient-to-b from-indigo-50/30 to-white border-indigo-200/60 shadow-3xs'
                      : badge.unlocked
                      ? 'bg-gradient-to-b from-amber-50/40 to-white border-amber-250 shadow-2xs animate-pulse-slow'
                      : 'bg-slate-50/60 border-slate-200/80 opacity-65'
                  }`}
                >
                  
                  {/* Equipped status flag / ready claim indicator */}
                  {activeEquipped ? (
                    <span className="absolute top-3.5 right-3.5 bg-indigo-600 text-white text-[8px] px-2 py-0.5 rounded-full font-black tracking-wide flex items-center gap-0.5 shadow-3xs animate-bounce">
                      <Star className="w-2 h-2 fill-white shrink-0" />
                      EQUIPPED
                    </span>
                  ) : badge.unlocked && !badge.claimed ? (
                    <span className="absolute top-3.5 right-3.5 bg-amber-500 text-slate-950 text-[8px] px-2 py-0.5 rounded-full font-black tracking-wide flex items-center gap-0.5 shadow-2xs animate-pulse">
                      CLAIM REWARD
                    </span>
                  ) : badge.claimed ? (
                    <span className="absolute top-3.5 right-3.5 bg-emerald-100 text-emerald-850 text-[8.5px] px-2 py-0.5 rounded-full font-black flex items-center gap-0.5">
                      ✓ Claimed
                    </span>
                  ) : null}

                  {/* Badge content */}
                  <div className="space-y-2.5">
                    
                    {/* Badge Emoji icon bubble */}
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-xs shrink-0 ${
                      badge.unlocked 
                        ? 'bg-white border border-slate-200 scale-105 group-hover:rotate-12 duration-200' 
                        : 'bg-slate-200 border-slate-300 text-slate-400'
                    }`}>
                      <BadgeVisualIcon emoji={badge.emoji} unlocked={badge.unlocked} className="w-5 h-5" />
                    </div>

                    {/* Badge titles and description */}
                    <div className="space-y-1">
                      <h5 className="font-sans font-black text-xs text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1">
                        "{badge.title}"
                      </h5>
                      <p className="text-[10px] text-slate-500 leading-normal line-clamp-2">{badge.description}</p>
                    </div>

                  </div>

                  {/* Progress panel */}
                  <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                    <div className="flex justify-between items-center text-[9px] font-mono font-bold">
                      <span className="text-slate-400">{badge.progressLabel}</span>
                      <span className="text-indigo-705">{Math.round(badge.progressPercent)}%</span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          badge.claimed ? 'bg-indigo-650' : badge.unlocked ? 'bg-amber-500' : 'bg-slate-400'
                        }`}
                        style={{ width: `${badge.progressPercent}%` }}
                      />
                    </div>
                  </div>

                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. AUTOMATED ACCOUNTABILITY */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-5 shadow-3xs text-left">
        <div className="space-y-0.5">
          <h4 className="font-sans font-black text-slate-900 text-sm sm:text-base tracking-tight flex items-center gap-1.5">
            <Calendar className="w-4.5 h-4.5 text-indigo-600" />
            Automated Attendance Tracking
          </h4>
          <p className="text-[11px] text-slate-400">Your daily presence is logged automatically by the system whenever you complete classroom workloads or planner tasks.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          
          {/* Today's Automatic Status Panel */}
          <div className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center space-y-2.5 h-36 ${
            attendance.some(a => a.date === getTodayString()) 
              ? 'bg-emerald-50/60 border-emerald-100 text-emerald-900' 
              : 'bg-slate-50 border-slate-150 text-slate-600'
          }`}>
            {attendance.some(a => a.date === getTodayString()) ? (
              <>
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm animate-bounce">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 block">Today's Presence</span>
                  <span className="text-xs font-black text-emerald-950 block">Checked In Present ✓</span>
                  <p className="text-[9.5px] text-emerald-700 mt-0.5 leading-tight font-medium">
                    {attendance.find(a => a.date === getTodayString())?.subject || 'Logged automatically via daily task completion.'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100/50 flex items-center justify-center text-indigo-500 shadow-2xs">
                  <Calendar className="w-5 h-5 stroke-[2] animate-pulse" />
                </div>
                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">Today's Presence</span>
                  <span className="text-xs font-black text-slate-700 block">Pending Task Completion</span>
                  <p className="text-[9.5px] text-slate-400 mt-0.5 leading-tight font-medium">
                    Complete any task today to automatically mark attendance.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Quick Stats Summary */}
          <div className="bg-slate-50/70 border border-slate-150 p-4 rounded-2xl flex flex-col justify-between h-36">
            <span className="font-bold text-slate-800 block text-[9.5px] uppercase tracking-wide">Accountability Statistics</span>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="text-left bg-white p-2 rounded-xl border border-slate-150">
                <span className="text-[8.5px] block text-slate-400 font-extrabold uppercase">Present Rate</span>
                <span className="text-sm font-black font-mono text-emerald-700 block mt-0.5">{presentRate}%</span>
              </div>
              <div className="text-left bg-white p-2 rounded-xl border border-slate-150">
                <span className="text-[8.5px] block text-slate-400 font-extrabold uppercase">Total Presence Logs</span>
                <span className="text-sm font-black font-mono text-slate-800 block mt-0.5">{totalAttendanceCount} days</span>
              </div>
            </div>
            <p className="text-[9px] text-slate-400 font-medium">Updated live as you complete learning challenges.</p>
          </div>

          {/* How it works details */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-[10.5px] text-slate-500 space-y-2 leading-relaxed h-36 flex flex-col justify-center">
            <span className="font-bold text-slate-700 block text-[9px] uppercase tracking-wide">💡 How it works</span>
            <p className="m-0">When you complete any assignment, study milestone, or planner task on TaskTrack, the system automatically writes a secure daily attendance timestamp in the database.</p>
          </div>

        </div>
      </div>

      {/* 4. HOME SCREEN WIDGETS */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 space-y-4 shadow-md border border-slate-800 text-left">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-sans font-black text-white text-sm tracking-tight">
              TaskTrack Home Screen Widgets
            </h4>
            <p className="text-[10.5px] text-slate-400">
              Access your daily study metrics instantly without opening the app.
            </p>
          </div>
        </div>

        <div className="bg-slate-950/40 rounded-2xl p-4 border border-slate-800/60 text-left space-y-3">
          <p className="text-[11.5px] text-slate-300 leading-relaxed">
            TaskTrack supports dedicated home screen widgets that display your <strong className="text-indigo-300">Live Login Streaks</strong>, <strong className="text-indigo-300">Active Task Deadlines</strong>, and <strong className="text-indigo-300">Daily Presence Attendance logs</strong> directly on your physical Android device.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] font-bold text-orange-400 font-mono block">🔥 STUDY STREAKS</span>
              <p className="text-[10px] text-slate-400 leading-normal m-0">Shows your current consecutive study streak days and live user profile status tag.</p>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] font-bold text-red-400 font-mono block">⏳ DEADLINE RADAR</span>
              <p className="text-[10px] text-slate-400 leading-normal m-0">Lists your upcoming class deadlines and high priority assignments at a glance.</p>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] font-bold text-emerald-400 font-mono block">📈 PRESENCE TRACKER</span>
              <p className="text-[10px] text-slate-400 leading-normal m-0">Monitors your percentage rate of class attendance, updated dynamically in real-time.</p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[10.5px] text-slate-400">
            <span>💡 To add a widget, long-press your phone's homescreen and select <strong>TaskTrack</strong>.</span>
            <a 
              href="https://developer.android.com/develop/ui/views/appwidgets" 
              target="_blank" 
              referrerPolicy="no-referrer"
              className="text-indigo-400 hover:text-indigo-300 font-bold shrink-0 flex items-center gap-1 transition-colors"
            >
              Learn more about Widgets →
            </a>
          </div>
        </div>
      </div>

      {/* 5. INTERACTIVE BADGE DETAIL POPUP / MODAL OVERLAY */}
      <AnimatePresence>
        {selectedBadge && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBadge(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 max-w-sm w-full relative z-10 space-y-5 text-center font-sans overflow-hidden"
            >
              
              {/* Close Button */}
              <button
                onClick={() => setSelectedBadge(null)}
                className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Sparkle background element */}
              <div className="absolute -top-10 -left-10 w-28 h-28 bg-indigo-50 rounded-full blur-2xl opacity-70 pointer-events-none" />
              <div className="absolute -bottom-10 -right-10 w-28 h-28 bg-amber-50 rounded-full blur-2xl opacity-70 pointer-events-none" />

              {/* Badge visual representation */}
              <div className="relative inline-block mx-auto pt-3">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-md border ${
                  selectedBadge.unlocked
                    ? 'bg-gradient-to-tr from-amber-50 via-white to-orange-50 border-amber-250 animate-bounce'
                    : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}>
                  <BadgeVisualIcon emoji={selectedBadge.emoji} unlocked={selectedBadge.unlocked} className="w-8 h-8" />
                </div>
                
                {selectedBadge.unlocked && (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                    className="absolute -top-1 -right-1"
                  >
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  </motion.div>
                )}
              </div>

              {/* Title & Lore */}
              <div className="space-y-1.5 relative">
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-indigo-600 block">
                  {selectedBadge.unlocked ? 'Challenge Unlocked' : 'Locked Challenge'}
                </span>
                
                <h4 className="text-base font-black text-slate-900 leading-tight">
                  "{selectedBadge.title}" Badge
                </h4>
                
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto italic leading-normal">
                  "{selectedBadge.unlocked ? selectedBadge.lore : 'The requirements are obscured by academic secrecy. Work harder to unlock this reward.'}"
                </p>
              </div>

              {/* Status and Requirements Details */}
              <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-2xl text-left space-y-2">
                <div className="flex justify-between items-center text-[10px] font-extrabold uppercase text-slate-400 font-mono tracking-wider">
                  <span>Requirement</span>
                  <span className="text-indigo-650">{selectedBadge.unlocked ? 'Completed' : 'In Progress'}</span>
                </div>
                
                <p className="text-[11px] text-slate-700 leading-relaxed font-semibold">
                  {selectedBadge.description}
                </p>

                {/* Progress detail */}
                <div className="space-y-1 pt-1.5 border-t border-slate-200/50">
                  <div className="flex justify-between items-center text-[10px] font-mono font-bold text-slate-500">
                    <span>{selectedBadge.progressLabel}</span>
                    <span className="text-indigo-700">{Math.round(selectedBadge.progressPercent)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-1.5 rounded-full transition-all"
                      style={{ width: `${selectedBadge.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Interactive buttons */}
              <div className="space-y-2 pt-2">
                
                {/* 1. Unlocked & Unclaimed -> SHOW CLAIM REWARD */}
                {selectedBadge.unlocked && !selectedBadge.claimed && (
                  <button
                    onClick={(e) => handleClaimReward(selectedBadge, e)}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-sans font-black text-xs py-3 rounded-2xl shadow-md transition-all scale-102 hover:scale-105 active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Claim +{selectedBadge.pointsAward} Study Points!</span>
                    <Zap className="w-3.5 h-3.5 fill-white text-white" />
                  </button>
                )}

                {/* 2. Unlocked & Claimed -> SHOW EQUIP/UNEQUIP */}
                {selectedBadge.claimed && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEquipBadge(selectedBadge)}
                      className={`flex-1 font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        activeProfile?.equippedBadge === selectedBadge.emoji
                          ? 'bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-3xs'
                      }`}
                    >
                      {activeProfile?.equippedBadge === selectedBadge.emoji ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />
                          Unequip Badge
                        </>
                      ) : (
                        <>
                          <Star className="w-3.5 h-3.5 fill-white text-white" />
                          Equip Emoji Badge
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* 3. Locked -> SHOW GUIDE ME REDIRECT */}
                {!selectedBadge.unlocked && (
                  <button
                    onClick={() => handleRedirect(selectedBadge.tabRedirect)}
                    className="w-full bg-slate-100 hover:bg-slate-250 border border-slate-200/80 text-slate-800 font-sans font-bold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Compass className="w-4 h-4 text-slate-500" />
                    Guide Me To This Challenge 🚀
                  </button>
                )}

                <button
                  onClick={() => setSelectedBadge(null)}
                  className="w-full text-slate-400 hover:text-slate-600 font-bold text-[10px] py-1 transition-colors cursor-pointer"
                >
                  Dismiss details
                </button>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
