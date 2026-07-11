import React, { useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Area, Bar
} from 'recharts';
import { 
  TrendingUp, CheckCircle2, AlertCircle, 
  Award, BarChart2, Target,
  Smile, Zap, BookOpen
} from 'lucide-react';
import { Task, StudentProfile, SyncedTaskCompletion } from '../types';

interface WeeklyProductivityProps {
  tasks: Task[];
  activeProfile: StudentProfile;
  completions?: SyncedTaskCompletion[];
  activeGroupId?: string | null;
}

export default function WeeklyProductivity({ 
  tasks, 
  activeProfile, 
  completions = [], 
  activeGroupId = null 
}: WeeklyProductivityProps) {
  const [timeRange, setTimeRange] = useState<'7days' | '14days' | '30days'>('7days');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [scope, setScope] = useState<'my-tasks' | 'all-tasks'>('my-tasks');
  const [activeChartType, setActiveChartType] = useState<'all' | 'synced'>('all');

  // Decorate tasks with their actual completed status based on completions
  const decoratedTasks = useMemo(() => {
    return tasks.map(task => {
      if (task.isSynced && completions) {
        const comp = completions.find(c => c.classmateId === activeProfile.id && c.taskId === task.id);
        return {
          ...task,
          completed: comp ? comp.completed : false,
          completedAt: comp ? (comp.completedAt || null) : null
        };
      }
      return task;
    });
  }, [tasks, completions, activeProfile.id]);

  // 1. Filter tasks belonging to this profile / group based on selection
  const scopedTasks = useMemo(() => {
    return decoratedTasks.filter(task => {
      // Ignore archived tasks for productivity unless completed
      if (task.isArchived && !task.completed) return false;
      
      if (scope === 'my-tasks') {
        return task.createdById === activeProfile.id || task.classmateId === activeProfile.id;
      }
      return true; // All group tasks
    });
  }, [decoratedTasks, activeProfile.id, scope]);

  // 2. Get unique categories for dropdown filtering
  const categories = useMemo(() => {
    const list = new Set<string>();
    scopedTasks.forEach(t => {
      if (t.category) list.add(t.category);
    });
    return ['all', ...Array.from(list)];
  }, [scopedTasks]);

  // 3. Filter tasks further by category
  const filteredTasks = useMemo(() => {
    if (filterCategory === 'all') return scopedTasks;
    return scopedTasks.filter(t => t.category === filterCategory);
  }, [scopedTasks, filterCategory]);

  // 4. Generate Date Points based on selected time range
  const datePoints = useMemo(() => {
    const daysToGenerate = timeRange === '7days' ? 7 : timeRange === '14days' ? 14 : 30;
    const points = [];
    for (let i = daysToGenerate - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { 
        weekday: daysToGenerate <= 14 ? 'short' : undefined,
        month: 'short', 
        day: 'numeric' 
      });
      points.push({ dateStr, label });
    }
    return points;
  }, [timeRange]);

  // 5. Compute Chart Data
  const chartData = useMemo(() => {
    return datePoints.map(point => {
      // Find tasks due on this date or completed on this date
      const tasksOnDay = filteredTasks.filter(t => t.dueDate === point.dateStr);
      
      const total = tasksOnDay.length;
      const completed = tasksOnDay.filter(t => t.completed).length;
      
      // Calculate completion rate
      // If there are no tasks due, we can calculate a cumulative rate or set as 0,
      // but to make it clean, we'll track completed vs total.
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        date: point.dateStr,
        name: point.label,
        "Total Workloads": total,
        "Completed": completed,
        "Completion Rate (%)": total > 0 ? rate : 100, // Show 100% if no tasks are due (all done!)
        hasTasks: total > 0
      };
    });
  }, [datePoints, filteredTasks]);

  // 5b. Compute Synced Tasks Chart Data
  const syncedChartData = useMemo(() => {
    return datePoints.map(point => {
      // Find synced tasks due on this date (filtered by active group if present)
      const syncedOnDay = decoratedTasks.filter(t => 
        t.isSynced && 
        t.dueDate === point.dateStr &&
        (!activeGroupId || t.groupId === activeGroupId)
      );
      
      const total = syncedOnDay.length;
      const completed = syncedOnDay.filter(t => t.completed).length;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 100; // default 100% when nothing is due

      // Find synced tasks completed ON this specific date
      const completedOnDay = decoratedTasks.filter(t => {
        if (!t.isSynced || !t.completed || !t.completedAt) return false;
        if (activeGroupId && t.groupId !== activeGroupId) return false;
        const compDateStr = t.completedAt.split('T')[0];
        return compDateStr === point.dateStr;
      }).length;

      return {
        date: point.dateStr,
        name: point.label,
        "Daily Completion Rate (%)": rate,
        "Tasks Due": total,
        "Tasks Completed": completed,
        "Activity (Completed Today)": completedOnDay,
        hasTasks: total > 0
      };
    });
  }, [datePoints, decoratedTasks, activeGroupId]);

  // 5c. Compute Synced Tasks Performance Metrics
  const syncedMetrics = useMemo(() => {
    const syncedTasks = decoratedTasks.filter(t => 
      t.isSynced && 
      (!activeGroupId || t.groupId === activeGroupId)
    );
    const totalCount = syncedTasks.length;
    const completedCount = syncedTasks.filter(t => t.completed).length;
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // Daily average completion rate over the week (days with tasks)
    const daysWithTasks = syncedChartData.filter(d => d.hasTasks);
    const avgDailyRate = daysWithTasks.length > 0 
      ? Math.round(daysWithTasks.reduce((sum, d) => sum + d["Daily Completion Rate (%)"], 0) / daysWithTasks.length)
      : 100;

    return {
      totalCount,
      completedCount,
      completionRate,
      avgDailyRate
    };
  }, [decoratedTasks, activeGroupId, syncedChartData]);

  // 6. Compute Core Dashboard KPI Metrics
  const metrics = useMemo(() => {
    const totalCount = filteredTasks.length;
    const completedCount = filteredTasks.filter(t => t.completed).length;
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    
    // High priority tasks
    const highPriorityTasks = filteredTasks.filter(t => t.priority === 'high');
    const completedHighPriority = highPriorityTasks.filter(t => t.completed).length;
    const highCompletionRate = highPriorityTasks.length > 0 
      ? Math.round((completedHighPriority / highPriorityTasks.length) * 100) 
      : 0;

    // Overdue tasks
    const todayStr = new Date().toISOString().split('T')[0];
    const overdueCount = filteredTasks.filter(t => !t.completed && t.dueDate < todayStr).length;

    // Find the most productive day (day with most completed tasks in chartData)
    let bestDayName = "None";
    let maxCompleted = 0;
    chartData.forEach(d => {
      if (d.Completed > maxCompleted) {
        maxCompleted = d.Completed;
        bestDayName = d.name;
      }
    });

    return {
      totalCount,
      completedCount,
      completionRate,
      highPriorityCount: highPriorityTasks.length,
      highCompletionRate,
      overdueCount,
      bestDayName,
      maxCompleted
    };
  }, [filteredTasks, chartData]);

  // 7. Habit Analysis & Actionable Insights
  const insights = useMemo(() => {
    const list = [];
    
    if (metrics.completionRate >= 80) {
      list.push({
        type: 'success',
        icon: Award,
        title: 'Master Organizer Status',
        description: 'Excellent completion rate! Your study stamina and scheduling consistency are in the top 5% of users this week.'
      });
    } else if (metrics.completionRate >= 50) {
      list.push({
        type: 'info',
        icon: Zap,
        title: 'On the Right Track',
        description: 'You are completing more than half of your assignments. Try focusing on high-priority workloads first to boost efficiency.'
      });
    } else if (metrics.totalCount > 0) {
      list.push({
        type: 'warning',
        icon: AlertCircle,
        title: 'Overdue Backlog warning',
        description: 'Your task volume is building up. Consider parsing large tasks into smaller subtasks or setting up a 25-min Pomodoro focus sprint.'
      });
    }

    if (metrics.highCompletionRate >= 90 && metrics.highPriorityCount > 0) {
      list.push({
        type: 'success',
        icon: Target,
        title: 'Flawless High-Priority Execution',
        description: 'Incredible! You have executed almost all critical deadlines. This represents exceptional critical focus.'
      });
    }

    if (metrics.maxCompleted > 2) {
      list.push({
        type: 'info',
        icon: Smile,
        title: `Peak Efficiency on ${metrics.bestDayName}`,
        description: `Your peak study speed was on ${metrics.bestDayName}, finishing ${metrics.maxCompleted} academic milestones. Excellent effort!`
      });
    }

    // Default tip if list is sparse
    if (list.length < 2) {
      list.push({
        type: 'info',
        icon: BookOpen,
        title: 'Continuous Habit Cultivation',
        description: 'Plan your assignments at least 2 days before the due date. Spacing out deadlines naturally maximizes long-term memory retention.'
      });
    }

    return list;
  }, [metrics]);

  return (
    <div className="space-y-6 text-left font-sans">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900 text-white rounded-3xl p-6 shadow-sm border border-slate-850">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/25 rounded-xl text-indigo-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h2 className="font-sans font-black text-xl tracking-tight">Weekly Productivity</h2>
          </div>
          <p className="text-xs text-slate-400">
            Track, analyze, and visualize your study habit metrics and task completion trends.
          </p>
        </div>

        {/* DASHBOARD LEVEL FILTERS */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Scope selection */}
          <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700/60">
            <button
              onClick={() => setScope('my-tasks')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                scope === 'my-tasks' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              My Workloads
            </button>
            <button
              onClick={() => setScope('all-tasks')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                scope === 'all-tasks' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Cohort
            </button>
          </div>

          {/* Timeframe switch */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-1.5 text-[10px] font-bold outline-none cursor-pointer hover:bg-slate-750 transition-all"
          >
            <option value="7days">📅 Past 7 Days</option>
            <option value="14days">📅 Past 2 Weeks</option>
            <option value="30days">📅 Past 30 Days</option>
          </select>

          {/* Category Dropdown */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-1.5 text-[10px] font-bold outline-none cursor-pointer hover:bg-slate-750 transition-all"
          >
            <option value="all">📁 All Categories</option>
            {categories.filter(c => c !== 'all').map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* CORE KPI CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Completion Rate */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-3xs flex items-center gap-4 hover:shadow-2xs transition-all">
          <div className="relative flex items-center justify-center shrink-0">
            {/* SVG circle progress */}
            <svg className="w-14 h-14 transform -rotate-90">
              <circle
                cx="28"
                cy="28"
                r="24"
                className="stroke-slate-100"
                strokeWidth="5"
                fill="transparent"
              />
              <circle
                cx="28"
                cy="28"
                r="24"
                className="stroke-indigo-600 transition-all duration-500 ease-out"
                strokeWidth="5"
                fill="transparent"
                strokeDasharray={150.7}
                strokeDashoffset={150.7 - (150.7 * metrics.completionRate) / 100}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-xs font-black text-slate-800 font-mono">
              {metrics.completionRate}%
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Completion Rate</span>
            <span className="text-lg font-black text-slate-900 tracking-tight">
              {metrics.completedCount} / {metrics.totalCount}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Tasks resolved</span>
          </div>
        </div>

        {/* KPI 2: Velocity Status */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-3xs flex items-center gap-4 hover:shadow-2xs transition-all">
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Weekly Velocity</span>
            <span className="text-lg font-black text-slate-900 tracking-tight">
              {metrics.completedCount} Done
            </span>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${metrics.completionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* KPI 3: High Priority Completion */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-3xs flex items-center gap-4 hover:shadow-2xs transition-all">
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl text-amber-600 shrink-0">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Critical Focus</span>
            <span className="text-lg font-black text-slate-900 tracking-tight">
              {metrics.highCompletionRate}%
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {metrics.highPriorityCount} critical deadlines
            </span>
          </div>
        </div>

        {/* KPI 4: Overdue Warning */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-3xs flex items-center gap-4 hover:shadow-2xs transition-all">
          <div className={`p-3 rounded-2xl shrink-0 border ${
            metrics.overdueCount > 0 
              ? 'bg-rose-50 border-rose-100 text-rose-600' 
              : 'bg-slate-50 border-slate-100 text-slate-500'
          }`}>
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Overdue Backlog</span>
            <span className={`text-lg font-black tracking-tight ${metrics.overdueCount > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-800'}`}>
              {metrics.overdueCount} {metrics.overdueCount === 1 ? 'Task' : 'Tasks'}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Require attention
            </span>
          </div>
        </div>

      </div>

      {/* CHART & HABIT STATS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LINE CHART CONTAINER (SPAN 2) */}
        <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200 shadow-sm lg:col-span-2 space-y-4 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="font-sans font-black text-sm text-slate-900 tracking-tight">
                {activeChartType === 'all' ? 'All Assignments Velocity Chart' : 'Classroom Synced Completion Rate'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {activeChartType === 'all' 
                  ? 'Line trends showing completion rate against overall task volume.' 
                  : 'Daily completion rate (%) and student activity for synced classroom assignments.'}
              </p>
            </div>
            
            {/* Chart Selector Toggle Pills */}
            <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-center">
              <button
                type="button"
                onClick={() => setActiveChartType('all')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  activeChartType === 'all' 
                    ? 'bg-white text-slate-900 shadow-3xs border border-slate-200/50' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All Workloads
              </button>
              <button
                type="button"
                onClick={() => setActiveChartType('synced')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeChartType === 'synced' 
                    ? 'bg-white text-indigo-700 shadow-3xs border border-indigo-100' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                📡 Synced Tasks
              </button>
            </div>
          </div>

          {/* Sync Stats Mini Summary Row */}
          {activeChartType === 'synced' && (
            <div className="grid grid-cols-3 gap-3 bg-indigo-50/40 border border-indigo-100/50 p-3 rounded-2xl animate-fade-in">
              <div className="text-left">
                <span className="text-[9px] uppercase font-bold text-indigo-500 tracking-wider block font-mono">Synced Tasks</span>
                <span className="text-xs sm:text-sm font-black text-slate-900 font-mono">
                  {syncedMetrics.completedCount} / {syncedMetrics.totalCount}
                </span>
                <span className="text-[8.5px] text-slate-450 block">Active classroom workloads</span>
              </div>
              <div className="text-left border-x border-indigo-100/80 px-3">
                <span className="text-[9px] uppercase font-bold text-indigo-500 tracking-wider block font-mono">My Completion</span>
                <span className="text-xs sm:text-sm font-black text-indigo-700 font-mono">
                  {syncedMetrics.completionRate}%
                </span>
                <span className="text-[8.5px] text-slate-450 block">Cumulative classroom score</span>
              </div>
              <div className="text-left">
                <span className="text-[9px] uppercase font-bold text-indigo-500 tracking-wider block font-mono">Weekly Avg Rate</span>
                <span className="text-xs sm:text-sm font-black text-emerald-700 font-mono">
                  {syncedMetrics.avgDailyRate}%
                </span>
                <span className="text-[8.5px] text-slate-450 block">Daily task readiness</span>
              </div>
            </div>
          )}

          {/* Legend indicators */}
          <div className="hidden sm:flex items-center gap-4 text-[10px] font-mono font-bold justify-end pt-1">
            {activeChartType === 'all' ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />
                  <span className="text-slate-500">Rate (%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                  <span className="text-slate-500">Completed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-amber-400 rounded-full" />
                  <span className="text-slate-500">Total</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />
                  <span className="text-slate-500">Completion Rate (%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                  <span className="text-slate-500">Completed Today (Activity)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-amber-400 rounded-full" />
                  <span className="text-slate-500">Tasks Due</span>
                </div>
              </>
            )}
          </div>

          {/* THE RECHARTS LINE CHART STAGE */}
          <div className="h-64 sm:h-72 w-full pt-2">
            {activeChartType === 'all' ? (
              metrics.totalCount === 0 ? (
                <div className="h-full w-full border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <BarChart2 className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                  <p className="text-xs font-bold text-slate-800">No Productivity Records Available</p>
                  <p className="text-[10px] text-slate-400 max-w-xs leading-relaxed">
                    Start assigning and resolving academic workloads to unlock completion speed visual graphs.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: '#64748b', fontSize: 9, fontWeight: 'bold', fontFamily: 'monospace' }} 
                    />
                    <YAxis 
                      yAxisId="left"
                      tickLine={false} 
                      axisLine={false} 
                      domain={[0, 100]}
                      tick={{ fill: '#4f46e5', fontSize: 9, fontWeight: 'bold', fontFamily: 'monospace' }} 
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tickLine={false} 
                      axisLine={false} 
                      allowDecimals={false}
                      tick={{ fill: '#10b981', fontSize: 9, fontWeight: 'bold', fontFamily: 'monospace' }} 
                    />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-md space-y-1.5 text-slate-900 text-left text-xs font-sans">
                              <p className="font-bold text-slate-900 border-b pb-1 mb-1.5 font-mono">{label}</p>
                              {payload.map((entry: any) => (
                                <div key={entry.name} className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span className="text-slate-500 font-medium">{entry.name}:</span>
                                  </div>
                                  <span className="font-extrabold font-mono text-slate-800">
                                    {entry.value}{entry.name.includes('%') ? '%' : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="Completion Rate (%)" 
                      stroke="#4f46e5" 
                      strokeWidth={3} 
                      dot={{ r: 3, stroke: '#4f46e5', strokeWidth: 2, fill: '#fff' }}
                      activeDot={{ r: 5, stroke: '#4f46e5', strokeWidth: 3 }} 
                      animationDuration={600}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="Completed" 
                      stroke="#10b981" 
                      strokeWidth={2} 
                      strokeDasharray="4 4"
                      dot={{ r: 2, fill: '#10b981' }}
                      activeDot={{ r: 4 }}
                      animationDuration={600}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="Total Workloads" 
                      stroke="#fbbf24" 
                      strokeWidth={1.5} 
                      dot={false}
                      animationDuration={600}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )
            ) : (
              syncedMetrics.totalCount === 0 ? (
                <div className="h-full w-full border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <BarChart2 className="w-8 h-8 text-indigo-300 stroke-[1.5]" />
                  <p className="text-xs font-bold text-slate-800 font-sans">No Classroom Synced Tasks</p>
                  <p className="text-[10px] text-slate-400 max-w-xs leading-relaxed font-sans">
                    Enable homework sync in your study workroom to track classroom-wide assignments and view daily completion metrics.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={syncedChartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="syncedRateGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: '#64748b', fontSize: 9, fontWeight: 'bold', fontFamily: 'monospace' }} 
                    />
                    <YAxis 
                      yAxisId="left"
                      tickLine={false} 
                      axisLine={false} 
                      domain={[0, 100]}
                      tick={{ fill: '#6366f1', fontSize: 9, fontWeight: 'bold', fontFamily: 'monospace' }} 
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tickLine={false} 
                      axisLine={false} 
                      allowDecimals={false}
                      tick={{ fill: '#10b981', fontSize: 9, fontWeight: 'bold', fontFamily: 'monospace' }} 
                    />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-md space-y-1.5 text-slate-900 text-left text-xs font-sans">
                              <p className="font-bold text-slate-900 border-b pb-1 mb-1.5 font-mono">{label}</p>
                              {payload.map((entry: any) => (
                                <div key={entry.name} className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span className="text-slate-500 font-medium">{entry.name}:</span>
                                  </div>
                                  <span className="font-extrabold font-mono text-slate-800">
                                    {entry.value}{entry.name.includes('%') ? '%' : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="Daily Completion Rate (%)" 
                      stroke="#6366f1" 
                      strokeWidth={3} 
                      fillOpacity={1}
                      fill="url(#syncedRateGradient)"
                      dot={{ r: 3, stroke: '#6366f1', strokeWidth: 2, fill: '#fff' }}
                      activeDot={{ r: 5, stroke: '#6366f1', strokeWidth: 3 }}
                    />
                    <Bar 
                      yAxisId="right"
                      dataKey="Activity (Completed Today)" 
                      fill="#10b981" 
                      radius={[4, 4, 0, 0]}
                      barSize={12}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="Tasks Due" 
                      stroke="#f59e0b" 
                      strokeWidth={1.5} 
                      strokeDasharray="3 3"
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )
            )}
          </div>
        </div>

        {/* COGNITIVE INSIGHTS COLUMN */}
        <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="space-y-0.5">
              <h3 className="font-sans font-black text-sm text-slate-900 tracking-tight">Study Habits Analysis</h3>
              <p className="text-[11px] text-slate-400">Actionable advice powered by your productivity patterns.</p>
            </div>

            {/* List of custom insights */}
            <div className="space-y-3">
              {insights.map((insight, idx) => {
                const IconComponent = insight.icon;
                return (
                  <div 
                    key={idx} 
                    className={`p-3.5 rounded-2xl border text-xs flex gap-3 text-left ${
                      insight.type === 'success' 
                        ? 'bg-emerald-50/50 border-emerald-100 text-emerald-900' 
                        : insight.type === 'warning'
                          ? 'bg-rose-50/50 border-rose-100 text-rose-900'
                          : 'bg-indigo-50/50 border-indigo-100 text-indigo-900'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 h-fit ${
                      insight.type === 'success' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : insight.type === 'warning'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="font-sans font-black text-slate-900 text-xs tracking-tight">{insight.title}</h4>
                      <p className="text-[10.5px] leading-relaxed text-slate-500">{insight.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick motivational statement */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3 mt-auto">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-slate-600" />
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">
              Study habits take average of 66 days to form. Every check-in and task completed builds your cognitive persistence! Keep writing!
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
