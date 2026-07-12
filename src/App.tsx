/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Plus, Trash2, Calendar, Clock, ArrowUpDown, 
  Layers, Users, Award, AlertCircle, CheckCircle2, 
  Check, Layout, Info, Trash, Square, Tag, 
  AlignLeft, RefreshCw, Flame, ChevronDown,
  Megaphone, UserPlus, Shield, ShieldCheck, Send, LogOut, Archive, Lock, WifiOff,
  Edit3, Paperclip, Link, FileText, UploadCloud, ChevronRight, HelpCircle, ArrowRight,
  MessageSquare, X, Menu, Image, Pin, Palette, Sun, Moon, Coffee, Settings,
  TrendingUp, Trophy, User, GraduationCap, Bell,
  Sparkles, Star, Zap, University, CheckSquare, BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PomodoroTimer from './components/PomodoroTimer';
import AdminDashboard from './components/AdminDashboard';
import StreaksAchievements from './components/StreaksAchievements';
import WeeklyProductivity from './components/WeeklyProductivity';
import StarterTutorial from './components/StarterTutorial';
import { HexColorPicker } from 'react-colorful';
import { Task, StudentProfile, SyncedTaskCompletion, Group, GroupMembership, Announcement, Attachment, TaskComment, AttendanceLog, TaskSubmission } from './types';
import { initAuth, googleSignIn, googleLogout, emailSignUp, emailSignIn } from './lib/firebaseAuth';
import { db, auth } from './firebase';
import { doc, writeBatch, onSnapshot, collection, query, where, getDocs, getDoc, disableNetwork, enableNetwork } from 'firebase/firestore';
import { 
  createProfile, updateProfile, 
  createGroup, getGroupById, createMembership, 
  updateMembership, deleteMembership, createAnnouncement, 
  createComment, createTask, updateTask, deleteTask, 
  saveCompletion, resetDatabase, saveAttendanceLog,
  saveTaskSubmission
} from './lib/firebaseService';
import { 
  getTodayString, 
  getYesterdayString, 
  getStartOfCurrentWeekMonday, 
  syncServerTime 
} from './utils/date';

const compressImage = (file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.75): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        resolve(e.target?.result as string);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

const getRgbFromHex = (hex: string): string => {
  let cleanHex = hex.replace(/^\s*#|\s*$/g, '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.replace(/(.)/g, '$1$1');
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  return `${r}, ${g}, ${b}`;
};

const getContrastColor = (hex: string): string => {
  let cleanHex = hex.replace(/^\s*#|\s*$/g, '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.replace(/(.)/g, '$1$1');
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 150) ? '#0f172a' : '#ffffff';
};

const getColorMapShades = (hex: string) => {
  let cleanHex = hex.replace(/^\s*#|\s*$/g, '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.replace(/(.)/g, '$1$1');
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;

  const mix = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number, weight: number) => {
    const rMix = Math.round(r1 * (1 - weight) + r2 * weight);
    const gMix = Math.round(g1 * (1 - weight) + g2 * weight);
    const bMix = Math.round(b1 * (1 - weight) + b2 * weight);
    const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
    return `#${toHex(rMix)}${toHex(gMix)}${toHex(bMix)}`;
  };

  return {
    50: mix(r, g, b, 255, 255, 255, 0.95),
    100: mix(r, g, b, 255, 255, 255, 0.88),
    150: mix(r, g, b, 255, 255, 255, 0.82),
    200: mix(r, g, b, 255, 255, 255, 0.75),
    300: mix(r, g, b, 255, 255, 255, 0.50),
    400: mix(r, g, b, 255, 255, 255, 0.25),
    500: mix(r, g, b, 255, 255, 255, 0.10),
    600: hex,
    650: mix(r, g, b, 0, 0, 0, 0.08),
    700: mix(r, g, b, 0, 0, 0, 0.15),
    800: mix(r, g, b, 0, 0, 0, 0.35),
    850: mix(r, g, b, 0, 0, 0, 0.50),
    900: mix(r, g, b, 0, 0, 0, 0.65),
    950: mix(r, g, b, 0, 0, 0, 0.82)
  };
};

const _adjustColorBrightness = (hex: string, percent: number): string => {
  let cleanHex = hex.replace(/^\s*#|\s*$/g, '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.replace(/(.)/g, '$1$1');
  }
  let r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  let g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  let b = parseInt(cleanHex.substring(4, 6), 16) || 0;

  r = Math.max(0, Math.min(255, r + (percent * 2.55)));
  g = Math.max(0, Math.min(255, g + (percent * 2.55)));
  b = Math.max(0, Math.min(255, b + (percent * 2.55)));

  const rHex = Math.round(r).toString(16).padStart(2, '0');
  const gHex = Math.round(g).toString(16).padStart(2, '0');
  const bHex = Math.round(b).toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
};

const SUGGESTED_PRESETS = [
  {
    id: 'lavender_dusk',
    name: 'Lavender Dusk 🌌',
    color: '#a78bfa',
    bg: '#0f0e17',
    card: '#1a1829',
    text: '#fffffe',
    sidebar: '#0d0c15',
    mode: 'dark' as const
  },
  {
    id: 'matcha_latte',
    name: 'Matcha Latte 🍵',
    color: '#10b981',
    bg: '#f0fdf4',
    card: '#ffffff',
    text: '#14532d',
    sidebar: '#14532d',
    mode: 'light' as const
  },
  {
    id: 'midnight_void',
    name: 'Midnight Void 🌑',
    color: '#3b82f6',
    bg: '#030712',
    card: '#0b0f19',
    text: '#f3f4f6',
    sidebar: '#030712',
    mode: 'dark' as const
  },
  {
    id: 'sepia_book',
    name: 'Sepia Book ☕',
    color: '#d97706',
    bg: '#FAF6EE',
    card: '#FDFBF7',
    text: '#433422',
    sidebar: '#3E2F1F',
    mode: 'sepia' as const
  },
  {
    id: 'crimson_velvet',
    name: 'Crimson Velvet 🌹',
    color: '#e11d48',
    bg: '#140202',
    card: '#220909',
    text: '#ffe4e6',
    sidebar: '#140202',
    mode: 'dark' as const
  },
  {
    id: 'ocean_breeze',
    name: 'Ocean Breeze 🌊',
    color: '#0284c7',
    bg: '#f0f9ff',
    card: '#ffffff',
    text: '#0369a1',
    sidebar: '#0c4a6e',
    mode: 'light' as const
  }
];

const RoleIcon = ({ role, className = "w-3 h-3" }: { role?: string; className?: string }) => {
  switch (role) {
    case 'Student': return <User className={className} />;
    case 'Teacher': return <GraduationCap className={className} />;
    case 'Class': return <Users className={className} />;
    case 'School Department': return <Layers className={className} />;
    case 'Administrative Office': return <Shield className={className} />;
    case 'School': return <University className={className} />;
    default: return <User className={className} />;
  }
};

const BadgeIcon = ({ emoji, className = "w-3.5 h-3.5" }: { emoji: string; className?: string }) => {
  switch (emoji) {
    case '🔥': return <Flame className={`${className} text-orange-500`} />;
    case '🌟': return <Star className={`${className} text-amber-500`} />;
    case '⚡': return <Zap className={`${className} text-yellow-500`} />;
    case '🧘': return <Sparkles className={`${className} text-rose-500`} />;
    case '🎒': return <Trophy className={`${className} text-indigo-500`} />;
    case '🛠️': return <Settings className={`${className} text-sky-500`} />;
    case '🎨': return <Palette className={`${className} text-violet-500`} />;
    default: return <Award className={`${className} text-indigo-500`} />;
  }
};

// Custom interactive celebration elements
const ProgressBarParticle = ({ delay, type }: { delay: number; type: 'circle' | 'emoji' }) => {
  const startX = useMemo(() => Math.random() * 90 + 5, []);
  const size = useMemo(() => Math.random() * 8 + 6, []);
  const emoji = useMemo(() => {
    const emojis = ['✨', '⭐', '🎉', '🌟', '🎈', '🎊'];
    return emojis[Math.floor(Math.random() * emojis.length)];
  }, []);
  const color = useMemo(() => {
    const colors = ['#10B981', '#34D399', '#6EE7B7', '#FBBF24', '#3B82F6', '#60A5FA', '#F472B6', '#A78BFA'];
    return colors[Math.floor(Math.random() * colors.length)];
  }, []);

  return (
    <motion.div
      className="absolute pointer-events-none select-none flex items-center justify-center font-bold"
      style={{
        left: `${startX}%`,
        bottom: '0px',
        width: type === 'circle' ? size : 'auto',
        height: type === 'circle' ? size : 'auto',
        backgroundColor: type === 'circle' ? color : 'transparent',
        borderRadius: type === 'circle' ? '50%' : '0',
        boxShadow: type === 'circle' ? `0 0 8px ${color}` : 'none',
        fontSize: type === 'emoji' ? `${Math.floor(Math.random() * 8 + 10)}px` : 'inherit',
        zIndex: 10,
      }}
      animate={{
        y: [-5, -120 - Math.random() * 100],
        x: [0, (Math.random() - 0.5) * 80],
        opacity: [0, 1, 1, 0],
        scale: [0.3, 1.3, 1, 0],
        rotate: type === 'emoji' ? [0, (Math.random() - 0.5) * 360] : 0,
      }}
      transition={{
        duration: 1.8 + Math.random() * 1.8,
        repeat: Infinity,
        delay: delay,
        ease: "easeOut"
      }}
    >
      {type === 'emoji' ? emoji : null}
    </motion.div>
  );
};

const FallingConfetti = () => {
  const particles = useMemo(() => {
    return Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      emoji: ['🎉', '✨', '⭐', '🎈', '🎓', '🏆', '🌟', '🌸', '🎊', '🍰'][Math.floor(Math.random() * 10)],
      delay: Math.random() * 6,
      duration: 3.5 + Math.random() * 4.5,
      size: 16 + Math.random() * 24,
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute font-bold select-none text-center"
          style={{
            left: `${p.left}%`,
            top: '-50px',
            fontSize: `${p.size}px`,
            zIndex: 60,
          }}
          animate={{
            y: ['0vh', '110vh'],
            x: [0, (Math.random() - 0.5) * 150],
            rotate: [0, (Math.random() - 0.5) * 720],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "linear"
          }}
        >
          {p.emoji}
        </motion.div>
      ))}
    </div>
  );
};

export default function App() {
  // Global Workspace Database lists loaded from server
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<SyncedTaskCompletion[]>([]);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);

  // Segmented query states to comply with security rules
  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [groupTasks, setGroupTasks] = useState<Task[]>([]);

  const [myCompletions, setMyCompletions] = useState<SyncedTaskCompletion[]>([]);
  const [activeTaskCompletions, setActiveTaskCompletions] = useState<SyncedTaskCompletion[]>([]);
  const [groupCompletions, setGroupCompletions] = useState<SyncedTaskCompletion[]>([]);

  const [mySubmissions, setMySubmissions] = useState<TaskSubmission[]>([]);
  const [activeTaskSubmissions, setActiveTaskSubmissions] = useState<TaskSubmission[]>([]);

  const [myAttendanceLogs, setMyAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [groupAttendanceLogs, setGroupAttendanceLogs] = useState<AttendanceLog[]>([]);

  // Merge segmented tasks
  useEffect(() => {
    const merged = new Map<string, Task>();
    createdTasks.forEach(t => merged.set(t.id, t));
    assignedTasks.forEach(t => merged.set(t.id, t));
    groupTasks.forEach(t => merged.set(t.id, t));
    setTasks(Array.from(merged.values()));
  }, [createdTasks, assignedTasks, groupTasks]);

  // Merge segmented completions
  useEffect(() => {
    const merged = new Map<string, SyncedTaskCompletion>();
    myCompletions.forEach(c => merged.set(c.id || `${c.classmateId}-${c.taskId}`, c));
    activeTaskCompletions.forEach(c => merged.set(c.id || `${c.classmateId}-${c.taskId}`, c));
    groupCompletions.forEach(c => merged.set(c.id || `${c.classmateId}-${c.taskId}`, c));
    setCompletions(Array.from(merged.values()));
  }, [myCompletions, activeTaskCompletions, groupCompletions]);

  // Merge segmented submissions
  useEffect(() => {
    const merged = new Map<string, TaskSubmission>();
    mySubmissions.forEach(s => merged.set(s.id, s));
    activeTaskSubmissions.forEach(s => merged.set(s.id, s));
    setSubmissions(Array.from(merged.values()));
  }, [mySubmissions, activeTaskSubmissions]);

  // Merge segmented attendance logs
  useEffect(() => {
    const merged = new Map<string, AttendanceLog>();
    myAttendanceLogs.forEach(a => {
      if (a.id) merged.set(a.id, a);
    });
    groupAttendanceLogs.forEach(a => {
      if (a.id) merged.set(a.id, a);
    });
    setAttendanceLogs(Array.from(merged.values()));
  }, [myAttendanceLogs, groupAttendanceLogs]);

  // Active user profile state (Local persistence)
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() => {
    return localStorage.getItem('studysync_user_id') || null;
  });
  const [activeGroupId, setActiveGroupId] = useState<string | null>(() => {
    return localStorage.getItem('studysync_group_id') || null;
  });

  // Hold-to-logout states
  const [logoutHoldProgress, setLogoutHoldProgress] = useState(0);
  const logoutHoldIntervalRef = useRef<any>(null);

  const startLogoutHold = () => {
    if (logoutHoldIntervalRef.current) {
      clearInterval(logoutHoldIntervalRef.current);
    }
    
    const startTime = Date.now();
    const duration = 1200; // 1.2 seconds hold duration
    
    logoutHoldIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / duration) * 100);
      
      setLogoutHoldProgress(progress);
      
      if (progress >= 100) {
        clearInterval(logoutHoldIntervalRef.current);
        logoutHoldIntervalRef.current = null;
        setLogoutHoldProgress(0);
        handleLogout();
      }
    }, 20);
  };

  const stopLogoutHold = () => {
    if (logoutHoldIntervalRef.current) {
      clearInterval(logoutHoldIntervalRef.current);
      logoutHoldIntervalRef.current = null;
    }
    
    // Smoothly drain hold progress back to 0
    const currentProgress = logoutHoldProgress;
    if (currentProgress > 0) {
      let tempProgress = currentProgress;
      logoutHoldIntervalRef.current = setInterval(() => {
        tempProgress = Math.max(0, tempProgress - 12);
        setLogoutHoldProgress(tempProgress);
        if (tempProgress <= 0) {
          clearInterval(logoutHoldIntervalRef.current);
          logoutHoldIntervalRef.current = null;
        }
      }, 20);
    }
  };

  useEffect(() => {
    return () => {
      if (logoutHoldIntervalRef.current) {
        clearInterval(logoutHoldIntervalRef.current);
      }
    };
  }, []);

  // System connection state for running packaged builds / WebViews / APKs
  const [serverApiUrl, setServerApiUrl] = useState<string>(() => {
    return localStorage.getItem('studysync_server_api_url') || '';
  });

  const getApiUrl = useCallback((path: string): string => {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    const savedUrl = localStorage.getItem('studysync_server_api_url') || serverApiUrl;
    if (savedUrl) {
      const base = savedUrl.replace(/\/+$/, '');
      const cleanPath = path.replace(/^\/+/, '');
      return `${base}/${cleanPath}`;
    }
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) {
      const base = envUrl.replace(/\/+$/, '');
      const cleanPath = path.replace(/^\/+/, '');
      return `${base}/${cleanPath}`;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (origin && !origin.startsWith('file:') && !origin.startsWith('capacitor:') && !origin.startsWith('chrome-extension:')) {
      const base = origin.replace(/\/+$/, '');
      const cleanPath = path.replace(/^\/+/, '');
      return `${base}/${cleanPath}`;
    }
    const defaultProductionDeployUrl = "https://ais-pre-4tgsuzuwe3pwzlzchjfwfx-1044932737425.asia-southeast1.run.app";
    const cleanPath = path.replace(/^\/+/, '');
    return `${defaultProductionDeployUrl}/${cleanPath}`;
  }, [serverApiUrl]);

  const checkAndUpdateLoginStreak = async (userProfile: any) => {
    if (!userProfile) return;
    if (!auth.currentUser || auth.currentUser.uid !== userProfile.id) {
      return;
    }
    const today = getTodayString();
    const yesterday = getYesterdayString();
    
    if (userProfile.lastLoginDate === today) {
      return;
    }
    
    let newStreak = userProfile.dailyLoginStreak || 0;
    if (userProfile.lastLoginDate === yesterday) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }
    
    try {
      await updateProfile(userProfile.id, {
        dailyLoginStreak: newStreak,
        lastLoginDate: today
      });
      setFormSuccess(`Daily Login Streak Maintained! 🔥 ${newStreak} Days!`);
      setTimeout(() => setFormSuccess(null), 5000);
    } catch (err) {
      console.error("Failed to update daily login streak", err);
    }
  };

  const checkAndUpdateSubmissionStreak = async () => {
    if (!activeProfile) return;
    if (!auth.currentUser || auth.currentUser.uid !== activeProfile.id) return;
    const today = getTodayString();
    const yesterday = getYesterdayString();
    
    if (activeProfile.lastSubmitDate === today) {
      return;
    }
    
    let newStreak = activeProfile.assignmentStreak || 0;
    if (activeProfile.lastSubmitDate === yesterday) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }
    
    try {
      await updateProfile(activeProfile.id, {
        assignmentStreak: newStreak,
        lastSubmitDate: today
      });
    } catch (err) {
      console.error("Failed to update submission streak", err);
    }
  };

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [pullDistance, setPullDistance] = useState<number>(0);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const pullStartY = useRef<number>(0);

  const handleForceSync = async () => {
    setIsRefreshing(true);
    try {
      await disableNetwork(db);
      await enableNetwork(db);
      console.log("Forced network sync completed successfully.");
    } catch (err) {
      console.error("Force network sync failed:", err);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 800);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      handleForceSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Secure Auth form states
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('What is your favorite school subject?');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryQuestion, setRecoveryQuestion] = useState('');
  const [recoveryAnswerInput, setRecoveryAnswerInput] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'username' | 'answer' | 'done'>('username');

  // Double Click / Debounce tracker
  const [isPublishingTask, setIsPublishingTask] = useState(false);
  const [showLoginConnSettings, setShowLoginConnSettings] = useState(false);

  // Google Auth & Access Token States
  const [_googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [_needsGoogleAuth, setNeedsGoogleAuth] = useState(true);

  // Profile customization states
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [_isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTagline, setEditTagline] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editGender, setEditGender] = useState<'male' | 'female'>('male');
  const [editAutoDeleteCompleted, setEditAutoDeleteCompleted] = useState(false);
  const [editAutoDeleteInterval, setEditAutoDeleteInterval] = useState<string>('immediate');
  const [activeDetailTask, setActiveDetailTask] = useState<Task | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Discussion & Comments states
  const [_expandedCommentsTaskId, _setExpandedCommentsTaskId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentImage, setNewCommentImage] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Announcement picture states
  const [announcementImage, setAnnouncementImage] = useState<string | null>(null);

  // Task composer attachments
  const [composerAttachments, setComposerAttachments] = useState<Attachment[]>([]);

  // Layout Tab control: 'tasks' | 'create' | 'classroom' | 'focus' | 'archive' | 'streaks' | 'settings' | 'productivity' | 'profile' | 'admin' | 'super_admin'
  const [activeTab, setActiveTab] = useState<'tasks' | 'create' | 'classroom' | 'focus' | 'archive' | 'streaks' | 'settings' | 'productivity' | 'profile' | 'admin' | 'super_admin'>('tasks');
  const [isEditingProfileInline, setIsEditingProfileInline] = useState(false);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState(false);
  const [_regAppMode, setRegAppMode] = useState('Student');
  const [_editAppMode, setEditAppMode] = useState('Student');
  const [regUserRole, setRegUserRole] = useState('Student');
  const [editUserRole, setEditUserRole] = useState('Student');
  const [selectedOnboardingRole, setSelectedOnboardingRole] = useState('Student');
  const [savingOnboarding, setSavingOnboarding] = useState(false);

  // Popup overlay sheets togglers
  const [showProfilePopover, setShowProfilePopover] = useState(false);
  const [showGroupPopover, setShowGroupPopover] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [guideStep, setGuideStep] = useState<number | null>(null);

  // Default blank white profile picture SVG database payload
  const BLANK_WHITE_PICTURE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'><rect width='100%' height='100%' fill='%23FFFFFF'/><circle cx='75' cy='75' r='45' fill='%23F1F5F9' stroke='%23CBD5E1' stroke-width='2'/><path d='M75 80c-15 0-25 8-25 15v5h50v-5c0-7-10-15-25-15z' fill='%2394A3B8'/><circle cx='75' cy='55' r='15' fill='%2394A3B8'/></svg>";

  // Input states for registering an account
  const [newUserId, setNewUserId] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserTagline, setNewUserTagline] = useState('');
  const [newUserAvatar, setNewUserAvatar] = useState(BLANK_WHITE_PICTURE);
  const [regGender, setRegGender] = useState<'male' | 'female'>('male');

  // Avatar Options (Deprecated)
  const _avatarOptions: string[] = [];

  // Input states for creating a Class group
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  // Input states for joining an existing Group
  const [joinCode, setJoinCode] = useState('');

  // Input states for adding Announcements
  const [newAnnouncement, setNewAnnouncement] = useState('');

  // Search, sorting, and pill filter states for tasks
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [_selectedPriority, _setSelectedPriority] = useState('All');
  const [selectedScope, setSelectedScope] = useState<'all' | 'synced' | 'personal'>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'category'>('dueDate');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');

  // App Customization and Color Scheme States
  interface FullThemePreset {
    id: string;
    name: string;
    color: string;
    bg: string;
    card: string;
    text: string;
    sidebar: string;
    mode: 'light' | 'dark' | 'sepia';
    isCustom?: boolean;
  }

  const [committedTheme, setCommittedTheme] = useState<{
    color: string;
    bg: string;
    card: string;
    text: string;
    sidebar: string;
    mode: 'light' | 'dark' | 'sepia';
  }>(() => {
    const color = localStorage.getItem('studysync_committed_color') || localStorage.getItem('studysync_custom_color') || '#4f46e5';
    const bg = localStorage.getItem('studysync_committed_bg_color') || localStorage.getItem('studysync_custom_bg_color') || '';
    const card = localStorage.getItem('studysync_committed_card_color') || localStorage.getItem('studysync_custom_card_color') || '';
    const text = localStorage.getItem('studysync_committed_text_color') || localStorage.getItem('studysync_custom_text_color') || '';
    const sidebar = localStorage.getItem('studysync_committed_sidebar_color') || localStorage.getItem('studysync_custom_sidebar_color') || '';
    const mode = (localStorage.getItem('studysync_committed_theme_mode') || localStorage.getItem('studysync_theme_mode') || 'light') as 'light' | 'dark' | 'sepia';
    return { color, bg, card, text, sidebar, mode };
  });

  const [colorScheme, setColorScheme] = useState<'indigo' | 'emerald' | 'rose' | 'violet' | 'amber' | 'slate'>(() => {
    return (localStorage.getItem('studysync_color_scheme') as any) || 'indigo';
  });
  
  const [customColor, setCustomColor] = useState<string>(committedTheme.color);
  const [appThemeMode, setAppThemeMode] = useState<'light' | 'dark' | 'sepia'>(committedTheme.mode);
  const [customBgColor, setCustomBgColor] = useState<string>(committedTheme.bg);
  const [customCardColor, setCustomCardColor] = useState<string>(committedTheme.card);
  const [customTextColor, setCustomTextColor] = useState<string>(committedTheme.text);
  const [customSidebarColor, setCustomSidebarColor] = useState<string>(committedTheme.sidebar);

  const [selectedLayer, setSelectedLayer] = useState<'accent' | 'bg' | 'card' | 'text' | 'sidebar'>('accent');
  const [isLayerDropdownOpen, setIsLayerDropdownOpen] = useState(false);

  // Custom presets states
  const [userPresets, setUserPresets] = useState<FullThemePreset[]>(() => {
    try {
      const saved = localStorage.getItem('studysync_user_presets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [newPresetName, setNewPresetName] = useState('');
  const [copiedPresetId, setCopiedPresetId] = useState<string | null>(null);
  const [importCode, setImportCode] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  const getActiveLayerColor = (): string => {
    switch (selectedLayer) {
      case 'accent':
        return customColor;
      case 'bg':
        return customBgColor || (appThemeMode === 'dark' ? '#020617' : appThemeMode === 'sepia' ? '#FAF6EE' : '#f8fafc');
      case 'card':
        return customCardColor || (appThemeMode === 'dark' ? '#0f172a' : appThemeMode === 'sepia' ? '#FDFBF7' : '#ffffff');
      case 'text':
        return customTextColor || (appThemeMode === 'dark' ? '#f1f5f9' : appThemeMode === 'sepia' ? '#433422' : '#0f172a');
      case 'sidebar':
        return customSidebarColor || '#0f172a';
    }
  };

  const handleActiveLayerColorChange = (hex: string) => {
    switch (selectedLayer) {
      case 'accent':
        setCustomColor(hex);
        break;
      case 'bg':
        setCustomBgColor(hex);
        break;
      case 'card':
        setCustomCardColor(hex);
        break;
      case 'text':
        setCustomTextColor(hex);
        break;
      case 'sidebar':
        setCustomSidebarColor(hex);
        break;
    }
  };

  const handleResetLayer = () => {
    switch (selectedLayer) {
      case 'accent':
        setCustomColor('#4f46e5');
        break;
      case 'bg':
        setCustomBgColor('');
        break;
      case 'card':
        setCustomCardColor('');
        break;
      case 'text':
        setCustomTextColor('');
        break;
      case 'sidebar':
        setCustomSidebarColor('');
        break;
    }
  };

  const hasUnsavedThemeChanges = 
    customColor !== committedTheme.color ||
    customBgColor !== committedTheme.bg ||
    customCardColor !== committedTheme.card ||
    customTextColor !== committedTheme.text ||
    customSidebarColor !== committedTheme.sidebar ||
    appThemeMode !== committedTheme.mode;

  const handleSaveThemeChanges = () => {
    const newTheme = {
      color: customColor,
      bg: customBgColor,
      card: customCardColor,
      text: customTextColor,
      sidebar: customSidebarColor,
      mode: appThemeMode
    };
    setCommittedTheme(newTheme);
    localStorage.setItem('studysync_committed_color', newTheme.color);
    localStorage.setItem('studysync_committed_bg_color', newTheme.bg);
    localStorage.setItem('studysync_committed_card_color', newTheme.card);
    localStorage.setItem('studysync_committed_text_color', newTheme.text);
    localStorage.setItem('studysync_committed_sidebar_color', newTheme.sidebar);
    localStorage.setItem('studysync_committed_theme_mode', newTheme.mode);
    
    localStorage.setItem('studysync_custom_color', newTheme.color);
    localStorage.setItem('studysync_custom_bg_color', newTheme.bg);
    localStorage.setItem('studysync_custom_card_color', newTheme.card);
    localStorage.setItem('studysync_custom_text_color', newTheme.text);
    localStorage.setItem('studysync_custom_sidebar_color', newTheme.sidebar);
    localStorage.setItem('studysync_theme_mode', newTheme.mode);
  };

  const handleDiscardThemeChanges = () => {
    setCustomColor(committedTheme.color);
    setCustomBgColor(committedTheme.bg);
    setCustomCardColor(committedTheme.card);
    setCustomTextColor(committedTheme.text);
    setCustomSidebarColor(committedTheme.sidebar);
    setAppThemeMode(committedTheme.mode);
  };

  const handleSelectPreset = (preset: { color: string; bg: string; card: string; text: string; sidebar: string; mode: 'light' | 'dark' | 'sepia' }) => {
    setCustomColor(preset.color);
    setCustomBgColor(preset.bg);
    setCustomCardColor(preset.card);
    setCustomTextColor(preset.text);
    setCustomSidebarColor(preset.sidebar);
    setAppThemeMode(preset.mode);
  };

  const handleAddPreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: FullThemePreset = {
      id: 'preset_' + Date.now(),
      name: newPresetName.trim(),
      color: customColor,
      bg: customBgColor,
      card: customCardColor,
      text: customTextColor,
      sidebar: customSidebarColor,
      mode: appThemeMode,
      isCustom: true
    };
    const updated = [...userPresets, newPreset];
    setUserPresets(updated);
    localStorage.setItem('studysync_user_presets', JSON.stringify(updated));
    setNewPresetName('');
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = userPresets.filter(p => p.id !== id);
    setUserPresets(updated);
    localStorage.setItem('studysync_user_presets', JSON.stringify(updated));
  };

  const handleCopyPreset = (preset: FullThemePreset, e: React.MouseEvent) => {
    e.stopPropagation();
    const config = {
      name: preset.name,
      color: preset.color,
      bg: preset.bg,
      card: preset.card,
      text: preset.text,
      sidebar: preset.sidebar,
      mode: preset.mode
    };
    try {
      const code = 'ST_' + btoa(unescape(encodeURIComponent(JSON.stringify(config))));
      navigator.clipboard.writeText(code);
      setCopiedPresetId(preset.id);
      setTimeout(() => setCopiedPresetId(null), 2000);
    } catch {
      navigator.clipboard.writeText(JSON.stringify(config));
      setCopiedPresetId(preset.id);
      setTimeout(() => setCopiedPresetId(null), 2000);
    }
  };

  const handleImportThemeCode = () => {
    setImportError('');
    setImportSuccess('');
    if (!importCode.trim()) {
      setImportError('Please enter a valid theme code');
      return;
    }
    let cleanCode = importCode.trim();
    if (cleanCode.startsWith('ST_')) {
      cleanCode = cleanCode.substring(3);
    }
    try {
      const jsonStr = decodeURIComponent(escape(atob(cleanCode)));
      const parsed = JSON.parse(jsonStr);
      if (!parsed.color) {
        throw new Error('Missing color properties');
      }
      
      const themeColors = {
        color: parsed.color,
        bg: parsed.bg || '',
        card: parsed.card || '',
        text: parsed.text || '',
        sidebar: parsed.sidebar || '',
        mode: (parsed.mode || 'light') as 'light' | 'dark' | 'sepia'
      };
      
      setCustomColor(themeColors.color);
      setCustomBgColor(themeColors.bg);
      setCustomCardColor(themeColors.card);
      setCustomTextColor(themeColors.text);
      setCustomSidebarColor(themeColors.sidebar);
      setAppThemeMode(themeColors.mode);
      
      const newPreset: FullThemePreset = {
        id: 'preset_imported_' + Date.now(),
        name: (parsed.name || 'Shared Theme') + ' 📥',
        color: themeColors.color,
        bg: themeColors.bg,
        card: themeColors.card,
        text: themeColors.text,
        sidebar: themeColors.sidebar,
        mode: themeColors.mode,
        isCustom: true
      };
      const updated = [...userPresets, newPreset];
      setUserPresets(updated);
      localStorage.setItem('studysync_user_presets', JSON.stringify(updated));
      
      setImportSuccess(`Successfully imported and loaded "${parsed.name || 'Shared Theme'}"!`);
      setImportCode('');
      setTimeout(() => setImportSuccess(''), 4000);
    } catch {
      setImportError('Invalid theme code format. Please verify and try again.');
    }
  };

  // Task inline/modal edit, lightbox view, and calendar Date states
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  const [toasts, setToasts] = useState<Array<{
    id: string;
    title: string;
    body: string;
    type: 'task' | 'announcement' | 'comment' | 'success';
    groupName?: string;
  }>>([]);
  const [browserNotificationGranted, setBrowserNotificationGranted] = useState<boolean>(() => {
    return 'Notification' in window && Notification.permission === 'granted';
  });

  const [showGlobalCongratulation, setShowGlobalCongratulation] = useState(false);
  const [showProgressDetails, setShowProgressDetails] = useState(false);
  const prevPercentRef = useRef<number | null>(null);
  const hasJustInteractedRef = useRef<boolean>(false);

  // Dynamic Theme Definitions and mapping
  const theme = useMemo(() => {
    const accents = {
      indigo: {
        primary: 'bg-indigo-600',
        hover: 'hover:bg-indigo-700',
        text: 'text-indigo-600',
        textHover: 'hover:text-indigo-700',
        border: 'border-indigo-200',
        bgLight: 'bg-indigo-50/50',
        bgLightHover: 'hover:bg-indigo-100/50',
        borderLight: 'border-indigo-100',
        focus: 'focus:border-indigo-400',
        accentGlow: 'shadow-indigo-100',
        badge: 'bg-indigo-50 border-indigo-100 text-indigo-600',
        activeTab: 'bg-indigo-650 text-white',
        gradient: 'from-indigo-600 to-violet-600',
        progress: 'bg-indigo-600',
      },
      emerald: {
        primary: 'bg-emerald-600',
        hover: 'hover:bg-emerald-700',
        text: 'text-emerald-600',
        textHover: 'hover:text-emerald-700',
        border: 'border-emerald-200',
        bgLight: 'bg-emerald-50/55',
        bgLightHover: 'hover:bg-emerald-100/50',
        borderLight: 'border-emerald-100',
        focus: 'focus:border-emerald-400',
        accentGlow: 'shadow-emerald-100',
        badge: 'bg-emerald-50 border-emerald-100 text-emerald-600',
        activeTab: 'bg-emerald-600 text-white',
        gradient: 'from-emerald-600 to-teal-600',
        progress: 'bg-emerald-600',
      },
      rose: {
        primary: 'bg-rose-600',
        hover: 'hover:bg-rose-700',
        text: 'text-rose-600',
        textHover: 'hover:text-rose-700',
        border: 'border-rose-200',
        bgLight: 'bg-rose-50/55',
        bgLightHover: 'hover:bg-rose-100/50',
        borderLight: 'border-rose-100',
        focus: 'focus:border-rose-400',
        accentGlow: 'shadow-rose-100',
        badge: 'bg-rose-50 border-rose-100 text-rose-600',
        activeTab: 'bg-rose-600 text-white',
        gradient: 'from-rose-600 to-pink-600',
        progress: 'bg-rose-600',
      },
      violet: {
        primary: 'bg-violet-600',
        hover: 'hover:bg-violet-700',
        text: 'text-violet-600',
        textHover: 'hover:text-violet-700',
        border: 'border-violet-200',
        bgLight: 'bg-violet-50/55',
        bgLightHover: 'hover:bg-violet-100/50',
        borderLight: 'border-violet-100',
        focus: 'focus:border-violet-400',
        accentGlow: 'shadow-violet-100',
        badge: 'bg-violet-50 border-violet-100 text-violet-600',
        activeTab: 'bg-violet-600 text-white',
        gradient: 'from-violet-600 to-fuchsia-600',
        progress: 'bg-violet-600',
      },
      amber: {
        primary: 'bg-amber-600',
        hover: 'hover:bg-amber-700',
        text: 'text-amber-600',
        textHover: 'hover:text-amber-700',
        border: 'border-amber-200',
        bgLight: 'bg-amber-50/55',
        bgLightHover: 'hover:bg-amber-100/50',
        borderLight: 'border-amber-100',
        focus: 'focus:border-amber-400',
        accentGlow: 'shadow-amber-100',
        badge: 'bg-amber-50 border-amber-100 text-amber-750',
        activeTab: 'bg-amber-600 text-white',
        gradient: 'from-amber-600 to-orange-600',
        progress: 'bg-amber-600',
      },
      slate: {
        primary: 'bg-slate-700',
        hover: 'hover:bg-slate-800',
        text: 'text-slate-700',
        textHover: 'hover:text-slate-800',
        border: 'border-slate-300',
        bgLight: 'bg-slate-100/55',
        bgLightHover: 'hover:bg-slate-200/55',
        borderLight: 'border-slate-200',
        focus: 'focus:border-slate-500',
        accentGlow: 'shadow-slate-100',
        badge: 'bg-slate-150 border-slate-250 text-slate-750',
        activeTab: 'bg-slate-700 text-white',
        gradient: 'from-slate-700 to-slate-900',
        progress: 'bg-slate-700',
      },
    };

    const modes = {
      light: {
        bodyBg: 'theme-body-bg',
        textMain: 'theme-text-main',
        textMuted: 'text-slate-500',
        cardBg: 'theme-card-bg',
        cardBorder: 'border-slate-200',
        panelBg: 'theme-body-bg',
        panelBorder: 'border-slate-100',
        inputBg: 'theme-card-bg',
        inputBorder: 'border-slate-200',
        inputText: 'theme-text-main',
        commentBg: 'theme-body-bg',
        commentBorder: 'border-slate-150',
        detailHeaderBg: 'bg-slate-900',
      },
      dark: {
        bodyBg: 'theme-body-bg',
        textMain: 'theme-text-main',
        textMuted: 'text-slate-400',
        cardBg: 'theme-card-bg',
        cardBorder: 'border-slate-800',
        panelBg: 'theme-body-bg',
        panelBorder: 'border-slate-800',
        inputBg: 'theme-card-bg',
        inputBorder: 'border-slate-700',
        inputText: 'theme-text-main',
        commentBg: 'theme-body-bg',
        commentBorder: 'border-slate-800',
        detailHeaderBg: 'bg-slate-950',
      },
      sepia: {
        bodyBg: 'theme-body-bg',
        textMain: 'theme-text-main',
        textMuted: 'text-[#8A7A6B]',
        cardBg: 'theme-card-bg',
        cardBorder: 'border-[#EAE2D5]',
        panelBg: 'theme-body-bg',
        panelBorder: 'border-[#E3DAC9]',
        inputBg: 'theme-card-bg',
        inputBorder: 'border-[#DFD6C4]',
        inputText: 'theme-text-main',
        commentBg: 'theme-body-bg',
        commentBorder: 'border-[#DFD6C4]',
        detailHeaderBg: 'bg-[#3E2F1F]',
      },
    };

    return {
      accent: accents[colorScheme] || accents.indigo,
      mode: modes[appThemeMode] || modes.light,
    };
  }, [colorScheme, appThemeMode]);

  // Input states for publishing a Task
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newTaskCategory, setNewTaskCategory] = useState('Physics'); // can type anything custom!
  const [newTaskSubtasksRaw, setNewTaskSubtasksRaw] = useState('');
  const [newTaskSubtasksList, setNewTaskSubtasksList] = useState<{ id: string; title: string; completed: boolean }[]>([]);
  const [newTaskSubtaskInputValue, setNewTaskSubtaskInputValue] = useState('');
  const [newTaskScope, setNewTaskScope] = useState<'synced' | 'personal'>('synced');
  const [personalEstDuration, setPersonalEstDuration] = useState<string>('30m');
  const [personalRecurrence, setPersonalRecurrence] = useState<string>('one-off');
  const [newTaskPoints, setNewTaskPoints] = useState<number>(50);
  
  // Asynchronous Task states
  const [newTaskSubmissionType, setNewTaskSubmissionType] = useState<'none' | 'subjective' | 'objective'>('none');
  const [newTaskMaxScore, setNewTaskMaxScore] = useState<number>(100);
  const [newTaskSubjectivePrompt, setNewTaskSubjectivePrompt] = useState('');
  const [newTaskObjectiveQuestions, setNewTaskObjectiveQuestions] = useState<{ id: string; question: string; options: string[]; correctAnswer: string; }[]>([]);

  const [classroomSubTab, setClassroomSubTab] = useState<'leaderboard' | 'members'>('leaderboard');

  // Submission & Grading Active Modal States
  const [submissionSubjectiveAnswer, setSubmissionSubjectiveAnswer] = useState('');
  const [submissionObjectiveAnswers, setSubmissionObjectiveAnswers] = useState<Record<string, string>>({});
  const [submissionActiveTab, setSubmissionActiveTab] = useState<'submit' | 'review'>('submit');
  const [gradingScore, setGradingScore] = useState<string>('');
  const [gradingFeedback, setGradingFeedback] = useState<string>('');
  const [reviewClassmateId, setReviewClassmateId] = useState<string | null>(null);

  // In-line manual task subtask addition states
  const [inlineMilestoneInput, setInlineMilestoneInput] = useState<Record<string, string>>({});

  // Active User profile matching
  const activeProfile = useMemo(() => {
    return profiles.find(p => p.id === activeProfileId) || null;
  }, [profiles, activeProfileId]);

  // Check if current user is the Administrator
  const _isAdminUser = useMemo(() => {
    if (!activeProfileId) return false;
    const authEmail = auth.currentUser?.email;
    if (authEmail === 'minami23o49@gmail.com') return true;
    if (activeProfile?.id === 'admin' || activeProfileId === 'admin') return true;
    if (activeProfile?.name?.toLowerCase().includes('admin')) return true;
    if ((activeProfile as any)?.username?.toLowerCase() === 'minami23o49') return true;
    return false;
  }, [activeProfileId, activeProfile]);

  // Is Super Admin explicitly matching the user's personal account
  const isSuperAdmin = useMemo(() => {
    if (!activeProfileId) return false;
    const authEmail = auth.currentUser?.email;
    if (authEmail === 'minami23o49@gmail.com') return true;
    if (activeProfile?.id === 'admin' || activeProfileId === 'admin') return true;
    if ((activeProfile as any)?.username?.toLowerCase() === 'minami23o49') return true;
    return false;
  }, [activeProfileId, activeProfile]);

  // Can Access Class Analytics
  const canAccessClassAnalytics = useMemo(() => {
    if (!activeProfileId) return false;
    if (isSuperAdmin) return true;
    // Visually accessible if user created any group or is a leader of any group
    return groups.some(g => g.creatorId === activeProfileId) || memberships.some(m => m.userId === activeProfileId && m.role === 'leader');
  }, [groups, memberships, activeProfileId, isSuperAdmin]);

  // Restricted datasets for Class Analytics
  const classAnalyticsData = useMemo(() => {
    if (!activeProfileId) {
      return { groups: [], memberships: [], profiles: [], tasks: [], completions: [], comments: [], attendanceLogs: [] };
    }

    // Determine rooms the user has permission for (either they are creator, or they are leader)
    const allowedGroups = groups.filter(g => {
      if (g.creatorId === activeProfileId) return true;
      return memberships.some(m => m.groupId === g.id && m.userId === activeProfileId && m.role === 'leader');
    });

    const allowedGroupIds = new Set(allowedGroups.map(g => g.id));

    // Filter memberships associated with these groups
    const allowedMemberships = memberships.filter(m => allowedGroupIds.has(m.groupId));
    const allowedUserIds = new Set(allowedMemberships.map(m => m.userId));

    // Filter profiles belonging to those memberships
    const allowedProfiles = profiles.filter(p => allowedUserIds.has(p.id));

    // Filter tasks belonging to these groups
    const allowedTasks = tasks.filter(t => t.groupId && allowedGroupIds.has(t.groupId));
    const allowedTaskIds = new Set(allowedTasks.map(t => t.id));

    // Filter completions belonging to those tasks
    const allowedCompletions = completions.filter(c => allowedTaskIds.has(c.taskId));

    // Filter comments belonging to those tasks
    const allowedComments = comments.filter(c => allowedTaskIds.has(c.taskId));

    // Filter attendance logs belonging to matching users
    const allowedAttendanceLogs = attendanceLogs.filter(a => allowedUserIds.has(a.classmateId));

    return {
      groups: allowedGroups,
      memberships: allowedMemberships,
      profiles: allowedProfiles,
      tasks: allowedTasks,
      completions: allowedCompletions,
      comments: allowedComments,
      attendanceLogs: allowedAttendanceLogs
    };
  }, [groups, memberships, profiles, tasks, completions, comments, attendanceLogs, activeProfileId]);

  // Active User group memberships
  const activeUserMemberships = useMemo(() => {
    if (!activeProfileId) return [];
    return memberships.filter(m => m.userId === activeProfileId);
  }, [memberships, activeProfileId]);

  // List of Groups containing study active memberships
  const joinedGroups = useMemo(() => {
    const listGroupIds = new Set(activeUserMemberships.map(m => m.groupId));
    return groups.filter(g => listGroupIds.has(g.id));
  }, [groups, activeUserMemberships]);

  // Active group detail matching
  const activeGroup = useMemo(() => {
    if (!activeGroupId) return null;
    return groups.find(g => g.id === activeGroupId) || null;
  }, [groups, activeGroupId]);

  // Active user role within the selected group / class context
  const activeGroupMembership = useMemo(() => {
    if (!activeGroupId || !activeProfileId) return null;
    return memberships.find(m => m.groupId === activeGroupId && m.userId === activeProfileId) || null;
  }, [memberships, activeGroupId, activeProfileId]);

  // Is active user the leader/owner of the classroom
  const activeUserIsLeader = useMemo(() => {
    return activeGroupMembership?.role === 'leader';
  }, [activeGroupMembership]);

  const latestActiveTask = useMemo(() => {
    if (!activeDetailTask) return null;
    const rawTask = tasks.find(t => t.id === activeDetailTask.id) || activeDetailTask;
    if (rawTask && rawTask.isSynced && activeProfileId) {
      const comp = completions.find(c => c.classmateId === activeProfileId && c.taskId === rawTask.id);
      const isComp = comp ? comp.completed : false;
      const completedSubtaskIds = comp?.completedSubtaskIds || [];
      const decoratedSubtasks = rawTask.subtasks?.map(s => ({
        ...s,
        completed: isComp ? true : completedSubtaskIds.includes(s.id)
      })) || [];
      
      const subCount = decoratedSubtasks.length;
      const subCompCount = decoratedSubtasks.filter(s => s.completed).length;
      let status: 'todo' | 'in_progress' | 'completed' = 'todo';
      if (isComp) {
        status = 'completed';
      } else if (subCount > 0 && subCompCount > 0) {
        status = 'in_progress';
      }

      return {
        ...rawTask,
        completed: isComp,
        completedAt: isComp ? (comp?.completedAt || null) : null,
        subtasks: decoratedSubtasks,
        status: status
      };
    }
    return rawTask;
  }, [tasks, activeDetailTask, completions, activeProfileId]);

  const canModifyActiveTask = useMemo(() => {
    if (!latestActiveTask) return false;
    return activeUserIsLeader || latestActiveTask.createdById === activeProfileId || !latestActiveTask.isSynced;
  }, [latestActiveTask, activeUserIsLeader, activeProfileId]);

  // Synchronize/Reset submission forms whenever a new active detail task is focused
  useEffect(() => {
    if (!latestActiveTask) {
      setSubmissionSubjectiveAnswer('');
      setSubmissionObjectiveAnswers({});
      setSubmissionActiveTab('submit');
      setGradingScore('');
      setGradingFeedback('');
      setReviewClassmateId(null);
      return;
    }
    
    // Default sub tab
    const isLeader = activeUserIsLeader || latestActiveTask.createdById === activeProfileId;
    setSubmissionActiveTab(isLeader ? 'review' : 'submit');

    // Find if user already has a submission
    const mySub = submissions.find(s => s.taskId === latestActiveTask.id && s.classmateId === activeProfileId);
    if (mySub) {
      if (mySub.subjectiveAnswer) {
        setSubmissionSubjectiveAnswer(mySub.subjectiveAnswer);
      }
      if (mySub.objectiveAnswers) {
        setSubmissionObjectiveAnswers(mySub.objectiveAnswers);
      }
    } else {
      setSubmissionSubjectiveAnswer('');
      setSubmissionObjectiveAnswers({});
    }

    setGradingScore('');
    setGradingFeedback('');
    setReviewClassmateId(null);
  }, [latestActiveTask, submissions, activeProfileId, activeUserIsLeader]);

  // Permissions of active member
  const permissions = useMemo(() => {
    return {
      canSyncTasks: activeUserIsLeader || !!activeGroupMembership?.canSyncTasks,
      canAnnounce: activeUserIsLeader || !!activeGroupMembership?.canAnnounce
    };
  }, [activeUserIsLeader, activeGroupMembership]);

  // List of colleagues enrolled in active group loaded dynamically
  const groupMembersList = useMemo(() => {
    if (!activeGroupId) return [];
    const activeMems = memberships.filter(m => m.groupId === activeGroupId);
    return activeMems.map(mem => {
      const matchProfile = profiles.find(p => p.id === mem.userId);
      return {
        userId: mem.userId,
        name: matchProfile?.name || mem.userId,
        avatar: matchProfile?.avatar || BLANK_WHITE_PICTURE,
        tagline: matchProfile?.tagline || "Enrolled Student",
        role: mem.role,
        userRole: matchProfile?.role || "Student",
        canSyncTasks: mem.canSyncTasks,
        canAnnounce: mem.canAnnounce,
        equippedBadge: matchProfile?.equippedBadge
      };
    });
  }, [memberships, activeGroupId, profiles]);

  // Synchronize state to refs to prevent stale closures in real-time listeners
  const membershipsRef = useRef<GroupMembership[]>([]);
  const tasksRef = useRef<Task[]>([]);
  const groupsRef = useRef<Group[]>([]);
  const completionsRef = useRef<SyncedTaskCompletion[]>([]);
  const appLoadedAtRef = useRef<string>(new Date().toISOString());

  useEffect(() => {
    membershipsRef.current = memberships;
  }, [memberships]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  useEffect(() => {
    completionsRef.current = completions;
  }, [completions]);

  // Reusable notification trigger
  const triggerNotification = (item: {
    title: string;
    body: string;
    type: 'task' | 'announcement' | 'comment' | 'success';
    groupName?: string;
  }) => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { id, ...item }]);

    // Automatically remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);

    const formattedBody = `${item.groupName ? `[${item.groupName}] ` : ''}${item.body}`;
    let handledByBridge = false;
    const anyWindow = window as any;

    // 1. Android Kotlin Bridge Interface fallback (for actual native Compose notifications)
    const androidBridge = anyWindow.AndroidInterface || anyWindow.Android || anyWindow.AndroidNotification;
    if (androidBridge && typeof androidBridge.showNotification === 'function') {
      try {
        androidBridge.showNotification(item.title, formattedBody, item.type);
        handledByBridge = true;
        console.log("Notification sent successfully via Android Kotlin Bridge.");
      } catch (err) {
        console.warn("Android Kotlin Bridge call failed, falling back to Web API:", err);
      }
    }

    // 2. Standard Web/PWA Push Notification (works natively on Chrome for Android & Android PWAs)
    if (!handledByBridge && 'Notification' in window && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(item.title, {
              body: formattedBody,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              tag: 'campustrack-local-notification',
              renotify: true,
              vibrate: [150, 80, 150],
              data: {
                url: '/'
              }
            });
          }).catch(err => {
            console.warn("ServiceWorker ready showNotification failed, trying fallback:", err);
            new Notification(item.title, {
              body: formattedBody,
              icon: '/favicon.ico'
            });
          });
        } else {
          new Notification(item.title, {
            body: formattedBody,
            icon: '/favicon.ico'
          });
        }
      } catch (err) {
        console.warn("Could not dispatch HTML5 Notification:", err);
      }
    }
  };

  // Helper to convert VAPID key
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // Synchronize Push Subscription with Backend
  const syncPushSubscription = useCallback(async (registration: ServiceWorkerRegistration, userId: string) => {
    try {
      // 1. Fetch VAPID public key
      const res = await fetch('/api/push/vapid-public-key');
      if (!res.ok) throw new Error('Failed to fetch VAPID public key');
      const { publicKey } = await res.json();

      // 2. Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // 3. Register on backend
      const regRes = await fetch('/api/push/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subscription })
      });

      if (!regRes.ok) throw new Error('Failed to register subscription with server');
      console.log('Successfully registered push subscription with backend.');
    } catch (err) {
      console.warn('Push subscription synchronization failed:', err);
    }
  }, []);

  const toggleBrowserNotifications = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      alert("Push notifications are not supported in this browser or environment.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setBrowserNotificationGranted(true);
        
        // Find or wait for active service worker
        const reg = await navigator.serviceWorker.ready;
        const storedUserId = activeProfileId || localStorage.getItem('studysync_user_id');
        if (storedUserId) {
          await syncPushSubscription(reg, storedUserId);
        }

        triggerNotification({
          title: "Notifications Activated! 🎉",
          body: "Real-time push notifications are now enabled on your Android phone/browser.",
          type: 'success'
        });
      } else {
        setBrowserNotificationGranted(false);
      }
    } catch (err) {
      console.error("Error enabling notifications:", err);
    }
  };

  // Synchronize with the server-side reference clock on app mount to prevent streak tampering
  useEffect(() => {
    syncServerTime(getApiUrl);
  }, [getApiUrl]);

  // Service Worker & Push Notification Auto-Registration Hook
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(async (reg) => {
          console.log('Service Worker Registered successfully:', reg);
          
          const storedUserId = activeProfileId || localStorage.getItem('studysync_user_id');
          if (Notification.permission === 'granted' && storedUserId) {
            // Wait for service worker to be ready to synchronize
            const readyReg = await navigator.serviceWorker.ready;
            syncPushSubscription(readyReg, storedUserId);
          }
        })
        .catch(err => {
          console.error('Service Worker registration failed:', err);
        });
    }
  }, [activeProfileId, syncPushSubscription]);

  // Real-time Firestore subscriptions for complete reactive database
  useEffect(() => {
    const storedUserId = activeProfileId || localStorage.getItem('studysync_user_id');
    if (!storedUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubs: (() => void)[] = [];

    try {
      // 1. Subscribe to Current User's Profile
      const unsubProfiles = onSnapshot(doc(db, 'profiles', storedUserId), (docSnap) => {
        if (docSnap.exists()) {
          const myProfile = { id: docSnap.id, ...docSnap.data() } as StudentProfile;
          setProfiles([myProfile]);
          checkAndUpdateLoginStreak(myProfile);
        }
        setLoading(false);
      }, err => {
        console.warn("Profiles subscription error:", err);
        setLoading(false);
      });
      unsubs.push(unsubProfiles);

      // 2. Subscribe to Groups (all signed-in users can list groups)
      const unsubGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
        const list: Group[] = [];
        snapshot.forEach(docSnap => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Group);
        });
        setGroups(list);
      }, err => console.warn("Groups subscription error:", err));
      unsubs.push(unsubGroups);

      // 3. Subscribe to My Own Memberships
      const unsubMemberships = onSnapshot(query(collection(db, 'groupMemberships'), where('userId', '==', storedUserId)), (snapshot) => {
        const list: GroupMembership[] = [];
        snapshot.forEach(docSnap => {
          list.push({ id: docSnap.id, ...docSnap.data() } as GroupMembership);
        });
        setMemberships(list);
      }, err => console.warn("Memberships subscription error:", err));
      unsubs.push(unsubMemberships);

      // 4. Subscribe to My Created Tasks
      const unsubCreatedTasks = onSnapshot(query(collection(db, 'tasks'), where('createdById', '==', storedUserId)), (snapshot) => {
        const list: Task[] = [];
        snapshot.forEach(docSnap => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Task);
        });
        setCreatedTasks(list);
      }, err => console.warn("Created Tasks subscription error:", err));
      unsubs.push(unsubCreatedTasks);

      // 5. Subscribe to Tasks Assigned to Me
      const unsubAssignedTasks = onSnapshot(query(collection(db, 'tasks'), where('classmateId', '==', storedUserId)), (snapshot) => {
        const list: Task[] = [];
        snapshot.forEach(docSnap => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Task);
        });
        setAssignedTasks(list);
      }, err => console.warn("Assigned Tasks subscription error:", err));
      unsubs.push(unsubAssignedTasks);

      // 6. Subscribe to My Own Completions
      const unsubCompletions = onSnapshot(query(collection(db, 'completions'), where('classmateId', '==', storedUserId)), (snapshot) => {
        const list: SyncedTaskCompletion[] = [];
        snapshot.forEach(docSnap => {
          list.push({ id: docSnap.id, ...docSnap.data() } as SyncedTaskCompletion);
        });
        setMyCompletions(list);
      }, err => console.warn("Completions subscription error:", err));
      unsubs.push(unsubCompletions);

      // 7. Subscribe to My Own Attendance Logs
      const unsubAttendance = onSnapshot(query(collection(db, 'attendance_logs'), where('classmateId', '==', storedUserId)), (snapshot) => {
        const list: AttendanceLog[] = [];
        snapshot.forEach(docSnap => {
          list.push({ id: docSnap.id, ...docSnap.data() } as AttendanceLog);
        });
        setMyAttendanceLogs(list);
      }, err => console.warn("Attendance subscription error:", err));
      unsubs.push(unsubAttendance);

      // 8. Subscribe to My Own Task Submissions
      const unsubSubmissions = onSnapshot(query(collection(db, 'taskSubmissions'), where('classmateId', '==', storedUserId)), (snapshot) => {
        const list: TaskSubmission[] = [];
        snapshot.forEach(docSnap => {
          list.push({ id: docSnap.id, ...docSnap.data() } as TaskSubmission);
        });
        setMySubmissions(list);
      }, err => console.warn("Task submissions subscription error:", err));
      unsubs.push(unsubSubmissions);

    } catch (err) {
      console.error("Failed to initialize Firestore live listeners:", err);
      setLoading(false);
    }

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [activeProfileId]);

  const membershipsJoined = useMemo(() => {
    return memberships
      .filter(m => m.userId === activeProfileId)
      .map(m => m.groupId)
      .join(',');
  }, [memberships, activeProfileId]);

  const classmateIdsJoined = useMemo(() => {
    const storedUserId = activeProfileId || localStorage.getItem('studysync_user_id');
    if (!storedUserId || !activeGroupId) return '';
    const activeMems = memberships.filter(m => m.groupId === activeGroupId);
    return activeMems.map(m => m.userId).filter(uid => uid !== storedUserId).sort().join(',');
  }, [memberships, activeGroupId, activeProfileId]);

  // Segmented subscriptions for related records depending on current user context (Classrooms, active tasks, active groups)

  // A. Subscribe to classmate profiles for the active group
  useEffect(() => {
    const storedUserId = activeProfileId || localStorage.getItem('studysync_user_id');
    if (!storedUserId || !activeGroupId || !classmateIdsJoined) return;

    const classmateIds = classmateIdsJoined.split(',').filter(Boolean);
    if (classmateIds.length === 0) return;

    const q = query(collection(db, 'profiles'), where('id', 'in', classmateIds.slice(0, 30)));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: StudentProfile[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as StudentProfile);
      });
      setProfiles(prev => {
        const filtered = prev.filter(p => p.id === storedUserId || !classmateIds.includes(p.id));
        const myProfile = filtered.find(p => p.id === storedUserId);
        const nextList = myProfile ? [myProfile, ...list] : list;
        if (prev.length === nextList.length && prev.every((val, index) => val.id === nextList[index].id)) {
          return prev;
        }
        return nextList;
      });
    }, err => {
      console.warn("Classmate profiles subscription error:", err);
    });

    return () => unsub();
  }, [activeGroupId, classmateIdsJoined, activeProfileId]);

  // B. Subscribe to all memberships of groups we are in
  useEffect(() => {
    const storedUserId = activeProfileId || localStorage.getItem('studysync_user_id');
    if (!storedUserId || !membershipsJoined) return;

    const myGroupIds = membershipsJoined.split(',').filter(Boolean);
    if (myGroupIds.length === 0) return;

    const q = query(collection(db, 'groupMemberships'), where('groupId', 'in', myGroupIds.slice(0, 30)));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: GroupMembership[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as GroupMembership);
      });
      setMemberships(prev => {
        const myOwn = prev.filter(m => m.userId === storedUserId);
        const otherMems = list.filter(m => m.userId !== storedUserId);
        const isSame = prev.length === (myOwn.length + otherMems.length) &&
          myOwn.every(m => prev.some(pm => pm.id === m.id)) &&
          otherMems.every(m => prev.some(pm => pm.id === m.id));
        if (isSame) return prev;
        return [...myOwn, ...otherMems];
      });
    }, err => {
      console.warn("Colleague memberships subscription error:", err);
    });

    return () => unsub();
  }, [membershipsJoined, activeProfileId]);

  // C. Subscribe to Announcements of groups we belong to, with notification triggers
  useEffect(() => {
    const storedUserId = activeProfileId || localStorage.getItem('studysync_user_id');
    if (!storedUserId || !membershipsJoined) {
      setAnnouncements([]);
      return;
    }

    const myGroupIds = membershipsJoined.split(',').filter(Boolean);
    if (myGroupIds.length === 0) {
      setAnnouncements([]);
      return;
    }

    const q = query(collection(db, 'announcements'), where('groupId', 'in', myGroupIds.slice(0, 30)));
    let isInitialAnnouncements = true;
    const unsub = onSnapshot(q, (snapshot) => {
      const list: Announcement[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Announcement);
      });
      setAnnouncements(list);

      if (!isInitialAnnouncements) {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data() as Announcement;
            const isNew = data.createdAt && (data.createdAt > appLoadedAtRef.current);
            if (isNew && data.userId !== storedUserId) {
              const group = groupsRef.current.find(g => g.id === data.groupId);
              triggerNotification({
                title: `${data.userName || 'Someone'} posted an announcement 📢`,
                body: data.content || "Check the class announcement board.",
                type: 'announcement',
                groupName: group ? group.name : undefined
              });
            }
          }
        });
      }
      isInitialAnnouncements = false;
    }, err => {
      console.warn("Announcements subscription error:", err);
    });

    return () => unsub();
  }, [membershipsJoined, activeProfileId]);

  // D. Subscribe to Tasks of groups we belong to, with notification triggers
  useEffect(() => {
    const storedUserId = activeProfileId || localStorage.getItem('studysync_user_id');
    if (!storedUserId || !membershipsJoined) {
      setGroupTasks([]);
      return;
    }

    const myGroupIds = membershipsJoined.split(',').filter(Boolean);
    if (myGroupIds.length === 0) {
      setGroupTasks([]);
      return;
    }

    const q = query(
      collection(db, 'tasks'),
      where('isSynced', '==', true),
      where('groupId', 'in', myGroupIds.slice(0, 30))
    );
    let isInitialTasks = true;
    const unsub = onSnapshot(q, (snapshot) => {
      const list: Task[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Task);
      });
      setGroupTasks(list);

      if (!isInitialTasks) {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data() as Task;
            
            // Determine task creation time (from createdAt or fallback parsed from ID)
            const taskCreatedAt = data.createdAt || (() => {
              const parts = change.doc.id.split('-');
              if (parts[1]) {
                const ms = parseInt(parts[1], 10);
                if (!isNaN(ms)) return new Date(ms).toISOString();
              }
              return undefined;
            })();

            const isNew = taskCreatedAt && (taskCreatedAt > appLoadedAtRef.current);
            const isCompleted = data.completed || 
              (data.status === 'completed') || 
              (data.isSynced ? !!completionsRef.current.find(c => c.classmateId === storedUserId && c.taskId === data.id)?.completed : false);

            if (isNew && !isCompleted && data.createdById !== storedUserId) {
              const group = groupsRef.current.find(g => g.id === data.groupId);
              triggerNotification({
                title: `New Task published 📝`,
                body: data.title || "A new task has been assigned to your group.",
                type: 'task',
                groupName: group ? group.name : undefined
              });
            }
          }
        });
      }
      isInitialTasks = false;
    }, err => {
      console.warn("Group tasks subscription error:", err);
    });

    return () => unsub();
  }, [membershipsJoined, activeProfileId]);

  // E. Subscribe to Task Comments for the active detail task, with notification triggers
  useEffect(() => {
    const storedUserId = activeProfileId || localStorage.getItem('studysync_user_id');
    if (!storedUserId || !activeDetailTask?.id) {
      setComments([]);
      return;
    }
    const q = query(collection(db, 'taskComments'), where('taskId', '==', activeDetailTask.id));
    let isInitialComments = true;
    const unsub = onSnapshot(q, (snapshot) => {
      const list: TaskComment[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as TaskComment);
      });
      setComments(list);

      if (!isInitialComments) {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data() as TaskComment;
            const isNew = data.createdAt && (data.createdAt > appLoadedAtRef.current);
            if (isNew && data.userId !== storedUserId) {
              const task = tasksRef.current.find(t => t.id === data.taskId);
              if (task) {
                const isTaskCompleted = task.completed || 
                  (task.status === 'completed') || 
                  (task.isSynced ? !!completionsRef.current.find(c => c.classmateId === storedUserId && c.taskId === task.id)?.completed : false);

                if (!isTaskCompleted) {
                  const group = groupsRef.current.find(g => g.id === task.groupId);
                  triggerNotification({
                    title: `New Comment on: ${task.title} 💬`,
                    body: `${data.userName || 'Someone'}: ${data.content || 'New comment.'}`,
                    type: 'comment',
                    groupName: group ? group.name : undefined
                  });
                }
              }
            }
          }
        });
      }
      isInitialComments = false;
    }, err => {
      console.warn("Task comments subscription error:", err);
    });
    return () => unsub();
  }, [activeDetailTask?.id, activeProfileId]);

  // F. Subscribe to Completions for the active detail task
  useEffect(() => {
    if (!activeDetailTask?.id) {
      setActiveTaskCompletions([]);
      return;
    }
    const q = query(collection(db, 'completions'), where('taskId', '==', activeDetailTask.id));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: SyncedTaskCompletion[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as SyncedTaskCompletion);
      });
      setActiveTaskCompletions(list);
    }, err => {
      console.warn("Active task completions subscription error:", err);
    });
    return () => unsub();
  }, [activeDetailTask?.id]);

  // G. Subscribe to Task Submissions for the active detail task
  useEffect(() => {
    if (!activeDetailTask?.id) {
      setActiveTaskSubmissions([]);
      return;
    }
    const q = query(collection(db, 'taskSubmissions'), where('taskId', '==', activeDetailTask.id));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: TaskSubmission[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as TaskSubmission);
      });
      setActiveTaskSubmissions(list);
    }, err => {
      console.warn("Active task submissions subscription error:", err);
    });
    return () => unsub();
  }, [activeDetailTask?.id]);

  // H. Subscribe to group attendance logs for Class Analytics
  useEffect(() => {
    const storedUserId = activeProfileId || localStorage.getItem('studysync_user_id');
    if (!storedUserId || !activeGroupId) {
      setGroupAttendanceLogs([]);
      return;
    }
    const q = query(collection(db, 'attendance_logs'), where('groupId', '==', activeGroupId));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: AttendanceLog[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as AttendanceLog);
      });
      setGroupAttendanceLogs(list);
    }, err => {
      console.warn("Group attendance logs subscription error:", err);
    });
    return () => unsub();
  }, [activeGroupId, activeProfileId]);

  // I. Subscribe to all completions of synced tasks in the active group for the classroom leaderboard
  useEffect(() => {
    const storedUserId = activeProfileId || localStorage.getItem('studysync_user_id');
    if (!storedUserId || !activeGroupId) {
      setGroupCompletions([]);
      return;
    }

    const syncTasks = tasks.filter(t => t.groupId === activeGroupId && t.isSynced);
    const syncTaskIds = syncTasks.map(t => t.id);

    if (syncTaskIds.length === 0) {
      setGroupCompletions([]);
      return;
    }

    // Firestore limits IN queries to 30 items
    const q = query(
      collection(db, 'completions'),
      where('taskId', 'in', syncTaskIds.slice(0, 30))
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: SyncedTaskCompletion[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as SyncedTaskCompletion);
      });
      setGroupCompletions(list);
    }, err => {
      console.warn("Group completions subscription error:", err);
    });

    return () => unsub();
  }, [activeGroupId, tasks, activeProfileId]);

  // Backward compatibility mock
  const fetchWorkspaceData = async (_silent = false, _customUserId?: string | null) => {
    // No-op because Firestore subscriptions handle data loading reactively in real-time!
    console.log("fetchWorkspaceData no-op called (real-time subscriptions are active)");
  };

  // Listen to Google OAuth state changed
  useEffect(() => {
    const unsub = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setNeedsGoogleAuth(false);

        // If logged in via Firebase Auth, auto-set active profile ID
        setActiveProfileId(user.uid);
        localStorage.setItem('studysync_user_id', user.uid);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        // Securely force active profile to null if not authenticated
        setActiveProfileId(null);
        localStorage.removeItem('studysync_user_id');
      }
    );
    return () => unsub();
  }, []);

  // Update profile inputs state when activeProfile loads
  useEffect(() => {
    if (activeProfile) {
      setEditName(activeProfile.name);
      setEditTagline(activeProfile.tagline);
      setEditAvatar(activeProfile.avatar);
      setEditGender(activeProfile.gender || 'male');
      setEditAutoDeleteCompleted(activeProfile.autoDeleteCompleted ?? false);
      setEditAutoDeleteInterval(activeProfile.autoDeleteInterval || 'immediate');
      setEditAppMode(activeProfile.appMode || 'Student');
      setEditUserRole(activeProfile.role || 'Student');
    }
  }, [activeProfile]);

  // Auto-trigger tutorial on first-time login
  useEffect(() => {
    if (activeProfileId && activeProfile?.onboardingCompleted === true) {
      const tutorialCompleted = localStorage.getItem('tasktrack_tutorial_completed');
      if (tutorialCompleted !== 'true') {
        setShowTutorial(true);
      }
    }
  }, [activeProfileId, activeProfile?.onboardingCompleted]);

  // Auto-trigger interactive pointing guide on first-time login
  useEffect(() => {
    if (activeProfileId && activeProfile?.onboardingCompleted === true && !showTutorial) {
      const guideCompleted = localStorage.getItem('tasktrack_interactive_guide_completed');
      if (guideCompleted !== 'true') {
        setGuideStep(0);
      }
    }
  }, [activeProfileId, activeProfile?.onboardingCompleted, showTutorial]);

  // Handle Edit/Customize Profile Submission
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfileId || !editName.trim()) return;
    try {
      // Save custom API Server URL if running in APK / Offline / WebView
      if (serverApiUrl.trim()) {
        localStorage.setItem('studysync_server_api_url', serverApiUrl.trim());
      } else {
        localStorage.removeItem('studysync_server_api_url');
      }

      await updateProfile(activeProfileId, {
        name: editName.trim(),
        tagline: editTagline.trim(),
        avatar: editAvatar,
        autoDeleteCompleted: editAutoDeleteCompleted,
        autoDeleteInterval: editAutoDeleteInterval,
        appMode: editUserRole,
        role: editUserRole
      });
      // Save custom color scheme as well
      localStorage.setItem('studysync_custom_color', customColor);

      setIsEditProfileModalOpen(false);
      setSettingsSaveSuccess(true);
      setTimeout(() => setSettingsSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to update settings.");
    }
  };

  // Google GAPI picker script load helper
  const loadPickerAPI = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const checkState = () => {
        if ((window as any).gapi && (window as any).google) {
          (window as any).gapi.load('picker', {
            callback: () => {
              resolve();
            },
            onerror: () => {
              reject(new Error('Google Picker API load failed'));
            }
          });
        } else {
          setTimeout(checkState, 150);
        }
      };
      checkState();
    });
  };

  // Launch Google Picker widget
  const openGooglePicker = async () => {
    let tokenToUse = googleToken;
    if (!tokenToUse) {
      if (confirm("Accessing Google Drive files requires a connected Google account. Launch authentication popup?")) {
        try {
          const res = await googleSignIn();
          if (res) {
            tokenToUse = res.accessToken;
            setGoogleUser(res.user);
            setGoogleToken(res.accessToken);
            setNeedsGoogleAuth(false);
          } else {
            return;
          }
        } catch {
          return;
        }
      } else {
        return;
      }
    }

    try {
      await loadPickerAPI();
      
      const pickerOrigin =
        window.location.ancestorOrigins &&
        window.location.ancestorOrigins.length > 0
          ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
          : window.location.origin;

      const picker = new (window as any).google.picker.PickerBuilder()
        .addView((window as any).google.picker.ViewId.DOCS)
        .setOAuthToken(tokenToUse)
        .setCallback((data: any) => {
          if (data.action === (window as any).google.picker.Action.PICKED) {
            const doc = data.docs[0];
            const newAttachment: Attachment = {
              id: doc.id,
              name: doc.name,
              url: doc.url || `https://docs.google.com/file/d/${doc.id}/edit`,
              mimeType: doc.mimeType,
              source: 'google-drive'
            };
            setComposerAttachments(prev => [...prev, newAttachment]);
          }
        })
        .setOrigin(pickerOrigin)
        .build();
      picker.setVisible(true);
    } catch (err: any) {
      alert("Failed to load Google Picker: " + err.message);
    }
  };

  // Attach a local study file (via Base64 storage in cloud database)
  const handleLocalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    const isImage = file.type.startsWith('image/');
    if (!isImage && file.size > 2.5 * 1024 * 1024) {
      alert("For swift sync and saving, local files uploaded must be smaller than 2.5MB.");
      return;
    }

    try {
      let base64Data = '';
      if (isImage) {
        base64Data = await compressImage(file);
      } else {
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });
      }

      const newAttachment: Attachment = {
        id: 'local-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name: file.name,
        url: base64Data,
        mimeType: file.type,
        source: 'local'
      };
      setComposerAttachments(prev => [...prev, newAttachment]);
    } catch (err: any) {
      console.error("Local file selection failed:", err);
    }
  };

  // Add inline attachment directly to an existing task card
  const handleAddInlineAttachment = async (task: Task, source: 'drive' | 'local') => {
    if (source === 'drive') {
      let tokenToUse = googleToken;
      if (!tokenToUse) {
        if (confirm("Attaching from Google Drive requires connecting your Google account. Connect now?")) {
          try {
            const res = await googleSignIn();
            if (res) {
              tokenToUse = res.accessToken;
              setGoogleUser(res.user);
              setGoogleToken(res.accessToken);
              setNeedsGoogleAuth(false);
            } else {
              return;
            }
          } catch {
            return;
          }
        } else {
          return;
        }
      }

      try {
        await loadPickerAPI();
        const pickerOrigin =
          window.location.ancestorOrigins &&
          window.location.ancestorOrigins.length > 0
            ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
            : window.location.origin;

        const picker = new (window as any).google.picker.PickerBuilder()
          .addView((window as any).google.picker.ViewId.DOCS)
          .setOAuthToken(tokenToUse)
          .setCallback(async (data: any) => {
            if (data.action === (window as any).google.picker.Action.PICKED) {
              const doc = data.docs[0];
              const att: Attachment = {
                id: doc.id,
                name: doc.name,
                url: doc.url || `https://docs.google.com/file/d/${doc.id}/edit`,
                mimeType: doc.mimeType,
                source: 'google-drive'
              };
              
              const updatedAttachments = [...(task.attachments || []), att];
              await postUpdatedAttachments(task, updatedAttachments);
            }
          })
          .setOrigin(pickerOrigin)
          .build();
        picker.setVisible(true);
      } catch (err: any) {
        alert("Failed to load Google Picker: " + err.message);
      }
    } else {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isImage = file.type.startsWith('image/');
        if (!isImage && file.size > 2.5 * 1024 * 1025) {
          alert("For swift sync and saving, local files uploaded must be smaller than 2.5MB.");
          return;
        }

        try {
          let base64Data = '';
          if (isImage) {
            base64Data = await compressImage(file);
          } else {
            base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = (err) => reject(err);
              reader.readAsDataURL(file);
            });
          }

          const att: Attachment = {
            id: 'local-' + Date.now(),
            name: file.name,
            url: base64Data,
            mimeType: file.type,
            source: 'local'
          };
          const updatedAttachments = [...(task.attachments || []), att];
          await postUpdatedAttachments(task, updatedAttachments);
        } catch (err: any) {
          console.error("Local file attachment selection failed:", err);
        }
      };
      fileInput.click();
    }
  };

  const postUpdatedAttachments = async (task: Task, updatedAttachments: Attachment[]) => {
    try {
      await updateTask(task.id, { attachments: updatedAttachments });
    } catch (e) {
      console.error(e);
    }
  };

  // Sync state triggers
  const triggerStateReload = async () => {
    setSyncing(true);
    await fetchWorkspaceData(true);
    setTimeout(() => setSyncing(false), 600);
  };

  // Handle Sign-In / Auth with Google
  const handleGoogleSignIn = async () => {
    setFormError(null);
    setFormSuccess(null);
    try {
      const res = await googleSignIn();
      if (!res) return;

      const { user, accessToken } = res;
      setGoogleUser(user);
      setGoogleToken(accessToken);
      setNeedsGoogleAuth(false);

      const uid = user.uid;

      // Check if profile exists in Firestore, else create it
      const profileRef = doc(db, 'profiles', uid);
      const profileSnap = await getDoc(profileRef);

      if (!profileSnap.exists()) {
        const _username = (user.email?.split('@')[0] || 'google_user_' + uid.substring(0, 5)).toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
        const newProfile: StudentProfile = {
          id: uid,
          name: user.displayName || 'Google Student',
          avatar: user.photoURL || BLANK_WHITE_PICTURE,
          tagline: 'Student via Google Auth',
          autoDeleteCompleted: false,
          autoDeleteInterval: 'immediate',
          appMode: 'Student',
          role: 'Student',
          onboardingCompleted: false,
          dailyLoginStreak: 1,
          lastLoginDate: new Date().toISOString().split('T')[0],
          studyStreak: 0,
          assignmentStreak: 0,
          badges: '[]'
        };
        // Save to Firestore
        await createProfile(newProfile);
      }

      setActiveProfileId(uid);
      localStorage.setItem('studysync_user_id', uid);
      setFormError(null);
    } catch (err: any) {
      console.error("Google sign in failed:", err);
      setFormError(err.message || "Google authentication failed.");
    }
  };

  // Perform secure username/password login
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    const username = newUserId.trim().toLowerCase();
    if (!username || !signInPassword) {
      setFormError("Both username and password are required.");
      return;
    }

    try {
      setLoading(true);
      // Log in with email-mapped username in Firebase Auth
      const user = await emailSignIn(username, signInPassword);
      const uid = user.uid;

      setActiveProfileId(uid);
      localStorage.setItem('studysync_user_id', uid);
      setSignInPassword('');
      setFormError(null);
    } catch (err: any) {
      console.error("Sign in failed:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setFormError("Invalid username or password.");
      } else {
        setFormError(err.message || "Sign in failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Perform Register Profile
  const handleRegisterProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    const username = newUserId.trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
    if (!username || !newUserName.trim() || !signUpPassword) {
      setFormError("Username, Display Name, and Password are required!");
      return;
    }

    try {
      setLoading(true);
      // 1. Check if username is already taken in Firestore
      const q = query(collection(db, 'profiles'), where('username', '==', username));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        setFormError("Username is already taken. Please choose another one.");
        setLoading(false);
        return;
      }

      // 2. Register with Firebase Auth using virtual email
      const user = await emailSignUp(username, signUpPassword);
      const uid = user.uid;

      // 3. Create profile document
      const newProfile = {
        id: uid,
        username: username,
        name: newUserName.trim(),
        avatar: newUserAvatar || BLANK_WHITE_PICTURE,
        tagline: newUserTagline.trim() || 'Classroom Buddy',
        gender: regGender,
        securityQuestion: securityQuestion || "What is your favorite school subject?",
        securityAnswer: securityAnswer.trim().toLowerCase(),
        autoDeleteCompleted: false,
        autoDeleteInterval: 'immediate',
        appMode: regUserRole,
        role: regUserRole,
        onboardingCompleted: false,
        dailyLoginStreak: 1,
        lastLoginDate: new Date().toISOString().split('T')[0],
        studyStreak: 0,
        assignmentStreak: 0,
        badges: '[]'
      };

      await createProfile(newProfile as any);

      // Success, authenticate locally
      setActiveProfileId(uid);
      localStorage.setItem('studysync_user_id', uid);
      
      // Reset inputs
      setNewUserId('');
      setNewUserName('');
      setNewUserTagline('');
      setSignUpPassword('');
      setSecurityAnswer('');
      setRegAppMode('Student');
      setRegUserRole('Student');
    } catch (err: any) {
      console.error("Registration failed:", err);
      setFormError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  // Perform secure save of Onboarding Workspace role
  const handleSaveOnboarding = async () => {
    if (!activeProfileId) return;
    setSavingOnboarding(true);
    try {
      await updateProfile(activeProfileId, {
        role: selectedOnboardingRole,
        appMode: selectedOnboardingRole,
        onboardingCompleted: true
      });
      await triggerStateReload();
      setShowTutorial(true);
    } catch (err) {
      console.error("Failed to save onboarding workspace selection:", err);
    } finally {
      setSavingOnboarding(false);
    }
  };

  // Recover Password Step 1: Fetch Question from Server (still using API since it checks the database safely)
  const handleRecoverFetchQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    if (!recoveryUsername.trim()) {
      setFormError("Username is required to pull the recovery setup question.");
      return;
    }

    try {
      const resp = await fetch(getApiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: recoveryUsername.trim() })
      });

      const resData = await resp.json();
      if (!resp.ok) {
        setFormError(resData.error || "Recovery target username does not exist.");
        return;
      }

      setRecoveryQuestion(resData.securityQuestion);
      setRecoveryStep('answer');
    } catch {
      setFormError("Fetching authentication challenge question failed.");
    }
  };

  // Recover Password Step 2: Verify Answer and Reset Password via Server
  const handleRecoverSubmitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    if (!recoveryAnswerInput.trim() || !recoveryNewPassword) {
      setFormError("Both the challenge answer and your new password are required.");
      return;
    }

    try {
      const resp = await fetch(getApiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: recoveryUsername,
          securityAnswer: recoveryAnswerInput,
          newPassword: recoveryNewPassword
        })
      });

      const resData = await resp.json();
      if (!resp.ok) {
        setFormError(resData.error || "Incorrect security response. Verification stalled.");
        return;
      }

      setFormSuccess(resData.message || "Password successfully updated.");
      setRecoveryStep('done');
      setRecoveryAnswerInput('');
      setRecoveryNewPassword('');
    } catch {
      setFormError("Reset request transmission failed.");
    }
  };

  // Switch Active identity and store
  const _handleSwitchIdentity = async (id: string) => {
    setActiveProfileId(id);
    localStorage.setItem('studysync_user_id', id);
    setShowProfilePopover(false);

    // Find first group this new profile is enrolled in, and auto-switch to avoid empty state
    const firstGroupMem = memberships.find(m => m.userId === id);
    if (firstGroupMem) {
      setActiveGroupId(firstGroupMem.groupId);
      localStorage.setItem('studysync_group_id', firstGroupMem.groupId);
    } else {
      setActiveGroupId(null);
      localStorage.removeItem('studysync_group_id');
    }
    setActiveTab('tasks');
  };

  // Logout / clear local auth
  const handleLogout = () => {
    setActiveProfileId(null);
    localStorage.removeItem('studysync_user_id');
    setActiveGroupId(null);
    localStorage.removeItem('studysync_group_id');
    setShowProfilePopover(false);
    setActiveTab('tasks');
    googleLogout().catch(err => console.warn("Google logout error:", err));
  };

  // Perform fully authoritative server database wipe
  const _handleResetServerDatabase = async () => {
    try {
      setSyncing(true);
      if (activeProfileId) {
        await resetDatabase(activeProfileId);
      }

      // Completely clear physical browser local storage
      localStorage.clear();
      
      // Wipe React states cleanly
      setActiveProfileId(null);
      setActiveGroupId(null);
      setProfiles([]);
      setGroups([]);
      setMemberships([]);
      setAnnouncements([]);
      setComments([]);
      setTasks([]);
      setCompletions([]);
      
      setActiveTab('tasks');
      setIsResetConfirmOpen(false);
    } catch (err: any) {
      console.error("Database wipe failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  // Perform Create workspace group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!newGroupName.trim() || !activeProfileId) {
      setFormError("Please fill out the Class wide name.");
      return;
    }

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

      // Automatically join and set as active session group
      setActiveGroupId(groupId);
      localStorage.setItem('studysync_group_id', groupId);

      // Reset
      setNewGroupName('');
      setNewGroupDesc('');
    } catch (err: any) {
      setFormError(err.message || "Group establish error.");
    }
  };

  // Perform Join study group via invitation code
  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!joinCode.trim() || !activeProfileId) {
      setFormError("Invite authentication code is required.");
      return;
    }

    try {
      const groupId = joinCode.trim();
      const group = await getGroupById(groupId);
      if (!group) {
        setFormError("Classrooms join code is invalid.");
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
      setJoinCode('');
    } catch {
      setFormError("Connection failure during join context.");
    }
  };

  // Update classmate enrollment capabilities (Owner only)
  const toggleMemberPermissions = async (userId: string, targetKey: 'canSyncTasks' | 'canAnnounce', currentVal: boolean) => {
    if (!activeGroupId || !activeProfileId) return;
    try {
      const membershipId = `${activeGroupId}-${userId}`;
      await updateMembership(membershipId, { [targetKey]: !currentVal });
    } catch (e) {
      console.error(e);
    }
  };

  // Remove classmate enrollment (Owner only)
  const handleRemoveMember = async (userId: string) => {
    if (!activeGroupId || !activeProfileId) return;
    if (window.confirm("Are you sure you want to remove this classmate from the classroom?")) {
      try {
        const membershipId = `${activeGroupId}-${userId}`;
        await deleteMembership(membershipId);
      } catch (e) {
        console.error(e);
        alert("Failed to remove student.");
      }
    }
  };

  // Post Announcements with optional image attachment
  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.trim() && !announcementImage) return;
    if (!activeGroupId || !activeProfileId) return;

    try {
      const myProfile = profiles.find(p => p.id === activeProfileId);
      const newAnn: Announcement = {
        id: 'ann-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
        groupId: activeGroupId,
        userId: activeProfileId,
        userName: myProfile?.name || 'Student',
        userAvatar: myProfile?.avatar || BLANK_WHITE_PICTURE,
        content: newAnnouncement.trim(),
        createdAt: new Date().toISOString(),
        imageAttachment: announcementImage
      };

      await createAnnouncement(newAnn);

      setNewAnnouncement('');
      setAnnouncementImage(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Post Task Comment (direct assignment discussion)
  const handlePostComment = async (taskId: string) => {
    if (!newCommentText.trim() && !newCommentImage) return;
    if (!activeProfileId) {
      alert("Sign-in to participate in study discussions.");
      return;
    }

    try {
      const myProfile = profiles.find(p => p.id === activeProfileId);
      const newComment: TaskComment = {
        id: 'comment-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
        taskId: taskId,
        userId: activeProfileId,
        userName: myProfile?.name || 'Student',
        userAvatar: myProfile?.avatar || BLANK_WHITE_PICTURE,
        content: newCommentText.trim(),
        createdAt: new Date().toISOString(),
        imageAttachment: newCommentImage
      };

      await createComment(newComment);

      setNewCommentText('');
      setNewCommentImage(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddNewSubtaskToList = (titleString: string) => {
    if (!titleString.trim()) return;
    const items = titleString
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    const newItems = items.map(title => ({
      id: 'sub-' + Math.random().toString(36).substring(2, 6),
      title,
      completed: false
    }));

    setNewTaskSubtasksList(prev => [...prev, ...newItems]);
    setNewTaskSubtaskInputValue('');
  };

  // Publish dynamic Task Event (Synced OR Private)
  const handlePublishTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPublishingTask) return;
    if (!newTaskTitle.trim() || !activeProfileId || !activeGroupId) {
      alert("Active study workspace and title name details are required.");
      return;
    }

    setIsPublishingTask(true);

    const rawSubtasksParsed = newTaskSubtasksRaw
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => ({ id: 'sub-' + Math.random().toString(36).substring(2, 6), title: s, completed: false }));

    const subtasksArray = [...newTaskSubtasksList, ...rawSubtasksParsed];

    try {
      const myProfile = profiles.find(p => p.id === activeProfileId);
      const taskId = 'task-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5);
      
      let finalDesc = newTaskDesc.trim();
      if (newTaskScope === 'personal') {
        const durLabel = personalEstDuration === '15m' ? '⏱️ 15 Mins' : personalEstDuration === '30m' ? '⏱️ 30 Mins' : personalEstDuration === '1h' ? '⏱️ 1 Hour' : '⏱️ 2+ Hours';
        const recLabel = personalRecurrence === 'daily' ? '🔁 Daily Habit' : personalRecurrence === 'weekly' ? '🔁 Weekly Review' : '📌 One-off Task';
        finalDesc = `${finalDesc}\n\n[Planner Settings]\n${durLabel} • ${recLabel}`.trim();
      }

      const newTask: Task = {
        id: taskId,
        title: newTaskTitle.trim(),
        description: finalDesc,
        dueDate: newTaskScope === 'synced' 
          ? (newTaskDueDate || new Date(Date.now() + 3*24*60*60*1000).toISOString().split('T')[0])
          : (newTaskDueDate || new Date(Date.now() + 2*24*60*60*1000).toISOString().split('T')[0]),
        priority: newTaskPriority,
        category: newTaskCategory.trim(),
        isSynced: newTaskScope === 'synced',
        createdBy: myProfile?.name || 'Student',
        createdById: activeProfileId,
        completed: false,
        classmateId: newTaskScope === 'synced' ? null : activeProfileId,
        groupId: activeGroupId,
        createdAt: new Date().toISOString(),
        attachments: composerAttachments,
        subtasks: subtasksArray,
        points: newTaskScope === 'synced' ? (newTaskPoints || 50) : undefined,
        
        // Asynchronous Task submission parameters
        submissionType: newTaskScope === 'synced' ? newTaskSubmissionType : 'none',
        maxScore: newTaskScope === 'synced' && newTaskSubmissionType !== 'none' ? newTaskMaxScore : undefined,
        subjectivePrompt: newTaskScope === 'synced' && newTaskSubmissionType === 'subjective' ? newTaskSubjectivePrompt : undefined,
        objectiveQuestions: newTaskScope === 'synced' && newTaskSubmissionType === 'objective' ? newTaskObjectiveQuestions : undefined
      };

      await createTask(newTask);

      // Reset Form fields
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskDueDate('');
      setNewTaskSubtasksRaw('');
      setNewTaskSubtasksList([]);
      setNewTaskSubtaskInputValue('');
      setNewTaskPriority('medium');
      setNewTaskPoints(50);
      setComposerAttachments([]);
      setNewTaskSubmissionType('none');
      setNewTaskMaxScore(100);
      setNewTaskSubjectivePrompt('');
      setNewTaskObjectiveQuestions([]);
      setPersonalEstDuration('30m');
      setPersonalRecurrence('one-off');
      setActiveTab('tasks');
    } catch (err) {
      console.error(err);
    } finally {
      setIsPublishingTask(false);
    }
  };

  // Submit Asynchronous Student Task Work
  const handleSubmitAsynchronousTask = async (task: Task) => {
    if (!activeProfileId) return;
    const myProfile = profiles.find(p => p.id === activeProfileId);
    
    let submissionScore: number | undefined = undefined;
    let submissionStatus: 'pending' | 'graded' = 'pending';

    // 1. Calculate Score for Objective task
    if (task.submissionType === 'objective') {
      const questions = task.objectiveQuestions || [];
      if (questions.length === 0) {
        alert("This objective task does not contain any questions.");
        return;
      }
      
      // Check answers
      let correctCount = 0;
      questions.forEach(q => {
        if (submissionObjectiveAnswers[q.id] === q.correctAnswer) {
          correctCount++;
        }
      });
      
      const maxScore = task.maxScore || 100;
      submissionScore = Math.round((correctCount / questions.length) * maxScore);
      submissionStatus = 'graded';
    }

    const subId = `${activeProfileId}-${task.id}`;
    const newSubmission: TaskSubmission = {
      id: subId,
      taskId: task.id,
      classmateId: activeProfileId,
      classmateName: myProfile?.name || 'Student',
      classmateAvatar: myProfile?.avatar || '',
      submittedAt: new Date().toISOString(),
      submissionType: task.submissionType as 'subjective' | 'objective',
      subjectiveAnswer: task.submissionType === 'subjective' ? submissionSubjectiveAnswer : undefined,
      objectiveAnswers: task.submissionType === 'objective' ? submissionObjectiveAnswers : undefined,
      score: submissionScore,
      status: submissionStatus
    };

    try {
      await saveTaskSubmission(newSubmission);
      
      // Auto-save Synced Completion
      const newComp: SyncedTaskCompletion = {
        classmateId: activeProfileId,
        taskId: task.id,
        completed: true,
        completedAt: new Date().toISOString()
      };
      await saveCompletion(newComp);
      
      alert(task.submissionType === 'objective' 
        ? `Quiz submitted! Your automated score is: ${submissionScore} / ${task.maxScore || 100}` 
        : "Assignment successfully submitted! Waiting for teacher's grading review."
      );
    } catch (err: any) {
      console.error("Task submission failed:", err);
      alert("Submission error: " + err.message);
    }
  };

  // Grade student's subjective submission
  const handleGradeAsynchronousTask = async (task: Task, studentId: string) => {
    if (!activeProfileId) return;
    const teacherProfile = profiles.find(p => p.id === activeProfileId);
    const subId = `${studentId}-${task.id}`;
    const existingSub = submissions.find(s => s.id === subId);
    
    if (!existingSub) {
      alert("No active submission record found for this student.");
      return;
    }

    const scoreNum = parseFloat(gradingScore);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > (task.maxScore || 100)) {
      alert(`Please input a valid score between 0 and the max score of ${task.maxScore || 100}.`);
      return;
    }

    const updatedSub: TaskSubmission = {
      ...existingSub,
      score: scoreNum,
      status: 'graded',
      feedback: gradingFeedback.trim(),
      gradedBy: teacherProfile?.name || 'Teacher',
      gradedAt: new Date().toISOString()
    };

    try {
      await saveTaskSubmission(updatedSub);
      
      // Make sure there is a completions record saved for this student so it updates on leaderboard
      const studentComp: SyncedTaskCompletion = {
        classmateId: studentId,
        taskId: task.id,
        completed: true,
        completedAt: new Date().toISOString()
      };
      await saveCompletion(studentComp);
      
      alert(`Submission graded successfully! Awarded score: ${scoreNum} / ${task.maxScore || 100}`);
      setGradingScore('');
      setGradingFeedback('');
      setReviewClassmateId(null);
    } catch (err: any) {
      console.error("Grading failed:", err);
      alert("Grading error: " + err.message);
    }
  };

  // Perform Task Archive/Unarchive Action
  const handleToggleArchive = async (taskId: string, isArchived: boolean) => {
    try {
      await updateTask(taskId, { isArchived });
    } catch (err) {
      console.error("Archive operation failed:", err);
    }
  };

  // Trigger manual or automatic archive database purging
  const handlePurgeArchive = async (forceAll: boolean) => {
    if (!activeProfileId) return;
    try {
      const batch = writeBatch(db);
      const q = query(collection(db, 'tasks'), where('createdById', '==', activeProfileId), where('isArchived', '==', true));
      const snap = await getDocs(q);
      
      const now = new Date();
      snap.forEach(d => {
        const data = d.data() as Task;
        if (forceAll) {
          batch.delete(d.ref);
        } else if (activeProfile?.autoDeleteCompleted) {
          const interval = activeProfile.autoDeleteInterval || 'immediate';
          if (interval === 'immediate') {
            batch.delete(d.ref);
          } else {
            const completedAtStr = data.completedAt || data.dueDate;
            if (completedAtStr) {
              const compDate = new Date(completedAtStr);
              const diffTime = now.getTime() - compDate.getTime();
              const diffDays = diffTime / (1000 * 60 * 60 * 24);
              const limitDays = parseInt(interval, 10);
              if (!isNaN(limitDays) && diffDays >= limitDays) {
                batch.delete(d.ref);
              }
            }
          }
        }
      });
      await batch.commit();
    } catch (err) {
      console.error("Purge failed:", err);
    }
  };

  // Toggle checklist, subtasks, or master completion stats
  const toggleTaskCompleteness = async (task: Task, isSubtaskCall = false, subtaskId?: string, subtaskPrevVal?: boolean) => {
    if (!activeProfileId) return;
    hasJustInteractedRef.current = true;
    try {
      const comp = completions.find(c => c.classmateId === activeProfileId && c.taskId === task.id);
      const wasCompleted = task.isSynced 
        ? (comp ? comp.completed : false)
        : task.completed;

      if (task.isSynced) {
        const currentCompletedSubtaskIds = comp?.completedSubtaskIds || [];
        
        if (isSubtaskCall && subtaskId) {
          let updatedSubtaskIds = [...currentCompletedSubtaskIds];
          const isCurrentlyCompleted = currentCompletedSubtaskIds.includes(subtaskId);
          if (isCurrentlyCompleted) {
            updatedSubtaskIds = updatedSubtaskIds.filter(id => id !== subtaskId);
          } else {
            updatedSubtaskIds.push(subtaskId);
          }
          
          const allSubtaskIds = task.subtasks?.map(s => s.id) || [];
          const allSubComplete = allSubtaskIds.length > 0 && allSubtaskIds.every(id => updatedSubtaskIds.includes(id));
          
          const completion: SyncedTaskCompletion = {
            id: `${activeProfileId}-${task.id}`,
            classmateId: activeProfileId,
            taskId: task.id,
            completed: allSubComplete,
            completedAt: allSubComplete ? new Date().toISOString() : undefined,
            completedSubtaskIds: updatedSubtaskIds,
            status: allSubComplete ? 'completed' : (updatedSubtaskIds.length > 0 ? 'in_progress' : 'todo')
          };
          await saveCompletion(completion);
        } else {
          // Toggle overall classmates completion tracker for this synced task
          const nextVal = !wasCompleted;
          const allSubtaskIds = task.subtasks?.map(s => s.id) || [];
          const updatedSubtaskIds = nextVal ? allSubtaskIds : [];
          
          const completion: SyncedTaskCompletion = {
            id: `${activeProfileId}-${task.id}`,
            classmateId: activeProfileId,
            taskId: task.id,
            completed: nextVal,
            completedAt: nextVal ? new Date().toISOString() : undefined,
            completedSubtaskIds: updatedSubtaskIds,
            status: nextVal ? 'completed' : 'todo'
          };
          await saveCompletion(completion);
        }
      } else {
        // Local personal task
        if (isSubtaskCall && subtaskId) {
          const updatedSub = task.subtasks?.map(s => s.id === subtaskId ? { ...s, completed: !subtaskPrevVal } : s);
          const allSubComplete = updatedSub && updatedSub.length > 0 && updatedSub.every(s => s.completed);
          
          if (allSubComplete) {
            await updateTask(task.id, { 
              subtasks: updatedSub, 
              completed: true, 
              completedAt: new Date().toISOString(),
              isArchived: false, 
              status: 'completed' 
            });
          } else {
            await updateTask(task.id, { subtasks: updatedSub });
          }
        } else {
          const nextVal = !task.completed;
          const updatedSub = nextVal ? task.subtasks?.map(s => ({ ...s, completed: true })) : task.subtasks;
          await updateTask(task.id, { 
            subtasks: updatedSub, 
            completed: nextVal, 
            completedAt: nextVal ? new Date().toISOString() : null,
            isArchived: false, 
            status: nextVal ? 'completed' : 'todo' 
          });
        }
      }
      
      // Update submission streak on master task completion transition
      if (!wasCompleted && !isSubtaskCall && activeProfileId) {
        await checkAndUpdateSubmissionStreak();
        try {
          const today = getTodayString();
          // Check if there is already any attendance log for this student on this date
          const q = query(
            collection(db, 'attendance_logs'),
            where('classmateId', '==', activeProfileId),
            where('date', '==', today)
          );
          const snap = await getDocs(q);
          if (snap.empty) {
            await saveAttendanceLog({
              classmateId: activeProfileId,
              date: today,
              status: 'Present',
              subject: `Completed: ${task.title}`,
              groupId: task.groupId || activeGroupId || null
            });
            console.log(`Automatic attendance logged for completing task: ${task.title}`);
          } else {
            console.log(`Attendance already logged for today (${today}). Skipping duplicate.`);
          }
        } catch (err) {
          console.error("Failed to automatically log attendance on task completion:", err);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Interactive Delete event
  const handleDeleteTask = async (task: Task) => {
    if (!confirm(`Are you sure you want to delete "${task.title}"?`)) return;
    hasJustInteractedRef.current = true;
    try {
      await deleteTask(task.id);
    } catch (err) {
      console.error("Delete task failed:", err);
    }
  };

  // Manual Milestone Inline Addition Event
  const handleAddInlineMilestone = async (task: Task) => {
    const text = inlineMilestoneInput[task.id];
    if (!text || !text.trim() || !activeProfileId) return;

    try {
      const newSub = {
        id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: text.trim(),
        completed: false
      };
      const updatedSubtasks = [...(task.subtasks || []), newSub];
      await updateTask(task.id, { subtasks: updatedSubtasks });
      
      setInlineMilestoneInput(prev => ({ ...prev, [task.id]: '' }));
    } catch (err) {
      console.error("Append milestone failed:", err);
    }
  };

  const handleUpdateTask = async (updatedTask: Task) => {
    try {
      await updateTask(updatedTask.id, {
        title: updatedTask.title,
        description: updatedTask.description,
        dueDate: updatedTask.dueDate,
        priority: updatedTask.priority,
        category: updatedTask.category,
        isPinned: !!updatedTask.isPinned,
      });
    } catch (err) {
      console.error("Failed to update task:", err);
      throw err;
    }
  };

  const getTaskStatus = (task: Task): 'todo' | 'in_progress' | 'completed' => {
    if (task.isSynced && activeProfileId) {
      const comp = completions.find(c => c.classmateId === activeProfileId && c.taskId === task.id);
      const isComp = comp ? comp.completed : false;
      if (isComp) return 'completed';
      
      if (comp && comp.status) {
        return comp.status;
      }
      
      const completedSubtaskIds = comp?.completedSubtaskIds || [];
      const subCount = task.subtasks?.length || 0;
      const subCompCount = task.subtasks?.filter(s => completedSubtaskIds.includes(s.id)).length || 0;
      if (subCount > 0 && subCompCount > 0) return 'in_progress';
      return 'todo';
    }

    if (task.completed) return 'completed';
    if (task.status) return task.status;
    const subCount = task.subtasks?.length || 0;
    const subCompCount = task.subtasks?.filter(s => s.completed).length || 0;
    if (subCount > 0 && subCompCount > 0) return 'in_progress';
    return 'todo';
  };

  const handleUpdateTaskStatus = async (task: Task, nextStatus: 'todo' | 'in_progress' | 'completed') => {
    if (!activeProfileId) return;
    hasJustInteractedRef.current = true;
    try {
      const comp = completions.find(c => c.classmateId === activeProfileId && c.taskId === task.id);
      if (nextStatus === 'completed') {
        // Complete the task
        if (task.isSynced) {
          const completion: SyncedTaskCompletion = {
            id: `${activeProfileId}-${task.id}`,
            classmateId: activeProfileId,
            taskId: task.id,
            completed: true,
            completedAt: new Date().toISOString(),
            completedSubtaskIds: task.subtasks?.map(s => s.id) || [],
            status: 'completed'
          };
          await saveCompletion(completion);
        } else {
          const updatedSub = task.subtasks?.map(s => ({ ...s, completed: true })) || [];
          await updateTask(task.id, { 
            subtasks: updatedSub, 
            completed: true, 
            completedAt: new Date().toISOString(),
            isArchived: false, 
            status: 'completed' 
          });
        }
        
        // Update submission streak on master task completion transition
        const wasCompleted = task.isSynced 
          ? (comp ? comp.completed : false)
          : task.completed;

        if (!wasCompleted) {
          await checkAndUpdateSubmissionStreak();
          try {
            const today = getTodayString();
            const q = query(
              collection(db, 'attendance_logs'),
              where('classmateId', '==', activeProfileId),
              where('date', '==', today)
            );
            const snap = await getDocs(q);
            if (snap.empty) {
              await saveAttendanceLog({
                classmateId: activeProfileId,
                date: today,
                status: 'Present',
                subject: `Completed: ${task.title}`,
                groupId: task.groupId || activeGroupId || null
              });
              console.log(`Automatic attendance logged for completing task: ${task.title}`);
            }
          } catch (streakErr) {
            console.error("Attendance/streak update failed:", streakErr);
          }
        }
      } else {
        // Moving back to todo or in_progress
        if (task.isSynced) {
          const completion: SyncedTaskCompletion = {
            id: `${activeProfileId}-${task.id}`,
            classmateId: activeProfileId,
            taskId: task.id,
            completed: false,
            completedAt: undefined,
            completedSubtaskIds: nextStatus === 'todo' ? [] : (comp?.completedSubtaskIds || []),
            status: nextStatus
          };
          await saveCompletion(completion);
        } else {
          await updateTask(task.id, { completed: false, completedAt: null, isArchived: false, status: nextStatus });
        }
      }
    } catch (err) {
      console.error("Failed to update task status:", err);
    }
  };

  const handleTogglePinTask = async (task: Task, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    try {
      await updateTask(task.id, { isPinned: !task.isPinned });
    } catch (err) {
      console.error("Pinning task failed:", err);
    }
  };

  // Filter tasks computation
  const activeGroupTasksFiltered = useMemo(() => {
    if (!activeGroupId || !activeProfileId) return [];

    let list = tasks.filter(t => {
      if (t.groupId !== activeGroupId) return false;
      if (t.isArchived) return false;

      const isComp = t.isSynced 
        ? !!completions.find(c => c.classmateId === activeProfileId && c.taskId === t.id)?.completed
        : !!t.completed;

      if (isComp || t.status === 'completed') {
        const completedAtStr = t.completedAt || (t.isSynced ? completions.find(c => c.classmateId === activeProfileId && c.taskId === t.id)?.completedAt : null);
        if (completedAtStr) {
          const completedAt = new Date(completedAtStr);
          const startOfThisWeek = getStartOfCurrentWeekMonday();
          if (completedAt < startOfThisWeek) {
            return false;
          } else {
            return true;
          }
        } else {
          return false;
        }
      }

      return true;
    });

    // Decorate synced tasks completion stats
    list = list.map(t => {
      if (t.isSynced) {
        const comp = completions.find(c => c.classmateId === activeProfileId && c.taskId === t.id);
        const isComp = comp ? comp.completed : false;
        const completedSubtaskIds = comp?.completedSubtaskIds || [];
        const decoratedSubtasks = t.subtasks?.map(s => ({
          ...s,
          completed: isComp ? true : completedSubtaskIds.includes(s.id)
        })) || [];
        
        // Calculate status dynamically based on decorated subtasks or overall completion
        const subCount = decoratedSubtasks.length;
        const subCompCount = decoratedSubtasks.filter(s => s.completed).length;
        let status: 'todo' | 'in_progress' | 'completed' = 'todo';
        if (isComp) {
          status = 'completed';
        } else if (comp && comp.status) {
          status = comp.status;
        } else if (subCount > 0 && subCompCount > 0) {
          status = 'in_progress';
        }

        return {
          ...t,
          completed: isComp,
          completedAt: isComp ? (comp?.completedAt || null) : null,
          subtasks: decoratedSubtasks,
          status: status
        };
      }
      return t;
    });

    // Apply Scope Selector (Synced vs Personal private checklists)
    if (selectedScope === 'synced') {
      list = list.filter(t => t.isSynced);
    } else if (selectedScope === 'personal') {
      list = list.filter(t => !t.isSynced && t.classmateId === activeProfileId);
    } else {
      // Show Synced AND Personal for this active user only
      list = list.filter(t => t.isSynced || t.classmateId === activeProfileId);
    }

    // Apply Category Pill Filter
    if (selectedCategory !== 'All') {
      list = list.filter(t => t.category.toLowerCase() === selectedCategory.toLowerCase());
    }

    // Sorting implementation: prioritize pinned, then highest urgency, then sooner due date
    return list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      const priorityScore: Record<string, number> = { high: 3, medium: 2, low: 1 };
      const scoreA = priorityScore[a.priority] || 1;
      const scoreB = priorityScore[b.priority] || 1;

      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return dateA - dateB;
    });

  }, [tasks, completions, activeGroupId, activeProfileId, selectedCategory, selectedScope]);

  // Extract all categories in task-feed dynamically to populate select pills
  const loadedCategories = useMemo(() => {
    const categoriesSet = new Set<string>();
    tasks.filter(t => t.groupId === activeGroupId).forEach(t => {
      if (t.category) categoriesSet.add(t.category);
    });
    return ['All', ...Array.from(categoriesSet)];
  }, [tasks, activeGroupId]);

  // Compute classroom task completion metrics for the active group
  const activeGroupProgressMetrics = useMemo(() => {
    if (!activeGroupId || !activeProfileId) {
      return { total: 0, completed: 0, pending: 0, percent: 0 };
    }
    const groupTasks = tasks.filter(t => 
      t.groupId === activeGroupId && 
      !t.isArchived && 
      (t.isSynced || t.classmateId === activeProfileId)
    );
    if (groupTasks.length === 0) {
      return { total: 0, completed: 0, pending: 0, percent: 100 };
    }
    
    let totalUnits = 0;
    let completedUnits = 0;
    
    groupTasks.forEach(t => {
      const isComp = t.isSynced 
        ? !!completions.find(c => c.classmateId === activeProfileId && c.taskId === t.id)?.completed
        : (!!t.completed || t.status === 'completed');
        
      totalUnits += 1;
      if (isComp) {
        completedUnits += 1;
      }
      
      const subtasks = t.subtasks || [];
      totalUnits += subtasks.length;
      subtasks.forEach(s => {
        if (isComp || s.completed) {
          completedUnits += 1;
        }
      });
    });
    
    const percent = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 100;
    const pending = totalUnits - completedUnits;
    return { total: totalUnits, completed: completedUnits, pending, percent };
  }, [tasks, completions, activeGroupId, activeProfileId]);

  // Compute remaining incomplete task counts per scope for classroom tabs
  const todoCounts = useMemo(() => {
    if (!activeGroupId || !activeProfileId) {
      return { all: 0, synced: 0, personal: 0 };
    }
    const activeTasks = tasks.filter(t => t.groupId === activeGroupId && !t.isArchived);
    
    const isTaskCompleted = (t: Task) => {
      if (t.isSynced) {
        return !!completions.find(c => c.classmateId === activeProfileId && c.taskId === t.id)?.completed;
      }
      return !!t.completed || t.status === 'completed';
    };

    const incomplete = activeTasks.filter(t => !isTaskCompleted(t));
    
    const all = incomplete.filter(t => t.isSynced || t.classmateId === activeProfileId).length;
    const synced = incomplete.filter(t => t.isSynced).length;
    const personal = incomplete.filter(t => !t.isSynced && t.classmateId === activeProfileId).length;

    return { all, synced, personal };
  }, [tasks, completions, activeGroupId, activeProfileId]);

  useEffect(() => {
    if (activeGroupProgressMetrics.total > 0) {
      if (prevPercentRef.current !== null && prevPercentRef.current < 100 && activeGroupProgressMetrics.percent === 100) {
        if (hasJustInteractedRef.current) {
          setShowGlobalCongratulation(true);
          hasJustInteractedRef.current = false;
        }
      }
      prevPercentRef.current = activeGroupProgressMetrics.percent;
    } else {
      prevPercentRef.current = null;
    }
  }, [activeGroupProgressMetrics.percent, activeGroupProgressMetrics.total]);

  // Compute classroom activity summaries
  const _groupCompsStatistics = useMemo(() => {
    const classmates = groupMembersList.filter(m => m.role === 'classmate');
    const syncTasks = tasks.filter(t => t.groupId === activeGroupId && t.isSynced);
    
    if (syncTasks.length === 0) return [];
    
    return classmates.map(m => {
      const finishedCount = completions.filter(c => 
        c.classmateId === m.userId && 
        c.completed && 
        syncTasks.some(st => st.id === c.taskId)
      ).length;

      const percentage = Math.round((finishedCount / syncTasks.length) * 100);
      return {
        ...m,
        completedCount: finishedCount,
        totalCount: syncTasks.length,
        percentage
      };
    });
  }, [groupMembersList, tasks, completions, activeGroupId]);

  // Compute classroom points leaderboard
  const classroomLeaderboard = useMemo(() => {
    if (!activeGroupId) return [];
    const syncTasks = tasks.filter(t => t.groupId === activeGroupId && t.isSynced);
    
    return groupMembersList.map(member => {
      // Find completions by this member for synced tasks in the active group
      const memberCompletions = completions.filter(c => 
        c.classmateId === member.userId && 
        c.completed && 
        syncTasks.some(st => st.id === c.taskId)
      );
      
      // Sum points for each completed task
      let points = 0;
      memberCompletions.forEach(c => {
        const task = syncTasks.find(st => st.id === c.taskId);
        if (task) {
          if (task.submissionType === 'subjective' || task.submissionType === 'objective') {
            const sub = submissions.find(s => s.taskId === task.id && s.classmateId === member.userId);
            points += sub && sub.score !== undefined ? sub.score : 0;
          } else {
            points += task.points !== undefined ? task.points : 50; // default 50 points if not explicitly specified
          }
        }
      });
      
      return {
        ...member,
        points,
        completedCount: memberCompletions.length
      };
    }).sort((a, b) => b.points - a.points); // Highest points first
  }, [groupMembersList, tasks, completions, submissions, activeGroupId]);

  const activeGroupAnnouncements = useMemo(() => {
    if (!activeGroupId) return [];
    return announcements
      .filter(a => a.groupId === activeGroupId)
      .sort((a, b) => b.id.localeCompare(a.id)); // Latest first
  }, [announcements, activeGroupId]);

  // Sub-method helper mapping due dates calendar statuses
  const getDaysLeftConfig = (dueDate: string, completed?: boolean) => {
    if (completed) {
      return { text: '✓ Completed', containerClass: 'bg-emerald-50 text-emerald-800 border-emerald-150 font-bold', dotColor: 'bg-emerald-500' };
    }
    const diffTime = new Date(dueDate).getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { text: `Overdue (${Math.abs(diffDays)}d ago)`, containerClass: 'bg-rose-50 text-rose-700 border-rose-150', dotColor: 'bg-rose-500' };
    }
    if (diffDays === 0) {
      return { text: '🚨 Due Today', containerClass: 'bg-amber-50 text-amber-900 border-amber-200 font-bold', dotColor: 'bg-amber-500' };
    }
    if (diffDays === 1) {
      return { text: '⌛ Tomorrow', containerClass: 'bg-amber-50 text-amber-800 border-amber-100 font-semibold', dotColor: 'bg-amber-400' };
    }
    return { text: `📅 In ${diffDays} days`, containerClass: 'bg-slate-50 text-slate-600 border-slate-200', dotColor: 'bg-slate-400' };
  };

  // Handle static terms and privacy routes within the single-page application
  const currentPath = window.location.pathname.toLowerCase().trim();
  if (currentPath === '/privacy') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-8 font-sans text-slate-300">
        <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6">
          <div className="border-b border-slate-800 pb-5">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Privacy Policy</h1>
            <p className="text-xs font-mono text-slate-500 mt-2">Last Updated: June 2026</p>
          </div>
          
          <div className="space-y-4 text-sm leading-relaxed text-slate-400 text-left">
            <p>
              Welcome to <strong>TaskTrack</strong>. We respect your privacy and are committed to protecting the personal data you share with us. This Privacy Policy outlines our practices regarding data collection, usage, and storage within our platform.
            </p>
            
            <h2 className="text-lg font-bold text-white pt-2 border-t border-slate-800/50">1. Data We Collect</h2>
            <p>
              <strong>TaskTrack</strong> is a student planning platform designed to store academic schedules, study groups, announcements, tasks, and task comments. When you register or sign in using email credentials or Google OAuth, we store:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Profile metadata (username, display name, tagline, avatar image).</li>
              <li>Encrypted credentials (salted password hashes, and security question mappings).</li>
              <li>Productivity records (tasks, custom milestones, Pomodoro study streaks, and attendance logs).</li>
            </ul>

            <h2 className="text-lg font-bold text-white pt-2 border-t border-slate-800/50">2. How We Store Your Data</h2>
            <p>
              Your data is stored securely in Firebase Firestore and Cloud SQL databases hosted in secure cloud environments. Real-time synchronizations are performed to ensure your devices remain up to date.
            </p>

            <h2 className="text-lg font-bold text-white pt-2 border-t border-slate-800/50">3. Third-Party Integrations</h2>
            <p>
              If you authenticate using Google OAuth, your Google Profile picture and email are used solely for account setup and identity synchronization within your classroom groups. We do not sell or share your data with third parties.
            </p>

            <h2 className="text-lg font-bold text-white pt-2 border-t border-slate-800/50">4. Your Rights and Controls</h2>
            <p>
              You maintain full control of your data. You may customize your account parameters, toggle automatic cleanup of archived items, or use the "Reset Database" option in your account options to permanently erase all records from our cloud database.
            </p>
          </div>

          <div className="pt-6 border-t border-slate-800 flex justify-between items-center">
            <a href="/" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-indigo-600/20">
              Return to Home Page
            </a>
            <span className="text-[10px] font-mono text-slate-600">TaskTrack Core</span>
          </div>
        </div>
        <div className="text-center text-xs text-slate-600 mt-8">
          &copy; 2026 TaskTrack. All rights reserved.
        </div>
      </div>
    );
  }

  if (currentPath === '/terms') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-8 font-sans text-slate-300">
        <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6">
          <div className="border-b border-slate-800 pb-5">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Terms of Service</h1>
            <p className="text-xs font-mono text-slate-500 mt-2">Last Updated: June 2026</p>
          </div>
          
          <div className="space-y-4 text-sm leading-relaxed text-slate-400 text-left">
            <p>
              Welcome to <strong>TaskTrack</strong>. By accessing or using our student co-op planner, study groups, or synchronization features, you agree to comply with and be bound by the following Terms of Service.
            </p>
            
            <h2 className="text-lg font-bold text-white pt-2 border-t border-slate-800/50">1. Acceptance of Terms</h2>
            <p>
              By accessing the platform at this domain, you accept these terms in full. If you do not agree to all of the terms, please discontinue use of the platform.
            </p>

            <h2 className="text-lg font-bold text-white pt-2 border-t border-slate-800/50">2. User Account and Responsibilities</h2>
            <p>
              You are responsible for keeping your credentials safe (username, secure passwords, and security answers) and for all activities that occur under your registered student profile. You agree to use the platform solely for lawful academic coordination and productivity.
            </p>

            <h2 className="text-lg font-bold text-white pt-2 border-t border-slate-800/50">3. Synced Task Rules</h2>
            <p>
              In a collaborative study group classroom, users with administrative authority (Group Leaders) can synchronize academic tasks and publish classroom broadcasts. You agree not to distribute harmful, offensive, or inappropriate content on the broadcast walls or task comment boards.
            </p>

            <h2 className="text-lg font-bold text-white pt-2 border-t border-slate-800/50">4. Service Modifications and Disclaimers</h2>
            <p>
              The platform is provided "as is" without warranties of any kind. We reserve the right to deploy updates, modify features, or reset databases for system maintenance or optimization without liability.
            </p>
          </div>

          <div className="pt-6 border-t border-slate-800 flex justify-between items-center">
            <a href="/" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-indigo-600/20">
              Return to Home Page
            </a>
            <span className="text-[10px] font-mono text-slate-600">TaskTrack Core</span>
          </div>
        </div>
        <div className="text-center text-xs text-slate-600 mt-8">
          &copy; 2026 TaskTrack. All rights reserved.
        </div>
      </div>
    );
  }

  // Loading indicator spinner center page
  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center font-sans px-4">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-black tracking-tight text-white font-sans">
              CampusTrack
            </h1>
            <p className="text-slate-400 text-xs font-semibold tracking-wide uppercase font-mono">
              Task Management App
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 mt-4">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-400 animate-spin" />
            <p className="text-slate-500 font-mono text-[9px] tracking-widest uppercase">
              Preparing Your Workspace...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const shades = getColorMapShades(customColor);
  const contrastColor = getContrastColor(customColor);

  const bodyBgVal = customBgColor || (appThemeMode === 'dark' ? '#020617' : appThemeMode === 'sepia' ? '#FAF6EE' : '#f8fafc');
  const cardBgVal = customCardColor || (appThemeMode === 'dark' ? '#0f172a' : appThemeMode === 'sepia' ? '#FDFBF7' : '#ffffff');
  const textMainVal = customTextColor || (appThemeMode === 'dark' ? '#f1f5f9' : appThemeMode === 'sepia' ? '#433422' : '#0f172a');
  const sidebarBgVal = customSidebarColor || '#0f172a';

  return (
    <div className="min-h-screen theme-body-bg flex justify-center items-center p-0 select-none font-sans overflow-x-hidden overflow-y-auto sm:overflow-hidden">
      <style>{`
        :root {
          --primary-color: ${customColor};
          --primary-color-rgb: ${getRgbFromHex(customColor)};
          --primary-contrast: ${contrastColor};
          
          --primary-50: ${shades[50]};
          --primary-100: ${shades[100]};
          --primary-150: ${shades[150]};
          --primary-200: ${shades[200]};
          --primary-300: ${shades[300]};
          --primary-400: ${shades[400]};
          --primary-500: ${shades[500]};
          --primary-600: ${shades[600]};
          --primary-650: ${shades[650]};
          --primary-700: ${shades[700]};
          --primary-800: ${shades[800]};
          --primary-850: ${shades[850]};
          --primary-900: ${shades[900]};
          --primary-950: ${shades[950]};

          --body-bg: ${bodyBgVal};
          --card-bg: ${cardBgVal};
          --text-main: ${textMainVal};
          --sidebar-bg: ${sidebarBgVal};
        }

        .theme-body-bg {
          background-color: var(--body-bg) !important;
        }
        .theme-card-bg {
          background-color: var(--card-bg) !important;
        }
        .theme-text-main {
          color: var(--text-main) !important;
        }
        .theme-sidebar-bg {
          background-color: var(--sidebar-bg) !important;
        }

        ${appThemeMode === 'dark' ? `
          /* === DARK VOID HIGH CONTRAST THEMING OVERRIDES === */
          .text-slate-950, .text-slate-900, .text-slate-850, .text-slate-805 {
            color: #ffffff !important;
          }
          .text-slate-800, .text-slate-705, .text-slate-700, .text-slate-650 {
            color: #f1f5f9 !important;
          }
          .text-slate-600, .text-slate-500 {
            color: #94a3b8 !important;
          }
          .text-slate-450, .text-slate-400 {
            color: #64748b !important;
          }
          .text-slate-350, .text-slate-300, .text-slate-250, .text-slate-200 {
            color: #475569 !important;
          }
          ::placeholder {
            color: #64748b !important;
            opacity: 0.95 !important;
          }

          /* Background overrides for layered depth */
          .bg-white {
            background-color: var(--card-bg) !important;
          }
          .bg-slate-50 {
            background-color: var(--body-bg) !important;
          }
          .bg-slate-100, .bg-slate-150 {
            background-color: #1e293b !important;
          }
          .bg-slate-200, .bg-slate-250 {
            background-color: #334155 !important;
          }
          .bg-slate-300, .bg-slate-350 {
            background-color: #475569 !important;
          }
          
          /* Hover overrides */
          .hover\\:bg-slate-50:hover {
            background-color: #0f172a !important;
          }
          .hover\\:bg-slate-100:hover {
            background-color: #334155 !important;
          }
          .hover\\:bg-slate-150:hover, .hover\\:bg-slate-200:hover {
            background-color: #475569 !important;
          }
          
          /* Semi-transparent overlays */
          .bg-slate-100\\/30, .bg-slate-50\\/50, .bg-slate-100\\/50, .bg-slate-50\\/55, .bg-slate-100\\/55 {
            background-color: rgba(255, 255, 255, 0.05) !important;
          }
          
          /* Accent container background overrides (dim bright badges and indicators) */
          .bg-indigo-50, .bg-emerald-50, .bg-rose-50, .bg-violet-50, .bg-amber-50, .bg-indigo-50\\/50, .bg-emerald-50\\/55, .bg-rose-50\\/55, .bg-violet-50\\/55, .bg-amber-50\\/55 {
            background-color: rgba(var(--primary-color-rgb), 0.12) !important;
            color: #ffffff !important;
          }
          
          /* Border overrides for sharp contrast */
          .border-slate-100, .border-slate-150, .border-slate-200, .border-slate-205, .border-slate-250 {
            border-color: #1e293b !important;
          }
          .border-slate-300, .border-slate-350 {
            border-color: #334155 !important;
          }
        ` : appThemeMode === 'sepia' ? `
          /* === SEPIA COFFEE THEMING OVERRIDES === */
          .text-slate-950, .text-slate-900, .text-slate-850, .text-slate-805 {
            color: #2D1E10 !important;
          }
          .text-slate-800, .text-slate-705, .text-slate-700, .text-slate-650 {
            color: #433422 !important;
          }
          .text-slate-600, .text-slate-500 {
            color: #8A7A6B !important;
          }
          .text-slate-450, .text-slate-400 {
            color: #A08F7F !important;
          }
          .text-slate-350, .text-slate-300, .text-slate-250, .text-slate-200 {
            color: #C5B7A5 !important;
          }
          ::placeholder {
            color: #A08F7F !important;
            opacity: 0.95 !important;
          }

          /* Background overrides for layered depth */
          .bg-white {
            background-color: var(--card-bg) !important;
          }
          .bg-slate-50 {
            background-color: var(--body-bg) !important;
          }
          .bg-slate-100 {
            background-color: #F4ECE1 !important;
          }
          .bg-slate-150, .bg-slate-200 {
            background-color: #ECE2D3 !important;
          }
          .bg-slate-250, .bg-slate-300 {
            background-color: #E4D7C3 !important;
          }
          .bg-slate-350 {
            background-color: #DDD2BE !important;
          }
          
          /* Hover overrides */
          .hover\\:bg-slate-50:hover {
            background-color: #FDFBF7 !important;
          }
          .hover\\:bg-slate-100:hover {
            background-color: #ECE2D3 !important;
          }
          .hover\\:bg-slate-150:hover, .hover\\:bg-slate-200:hover {
            background-color: #E4D7C3 !important;
          }
          
          /* Semi-transparent overlays */
          .bg-slate-100\\/30, .bg-slate-50\\/50, .bg-slate-100\\/50, .bg-slate-50\\/55, .bg-slate-100\\/55 {
            background-color: rgba(67, 52, 34, 0.05) !important;
          }
          
          /* Light accent container background overrides */
          .bg-indigo-50, .bg-emerald-50, .bg-rose-50, .bg-violet-50, .bg-amber-50, .bg-indigo-50\\/50, .bg-emerald-50\\/55, .bg-rose-50\\/55, .bg-violet-50\\/55, .bg-amber-50\\/55 {
            background-color: rgba(var(--primary-color-rgb), 0.08) !important;
            color: #2D1E10 !important;
          }
          
          /* Border overrides */
          .border-slate-100, .border-slate-150, .border-slate-200, .border-slate-205, .border-slate-250 {
            border-color: #EBE2D5 !important;
          }
          .border-slate-300, .border-slate-350 {
            border-color: #DFD6C4 !important;
          }
        ` : `
          /* === LIGHT SLATE THEMING OVERRIDES === */
          .text-slate-950, .text-slate-900, .text-slate-850, .text-slate-805 {
            color: ${customTextColor || '#0f172a'} !important;
          }
          .text-slate-800, .text-slate-705, .text-slate-700, .text-slate-650 {
            color: ${customTextColor ? 'var(--text-main)' : '#1e293b'} !important;
          }
          .text-slate-600, .text-slate-500 {
            color: ${customTextColor ? 'var(--text-main)' : '#475569'} !important;
            opacity: ${customTextColor ? 0.8 : 1} !important;
          }
          .text-slate-450, .text-slate-400 {
            color: ${customTextColor ? 'var(--text-main)' : '#5e6e82'} !important;
            opacity: ${customTextColor ? 0.75 : 1} !important;
          }
          .text-slate-350, .text-slate-300, .text-slate-250, .text-slate-200 {
            color: ${customTextColor ? 'var(--text-main)' : '#7f8ea3'} !important;
            opacity: ${customTextColor ? 0.65 : 1} !important;
          }

          /* Protect text inside dark backgrounds (buttons, badges, active indicators) from inheriting light overrides */
          .bg-slate-950 .text-slate-300, .bg-slate-900 .text-slate-300, .bg-slate-850 .text-slate-300, .bg-slate-800 .text-slate-300,
          .bg-slate-950 .text-slate-200, .bg-slate-900 .text-slate-200, .bg-slate-850 .text-slate-200, .bg-slate-800 .text-slate-200,
          .bg-slate-950 .text-slate-100, .bg-slate-900 .text-slate-100, .bg-slate-850 .text-slate-100, .bg-slate-800 .text-slate-100,
          .bg-indigo-650 .text-slate-300, .bg-indigo-600 .text-slate-300, .bg-emerald-600 .text-slate-300, .bg-rose-600 .text-slate-300,
          .bg-indigo-650 .text-slate-200, .bg-indigo-600 .text-slate-200, .bg-emerald-600 .text-slate-200, .bg-rose-600 .text-slate-200 {
            color: #f1f5f9 !important;
            opacity: 0.95 !important;
          }
          .bg-slate-950 .text-slate-400, .bg-slate-900 .text-slate-400, .bg-slate-850 .text-slate-400, .bg-slate-800 .text-slate-400,
          .bg-slate-950 .text-slate-450, .bg-slate-900 .text-slate-450, .bg-slate-850 .text-slate-450, .bg-slate-800 .text-slate-450,
          .bg-indigo-650 .text-slate-400, .bg-indigo-600 .text-slate-400, .bg-emerald-600 .text-slate-400, .bg-rose-600 .text-slate-400 {
            color: #cbd5e1 !important;
            opacity: 0.9 !important;
          }
          ::placeholder {
            color: #94a3b8 !important;
            opacity: 0.95 !important;
          }

          /* Background overrides for layered depth */
          .bg-white {
            background-color: var(--card-bg) !important;
          }
          .bg-slate-50 {
            background-color: var(--body-bg) !important;
          }
          .bg-slate-100 {
            background-color: ${customBgColor ? 'var(--body-bg)' : '#f1f5f9'} !important;
          }
          .bg-slate-150, .bg-slate-200 {
            background-color: ${customBgColor ? 'rgba(var(--primary-color-rgb), 0.05)' : '#e2e8f0'} !important;
          }
          .bg-slate-250, .bg-slate-300 {
            background-color: ${customBgColor ? 'rgba(var(--primary-color-rgb), 0.1)' : '#cbd5e1'} !important;
          }
          .bg-slate-350 {
            background-color: #cbd5e1 !important;
          }
          
          /* Hover overrides */
          .hover\\:bg-slate-50:hover {
            background-color: #f8fafc !important;
          }
          .hover\\:bg-slate-100:hover {
            background-color: #f1f5f9 !important;
          }
          .hover\\:bg-slate-150:hover, .hover\\:bg-slate-200:hover {
            background-color: #cbd5e1 !important;
          }
          
          /* Semi-transparent overlays */
          .bg-slate-100\\/30, .bg-slate-50\\/50, .bg-slate-100\\/50, .bg-slate-50\\/55, .bg-slate-100\\/55 {
            background-color: rgba(15, 23, 42, 0.03) !important;
          }
          
          /* Light accent container background overrides */
          .bg-indigo-50, .bg-emerald-50, .bg-rose-50, .bg-violet-50, .bg-amber-50, .bg-indigo-50\\/50, .bg-emerald-50\\/55, .bg-rose-50\\/55, .bg-violet-50\\/55, .bg-amber-50\\/55 {
            background-color: rgba(var(--primary-color-rgb), 0.08) !important;
            color: var(--primary-color) !important;
          }
          
          /* Border overrides */
          .border-slate-100, .border-slate-150, .border-slate-200, .border-slate-205, .border-slate-250 {
            border-color: ${customBgColor ? 'rgba(var(--primary-color-rgb), 0.1)' : '#e2e8f0'} !important;
          }
          .border-slate-300, .border-slate-350 {
            border-color: ${customBgColor ? 'rgba(var(--primary-color-rgb), 0.15)' : '#cbd5e1'} !important;
          }
        `}

        /* 🔔 Ensure sidebar elements remain beautifully readable with high contrast on dark sidebar background */
        .theme-sidebar-bg .text-slate-100, .theme-sidebar-bg .text-slate-200, .theme-sidebar-bg .text-slate-300 {
          color: #f1f5f9 !important;
        }
        .theme-sidebar-bg .text-slate-400, .theme-sidebar-bg .text-slate-500 {
          color: #94a3b8 !important;
          opacity: 1 !important;
        }
        .theme-sidebar-bg .bg-slate-850 {
          background-color: #1e293b !important;
          border-color: #334155 !important;
        }
        .theme-sidebar-bg .border-slate-800 {
          border-color: #334155 !important;
        }

        /* Direct color overrides */
        .bg-indigo-50 { background-color: ${appThemeMode === 'dark' ? 'rgba(var(--primary-color-rgb), 0.08)' : appThemeMode === 'sepia' ? 'rgba(var(--primary-color-rgb), 0.06)' : 'var(--primary-50)'} !important; }
        .bg-indigo-100 { background-color: ${appThemeMode === 'dark' ? 'rgba(var(--primary-color-rgb), 0.15)' : appThemeMode === 'sepia' ? 'rgba(var(--primary-color-rgb), 0.12)' : 'var(--primary-100)'} !important; }
        .bg-indigo-150 { background-color: ${appThemeMode === 'dark' ? 'rgba(var(--primary-color-rgb), 0.22)' : appThemeMode === 'sepia' ? 'rgba(var(--primary-color-rgb), 0.18)' : 'var(--primary-150)'} !important; }
        .bg-indigo-200 { background-color: ${appThemeMode === 'dark' ? 'rgba(var(--primary-color-rgb), 0.3)' : appThemeMode === 'sepia' ? 'rgba(var(--primary-color-rgb), 0.24)' : 'var(--primary-200)'} !important; }
        .bg-indigo-300 { background-color: ${appThemeMode === 'dark' ? 'rgba(var(--primary-color-rgb), 0.42)' : appThemeMode === 'sepia' ? 'rgba(var(--primary-color-rgb), 0.35)' : 'var(--primary-300)'} !important; }
        .bg-indigo-500 { background-color: var(--primary-500) !important; }
        .bg-indigo-600, .bg-indigo-650 {
          background-color: var(--primary-color) !important;
          color: var(--primary-contrast) !important;
        }
        .bg-indigo-700 { background-color: var(--primary-700) !important; }
        .bg-indigo-800 { background-color: var(--primary-800) !important; }
        .bg-indigo-900 { background-color: var(--primary-900) !important; }
        .bg-indigo-950 { background-color: var(--primary-950) !important; }

        /* Handle icons and text inside active primary buttons/tabs nicely */
        .bg-indigo-600 *, .bg-indigo-650 *, .bg-indigo-500 * {
          color: inherit !important;
        }

        /* Hover background overrides */
        .hover\\:bg-indigo-50:hover { background-color: var(--primary-50) !important; }
        .hover\\:bg-indigo-100:hover { background-color: var(--primary-100) !important; }
        .hover\\:bg-indigo-200:hover { background-color: var(--primary-200) !important; }
        .hover\\:bg-indigo-600:hover { background-color: var(--primary-color) !important; color: var(--primary-contrast) !important; }
        .hover\\:bg-indigo-650:hover { background-color: var(--primary-650) !important; color: var(--primary-contrast) !important; }
        .hover\\:bg-indigo-700:hover { background-color: var(--primary-700) !important; }

        /* Text color overrides */
        .text-indigo-50 { color: var(--primary-50) !important; }
        .text-indigo-100 { color: var(--primary-100) !important; }
        .text-indigo-200 { color: var(--primary-200) !important; }
        .text-indigo-300 { color: var(--primary-300) !important; }
        .text-indigo-400 { color: var(--primary-400) !important; }
        .text-indigo-500 { color: var(--primary-500) !important; }
        .text-indigo-600, .text-indigo-650 { color: var(--primary-color) !important; }
        .text-indigo-700 { color: var(--primary-700) !important; }
        .text-indigo-800 { color: var(--primary-800) !important; }
        .text-indigo-900 { color: var(--primary-900) !important; }
        .text-indigo-950 { color: var(--primary-950) !important; }

        .hover\\:text-indigo-600:hover { color: var(--primary-color) !important; }
        .hover\\:text-indigo-700:hover { color: var(--primary-700) !important; }

        /* Borders */
        .border-indigo-50 { border-color: var(--primary-50) !important; }
        .border-indigo-100 { border-color: var(--primary-100) !important; }
        .border-indigo-150 { border-color: var(--primary-150) !important; }
        .border-indigo-200 { border-color: var(--primary-200) !important; }
        .border-indigo-300 { border-color: var(--primary-300) !important; }
        .border-indigo-500 { border-color: var(--primary-500) !important; }
        .border-indigo-600 { border-color: var(--primary-color) !important; }
        .border-indigo-700 { border-color: var(--primary-700) !important; }

        /* Input Focus and ring outlines */
        .focus\\:border-indigo-650:focus, .focus\\:border-indigo-600:focus, .focus\\:border-indigo-500:focus {
          border-color: var(--primary-color) !important;
        }
        .focus\\:ring-indigo-650\\/30:focus {
          box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.3) !important;
        }

        .shadow-indigo-600\\/20 {
          box-shadow: 0 10px 15px -3px rgba(var(--primary-color-rgb), 0.2), 0 4px 6px -4px rgba(var(--primary-color-rgb), 0.2) !important;
        }
        .shadow-indigo-100 {
          box-shadow: 0 4px 6px -1px rgba(var(--primary-color-rgb), 0.1), 0 2px 4px -1px rgba(var(--primary-color-rgb), 0.06) !important;
        }
      `}</style>
      
      {/* 💻 RESPONSIVE DUAL FRAMEWORK - FLUID LAYOUT */}
      <div className={`w-full h-screen ${theme.mode.bodyBg} flex flex-col lg:flex-row overflow-hidden relative`}>
        
        {/* 💻 DESKTOP/TABLET SIDEBAR INTEGRATION */}
        <div className="hidden lg:flex flex-col w-72 theme-sidebar-bg text-slate-100 shrink-0 border-r border-slate-800 p-5 justify-between select-none">
          <div className="space-y-6 flex-1 overflow-y-auto pr-1 min-h-0 mb-4">
            {/* Branding */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex flex-col text-left">
                <span className="text-lg font-black tracking-tight text-white leading-none">CampusTrack.</span>
                <span className="text-[10px] font-mono text-slate-500 font-extrabold uppercase mt-1 leading-none">TASK MANAGEMENT</span>
              </div>
              <span className="bg-indigo-950 text-indigo-400 text-[10px] font-mono font-bold py-1 px-2.5 rounded-full border border-indigo-900">
                Tablet Co-op
              </span>
            </div>

            {/* Profile customized trigger */}
            {activeProfile && (
              <div className="space-y-2">
                <div className="bg-slate-850 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3 relative text-left">
                  <div 
                    onClick={() => setActiveTab('profile')}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group"
                  >
                    <div className="relative shrink-0 transition-transform group-hover:scale-105">
                      <img src={activeProfile.avatar} alt={activeProfile.name} className="w-10 h-10 rounded-full object-cover border-2 border-slate-700" referrerPolicy="no-referrer" />
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-850" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-black text-white truncate leading-tight flex items-center gap-1 group-hover:text-indigo-405 transition-colors">
                          <span>{activeProfile.name}</span>
                          {activeProfile.equippedBadge && <BadgeIcon emoji={activeProfile.equippedBadge} className="w-3.5 h-3.5 animate-pulse" />}
                        </h4>
                        <span className="text-[8px] bg-slate-800 text-slate-300 border border-slate-700 px-1 py-0.5 rounded-sm font-sans font-bold flex items-center gap-1" title={`Role: ${activeProfile.role || 'Student'}`}>
                          <RoleIcon role={activeProfile.role} className="w-2.5 h-2.5" /> {activeProfile.role || 'Student'}
                        </span>
                      </div>
                      <p className="text-[9.5px] text-slate-400 italic font-mono truncate">{activeProfile.tagline}</p>
                    </div>
                  </div>
                  {/* Profile Settings Trigger */}
                  <button 
                    onClick={() => setActiveTab('settings')}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Customize Settings & Colors"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>

                {/* Move hold to log off below the profile card on the side menu */}
                <div className="relative overflow-hidden w-full bg-slate-850 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900/30 text-slate-400 hover:text-rose-450 rounded-xl transition-all duration-150 cursor-pointer select-none active:scale-98">
                  {/* Progress Fill Background overlay */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 bg-rose-600/30 pointer-events-none transition-all duration-75"
                    style={{ width: `${logoutHoldProgress}%` }}
                  />
                  <button
                    onMouseDown={startLogoutHold}
                    onMouseUp={stopLogoutHold}
                    onMouseLeave={stopLogoutHold}
                    onTouchStart={startLogoutHold}
                    onTouchEnd={stopLogoutHold}
                    onTouchCancel={stopLogoutHold}
                    className="relative z-10 w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-extrabold"
                  >
                    <LogOut className={`w-3.5 h-3.5 transition-transform ${logoutHoldProgress > 0 ? 'scale-110 rotate-12 text-rose-450' : 'text-slate-500'}`} />
                    <span className="font-sans">
                      {logoutHoldProgress > 0 ? `Hold to Log Off (${Math.round(logoutHoldProgress)}%)` : 'Hold to Log Off'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Class Analytics trigger */}
            {activeProfile && canAccessClassAnalytics && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-indigo-600/30 border-indigo-500 text-white'
                    : 'bg-indigo-950/20 hover:bg-indigo-950/40 border-indigo-950 text-indigo-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-xs font-mono font-bold tracking-tight">Class Analytics</span>
                </div>
                <span className="bg-indigo-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase animate-pulse">Live</span>
              </button>
            )}

            {/* Super Admin Console trigger */}
            {activeProfile && isSuperAdmin && (
              <button
                onClick={() => setActiveTab('super_admin')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                  activeTab === 'super_admin'
                    ? 'bg-emerald-600/30 border-emerald-500 text-white animate-pulse'
                    : 'bg-slate-900/40 hover:bg-slate-900/80 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-mono font-bold tracking-tight">Admin Console</span>
                </div>
                <span className="bg-emerald-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase">Global</span>
              </button>
            )}

            {/* Group switchers */}
            {activeProfile && (
              <div className="space-y-2">
                <span className="text-[9.5px] uppercase font-bold text-slate-500 tracking-wider block text-left">My Classrooms</span>
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {joinedGroups.map(group => {
                    const isOwner = group.creatorId === activeProfileId;
                    const isSelected = activeGroupId === group.id;
                    return (
                      <button
                        key={group.id}
                        onClick={() => {
                          setActiveGroupId(group.id);
                          localStorage.setItem('studysync_group_id', group.id);
                          setActiveTab('tasks');
                        }}
                        className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-indigo-650 border-indigo-600 text-white font-black' 
                            : 'bg-slate-850 hover:bg-slate-800 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold block truncate">{group.name}</span>
                          <span className={`text-[8px] font-mono uppercase tracking-wider block truncate ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                            {isOwner ? '👑 Code:' : '🔑 Code:'} {group.id}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {joinedGroups.length === 0 && (
                    <p className="text-[10px] text-slate-500 italic py-1 text-left">No groups enrolled.</p>
                  )}
                </div>
                {/* Join/Create button */}
                <button
                  onClick={() => {
                    setActiveGroupId(null);
                    localStorage.removeItem('studysync_group_id');
                    setActiveTab('classroom');
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-750 text-white font-bold py-2 rounded-xl text-[10px] flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700/50"
                >
                  <Plus className="w-3.5 h-3.5" /> Join / Create Group
                </button>
              </div>
            )}

            {/* Navigation links */}
            {activeGroupId && (
              <div className="space-y-1 pt-2 border-t border-slate-800">
                <span className="text-[9.5px] uppercase font-bold text-slate-500 tracking-wider block text-left mb-1.5 font-black font-sans">Control Center</span>
                {[
                  { id: 'tasks', label: 'Workloads Feed', icon: AlignLeft },
                  { id: 'create', label: 'Assemble / Publish', icon: Plus },
                  { id: 'classroom', label: 'Announcements & Members', icon: Users },
                  { id: 'focus', label: 'Focus Pomodoro Sprints', icon: Flame },
                  { id: 'productivity', label: 'Weekly Productivity', icon: TrendingUp },
                  { id: 'profile', label: 'Student Profile & Stats', icon: User },
                  { id: 'archive', label: 'Completed Archive', icon: Archive },
                  { id: 'settings', label: 'Settings & Colors', icon: Settings }
                ].map(item => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      id={
                        item.id === 'tasks' ? 'switcher-feed-trigger-desktop' :
                        item.id === 'create' ? 'switcher-create-trigger-desktop' :
                        item.id === 'classroom' ? 'switcher-classroom-trigger-desktop' :
                        item.id === 'focus' ? 'switcher-focus-trigger-desktop' :
                        undefined
                      }
                      onClick={() => setActiveTab(item.id as any)}
                      className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                        isActive 
                          ? 'bg-indigo-650 text-white' 
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="pt-4 border-t border-slate-800 space-y-2 text-left">
            <div className="text-[10px] text-slate-400 flex justify-between items-center">
              <span>View Filter Scope:</span>
              <span className="font-extrabold text-white uppercase font-mono bg-slate-800 px-1.5 py-0.5 rounded text-[8.5px] border border-slate-700">{selectedScope}</span>
            </div>
            {activeProfileId && (
              <div className="space-y-1.5 w-full">
                <button
                  onClick={() => setShowTutorial(true)}
                  className="w-full flex items-center justify-center gap-1.5 bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-900/50 text-indigo-400 py-2 px-3 rounded-lg text-xs font-extrabold transition-all cursor-pointer shadow-3xs"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-400" /> 📖 Quick Start Guide
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 📱 MOBILE & TABLET SLIDE-OUT DRAWER */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              {/* Overlay Backdrop */}
              <div 
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-slate-950/70 z-50 lg:hidden backdrop-blur-3xs"
              />
              {/* Drawer Container */}
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="fixed inset-y-0 left-0 w-72 theme-sidebar-bg text-slate-100 z-55 p-5 flex flex-col justify-between select-none border-r border-slate-800 shadow-2xl lg:hidden"
              >
                <div className="space-y-6 overflow-y-auto flex-1 pr-0.5 min-h-0 mb-4">
                  {/* Branding */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex flex-col text-left">
                      <span className="text-base font-black tracking-tight text-white leading-none">CampusTrack.</span>
                      <span className="text-[9px] font-mono text-slate-500 font-extrabold uppercase mt-1 leading-none">TASK MANAGEMENT</span>
                    </div>
                    <button 
                      onClick={() => setIsSidebarOpen(false)}
                      className="p-1 hover:bg-slate-800 rounded-lg text-slate-450 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Profile customized trigger */}
                  {activeProfile && (
                    <div className="space-y-2">
                      <div className="bg-slate-850 p-3 rounded-2xl border border-slate-800 flex items-center gap-2.5 relative text-left">
                        <div 
                          onClick={() => {
                            setIsSidebarOpen(false);
                            setActiveTab('profile');
                          }}
                          className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer group"
                        >
                          <div className="relative shrink-0 transition-transform group-hover:scale-105">
                            <img src={activeProfile.avatar} alt={activeProfile.name} className="w-9 h-9 rounded-full object-cover border-2 border-slate-705" referrerPolicy="no-referrer" />
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-850" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs font-black text-white truncate leading-tight flex items-center gap-1 group-hover:text-indigo-405 transition-colors">
                                <span>{activeProfile.name}</span>
                                {activeProfile.equippedBadge && <BadgeIcon emoji={activeProfile.equippedBadge} className="w-3.5 h-3.5 animate-pulse" />}
                              </h4>
                              <span className="text-[8px] bg-slate-800 text-slate-300 border border-slate-700 px-1 py-0.5 rounded-sm font-sans font-bold flex items-center gap-1" title={`Role: ${activeProfile.role || 'Student'}`}>
                                <RoleIcon role={activeProfile.role} className="w-2.5 h-2.5" /> {activeProfile.role || 'Student'}
                              </span>
                            </div>
                            <p className="text-[9px] text-slate-405 italic font-mono truncate">{activeProfile.tagline}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setIsSidebarOpen(false);
                            setActiveTab('settings');
                          }}
                          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-405 hover:text-white cursor-pointer shrink-0"
                          title="Customize Settings & Colors"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Move hold to log off below the profile card on the mobile side menu */}
                      <div className="relative overflow-hidden w-full bg-slate-850 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900/30 text-slate-400 hover:text-rose-400 rounded-xl transition-all duration-150 cursor-pointer select-none active:scale-98">
                        {/* Progress Fill Background overlay */}
                        <div 
                          className="absolute left-0 top-0 bottom-0 bg-rose-600/30 pointer-events-none transition-all duration-75"
                          style={{ width: `${logoutHoldProgress}%` }}
                        />
                        <button
                          onMouseDown={startLogoutHold}
                          onMouseUp={stopLogoutHold}
                          onMouseLeave={stopLogoutHold}
                          onTouchStart={startLogoutHold}
                          onTouchEnd={stopLogoutHold}
                          onTouchCancel={stopLogoutHold}
                          className="relative z-10 w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-extrabold"
                        >
                          <LogOut className={`w-3.5 h-3.5 transition-transform ${logoutHoldProgress > 0 ? 'scale-110 rotate-12 text-rose-450' : 'text-slate-500'}`} />
                          <span className="font-sans">
                            {logoutHoldProgress > 0 ? `Hold to Log Off (${Math.round(logoutHoldProgress)}%)` : 'Hold to Log Off'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Class Analytics trigger */}
                  {activeProfile && canAccessClassAnalytics && (
                    <button
                      onClick={() => {
                        setActiveTab('admin');
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                        activeTab === 'admin'
                          ? 'bg-indigo-600/30 border-indigo-500 text-white'
                          : 'bg-indigo-950/20 hover:bg-indigo-950/40 border-indigo-950 text-indigo-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="text-xs font-mono font-bold tracking-tight">Class Analytics</span>
                      </div>
                      <span className="bg-indigo-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase animate-pulse">Live</span>
                    </button>
                  )}

                  {/* Super Admin Console trigger */}
                  {activeProfile && isSuperAdmin && (
                    <button
                      onClick={() => {
                        setActiveTab('super_admin');
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                        activeTab === 'super_admin'
                          ? 'bg-emerald-600/30 border-emerald-500 text-white'
                          : 'bg-slate-900/40 hover:bg-slate-900/80 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-xs font-mono font-bold tracking-tight">Admin Console</span>
                      </div>
                      <span className="bg-emerald-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase">Global</span>
                    </button>
                  )}

                  {/* Group switchers */}
                  {activeProfile && (
                    <div className="space-y-1.5">
                      <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block text-left font-mono">My Classrooms</span>
                      <div className="space-y-1 max-h-[140px] overflow-y-auto">
                        {joinedGroups.map(group => {
                          const isSelected = activeGroupId === group.id;
                          return (
                            <button
                              key={group.id}
                              onClick={() => {
                                setActiveGroupId(group.id);
                                localStorage.setItem('studysync_group_id', group.id);
                                setActiveTab('tasks');
                                setIsSidebarOpen(false);
                              }}
                              className={`w-full flex items-center gap-2 p-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                                isSelected 
                                  ? 'bg-indigo-650 border border-indigo-505 text-white' 
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <span className="max-w-[180px] truncate block flex items-center gap-1.5">
                                <University className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span>{group.name}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Join / Create Classroom Actions */}
                  {activeProfile && (
                    <button
                      onClick={() => {
                        setActiveGroupId(null);
                        localStorage.removeItem('studysync_group_id');
                        setActiveTab('classroom');
                        setIsSidebarOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-805 text-slate-300 py-2.5 px-3 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-3xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-indigo-400" /> Join or Create Classroom
                    </button>
                  )}

                  {/* Navigation Switchers */}
                  {activeProfile && activeGroupId && (
                    <div className="space-y-1.5">
                      <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block text-left font-mono">Control Center</span>
                      <div className="space-y-1">
                        {[
                          { id: 'tasks', label: 'Workloads & Checkpoints', icon: AlignLeft },
                          { id: 'create', label: 'Publish Assignment', icon: Plus },
                          { id: 'classroom', label: 'Cooperative Class Feed', icon: Users },
                          { id: 'focus', label: 'Focus Soundscapes', icon: Flame },
                          { id: 'productivity', label: 'Weekly Productivity', icon: TrendingUp },
                          { id: 'profile', label: 'Student Profile & Stats', icon: User },
                          { id: 'archive', label: 'Completed Archive', icon: Archive },
                          { id: 'settings', label: 'Settings & Colors', icon: Settings }
                        ].map(item => {
                          const isActive = activeTab === item.id;
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setActiveTab(item.id as any);
                                setIsSidebarOpen(false);
                              }}
                              className={`w-full flex items-center gap-2 p-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                                isActive 
                                  ? 'bg-indigo-650 text-white font-extrabold' 
                                  : 'text-slate-450 hover:text-slate-200 hover:bg-slate-800'
                              }`}
                            >
                              <Icon className="w-4 h-4 shrink-0" />
                              <span>{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer and Signout */}
                <div className="pt-4 border-t border-slate-800 space-y-2 text-left shrink-0">
                  <div className="text-[9.5px] text-slate-450 flex justify-between items-center">
                    <span>View Scope:</span>
                    <span className="font-extrabold text-white uppercase font-mono bg-slate-800 px-1.5 py-0.5 rounded text-[8px] border border-slate-700">{selectedScope}</span>
                  </div>
                  {activeProfileId && (
                    <div className="space-y-1.5 w-full">
                      <button
                        onClick={() => {
                          setShowTutorial(true);
                          setIsSidebarOpen(false);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-900/50 text-indigo-400 py-2 px-3 rounded-lg text-xs font-extrabold transition-all cursor-pointer shadow-3xs"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-indigo-400" /> 📖 Quick Start Guide
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* 📱 PORTRAIT MOBILE SMARTPHONE FLOW CONSTRAINED TO FLEX-1 */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">

          {/* --- BRANDING HEADER WITH COLLAPSIBLE SWITCHERS (Mobile Only) --- */}
          <div className="bg-white border-b border-slate-100 relative px-4 py-3 select-none shrink-0 z-40 shadow-xs flex justify-between items-center lg:hidden">
            
            {/* Left section: Hamburger Menu and App Name */}
            <div className="flex items-center gap-2.5">
              {/* TABLET/MOBILE SIDEBAR TOGGLER */}
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="w-9 h-9 hover:bg-slate-50 active:bg-slate-100 rounded-xl text-slate-700 transition-all cursor-pointer flex items-center justify-center border border-slate-200/80 shadow-3xs"
                title="Open Navigation Menu"
              >
                <Menu className="w-4 h-4 text-slate-800" />
              </button>
              
              {/* BRANDING LOGO & SUBTITLE */}
              <div className="flex flex-col text-left">
                <span className="text-xs font-black text-slate-900 tracking-tight leading-none">CampusTrack</span>
                <span className="text-[7.5px] font-mono text-indigo-600 font-bold uppercase tracking-wider mt-0.5 leading-none">Workspace</span>
              </div>
            </div>

            {/* Right section: Context Selector, Theme Icon, and User Avatar */}
            <div className="flex items-center gap-2">
              
              {/* THEME & COLOR CUSTOMIZER QUICK TRIGGER */}
              {activeProfile && (
                <button
                  id="switcher-theme-trigger"
                  onClick={() => {
                    setActiveTab('settings');
                    setGuideStep(null); // Close active guide walkthrough when clicked
                  }}
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all cursor-pointer shadow-3xs relative ${
                    activeTab === 'settings' 
                      ? 'border-indigo-200 bg-indigo-50/50 text-indigo-650' 
                      : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50 text-slate-700'
                  }`}
                  title="Customize Theme Colors"
                >
                  <Palette className="w-4 h-4 text-indigo-600 animate-pulse" />
                  <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                </button>
              )}

              {/* GROUP SELECTOR WORKSPACE (Middle Area) */}
              {activeProfile && (
                <div className="relative">
                  <div 
                    onClick={() => { setShowGroupPopover(!showGroupPopover); setShowProfilePopover(false); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer transition-all border text-[11px] font-extrabold ${
                      activeGroup 
                        ? 'border-indigo-100 bg-indigo-50/50 text-indigo-950 hover:bg-indigo-50 hover:border-indigo-200' 
                        : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100/50 animate-pulse'
                    }`}
                    id="switcher-group-trigger"
                  >
                    <span className="max-w-[85px] sm:max-w-[130px] truncate block flex items-center gap-1">
                      {activeGroup ? (
                        <>
                          <University className="w-3.5 h-3.5 text-indigo-650 shrink-0" />
                          <span>{activeGroup.name}</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-bounce" />
                          <span>Select Class</span>
                        </>
                      )}
                    </span>
                    <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
                  </div>
                </div>
              )}

              {/* PROFILE SELECTOR OR PROFILE TRIGGER */}
              {activeProfile ? (
                <div 
                  onClick={() => { 
                    setActiveTab('profile'); 
                    setShowProfilePopover(false); 
                    setShowGroupPopover(false); 
                  }}
                  className="w-8 h-8 rounded-full border-2 border-slate-200 hover:border-indigo-400 cursor-pointer relative shadow-3xs active:scale-95 transition-all overflow-hidden shrink-0"
                  id="switcher-identity-trigger"
                  title="View Profile Page"
                >
                  <img 
                    src={activeProfile.avatar} 
                    alt={activeProfile.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                </div>
              ) : (
                <div className="text-[10px] text-slate-450 font-bold px-1.5 py-1">No Login</div>
              )}

            </div>

          </div>

        {/* --- SECURE CREDENTIALS AUTHENTICATION (LANDING, SIGN-IN, SIGN-UP, FORGOT PASSWORD) --- */}
        <AnimatePresence>
          {!activeProfileId && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/98 z-50 flex items-center justify-center p-4 font-sans"
            >
              <div className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl text-left text-slate-900 my-auto">
                
                {/* Visual Header Branding */}
                <div className="text-center space-y-2 pb-1.5 shrink-0">
                  <h3 className="font-sans font-black text-xl text-slate-950 tracking-tight">CampusTrack: Task Management App</h3>
                  <p className="text-slate-500 text-xs">
                    {authMode === 'signin' && "Access your structured studies, checklists, progress timers, and cohort broadcasts."}
                    {authMode === 'signup' && "Create a secure profile and configure recovery keys to retain study materials."}
                    {authMode === 'forgot' && "Confirm your recovery challenge to reset your private account password."}
                  </p>
                </div>

                {/* Scrollable Form Area */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-4 mt-3">

                  {/* Status Banners */}
                  {formError && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span className="font-medium">{formError}</span>
                    </div>
                  )}
                  {formSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2 text-emerald-800 text-xs">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span className="font-medium">{formSuccess}</span>
                    </div>
                  )}

                  {/* SIGN IN FORM */}
                  {authMode === 'signin' && (
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Student Username</label>
                        <input
                          type="text"
                          placeholder="e.g. sarah2026"
                          value={newUserId}
                          onChange={(e) => setNewUserId(e.target.value)}
                          required
                          className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Secret Password</label>
                          <button 
                            type="button" 
                            onClick={() => { setAuthMode('forgot'); setRecoveryStep('username'); setFormError(null); setFormSuccess(null); }}
                            className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                          >
                            Forgot Password?
                          </button>
                        </div>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={signInPassword}
                          onChange={(e) => setSignInPassword(e.target.value)}
                          required
                          className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-all"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-indigo-650 hover:bg-slate-950 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-colors cursor-pointer mt-2"
                      >
                        Authenticate and Enter
                      </button>

                      <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-200"></div>
                        <span className="flex-shrink mx-4 text-slate-400 text-[9px] font-extrabold uppercase tracking-wider">or continue with</span>
                        <div className="flex-grow border-t border-slate-200"></div>
                      </div>

                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs shadow-sm transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4 text-indigo-650" />
                        <span>Sign In with Google</span>
                      </button>

                      <div className="text-center pt-3 mt-4 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">No account yet?</p>
                        <button
                          type="button"
                          onClick={() => { setAuthMode('signup'); setFormError(null); setFormSuccess(null); }}
                          className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-black py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-3xs"
                        >
                          <UserPlus className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                          <span>Create Student Account / Register</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* SIGN UP FORM */}
                  {authMode === 'signup' && (
                    <form onSubmit={handleRegisterProfile} className="space-y-3.5 pr-0.5">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Username</label>
                          <input
                            type="text"
                            placeholder="sarah2026"
                            value={newUserId}
                            onChange={(e) => setNewUserId(e.target.value)}
                            required
                            className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none transition-all"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Password</label>
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={signUpPassword}
                            onChange={(e) => setSignUpPassword(e.target.value)}
                            required
                            className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Display Name</label>
                        <input
                          type="text"
                          placeholder="Sarah Chang"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          required
                          className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Motto / Tagline</label>
                        <input
                          type="text"
                          placeholder="Gauss curves calculation sprints"
                          value={newUserTagline}
                          onChange={(e) => setNewUserTagline(e.target.value)}
                          className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Select Role</label>
                        <p className="text-[9.5px] text-slate-450 leading-tight">Organizes tasks, announcements, and schedules for appropriate members.</p>
                        <select
                          value={regUserRole}
                          onChange={(e) => setRegUserRole(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-650 rounded-xl px-2.5 py-2 text-xs text-slate-800 outline-none transition-all"
                        >
                          <option value="Student">Student</option>
                          <option value="Teacher">Teacher</option>
                          <option value="Class">Class</option>
                          <option value="School Department">School Department</option>
                          <option value="Administrative Office">Administrative Office</option>
                          <option value="School">School</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Gender</label>
                        <div className="flex gap-4 pt-1">
                          <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
                            <input
                              type="radio"
                              name="regGender"
                              value="male"
                              checked={regGender === 'male'}
                              onChange={() => setRegGender('male')}
                              className="accent-indigo-600 w-4 h-4 cursor-pointer"
                            />
                            Male
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
                            <input
                              type="radio"
                              name="regGender"
                              value="female"
                              checked={regGender === 'female'}
                              onChange={() => setRegGender('female')}
                              className="accent-indigo-600 w-4 h-4 cursor-pointer"
                            />
                            Female
                          </label>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-2 space-y-2">
                        <p className="text-[9.5px] font-black uppercase text-indigo-950 tracking-wider">Password Retrieval Config</p>
                        
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Security Question</label>
                          <select
                            value={securityQuestion}
                            onChange={(e) => setSecurityQuestion(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-250 rounded-xl px-2.5 py-2 text-xs text-slate-800 outline-none"
                          >
                            <option>What is your favorite school subject?</option>
                            <option>What was your first school's name?</option>
                            <option>What is your favorite academic book?</option>
                            <option>What city were you born in?</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Case-Insensitive Security Answer</label>
                          <input
                            type="text"
                            placeholder="Your secret answer e.g. Mathematics"
                            value={securityAnswer}
                            onChange={(e) => setSecurityAnswer(e.target.value)}
                            required
                            className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none transition-all"
                          />
                        </div>
                      </div>

                      {/* PORTRAIT PHOTO SELECTION FROM PHYS DEVICE */}
                      <div className="border-t border-slate-100 pt-2.5 space-y-1.5">
                        <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider block">Profile Picture</label>
                        <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                          <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-slate-200 bg-white shrink-0">
                            <img src={newUserAvatar || BLANK_WHITE_PICTURE} alt="Selected profile pointer" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex gap-2">
                              <label className="inline-flex items-center justify-center px-3 py-1 bg-indigo-50 border border-indigo-150 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-lg cursor-pointer transition-colors select-none">
                                <UploadCloud className="w-3.5 h-3.5 mr-1 text-indigo-650 shrink-0" />
                                Choose Photo
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    try {
                                      const base64Data = await compressImage(file);
                                      setNewUserAvatar(base64Data);
                                    } catch (err: any) {
                                      console.error("Profile picture upload failed:", err);
                                    }
                                  }}
                                  className="hidden"
                                />
                              </label>
                              {newUserAvatar !== BLANK_WHITE_PICTURE && (
                                <button
                                  type="button"
                                  onClick={() => setNewUserAvatar(BLANK_WHITE_PICTURE)}
                                  className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                                >
                                  Clear Photo
                                </button>
                              )}
                            </div>
                            <p className="text-[8px] text-slate-450 leading-tight">Attach portrait from device storage. Falls back to pristine white card template.</p>
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-indigo-650 hover:bg-slate-950 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-colors cursor-pointer mt-3"
                      >
                        Establish Secured Student Profile
                      </button>

                      <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-200"></div>
                        <span className="flex-shrink mx-4 text-slate-400 text-[9px] font-extrabold uppercase tracking-wider">or continue with</span>
                        <div className="flex-grow border-t border-slate-200"></div>
                      </div>

                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs shadow-sm transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4 text-indigo-650" />
                        <span>Sign Up with Google</span>
                      </button>

                      <div className="text-center pt-1.5">
                        <button
                          type="button"
                          onClick={() => { setAuthMode('signin'); setFormError(null); setFormSuccess(null); }}
                          className="text-xs font-semibold text-slate-500 hover:text-indigo-650 cursor-pointer"
                        >
                          Already registered? <span className="text-indigo-600 font-extrabold underline">Sign In</span>
                        </button>
                      </div>
                    </form>
                  )}

                {/* FORGOT PASSWORD FORM */}
                {authMode === 'forgot' && (
                  <div className="space-y-4">
                    {recoveryStep === 'username' && (
                      <form onSubmit={handleRecoverFetchQuestion} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Enter Your Student Username</label>
                          <input
                            type="text"
                            placeholder="e.g. sarah2026"
                            value={recoveryUsername}
                            onChange={(e) => setRecoveryUsername(e.target.value)}
                            required
                            className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-all"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full bg-slate-900 hover:bg-indigo-650 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-colors cursor-pointer"
                        >
                          Verify Recovery Details
                        </button>
                      </form>
                    )}

                    {recoveryStep === 'answer' && (
                      <form onSubmit={handleRecoverSubmitReset} className="space-y-4">
                        <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                          <p className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider font-mono">Profile Security Question:</p>
                          <p className="text-xs font-black text-slate-950 mt-1">{recoveryQuestion}</p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Your Secure Recovery Answer</label>
                          <input
                            type="text"
                            placeholder="Write your setup response..."
                            value={recoveryAnswerInput}
                            onChange={(e) => setRecoveryAnswerInput(e.target.value)}
                            required
                            className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-all"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Set Your New Password</label>
                          <input
                            type="password"
                            placeholder="Type new secure password"
                            value={recoveryNewPassword}
                            onChange={(e) => setRecoveryNewPassword(e.target.value)}
                            required
                            className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-all"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-indigo-650 hover:bg-slate-950 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-colors cursor-pointer"
                        >
                          Configure Password Access
                        </button>
                      </form>
                    )}

                    {recoveryStep === 'done' && (
                      <div className="space-y-3 text-center">
                        <p className="text-xs text-slate-600">Your student password credentials were updated. Please sign in with your updated credentials.</p>
                        <button
                          onClick={() => { setAuthMode('signin'); setRecoveryStep('username'); setRecoveryUsername(''); setFormSuccess(null); }}
                          className="w-full bg-slate-950 hover:bg-indigo-650 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-colors cursor-pointer"
                        >
                          Proceed to Authentication Sign-In
                        </button>
                      </div>
                    )}

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => { setAuthMode('signin'); setRecoveryStep('username'); setRecoveryUsername(''); setFormError(null); setFormSuccess(null); }}
                        className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                      >
                        ← Back to Sign In
                      </button>
                    </div>
                  </div>
                )}

                {/* CONNECTION SETTINGS COLLAPSIBLE FOR MOBILE/APK ACCESS */}
                <div className="pt-2 border-t border-slate-100 flex flex-col mt-4 mt-auto">
                  <button
                    type="button"
                    onClick={() => setShowLoginConnSettings(!showLoginConnSettings)}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center justify-between w-full py-2 cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <Link className="w-3.5 h-3.5 text-slate-450" />
                      System & Connection Settings
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showLoginConnSettings ? 'rotate-180' : ''}`} />
                  </button>

                  {showLoginConnSettings && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-1 bg-slate-50 border border-slate-200/65 p-3 rounded-2xl space-y-2 text-left"
                    >
                      <p className="text-[10px] text-slate-450 leading-tight">
                        If running in a compiled APK or custom WebView environment, specify your deployment's base server URL to sync your databases properly.
                      </p>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">API Base Server URL</label>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={serverApiUrl}
                            onChange={(e) => {
                              const val = e.target.value;
                              setServerApiUrl(val);
                              if (val.trim()) {
                                localStorage.setItem('studysync_server_api_url', val.trim());
                              } else {
                                localStorage.removeItem('studysync_server_api_url');
                              }
                            }}
                            placeholder="e.g. https://ais-pre-4tgsuzuwe3pwzlzchjfwfx-1044932737425.asia-southeast1.run.app"
                            className="flex-1 bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500 transition-colors animate-none"
                          />
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono flex items-center justify-between pt-0.5">
                          <span>Active URL:</span>
                          <span className="font-bold text-slate-600 truncate max-w-[180px]">
                            {getApiUrl('/api/data').replace('/api/data', '') || 'Browser Default'}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- IDENTITY POPOVER ACCOUNT DETAILS --- */}
        <AnimatePresence>
          {showProfilePopover && (
            <>
              <div onClick={() => setShowProfilePopover(false)} className="fixed inset-0 bg-black/25 z-40 transition-opacity" />
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute left-3 right-3 top-14 bg-white border border-slate-200 rounded-2xl shadow-xl p-3.5 z-50 space-y-3 font-sans"
              >
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-black border-b pb-2 flex justify-between items-center">
                  <span>Student Profile</span>
                  <span className="bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded text-[8px]">Authenticated Session</span>
                </div>

                <div className="space-y-1">
                  {activeProfile ? (
                    <div className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-150">
                      <div className="flex items-center gap-2.5 text-left">
                        <img src={activeProfile.avatar} alt={activeProfile.name} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                        <div>
                          <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1">
                            <span>{activeProfile.name}</span>
                            {activeProfile.equippedBadge && <BadgeIcon emoji={activeProfile.equippedBadge} className="w-3 h-3" />}
                          </h5>
                          <p className="text-[9px] text-slate-400 truncate max-w-[180px] font-mono italic">{activeProfile.tagline}</p>
                        </div>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Active session" />
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic text-center py-2">Loading profile details...</p>
                  )}
                </div>

                {/* Sign Out Button only */}
                <div className="pt-2 border-t border-slate-100 flex">
                  <button
                    onClick={handleLogout}
                    className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 py-1.5 px-3 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer border border-rose-200 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* --- STUDY CLASSROOM GROUP SELECTOR / ATTACH POPOVER --- */}
        <AnimatePresence>
          {showGroupPopover && (
            <>
              <div onClick={() => setShowGroupPopover(false)} className="fixed inset-0 bg-black/25 z-40 transition-opacity" />
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute left-3 right-3 top-14 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 space-y-3 font-sans text-left"
              >
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-extrabold pb-1.5 border-b flex justify-between">
                  <span>Switch Study Group context</span>
                  <span className="text-[8px] italic text-indigo-600 font-bold">Cloud Synced</span>
                </div>

                {/* list joined groups */}
                <div className="space-y-1">
                  {joinedGroups.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic py-2 text-center">You have not joined any study groups yet.</p>
                  ) : (
                    joinedGroups.map(group => {
                      const isOwner = group.creatorId === activeProfileId;
                      return (
                        <button
                          key={group.id}
                          onClick={() => {
                            setActiveGroupId(group.id);
                            localStorage.setItem('studysync_group_id', group.id);
                            setShowGroupPopover(false);
                            setActiveTab('tasks');
                          }}
                          className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                            activeGroupId === group.id 
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-950 font-bold' 
                              : 'bg-white hover:bg-slate-50 border-slate-150 text-slate-650'
                          }`}
                        >
                          <div>
                            <span className="text-xs font-bold block">{group.name}</span>
                            <span className="text-[8.5px] font-mono text-slate-400 uppercase tracking-widest">{isOwner ? '👑 Administrator Code:' : '🔑 Enrolled Code:'} {group.id}</span>
                          </div>
                          {activeGroupId === group.id && <Check className="w-3.5 h-3.5 text-indigo-600 stroke-[3]" />}
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Trigger to invite / join screens */}
                <div className="pt-2 border-t border-slate-100 flex gap-2">
                  <button
                    onClick={() => {
                      setActiveGroupId(null);
                      localStorage.removeItem('studysync_group_id');
                      setShowGroupPopover(false);
                      setActiveTab('classroom');
                    }}
                    className="flex-1 bg-indigo-600 hover:bg-slate-950 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] flex items-center justify-center gap-1 cursor-pointer shadow-3xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Join / Create Group
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* --- MAIN PAGE CONTENT OUTLET (DYNAMIC TAB RENDERING) --- */}
        <div 
          className={`flex-1 overflow-y-auto ${theme.mode.bodyBg} pb-20 select-none relative`}
          onTouchStart={(e) => {
            const container = e.currentTarget;
            if (container.scrollTop === 0) {
              setIsPulling(true);
              pullStartY.current = e.touches[0].clientY;
            }
          }}
          onTouchMove={(e) => {
            if (!isPulling) return;
            const container = e.currentTarget;
            const currentY = e.touches[0].clientY;
            const diff = currentY - pullStartY.current;
            if (diff > 0 && container.scrollTop === 0) {
              const pullDist = Math.min(100, diff * 0.4);
              setPullDistance(pullDist);
              if (e.cancelable) {
                e.preventDefault();
              }
            }
          }}
          onTouchEnd={() => {
            setIsPulling(false);
            if (pullDistance >= 50) {
              handleForceSync();
            } else {
              setPullDistance(0);
            }
          }}
        >
          {/* PULL TO REFRESH INDICATOR */}
          {pullDistance > 0 && (
            <div 
              className="w-full flex items-center justify-center overflow-hidden transition-all duration-75 bg-slate-50 border-b border-slate-100"
              style={{ height: `${pullDistance}px` }}
            >
              <div className="flex items-center gap-2 py-1">
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 transition-transform ${pullDistance >= 50 ? 'rotate-180 duration-150' : ''}`} />
                <span className="font-bold text-[10px] text-slate-600">
                  {pullDistance >= 50 ? 'Release to Sync & Retrieve' : 'Pull down to refresh...'}
                </span>
              </div>
            </div>
          )}

          {/* ACTIVE REFRESHING INDICATION */}
          {isRefreshing && (
            <div className="w-full h-10 flex items-center justify-center bg-indigo-50/50 border-b border-indigo-150 text-indigo-950 font-sans">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                <span className="font-extrabold text-[10px] uppercase tracking-wider animate-pulse">Syncing offline database queue...</span>
              </div>
            </div>
          )}

          {/* OFFLINE STATUS BANNER */}
          {!isOnline && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-3 text-amber-800 text-xs font-semibold animate-in fade-in duration-300">
              <div className="flex items-center gap-2 text-left">
                <WifiOff className="w-4 h-4 text-amber-600 shrink-0 animate-bounce" />
                <div>
                  <span className="block font-black text-amber-900 leading-none mb-0.5">Device Offline — Cached Mode</span>
                  <span className="block text-[10px] text-amber-700 font-medium">No connection detected. Edits are saved locally and will auto-sync when online.</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleForceSync}
                disabled={isRefreshing}
                className="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shrink-0 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isRefreshing ? 'Checking...' : 'Sync Now'}
              </button>
            </div>
          )}
          
          {/* THEME PREVIEW BANNER */}
          {hasUnsavedThemeChanges && (
            <div className="sticky top-0 z-30 bg-slate-950/95 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md shadow-lg border-b border-slate-800 text-xs font-bold font-sans animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                <div className="text-left">
                  <span className="block text-xs font-black text-amber-400 tracking-tight leading-none mb-0.5">🎨 Theme Preview Mode</span>
                  <span className="block text-[9.5px] text-slate-400 font-medium">Previewing modifications live. Save to make them persistent.</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSaveThemeChanges}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer shadow-sm hover:scale-102 active:scale-98"
                  style={{ backgroundColor: customColor }}
                >
                  Save & Apply
                </button>
                <button
                  type="button"
                  onClick={handleDiscardThemeChanges}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer hover:scale-102 active:scale-98"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
          
          {/* SYNC REFRESHING OVERLAY */}
          {syncing && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white border border-slate-700 font-mono text-[9px] uppercase tracking-widest py-1 px-3.5 rounded-full z-40 shadow-md flex items-center gap-1.5 animate-bounce">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Updating Database ...</span>
            </div>
          )}

          {activeProfile && activeTab === 'productivity' ? (
            <div className="p-4 sm:p-5">
              <WeeklyProductivity 
                activeProfile={activeProfile} 
                tasks={tasks} 
                completions={completions}
                activeGroupId={activeGroupId}
              />
            </div>
          ) : activeProfile && (activeTab === 'profile' || activeTab === 'streaks') ? (
            <div className="p-4 sm:p-5 space-y-6 text-left font-sans max-h-full overflow-y-auto pb-24">
              {/* Header section with cover design */}
              <div className="relative rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-3xs p-5 sm:p-6 flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
                {/* Visual Cover Accent bar */}
                <div className="absolute top-0 left-0 right-0 h-2" style={{ backgroundColor: customColor }} />
                
                {/* Left: Avatar Upload / Picture Showcase */}
                <div className="relative shrink-0 mt-2">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-100 bg-white shadow-sm relative group">
                    <img 
                      src={editAvatar || BLANK_WHITE_PICTURE} 
                      alt={activeProfile.name} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                    {/* Hover state overlay to indicate editability */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                      <span className="text-[9px] text-white font-bold font-sans uppercase tracking-wider">Photo Linked</span>
                    </div>
                  </div>
                  {activeProfile.equippedBadge && (
                    <div className="absolute -bottom-1 -right-1 bg-white border border-slate-150 w-8 h-8 rounded-full flex items-center justify-center shadow-md animate-bounce" title="Equipped Badge">
                      <BadgeIcon emoji={activeProfile.equippedBadge} className="w-5 h-5" />
                    </div>
                  )}
                </div>

                {/* Middle: Profile Info Text */}
                <div className="flex-1 space-y-3.5">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                      <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-none">
                        {activeProfile.name}
                      </h2>
                      <span className="text-[10px] bg-slate-100 text-slate-705 border border-slate-200 px-2.5 py-0.5 rounded-full font-sans font-bold flex items-center gap-1">
                        <RoleIcon role={activeProfile.role} className="w-3 h-3 text-slate-550" />
                        {activeProfile.role || 'Student'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium font-sans italic">
                      {activeProfile.tagline || "No tagline added. Edit your profile to share your student motto!"}
                    </p>
                  </div>

                  {/* Summary Micro-stats boxes */}
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-1">
                    <div className="bg-slate-50 border border-slate-150 px-3 py-1.5 rounded-xl text-left">
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Classrooms</span>
                      <span className="text-sm font-black text-slate-805 font-sans leading-none mt-0.5 block">
                        {joinedGroups.length} Enrolled
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-150 px-3 py-1.5 rounded-xl text-left">
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Badges Unlocked</span>
                      <span className="text-sm font-black text-indigo-650 font-sans leading-none mt-0.5 block">
                        {(() => {
                          try {
                            return JSON.parse(activeProfile.badges || '[]').length;
                          } catch {
                            return 0;
                          }
                        })()} / 7
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-150 px-3 py-1.5 rounded-xl text-left">
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Login Streak</span>
                      <span className="text-sm font-black text-orange-600 font-sans leading-none mt-0.5 block flex items-center gap-0.5">
                        🔥 {activeProfile.dailyLoginStreak || 1} Days
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions (Inline edit toggle and logout) */}
                <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto mt-2 md:mt-0">
                  <button
                    onClick={() => setIsEditingProfileInline(!isEditingProfileInline)}
                    className="flex-1 md:w-full bg-slate-100 hover:bg-slate-200 text-slate-850 font-extrabold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-3xs border border-slate-200"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{isEditingProfileInline ? "Close Editor" : "Edit Details"}</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 md:w-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-750 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-3xs"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-550" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Edit form panel inline */}
              <AnimatePresence>
                {isEditingProfileInline && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <form 
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!activeProfileId || !editName.trim()) return;
                        try {
                          await updateProfile(activeProfileId, {
                            name: editName.trim(),
                            tagline: editTagline.trim(),
                            avatar: editAvatar,
                            gender: editGender,
                            role: editUserRole,
                            appMode: editUserRole
                          });
                          setIsEditingProfileInline(false);
                          setSettingsSaveSuccess(true);
                          setTimeout(() => setSettingsSaveSuccess(false), 2500);
                        } catch (err: any) {
                          console.error(err);
                          alert(err.message || "Failed to update profile.");
                        }
                      }}
                      className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-3xs text-left"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <Edit3 className="w-4 h-4 text-indigo-650" />
                          <h4 className="font-sans font-black text-slate-900 text-sm tracking-tight">Modify Student Profile Details</h4>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Changes sync in real-time</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Student Name</label>
                          <input 
                            type="text" 
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="e.g., Alex Johnson"
                            required
                            className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-650 rounded-xl px-3.5 py-2.5 text-xs text-slate-850 outline-none transition-all shadow-3xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Bio Motto / Tagline</label>
                          <input 
                            type="text" 
                            value={editTagline}
                            onChange={(e) => setEditTagline(e.target.value)}
                            placeholder="e.g., Computer Science '27"
                            className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-650 rounded-xl px-3.5 py-2.5 text-xs text-slate-850 outline-none transition-all shadow-3xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-sans">Select Role Type</label>
                          <select
                            value={editUserRole}
                            onChange={(e) => setEditUserRole(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-650 rounded-xl px-3.5 py-2.5 text-xs text-slate-850 outline-none transition-all shadow-3xs cursor-pointer"
                          >
                            <option value="Student">Student</option>
                            <option value="Teacher">Teacher</option>
                            <option value="Class">Class</option>
                            <option value="School Department">School Department</option>
                            <option value="Administrative Office">Administrative Office</option>
                            <option value="School">School</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-sans">Profile Photograph upload</label>
                          <div className="flex items-center gap-2">
                            <label className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-indigo-50 border border-indigo-150 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl cursor-pointer transition-all select-none">
                              <UploadCloud className="w-4 h-4 mr-1.5 text-indigo-650" />
                              Choose Photo File
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    const base64Data = await compressImage(file);
                                    setEditAvatar(base64Data);
                                  } catch (err: any) {
                                    console.error("Profile image upload failed:", err);
                                  }
                                }}
                                className="hidden"
                              />
                            </label>
                            {editAvatar !== BLANK_WHITE_PICTURE && (
                              <button
                                type="button"
                                onClick={() => setEditAvatar(BLANK_WHITE_PICTURE)}
                                className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-sans">Gender</label>
                          <select
                            value={editGender}
                            onChange={(e) => setEditGender(e.target.value as 'male' | 'female')}
                            className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-650 rounded-xl px-3.5 py-2.5 text-xs text-slate-850 outline-none transition-all shadow-3xs cursor-pointer"
                          >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingProfileInline(false)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-705 font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="bg-indigo-650 hover:bg-indigo-750 text-white font-black px-5 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-indigo-650/15"
                          style={{ backgroundColor: customColor }}
                        >
                          Save Details
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Streaks & Achievements Board embedded on Profile Page */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pl-1">
                  <Trophy className="w-4.5 h-4.5 text-indigo-650 animate-bounce" />
                  <h3 className="font-sans font-black text-slate-900 text-sm sm:text-base tracking-tight uppercase">
                    My Learning Streaks & Achievements
                  </h3>
                </div>
                
                <StreaksAchievements 
                  activeProfile={activeProfile} 
                  tasks={tasks} 
                  onUpdateProfile={async (updatedData) => {
                    try {
                      await updateProfile(activeProfileId!, updatedData);
                    } catch (e) {
                      console.error("Failed to update profile", e);
                    }
                  }}
                  apiUrlHelper={getApiUrl}
                  setActiveTab={setActiveTab as any}
                  activeGroupId={activeGroupId}
                />
              </div>
            </div>
          ) : activeProfile && !activeGroupId ? (
            /* --- NO ACTIVE GROUP SELECTION BOARD --- */
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 space-y-6 text-left"
            >
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-600">Enrolled student: {activeProfile.name}</span>
                  <h3 className="text-lg font-black tracking-tight text-slate-900 leading-tight">Enroll In A Homework Sync Workroom</h3>
                  <p className="text-slate-400 text-xs">Join an active classroom study group to download curriculum synced tasks, milestones, or manage your personal study planners.</p>
                </div>

                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs flex gap-1.5 items-center">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* JOIN GROUP METHOD */}
                <div className="border bg-slate-50 border-slate-150 p-4 rounded-2xl space-y-3">
                  <span className="text-[10px] font-mono tracking-widest text-slate-450 uppercase font-black block">🔑 JOIN GROUP WITH CODE</span>
                  <form onSubmit={handleJoinGroup} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. g-XYZA92"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      required
                      className="flex-1 uppercase bg-white border border-slate-250 font-bold tracking-widest text-center focus:border-indigo-600 focus:outline-none rounded-xl px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-slate-950 text-white px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      Enroll Code
                    </button>
                  </form>
                </div>

                <div className="relative flex py-1.5 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-4 text-slate-400 font-mono text-[9px] uppercase tracking-widest font-bold">OR</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                {/* CREATE GROUP METHOD */}
                <div className="border bg-indigo-50/20 border-indigo-100 p-4 rounded-2xl space-y-3">
                  <span className="text-[10px] font-mono tracking-widest text-indigo-950 uppercase font-black block">📝 CREATE A NEW CLASSROOM STUDYROOM</span>
                  <form onSubmit={handleCreateGroup} className="space-y-3">
                    <input
                      type="text"
                      placeholder="e.g. Calculus BC Unit 5"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-200 focus:border-indigo-600 focus:outline-none rounded-xl px-3 py-2 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="e.g. Curricula, checklist sync assignments"
                      value={newGroupDesc}
                      onChange={(e) => setNewGroupDesc(e.target.value)}
                      className="w-full bg-white border border-slate-202 focus:border-indigo-600 focus:outline-none rounded-xl px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="w-full bg-slate-900 hover:bg-slate-950 text-white py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      Establish Studyroom Group
                    </button>
                  </form>
                </div>
              </div>


            </motion.div>
          ) : activeProfile && activeGroupId ? (
            
            <AnimatePresence mode="wait">
              
              {/* --- TAB 1: WORKLOADS (TASKS FEED) --- */}
              {activeTab === 'tasks' && (
                <motion.div
                  key="tasks-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 space-y-4"
                >
                  {/* OVERALL CLASSROOM WORKLOAD PROGRESS BAR */}
                  {(() => {
                    const metrics = activeGroupProgressMetrics;
                    const getProgressColor = (pct: number) => {
                      if (pct === 100) return 'from-emerald-500 to-teal-500';
                      if (pct >= 75) return 'from-blue-500 to-indigo-600';
                      if (pct >= 50) return 'from-indigo-500 to-purple-600';
                      if (pct >= 25) return 'from-amber-500 to-orange-500';
                      return 'from-rose-500 to-red-600';
                    };

                    return (
                      <div className="w-full relative overflow-visible transition-all duration-300">
                        <div 
                          id="overall-progress-bar-container"
                          onClick={() => {
                            if (metrics.percent === 100 && metrics.total > 0) {
                              setShowGlobalCongratulation(true);
                            } else if (metrics.total > 0) {
                              setShowProgressDetails(!showProgressDetails);
                            }
                          }}
                          className={`w-full py-2 px-1 text-left relative overflow-visible transition-all duration-300 rounded-xl hover:bg-slate-50/85 px-2 -mx-2 select-none ${
                            metrics.total > 0 ? 'cursor-pointer' : ''
                          }`}
                        >
                          {/* Status Label on Top */}
                          <div className="flex items-center justify-between mb-2 pl-0.5 text-slate-700">
                            <div className="flex items-center gap-1.5">
                              {metrics.percent === 100 && metrics.total > 0 ? (
                                <Trophy className="w-3.5 h-3.5 text-emerald-600 shrink-0 animate-bounce" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0 animate-pulse" />
                              )}
                              <span className="text-[11px] font-sans font-bold text-slate-800 tracking-tight flex items-center gap-1">
                                {metrics.total === 0 ? (
                                  "No workloads published yet. Get started by adding tasks!"
                                ) : metrics.percent === 100 ? (
                                  "You completed all the task, good job! 🎉✨"
                                ) : (
                                  <>
                                    <span>You still have some task to do</span>
                                    <span className="text-[9.5px] font-medium text-indigo-605 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-150 ml-1">
                                      {showProgressDetails ? 'Hide details' : 'View details'}
                                    </span>
                                  </>
                                )}
                              </span>
                            </div>
                            {metrics.total > 0 && (
                              <span className={`text-[10px] font-mono font-black shrink-0 ${
                                metrics.percent === 100 
                                  ? 'text-emerald-600' 
                                  : 'text-indigo-600'
                              }`}>
                                {metrics.percent}% Complete
                              </span>
                            )}
                          </div>

                          {/* Really Thin Progress Bar with Infinite Floating Particle Emitter when Completed */}
                          {metrics.total > 0 && (
                            <div className="relative w-full overflow-visible">
                              <div className="relative w-full bg-slate-100 border border-slate-200/20 rounded-full h-1.5 overflow-hidden flex items-center shadow-inner">
                                <motion.div 
                                  className={`h-full bg-gradient-to-r ${getProgressColor(metrics.percent)} rounded-full`}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${metrics.percent}%` }}
                                  transition={{ duration: 0.8, ease: "easeOut" }}
                                />
                              </div>

                              {/* Particle Emitter */}
                              {metrics.percent === 100 && (
                                <div className="absolute inset-0 pointer-events-none overflow-visible">
                                  {Array.from({ length: 15 }).map((_, i) => (
                                    <ProgressBarParticle key={i} delay={i * 0.15} type={i % 2 === 0 ? 'circle' : 'emoji'} />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* DETAILED PROGRESS BREAKDOWN */}
                        {showProgressDetails && metrics.percent < 100 && metrics.total > 0 && (() => {
                          const groupTasks = tasks.filter(t => 
                            t.groupId === activeGroupId && 
                            !t.isArchived && 
                            (t.isSynced || t.classmateId === activeProfileId)
                          );

                          const incompleteItems = groupTasks.map(t => {
                            const isComp = t.isSynced 
                              ? !!completions.find(c => c.classmateId === activeProfileId && c.taskId === t.id)?.completed
                              : (!!t.completed || t.status === 'completed');
                            
                            const subtasks = t.subtasks || [];
                            const totalSubsCount = subtasks.length;
                            const completedSubsCount = subtasks.filter(s => s.completed).length;
                            
                            return {
                              task: t,
                              isComp,
                              totalSubsCount,
                              completedSubsCount,
                              isFullyComplete: isComp
                            };
                          }).filter(item => !item.isFullyComplete);

                          return (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-3 mt-1 space-y-2.5 text-left font-sans text-stone-800 shadow-xs overflow-hidden"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                                  <Info className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Workload Progress Breakdown</span>
                                </div>
                                <button 
                                  onClick={() => setShowProgressDetails(false)}
                                  className="text-[10px] text-slate-400 hover:text-slate-650 font-bold"
                                >
                                  Close
                                </button>
                              </div>

                              <p className="text-[10px] text-slate-500 leading-normal">
                                This progress bar represents the weighted completion of all your assignments and their individual milestones/subtasks. Below are the items keeping you from 100%:
                              </p>

                              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 no-scrollbar">
                                {incompleteItems.length === 0 ? (
                                  <p className="text-[10.5px] text-emerald-700 font-bold">No incomplete items remaining! If the bar is not 100%, check for archived tasks.</p>
                                ) : (
                                  incompleteItems.map(({ task, isComp, totalSubsCount, completedSubsCount }) => (
                                    <div key={task.id} className="bg-white border border-slate-150 p-2 rounded-xl flex flex-col gap-1 shadow-2xs">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex flex-col">
                                          <div className="flex items-center gap-1">
                                            <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded-md ${
                                              task.isSynced 
                                                ? 'bg-indigo-50 text-indigo-750 border border-indigo-150' 
                                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                                            }`}>
                                              {task.isSynced ? 'Synced' : 'Personal'}
                                            </span>
                                            <span className="text-[11px] font-bold text-slate-800 line-clamp-1">{task.title}</span>
                                          </div>
                                          {task.category && (
                                            <span className="text-[9px] text-slate-450 mt-0.5">Category: {task.category}</span>
                                          )}
                                        </div>
                                        <button
                                          onClick={() => toggleTaskCompleteness(task)}
                                          className="text-[9.5px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200 transition-all shrink-0"
                                        >
                                          Check main task
                                        </button>
                                      </div>

                                      <div className="flex items-center gap-4 mt-1 border-t border-slate-50 pt-1.5 text-[10px] text-slate-600">
                                        <div className="flex items-center gap-1">
                                          <span className="text-slate-400">Main Checkbox:</span>
                                          <span className={`font-bold flex items-center gap-0.5 ${isComp ? 'text-emerald-600' : 'text-amber-600'}`}>
                                            {isComp ? '✓ Done' : '✗ Pending'}
                                          </span>
                                        </div>
                                        {totalSubsCount > 0 && (
                                          <div className="flex items-center gap-1">
                                            <span className="text-slate-400">Milestones:</span>
                                            <span className={`font-bold ${completedSubsCount === totalSubsCount ? 'text-emerald-600' : 'text-slate-600'}`}>
                                              {completedSubsCount}/{totalSubsCount} completed
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {totalSubsCount > 0 && completedSubsCount === totalSubsCount && !isComp && (
                                        <div className="text-[9.5px] text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-lg mt-1 font-medium">
                                          💡 Tip: All subtasks are complete! Just check off the main task above to finish it.
                                        </div>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            </motion.div>
                          );
                        })()}
                      </div>
                    );
                  })()}

                  {/* COLLAPSIBLE ANNOUNCEMENTS FEED BANNER (MINIMIZED) */}
                  <div id="announcements-banner-container" className="bg-slate-50 border border-slate-200 rounded-xl p-2 px-3.5 shadow-3xs">
                    <button
                      type="button"
                      onClick={() => setShowAnnouncements(!showAnnouncements)}
                      className="w-full flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Bell className="w-3.5 h-3.5 text-slate-550" />
                        <div>
                          <span className="font-sans font-bold text-slate-850 text-xs tracking-tight block">
                            Class Announcements
                          </span>
                          <span className="text-[9px] text-slate-450 block leading-none font-sans mt-0.5">
                            {activeGroupAnnouncements.length === 0 
                              ? 'No announcements posted' 
                              : `${activeGroupAnnouncements.length} update${activeGroupAnnouncements.length > 1 ? 's' : ''}`}
                          </span>
                        </div>
                      </div>
                      <span className="text-slate-600 text-[9.5px] font-bold bg-white px-2 py-1 rounded-lg border border-slate-200 flex items-center gap-1 hover:bg-slate-50 shadow-3xs">
                        {showAnnouncements ? 'Collapse' : 'Expand'}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAnnouncements ? 'rotate-180' : ''}`} />
                      </span>
                    </button>

                    {showAnnouncements && (
                      <div className="mt-3.5 pt-3.5 border-t border-slate-250 space-y-3.5">
                        {/* Announcement compiler */}
                        {permissions.canAnnounce ? (
                          <div className="space-y-2">
                            {announcementImage && (
                              <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 p-2 rounded-xl relative max-w-xs text-left">
                                <img src={announcementImage} alt="Announcement picture preview" className="w-10 h-10 rounded-lg object-cover border" />
                                <div className="text-left font-sans">
                                  <span className="text-[10px] font-black text-slate-800 block">Image Selected</span>
                                  <span className="text-[8.5px] text-slate-400 block font-sans">Ready to broadcast</span>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => setAnnouncementImage(null)}
                                  className="absolute top-1 right-1 p-0.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-full text-slate-650 cursor-pointer"
                                  title="Delete Preview"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            <form onSubmit={handlePostAnnouncement} className="flex gap-2">
                              {/* Image upload button */}
                              <label className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-205 text-slate-500 hover:text-slate-800 rounded-xl cursor-pointer transition-colors relative shrink-0 flex items-center justify-center shadow-3xs" title="Select Picture">
                                <Image className="w-4 h-4 text-indigo-650" />
                                <input 
                                  type="file" 
                                  accept="image/*"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    try {
                                      const base64Data = await compressImage(file);
                                      setAnnouncementImage(base64Data);
                                    } catch (err: any) {
                                      console.error("Announcement image upload compression failed:", err);
                                    }
                                  }}
                                  className="hidden" 
                                />
                              </label>

                              <input
                                type="text"
                                placeholder="Post critical lesson, homework reminders..."
                                value={newAnnouncement}
                                onChange={(e) => setNewAnnouncement(e.target.value)}
                                className="flex-1 bg-slate-50 border border-slate-205 focus:bg-white focus:border-indigo-400 rounded-xl px-3.5 py-2.5 text-xs text-slate-850 outline-none shadow-3xs"
                              />

                              <button
                                type="submit"
                                disabled={!newAnnouncement.trim() && !announcementImage}
                                className="bg-slate-900 hover:bg-slate-950 text-white p-2.5 rounded-xl transition-colors cursor-pointer shrink-0 disabled:opacity-40 flex items-center justify-center"
                                title="Post Broadcast"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            </form>
                          </div>
                        ) : (
                          <div className="p-2.5 bg-slate-50/75 border border-slate-150 rounded-xl flex gap-1.5 items-center text-slate-400 text-[10.5px]">
                            <Shield className="w-3.5 h-3.5 shrink-0" />
                            <span>Only users granted classmate announcements permission by the group leader/creator can publish.</span>
                          </div>
                        )}

                        {/* Broadcast feed cards list */}
                        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-0.5">
                          {activeGroupAnnouncements.length === 0 ? (
                            <p className="italic text-[10.5px] text-slate-400 text-center py-4 bg-slate-50 rounded-xl">No active announcements posted.</p>
                          ) : (
                            activeGroupAnnouncements.map(ann => {
                              const isLeaderPost = memberships.find(m => m.groupId === activeGroupId && m.userId === ann.userId)?.role === 'leader';
                              const annProfile = profiles.find(p => p.id === ann.userId);
                              return (
                                <div key={ann.id} className="bg-white p-3.5 border border-slate-150 rounded-xl space-y-2 text-left shadow-3xs">
                                  <div className="flex items-center gap-2 justify-between">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <img src={ann.userAvatar} alt="Announcement Author icon" className="w-6 h-6 rounded-full object-cover border shrink-0" referrerPolicy="no-referrer" />
                                      <div className="min-w-0">
                                        <span className="text-[10.5px] font-black text-slate-955 truncate block leading-tight flex items-center gap-1">
                                          <span>{ann.userName}</span>
                                          {annProfile?.equippedBadge && <BadgeIcon emoji={annProfile.equippedBadge} className="w-3.5 h-3.5" />}
                                        </span>
                                        <span className="text-[8px] font-mono text-slate-405 block leading-none">{ann.createdAt}</span>
                                      </div>
                                    </div>
                                    {isLeaderPost && (
                                      <span className="text-[7.5px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1 rounded font-black font-mono">
                                        ADMIN
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-700 whitespace-pre-line leading-relaxed pl-0.5 font-sans">
                                    {ann.content}
                                  </p>
                                  {ann.imageAttachment && (
                                    <div className="mt-2.5 rounded-xl overflow-hidden border border-slate-150 max-h-[180px] max-w-[280px] bg-white">
                                      <img 
                                        referrerPolicy="no-referrer"
                                        src={ann.imageAttachment} 
                                        alt="Announcement Broadcast Attachment image" 
                                        className="w-full h-full object-cover shrink-0 cursor-zoom-in"
                                        onClick={() => window.open(ann.imageAttachment!, '_blank')} 
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CUSTOMIZABLE CATEGORIES PILLS SLIDER (MINIMIZED) */}
                  <div className="space-y-1 text-left font-sans">
                    <span id="subject-categories-header" className="text-[9px] font-mono text-slate-400 font-extrabold uppercase tracking-widest pl-1 block">Subject Categories</span>
                    {loadedCategories.length <= 1 ? (
                      <p className="text-[10px] text-slate-400 italic pl-1">No custom tags registered. Use "Create Task" tab to log subjects.</p>
                    ) : (
                      <div className="flex gap-1 overflow-x-auto pb-1 px-0.5 no-scrollbar scroll-smooth">
                        {loadedCategories.map(cat => {
                          const isCatActive = selectedCategory.toLowerCase() === cat.toLowerCase();
                          return (
                            <button
                              key={cat}
                              onClick={() => setSelectedCategory(cat)}
                              className={`text-[9.5px] font-bold px-2.5 py-1 rounded-lg border shrink-0 transition-all cursor-pointer ${
                                isCatActive 
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-3xs scale-102' 
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {cat}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* CLASSMATE SYNC SCOPE FILTER BOX */}
                  <div id="classmate-sync-filter-box" className="flex gap-1 bg-slate-200/60 p-1 rounded-xl font-sans text-stone-700 text-left">
                    <button
                      onClick={() => setSelectedScope('all')}
                      className={`flex-1 py-1.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                        selectedScope === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Show All ({todoCounts.all})
                    </button>
                    <button
                      onClick={() => setSelectedScope('synced')}
                      className={`flex-1 py-1.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                        selectedScope === 'synced' ? 'bg-white text-indigo-700 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Synced Classroom ({todoCounts.synced})
                    </button>
                    <button
                      onClick={() => setSelectedScope('personal')}
                      className={`flex-1 py-1.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                        selectedScope === 'personal' ? 'bg-white text-slate-955 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Private Planners ({todoCounts.personal})
                    </button>
                  </div>

                  {/* VIEW MODE SETTINGS AND SORT SELECTOR */}
                  <div id="sort-viewmode-settings-container" className="flex items-center justify-between text-xs px-1 border-t border-slate-150 pt-3">
                    <button 
                      id="sort-sheet-trigger-btn"
                      onClick={() => setShowSortSheet(true)}
                      className="flex items-center gap-1.5 font-bold text-slate-705 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-indigo-650" />
                      <span>Sorting: <span className="text-indigo-600">{sortBy === 'dueDate' ? 'Due Date' : sortBy === 'priority' ? 'Urgency' : 'Subject'}</span></span>
                    </button>

                    <div className="flex bg-slate-200/55 p-1 rounded-lg">
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-1 rounded-md transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white shadow-xs text-slate-800' : 'text-slate-400 hover:text-slate-605'}`}
                        title="List view mode"
                      >
                        <AlignLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setViewMode('kanban')}
                        className={`p-1 rounded-md transition-all cursor-pointer ${viewMode === 'kanban' ? 'bg-white shadow-xs text-slate-800' : 'text-slate-400 hover:text-slate-605'}`}
                        title="Kanban columns view mode"
                      >
                        <Layout className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* --- TASK FEED RENDERING OUTLET --- */}
                  {activeGroupTasksFiltered.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center shadow-xs font-sans space-y-3">
                      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-xl">
                        🎯
                      </div>
                      <div>
                        <h4 className="font-sans font-bold text-slate-800 text-xs text-center">No assignments or checklist items mapped.</h4>
                        <p className="text-slate-400 text-[10px] mt-1 text-center">Create a task in the "Create Task" tab or switch filter pills.</p>
                      </div>
                    </div>
                  ) : viewMode === 'list' ? (
                    
                    /* DESIGN A: MODERN DETAILED TASK ROW PLANNERS */
                    <div className="space-y-4 text-left font-sans">
                      {activeGroupTasksFiltered.map(task => {
                        const dateBadge = getDaysLeftConfig(task.dueDate, task.completed);
                        
                        const subCount = task.subtasks?.length || 0;
                        const subCompCount = task.subtasks?.filter(s => s.completed).length || 0;
                        const _ratioPercent = subCount > 0 ? Math.round((subCompCount / subCount) * 100) : 0;

                        // Identify authorization: leader or classmates owned private tasks can delete
                        const canModify = activeUserIsLeader || task.createdById === activeProfileId || !task.isSynced;
                        const isExpanded = expandedTaskId === task.id;

                        return (
                          <div 
                            key={task.id}
                              onClick={() => setActiveDetailTask(task)}
                              className={`bg-white rounded-2xl border p-3 flex flex-col gap-2 shadow-3xs transition-all duration-200 cursor-pointer select-none hover:shadow-xs hover:border-slate-300 ${
                                task.completed 
                                  ? 'opacity-65 border-slate-200 bg-slate-100/30' 
                                  : task.priority === 'high' 
                                    ? 'border-rose-200 hover:border-rose-350 border-l-[4px] border-l-rose-500' 
                                    : 'border-slate-200/90 hover:border-slate-300'
                              }`}
                            >
                              {/* COLLAPSED HEADER CONTAINER */}
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                  {/* Checklist Circle Toggle */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTaskCompleteness(task);
                                    }}
                                    className="text-slate-305 hover:text-indigo-650 transition-colors shrink-0 cursor-pointer"
                                    title={task.completed ? "Mark task incomplete" : "Mark task complete"}
                                  >
                                    {task.completed ? (
                                      <CheckCircle2 className="w-5 h-5 text-indigo-600 fill-indigo-50" />
                                    ) : (
                                      <div className="w-5 h-5 rounded-full border-2 border-slate-300 hover:border-indigo-400 bg-white" />
                                    )}
                                  </button>
  
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className={`text-xs sm:text-sm font-black tracking-tight truncate ${task.completed ? 'line-through text-slate-450' : 'text-slate-850'}`}>
                                        {task.title}
                                      </h4>
                                      
                                      {/* Task Metadata Row inside Collapsed State */}
                                      <div className="flex items-center gap-1 flex-wrap">
                                        {task.isSynced ? (
                                          <span className="px-1.5 py-0.5 rounded-[4px] text-[7.5px] bg-indigo-50 border border-indigo-100/60 text-indigo-600 font-extrabold font-mono tracking-tighter shrink-0 block">
                                            📡 SYNC
                                          </span>
                                        ) : (
                                          <span className="px-1.5 py-0.5 rounded-[4px] text-[7.5px] bg-slate-100 border border-slate-200 text-slate-500 font-extrabold font-mono tracking-tighter shrink-0 block">
                                            🔒 PRIVATE
                                          </span>
                                        )}
  
                                        <span className="px-1.5 py-0.5 rounded-[4px] text-[7.5px] bg-amber-50 border border-amber-200/60 text-amber-700 font-black font-mono tracking-tighter shrink-0 block flex items-center gap-0.5" title="Earnable Completion Points">
                                          ⭐ {task.points !== undefined ? task.points : 50} pts
                                        </span>
  
                                        <span className={`px-1.5 py-0.5 rounded-[4px] text-[7.5px] font-mono font-bold flex items-center gap-0.5 shrink-0 ${dateBadge.containerClass}`}>
                                          <span className={`w-1 h-1 rounded-full ${dateBadge.dotColor}`} />
                                          {dateBadge.text}
                                        </span>

                                        {subCount > 0 && (
                                          <span className="px-1.5 py-0.5 rounded-[4px] text-[7.5px] bg-indigo-50 border border-indigo-200/60 text-indigo-750 font-extrabold font-mono tracking-tighter shrink-0 block flex items-center gap-0.5" title="Subtasks Checklist Progress">
                                            ☑️ {subCompCount}/{subCount} subtasks
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
  
                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Toggle Details Indicator Chevron */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedTaskId(isExpanded ? null : task.id);
                                    }}
                                    className="text-slate-400 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                                    title={isExpanded ? "Hide subtasks & guidelines" : "Show subtasks & guidelines"}
                                  >
                                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-indigo-650' : 'text-slate-400'}`} />
                                  </button>
                                </div>
                              </div>

                            {/* EXPANDED DETAILS BODY CONTAINER */}
                            {isExpanded && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.15 }}
                                className="pt-2.5 border-t border-slate-100/80 flex flex-col gap-2.5 text-xs text-slate-600 font-sans cursor-default"
                                onClick={(e) => e.stopPropagation()} // Prevent card collapse when clicking inside the expanded container
                              >
                                {/* Guidelines/Description Area */}
                                <div className="space-y-1">
                                  <span className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-wider block font-mono">Guidelines:</span>
                                  <p className="text-[10px] leading-relaxed text-slate-650 bg-slate-50 border border-slate-100/70 rounded-xl p-2.5">
                                    {task.description || "No customized guidelines provided for this task."}
                                  </p>
                                </div>

                                {/* Checklist Subtasks & Percentage Progress */}
                                <div className={`border p-3 rounded-xl space-y-2.5 transition-all ${
                                  task.isSynced && subCount > 0 && subCompCount === subCount
                                    ? 'bg-emerald-50/20 border-emerald-200 shadow-3xs'
                                    : 'bg-slate-50/40 border-slate-100'
                                }`}>
                                  {/* Color Changing Percentage Progress Bar */}
                                  {(() => {
                                    const percent = task.completed 
                                      ? 100 
                                      : (subCount > 0 ? Math.round((subCompCount / subCount) * 100) : 0);
                                    return (
                                      <div className="relative w-full bg-slate-150 border border-slate-200/50 rounded-full h-4.5 overflow-hidden flex items-center justify-center shadow-3xs">
                                        <motion.div 
                                          className={`absolute left-0 top-0 h-full transition-all duration-500 ${
                                            percent === 0 
                                              ? 'bg-transparent' 
                                              : percent < 35 
                                                ? 'bg-rose-500' 
                                                : percent < 70 
                                                  ? 'bg-amber-500' 
                                                  : percent < 100 
                                                    ? 'bg-indigo-600' 
                                                    : 'bg-emerald-600'
                                          }`}
                                          initial={{ width: 0 }}
                                          animate={{ width: `${percent}%` }}
                                          transition={{ duration: 0.4, ease: "easeOut" }}
                                        />
                                        <span className={`relative z-10 text-[8.5px] font-mono font-black select-none transition-colors duration-300 ${
                                          percent > 50 ? 'text-white' : 'text-slate-705'
                                        }`}>
                                          Progress: {percent}%
                                        </span>
                                      </div>
                                    );
                                  })()}

                                  {/* Interactive subtasks listing */}
                                  {task.subtasks && task.subtasks.length > 0 && (
                                    <div className="space-y-1 pt-0.5">
                                      {task.subtasks.map(subItem => (
                                        <div
                                          key={subItem.id}
                                          onClick={() => toggleTaskCompleteness(task, true, subItem.id, subItem.completed)}
                                          className={`flex items-center gap-2 p-1.5 rounded-lg border text-[9px] font-bold cursor-pointer select-none transition-all ${
                                            subItem.completed 
                                              ? task.isSynced && subCompCount === subCount
                                                ? 'bg-emerald-50/50 text-emerald-700/80 border-emerald-150'
                                                : 'bg-slate-100 text-slate-400 border-slate-150' 
                                              : 'bg-white text-slate-705 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                          }`}
                                        >
                                          {subItem.completed ? (
                                            <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${
                                              task.isSynced && subCompCount === subCount ? 'text-emerald-600 fill-emerald-50' : 'text-indigo-600 fill-indigo-50'
                                            }`} />
                                          ) : (
                                            <Square className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                          )}
                                          <span className="truncate flex-1 font-sans">{subItem.title}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Celebration Banner for complete Sync Milestones */}
                                  {task.isSynced && subCount > 0 && subCompCount === subCount && (
                                    <motion.div 
                                      initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-[9.5px] font-bold leading-tight"
                                    >
                                      <div className="p-0.5 rounded-full bg-emerald-500 text-white shrink-0">
                                        <CheckCircle2 className="w-3 h-3" />
                                      </div>
                                      <div className="flex-1">
                                        <p className="font-extrabold text-emerald-900 flex items-center gap-1">
                                          <span>Synced Assignment Cleared!</span>
                                          <span className="inline-block animate-bounce">🏆</span>
                                        </p>
                                        <p className="text-[8.5px] font-normal text-emerald-700/90">All shared milestones verified and up-to-date.</p>
                                      </div>
                                    </motion.div>
                                  )}

                                  {/* Inline Milestones checkpoint creator */}
                                  <div className="flex gap-2 pt-0.5">
                                    <input
                                      type="text"
                                      placeholder="Add custom study checkpoint & press Enter..."
                                      value={inlineMilestoneInput[task.id] || ''}
                                      onChange={(e) => setInlineMilestoneInput(p => ({ ...p, [task.id]: e.target.value }))}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleAddInlineMilestone(task);
                                        }
                                      }}
                                      className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[9.5px] text-slate-800 outline-none focus:border-indigo-400 placeholder-slate-400 shadow-3xs font-sans"
                                    />
                                  </div>
                                </div>

                                {/* Attached resources and files */}
                                {task.attachments && task.attachments.length > 0 && (
                                  <div className="space-y-1.5 text-left pt-0.5">
                                    <span className="text-[8.5px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1 font-mono">
                                      <Paperclip className="w-3 h-3 text-slate-400 font-bold" />
                                      Attached Resources ({task.attachments.length})
                                    </span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                      {task.attachments.map((att, index) => {
                                        const isImage = att.mimeType?.startsWith('image/') || att.url?.startsWith('data:image/') || /\.(png|jpe?g|gif|webp|svg)/i.test(att.name || '');
                                        let clickAction: () => void = () => {
                                          if (isImage) {
                                            setLightboxImage({ url: att.url, title: att.name });
                                          } else {
                                            window.open(att.url, '_blank');
                                          }
                                        };
                                        if (att.source === 'local' && !isImage) {
                                          clickAction = () => {
                                            const downloadLink = document.createElement('a');
                                            downloadLink.href = att.url;
                                            downloadLink.download = att.name;
                                            downloadLink.click();
                                          };
                                        }
                                        return (
                                          <div 
                                            key={att.id || index}
                                            onClick={clickAction}
                                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-150 hover:bg-slate-100 cursor-pointer transition-colors text-[9.5px] font-sans text-slate-700 min-w-0"
                                            title={isImage ? "View image preview" : att.source === 'google-drive' ? "Open in Google Drive" : "Download file"}
                                          >
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                              {isImage ? (
                                                <img src={att.url} alt={att.name} className="w-5 h-5 rounded object-cover border border-slate-200 bg-white shrink-0" referrerPolicy="no-referrer" />
                                              ) : (
                                                <FileText className="w-3 h-3 text-indigo-650 shrink-0" />
                                              )}
                                              <span className="truncate pr-1 font-bold text-slate-700">{att.name}</span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                              {att.source === 'google-drive' ? (
                                                <span className="text-[7.5px] px-1 bg-yellow-50 text-yellow-800 rounded font-black font-mono tracking-tighter shrink-0 block border border-yellow-200">DRIVE</span>
                                              ) : (
                                                <span className="text-[7.5px] px-1 bg-sky-50 text-sky-800 rounded font-black font-mono tracking-tighter shrink-0 block border border-sky-200">LOCAL</span>
                                              )}
                                              {canModify && (
                                                <button
                                                  onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!confirm(`Are you sure you want to delete the attachment "${att.name}"?`)) return;
                                                    const updated = (task.attachments || []).filter((_, i) => i !== index);
                                                    await updateTask(task.id, { attachments: updated });
                                                  }}
                                                  className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                                                  title="Remove attachment"
                                                >
                                                  <Trash className="w-2.5 h-2.5" />
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Attachments quick-pin action */}
                                <div className="flex justify-start gap-1 flex-wrap pt-0.5">
                                  <button
                                    onClick={() => handleAddInlineAttachment(task, 'drive')}
                                    className="px-2 py-1 text-[8.5px] font-mono font-black rounded-lg border border-slate-150 text-slate-400 hover:text-yellow-700 hover:bg-yellow-50 hover:border-yellow-200 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                                    title="Pin item dynamically using Google Drive Picker"
                                  >
                                    <Paperclip className="w-2.5 h-2.5" /> + Pin Drive File
                                  </button>
                                  <button
                                    onClick={() => handleAddInlineAttachment(task, 'local')}
                                    className="px-2 py-1 text-[8.5px] font-mono font-black rounded-lg border border-slate-150 text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 hover:border-indigo-200 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                                    title="Attach local document or worksheet into this board"
                                  >
                                    <UploadCloud className="w-2.5 h-2.5" /> + Upload Material
                                  </button>
                                </div>

                                {/* Bottom Metadata details & Actions bar */}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                                  <div className="flex items-center gap-1.5 text-[8.5px] text-slate-400">
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-900 font-extrabold flex items-center gap-0.5 font-mono uppercase shrink-0">
                                      <Tag className="w-2.5 h-2.5 text-indigo-650" />
                                      {task.category}
                                    </span>
                                    <span className="font-semibold pt-0.5">By: <span className="font-extrabold text-slate-705">{task.createdBy}</span></span>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0 select-none">
                                    {/* DISCUSSION BUTTON */}
                                    <button
                                      onClick={() => setActiveDetailTask(task)}
                                      className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 hover:border-indigo-200 text-indigo-700 hover:text-indigo-950 font-mono font-extrabold text-[8.5px] flex items-center gap-1 transition-all cursor-pointer shadow-3xs"
                                      title="Join Assignment Discussion Comment Section"
                                    >
                                      <MessageSquare className="w-2.5 h-2.5 text-indigo-650" />
                                      Discussion ({comments.filter(c => c.taskId === task.id).length})
                                    </button>

                                    {/* Action items button tray */}
                                    <div className="flex items-center gap-0.5 bg-slate-50 p-0.5 rounded-lg border border-slate-100">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleTogglePinTask(task, e);
                                        }}
                                        className={`p-1 rounded-md transition-all cursor-pointer ${
                                          task.isPinned 
                                            ? 'text-amber-500 bg-amber-50 border border-amber-100' 
                                            : 'text-slate-400 hover:text-amber-500 hover:bg-white'
                                        }`}
                                        title={task.isPinned ? "Unpin assignment" : "Pin assignment to top"}
                                      >
                                        <Pin className="w-3 h-3" />
                                      </button>
                                      {canModify && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingTask(task);
                                          }}
                                          className="text-slate-400 hover:text-indigo-600 hover:bg-white p-1 rounded-md transition-all cursor-pointer"
                                          title="Edit task guidelines"
                                        >
                                          <Edit3 className="w-3 h-3" />
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleArchive(task.id, true);
                                        }}
                                        className="text-slate-400 hover:text-indigo-650 hover:bg-white p-1 rounded-md transition-all cursor-pointer"
                                        title="Archive Task event"
                                      >
                                        <Archive className="w-3 h-3" />
                                      </button>
                                      {canModify && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteTask(task);
                                          }}
                                          className="text-slate-300 hover:text-rose-500 hover:bg-white p-1 rounded-md transition-all cursor-pointer"
                                          title="Delete Task record"
                                        >
                                          <Trash className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    
                    /* DESIGN B: REAL KANBAN STATUS COLUMNS WITH DRAG/ACTION CARDS */
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left font-sans items-start">
                      {[
                        { id: 'todo' as const, label: '🎯 To Do', color: 'bg-slate-50 border-slate-200' },
                        { id: 'in_progress' as const, label: '⚡ In Progress', color: 'bg-amber-50/15 border-amber-200/50' },
                        { id: 'completed' as const, label: '🎉 Completed', color: 'bg-emerald-50/15 border-emerald-200/50' }
                      ].map(column => {
                        const columnTasks = activeGroupTasksFiltered.filter(t => getTaskStatus(t) === column.id);
                        
                        return (
                          <div 
                            key={column.id} 
                            className={`rounded-2xl border p-3.5 space-y-3 shadow-3xs flex flex-col min-h-[300px] ${column.color}`}
                          >
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                              <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">{column.label}</span>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-100">
                                {columnTasks.length}
                              </span>
                            </div>

                            <div className="space-y-3 overflow-y-auto max-h-[500px] pr-0.5 scroll-smooth">
                              {columnTasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400 select-none border border-dashed border-slate-200 rounded-xl bg-white/50">
                                  <span className="text-xl">📭</span>
                                  <p className="italic text-[9.5px] mt-1 font-medium">No tasks in this stage</p>
                                </div>
                              ) : (
                                columnTasks.map(task => {
                                  const canModify = activeUserIsLeader || task.createdById === activeProfileId || !task.isSynced;
                                  const commentCount = comments.filter(c => c.taskId === task.id).length;
                                  const dateBadge = getDaysLeftConfig(task.dueDate, task.completed);
                                  const isHighPrio = task.priority === 'high';
                                  
                                  const subCount = task.subtasks?.length || 0;
                                  const subCompCount = task.subtasks?.filter(s => s.completed).length || 0;
                                  const _ratioPercent = subCount > 0 ? Math.round((subCompCount / subCount) * 100) : 0;

                                  return (
                                    <div 
                                      key={task.id} 
                                      onClick={() => setActiveDetailTask(task)}
                                      className={`bg-white p-3 border rounded-xl space-y-2.5 text-left shadow-2xs hover:shadow-xs transition-all duration-200 cursor-pointer select-none hover:border-indigo-400 ${
                                        isHighPrio && !task.completed
                                          ? 'border-rose-200 hover:border-rose-350 border-l-[4px] border-l-rose-500' 
                                          : 'border-slate-200/80 hover:border-slate-300'
                                      } ${task.completed ? 'opacity-85' : ''}`}
                                    >
                                      {/* Task Title & Badges */}
                                      <div className="space-y-1.5">
                                        <div className="flex justify-between items-start gap-1">
                                          <h5 className={`font-bold text-[11.5px] leading-snug text-slate-800 ${task.completed ? 'line-through text-slate-400' : ''}`}>
                                            {task.title}
                                          </h5>
                                          
                                          {/* Task Scope Label (Private / Synced) */}
                                          {task.isSynced ? (
                                            <span 
                                              className="text-[8px] font-black font-mono tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-1 rounded-sm shrink-0"
                                              title="Synced with Classmates"
                                            >
                                              📡 SYNC
                                            </span>
                                          ) : (
                                            <span 
                                              className="text-[8px] font-black font-mono tracking-wider text-slate-500 bg-slate-100 border border-slate-200 px-1 rounded-sm shrink-0"
                                              title="Private Workload Item"
                                            >
                                              🔒 PVT
                                            </span>
                                          )}
                                        </div>
                                        
                                        {task.description && (
                                          <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                                            {task.description}
                                          </p>
                                        )}
                                      </div>

                                      {/* Due Date & Category */}
                                      <div className="flex flex-wrap items-center gap-1.5 justify-between">
                                        <span className="text-[9px] font-mono font-extrabold text-amber-800 bg-amber-50/60 border border-amber-100/50 rounded px-1.5 py-0.5 uppercase shrink-0">
                                          {task.category}
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold flex items-center gap-0.5 shrink-0 ${dateBadge.containerClass}`}>
                                          <span className={`w-1 h-1 rounded-full ${dateBadge.dotColor}`} />
                                          {dateBadge.text}
                                        </span>
                                      </div>

                                      {/* Milestones Progress Bar */}
                                      {(() => {
                                        const percent = task.completed 
                                          ? 100 
                                          : (subCount > 0 ? Math.round((subCompCount / subCount) * 100) : 0);
                                        return (
                                          <div className="relative w-full bg-slate-150 border border-slate-200/50 rounded-full h-4.5 overflow-hidden flex items-center justify-center">
                                            <motion.div 
                                              className={`absolute left-0 top-0 h-full transition-all duration-500 ${
                                                percent === 0 
                                                  ? 'bg-transparent' 
                                                  : percent < 35 
                                                    ? 'bg-rose-500' 
                                                    : percent < 70 
                                                      ? 'bg-amber-500' 
                                                      : percent < 100 
                                                        ? 'bg-indigo-600' 
                                                        : 'bg-emerald-600'
                                              }`}
                                              initial={{ width: 0 }}
                                              animate={{ width: `${percent}%` }}
                                              transition={{ duration: 0.4, ease: "easeOut" }}
                                            />
                                            <span className={`relative z-10 text-[8.5px] font-mono font-black select-none transition-colors duration-300 ${
                                              percent > 50 ? 'text-white' : 'text-slate-700'
                                            }`}>
                                              Progress: {percent}% {subCount > 0 && `(${subCompCount}/${subCount} subtasks)`}
                                            </span>
                                          </div>
                                        );
                                      })()}

                                      {/* Kanban Interaction & Movement Actions */}
                                      <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100/75 animate-none">
                                        <div className="flex gap-1">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveDetailTask(task);
                                            }}
                                            className="flex-1 py-1 text-[9px] font-mono font-black text-indigo-700 hover:text-indigo-950 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-150 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer shadow-3xs"
                                            title="Open discussion and attachments"
                                          >
                                            <MessageSquare className="w-2.5 h-2.5 text-indigo-600" /> 
                                            Chat ({commentCount})
                                          </button>

                                          {canModify && (
                                            <>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setEditingTask(task);
                                                }}
                                                className="p-1 text-slate-400 hover:text-indigo-650 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-3xs flex items-center justify-center shrink-0"
                                                title="Edit task guidelines"
                                              >
                                                <Edit3 className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (confirm("Are you sure you want to permanently delete this task? This action cannot be undone.")) {
                                                    handleDeleteTask(task);
                                                  }
                                                }}
                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-3xs flex items-center justify-center shrink-0"
                                                title="Delete Task record"
                                              >
                                                <Trash className="w-3.5 h-3.5" />
                                              </button>
                                            </>
                                          )}
                                        </div>

                                        <div className="flex gap-1 items-center">
                                          {/* Move Left / Back Button */}
                                          {column.id !== 'todo' && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const prevCol = column.id === 'completed' ? 'in_progress' : 'todo';
                                                handleUpdateTaskStatus(task, prevCol);
                                              }}
                                              className="flex-1 py-1 px-1 text-[8.5px] font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-lg flex items-center justify-center gap-0.5 transition-all cursor-pointer shadow-3xs"
                                              title="Move back to previous column"
                                            >
                                              ⇠ Move Back
                                            </button>
                                          )}

                                          {/* Move Right / Forward Button */}
                                          {column.id !== 'completed' && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const nextCol = column.id === 'todo' ? 'in_progress' : 'completed';
                                                handleUpdateTaskStatus(task, nextCol);
                                              }}
                                              className={`flex-1 py-1 px-1 text-[8.5px] font-black rounded-lg flex items-center justify-center gap-0.5 transition-all cursor-pointer shadow-3xs ${
                                                column.id === 'todo'
                                                  ? 'bg-amber-600 hover:bg-amber-700 text-white border border-amber-600'
                                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600'
                                              }`}
                                              title={column.id === 'todo' ? 'Start working on task' : 'Finish the whole task & archive'}
                                            >
                                              {column.id === 'todo' ? 'Start Task ⚡' : 'Complete ✓'}
                                            </button>
                                          )}

                                          {/* Completed State Restore Indicator */}
                                          {column.id === 'completed' && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdateTaskStatus(task, 'todo');
                                              }}
                                              className="flex-1 py-1 px-1 text-[8.5px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg flex items-center justify-center gap-0.5 transition-all cursor-pointer shadow-3xs"
                                              title="Reopen task and move to To Do"
                                            >
                                              ⤾ Reopen Study
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* --- TAB 2: PUBLISH / ASSEMBLE TASK --- */}
              {activeTab === 'create' && (
                <motion.div
                  key="create-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="p-4 space-y-4 text-left font-sans"
                >
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm border border-slate-800">
                        <Edit3 className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="font-sans font-extrabold text-slate-900 text-sm tracking-tight leading-none">Assemble Study Materials</h3>
                        <p className="text-[11px] text-slate-500 mt-1.5 leading-none font-medium">Log assignment instructions, interactive milestones, and distribution settings.</p>
                      </div>
                    </div>

                    <form onSubmit={handlePublishTask} className="space-y-4 text-xs">
                      
                      {/* Sync type Selector Scope */}
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block font-mono">1. Distribution Scope</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (!permissions.canSyncTasks) {
                                alert("Your classmate account permissions prevent publishing classroom wide. Tap 'Private Planner' instead.");
                                return;
                              }
                              setNewTaskScope('synced');
                            }}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                              newTaskScope === 'synced'
                                ? 'bg-indigo-50/70 border-indigo-250 text-indigo-950 shadow-sm'
                                : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50/80 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Megaphone className={`w-4 h-4 ${newTaskScope === 'synced' ? 'text-indigo-600' : 'text-slate-400'}`} />
                              <span className="text-[11px] font-bold">Synced with Class</span>
                            </div>
                            <span className="block text-[9px] font-normal leading-normal text-slate-500 mt-1">
                              {permissions.canSyncTasks ? 'Everyone enrolled views, coordinates & completes' : '👑 Requires Leader permission'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setNewTaskScope('personal')}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                              newTaskScope === 'personal'
                                ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                                : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50/80 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Lock className={`w-4 h-4 ${newTaskScope === 'personal' ? 'text-white' : 'text-slate-400'}`} />
                              <span className="text-[11px] font-bold">Private Planner</span>
                            </div>
                            <span className={`block text-[9px] font-normal leading-normal mt-1 ${newTaskScope === 'personal' ? 'text-slate-300' : 'text-slate-500'}`}>
                              Isolated tasks added only on your personal study checklist
                            </span>
                          </button>
                        </div>
                      </div>

                      {newTaskScope === 'synced' ? (
                        <div className="space-y-4 animate-fadeIn">
                          {/* Title */}
                          <div className="space-y-1.5 text-left">
                            <label className="text-[10px] text-indigo-650 font-extrabold uppercase tracking-wider block font-mono">Assignment / Lesson Objectives</label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <BookOpen className="h-4 w-4 text-indigo-600" />
                              </div>
                              <input
                                type="text"
                                placeholder="e.g. Gauss Theorem curves calculations"
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                required
                                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:bg-white rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 outline-none transition-all placeholder:text-slate-400"
                              />
                            </div>
                          </div>

                          {/* category customized */}
                          <div className="space-y-1.5 text-left">
                            <label className="text-[10px] text-indigo-650 font-extrabold uppercase tracking-wider block font-mono">Subject Category</label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Tag className="h-4 w-4 text-indigo-650" />
                              </div>
                              <input
                                type="text"
                                placeholder="e.g. Physics, Calculus, Chem, Supplies"
                                value={newTaskCategory}
                                onChange={(e) => setNewTaskCategory(e.target.value)}
                                required
                                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:bg-white rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 outline-none transition-all font-semibold placeholder:text-slate-400"
                              />
                            </div>
                          </div>

                          {/* guidelines desc */}
                          <div className="space-y-1.5 text-left">
                            <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block font-mono">Brief guidelines</label>
                            <div className="relative">
                              <div className="absolute top-2.5 left-3 pointer-events-none">
                                <AlignLeft className="h-4 w-4 text-slate-400" />
                              </div>
                              <textarea
                                placeholder="Outline textbook pages, grading deadlines, notes..."
                                value={newTaskDesc}
                                onChange={(e) => setNewTaskDesc(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:bg-white rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 outline-none transition-all h-20 resize-none placeholder:text-slate-400"
                              />
                            </div>
                          </div>

                          {/* Due date */}
                          <div className="space-y-1.5 text-left">
                            <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block font-mono">Calendar Due Date</label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Calendar className="h-4 w-4 text-slate-400" />
                              </div>
                              <input
                                type="date"
                                value={newTaskDueDate}
                                onChange={(e) => setNewTaskDueDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:bg-white rounded-xl pl-9 pr-3 py-2 text-xs text-slate-700 font-bold outline-none transition-all"
                              />
                            </div>
                          </div>

                          {/* Urgency */}
                          <div className="space-y-2 text-left">
                            <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block font-mono">Select Urgency Priority</label>
                            <div className="grid grid-cols-3 gap-2.5">
                              {[
                                { value: 'high', label: 'High', colorClass: 'bg-rose-500' },
                                { value: 'medium', label: 'Med', colorClass: 'bg-amber-500' },
                                { value: 'low', label: 'Low', colorClass: 'bg-emerald-500' }
                              ].map(opt => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setNewTaskPriority(opt.value as any)}
                                  className={`py-2 px-3 border cursor-pointer font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                                    newTaskPriority === opt.value 
                                      ? 'bg-slate-900 border-indigo-950 text-white font-extrabold shadow-sm' 
                                      : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50 hover:border-slate-300'
                                  }`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${opt.colorClass}`} />
                                  <span>{opt.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Points selection */}
                          <div className="space-y-2 border-t border-slate-100 pt-3.5 text-left">
                            <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block font-mono">Award Points for Completion</label>
                            <div className="flex items-center gap-3 bg-indigo-50/45 p-3 rounded-xl border border-indigo-100/60">
                              <div className="relative shrink-0">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <Award className="h-4 w-4 text-indigo-600" />
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  max="1000"
                                  value={newTaskPoints}
                                  onChange={(e) => setNewTaskPoints(Math.max(0, parseInt(e.target.value) || 0))}
                                  className="w-24 bg-white border border-indigo-200 focus:border-indigo-400 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-900 font-bold outline-none shadow-3xs"
                                />
                              </div>
                              <span className="text-[11px] text-slate-600 leading-normal font-medium">
                                Enrolled students will receive these points automatically in their profile metrics upon completing this assignment.
                              </span>
                            </div>
                          </div>

                          {/* Subtasks initial seed raw */}
                          <div className="space-y-2 border-t border-slate-100 pt-3.5 text-left">
                            <div className="flex items-center gap-1.5">
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                              <label className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-wider block font-mono">Interactive Assignment Milestones</label>
                            </div>
                            
                            {/* Interactive Milestone Input and Add Button */}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Add milestone (e.g., Read page 40, Answer Q3) & press Enter..."
                                value={newTaskSubtaskInputValue}
                                onChange={(e) => setNewTaskSubtaskInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddNewSubtaskToList(newTaskSubtaskInputValue);
                                  }
                                }}
                                className="flex-1 bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:bg-white rounded-xl px-3 py-2 text-xs text-slate-900 outline-none transition-all placeholder:text-slate-400"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddNewSubtaskToList(newTaskSubtaskInputValue)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-3xs"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>

                            {/* List of Added Milestones with Checkmarks and Trash */}
                            {newTaskSubtasksList.length > 0 && (
                              <div className="space-y-1.5 p-2 bg-slate-50 border border-slate-200/60 rounded-xl max-h-56 overflow-y-auto">
                                {newTaskSubtasksList.map((sub, index) => (
                                  <div
                                    key={sub.id}
                                    className="flex items-center justify-between gap-2.5 p-2 bg-white border border-slate-150 rounded-lg shadow-3xs transition-all"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                      {/* Milestone Checkbox Toggle */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setNewTaskSubtasksList(prev => 
                                            prev.map((item, idx) => 
                                              idx === index ? { ...item, completed: !item.completed } : item
                                            )
                                          );
                                        }}
                                        className="text-slate-300 hover:text-indigo-600 transition-colors shrink-0 cursor-pointer"
                                      >
                                        {sub.completed ? (
                                          <CheckCircle2 className="w-4 h-4 text-indigo-600 fill-indigo-50" />
                                        ) : (
                                          <div className="w-4 h-4 rounded-full border border-slate-300 hover:border-indigo-400 bg-white" />
                                        )}
                                      </button>

                                      <span className={`text-[11px] font-bold truncate ${sub.completed ? 'line-through text-slate-400' : 'text-slate-750'}`}>
                                        {sub.title}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setNewTaskSubtasksList(prev => prev.filter((_, idx) => idx !== index));
                                      }}
                                      className="text-slate-350 hover:text-rose-600 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                                      title="Delete milestone"
                                    >
                                      <Trash className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <span className="text-[8.5px] italic text-slate-450 block mt-0.5">
                              Milestones can be pre-completed (checked) or active (unchecked).
                            </span>
                          </div>

                          {/* Attachments staging list */}
                          <div className="space-y-2 border-t border-slate-100 pt-3.5 text-left">
                            <div className="flex items-center gap-1.5">
                              <Paperclip className="w-4 h-4 text-slate-500" />
                              <label className="text-[10px] text-slate-455 font-extrabold uppercase tracking-wider block font-mono">Attachments & Study Materials</label>
                            </div>
                            
                            {/* Selected files indicator */}
                            {composerAttachments.length > 0 && (
                              <div className="space-y-1.5 mb-2 bg-slate-50 border border-slate-150 rounded-xl p-2.5">
                                {composerAttachments.map((att, index) => (
                                  <div key={index} className="flex items-center justify-between text-[11px] bg-white border border-slate-150 px-2.5 py-2 rounded-lg shadow-3xs">
                                    <span className="flex items-center gap-2 truncate max-w-[80%]">
                                      {att.source === 'google-drive' ? (
                                        <span className="text-[8px] px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-100 rounded font-bold font-mono">DRIVE</span>
                                      ) : (
                                        <span className="text-[8px] px-1.5 py-0.5 bg-sky-50 text-sky-800 border border-sky-100 rounded font-bold font-mono">LOCAL</span>
                                      )}
                                      <span className="truncate text-slate-750 font-bold">{att.name}</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setComposerAttachments(p => p.filter((_, i) => i !== index))}
                                      className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                                      title="Remove attachment"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Integration attachments buttons */}
                            <div className="grid grid-cols-2 gap-2.5">
                              <button
                                type="button"
                                onClick={openGooglePicker}
                                className="bg-white hover:bg-slate-50 border border-slate-200 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[10.5px] font-bold text-slate-705 shadow-3xs"
                              >
                                <Link className="w-3.5 h-3.5 text-amber-500" /> Add from Drive
                              </button>
                              
                              <label className="bg-white hover:bg-slate-50 border border-slate-200 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[10.5px] font-bold text-slate-705 shadow-3xs text-center">
                                <UploadCloud className="w-3.5 h-3.5 text-indigo-500" /> Upload Local Item
                                <input 
                                  type="file" 
                                  onChange={handleLocalFileSelect}
                                  className="hidden" 
                                />
                              </label>
                            </div>
                          </div>

                          {/* Asynchronous Task Settings */}
                          <div className="space-y-3 border-t border-slate-100 pt-3.5 text-left">
                            <div className="flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-indigo-600" />
                              <label className="text-[10px] text-slate-450 font-extrabold uppercase tracking-wider block font-mono">Asynchronous Student Submissions</label>
                            </div>
                            <div className="grid grid-cols-3 gap-2.5">
                              {[
                                { value: 'none', label: 'No Submission', description: 'Self-completed' },
                                { value: 'subjective', label: 'Subjective Response', description: 'Essay/Written work' },
                                { value: 'objective', label: 'Quiz Questions', description: 'Multiple choice' }
                              ].map(opt => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setNewTaskSubmissionType(opt.value as any)}
                                  className={`p-2.5 border cursor-pointer rounded-xl transition-all text-left flex flex-col justify-between h-20 ${
                                    newTaskSubmissionType === opt.value 
                                      ? 'bg-slate-900 border-slate-950 text-white shadow-sm' 
                                      : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50 hover:border-slate-300'
                                  }`}
                                >
                                  <span className="text-[10.5px] font-bold leading-tight block">{opt.label}</span>
                                  <span className={`text-[8px] font-normal leading-normal ${newTaskSubmissionType === opt.value ? 'text-slate-300' : 'text-slate-400'}`}>
                                    {opt.description}
                                  </span>
                                </button>
                              ))}
                            </div>

                            {newTaskSubmissionType !== 'none' && (
                              <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-150">
                                <div className="space-y-1">
                                  <label className="text-[9px] text-slate-405 font-extrabold uppercase tracking-wider block">Max Score</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max="10000"
                                    value={newTaskMaxScore}
                                    onChange={(e) => setNewTaskMaxScore(Math.max(1, parseInt(e.target.value) || 100))}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none"
                                  />
                                  <p className="text-[8.5px] text-slate-400 font-medium">Specify the maximum possible score points for this task.</p>
                                </div>

                                {newTaskSubmissionType === 'subjective' && (
                                  <div className="space-y-1 text-left">
                                    <label className="text-[9px] text-slate-405 font-extrabold uppercase tracking-wider block">Subjective Prompt / Assignment Question</label>
                                    <textarea
                                      placeholder="e.g. Write a 500-word summary analyzing Newton's third law in aerospace engineering."
                                      value={newTaskSubjectivePrompt}
                                      onChange={(e) => setNewTaskSubjectivePrompt(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none h-20 resize-none focus:border-indigo-400"
                                    />
                                  </div>
                                )}

                                {newTaskSubmissionType === 'objective' && (
                                  <div className="space-y-3 text-left">
                                    <div className="flex items-center justify-between">
                                      <label className="text-[9px] text-indigo-600 font-extrabold uppercase tracking-wider font-mono">Quiz Questions ({newTaskObjectiveQuestions.length})</label>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setNewTaskObjectiveQuestions(prev => [
                                            ...prev,
                                            {
                                              id: 'q-' + Math.random().toString(36).substring(2, 6),
                                              question: '',
                                              options: ['', '', '', ''],
                                              correctAnswer: 'A'
                                            }
                                          ]);
                                        }}
                                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-755 text-white rounded-lg text-[9px] font-extrabold font-mono flex items-center gap-1 cursor-pointer transition-colors"
                                      >
                                        <Plus className="w-3 h-3" /> Add Question
                                      </button>
                                    </div>

                                    {newTaskObjectiveQuestions.length === 0 ? (
                                      <div className="text-center py-4 text-slate-400 text-[10px] italic bg-white border border-dashed rounded-lg">
                                        No questions added yet. Click 'Add Question' above.
                                      </div>
                                    ) : (
                                      <div className="space-y-3.5 max-h-60 overflow-y-auto pr-0.5">
                                        {newTaskObjectiveQuestions.map((q, idx) => (
                                          <div key={q.id} className="p-3 bg-white border border-slate-200 rounded-lg relative space-y-2.5 text-left shadow-3xs">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setNewTaskObjectiveQuestions(prev => prev.filter((_, i) => i !== idx));
                                              }}
                                              className="absolute top-2 right-2 text-slate-300 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer"
                                              title="Remove Question"
                                            >
                                              <Trash className="w-3.5 h-3.5" />
                                            </button>

                                            <div className="space-y-1">
                                              <span className="text-[9.5px] font-bold text-slate-450 block font-mono">Question {idx + 1}</span>
                                              <input
                                                type="text"
                                                placeholder="e.g. What is the value of gravitational acceleration on Earth?"
                                                value={q.question}
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  setNewTaskObjectiveQuestions(prev => prev.map((item, i) => i === idx ? { ...item, question: val } : item));
                                                }}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-xs text-slate-800 outline-none focus:bg-white"
                                              />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                              {['A', 'B', 'C', 'D'].map((letter, optIdx) => (
                                                <div key={letter} className="space-y-0.5">
                                                  <span className="text-[8.5px] font-bold text-slate-400 font-mono">Option {letter}</span>
                                                  <input
                                                    type="text"
                                                    placeholder={`Option ${letter}`}
                                                    value={q.options[optIdx]}
                                                    onChange={(e) => {
                                                      const val = e.target.value;
                                                      setNewTaskObjectiveQuestions(prev => prev.map((item, i) => {
                                                        if (i === idx) {
                                                          const copyOpts = [...item.options];
                                                          copyOpts[optIdx] = val;
                                                          return { ...item, options: copyOpts };
                                                        }
                                                        return item;
                                                      }));
                                                    }}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-[11px] text-slate-800 outline-none focus:bg-white"
                                                  />
                                                </div>
                                              ))}
                                            </div>

                                            <div className="space-y-1">
                                              <span className="text-[8.5px] font-bold text-slate-400 font-mono">Correct Option</span>
                                              <select
                                                value={q.correctAnswer}
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  setNewTaskObjectiveQuestions(prev => prev.map((item, i) => i === idx ? { ...item, correctAnswer: val } : item));
                                                }}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs font-bold text-slate-705 outline-none font-sans"
                                              >
                                                <option value="A">Option A</option>
                                                <option value="B">Option B</option>
                                                <option value="C">Option C</option>
                                                <option value="D">Option D</option>
                                              </select>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <button
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-slate-900 text-white font-extrabold py-3 rounded-xl text-xs shadow-sm transition-all block cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] mt-2"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Publish Lesson Board to Class</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4 animate-fadeIn">
                          {/* Personal Title */}
                          <div className="space-y-1.5 text-left">
                            <label className="text-[10px] text-slate-900 font-extrabold uppercase tracking-wider block font-mono">Personal Task / Study Goal</label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <CheckSquare className="h-4 w-4 text-slate-600" />
                              </div>
                              <input
                                type="text"
                                placeholder="e.g. Finish reviewing Chemistry chapter 4 notes"
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                required
                                className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 outline-none transition-all placeholder:text-slate-400 font-bold"
                              />
                            </div>
                          </div>

                          {/* Personal Category Badge Row */}
                          <div className="space-y-1.5 text-left">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block font-mono">Personal Category Tag</label>
                              <span className="text-[9px] text-slate-400 font-bold">Presets:</span>
                            </div>
                            
                            {/* Badges container */}
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {['📚 Study', '📝 Prep', '💡 Project', '🎯 Habit', '🛒 Other'].map((cat) => {
                                const cleanCat = cat.split(' ')[1] || cat;
                                return (
                                  <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setNewTaskCategory(cleanCat)}
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border cursor-pointer ${
                                      newTaskCategory.toLowerCase() === cleanCat.toLowerCase()
                                        ? 'bg-slate-900 text-white border-slate-950 shadow-3xs'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-650 border-slate-200'
                                    }`}
                                  >
                                    {cat}
                                  </button>
                                );
                              })}
                            </div>

                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Tag className="h-4 w-4 text-slate-400" />
                              </div>
                              <input
                                type="text"
                                placeholder="Or enter custom tag..."
                                value={newTaskCategory}
                                onChange={(e) => setNewTaskCategory(e.target.value)}
                                required
                                className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 outline-none transition-all font-semibold placeholder:text-slate-400"
                              />
                            </div>
                          </div>

                          {/* Description / Self Notes */}
                          <div className="space-y-1.5 text-left">
                            <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block font-mono">Personal Study Notes & Details</label>
                            <div className="relative">
                              <div className="absolute top-2.5 left-3 pointer-events-none">
                                <AlignLeft className="h-4 w-4 text-slate-400" />
                              </div>
                              <textarea
                                placeholder="Jot down quick references, page numbers, links, or helpful thoughts to guide yourself..."
                                value={newTaskDesc}
                                onChange={(e) => setNewTaskDesc(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 outline-none transition-all h-20 resize-none placeholder:text-slate-400"
                              />
                            </div>
                          </div>

                          {/* Due Date */}
                          <div className="space-y-1.5 text-left">
                            <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block font-mono">Target Completion Date</label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Calendar className="h-4 w-4 text-slate-400" />
                              </div>
                              <input
                                type="date"
                                value={newTaskDueDate}
                                onChange={(e) => setNewTaskDueDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white rounded-xl pl-9 pr-3 py-2 text-xs text-slate-700 font-bold outline-none transition-all"
                              />
                            </div>
                          </div>

                          {/* Personal Priority */}
                          <div className="space-y-2 text-left">
                            <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block font-mono">Personal Urgency Priority</label>
                            <div className="grid grid-cols-3 gap-2.5">
                              {[
                                { value: 'high', label: 'High Priority', colorClass: 'bg-rose-500' },
                                { value: 'medium', label: 'Normal', colorClass: 'bg-amber-500' },
                                { value: 'low', label: 'Relaxed', colorClass: 'bg-emerald-500' }
                              ].map(opt => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setNewTaskPriority(opt.value as any)}
                                  className={`py-2 px-1 border cursor-pointer font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 text-[10.5px] ${
                                    newTaskPriority === opt.value 
                                      ? 'bg-slate-900 border-slate-950 text-white font-extrabold shadow-sm' 
                                      : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50 hover:border-slate-300'
                                  }`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${opt.colorClass}`} />
                                  <span>{opt.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Estimated study duration */}
                          <div className="space-y-2 border-t border-slate-100 pt-3.5 text-left">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-indigo-650 shrink-0" />
                              <label className="text-[10px] text-slate-900 font-extrabold uppercase tracking-wider block font-mono">Estimated Study Duration</label>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                              {[
                                { value: '15m', label: '15 Mins', desc: 'Quick Check' },
                                { value: '30m', label: '30 Mins', desc: 'Sprint' },
                                { value: '1h', label: '1 Hour', desc: 'Focus Block' },
                                { value: '2h', label: '2+ Hours', desc: 'Deep Dive' }
                              ].map(opt => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setPersonalEstDuration(opt.value)}
                                  className={`p-2 border cursor-pointer rounded-xl transition-all text-center flex flex-col justify-center gap-0.5 ${
                                    personalEstDuration === opt.value 
                                      ? 'bg-indigo-50 border-indigo-250 text-indigo-950 font-black shadow-3xs' 
                                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                  }`}
                                >
                                  <span className="text-[10.5px] block leading-none">{opt.label}</span>
                                  <span className="text-[7.5px] font-medium block text-slate-400 uppercase tracking-tight mt-0.5">{opt.desc}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Routine Recurrence */}
                          <div className="space-y-2 border-t border-slate-100 pt-3.5 text-left">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
                              <label className="text-[10px] text-slate-900 font-extrabold uppercase tracking-wider block font-mono">Routine Recurrence Settings</label>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { value: 'one-off', label: '📌 One-off Task', desc: 'Complete once' },
                                { value: 'daily', label: '🔁 Daily Habit', desc: 'Repeat daily' },
                                { value: 'weekly', label: '📅 Weekly Check', desc: 'Every week' }
                              ].map(opt => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setPersonalRecurrence(opt.value)}
                                  className={`p-2 border cursor-pointer rounded-xl transition-all text-center flex flex-col justify-center gap-0.5 ${
                                    personalRecurrence === opt.value 
                                      ? 'bg-amber-50 border-amber-200 text-amber-950 font-black shadow-3xs' 
                                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                  }`}
                                >
                                  <span className="text-[10.5px] block leading-none">{opt.label}</span>
                                  <span className="text-[7.5px] font-medium block text-slate-405 uppercase tracking-tight mt-0.5">{opt.desc}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Personal Step checklist */}
                          <div className="space-y-2 border-t border-slate-100 pt-3.5 text-left">
                            <div className="flex items-center gap-1.5">
                              <CheckSquare className="w-4 h-4 text-slate-800" />
                              <label className="text-[10px] text-slate-900 font-extrabold uppercase tracking-wider block font-mono">Personal Step-by-Step Checklist</label>
                            </div>
                            
                            {/* Interactive Milestone Input and Add Button */}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="e.g. Set up desk, Read page 12, Print worksheet..."
                                value={newTaskSubtaskInputValue}
                                onChange={(e) => setNewTaskSubtaskInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddNewSubtaskToList(newTaskSubtaskInputValue);
                                  }
                                }}
                                className="flex-1 bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white rounded-xl px-3 py-2 text-xs text-slate-900 outline-none transition-all placeholder:text-slate-400"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddNewSubtaskToList(newTaskSubtaskInputValue)}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-3xs"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>

                            {/* List of Added Milestones */}
                            {newTaskSubtasksList.length > 0 && (
                              <div className="space-y-1.5 p-2 bg-slate-50 border border-slate-200/60 rounded-xl max-h-56 overflow-y-auto">
                                {newTaskSubtasksList.map((sub, index) => (
                                  <div
                                    key={sub.id}
                                    className="flex items-center justify-between gap-2.5 p-2 bg-white border border-slate-150 rounded-lg shadow-3xs transition-all animate-fadeIn"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setNewTaskSubtasksList(prev => 
                                            prev.map((item, idx) => 
                                              idx === index ? { ...item, completed: !item.completed } : item
                                            )
                                          );
                                        }}
                                        className="text-slate-300 hover:text-indigo-600 transition-colors shrink-0 cursor-pointer"
                                      >
                                        {sub.completed ? (
                                          <CheckCircle2 className="w-4 h-4 text-slate-800 fill-slate-50" />
                                        ) : (
                                          <div className="w-4 h-4 rounded-full border border-slate-300 hover:border-slate-800 bg-white" />
                                        )}
                                      </button>

                                      <span className={`text-[11px] font-bold truncate ${sub.completed ? 'line-through text-slate-400' : 'text-slate-750'}`}>
                                        {sub.title}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setNewTaskSubtasksList(prev => prev.filter((_, idx) => idx !== index));
                                      }}
                                      className="text-slate-350 hover:text-rose-600 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                                      title="Delete step"
                                    >
                                      <Trash className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Private Attachments */}
                          <div className="space-y-2 border-t border-slate-100 pt-3.5 text-left">
                            <div className="flex items-center gap-1.5">
                              <Paperclip className="w-4 h-4 text-slate-500" />
                              <label className="text-[10px] text-slate-900 font-extrabold uppercase tracking-wider block font-mono">Private Study References</label>
                            </div>
                            
                            {composerAttachments.length > 0 && (
                              <div className="space-y-1.5 mb-2 bg-slate-50 border border-slate-150 rounded-xl p-2.5 text-left">
                                {composerAttachments.map((att, index) => (
                                  <div key={index} className="flex items-center justify-between text-[11px] bg-white border border-slate-150 px-2.5 py-2 rounded-lg shadow-3xs animate-fadeIn">
                                    <span className="flex items-center gap-2 truncate max-w-[80%]">
                                      {att.source === 'google-drive' ? (
                                        <span className="text-[8px] px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-100 rounded font-bold font-mono">DRIVE</span>
                                      ) : (
                                        <span className="text-[8px] px-1.5 py-0.5 bg-sky-50 text-sky-800 border border-sky-100 rounded font-bold font-mono">LOCAL</span>
                                      )}
                                      <span className="truncate text-slate-750 font-bold">{att.name}</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setComposerAttachments(p => p.filter((_, i) => i !== index))}
                                      className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                                      title="Remove attachment"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2.5">
                              <button
                                type="button"
                                onClick={openGooglePicker}
                                className="bg-white hover:bg-slate-50 border border-slate-200 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[10.5px] font-bold text-slate-705 shadow-3xs"
                              >
                                <Link className="w-3.5 h-3.5 text-amber-500" /> Add private Link
                              </button>
                              
                              <label className="bg-white hover:bg-slate-50 border border-slate-200 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-[10.5px] font-bold text-slate-705 shadow-3xs text-center">
                                <UploadCloud className="w-3.5 h-3.5 text-slate-800" /> Upload PDF/Resource
                                <input 
                                  type="file" 
                                  onChange={handleLocalFileSelect}
                                  className="hidden" 
                                />
                              </label>
                            </div>
                          </div>

                          <button
                            type="submit"
                            className="w-full bg-slate-900 hover:bg-slate-850 text-white font-extrabold py-3 rounded-xl text-xs shadow-sm transition-all block cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] mt-2"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Save to Private Planner</span>
                          </button>
                        </div>
                      )}
                    </form>
                  </div>
                </motion.div>
              )}

              {/* --- TAB 3: CLASSROOM SECTION (ANNOUNCEMENTS FEED & MEMBERS BOARD) --- */}
              {activeTab === 'classroom' && (
                <motion.div
                  key="classroom-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="p-4 space-y-4 text-left font-sans"
                >
                  {/* Active group invite key & stats */}
                  <div className="bg-gradient-to-br from-indigo-950 to-slate-900 rounded-3xl p-5 border border-indigo-900/60 text-white shadow-md relative overflow-hidden">
                    <div className="relative z-10 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="text-[9px] font-mono uppercase bg-indigo-700 text-indigo-50 px-2 py-0.5 rounded font-black tracking-widest leading-none">
                            ACTIVE CLASSROOM
                          </span>
                          <h3 className="font-sans font-black text-lg tracking-tight mt-1 leading-tight">{activeGroup?.name || "No Active Class"}</h3>
                          <p className="text-slate-300 text-xs italic mt-1 font-sans">{activeGroup?.description}</p>
                        </div>
                        {activeUserIsLeader && (
                          <button
                            type="button"
                            onClick={() => setClassroomSubTab(classroomSubTab === 'members' ? 'leaderboard' : 'members')}
                            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-black shrink-0 ${
                              classroomSubTab === 'members'
                                ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-sm'
                                : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
                            }`}
                            title="Open Classroom Settings & Member Management"
                          >
                            <Settings className="w-4 h-4 animate-spin-slow" />
                            <span>Class Settings</span>
                          </button>
                        )}
                      </div>

                      {/* Invitation authorization card */}
                      <div className="bg-white/10 p-3 rounded-2xl flex items-center justify-between border border-white/10">
                        <div>
                          <span className="text-[9px] font-mono text-slate-300 uppercase tracking-widest font-bold">Invite Members Access Key</span>
                          <span className="text-sm font-mono block font-black text-yellow-300 tracking-wider">
                            {activeGroupId}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            const textToCopy = activeGroupId || "";
                            if (navigator.clipboard && window.isSecureContext) {
                              navigator.clipboard.writeText(textToCopy).catch(() => {});
                            } else {
                              const textArea = document.createElement("textarea");
                              textArea.value = textToCopy;
                              textArea.style.position = "fixed";
                              textArea.style.left = "-9999px";
                              document.body.appendChild(textArea);
                              textArea.select();
                              try { document.execCommand('copy'); } catch {}
                              document.body.removeChild(textArea);
                            }
                            alert(`Invitation authorization key: "${activeGroupId}" copied to clipboard! Share with classmates to join.`);
                          }}
                          className="text-[9.5px] bg-white text-indigo-950 font-bold py-1.5 px-3 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                        >
                          Copy Key
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Classroom Tab Contents */}
                  {classroomSubTab !== 'members' ? (
                    /* DEFAULT VIEW: LEADERBOARD */
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-150 pb-2.5">
                        <Trophy className="w-4 h-4 text-amber-500 animate-bounce" />
                        <h4 className="font-sans font-black text-slate-900 text-xs sm:text-sm tracking-tight">Classroom Leaderboard</h4>
                      </div>

                      <div className="bg-gradient-to-r from-amber-500/10 to-indigo-500/10 p-3 rounded-xl border border-amber-200/50 text-left">
                        <p className="text-[10.5px] text-slate-700 leading-relaxed font-sans">
                          🏆 <strong>Scholastic Leaderboard:</strong> Earn points by completing synced class tasks. Climb the ranks and earn your bragging rights!
                        </p>
                      </div>

                      <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-0.5">
                        {classroomLeaderboard.length === 0 ? (
                          <p className="italic text-[10.5px] text-slate-400 text-center py-6 bg-slate-50 rounded-xl">No classmates have earned points yet. Complete a synced class task to begin!</p>
                        ) : (
                          classroomLeaderboard.map((member, index) => {
                            const isSelf = member.userId === activeProfileId;
                            const rank = index + 1;
                            
                            // Style top ranks uniquely
                            let cardStyle = "bg-slate-50 border-slate-150";
                            let medal = "";
                            if (rank === 1) {
                              cardStyle = "bg-amber-50/50 border-amber-200 shadow-3xs ring-1 ring-amber-300";
                              medal = "🥇";
                            } else if (rank === 2) {
                              cardStyle = "bg-slate-100/60 border-slate-250";
                              medal = "🥈";
                            } else if (rank === 3) {
                              cardStyle = "bg-amber-900/5 border-amber-900/10";
                              medal = "🥉";
                            }

                            return (
                              <div 
                                key={member.userId}
                                className={`p-3 border rounded-xl flex items-center justify-between gap-3 text-left transition-all ${cardStyle}`}
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  {/* Rank Indicator */}
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center font-mono font-black text-[11px] shrink-0 bg-white/80 border border-slate-200">
                                    {medal ? medal : rank}
                                  </div>

                                  <img 
                                    src={member.avatar} 
                                    alt="Student avatar icon" 
                                    className="w-8 h-8 rounded-full object-cover shrink-0 border" 
                                    referrerPolicy="no-referrer" 
                                  />
                                  
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h5 className="text-[11.5px] font-black text-slate-900 leading-tight flex items-center gap-1">
                                        <span>{member.name}</span>
                                        {member.equippedBadge && <BadgeIcon emoji={member.equippedBadge} className="w-3.5 h-3.5 shrink-0" />}
                                        {isSelf && <span className="text-indigo-650 text-[9.5px] font-extrabold shrink-0">(You)</span>}
                                      </h5>
                                      <span className="text-[8px] bg-indigo-50 text-indigo-700 px-1 py-0.2 rounded font-sans font-bold inline-flex items-center gap-1">
                                        <RoleIcon role={member.userRole} className="w-2.5 h-2.5 text-indigo-700" /> {member.userRole}
                                      </span>
                                    </div>
                                    <p className="text-[9.5px] text-slate-400 italic font-mono truncate max-w-[120px] sm:max-w-none">
                                      {member.completedCount} synced task{member.completedCount !== 1 ? 's' : ''} completed
                                    </p>
                                  </div>
                                </div>

                                {/* Points Badge */}
                                <div className="text-right shrink-0">
                                  <span className="text-[12.5px] bg-amber-50 border border-amber-200 text-amber-800 font-black px-2.5 py-1 rounded-xl font-mono flex items-center gap-1 shadow-3xs">
                                    <Award className="w-3.5 h-3.5 text-amber-600" /> {member.points} pts
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    /* SETTINGS VIEW: MEMBERS & CLASSROOM SETTINGS (Only for leader/creator) */
                    activeUserIsLeader && (
                      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3.5">
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-indigo-650" />
                            <h4 className="font-sans font-black text-slate-900 text-xs sm:text-sm tracking-tight">Classroom Members</h4>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black text-slate-500 bg-slate-100">
                            Total Enrolled: {groupMembersList.length}
                          </span>
                        </div>

                        <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-0.5">
                          {groupMembersList.map((member) => {
                            const isSelf = member.userId === activeProfileId;
                            const isLeader = member.role === 'leader';
                            return (
                              <div 
                                key={member.userId}
                                className="p-3 border rounded-xl bg-slate-50 border-slate-150 flex items-center justify-between gap-3 text-left"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <img src={member.avatar} alt="Student avatar icon" className="w-8 h-8 rounded-full object-cover shrink-0 border" referrerPolicy="no-referrer" />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h5 className="text-[11.5px] font-black text-slate-900 leading-tight">
                                        {member.name} {isSelf && <span className="text-indigo-650 text-[9.5px]">(You)</span>}
                                      </h5>
                                      <span className="text-[8.5px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-sans font-bold inline-flex items-center gap-1" title={`Role: ${member.userRole}`}>
                                        <RoleIcon role={member.userRole} className="w-2.5 h-2.5 text-indigo-700" /> {member.userRole}
                                      </span>
                                    </div>
                                    <p className="text-[9.5px] text-slate-400 italic font-mono truncate max-w-[120px] sm:max-w-none">{member.tagline}</p>
                                  </div>
                                </div>

                                {/* ROLE IDENTIFIERS & PERMISSION TOGGLER (ONLY VIEWABLE BY OWNER/LEADER) */}
                                <div className="flex items-center gap-1.5 shrink-0 font-sans">
                                  {isLeader ? (
                                    <span className="px-1.5 py-0.5 bg-yellow-100 border border-yellow-200 text-yellow-800 text-[8px] font-extrabold uppercase rounded-md tracking-wider">
                                      👑 Leader
                                    </span>
                                  ) : (
                                    /* OWNER ASSIGNS PERMISSIONS & OPTION TO REMOVE MEMBER */
                                    <div className="flex flex-col gap-1 items-end">
                                      <button
                                        type="button"
                                        onClick={() => toggleMemberPermissions(member.userId, 'canSyncTasks', member.canSyncTasks)}
                                        className={`px-1.5 py-0.5 rounded text-[8px] font-black border transition-all cursor-pointer ${
                                          member.canSyncTasks 
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-250' 
                                            : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100'
                                        }`}
                                        title="Allow classmate to publish synced tasks"
                                      >
                                        Publish Sync: {member.canSyncTasks ? 'Enabled' : 'Disabled'}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => toggleMemberPermissions(member.userId, 'canAnnounce', member.canAnnounce)}
                                        className={`px-1.5 py-0.5 rounded text-[8px] font-black border transition-all cursor-pointer ${
                                          member.canAnnounce 
                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                                            : 'bg-white text-slate-400 border-slate-205 hover:bg-slate-100'
                                        }`}
                                        title="Allow classmate to post announcements"
                                      >
                                        Announce: {member.canAnnounce ? 'Enabled' : 'Disabled'}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleRemoveMember(member.userId)}
                                        className="px-1.5 py-0.5 rounded text-[8px] font-black border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition-all cursor-pointer"
                                        title="Remove classmate from classroom"
                                      >
                                        Remove Classmate
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )
                  )}

                </motion.div>
              )}

              {/* --- TAB 4: FOCUS TIMER SPRINTS --- */}
              {activeTab === 'focus' && (
                <motion.div
                  key="focus-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="p-4 space-y-4"
                >
                  <PomodoroTimer onTimerComplete={async () => {
                    console.log('Sprint study timer finished!');
                    if (activeProfile) {
                      const today = getTodayString();
                      const yesterday = getYesterdayString();
                      let newStreak = activeProfile.studyStreak || 0;
                      if (activeProfile.lastStudyDate !== today) {
                        if (activeProfile.lastStudyDate === yesterday) {
                          newStreak += 1;
                        } else {
                          newStreak = 1;
                        }
                        try {
                          await updateProfile(activeProfile.id, {
                            studyStreak: newStreak,
                            lastStudyDate: today
                          });
                          setFormSuccess(`Study Sprint Completed! 🔥 Streak is now ${newStreak} days!`);
                          setTimeout(() => setFormSuccess(null), 5050);
                        } catch (e) {
                          console.error(e);
                        }
                      }
                    }
                  }} />

                  <div className="bg-white rounded-2xl border border-slate-200 p-4.5 text-left font-sans text-slate-500 text-xs space-y-2">
                    <h5 className="font-bold text-slate-805 text-xs flex gap-1 items-center">
                      <span>💡</span> Learn Like a Pro
                    </h5>
                    <p className="leading-relaxed">This Pomodoro sprint timer guides structured focus rhythms. Study relentlessly during the 25-minute sprints, then rest during the intermission break modes.</p>
                  </div>
                </motion.div>
              )}

              {/* --- TAB 5: COMPLETED ARCHIVE BOARD --- */}
              {activeTab === 'archive' && (
                <motion.div
                  key="archive-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="p-4 space-y-4 text-left font-sans"
                >
                  {/* ARCHIVE CONFIGURATION STATS ROW */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
                    <div className="flex justify-between items-start gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-650 font-mono">Archive Purges control</span>
                        <h4 className="font-sans font-black text-slate-805 text-sm tracking-tight">Manual & Automated Purge Board</h4>
                        <p className="text-slate-400 text-[10px] leading-relaxed">
                          TaskTrack automatically removes or archives completed coursework based on setting profiles. You can also enforce purgest manually.
                        </p>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-center shrink-0">
                        <span className="text-[9px] block text-slate-400 font-extrabold uppercase">Settings status</span>
                        <span className={`text-[11px] font-black uppercase tracking-tight block ${activeProfile.autoDeleteCompleted ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {activeProfile.autoDeleteCompleted ? `ON (${activeProfile.autoDeleteInterval}d)` : 'Disabled'}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2.5 pt-1.5 border-t border-slate-100 flex-wrap">
                      <button
                        onClick={() => handlePurgeArchive(false)}
                        className="flex-1 min-w-[150px] bg-slate-100 hover:bg-slate-200 text-slate-705 font-bold py-2 rounded-xl text-[10px] text-center transition-colors cursor-pointer"
                        title="Purges based on user auto delete settings"
                      >
                        ⚡ Run Preferences Purge
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Are you sure you want to permanently erase all archived tasks? This is irreversible!")) {
                            handlePurgeArchive(true);
                          }
                        }}
                        className="flex-1 min-w-[150px] bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-black py-2 rounded-xl text-[10px] text-center transition-colors cursor-pointer"
                        title="Wipes all archived coursework data"
                      >
                        ⚠️ Force Delete All Completed
                      </button>
                    </div>
                  </div>

                  {/* ARCHIVED TASKS SCROLLING AREA */}
                  <div className="space-y-3">
                    <span className="text-[9.5px] uppercase font-bold text-slate-500 tracking-wider block font-black">
                      Archived Assignments ({(() => {
                        return tasks.filter(t => {
                          if (t.groupId !== activeGroupId) return false;
                          if (t.isArchived) return true;
                          const isComp = t.isSynced 
                            ? !!completions.find(c => c.classmateId === activeProfileId && c.taskId === t.id)?.completed
                            : !!t.completed;
                          if (isComp || t.status === 'completed') {
                            const completedAtStr = t.completedAt || (t.isSynced ? completions.find(c => c.classmateId === activeProfileId && c.taskId === t.id)?.completedAt : null);
                            if (completedAtStr) {
                              return new Date(completedAtStr) < getStartOfCurrentWeekMonday();
                            }
                            return true;
                          }
                          return false;
                        }).length;
                      })()})
                    </span>

                    {/* Integrated Search bar inside Archive */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search archived description, category or milestone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-650 transition-all placeholder-slate-400 text-slate-900 shadow-sm"
                      />
                    </div>

                    {(() => {
                      const archivedTasksFiltered = tasks.filter(t => {
                        if (t.groupId !== activeGroupId) return false;
                        if (t.isArchived) return true;
                        const isComp = t.isSynced 
                          ? !!completions.find(c => c.classmateId === activeProfileId && c.taskId === t.id)?.completed
                          : !!t.completed;
                        if (isComp || t.status === 'completed') {
                          const completedAtStr = t.completedAt || (t.isSynced ? completions.find(c => c.classmateId === activeProfileId && c.taskId === t.id)?.completedAt : null);
                          if (completedAtStr) {
                            return new Date(completedAtStr) < getStartOfCurrentWeekMonday();
                          }
                          return true;
                        }
                        return false;
                      }).filter(t => {
                        if (searchQuery.trim() === '') return true;
                        const query = searchQuery.toLowerCase();
                        return t.title.toLowerCase().includes(query) || 
                          (t.description || '').toLowerCase().includes(query) || 
                          t.category.toLowerCase().includes(query);
                      });

                      const totalArchivedCount = tasks.filter(t => {
                        if (t.groupId !== activeGroupId) return false;
                        if (t.isArchived) return true;
                        const isComp = t.isSynced 
                          ? !!completions.find(c => c.classmateId === activeProfileId && c.taskId === t.id)?.completed
                          : !!t.completed;
                        if (isComp || t.status === 'completed') {
                          const completedAtStr = t.completedAt || (t.isSynced ? completions.find(c => c.classmateId === activeProfileId && c.taskId === t.id)?.completedAt : null);
                          if (completedAtStr) {
                            return new Date(completedAtStr) < getStartOfCurrentWeekMonday();
                          }
                          return true;
                        }
                        return false;
                      }).length;

                      if (totalArchivedCount === 0) {
                        return (
                          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
                            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-lg">
                              📦
                            </div>
                            <h5 className="font-sans font-bold text-slate-705 text-xs mt-3">Completed Archive is empty.</h5>
                            <p className="text-[10px] text-slate-400 mt-1">When coursework gets marked complete, and Monday starts, they will be archived here.</p>
                          </div>
                        );
                      }

                      if (archivedTasksFiltered.length === 0) {
                        return (
                          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
                            <h5 className="font-sans font-bold text-slate-705 text-xs">No matching results.</h5>
                            <p className="text-[10px] text-slate-400 mt-1">Try adjusting your search keywords to find archived assignments.</p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-3">
                          {archivedTasksFiltered.map(task => {
                            const canDelete = activeUserIsLeader || task.createdById === activeProfileId || !task.isSynced;
                          return (
                            <div key={task.id} className="bg-white rounded-2xl border border-slate-200 p-4.5 flex flex-col sm:flex-row justify-between sm:items-center gap-3 shadow-xs">
                              <div className="space-y-1 text-left min-w-0 flex-1 font-sans">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h5 className="font-bold text-slate-900 text-xs sm:text-sm truncate">{task.title}</h5>
                                  <span className="text-[8px] font-bold font-mono px-1.5 py-0.5 rounded bg-amber-50 border border-amber-100 text-stone-900 uppercase">
                                    {task.category}
                                  </span>
                                </div>
                                <p className="text-[10.5px] text-slate-505 leading-normal truncate">{task.description || "No customized guidelines provided."}</p>
                                {task.completedAt && (
                                  <p className="text-[9px] text-slate-400 font-mono">Completed on: {new Date(task.completedAt).toLocaleString()}</p>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                                <button
                                  onClick={() => handleToggleArchive(task.id, false)}
                                  className="px-3 py-1.5 text-[10.5px] font-bold rounded-xl bg-indigo-50 border border-indigo-100/60 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer"
                                  title="Restores task to active boards"
                                >
                                  🔄 Restore Feed
                                </button>
                                {canDelete && (
                                  <button
                                    onClick={() => handleDeleteTask(task)}
                                    className="p-2 text-rose-650 hover:bg-rose-50 border border-transparent hover:border-rose-250 rounded-xl transition-colors cursor-pointer"
                                    title="Wipe record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )})()}
                  </div>
                </motion.div>
              )}

              {/* --- TAB 6: SETTINGS & CUSTOM COLORS CONTROL PANEL --- */}
              {activeTab === 'settings' && (
                <motion.div
                  key="settings-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="p-4 space-y-6 text-left font-sans pb-24"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
                    <div>
                      <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Settings className="w-5 h-5 text-indigo-650" />
                        Control Center & Preferences
                      </h2>
                      <p className="text-slate-400 text-xs mt-1">Fully customize your Student Profile, system settings, and custom color themes.</p>
                    </div>
                  </div>

                  {settingsSaveSuccess && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-850 shadow-sm"
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-650 shrink-0" />
                      <div className="text-xs">
                        <p className="font-extrabold">Settings Saved Successfully!</p>
                        <p className="opacity-90 font-mono mt-0.5">Your student profile and theme preferences have been securely synced.</p>
                      </div>
                    </motion.div>
                  )}

                  <form onSubmit={handleUpdateProfile} className="space-y-6">
                    {/* CARD 2: COLOR PALETTE & VIEW CUSTOMIZATION */}
                    <div className="theme-card-bg theme-text-main rounded-3xl border border-slate-200 p-5 space-y-4.5 shadow-3xs">
                      <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                        <span className="text-lg">🎨</span>
                        <div className="text-left">
                          <h4 className="font-sans font-black text-slate-805 text-sm tracking-tight">Interactive Theme & Color Customizer</h4>
                          <p className="text-slate-400 text-[10px]">Select presets or use the real-time custom color picker.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4 text-left">
                          <div className="space-y-1.5 relative">
                            <label className="text-[10px] font-mono font-extrabold uppercase tracking-wide text-slate-500 block">Select Customizer Layer</label>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setIsLayerDropdownOpen(!isLayerDropdownOpen)}
                                className="w-full bg-slate-50 border border-slate-150 hover:bg-slate-100 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 flex items-center justify-between transition-all shadow-3xs cursor-pointer focus:outline-none"
                              >
                                <div className="flex items-center gap-2.5 text-left">
                                  <div 
                                    className="w-4 h-4 rounded-full border border-black/10 shrink-0" 
                                    style={{ backgroundColor: getActiveLayerColor() }} 
                                  />
                                  <div>
                                    <span className="block text-xs font-black text-slate-805 leading-none">
                                      {selectedLayer === 'accent' ? 'Primary Accent' : selectedLayer === 'bg' ? 'Page Background' : selectedLayer === 'card' ? 'Card & Surface' : selectedLayer === 'text' ? 'Primary Text' : 'Sidebar Background'}
                                    </span>
                                    <span className="block text-[9px] text-slate-400 font-medium mt-0.5 leading-none">
                                      {selectedLayer === 'accent' ? 'Buttons, active states, indicators' : selectedLayer === 'bg' ? 'Main workspace background areas' : selectedLayer === 'card' ? 'Bento panels, cards, content blocks' : selectedLayer === 'text' ? 'Headings, titles, paragraph texts' : 'Classroom selection left column'}
                                    </span>
                                  </div>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isLayerDropdownOpen ? 'rotate-180' : ''}`} />
                              </button>

                              {isLayerDropdownOpen && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-40" 
                                    onClick={() => setIsLayerDropdownOpen(false)} 
                                  />
                                  <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-150 rounded-2xl shadow-lg z-50 overflow-hidden py-1 divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1 duration-100">
                                    {[
                                      { key: 'accent', label: 'Primary Accent', desc: 'Buttons, active states, indicators', color: customColor },
                                      { key: 'bg', label: 'Page Background', desc: 'Main workspace background areas', color: customBgColor || (appThemeMode === 'dark' ? '#020617' : appThemeMode === 'sepia' ? '#FAF6EE' : '#f8fafc') },
                                      { key: 'card', label: 'Card & Surface', desc: 'Bento panels, cards, content blocks', color: customCardColor || (appThemeMode === 'dark' ? '#0f172a' : appThemeMode === 'sepia' ? '#FDFBF7' : '#ffffff') },
                                      { key: 'text', label: 'Primary Text', desc: 'Headings, titles, paragraph texts', color: customTextColor || (appThemeMode === 'dark' ? '#f1f5f9' : appThemeMode === 'sepia' ? '#433422' : '#0f172a') },
                                      { key: 'sidebar', label: 'Sidebar Background', desc: 'Classroom selection left column', color: customSidebarColor || '#0f172a' }
                                    ].map(layer => (
                                      <button
                                        key={layer.key}
                                        type="button"
                                        onClick={() => {
                                          setSelectedLayer(layer.key as any);
                                          setIsLayerDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                                          selectedLayer === layer.key ? 'bg-indigo-50/20' : ''
                                        }`}
                                      >
                                        <div 
                                          className="w-4.5 h-4.5 rounded-full border border-black/10 shrink-0 shadow-3xs" 
                                          style={{ backgroundColor: layer.color }} 
                                        />
                                        <div className="flex-1 min-w-0">
                                          <span className={`block text-xs leading-none ${selectedLayer === layer.key ? 'font-black text-indigo-600' : 'font-bold text-slate-800'}`}>
                                            {layer.label}
                                          </span>
                                          <span className="block text-[9px] text-slate-400 mt-1 truncate">
                                            {layer.desc}
                                          </span>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-3">
                            <div className="w-full flex justify-center p-3 bg-slate-50 border border-slate-150 rounded-2xl shadow-3xs">
                              <HexColorPicker 
                                color={getActiveLayerColor()} 
                                onChange={(hex) => handleActiveLayerColorChange(hex)}
                              />
                            </div>
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 rounded-2xl p-2.5">
                              <div className="w-7 h-7 rounded-lg border border-black/10 shrink-0 shadow-3xs transition-all" style={{ backgroundColor: getActiveLayerColor() }} />
                              <div className="flex-1 flex items-center gap-1.5">
                                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">HEX:</span>
                                <input 
                                  type="text" 
                                  value={getActiveLayerColor()} 
                                  maxLength={7}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleActiveLayerColorChange(val);
                                  }}
                                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 w-24 focus:outline-none focus:border-indigo-650"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={handleResetLayer}
                                className="bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-700 text-[10px] font-extrabold px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-3xs transition-all cursor-pointer mr-1"
                              >
                                Reset
                              </button>
                              <span className="text-[9px] font-medium text-slate-400">Drag to customize</span>
                            </div>
                          </div>

                          {/* 🎨 PREMIUM THEME CENTER */}
                          <div className="space-y-4 pt-4 border-t border-slate-100">
                            <div>
                              <span className="text-[10px] font-mono font-extrabold uppercase tracking-wide text-slate-500 block">1. Suggested Full Themes:</span>
                              <p className="text-[9px] text-slate-400 mt-0.5">Click a preset to load and preview the entire style.</p>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {SUGGESTED_PRESETS.map(preset => {
                                const isActive = 
                                  customColor === preset.color &&
                                  (customBgColor || (preset.mode === 'dark' ? '#020617' : preset.mode === 'sepia' ? '#FAF6EE' : '#f8fafc')) === preset.bg &&
                                  (customCardColor || (preset.mode === 'dark' ? '#0f172a' : preset.mode === 'sepia' ? '#FDFBF7' : '#ffffff')) === preset.card &&
                                  (customTextColor || (preset.mode === 'dark' ? '#f1f5f9' : preset.mode === 'sepia' ? '#433422' : '#0f172a')) === preset.text &&
                                  (customSidebarColor || '#0f172a') === preset.sidebar &&
                                  appThemeMode === preset.mode;

                                return (
                                  <div
                                    key={preset.id}
                                    onClick={() => handleSelectPreset(preset)}
                                    className={`p-3 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between gap-2.5 hover:scale-101 relative group ${
                                      isActive
                                        ? 'bg-slate-50 border-slate-800 ring-1 ring-slate-800'
                                        : 'bg-white hover:bg-slate-50 border-slate-150'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-black text-slate-805">{preset.name}</span>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={(e) => handleCopyPreset(preset, e)}
                                          className="p-1 rounded bg-slate-50 border border-slate-200 text-slate-450 hover:bg-slate-105 hover:text-slate-700 transition-colors cursor-pointer"
                                          title="Copy configuration code"
                                        >
                                          {copiedPresetId === preset.id ? (
                                            <span className="text-[9px] font-bold text-emerald-600 px-0.5">Copied!</span>
                                          ) : (
                                            <span className="text-[10px]">📋</span>
                                          )}
                                        </button>
                                        {isActive && (
                                          <span className="text-[9px] font-mono font-extrabold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                                            Active
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Swatch palette row */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1">
                                        <div className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: preset.color }} title="Accent" />
                                        <div className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: preset.bg }} title="Page Background" />
                                        <div className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: preset.card }} title="Card Surface" />
                                        <div className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: preset.text }} title="Text color" />
                                        <div className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: preset.sidebar }} title="Sidebar" />
                                      </div>
                                      <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest">{preset.mode} Contrast</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* 📂 CUSTOM SAVED PRESETS */}
                          <div className="space-y-4 pt-4 border-t border-slate-100">
                            <div>
                              <span className="text-[10px] font-mono font-extrabold uppercase tracking-wide text-slate-500 block">2. Your Custom Presets:</span>
                              <p className="text-[9px] text-slate-400 mt-0.5">Save your bespoke workspace configurations to reuse or delete.</p>
                            </div>

                            {userPresets.length === 0 ? (
                              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center">
                                <p className="text-[10px] text-slate-405 italic">No custom presets saved yet. Build a configuration above and save it below!</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {userPresets.map(preset => {
                                  const isActive = 
                                    customColor === preset.color &&
                                    customBgColor === preset.bg &&
                                    customCardColor === preset.card &&
                                    customTextColor === preset.text &&
                                    customSidebarColor === preset.sidebar &&
                                    appThemeMode === preset.mode;

                                  return (
                                    <div
                                      key={preset.id}
                                      onClick={() => handleSelectPreset(preset)}
                                      className={`p-3 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between gap-2.5 hover:scale-101 relative group ${
                                        isActive
                                          ? 'bg-slate-50 border-slate-800 ring-1 ring-slate-800'
                                          : 'bg-white hover:bg-slate-50 border-slate-150'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-slate-805 truncate max-w-[120px]">{preset.name}</span>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={(e) => handleCopyPreset(preset, e)}
                                            className="p-1 rounded bg-slate-50 border border-slate-200 text-slate-450 hover:bg-slate-105 hover:text-slate-700 transition-colors cursor-pointer"
                                            title="Copy configuration code"
                                          >
                                            {copiedPresetId === preset.id ? (
                                              <span className="text-[9px] font-bold text-emerald-600 px-0.5">Copied!</span>
                                            ) : (
                                              <span className="text-[10px]">📋</span>
                                            )}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => handleDeletePreset(preset.id, e)}
                                            className="p-1 rounded bg-rose-50 border border-rose-150 text-rose-500 hover:bg-rose-100 transition-colors cursor-pointer"
                                            title="Delete preset"
                                          >
                                            <span className="text-[10px]">🗑️</span>
                                          </button>
                                          {isActive && (
                                            <span className="text-[9px] font-mono font-extrabold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                                              Active
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Swatch palette row */}
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1">
                                          <div className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: preset.color }} title="Accent" />
                                          <div className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: preset.bg || '#f8fafc' }} title="Page Background" />
                                          <div className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: preset.card || '#ffffff' }} title="Card Surface" />
                                          <div className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: preset.text || '#0f172a' }} title="Text color" />
                                          <div className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: preset.sidebar || '#0f172a' }} title="Sidebar" />
                                        </div>
                                        <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest">{preset.mode} Contrast</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Create custom preset form */}
                            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 flex flex-col sm:flex-row items-center gap-2 text-left">
                              <div className="flex-1 w-full space-y-1">
                                <label className="text-[9px] font-mono font-extrabold uppercase tracking-wide text-slate-400 block">Name Your Custom Preset</label>
                                <input
                                  type="text"
                                  value={newPresetName}
                                  onChange={(e) => setNewPresetName(e.target.value)}
                                  placeholder="e.g. Cyberpunk Neon"
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-indigo-650"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={handleAddPreset}
                                disabled={!newPresetName.trim()}
                                className="w-full sm:w-auto bg-slate-900 hover:bg-slate-850 disabled:opacity-50 text-white text-[11px] font-extrabold px-4 py-2.5 rounded-xl cursor-pointer shrink-0 transition-all flex items-center justify-center gap-1.5 mt-auto sm:mt-5"
                              >
                                <span>Save Current Mix</span>
                              </button>
                            </div>
                          </div>

                          {/* 📥 IMPORT SHAREABLE CONFIG */}
                          <div className="space-y-2.5 pt-4 border-t border-slate-100">
                            <div>
                              <span className="text-[10px] font-mono font-extrabold uppercase tracking-wide text-slate-500 block">3. Import Shared Theme Code:</span>
                              <p className="text-[9px] text-slate-400 mt-0.5">Paste a shared theme config code (starting with ST_) to instantly load and add it.</p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-2">
                              <input
                                type="text"
                                value={importCode}
                                onChange={(e) => {
                                  setImportCode(e.target.value);
                                  setImportError('');
                                }}
                                placeholder="Paste shared code starting with ST_ here..."
                                className="w-full flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-650"
                              />
                              <button
                                type="button"
                                onClick={handleImportThemeCode}
                                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold px-4 py-2.5 rounded-xl cursor-pointer shrink-0 transition-all"
                              >
                                Import Theme
                              </button>
                            </div>

                            {importError && (
                              <p className="text-[10px] font-bold text-rose-600 font-sans mt-1 text-left">⚠️ {importError}</p>
                            )}
                            {importSuccess && (
                              <p className="text-[10px] font-bold text-emerald-600 font-sans mt-1 text-left">✨ {importSuccess}</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3 text-left">
                          <label className="text-[10px] font-mono font-extrabold uppercase tracking-wide text-slate-500 block">View Contrast Theme Mode</label>
                          <div className="grid grid-cols-3 gap-2.5">
                            {[
                              { id: 'light', label: '☀️ Light Slate', bg: 'bg-white border-slate-200' },
                              { id: 'dark', label: '🌑 Dark Void', bg: 'bg-slate-900 border-slate-800' },
                              { id: 'sepia', label: '☕ Sepia Coffee', bg: 'bg-[#faf6f0] border-amber-200/60' }
                            ].map(m => {
                              const isActive = appThemeMode === m.id;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    setAppThemeMode(m.id as any);
                                    setCustomBgColor('');
                                    setCustomCardColor('');
                                    setCustomTextColor('');
                                    setCustomSidebarColor('');
                                  }}
                                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col justify-between h-20 ${m.bg} ${
                                    isActive 
                                      ? 'scale-102 font-extrabold text-slate-950 shadow-sm' 
                                      : 'hover:scale-101 text-slate-400'
                                  }`}
                                  style={isActive ? { borderColor: customColor, borderWidth: '2px', boxShadow: `0 0 0 4px ${customColor}25` } : {}}
                                >
                                  <span className="text-xs font-black block">{m.label}</span>
                                  <span className="text-[8px] font-mono uppercase tracking-widest block opacity-75">{isActive ? 'ACTIVE' : 'SELECT'}</span>
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-[9.5px] text-slate-400 leading-normal">Instantly shift between high contrast day study backgrounds, pure night-void setups, or amber sepia warmth.</p>
                        </div>
                      </div>

                      

                    </div>

                    {/* CARD 3: AUTO-DELETE PREFERENCES */}
                    <div className="theme-card-bg theme-text-main rounded-3xl border border-slate-200 p-5 space-y-4.5 shadow-3xs text-left">
                      <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                        <span className="text-lg">🧹</span>
                        <div className="text-left">
                          <h4 className="font-sans font-black text-slate-805 text-sm tracking-tight">Automated Cleanup & Purge Intervals</h4>
                          <p className="text-slate-400 text-[10px]">Enable self-archiving triggers to keep dashboards pristine.</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl shadow-3xs">
                          <div className="space-y-0.5 pr-4">
                            <span className="text-xs font-black text-slate-900 block">Auto-Delete Completed Coursework</span>
                            <span className="text-[9.5px] text-slate-400 block leading-normal">Instruct the secure backend and clients to purge accomplished tasks on schedule.</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditAutoDeleteCompleted(!editAutoDeleteCompleted)}
                            className={`w-12 h-6.5 rounded-full p-1 transition-colors cursor-pointer ${editAutoDeleteCompleted ? 'bg-indigo-600' : 'bg-slate-250'}`}
                          >
                            <div className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform ${editAutoDeleteCompleted ? 'translate-x-5.5' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        {editAutoDeleteCompleted && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="space-y-1.5"
                          >
                            <label className="text-[10px] font-mono font-extrabold uppercase tracking-wide text-slate-500">Scheduled Trigger Age</label>
                            <select
                              value={editAutoDeleteInterval}
                              onChange={(e) => setEditAutoDeleteInterval(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-650/30 focus:border-indigo-650 transition-all shadow-3xs cursor-pointer"
                            >
                              <option value="immediate">⚡ Wipe immediately upon completion tick</option>
                              <option value="1">📅 Retain for 1 full day, then flush</option>
                              <option value="7">📅 Retain for 7 days (Weekly digest)</option>
                              <option value="30">📅 Retain for 30 days (Monthly review)</option>
                            </select>
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* CARD 4: MANUAL PURGES */}
                    <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-3xs text-left">
                      <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                        <span className="text-lg">🚨</span>
                        <div className="text-left">
                          <h4 className="font-sans font-black text-slate-805 text-sm tracking-tight">Manual Database Purge Actions</h4>
                          <p className="text-slate-400 text-[10px]">Manually wipe accomplished work or permanently purge historical records.</p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            handlePurgeArchive(false);
                            setSettingsSaveSuccess(true);
                            setTimeout(() => setSettingsSaveSuccess(false), 2000);
                          }}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold py-3.5 px-4 rounded-2xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-3xs"
                        >
                          <span>⚡</span> Run Preferences Purge
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Are you sure you want to permanently erase all archived tasks? This is completely irreversible!")) {
                              handlePurgeArchive(true);
                              setSettingsSaveSuccess(true);
                              setTimeout(() => setSettingsSaveSuccess(false), 2000);
                            }
                          }}
                          className="flex-1 bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-700 font-black py-3.5 px-4 rounded-2xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-3xs"
                        >
                          <span>⚠️</span> Force Delete All Completed
                        </button>
                      </div>
                    </div>

                    {/* CARD: REAL-TIME ALERTS & NOTIFICATIONS */}
                    <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-3xs text-left">
                      <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                        <span className="text-lg">🔔</span>
                        <div className="text-left">
                          <h4 className="font-sans font-black text-slate-805 text-sm tracking-tight">Real-Time Alerts & System Notifications</h4>
                          <p className="text-slate-400 text-[10px]">Get instant desktop and in-app alerts whenever group members publish tasks, announcements, or comments.</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-150 rounded-2xl shadow-3xs">
                          <div className="text-left flex-1 sm:pr-3">
                            <span className="block text-xs font-black text-slate-900 leading-none">Desktop Push Notifications</span>
                            <span className="block text-[10px] text-slate-450 mt-1 leading-normal">
                              Enable real-time push alerts outside of your browser window. In-app toast alerts will remain active automatically.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={toggleBrowserNotifications}
                            className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all cursor-pointer border shrink-0 ${
                              browserNotificationGranted
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/50'
                                : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-200 text-white shadow-sm'
                            }`}
                          >
                            {browserNotificationGranted ? '✓ Active & Granted' : 'Enable Desktop Alerts'}
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => triggerNotification({
                              title: "Test In-App Alert 🚀",
                              body: "This is a live test of CampusTrack's high-fidelity real-time notification engine.",
                              type: 'success'
                            })}
                            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10.5px] font-bold px-4 py-2 rounded-xl transition-all shadow-3xs cursor-pointer flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Test In-App Toast</span>
                          </button>

                          {browserNotificationGranted && (
                            <button
                              type="button"
                              onClick={() => {
                                if ('Notification' in window && Notification.permission === 'granted') {
                                  new Notification("CampusTrack Live Test 🔔", {
                                    body: "Real-time system notification channels are primed and ready!",
                                    icon: '/favicon.ico'
                                  });
                                }
                              }}
                              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10.5px] font-bold px-4 py-2 rounded-xl transition-all shadow-3xs cursor-pointer flex items-center gap-1.5"
                            >
                              <Bell className="w-3.5 h-3.5 text-amber-500" />
                              <span>Test Desktop Notification</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* CARD 5: APK & SYSTEM CONNECTION SETTINGS */}
                    <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-3xs text-left">
                      <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                        <span className="text-lg">📡</span>
                        <div className="text-left">
                          <h4 className="font-sans font-black text-slate-805 text-sm tracking-tight">API Link & Mobile APK Server</h4>
                          <p className="text-slate-400 text-[10px]">Define target local/production server URLs if running inside custom WebView APKs.</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-mono font-extrabold uppercase tracking-wide text-slate-500">API Connection URL</label>
                        <input 
                          type="url" 
                          placeholder="e.g. https://api.studysync.myuniversity.edu"
                          value={serverApiUrl}
                          onChange={(e) => setServerApiUrl(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-650/30 focus:border-indigo-650 transition-all shadow-3xs"
                        />
                        <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-400 font-mono">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                          <span>Connected to Secure Production Database Engine.</span>
                        </div>
                      </div>
                    </div>

                    {/* FORM SUBMISSION BAR */}
                    <div className="pt-2 flex justify-end gap-3 shrink-0">
                      <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 px-8 rounded-2xl text-xs transition-all shadow-md shadow-indigo-600/20 hover:scale-101 cursor-pointer flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        <span>Save Settings Changes</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

            </AnimatePresence>

          ): null}

        </div>

        {/* --- CUSTOM BOTTOM SHEET SORTING DRAWER SHEET --- */}
        <AnimatePresence>
          {showSortSheet && (
            <>
              {/* Backing dismiss overlay */}
              <div 
                onClick={() => setShowSortSheet(false)} 
                className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 cursor-pointer transition-opacity" 
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 280 }}
                className="absolute left-0 right-0 bottom-0 bg-white border-t border-slate-200 rounded-t-[32px] p-5 pb-8 space-y-4 text-left z-55 shadow-2xl font-sans"
              >
                {/* Visual bar drawer indicator */}
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto" />
                
                <div className="space-y-1">
                  <h4 className="font-sans font-black text-slate-900 text-sm tracking-tight leading-none">Determine Task Sequence</h4>
                  <p className="text-slate-400 text-[10px]">Select a primary column sequence option to arrange active study files.</p>
                </div>

                <div className="space-y-1.5 pt-2">
                  {[
                    { id: 'dueDate', label: '📅 Due Date / Calendar Order', desc: 'Arrange closest submission target dates first' },
                    { id: 'priority', label: '🚨 Urgency Level Prioritization', desc: 'Highlight critical tasks on high focus levels first' },
                    { id: 'category', label: '📚 Study Subject Category (Pills)', desc: 'Order tasks alphabetically according to custom tags' }
                  ].map(option => {
                    const activeOption = sortBy === option.id;
                    return (
                      <button
                        key={option.id}
                        onClick={() => {
                          setSortBy(option.id as any);
                          setShowSortSheet(false);
                        }}
                        className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          activeOption 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-950 font-bold' 
                            : 'bg-slate-50 border-transparent hover:bg-slate-100 text-slate-705'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-black block">{option.label}</span>
                          <span className="text-[9px] font-mono text-slate-400 font-medium block mt-0.5">{option.desc}</span>
                        </div>
                        {activeOption && <CheckCircle2 className="w-4 h-4 text-indigo-650" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* 📱 COZY TOUCH BOTTOM SHIFT NAVIGATION BAR CONTROLS */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200/90 flex items-center justify-around px-4 z-40 select-none lg:hidden">
          <button
            id="switcher-feed-trigger"
            onClick={() => { if (activeGroupId) setActiveTab('tasks'); }}
            disabled={!activeGroupId}
            className={`flex flex-col items-center justify-center gap-1 transition-all flex-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            <AlignLeft className={`w-5 h-5 ${activeTab === 'tasks' ? 'text-indigo-600 stroke-[2.5]' : 'text-slate-400 hover:text-slate-600'}`} />
            <span className={`text-[9px] font-bold ${activeTab === 'tasks' ? 'text-indigo-950 font-extrabold' : 'text-slate-400'}`}>Workloads</span>
          </button>

          <button
            id="switcher-create-trigger"
            onClick={() => { if (activeGroupId) setActiveTab('create'); }}
            disabled={!activeGroupId}
            className={`flex flex-col items-center justify-center gap-1 transition-all flex-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            <Plus className={`w-5 h-5 ${activeTab === 'create' ? 'text-indigo-600 stroke-[2.5]' : 'text-slate-400 hover:text-slate-600'}`} />
            <span className={`text-[9px] font-bold ${activeTab === 'create' ? 'text-indigo-950 font-extrabold' : 'text-slate-400'}`}>Publish</span>
          </button>

          <button
            id="switcher-classroom-trigger"
            onClick={() => { if (activeGroupId) setActiveTab('classroom'); }}
            disabled={!activeGroupId}
            className={`flex flex-col items-center justify-center gap-1 transition-all flex-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            <Users className={`w-5 h-5 ${activeTab === 'classroom' ? 'text-indigo-600 stroke-[2.5]' : 'text-slate-400 hover:text-slate-600'}`} />
            <span className={`text-[9px] font-bold ${activeTab === 'classroom' ? 'text-indigo-950 font-extrabold' : 'text-slate-400'}`}>Class Hub</span>
          </button>

          <button
            id="switcher-focus-trigger"
            onClick={() => { if (activeProfile) setActiveTab('focus'); }}
            disabled={!activeProfile}
            className={`flex flex-col items-center justify-center gap-1 transition-all flex-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            <Flame className={`w-5 h-5 ${activeTab === 'focus' ? 'text-indigo-600 stroke-[2.5]' : 'text-slate-400 hover:text-slate-600'}`} />
            <span className={`text-[9px] font-bold ${activeTab === 'focus' ? 'text-indigo-950 font-extrabold' : 'text-slate-400'}`}>Sprints</span>
          </button>
        </div>

      </div>

        {/* 👤 CUSTOMIZE PROFILE FLOATING MODAL DIALOG */}
        <AnimatePresence>
          {isEditProfileModalOpen && (
            <>
              {/* Backing dismiss overlay */}
              <div 
                onClick={() => setIsEditProfileModalOpen(false)} 
                className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-55 cursor-pointer transition-opacity animate-fade-in" 
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-y-10 sm:inset-y-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-[90%] sm:w-full sm:max-w-lg bg-white rounded-3xl p-6 space-y-5 text-left z-55 shadow-2xl font-sans overflow-y-auto max-h-[85vh]"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-150">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-5 h-5 text-indigo-650" />
                    <h3 className="font-sans font-black text-slate-900 text-sm tracking-tight sm:text-base">Customize Your Profile</h3>
                  </div>
                  <button 
                    onClick={() => setIsEditProfileModalOpen(false)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  {/* Name field */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Student Name</label>
                    <input 
                      type="text" 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="e.g., Alex Johnson"
                      required
                      className="w-full bg-slate-50 border border-slate-205 focus:bg-white rounded-xl px-3 py-2.5 text-xs text-slate-850 outline-none"
                    />
                  </div>

                  {/* Motto / Tagline field */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Bio Motto / Tagline</label>
                    <input 
                      type="text" 
                      value={editTagline}
                      onChange={(e) => setEditTagline(e.target.value)}
                      placeholder="e.g., Physics Major | Class representation"
                      className="w-full bg-slate-50 border border-slate-205 focus:bg-white rounded-xl px-3 py-2.5 text-xs text-slate-850 outline-none"
                    />
                  </div>

                  {/* Select Role option */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Select Role</label>
                    <select
                      value={editUserRole}
                      onChange={(e) => setEditUserRole(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-205 focus:bg-white rounded-xl px-3 py-2.5 text-xs text-slate-850 outline-none"
                    >
                      <option value="Student">Student</option>
                      <option value="Teacher">Teacher</option>
                      <option value="Class">Class</option>
                      <option value="School Department">School Department</option>
                      <option value="Administrative Office">Administrative Office</option>
                      <option value="School">School</option>
                    </select>
                  </div>

                  {/* Custom profile picture uploader */}
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Profile Picture</label>
                    <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-205">
                      <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-slate-200 bg-white shrink-0">
                        <img src={editAvatar || BLANK_WHITE_PICTURE} alt="Selected profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex gap-2">
                          <label className="inline-flex items-center justify-center px-3 py-1 bg-indigo-50 border border-indigo-150 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-lg cursor-pointer transition-colors select-none">
                            <UploadCloud className="w-3 h-3 mr-1 text-indigo-650 shrink-0" />
                            Choose Photo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  const base64Data = await compressImage(file);
                                  setEditAvatar(base64Data);
                                } catch (err: any) {
                                  console.error("Profile picture upload failed:", err);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                          {editAvatar !== BLANK_WHITE_PICTURE && (
                            <button
                              type="button"
                              onClick={() => setEditAvatar(BLANK_WHITE_PICTURE)}
                              className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                            >
                              Clear Photo
                            </button>
                          )}
                        </div>
                        <p className="text-[8px] text-slate-450 leading-tight">Upload pictures from your physical device. Cleared pictures fall back to a blank white template.</p>
                      </div>
                    </div>
                  </div>

                  {/* AUTO-DELETE OPT-IN PREFERENCES */}
                  <div className="bg-slate-50 border border-slate-200/65 p-4 rounded-2xl space-y-3.5">
                    <div className="flex items-start gap-2.5">
                      <input 
                        type="checkbox"
                        id="pref-auto-delete-chk"
                        checked={editAutoDeleteCompleted}
                        onChange={(e) => setEditAutoDeleteCompleted(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-slate-350 select-none text-indigo-650 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="text-left">
                        <label htmlFor="pref-auto-delete-chk" className="text-xs font-black text-slate-900 cursor-pointer">
                          Auto-Delete Completed Submissions
                        </label>
                        <p className="text-[10px] text-slate-450 mt-0.5 leading-tight">
                          Automatically purge completed credentials, checklists, or archived assignments.
                        </p>
                      </div>
                    </div>

                    {editAutoDeleteCompleted && (
                      <div className="space-y-1.5 pl-6 border-l-2 border-indigo-400">
                        <label className="text-[9.5px] uppercase font-extrabold text-slate-400 tracking-wider">Purge Interval Schedule</label>
                        <select
                          value={editAutoDeleteInterval}
                          onChange={(e) => setEditAutoDeleteInterval(e.target.value)}
                          className="w-full bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 outline-none"
                        >
                          <option value="immediate">Immediately upon completion/archived toggle</option>
                          <option value="1">After 24 hours (1 Day)</option>
                          <option value="7">After 7 Days (1 Week)</option>
                          <option value="30">After 30 Days (1 Month)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* 🎨 COLOR SCHEME & APP THEME MODE CUSTOMIZER */}
                  <div className="bg-slate-50 border border-slate-200/65 p-4 rounded-2xl space-y-4">
                    <div className="text-left">
                      <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <Palette className="w-4 h-4 text-indigo-600" />
                        Color Scheme & Theme Customization
                      </label>
                      <p className="text-[10px] text-slate-450 mt-0.5 leading-tight">
                        Personalize the accent colors and contrast modes of your workspace view instantly.
                      </p>
                    </div>

                    {/* Color Schemes Grid */}
                    <div className="space-y-1.5 text-left">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">1. Color Palette Accent</span>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { key: 'indigo', name: 'Indigo Core', dot: 'bg-indigo-600' },
                          { key: 'emerald', name: 'Emerald Forest', dot: 'bg-emerald-600' },
                          { key: 'rose', name: 'Rose Petal', dot: 'bg-rose-600' },
                          { key: 'violet', name: 'Violet Eclipse', dot: 'bg-violet-600' },
                          { key: 'amber', name: 'Amber Sunrise', dot: 'bg-amber-600' },
                          { key: 'slate', name: 'Slate Steel', dot: 'bg-slate-700' },
                        ].map(scheme => (
                          <button
                            key={scheme.key}
                            type="button"
                            onClick={() => {
                              setColorScheme(scheme.key as any);
                              localStorage.setItem('studysync_color_scheme', scheme.key);
                            }}
                            className={`py-2 px-2.5 rounded-xl border text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              colorScheme === scheme.key
                                ? 'bg-white border-slate-800 text-slate-900 shadow-3xs scale-102 ring-1 ring-slate-800'
                                : 'bg-white border-slate-200 text-slate-605 hover:bg-slate-50'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${scheme.dot}`} />
                            <span>{scheme.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Theme modes select buttons */}
                    <div className="space-y-1.5 text-left">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">2. View Contrast Theme Mode</span>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { key: 'light', name: 'Light Slate', icon: Sun },
                          { key: 'dark', name: 'Dark Void', icon: Moon },
                          { key: 'sepia', name: 'Vintage Sepia', icon: Coffee },
                        ].map(modeOpt => {
                          const IconComp = modeOpt.icon;
                          return (
                            <button
                              key={modeOpt.key}
                              type="button"
                              onClick={() => {
                                setAppThemeMode(modeOpt.key as any);
                                localStorage.setItem('studysync_theme_mode', modeOpt.key);
                                localStorage.setItem('studysync_committed_theme_mode', modeOpt.key);
                                
                                // Clear custom overrides to let the selected mode's defaults render
                                setCustomBgColor('');
                                setCustomCardColor('');
                                setCustomTextColor('');
                                setCustomSidebarColor('');
                                
                                localStorage.setItem('studysync_custom_bg_color', '');
                                localStorage.setItem('studysync_custom_card_color', '');
                                localStorage.setItem('studysync_custom_text_color', '');
                                localStorage.setItem('studysync_custom_sidebar_color', '');
                                
                                localStorage.setItem('studysync_committed_bg_color', '');
                                localStorage.setItem('studysync_committed_card_color', '');
                                localStorage.setItem('studysync_committed_text_color', '');
                                localStorage.setItem('studysync_committed_sidebar_color', '');
                              }}
                              className={`py-2 px-2.5 rounded-xl border text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                appThemeMode === modeOpt.key
                                  ? 'bg-slate-900 border-slate-900 text-white shadow-3xs scale-102'
                                  : 'bg-white border-slate-200 text-slate-605 hover:bg-slate-50'
                              }`}
                            >
                              <IconComp className="w-3.5 h-3.5 shrink-0" />
                              <span>{modeOpt.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* SYSTEM CONNECTION (APK / MOBILE WRAPPER CONFIG) */}
                  <div className="bg-slate-50 border border-slate-200/65 p-4 rounded-2xl space-y-2.5">
                    <div className="text-left">
                      <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <Link className="w-3.5 h-3.5 text-indigo-650" />
                        System & APK Connection Settings
                      </label>
                      <p className="text-[10px] text-slate-450 mt-0.5 leading-tight">
                        Packaged installations (like compiled Android APKs) require an absolute address to communicate with back-end servers. Set or update your active Cloud deployment target here if needed.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider block">API Base Server URL</label>
                      <input 
                        type="url"
                        value={serverApiUrl}
                        onChange={(e) => setServerApiUrl(e.target.value)}
                        placeholder="e.g., https://ais-pre-4tgsuzuwe3pwzlzchjfwfx-1044932737425.asia-southeast1.run.app"
                        className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                      />
                      <div className="text-[9px] text-slate-400 font-mono flex items-center justify-between pt-0.5">
                        <span>Current Active API Host:</span>
                        <span className="font-bold text-slate-600 truncate max-w-[220px]">
                          {getApiUrl('/api/data').replace('/api/data', '') || 'Browser Default'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Submit buttons */}
                  <div className="pt-4 flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsEditProfileModalOpen(false)}
                      className="flex-1 bg-slate-100 hover:bg-slate-150 text-slate-700 font-bold py-2.5 rounded-xl text-xs text-center transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-650 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs text-center transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                    >
                      Save Bio
                    </button>
                  </div>

                </form>
              </motion.div>
            </>
          )}
        </AnimatePresence>



        <AnimatePresence>
          {latestActiveTask && (
            <>
                {/* Backing Overlay */}
                <div 
                  onClick={() => {
                    setActiveDetailTask(null);
                    setNewCommentText('');
                    setNewCommentImage(null);
                  }}
                  className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-55 cursor-pointer transition-opacity animate-fade-in" 
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="fixed inset-x-4 top-[5%] bottom-[5%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[540px] bg-white rounded-3xl z-55 shadow-2xl overflow-hidden flex flex-col justify-between border border-slate-200"
                >
                  {/* Header Section */}
                  <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-indigo-400" />
                      <div className="text-left font-sans">
                        <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-mono">Assignment Hub</span>
                        <h3 className="font-sans font-black text-sm text-white tracking-tight leading-none mt-0.5 truncate max-w-[280px] sm:max-w-[320px]">
                          {latestActiveTask.title}
                        </h3>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setActiveDetailTask(null);
                        setNewCommentText('');
                        setNewCommentImage(null);
                      }}
                      className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Main Content Area */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Task meta info */}
                    <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl text-left space-y-2.5">
                      <div className="flex justify-between items-center flex-wrap gap-1.5 pt-0.5">
                        <span className="text-[9px] font-mono font-extrabold uppercase bg-amber-50 text-amber-900 border border-amber-100 px-2 py-0.5 rounded">
                          {latestActiveTask.category}
                        </span>
                        <span className="text-[9.5px] font-mono text-slate-450 font-medium">
                          Published by: <span className="text-slate-700 font-extrabold">{latestActiveTask.createdBy}</span>
                        </span>
                      </div>
                      <h4 className="font-sans font-black text-slate-900 text-xs sm:text-sm tracking-tight leading-none mt-0.5">{latestActiveTask.title}</h4>
                      <p className="text-[11.5px] text-slate-650 font-sans leading-relaxed whitespace-pre-wrap">
                        {latestActiveTask.description || "No customized guidelines provided."}
                      </p>
                      <div className="text-[10.5px] text-slate-500 font-semibold flex items-center gap-1 mt-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-indigo-650 shrink-0" />
                        <span>Due: {latestActiveTask.dueDate}</span>
                      </div>

                      {canModifyActiveTask && (
                        <div className="flex items-center gap-2 pt-3 mt-1.5 border-t border-slate-200/70">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTask(latestActiveTask);
                            }}
                            className="flex-1 py-1.5 bg-white hover:bg-slate-50 border border-slate-250 hover:border-slate-350 text-indigo-700 font-bold rounded-xl text-[10px] flex items-center justify-center gap-1.5 transition-all shadow-3xs cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                            Edit Guidelines
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm("Are you sure you want to permanently delete this task? This action cannot be undone.")) {
                                await handleDeleteTask(latestActiveTask);
                                setActiveDetailTask(null);
                              }
                            }}
                            className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 text-rose-700 font-bold rounded-xl text-[10px] flex items-center justify-center gap-1.5 transition-all shadow-3xs cursor-pointer"
                          >
                            <Trash className="w-3.5 h-3.5 text-rose-600" />
                            Delete Task
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Checklist Subtasks in Detail Panel */}
                    {latestActiveTask.subtasks && latestActiveTask.subtasks.length > 0 && (
                      <div className="border border-slate-200 p-4 rounded-2xl bg-slate-50/50 space-y-3 text-left">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 font-sans font-mono flex items-center gap-1.5">
                            <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                            Subtask Milestones ({latestActiveTask.subtasks.filter(s => s.completed).length}/{latestActiveTask.subtasks.length})
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          {latestActiveTask.subtasks.map(subItem => (
                            <div
                              key={subItem.id}
                              onClick={() => toggleTaskCompleteness(latestActiveTask, true, subItem.id, subItem.completed)}
                              className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-[10.5px] font-bold cursor-pointer select-none transition-all ${
                                subItem.completed 
                                  ? 'bg-slate-100/85 text-slate-400 border-slate-150 line-through' 
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-350'
                              }`}
                            >
                              {subItem.completed ? (
                                <CheckCircle2 className="w-4 h-4 text-indigo-600 fill-indigo-50 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300 shrink-0" />
                              )}
                              <span className="truncate flex-1 font-sans">{subItem.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Asynchronous Task Submission & Review Panel */}
                    {(latestActiveTask.submissionType === 'subjective' || latestActiveTask.submissionType === 'objective') && (
                      <div className="border border-indigo-100 p-4 rounded-2xl bg-indigo-50/15 text-left space-y-4">
                        {/* Header with Sub Tab buttons if leader */}
                        <div className="flex items-center justify-between border-b border-indigo-100/50 pb-2.5">
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-750 font-mono flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                            Assignment Desk {latestActiveTask.maxScore !== undefined && `(${latestActiveTask.maxScore} Max Pts)`}
                          </span>
                          
                          {(activeUserIsLeader || latestActiveTask.createdById === activeProfileId) && (
                            <div className="flex bg-slate-100 p-0.5 rounded-lg text-[9px] font-black font-mono">
                              <button
                                type="button"
                                onClick={() => setSubmissionActiveTab('submit')}
                                className={`px-2 py-1 rounded transition-all cursor-pointer ${
                                  submissionActiveTab === 'submit' ? 'bg-white text-indigo-750 shadow-3xs font-black' : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                Submit Tab
                              </button>
                              <button
                                type="button"
                                onClick={() => setSubmissionActiveTab('review')}
                                className={`px-2 py-1 rounded transition-all cursor-pointer ${
                                  submissionActiveTab === 'review' ? 'bg-white text-indigo-750 shadow-3xs font-black' : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                Review ({submissions.filter(s => s.taskId === latestActiveTask.id).length})
                              </button>
                            </div>
                          )}
                        </div>

                        {/* SUBMIT TAB FOR STUDENTS */}
                        {submissionActiveTab === 'submit' && (() => {
                          const mySub = submissions.find(s => s.taskId === latestActiveTask.id && s.classmateId === activeProfileId);
                          
                          return (
                            <div className="space-y-3">
                              {/* If graded / submitted state card */}
                              {mySub ? (
                                <div className="space-y-3 bg-white p-3 rounded-xl border border-indigo-50 shadow-3xs">
                                  <div className="flex items-center justify-between border-b pb-2">
                                    <span className="text-[9.5px] font-bold uppercase tracking-wider font-mono flex items-center gap-1">
                                      {mySub.status === 'graded' ? (
                                        <>
                                          <span className="text-emerald-600">✓ Graded</span>
                                          <span className="text-slate-400 font-normal">by {mySub.gradedBy || 'Teacher'}</span>
                                        </>
                                      ) : (
                                        <span className="text-amber-600">⏳ Submitted (Pending Review)</span>
                                      )}
                                    </span>
                                    
                                    {mySub.score !== undefined && (
                                      <span className="text-xs font-black text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded font-mono">
                                        Score: {mySub.score} / {latestActiveTask.maxScore || 100}
                                      </span>
                                    )}
                                  </div>

                                  {/* Submitted work */}
                                  {mySub.submissionType === 'subjective' && (
                                    <div className="space-y-1">
                                      <span className="text-[8.5px] font-bold text-slate-400 block font-mono">My Submitted Answer:</span>
                                      <div className="text-[11px] text-slate-700 bg-slate-50 p-2.5 rounded-lg whitespace-pre-wrap leading-relaxed border">
                                        {mySub.subjectiveAnswer}
                                      </div>
                                    </div>
                                  )}

                                  {mySub.submissionType === 'objective' && (
                                    <div className="space-y-1.5">
                                      <span className="text-[8.5px] font-bold text-slate-400 block font-mono">My MCQ Submission Answers:</span>
                                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                                        {(latestActiveTask.objectiveQuestions || []).map((q, idx) => {
                                          const chosen = mySub.objectiveAnswers?.[q.id] || 'N/A';
                                          const isCorrect = chosen === q.correctAnswer;
                                          return (
                                            <div key={q.id} className={`p-2 rounded-lg border flex items-center justify-between ${
                                              isCorrect ? 'bg-emerald-50/50 border-emerald-150 text-emerald-800' : 'bg-rose-50/50 border-rose-150 text-rose-800'
                                            }`}>
                                              <span className="font-semibold truncate">Q{idx + 1}: Chosen {chosen}</span>
                                              <span className="font-bold text-[9px]">{isCorrect ? '✓ Correct' : `✗ Correct: ${q.correctAnswer}`}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Teacher feedback if graded */}
                                  {mySub.status === 'graded' && mySub.feedback && (
                                    <div className="mt-2 p-2 bg-amber-50 border border-amber-100 rounded-lg text-left text-[11px] text-amber-900">
                                      <div className="font-extrabold flex items-center gap-1 font-mono uppercase text-[8.5px]">💬 Instructor Feedback:</div>
                                      <p className="mt-1 leading-relaxed italic">{mySub.feedback}</p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                // No submission yet -> RENDER SUBMISSION FORM
                                <div className="space-y-3">
                                  {latestActiveTask.submissionType === 'subjective' && (
                                    <div className="space-y-2 text-left">
                                      <div className="bg-slate-100/60 p-3 rounded-xl border border-slate-200">
                                        <span className="text-[8.5px] font-black uppercase tracking-wider font-mono text-slate-450 block">Question Prompt / Guidelines</span>
                                        <p className="text-[11.5px] text-slate-800 font-bold mt-1 leading-relaxed whitespace-pre-wrap">
                                          {latestActiveTask.subjectivePrompt || "Write your essay response or proof based on guidelines."}
                                        </p>
                                      </div>

                                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block font-mono">Write Your Answer Here</span>
                                      <textarea
                                        placeholder="Type your homework answer or write essay proof..."
                                        value={submissionSubjectiveAnswer}
                                        onChange={(e) => setSubmissionSubjectiveAnswer(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none h-24 focus:border-indigo-400 focus:bg-white resize-none"
                                      />
                                      
                                      <button
                                        type="button"
                                        disabled={!submissionSubjectiveAnswer.trim()}
                                        onClick={() => handleSubmitAsynchronousTask(latestActiveTask)}
                                        className="w-full bg-indigo-650 hover:bg-indigo-750 text-white font-extrabold py-2 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        Submit Written Assignment
                                      </button>
                                    </div>
                                  )}

                                  {latestActiveTask.submissionType === 'objective' && (
                                    <div className="space-y-3 text-left">
                                      <div className="bg-amber-50 border border-amber-100 p-2.5 rounded-xl text-[10.5px] text-amber-900 font-semibold leading-relaxed">
                                        💡 Complete the quiz below. Answers are checked and graded automatically upon submission.
                                      </div>

                                      <div className="space-y-3 max-h-72 overflow-y-auto pr-0.5">
                                        {(latestActiveTask.objectiveQuestions || []).map((q, idx) => (
                                          <div key={q.id} className="bg-white p-3 border border-slate-200 rounded-xl space-y-2 shadow-3xs">
                                            <div className="text-[11px] font-black text-slate-900 leading-snug">
                                              Question {idx + 1}: {q.question || "Undefined Question text"}
                                            </div>
                                            <div className="grid grid-cols-1 gap-1.5 pt-1">
                                              {['A', 'B', 'C', 'D'].map((letter, optIdx) => {
                                                const optText = q.options[optIdx];
                                                if (!optText) return null;
                                                const isSelected = submissionObjectiveAnswers[q.id] === letter;
                                                
                                                return (
                                                  <button
                                                    key={letter}
                                                    type="button"
                                                    onClick={() => {
                                                      setSubmissionObjectiveAnswers(prev => ({
                                                        ...prev,
                                                        [q.id]: letter
                                                      }));
                                                    }}
                                                    className={`w-full text-left p-2 rounded-lg border text-[10.5px] font-bold flex items-center gap-2 transition-all cursor-pointer ${
                                                      isSelected 
                                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-black' 
                                                        : 'bg-white border-slate-150 text-slate-650 hover:bg-slate-50'
                                                    }`}
                                                  >
                                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold text-[9.5px] shrink-0 ${
                                                      isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                      {letter}
                                                    </span>
                                                    <span className="truncate">{optText}</span>
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        ))}
                                      </div>

                                      {(() => {
                                        const qCount = latestActiveTask.objectiveQuestions?.length || 0;
                                        const answeredCount = Object.keys(submissionObjectiveAnswers).length;
                                        const allAnswered = answeredCount === qCount && qCount > 0;
                                        
                                        return (
                                          <button
                                            type="button"
                                            disabled={!allAnswered}
                                            onClick={() => handleSubmitAsynchronousTask(latestActiveTask)}
                                            className="w-full bg-indigo-650 hover:bg-indigo-750 text-white font-extrabold py-2 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-40"
                                          >
                                            Submit Quiz ({answeredCount}/{qCount} Answered)
                                          </button>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* REVIEW TAB FOR TEACHERS / LEADERS */}
                        {submissionActiveTab === 'review' && (() => {
                          const subs = submissions.filter(s => s.taskId === latestActiveTask.id);
                          
                          return (
                            <div className="space-y-3.5">
                              {subs.length === 0 ? (
                                <div className="text-center py-6 text-slate-400 text-[10px] italic bg-white border border-dashed rounded-xl">
                                  No student submissions received yet for this assignment.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-455 block font-mono">Class Submissions ({subs.length})</span>
                                  
                                  <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                                    {subs.map(sub => {
                                      const isSelected = reviewClassmateId === sub.classmateId;
                                      return (
                                        <div key={sub.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3xs">
                                          {/* Student row */}
                                          <div 
                                            onClick={() => {
                                              if (reviewClassmateId === sub.classmateId) {
                                                setReviewClassmateId(null);
                                              } else {
                                                setReviewClassmateId(sub.classmateId);
                                                setGradingScore(sub.score !== undefined ? String(sub.score) : '');
                                                setGradingFeedback(sub.feedback || '');
                                              }
                                            }}
                                            className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
                                          >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                              <img src={sub.classmateAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60"} alt="student avatar" className="w-6.5 h-6.5 rounded-full object-cover border" referrerPolicy="no-referrer" />
                                              <div className="text-left font-sans min-w-0">
                                                <span className="text-[11px] font-black text-slate-800 block truncate">{sub.classmateName}</span>
                                                <span className="text-[8.5px] text-slate-400 block font-mono">{sub.submittedAt.split('T')[0]}</span>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                              {sub.status === 'graded' ? (
                                                <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-bold">
                                                  ★ {sub.score} / {latestActiveTask.maxScore || 100}
                                                </span>
                                              ) : (
                                                <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-bold">
                                                  ⏳ Grade
                                                </span>
                                              )}
                                              <span className="text-slate-350 text-xs font-bold">{isSelected ? '▲' : '▼'}</span>
                                            </div>
                                          </div>

                                          {/* Expanded Detail and grading controls */}
                                          {isSelected && (
                                            <div className="p-3 border-t border-slate-100 bg-slate-50/50 text-left space-y-3.5">
                                              {/* Answers review */}
                                              {sub.submissionType === 'subjective' && (
                                                <div className="space-y-1">
                                                  <span className="text-[8.5px] font-bold text-slate-400 block font-mono">Student Response Answer:</span>
                                                  <div className="text-[11px] text-slate-750 bg-white p-2.5 rounded-lg border border-slate-150 whitespace-pre-wrap leading-relaxed shadow-3xs">
                                                    {sub.subjectiveAnswer}
                                                  </div>
                                                </div>
                                              )}

                                              {sub.submissionType === 'objective' && (
                                                <div className="space-y-1.5">
                                                  <span className="text-[8.5px] font-bold text-slate-400 block font-mono">Quiz MCQ Answers Summary:</span>
                                                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                    {(latestActiveTask.objectiveQuestions || []).map((q, qidx) => {
                                                      const sAnswer = sub.objectiveAnswers?.[q.id] || 'N/A';
                                                      const isCorrect = sAnswer === q.correctAnswer;
                                                      return (
                                                        <div key={q.id} className={`p-2 bg-white rounded-lg border flex items-center justify-between shadow-3xs ${
                                                          isCorrect ? 'border-emerald-200 text-emerald-800' : 'border-rose-200 text-rose-800'
                                                        }`}>
                                                          <span className="font-semibold truncate">Q{qidx + 1}: Chose {sAnswer}</span>
                                                          <span className="font-bold text-[9px] shrink-0">{isCorrect ? '✓ OK' : `✗ Key: ${q.correctAnswer}`}</span>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              )}

                                              {/* Grading inputs */}
                                              <div className="bg-white p-3 border border-indigo-50/60 rounded-xl space-y-3 shadow-3xs">
                                                <span className="text-[9.5px] font-extrabold text-indigo-750 block uppercase font-mono border-b pb-1">✏️ Score Sheet & Grading Feedbacks</span>
                                                
                                                <div className="space-y-1">
                                                  <label className="text-[8.5px] font-bold text-slate-400 font-mono font-sans">Award points (0 to {latestActiveTask.maxScore || 100})</label>
                                                  <input
                                                    type="number"
                                                    min="0"
                                                    max={latestActiveTask.maxScore || 100}
                                                    placeholder={`Max ${latestActiveTask.maxScore || 100}`}
                                                    value={gradingScore}
                                                    onChange={(e) => setGradingScore(e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 outline-none focus:bg-white font-bold font-sans"
                                                  />
                                                </div>

                                                <div className="space-y-1">
                                                  <label className="text-[8.5px] font-bold text-slate-400 font-mono font-sans">Instructor Feedback / Guidelines Notes</label>
                                                  <textarea
                                                    placeholder="Type grading comments or feedback..."
                                                    value={gradingFeedback}
                                                    onChange={(e) => setGradingFeedback(e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 h-14 resize-none outline-none focus:bg-white font-sans"
                                                  />
                                                </div>

                                                <button
                                                  type="button"
                                                  onClick={() => handleGradeAsynchronousTask(latestActiveTask, sub.classmateId)}
                                                  className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-black py-1.5 rounded-lg text-[10px] uppercase font-mono shadow-3xs cursor-pointer font-sans"
                                                >
                                                  Save Grade & Feedback
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                     {/* Classmate Completions Dashboard for Coordinators */}
                    {latestActiveTask.isSynced && (activeUserIsLeader || latestActiveTask.createdById === activeProfileId) && (
                      <div className="border border-emerald-100 p-4 rounded-2xl bg-emerald-50/10 text-left space-y-3">
                        <div className="flex items-center justify-between border-b border-emerald-100/50 pb-2.5">
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-800 font-mono flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-emerald-600" />
                            Classmate Completion Tracker
                          </span>
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full font-mono">
                            {(() => {
                              const totalClassmates = groupMembersList.filter(m => m.role === 'classmate').length;
                              const completedClassmates = groupMembersList.filter(m => {
                                if (m.role !== 'classmate') return false;
                                const comp = completions.find(c => c.classmateId === m.userId && c.taskId === latestActiveTask.id);
                                return comp?.completed;
                              }).length;
                              return `${completedClassmates} / ${totalClassmates} Done`;
                            })()}
                          </span>
                        </div>

                        <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                          {groupMembersList.filter(m => m.role === 'classmate').length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic py-2">No classmates enrolled in this group yet.</p>
                          ) : (
                            groupMembersList
                              .filter(m => m.role === 'classmate')
                              .map(member => {
                                const memberComp = completions.find(c => c.classmateId === member.userId && c.taskId === latestActiveTask.id);
                                const isComp = memberComp ? memberComp.completed : false;
                                const completedSubtaskIds = memberComp?.completedSubtaskIds || [];
                                
                                const totalSubs = latestActiveTask.subtasks?.length || 0;
                                const compSubs = latestActiveTask.subtasks?.filter(s => completedSubtaskIds.includes(s.id)).length || 0;
                                
                                return (
                                  <div key={member.userId} className="flex items-center justify-between bg-white p-2.5 border border-slate-150 rounded-xl hover:border-slate-300 transition-all shadow-3xs gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <img src={member.avatar} alt="Student avatar" className="w-6 h-6 rounded-full object-cover border shrink-0" referrerPolicy="no-referrer" />
                                      <div className="min-w-0">
                                        <span className="text-[10.5px] font-black text-slate-850 truncate block">{member.name}</span>
                                        {totalSubs > 0 && (
                                          <span className="text-[8.5px] text-slate-400 block font-mono">
                                            Milestones: {compSubs} / {totalSubs}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="shrink-0 flex items-center gap-1.5">
                                      {isComp ? (
                                        <span className="bg-emerald-50 border border-emerald-150 text-emerald-700 px-2.5 py-0.5 rounded-lg text-[9px] font-bold flex items-center gap-1">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                          Completed
                                        </span>
                                      ) : compSubs > 0 ? (
                                        <span className="bg-amber-50 border border-amber-150 text-amber-700 px-2.5 py-0.5 rounded-lg text-[9px] font-bold">
                                          In Progress
                                        </span>
                                      ) : (
                                        <span className="bg-slate-50 border border-slate-150 text-slate-400 px-2.5 py-0.5 rounded-lg text-[9px] font-medium">
                                          Not Started
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                          )}
                        </div>
                      </div>
                    )}

                    {/* Comments / Discussions feed */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] uppercase tracking-wider font-extrabold text-slate-450 font-sans flex items-center gap-1.5 border-b pb-2 text-left font-mono">
                        <MessageSquare className="w-4 h-4 text-slate-400" />
                        Discussion Feed ({comments.filter(c => c.taskId === latestActiveTask.id).length})
                      </h4>

                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        {comments.filter(c => c.taskId === latestActiveTask.id).length === 0 ? (
                          <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <MessageSquare className="w-6 h-6 text-slate-350 mx-auto" />
                            <p className="italic text-[10.5px] text-slate-455 mt-1">No group discussion started yet. Be the first to share thoughts!</p>
                          </div>
                        ) : (
                          comments
                            .filter(c => c.taskId === latestActiveTask.id)
                            .map(comm => {
                              const isSelf = comm.userId === activeProfileId;
                              const commProfile = profiles.find(p => p.id === comm.userId);
                              return (
                                <div key={comm.id} className={`flex items-start gap-2.5 text-left p-3.5 rounded-2xl border ${
                                  isSelf ? 'bg-indigo-50/40 border-indigo-100' : 'bg-slate-50 border-slate-150'
                                }`}>
                                  <img src={comm.userAvatar} alt="Commentator avatar logo" className="w-7 h-7 rounded-full object-cover border shrink-0 mt-0.5" referrerPolicy="no-referrer" />
                                  <div className="space-y-1 min-w-0 flex-1">
                                    <div className="flex items-baseline justify-between gap-2">
                                      <span className="text-[10.5px] font-black text-slate-955 leading-tight block truncate flex items-center gap-1">
                                        <span>{comm.userName}</span>
                                        {commProfile?.equippedBadge && <BadgeIcon emoji={commProfile.equippedBadge} className="w-3.5 h-3.5 shrink-0" />}
                                      </span>
                                      <span className="text-[8px] font-mono text-slate-400 leading-none shrink-0">{comm.createdAt}</span>
                                    </div>
                                    <p className="text-[11.5px] text-slate-700 leading-relaxed font-sans mt-0.5 whitespace-pre-wrap">
                                      {comm.content}
                                    </p>
                                    {comm.imageAttachment && (
                                      <div className="mt-2.5 rounded-xl overflow-hidden border border-slate-150 max-h-[160px] max-w-[220px] bg-white">
                                        <img 
                                          referrerPolicy="no-referrer"
                                          src={comm.imageAttachment} 
                                          alt="Uploaded attachment diagram" 
                                          className="w-full h-full object-cover shrink-0 cursor-zoom-in"
                                          onClick={() => setLightboxImage({ url: comm.imageAttachment!, title: `Shared by ${comm.userName}` })} 
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Input Footer Composer Panel */}
                  <div className="bg-slate-50 border-t border-slate-155 p-3.5 space-y-2.5 shrink-0 select-none">
                    {/* Image Attachment Preview */}
                    {newCommentImage && (
                      <div className="flex items-center gap-3 bg-white border border-slate-200 p-2 rounded-xl max-w-sm relative">
                        <img src={newCommentImage} alt="Attachment thumbnail preview" className="w-10 h-10 rounded-lg object-cover border" />
                        <div className="text-left font-sans">
                          <span className="text-[10px] font-black text-indigo-950 block">Picture Ready to Send</span>
                          <span className="text-[8.5px] text-slate-455 block font-sans">Embedded inside group discussion feedback</span>
                        </div>
                        <button 
                          onClick={() => setNewCommentImage(null)}
                          className="absolute top-1 right-1 p-0.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-650 cursor-pointer"
                          title="Remove Image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Input form */}
                    <div className="flex items-center gap-2">
                      {/* Select attachment image from device */}
                      <label className="p-2.5 bg-white border border-slate-205 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl cursor-pointer transition-colors relative shrink-0 shadow-3xs" title="Send Picture">
                        <Image className="w-4 h-4 text-indigo-650" />
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const base64Data = await compressImage(file);
                              setNewCommentImage(base64Data);
                            } catch (err: any) {
                              console.error("Comment image upload compression failed:", err);
                            }
                          }}
                          className="hidden" 
                        />
                      </label>

                      <input 
                        type="text"
                        placeholder="Type discussion comment..."
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handlePostComment(latestActiveTask.id);
                          }
                        }}
                        className="flex-1 bg-white border border-slate-205 focus:border-indigo-400 rounded-xl px-3.5 py-2.5 text-xs text-slate-850 outline-none shadow-3xs"
                      />

                      <button
                        onClick={() => handlePostComment(latestActiveTask.id)}
                        disabled={!newCommentText.trim() && !newCommentImage}
                        className="bg-indigo-650 hover:bg-indigo-700 text-white p-2.5 rounded-xl transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                </motion.div>
              </>
            )}
        </AnimatePresence>

        {/* --- EDIT TASK MODAL --- */}
        <AnimatePresence>
          {editingTask && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingTask(null)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              >
                {/* Header */}
                <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-indigo-400" />
                    <div className="text-left font-sans">
                      <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-mono">TASK MODIFIER</span>
                      <h3 className="font-sans font-black text-sm text-white tracking-tight leading-none mt-0.5">
                        Edit Assignment
                      </h3>
                    </div>
                  </div>
                  <button 
                    onClick={() => setEditingTask(null)}
                    className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 text-left font-sans">
                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-450 font-extrabold uppercase tracking-wider block">Assignment Title</label>
                    <input
                      type="text"
                      value={editingTask.title}
                      onChange={(e) => setEditingTask(prev => prev ? { ...prev, title: e.target.value } : null)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl px-3 py-2 text-xs text-slate-900 outline-none font-bold"
                    />
                  </div>

                  {/* Subject Category */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-450 font-extrabold uppercase tracking-wider block">Subject / Category</label>
                    <input
                      type="text"
                      value={editingTask.category}
                      onChange={(e) => setEditingTask(prev => prev ? { ...prev, category: e.target.value } : null)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl px-3 py-2 text-xs text-slate-900 outline-none font-semibold"
                    />
                  </div>

                  {/* Guidelines Description */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-450 font-extrabold uppercase tracking-wider block">Guidelines</label>
                    <textarea
                      value={editingTask.description || ''}
                      onChange={(e) => setEditingTask(prev => prev ? { ...prev, description: e.target.value } : null)}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl px-3 py-2 text-xs text-slate-900 outline-none h-20 resize-none"
                    />
                  </div>

                  {/* Due Date */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-450 font-extrabold uppercase tracking-wider block">Calendar Due Date</label>
                    <input
                      type="date"
                      value={editingTask.dueDate}
                      onChange={(e) => setEditingTask(prev => prev ? { ...prev, dueDate: e.target.value } : null)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-705 font-bold"
                    />
                  </div>

                  {/* Urgency */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-450 font-extrabold uppercase tracking-wider block">Urgency Priority</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'high', label: '🔴 High' },
                        { value: 'medium', label: '🟡 Med' },
                        { value: 'low', label: '🟢 Low' }
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setEditingTask(prev => prev ? { ...prev, priority: opt.value as any } : null)}
                          className={`py-2 text-[10.5px] border cursor-pointer font-bold rounded-xl transition-all ${
                            editingTask.priority === opt.value 
                              ? 'bg-slate-900 border-slate-950 text-white font-extrabold scale-102' 
                              : 'bg-white border-slate-200 text-slate-655 hover:bg-slate-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions footer */}
                <div className="bg-slate-50 border-t border-slate-150 p-4 flex gap-3 select-none">
                  <button
                    type="button"
                    onClick={() => setEditingTask(null)}
                    className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!editingTask.title.trim()) return;
                      await handleUpdateTask(editingTask);
                      setEditingTask(null);
                    }}
                    className="flex-1 py-2.5 bg-indigo-650 hover:bg-slate-950 text-white font-black rounded-xl text-xs shadow-md transition-all cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- DYNAMIC WORKSPACE ONBOARDING SELECTION MODAL --- */}
        <AnimatePresence>
          {activeProfile && activeProfile.onboardingCompleted === false && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-95 flex items-center justify-center p-4 font-sans overflow-y-auto"
            >
              <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-4xl shadow-2xl text-left text-slate-900 border border-slate-200 flex flex-col max-h-[95vh] my-auto">
                <div className="text-center space-y-2 pb-4 border-b shrink-0">
                  <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-3xl flex items-center justify-center mx-auto shadow-sm animate-bounce">
                    <Flame className="w-8 h-8 text-indigo-600" />
                  </div>
                  <h3 className="font-sans font-black text-2xl text-slate-950 tracking-tight">Setup Your Workspace Role</h3>
                  <p className="text-slate-500 text-xs max-w-xl mx-auto">
                    Welcome to TaskTrack, <span className="font-bold text-indigo-650">{activeProfile.name}</span>! Select the workspace context that fits your day-to-day workflow. This configures your layout, checklists, permissions, and study groups.
                  </p>
                </div>

                {/* Grid of workspace choices */}
                <div className="flex-1 overflow-y-auto py-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-h-[250px]">
                  {[
                    {
                      role: 'Student',
                      Icon: User,
                      title: 'Student Workspace',
                      description: 'Track assignments, store notes, connect with peer study groups, and complete synchronized task boards.'
                    },
                    {
                      role: 'Teacher',
                      Icon: GraduationCap,
                      title: 'Teacher / Instructor',
                      description: 'Create task lists, moderate student groups, view completions, and push group announcements.'
                    },
                    {
                      role: 'Class',
                      Icon: Users,
                      title: 'Class / Cohort',
                      description: 'Collaborative board for cohort members to share reference files, align on schedules, and sync milestones.'
                    },
                    {
                      role: 'School Department',
                      Icon: Layers,
                      title: 'School Department',
                      description: 'Coordinate departmental programs, dispatch syllabus notes, and delegate administrative tasks.'
                    },
                    {
                      role: 'Administrative Office',
                      Icon: Shield,
                      title: 'Administrative Office',
                      description: 'Track executive guidelines, post board announcements, and monitor institution timelines.'
                    },
                    {
                      role: 'School',
                      Icon: University,
                      title: 'School / Institution',
                      description: 'Broadcast all-campus announcements, handle institutional milestones, and coordinate cross-departmental tasks.'
                    }
                  ].map((opt) => {
                    const isSelected = selectedOnboardingRole === opt.role;
                    const IconComp = opt.Icon;
                    return (
                      <button
                        key={opt.role}
                        onClick={() => setSelectedOnboardingRole(opt.role)}
                        className={`p-5 rounded-2xl border text-left transition-all duration-200 hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between h-full group ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-650/15'
                            : 'border-slate-200 hover:border-slate-350 hover:bg-slate-50 hover:shadow-2xs'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-transform group-hover:scale-110 ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'
                          }`}>
                            <IconComp className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-900">{opt.title}</h4>
                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                              {opt.description}
                            </p>
                          </div>
                        </div>
                        
                        <div className="mt-4 pt-3 border-t border-dashed border-slate-200/60 w-full flex justify-between items-center text-[10px]">
                          <span className={`font-mono font-bold uppercase tracking-wider ${isSelected ? 'text-indigo-650' : 'text-slate-405'}`}>
                            {isSelected ? 'Selected' : 'Click to select'}
                          </span>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-indigo-650 bg-indigo-650 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Footer submit button */}
                <div className="border-t pt-4 flex flex-col sm:flex-row sm:justify-between items-center gap-3 shrink-0">
                  <div className="text-center sm:text-left">
                    <p className="text-[10px] text-slate-400 font-mono">
                      Current Selection: <span className="font-extrabold text-slate-700">{selectedOnboardingRole} Mode</span>
                    </p>
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      You can change this anytime from your account settings.
                    </p>
                  </div>
                  <button
                    onClick={handleSaveOnboarding}
                    disabled={savingOnboarding}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-6 py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-98 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {savingOnboarding ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Initializing Workspace...</span>
                      </>
                    ) : (
                      <>
                        <span>Launch {selectedOnboardingRole} Workspace</span>
                        <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- GLOBAL MEDIA LIGHTBOX MODAL --- */}
        <AnimatePresence>
          {lightboxImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLightboxImage(null)}
              className="fixed inset-0 bg-black/90 backdrop-blur-md z-99 flex flex-col items-center justify-center p-4 select-none"
            >
              {/* Close button top right */}
              <button 
                onClick={() => setLightboxImage(null)}
                className="absolute top-5 right-5 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
                title="Close preview"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="max-w-4xl max-h-[80vh] flex flex-col items-center justify-center relative">
                <img 
                  src={lightboxImage.url} 
                  alt={lightboxImage.title} 
                  className="max-w-full max-h-[72vh] object-contain rounded-xl shadow-2xl border border-white/10"
                  referrerPolicy="no-referrer"
                  onClick={(e) => e.stopPropagation()} 
                />
                {lightboxImage.title && (
                  <p className="text-white text-xs font-bold mt-4 font-sans bg-black/55 px-4 py-2 rounded-full border border-white/10">
                    {lightboxImage.title}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- GLOBAL CONGRATULATIONS OVERLAY --- */}
        <AnimatePresence>
          {showGlobalCongratulation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[999] flex flex-col items-center justify-center p-4 select-none overflow-hidden"
              onClick={() => setShowGlobalCongratulation(false)}
            >
              {/* Falling celebration elements */}
              <FallingConfetti />

              {/* Glassmorphic Celebratory Card */}
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 15 }}
                className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-md w-full text-center relative z-10 shadow-2xl space-y-6"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Radiant Sparkle/Trophy animation */}
                <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                  <motion.div 
                    className="absolute inset-0 bg-amber-400/20 rounded-full blur-xl"
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <div className="w-20 h-20 bg-gradient-to-tr from-amber-400 to-yellow-300 rounded-2xl flex items-center justify-center shadow-lg border border-amber-300/30">
                    <Trophy className="w-10 h-10 text-amber-950 animate-bounce" />
                  </div>
                  {/* Surrounding little sparkles */}
                  <motion.div 
                    className="absolute -top-1 -right-1 text-yellow-300 text-lg"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  >
                    ✨
                  </motion.div>
                  <motion.div 
                    className="absolute -bottom-1 -left-1 text-yellow-300 text-lg"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  >
                    ✨
                  </motion.div>
                </div>

                <div className="space-y-2">
                  <h2 className="font-sans font-black text-white text-2xl tracking-tight leading-none">
                    ALL WORKLOADS CLEAR!
                  </h2>
                  <p className="text-emerald-300 font-mono font-bold text-xs uppercase tracking-widest">
                    Milestone Completed Successfully
                  </p>
                </div>

                <p className="text-slate-200 text-xs sm:text-sm font-sans leading-relaxed">
                  "You completed all the task, good job!" You have successfully aligned all assignments, group checklists, and personal milestones. Excellent teamwork and persistence!
                </p>

                <div className="pt-2">
                  <button
                    onClick={() => setShowGlobalCongratulation(false)}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold px-6 py-3 rounded-xl text-xs tracking-wider uppercase transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 active:scale-95 cursor-pointer"
                  >
                    Keep Up the Great Work!
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* --- STARTER TUTORIAL GUIDE MODAL --- */}
        <StarterTutorial
          isOpen={showTutorial}
          onClose={() => {
            setShowTutorial(false);
            localStorage.setItem('tasktrack_tutorial_completed', 'true');
          }}
          activeTab={activeTab as any}
          setActiveTab={setActiveTab as any}
          activeGroupId={activeGroupId}
          activeProfileId={activeProfileId}
          setActiveGroupId={setActiveGroupId}
          groups={groups}
          onStartInteractiveTour={() => {
            setShowTutorial(false);
            localStorage.setItem('tasktrack_tutorial_completed', 'true');
            setGuideStep(0);
          }}
        />

        {/* --- INTERACTIVE ONBOARDING POINTER GUIDE --- */}
        {guideStep !== null && (
          <InteractiveGuide
            step={guideStep}
            totalSteps={7}
            onNext={() => {
              if (guideStep < 6) {
                setGuideStep(guideStep + 1);
              } else {
                setGuideStep(null);
                localStorage.setItem('tasktrack_interactive_guide_completed', 'true');
              }
            }}
            onPrev={() => {
              if (guideStep > 0) {
                setGuideStep(guideStep - 1);
              }
            }}
            onClose={() => {
              setGuideStep(null);
              localStorage.setItem('tasktrack_interactive_guide_completed', 'true');
            }}
          />
        )}

        {/* --- CLASS ANALYTICS CONSOLE OVERLAY --- */}
        {activeTab === 'admin' && canAccessClassAnalytics && (
          <AdminDashboard
            profiles={classAnalyticsData.profiles}
            groups={classAnalyticsData.groups}
            memberships={classAnalyticsData.memberships}
            announcements={announcements}
            tasks={classAnalyticsData.tasks}
            completions={classAnalyticsData.completions}
            comments={classAnalyticsData.comments}
            attendanceLogs={classAnalyticsData.attendanceLogs}
            onClose={() => setActiveTab('tasks')}
            activeProfileId={activeProfileId}
            userEmail={auth.currentUser?.email}
            googleToken={googleToken}
            onGoogleSignIn={handleGoogleSignIn}
            consoleTitle="Class Analytics"
          />
        )}

        {/* --- SUPER ADMIN CONSOLE OVERLAY --- */}
        {activeTab === 'super_admin' && isSuperAdmin && (
          <AdminDashboard
            profiles={profiles}
            groups={groups}
            memberships={memberships}
            announcements={announcements}
            tasks={tasks}
            completions={completions}
            comments={comments}
            attendanceLogs={attendanceLogs}
            onClose={() => setActiveTab('tasks')}
            activeProfileId={activeProfileId}
            userEmail={auth.currentUser?.email}
            googleToken={googleToken}
            onGoogleSignIn={handleGoogleSignIn}
            consoleTitle="Super Admin Console"
          />
        )}

        {/* 🔔 FLOATING REAL-TIME NOTIFICATION TOASTS */}
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none px-4 sm:px-0">
          <AnimatePresence>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
                className="w-full bg-slate-900/95 border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex gap-3 pointer-events-auto select-none text-left"
              >
                {/* Toast Icon */}
                <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 border border-slate-750">
                  {toast.type === 'task' ? (
                    <CheckSquare className="w-5 h-5 text-indigo-400" />
                  ) : toast.type === 'announcement' ? (
                    <Megaphone className="w-5 h-5 text-amber-400" />
                  ) : toast.type === 'comment' ? (
                    <MessageSquare className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Info className="w-5 h-5 text-sky-400" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 text-left font-sans">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-black text-slate-400 tracking-wider uppercase">
                      {toast.type === 'task' ? 'New Task Published' : toast.type === 'announcement' ? 'New Announcement' : toast.type === 'comment' ? 'New Comment Added' : 'System Alert'}
                    </span>
                    <button
                      onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                      className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h4 className="text-xs font-black text-white mt-1 leading-snug">{toast.title}</h4>
                  <p className="text-[10.5px] text-slate-300 mt-1 line-clamp-2 leading-relaxed">{toast.body}</p>
                  {toast.groupName && (
                    <div className="mt-2 flex items-center gap-1">
                      <span className="text-[8.5px] font-bold bg-slate-800 border border-slate-700/60 px-1.5 py-0.5 rounded-md text-indigo-300">
                        🏫 {toast.groupName}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}

function InteractiveGuide({ 
  step, 
  onNext, 
  onPrev, 
  onClose,
  totalSteps = 7
}: { 
  step: number; 
  onNext: () => void; 
  onPrev: () => void; 
  onClose: () => void;
  totalSteps?: number;
}) {
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const stepsData = [
    {
      title: 'Select Active Class',
      desc: 'Tap here to switch classroom cohorts! Enroll with class codes to sync schedules, announcements, workloads, and chat.',
      fallbackDesc: 'Tap here to switch classroom cohorts! Enroll with class codes to sync schedules, announcements, workloads, and chat.',
      icon: <University className="w-4 h-4 text-indigo-400" />,
      targetIdDesktop: 'switcher-group-trigger',
      targetIdMobile: 'switcher-group-trigger',
      placement: 'bottom' as const,
    },
    {
      title: 'Workloads & Checklists',
      desc: 'Access study planners. Track assignments, exams, or subtasks. Checking them off updates your class progress bar.',
      fallbackDesc: 'Unlock your workloads panel once enrolled in a class! Here you will track assignments, study materials, and custom student checklists.',
      icon: <CheckSquare className="w-4 h-4 text-emerald-400" />,
      targetIdDesktop: 'switcher-feed-trigger-desktop',
      targetIdMobile: 'switcher-feed-trigger',
      placement: 'right' as const,
    },
    {
      title: 'Assemble & Publish',
      desc: 'Create and publish tasks, assignments, announcements, and links to your classmates in real time.',
      fallbackDesc: 'Publish tasks, assignments, homework, and classroom notices! Once in a class, you can compose and sync records instantly.',
      icon: <Plus className="w-4 h-4 text-amber-400" />,
      targetIdDesktop: 'switcher-create-trigger-desktop',
      targetIdMobile: 'switcher-create-trigger',
      placement: 'right' as const,
    },
    {
      title: 'Class Hub & Announcements',
      desc: 'Access cohort-wide announcements, inspect registered student members, copy your class invite code, and chat in real-time.',
      fallbackDesc: 'Interact with other classmates! Once enrolled, the Class Hub hosts shared noticeboards, member rosters, and active cohort group chat.',
      icon: <Users className="w-4 h-4 text-sky-400" />,
      targetIdDesktop: 'switcher-classroom-trigger-desktop',
      targetIdMobile: 'switcher-classroom-trigger',
      placement: 'right' as const,
    },
    {
      title: 'Focus Pomodoro Sprints',
      desc: 'Boot up solo or multiplayer study timers! Pick focus durations, play relaxing ambient sounds, and level up your study XP.',
      fallbackDesc: 'Concentrate on your studies! Focus Sprints provide custom Pomodoro timers with rich sound choices and XP multipliers.',
      icon: <Flame className="w-4 h-4 text-rose-400" />,
      targetIdDesktop: 'switcher-focus-trigger-desktop',
      targetIdMobile: 'switcher-focus-trigger',
      placement: 'right' as const,
    },
    {
      title: 'Theme & Accent Colors',
      desc: 'Customize your layout! Access the palette to customize accent colors, toggle dark/contrast card modes, and pick background themes.',
      fallbackDesc: 'Customize your layout! Access the palette to customize accent colors, toggle dark/contrast card modes, and pick background themes.',
      icon: <Palette className="w-4 h-4 text-purple-400" />,
      targetIdDesktop: 'switcher-theme-trigger',
      targetIdMobile: 'switcher-theme-trigger',
      placement: 'bottom' as const,
    },
    {
      title: 'Student Identity & XP Profile',
      desc: 'Check your student persona card. View your current active level, review accumulated study streak days, or securely sign out.',
      fallbackDesc: 'Check your student persona card. View your current active level, review accumulated study streak days, or securely sign out.',
      icon: <User className="w-4 h-4 text-pink-400" />,
      targetIdDesktop: 'switcher-identity-trigger',
      targetIdMobile: 'switcher-identity-trigger',
      placement: 'bottom' as const,
    }
  ];

  const currentStepData = stepsData[step] || stepsData[0];

  useEffect(() => {
    const updatePosition = () => {
      const isDesktop = window.innerWidth >= 1024;
      const targetId = isDesktop ? currentStepData.targetIdDesktop : currentStepData.targetIdMobile;
      const el = document.getElementById(targetId);
      
      if (el) {
        const rect = el.getBoundingClientRect();
        // Skip updating if coordinates are unchanged
        setCoords(prev => {
          if (prev && prev.top === rect.top && prev.left === rect.left && prev.width === rect.width && prev.height === rect.height) {
            return prev;
          }
          return {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
          };
        });
      } else {
        setCoords(null);
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    const interval = setInterval(updatePosition, 300);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      clearInterval(interval);
    };
  }, [step, currentStepData]);

  const isDesktop = window.innerWidth >= 1024;
  const tooltipWidth = 320;
  const tooltipHeight = 175;
  const gap = 14;

  let placement = currentStepData.placement;
  if (!isDesktop && (placement === 'right' || placement === 'left')) {
    placement = 'top';
  }

  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 1000,
  };
  const arrowStyle: React.CSSProperties = {};

  if (coords) {
    if (placement === 'bottom') {
      tooltipStyle.top = coords.top + coords.height + gap;
      tooltipStyle.left = Math.max(12, Math.min(window.innerWidth - tooltipWidth - 12, coords.left + coords.width / 2 - tooltipWidth / 2));
      arrowStyle.top = -5;
      arrowStyle.left = Math.max(12, Math.min(tooltipWidth - 24, coords.left + coords.width / 2 - (tooltipStyle.left as number) - 5));
    } else if (placement === 'top') {
      tooltipStyle.top = Math.max(12, coords.top - tooltipHeight - gap);
      tooltipStyle.left = Math.max(12, Math.min(window.innerWidth - tooltipWidth - 12, coords.left + coords.width / 2 - tooltipWidth / 2));
      arrowStyle.bottom = -5;
      arrowStyle.left = Math.max(12, Math.min(tooltipWidth - 24, coords.left + coords.width / 2 - (tooltipStyle.left as number) - 5));
    } else if (placement === 'right') {
      tooltipStyle.top = Math.max(12, Math.min(window.innerHeight - tooltipHeight - 12, coords.top + coords.height / 2 - tooltipHeight / 2));
      tooltipStyle.left = coords.left + coords.width + gap;
      arrowStyle.left = -5;
      arrowStyle.top = Math.max(12, Math.min(tooltipHeight - 24, coords.top + coords.height / 2 - (tooltipStyle.top as number) - 5));
    } else if (placement === 'left') {
      tooltipStyle.top = Math.max(12, Math.min(window.innerHeight - tooltipHeight - 12, coords.top + coords.height / 2 - tooltipHeight / 2));
      tooltipStyle.left = coords.left - tooltipWidth - gap;
      arrowStyle.right = -5;
      arrowStyle.top = Math.max(12, Math.min(tooltipHeight - 24, coords.top + coords.height / 2 - (tooltipStyle.top as number) - 5));
    }
  } else {
    // Elegant viewport center screen fallback
    tooltipStyle.top = '50%';
    tooltipStyle.left = '50%';
    tooltipStyle.transform = 'translate(-50%, -50%)';
  }

  let arrowClassName = "absolute w-2.5 h-2.5 bg-slate-900 pointer-events-none transform rotate-45";
  if (placement === 'bottom') {
    arrowClassName += " border-l border-t border-slate-800/90";
  } else if (placement === 'top') {
    arrowClassName += " border-r border-b border-slate-800/90";
  } else if (placement === 'right') {
    arrowClassName += " border-l border-b border-slate-800/90";
  } else if (placement === 'left') {
    arrowClassName += " border-r border-t border-slate-800/90";
  }

  return (
    <div className="fixed inset-0 z-[999] pointer-events-none font-sans select-none">
      {/* Dark semi-transparent background overlay */}
      <div 
        className="fixed inset-0 bg-slate-950/45 pointer-events-auto cursor-pointer"
        onClick={onClose}
      />

      {/* Pulsing Highlight Target Frame */}
      {coords && (
        <div 
          className="fixed border-2 border-indigo-500 rounded-2xl shadow-[0_0_0_9999px_rgba(2,6,23,0.45)] transition-all duration-300 pointer-events-none"
          style={{
            top: coords.top - 6,
            left: coords.left - 6,
            width: coords.width + 12,
            height: coords.height + 12
          }}
        >
          {/* Inner pulse ring */}
          <div className="absolute -inset-1 border border-indigo-400 rounded-2xl animate-pulse opacity-70" />
        </div>
      )}

      {/* Guide Tooltip Card */}
      <div 
        className="fixed bg-slate-900 border border-slate-800/90 p-4.5 rounded-2xl w-[320px] text-white shadow-2xl pointer-events-auto transition-all duration-300 select-text"
        style={tooltipStyle}
      >
        {coords && (
          <div 
            className={arrowClassName}
            style={arrowStyle}
          />
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-850 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-indigo-400 font-extrabold uppercase tracking-widest">
                Guide &bull; Step {step + 1} of {totalSteps}
              </span>
              {!coords && (
                <span className="text-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider uppercase">
                  View Only
                </span>
              )}
            </div>
            
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5 hover:bg-slate-800 rounded"
              title="Close Guide"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="text-left space-y-1.5">
            <h4 className="font-black text-xs text-white flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-slate-800 border border-slate-700/60 shadow-3xs shrink-0">
                {currentStepData.icon}
              </span> 
              <span>{currentStepData.title}</span>
            </h4>
            <p className="text-[10.5px] text-slate-300 leading-relaxed font-medium">
              {coords ? currentStepData.desc : currentStepData.fallbackDesc}
            </p>
          </div>

          {/* SaaS Dots and Navigation Controls */}
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-850">
            {/* Dots bar */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <div 
                  key={idx}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    idx === step 
                      ? 'w-3.5 bg-indigo-500' 
                      : idx < step 
                        ? 'w-1.5 bg-emerald-500' 
                        : 'w-1 bg-slate-800'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onPrev}
                disabled={step === 0}
                className={`text-[9.5px] font-black tracking-wider uppercase transition-all px-2.5 py-1.5 rounded-lg ${
                  step === 0 
                    ? 'text-slate-600 cursor-not-allowed opacity-40' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-850'
                }`}
              >
                Back
              </button>

              <button
                onClick={onNext}
                className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black text-[9.5px] tracking-wider uppercase px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all shadow-md active:scale-98"
              >
                <span>{step === totalSteps - 1 ? 'Finish' : 'Next'}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
