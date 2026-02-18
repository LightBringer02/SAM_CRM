import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme.jsx";
import { Palette, Image, Sun, Moon, ArrowLeft, CheckCircle, Loader2 } from "lucide-react";

// Unsplash API Configuration
const UNSPLASH_ACCESS_KEY = "xtB2sYkj6CNRZ_k_KjPFiMJKgmpRBcN_6Y53qoVMn08";

// Helper: ensure Unsplash URLs use high resolution
function ensureHiResUrl(url) {
  if (!url || typeof url !== 'string') return url;
  // If it's an Unsplash URL, upgrade to full HD
  if (url.includes('unsplash.com')) {
    // Remove existing w= and q= params and add HD params
    let hdUrl = url.replace(/[?&]w=\d+/g, '').replace(/[?&]q=\d+/g, '').replace(/[?&]auto=[^&]*/g, '');
    const separator = hdUrl.includes('?') ? '&' : '?';
    hdUrl = `${hdUrl}${separator}w=3840&q=90&auto=format`;
    return hdUrl;
  }
  return url;
}

// Helper: apply background to html element (not body) to ensure it's visible behind all layers
function applyBackgroundToRoot(bgValue, isGradient = false) {
  const root = document.documentElement;
  if (!bgValue || bgValue === 'none') {
    root.style.backgroundImage = 'none';
    root.style.backgroundSize = '';
    root.style.backgroundAttachment = '';
    root.style.backgroundPosition = '';
    root.style.backgroundRepeat = '';
    // Remove photo-bg class
    root.classList.remove('photo-bg');
    return;
  }
  if (isGradient) {
    root.style.background = bgValue;
    root.classList.remove('photo-bg');
  } else {
    // Apply HD version of the image
    const hdUrl = ensureHiResUrl(bgValue);
    root.style.backgroundImage = `url(${hdUrl})`;
    // Add photo-bg class so abstract patterns can detect it
    root.classList.add('photo-bg');
  }
  root.style.backgroundSize = 'cover';
  root.style.backgroundAttachment = 'fixed';
  root.style.backgroundPosition = 'center';
  root.style.backgroundRepeat = 'no-repeat';
}

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

// Default background images (gradients)
const DEFAULT_IMAGES = [
  { id: 'none', name: 'No Image', url: null },
  { id: 'gradient1', name: 'Blue Gradient', url: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'gradient2', name: 'Sunset Gradient', url: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 'gradient3', name: 'Ocean Gradient', url: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 'gradient4', name: 'Forest Gradient', url: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
];

export default function ThemeSettings() {
  const navigate = useNavigate();
  const { currentTheme, setColorTheme, dark, setDark } = useTheme();
  
  const [selectedTheme, setSelectedTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('crm_selected_theme');
      return saved || 'default';
    } catch { return 'default'; }
  });
  
  const [selectedImage, setSelectedImage] = useState(() => {
    try {
      const saved = localStorage.getItem('crm_theme_image');
      return saved || 'none';
    } catch { return 'none'; }
  });
  
  const [selectedUnsplashUrl, setSelectedUnsplashUrl] = useState(() => {
    try {
      const saved = localStorage.getItem('crm_unsplash_url');
      return saved || '';
    } catch { return ''; }
  });

  // activeMode: 'color' | 'gradient' | 'photo'
  const [activeMode, setActiveMode] = useState(() => {
    try {
      const unsplash = localStorage.getItem('crm_unsplash_url');
      const img = localStorage.getItem('crm_theme_image');
      const theme = localStorage.getItem('crm_selected_theme');
      if (unsplash) return 'photo';
      if (img && img !== 'none') return img.startsWith('unsplash_') ? 'photo' : 'gradient';
      return theme ? 'color' : 'color';
    } catch { return 'color'; }
  });

  // Unsplash state
  const [unsplashImages, setUnsplashImages] = useState([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('nature wallpaper');
  const [showUnsplash, setShowUnsplash] = useState(false);

  // Fetch images from Unsplash
  const fetchUnsplashImages = async (query = 'nature wallpaper') => {
    setUnsplashLoading(true);
    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12&orientation=landscape`,
        {
          headers: {
            'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
          }
        }
      );
      const data = await response.json();
      if (data.results) {
        setUnsplashImages(data.results);
      }
    } catch (err) {
      console.error('Failed to fetch Unsplash images:', err);
    } finally {
      setUnsplashLoading(false);
    }
  };

  // Load Unsplash images on component mount
  useEffect(() => {
    if (showUnsplash && unsplashImages.length === 0) {
      fetchUnsplashImages();
    }
  }, [showUnsplash]);

  // Apply theme function
  const applyTheme = (themeId = selectedTheme, imageId = selectedImage, unsplashUrl = selectedUnsplashUrl, mode = activeMode) => {
    console.debug('[ThemeSettings] applyTheme called with', { themeId, imageId, unsplashUrl, mode });

    // Persist mode
    try { localStorage.setItem('crm_active_theme_mode', mode); } catch {}
    setActiveMode(mode);

    // Clear overlay DOM if present (cleanup)
    const existingOverlay = document.getElementById('theme-color-overlay');
    if (existingOverlay) existingOverlay.remove();

    // MODE: color => set CSS color vars and clear background
    if (mode === 'color') {
      const theme = THEME_PRESETS.find(t => t.id === themeId) || THEME_PRESETS[0];
      console.debug('[ThemeSettings] Applying color mode theme:', theme.id);
      // Save to localStorage
      try { localStorage.setItem('crm_selected_theme', theme.id); } catch {}
      try { localStorage.setItem('crm_theme_image', 'none'); } catch {}
      try { localStorage.removeItem('crm_unsplash_url'); } catch {}
      setSelectedTheme(theme.id);
      setSelectedImage('none');
      setSelectedUnsplashUrl('');
      // Apply color variables
      if (theme.colorKey) setColorTheme(theme.colorKey);
      document.documentElement.style.setProperty('--color-primary', theme.primary);
      document.documentElement.style.setProperty('--color-background', theme.background);
      document.documentElement.style.setProperty('--color-surface', theme.surface);
      document.documentElement.style.setProperty('--color-text', theme.text);
      document.documentElement.style.setProperty('--color-accent', theme.accent);
      // Clear backgrounds from html and body
      applyBackgroundToRoot('none');
      document.body.style.background = '';
      document.body.style.backgroundImage = 'none';
      console.debug('[ThemeSettings] Color applied, backgrounds cleared');
      return;
    }

    // MODE: gradient or photo => apply background and clear color selection (no color CSS applied)
    // We will not change CSS variables so color theme is not applied (ensures only one applied)
    // Persist selected image / unsplash
    try { localStorage.setItem('crm_theme_image', imageId || 'none'); } catch {}
    try {
      if (unsplashUrl) localStorage.setItem('crm_unsplash_url', unsplashUrl); else localStorage.removeItem('crm_unsplash_url');
    } catch {}
    setSelectedImage(imageId || 'none');
    setSelectedUnsplashUrl(unsplashUrl || '');
    setSelectedTheme('');

    // Ensure color variables are reset to default so a gradient or photo does not retain previous color theme
    const defaultTheme = THEME_PRESETS.find(t => t.id === 'default') || THEME_PRESETS[0];
    if (defaultTheme) {
      setColorTheme(defaultTheme.colorKey);
      document.documentElement.style.setProperty('--color-primary', defaultTheme.primary);
      document.documentElement.style.setProperty('--color-background', defaultTheme.background);
      document.documentElement.style.setProperty('--color-surface', defaultTheme.surface);
      document.documentElement.style.setProperty('--color-text', defaultTheme.text);
      document.documentElement.style.setProperty('--color-accent', defaultTheme.accent);
    }

    // Apply background to HTML root element (ensures it shows behind all layers)
    if (imageId?.startsWith('unsplash_') && unsplashUrl) {
      // photo
      console.debug('[ThemeSettings] Applying photo mode with:', unsplashUrl);
      applyBackgroundToRoot(unsplashUrl, false);
      console.debug('[ThemeSettings] Photo applied to root');
      return;
    }

    if (imageId && imageId !== 'none') {
      const imageData = DEFAULT_IMAGES.find(i => i.id === imageId);
      if (imageData?.url && imageData.url.startsWith('linear-gradient')) {
        // gradient
        console.debug('[ThemeSettings] Applying gradient mode:', imageData.url);
        applyBackgroundToRoot(imageData.url, true);
        console.debug('[ThemeSettings] Gradient applied to root');
        return;
      }
    }

    // If we reach here, clear any backgrounds
    applyBackgroundToRoot('none');
    console.debug('[ThemeSettings] Cleared backgrounds (none selected)');
  };

  // Select Unsplash image - use full resolution for HD quality
  const selectUnsplashImage = (image) => {
    // Use 'full' or 'raw' for highest resolution, fallback to 'regular'
    const imageUrl = image.urls.full || image.urls.raw || image.urls.regular;
    const imageId = `unsplash_${image.id}`;
    // Persist and preview immediately
    setSelectedImage(imageId);
    setSelectedUnsplashUrl(imageUrl);
    localStorage.setItem('crm_unsplash_url', imageUrl);
    // Clear color theme highlight visually and switch to photo mode
    setSelectedTheme('');
    setActiveMode('photo');
    try { localStorage.setItem('crm_active_theme_mode', 'photo'); } catch {}
    console.debug('[ThemeSettings] Unsplash image selected (clearing color selection):', imageId, imageUrl);
    // Immediately preview the selected unsplash image to prevent user confusion
    applyTheme('', imageId, imageUrl, 'photo');
  };

  // Apply saved theme on mount (respect activeMode)
  useEffect(() => {
    console.debug('[ThemeSettings] Initializing theme with mode:', activeMode, { selectedTheme, selectedImage, selectedUnsplashUrl });
    applyTheme(selectedTheme, selectedImage, selectedUnsplashUrl, activeMode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchUnsplashImages(searchQuery);
  };
  
  // Handle Apply button
  const [applyMessage, setApplyMessage] = useState("");

  const handleApply = () => {
    console.debug('[ThemeSettings] Apply button clicked');
    applyTheme(selectedTheme, selectedImage, selectedUnsplashUrl, activeMode);
    setApplyMessage('Theme applied');
    setTimeout(() => setApplyMessage(''), 1500);
  };
  
  // Handle Done button
  const handleDone = () => {
    console.debug('[ThemeSettings] Done button clicked');
    applyTheme(selectedTheme, selectedImage, selectedUnsplashUrl, activeMode);
    setApplyMessage('Theme applied');
    // Small delay so console logs and DOM updates are visible before navigation
    setTimeout(() => {
      setApplyMessage('');
      navigate('/settings');
    }, 250);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/settings')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Palette className="w-7 h-7 text-purple-500" />
              Theme Settings
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Customize your CRM appearance with colors and backgrounds
            </p>
            <div className="mt-2">
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">Mode: {activeMode}</span>
            </div>
          </div>
        </div>
        
        {/* Dark Mode Toggle */}
        <button
          onClick={() => setDark(!dark)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        >
          {dark ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-gray-600" />}
          <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>

      {/* Color Themes Section */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5" /> Color Themes
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {THEME_PRESETS.map(theme => (
            <button
              key={theme.id}
              onClick={() => {
                // Select color theme and clear any background image selection
                const prevTheme = theme.id;
                setSelectedTheme(prevTheme);
                setSelectedImage('none');
                setSelectedUnsplashUrl('');
                setActiveMode('color');
                try { localStorage.setItem('crm_active_theme_mode', 'color'); } catch {}
                console.debug('[ThemeSettings] Color theme selected, clearing background selection');
                applyTheme(prevTheme, 'none', '', 'color');
              }}
              className={`relative p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                (selectedTheme === theme.id && activeMode === 'color')
                  ? 'border-purple-500 ring-2 ring-purple-500/30 shadow-lg' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              {/* Theme Preview */}
              <div 
                className="w-full h-24 rounded-lg mb-3 relative overflow-hidden shadow-inner"
                style={{ backgroundColor: theme.background }}
              >
                <div className="absolute inset-2 rounded-md" style={{ backgroundColor: theme.surface }}>
                  <div className="h-3 w-16 rounded mt-2 ml-2" style={{ backgroundColor: theme.primary }} />
                  <div className="h-2 w-12 rounded mt-1 ml-2" style={{ backgroundColor: theme.text, opacity: 0.3 }} />
                  <div className="absolute bottom-2 right-2 h-6 w-6 rounded-full" style={{ backgroundColor: theme.accent }} />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{theme.name}</span>
                <div className="flex -space-x-1">
                  <div className="w-4 h-4 rounded-full border border-white" style={{ backgroundColor: theme.primary }} />
                  <div className="w-4 h-4 rounded-full border border-white" style={{ backgroundColor: theme.accent }} />
                </div>
              </div>
              
              {(selectedTheme === theme.id && activeMode === 'color') && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Gradient Backgrounds Section */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Image className="w-5 h-5" /> Gradient Backgrounds
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {DEFAULT_IMAGES.map(img => (
            <button
              key={img.id}
              onClick={() => {
                // Select gradient background and clear color theme highlight visually
                const prevTheme = selectedTheme || 'default';
                setSelectedImage(img.id);
                setSelectedUnsplashUrl('');
                setSelectedTheme('');
                setActiveMode('gradient');
                try { localStorage.setItem('crm_active_theme_mode', 'gradient'); } catch {}
                console.debug('[ThemeSettings] Gradient selected, clearing color theme selection');
                applyTheme('', img.id, '', 'gradient');
              }}
              className={`relative h-20 rounded-xl border-2 transition-all hover:scale-105 overflow-hidden ${
                (selectedImage === img.id && activeMode === 'gradient')
                  ? 'border-purple-500 ring-2 ring-purple-500/30 shadow-lg' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
              style={{
                background: img.url || '#f3f4f6'
              }}
            >
              {!img.url && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                  None
                </div>
              )}
              {(selectedImage === img.id && activeMode === 'gradient') && (
                <div className="absolute top-1 right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-3 h-3 text-white" />
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs py-1 px-2 truncate">
                {img.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Nature Backgrounds Section */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Image className="w-5 h-5" /> Nature Backgrounds
          </h2>
          <button
            onClick={() => setShowUnsplash(!showUnsplash)}
            className="text-sm text-purple-500 hover:text-purple-600"
          >
            {showUnsplash ? 'Hide' : 'Browse Photos'}
          </button>
        </div>
        
        {showUnsplash && (
          <>
            {/* Images Grid */}
            {unsplashLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto">
                {unsplashImages.map(image => (
                  <button
                    key={image.id}
                    onClick={() => selectUnsplashImage(image)}
                    className={`relative h-32 rounded-xl overflow-hidden transition-all hover:scale-105 ${
                      (selectedImage === `unsplash_${image.id}` && activeMode === 'photo')
                        ? 'ring-4 ring-purple-500 shadow-lg'
                        : 'hover:ring-2 hover:ring-purple-300'
                    }`}
                  >
                    <img
                      src={image.urls.small}
                      alt={image.alt_description || 'Unsplash photo'}
                      className="w-full h-full object-cover"
                    />
                    {(selectedImage === `unsplash_${image.id}` && activeMode === 'photo') && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-white text-xs truncate">by {image.user.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            <p className="text-xs text-gray-500 mt-4 text-center">
              Nature photos from Unsplash
            </p>
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex justify-between">
        <button
          onClick={() => {
            setSelectedTheme('default');
            setSelectedImage('none');
            setSelectedUnsplashUrl('');
            setActiveMode('color');
            try { localStorage.setItem('crm_active_theme_mode','color'); } catch {}
            localStorage.removeItem('crm_unsplash_url');
            applyTheme('default', 'none', '', 'color');
          }}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
        >
          Reset to Default
        </button>
        <div className="flex gap-3 items-center">
          <div className="text-sm text-green-600" aria-live="polite">{applyMessage}</div>
          <button
            onClick={handleApply}
            className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition"
          >
            Apply
          </button>
          <button
            onClick={handleDone}
            className="px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
