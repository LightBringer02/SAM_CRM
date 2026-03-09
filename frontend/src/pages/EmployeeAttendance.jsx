import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Calendar, CheckCircle, XCircle, Clock, CalendarDays,
  ChevronLeft, ChevronRight, Users, AlertCircle, X, UserCheck, IndianRupee
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────
const ATTENDANCE_STATUS = {
  present:  { label: "Present",  short: "P",  color: "#22c55e", bg: "#dcfce7", bgDark: "rgba(34,197,94,0.15)" },
  absent:   { label: "Absent",   short: "A",  color: "#ef4444", bg: "#fee2e2", bgDark: "rgba(239,68,68,0.15)" },
  leave:    { label: "Leave",    short: "L",  color: "#3b82f6", bg: "#dbeafe", bgDark: "rgba(59,130,246,0.15)" },
  holiday:  { label: "Holiday",  short: "H",  color: "#a855f7", bg: "#f3e8ff", bgDark: "rgba(168,85,247,0.15)" },
};

function getEmployeesFromStorage() {
  try { const s = localStorage.getItem("crm_employees"); if (s) return JSON.parse(s); } catch {}
  return [];
}
function getAttendanceFromStorage() {
  try { const s = localStorage.getItem("crm_attendance"); if (s) return JSON.parse(s); } catch {}
  return {};
}
function saveAttendanceToStorage(att) {
  try { localStorage.setItem("crm_attendance", JSON.stringify(att)); return true; } catch { return false; }
}
/** Fixed: Use local date parts to avoid timezone-induced date shifts */
function formatDateKey(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function getMonthName(m) {
  return ["January","February","March","April","May","June","July","August","September","October","November","December"][m];
}
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

// ── Component ────────────────────────────────────────────────────────
export default function EmployeeAttendance() {
  const { user, isAdminOrHigher } = useAuth();
  const { currentTheme, dark } = useTheme();
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [message, setMessage] = useState(null);
  const [markingEmpId, setMarkingEmpId] = useState(null);
  const [markingDate, setMarkingDate] = useState(formatDateKey(new Date()));

  const canManage = isAdminOrHigher();

  useEffect(() => {
    setEmployees(getEmployeesFromStorage());
    setAttendance(getAttendanceFromStorage());
  }, []);

  // ── Mark attendance ──
  const markAttendance = (empId, dateKey, status) => {
    const next = {
      ...attendance,
      [empId]: {
        ...(attendance[empId] || {}),
        [dateKey]: { status, markedBy: user?.id, markedAt: new Date().toISOString() },
      },
    };
    if (saveAttendanceToStorage(next)) setAttendance(next);
  };

  // ── Bulk mark ──
  const markBulkAttendance = (status) => {
    const next = { ...attendance };
    employees.forEach(emp => {
      if (!next[emp.id]) next[emp.id] = {};
      next[emp.id][markingDate] = { status, markedBy: user?.id, markedAt: new Date().toISOString() };
    });
    if (saveAttendanceToStorage(next)) {
      setAttendance(next);
      setMessage({ type: "success", text: `Marked ${employees.length} employees as ${ATTENDANCE_STATUS[status].label}` });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const getStatus = (empId, dateKey) => attendance[empId]?.[dateKey]?.status || null;

  // ── Monthly stats ──
  const getMonthlyStats = (empId) => {
    const dm = getDaysInMonth(selectedYear, selectedMonth);
    const stats = { present: 0, absent: 0, leave: 0, holiday: 0, unmarked: 0 };
    for (let d = 1; d <= dm; d++) {
      const dk = formatDateKey(new Date(selectedYear, selectedMonth, d));
      const s = getStatus(empId, dk);
      if (s && stats[s] !== undefined) stats[s]++;
      else stats.unmarked++;
    }
    const working = dm - stats.holiday - stats.leave;
    stats.percentage = working > 0 ? Math.round((stats.present / working) * 100) : 0;
    return stats;
  };

  // ── Calculate salary based on working days ──
  const calculateSalary = (empId) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp || !emp.salary) return { monthlySalary: 0, perDay: 0, payable: 0, presentDays: 0, totalWorkingDays: 0 };
    const dm = getDaysInMonth(selectedYear, selectedMonth);
    const stats = getMonthlyStats(empId);
    const totalWorkingDays = dm - stats.holiday;
    const perDay = totalWorkingDays > 0 ? emp.salary / totalWorkingDays : 0;
    const payable = Math.round(perDay * stats.present);
    return { monthlySalary: emp.salary, perDay: Math.round(perDay), payable, presentDays: stats.present, totalWorkingDays };
  };

  // ── Summary stats ──
  const summaryStats = useMemo(() => {
    const totals = { present: 0, absent: 0, leave: 0, holiday: 0, avgPct: 0, totalPayable: 0 };
    if (!employees.length) return totals;
    let pctSum = 0;
    employees.forEach(emp => {
      const s = getMonthlyStats(emp.id);
      totals.present += s.present;
      totals.absent += s.absent;
      totals.leave += s.leave;
      totals.holiday += s.holiday;
      pctSum += s.percentage;
      const sal = calculateSalary(emp.id);
      totals.totalPayable += sal.payable;
    });
    totals.avgPct = Math.round(pctSum / employees.length);
    return totals;
  }, [employees, attendance, selectedMonth, selectedYear]);

  // ── Month navigation ──
  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);

  return (
    <div className="p-4 sm:p-6 min-h-screen" style={{ color: currentTheme?.text }}>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/employees")}
            className="p-2 rounded-xl border transition-colors"
            style={{ borderColor: currentTheme?.border, backgroundColor: currentTheme?.surfaceAlt }}
          >
            <ArrowLeft className="w-5 h-5" style={{ color: currentTheme?.text }} />
          </button>
          <div className="glass-text">
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: currentTheme?.text }}>Attendance Dashboard</h1>
            <p className="text-sm" style={{ color: currentTheme?.textMuted }}>Track and manage employee attendance</p>
          </div>
        </div>
      </div>

      {/* ── Message ── */}
      {message && (
        <div className="mb-4 p-3 rounded-xl flex items-center gap-2 border"
          style={{
            backgroundColor: message.type === "success" ? "#f0fdf4" : "#fef2f2",
            borderColor: message.type === "success" ? "#bbf7d0" : "#fecaca",
            color: message.type === "success" ? "#166534" : "#991b1b"
          }}
        >
          {message.type === "success" ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total Present", value: summaryStats.present, color: "#22c55e", icon: CheckCircle },
          { label: "Total Absent", value: summaryStats.absent, color: "#ef4444", icon: XCircle },
          { label: "Total Leave", value: summaryStats.leave, color: "#3b82f6", icon: Calendar },
          { label: "Avg Attendance", value: `${summaryStats.avgPct}%`, color: currentTheme?.primary, icon: UserCheck },
          { label: "Total Payable", value: `₹${summaryStats.totalPayable.toLocaleString("en-IN")}`, color: "#f59e0b", icon: IndianRupee },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="rounded-2xl border p-4 transition-all" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${s.color}18` }}>
                  <Icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
                <span className="text-xs font-medium" style={{ color: currentTheme?.textMuted }}>{s.label}</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* ── Month Navigation + Bulk Actions ── */}
      <div className="rounded-2xl border p-4 mb-6" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-2 rounded-xl border transition-colors" style={{ borderColor: currentTheme?.border, backgroundColor: currentTheme?.surface }}>
              <ChevronLeft className="w-5 h-5" style={{ color: currentTheme?.text }} />
            </button>
            <span className="text-lg font-semibold min-w-[160px] text-center" style={{ color: currentTheme?.text }}>
              {getMonthName(selectedMonth)} {selectedYear}
            </span>
            <button onClick={nextMonth} className="p-2 rounded-xl border transition-colors" style={{ borderColor: currentTheme?.border, backgroundColor: currentTheme?.surface }}>
              <ChevronRight className="w-5 h-5" style={{ color: currentTheme?.text }} />
            </button>
          </div>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={markingDate} onChange={e => setMarkingDate(e.target.value)}
                className="px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: currentTheme?.border, backgroundColor: currentTheme?.surface, color: currentTheme?.text }} />
              {Object.entries(ATTENDANCE_STATUS).map(([key, val]) => (
                <button key={key} onClick={() => markBulkAttendance(key)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                  style={{ backgroundColor: dark ? val.bgDark : val.bg, color: val.color, border: `1px solid ${val.color}44` }}>
                  All {val.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3 mt-4 pt-3" style={{ borderTop: `1px solid ${currentTheme?.border}` }}>
          {Object.entries(ATTENDANCE_STATUS).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: val.color }} />
              <span style={{ color: currentTheme?.textMuted }}>{val.short} = {val.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Attendance Table ── */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
        {employees.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-40" style={{ color: currentTheme?.textMuted }} />
            <p style={{ color: currentTheme?.textMuted }}>No employees found. Add employees in Employee Management first.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr style={{ backgroundColor: currentTheme?.surface }}>
                  <th className="px-3 py-3 text-left text-xs font-semibold sticky left-0 z-10" style={{ color: currentTheme?.text, backgroundColor: currentTheme?.surface, minWidth: 140 }}>
                    Employee
                  </th>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const dt = new Date(selectedYear, selectedMonth, i + 1);
                    const isSun = dt.getDay() === 0;
                    return (
                      <th key={i} className="px-1 py-2 text-center text-[10px] font-medium min-w-[38px]"
                        style={{ color: isSun ? "#a855f7" : currentTheme?.textMuted, backgroundColor: isSun ? `${currentTheme?.accent}08` : undefined }}>
                        <div>{["S","M","T","W","T","F","S"][dt.getDay()]}</div>
                        <div className="font-bold text-xs" style={{ color: isSun ? "#a855f7" : currentTheme?.text }}>{i + 1}</div>
                      </th>
                    );
                  })}
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: currentTheme?.text, minWidth: 80 }}>%</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold" style={{ color: currentTheme?.text, minWidth: 120 }}>Salary</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const stats = getMonthlyStats(emp.id);
                  const salInfo = calculateSalary(emp.id);
                  return (
                    <tr key={emp.id} style={{ borderTop: `1px solid ${currentTheme?.border}44` }}>
                      <td className="px-3 py-2 sticky left-0 z-10" style={{ backgroundColor: currentTheme?.surfaceAlt }}>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ background: `linear-gradient(135deg, ${currentTheme?.primary}, ${currentTheme?.accent})` }}>
                            {emp.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: currentTheme?.text }}>{emp.name}</p>
                            <p className="text-[10px] truncate" style={{ color: currentTheme?.textMuted }}>{emp.designation || "Staff"}</p>
                          </div>
                        </div>
                      </td>
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const dt = new Date(selectedYear, selectedMonth, i + 1);
                        const dk = formatDateKey(dt);
                        const status = getStatus(emp.id, dk);
                        const info = status ? ATTENDANCE_STATUS[status] : null;
                        const isSun = dt.getDay() === 0;
                        return (
                          <td key={i} className="px-0.5 py-1 text-center"
                            style={{ backgroundColor: isSun ? `${currentTheme?.accent}06` : undefined }}>
                            {canManage ? (
                              <select value={status || ""} onChange={e => { if (e.target.value) markAttendance(emp.id, dk, e.target.value); }}
                                className="w-8 h-7 text-[10px] font-bold rounded cursor-pointer border-0 text-center appearance-none"
                                style={{ 
                                  backgroundColor: info ? (dark ? info.bgDark : info.bg) : `${currentTheme?.border}44`, 
                                  color: info ? info.color : (dark ? currentTheme?.text : currentTheme?.textMuted),
                                  WebkitTextFillColor: info ? info.color : (dark ? currentTheme?.text : currentTheme?.textMuted)
                                }}>
                                <option value="" style={{ backgroundColor: dark ? '#1f2937' : '#fff', color: dark ? '#e5e7eb' : '#374151' }}>-</option>
                                {Object.entries(ATTENDANCE_STATUS).map(([k, v]) => (
                                  <option key={k} value={k} style={{ backgroundColor: dark ? '#1f2937' : '#fff', color: v.color }}>{v.short}</option>
                                ))}
                              </select>
                            ) : (
                              <div className="w-7 h-7 mx-auto rounded flex items-center justify-center text-[10px] font-bold"
                                style={{ 
                                  backgroundColor: info ? (dark ? info.bgDark : info.bg) : `${currentTheme?.border}44`, 
                                  color: info ? info.color : (dark ? currentTheme?.text : currentTheme?.textMuted)
                                }}>
                                {info ? info.short : "-"}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center">
                        <span className="inline-block px-2 py-1 rounded-lg text-xs font-bold"
                          style={{ backgroundColor: dark 
                            ? (stats.percentage >= 90 ? "rgba(34,197,94,0.2)" : stats.percentage >= 75 ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)") 
                            : (stats.percentage >= 90 ? "#dcfce7" : stats.percentage >= 75 ? "#fef3c7" : "#fee2e2"),
                            color: stats.percentage >= 90 ? "#22c55e" : stats.percentage >= 75 ? "#f59e0b" : "#ef4444" }}>
                          {stats.percentage}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold" style={{ color: "#f59e0b" }}>
                            ₹{salInfo.payable.toLocaleString("en-IN")}
                          </span>
                          <span className="text-[9px]" style={{ color: currentTheme?.textMuted }}>
                            {salInfo.presentDays}d × ₹{salInfo.perDay.toLocaleString("en-IN")}
                          </span>
                          {salInfo.monthlySalary > 0 && (
                            <span className="text-[9px]" style={{ color: currentTheme?.textMuted }}>
                              of ₹{salInfo.monthlySalary.toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
