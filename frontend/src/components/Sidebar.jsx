import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Boxes,
  Receipt,
  Building2,
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
} from "lucide-react";
// import { useTheme } from "../theme.jsx";
import { useAuth } from "../auth.jsx";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { name: "Vouchers", icon: Receipt, path: "/vouchers" },
  { name: "Orders", icon: ShoppingCart, path: "/orders" },
  { name: "Vendors", icon: Building2, path: "/vendors" },
  { name: "Inventory", icon: Boxes, path: "/inventory" },
  { name: "Employees", icon: BriefcaseBusiness, path: "/employees" },
  { name: "Reports", icon: LineChart, path: "/reports" },
  { name: "Users", icon: Users, path: "/users", adminOnly: true },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  // const { dark, setDark } = useTheme();
  const { user, logout } = useAuth();
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="w-64 border-r border-blue-200 flex flex-col bg-white text-blue-900 transition-all">

      {/* HEADER */}
      <div className="h-14 flex items-center px-6 border-b border-blue-200 text-xl font-bold text-blue-700">
        CRM
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 mt-3">
        {navItems.map(({ name, icon: Icon, path, adminOnly }) => {
          // Hide admin-only items from non-admin users
          if (adminOnly && user?.role !== "admin") {
            return null;
          }
          
          const active = location.pathname === path;
          return (
            <Link
              key={name}
              to={path}
              className={`flex items-center gap-3 px-6 py-3 text-sm rounded-r-full mr-2 transition-colors
                ${
                  active
                    ? "bg-sky-100 text-blue-700"
                    : "hover:bg-blue-50 text-blue-900"
                }`}
            >
              <Icon className="w-5 h-5" />
              {name}
            </Link>
          );
        })}
      </nav>

      {/* BOTTOM PROFILE MENU */}
      <div ref={menuRef} className="relative border-t border-blue-200 px-4 py-3">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-full flex items-center justify-between px-4 py-2 hover:bg-blue-50 rounded-lg transition-all"
        >
          <div className="flex items-center gap-3">
            <UserCircle className="w-6 h-6 text-blue-700" />
            <div>
              <p className="font-medium">{user?.username || "User"}</p>
              <p className="text-sm text-blue-400">@{user?.email?.split("@")[0] || "user"}</p>
            </div>
          </div>
        </button>

        {menuOpen && (
          <div className="absolute bottom-16 left-4 w-56 bg-white shadow-xl rounded-xl border border-blue-200 p-2 animate-fade-in">

            {/* Light mode only: dark mode toggle removed */}

            {/* SETTINGS */}
            <Link
              to="/settings"
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-blue-50"
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </Link>

            {/* LOGOUT */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-blue-50 text-red-600 hover:text-red-700"
            >
              <LogOut className="w-5 h-5" />
              <span>Log out</span>
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
