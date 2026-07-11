import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { en } from '@/i18n/en';
import { nl } from '@/i18n/nl';
import type { Dictionary } from '@/i18n/types';

export type Locale = 'nl' | 'en';

const dictionaries: Record<Locale, Dictionary> = { nl, en };

const LOCALE_STORAGE_KEY = 'basket.locale';

// Basket is a Dutch grocery app, so it opens in Dutch regardless of the phone's
// system language; English is opt-in via the toggle. A stored choice overrides this.
const DEFAULT_LOCALE: Locale = 'nl';

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

/**
 * Hand-rolled i18n rather than i18next -- only two locales exist today and none of
 * the copy needs ICU-style plural rules (Dutch/English pluralization is expressed as
 * plain TS in nl.ts/en.ts). Revisit if locale count or plural complexity grows.
 *
 * The chosen locale persists in AsyncStorage so the language toggle sticks across
 * restarts; until the stored value hydrates we render in the default (Dutch).
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(LOCALE_STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && (stored === 'nl' || stored === 'en')) setLocaleState(stored);
      })
      .catch(() => {
        // A read failure just means we keep the device-detected locale -- no user impact.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    AsyncStorage.setItem(LOCALE_STORAGE_KEY, next).catch(() => {
      // Persist is best-effort; the in-memory switch still applies for this session.
    });
  }, []);

  const value = useMemo(() => ({ locale, setLocale, t: dictionaries[locale] }), [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used within an I18nProvider');
  return context;
}
