import React, { useState, useMemo, useCallback } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar,
  ExternalLink,
  Sparkles,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';
import { Task, StudentProfile, SyncedTaskCompletion, AttendanceLog } from '../types';

interface GoogleSheetsExportProps {
  googleToken: string | null;
  onGoogleSignIn: () => Promise<void>;
  profiles: StudentProfile[];
  attendanceLogs: AttendanceLog[];
  completions: SyncedTaskCompletion[];
  tasks: Task[];
  activeProfileId: string | null;
}

type ExportType = 'attendance' | 'completions';
type TimeFrame = 'day' | 'week' | 'month' | 'all';

export default function GoogleSheetsExport({
  googleToken,
  onGoogleSignIn,
  profiles,
  attendanceLogs,
  completions,
  tasks,
  activeProfileId
}: GoogleSheetsExportProps) {
  const [exportType, setExportType] = useState<ExportType>('attendance');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('month');
  const [isExporting, setIsExporting] = useState(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isAwaitingBridge, setIsAwaitingBridge] = useState(false);

  const isWebView = useMemo(() => {
    if (typeof window === 'undefined' || !window.navigator) return false;
    const ua = window.navigator.userAgent || '';
    return (
      /wv/i.test(ua) ||
      (ua.includes('Android') && !ua.includes('Chrome/')) ||
      ua.includes('FBAN') ||
      ua.includes('FBAV') ||
      window.location.protocol === 'file:' ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'chrome-extension:'
    );
  }, []);

  const webAppUrl = "https://ais-pre-4tgsuzuwe3pwzlzchjfwfx-1044932737425.asia-southeast1.run.app";

  const handleCopyLink = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(webAppUrl);
    } else {
      // Fallback for older WebView engines
      const textarea = document.createElement("textarea");
      textarea.value = webAppUrl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } catch (err) {
        console.warn("execCommand fallback failed", err);
      }
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to parse dates and check range
  const isWithinTimeFrame = useCallback((dateStr: string | undefined): boolean => {
    if (!dateStr || dateStr === 'N/A') return false;
    
    const recordDate = new Date(dateStr);
    if (isNaN(recordDate.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recordMidnight = new Date(recordDate);
    recordMidnight.setHours(0, 0, 0, 0);

    if (timeFrame === 'day') {
      return recordMidnight.getTime() === today.getTime();
    } else if (timeFrame === 'week') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      return recordMidnight.getTime() >= sevenDaysAgo.getTime();
    } else if (timeFrame === 'month') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      return recordMidnight.getTime() >= thirtyDaysAgo.getTime();
    }
    return true; // 'all'
  }, [timeFrame]);

  // Get matching attendance records
  const matchedAttendance = useMemo(() => {
    return attendanceLogs.filter(log => isWithinTimeFrame(log.date));
  }, [attendanceLogs, isWithinTimeFrame]);

  // Get matching completed tasks
  const matchedCompletions = useMemo(() => {
    const list: Array<{
      date: string;
      taskTitle: string;
      category: string;
      priority: string;
      studentName: string;
      source: 'Synced' | 'Local';
    }> = [];

    // 1. completions array (synced tasks)
    completions.forEach(c => {
      if (c.completed && c.completedAt) {
        const task = tasks.find(t => t.id === c.taskId);
        const student = profiles.find(p => p.id === c.classmateId);
        
        if (isWithinTimeFrame(c.completedAt)) {
          list.push({
            date: c.completedAt.split('T')[0],
            taskTitle: task ? task.title : 'Deleted Synced Task',
            category: task ? task.category : 'General',
            priority: task ? task.priority : 'medium',
            studentName: student ? student.name : `Student ${c.classmateId.substring(0, 5)}`,
            source: 'Synced'
          });
        }
      }
    });

    // 2. tasks array (local tasks for active user)
    tasks.forEach(t => {
      if (!t.isSynced && t.completed && t.completedAt) {
        const student = profiles.find(p => p.id === activeProfileId);
        if (isWithinTimeFrame(t.completedAt)) {
          list.push({
            date: t.completedAt.split('T')[0],
            taskTitle: t.title,
            category: t.category || 'General',
            priority: t.priority || 'medium',
            studentName: student ? student.name : 'Me',
            source: 'Local'
          });
        }
      }
    });

    // Sort by date descending
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [completions, tasks, profiles, activeProfileId, isWithinTimeFrame]);

  const recordCount = exportType === 'attendance' ? matchedAttendance.length : matchedCompletions.length;

  const handleExport = async () => {
    if (!googleToken) {
      setErrorMessage("Please authenticate with Google first.");
      return;
    }

    setIsExporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setExportedUrl(null);

    try {
      const timeFrameLabel = 
        timeFrame === 'day' ? 'Today' : 
        timeFrame === 'week' ? 'Last 7 Days' : 
        timeFrame === 'month' ? 'Last 30 Days' : 'All-Time';
      
      const typeLabel = exportType === 'attendance' ? 'Attendance Logs' : 'Completed Coursework';
      const title = `CampusTrack Export - ${typeLabel} (${timeFrameLabel})`;

      // 1. Create spreadsheet
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: { title }
        })
      });

      if (!createRes.ok) {
        const errData = await createRes.json();
        throw new Error(errData.error?.message || "Failed to create Google Sheet.");
      }

      const createData = await createRes.json();
      const spreadsheetId = createData.spreadsheetId;
      const spreadsheetUrl = createData.spreadsheetUrl;

      // 2. Prepare spreadsheet values
      let values: any[][] = [];
      
      if (exportType === 'attendance') {
        values = [
          [`CampusTrack ${typeLabel} Export`],
          [`Time Range: ${timeFrameLabel}`, `Generated: ${new Date().toLocaleString()}`],
          [], // spacer
          ["Date Check-In", "Student Name", "Subject", "Status Check"]
        ];

        matchedAttendance.forEach(log => {
          const student = profiles.find(p => p.id === log.classmateId);
          values.push([
            log.date,
            student ? student.name : `ID: ${log.classmateId}`,
            log.subject || 'N/A',
            log.status
          ]);
        });
      } else {
        values = [
          [`CampusTrack ${typeLabel} Export`],
          [`Time Range: ${timeFrameLabel}`, `Generated: ${new Date().toLocaleString()}`],
          [], // spacer
          ["Completion Date", "Task Title", "Subject Category", "Urgency Priority", "Student Name", "Sync Type"]
        ];

        matchedCompletions.forEach(item => {
          values.push([
            item.date,
            item.taskTitle,
            item.category,
            item.priority.toUpperCase(),
            item.studentName,
            item.source
          ]);
        });
      }

      // 3. Write data to spreadsheet
      const writeRange = 'Sheet1!A1';
      const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: writeRange,
          majorDimension: 'ROWS',
          values: values
        })
      });

      if (!writeRes.ok) {
        const errData = await writeRes.json();
        throw new Error(errData.error?.message || "Failed to populate Google Sheet values.");
      }

      // 4. Custom Styling BatchUpdate (Bold header, slate background, border borders, auto-resize)
      try {
        const endColumnIndex = exportType === 'attendance' ? 4 : 6;
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [
              // Title banner styling
              {
                repeatCell: {
                  range: {
                    sheetId: 0,
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: 1
                  },
                  cell: {
                    userEnteredFormat: {
                      textFormat: {
                        fontSize: 16,
                        bold: true,
                        foregroundColor: { red: 0.1, green: 0.1, blue: 0.25 }
                      }
                    }
                  },
                  fields: 'userEnteredFormat(textFormat)'
                }
              },
              // Headers Row Styling
              {
                repeatCell: {
                  range: {
                    sheetId: 0,
                    startRowIndex: 3,
                    endRowIndex: 4,
                    startColumnIndex: 0,
                    endColumnIndex: endColumnIndex
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.24, green: 0.27, blue: 0.58 }, // #3f4494
                      textFormat: {
                        foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                        bold: true,
                        fontSize: 10
                      },
                      horizontalAlignment: 'CENTER'
                    }
                  },
                  fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                }
              },
              // Auto-resize columns
              {
                autoResizeDimensions: {
                  dimensions: {
                    sheetId: 0,
                    dimension: 'COLUMNS',
                    startIndex: 0,
                    endIndex: endColumnIndex
                  }
                }
              }
            ]
          })
        });
      } catch (styleErr) {
        console.warn("Styling update failed (benign):", styleErr);
      }

      setExportedUrl(spreadsheetUrl);
      setSuccessMessage(`Export successful! Successfully wrote ${recordCount} records.`);
    } catch (err: any) {
      console.error("Sheets export error:", err);
      setErrorMessage(err.message || "An error occurred while creating the spreadsheet.");
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
            <h4 className="font-sans font-black text-slate-100 text-sm tracking-tight">Google Sheets Report Exporter</h4>
            <p className="text-slate-400 text-[10px]">Create styled worksheets for attendance and accomplishments dynamically.</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-indigo-950/40 px-2.5 py-1 rounded-full border border-indigo-900/60">
          <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span className="text-[9px] font-mono font-extrabold text-indigo-300 uppercase tracking-wider">Sheets Active</span>
        </div>
      </div>

      {!googleToken ? (
        isAwaitingBridge ? (
          <div className="p-5 bg-slate-950/60 border border-indigo-900/40 rounded-3xl space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-indigo-950/80 border border-indigo-500/20 flex items-center justify-center relative">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping absolute" />
              <FileSpreadsheet className="w-5 h-5 text-indigo-400 animate-pulse relative z-10" />
            </div>
            
            <div className="space-y-1">
              <h5 className="text-xs font-black text-indigo-300 uppercase tracking-wider font-mono">📡 Awaiting Web Authorization...</h5>
              <p className="text-[10px] text-slate-300 leading-relaxed max-w-xs mx-auto">
                We launched a secure browser tab to authorize your Google Workspace account. Please complete the login on Chrome/Safari.
              </p>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-850 text-left space-y-1.5 font-mono text-[9.5px]">
              <div className="flex justify-between items-center text-slate-400">
                <span>Firestore Sync Channel:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active Listening
                </span>
              </div>
              <p className="text-[8.5px] text-slate-500 leading-normal pt-1 border-t border-slate-850">
                This APK app will automatically refresh and connect the moment the standard browser login succeeds!
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <a
                href={`${webAppUrl}?bridgeAuth=true&uid=${activeProfileId || ''}`}
                target="_blank"
                referrerPolicy="no-referrer"
                rel="noopener noreferrer"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 px-3 rounded-xl text-[10px] flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer shadow-md"
              >
                <ExternalLink className="w-3.5 h-3.5 text-indigo-200" />
                <span>Re-open Auth Tab</span>
              </a>
              
              <button
                type="button"
                onClick={() => setIsAwaitingBridge(false)}
                className="text-[10px] text-slate-500 hover:text-slate-400 underline font-semibold transition-colors cursor-pointer"
              >
                Cancel and return
              </button>
            </div>
          </div>
        ) : isWebView ? (
          <div className="p-4 bg-slate-950/60 border border-amber-900/40 rounded-2xl space-y-4 text-left">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <h5 className="text-xs font-black uppercase tracking-tight font-mono">Mobile App Connection Notice</h5>
            </div>
            
            <p className="text-[10px] text-slate-300 leading-relaxed">
              Google's strict security guidelines **prevent direct Google Account sign-ins inside embedded web views (APK apps)**. 
            </p>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-850 space-y-2">
              <span className="text-[9px] font-mono font-black text-indigo-400 uppercase tracking-wide block">💡 Seamless Real-Time Solution:</span>
              <p className="text-[9.5px] text-slate-400 leading-normal">
                Authorize the app securely in your standard browser (Chrome/Safari) using the **Google Auth Bridge**. Your APK app will automatically detect and link the connection instantly!
              </p>
            </div>

            <div className="pt-1.5 space-y-2">
              <a
                href={`${webAppUrl}?bridgeAuth=true&uid=${activeProfileId || ''}`}
                onClick={() => setIsAwaitingBridge(true)}
                target="_blank"
                referrerPolicy="no-referrer"
                rel="noopener noreferrer"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-4 rounded-xl text-[10.5px] flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md text-center"
              >
                <Sparkles className="w-4 h-4 text-indigo-200" />
                <span>Connect with Google Auth Bridge</span>
              </a>

              <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-[9px] font-mono text-slate-300 select-all">
                <span className="truncate flex-1 font-semibold">{webAppUrl}</span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="p-1 hover:bg-slate-800 rounded text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                  title="Copy web link"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-3.5 text-center">
            <div className="mx-auto w-10 h-10 rounded-full bg-indigo-950/60 border border-indigo-900/40 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="space-y-1">
              <h5 className="text-xs font-black text-slate-200">Workspace Authorization Required</h5>
              <p className="text-[9.5px] text-slate-400 max-w-sm mx-auto leading-normal">
                To securely connect and export files to Google Drive & Google Sheets on your account, please sign in with your Google workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="w-full max-w-xs mx-auto bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-3xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>Connect Workspace Account</span>
            </button>
          </div>
        )
      ) : (
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
            <div className="p-4 bg-emerald-950/40 border border-emerald-900/60 text-emerald-200 rounded-2xl space-y-2.5">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-extrabold">{successMessage}</p>
                  <p className="opacity-90 mt-0.5 leading-normal text-slate-300">
                    Spreadsheet created successfully on your Google Drive. Review and edit the worksheet at any time.
                  </p>
                </div>
              </div>
              {exportedUrl && (
                <a
                  href={exportedUrl}
                  target="_blank"
                  referrerPolicy="no-referrer"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black px-4 py-2 rounded-xl transition-all shadow-3xs cursor-pointer"
                >
                  <span>Open Google Sheet</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {/* EXPORT ACTION BUTTON */}
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || recordCount === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold py-3 px-4 rounded-2xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/10"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Spreadsheet & Writing Data...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Export {exportType === 'attendance' ? 'Attendance' : 'Completions'} to Google Sheets</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
