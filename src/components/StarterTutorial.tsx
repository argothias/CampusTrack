import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ArrowRight, ArrowLeft, CheckCircle2, 
  Users, Flame, Award, AlignLeft, Sparkles, GraduationCap, ChevronRight
} from 'lucide-react';

interface StarterTutorialProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'tasks' | 'create' | 'classroom' | 'focus' | 'archive' | 'streaks' | 'settings' | 'productivity';
  setActiveTab: (tab: 'tasks' | 'create' | 'classroom' | 'focus' | 'archive' | 'streaks' | 'settings' | 'productivity') => void;
  activeGroupId: string | null;
}

export default function StarterTutorial({ isOpen, onClose, activeTab: _activeTab, setActiveTab, activeGroupId: _activeGroupId }: StarterTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const totalSteps = 4;

  const handleRedirectTab = (tab: 'tasks' | 'create' | 'classroom' | 'focus' | 'archive' | 'streaks' | 'settings' | 'productivity') => {
    setActiveTab(tab);
    onClose();
  };

  const steps = [
    // STEP 1: Welcome & Overview
    {
      title: "Welcome to TaskTrack!",
      subtitle: "Your Unified Academic Workload Suite",
      icon: <GraduationCap className="w-10 h-10 text-indigo-600" />,
      bgGradient: "from-indigo-50 to-indigo-100/40",
      content: (
        <div className="space-y-4 text-slate-700 text-xs sm:text-sm leading-relaxed">
          <p className="text-slate-600 font-medium text-center sm:text-left">
            TaskTrack is a high-performance personal manager and collaborative classroom companion designed to centralize your learning workloads, guide your focus, and synchronize with peer groups.
          </p>
          
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs space-y-3.5">
            <span className="block text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Core Features At A Glance</span>
            
            <div className="space-y-3">
              <div className="flex gap-3 items-start">
                <div className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg shrink-0 mt-0.5">
                  <AlignLeft className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">Structured Workloads</h4>
                  <p className="text-[11px] text-slate-500">Log assignments, prioritize milestones, and manage complex tasks with granular subtask checklists.</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="bg-emerald-50 text-emerald-600 p-1.5 rounded-lg shrink-0 mt-0.5">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">Cohort Classroom Sync</h4>
                  <p className="text-[11px] text-slate-500">Join classmates via Class Codes to instantly sync group workloads, bulletins, and announcements.</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="bg-rose-50 text-rose-600 p-1.5 rounded-lg shrink-0 mt-0.5">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">Study Sprints & Streaks</h4>
                  <p className="text-[11px] text-slate-500">Run scientific 25-minute Pomodoro timers with ambient audio, track daily streaks, and claim achievements.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },

    // STEP 2: Workloads & Task Engine
    {
      title: "Organize Your Workloads",
      subtitle: "Manage Homework and Tasks with Precision",
      icon: <AlignLeft className="w-10 h-10 text-blue-600" />,
      bgGradient: "from-blue-50 to-blue-100/40",
      content: (
        <div className="space-y-4 text-slate-700 text-xs sm:text-sm leading-relaxed">
          <p className="text-slate-600">
            Keep track of homework, exams, and projects. You can manage tasks in two clean, distinct scopes:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white border border-slate-150 rounded-2xl p-3.5 shadow-3xs">
              <span className="inline-block bg-slate-100 text-slate-700 font-extrabold text-[9px] px-2 py-0.5 rounded-md mb-2">PERSONAL</span>
              <h4 className="font-extrabold text-slate-900 text-xs mb-1">Private Study Planner</h4>
              <p className="text-[10.5px] text-slate-500 leading-snug">Visible only to you. Perfect for managing personal goals, study review sessions, and individual tasks.</p>
            </div>
            
            <div className="bg-white border border-slate-150 rounded-2xl p-3.5 shadow-3xs">
              <span className="inline-block bg-indigo-50 text-indigo-700 font-extrabold text-[9px] px-2 py-0.5 rounded-md mb-2">SYNCED</span>
              <h4 className="font-extrabold text-slate-900 text-xs mb-1">Classroom Assignment</h4>
              <p className="text-[10.5px] text-slate-500 leading-snug">Linked to a Classroom. Keeps the whole cohort aligned, allowing classmates to check off progress individually.</p>
            </div>
          </div>

          <div className="bg-indigo-50/40 border border-indigo-100 p-3.5 rounded-2xl flex gap-2.5 items-start">
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-indigo-950">
              <strong>Subtask Progress:</strong> Break assignments down into manageable checklists. Checking off subtasks updates your main progress bar automatically!
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleRedirectTab('create')}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-all shadow-3xs"
          >
            Create Your First Workload <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    },

    // STEP 3: Cohort Classrooms
    {
      title: "Synced Classroom Hub",
      subtitle: "Learn, Share, and Track Progress with Peers",
      icon: <Users className="w-10 h-10 text-emerald-600" />,
      bgGradient: "from-emerald-50 to-emerald-100/40",
      content: (
        <div className="space-y-4 text-slate-700 text-xs sm:text-sm leading-relaxed">
          <p className="text-slate-600">
            Collaborating with peers makes learning faster and more enjoyable. The Classroom Hub provides instant synchronization:
          </p>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs space-y-3.5">
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-700"><strong>Class Codes:</strong> Enter a code from a classmate/teacher to enroll instantly, or create a class and distribute your code.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-700"><strong>Synced Workloads:</strong> Any shared homework items added to the classroom will pop up on your cohort's workloads feed immediately.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-700"><strong>Class Bulletins:</strong> Post quick team announcements, coordinate group meetings, and leave comments on assignments.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-700"><strong>Peer Standings:</strong> Climb the dynamic weekly leaderboard by completing study intervals and tasks to earn Study Points!</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleRedirectTab('classroom')}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-all shadow-3xs"
          >
            Open Classroom Hub <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    },

    // STEP 4: Focus & Achievements
    {
      title: "Focus Sprints & Achievements",
      subtitle: "Build Distraction-Free Study Rhythms",
      icon: <Award className="w-10 h-10 text-amber-500" />,
      bgGradient: "from-amber-50 to-amber-100/40",
      content: (
        <div className="space-y-4 text-slate-700 text-xs sm:text-sm leading-relaxed">
          <p className="text-slate-600">
            Harness focused intervals and keep your daily streak alive to earn customizable achievement credentials:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white border border-slate-150 rounded-2xl p-3.5 shadow-3xs flex gap-2.5">
              <Flame className="w-5 h-5 text-rose-500 shrink-0" />
              <div>
                <h4 className="font-extrabold text-slate-900 text-xs mb-0.5">Study Sprints</h4>
                <p className="text-[10px] text-slate-500 leading-normal">Practice 25-minute study intervals paired with relaxing background audio loops (Rain, Library Hub, Coffee Shop).</p>
              </div>
            </div>

            <div className="bg-white border border-slate-150 rounded-2xl p-3.5 shadow-3xs flex gap-2.5">
              <Award className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <h4 className="font-extrabold text-slate-900 text-xs mb-0.5">Motivating Streaks</h4>
                <p className="text-[10px] text-slate-500 leading-normal">Maintain daily check-ins, study session counts, and task check-offs to accumulate points and unlock rare badges.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleRedirectTab('focus')}
              className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-all shadow-3xs"
            >
              Start Focus Sprint <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleRedirectTab('streaks')}
              className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-all shadow-3xs"
            >
              View Achievements <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

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
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-900/10 active:bg-slate-900/15 rounded-full text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
              title="Close Tutorial"
            >
              <X className="w-4 h-4" />
            </button>

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
                  onClick={() => setCurrentStep(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                    i === currentStep 
                      ? 'bg-indigo-650 scale-110' 
                      : 'bg-slate-300 hover:bg-slate-400'
                  }`}
                  title={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleNext}
              className="bg-slate-900 hover:bg-slate-950 text-white font-black text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 active:scale-98 cursor-pointer transition-all shadow-md"
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
