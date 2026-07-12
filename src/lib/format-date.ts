/** Short, locale-aware label for a list's created_at -- "vandaag"/"today" for same
 * calendar day, otherwise "10 jul" (adds a year only when it's not the current one). */
export function formatListDate(iso: string, locale: 'nl' | 'en'): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return locale === 'nl' ? 'vandaag' : 'today';

  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  }).format(date);
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Default name for a brand-new list -- "Zondag 12 Juli" / "Sunday July 12" -- replaces
 * both the DB's original static 'Weekmenu' default and the later "Lijst: 2 juni" prefix,
 * neither of which told same-day lists apart at a glance. No "Mandje"/"Basket" prefix --
 * List Hub's big (48px) title already labels the screen as a basket, and a prefix pushed
 * the date onto a second line on a phone screen, forcing the rename-pencil icon out of
 * position. Read as a plain label (like a heading), not a sentence, so weekday/month are
 * capitalized even in Dutch, where they're normally lowercase in running text. Still just
 * a default: the pencil-icon rename in List Hub overrides it, same as before. When a user
 * already has another list with this exact base name today, resolveNewListName
 * (features/lists/api.ts) appends " (2)", " (3)", etc. -- kept out of this (pure,
 * unit-tested) function since that needs a DB round-trip. */
export function formatNewListName(locale: 'nl' | 'en', date: Date = new Date()): string {
  const intlLocale = locale === 'nl' ? 'nl-NL' : 'en-US';
  const weekday = capitalize(new Intl.DateTimeFormat(intlLocale, { weekday: 'long' }).format(date));
  const month = capitalize(new Intl.DateTimeFormat(intlLocale, { month: 'long' }).format(date));
  const day = date.getDate();
  return locale === 'nl' ? `${weekday} ${day} ${month}` : `${weekday} ${month} ${day}`;
}
