/** PUBLIC: Survey metadata visible on-chain */
export interface Survey {
  id: string;
  questionCount: number;
  active: boolean;
  organizer: string;
  participantCount: number;
}

/** PUBLIC: Question structure (stored off-chain, referenced by index) */
export interface SurveyQuestion {
  index: number;
  text: string;
  options: string[];
}

/** PUBLIC: Aggregate results — no individual response data */
export interface SurveyResults {
  tallies: Record<number, Record<number, number>>;
  totalParticipants: number;
}

/** PUBLIC: Wallet connection state */
export type WalletState = "disconnected" | "connecting" | "connected";
