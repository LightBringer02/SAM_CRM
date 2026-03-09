import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, UserPlus, Trash2, Edit2, Save, X, Phone, Mail,
  Building, Briefcase, IndianRupee, User, Search, Target,
  CheckCircle, AlertCircle, Calendar, Activity, Shield,
  UserX, ChevronDown, Clock, FileText, CreditCard
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────
function getEmployeesFromStorage() {
  try { const s = localStorage.getItem("crm_employees"); if (s) return JSON.parse(s); } catch {}
  return [];
}
function saveEmployeesToStorage(emp) {
  try { localStorage.setItem("crm_employees", JSON.stringify(emp)); return true; } catch { return false; }
}
function getAttendanceFromStorage() {
  try { const s = localStorage.getItem("crm_attendance"); if (s) return JSON.parse(s); } catch {}
  return {};
}
function formatDateKey(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

const DEPARTMENTS = ["Sales", "Operations", "Finance", "HR", "IT", "Marketing", "Admin", "Other"];
const DESIGNATIONS = ["Manager", "Executive", "Senior Executive", "Team Lead", "Intern", "Trainee", "Director", "Other"];

/** Session starts in April. Returns the April 1 date for the current FY. */
function getSessionStart() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(year, 3, 1);
}

/** Calculate attendance percentage for a date range. */
function calcAttendancePct(empId, attendance, from, to) {
  let working = 0, present = 0;
  const d = new Date(from);
  while (d <= to) {
    const dk = formatDateKey(d);
    const a = attendance[empId]?.[dk];
    if (a) {
      if (a.status !== "holiday") {
        working++;
        if (a.status === "present") present++;
        else if (a.status === "half_day") present += 0.5;
      }
    } else {
      // only count past days as working if no record
      if (d <= new Date()) working++;
    }
    d.setDate(d.getDate() + 1);
  }
  return working > 0 ? Math.round((present / working) * 100) : 0;
}

// ── Reusable Form Input (module-level for stable React identity) ────
function FormInput({ label, type = "text", value, onChange, placeholder, required = false, theme, inputMode, pattern }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: theme?.textMuted }}>{label}{required && " *"}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        inputMode={inputMode} pattern={pattern}
        className="w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none"
        style={{ borderColor: theme?.border, backgroundColor: theme?.surface, color: theme?.text }}
      />
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────
export default function EmployeeManagement() {
  const { user, isAdminOrHigher, users } = useAuth();
  const { currentTheme, dark } = useTheme();
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [message, setMessage] = useState(null);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");

  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", aadhaar: "", department: "", designation: "",
    salary: "", joiningDate: "", address: "", emergencyContact: "", notes: "",
    isUser: false, userId: null, createUserAccount: false, userRole: "user",
    customUsername: "",
  });
  const [targetData, setTargetData] = useState({ monthlyTarget: "", incentiveRate: "", targetMonth: "", targetDeadline: "" });

  const canManage = isAdminOrHigher();

  useEffect(() => {
    setEmployees(getEmployeesFromStorage());
    setAttendance(getAttendanceFromStorage());
  }, []);

  const now = new Date();
  const sessionStart = getSessionStart();

  // ── CRUD ──
  const resetForm = () => setFormData({
    name: "", email: "", phone: "", aadhaar: "", department: "", designation: "",
    salary: "", joiningDate: "", address: "", emergencyContact: "", notes: "",
    isUser: false, userId: null, createUserAccount: false, userRole: "user",
    customUsername: "",
  });

  const handleCreateEmployee = () => {
    if (!formData.name.trim()) { setMessage({ type: "error", text: "Employee name is required" }); return; }
    let userId = formData.userId;
    if (formData.createUserAccount && !formData.userId) {
      if (!formData.email) { setMessage({ type: "error", text: "Email is required to create user account" }); return; }
      const username = formData.customUsername?.trim() || formData.email.split("@")[0];
      if (!username) { setMessage({ type: "error", text: "Username is required" }); return; }
      const existing = JSON.parse(localStorage.getItem("users") || "[]");
      if (existing.some(u => u.username === username)) {
        setMessage({ type: "error", text: `Username "${username}" already exists.` }); return;
      }
      const tempPwd = localStorage.getItem("adminTempPassword") || "TempPassword@123";
      const newUser = { id: Date.now(), username, name: formData.name, email: formData.email, password: tempPwd, role: formData.userRole || "user", createdAt: new Date().toLocaleDateString(), isNewUser: true, isEmployee: true };
      localStorage.setItem("users", JSON.stringify([...existing, newUser]));
      userId = newUser.id;
      setMessage({ type: "success", text: `User created! Username: ${username}, Temp Password: ${tempPwd}` });
    }
    const emp = {
      id: Date.now().toString(), ...formData,
      salary: parseFloat(formData.salary) || 0,
      monthlyTarget: 0, incentiveRate: 0,
      isUser: !!userId, userId,
      fired: false,
      createdAt: new Date().toISOString(), createdBy: user?.id,
    };
    const updated = [...employees, emp];
    if (saveEmployeesToStorage(updated)) {
      setEmployees(updated); setShowCreateModal(false); resetForm();
      setMessage({ type: "success", text: `Employee "${emp.name}" created!` });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleUpdateEmployee = () => {
    if (!selectedEmployee) return;
    const updated = employees.map(e =>
      e.id === selectedEmployee.id
        ? { ...e, ...formData, salary: parseFloat(formData.salary) || 0, monthlyTarget: e.monthlyTarget || 0, incentiveRate: e.incentiveRate || 0, updatedAt: new Date().toISOString() }
        : e
    );
    if (saveEmployeesToStorage(updated)) {
      setEmployees(updated); setShowEditModal(false); setSelectedEmployee(null); resetForm();
      setMessage({ type: "success", text: "Employee updated!" });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDeleteEmployee = (empId) => {
    const emp = employees.find(e => e.id === empId);
    if (!window.confirm(`Delete "${emp?.name}"?`)) return;
    const updated = employees.filter(e => e.id !== empId);
    if (saveEmployeesToStorage(updated)) {
      setEmployees(updated);
      setMessage({ type: "success", text: "Employee deleted!" });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleFireEmployee = (empId) => {
    const emp = employees.find(e => e.id === empId);
    if (!window.confirm(`Mark "${emp?.name}" as fired? This will be stored but won't affect current workflow.`)) return;
    const updated = employees.map(e => e.id === empId ? { ...e, fired: true, firedAt: new Date().toISOString() } : e);
    if (saveEmployeesToStorage(updated)) {
      setEmployees(updated);
      setMessage({ type: "success", text: `${emp?.name} has been marked as fired.` });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const openEditModal = (emp) => {
    setSelectedEmployee(emp);
    setFormData({
      name: emp.name || "", email: emp.email || "", phone: emp.phone || "",
      aadhaar: emp.aadhaar || "", department: emp.department || "",
      designation: emp.designation || "", salary: emp.salary?.toString() || "",
      joiningDate: emp.joiningDate || "", address: emp.address || "",
      emergencyContact: emp.emergencyContact || "", notes: emp.notes || "",
      isUser: emp.isUser || false, userId: emp.userId || null,
      customUsername: "",
    });
    setShowEditModal(true);
  };

  const openTargetModal = (emp) => {
    setSelectedEmployee(emp);
    setTargetData({ monthlyTarget: emp.monthlyTarget?.toString() || "", incentiveRate: emp.incentiveRate?.toString() || "", targetMonth: emp.targetMonth || "", targetDeadline: emp.targetDeadline || "" });
    setShowTargetModal(true);
  };

  const handleSaveTarget = () => {
    if (!selectedEmployee) return;
    const updated = employees.map(e =>
      e.id === selectedEmployee.id
        ? { ...e, monthlyTarget: parseFloat(targetData.monthlyTarget) || 0, incentiveRate: parseFloat(targetData.incentiveRate) || 0, targetMonth: targetData.targetMonth || '', targetDeadline: targetData.targetDeadline || '', updatedAt: new Date().toISOString() }
        : e
    );
    if (saveEmployeesToStorage(updated)) {
      setEmployees(updated); setShowTargetModal(false); setSelectedEmployee(null);
      setMessage({ type: "success", text: "Target updated!" });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  // ── Filtering ──
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = !search ||
      emp.name?.toLowerCase().includes(search.toLowerCase()) ||
      emp.email?.toLowerCase().includes(search.toLowerCase()) ||
      emp.phone?.includes(search);
    const matchesDept = !filterDept || emp.department === filterDept;
    return matchesSearch && matchesDept;
  });

  // ── ESC handler ──
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (showProfileModal) setShowProfileModal(false);
        else if (showCreateModal) setShowCreateModal(false);
        else if (showEditModal) setShowEditModal(false);
        else if (showTargetModal) setShowTargetModal(false);
        else navigate(-1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, showCreateModal, showEditModal, showTargetModal, showProfileModal]);

  // ── Employee Form Modal (render function, not component, to preserve input focus) ──
  const renderEmployeeModal = (isEdit) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => isEdit ? setShowEditModal(false) : setShowCreateModal(false)}>
      <div className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: currentTheme?.surfaceAlt, border: `1px solid ${currentTheme?.border}` }}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${currentTheme?.border}` }}>
          <h2 className="text-lg font-bold" style={{ color: currentTheme?.text }}>{isEdit ? "Edit Employee" : "Add New Employee"}</h2>
          <button onClick={() => isEdit ? setShowEditModal(false) : setShowCreateModal(false)} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ backgroundColor: `${currentTheme?.border}44` }}>
            <X className="w-5 h-5" style={{ color: currentTheme?.text }} />
          </button>
        </div>
        {/* Form */}
        <div className="p-5 overflow-y-auto max-h-[65vh]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Full Name" required theme={currentTheme} />
            <FormInput label="Email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="email@example.com" theme={currentTheme} />
            <FormInput label="Phone" type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: (e.target.value || '').replace(/\D/g, '') })} placeholder="9876543210" theme={currentTheme} inputMode="numeric" pattern="[0-9]*" />
            <FormInput label="Aadhaar Number" value={formData.aadhaar} onChange={e => setFormData({ ...formData, aadhaar: (e.target.value || '').replace(/\D/g, '').slice(0, 12) })} placeholder="123456789012" theme={currentTheme} inputMode="numeric" pattern="[0-9]*" />
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: currentTheme?.textMuted }}>Department</label>
              <select value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: currentTheme?.border, backgroundColor: currentTheme?.surface, color: currentTheme?.text }}>
                <option value="">Select</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: currentTheme?.textMuted }}>Designation</label>
              <select value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: currentTheme?.border, backgroundColor: currentTheme?.surface, color: currentTheme?.text }}>
                <option value="">Select</option>
                {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <FormInput label="Salary (₹)" type="number" value={formData.salary} onChange={e => setFormData({ ...formData, salary: e.target.value })} placeholder="Monthly salary" theme={currentTheme} />
            <FormInput label="Joining Date" type="date" value={formData.joiningDate} onChange={e => setFormData({ ...formData, joiningDate: e.target.value })} theme={currentTheme} />
            <FormInput label="Emergency Contact" value={formData.emergencyContact} onChange={e => setFormData({ ...formData, emergencyContact: e.target.value })} placeholder="Contact details" theme={currentTheme} />
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: currentTheme?.textMuted }}>Address</label>
              <textarea value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} rows={2}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: currentTheme?.border, backgroundColor: currentTheme?.surface, color: currentTheme?.text }} placeholder="Full address" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: currentTheme?.textMuted }}>Notes</label>
              <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: currentTheme?.border, backgroundColor: currentTheme?.surface, color: currentTheme?.text }} placeholder="Additional notes" />
            </div>
            {/* Link user */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: currentTheme?.textMuted }}>Link to System User</label>
              <select value={formData.userId || ""} onChange={e => setFormData({ ...formData, userId: e.target.value || null, isUser: !!e.target.value, createUserAccount: false })}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: currentTheme?.border, backgroundColor: currentTheme?.surface, color: currentTheme?.text }}
                disabled={formData.createUserAccount}>
                <option value="">No linked user</option>
                {users?.map(u => <option key={u.id} value={u.id}>{u.name || u.username} ({u.role})</option>)}
              </select>
            </div>
            {!isEdit && !formData.userId && (
              <div className="sm:col-span-2 p-4 rounded-xl border" style={{ backgroundColor: `${currentTheme?.primary}08`, borderColor: `${currentTheme?.primary}33` }}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={formData.createUserAccount} onChange={e => setFormData({ ...formData, createUserAccount: e.target.checked })}
                    className="w-4 h-4 rounded" />
                  <div>
                    <span className="font-medium text-sm" style={{ color: currentTheme?.text }}>Create System User Account</span>
                    <p className="text-xs" style={{ color: currentTheme?.textMuted }}>Creates a login for the employee</p>
                  </div>
                </label>
                {formData.createUserAccount && (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <FormInput label="Username" value={formData.customUsername} onChange={e => setFormData({ ...formData, customUsername: e.target.value.replace(/\s/g, '') })} placeholder={formData.email ? formData.email.split('@')[0] : 'username'} theme={currentTheme} />
                      <div>
                        <span className="text-xs" style={{ color: currentTheme?.textMuted }}>Role:</span>
                        <select value={formData.userRole} onChange={e => setFormData({ ...formData, userRole: e.target.value })}
                          className="px-3 py-1 rounded-lg border text-xs" style={{ borderColor: currentTheme?.border, backgroundColor: currentTheme?.surface, color: currentTheme?.text }}>
                          <option value="user">User</option><option value="staff">Staff</option><option value="manager">Manager</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-[10px]" style={{ color: currentTheme?.textMuted }}>Leave username empty to use email prefix. Temporary password will be assigned.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Footer */}
        <div className="p-5 flex justify-end gap-3" style={{ borderTop: `1px solid ${currentTheme?.border}` }}>
          <button onClick={() => isEdit ? setShowEditModal(false) : setShowCreateModal(false)}
            className="px-4 py-2 rounded-lg border text-sm transition-colors" style={{ borderColor: currentTheme?.border, color: currentTheme?.text }}>
            Cancel
          </button>
          <button onClick={isEdit ? handleUpdateEmployee : handleCreateEmployee}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 transition-colors"
            style={{ backgroundColor: currentTheme?.primary }}>
            <Save className="w-4 h-4" />{isEdit ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Employee Profile Modal (render function, not component) ──
  const renderProfileModal = () => {
    if (!selectedEmployee) return null;
    const emp = selectedEmployee;
    const sessionPct = calcAttendancePct(emp.id, attendance, sessionStart, now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthPct = calcAttendancePct(emp.id, attendance, monthStart, now);
    const linkedUser = emp.userId ? users?.find(u => String(u.id) === String(emp.userId)) : null;

    const InfoRow = ({ icon: Icon, label, value }) => (
      <div className="flex items-start gap-3 py-2" style={{ borderBottom: `1px solid ${currentTheme?.border}33` }}>
        <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: currentTheme?.primary }} />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide" style={{ color: currentTheme?.textMuted }}>{label}</p>
          <p className="text-sm font-medium break-all" style={{ color: currentTheme?.text }}>{value || "—"}</p>
        </div>
      </div>
    );

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowProfileModal(false)}>
        <div className="rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}
          style={{ backgroundColor: currentTheme?.surfaceAlt, border: `1px solid ${currentTheme?.border}` }}>
          {/* Header with gradient */}
          <div className="relative p-6 pb-14" style={{ background: `linear-gradient(135deg, ${currentTheme?.primary}, ${currentTheme?.accent})` }}>
            <button onClick={() => setShowProfileModal(false)} className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white">
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold text-white">{emp.name}</h2>
            <p className="text-sm text-white/80">{emp.designation || "Staff"} — {emp.department || "General"}</p>
            {emp.fired && <span className="absolute top-3 left-3 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded">FIRED</span>}
          </div>
          {/* Avatar overlap */}
          <div className="flex justify-center -mt-10 mb-4">
            <div className="w-20 h-20 rounded-full border-4 flex items-center justify-center text-white text-2xl font-bold"
              style={{ borderColor: currentTheme?.surfaceAlt, background: `linear-gradient(135deg, ${currentTheme?.primary}, ${currentTheme?.accent})` }}>
              {emp.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
          </div>
          {/* Content */}
          <div className="px-6 pb-6 overflow-y-auto max-h-[55vh]">
            {/* Attendance badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl p-3 text-center border" style={{ borderColor: currentTheme?.border, backgroundColor: currentTheme?.surface }}>
                <p className="text-[10px] uppercase" style={{ color: currentTheme?.textMuted }}>Session Attendance</p>
                <p className="text-2xl font-bold" style={{ color: sessionPct >= 75 ? "#22c55e" : sessionPct >= 50 ? "#f59e0b" : "#ef4444" }}>{sessionPct}%</p>
                <p className="text-[10px]" style={{ color: currentTheme?.textMuted }}>Since Apr {sessionStart.getFullYear()}</p>
              </div>
              <div className="rounded-xl p-3 text-center border" style={{ borderColor: currentTheme?.border, backgroundColor: currentTheme?.surface }}>
                <p className="text-[10px] uppercase" style={{ color: currentTheme?.textMuted }}>This Month</p>
                <p className="text-2xl font-bold" style={{ color: monthPct >= 75 ? "#22c55e" : monthPct >= 50 ? "#f59e0b" : "#ef4444" }}>{monthPct}%</p>
                <p className="text-[10px]" style={{ color: currentTheme?.textMuted }}>{new Date().toLocaleString("en-IN", { month: "long", year: "numeric" })}</p>
              </div>
            </div>
            {/* Details */}
            <InfoRow icon={Phone} label="Phone" value={emp.phone} />
            <InfoRow icon={CreditCard} label="Aadhaar Number" value={emp.aadhaar} />
            <InfoRow icon={IndianRupee} label="Salary" value={emp.salary ? `₹${Number(emp.salary).toLocaleString("en-IN")}/month` : null} />
            <InfoRow icon={Target} label="Monthly Target" value={emp.monthlyTarget ? `₹${Number(emp.monthlyTarget).toLocaleString("en-IN")}` : null} />
            <InfoRow icon={Mail} label="Email" value={emp.email} />
            <InfoRow icon={Calendar} label="Date Joined" value={emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null} />
            <InfoRow icon={Building} label="Address" value={emp.address} />
            <InfoRow icon={Phone} label="Emergency Contact" value={emp.emergencyContact} />
            <InfoRow icon={FileText} label="Notes" value={emp.notes} />
            {linkedUser && (
              <>
                <InfoRow icon={Shield} label="CRM Status" value="Linked to CRM Account" />
                <InfoRow icon={User} label="Username" value={linkedUser.username || linkedUser.email} />
                <InfoRow icon={Shield} label="Role" value={linkedUser.role} />
              </>
            )}
            <InfoRow icon={Clock} label="Created" value={emp.createdAt ? new Date(emp.createdAt).toLocaleString("en-IN") : null} />
            {emp.fired && <InfoRow icon={UserX} label="Fired On" value={emp.firedAt ? new Date(emp.firedAt).toLocaleString("en-IN") : "Yes"} />}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 min-h-screen" style={{ color: currentTheme?.text }}>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/employees")} className="p-2 rounded-xl border transition-colors"
            style={{ borderColor: currentTheme?.border, backgroundColor: currentTheme?.surfaceAlt }}>
            <ArrowLeft className="w-5 h-5" style={{ color: currentTheme?.text }} />
          </button>
          <div className="glass-text">
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: currentTheme?.text }}>Employee Management</h1>
            <p className="text-sm" style={{ color: currentTheme?.textMuted }}>Add, edit, and manage employee information</p>
          </div>
        </div>
        {canManage && (
          <button onClick={() => { resetForm(); setShowCreateModal(true); }}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 transition-all hover:shadow-lg"
            style={{ backgroundColor: currentTheme?.primary }}>
            <UserPlus className="w-4 h-4" />Add Employee
          </button>
        )}
      </div>

      {/* ── Message ── */}
      {message && (
        <div className="mb-4 p-3 rounded-xl flex items-center gap-2 border"
          style={{
            backgroundColor: message.type === "success" ? "#f0fdf4" : "#fef2f2",
            borderColor: message.type === "success" ? "#bbf7d0" : "#fecaca",
            color: message.type === "success" ? "#166534" : "#991b1b"
          }}>
          {message.type === "success" ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="rounded-2xl border p-4 mb-6" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: currentTheme?.textMuted }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border text-sm" style={{ borderColor: currentTheme?.border, backgroundColor: currentTheme?.surface, color: currentTheme?.text }} />
          </div>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm" style={{ borderColor: currentTheme?.border, backgroundColor: currentTheme?.surface, color: currentTheme?.text }}>
            <option value="">All Departments</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* ── Employee Cards ── */}
      {filteredEmployees.length === 0 ? (
        <div className="rounded-2xl border p-12 text-center" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
          <User className="w-12 h-12 mx-auto mb-4 opacity-40" style={{ color: currentTheme?.textMuted }} />
          <p style={{ color: currentTheme?.textMuted }}>No employees found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map(emp => {
            const sessionPct = calcAttendancePct(emp.id, attendance, sessionStart, now);
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthPct = calcAttendancePct(emp.id, attendance, monthStart, now);

            return (
              <div key={emp.id}
                className="rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-lg cursor-pointer group"
                style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: emp.fired ? "#ef4444" : currentTheme?.border }}
                onClick={() => { setSelectedEmployee(emp); setShowProfileModal(true); }}
              >
                {/* Card header gradient strip */}
                <div className="h-1.5 transition-all group-hover:h-2" style={{ background: `linear-gradient(90deg, ${currentTheme?.primary}, ${currentTheme?.accent})` }} />

                <div className="p-4 sm:p-5">
                  {/* Top section */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0"
                        style={{ background: `linear-gradient(135deg, ${currentTheme?.primary}, ${currentTheme?.accent})` }}>
                        {emp.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm truncate" style={{ color: currentTheme?.text }}>{emp.name}</h3>
                        <p className="text-xs truncate" style={{ color: currentTheme?.textMuted }}>
                          {emp.designation || "Staff"}{emp.department ? ` • ${emp.department}` : ""}
                        </p>
                      </div>
                    </div>
                    {emp.fired && <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded shrink-0">FIRED</span>}
                  </div>

                  {/* Info rows */}
                  <div className="space-y-1.5 mb-3">
                    {emp.phone && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: currentTheme?.textMuted }}>
                        <Phone className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{emp.phone}</span>
                      </div>
                    )}
                    {emp.aadhaar && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: currentTheme?.textMuted }}>
                        <CreditCard className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{emp.aadhaar}</span>
                      </div>
                    )}
                    {emp.salary > 0 && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: currentTheme?.textMuted }}>
                        <IndianRupee className="w-3.5 h-3.5 shrink-0" /><span>₹{Number(emp.salary).toLocaleString("en-IN")}/month</span>
                      </div>
                    )}
                    {emp.monthlyTarget > 0 && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: currentTheme?.textMuted }}>
                        <Target className="w-3.5 h-3.5 shrink-0" /><span>Target: ₹{Number(emp.monthlyTarget).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                    {emp.targetDeadline && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: currentTheme?.textMuted }}>
                        <Clock className="w-3.5 h-3.5 shrink-0" /><span>Deadline: {new Date(emp.targetDeadline).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                      </div>
                    )}
                  </div>

                  {/* Target Progress Bar */}
                  {emp.monthlyTarget > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span style={{ color: currentTheme?.textMuted }}>Target Progress</span>
                        <span className="font-bold" style={{ color: currentTheme?.accent }}>{emp.targetAchieved ? Math.min(Math.round((emp.targetAchieved / emp.monthlyTarget) * 100), 100) : 0}%</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${currentTheme?.border}66` }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${emp.targetAchieved ? Math.min(Math.round((emp.targetAchieved / emp.monthlyTarget) * 100), 100) : 0}%`, background: `linear-gradient(90deg, #38bdf8, ${currentTheme?.accent})` }} />
                      </div>
                    </div>
                  )}

                  {/* Attendance badges */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    <div className="rounded-lg p-2 text-center border" style={{ borderColor: `${currentTheme?.border}66`, backgroundColor: `${currentTheme?.surface}88` }}>
                      <p className="text-[9px] uppercase" style={{ color: currentTheme?.textMuted }}>Session</p>
                      <p className="text-sm font-bold" style={{ color: sessionPct >= 75 ? "#22c55e" : sessionPct >= 50 ? "#f59e0b" : "#ef4444" }}>{sessionPct}%</p>
                    </div>
                    <div className="rounded-lg p-2 text-center border" style={{ borderColor: `${currentTheme?.border}66`, backgroundColor: `${currentTheme?.surface}88` }}>
                      <p className="text-[9px] uppercase" style={{ color: currentTheme?.textMuted }}>This Month</p>
                      <p className="text-sm font-bold" style={{ color: monthPct >= 75 ? "#22c55e" : monthPct >= 50 ? "#f59e0b" : "#ef4444" }}>{monthPct}%</p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {canManage && (
                    <div className="flex items-center gap-1.5 pt-2" style={{ borderTop: `1px solid ${currentTheme?.border}44` }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => openTargetModal(emp)} title="Set Target"
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                        style={{ backgroundColor: `${currentTheme?.accent}14`, color: currentTheme?.accent }}>
                        <Target className="w-3.5 h-3.5" />Target
                      </button>
                      <button onClick={() => openEditModal(emp)} title="Edit"
                        className="p-1.5 rounded-lg transition-all hover:opacity-80"
                        style={{ backgroundColor: `${currentTheme?.primary}14`, color: currentTheme?.primary }}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {!emp.fired && (
                        <button onClick={() => handleFireEmployee(emp.id)} title="Fire Employee"
                          className="p-1.5 rounded-lg transition-all hover:opacity-80"
                          style={{ backgroundColor: "#ef444414", color: "#ef4444" }}>
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => handleDeleteEmployee(emp.id)} title="Delete"
                        className="p-1.5 rounded-lg transition-all hover:opacity-80"
                        style={{ backgroundColor: "#ef444414", color: "#ef4444" }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {showCreateModal && renderEmployeeModal(false)}
      {showEditModal && renderEmployeeModal(true)}
      {showProfileModal && renderProfileModal()}

      {/* ── Target Modal ── */}
      {showTargetModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowTargetModal(false)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}
            style={{ backgroundColor: currentTheme?.surfaceAlt, border: `1px solid ${currentTheme?.border}` }}>
            <div className="p-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${currentTheme?.border}` }}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ backgroundColor: `${currentTheme?.accent}18` }}>
                  <Target className="w-5 h-5" style={{ color: currentTheme?.accent }} />
                </div>
                <div>
                  <h2 className="font-bold" style={{ color: currentTheme?.text }}>Set Target &amp; Incentive</h2>
                  <p className="text-xs" style={{ color: currentTheme?.textMuted }}>{selectedEmployee.name}</p>
                </div>
              </div>
              <button onClick={() => setShowTargetModal(false)} className="p-1.5 rounded-lg" style={{ backgroundColor: `${currentTheme?.border}44` }}>
                <X className="w-4 h-4" style={{ color: currentTheme?.text }} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <FormInput label="Monthly Target (₹)" type="number" value={targetData.monthlyTarget}
                onChange={e => setTargetData({ ...targetData, monthlyTarget: e.target.value })} placeholder="Enter target" theme={currentTheme} />
              <FormInput label="Incentive Rate (%)" type="number" value={targetData.incentiveRate}
                onChange={e => setTargetData({ ...targetData, incentiveRate: e.target.value })} placeholder="Enter incentive %" theme={currentTheme} />
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: currentTheme?.textMuted }}>Target Month</label>
                <input type="month" value={targetData.targetMonth} onChange={e => setTargetData({ ...targetData, targetMonth: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: currentTheme?.border, backgroundColor: currentTheme?.surface, color: currentTheme?.text }} />
              </div>
              <FormInput label="Deadline" type="date" value={targetData.targetDeadline}
                onChange={e => setTargetData({ ...targetData, targetDeadline: e.target.value })} placeholder="Target deadline" theme={currentTheme} />
            </div>
            <div className="p-5 flex justify-end gap-3" style={{ borderTop: `1px solid ${currentTheme?.border}` }}>
              <button onClick={() => setShowTargetModal(false)} className="px-4 py-2 rounded-lg border text-sm"
                style={{ borderColor: currentTheme?.border, color: currentTheme?.text }}>Cancel</button>
              <button onClick={handleSaveTarget}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
                style={{ backgroundColor: currentTheme?.accent }}>
                <Save className="w-4 h-4" />Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
