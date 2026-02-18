import React, { useState, useEffect } from "react";
import { useAuth } from "../auth";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Calendar, CheckCircle, XCircle, Clock, CalendarDays,
  ChevronLeft, ChevronRight, Save, Users, Download
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

export default function EmployeeAttendance() {
  const { user, isAdminOrHigher } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [message, setMessage] = useState(null);
  const [bulkDate, setBulkDate] = useState(formatDateKey(new Date()));
  const [bulkStatus, setBulkStatus] = useState("present");

  const canManage = isAdminOrHigher();

  useEffect(() => {
    setEmployees(getEmployeesFromStorage());
    setAttendance(getAttendanceFromStorage());
  }, []);

  // Mark attendance for a single employee
  const markAttendance = (empId, date, status) => {
    const dateKey = typeof date === 'string' ? date : formatDateKey(date);
    const newAttendance = {
      ...attendance,
      [empId]: {
        ...(attendance[empId] || {}),
        [dateKey]: {
          status,
          markedBy: user?.id,
          markedAt: new Date().toISOString()
        }
      }
    };
    if (saveAttendanceToStorage(newAttendance)) {
      setAttendance(newAttendance);
    }
  };

  // Bulk mark attendance for all employees
  const markBulkAttendance = () => {
    const newAttendance = { ...attendance };
    employees.forEach(emp => {
      if (!newAttendance[emp.id]) newAttendance[emp.id] = {};
      newAttendance[emp.id][bulkDate] = {
        status: bulkStatus,
        markedBy: user?.id,
        markedAt: new Date().toISOString()
      };
    });
    if (saveAttendanceToStorage(newAttendance)) {
      setAttendance(newAttendance);
      setMessage({ type: "success", text: `Marked ${employees.length} employees as ${ATTENDANCE_STATUS[bulkStatus].label}` });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // Get attendance for a specific employee and date
  const getAttendanceStatus = (empId, date) => {
    const dateKey = typeof date === 'string' ? date : formatDateKey(date);
    return attendance[empId]?.[dateKey]?.status || null;
  };

  // Calculate monthly summary for an employee
  const getMonthlyStats = (empId) => {
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    const stats = { present: 0, absent: 0, half_day: 0, leave: 0, holiday: 0, unmarked: 0 };
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(selectedYear, selectedMonth, day);
      const status = getAttendanceStatus(empId, date);
      if (status && stats[status] !== undefined) {
        stats[status]++;
      } else {
        stats.unmarked++;
      }
    }
    return stats;
  };

  // Navigate months
  const prevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const days = [];
    
    // Empty cells for days before the first day
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    // Actual days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="p-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/employees")}
            className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance Management</h1>
            <p className="text-gray-500 dark:text-gray-400">Track and manage employee attendance</p>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {message.text}
        </div>
      )}

      {/* Month Navigation and Bulk Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Month Navigation */}
          <div className="flex items-center gap-4">
            <button onClick={prevMonth} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-lg font-semibold text-gray-900 dark:text-white min-w-[160px] text-center">
              {getMonthName(selectedMonth)} {selectedYear}
            </span>
            <button onClick={nextMonth} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Bulk Mark Attendance */}
          {canManage && (
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
              />
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
              >
                {Object.entries(ATTENDANCE_STATUS).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              <button
                onClick={markBulkAttendance}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Mark All
              </button>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {Object.entries(ATTENDANCE_STATUS).map(([key, val]) => {
            const Icon = val.icon;
            return (
              <div key={key} className="flex items-center gap-2 text-sm">
                <Icon className={`w-4 h-4 text-${val.color}-500`} />
                <span className="text-gray-600 dark:text-gray-400">{val.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {employees.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No employees found. Add employees in Employee Management first.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 sticky left-0 bg-gray-50 dark:bg-gray-700 z-10">
                    Employee
                  </th>
                  {calendarDays.map((day, idx) => (
                    <th key={idx} className="px-2 py-3 text-center text-xs font-medium text-gray-600 dark:text-gray-400 min-w-[40px]">
                      {day !== null && (
                        <div>
                          <div className="text-gray-400">{weekDays[idx % 7]}</div>
                          <div>{day}</div>
                        </div>
                      )}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Summary
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {employees.map((emp) => {
                  const stats = getMonthlyStats(emp.id);
                  return (
                    <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800 z-10">
                        <div>
                          <div className="font-semibold">{emp.name}</div>
                          <div className="text-xs text-gray-500">{emp.designation || "Staff"}</div>
                        </div>
                      </td>
                      {calendarDays.map((day, idx) => {
                        if (day === null) return <td key={idx} className="px-2 py-3"></td>;
                        
                        const date = new Date(selectedYear, selectedMonth, day);
                        const status = getAttendanceStatus(emp.id, date);
                        const statusInfo = status ? ATTENDANCE_STATUS[status] : null;
                        const Icon = statusInfo?.icon;
                        
                        return (
                          <td key={idx} className="px-1 py-2 text-center">
                            {canManage ? (
                              <select
                                value={status || ""}
                                onChange={(e) => markAttendance(emp.id, date, e.target.value)}
                                className={`w-8 h-8 text-xs rounded cursor-pointer border-0 ${
                                  status === "present" ? "bg-green-100 text-green-700" :
                                  status === "absent" ? "bg-red-100 text-red-700" :
                                  status === "half_day" ? "bg-yellow-100 text-yellow-700" :
                                  status === "leave" ? "bg-blue-100 text-blue-700" :
                                  status === "holiday" ? "bg-purple-100 text-purple-700" :
                                  "bg-gray-100 text-gray-500"
                                }`}
                                title={statusInfo?.label || "Not marked"}
                              >
                                <option value="">-</option>
                                <option value="present">P</option>
                                <option value="absent">A</option>
                                <option value="half_day">H</option>
                                <option value="leave">L</option>
                                <option value="holiday">🎉</option>
                              </select>
                            ) : (
                              <div className={`w-8 h-8 mx-auto rounded flex items-center justify-center text-xs ${
                                status === "present" ? "bg-green-100 text-green-700" :
                                status === "absent" ? "bg-red-100 text-red-700" :
                                status === "half_day" ? "bg-yellow-100 text-yellow-700" :
                                status === "leave" ? "bg-blue-100 text-blue-700" :
                                status === "holiday" ? "bg-purple-100 text-purple-700" :
                                "bg-gray-100 text-gray-400"
                              }`}>
                                {status === "present" ? "P" : status === "absent" ? "A" : status === "half_day" ? "H" : status === "leave" ? "L" : status === "holiday" ? "🎉" : "-"}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3">
                        <div className="flex gap-1 text-xs justify-center">
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">{stats.present}P</span>
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded">{stats.absent}A</span>
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">{stats.half_day}H</span>
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">{stats.leave}L</span>
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
