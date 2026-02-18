import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { useTheme } from "../theme.jsx";
import { validatePassword } from "../utils/passwordValidator.js";
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, User, Mail, Phone, Edit2, Camera, X, Upload, Palette, Image, Sun, Moon } from "lucide-react";

// Theme presets with preview colors
const THEME_PRESETS = [
  { id: 'default', colorKey: 'midnight', name: 'Default Blue', primary: '#3b82f6', background: '#ffffff', surface: '#f8fafc', text: '#1e293b', accent: '#6366f1' },
  { id: 'dark', colorKey: 'midnight', name: 'Dark Mode', primary: '#6366f1', background: '#1e1f22', surface: '#2a2b2f', text: '#ffffff', accent: '#8b5cf6' },
  { id: 'ocean', colorKey: 'ocean', name: 'Ocean', primary: '#0ea5e9', background: '#f0f9ff', surface: '#e0f2fe', text: '#0c4a6e', accent: '#06b6d4' },
  { id: 'forest', colorKey: 'forest', name: 'Forest', primary: '#22c55e', background: '#f0fdf4', surface: '#dcfce7', text: '#14532d', accent: '#10b981' },
  { id: 'sunset', colorKey: 'sunset', name: 'Sunset', primary: '#f97316', background: '#fff7ed', surface: '#fed7aa', text: '#7c2d12', accent: '#ef4444' },
  { id: 'lavender', colorKey: 'cosmic', name: 'Lavender', primary: '#a855f7', background: '#faf5ff', surface: '#f3e8ff', text: '#581c87', accent: '#c084fc' },
  { id: 'rose', colorKey: 'nebula', name: 'Rose', primary: '#ec4899', background: '#fdf2f8', surface: '#fce7f3', text: '#831843', accent: '#f43f5e' },
  { id: 'slate', colorKey: 'arctic', name: 'Slate', primary: '#64748b', background: '#f8fafc', surface: '#f1f5f9', text: '#1e293b', accent: '#475569' },
];

// Background images for themes - each image gets color overlay from selected theme except custom
const THEME_IMAGES = [
  { id: 'none', name: 'No Image', url: null, useColorOverlay: false },
  { id: 'gradient1', name: 'Blue Gradient', url: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', useColorOverlay: false },
  { id: 'gradient2', name: 'Sunset Gradient', url: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', useColorOverlay: false },
  { id: 'gradient3', name: 'Ocean Gradient', url: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', useColorOverlay: false },
  { id: 'gradient4', name: 'Forest Gradient', url: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', useColorOverlay: false },
  { id: 'abstract1', name: 'Abstract Wave', url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1920&q=80', useColorOverlay: true },
  { id: 'nature1', name: 'Mountains', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80', useColorOverlay: true },
  { id: 'minimal1', name: 'Minimal Pattern', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80', useColorOverlay: true },
];

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const { currentTheme, setColorTheme, dark, setDark } = useTheme();
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [detailsFormData, setDetailsFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [errors, setErrors] = useState({});
  const [detailsErrors, setDetailsErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [detailsSuccessMessage, setDetailsSuccessMessage] = useState("");
  const [editingDetails, setEditingDetails] = useState(false);
  
  // Theme popup state
  const [showThemePopup, setShowThemePopup] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('crm_selected_theme');
      return saved || 'default';
    } catch { return 'default'; }
  });
  const [selectedImage, setSelectedImage] = useState(() => {
    try {
      const saved = localStorage.getItem('crm_theme_image');
      return saved || 'nature1'; // Default to mountain theme
    } catch { return 'nature1'; }
  });
  const [customImageUrl, setCustomImageUrl] = useState(() => {
    try {
      const saved = localStorage.getItem('crm_custom_image');
      return saved || '';
    } catch { return ''; }
  });
  
  // Profile Image State
  const [profileImage, setProfileImage] = useState(() => {
    const saved = localStorage.getItem(`profile_image_${user?.id}`);
    return saved || null;
  });
  const [imageLoading, setImageLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Handle profile image upload
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size must be less than 2MB');
      return;
    }

    setImageLoading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result;
      setProfileImage(base64);
      localStorage.setItem(`profile_image_${user?.id}`, base64);
      setImageLoading(false);
    };
    reader.onerror = () => {
      alert('Failed to read image file');
      setImageLoading(false);
    };
    reader.readAsDataURL(file);
  };

  // Remove profile image
  const handleRemoveImage = () => {
    setProfileImage(null);
    localStorage.removeItem(`profile_image_${user?.id}`);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Get initials for avatar
  const getInitials = () => {
    const name = user?.name || user?.username || "U";
    return name.charAt(0).toUpperCase();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Real-time password validation for new password
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

    // Clear success message on any change
    if (successMessage) {
      setSuccessMessage("");
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = "Current password is required";
    }

    if (!formData.newPassword) {
      newErrors.newPassword = "New password is required";
    }

    if (passwordErrors.length > 0) {
      newErrors.newPassword = "New password does not meet requirements";
    }

    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (formData.currentPassword === formData.newPassword) {
      newErrors.newPassword =
        "New password must be different from current password";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateDetailsForm = () => {
    const newErrors = {};

    if (!detailsFormData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!detailsFormData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(detailsFormData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (detailsFormData.phone && detailsFormData.phone.trim()) {
      // Extract only digits from the phone number
      const digitsOnly = detailsFormData.phone.replace(/\D/g, "");
      
      // Check if it has at least 10 digits (for 10-digit format or international with country code)
      if (digitsOnly.length < 10) {
        newErrors.phone = "Phone number must have at least 10 digits";
      } else if (!/^[\d\-\+\(\)\s]+$/.test(detailsFormData.phone)) {
        // Also check for valid characters
        newErrors.phone = "Phone number can only contain digits, spaces, dashes, parentheses, and plus sign";
      }
    }

    setDetailsErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage("");

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    // Get users from localStorage
    const users = JSON.parse(localStorage.getItem("users") || "[]");

    // Find current user
    const currentUserData = users.find((u) => u.email === user?.email);

    if (!currentUserData) {
      setErrors({ submit: "User not found" });
      setLoading(false);
      return;
    }

    // Verify current password
    if (currentUserData.password !== formData.currentPassword) {
      setErrors({ currentPassword: "Current password is incorrect" });
      setLoading(false);
      return;
    }

    // Update password
    const updatedUsers = users.map((u) =>
      u.email === user?.email
        ? { ...u, password: formData.newPassword }
        : u
    );

    localStorage.setItem("users", JSON.stringify(updatedUsers));

    // Clear form
    setFormData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setErrors({});
    setPasswordErrors([]);
    setSuccessMessage("Password changed successfully!");

    // Clear success message after 3 seconds
    setTimeout(() => {
      setSuccessMessage("");
    }, 3000);

    setLoading(false);
  };

  const handleDetailsInputChange = (e) => {
    const { name, value } = e.target;
    setDetailsFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error for this field
    if (detailsErrors[name]) {
      setDetailsErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }

    // Clear success message on any change
    if (detailsSuccessMessage) {
      setDetailsSuccessMessage("");
    }
  };

  const handleUpdateDetails = (e) => {
    e.preventDefault();
    setDetailsLoading(true);
    setDetailsSuccessMessage("");

    if (!validateDetailsForm()) {
      setDetailsLoading(false);
      return;
    }

    // Update user in auth context
    updateUser(user?.id, {
      name: detailsFormData.name,
      email: detailsFormData.email,
      phone: detailsFormData.phone,
    });

    setDetailsSuccessMessage("Profile updated successfully!");
    setEditingDetails(false);

    // Clear success message after 3 seconds
    setTimeout(() => {
      setDetailsSuccessMessage("");
    }, 3000);

    setDetailsLoading(false);
  };

  // Lock body scroll when popup is open
  useEffect(() => {
    if (showThemePopup) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showThemePopup]);

  // useEffect: Only update context color theme when selectedTheme changes (do NOT apply backgrounds - ThemeSettings handles that)
  useEffect(() => {
    const theme = THEME_PRESETS.find(t => t.id === selectedTheme) || THEME_PRESETS[0];
    // Set theme in context (triggers ThemeProvider effect)
    if (theme?.colorKey) setColorTheme(theme.colorKey);
    // DO NOT apply backgrounds here - ThemeSettings.jsx manages document.documentElement backgrounds
  }, [selectedTheme]);

  return (
    <div className="flex justify-center">
      <div className="space-y-6 w-full max-w-2xl">
        {/* Themes Card */}
        <div className="bg-white dark:bg-[#1e1f22] rounded-lg shadow-md border dark:border-gray-700 p-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Palette className="w-6 h-6" />
                Appearance
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Customize your theme and background
              </p>
            </div>
            <button
              onClick={() => navigate('/settings/theme')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-lg transition shadow-lg"
            >
              <Palette className="w-4 h-4" />
              Choose Theme
            </button>
          </div>
          
          {/* Current Theme Preview */}
          <div className="mt-4 flex items-center gap-4">
            <div className="flex gap-2">
              {THEME_PRESETS.find(t => t.id === selectedTheme) && (
                <>
                  <div 
                    className="w-8 h-8 rounded-full border-2 border-white shadow" 
                    style={{ backgroundColor: THEME_PRESETS.find(t => t.id === selectedTheme)?.primary }}
                    title="Primary Color"
                  />
                  <div 
                    className="w-8 h-8 rounded-full border-2 border-white shadow" 
                    style={{ backgroundColor: THEME_PRESETS.find(t => t.id === selectedTheme)?.accent }}
                    title="Accent Color"
                  />
                </>
              )}
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Current: {THEME_PRESETS.find(t => t.id === selectedTheme)?.name || 'Default'}
            </span>
            
            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDark(!dark)}
              className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
            >
              {dark ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-gray-600" />}
              <span className="text-sm">{dark ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>

        {/* User Details Card */}
        <div className="bg-white dark:bg-[#1e1f22] rounded-lg shadow-md border dark:border-gray-700 p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <User className="w-6 h-6" />
                Profile Information
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Update your personal information.
              </p>
            </div>
            {!editingDetails && (
              <button
                onClick={() => setEditingDetails(true)}
                className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-lg transition"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>

          {/* Profile Image Section */}
          <div className="mb-6 flex flex-col items-center">
            <div className="relative group">
              {/* Profile Image or Initials */}
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg">
                {imageLoading ? (
                  <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full"></div>
                ) : profileImage ? (
                  <img 
                    src={profileImage} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-white">{getInitials()}</span>
                )}
              </div>
              
              {/* Camera Overlay */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 w-24 h-24 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
              
              {/* Remove Button */}
              {profileImage && (
                <button
                  onClick={handleRemoveImage}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition"
                  title="Remove photo"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            
            {/* Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition"
            >
              <Upload className="w-4 h-4" />
              {profileImage ? "Change Photo" : "Upload Photo"}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Max 2MB, JPG/PNG</p>
          </div>

          {/* Success Message */}
          {detailsSuccessMessage && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <p className="text-green-700 dark:text-green-300">{detailsSuccessMessage}</p>
            </div>
          )}

          {editingDetails ? (
            <form onSubmit={handleUpdateDetails} className="space-y-5">
              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    name="name"
                    value={detailsFormData.name}
                    onChange={handleDetailsInputChange}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-[#2a2b2f] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition ${
                      detailsErrors.name
                        ? "border-red-500"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                    placeholder="Enter your full name"
                  />
                </div>
                {detailsErrors.name && (
                  <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                    {detailsErrors.name}
                  </p>
                )}
              </div>

              {/* Email Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="email"
                    name="email"
                    value={detailsFormData.email}
                    onChange={handleDetailsInputChange}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-[#2a2b2f] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition ${
                      detailsErrors.email
                        ? "border-red-500"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                    placeholder="Enter your email address"
                  />
                </div>
                {detailsErrors.email && (
                  <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                    {detailsErrors.email}
                  </p>
                )}
              </div>

              {/* Phone Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    name="phone"
                    value={detailsFormData.phone}
                    onChange={handleDetailsInputChange}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-[#2a2b2f] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition ${
                      detailsErrors.phone
                        ? "border-red-500"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                    placeholder="Enter your phone number"
                  />
                </div>
                {detailsErrors.phone && (
                  <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                    {detailsErrors.phone}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                  <button
                  type="submit"
                  disabled={detailsLoading}
                  className="flex-1 py-2 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {detailsLoading ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingDetails(false);
                    setDetailsFormData({
                      name: user?.name || "",
                      email: user?.email || "",
                      phone: user?.phone || "",
                    });
                    setDetailsErrors({});
                  }}
                  className="flex-1 py-2 px-4 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Name Display */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Full Name</p>
                    <p className="text-gray-900 dark:text-white font-semibold">{detailsFormData.name || "Not provided"}</p>
                  </div>
                </div>
              </div>

              {/* Email Display */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Email Address</p>
                    <p className="text-gray-900 dark:text-white font-semibold">{detailsFormData.email || "Not provided"}</p>
                  </div>
                </div>
              </div>

              {/* Phone Display */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone Number</p>
                    <p className="text-gray-900 dark:text-white font-semibold">{detailsFormData.phone || "Not provided"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      {/* Change Password Card */}
      <div className="bg-white dark:bg-[#1e1f22] rounded-lg shadow-md border dark:border-gray-700 p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Lock className="w-6 h-6" />
            Change Password
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Update your password to keep your account secure.
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <p className="text-green-700 dark:text-green-300">{successMessage}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleChangePassword} className="space-y-5">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Current Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type={showCurrentPassword ? "text" : "password"}
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleInputChange}
                className={`w-full pl-10 pr-10 py-2 border rounded-lg bg-white dark:bg-[#2a2b2f] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition ${
                  errors.currentPassword
                    ? "border-red-500"
                    : "border-gray-300 dark:border-gray-600"
                }`}
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
              >
                {showCurrentPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                {errors.currentPassword}
              </p>
            )}
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type={showNewPassword ? "text" : "password"}
                name="newPassword"
                value={formData.newPassword}
                onChange={handleInputChange}
                maxLength="16"
                className={`w-full pl-10 pr-10 py-2 border rounded-lg bg-white dark:bg-[#2a2b2f] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition ${
                  errors.newPassword
                    ? "border-red-500"
                    : "border-gray-300 dark:border-gray-600"
                }`}
                placeholder="Enter new password (max 16 characters)"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
              >
                {showNewPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Password Requirements */}
            {formData.newPassword && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password Requirements:
                </div>
                <div
                  className={`flex items-center gap-2 text-xs ${
                    formData.newPassword.length >= 8
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {formData.newPassword.length >= 8 ? (
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  )}
                  At least 8 characters
                </div>
                <div
                  className={`flex items-center gap-2 text-xs ${
                    /[A-Z]/.test(formData.newPassword)
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {/[A-Z]/.test(formData.newPassword) ? (
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  )}
                  One capital letter (A-Z)
                </div>
                <div
                  className={`flex items-center gap-2 text-xs ${
                    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
                      formData.newPassword
                    )
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
                    formData.newPassword
                  ) ? (
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  )}
                  One special character (!@#$%...)
                </div>
              </div>
            )}

            {errors.newPassword && (
              <p className="text-red-600 text-sm mt-2">
                {errors.newPassword}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-3">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-4 w-6 h-6 text-gray-400" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                maxLength="16"
                className={`w-full pl-14 pr-14 py-3 border rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg transition ${
                  errors.confirmPassword
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-6 h-6" />
                ) : (
                  <Eye className="w-6 h-6" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-red-600 text-sm mt-2">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={
              loading ||
              passwordErrors.length > 0 ||
              !formData.currentPassword ||
              !formData.newPassword ||
              !formData.confirmPassword
            }
            className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-lg shadow transition disabled:opacity-50 disabled:cursor-not-allowed mt-8"
          >
            {loading ? "Changing Password..." : "Change Password"}
          </button>
        </form>
      </div>

      {/* Additional Info */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-8 mt-10">
        <h3 className="font-bold text-blue-900 text-xl mb-4">
          Password Security Tips
        </h3>
        <ul className="text-lg text-blue-800 space-y-2">
          <li>• Use a strong password with at least 8 characters</li>
          <li>• Include uppercase and lowercase letters</li>
          <li>• Add numbers and special characters for better security</li>
          <li>• Avoid using personal information or common words</li>
          <li>• Change your password regularly for maximum security</li>
        </ul>
      </div>
      </div>
    </div>
  );
}
