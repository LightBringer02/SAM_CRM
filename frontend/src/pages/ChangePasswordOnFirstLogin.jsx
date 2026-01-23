import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { validatePassword } from "../utils/passwordValidator";
import { Eye, EyeOff, AlertCircle, CheckCircle, User, Mail, Phone } from "lucide-react";

export default function ChangePasswordOnFirstLogin() {
  const { currentUser, user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redirect if user already has updated password (for new users)
  // OR if password was reset by admin but user already changed it
  if (!user?.isNewUser && !user?.passwordResetByAdmin) {
    navigate("/dashboard");
    return null;
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Real-time password validation
    if (name === "newPassword") {
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

    // Mandatory fields
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.newPassword) {
      newErrors.newPassword = "New password is required";
    }

    if (passwordErrors.length > 0) {
      newErrors.newPassword = "Password does not meet requirements";
    }

    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else {
      // Extract only digits from the phone number
      const digitsOnly = formData.phone.replace(/\D/g, "");
      
      // Check if it has at least 10 digits (for 10-digit format or international with country code)
      if (digitsOnly.length < 10) {
        newErrors.phone = "Phone number must have at least 10 digits";
      } else if (!/^[\d\-\+\(\)\s]+$/.test(formData.phone)) {
        // Also check for valid characters
        newErrors.phone = "Phone number can only contain digits, spaces, dashes, parentheses, and plus sign";
      }
    }

    // Optional fields validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    // Update user in auth context and localStorage
    updateUser(user.id, { 
      name: formData.name,
      email: formData.email || user?.email,
      phone: formData.phone,
      password: formData.newPassword, 
      isNewUser: false,
      passwordResetByAdmin: false 
    });

    setSuccess(true);

    // Redirect to dashboard after 2 seconds
    setTimeout(() => {
      navigate("/dashboard");
    }, 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-blue-100 dark:from-[#0f172a] dark:to-[#1e293b] transition-colors">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-[#1e1f22] shadow-2xl rounded-2xl p-8 border dark:border-gray-700">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-sky-600 dark:text-sky-400 mb-2">
              Secure Your Account
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Please change your temporary password to complete setup
            </p>
          </div>

          {success ? (
            <>
              {/* Success Message */}
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-green-800 dark:text-green-300 font-semibold text-sm">
                    Password Changed Successfully!
                  </p>
                  <p className="text-green-700 dark:text-green-400 text-xs mt-1">
                    Redirecting to dashboard...
                  </p>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
              </div>
            </>
          ) : (
            <>
              {/* Error Messages */}
              {Object.keys(errors).length > 0 && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg space-y-2">
                  {Object.values(errors).map((error, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                {/* Name Field (Mandatory) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition ${
                        errors.name ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                      }`}
                      placeholder="Enter your full name"
                    />
                  </div>
                  {errors.name && (
                    <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.name}</p>
                  )}
                </div>

                {/* Email Field (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email Address <span className="text-gray-500 text-xs">(optional)</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition ${
                        errors.email ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                      }`}
                      placeholder="your@email.com"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.email}</p>
                  )}
                </div>

                {/* Phone Field (Mandatory) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition ${
                        errors.phone ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                      }`}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.phone}</p>
                  )}
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      name="newPassword"
                      value={formData.newPassword}
                      onChange={handleInputChange}
                      maxLength="16"
                      className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition ${
                        errors.newPassword ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                      }`}
                      placeholder="Enter new password (max 16 characters)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-gray-500 dark:text-gray-400"
                    >
                      {showNewPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                  {formData.newPassword && passwordErrors.length === 0 && (
                    <p className="text-green-600 dark:text-green-400 text-xs mt-1">Password is strong</p>
                  )}
                  {passwordErrors.length > 0 && (
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs space-y-1">
                      {passwordErrors.map((err, i) => (
                        <p key={i} className="text-red-600 dark:text-red-400">• {err}</p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      maxLength="16"
                      className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition ${
                        errors.confirmPassword ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                      }`}
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-gray-500 dark:text-gray-400"
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.confirmPassword}</p>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || passwordErrors.length > 0 || !formData.name || !formData.newPassword || !formData.confirmPassword || !formData.phone}
                  className="w-full py-2 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                >
                  {loading ? "Setting up..." : "Complete Setup"}
                </button>
              </form>

              {/* Info Box */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-blue-800 dark:text-blue-300 text-xs">
                  <strong>Note:</strong> Fields marked with <span className="text-red-500">*</span> are mandatory. Complete your profile information to get started.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
