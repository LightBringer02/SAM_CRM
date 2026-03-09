import { useState, useEffect } from "react";
import { useAuth } from "../auth.jsx";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ToggleLeft,
  ToggleRight,
  Zap,
  FileText,
  Truck,
  Receipt,
  MessageSquare,
  Mail,
  BarChart3,
  Shield,
  Bell,
} from "lucide-react";

const FEATURES_KEY = "crm_feature_flags";

// Default feature definitions
const FEATURE_LIST = [
  {
    id: "e_invoice",
    name: "E-Invoice Generation",
    description: "Generate e-invoices (IRN) for sales vouchers via GST portal",
    icon: FileText,
    category: "Billing",
    default: false,
  },
  {
    id: "e_way_bill",
    name: "E-Way Bill Generation",
    description: "Generate e-way bills for goods transport above ₹50,000",
    icon: Truck,
    category: "Billing",
    default: false,
  },
  {
    id: "convert_to_sales",
    name: "Convert Order to Sales",
    description: "Allow converting orders directly to Tally sales vouchers",
    icon: Receipt,
    category: "Orders",
    default: true,
  },
  {
    id: "whatsapp_messaging",
    name: "WhatsApp Messaging",
    description: "Send invoices and updates via WhatsApp Business API",
    icon: MessageSquare,
    category: "Communication",
    default: false,
  },
  {
    id: "email_notifications",
    name: "Email Notifications",
    description: "Send email notifications and invoice copies via SMTP",
    icon: Mail,
    category: "Communication",
    default: false,
  },
  {
    id: "advanced_reports",
    name: "Advanced Reports",
    description: "Generate detailed analytics reports from Tally data",
    icon: BarChart3,
    category: "Reports",
    default: true,
  },
  {
    id: "order_edit_lock",
    name: "Order Edit Lock",
    description: "Require admin approval for editing confirmed orders",
    icon: Shield,
    category: "Orders",
    default: true,
  },
  {
    id: "reminder_notifications",
    name: "Calendar Reminders",
    description: "Show popup reminders for scheduled calendar tasks",
    icon: Bell,
    category: "General",
    default: true,
  },
];

// Export helper to check feature status from any component
export function isFeatureEnabled(featureId) {
  try {
    const flags = JSON.parse(localStorage.getItem(FEATURES_KEY) || "{}");
    const feature = FEATURE_LIST.find((f) => f.id === featureId);
    if (flags[featureId] !== undefined) return flags[featureId];
    return feature?.default ?? false;
  } catch {
    return false;
  }
}

export default function Features() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect if not root user
  useEffect(() => {
    if (user?.role !== "root") {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const [flags, setFlags] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FEATURES_KEY) || "{}");
      // Initialize missing flags with defaults
      const merged = {};
      FEATURE_LIST.forEach((f) => {
        merged[f.id] = saved[f.id] !== undefined ? saved[f.id] : f.default;
      });
      return merged;
    } catch {
      const defaults = {};
      FEATURE_LIST.forEach((f) => (defaults[f.id] = f.default));
      return defaults;
    }
  });

  const [saved, setSaved] = useState(false);

  const toggleFeature = (id) => {
    const updated = { ...flags, [id]: !flags[id] };
    setFlags(updated);
    localStorage.setItem(FEATURES_KEY, JSON.stringify(updated));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const categories = [...new Set(FEATURE_LIST.map((f) => f.category))];

  if (user?.role !== "root") return null;

  return (
    <div className="p-6 min-h-screen">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <Zap className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="glass-text">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Feature Management
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Toggle features on/off across the application
              </p>
            </div>
          </div>
        </div>

        {/* Saved indicator */}
        {saved && (
          <div className="mb-4 p-3 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-sm font-medium flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Feature settings saved!
          </div>
        )}

        {/* Feature Sections */}
        {categories.map((category) => (
          <div key={category} className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
              {category}
            </h2>
            <div className="space-y-3">
              {FEATURE_LIST.filter((f) => f.category === category).map(
                (feature) => {
                  const Icon = feature.icon;
                  const enabled = flags[feature.id];
                  return (
                    <div
                      key={feature.id}
                      className={`rounded-xl border p-4 flex items-center gap-4 transition-all ${
                        enabled
                          ? "bg-white dark:bg-gray-800 border-green-200 dark:border-green-800"
                          : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 opacity-80"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          enabled
                            ? "bg-green-100 dark:bg-green-900/30"
                            : "bg-gray-200 dark:bg-gray-700"
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 ${
                            enabled
                              ? "text-green-600 dark:text-green-400"
                              : "text-gray-500 dark:text-gray-400"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {feature.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {feature.description}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleFeature(feature.id)}
                        className="flex-shrink-0 transition"
                      >
                        {enabled ? (
                          <ToggleRight className="w-10 h-10 text-green-500" />
                        ) : (
                          <ToggleLeft className="w-10 h-10 text-gray-400" />
                        )}
                      </button>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        ))}

        {/* Info note */}
        <div className="mt-8 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-400">
            <strong>Note:</strong> Disabling a feature will show "Coming Soon"
            to users instead of the actual functionality. Features disabled here
            will be hidden or grayed out across all pages.
          </p>
        </div>
      </div>
    </div>
  );
}
