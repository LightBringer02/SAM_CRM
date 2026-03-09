import { createContext, useContext, useState, useEffect } from "react";

// Abstract pattern types for each theme
const ABSTRACT_PATTERNS = {
  midnight: { type: 'geometric', shapes: ['diamond', 'circle', 'square'], animation: 'pulse' },
  aurora: { type: 'waves', shapes: ['wave', 'arc', 'ripple'], animation: 'float' },
  sunset: { type: 'rays', shapes: ['triangle', 'ray', 'starburst'], animation: 'glow' },
  cosmic: { type: 'nebula', shapes: ['spiral', 'star', 'orbit'], animation: 'rotate' },
  ocean: { type: 'waves', shapes: ['wave', 'bubble', 'current'], animation: 'drift' },
  forest: { type: 'organic', shapes: ['leaf', 'branch', 'hexagon'], animation: 'sway' },
  volcano: { type: 'lava', shapes: ['flame', 'ember', 'crack'], animation: 'flicker' },
  arctic: { type: 'crystal', shapes: ['shard', 'snowflake', 'prism'], animation: 'shimmer' },
  nebula: { type: 'cosmic', shapes: ['cloud', 'star', 'swirl'], animation: 'pulse' },
  matrix: { type: 'digital', shapes: ['grid', 'line', 'dot'], animation: 'flow' }
};

// Color themes with both light and dark mode support + abstract patterns
const COLOR_THEMES = {
  midnight: {
    name: "Midnight",
    // Dark mode colors
    dark: {
      base: "#0a0a1a",
      surface: "#12122a",
      surfaceAlt: "#1a1a3a",
      primary: "#6366f1",
      primaryHover: "#818cf8",
      accent: "#8b5cf6",
      text: "#e2e8f0",
      textMuted: "#94a3b8",
      border: "#2d2d5a",
      gradients: [
        "from-blue-900/30 via-purple-900/20 to-transparent",
        "from-cyan-900/25 via-blue-900/15 to-transparent",
        "from-indigo-900/20 via-violet-900/10 to-transparent",
        "from-sky-900/15 to-transparent"
      ]
    },
    // Light mode colors
    light: {
      base: "#f0f4ff",
      surface: "#ffffff",
      surfaceAlt: "#f8fafc",
      primary: "#4f46e5",
      primaryHover: "#4338ca",
      accent: "#7c3aed",
      text: "#1e293b",
      textMuted: "#64748b",
      border: "#cbd5e1",
      gradients: [
        "from-blue-200/40 via-purple-200/30 to-transparent",
        "from-cyan-200/35 via-blue-100/25 to-transparent",
        "from-indigo-200/30 via-violet-100/20 to-transparent",
        "from-sky-200/25 to-transparent"
      ]
    }
  },
  aurora: {
    name: "Aurora",
    dark: {
      base: "#0a1a1a",
      surface: "#0f2a2a",
      surfaceAlt: "#143a3a",
      primary: "#10b981",
      primaryHover: "#34d399",
      accent: "#06b6d4",
      text: "#e2e8f0",
      textMuted: "#94a3b8",
      border: "#1e4a4a",
      gradients: [
        "from-emerald-900/30 via-teal-900/20 to-transparent",
        "from-green-900/25 via-cyan-900/15 to-transparent",
        "from-teal-900/20 via-emerald-900/10 to-transparent",
        "from-cyan-900/15 to-transparent"
      ]
    },
    light: {
      base: "#ecfdf5",
      surface: "#ffffff",
      surfaceAlt: "#f0fdf4",
      primary: "#059669",
      primaryHover: "#047857",
      accent: "#0891b2",
      text: "#1e293b",
      textMuted: "#64748b",
      border: "#a7f3d0",
      gradients: [
        "from-emerald-200/40 via-teal-200/30 to-transparent",
        "from-green-200/35 via-cyan-100/25 to-transparent",
        "from-teal-200/30 via-emerald-100/20 to-transparent",
        "from-cyan-200/25 to-transparent"
      ]
    }
  },
  sunset: {
    name: "Sunset",
    dark: {
      base: "#1a0a0a",
      surface: "#2a0f0f",
      surfaceAlt: "#3a1414",
      primary: "#f97316",
      primaryHover: "#fb923c",
      accent: "#ef4444",
      text: "#fef2f2",
      textMuted: "#fca5a5",
      border: "#4a1e1e",
      gradients: [
        "from-orange-900/30 via-red-900/20 to-transparent",
        "from-rose-900/25 via-pink-900/15 to-transparent",
        "from-amber-900/20 via-orange-900/10 to-transparent",
        "from-red-900/15 to-transparent"
      ]
    },
    light: {
      base: "#fff7ed",
      surface: "#ffffff",
      surfaceAlt: "#fef3c7",
      primary: "#ea580c",
      primaryHover: "#c2410c",
      accent: "#dc2626",
      text: "#1e293b",
      textMuted: "#64748b",
      border: "#fed7aa",
      gradients: [
        "from-orange-200/40 via-red-200/30 to-transparent",
        "from-rose-200/35 via-pink-100/25 to-transparent",
        "from-amber-200/30 via-orange-100/20 to-transparent",
        "from-red-200/25 to-transparent"
      ]
    }
  },
  cosmic: {
    name: "Cosmic",
    dark: {
      base: "#0f0a1a",
      surface: "#1a0f2a",
      surfaceAlt: "#25143a",
      primary: "#a855f7",
      primaryHover: "#c084fc",
      accent: "#ec4899",
      text: "#f5f3ff",
      textMuted: "#c4b5fd",
      border: "#3b1e5a",
      gradients: [
        "from-purple-900/30 via-pink-900/20 to-transparent",
        "from-fuchsia-900/25 via-violet-900/15 to-transparent",
        "from-pink-900/20 via-purple-900/10 to-transparent",
        "from-violet-900/15 to-transparent"
      ]
    },
    light: {
      base: "#faf5ff",
      surface: "#ffffff",
      surfaceAlt: "#f5f3ff",
      primary: "#9333ea",
      primaryHover: "#7c3aed",
      accent: "#db2777",
      text: "#1e293b",
      textMuted: "#64748b",
      border: "#e9d5ff",
      gradients: [
        "from-purple-200/40 via-pink-200/30 to-transparent",
        "from-fuchsia-200/35 via-violet-100/25 to-transparent",
        "from-pink-200/30 via-purple-100/20 to-transparent",
        "from-violet-200/25 to-transparent"
      ]
    }
  },
  ocean: {
    name: "Ocean",
    dark: {
      base: "#0a0f1a",
      surface: "#0f1a2a",
      surfaceAlt: "#14253a",
      primary: "#0ea5e9",
      primaryHover: "#38bdf8",
      accent: "#3b82f6",
      text: "#e0f2fe",
      textMuted: "#7dd3fc",
      border: "#1e3a5a",
      gradients: [
        "from-blue-900/35 via-indigo-900/25 to-transparent",
        "from-sky-900/30 via-blue-900/20 to-transparent",
        "from-indigo-900/25 via-blue-900/15 to-transparent",
        "from-blue-900/20 to-transparent"
      ]
    },
    light: {
      base: "#f0f9ff",
      surface: "#ffffff",
      surfaceAlt: "#e0f2fe",
      primary: "#0284c7",
      primaryHover: "#0369a1",
      accent: "#2563eb",
      text: "#1e293b",
      textMuted: "#64748b",
      border: "#bae6fd",
      gradients: [
        "from-blue-200/40 via-indigo-200/30 to-transparent",
        "from-sky-200/35 via-blue-100/25 to-transparent",
        "from-indigo-200/30 via-blue-100/20 to-transparent",
        "from-blue-200/25 to-transparent"
      ]
    }
  },
  forest: {
    name: "Forest",
    dark: {
      base: "#0a120a",
      surface: "#0f1f0f",
      surfaceAlt: "#142c14",
      primary: "#22c55e",
      primaryHover: "#4ade80",
      accent: "#84cc16",
      text: "#dcfce7",
      textMuted: "#86efac",
      border: "#1e4a1e",
      gradients: [
        "from-green-900/30 via-emerald-900/20 to-transparent",
        "from-lime-900/25 via-green-900/15 to-transparent",
        "from-emerald-900/20 via-teal-900/10 to-transparent",
        "from-green-900/15 to-transparent"
      ]
    },
    light: {
      base: "#f0fdf4",
      surface: "#ffffff",
      surfaceAlt: "#dcfce7",
      primary: "#16a34a",
      primaryHover: "#15803d",
      accent: "#65a30d",
      text: "#1e293b",
      textMuted: "#64748b",
      border: "#bbf7d0",
      gradients: [
        "from-green-200/40 via-emerald-200/30 to-transparent",
        "from-lime-200/35 via-green-100/25 to-transparent",
        "from-emerald-200/30 via-teal-100/20 to-transparent",
        "from-green-200/25 to-transparent"
      ]
    }
  },
  volcano: {
    name: "Volcano",
    dark: {
      base: "#120808",
      surface: "#1f0f0f",
      surfaceAlt: "#2c1414",
      primary: "#ef4444",
      primaryHover: "#f87171",
      accent: "#f97316",
      text: "#fef2f2",
      textMuted: "#fca5a5",
      border: "#4a1e1e",
      gradients: [
        "from-red-900/35 via-orange-900/25 to-transparent",
        "from-amber-900/30 via-red-900/20 to-transparent",
        "from-orange-900/25 via-yellow-900/15 to-transparent",
        "from-red-900/20 to-transparent"
      ]
    },
    light: {
      base: "#fef2f2",
      surface: "#ffffff",
      surfaceAlt: "#fee2e2",
      primary: "#dc2626",
      primaryHover: "#b91c1c",
      accent: "#ea580c",
      text: "#1e293b",
      textMuted: "#64748b",
      border: "#fecaca",
      gradients: [
        "from-red-200/40 via-orange-200/30 to-transparent",
        "from-amber-200/35 via-red-100/25 to-transparent",
        "from-orange-200/30 via-yellow-100/20 to-transparent",
        "from-red-200/25 to-transparent"
      ]
    }
  },
  arctic: {
    name: "Arctic",
    dark: {
      base: "#0a0f12",
      surface: "#0f1a1f",
      surfaceAlt: "#14252c",
      primary: "#64748b",
      primaryHover: "#94a3b8",
      accent: "#06b6d4",
      text: "#f1f5f9",
      textMuted: "#cbd5e1",
      border: "#334155",
      gradients: [
        "from-slate-800/30 via-gray-800/20 to-transparent",
        "from-zinc-800/25 via-slate-800/15 to-transparent",
        "from-gray-800/20 via-zinc-800/10 to-transparent",
        "from-slate-800/15 to-transparent"
      ]
    },
    light: {
      base: "#f8fafc",
      surface: "#ffffff",
      surfaceAlt: "#f1f5f9",
      primary: "#475569",
      primaryHover: "#334155",
      accent: "#0891b2",
      text: "#1e293b",
      textMuted: "#64748b",
      border: "#e2e8f0",
      gradients: [
        "from-slate-200/40 via-gray-200/30 to-transparent",
        "from-zinc-200/35 via-slate-100/25 to-transparent",
        "from-gray-200/30 via-zinc-100/20 to-transparent",
        "from-slate-200/25 to-transparent"
      ]
    }
  },
  nebula: {
    name: "Nebula",
    dark: {
      base: "#0f0a12",
      surface: "#1a0f1f",
      surfaceAlt: "#25142c",
      primary: "#ec4899",
      primaryHover: "#f472b6",
      accent: "#8b5cf6",
      text: "#fdf2f8",
      textMuted: "#f9a8d4",
      border: "#4a1e3a",
      gradients: [
        "from-pink-900/30 via-blue-900/20 to-transparent",
        "from-violet-900/25 via-pink-900/15 to-transparent",
        "from-blue-900/20 via-purple-900/10 to-transparent",
        "from-fuchsia-900/15 to-transparent"
      ]
    },
    light: {
      base: "#fdf2f8",
      surface: "#ffffff",
      surfaceAlt: "#fce7f3",
      primary: "#db2777",
      primaryHover: "#be185d",
      accent: "#7c3aed",
      text: "#1e293b",
      textMuted: "#64748b",
      border: "#fbcfe8",
      gradients: [
        "from-pink-200/40 via-blue-200/30 to-transparent",
        "from-violet-200/35 via-pink-100/25 to-transparent",
        "from-blue-200/30 via-purple-100/20 to-transparent",
        "from-fuchsia-200/25 to-transparent"
      ]
    }
  },
  matrix: {
    name: "Matrix",
    dark: {
      base: "#050a05",
      surface: "#0a140a",
      surfaceAlt: "#0f1e0f",
      primary: "#22c55e",
      primaryHover: "#4ade80",
      accent: "#a3e635",
      text: "#dcfce7",
      textMuted: "#86efac",
      border: "#1e3a1e",
      gradients: [
        "from-green-900/40 via-lime-900/30 to-transparent",
        "from-emerald-900/35 via-green-900/25 to-transparent",
        "from-lime-900/30 via-teal-900/20 to-transparent",
        "from-green-900/25 to-transparent"
      ]
    },
    light: {
      base: "#f7fee7",
      surface: "#ffffff",
      surfaceAlt: "#ecfccb",
      primary: "#16a34a",
      primaryHover: "#15803d",
      accent: "#84cc16",
      text: "#1e293b",
      textMuted: "#64748b",
      border: "#bef264",
      gradients: [
        "from-green-200/40 via-lime-200/30 to-transparent",
        "from-emerald-200/35 via-green-100/25 to-transparent",
        "from-lime-200/30 via-teal-100/20 to-transparent",
        "from-green-200/25 to-transparent"
      ]
    }
  }
};

const ThemeContext = createContext();

// ── Helpers to persist theme preferences inside the user record ──────
function saveThemeToUser(prefs) {
  try {
    const cu = localStorage.getItem("currentUser");
    if (!cu) return;
    const currentUser = JSON.parse(cu);
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const updated = users.map(u =>
      u.id === currentUser.id ? { ...u, themePrefs: { ...(u.themePrefs || {}), ...prefs } } : u
    );
    localStorage.setItem("users", JSON.stringify(updated));
    // Also patch currentUser so a page-refresh keeps them
    const patched = { ...currentUser, themePrefs: { ...(currentUser.themePrefs || {}), ...prefs } };
    localStorage.setItem("currentUser", JSON.stringify(patched));
  } catch {}
}

function loadThemeFromUser() {
  try {
    const cu = localStorage.getItem("currentUser");
    if (cu) {
      const parsed = JSON.parse(cu);
      if (parsed.themePrefs) return parsed.themePrefs;
    }
  } catch {}
  return null;
}

export function ThemeProvider({ children }) {
  // On mount: prefer the user-record prefs (cloud-saved), fall back to localStorage
  const [dark, setDark] = useState(() => {
    const userPrefs = loadThemeFromUser();
    if (userPrefs?.mode === "dark") return true;
    if (userPrefs?.mode === "light") return false;
    const saved = localStorage.getItem("theme");
    if (saved === "dark") return true;
    if (saved === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const [colorTheme, setColorTheme] = useState(() => {
    const userPrefs = loadThemeFromUser();
    return userPrefs?.colorTheme || localStorage.getItem("colorTheme") || "midnight";
  });

  // Persist dark/light + sync to user
  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    saveThemeToUser({ mode: dark ? "dark" : "light" });
  }, [dark]);

  // Persist colorTheme + CSS vars + sync to user
  useEffect(() => {
    localStorage.setItem("colorTheme", colorTheme);
    saveThemeToUser({ colorTheme });

    // Apply CSS custom properties for theming
    const theme = COLOR_THEMES[colorTheme] || COLOR_THEMES.midnight;
    const mode = dark ? theme.dark : theme.light;
    const root = document.documentElement;
    
    root.style.setProperty('--theme-base', mode.base);
    root.style.setProperty('--theme-surface', mode.surface);
    root.style.setProperty('--theme-surface-alt', mode.surfaceAlt);
    root.style.setProperty('--theme-primary', mode.primary);
    root.style.setProperty('--theme-primary-hover', mode.primaryHover);
    root.style.setProperty('--theme-accent', mode.accent);
    root.style.setProperty('--theme-text', mode.text);
    root.style.setProperty('--theme-text-muted', mode.textMuted);
    root.style.setProperty('--theme-border', mode.border);
  }, [colorTheme, dark]);

  // Re-apply saved theme when user logs in (handles cross-device persistence)
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === "currentUser" && e.newValue) {
        try {
          const u = JSON.parse(e.newValue);
          if (u.themePrefs) {
            if (u.themePrefs.mode === "dark") setDark(true);
            else if (u.themePrefs.mode === "light") setDark(false);
            if (u.themePrefs.colorTheme && COLOR_THEMES[u.themePrefs.colorTheme]) {
              setColorTheme(u.themePrefs.colorTheme);
            }
          }
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Global theme/background initialization on app mount
  // Reads saved theme mode and applies background to document.documentElement
  useEffect(() => {
    const initializeTheme = () => {
      try {
        const activeMode = localStorage.getItem('crm_active_theme_mode') || 'color';
        const themeImage = localStorage.getItem('crm_theme_image');
        const unsplashUrl = localStorage.getItem('crm_unsplash_url');
        
        const root = document.documentElement;
        
        // Clear any existing body backgrounds to avoid conflicts
        document.body.style.backgroundImage = 'none';
        document.body.style.background = '';
        
        if (activeMode === 'photo' && unsplashUrl) {
          // Apply Unsplash photo background
          root.style.backgroundImage = `url(${unsplashUrl})`;
          root.style.backgroundSize = 'cover';
          root.style.backgroundPosition = 'center';
          root.style.backgroundAttachment = 'fixed';
          root.style.backgroundRepeat = 'no-repeat';
        } else if (activeMode === 'gradient' && themeImage && themeImage !== 'none' && !themeImage.startsWith('unsplash_')) {
          // Default gradient URLs for built-in gradients
          const GRADIENT_MAP = {
            'gradient-cosmic': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'gradient-sunset': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            'gradient-ocean': 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
            'gradient-forest': 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
            'gradient-aurora': 'linear-gradient(135deg, #00c6ff 0%, #0072ff 50%, #7209b7 100%)',
            'gradient-magma': 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)',
            'gradient-twilight': 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
            'gradient-mint': 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
          };
          const gradientUrl = GRADIENT_MAP[themeImage];
          if (gradientUrl) {
            root.style.backgroundImage = gradientUrl;
            root.style.backgroundSize = 'cover';
            root.style.backgroundPosition = 'center';
            root.style.backgroundAttachment = 'fixed';
            root.style.backgroundRepeat = 'no-repeat';
          }
        } else {
          // Color mode - clear backgrounds
          root.style.backgroundImage = 'none';
          root.style.backgroundColor = '';
        }
      } catch (e) {
        console.warn('[ThemeProvider] Error initializing theme:', e);
      }
    };
    
    initializeTheme();
  }, []); // Run once on mount

  const themeData = COLOR_THEMES[colorTheme] || COLOR_THEMES.midnight;
  const currentTheme = dark ? themeData.dark : themeData.light;
  const abstractPattern = ABSTRACT_PATTERNS[colorTheme] || ABSTRACT_PATTERNS.midnight;

  return (
    <ThemeContext.Provider value={{ 
      dark, 
      setDark, 
      colorTheme, 
      setColorTheme, 
      currentTheme,
      themeData,
      abstractPattern,
      availableThemes: COLOR_THEMES 
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Default fallback theme for when context is not available
const defaultTheme = {
  base: "#f0f4ff",
  surface: "#ffffff",
  surfaceAlt: "#f8fafc",
  primary: "#4f46e5",
  primaryHover: "#4338ca",
  accent: "#7c3aed",
  text: "#1e293b",
  textMuted: "#64748b",
  border: "#cbd5e1",
  gradients: []
};

export function useTheme() {
  const context = useContext(ThemeContext);
  // Return fallback values if context is not available (prevents crashes)
  if (!context) {
    console.warn("useTheme: ThemeContext not found, using default theme");
    return {
      dark: false,
      setDark: () => {},
      colorTheme: "midnight",
      setColorTheme: () => {},
      currentTheme: defaultTheme,
      themeData: { light: defaultTheme, dark: defaultTheme },
      abstractPattern: { type: 'geometric', shapes: [], animation: 'pulse' },
      availableThemes: COLOR_THEMES
    };
  }
  return context;
}

export { COLOR_THEMES, ABSTRACT_PATTERNS };