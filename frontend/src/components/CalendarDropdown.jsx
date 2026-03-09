import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Bell, Trash2, Clock, Calendar, ChevronLeft, ChevronRight, Edit2, Check, AlertCircle } from "lucide-react";

// LocalStorage key for reminders
const REMINDERS_KEY = 'crm_calendar_reminders';

function getReminders() {
  try {
    return JSON.parse(localStorage.getItem(REMINDERS_KEY) || '[]');
  } catch { return []; }
}

function saveReminders(reminders) {
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
}

const CalendarDropdown = React.memo(function CalendarDropdown({ open, onClose, anchorRef }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  useEffect(() => {
    return () => {};
  }, []);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [reminders, setReminders] = useState(getReminders());
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [newReminder, setNewReminder] = useState({ title: '', time: '', notes: '' });
  const [editingId, setEditingId] = useState(null);
  const dropdownRef = useRef(null);

  // Close on outside click - handled in a single effect below
  // (removed duplicate handler)

  // Notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Reminder notification checker
  // Reminder notification checker (does NOT close the calendar)
  useEffect(() => {
    // This interval only checks reminders and does not affect the calendar open state
    const interval = setInterval(() => {
      const now = new Date();
      reminders.forEach(r => {
        if (r.notified) return;
        const reminderTime = new Date(`${r.date}T${r.time}`);
        if (reminderTime <= now && reminderTime > new Date(now.getTime() - 60000)) {
          // Trigger notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Reminder: ' + r.title, { body: r.notes || 'You have a reminder!' });
          }
          // Mark as notified
          const updated = reminders.map(rem => rem.id === r.id ? { ...rem, notified: true } : rem);
          setReminders(updated);
          saveReminders(updated);
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [reminders]);

  // Calendar helpers
  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const monthYear = currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const days = [];
  const daysCount = daysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const startDay = firstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());

  for (let i = 0; i < startDay; i++) days.push(null);
  for (let i = 1; i <= daysCount; i++) days.push(i);

  const dateKey = (d) => `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const selectedKey = dateKey(selectedDate.getDate());

  const remindersForDate = reminders.filter(r => r.date === dateKey(selectedDate.getDate()) && currentMonth.getMonth() === selectedDate.getMonth() && currentMonth.getFullYear() === selectedDate.getFullYear());

  const handleAddReminder = () => {
    if (!newReminder.title || !newReminder.time) return;
    const reminder = {
      id: Date.now(),
      title: newReminder.title,
      time: newReminder.time,
      notes: newReminder.notes,
      date: dateKey(selectedDate.getDate()),
      notified: false
    };
    const updated = [...reminders, reminder];
    setReminders(updated);
    saveReminders(updated);
    setNewReminder({ title: '', time: '', notes: '' });
    setShowAddReminder(false);
  };

  const handleDeleteReminder = (id) => {
    const updated = reminders.filter(r => r.id !== id);
    setReminders(updated);
    saveReminders(updated);
  };

  // Close on outside click - only close when clicking truly outside
  useEffect(() => {
    if (!open) return;
    
    const handleClickOutside = (e) => {
      // Don't do anything if the dropdown ref isn't set yet
      if (!dropdownRef.current) return;
      
      const isInsideDropdown = dropdownRef.current.contains(e.target);
      const isInsideAnchor = anchorRef?.current && anchorRef.current.contains(e.target);
      
      // Only close if click is truly outside both elements
      if (!isInsideDropdown && !isInsideAnchor) {
        onClose();
      }
    };
    
    // Use a longer delay to ensure the opening click doesn't trigger close
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose, anchorRef]);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  // Render dropdown as a portal to body - responsive for mobile/tablet
  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed inset-x-4 top-16 sm:inset-x-auto sm:top-20 sm:left-1/2 sm:-translate-x-1/2 z-[120000] w-auto sm:w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden max-h-[calc(100vh-5rem)] overflow-y-auto"
      style={{ pointerEvents: 'auto' }}
      onClick={(e) => e.stopPropagation()}
    >
      {process.env.NODE_ENV === 'development' && (
        <div style={{ position: 'absolute', inset: 2, pointerEvents: 'none', border: '2px dashed rgba(255,0,0,0.6)', borderRadius: '12px' }} />
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="font-semibold text-sm sm:text-base">Calendar & Reminders</span>
        </div>
        <button onClick={onClose} className="p-1.5 sm:p-1 rounded hover:bg-white/20 transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-gray-100 dark:border-gray-800">
        <button onClick={prevMonth} className="p-2 sm:p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronLeft className="w-5 h-5" /></button>
        <span className="font-medium text-sm sm:text-base text-gray-800 dark:text-gray-200">{monthYear}</span>
        <button onClick={nextMonth} className="p-2 sm:p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronRight className="w-5 h-5" /></button>
      </div>

      {/* Calendar Grid */}
      <div className="px-2 sm:px-3 py-2">
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-center text-xs text-gray-500 dark:text-gray-400 mb-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const isSelected = d === selectedDate.getDate() && currentMonth.getMonth() === selectedDate.getMonth() && currentMonth.getFullYear() === selectedDate.getFullYear();
            const isToday = d === new Date().getDate() && currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear();
            const hasReminder = reminders.some(r => r.date === dateKey(d));
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d))}
                className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition
                  ${isSelected ? 'bg-blue-500 text-white' : isToday ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200'}
                `}
              >
                {d}
                {hasReminder && <span className="absolute bottom-0.5 sm:bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-purple-500" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reminders for Selected Date */}
      <div className="px-3 sm:px-4 py-2 sm:py-3 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200">
            {selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <button
            onClick={() => setShowAddReminder(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-800 transition"
          >
            <Plus className="w-3 h-3 sm:w-4 sm:h-4" /> Add
          </button>
        </div>

        {remindersForDate.length === 0 && !showAddReminder && (
          <div className="text-xs text-gray-400 text-center py-3 sm:py-4">No reminders for this day</div>
        )}

        {remindersForDate.map(r => (
          <div key={r.id} className="flex items-start gap-2 mb-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
            <Bell className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-xs sm:text-sm text-gray-800 dark:text-gray-100 truncate">{r.title}</div>
              <div className="flex items-center gap-1 sm:gap-2 text-xs text-gray-500 dark:text-gray-400">
                <Clock className="w-3 h-3" /> {r.time}
              </div>
              {r.notes && <div className="text-xs text-gray-400 mt-1 truncate">{r.notes}</div>}
            </div>
            <button onClick={() => handleDeleteReminder(r.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 flex-shrink-0">
              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>
          </div>
        ))}

        {/* Add Reminder Form */}
        {showAddReminder && (
          <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <input
              type="text"
              placeholder="Reminder title..."
              className="w-full mb-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded border border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-xs sm:text-sm"
              value={newReminder.title}
              onChange={e => setNewReminder({ ...newReminder, title: e.target.value })}
            />
            <input
              type="time"
              className="w-full mb-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded border border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-xs sm:text-sm"
              value={newReminder.time}
              onChange={e => setNewReminder({ ...newReminder, time: e.target.value })}
            />
            <textarea
              placeholder="Notes (optional)"
              className="w-full mb-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded border border-gray-200 dark:border-gray-700 dark:bg-gray-800 text-xs sm:text-sm resize-none"
              rows={2}
              value={newReminder.notes}
              onChange={e => setNewReminder({ ...newReminder, notes: e.target.value })}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddReminder}
                className="flex-1 py-1.5 sm:py-2 bg-purple-500 hover:bg-purple-600 text-white text-xs sm:text-sm font-medium rounded transition"
              >
                <Check className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" /> Save
              </button>
              <button
                onClick={() => { setShowAddReminder(false); setNewReminder({ title: '', time: '', notes: '' }); }}
                className="flex-1 py-1.5 sm:py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium rounded transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notification Hint */}
      <div className="px-3 sm:px-4 py-2 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
        <AlertCircle className="w-3 h-3 flex-shrink-0" />
        <span className="text-[10px] sm:text-xs">Reminders notify when browser is open</span>
      </div>
    </div>,
    document.body
  );
});

export default CalendarDropdown;
