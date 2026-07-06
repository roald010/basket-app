import * as Localization from 'expo-localization';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { en } from '@/i18n/en';
import { nl } from '@/i18n/nl';
import type { Dictionary } from '@/i18n/types';

export type Locale = 'nl' | 'en';

const dictionaries: Record<Locale, Dictionary> = { nl, en };

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function detectInitialLocale(): Locale {
  const [first] = Localization.getLocales();
  return first?.languageCode === 'en' ? 'en' : 'nl';
}

/**
 * Hand-rolled i18n rather than i18next -- only two locales exist today and none of
 * the copy needs ICU-style plural rules (Dutch/English pluralization is expressed as
 * plain TS in nl.ts/en.ts). Revisit if locale count or plural complexity grows.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(detectInitialLocale);
  const value = useMemo(() => ({ locale, setLocale, t: dictionaries[locale] }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used within an I18nProvider');
  return context;
}
