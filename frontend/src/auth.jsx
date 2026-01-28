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
      const hasRoot = storedUsers.some(u => u.role === "root");
      if (!hasRoot) {
        storedUsers.unshift({
          id: 0,
          username: "Root",
          email: "root@crm.com",
          password: "Root@12345",
          role: "root",
          createdAt: new Date().toLocaleDateString(),
        });
        localStorage.setItem("users", JSON.stringify(storedUsers));
      }
    }
    
    setUsers(storedUsers);

    // Initialize current user from localStorage
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("currentUser");
      }
    }
    setLoading(false);
  }, []);

  const login = (emailOrUsername, password) => {
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const foundUser = users.find(
      (u) => (u.email === emailOrUsername || u.username === emailOrUsername) && u.password === password
    );

    if (foundUser) {
      const userWithoutPassword = { ...foundUser };
      delete userWithoutPassword.password;
      setUser(userWithoutPassword);
      localStorage.setItem("currentUser", JSON.stringify(userWithoutPassword));
      return { success: true, isNewUser: foundUser.isNewUser || false };
    }

    return { success: false, error: "Invalid username/email or password" };
  };

  const signup = (email, username, password, role) => {
    const users = JSON.parse(localStorage.getItem("users") || "[]");

    if (users.find((u) => u.email === email)) {
      return { success: false, error: "Email already exists" };
    }

    const newUser = {
      id: Date.now(),
      email,
      username,
      password,
      role,
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
      'x-user-role': user.role,
      'x-username': user.username || user.email
    };
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
