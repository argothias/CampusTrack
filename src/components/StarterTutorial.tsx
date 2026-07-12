import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ArrowRight, ArrowLeft, CheckCircle2, 
  Users, Flame, Award, AlignLeft, Sparkles,
  Copy, Check, Plus, LogIn, Layers, School
} from 'lucide-react';
import { createGroup, getGroupById, createMembership } from '../lib/firebaseService';
import { Group, GroupMembership } from '../types';

interface StarterTutorialProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'tasks' | 'create' | 'classroom' | 'focus' | 'archive' | 'streaks' | 'settings' | 'productivity';
  setActiveTab: (tab: 'tasks' | 'create' | 'classroom' | 'focus' | 'archive' | 'streaks' | 'settings' | 'productivity') => void;
  activeGroupId: string | null;
  activeProfileId: string | null;
  setActiveGroupId: (groupId: string | null) => void;
  groups: Group[];
  onStartInteractiveTour?: () => void;
}

export default function StarterTutorial({ 
  isOpen, 
  onClose, 
  activeTab: _activeTab, 
  setActiveTab: _setActiveTab, 
  activeGroupId,
  activeProfileId,
  setActiveGroupId,
  groups,
  onStartInteractiveTour 
}: StarterTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [modeTab, setModeTab] = useState<'join' | 'create'>('join');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const totalSteps = 3;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLocalCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!newGroupName.trim()) {
      setErrorMsg("Please provide a Classroom Name.");
      return;
    }
    if (!activeProfileId) {
      setErrorMsg("Please sign in or complete your profile first.");
      return;
    }

    setLoading(true);
    try {
      const groupId = 'group-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      const newGroup: Group = {
        id: groupId,
        name: newGroupName.trim(),
        description: newGroupDesc.trim() || "Virtual Study Room & Sync",
        creatorId: activeProfileId
      };
      const newMembership: GroupMembership = {
        id: `${groupId}-${activeProfileId}`,
        groupId: groupId,
        userId: activeProfileId,
        role: 'leader',
        canSyncTasks: true,
        canAnnounce: true
      };

      await createGroup(newGroup, newMembership);
      setActiveGroupId(groupId);
      localStorage.setItem('studysync_group_id', groupId);

      setSuccessMsg(`Classroom "${newGroup.name}" created successfully!`);
      setNewGroupName('');
      setNewGroupDesc('');
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to establish classroom.");
    } finally {
      setLoading(false);
    }
  };

  const handleLocalJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!joinCode.trim()) {
      setErrorMsg("Please enter a valid Invitation Code.");
      return;
    }
    if (!activeProfileId) {
      setErrorMsg("Please sign in or complete your profile first.");
      return;
    }

    setLoading(true);
    try {
      const groupId = joinCode.trim();
      const group = await getGroupById(groupId);
      if (!group) {
        setErrorMsg("Classroom not found. Please double-check the invitation code.");
        setLoading(false);
        return;
      }

      const newMembership: GroupMembership = {
        id: `${groupId}-${activeProfileId}`,
        groupId: groupId,
        userId: activeProfileId,
        role: 'classmate',
        canSyncTasks: false,
        canAnnounce: false
      };

      await createMembership(newMembership);
      setActiveGroupId(groupId);
      localStorage.setItem('studysync_group_id', groupId);

      setSuccessMsg(`Enrolled in "${group.name}" successfully!`);
      setJoinCode('');
    } catch (err: any) {
      setErrorMsg(err.message || "Connection failure during classroom enrollment.");
    } finally {
      setLoading(false);
    }
  };

  // Find the active group info
  const activeGroup = groups.find(g => g.id === activeGroupId);

  const steps = [
    // STEP 1: Connect to a Cohort Room first (Mandatory)
    {
      title: "Set Up Your Classroom Cohort",
      subtitle: "Join classmates or create a study room to begin syncing",
      icon: <School className="w-10 h-10 text-indigo-600 animate-pulse" />,
      bgGradient: "from-indigo-50 to-indigo-100/40",
      content: (
        <div className="space-y-4 text-slate-700 text-xs sm:text-sm leading-relaxed">
          <p className="text-slate-600 font-medium text-center sm:text-left">
            To unlock study syncing, homework planners, real-time announcements, and peer standings, you must first connect to a **Classroom Room**.
          </p>

          {activeGroupId && activeGroup ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4.5 space-y-3.5 shadow-3xs">
              <div className="flex items-center gap-2.5">
                <div className="bg-emerald-100 text-emerald-700 p-2 rounded-xl">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold tracking-widest text-emerald-600 block">CONNECTED COHORT</span>
                  <h4 className="font-extrabold text-slate-900 text-sm">{activeGroup.name}</h4>
                </div>
              </div>

              <div className="bg-white border border-emerald-100/60 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[8px] font-mono font-extrabold text-slate-400 block tracking-wider">ROOM INVITATION CODE</span>
                  <span className="font-mono text-xs font-bold text-slate-700 select-all">{activeGroup.id}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyCode(activeGroup.id)}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied" : "Copy Code"}
                </button>
              </div>

              <div className="border-t border-emerald-150 pt-2.5 flex items-center justify-between">
                <span className="text-[11px] text-emerald-800 font-semibold">⚡ All features unlocked! Ready to proceed.</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveGroupId(null);
                    setSuccessMsg(null);
                    setErrorMsg(null);
                  }}
                  className="text-[10px] text-slate-500 hover:text-rose-600 font-bold underline cursor-pointer"
                >
                  Change Classroom
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              {/* Tab Selector */}
              <div className="flex border-b border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => {
                    setModeTab('join');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`flex-1 py-3 text-xs font-black tracking-wider uppercase flex items-center justify-center gap-2 border-b-2 transition-all ${
                    modeTab === 'join' 
                      ? 'border-indigo-600 text-indigo-600 bg-white' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" /> Join Room
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModeTab('create');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`flex-1 py-3 text-xs font-black tracking-wider uppercase flex items-center justify-center gap-2 border-b-2 transition-all ${
                    modeTab === 'create' 
                      ? 'border-indigo-600 text-indigo-600 bg-white' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" /> Create Room
                </button>
              </div>

              <div className="p-4.5">
                {modeTab === 'join' ? (
                  <form onSubmit={handleLocalJoinGroup} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-1">Enter Room Invite Code</label>
                      <input
                        type="text"
                        placeholder="e.g. GROUP-ABC123XY"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        className="w-full text-xs font-bold font-mono px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-3xs"
                    >
                      {loading ? "Searching..." : "Enroll & Connect ⚡"}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleLocalCreateGroup} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-1">Classroom/Cohort Name</label>
                      <input
                        type="text"
                        placeholder="e.g. CS 101 Study Group"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        className="w-full text-xs font-bold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-1">Brief Description (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Syncing coursework, bulletins, and sprints."
                        value={newGroupDesc}
                        onChange={(e) => setNewGroupDesc(e.target.value)}
                        className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-3xs"
                    >
                      {loading ? "Establishing..." : "Establish Classroom ⚡"}
                    </button>
                  </form>
                )}

                {errorMsg && (
                  <div className="mt-3 p-2.5 bg-rose-50 border border-rose-150 text-rose-700 rounded-xl text-[11px] font-medium leading-normal text-left">
                    ⚠️ {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-xl text-[11px] font-medium leading-normal text-left">
                    ✓ {successMsg}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )
    },

    // STEP 2: Unified Controls Cheat Sheet
    {
      title: "Workspace Cheat Sheet",
      subtitle: "Learn how to use your buttons, tabs, and study modes",
      icon: <Layers className="w-10 h-10 text-blue-600" />,
      bgGradient: "from-blue-50 to-blue-100/40",
      content: (
        <div className="space-y-4 text-slate-700 text-xs sm:text-sm leading-relaxed">
          <p className="text-slate-600 font-medium">
            Let's review the primary buttons and tabs you'll interact with:
          </p>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs space-y-3.5 max-h-[280px] overflow-y-auto">
            <div className="space-y-3">
              <div className="flex gap-3.5 items-start">
                <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl shrink-0">
                  <School className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">Classroom Cohort Switcher</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">Located at the top-left dropdown. Swap between study classes, copy invite codes, or launch new cohorts.</p>
                </div>
              </div>

              <div className="flex gap-3.5 items-start">
                <div className="bg-blue-50 text-blue-600 p-2 rounded-xl shrink-0">
                  <AlignLeft className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">Workloads & Checklists</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">Track classroom assignments, test schedules, and milestones. Checking them off feeds your class progress bar.</p>
                </div>
              </div>

              <div className="flex gap-3.5 items-start">
                <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl shrink-0">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">Assemble & Publish</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">Leaders can instantly publish shared study tasks, assign coursework, upload files, and post announcements.</p>
                </div>
              </div>

              <div className="flex gap-3.5 items-start">
                <div className="bg-sky-50 text-sky-600 p-2 rounded-xl shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">Class Hub & Announcements</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">Inspect noticeboards, review registered classmates, and chat live in real-time cohort discussions.</p>
                </div>
              </div>

              <div className="flex gap-3.5 items-start">
                <div className="bg-rose-50 text-rose-600 p-2 rounded-xl shrink-0">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">Focus Pomodoro Sprints</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">Boot study timers with custom sounds (Rain, Library Cafe, Coffee Shop) to maintain focus and accumulate XP.</p>
                </div>
              </div>

              <div className="flex gap-3.5 items-start">
                <div className="bg-amber-50 text-amber-600 p-2 rounded-xl shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">XP & Identity Profile</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">Inspect your persona card, claim rare achievements, view streak days, and customize your app's paint accents. You can also update your gender (Male/Female) here anytime.</p>
                </div>
              </div>

              <div className="flex gap-3.5 items-start">
                <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">Gender-Separated Excel Reports</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">When exporting attendance or coursework logs, students are automatically separated by gender (Male & Female) for clean, publication-ready institutional formatting.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },

    // STEP 3: Pointer Onboarding Invitation
    {
      title: "Interactive Live Tour",
      subtitle: "See where the physical buttons are located live",
      icon: <Sparkles className="w-10 h-10 text-violet-600 animate-bounce" />,
      bgGradient: "from-violet-50 to-violet-100/40",
      content: (
        <div className="space-y-4 text-slate-700 text-xs sm:text-sm leading-relaxed text-center py-2">
          <p className="text-slate-600 font-medium">
            Ready to explore? We built an interactive, step-by-step tour that physically highlights the active control buttons right on your workspace.
          </p>

          <div className="bg-indigo-50 border border-indigo-150 p-4.5 rounded-2xl max-w-sm mx-auto shadow-3xs text-left space-y-2">
            <h4 className="font-extrabold text-indigo-950 text-xs flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Physical Indicator Tour
            </h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              This tour will highlight and explain each action tab on your navigation bar, letting you practice with sample items.
            </p>
          </div>

          <button
            type="button"
            onClick={onStartInteractiveTour}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-98"
          >
            <Sparkles className="w-4 h-4 animate-spin-slow" /> Start Live Pointer Tour ⚡
          </button>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep === 0 && !activeGroupId) {
      setErrorMsg("Please create or join a classroom room first to unlock the tutorial!");
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);

    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isNextDisabled = currentStep === 0 && !activeGroupId;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/70 z-99 flex items-center justify-center p-4 backdrop-blur-xs font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-250"
        >
          {/* Header Banner with Gradient Background */}
          <div className={`p-5 text-left shrink-0 border-b border-slate-150 bg-gradient-to-br ${steps[currentStep].bgGradient} transition-colors duration-300 relative`}>
            {activeGroupId && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 hover:bg-slate-900/10 active:bg-slate-900/15 rounded-full text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
                title="Close Tutorial"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <div className="flex items-center gap-3.5">
              <div className="bg-white p-2.5 rounded-2xl shadow-3xs border border-slate-200 shrink-0">
                {steps[currentStep].icon}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black tracking-widest text-indigo-650 uppercase font-mono block leading-none mb-1.5">
                  Starter Guide &bull; Step {currentStep + 1} of {totalSteps}
                </span>
                <h3 className="font-sans font-black text-slate-950 text-base sm:text-lg tracking-tight leading-none">
                  {steps[currentStep].title}
                </h3>
                <p className="text-[11px] text-slate-550 leading-tight font-medium mt-1">
                  {steps[currentStep].subtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Progress Indicator Line */}
          <div className="w-full bg-slate-100 h-1">
            <div 
              className="bg-indigo-650 h-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>

          {/* Content Body - Scrollable */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 text-left">
            {steps[currentStep].content}
          </div>

          {/* Footer Navigation Bar */}
          <div className="p-4 sm:px-6 sm:py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 0}
              className={`text-xs font-black py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all border ${
                currentStep === 0 
                  ? 'opacity-0 pointer-events-none' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-205 active:scale-98 cursor-pointer shadow-3xs'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>

            <div className="flex gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <button
                  key={i}
                  disabled={i > 0 && isNextDisabled}
                  onClick={() => setCurrentStep(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                    i === currentStep 
                      ? 'bg-indigo-650 scale-110' 
                      : i > 0 && isNextDisabled
                        ? 'bg-slate-200 cursor-not-allowed opacity-50'
                        : 'bg-slate-300 hover:bg-slate-400'
                  }`}
                  title={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleNext}
              className={`font-black text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 active:scale-98 cursor-pointer transition-all shadow-md ${
                isNextDisabled 
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                  : 'bg-slate-900 hover:bg-slate-950 text-white'
              }`}
            >
              {currentStep === totalSteps - 1 ? 'Finish Guide' : 'Continue'} 
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
