import React, { useState, useMemo } from 'react';
import { 
  Users, Layers, CheckSquare, Trophy, Calendar, MessageSquare, 
  Search, Shield, Award, Edit3, Check, X, Sparkles,
  TrendingUp, Filter, CalendarDays, BarChart2,
  Activity, BookOpen, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, 
  AreaChart, Area
} from 'recharts';
import { StudentProfile, Group, GroupMembership, Announcement, Task, SyncedTaskCompletion, TaskComment, AttendanceLog } from '../types';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import GoogleSheetsExport from './GoogleSheetsExport';

interface AdminDashboardProps {
  profiles: StudentProfile[];
  groups: Group[];
  memberships: GroupMembership[];
  announcements: Announcement[];
  tasks: Task[];
  completions: SyncedTaskCompletion[];
  comments: TaskComment[];
  attendanceLogs: AttendanceLog[];
  onClose: () => void;
  activeProfileId: string | null;
  userEmail?: string | null;
  googleToken: string | null;
  onGoogleSignIn: () => Promise<void>;
  consoleTitle?: string;
}

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6'];

const MONTHS_MAP: { [key: string]: string } = {
  '01': 'January',
  '02': 'February',
  '03': 'March',
  '04': 'April',
  '05': 'May',
  '06': 'June',
  '07': 'July',
  '08': 'August',
  '09': 'September',
  '10': 'October',
  '11': 'November',
  '12': 'December'
};

const getMonthFromDateStr = (dateStr?: string | null): string | null => {
  if (!dateStr) return null;
  const match = dateStr.match(/^\d{4}-(\d{2})-\d{2}/);
  if (match) return match[1];
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const m = d.getMonth() + 1;
      return m < 10 ? `0${m}` : `${m}`;
    }
  } catch {}
  return null;
};

export default function AdminDashboard({
  profiles,
  groups,
  memberships,
  announcements: _announcements,
  tasks,
  completions,
  comments,
  attendanceLogs,
  onClose,
  activeProfileId,
  userEmail: _userEmail,
  googleToken,
  onGoogleSignIn,
  consoleTitle
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'classrooms'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newRoleVal, setNewRoleVal] = useState<string>('');
  const [adminStatusMsg, setAdminStatusMsg] = useState<string | null>(null);
  
  // New States for Advanced Room & Time Comparison
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [monthA, setMonthA] = useState<string>('05'); // Default: May
  const [monthB, setMonthB] = useState<string>('06'); // Default: June
  const [pointsAmount, setPointsAmount] = useState<number>(50);

  // Helper to trigger timed feedback messages
  const triggerStatusMsg = (msg: string) => {
    setAdminStatusMsg(msg);
    setTimeout(() => setAdminStatusMsg(null), 4000);
  };

  // Toggle group selection for comparison
  const handleToggleGroup = (groupId: string) => {
    setSelectedGroupIds(prev => {
      if (prev.includes(groupId)) {
        const next = prev.filter(id => id !== groupId);
        triggerStatusMsg(`Removed room from filter.`);
        return next;
      } else {
        const next = [...prev, groupId];
        const gName = groups.find(g => g.id === groupId)?.name || 'Classroom';
        triggerStatusMsg(`Added "${gName}" for comparison analysis.`);
        return next;
      }
    });
  };

  const handleSelectAllGroups = () => {
    setSelectedGroupIds([]);
    triggerStatusMsg("Cleared specific room filters. Viewing all combined classrooms.");
  };

  const handleSelectSingleGroup = (groupId: string) => {
    setSelectedGroupIds([groupId]);
    const gName = groups.find(g => g.id === groupId)?.name || 'Classroom';
    setActiveTab('overview');
    triggerStatusMsg(`Deep diving into classroom cohort: "${gName}"`);
  };

  // --- FILTERED COLLECTIONS BASED ON SELECTED GROUPS ---
  // If no groups selected, include everything. Otherwise, filter items associated with chosen groups.
  const analyzedMemberships = useMemo(() => {
    if (selectedGroupIds.length === 0) return memberships;
    return memberships.filter(m => selectedGroupIds.includes(m.groupId));
  }, [memberships, selectedGroupIds]);

  const analyzedProfiles = useMemo(() => {
    if (selectedGroupIds.length === 0) return profiles;
    // Users that are members of selected groups
    const allowedUserIds = new Set(analyzedMemberships.map(m => m.userId));
    return profiles.filter(p => allowedUserIds.has(p.id));
  }, [profiles, analyzedMemberships, selectedGroupIds]);

  const analyzedTasks = useMemo(() => {
    if (selectedGroupIds.length === 0) return tasks;
    return tasks.filter(t => t.groupId && selectedGroupIds.includes(t.groupId));
  }, [tasks, selectedGroupIds]);

  const analyzedCompletions = useMemo(() => {
    if (selectedGroupIds.length === 0) return completions;
    const taskIds = new Set(analyzedTasks.map(t => t.id));
    return completions.filter(c => taskIds.has(c.taskId));
  }, [completions, analyzedTasks, selectedGroupIds]);

  const analyzedComments = useMemo(() => {
    if (selectedGroupIds.length === 0) return comments;
    const taskIds = new Set(analyzedTasks.map(t => t.id));
    return comments.filter(c => taskIds.has(c.taskId));
  }, [comments, analyzedTasks, selectedGroupIds]);

  const analyzedAttendanceLogs = useMemo(() => {
    if (selectedGroupIds.length === 0) return attendanceLogs;
    const allowedUserIds = new Set(analyzedProfiles.map(p => p.id));
    return attendanceLogs.filter(a => allowedUserIds.has(a.classmateId));
  }, [attendanceLogs, analyzedProfiles, selectedGroupIds]);

  // --- OVERVIEW STATS FOR SELECTED COHORTS ---
  const totalProfiles = analyzedProfiles.length;
  const totalGroups = selectedGroupIds.length > 0 ? selectedGroupIds.length : groups.length;
  const totalTasks = analyzedTasks.length;
  const totalComments = analyzedComments.length;
  const totalAttendance = analyzedAttendanceLogs.length;

  const completedTasksCount = useMemo(() => {
    const privateCompleted = analyzedTasks.filter(t => !t.isSynced && t.completed).length;
    const syncedCompletions = analyzedCompletions.filter(c => c.completed).length;
    return privateCompleted + syncedCompletions;
  }, [analyzedTasks, analyzedCompletions]);

  const completionRate = useMemo(() => {
    if (totalTasks === 0) return 0;
    let totalExpectedCompletions = analyzedTasks.filter(t => !t.isSynced).length;
    analyzedTasks.filter(t => t.isSynced).forEach(t => {
      const groupMems = analyzedMemberships.filter(m => m.groupId === t.groupId).length;
      totalExpectedCompletions += Math.max(1, groupMems);
    });
    return Math.min(100, Math.round((completedTasksCount / (totalExpectedCompletions || 1)) * 100));
  }, [analyzedTasks, analyzedMemberships, completedTasksCount, totalTasks]);

  // --- ROOM COMPARISON METRICS DATA (SIDE-BY-SIDE OVERLAP) ---
  const roomsComparisonData = useMemo(() => {
    // If we want to compare, we build data for either all active groups or the selected groups
    const targetGroups = selectedGroupIds.length > 0 
      ? groups.filter(g => selectedGroupIds.includes(g.id))
      : groups;

    return targetGroups.map(group => {
      const gMems = memberships.filter(m => m.groupId === group.id);
      const gTasks = tasks.filter(t => t.groupId === group.id);
      const taskIds = new Set(gTasks.map(t => t.id));
      
      const gCompletions = completions.filter(c => taskIds.has(c.taskId) && c.completed).length;
      const gPrivateTasks = gTasks.filter(t => !t.isSynced);
      const gPrivateCompleted = gPrivateTasks.filter(t => t.completed).length;
      const totalGroupCompletions = gCompletions + gPrivateCompleted;

      let expected = gPrivateTasks.length;
      gTasks.filter(t => t.isSynced).forEach(() => {
        expected += Math.max(1, gMems.length);
      });

      const compRate = expected > 0 ? Math.round((totalGroupCompletions / expected) * 100) : 100;

      // Attendance logs of group members
      const memIds = new Set(gMems.map(m => m.userId));
      const groupAttendance = attendanceLogs.filter(a => memIds.has(a.classmateId));
      const presentLogs = groupAttendance.filter(a => a.status === 'Present' || a.status === 'Late').length;
      const attRate = groupAttendance.length > 0 ? Math.round((presentLogs / groupAttendance.length) * 100) : 100;

      return {
        roomName: group.name,
        'Active Students': gMems.length,
        'Syllabus Tasks': gTasks.length,
        'Completion Rate (%)': Math.min(100, compRate),
        'Attendance Rate (%)': Math.min(100, attRate)
      };
    });
  }, [groups, memberships, tasks, completions, attendanceLogs, selectedGroupIds]);

  // --- TIME COMPARISON TRENDS (MONTH OVER MONTH) ---
  const monthlyTimelineData = useMemo(() => {
    // Collect data grouped by month
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    
    return months.map(m => {
      // Completed Tasks count in month m
      const privateDoneInMonth = analyzedTasks.filter(t => !t.isSynced && t.completed && getMonthFromDateStr(t.completedAt) === m).length;
      const syncedDoneInMonth = analyzedCompletions.filter(c => c.completed && getMonthFromDateStr(c.completedAt) === m).length;
      const totalDone = privateDoneInMonth + syncedDoneInMonth;

      // Attendance count in month m
      const attendanceInMonth = analyzedAttendanceLogs.filter(a => getMonthFromDateStr(a.date) === m);
      const presentInMonth = attendanceInMonth.filter(a => a.status === 'Present' || a.status === 'Late').length;
      const attRate = attendanceInMonth.length > 0 ? Math.round((presentInMonth / attendanceInMonth.length) * 100) : 100;

      // Feedback count in month m
      const commentsInMonth = analyzedComments.filter(c => getMonthFromDateStr(c.createdAt) === m).length;

      return {
        monthKey: m,
        monthName: MONTHS_MAP[m],
        'Tasks Completed': totalDone,
        'Attendance Rate (%)': attRate,
        'Comments Posted': commentsInMonth
      };
    });
  }, [analyzedTasks, analyzedCompletions, analyzedAttendanceLogs, analyzedComments]);

  // Direct comparison between Month A and Month B
  const timeComparisonMetrics = useMemo(() => {
    const dataA = monthlyTimelineData.find(d => d.monthKey === monthA);
    const dataB = monthlyTimelineData.find(d => d.monthKey === monthB);

    return {
      monthAName: MONTHS_MAP[monthA] || 'Month A',
      monthBName: MONTHS_MAP[monthB] || 'Month B',
      tasksA: dataA?.['Tasks Completed'] || 0,
      tasksB: dataB?.['Tasks Completed'] || 0,
      attRateA: dataA?.['Attendance Rate (%)'] || 0,
      attRateB: dataB?.['Attendance Rate (%)'] || 0,
      commentsA: dataA?.['Comments Posted'] || 0,
      commentsB: dataB?.['Comments Posted'] || 0
    };
  }, [monthlyTimelineData, monthA, monthB]);


  // --- LEADERBOARD & DISTRIBUTIONS FOR ACTIVE FILTER ---
  const taskCategoryData = useMemo(() => {
    const counts: { [key: string]: number } = {};
    analyzedTasks.forEach(t => {
      const cat = t.category || 'Uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [analyzedTasks]);

  const leaderboardData = useMemo(() => {
    return [...analyzedProfiles]
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .slice(0, 6)
      .map(p => ({
        name: p.name,
        Points: p.points || 0,
        Streak: p.studyStreak || 0
      }));
  }, [analyzedProfiles]);

  // --- ACADEMIC RISK & ENGAGEMENT COHORTS ANALYSIS ---
  const cohortTiersData = useMemo(() => {
    let highCount = 0;
    let onTrackCount = 0;
    let attentionCount = 0;
    let inactiveCount = 0;

    const tierLists: {
      high: StudentProfile[];
      onTrack: StudentProfile[];
      attention: StudentProfile[];
      inactive: StudentProfile[];
    } = { high: [], onTrack: [], attention: [], inactive: [] };

    analyzedProfiles.forEach(p => {
      const pts = p.points || 0;
      const streak = p.studyStreak || 0;
      if (pts >= 120 && streak >= 3) {
        highCount++;
        tierLists.high.push(p);
      } else if (pts >= 50) {
        onTrackCount++;
        tierLists.onTrack.push(p);
      } else if (pts > 0) {
        attentionCount++;
        tierLists.attention.push(p);
      } else {
        inactiveCount++;
        tierLists.inactive.push(p);
      }
    });

    return {
      chartData: [
        { name: 'High Achievers', value: highCount, color: '#10b981' },
        { name: 'On Track', value: onTrackCount, color: '#6366f1' },
        { name: 'Needs Attention', value: attentionCount, color: '#f59e0b' },
        { name: 'Inactive / No Activity', value: inactiveCount, color: '#ef4444' }
      ],
      tierLists
    };
  }, [analyzedProfiles]);

  // --- WORKLOAD PRIORITY DISTRIBUTION ---
  const taskPriorityData = useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;

    analyzedTasks.forEach(t => {
      if (t.priority === 'high') high++;
      else if (t.priority === 'medium') medium++;
      else low++;
    });

    return [
      { name: 'High Priority', count: high, fill: '#f43f5e' },
      { name: 'Medium Priority', count: medium, fill: '#f59e0b' },
      { name: 'Low Priority', count: low, fill: '#10b981' }
    ];
  }, [analyzedTasks]);

  // --- ATTENDANCE PATTERNS BY DAY OF WEEK ---
  const attendanceDayPattern = useMemo(() => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const counts = Array(7).fill(0).map(() => ({ present: 0, total: 0 }));

    analyzedAttendanceLogs.forEach(log => {
      if (!log.date) return;
      try {
        const dateObj = new Date(log.date);
        if (!isNaN(dateObj.getTime())) {
          const dayIdx = dateObj.getDay();
          counts[dayIdx].total++;
          if (log.status === 'Present' || log.status === 'Late') {
             counts[dayIdx].present++;
          }
        }
      } catch {}
    });

    return dayNames.map((name, idx) => {
      const { present, total } = counts[idx];
      const rate = total > 0 ? Math.round((present / total) * 100) : 100;
      return {
        day: name,
        'Attendance Rate (%)': rate,
        'Total Checks': total
      };
    }).filter(d => d['Total Checks'] > 0 || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(d.day));
  }, [analyzedAttendanceLogs]);


  // --- USER DIRECTORY PROCESSING ---
  const processedUsers = useMemo(() => {
    return profiles.map(p => {
      const pTasks = tasks.filter(t => t.classmateId === p.id && !t.isSynced);
      const pCompleted = pTasks.filter(t => t.completed).length;
      const sCompleted = completions.filter(c => c.classmateId === p.id && c.completed).length;
      
      const totalAssigned = pTasks.length + memberships.filter(m => m.userId === p.id).length;
      const totalCompleted = pCompleted + sCompleted;

      const completionPercentage = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 100;

      return {
        ...p,
        totalAssigned,
        totalCompleted,
        completionPercentage,
        groupsJoinedCount: memberships.filter(m => m.userId === p.id).length
      };
    });
  }, [profiles, tasks, completions, memberships]);

  const filteredUsers = useMemo(() => {
    return processedUsers.filter(u => {
      const matchSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (u.tagline || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.id.toLowerCase().includes(searchQuery.toLowerCase());
      const uRole = u.role || u.appMode || 'Student';
      const matchRole = roleFilter === 'all' || uRole.toLowerCase() === roleFilter.toLowerCase();
      return matchSearch && matchRole;
    });
  }, [processedUsers, searchQuery, roleFilter]);

  // Award Points API
  const handleAwardPoints = async (userId: string) => {
    try {
      const profileRef = doc(db, 'profiles', userId);
      const user = profiles.find(p => p.id === userId);
      if (!user) return;
      const currentPoints = user.points || 0;
      await updateDoc(profileRef, {
        points: currentPoints + pointsAmount
      });
      triggerStatusMsg(`Awarded +${pointsAmount} points to ${user.name}!`);
    } catch (err: any) {
      console.error(err);
      triggerStatusMsg(`Error: ${err.message}`);
    }
  };

  const handleUpdateRole = async (userId: string) => {
    if (!newRoleVal) return;
    try {
      const profileRef = doc(db, 'profiles', userId);
      await updateDoc(profileRef, {
        role: newRoleVal,
        appMode: newRoleVal
      });
      setEditingUserId(null);
      triggerStatusMsg(`Successfully updated user's role to ${newRoleVal}!`);
    } catch (err: any) {
      console.error(err);
      triggerStatusMsg(`Error: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header Panel */}
      <header className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="bg-indigo-600/20 text-indigo-400 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border border-indigo-500/30 shrink-0">
            <Shield className="w-5 h-5 sm:w-6 h-6 animate-pulse" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-black tracking-tight font-sans flex flex-wrap items-center gap-1.5 sm:gap-2 leading-tight">
              CampusTrack 
              <span className="bg-indigo-600 text-white text-[8px] sm:text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 sm:px-2.5 rounded-full">
                {consoleTitle || "Class Analytics"}
              </span>
            </h1>
            <p className="text-[8px] sm:text-xs text-slate-450 font-mono truncate max-w-[200px] xs:max-w-xs sm:max-w-none">
              {consoleTitle?.toLowerCase().includes("super") 
                ? "AUTHORIZED SYSTEMS ACCESS • GLOBAL DATA ANALYTICS"
                : "CLASSROOM COHORT PERFORMANCE • COMPREHENSIVE COMPLETION LOGS"}
            </p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl transition-all font-mono font-bold text-xs border border-slate-700 cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" /> 
          <span className="hidden sm:inline">Exit Console</span>
          <span className="sm:hidden text-[10px]">Exit</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        
        {/* Toast / Status Messaging Banner */}
        <AnimatePresence>
          {adminStatusMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-indigo-950/90 border border-indigo-500 text-indigo-300 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-mono font-bold"
            >
              <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
              <span>{adminStatusMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Room / Study Group Filters & Selector Hub */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl space-y-3 sm:space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
            <div className="space-y-1">
              <h3 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-1.5 sm:gap-2">
                <Filter className="w-3.5 h-3.5 sm:w-4 h-4 text-indigo-400" /> Room Cohort Selector & Overlap Controller
              </h3>
              <p className="text-[10.5px] sm:text-xs text-slate-400 leading-normal">
                Select one room to filter metrics, or check **multiple rooms** to overlay and compare their academic workloads and student progress side-by-side.
              </p>
            </div>
            <button 
              onClick={handleSelectAllGroups}
              className={`text-xs px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-bold border transition-all cursor-pointer w-full md:w-auto text-center justify-center flex items-center shrink-0 ${
                selectedGroupIds.length === 0 
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              All Rooms Combined ({groups.length})
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-2.5">
            {groups.map(group => {
              const isSelected = selectedGroupIds.includes(group.id);
              const membersCount = memberships.filter(m => m.groupId === group.id).length;
              return (
                <button
                  key={group.id}
                  onClick={() => handleToggleGroup(group.id)}
                  className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-[10.5px] sm:text-xs font-medium flex items-center gap-1.5 sm:gap-2 border transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-indigo-600 border-indigo-500 text-white font-extrabold shadow-lg shadow-indigo-600/10' 
                      : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white animate-pulse' : 'bg-slate-700'}`} />
                  <span className="truncate max-w-[120px]">{group.name}</span>
                  <span className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded ${isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-900 text-slate-500'}`}>
                    {membersCount} std
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Metric Stat Boxes (Filtered in real-time) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4">
          <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/60 p-3 sm:p-4 rounded-xl flex flex-col justify-between transition-all group">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[8.5px] sm:text-[9.5px] uppercase tracking-wider text-slate-500 font-bold font-mono truncate">Cohort Members</span>
              <div className="bg-indigo-500/10 p-1 sm:p-1.5 rounded-lg border border-indigo-500/10 group-hover:border-indigo-500/20 transition-all shrink-0">
                <Users className="w-3 h-3 sm:w-3.5 h-3.5 text-indigo-400" />
              </div>
            </div>
            <div className="mt-2.5 sm:mt-3">
              <span className="text-lg sm:text-2xl font-extrabold text-white font-mono leading-none">{totalProfiles}</span>
              <span className="text-[8.5px] sm:text-[9px] text-slate-400 block font-mono mt-0.5 sm:mt-1 truncate">
                Avg Streak: <span className="text-indigo-400 font-bold">{Math.round(analyzedProfiles.reduce((acc, p) => acc + (p.studyStreak || 0), 0) / (totalProfiles || 1))}d</span>
              </span>
            </div>
          </div>

          <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/60 p-3 sm:p-4 rounded-xl flex flex-col justify-between transition-all group">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[8.5px] sm:text-[9.5px] uppercase tracking-wider text-slate-500 font-bold font-mono truncate">Rooms Filtered</span>
              <div className="bg-purple-500/10 p-1 sm:p-1.5 rounded-lg border border-purple-500/10 group-hover:border-purple-500/20 transition-all shrink-0">
                <Layers className="w-3 h-3 sm:w-3.5 h-3.5 text-purple-400" />
              </div>
            </div>
            <div className="mt-2.5 sm:mt-3">
              <span className="text-lg sm:text-2xl font-extrabold text-white font-mono leading-none">{totalGroups}</span>
              <span className="text-[8.5px] sm:text-[9px] text-slate-400 block font-mono mt-0.5 sm:mt-1 truncate">
                {totalProfiles > 0 && totalGroups > 0 ? Math.round(totalProfiles / totalGroups) : totalProfiles} std / cohort
              </span>
            </div>
          </div>

          <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/60 p-3 sm:p-4 rounded-xl flex flex-col justify-between transition-all group">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[8.5px] sm:text-[9.5px] uppercase tracking-wider text-slate-500 font-bold font-mono truncate">Active Workloads</span>
              <div className="bg-pink-500/10 p-1 sm:p-1.5 rounded-lg border border-pink-500/10 group-hover:border-pink-500/20 transition-all shrink-0">
                <CheckSquare className="w-3 h-3 sm:w-3.5 h-3.5 text-pink-400" />
              </div>
            </div>
            <div className="mt-2.5 sm:mt-3">
              <span className="text-lg sm:text-2xl font-extrabold text-white font-mono leading-none">{totalTasks}</span>
              <span className="text-[8.5px] sm:text-[9px] text-slate-400 block font-mono mt-0.5 sm:mt-1 truncate">
                <span className="text-pink-400 font-bold">{analyzedTasks.filter(t => t.priority === 'high').length}</span> high priority
              </span>
            </div>
          </div>

          <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/60 p-3 sm:p-4 rounded-xl flex flex-col justify-between transition-all group">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[8.5px] sm:text-[9.5px] uppercase tracking-wider text-slate-500 font-bold font-mono truncate">Room Progress</span>
              <div className="bg-emerald-500/10 p-1 sm:p-1.5 rounded-lg border border-emerald-500/10 group-hover:border-emerald-500/20 transition-all shrink-0">
                <Trophy className="w-3 h-3 sm:w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>
            <div className="mt-2.5 sm:mt-3">
              <span className="text-lg sm:text-2xl font-extrabold text-white font-mono leading-none">{completionRate}%</span>
              <span className="text-[8.5px] sm:text-[9px] text-slate-400 block font-mono mt-0.5 sm:mt-1 truncate">
                <span className="text-emerald-400 font-bold">{completedTasksCount}</span> completed
              </span>
            </div>
          </div>

          <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/60 p-3 sm:p-4 rounded-xl flex flex-col justify-between transition-all group">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[8.5px] sm:text-[9.5px] uppercase tracking-wider text-slate-500 font-bold font-mono truncate">Attendance</span>
              <div className="bg-amber-500/10 p-1 sm:p-1.5 rounded-lg border border-amber-500/10 group-hover:border-amber-500/20 transition-all shrink-0">
                <Calendar className="w-3 h-3 sm:w-3.5 h-3.5 text-amber-400" />
              </div>
            </div>
            <div className="mt-2.5 sm:mt-3">
              <span className="text-lg sm:text-2xl font-extrabold text-white font-mono leading-none">{totalAttendance}</span>
              <span className="text-[8.5px] sm:text-[9px] text-slate-450 block font-mono mt-0.5 sm:mt-1 truncate">
                Presence checks log
              </span>
            </div>
          </div>

          <div className="bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/60 p-3 sm:p-4 rounded-xl flex flex-col justify-between transition-all group">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[8.5px] sm:text-[9.5px] uppercase tracking-wider text-slate-500 font-bold font-mono truncate">Forum Activity</span>
              <div className="bg-blue-500/10 p-1 sm:p-1.5 rounded-lg border border-blue-500/10 group-hover:border-blue-500/20 transition-all shrink-0">
                <MessageSquare className="w-3 h-3 sm:w-3.5 h-3.5 text-blue-400" />
              </div>
            </div>
            <div className="mt-2.5 sm:mt-3">
              <span className="text-lg sm:text-2xl font-extrabold text-white font-mono leading-none">{totalComments}</span>
              <span className="text-[8.5px] sm:text-[9px] text-slate-400 block font-mono mt-0.5 sm:mt-1 truncate">
                Replies & feedback
              </span>
            </div>
          </div>
        </div>

        {/* Tabs Control */}
        <div className="flex border-b border-slate-800 overflow-x-auto scrollbar-none whitespace-nowrap -mx-3 px-3 sm:mx-0 sm:px-0">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`px-4 sm:px-5 py-2.5 sm:py-3 font-sans text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
              activeTab === 'overview' 
                ? 'border-indigo-500 text-white bg-slate-900/40' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" /> Quantitative & Temporal Charts
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-4 sm:px-5 py-2.5 sm:py-3 font-sans text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
              activeTab === 'users' 
                ? 'border-indigo-500 text-white bg-slate-900/40' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Student Account Directory ({filteredUsers.length})
          </button>
          <button 
            onClick={() => setActiveTab('classrooms')}
            className={`px-4 sm:px-5 py-2.5 sm:py-3 font-sans text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
              activeTab === 'classrooms' 
                ? 'border-indigo-500 text-white bg-slate-900/40' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Classroom Cohort Analyzer
          </button>
        </div>

        {/* Tab 1: Charts Dashboard */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Google Sheets Report Export */}
            <GoogleSheetsExport
              googleToken={googleToken}
              onGoogleSignIn={onGoogleSignIn}
              profiles={analyzedProfiles}
              attendanceLogs={analyzedAttendanceLogs}
              completions={analyzedCompletions}
              tasks={analyzedTasks}
              activeProfileId={activeProfileId}
            />
            
            {/* Section A: Room Cohorts Multi-Overlap Comparison Charts */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4.5 h-4.5 text-indigo-400" />
                  <div>
                    <h3 className="text-xs font-mono font-extrabold uppercase text-slate-200">Classroom Cohorts Overlap Comparison</h3>
                    <p className="text-[10px] text-slate-450">Quantitative metrics compared side-by-side across your filtered classrooms.</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-indigo-300">
                  Comparing {roomsComparisonData.length} Classroom(s)
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Members and Workloads Bar Chart */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">Cohort Size & Assigned Academic Workloads</span>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={roomsComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="roomName" stroke="#64748b" fontSize={9} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                        <Legend fontSize={9} />
                        <Bar dataKey="Active Students" fill="#6366f1" radius={[4, 4, 0, 0]} name="Enrolled Classmates" />
                        <Bar dataKey="Syllabus Tasks" fill="#ec4899" radius={[4, 4, 0, 0]} name="Assigned Workloads" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Rates Overlap Chart */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">Performance Overlap (%) (Task Completion vs Attendance Rate)</span>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={roomsComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="roomName" stroke="#64748b" fontSize={9} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={9} tickLine={false} domain={[0, 100]} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                        <Legend />
                        <Bar dataKey="Completion Rate (%)" fill="#10b981" radius={[4, 4, 0, 0]} name="Workload Completion %" />
                        <Bar dataKey="Attendance Rate (%)" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Presence checks %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* Section B: Monthly Matrix & Temporal Comparison (Time Performance) */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-3 gap-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4.5 h-4.5 text-pink-400" />
                  <div>
                    <h3 className="text-xs font-mono font-extrabold uppercase text-slate-200">Temporal Matrix & Time Frame Comparison</h3>
                    <p className="text-[10px] text-slate-450">Analyze, compare, and study workloads completion and attendance across months.</p>
                  </div>
                </div>

                {/* Months Selection Dropdown */}
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-1.5 rounded-xl">
                  <select
                    value={monthA}
                    onChange={(e) => setMonthA(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-[11px] text-white font-mono cursor-pointer focus:outline-none"
                  >
                    {Object.entries(MONTHS_MAP).map(([k, v]) => (
                      <option key={k} value={k}>Month 1: {v}</option>
                    ))}
                  </select>
                  <span className="text-[10px] font-mono text-slate-600 font-bold">VS</span>
                  <select
                    value={monthB}
                    onChange={(e) => setMonthB(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-[11px] text-white font-mono cursor-pointer focus:outline-none"
                  >
                    {Object.entries(MONTHS_MAP).map(([k, v]) => (
                      <option key={k} value={k}>Month 2: {v}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Side-by-Side Monthly Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Tasks Comparison */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    <span>Tasks Completed</span>
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-slate-800 text-center">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-mono font-bold block">{timeComparisonMetrics.monthAName}</span>
                      <span className="text-xl font-black text-white font-mono">{timeComparisonMetrics.tasksA}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-indigo-400 font-mono font-bold block">{timeComparisonMetrics.monthBName}</span>
                      <span className="text-xl font-black text-indigo-450 font-mono">{timeComparisonMetrics.tasksB}</span>
                    </div>
                  </div>
                  {/* Micro Visual Bar */}
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden flex">
                    <div 
                      style={{ width: `${(timeComparisonMetrics.tasksA / (timeComparisonMetrics.tasksA + timeComparisonMetrics.tasksB || 1)) * 100}%` }} 
                      className="bg-indigo-600 h-full"
                    />
                    <div 
                      style={{ width: `${(timeComparisonMetrics.tasksB / (timeComparisonMetrics.tasksA + timeComparisonMetrics.tasksB || 1)) * 100}%` }} 
                      className="bg-purple-600 h-full"
                    />
                  </div>
                </div>

                {/* 2. Attendance rates comparison */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    <span>Attendance Rate</span>
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-slate-800 text-center">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-mono font-bold block">{timeComparisonMetrics.monthAName}</span>
                      <span className="text-xl font-black text-white font-mono">{timeComparisonMetrics.attRateA}%</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-indigo-400 font-mono font-bold block">{timeComparisonMetrics.monthBName}</span>
                      <span className="text-xl font-black text-amber-500 font-mono">{timeComparisonMetrics.attRateB}%</span>
                    </div>
                  </div>
                  {/* Micro Visual Bar */}
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden flex">
                    <div 
                      style={{ width: `${timeComparisonMetrics.attRateA}%` }} 
                      className="bg-slate-650 h-full animate-pulse"
                    />
                    <div 
                      style={{ width: `${timeComparisonMetrics.attRateB}%` }} 
                      className="bg-amber-500 h-full animate-pulse"
                    />
                  </div>
                </div>

                {/* 3. Forum Comments comparison */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    <span>Forums Engagement</span>
                    <MessageSquare className="w-3.5 h-3.5 text-pink-400" />
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-slate-800 text-center">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-mono font-bold block">{timeComparisonMetrics.monthAName}</span>
                      <span className="text-xl font-black text-white font-mono">{timeComparisonMetrics.commentsA}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-indigo-400 font-mono font-bold block">{timeComparisonMetrics.monthBName}</span>
                      <span className="text-xl font-black text-pink-500 font-mono">{timeComparisonMetrics.commentsB}</span>
                    </div>
                  </div>
                  {/* Micro Visual Bar */}
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden flex">
                    <div 
                      style={{ width: `${(timeComparisonMetrics.commentsA / (timeComparisonMetrics.commentsA + timeComparisonMetrics.commentsB || 1)) * 100}%` }} 
                      className="bg-slate-600 h-full"
                    />
                    <div 
                      style={{ width: `${(timeComparisonMetrics.commentsB / (timeComparisonMetrics.commentsA + timeComparisonMetrics.commentsB || 1)) * 100}%` }} 
                      className="bg-pink-600 h-full"
                    />
                  </div>
                </div>
              </div>

              {/* Entire 12 Months Time Performance Trend AreaChart */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-mono text-slate-300 uppercase tracking-wide font-extrabold">All Months Productivity Timeline Trends (12 Months)</span>
                  <span className="text-[9px] font-mono text-slate-500">YEAR TO DATE MONITORING</span>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyTimelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="monthName" stroke="#64748b" fontSize={9} />
                      <YAxis stroke="#64748b" fontSize={9} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                      <Legend />
                      <Area type="monotone" dataKey="Tasks Completed" stroke="#6366f1" fillOpacity={1} fill="url(#colorTasks)" name="Tasks Completed (Count)" />
                      <Area type="monotone" dataKey="Attendance Rate (%)" stroke="#f59e0b" fillOpacity={1} fill="url(#colorAtt)" name="Attendance Rate (%)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Section C: Leaderboard and Categories */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Leaderboard Chart */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-mono font-extrabold uppercase text-slate-300">Active Leaderboard (Based on Filter)</h3>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={leaderboardData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                        labelStyle={{ fontWeight: 'bold', color: '#fff' }}
                      />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="Points" fill="#6366f1" radius={[4, 4, 0, 0]} name="Academic Points" />
                      <Bar dataKey="Streak" fill="#a855f7" radius={[4, 4, 0, 0]} name="Study Streak (Days)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Task Category distribution */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-xs font-mono font-extrabold uppercase text-slate-300">Filtered Syllabus Task Categories</h3>
                </div>
                <div className="h-64 flex items-center justify-center">
                  {taskCategoryData.length === 0 ? (
                    <span className="text-xs text-slate-500 font-mono">No tasks matching filters</span>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={taskCategoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {taskCategoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Section D: Deep-Dive Student Insights & Advanced Metrics */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-3 gap-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 text-indigo-400" />
                  <div>
                    <h3 className="text-xs font-mono font-extrabold uppercase text-slate-200">Behavioral Insights & Multi-Dimensional Engagement Matrix</h3>
                    <p className="text-[10px] text-slate-400">Advanced cohort telemetry mapping student risk tiers, day-of-week attendance patterns, and curriculum priorities.</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-slate-950 px-2.5 py-1 rounded border border-slate-850 text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE DIAGNOSTICS
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Engagement Tiers & Risk Donut */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-400" /> Academic Risk & Cohort Tiers
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">PROFILES CLASSIFIED</span>
                    </div>
                    
                    <div className="h-40 flex items-center justify-center relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={cohortTiersData.chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={38}
                            outerRadius={55}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {cohortTiersData.chartData.map((entry, index) => (
                              <Cell key={`cell-tier-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-lg font-black text-white font-mono">{totalProfiles}</span>
                        <span className="text-[8px] uppercase tracking-wider text-slate-500 font-mono font-bold">Students</span>
                      </div>
                    </div>
                  </div>

                  {/* Tier lists & Quick Actions */}
                  <div className="space-y-2 mt-4">
                    {cohortTiersData.chartData.map((tier, idx) => {
                      const list = tier.name === 'High Achievers' ? cohortTiersData.tierLists.high :
                                   tier.name === 'On Track' ? cohortTiersData.tierLists.onTrack :
                                   tier.name === 'Needs Attention' ? cohortTiersData.tierLists.attention :
                                   cohortTiersData.tierLists.inactive;
                      
                      return (
                        <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-900/40 px-2.5 py-1.5 rounded-lg border border-slate-850/60">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tier.color }} />
                            <span className="text-slate-300 font-medium">{tier.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-mono font-bold bg-slate-950 px-1.5 py-0.2 rounded border border-slate-900">
                              {list.length}
                            </span>
                            <span className="text-[9px] text-slate-500">({Math.round((list.length / (totalProfiles || 1)) * 100)}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Day-of-Week Attendance Distribution */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-indigo-400" /> Day-of-Week Attendance Curve
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">WEEKLY TELEMETRY</span>
                    </div>

                    <div className="h-44">
                      {attendanceDayPattern.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-[10px] text-slate-500 font-mono">No weekly attendance logs registered</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={attendanceDayPattern} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorDayPattern" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="day" stroke="#64748b" fontSize={8} tickLine={false} />
                            <YAxis stroke="#64748b" fontSize={8} domain={[0, 100]} tickLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '10px' }} />
                            <Area type="monotone" dataKey="Attendance Rate (%)" stroke="#818cf8" fillOpacity={1} fill="url(#colorDayPattern)" name="Attendance Rate" />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 leading-normal bg-slate-900/30 p-2.5 rounded-lg border border-slate-850/50 mt-2">
                    <p className="flex items-start gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <span>
                        Attendance peaks on mid-week days. Target high-risk students during low-attendance days to boost general classroom participation.
                      </span>
                    </p>
                  </div>
                </div>

                {/* 3. Task Priority Burden */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-pink-400" /> Syllabus Curricular Priority Burden
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">WORKLOAD COMPOSITION</span>
                    </div>

                    <div className="h-44">
                      {taskPriorityData.every(d => d.count === 0) ? (
                        <div className="h-full flex items-center justify-center text-[10px] text-slate-500 font-mono">No assignments registered in filter</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={taskPriorityData} layout="vertical" margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis type="number" stroke="#64748b" fontSize={8} tickLine={false} />
                            <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={8} tickLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '10px' }} />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Assignments count" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-2">
                    <div className="text-[9.5px] font-mono text-slate-500 uppercase tracking-wider">Quick Action Risk Summary</div>
                    <div className="grid grid-cols-3 gap-2">
                      {taskPriorityData.map((prio, index) => (
                        <div key={index} className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-850/60 text-center">
                          <span className="block text-[8px] text-slate-450 truncate">{prio.name.replace(" Priority", "")}</span>
                          <span className="text-xs font-black text-white font-mono">{prio.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Tab 2: User Directory & Actions */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-3.5 justify-between items-center bg-slate-900 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-800">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-450" />
                <input
                  type="text"
                  placeholder="Search students by name, motto tagline, or account ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 pl-10 pr-4 py-2 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500"
                />
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-550 shrink-0">Filter Role:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs text-slate-200 focus:outline-none cursor-pointer focus:border-indigo-500 font-bold w-full sm:w-auto"
                >
                  <option value="all">All Roles</option>
                  <option value="Student">Student Only</option>
                  <option value="Classmate">Classmate Only</option>
                  <option value="Group Leader">Group Leader Only</option>
                  <option value="Teacher">Teacher/Admin</option>
                </select>
              </div>
            </div>

            {/* Desktop User Directory Table Grid (Hidden on Mobile) */}
            <div className="hidden sm:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-450 font-mono border-b border-slate-800 uppercase text-[9px] font-extrabold">
                      <th className="px-6 py-4">Student Profile</th>
                      <th className="px-4 py-4">Credentials & ID</th>
                      <th className="px-4 py-4 text-center">Auth Role</th>
                      <th className="px-4 py-4 text-center">Streaks</th>
                      <th className="px-4 py-4 text-center">Points Balance</th>
                      <th className="px-4 py-4 text-center">Completion Rate</th>
                      <th className="px-6 py-4 text-right">Administrative Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-500 font-mono">
                          No registered student matching query found.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map(user => {
                        const isEditingRole = editingUserId === user.id;
                        const userRole = user.role || user.appMode || 'Student';

                        return (
                          <tr key={user.id} className="hover:bg-slate-850/40 transition-colors">
                            {/* Profile Info */}
                            <td className="px-6 py-4 flex items-center gap-3">
                              <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0" referrerPolicy="no-referrer" />
                              <div className="space-y-0.5">
                                <span className="font-extrabold text-slate-200 block text-sm">{user.name}</span>
                                <span className="text-[10px] text-slate-450 italic font-mono block max-w-xs truncate">{user.tagline || 'No custom motto'}</span>
                              </div>
                            </td>

                            {/* Credentials */}
                            <td className="px-4 py-4 font-mono text-[10px] text-slate-400">
                              <span className="block text-slate-200">{(user as any).username || 'OAuth Account'}</span>
                              <span className="text-[8.5px] text-slate-550 block select-all">{user.id}</span>
                            </td>

                            {/* Auth Role */}
                            <td className="px-4 py-4 text-center font-mono">
                              {isEditingRole ? (
                                <div className="flex items-center justify-center gap-1">
                                  <select
                                    value={newRoleVal}
                                    onChange={(e) => setNewRoleVal(e.target.value)}
                                    className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-white font-bold"
                                  >
                                    <option value="Student">Student</option>
                                    <option value="Classmate">Classmate</option>
                                    <option value="Group Leader">Group Leader</option>
                                    <option value="Teacher">Teacher</option>
                                  </select>
                                  <button
                                    onClick={() => handleUpdateRole(user.id)}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-1 rounded-md cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingUserId(null)}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1 rounded-md cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                    userRole === 'Group Leader' || userRole === 'Teacher'
                                      ? 'bg-indigo-950 text-indigo-400 border-indigo-900'
                                      : userRole === 'Classmate'
                                        ? 'bg-purple-950 text-purple-400 border-purple-900'
                                        : 'bg-slate-950 text-slate-400 border-slate-800'
                                  }`}>
                                    {userRole}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setEditingUserId(user.id);
                                      setNewRoleVal(userRole);
                                    }}
                                    className="text-slate-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
                                    title="Edit Access Role"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* Streaks */}
                            <td className="px-4 py-4 text-center font-mono">
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="text-amber-500 font-extrabold flex items-center gap-0.5" title="Login Streak">
                                  ⚡{(user as any).dailyLoginStreak || 1}
                                </span>
                                <span className="text-indigo-400 font-extrabold flex items-center gap-0.5" title="Study Streak">
                                  🔥{user.studyStreak || 0}
                                </span>
                              </div>
                            </td>

                            {/* Points balance */}
                            <td className="px-4 py-4 text-center font-mono font-extrabold text-indigo-450">
                              🏅 {user.points || 0} pts
                            </td>

                            {/* Workloads Completion percentage */}
                            <td className="px-4 py-4 text-center font-mono">
                              <div className="space-y-1">
                                <span className="font-extrabold text-slate-200 block">{user.completionPercentage}%</span>
                                <span className="text-[8px] text-slate-500 block">
                                  {user.totalCompleted} / {user.totalAssigned} items
                                </span>
                              </div>
                            </td>

                            {/* Actions Column */}
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="flex items-center gap-1 bg-slate-950 border border-slate-850 rounded-xl p-1">
                                  <input 
                                    type="number" 
                                    value={pointsAmount}
                                    onChange={(e) => setPointsAmount(Math.max(1, parseInt(e.target.value) || 0))}
                                    className="w-12 bg-transparent text-center font-mono text-[10px] focus:outline-none"
                                  />
                                  <button
                                    onClick={() => handleAwardPoints(user.id)}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[9px] px-2 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 uppercase tracking-wide"
                                  >
                                    <Award className="w-2.5 h-2.5" /> Award Points
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards List View (Visible only on mobile) */}
            <div className="block sm:hidden space-y-3.5">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 font-mono text-xs">
                  No registered student matching query found.
                </div>
              ) : (
                filteredUsers.map(user => {
                  const isEditingRole = editingUserId === user.id;
                  const userRole = user.role || user.appMode || 'Student';

                  return (
                    <div key={user.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3.5">
                      {/* Student Profile Header */}
                      <div className="flex items-center gap-3">
                        <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0" referrerPolicy="no-referrer" />
                        <div className="space-y-0.5 min-w-0">
                          <span className="font-extrabold text-slate-200 block text-sm truncate">{user.name}</span>
                          <span className="text-[10px] text-slate-400 italic font-mono block truncate">{user.tagline || 'No custom motto'}</span>
                        </div>
                      </div>

                      {/* Credentials / ID details */}
                      <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-850 text-[10px] font-mono text-slate-400 flex flex-col gap-0.5">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Account Username:</span>
                          <span className="text-slate-200 font-bold font-mono">{(user as any).username || 'OAuth Account'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Workspace UID:</span>
                          <span className="text-slate-300 font-mono select-all text-[8.5px] truncate max-w-[150px]">{user.id}</span>
                        </div>
                      </div>

                      {/* Info Grid (Auth Role, Streaks, Points, Completion) */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* Auth Role */}
                        <div className="bg-slate-950/30 p-2.5 rounded-lg border border-slate-850/60 flex flex-col justify-between min-h-[56px]">
                          <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold font-mono block">Auth Role</span>
                          {isEditingRole ? (
                            <div className="flex items-center gap-1 mt-1">
                              <select
                                value={newRoleVal}
                                onChange={(e) => setNewRoleVal(e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[9px] text-white font-bold min-w-0 flex-1"
                              >
                                <option value="Student">Student</option>
                                <option value="Classmate">Classmate</option>
                                <option value="Group Leader">Group Leader</option>
                                <option value="Teacher">Teacher</option>
                              </select>
                              <button
                                onClick={() => handleUpdateRole(user.id)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white p-1 rounded cursor-pointer shrink-0"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setEditingUserId(null)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1 rounded cursor-pointer shrink-0"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 mt-1 justify-between">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border truncate ${
                                userRole === 'Group Leader' || userRole === 'Teacher'
                                  ? 'bg-indigo-950 text-indigo-400 border-indigo-900'
                                  : userRole === 'Classmate'
                                    ? 'bg-purple-950 text-purple-400 border-purple-900'
                                    : 'bg-slate-950 text-slate-400 border-slate-800'
                              }`}>
                                {userRole}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingUserId(user.id);
                                  setNewRoleVal(userRole);
                                }}
                                className="text-slate-500 hover:text-white p-1 rounded transition-colors cursor-pointer shrink-0"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Streaks */}
                        <div className="bg-slate-950/30 p-2.5 rounded-lg border border-slate-850/60 flex flex-col justify-between min-h-[56px]">
                          <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold font-mono block">Streaks</span>
                          <div className="flex items-center gap-2 mt-1 font-mono text-[10px] font-bold">
                            <span className="text-amber-500" title="Login Streak">⚡{(user as any).dailyLoginStreak || 1}d</span>
                            <span className="text-indigo-400" title="Study Streak">🔥{user.studyStreak || 0}d</span>
                          </div>
                        </div>

                        {/* Points Balance */}
                        <div className="bg-slate-950/30 p-2.5 rounded-lg border border-slate-850/60 flex flex-col justify-between min-h-[56px]">
                          <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold font-mono block">Points Balance</span>
                          <span className="text-[11px] font-mono font-extrabold text-indigo-400 mt-1">🏅 {user.points || 0} pts</span>
                        </div>

                        {/* Completion Rate */}
                        <div className="bg-slate-950/30 p-2.5 rounded-lg border border-slate-850/60 flex flex-col justify-between min-h-[56px]">
                          <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold font-mono block">Syllabus Progress</span>
                          <div className="mt-1 flex items-baseline justify-between gap-1">
                            <span className="font-extrabold font-mono text-[11px] text-slate-200">{user.completionPercentage}%</span>
                            <span className="text-[8px] text-slate-500 font-mono truncate">({user.totalCompleted}/{user.totalAssigned})</span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Action: Award Points */}
                      <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-850 flex flex-col gap-1.5">
                        <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold font-mono block">Award Points (Administrative Action)</span>
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            value={pointsAmount}
                            onChange={(e) => setPointsAmount(Math.max(1, parseInt(e.target.value) || 0))}
                            className="w-16 bg-slate-900 border border-slate-800 text-center font-mono text-xs rounded-lg py-1.5 focus:outline-none"
                          />
                          <button
                            onClick={() => handleAwardPoints(user.id)}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wide"
                          >
                            <Award className="w-3 h-3" /> Award Points
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Classroom Analyzer */}
        {activeTab === 'classrooms' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.length === 0 ? (
              <div className="col-span-full bg-slate-900 border border-slate-800 rounded-2xl py-16 text-center text-slate-500 font-mono text-xs">
                No active classroom cohorts/groups have been created yet.
              </div>
            ) : (
              groups.map(group => {
                const groupMems = memberships.filter(m => m.groupId === group.id);
                const groupTasks = tasks.filter(t => t.groupId === group.id);
                const creator = profiles.find(p => p.id === group.creatorId);

                return (
                  <div key={group.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <span className="text-[9px] bg-slate-950 text-indigo-400 font-mono border border-slate-800 font-bold px-2 py-0.5 rounded">
                            ID: {group.id}
                          </span>
                          <h4 className="font-extrabold text-sm text-white font-sans">{group.name}</h4>
                          <p className="text-[10px] text-slate-450 line-clamp-2 italic">{group.description}</p>
                        </div>
                        <Layers className="w-5 h-5 text-indigo-500 shrink-0" />
                      </div>

                      <div className="border-t border-slate-800/80 pt-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-450 font-mono">Cohort Creator:</span>
                          <span className="font-bold text-slate-300">{creator?.name || 'Unknown User'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-450 font-mono">Active Members:</span>
                          <span className="font-extrabold text-white bg-slate-950 px-2.5 py-0.5 rounded-full border border-slate-800">
                            {groupMems.length} Students
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-450 font-mono">Synced Tasks:</span>
                          <span className="font-extrabold text-white bg-slate-950 px-2.5 py-0.5 rounded-full border border-slate-800">
                            {groupTasks.filter(t => t.isSynced).length} Assignments
                          </span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <h5 className="text-[9.5px] uppercase font-mono font-extrabold text-slate-500 tracking-wider mb-2">Cohort Roster Details</h5>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                          {groupMems.map(mem => {
                            const memProfile = profiles.find(p => p.id === mem.userId);
                            return (
                              <div key={mem.id} className="flex items-center justify-between bg-slate-950 p-1.5 rounded-xl border border-slate-800/60 text-[10px]">
                                <div className="flex items-center gap-2">
                                  <img src={memProfile?.avatar || BLANK_WHITE_PICTURE} alt={memProfile?.name} className="w-5 h-5 rounded-full object-cover" />
                                  <span className="font-bold text-slate-300 truncate max-w-[110px]">{memProfile?.name || 'Classmate'}</span>
                                </div>
                                <span className={`px-1.5 py-0.2 rounded font-mono text-[8px] uppercase ${
                                  mem.role === 'leader' ? 'text-indigo-400 bg-indigo-950/40' : 'text-slate-500 bg-slate-900'
                                }`}>
                                  {mem.role}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800/60 mt-4">
                      <button 
                        onClick={() => handleSelectSingleGroup(group.id)}
                        className="w-full bg-indigo-650 hover:bg-indigo-600 text-white font-bold py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <BarChart2 className="w-3.5 h-3.5" /> Analyze Classroom Analytics
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="bg-slate-950 border-t border-slate-900 py-6 px-6 text-center select-none shrink-0">
        <span className="text-xs font-black text-indigo-950 tracking-tighter block">CampusTrack.</span>
        <span className="text-[8px] font-mono text-slate-600 font-extrabold block uppercase mt-0.5 leading-none font-sans">ADMINISTRATIVE INTERACTIVE OPERATIONS SYSTEMS • DEPLOYED RE-RENDERING INSTANT STREAMS</span>
      </footer>
    </div>
  );
}

const BLANK_WHITE_PICTURE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%236366f1'><circle cx='50' cy='35' r='20'/><path d='M50 60c-25 0-35 15-35 25v5h70v-5c0-10-10-25-35-25z'/></svg>";
