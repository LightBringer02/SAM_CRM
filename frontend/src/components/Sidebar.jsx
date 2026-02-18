import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard,
  Boxes,
  Receipt,
  BookOpen,
  ShoppingCart,
  Users,
  BriefcaseBusiness,
  NotepadText,
  ListTodo,
  LineChart,
  Settings,
  LogOut,
  UserCircle,
  Moon,
  Sun,
  Shield,
  ListOrdered,
  Database,
  ChevronDown,
  ChevronRight,
  Wallet,
  Landmark,
  CreditCard,
  UserCheck,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  Plug,
} from "lucide-react";
import { useTheme } from "../theme.jsx";
import { useAuth } from "../auth.jsx";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { name: "Vouchers", icon: Receipt, path: "/vouchers" },
  { name: "Orders", icon: ShoppingCart, path: "/orders" },
  { 
    name: "Ledgers", 
    icon: BookOpen, 
    path: "/ledgers",
    subItems: [
      { name: "Sundry Debtors", icon: UserCheck, path: "/ledgers/sundry-debtors" },
      { name: "Sundry Creditors", icon: CreditCard, path: "/ledgers/sundry-creditors" },
      { name: "Cash", icon: Wallet, path: "/ledgers/cash" },
      { name: "Bank", icon: Landmark, path: "/ledgers/bank" },
    ]
  },
  { name: "Inventory", icon: Boxes, path: "/inventory" },
  { name: "Employees", icon: BriefcaseBusiness, path: "/employees" },
  { name: "Communication", icon: MessageSquare, path: "/communication" },
  { name: "Reports", icon: LineChart, path: "/reports" },
];

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [ledgersExpanded, setLedgersExpanded] = useState(false);
  const [ledgersHovered, setLedgersHovered] = useState(false);
  const { currentTheme, dark } = useTheme();
  const { user, logout } = useAuth();
  const menuRef = useRef(null);
  const menuPortalRef = useRef(null);
  const ledgersRef = useRef(null);
  
  // Get profile image from localStorage
  const [profileImage, setProfileImage] = useState(null);
  
  useEffect(() => {
    const savedImage = localStorage.getItem(`profile_image_${user?.id}`);
    setProfileImage(savedImage);
  }, [user?.id]);

  // Auto-expand ledgers if on a ledger sub-page
  useEffect(() => {
    if (location.pathname.startsWith('/ledgers/')) {
      setLedgersExpanded(true);
    }
  }, [location.pathname]);

  // Close ledgers dropdown when clicking outside (for collapsed state)
  useEffect(() => {
    function handleClickOutside(event) {
      if (collapsed && ledgersRef.current && !ledgersRef.current.contains(event.target)) {
        setLedgersHovered(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [collapsed]);

  useEffect(() => {
    function handleClickOutside(event) {
      // Check if click is outside both the trigger button and the portal menu
      const isOutsideTrigger = menuRef.current && !menuRef.current.contains(event.target);
      const isOutsidePortal = menuPortalRef.current && !menuPortalRef.current.contains(event.target);
      if (isOutsideTrigger && isOutsidePortal) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      // Use setTimeout to avoid catching the click that opened the menu
      const timeoutId = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 10);
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div 
      className={`h-screen flex flex-col transition-all duration-300 overflow-x-hidden backdrop-blur-xl ${collapsed ? 'w-16' : 'w-64'}`} 
      style={{
        minWidth: collapsed ? 64 : 256,
        backgroundColor: dark 
          ? 'rgba(26, 26, 58, 0.65)' 
          : 'rgba(248, 250, 252, 0.65)',
        color: currentTheme?.text || (dark ? '#e2e8f0' : '#1e293b'),
        borderRight: `1px solid ${currentTheme?.border || (dark ? 'rgba(45, 45, 90, 0.5)' : 'rgba(226, 232, 240, 0.5)')}`
      }}
    >
      {/* TOGGLE BUTTON */}
      <button
        className="h-14 flex items-center justify-between gap-2 px-3 focus:outline-none transition-colors"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'}
        style={{
          minHeight: 56,
          borderBottom: `1px solid ${currentTheme?.border || (dark ? '#2d2d5a' : '#e2e8f0')}`
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = currentTheme?.surface || (dark ? '#12122a' : '#ffffff')}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        {!collapsed && <span className="text-xl font-bold" style={{ color: currentTheme?.primary }}>CRM</span>}
        {collapsed ? (
          <PanelLeft className="w-5 h-5 mx-auto" style={{ color: currentTheme?.primary }} />
        ) : (
          <PanelLeftClose className="w-5 h-5" style={{ color: currentTheme?.primary }} />
        )}
      </button>

      {/* NAVIGATION */}
      <nav className="flex-1 mt-0 overflow-y-auto">
        {navItems.map(({ name, icon: Icon, path, adminOnly, subItems }) => {
          if (adminOnly && user?.role !== "admin") return null;
          const active = location.pathname === path || location.pathname.startsWith(path + '/');
          const hasSubItems = subItems && subItems.length > 0;
          
          if (hasSubItems) {
            return (
              <div 
                key={name} 
                className="relative"
                ref={ledgersRef}
                onMouseEnter={() => collapsed && setLedgersHovered(true)}
                onMouseLeave={() => collapsed && setLedgersHovered(false)}
              >
                {collapsed ? (
                  // When collapsed, show icon-only with hover dropdown
                  <div className="relative">
                    <button
                      onClick={() => {
                        // Navigate to main ledgers page and toggle dropdown
                        navigate(path);
                        setLedgersHovered(!ledgersHovered);
                      }}
                      className={`w-full flex items-center justify-center px-2 sm:px-3 py-3 text-sm transition-colors
                        ${active ? 'bg-sky-100 dark:bg-sky-900/30 text-blue-700 dark:text-sky-400' : 'hover:bg-blue-50 dark:hover:bg-gray-800 text-blue-900 dark:text-gray-100'}`}
                      title={name}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                    {/* Dropdown panel - appears inside sidebar area on hover/click */}
                    {ledgersHovered && (
                      <div className="absolute left-full top-0 ml-1 w-48 bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-blue-200 dark:border-gray-700 py-2 z-50">
                        {/* Header */}
                        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{name}</span>
                        </div>
                        {subItems.map(sub => {
                          const subActive = location.pathname === sub.path;
                          const SubIcon = sub.icon;
                          return (
                            <Link
                              key={sub.name}
                              to={sub.path}
                              onClick={() => setLedgersHovered(false)}
                              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg mx-1 my-0.5 transition-colors
                                ${subActive ? 'bg-sky-100 dark:bg-sky-900/30 text-blue-700 dark:text-sky-400' : 'hover:bg-blue-50 dark:hover:bg-gray-700 text-blue-900 dark:text-gray-100'}`}
                            >
                              <SubIcon className="w-4 h-4" />
                              {sub.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  // When expanded, show link with separate chevron button
                  <div className="flex items-center">
                    <Link
                      to={path}
                      className={`flex-1 flex items-center gap-3 px-2 sm:px-3 py-3 text-sm rounded-r-full mr-0 transition-colors
                        ${active ? 'bg-sky-100 dark:bg-sky-900/30 text-blue-700 dark:text-sky-400' : 'hover:bg-blue-50 dark:hover:bg-gray-800 text-blue-900 dark:text-gray-100'}`}
                    >
                      <Icon className="w-5 h-5" />
                      {name}
                    </Link>
                    <button
                      onClick={() => setLedgersExpanded(!ledgersExpanded)}
                      className="p-2 mr-2 hover:bg-blue-50 dark:hover:bg-gray-800 rounded transition-colors"
                    >
                      {ledgersExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>
                )}
                {/* Sub-items - show inline when expanded */}
                {!collapsed && ledgersExpanded && (
                  <div className="ml-4 border-l border-blue-100 dark:border-gray-700">
                    {subItems.map(sub => {
                      const subActive = location.pathname === sub.path;
                      const SubIcon = sub.icon;
                      return (
                        <Link
                          key={sub.name}
                          to={sub.path}
                          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-r-full mr-2 transition-colors
                            ${subActive ? 'bg-sky-100 dark:bg-sky-900/30 text-blue-700 dark:text-sky-400' : 'hover:bg-blue-50 dark:hover:bg-gray-800 text-blue-900 dark:text-gray-100'}`}
                        >
                          <SubIcon className="w-4 h-4" />
                          {sub.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          
          return (
            <Link
              key={name}
              to={path}
              className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-2 sm:px-3 py-3 text-sm rounded-r-full mr-2 transition-colors
                ${active ? 'bg-sky-100 dark:bg-sky-900/30 text-blue-700 dark:text-sky-400' : 'hover:bg-blue-50 dark:hover:bg-gray-800 text-blue-900 dark:text-gray-100'}`}
              title={collapsed ? name : undefined}
            >
              <Icon className="w-5 h-5" />
              {!collapsed && name}
            </Link>
          );
        })}
      </nav>

      {/* BOTTOM PROFILE MENU */}
      <div ref={menuRef} className={`relative border-t border-blue-200 dark:border-gray-700 ${collapsed ? 'px-1 py-2' : 'px-4 py-3'}`}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(true);
          }}
          className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-2 sm:px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-800 rounded-lg transition-all`}
          tabIndex={0}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                (user?.username || user?.name || "U").charAt(0).toUpperCase()
              )}
            </div>
            {!collapsed && (
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{user?.username || "User"}</p>
                <p className="text-sm text-blue-400 dark:text-blue-500">@{user?.email?.split("@")[0] || "user"}</p>
              </div>
            )}
          </div>
        </button>

        {menuOpen && createPortal(
          <>
            <div
              ref={menuPortalRef}
              className="fixed z-[100000] w-64 max-w-[90vw] bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-blue-200 dark:border-gray-700 p-2 animate-fade-in"
              style={{
                left: collapsed ? 72 : 80,
                bottom: 24,
                pointerEvents: 'auto',
              }}
            >
              <Link
                to="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </Link>
              {/* ROOT-only link for System Configuration */}
              {user?.role === "root" && (
                <Link
                  to="/system-config"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                >
                  <Shield className="w-5 h-5" />
                  <span>System Config</span>
                </Link>
              )}
              {/* ROOT-only link for API Configuration */}
              {user?.role === "root" && (
                <Link
                  to="/api-config"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                >
                  <Plug className="w-5 h-5" />
                  <span>API Configuration</span>
                </Link>
              )}
              {/* ROOT and ADMIN link for Queue Management */}
              {(user?.role === "root" || user?.role === "admin") && (
                <Link
                  to="/queue"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                >
                  <ListOrdered className="w-5 h-5" />
                  <span>Queue Management</span>
                </Link>
              )}
              {/* ROOT and ADMIN link for Backup Management */}
              {(user?.role === "root" || user?.role === "admin") && (
                <Link
                  to="/backup"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                >
                  <Database className="w-5 h-5" />
                  <span>Backup Management</span>
                </Link>
              )}
              {/* Admin-only links for Roles and Users */}
              {(user?.role === "admin" || user?.role === "root") && (
                <>
                  <Link
                    to="/roles"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <Users className="w-5 h-5 text-blue-700 dark:text-blue-400" />
                    <span>Manage Roles</span>
                  </Link>
                  <Link
                    to="/users"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <Users className="w-5 h-5 text-green-700 dark:text-green-400" />
                    <span>Manage Users</span>
                  </Link>
                </>
              )}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setTimeout(() => handleLogout(), 0);
                }}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                <LogOut className="w-5 h-5" />
                <span>Log out</span>
              </button>
            </div>
          </>,
          document.body
        )}
      </div>
    </div>
  );
}
