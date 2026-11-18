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
  messages: Message[];
}

export interface Settings {
  name?: string;
  autoLockMinutes: number; // 0 = never
  nudges: boolean; // gently ask for "a bit more" after very short answers
}

export const DEFAULT_SETTINGS: Settings = { autoLockMinutes: 5, nudges: true };
