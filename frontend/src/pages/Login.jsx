import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { Mail, Lock, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!emailOrUsername || !password) {
      setError("Username/Email and password are required");
      setLoading(false);
      return;
    }

    const result = login(emailOrUsername, password);
    if (result.success) {
      // Store keep logged in preference
      if (keepLoggedIn) {
        localStorage.setItem("keepLoggedIn", "true");
      } else {
        localStorage.removeItem("keepLoggedIn");
      }
      
      // Check if user is new and needs to change password
      if (result.isNewUser) {
        navigate("/change-password-first-login");
      } else {
        navigate("/dashboard");
      }
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-blue-100 dark:from-[#0f172a] dark:to-[#1e293b] transition-colors">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-[#1e1f22] shadow-2xl rounded-2xl p-8 border dark:border-gray-700">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-sky-600 dark:text-sky-400 mb-2">
              CRM
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Sign in to your account
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username or Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username or Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#2a2b2f] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
                  placeholder="username or email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#2a2b2f] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Keep Logged In Checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="keepLoggedIn"
                checked={keepLoggedIn}
                onChange={(e) => setKeepLoggedIn(e.target.checked)}
                className="w-4 h-4 text-sky-600 dark:text-sky-400 rounded focus:ring-2 focus:ring-sky-500 cursor-pointer"
              />
              <label htmlFor="keepLoggedIn" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                Keep me logged in
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
              Demo Credentials:
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Email: <code className="bg-white dark:bg-[#1e1f22] px-2 py-1 rounded">admin@crm.com</code>
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Password: <code className="bg-white dark:bg-[#1e1f22] px-2 py-1 rounded">Admin@123</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
