import { useState, useEffect } from "react";
import { useAuth } from "../auth.jsx";
import { useNavigate } from "react-router-dom";
import { 
  MessageSquare, 
  Send, 
  Settings as SettingsIcon, 
  Save, 
  CheckCircle, 
  AlertCircle,
  ArrowLeft,
  Shield,
  FileText,
  Truck
} from "lucide-react";

// WhatsApp Icon SVG
const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function ApiConfiguration() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect if not root user
  useEffect(() => {
    if (user?.role !== 'root') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Communication API Configuration State
  const [apiConfig, setApiConfig] = useState(() => {
    const saved = localStorage.getItem('communication_api_config');
    return saved ? JSON.parse(saved) : {
      whatsapp: {
        enabled: false,
        apiKey: '',
        phoneNumberId: '',
        businessAccountId: ''
      },
      email: {
        enabled: false,
        smtpHost: '',
        smtpPort: '587',
        smtpUser: '',
        smtpPassword: '',
        fromEmail: '',
        fromName: ''
      },
      ewayEinvoice: {
        enabled: false,
        apiEndpoint: '',
        username: '',
        password: '',
        gstin: '',
        clientId: '',
        clientSecret: '',
        ewayEnabled: true,
        einvoiceEnabled: true
      }
    };
  });
  const [apiConfigLoading, setApiConfigLoading] = useState(false);
  const [apiConfigSuccess, setApiConfigSuccess] = useState('');

  // App Settings State (stored separately)
  const [appSettings, setAppSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_app_settings') || '{}');
    } catch { return {}; }
  });

  // Save API config to localStorage
  const handleSaveApiConfig = () => {
    setApiConfigLoading(true);
    try {
      localStorage.setItem('communication_api_config', JSON.stringify(apiConfig));
      // Save app settings too
      localStorage.setItem('crm_app_settings', JSON.stringify(appSettings));
      setApiConfigSuccess('Configuration saved successfully!');
      setTimeout(() => setApiConfigSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to save config:', err);
    }
    setApiConfigLoading(false);
  };

  // Don't render if not root
  if (user?.role !== 'root') {
    return null;
  }

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
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
              <SettingsIcon className="w-6 h-6 text-purple-700 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">API Configuration</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <Shield className="w-4 h-4" /> Root access only
              </p>
            </div>
          </div>
        </div>

        {/* Communication API Configuration Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Communication API Configuration
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Configure WhatsApp and Email APIs for communication features.
            </p>
          </div>

          {/* Success Message */}
          {apiConfigSuccess && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <p className="text-green-700 dark:text-green-300">{apiConfigSuccess}</p>
            </div>
          )}

          {/* WhatsApp Configuration */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <WhatsAppIcon className="w-5 h-5 text-green-500" />
                WhatsApp Business API
              </h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={apiConfig.whatsapp.enabled}
                  onChange={(e) => setApiConfig(prev => ({
                    ...prev,
                    whatsapp: { ...prev.whatsapp, enabled: e.target.checked }
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
              </label>
            </div>
            
            {apiConfig.whatsapp.enabled && (
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key / Access Token</label>
                  <input
                    type="password"
                    value={apiConfig.whatsapp.apiKey}
                    onChange={(e) => setApiConfig(prev => ({
                      ...prev,
                      whatsapp: { ...prev.whatsapp, apiKey: e.target.value }
                    }))}
                    className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                    placeholder="Enter WhatsApp API access token"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number ID</label>
                  <input
                    type="text"
                    value={apiConfig.whatsapp.phoneNumberId}
                    onChange={(e) => setApiConfig(prev => ({
                      ...prev,
                      whatsapp: { ...prev.whatsapp, phoneNumberId: e.target.value }
                    }))}
                    className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                    placeholder="Enter Phone Number ID from Meta Developer Console"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Account ID</label>
                  <input
                    type="text"
                    value={apiConfig.whatsapp.businessAccountId}
                    onChange={(e) => setApiConfig(prev => ({
                      ...prev,
                      whatsapp: { ...prev.whatsapp, businessAccountId: e.target.value }
                    }))}
                    className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                    placeholder="Enter WhatsApp Business Account ID"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Get these from the <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">Meta Developer Console</a>
                </p>
              </div>
            )}
          </div>

          {/* Email SMTP Configuration */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-500" />
                Email SMTP Configuration
              </h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={apiConfig.email.enabled}
                  onChange={(e) => setApiConfig(prev => ({
                    ...prev,
                    email: { ...prev.email, enabled: e.target.checked }
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-500"></div>
              </label>
            </div>
            
            {apiConfig.email.enabled && (
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SMTP Host</label>
                    <input
                      type="text"
                      value={apiConfig.email.smtpHost}
                      onChange={(e) => setApiConfig(prev => ({
                        ...prev,
                        email: { ...prev.email, smtpHost: e.target.value }
                      }))}
                      className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SMTP Port</label>
                    <input
                      type="text"
                      value={apiConfig.email.smtpPort}
                      onChange={(e) => setApiConfig(prev => ({
                        ...prev,
                        email: { ...prev.email, smtpPort: e.target.value }
                      }))}
                      className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      placeholder="587"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SMTP Username</label>
                  <input
                    type="text"
                    value={apiConfig.email.smtpUser}
                    onChange={(e) => setApiConfig(prev => ({
                      ...prev,
                      email: { ...prev.email, smtpUser: e.target.value }
                    }))}
                    className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="your-email@gmail.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SMTP Password / App Password</label>
                  <input
                    type="password"
                    value={apiConfig.email.smtpPassword}
                    onChange={(e) => setApiConfig(prev => ({
                      ...prev,
                      email: { ...prev.email, smtpPassword: e.target.value }
                    }))}
                    className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter app password"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From Email</label>
                    <input
                      type="email"
                      value={apiConfig.email.fromEmail}
                      onChange={(e) => setApiConfig(prev => ({
                        ...prev,
                        email: { ...prev.email, fromEmail: e.target.value }
                      }))}
                      className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      placeholder="noreply@yourcompany.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From Name</label>
                    <input
                      type="text"
                      value={apiConfig.email.fromName}
                      onChange={(e) => setApiConfig(prev => ({
                        ...prev,
                        email: { ...prev.email, fromName: e.target.value }
                      }))}
                      className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      placeholder="Your Company Name"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  For Gmail, use an <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">App Password</a> instead of your regular password
                </p>
              </div>
            )}
          </div>

          {/* E-Way Bill & E-Invoice API Configuration */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-orange-500" />
                E-Way Bill & E-Invoice API
              </h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={apiConfig.ewayEinvoice?.enabled || false}
                  onChange={(e) => setApiConfig(prev => ({
                    ...prev,
                    ewayEinvoice: { ...prev.ewayEinvoice, enabled: e.target.checked }
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"></div>
              </label>
            </div>
            
            {apiConfig.ewayEinvoice?.enabled && (
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                {/* Feature Toggles */}
                <div className="flex gap-6 pb-4 border-b border-gray-200 dark:border-gray-600">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={apiConfig.ewayEinvoice?.ewayEnabled ?? true}
                      onChange={(e) => setApiConfig(prev => ({
                        ...prev,
                        ewayEinvoice: { ...prev.ewayEinvoice, ewayEnabled: e.target.checked }
                      }))}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">E-Way Bill</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={apiConfig.ewayEinvoice?.einvoiceEnabled ?? true}
                      onChange={(e) => setApiConfig(prev => ({
                        ...prev,
                        ewayEinvoice: { ...prev.ewayEinvoice, einvoiceEnabled: e.target.checked }
                      }))}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">E-Invoice</span>
                  </label>
                </div>

                {/* E-Way Bill Threshold Amount */}
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    E-Way Bill Threshold Amount (₹)
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">₹</span>
                      <input
                        type="number"
                        value={appSettings.ewayBillThreshold || 50000}
                        onChange={(e) => setAppSettings(prev => ({
                          ...prev,
                          ewayBillThreshold: Number(e.target.value) || 50000
                        }))}
                        className="w-full pl-8 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                        placeholder="50000"
                        min="0"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                    E-Way Bill button will only appear for sales vouchers with amount exceeding this threshold. Default: ₹50,000 (as per GST rules).
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Endpoint URL</label>
                  <input
                    type="text"
                    value={apiConfig.ewayEinvoice?.apiEndpoint || ''}
                    onChange={(e) => setApiConfig(prev => ({
                      ...prev,
                      ewayEinvoice: { ...prev.ewayEinvoice, apiEndpoint: e.target.value }
                    }))}
                    className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                    placeholder="https://api.gst.gov.in or third-party provider URL"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                    <input
                      type="text"
                      value={apiConfig.ewayEinvoice?.username || ''}
                      onChange={(e) => setApiConfig(prev => ({
                        ...prev,
                        ewayEinvoice: { ...prev.ewayEinvoice, username: e.target.value }
                      }))}
                      className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                      placeholder="API Username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                    <input
                      type="password"
                      value={apiConfig.ewayEinvoice?.password || ''}
                      onChange={(e) => setApiConfig(prev => ({
                        ...prev,
                        ewayEinvoice: { ...prev.ewayEinvoice, password: e.target.value }
                      }))}
                      className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                      placeholder="API Password"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={apiConfig.ewayEinvoice?.gstin || ''}
                    onChange={(e) => setApiConfig(prev => ({
                      ...prev,
                      ewayEinvoice: { ...prev.ewayEinvoice, gstin: e.target.value.toUpperCase() }
                    }))}
                    className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 uppercase"
                    placeholder="15-digit GSTIN"
                    maxLength={15}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client ID</label>
                    <input
                      type="text"
                      value={apiConfig.ewayEinvoice?.clientId || ''}
                      onChange={(e) => setApiConfig(prev => ({
                        ...prev,
                        ewayEinvoice: { ...prev.ewayEinvoice, clientId: e.target.value }
                      }))}
                      className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                      placeholder="OAuth Client ID"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client Secret</label>
                    <input
                      type="password"
                      value={apiConfig.ewayEinvoice?.clientSecret || ''}
                      onChange={(e) => setApiConfig(prev => ({
                        ...prev,
                        ewayEinvoice: { ...prev.ewayEinvoice, clientSecret: e.target.value }
                      }))}
                      className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                      placeholder="OAuth Client Secret"
                    />
                  </div>
                </div>
                
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <p className="text-xs text-orange-700 dark:text-orange-300 flex items-start gap-2">
                    <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      You can use official GST/NIC APIs or third-party providers like ClearTax, Tally, or Zoho Invoice for E-Way Bill and E-Invoice generation. 
                      Contact your GSP (GST Suvidha Provider) for API credentials.
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveApiConfig}
            disabled={apiConfigLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {apiConfigLoading ? "Saving..." : "Save API Configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}
