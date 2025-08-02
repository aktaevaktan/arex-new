"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

// Language types
export type Language = "ru" | "en" | "kg";

// Translation interface
interface Translations {
  [key: string]: any;
}

// Context interface
interface LocalizationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  translations: Translations;
}

// Create context
const LocalizationContext = createContext<LocalizationContextType | undefined>(
  undefined
);

// Language data
const languageData: Record<Language, Translations> = {
  ru: require("../locales/ru.json"),
  en: require("../locales/en.json"),
  kg: require("../locales/kg.json"),
};

// Cookie helpers
const getCookieLanguage = (): Language => {
  if (typeof window === "undefined") return "ru";

  const cookies = document.cookie.split(";");
  const langCookie = cookies.find((cookie) =>
    cookie.trim().startsWith("language=")
  );

  if (langCookie) {
    const lang = langCookie.split("=")[1] as Language;
    if (["ru", "en", "kg"].includes(lang)) {
      return lang;
    }
  }

  return "ru"; // Default to Russian
};

const setCookieLanguage = (language: Language) => {
  if (typeof window === "undefined") return;

  // Set cookie for 1 year
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `language=${language}; expires=${expires.toUTCString()}; path=/`;
};

// Provider component
interface LocalizationProviderProps {
  children: ReactNode;
}

export const LocalizationProvider: React.FC<LocalizationProviderProps> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<Language>("ru");
  const [translations, setTranslations] = useState<Translations>(
    languageData.ru
  );

  // Initialize language from cookie
  useEffect(() => {
    const savedLanguage = getCookieLanguage();
    setLanguageState(savedLanguage);
    setTranslations(languageData[savedLanguage]);
  }, []);

  // Set language and save to cookie
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    setTranslations(languageData[lang]);
    setCookieLanguage(lang);
  };

  // Translation function with parameter support
  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split(".");
    let value: any = translations;

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key; // Return key if translation not found
      }
    }

    let result = typeof value === "string" ? value : key;

    // Replace parameters in the translation
    if (params && typeof result === "string") {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        result = result.replace(
          new RegExp(`{${paramKey}}`, "g"),
          String(paramValue)
        );
      });
    }

    return result;
  };

  const contextValue: LocalizationContextType = {
    language,
    setLanguage,
    t,
    translations,
  };

  return (
    <LocalizationContext.Provider value={contextValue}>
      {children}
    </LocalizationContext.Provider>
  );
};

// Hook to use localization
export const useLocalization = (): LocalizationContextType => {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error(
      "useLocalization must be used within a LocalizationProvider"
    );
  }
  return context;
};

// Language switcher component
export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage, t } = useLocalization();

  const languages: { code: Language; name: string }[] = [
    { code: "ru", name: t("language.russian") },
    { code: "en", name: t("language.english") },
    { code: "kg", name: t("language.kyrgyz") },
  ];

  return (
    <div className="relative">
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className="bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        title={t("language.select")}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
};

// Export language options for external use
export const getLanguageOptions = () => [
  { code: "ru" as Language, name: "Русский", flag: "🇷🇺" },
  { code: "en" as Language, name: "English", flag: "🇺🇸" },
  { code: "kg" as Language, name: "Кыргызча", flag: "🇰🇬" },
];
