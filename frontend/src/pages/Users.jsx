import { useState, useEffect } from "react";
import { useAuth } from "../auth";
import { Eye, EyeOff, Plus, Trash2, Copy, Settings, RotateCcw } from "lucide-react";

export default function Users() {
  const { users, currentUser, deleteUser } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTempPasswordSettings, setShowTempPasswordSettings] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [username, setUsername] = useState("");
  const [tempPassword, setTempPassword] = useState("TempPassword@123");
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [createdUserInfo, setCreatedUserInfo] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const TEMP_PASSWORD_TEMPLATE = "TempPassword@123";

  // Load temp password from localStorage on mount
  useEffect(() => {
    const savedTempPassword = localStorage.getItem("adminTempPassword");
    if (savedTempPassword) {
      setTempPassword(savedTempPassword);
    }
  }, []);

  // Access control
  if (currentUser?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Only admins can access this page
          </p>
        </div>
      </div>
    );
  }

  const handleAddUser = () => {
    if (!username.trim()) {
      alert("Please enter a username");
      return;
    }

    // Check if username already exists
    if (users.some((u) => u.username === username)) {
      alert("Username already exists");
      return;
    }

    const newUser = {
      id: Date.now(),
      username: username.trim(),
      email: "",
      password: tempPassword,
      role: "user",
      createdAt: new Date().toLocaleDateString(),
      isNewUser: true,
    };

    const existingUsers = JSON.parse(localStorage.getItem("users") || "[]");
    const updatedUsers = [...existingUsers, newUser];
    localStorage.setItem("users", JSON.stringify(updatedUsers));

    setCreatedUserInfo({
      username: username.trim(),
      password: tempPassword,
    });
    setUsername("");
    setShowAddModal(false);
  };

  const handleResetPassword = () => {
    setTempPassword(TEMP_PASSWORD_TEMPLATE);
    localStorage.setItem("adminTempPassword", TEMP_PASSWORD_TEMPLATE);
    setShowTempPasswordSettings(false);
  };

  const handleSetCustomTempPassword = (newPassword) => {
    setTempPassword(newPassword);
    localStorage.setItem("adminTempPassword", newPassword);
  };

  const handleResetUserPassword = (userId) => {
    const user = users.find((u) => u.id === userId);
    
    if (!user) {
      alert("User not found");
      return;
    }

    if (user.role === "admin") {
      alert("Cannot reset admin password");
      return;
    }

    if (window.confirm(`Reset password for ${user.username} to temporary password?\n\nThey will be asked to change it on next login.`)) {
      const existingUsers = JSON.parse(localStorage.getItem("users") || "[]");
      const updatedUsers = existingUsers.map((u) =>
        u.id === userId
          ? { ...u, password: tempPassword, passwordResetByAdmin: true }
          : u
      );
      localStorage.setItem("users", JSON.stringify(updatedUsers));
      alert(`Password reset to temporary password for ${user.username}`);
    }
  };

  const handleDeleteUser = (userId) => {
    if (userId === currentUser.id) {
      alert("You cannot delete your own account");
      return;
    }
    if (window.confirm("Are you sure you want to delete this user?")) {
      deleteUser(userId);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="w-full p-6 bg-white text-gray-900 transition-colors duration-300">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          User Management
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTempPasswordSettings(true)}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition"
            title="Configure temporary password for new users"
          >
            <Settings size={20} />
            Temp Password
          </button>
          <button
            onClick={() => {
              setShowAddModal(true);
              setCreatedUserInfo(null);
              setUsername("");
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
          >
            <Plus size={20} />
            Create User
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
        <table className="w-full border-separate border-spacing-0 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b border-gray-200">
                S.No
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b border-gray-200">
                Username
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b border-gray-200">
                Name
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b border-gray-200">
                Email
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b border-gray-200">
                Role
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b border-gray-200">
                Status
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b border-gray-200">
                Date Created
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 border-b border-gray-200">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => (
              <tr
                key={user.id}
                className={
                  `border-b border-gray-200 transition ` +
                  (index % 2 === 0 ? 'bg-white' : 'bg-gray-50')
                }
              >
                <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200">
                  {index + 1}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 font-medium border-b border-gray-200">
                  {user.username}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200">
                  {user.name || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200">
                  {user.email || "-"}
                </td>
                <td className="px-4 py-3 text-sm border-b border-gray-200">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      user.role === "admin"
                        ? "bg-red-100 text-red-800"
                        : user.role === "manager"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm border-b border-gray-200">
                  {user.isNewUser ? (
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                      New User
                    </span>
                  ) : (
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200">
                  {user.createdAt}
                </td>
                <td className="px-4 py-3 text-center border-b border-gray-200">
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {user.role !== "admin" && user.id !== currentUser.id && (
                      <button
                        onClick={() => handleResetUserPassword(user.id)}
                        className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs transition"
                        title="Reset Password to Temp"
                      >
                        <RotateCcw size={14} />
                        Reset Pwd
                      </button>
                    )}
                    {user.id !== currentUser.id && (
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs transition"
                        title="Delete User"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No users found. Create one using the button above.
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            {!createdUserInfo ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Create New User
                </h2>
                <p className="text-gray-600 text-sm mb-4">
                  Enter the username. The new user will receive a temporary password to login.
                </p>

                {/* Username */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter username"
                    onKeyPress={(e) =>
                      e.key === "Enter" && handleAddUser()
                    }
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleAddUser}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                  >
                    Create User
                  </button>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setUsername("");
                      setCreatedUserInfo(null);
                    }}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  User Created Successfully! ✓
                </h2>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-green-800 mb-3">
                    Share these credentials with the new user:
                  </p>

                  {/* Username Display */}
                  <div className="mb-3">
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      Username
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 bg-white border rounded text-sm text-gray-900 font-mono">
                        {createdUserInfo.username}
                      </div>
                      <button
                        onClick={() => copyToClipboard(createdUserInfo.username, "username")}
                        className="p-2 bg-green-600 hover:bg-green-700 text-white rounded transition"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    {copiedId === "username" && (
                      <p className="text-xs text-green-600 mt-1">
                        Copied!
                      </p>
                    )}
                  </div>

                  {/* Temporary Password Display */}
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">
                      Temporary Password
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showTempPassword ? "text" : "password"}
                          value={createdUserInfo.password}
                          readOnly
                          className="w-full px-3 py-2 bg-white border rounded text-sm text-gray-900 font-mono focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowTempPassword(!showTempPassword)}
                          className="absolute right-3 top-2.5 text-gray-500"
                        >
                          {showTempPassword ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}
                        </button>
                      </div>
                      <button
                        onClick={() => copyToClipboard(createdUserInfo.password, "password")}
                        className="p-2 bg-green-600 hover:bg-green-700 text-white rounded transition"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    {copiedId === "password" && (
                      <p className="text-xs text-green-600 mt-1">
                        Copied!
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-600 mb-4">
                  The user can login with the temporary password and will be prompted to complete their profile (email, etc.) on first login.
                </p>

                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setUsername("");
                    setCreatedUserInfo(null);
                    setShowTempPassword(false);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Temp Password Settings Modal */}
      {showTempPasswordSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Configure Temporary Password
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              This password will be used for all new users. They can change it after logging in.
            </p>

            {/* Temp Password Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temporary Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={tempPassword}
                  onChange={(e) => handleSetCustomTempPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-500"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleResetPassword}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition"
              >
                Reset to Default
              </button>
              <button
                onClick={() => setShowTempPasswordSettings(false)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}