import React, { useState, useEffect } from "react";
import { Calendar, Clock, Trash2, Bell, Plus } from "lucide-react";

// LocalStorage keys
const REMINDERS_KEY = 'crm_calendar_reminders';
const NOTIFICATIONS_KEY = 'crm_notifications';

// Helper functions
function getReminders() {
  try {
    return JSON.parse(localStorage.getItem(REMINDERS_KEY) || '[]');
  } catch { return []; }
}

function saveReminders(reminders) {
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
}

function addNotification(notification) {
  try {
    const notifications = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
    notifications.unshift({
      id: Date.now(),
      type: 'warning',
      title: 'Reminder',
      message: notification.message,
      time: new Date().toISOString(),
      read: false
    });
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    // Dispatch event to notify NotificationPane
    window.dispatchEvent(new CustomEvent('notificationAdded'));
  } catch (e) {
    console.error('Failed to add notification:', e);
  }
}

export default function CalendarModal({ open, onClose }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [task, setTask] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [reminders, setReminders] = useState([]);
  const [showPopup, setShowPopup] = useState(null);

  // Load reminders on mount
  useEffect(() => {
    setReminders(getReminders());
  }, [open]);

  // Check for due reminders every 30 seconds
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const saved = getReminders();
      let hasTriggered = false;
      
      const updated = saved.map(reminder => {
        if (reminder.triggered) return reminder;
        
        const reminderDateTime = new Date(`${reminder.date}T${reminder.time}`);
        if (reminderDateTime <= now) {
          // Trigger notification
          addNotification({
            message: `${reminder.task} - ${new Date(reminder.date).toLocaleDateString()}`
          });
          
          // Show popup
          setShowPopup({
            task: reminder.task,
            date: reminder.date,
            time: reminder.time
          });
          
          hasTriggered = true;
          return { ...reminder, triggered: true };
        }
        return reminder;
      });
      
      if (hasTriggered) {
        saveReminders(updated);
        setReminders(updated);
      }
    };

    checkReminders(); // Check immediately
    const interval = setInterval(checkReminders, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleSave = () => {
    if (!task.trim()) {
      alert('Please enter a task description');
      return;
    }
    
    const newReminder = {
      id: Date.now(),
      task: task.trim(),
      date: selectedDate.toISOString().slice(0, 10),
      time: reminderTime || '09:00',
      triggered: false,
      createdAt: new Date().toISOString()
    };
    
    const updated = [...reminders, newReminder];
    saveReminders(updated);
    setReminders(updated);
    
    // Add notification about new reminder
    addNotification({
      message: `Reminder set: ${task.trim()} on ${selectedDate.toLocaleDateString()} at ${reminderTime || '09:00'}`
    });
    
    setTask("");
    setReminderTime("");
    alert(`Reminder saved! You will be notified on ${selectedDate.toLocaleDateString()} at ${reminderTime || '09:00'}`);
  };

  const handleDelete = (id) => {
    const updated = reminders.filter(r => r.id !== id);
    saveReminders(updated);
    setReminders(updated);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString(undefined, { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Get reminders for selected date
  const selectedDateStr = selectedDate.toISOString().slice(0, 10);
  const remindersForDate = reminders.filter(r => r.date === selectedDateStr);
  const upcomingReminders = reminders
    .filter(r => !r.triggered && new Date(`${r.date}T${r.time}`) > new Date())
    .sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`))
    .slice(0, 5);

  if (!open) return null;

  return (
    <>
      {/* Reminder Popup Alert */}
      {showPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 animate-bounce-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                <Bell className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Reminder!</h3>
            </div>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-2">{showPopup.task}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Scheduled for {formatDate(showPopup.date)} at {showPopup.time}
            </p>
            <button
              onClick={() => setShowPopup(null)}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Calendar Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto relative">
          <button 
            onClick={onClose} 
            className="absolute top-3 right-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <span className="text-xl text-gray-500">×</span>
          </button>
          
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Calendar & Reminders</h2>
          </div>

          {/* Date Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Date</label>
            <input
              type="date"
              className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={selectedDate.toISOString().slice(0, 10)}
              onChange={e => setSelectedDate(new Date(e.target.value))}
            />
          </div>

          {/* New Reminder Form */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add New Reminder
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Task Description</label>
                <input
                  type="text"
                  className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                  value={task}
                  onChange={e => setTask(e.target.value)}
                  placeholder="Enter reminder details..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Reminder Time</label>
                <input
                  type="time"
                  className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                  value={reminderTime}
                  onChange={e => setReminderTime(e.target.value)}
                />
              </div>
              <button
                onClick={handleSave}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
              >
                <Bell className="w-4 h-4" /> Set Reminder
              </button>
            </div>
          </div>

          {/* Reminders for Selected Date */}
          {remindersForDate.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Reminders for {formatDate(selectedDateStr)}
              </h3>
              <div className="space-y-2">
                {remindersForDate.map(reminder => (
                  <div 
                    key={reminder.id} 
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      reminder.triggered 
                        ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60' 
                        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {reminder.time}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{reminder.task}</span>
                      {reminder.triggered && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Done</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(reminder.id)}
                      className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Reminders */}
          {upcomingReminders.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Upcoming Reminders
              </h3>
              <div className="space-y-2">
                {upcomingReminders.map(reminder => (
                  <div 
                    key={reminder.id} 
                    className="flex items-center justify-between p-2 rounded border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">{formatDate(reminder.date)}</span>
                      <span className="text-gray-400">{reminder.time}</span>
                      <span className="text-gray-700 dark:text-gray-300">{reminder.task}</span>
                    </div>
                    <button
                      onClick={() => handleDelete(reminder.id)}
                      className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reminders.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-4">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No reminders set yet</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
