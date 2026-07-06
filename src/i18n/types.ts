import type { nl } from '@/i18n/nl';

/** Widens nl.ts's `as const` string literals to `string` so en.ts can hold different text while staying structurally in sync -- a missing/extra key is still a type error. */
type Widen<T> = T extends (...args: infer A) => infer R
  ? (...args: A) => Widen<R>
  : T extends string
    ? string
    : T extends object
      ? { [K in keyof T]: Widen<T[K]> }
      : T;

export type Dictionary = Widen<typeof nl>;
