// Notification Service - Global notification management for CRM
// This service provides consistent notification handling across all pages

const NOTIFICATIONS_KEY = 'crm_notifications';
const REMINDERS_KEY = 'crm_calendar_reminders';
const MAX_NOTIFICATIONS = 100; // Limit stored notifications

// Notification Types
export const NotificationType = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error'
};

// Get all notifications from storage
export function getNotifications() {
  try {
    return JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
  } catch {
    return [];
  }
}

// Save notifications to storage
export function saveNotifications(notifications) {
  // Limit to max notifications
  const limited = notifications.slice(0, MAX_NOTIFICATIONS);
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(limited));
}

// Add a new notification
export function addNotification({ type = 'info', title, message, page = '', data = null }) {
  try {
    const notifications = getNotifications();
    const newNotification = {
      id: Date.now() + Math.random(),
      type,
      title: title || 'Notification',
      message: message || '',
      page,
      data,
      time: new Date().toISOString(),
      read: false
    };
    
    notifications.unshift(newNotification);
    saveNotifications(notifications);
    
    // Dispatch event to update UI
    window.dispatchEvent(new CustomEvent('notificationAdded', { detail: newNotification }));
    
    return newNotification;
  } catch (e) {
    console.error('Failed to add notification:', e);
    return null;
  }
}

// Mark notification as read
export function markNotificationRead(id) {
  const notifications = getNotifications();
  const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
  saveNotifications(updated);
  window.dispatchEvent(new CustomEvent('notificationUpdated'));
}

// Mark all notifications as read
export function markAllNotificationsRead() {
  const notifications = getNotifications();
  const updated = notifications.map(n => ({ ...n, read: true }));
  saveNotifications(updated);
  window.dispatchEvent(new CustomEvent('notificationUpdated'));
}

// Delete notification
export function deleteNotification(id) {
  const notifications = getNotifications();
  const updated = notifications.filter(n => n.id !== id);
  saveNotifications(updated);
  window.dispatchEvent(new CustomEvent('notificationUpdated'));
}

// Clear all notifications
export function clearAllNotifications() {
  saveNotifications([]);
  window.dispatchEvent(new CustomEvent('notificationUpdated'));
}

// Get unread count
export function getUnreadCount() {
  return getNotifications().filter(n => !n.read).length;
}

// ============================================
// PAGE-SPECIFIC NOTIFICATION HELPERS
// ============================================

// Dashboard notifications
export function notifyDashboardUpdate(message) {
  return addNotification({
    type: NotificationType.INFO,
    title: 'Dashboard',
    message,
    page: 'dashboard'
  });
}

// Voucher notifications
export function notifyVoucherCreated(voucherNo) {
  return addNotification({
    type: NotificationType.SUCCESS,
    title: 'Voucher Created',
    message: `Voucher ${voucherNo} has been created successfully`,
    page: 'vouchers'
  });
}

export function notifyVoucherUpdated(voucherNo) {
  return addNotification({
    type: NotificationType.INFO,
    title: 'Voucher Updated',
    message: `Voucher ${voucherNo} has been updated`,
    page: 'vouchers'
  });
}

// Ledger notifications
export function notifyLedgerUpdate(ledgerName, message) {
  return addNotification({
    type: NotificationType.INFO,
    title: 'Ledger Update',
    message: message || `Ledger ${ledgerName} has been updated`,
    page: 'ledgers'
  });
}

export function notifyPaymentDue(partyName, amount) {
  return addNotification({
    type: NotificationType.WARNING,
    title: 'Payment Due',
    message: `Payment of ₹${amount.toLocaleString('en-IN')} is due from ${partyName}`,
    page: 'ledgers'
  });
}

// Inventory notifications
export function notifyLowStock(itemName, quantity) {
  return addNotification({
    type: NotificationType.WARNING,
    title: 'Low Stock Alert',
    message: `${itemName} stock is low (${quantity} remaining)`,
    page: 'inventory'
  });
}

export function notifyStockUpdated(itemName) {
  return addNotification({
    type: NotificationType.SUCCESS,
    title: 'Stock Updated',
    message: `Stock for ${itemName} has been updated`,
    page: 'inventory'
  });
}

// Employee notifications
export function notifyEmployeeAdded(employeeName) {
  return addNotification({
    type: NotificationType.SUCCESS,
    title: 'Employee Added',
    message: `${employeeName} has been added to the system`,
    page: 'employees'
  });
}

export function notifyTargetAchieved(employeeName, percentage) {
  return addNotification({
    type: NotificationType.SUCCESS,
    title: 'Target Achieved',
    message: `${employeeName} has achieved ${percentage}% of their target!`,
    page: 'employees'
  });
}

export function notifyAttendanceMarked(employeeName, status) {
  return addNotification({
    type: NotificationType.INFO,
    title: 'Attendance',
    message: `${employeeName} marked as ${status}`,
    page: 'employees'
  });
}

// Sync notifications
export function notifySyncStarted() {
  return addNotification({
    type: NotificationType.INFO,
    title: 'Sync Started',
    message: 'Data synchronization has started',
    page: 'sync'
  });
}

export function notifySyncCompleted(count) {
  return addNotification({
    type: NotificationType.SUCCESS,
    title: 'Sync Complete',
    message: `Successfully synced ${count} records`,
    page: 'sync'
  });
}

export function notifySyncFailed(error) {
  return addNotification({
    type: NotificationType.ERROR,
    title: 'Sync Failed',
    message: error || 'Data synchronization failed',
    page: 'sync'
  });
}

// Backup notifications
export function notifyBackupCreated(filename) {
  return addNotification({
    type: NotificationType.SUCCESS,
    title: 'Backup Created',
    message: `Backup ${filename} has been created successfully`,
    page: 'backup'
  });
}

export function notifyBackupRestored(filename) {
  return addNotification({
    type: NotificationType.SUCCESS,
    title: 'Backup Restored',
    message: `Backup ${filename} has been restored successfully`,
    page: 'backup'
  });
}

// User management notifications
export function notifyUserCreated(username) {
  return addNotification({
    type: NotificationType.SUCCESS,
    title: 'User Created',
    message: `User ${username} has been created`,
    page: 'users'
  });
}

export function notifyRoleUpdated(username, role) {
  return addNotification({
    type: NotificationType.INFO,
    title: 'Role Updated',
    message: `${username}'s role has been changed to ${role}`,
    page: 'users'
  });
}

// Settings notifications
export function notifySettingsUpdated(section) {
  return addNotification({
    type: NotificationType.SUCCESS,
    title: 'Settings Saved',
    message: `${section} settings have been updated`,
    page: 'settings'
  });
}

// Communication notifications
export function notifyMessageSent(type, recipient) {
  return addNotification({
    type: NotificationType.SUCCESS,
    title: 'Message Sent',
    message: `${type} sent to ${recipient}`,
    page: 'communication'
  });
}

// Queue notifications
export function notifyQueueTaskCompleted(taskName) {
  return addNotification({
    type: NotificationType.SUCCESS,
    title: 'Task Completed',
    message: `Queue task "${taskName}" has been completed`,
    page: 'queue'
  });
}

export function notifyQueueTaskFailed(taskName, error) {
  return addNotification({
    type: NotificationType.ERROR,
    title: 'Task Failed',
    message: `Queue task "${taskName}" failed: ${error}`,
    page: 'queue'
  });
}

// API notifications
export function notifyApiConnectionSuccess() {
  return addNotification({
    type: NotificationType.SUCCESS,
    title: 'API Connected',
    message: 'Successfully connected to Tally',
    page: 'api'
  });
}

export function notifyApiConnectionFailed(error) {
  return addNotification({
    type: NotificationType.ERROR,
    title: 'API Error',
    message: error || 'Failed to connect to Tally',
    page: 'api'
  });
}

// Reports notifications
export function notifyReportGenerated(reportName) {
  return addNotification({
    type: NotificationType.SUCCESS,
    title: 'Report Generated',
    message: `${reportName} report has been generated`,
    page: 'reports'
  });
}

// Calendar/Reminder notifications
export function notifyReminderSet(task, date, time) {
  return addNotification({
    type: NotificationType.INFO,
    title: 'Reminder Set',
    message: `Reminder: ${task} on ${date} at ${time}`,
    page: 'calendar'
  });
}

export function notifyReminderDue(task) {
  return addNotification({
    type: NotificationType.WARNING,
    title: 'Reminder',
    message: task,
    page: 'calendar'
  });
}

// Order notifications
export function notifyOrderCreated(orderNo) {
  return addNotification({
    type: NotificationType.SUCCESS,
    title: 'Order Created',
    message: `Order ${orderNo} has been created`,
    page: 'orders'
  });
}

export function notifyOrderStatusChanged(orderNo, status) {
  return addNotification({
    type: NotificationType.INFO,
    title: 'Order Updated',
    message: `Order ${orderNo} status changed to ${status}`,
    page: 'orders'
  });
}

// Generic error notification
export function notifyError(title, message) {
  return addNotification({
    type: NotificationType.ERROR,
    title: title || 'Error',
    message: message || 'An error occurred',
    page: ''
  });
}

// Generic success notification
export function notifySuccess(title, message) {
  return addNotification({
    type: NotificationType.SUCCESS,
    title: title || 'Success',
    message: message || 'Operation completed successfully',
    page: ''
  });
}

// Export global function for use in non-React contexts
if (typeof window !== 'undefined') {
  window.addCRMNotification = addNotification;
  window.notifySuccess = notifySuccess;
  window.notifyError = notifyError;
}
