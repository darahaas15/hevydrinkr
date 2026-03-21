import type { DrinkEntry } from './drink';
import type { PersonalRecord } from './pr';

export type SessionStatus = 'active' | 'completed' | 'abandoned';
export type SessionMood = 'legendary' | 'great' | 'good' | 'meh' | 'rough';

export interface DrinkSession {
  id: string;
  userId: string;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  venue: string;
  drinks: DrinkEntry[];
  rounds: Round[];
  totalStandardDrinks: number;
  totalVolumeMl: number;
  peakBacEstimate: number;
  durationMinutes: number;
  isPartyMode: boolean;
  partyId: string | null;
  prsAchieved: PersonalRecord[];
  mood: SessionMood | null;
  notes: string;
  photos: string[];
}

export interface Round {
  id: string;
  sessionId: string;
  boughtByUserId: string;
  boughtByName: string;
  drinkEntryIds: string[];
  timestamp: string;
  cost: number | null;
}
