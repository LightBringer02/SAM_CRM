import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth.jsx";
import { useTheme } from "../theme.jsx";
import { AlertCircle, X, Bell } from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import Navbar from "../components/Navbar.jsx";
import RightPane from "../components/RightPane.jsx";
import { useNavigate, useLocation } from "react-router-dom";

// Global Reminder Keys
const REMINDERS_KEY = 'crm_calendar_reminders';
const NOTIFICATIONS_KEY = 'crm_notifications';

// Helper to add notification
function addGlobalNotification(notification) {
  try {
    const notifications = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
    notifications.unshift({
      id: Date.now(),
      type: notification.type || 'info',
      title: notification.title || 'Notification',
      message: notification.message,
      time: new Date().toISOString(),
      read: false
    });
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    window.dispatchEvent(new CustomEvent('notificationAdded'));
  } catch (e) {
    console.error('Failed to add notification:', e);
  }
}

// Export for use in other components
window.addCRMNotification = addGlobalNotification;

// Abstract pattern renderer component
function AbstractPatterns({ pattern, primary, accent, dark }) {
  // Check if a photo background is active - suppress patterns on photo backgrounds
  const isPhotoBackground = () => {
    try {
      const mode = localStorage.getItem('crm_active_theme_mode');
      const unsplashUrl = localStorage.getItem('crm_unsplash_url');
      return mode === 'photo' || !!unsplashUrl;
    } catch { return false; }
  };
  
  // Reduce opacity significantly or hide on photo backgrounds to avoid visual clutter
  const hasPhoto = isPhotoBackground();
  const opacity = hasPhoto ? 0 : (dark ? 0.15 : 0.1);
  
  // Return nothing if no pattern or if photo background is active
  if (!pattern || !primary || hasPhoto) return null;
  
  // Different SVG patterns based on theme type
  const renderPattern = () => {
    switch (pattern?.type) {
      case 'waves':
        return (
          <>
            <svg className="absolute bottom-0 left-0 w-full h-48 opacity-10" viewBox="0 0 1440 320" preserveAspectRatio="none">
              <path fill={primary} d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"/>
            </svg>
            <svg className="absolute top-0 right-0 w-1/2 h-32 opacity-5" viewBox="0 0 500 150" preserveAspectRatio="none">
              <path fill={accent} d="M0.00,49.98 C149.99,150.00 349.20,-49.98 500.00,49.98 L500.00,0.00 L0.00,0.00 Z"/>
            </svg>
          </>
        );
      case 'rays':
        return (
          <>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 opacity-10"
              style={{
                borderLeft: '150px solid transparent',
                borderRight: '150px solid transparent',
                borderBottom: `300px solid ${primary}`
              }}
            />
            <div className="absolute bottom-0 right-1/4 w-1 h-64 opacity-20 origin-bottom rotate-12"
              style={{ background: `linear-gradient(to top, ${accent}, transparent)` }}
            />
            <div className="absolute bottom-0 right-1/3 w-1 h-48 opacity-15 origin-bottom -rotate-6"
              style={{ background: `linear-gradient(to top, ${primary}, transparent)` }}
            />
          </>
        );
      case 'nebula':
      case 'cosmic':
        return (
          <>
            <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-20 blur-3xl animate-pulse"
              style={{ background: `radial-gradient(circle, ${primary}40, transparent 70%)` }}
            />
            <div className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full opacity-15 blur-2xl"
              style={{ background: `radial-gradient(circle, ${accent}30, transparent 70%)` }}
            />
            <svg className="absolute top-1/3 right-1/3 w-8 h-8 opacity-30" viewBox="0 0 24 24" fill={primary}>
              <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9"/>
            </svg>
          </>
        );
      case 'organic':
        return (
          <>
            <svg className="absolute top-1/4 left-1/6 w-24 h-24 opacity-10" viewBox="0 0 100 100">
              <path fill={primary} d="M50 10 C30 30, 20 50, 50 90 C80 50, 70 30, 50 10"/>
            </svg>
            <svg className="absolute bottom-1/4 right-1/6 w-16 h-16 opacity-15 rotate-45" viewBox="0 0 100 100">
              <path fill={accent} d="M50 10 C30 30, 20 50, 50 90 C80 50, 70 30, 50 10"/>
            </svg>
            <div className="absolute top-1/2 left-1/3 w-32 h-32 opacity-5"
              style={{ 
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                backgroundColor: primary
              }}
            />
          </>
        );
      case 'lava':
        return (
          <>
            <div className="absolute bottom-0 left-1/4 w-32 h-48 opacity-20 blur-xl"
              style={{ background: `linear-gradient(to top, ${primary}, ${accent}50, transparent)` }}
            />
            <div className="absolute bottom-0 right-1/3 w-24 h-32 opacity-15 blur-lg"
              style={{ background: `linear-gradient(to top, ${accent}, ${primary}40, transparent)` }}
            />
            <div className="absolute bottom-1/4 left-1/2 w-2 h-2 rounded-full opacity-40 animate-ping"
              style={{ backgroundColor: accent }}
            />
          </>
        );
      case 'crystal':
        return (
          <>
            <div className="absolute top-1/4 right-1/4 w-16 h-16 opacity-10 rotate-45"
              style={{ 
                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                backgroundColor: primary
              }}
            />
            <div className="absolute bottom-1/3 left-1/4 w-12 h-12 opacity-15 rotate-12"
              style={{ 
                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                backgroundColor: accent
              }}
            />
            <svg className="absolute top-1/2 right-1/6 w-8 h-8 opacity-20" viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth="1">
              <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5"/>
            </svg>
          </>
        );
      case 'digital':
        return (
          <>
            <div className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: `linear-gradient(${primary}20 1px, transparent 1px), linear-gradient(90deg, ${primary}20 1px, transparent 1px)`,
                backgroundSize: '40px 40px'
              }}
            />
            <div className="absolute top-1/3 left-0 w-full h-px opacity-20"
              style={{ background: `linear-gradient(90deg, transparent, ${primary}, transparent)` }}
            />
            <div className="absolute top-2/3 left-0 w-full h-px opacity-10"
              style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
            />
          </>
        );
      case 'geometric':
      default:
        return (
          <>
            <div className="absolute top-1/6 right-1/6 w-32 h-32 border border-current rounded-lg rotate-45 opacity-5"
              style={{ borderColor: primary }}
            />
            <div className="absolute bottom-1/3 left-1/6 w-24 h-24 border-2 border-current rounded-full opacity-5"
              style={{ borderColor: accent }}
            />
            <div className="absolute top-2/3 right-1/3 w-16 h-16 border border-current opacity-5"
              style={{ borderColor: primary }}
            />
          </>
        );
    }
  };

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" style={{ opacity }}>
      {renderPattern()}
      {/* Floating dots pattern - common to all themes */}
      <div className="absolute top-1/4 left-1/2 w-2 h-2 rounded-full opacity-20"
        style={{ backgroundColor: primary }}
      />
      <div className="absolute top-3/4 left-1/4 w-3 h-3 rounded-full opacity-15"
        style={{ backgroundColor: accent }}
      />
      <div className="absolute top-1/2 right-1/6 w-2 h-2 rounded-full opacity-20"
        style={{ backgroundColor: primary }}
      />
    </div>
  );
}


export default function MainLayout({ children }) {
  const { currentUser } = useAuth();
  const { currentTheme, dark, abstractPattern, colorTheme } = useTheme();
  const [showProfileAlert, setShowProfileAlert] = useState(false);
  const [reminderPopup, setReminderPopup] = useState(null);
  // Sidebar collapsed state: default true, persist in localStorage per user
  const userKey = currentUser?.username || 'default';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = window.localStorage.getItem(`sidebarCollapsed_${userKey}`);
    return saved === null ? true : saved === 'true';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Global Reminder Checker - runs every 15 seconds to check for due reminders
  useEffect(() => {
    const checkReminders = () => {
      try {
        const reminders = JSON.parse(localStorage.getItem(REMINDERS_KEY) || '[]');
        const now = new Date();
        let hasTriggered = false;
        
        const updated = reminders.map(reminder => {
          if (reminder.triggered) return reminder;
          
          const reminderDateTime = new Date(`${reminder.date}T${reminder.time}`);
          if (reminderDateTime <= now) {
            // Show popup ONLY - do NOT add notification here (user will see popup)
            setReminderPopup({
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
          localStorage.setItem(REMINDERS_KEY, JSON.stringify(updated));
        }
      } catch (e) {
        console.error('Error checking reminders:', e);
      }
    };
    
    checkReminders(); // Check immediately on mount
    const interval = setInterval(checkReminders, 15000); // Check every 15 seconds
    return () => clearInterval(interval);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Global Escape key handler - navigate back on all pages
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape') {
        // Check if any modal is open (look for z-50 modals)
        const hasOpenModal = document.querySelector('.fixed.inset-0.z-50, [class*="fixed"][class*="z-50"]');
        // Only navigate back if no modal is open (modals handle their own escape)
        if (!hasOpenModal) {
          e.preventDefault();
          navigate(-1);
        }
      }
    };
    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [navigate]);

  const toggleMobileMenu = useCallback(() => setMobileMenuOpen(prev => !prev), []);

  useEffect(() => {
    if (currentUser && !currentUser.email) {
      setShowProfileAlert(true);
    }
  }, [currentUser]);

  const handleCompleteProfile = () => {
    navigate("/settings");
  };

  // Save sidebar preference on change
  useEffect(() => {
    window.localStorage.setItem(`sidebarCollapsed_${userKey}`, sidebarCollapsed);
  }, [sidebarCollapsed, userKey]);

  return (
    <>
      {/* Global Reminder Popup */}
      {reminderPopup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 transform animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full animate-bounce">
                <Bell className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Reminder!</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Task Due</p>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
              <p className="text-lg font-medium text-gray-800 dark:text-gray-200">{reminderPopup.task}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Scheduled for {new Date(reminderPopup.date).toLocaleDateString()} at {reminderPopup.time}
              </p>
            </div>
            <button
              onClick={() => setReminderPopup(null)}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <X className="w-5 h-5" />
              Dismiss
            </button>
          </div>
        </div>
      )}
      
      <div 
        className="flex flex-row h-screen w-full transition-colors duration-300 relative"
        style={{ backgroundColor: 'transparent' }}
      >
      {/* Abstract theme background pattern - Dynamic based on selected theme */}
      {/* Hide gradient orbs when photo background is active */}
      {(() => {
        const isPhotoMode = localStorage.getItem('crm_active_theme_mode') === 'photo' || localStorage.getItem('crm_unsplash_url');
        if (isPhotoMode) return null;
        return (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {/* Main gradient orbs */}
            <div 
              className={`absolute top-0 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br ${currentTheme?.gradients?.[0] || 'from-blue-900/30 via-purple-900/20 to-transparent'} rounded-full blur-3xl`}
            ></div>
            <div 
              className={`absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl ${currentTheme?.gradients?.[1] || 'from-cyan-900/25 via-blue-900/15 to-transparent'} rounded-full blur-3xl`}
            ></div>
            <div 
              className={`absolute top-1/3 right-1/4 w-1/3 h-1/3 bg-gradient-to-bl ${currentTheme?.gradients?.[2] || 'from-indigo-900/20 via-violet-900/10 to-transparent'} rounded-full blur-2xl`}
            ></div>
            <div 
              className={`absolute bottom-1/4 left-1/3 w-1/4 h-1/4 bg-gradient-to-tr ${currentTheme?.gradients?.[3] || 'from-sky-900/15 to-transparent'} rounded-full blur-xl`}
            ></div>
          </div>
        );
      })()}
      
      {/* Theme-specific abstract patterns */}
      <AbstractPatterns 
        pattern={abstractPattern} 
        primary={currentTheme?.primary} 
        accent={currentTheme?.accent}
        dark={dark}
      />
      
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden md:block relative z-10">
        <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[200] md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-64 h-full z-10 animate-fade-in">
            <Sidebar collapsed={false} setCollapsed={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0 relative z-10">
        <Navbar onToggleMobileMenu={toggleMobileMenu} mobileMenuOpen={mobileMenuOpen} />
        {showProfileAlert && (
          <div 
            className="border-b-2 px-6 py-3 flex items-center justify-between gap-4"
            style={{ 
              backgroundColor: dark ? 'rgba(234, 179, 8, 0.1)' : '#fefce8',
              borderColor: '#eab308'
            }}
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold" style={{ color: dark ? '#fef08a' : '#854d0e' }}>Complete Your Profile</p>
                <p className="text-xs" style={{ color: dark ? '#fde047' : '#a16207' }}>Please add your email address to complete your profile</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCompleteProfile}
                className="px-4 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded transition"
              >Complete Now</button>
              <button
                onClick={() => setShowProfileAlert(false)}
                className="p-1 rounded transition"
                style={{ backgroundColor: dark ? 'rgba(234, 179, 8, 0.2)' : '#fef9c3' }}
              >
                <X className="w-5 h-5 text-yellow-600" />
              </button>
            </div>
          </div>
        )}
        <main 
          className="p-4 md:p-6 overflow-y-auto flex-1"
          style={{ 
            color: currentTheme?.text || (dark ? '#e2e8f0' : '#1e293b')
          }}
        >
          {children}
        </main>
      </div>
      {/* RightPane - hidden on mobile to avoid content overlap */}
      <div className="hidden md:block">
        <RightPane />
      </div>
    </div>
    </>
  );
}