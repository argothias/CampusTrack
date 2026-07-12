import React, { useState, useMemo, useCallback } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar
} from 'lucide-react';
import { Task, StudentProfile, SyncedTaskCompletion, AttendanceLog } from '../types';
import * as XLSX from 'xlsx';

interface GoogleSheetsExportProps {
  profiles: StudentProfile[];
  attendanceLogs: AttendanceLog[];
  completions: SyncedTaskCompletion[];
  tasks: Task[];
  activeProfileId: string | null;
}

type ExportType = 'attendance' | 'completions';
type TimeFrame = 'day' | 'week' | 'month' | 'all';

export default function GoogleSheetsExport({
  profiles,
  attendanceLogs,
  completions,
  tasks,
  activeProfileId
}: GoogleSheetsExportProps) {
  const [exportType, setExportType] = useState<ExportType>('attendance');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('month');
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Generate list of dates based on timeFrame
  const dates = useMemo(() => {
    const list: string[] = [];
    const today = new Date();
    
    if (timeFrame === 'day') {
      list.push(today.toISOString().split('T')[0]);
    } else if (timeFrame === 'week') {
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        list.push(d.toISOString().split('T')[0]);
      }
    } else if (timeFrame === 'month') {
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        list.push(d.toISOString().split('T')[0]);
      }
    } else { // 'all'
      const uniqueDates = new Set<string>();
      
      attendanceLogs.forEach(log => {
        if (log.date) {
          uniqueDates.add(log.date.split('T')[0]);
        }
      });
      completions.forEach(c => {
        if (c.completedAt) {
          uniqueDates.add(c.completedAt.split('T')[0]);
        }
      });
      tasks.forEach(t => {
        if (t.completedAt) {
          uniqueDates.add(t.completedAt.split('T')[0]);
        }
      });

      if (uniqueDates.size === 0) {
        list.push(today.toISOString().split('T')[0]);
      } else {
        const sorted = Array.from(uniqueDates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        list.push(...sorted);
      }
    }
    return list;
  }, [timeFrame, attendanceLogs, completions, tasks]);

  // Generate the clean, organized Array-of-Arrays (AOA) grouped by Day horizontally
  const generateAoaData = useCallback((type: ExportType) => {
    const timeFrameLabel = 
      timeFrame === 'day' ? 'Today' : 
      timeFrame === 'week' ? 'Last 7 Days' : 
      timeFrame === 'month' ? 'Last 30 Days' : 'All-Time';
    
    const typeLabel = type === 'attendance' ? 'Attendance Logs' : 'Completed Coursework';
    
    const aoa: any[][] = [];
    aoa[0] = [`CampusTrack - ${typeLabel} Report`];
    aoa[1] = [`Timeframe: ${timeFrameLabel}`, `Generated: ${new Date().toLocaleString()}`];
    aoa[2] = []; // spacer
    
    // Row 3 is Date Header, Row 4 is Sub-headers ("Student Name", "Status")
    aoa[3] = [];
    aoa[4] = [];

    const males = profiles.filter(p => (p.gender || 'male') === 'male');
    const females = profiles.filter(p => p.gender === 'female');

    const maleHeaderRow = 5;
    const maleStartRow = 6;
    const femaleHeaderRow = 6 + males.length;
    const femaleStartRow = 7 + males.length;
    const totalRows = 7 + males.length + females.length;

    // Initialize all rows with empty arrays
    for (let r = 0; r < totalRows; r++) {
      aoa[r] = [];
    }

    dates.forEach((date, dateIdx) => {
      const colStart = dateIdx * 3; // 3 columns per date block (Student Name, Status, Blank spacer)
      
      let displayDate = date;
      try {
        const parsed = new Date(date);
        if (!isNaN(parsed.getTime())) {
          displayDate = parsed.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          });
        }
      } catch {
        // fallback
      }

      // Row 3: Date Header
      aoa[3][colStart] = `Date: ${displayDate}`;
      aoa[3][colStart + 1] = "";
      aoa[3][colStart + 2] = ""; // Spacer

      // Row 4: Sub-headers
      if (type === 'attendance') {
        aoa[4][colStart] = "Student Name";
        aoa[4][colStart + 1] = "Attendance Status";
        aoa[4][colStart + 2] = "";
      } else {
        aoa[4][colStart] = "Student Name";
        aoa[4][colStart + 1] = "Completed Tasks";
        aoa[4][colStart + 2] = "";
      }

      // Male Group Header Row
      aoa[maleHeaderRow][colStart] = "--- MALE STUDENTS ---";
      aoa[maleHeaderRow][colStart + 1] = "";
      aoa[maleHeaderRow][colStart + 2] = "";

      // Fill in Males
      males.forEach((student, idx) => {
        const studentRow = maleStartRow + idx;
        fillStudentData(student, studentRow, colStart, date, type);
      });

      // Female Group Header Row
      aoa[femaleHeaderRow][colStart] = "--- FEMALE STUDENTS ---";
      aoa[femaleHeaderRow][colStart + 1] = "";
      aoa[femaleHeaderRow][colStart + 2] = "";

      // Fill in Females
      females.forEach((student, idx) => {
        const studentRow = femaleStartRow + idx;
        fillStudentData(student, studentRow, colStart, date, type);
      });
    });

    function fillStudentData(student: StudentProfile, studentRow: number, colStart: number, date: string, type: ExportType) {
      if (type === 'attendance') {
        // 1. Get existing attendance log
        const log = attendanceLogs.find(l => {
          const logDate = l.date ? l.date.split('T')[0] : '';
          return l.classmateId === student.id && logDate === date;
        });
        
        // 2. Check task completions on this date
        const studentCompletions = completions.filter(c => c.classmateId === student.id && c.completed && c.completedAt && c.completedAt.startsWith(date));
        const isSelf = student.id === activeProfileId;
        const studentLocalCompletions = isSelf ? tasks.filter(t => !t.isSynced && t.completed && t.completedAt && t.completedAt.startsWith(date)) : [];
        
        const hasCompletedTask = studentCompletions.length > 0 || studentLocalCompletions.length > 0;
        
        // 3. Mark absent for those who have not completed a task
        const status = hasCompletedTask ? (log?.status || 'Present') : 'Absent';

        aoa[studentRow][colStart] = student.name;
        aoa[studentRow][colStart + 1] = status;
        aoa[studentRow][colStart + 2] = "";
      } else {
        // Check task completions on this date
        const studentCompletions = completions.filter(c => c.classmateId === student.id && c.completed && c.completedAt && c.completedAt.startsWith(date));
        const isSelf = student.id === activeProfileId;
        const studentLocalCompletions = isSelf ? tasks.filter(t => !t.isSynced && t.completed && t.completedAt && t.completedAt.startsWith(date)) : [];

        const completedTitles = [
          ...studentCompletions.map(c => {
            const task = tasks.find(t => t.id === c.taskId);
            return task ? `${task.title} (${task.category || 'General'})` : 'Completed Synced Task';
          }),
          ...studentLocalCompletions.map(t => `${t.title} (${t.category || 'General'})`)
        ];

        aoa[studentRow][colStart] = student.name;
        aoa[studentRow][colStart + 1] = completedTitles.length > 0 ? completedTitles.join(', ') : 'Absent';
        aoa[studentRow][colStart + 2] = "";
      }
    }

    // Make sure we replace any undefined values with empty strings to prevent Excel crashes
    for (let r = 0; r < aoa.length; r++) {
      if (!aoa[r]) {
        aoa[r] = [];
      }
      const maxCol = aoa[r].length;
      for (let c = 0; c < maxCol; c++) {
        if (aoa[r][c] === undefined) {
          aoa[r][c] = "";
        }
      }
    }

    return aoa;
  }, [timeFrame, dates, profiles, attendanceLogs, completions, tasks, activeProfileId]);

  const recordCount = useMemo(() => {
    return dates.length * profiles.length;
  }, [dates, profiles]);

  const handleLocalExport = () => {
    setIsExporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const timeFrameLabel = 
        timeFrame === 'day' ? 'Today' : 
        timeFrame === 'week' ? 'Last 7 Days' : 
        timeFrame === 'month' ? 'Last 30 Days' : 'All-Time';
      
      const typeLabel = exportType === 'attendance' ? 'Attendance_Logs' : 'Completed_Coursework';
      const filename = `CampusTrack_${typeLabel}_${timeFrameLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

      const aoaData = generateAoaData(exportType);

      // Create sheet from grouped AOA
      const worksheet = XLSX.utils.aoa_to_sheet(aoaData);

      // Simple column widths auto-adjust
      const maxColWidths = aoaData.reduce((acc, row) => {
        row.forEach((cell, idx) => {
          const val = String(cell || '');
          if (!acc[idx] || val.length > acc[idx]) {
            acc[idx] = val.length;
          }
        });
        return acc;
      }, [] as number[]).map(len => ({ wch: Math.min(len + 3, 50) }));

      worksheet['!cols'] = maxColWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, exportType === 'attendance' ? 'Attendance' : 'Completions');

      // Write and save locally
      XLSX.writeFile(workbook, filename);

      setSuccessMessage(`Export successful! Beautifully grouped ${recordCount} records downloaded directly to your device as ${filename}.`);
    } catch (err: any) {
      console.error("Local XLSX Export Error:", err);
      setErrorMessage(err.message || "An error occurred while generating the Excel file.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 space-y-5 shadow-3xs text-left">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">📊</span>
          <div className="text-left">
            <h4 className="font-sans font-black text-slate-100 text-sm tracking-tight">Excel Report Exporter</h4>
            <p className="text-slate-400 text-[10px]">Create structured worksheets for attendance and coursework accomplishments.</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-indigo-950/40 px-2.5 py-1 rounded-full border border-indigo-900/60">
          <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span className="text-[9px] font-mono font-extrabold text-indigo-300 uppercase tracking-wider">Spreadsheet Ready</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* STEP 1: SELECT EXPORT TYPE */}
        <div className="space-y-2">
          <label className="text-[10px] font-mono font-extrabold uppercase tracking-wide text-slate-400 block">
            1. Choose Report Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setExportType('attendance');
                setSuccessMessage(null);
                setErrorMessage(null);
              }}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-20 ${
                exportType === 'attendance'
                  ? 'bg-slate-850 border-slate-700 ring-1 ring-slate-650 font-extrabold text-white'
                  : 'bg-slate-950/40 hover:bg-slate-900 border-slate-850 text-slate-400'
              }`}
            >
              <span className="text-xs font-black">Attendance Logs</span>
              <span className="text-[10px] font-mono text-indigo-400 font-extrabold">
                {attendanceLogs.length} total days logged
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setExportType('completions');
                setSuccessMessage(null);
                setErrorMessage(null);
              }}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-20 ${
                exportType === 'completions'
                  ? 'bg-slate-850 border-slate-700 ring-1 ring-slate-650 font-extrabold text-white'
                  : 'bg-slate-950/40 hover:bg-slate-900 border-slate-850 text-slate-400'
              }`}
            >
              <span className="text-xs font-black">Completed Tasks</span>
              <span className="text-[10px] font-mono text-emerald-400 font-extrabold">
                {tasks.filter(t => t.completed).length + completions.filter(c => c.completed).length} items done
              </span>
            </button>
          </div>
        </div>

        {/* STEP 2: TIME INTERVAL */}
        <div className="space-y-2">
          <label className="text-[10px] font-mono font-extrabold uppercase tracking-wide text-slate-400 block">
            2. Select Interval (Day, Week, or Month)
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'day', label: 'Day', desc: 'Today only' },
              { id: 'week', label: 'Week', desc: 'Past 7d' },
              { id: 'month', label: 'Month', desc: 'Past 30d' },
              { id: 'all', label: 'All', desc: 'All history' }
            ].map(item => {
              const isActive = timeFrame === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTimeFrame(item.id as TimeFrame);
                    setSuccessMessage(null);
                    setErrorMessage(null);
                  }}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col justify-center gap-0.5 ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-3xs'
                      : 'bg-slate-950/40 hover:bg-slate-900 border-slate-850 text-slate-300'
                  }`}
                >
                  <span className="text-xs font-black block">{item.label}</span>
                  <span className={`text-[8px] font-mono uppercase tracking-wider block ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                    {item.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* LIVE PREVIEW ROW COUNT */}
        <div className="p-3 bg-slate-950/40 rounded-2xl border border-slate-850 flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-450 shrink-0" />
            <div>
              <span className="text-[11px] font-black text-slate-200 block">Matched Records Pre-check</span>
              <span className="text-[9.5px] text-slate-400 block leading-none mt-0.5">
                Filters match {recordCount} record{recordCount === 1 ? '' : 's'} to write.
              </span>
            </div>
          </div>
          <span className="text-xs font-black font-mono bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300">
            {recordCount} Row{recordCount === 1 ? '' : 's'}
          </span>
        </div>

        {/* ALERTS & STATE */}
        {errorMessage && (
          <div className="p-3 bg-rose-950/40 border border-rose-900/60 text-rose-200 text-[10.5px] font-bold rounded-2xl flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-450 shrink-0 mt-0.5" />
            <p className="leading-normal">{errorMessage}</p>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-900/60 text-emerald-200 rounded-2xl">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-extrabold">{successMessage}</p>
                <p className="opacity-90 mt-0.5 leading-normal text-slate-300">
                  The file has been successfully compiled and downloaded to your device.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* EXPORT ACTION BUTTON */}
        <button
          type="button"
          onClick={handleLocalExport}
          disabled={isExporting || recordCount === 0}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold py-3 px-4 rounded-2xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/10"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Generating file & exporting records...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>
                Download Grouped {exportType === 'attendance' ? 'Attendance' : 'Completions'} .xlsx
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
