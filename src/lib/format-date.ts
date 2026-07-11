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

/** Default name for a brand-new list -- "Lijst: 2 juni" / "List: June 2" -- replaces
 * the DB's static 'Weekmenu' default, which gave every new list the same name with no
 * way to tell them apart until renamed. Still just a default: the pencil-icon rename
 * in List Hub overrides it same as before. */
export function formatNewListName(locale: 'nl' | 'en'): string {
  const date = new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-US', {
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return locale === 'nl' ? `Lijst: ${date}` : `List: ${date}`;
}
