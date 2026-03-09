import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import {
  Users, ChevronRight, Calendar, CheckCircle, XCircle, Clock,
  AlertCircle, Activity, TrendingUp, TrendingDown, Zap, Heart,
  Target, BarChart3, Gauge, AlertTriangle, ArrowUpRight,
  ArrowDownRight, Timer, CalendarDays, Briefcase
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// ── Helpers ──────────────────────────────────────────────────────────
function getEmployeesFromStorage() {
  try {
    const stored = localStorage.getItem("crm_employees");
    if (stored) return JSON.parse(stored);
  } catch (err) { console.error("Failed to load employees:", err); }
  return [];
}

function getAttendanceFromStorage() {
  try {
    const stored = localStorage.getItem("crm_attendance");
    if (stored) return JSON.parse(stored);
  } catch (err) { console.error("Failed to load attendance:", err); }
  return {};
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthName(month) {
  return ["January","February","March","April","May","June",
    "July","August","September","October","November","December"][month];
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// ── Component ────────────────────────────────────────────────────────
export default function Employees() {
  const { user, isAdminOrHigher, isRoot, users } = useAuth();
  const { currentTheme, dark } = useTheme();
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [showTargetDetail, setShowTargetDetail] = useState(false);

  // Move date variables above useEffect hooks
  const now = new Date();
  const todayKey = formatDateKey(now);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  useEffect(() => {
    setEmployees(getEmployeesFromStorage());
    setAttendance(getAttendanceFromStorage());
  }, []);

  // Fetch actual target achievement from vouchers (via backend)
  useEffect(() => {
    if (!employees.length) return;
    const empWithTargets = employees.filter(e => e.monthlyTarget > 0);
    if (!empWithTargets.length) return;

    const fetchTargets = async () => {
      try {
        const res = await axios.post(`${API_BASE}/api/sync/employee-targets`, {
          employeeNames: empWithTargets.map(e => e.name),
          month: currentMonth,
          year: currentYear
        });
        if (res.data?.success && res.data.targets) {
          const targets = res.data.targets;
          let changed = false;
          const updated = employees.map(emp => {
            if (emp.monthlyTarget > 0 && targets[emp.name]) {
              const achieved = Math.round(targets[emp.name].achieved);
              if (emp.targetAchieved !== achieved) {
                changed = true;
                return { ...emp, targetAchieved: achieved, targetVoucherCount: targets[emp.name].voucherCount };
              }
            }
            return emp;
          });
          if (changed) {
            setEmployees(updated);
            try { localStorage.setItem("crm_employees", JSON.stringify(updated)); } catch {}
          }
        }
      } catch (err) {
        // Do not overwrite employees if backend fails
        console.warn("Failed to fetch employee targets:", err.message);
      }
    };
    fetchTargets();
  }, [employees.length, currentMonth, currentYear]);

  // ── Today's attendance ──
  const todayData = useMemo(() => {
    let present = 0, absent = 0, leave = 0, holiday = 0, unmarked = 0;
    employees.forEach(emp => {
      const a = attendance[emp.id]?.[todayKey];
      if (!a) { unmarked++; return; }
      if (a.status === "present") present++;
      else if (a.status === "absent") absent++;
      else if (a.status === "half_day") { present += 0.5; absent += 0.5; }
      else if (a.status === "leave") leave++;
      else if (a.status === "holiday") holiday++;
      else unmarked++;
    });
    const total = employees.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    const absentRate = total > 0 ? Math.round((absent / total) * 100) : 0;
    return { present: Math.round(present), absent: Math.round(absent), leave, holiday, unmarked, total, rate, absentRate };
  }, [employees, attendance, todayKey]);

  // ── Average stress (auto-calculated from attendance + targets) ──
  const avgStress = useMemo(() => {
    if (!employees.length) return 0;
    const dm = getDaysInMonth(currentYear, currentMonth);
    let totalStress = 0;
    employees.forEach(emp => {
      let absent = 0, present = 0, working = 0;
      for (let d = 1; d <= Math.min(now.getDate(), dm); d++) {
        const dk = formatDateKey(new Date(currentYear, currentMonth, d));
        const a = attendance[emp.id]?.[dk];
        if (a) {
          if (a.status !== 'holiday') { working++; if (a.status === 'present') present++; else if (a.status === 'absent') absent++; }
        } else if (new Date(currentYear, currentMonth, d) <= now) { working++; }
      }
      const attendanceScore = working > 0 ? (absent / working) * 40 : 0;
      const targetScore = emp.monthlyTarget > 0 ? Math.max(0, (1 - (emp.targetAchieved || 0) / emp.monthlyTarget)) * 40 : 10;
      const overworkScore = present > 24 ? 20 : present > 20 ? 10 : 0;
      totalStress += Math.min(100, Math.round(attendanceScore + targetScore + overworkScore));
    });
    return Math.round(totalStress / employees.length);
  }, [employees, attendance, currentMonth, currentYear]);

  const stressColor = avgStress <= 35 ? "#10b981" : avgStress <= 70 ? "#f59e0b" : "#ef4444";
  const stressLabel = avgStress <= 35 ? "Calm" : avgStress <= 70 ? "Active" : "Burnout Risk";

  // ── Efficiency ──
  const efficiency = useMemo(() => {
    if (!employees.length) return 0;
    const attScore = todayData.rate || 50;
    const stressScore = 100 - avgStress;
    return Math.round(attScore * 0.6 + stressScore * 0.4);
  }, [todayData.rate, avgStress, employees.length]);

  // ── Target overview ──
  const targetOverview = useMemo(() => {
    const totalTarget = employees.reduce((s, e) => s + (e.monthlyTarget || 0), 0);
    const achieved = employees.reduce((s, e) => s + (e.targetAchieved || 0), 0);
    const pct = totalTarget > 0 ? Math.round((achieved / totalTarget) * 100) : 0;
    return { totalTarget, achieved, pct, onTrack: pct >= 75 };
  }, [employees]);

  // ── Burnout risk ──
  const burnoutCount = useMemo(() => {
    return avgStress > 70 ? Math.ceil(employees.length * 0.2) : 0;
  }, [employees, avgStress]);

  // ── Monthly alerts ──
  const monthlyAlerts = useMemo(() => {
    const alerts = [];
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    employees.forEach(emp => {
      let absent = 0;
      for (let d = 1; d <= Math.min(now.getDate(), daysInMonth); d++) {
        const dk = formatDateKey(new Date(currentYear, currentMonth, d));
        const a = attendance[emp.id]?.[dk];
        if (a?.status === "absent") absent++;
      }
      if (absent >= 5) alerts.push({ name: emp.name, type: "absence", count: absent });
    });
    if (targetOverview.pct > 0 && targetOverview.pct < 50) {
      alerts.push({ name: "Team", type: "target", detail: `Only ${targetOverview.pct}% of target achieved` });
    }
    return alerts;
  }, [employees, attendance, currentMonth, currentYear, targetOverview.pct]);

  return (
    <div className="p-4 sm:p-6 min-h-screen" style={{ color: currentTheme?.text }}>
      {/* ── Header ── */}
      {employees.length === 0 && (
        <div className="rounded-xl border p-6 text-center mb-8" style={{ backgroundColor: `${currentTheme?.surface}88`, borderColor: currentTheme?.border }}>
          <h2 className="text-xl font-bold mb-2" style={{ color: currentTheme?.text }}>No employees found</h2>
          <p className="text-sm" style={{ color: currentTheme?.textMuted }}>Please add employees in Employee Management to see analytics and attendance.</p>
        </div>
      )}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${currentTheme?.primary}22` }}>
          <Users className="w-7 h-7" style={{ color: currentTheme?.primary }} />
        </div>
        <div className="glass-text">
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: currentTheme?.text }}>Employees</h1>
          <p className="text-sm" style={{ color: currentTheme?.textMuted }}>Workforce management &amp; analytics</p>
        </div>
      </div>

      {/* ── Navigation Buttons ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* Employee Management */}
        <button
          onClick={() => navigate("/employees/management")}
          className="group flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 transition-all duration-300 hover:shadow-lg active:scale-[0.98]"
          style={{ backgroundColor: `${currentTheme?.surfaceAlt}cc`, borderColor: currentTheme?.border }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = currentTheme?.primary; e.currentTarget.style.boxShadow = `0 0 24px ${currentTheme?.primary}22`; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = currentTheme?.border; e.currentTarget.style.boxShadow = "none"; }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${currentTheme?.primary}18` }}>
              <Briefcase className="w-5 h-5" style={{ color: currentTheme?.primary }} />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-base" style={{ color: currentTheme?.text }}>Employee Management</h3>
              <p className="text-sm" style={{ color: currentTheme?.textMuted }}>
                {employees.length} employees &bull; {employees.filter(e => e.isUser).length} linked users
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" style={{ color: currentTheme?.textMuted }} />
        </button>

        {/* Attendance System */}
        <button
          onClick={() => navigate("/employees/attendance")}
          className="group flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 transition-all duration-300 hover:shadow-lg active:scale-[0.98]"
          style={{ backgroundColor: `${currentTheme?.surfaceAlt}cc`, borderColor: currentTheme?.border }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = currentTheme?.accent; e.currentTarget.style.boxShadow = `0 0 24px ${currentTheme?.accent}22`; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = currentTheme?.border; e.currentTarget.style.boxShadow = "none"; }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${currentTheme?.accent}18` }}>
              <CalendarDays className="w-5 h-5" style={{ color: currentTheme?.accent }} />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-base" style={{ color: currentTheme?.text }}>Employee Attendance System</h3>
              <p className="text-sm" style={{ color: currentTheme?.textMuted }}>
                {getMonthName(currentMonth)} {currentYear} &bull; {todayData.present} present today
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" style={{ color: currentTheme?.textMuted }} />
        </button>
      </div>

      {/* ── Employee Management Dashboard ── */}
      <div
        className="rounded-3xl border p-4 sm:p-6 mb-6"
        style={{ backgroundColor: `${currentTheme?.surface}dd`, borderColor: currentTheme?.border, backdropFilter: "blur(12px)" }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: `linear-gradient(135deg, ${currentTheme?.primary}, ${currentTheme?.accent})` }}>
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold" style={{ color: currentTheme?.text }}>Employee Management Dashboard</h2>
              <p className="text-xs sm:text-sm" style={{ color: currentTheme?.textMuted }}>Real-time workforce health &amp; performance</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-xs" style={{ color: currentTheme?.textMuted }}>Live</span>
          </div>
        </div>

        {/* ── Top 3 Analytics Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Stress Management */}
          <div className="rounded-2xl border p-5 transition-all duration-300" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Heart className="w-4 h-4" style={{ color: stressColor }} />
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: currentTheme?.textMuted }}>Stress Pulse</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold" style={{ color: stressColor }}>{avgStress}</span>
                  <span className="text-lg" style={{ color: currentTheme?.textMuted }}>%</span>
                </div>
                <span className="text-sm font-semibold" style={{ color: stressColor }}>{stressLabel}</span>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: `${stressColor}18` }}>
                <Gauge className="w-7 h-7" style={{ color: stressColor }} />
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${currentTheme?.border}88` }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${avgStress}%`, backgroundColor: stressColor }} />
              </div>
              <div className="flex justify-between mt-1 text-[10px]" style={{ color: currentTheme?.textMuted }}>
                <span>Calm</span><span>Active</span><span>Critical</span>
              </div>
            </div>
          </div>

          {/* Efficiency */}
          <div className="rounded-2xl border p-5 transition-all duration-300" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4" style={{ color: currentTheme?.primary }} />
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: currentTheme?.textMuted }}>Efficiency</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold" style={{ color: currentTheme?.primary }}>{efficiency}</span>
                  <span className="text-lg" style={{ color: currentTheme?.textMuted }}>%</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {efficiency >= 70
                    ? <ArrowUpRight className="w-4 h-4 text-green-500" />
                    : <ArrowDownRight className="w-4 h-4 text-red-500" />}
                  <span className={`text-sm font-medium ${efficiency >= 70 ? "text-green-500" : "text-red-500"}`}>
                    {efficiency >= 70 ? "Optimal" : "Needs Attention"}
                  </span>
                </div>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: `${currentTheme?.primary}12` }}>
                <Activity className="w-7 h-7" style={{ color: currentTheme?.primary }} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="text-center p-2 rounded-lg" style={{ backgroundColor: `${currentTheme?.surface}88` }}>
                <p className="text-[10px]" style={{ color: currentTheme?.textMuted }}>Attendance</p>
                <p className="font-bold text-sm" style={{ color: currentTheme?.primary }}>{todayData.rate}%</p>
              </div>
              <div className="text-center p-2 rounded-lg" style={{ backgroundColor: `${currentTheme?.surface}88` }}>
                <p className="text-[10px]" style={{ color: currentTheme?.textMuted }}>Wellness</p>
                <p className="font-bold text-sm" style={{ color: currentTheme?.primary }}>{100 - avgStress}%</p>
              </div>
            </div>
          </div>

          {/* Target & Incentive - CLICKABLE */}
          <div className="rounded-2xl border p-5 transition-all duration-300 cursor-pointer hover:shadow-lg"
            style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}
            onClick={() => setShowTargetDetail(true)}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4" style={{ color: currentTheme?.accent }} />
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: currentTheme?.textMuted }}>Target Overview</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold" style={{ color: currentTheme?.accent }}>{targetOverview.pct}</span>
                  <span className="text-lg" style={{ color: currentTheme?.textMuted }}>%</span>
                </div>
                <p className="text-sm" style={{ color: currentTheme?.textMuted }}>
                  {targetOverview.totalTarget > 0
                    ? `₹${(targetOverview.achieved / 1000).toFixed(0)}K / ₹${(targetOverview.totalTarget / 1000).toFixed(0)}K`
                    : "No targets set"}
                </p>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: `${currentTheme?.accent}12` }}>
                <TrendingUp className="w-7 h-7" style={{ color: currentTheme?.accent }} />
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${currentTheme?.border}88` }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(targetOverview.pct, 100)}%`, background: `linear-gradient(90deg, ${currentTheme?.accent}, ${currentTheme?.primary})` }}
                />
              </div>
              <p className="text-[10px] mt-2 text-center" style={{ color: currentTheme?.textMuted }}>Click to see employee-wise breakdown</p>
            </div>
          </div>
        </div>

        {/* ── 4-chip row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Absence Rate", value: `${todayData.absentRate}%`, icon: XCircle, bad: todayData.absentRate > 20 },
            { label: "Punctuality", value: `${todayData.rate}%`, icon: Timer, color: currentTheme?.primary },
            { label: "Burnout Risk", value: `${burnoutCount} ${burnoutCount === 1 ? "person" : "people"}`, icon: AlertTriangle, bad: burnoutCount > 0 },
            { label: "Target Status", value: targetOverview.onTrack ? "On Track" : `${targetOverview.pct}% Done`, icon: Target, bad: !targetOverview.onTrack && targetOverview.totalTarget > 0 },
          ].map((chip, i) => {
            const Icon = chip.icon;
            const chipColor = chip.color || (chip.bad ? "#ef4444" : "#10b981");
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border" style={{ backgroundColor: `${currentTheme?.surface}aa`, borderColor: currentTheme?.border }}>
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${chipColor}14` }}>
                  <Icon className="w-4 h-4" style={{ color: chipColor }} />
                </div>
                <div>
                  <p className="text-[10px]" style={{ color: currentTheme?.textMuted }}>{chip.label}</p>
                  <p className="text-base font-bold" style={{ color: chipColor }}>{chip.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Alerts ── */}
        {monthlyAlerts.length > 0 && (
          <div className="rounded-xl border p-4" style={{ backgroundColor: `${currentTheme?.surface}88`, borderColor: currentTheme?.border }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="font-semibold text-sm" style={{ color: currentTheme?.text }}>Alerts &amp; Flags</span>
            </div>
            <div className="space-y-2">
              {monthlyAlerts.map((a, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg text-sm" style={{ backgroundColor: `${currentTheme?.surfaceAlt}88` }}>
                  {a.type === "absence"
                    ? <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    : <TrendingDown className="w-4 h-4 text-amber-500 shrink-0" />}
                  <span style={{ color: currentTheme?.text }}>
                    {a.type === "absence"
                      ? <><strong>{a.name}</strong> has {a.count} absences this month</>
                      : <><strong>{a.name}</strong>: {a.detail}</>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Target Detail Modal with Employee Progress Bars ── */}
      {showTargetDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowTargetDetail(false)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}
            style={{ backgroundColor: currentTheme?.surfaceAlt, border: `1px solid ${currentTheme?.border}` }}>
            <div className="p-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${currentTheme?.border}` }}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ backgroundColor: `${currentTheme?.accent}18` }}>
                  <Target className="w-5 h-5" style={{ color: currentTheme?.accent }} />
                </div>
                <div>
                  <h2 className="font-bold" style={{ color: currentTheme?.text }}>Employee Target Progress</h2>
                  <p className="text-xs" style={{ color: currentTheme?.textMuted }}>{getMonthName(currentMonth)} {currentYear}</p>
                </div>
              </div>
              <button onClick={() => setShowTargetDetail(false)} className="p-1.5 rounded-lg" style={{ backgroundColor: `${currentTheme?.border}44` }}>
                <XCircle className="w-5 h-5" style={{ color: currentTheme?.text }} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[65vh] space-y-4">
              {employees.filter(e => e.monthlyTarget > 0).length === 0 ? (
                <p className="text-center py-8 text-sm" style={{ color: currentTheme?.textMuted }}>No employees have targets set</p>
              ) : (
                employees.filter(e => e.monthlyTarget > 0).map(emp => {
                  const achieved = emp.targetAchieved || 0;
                  const pct = Math.min(Math.round((achieved / emp.monthlyTarget) * 100), 100);
                  const barColor = pct >= 75 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";
                  return (
                    <div key={emp.id} className="rounded-xl border p-4" style={{ borderColor: currentTheme?.border, backgroundColor: currentTheme?.surface }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ background: `linear-gradient(135deg, ${currentTheme?.primary}, ${currentTheme?.accent})` }}>
                            {emp.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: currentTheme?.text }}>{emp.name}</p>
                            <p className="text-[10px]" style={{ color: currentTheme?.textMuted }}>{emp.designation || "Staff"}</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold" style={{ color: barColor }}>{pct}%</span>
                      </div>
                      <div className="h-3 rounded-full overflow-hidden mb-1" style={{ backgroundColor: `${currentTheme?.border}66` }}>
                        <div className="h-full rounded-full transition-all duration-1000"
                          style={{ width: `${pct}%`, background: `linear-gradient(90deg, #38bdf8, ${barColor})` }} />
                      </div>
                      <div className="flex justify-between text-[10px]" style={{ color: currentTheme?.textMuted }}>
                        <span>₹{achieved.toLocaleString("en-IN")} achieved</span>
                        <span>Target: ₹{emp.monthlyTarget.toLocaleString("en-IN")}</span>
                      </div>
                      {emp.targetDeadline && (
                        <p className="text-[10px] mt-1" style={{ color: currentTheme?.textMuted }}>Deadline: {new Date(emp.targetDeadline).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
