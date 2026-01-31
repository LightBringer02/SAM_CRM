import React, { useState, useEffect } from "react";
import { useAuth } from "../auth";
import { useNavigate } from "react-router-dom";
import {
  Users, Calendar, ClipboardList, TrendingUp, Target, Award,
  IndianRupee, CheckCircle, XCircle, Clock, ArrowUpRight,
  BarChart3, PieChart
} from "lucide-react";

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

// Get performance data from localStorage
function getPerformanceFromStorage() {
  try {
    const stored = localStorage.getItem("crm_employee_performance");
    if (stored) return JSON.parse(stored);
  } catch (err) {
    console.error("Failed to load performance:", err);
  }
  return {};
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

export default function Employees() {
  const { user, isAdminOrHigher } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [performance, setPerformance] = useState({});
  
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    setEmployees(getEmployeesFromStorage());
    setAttendance(getAttendanceFromStorage());
    setPerformance(getPerformanceFromStorage());
  }, []);

  // Calculate today's attendance stats
  const getTodayStats = () => {
    const today = formatDateKey(new Date());
    let present = 0, absent = 0, leave = 0, unmarked = 0;
    
    employees.forEach(emp => {
      const status = attendance[emp.id]?.[today]?.status;
      if (status === "present") present++;
      else if (status === "absent") absent++;
      else if (status === "leave" || status === "half_day") leave++;
      else unmarked++;
    });
    
    return { present, absent, leave, unmarked, total: employees.length };
  };

  // Calculate monthly attendance rate
  const getMonthlyAttendanceRate = () => {
    if (employees.length === 0) return 0;
    
    let totalDays = 0;
    let presentDays = 0;
    
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const today = new Date().getDate();
    
    employees.forEach(emp => {
      for (let day = 1; day <= Math.min(today, daysInMonth); day++) {
        const date = new Date(currentYear, currentMonth, day);
        if (date.getDay() !== 0) { // Skip Sundays
          totalDays++;
          const status = attendance[emp.id]?.[formatDateKey(date)]?.status;
          if (status === "present") presentDays++;
          else if (status === "half_day") presentDays += 0.5;
        }
      }
    });
    
    return totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
  };

  // Calculate total monthly target
  const getTotalMonthlyTarget = () => {
    return employees.reduce((sum, emp) => sum + (emp.monthlyTarget || 0), 0);
  };

  // Calculate average incentive rate
  const getAverageIncentiveRate = () => {
    const withIncentive = employees.filter(emp => emp.incentiveRate > 0);
    if (withIncentive.length === 0) return 0;
    return withIncentive.reduce((sum, emp) => sum + emp.incentiveRate, 0) / withIncentive.length;
  };

  // Get department breakdown
  const getDepartmentBreakdown = () => {
    const breakdown = {};
    employees.forEach(emp => {
      const dept = emp.department || "Unassigned";
      breakdown[dept] = (breakdown[dept] || 0) + 1;
    });
    return Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  };

  // Get top performers (placeholder - would need actual sales data)
  const getTopPerformers = () => {
    // Sort by monthly target as a proxy for performance
    return [...employees]
      .filter(emp => emp.monthlyTarget > 0)
      .sort((a, b) => (b.monthlyTarget || 0) - (a.monthlyTarget || 0))
      .slice(0, 5);
  };

  const todayStats = getTodayStats();
  const attendanceRate = getMonthlyAttendanceRate();
  const totalTarget = getTotalMonthlyTarget();
  const avgIncentive = getAverageIncentiveRate();
  const deptBreakdown = getDepartmentBreakdown();
  const topPerformers = getTopPerformers();

  // Navigation Cards
  const navCards = [
    {
      title: "Employee Management",
      description: "Add, edit, and manage employee profiles and details",
      icon: Users,
      color: "from-blue-500 to-blue-600",
      path: "/employees/management",
      stats: `${employees.length} Employees`
    },
    {
      title: "Attendance",
      description: "Track and manage daily employee attendance",
      icon: Calendar,
      color: "from-green-500 to-green-600",
      path: "/employees/attendance",
      stats: `${todayStats.present}/${todayStats.total} Present Today`
    }
  ];

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Employee Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your workforce and track performance</p>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {navCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <button
              key={idx}
              onClick={() => navigate(card.path)}
              className="group bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-left hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300"
            >
              <div className="flex items-start justify-between">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">{card.title}</h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{card.description}</p>
              <div className="mt-4 inline-flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm font-medium text-gray-700 dark:text-gray-300">
                {card.stats}
              </div>
            </button>
          );
        })}
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Today's Attendance */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Today's Attendance</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {todayStats.present}/{todayStats.total}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex gap-3 text-xs">
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded">{todayStats.present} Present</span>
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded">{todayStats.absent} Absent</span>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">{todayStats.leave} Leave</span>
          </div>
        </div>

        {/* Monthly Attendance Rate */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Monthly Attendance</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{attendanceRate}%</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all" 
                style={{ width: `${attendanceRate}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{getMonthName(currentMonth)} {currentYear}</p>
          </div>
        </div>

        {/* Total Monthly Target */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Team Target</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                ₹{(totalTarget / 100000).toFixed(1)}L
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            Combined monthly sales target for all employees
          </p>
        </div>

        {/* Avg Incentive Rate */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Incentive Rate</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{avgIncentive.toFixed(1)}%</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Award className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            Average incentive percentage on sales above target
          </p>
        </div>
      </div>

      {/* Department Breakdown & Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-blue-600" />
            Department Breakdown
          </h3>
          {deptBreakdown.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No employee data</p>
          ) : (
            <div className="space-y-3">
              {deptBreakdown.map(([dept, count], idx) => {
                const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-yellow-500", "bg-pink-500", "bg-indigo-500"];
                const percentage = Math.round((count / employees.length) * 100);
                return (
                  <div key={dept}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300">{dept}</span>
                      <span className="text-gray-500">{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`${colors[idx % colors.length]} h-2 rounded-full transition-all`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Performers */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Top Performers by Target
          </h3>
          {topPerformers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No performance data</p>
          ) : (
            <div className="space-y-3">
              {topPerformers.map((emp, idx) => (
                <div key={emp.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                    idx === 0 ? "bg-yellow-500" : idx === 1 ? "bg-gray-400" : idx === 2 ? "bg-amber-600" : "bg-blue-500"
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{emp.name}</p>
                    <p className="text-xs text-gray-500">{emp.department || "Unassigned"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      ₹{(emp.monthlyTarget / 1000).toFixed(0)}K
                    </p>
                    <p className="text-xs text-green-600">{emp.incentiveRate || 0}% incentive</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
