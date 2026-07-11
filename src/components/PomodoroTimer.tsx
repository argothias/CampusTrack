/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Flame, Coffee, Trophy, Volume2, VolumeX } from 'lucide-react';

interface PomodoroTimerProps {
  onTimerComplete?: () => void;
}

export default function PomodoroTimer({ onTimerComplete }: PomodoroTimerProps) {
  const [mode, setMode] = useState<'study' | 'shortBreak' | 'longBreak'>('study');
  const [customDuration, setCustomDuration] = useState(25 * 60);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [adjustUnit, setAdjustUnit] = useState<'hours' | 'minutes'>('minutes');

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const dragStartY = useRef<number>(0);
  const dragStartDuration = useRef<number>(0);
  const lastTickValue = useRef<number>(0);

  // Audio synthesis helper
  const playChime = useCallback((type: 'complete' | 'click' | 'start') => {
    if (isMuted) return;

    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'complete') {
        // High double chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
        
        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
          gain2.gain.setValueAtTime(0.3, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.4);
        }, 150);
      } else if (type === 'start') {
        // Uplifting chime
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(329.63, ctx.currentTime); // E4
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.2); // A4
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        // Tiny tick
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        osc.start();
        osc.stop(ctx.currentTime + 0.06);
      }
    } catch {
      console.warn("Web Audio API not supported or interaction blocked on this browser context.");
    }
  }, [isMuted]);

  useEffect(() => {
    // Reset times when mode switches
    let duration = 25 * 60;
    if (mode === 'study') {
      duration = 25 * 60;
    } else if (mode === 'shortBreak') {
      duration = 5 * 60;
    } else {
      duration = 15 * 60;
    }
    setCustomDuration(duration);
    setTimeLeft(duration);
    setIsRunning(false);
  }, [mode]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            playChime('complete');
            if (intervalRef.current) clearInterval(intervalRef.current);
            
            if (mode === 'study') {
              setSessionCount((sc) => sc + 1);
              if (onTimerComplete) onTimerComplete();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, mode, onTimerComplete, playChime]);

  // Handle start of swipe/drag
  const handleStart = (clientY: number) => {
    if (isRunning) return; // Cannot drag to adjust while timer is actively running
    setIsDragging(true);
    dragStartY.current = clientY;
    dragStartDuration.current = customDuration;
    
    const curHrs = Math.floor(customDuration / 3600);
    const curMins = Math.floor((customDuration % 3600) / 60);
    lastTickValue.current = adjustUnit === 'hours' ? curHrs : curMins;
  };

  // Handle movement updates
  const handleMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    const deltaY = dragStartY.current - clientY; // Upward drag = positive increase
    
    const curHrs = Math.floor(dragStartDuration.current / 3600);
    const curMins = Math.floor((dragStartDuration.current % 3600) / 60);
    
    let nextDuration = customDuration;
    
    if (adjustUnit === 'hours') {
      const hourDelta = Math.round(deltaY / 25); // 25 pixels of vertical drag equals 1 hour adjustment
      let nextHours = curHrs + hourDelta;
      
      // Limits: from 0 hours to 24 hours
      if (nextHours < 0) nextHours = 0;
      if (nextHours > 24) nextHours = 24;
      
      nextDuration = (nextHours * 3600) + (curMins * 60);
      
      // Make sure it doesn't drop to 0 seconds if both are 0
      if (nextDuration < 60) nextDuration = 60;
      
      if (nextDuration !== customDuration) {
        setCustomDuration(nextDuration);
        setTimeLeft(nextDuration);
        
        if (nextHours !== lastTickValue.current) {
          playChime('click');
          lastTickValue.current = nextHours;
        }
      }
    } else {
      const minuteDelta = Math.round(deltaY / 10); // 10 pixels of vertical drag equals 1 minute adjustment
      let nextMinutes = curMins + minuteDelta;
      
      // Since hours are separate, minutes are bounded between 0 and 59
      const minLimitLower = curHrs === 0 ? 1 : 0;
      if (nextMinutes < minLimitLower) nextMinutes = minLimitLower;
      if (nextMinutes > 59) nextMinutes = 59;
      
      nextDuration = (curHrs * 3600) + (nextMinutes * 60);
      
      if (nextDuration !== customDuration) {
        setCustomDuration(nextDuration);
        setTimeLeft(nextDuration);
        
        if (nextMinutes !== lastTickValue.current) {
          playChime('click');
          lastTickValue.current = nextMinutes;
        }
      }
    }
  }, [isDragging, customDuration, adjustUnit, playChime]);

  const handleEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse Events
  const onMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientY);
  };

  // Touch Events
  const onTouchStart = (e: React.TouchEvent) => {
    // Prevent default scrolling when starting swipe on the timer container
    if (e.cancelable) {
      e.preventDefault();
    }
    if (e.touches.length > 0) {
      handleStart(e.touches[0].clientY);
    }
  };

  // Global mouse and touch listeners during drag state
  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.cancelable) {
        e.preventDefault();
      }
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientY);
      }
    };

    const onMouseUp = () => {
      handleEnd();
    };

    const onTouchEnd = () => {
      handleEnd();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, handleMove, handleEnd]);

  const toggleTimer = () => {
    if (!isRunning) {
      playChime('start');
    } else {
      playChime('click');
    }
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    playChime('click');
    setIsRunning(false);
    setTimeLeft(customDuration);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressCircleDash = () => {
    const total = customDuration;
    const elapsed = total - timeLeft;
    const progress = elapsed / total;
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    return circumference - (progress * circumference);
  };

  // Check if current customized duration matches default presets to show customized state
  const isCustomTime = () => {
    if (mode === 'study') return customDuration !== 25 * 60;
    if (mode === 'shortBreak') return customDuration !== 5 * 60;
    return customDuration !== 15 * 60;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col items-center w-full font-sans">
      {/* Timer Heading */}
      <div className="flex items-center justify-between w-full border-b border-slate-150 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-indigo-650" />
          <span className="font-sans font-bold text-slate-800 text-sm tracking-tight">Focus Work Station</span>
        </div>
        
        <button 
          onClick={() => setIsMuted(!isMuted)} 
          className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
          title={isMuted ? "Unmute Timer Chime" : "Mute Timer Chime"}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-indigo-600" />}
        </button>
      </div>

      {/* Mode Selectors */}
      <div className="flex gap-1 bg-slate-100/80 p-1 rounded-xl mb-6 w-full">
        <button
          onClick={() => { playChime('click'); setMode('study'); }}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            mode === 'study' 
              ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          {mode === 'study' && isCustomTime() ? `Study (${Math.round(customDuration / 60)}m)` : 'Study (25m)'}
        </button>
        <button
          onClick={() => { playChime('click'); setMode('shortBreak'); }}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            mode === 'shortBreak' 
              ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
          }`}
        >
          <Coffee className="w-3.5 h-3.5" />
          {mode === 'shortBreak' && isCustomTime() ? `Short (${Math.round(customDuration / 60)}m)` : 'Short (5m)'}
        </button>
        <button
          onClick={() => { playChime('click'); setMode('longBreak'); }}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
            mode === 'longBreak' 
              ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          {mode === 'longBreak' && isCustomTime() ? `Long (${Math.round(customDuration / 60)}m)` : 'Long (15m)'}
        </button>
      </div>

      {/* Circular Progress timer display with swipe / drag capabilities */}
      <div 
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        className={`relative w-44 h-44 mb-6 flex items-center justify-center select-none rounded-full transition-all duration-300 touch-none ${
          !isRunning 
            ? 'cursor-ns-resize hover:scale-[1.03] hover:shadow-md hover:bg-slate-50/50 active:scale-98 group' 
            : 'cursor-not-allowed'
        } ${isDragging ? 'bg-indigo-50/70 ring-8 ring-indigo-100/50 shadow-inner scale-[1.03]' : ''}`}
        title={!isRunning ? `Drag or Swipe Up/Down to customize ${adjustUnit}` : undefined}
      >
        <svg className="absolute w-full h-full transform -rotate-90 pointer-events-none" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="54"
            className="stroke-slate-100 fill-none"
            strokeWidth="4.5"
          />
          <circle
            cx="60"
            cy="60"
            r="54"
            strokeDasharray={2 * Math.PI * 54}
            strokeDashoffset={getProgressCircleDash()}
            strokeLinecap="round"
            className={`fill-none transition-all duration-300 ${
              mode === 'study' ? 'stroke-indigo-600' : mode === 'shortBreak' ? 'stroke-indigo-400' : 'stroke-slate-700'
            }`}
            strokeWidth="5"
          />
        </svg>
        
        <div className="absolute text-center font-sans z-10 flex flex-col items-center justify-center pointer-events-none">
          {/* Top Arrow Indicator shown when interactive */}
          {!isRunning && (
            <span className={`text-[9px] text-indigo-500 font-extrabold animate-bounce mb-1 transition-opacity duration-250 ${
              isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}>
              ▲ Adjust Up
            </span>
          )}

          {!isRunning ? (
            <div className="flex items-center gap-1 font-mono text-3xl font-black tracking-tight leading-none pointer-events-auto">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setAdjustUnit('hours');
                  playChime('click');
                }}
                className={`px-2 py-1 rounded-lg transition-all duration-200 cursor-pointer text-xs font-bold ${
                  adjustUnit === 'hours'
                    ? 'bg-indigo-600 text-white shadow-sm scale-105'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
                title="Click to adjust Hours"
              >
                {Math.floor(timeLeft / 3600).toString().padStart(2, '0')}h
              </button>
              <span className="text-slate-400 font-sans font-bold text-sm select-none animate-pulse">:</span>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setAdjustUnit('minutes');
                  playChime('click');
                }}
                className={`px-2 py-1 rounded-lg transition-all duration-200 cursor-pointer text-xs font-bold ${
                  adjustUnit === 'minutes'
                    ? 'bg-indigo-600 text-white shadow-sm scale-105'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
                title="Click to adjust Minutes"
              >
                {Math.floor((timeLeft % 3600) / 60).toString().padStart(2, '0')}m
              </button>
            </div>
          ) : (
            <div className="font-mono text-3.5xl font-black tracking-tight text-slate-900 leading-none">
              {formatTime(timeLeft)}
            </div>
          )}
          
          <span className="text-[8px] text-slate-450 uppercase tracking-widest font-extrabold block mt-2 leading-none">
            {isRunning 
              ? 'active focus' 
              : isDragging 
                ? `setting ${adjustUnit}` 
                : isCustomTime()
                  ? 'customized duration'
                  : `adjust ${adjustUnit}`}
          </span>

          {/* Bottom Arrow Indicator shown when interactive */}
          {!isRunning && (
            <span className={`text-[9px] text-indigo-500 font-extrabold animate-bounce mt-1.5 transition-opacity duration-250 ${
              isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}>
              ▼ Adjust Down
            </span>
          )}
        </div>

        {/* Subtle rotary gauge ticks decoration inside the circle */}
        {!isRunning && (
          <div className="absolute inset-4 border border-dashed border-slate-200/80 rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex gap-3.5 w-full justify-center mb-4">
        <button
          onClick={toggleTimer}
          className={`flex-1 flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer ${
            isRunning 
              ? 'bg-slate-800 hover:bg-slate-900 text-white' 
              : 'bg-indigo-600 hover:bg-slate-900 text-white'
          }`}
        >
          {isRunning ? (
            <>
              <Pause className="w-4 h-4 stroke-[2.5]" />
              Pause Sprints
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current text-white stroke-none" />
              Start Study
            </>
          )}
        </button>

        <button
          onClick={resetTimer}
          className="flex items-center justify-center border border-slate-200 hover:bg-slate-50 p-2.5 rounded-xl text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          title="Reset Pomodoro"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="text-center bg-indigo-50/50 border border-indigo-100/50 py-1.5 px-3 rounded-lg w-full">
        <span className="text-indigo-950 text-xs font-sans font-bold flex items-center justify-center gap-1">
          💡 Completed study sprints: <span className="text-indigo-600 font-extrabold font-mono text-sm">{sessionCount}</span>
        </span>
      </div>
    </div>
  );
}
