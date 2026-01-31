import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

const PREDEFINED_ROLES = ["root", "admin", "user", "manager", "staff"];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize users from localStorage
    let storedUsers = JSON.parse(localStorage.getItem("users") || "[]");
    
    // Create demo admin user and root user if no users exist
    if (storedUsers.length === 0) {
      storedUsers = [
        {
          id: 0,
          username: "Root",
          email: "root@crm.com",
          password: "Root@12345",
          role: "root",
          createdAt: new Date().toLocaleDateString(),
        },
        {
          id: 1,
          username: "Admin",
          email: "admin@crm.com",
          password: "Admin@123",
          role: "admin",
          createdAt: new Date().toLocaleDateString(),
        },
      ];
      localStorage.setItem("users", JSON.stringify(storedUsers));
    } else {
      // Ensure root user exists in existing installations
      const hasRoot = storedUsers.some(u => u.role?.toLowerCase() === "root");
      if (!hasRoot) {
        storedUsers.unshift({
          id: 0,
          username: "Root",
          email: "root@crm.com",
          password: "Root@12345",
          role: "root",
          createdAt: new Date().toLocaleDateString(),
        });
      }
      
      // Normalize all roles and emails to lowercase for consistency
      let needsUpdate = false;
      storedUsers = storedUsers.map(u => {
        const normalizedRole = u.role?.toLowerCase();
        const normalizedEmail = u.email?.toLowerCase();
        if (u.role !== normalizedRole || u.email !== normalizedEmail) {
          needsUpdate = true;
          return { ...u, role: normalizedRole, email: normalizedEmail };
        }
        return u;
      });
      
      if (needsUpdate || !hasRoot) {
        localStorage.setItem("users", JSON.stringify(storedUsers));
      }
    }
    
    setUsers(storedUsers);

    // Initialize current user from localStorage
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        // Normalize role to lowercase for consistency
        if (parsedUser.role) {
          parsedUser.role = parsedUser.role.toLowerCase();
        }
        setUser(parsedUser);
        localStorage.setItem("currentUser", JSON.stringify(parsedUser));
      } catch {
        localStorage.removeItem("currentUser");
      }
    }
    setLoading(false);
  }, []);

  // Track user activity - update every minute while logged in
  useEffect(() => {
    if (!user) return;
    
    // Update activity immediately
    localStorage.setItem(`user_activity_${user.id}`, Date.now().toString());
    
    // Update activity every minute
    const interval = setInterval(() => {
      localStorage.setItem(`user_activity_${user.id}`, Date.now().toString());
    }, 60000);
    
    // Update on page visibility change
    const handleVisibility = () => {
      if (!document.hidden && user) {
        localStorage.setItem(`user_activity_${user.id}`, Date.now().toString());
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user]);

  const login = (emailOrUsername, password) => {
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const normalizedInput = emailOrUsername.toLowerCase().trim();
    const foundUser = users.find(
      (u) => (u.email?.toLowerCase() === normalizedInput || u.username?.toLowerCase() === normalizedInput) && u.password === password
    );

    if (foundUser) {
      const userWithoutPassword = { ...foundUser };
      delete userWithoutPassword.password;
      setUser(userWithoutPassword);
      localStorage.setItem("currentUser", JSON.stringify(userWithoutPassword));
      // Update user activity on login
      localStorage.setItem(`user_activity_${foundUser.id}`, Date.now().toString());
      return { success: true, isNewUser: foundUser.isNewUser || false };
    }

    return { success: false, error: "Invalid username/email or password" };
  };

  const signup = (email, username, password, role) => {
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const normalizedEmail = email.toLowerCase().trim();

    if (users.find((u) => u.email?.toLowerCase() === normalizedEmail)) {
      return { success: false, error: "Email already exists" };
    }

    const newUser = {
      id: Date.now(),
      email: email.toLowerCase().trim(),
      username,
      password,
      role: role.toLowerCase(),
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    localStorage.setItem("users", JSON.stringify(users));

    // Auto login after signup
    const userWithoutPassword = { ...newUser };
    delete userWithoutPassword.password;
    setUser(userWithoutPassword);
    localStorage.setItem("currentUser", JSON.stringify(userWithoutPassword));

    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("currentUser");
  };

  const updateUser = (userId, updatedData) => {
    const updatedUsers = users.map((u) =>
      u.id === userId ? { ...u, ...updatedData } : u
    );
    setUsers(updatedUsers);
    localStorage.setItem("users", JSON.stringify(updatedUsers));
    
    // Update current user if it's the logged-in user
    if (user?.id === userId) {
      const updatedUser = { ...user, ...updatedData };
      setUser(updatedUser);
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
    }
  };

  const deleteUser = (userId) => {
    const updatedUsers = users.filter((u) => u.id !== userId);
    setUsers(updatedUsers);
    localStorage.setItem("users", JSON.stringify(updatedUsers));
  };

  // Helper to check if user is root
  const isRoot = () => {
    return user?.role?.toLowerCase() === 'root';
  };

  // Helper to check if user is admin or higher (admin or root)
  const isAdminOrHigher = () => {
    const role = user?.role?.toLowerCase();
    return role === 'admin' || role === 'root';
  };

  // Helper to get headers for API calls with user info
  const getAuthHeaders = () => {
    if (!user) return {};
    return {
      'x-user-id': String(user.id),
      'x-user-role': user.role?.toLowerCase() || 'user',
      'x-username': user.username || user.email
    };
  };

  // Helper to check if user has a specific permission
  const hasPermission = (permissionId) => {
    if (!user) return false;
    const userRole = user.role?.toLowerCase();
    
    // Root has all permissions
    if (userRole === 'root') return true;
    
    // Get roles from localStorage
    try {
      const storedRoles = localStorage.getItem("system_roles");
      if (storedRoles) {
        const roles = JSON.parse(storedRoles);
        const roleConfig = roles.find(r => r.id === userRole);
        if (roleConfig && roleConfig.permissions) {
          return roleConfig.permissions.includes(permissionId);
        }
      }
    } catch (err) {
      console.error("Error checking permission:", err);
    }
    
    // Default permissions by role
    const defaultPerms = {
      admin: ['view_dashboard', 'view_vouchers', 'edit_vouchers', 'delete_vouchers', 'export_vouchers', 
              'view_inventory', 'manage_inventory', 'view_ledgers', 'manage_ledgers', 
              'view_reports', 'export_reports', 'view_employees', 'manage_employees',
              'view_users', 'manage_users', 'view_settings', 'manage_settings', 'view_logs'],
      manager: ['view_dashboard', 'view_vouchers', 'edit_vouchers', 'view_inventory', 
                'view_ledgers', 'view_reports', 'export_reports', 'view_employees'],
      staff: ['view_dashboard', 'view_vouchers', 'view_inventory', 'view_ledgers'],
      user: ['view_dashboard']
    };
    
    return defaultPerms[userRole]?.includes(permissionId) || false;
  };

  const value = {
    user,
    currentUser: user,
    users,
    loading,
    login,
    signup,
    logout,
    updateUser,
    deleteUser,
    roles: PREDEFINED_ROLES,
    isRoot,
    isAdminOrHigher,
    getAuthHeaders,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
