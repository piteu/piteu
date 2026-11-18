export type Mood = 1 | 2 | 3 | 4 | 5;

export interface Message {
  from: 'app' | 'me';
  text: string;
  at: number;
}

/** One conversation = one journal entry. Stored encrypted. */
export interface Entry {
  id: string;
  createdAt: number;
  updatedAt: number;
  flowId: string;
  flowTitle: string;
  mood?: Mood;
  feelings?: string[];
  topics?: string[];
  /** What you did, e.g. "🚶 Walk" (from the "What I did" and "End of day" check-ins). */
  activities?: string[];
  /** Who you saw or talked to. */
  people?: string[];
  /** Your written answers (not taps). */
  notes?: string[];
  /** When the entry is about a different day than it was written (e.g. filling in yesterday). */
  aboutAt?: number;
  messages: Message[];
}

/** The moment an entry is "about": usually when it was written, unless it was filled in later. */
export const entryTime = (e: Pick<Entry, 'createdAt' | 'aboutAt'>) => e.aboutAt ?? e.createdAt;

export interface Settings {
  name?: string;
  autoLockMinutes: number; // 0 = never
  nudges: boolean; // gently ask for "a bit more" after very short answers
}

export const DEFAULT_SETTINGS: Settings = { autoLockMinutes: 5, nudges: true };
