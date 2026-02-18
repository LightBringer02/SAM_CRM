import React, { useState, useEffect, useRef } from "react";
import { Bell, X, Check, Trash2, AlertCircle, Info, CheckCircle, XCircle } from "lucide-react";

// LocalStorage key for notifications
const NOTIFICATIONS_KEY = 'crm_notifications';

function getNotifications() {
  try {
    return JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
  } catch { return []; }
}

function saveNotifications(notifications) {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

// Demo notifications for first use
const DEMO_NOTIFICATIONS = [
  { id: 1, type: 'info', title: 'Welcome to CRM', message: 'Your CRM system is ready to use!', time: new Date().toISOString(), read: false },
  { id: 2, type: 'success', title: 'Sync Complete', message: 'Data has been synced successfully.', time: new Date(Date.now() - 3600000).toISOString(), read: false },
];

export default function NotificationPane() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(() => {
    const saved = getNotifications();
    return saved.length > 0 ? saved : DEMO_NOTIFICATIONS;
  });
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  // Close on outside click - use click with delay to avoid race condition
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      setTimeout(() => {
        if (
          panelRef.current && !panelRef.current.contains(e.target) &&
          buttonRef.current && !buttonRef.current.contains(e.target)
        ) {
          setOpen(false);
        }
      }, 0);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [open]);

  // Save notifications to localStorage
  useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        title="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Panel - opens to the left for right pane placement */}
      {open && (
        <div
          ref={panelRef}
          className="fixed w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in"
          style={{ 
            minWidth: 320,
            top: '60px',
            right: '70px',
            zIndex: 99999
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              <span className="font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">{unreadCount} new</span>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/20 transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Actions */}
          {notifications.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800">
              <button onClick={markAllRead} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Mark all as read</button>
              <button onClick={clearAll} className="text-xs text-red-500 hover:underline">Clear all</button>
            </div>
          )}

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Bell className="w-10 h-10 mb-2 opacity-30" />
                <span className="text-sm">No notifications</span>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer ${!n.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  onClick={() => markAsRead(n.id)}
                >
                  {getIcon(n.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`font-medium text-sm ${!n.read ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>{n.title}</span>
                      <span className="text-xs text-gray-400">{formatTime(n.time)}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{n.message}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 text-center">
            Notifications are stored locally
          </div>
        </div>
      )}
    </div>
  );
}
