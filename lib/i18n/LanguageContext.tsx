"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import en from "@/locales/en.json";
import hi from "@/locales/hi.json";

const dictionaries: Record<string, Record<string, string | Record<string, string>>> = { en, hi };
export type Language = "en" | "hi";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Default to Hindi
  const [lang, setLangState] = useState<Language>("hi");

  useEffect(() => {
    // Optionally read from localStorage on mount
    const saved = localStorage.getItem("dgms_lang") as Language;
    if (saved && (saved === "hi" || saved === "en")) {
      setLangState(saved);
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("dgms_lang", newLang);
  };

  const t = (key: string, replacements?: Record<string, string | number>) => {
    const keys = key.split(".");
    let value: unknown = dictionaries[lang];
    
    for (const k of keys) {
      if (value === undefined || typeof value !== "object" || value === null) break;
      value = (value as Record<string, unknown>)[k];
    }
    
    let result = typeof value === "string" ? value : key;
    
    if (replacements && typeof result === "string") {
      Object.entries(replacements).forEach(([k, v]) => {
        result = result.replace(`{${k}}`, String(v));
      });
    }
    
    return result;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
