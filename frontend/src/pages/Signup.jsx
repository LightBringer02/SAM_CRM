import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { validatePassword } from "../utils/passwordValidator.js";
import { Mail, Lock, User, AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";

export default function Signup() {
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    role: "user",
  });
  const [errors, setErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signup, roles } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Real-time password validation
    if (name === "password") {
      const validation = validatePassword(value);
      setPasswordErrors(validation.errors);
    }

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (!formData.username) {
      newErrors.username = "Username is required";
    } else if (formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    }

    if (passwordErrors.length > 0) {
      newErrors.password = "Password does not meet requirements";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.role) {
      newErrors.role = "Role is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    const result = signup(formData.email, formData.username, formData.password, formData.role);

    if (result.success) {
      navigate("/dashboard");
    } else {
      setErrors({ submit: result.error });
    }

    setLoading(false);
  };

  const passwordValidation = validatePassword(formData.password);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-blue-100 dark:from-[#0f172a] dark:to-[#1e293b] transition-colors p-4 py-8">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="bg-white dark:bg-[#1e1f22] shadow-2xl rounded-2xl p-8 border dark:border-gray-700">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-sky-600 dark:text-sky-400 mb-2">
              CRM
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Create your account
            </p>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-red-700 dark:text-red-300 text-sm">{errors.submit}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-[#2a2b2f] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition ${
                    errors.email ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                  }`}
                  placeholder="you@example.com"
                />
              </div>
              {errors.email && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-[#2a2b2f] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition ${
                    errors.username ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                  }`}
                  placeholder="username"
                />
              </div>
              {errors.username && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.username}</p>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-[#2a2b2f] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition ${
                  errors.role ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                }`}
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
              {errors.role && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.role}</p>
              )}
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
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-10 py-2 border rounded-lg bg-white dark:bg-[#2a2b2f] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition ${
                    errors.password ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Password Requirements */}
              {formData.password && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-1">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password Requirements:
                  </div>
                  <div className={`flex items-center gap-2 text-xs ${formData.password.length >= 8 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {formData.password.length >= 8 ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                    At least 8 characters
                  </div>
                  <div className={`flex items-center gap-2 text-xs ${/[A-Z]/.test(formData.password) ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {/[A-Z]/.test(formData.password) ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                    One capital letter (A-Z)
                  </div>
                  <div className={`flex items-center gap-2 text-xs ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password) ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password) ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                    One special character (!@#$%...)
                  </div>
                </div>
              )}

              {errors.password && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`w-full pl-10 pr-10 py-2 border rounded-lg bg-white dark:bg-[#2a2b2f] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition ${
                    errors.confirmPassword ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || passwordErrors.length > 0}
              className="w-full py-2 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? "Creating account..." : "Sign up"}
            </button>
          </form>

          {/* Login Link */}
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mt-6">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-sky-600 dark:text-sky-400 font-semibold hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
