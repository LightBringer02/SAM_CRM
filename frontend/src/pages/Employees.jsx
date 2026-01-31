import React, { useState, useEffect } from "react";
import { useAuth } from "../auth";
import { 
  Users, UserPlus, Trash2, Edit2, Save, X, ChevronDown, ChevronRight,
  Calendar, CheckCircle, XCircle, Clock, AlertCircle, Phone, Mail,
  Building, Briefcase, IndianRupee, FileText, User, CalendarDays
} from "lucide-react";

// Attendance status options
const ATTENDANCE_STATUS = {
  present: { label: "Present", color: "green", icon: CheckCircle },
  absent: { label: "Absent", color: "red", icon: XCircle },
  half_day: { label: "Half Day", color: "yellow", icon: Clock },
  leave: { label: "Leave", color: "blue", icon: Calendar },
  holiday: { label: "Holiday", color: "purple", icon: CalendarDays },
};

// Get employees from localStorage
function getEmployeesFromStorage() {
  try {
    const stored = localStorage.getItem("crm_employees");
    if (stored) return JSON.parse(stored);
  } catch (err) {
    console.error("Failed to load employees:", err);
  }
  return [];
}

// Save employees to localStorage
function saveEmployeesToStorage(employees) {
  try {
    localStorage.setItem("crm_employees", JSON.stringify(employees));
    return true;
  } catch (err) {
    console.error("Failed to save employees:", err);
    return false;
  }
}

// Get attendance from localStorage
function getAttendanceFromStorage() {
  try {
    const stored = localStorage.getItem("crm_attendance");
    if (stored) return JSON.parse(stored);
  } catch (err) {
    console.error("Failed to load attendance:", err);
  }
  return {};
}

// Save attendance to localStorage
function saveAttendanceToStorage(attendance) {
  try {
    localStorage.setItem("crm_attendance", JSON.stringify(attendance));
    return true;
  } catch (err) {
    console.error("Failed to save attendance:", err);
    return false;
  }
}

// Format date as YYYY-MM-DD
function formatDateKey(date) {
  return date.toISOString().split('T')[0];
}

// Get month name
function getMonthName(month) {
  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  return months[month];
}

// Get days in month
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export default function Employees() {
  const { user, isAdminOrHigher, users } = useAuth();
  const [activeSection, setActiveSection] = useState(null); // 'management' or 'attendance'
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [message, setMessage] = useState(null);
  
  // Attendance state
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Form state for new/edit employee
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    designation: "",
    salary: "",
    joiningDate: "",
    address: "",
    emergencyContact: "",
    notes: "",
    isUser: false,
    userId: null
  });

  // Check if current user can manage employees
  const canManage = isAdminOrHigher();

  // Check if a user is online (active within last 5 minutes)
  const isUserOnline = (userId) => {
    if (!userId) return false;
    const lastActivity = localStorage.getItem(`user_activity_${userId}`);
    if (!lastActivity) return false;
    const timeDiff = Date.now() - parseInt(lastActivity, 10);
    return timeDiff < 5 * 60 * 1000; // 5 minutes
  };

  // Get last seen time
  const getLastSeen = (userId) => {
    if (!userId) return null;
    const lastActivity = localStorage.getItem(`user_activity_${userId}`);
    if (!lastActivity) return null;
    const date = new Date(parseInt(lastActivity, 10));
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`;
    return date.toLocaleDateString();
  };

  // Load data on mount
  useEffect(() => {
    const loadedEmployees = getEmployeesFromStorage();
    const loadedAttendance = getAttendanceFromStorage();
    setEmployees(loadedEmployees);
    setAttendance(loadedAttendance);
  }, []);

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      department: "",
      designation: "",
      salary: "",
      joiningDate: "",
      address: "",
      emergencyContact: "",
      notes: "",
      isUser: false,
      userId: null
    });
  };

  // Create employee
  const handleCreateEmployee = () => {
    if (!formData.name.trim()) {
      setMessage({ type: "error", text: "Employee name is required" });
      return;
    }

    const newEmployee = {
      id: Date.now().toString(),
      ...formData,
      salary: parseFloat(formData.salary) || 0,
      createdAt: new Date().toISOString(),
      createdBy: user?.id
    };

    const updatedEmployees = [...employees, newEmployee];
    if (saveEmployeesToStorage(updatedEmployees)) {
      setEmployees(updatedEmployees);
      setShowCreateModal(false);
      resetForm();
      setMessage({ type: "success", text: `Employee "${newEmployee.name}" created successfully!` });
    } else {
      setMessage({ type: "error", text: "Failed to save employee" });
    }
  };

  // Update employee
  const handleUpdateEmployee = () => {
    if (!selectedEmployee) return;

    const updatedEmployees = employees.map(emp =>
      emp.id === selectedEmployee.id
        ? { ...emp, ...formData, salary: parseFloat(formData.salary) || 0, updatedAt: new Date().toISOString() }
        : emp
    );

    if (saveEmployeesToStorage(updatedEmployees)) {
      setEmployees(updatedEmployees);
      setShowEditModal(false);
      setSelectedEmployee(null);
      resetForm();
      setMessage({ type: "success", text: "Employee updated successfully!" });
    } else {
      setMessage({ type: "error", text: "Failed to update employee" });
    }
  };

  // Delete employee
  const handleDeleteEmployee = (empId) => {
    const emp = employees.find(e => e.id === empId);
    if (!window.confirm(`Are you sure you want to delete "${emp?.name}"?`)) return;

    const updatedEmployees = employees.filter(e => e.id !== empId);
    if (saveEmployeesToStorage(updatedEmployees)) {
      setEmployees(updatedEmployees);
      setMessage({ type: "success", text: "Employee deleted successfully!" });
    } else {
      setMessage({ type: "error", text: "Failed to delete employee" });
    }
  };

  // Open edit modal
  const openEditModal = (emp) => {
    setSelectedEmployee(emp);
    setFormData({
      name: emp.name || "",
      email: emp.email || "",
      phone: emp.phone || "",
      department: emp.department || "",
      designation: emp.designation || "",
      salary: emp.salary?.toString() || "",
      joiningDate: emp.joiningDate || "",
      address: emp.address || "",
      emergencyContact: emp.emergencyContact || "",
      notes: emp.notes || "",
      isUser: emp.isUser || false,
      userId: emp.userId || null
    });
    setShowEditModal(true);
  };

  // Mark attendance
  const markAttendance = (empId, date, status, remark = "") => {
    const dateKey = formatDateKey(date);
    const newAttendance = {
      ...attendance,
      [empId]: {
        ...(attendance[empId] || {}),
        [dateKey]: { status, remark, markedBy: user?.id, markedAt: new Date().toISOString() }
      }
    };
    if (saveAttendanceToStorage(newAttendance)) {
      setAttendance(newAttendance);
    }
  };

  // Get attendance for a specific date
  const getAttendanceForDate = (empId, date) => {
    const dateKey = formatDateKey(date);
    return attendance[empId]?.[dateKey] || null;
  };

  // Calculate monthly attendance stats
  const getMonthlyStats = (empId) => {
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    let present = 0, absent = 0, halfDay = 0, leave = 0, holiday = 0, unmarked = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(selectedYear, selectedMonth, day);
      const att = getAttendanceForDate(empId, date);
      if (!att) {
        unmarked++;
      } else {
        switch (att.status) {
          case 'present': present++; break;
          case 'absent': absent++; break;
          case 'half_day': halfDay++; break;
          case 'leave': leave++; break;
          case 'holiday': holiday++; break;
          default: unmarked++;
        }
      }
    }

    return { present, absent, halfDay, leave, holiday, unmarked, total: daysInMonth };
  };

  // Render section cards
  const renderSectionCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      {/* Management Card */}
      <div
        className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
          activeSection === 'management'
            ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e1f22] hover:border-sky-300 dark:hover:border-sky-700'
        }`}
        onClick={() => setActiveSection(activeSection === 'management' ? null : 'management')}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-sky-100 dark:bg-sky-900/50 rounded-lg">
              <Users className="w-6 h-6 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Employee Management</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{employees.length} employees</p>
            </div>
          </div>
          {activeSection === 'management' ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Attendance Card */}
      <div
        className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
          activeSection === 'attendance'
            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e1f22] hover:border-green-300 dark:hover:border-green-700'
        }`}
        onClick={() => setActiveSection(activeSection === 'attendance' ? null : 'attendance')}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Attendance</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{getMonthName(selectedMonth)} {selectedYear}</p>
            </div>
          </div>
          {activeSection === 'attendance' ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>
    </div>
  );

  // Render mini attendance dashboard
  const renderAttendanceDashboard = () => (
    <div className="mb-6 p-4 bg-white dark:bg-[#1e1f22] rounded-xl border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Attendance Overview - {getMonthName(selectedMonth)} {selectedYear}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800">
              <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Employee</th>
              <th className="px-3 py-2 text-center font-medium text-green-600">Present</th>
              <th className="px-3 py-2 text-center font-medium text-red-600">Absent</th>
              <th className="px-3 py-2 text-center font-medium text-yellow-600">Half Day</th>
              <th className="px-3 py-2 text-center font-medium text-blue-600">Leave</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Unmarked</th>
              <th className="px-3 py-2 text-center font-medium text-gray-700 dark:text-gray-300">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {employees.map(emp => {
              const stats = getMonthlyStats(emp.id);
              const workingDays = stats.total - stats.holiday - stats.leave;
              const percentage = workingDays > 0 ? ((stats.present + stats.halfDay * 0.5) / workingDays * 100) : 0;
              return (
                <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{emp.name}</td>
                  <td className="px-3 py-2 text-center text-green-600">{stats.present}</td>
                  <td className="px-3 py-2 text-center text-red-600">{stats.absent}</td>
                  <td className="px-3 py-2 text-center text-yellow-600">{stats.halfDay}</td>
                  <td className="px-3 py-2 text-center text-blue-600">{stats.leave}</td>
                  <td className="px-3 py-2 text-center text-gray-500">{stats.unmarked}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      percentage >= 90 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      percentage >= 75 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {percentage.toFixed(0)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Render management section
  const renderManagementSection = () => (
    <div className="bg-white dark:bg-[#1e1f22] rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Employee List</h3>
        {canManage && (
          <button
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition"
          >
            <UserPlus className="w-4 h-4" />
            Add Employee
          </button>
        )}
      </div>

      {employees.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No employees yet. Add your first employee to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Name</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Department</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Designation</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Contact</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">User Account</th>
                {canManage && <th className="px-3 py-2 text-center font-medium text-gray-700 dark:text-gray-300">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {employees.map(emp => {
                const online = isUserOnline(emp.userId);
                const lastSeen = getLastSeen(emp.userId);
                return (
                <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center">
                          <User className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        </div>
                        {emp.userId && (
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
                        )}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {emp.userId ? (
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className={`text-xs ${online ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                          {online ? 'Online' : lastSeen || 'Offline'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{emp.department || '-'}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{emp.designation || '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col text-xs">
                      {emp.phone && <span className="text-gray-600 dark:text-gray-400">{emp.phone}</span>}
                      {emp.email && <span className="text-gray-500 dark:text-gray-500">{emp.email}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {emp.isUser ? (
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">
                        Linked
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded text-xs">
                        Not a user
                      </span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(emp)}
                          className="p-1 text-gray-500 hover:text-sky-600 dark:hover:text-sky-400"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp.id)}
                          className="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // Render attendance section
  const renderAttendanceSection = () => {
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);

    return (
      <div className="bg-white dark:bg-[#1e1f22] rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        {/* Month/Year selector */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>{getMonthName(i)}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - 2 + i;
                return <option key={year} value={year}>{year}</option>;
              })}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">P = Present</span>
            <span className="px-2 py-1 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">A = Absent</span>
            <span className="px-2 py-1 text-xs rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">H = Half Day</span>
            <span className="px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">L = Leave</span>
            <span className="px-2 py-1 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">🎉 = Holiday</span>
          </div>
        </div>

        {employees.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Add employees first to mark attendance.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="px-2 py-2 text-left font-medium text-gray-700 dark:text-gray-300 sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 min-w-[120px]">
                    Employee
                  </th>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const date = new Date(selectedYear, selectedMonth, i + 1);
                    const isSunday = date.getDay() === 0;
                    return (
                      <th key={i} className={`px-1 py-2 text-center font-medium min-w-[36px] ${isSunday ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {i + 1}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-2 py-2 font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-[#1e1f22] z-10">
                      {emp.name}
                    </td>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const date = new Date(selectedYear, selectedMonth, i + 1);
                      const att = getAttendanceForDate(emp.id, date);
                      const isSunday = date.getDay() === 0;
                      
                      return (
                        <td key={i} className={`px-1 py-1 text-center ${isSunday ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}>
                          {canManage ? (
                            <select
                              value={att?.status || ''}
                              onChange={(e) => {
                                const status = e.target.value;
                                if (status) {
                                  const remark = status === 'leave' || status === 'absent' 
                                    ? prompt('Add a remark (optional):') || ''
                                    : '';
                                  markAttendance(emp.id, date, status, remark);
                                }
                              }}
                              className={`w-8 h-6 text-xs rounded border-0 cursor-pointer ${
                                att?.status === 'present' ? 'bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100' :
                                att?.status === 'absent' ? 'bg-red-200 text-red-800 dark:bg-red-700 dark:text-red-100' :
                                att?.status === 'half_day' ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100' :
                                att?.status === 'leave' ? 'bg-blue-200 text-blue-800 dark:bg-blue-700 dark:text-blue-100' :
                                att?.status === 'holiday' ? 'bg-purple-200 text-purple-800 dark:bg-purple-700 dark:text-purple-100' :
                                'bg-gray-100 dark:bg-gray-700'
                              }`}
                              title={att?.remark ? `Remark: ${att.remark}` : 'Click to mark attendance'}
                            >
                              <option value="">-</option>
                              <option value="present">P</option>
                              <option value="absent">A</option>
                              <option value="half_day">H</option>
                              <option value="leave">L</option>
                              <option value="holiday">🎉</option>
                            </select>
                          ) : (
                            <span className={`inline-block w-6 h-6 rounded text-xs leading-6 ${
                              att?.status === 'present' ? 'bg-green-200 text-green-800' :
                              att?.status === 'absent' ? 'bg-red-200 text-red-800' :
                              att?.status === 'half_day' ? 'bg-yellow-200 text-yellow-800' :
                              att?.status === 'leave' ? 'bg-blue-200 text-blue-800' :
                              att?.status === 'holiday' ? 'bg-purple-200 text-purple-800' :
                              'bg-gray-100 dark:bg-gray-700 text-gray-400'
                            }`} title={att?.remark ? `Remark: ${att.remark}` : ''}>
                              {att?.status === 'present' ? 'P' :
                               att?.status === 'absent' ? 'A' :
                               att?.status === 'half_day' ? 'H' :
                               att?.status === 'leave' ? 'L' :
                               att?.status === 'holiday' ? '🎉' : '-'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // Render employee form modal
  const renderEmployeeModal = (isEdit = false) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => isEdit ? setShowEditModal(false) : setShowCreateModal(false)}>
      <div className="bg-white dark:bg-[#1e1f22] rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Employee' : 'Add New Employee'}
          </h2>
          <button onClick={() => isEdit ? setShowEditModal(false) : setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Full Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="+91 XXXXX XXXXX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
              <input
                type="text"
                value={formData.department}
                onChange={e => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="e.g., Sales, IT, HR"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Designation</label>
              <input
                type="text"
                value={formData.designation}
                onChange={e => setFormData({ ...formData, designation: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="e.g., Manager, Executive"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Salary (Monthly)</label>
              <input
                type="number"
                value={formData.salary}
                onChange={e => setFormData({ ...formData, salary: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Joining Date</label>
              <input
                type="date"
                value={formData.joiningDate}
                onChange={e => setFormData({ ...formData, joiningDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Emergency Contact</label>
              <input
                type="tel"
                value={formData.emergencyContact}
                onChange={e => setFormData({ ...formData, emergencyContact: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="+91 XXXXX XXXXX"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
              <textarea
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                rows={2}
                placeholder="Full address"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                rows={2}
                placeholder="Any additional notes"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isUser}
                  onChange={e => setFormData({ ...formData, isUser: e.target.checked })}
                  className="w-4 h-4 text-sky-600 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">This employee has a user account in the system</span>
              </label>
              {formData.isUser && (
                <select
                  value={formData.userId || ''}
                  onChange={e => setFormData({ ...formData, userId: e.target.value })}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">Select user account...</option>
                  {users?.map(u => (
                    <option key={u.id} value={u.id}>{u.username || u.email} ({u.role})</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={() => isEdit ? setShowEditModal(false) : setShowCreateModal(false)}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={isEdit ? handleUpdateEmployee : handleCreateEmployee}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg"
          >
            <Save className="w-4 h-4" />
            {isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 dark:bg-[#0f172a] min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-8 h-8 text-sky-600 dark:text-sky-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Employees</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Manage employees and track attendance</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
          message.type === "success" 
            ? "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
            : "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
        }`}>
          {message.type === "success" ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section Cards */}
      {renderSectionCards()}

      {/* Attendance Mini Dashboard (always visible when there are employees) */}
      {employees.length > 0 && renderAttendanceDashboard()}

      {/* Active Section Content */}
      {activeSection === 'management' && renderManagementSection()}
      {activeSection === 'attendance' && renderAttendanceSection()}

      {/* Modals */}
      {showCreateModal && renderEmployeeModal(false)}
      {showEditModal && renderEmployeeModal(true)}
    </div>
  );
}
