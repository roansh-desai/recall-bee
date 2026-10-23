export interface Source {
  conversationId: string;
  quote: string;
  speaker?: string;
  timestamp?: string;
}
export interface Utterance {
  id: string;
  speaker: string;
  text: string;
  timestamp?: string;
}
export interface Conversation {
  id: string;
  title: string;
  startedAt: string;
  updatedAt: string;
  mySpeaker: string | null;
  location: string | null;
  utterances: Utterance[];
  isFixture: boolean;
}
export interface Detail {
  id: string;
  personId: string;
  kind: "role" | "org" | "topic" | "self" | "met" | "note";
  text: string;
  source: Source;
}
export interface Handle {
  id: string;
  personId: string;
  platform: string;
  handle: string | null;
  url: string | null;
  source: Source;
}
export interface PromiseItem {
  id: string;
  personId: string;
  personName: string;
  direction: "i_owe" | "they_owe" | "unknown";
  text: string;
  dueHint: string | null;
  alarmAt: string | null;
  completed: boolean;
  beeTodoId: string | null;
  syncError: string | null;
  source: Source;
}
export interface Person {
  id: string;
  name: string;
  lastSeen: string;
  createdAt: string;
  nameSource: Source;
  details: Detail[];
  handles: Handle[];
  promises: PromiseItem[];
  conversationIds: string[];
  isFixture: boolean;
}
export interface MergeCandidate {
  id: string;
  personA: string;
  personB: string;
  reason: string;
  status: "pending" | "merged" | "separate";
}
export interface BriefLine {
  label: string;
  text: string;
  sources: Source[];
}
export interface Brief {
  personId: string;
  name: string;
  lines: BriefLine[];
  wordCount: number;
  isFixture: boolean;
}
export interface AskAnswer {
  answer: string;
  sources: Source[];
  method: "bee-search" | "fixture" | "unavailable";
  error?: string;
}
export interface LiveStatus {
  mode: "live" | "fixture";
  connected: boolean;
  streamConnected: boolean;
  lastEvent: string | null;
  lastEventAt: string | null;
  lastSyncAt: string | null;
  error: string | null;
  conversations: number;
  people: number;
  openPromises: number;
}
export interface Snapshot {
  status: LiveStatus;
  people: Person[];
  promises: PromiseItem[];
  conversations: Conversation[];
  mergeCandidates: MergeCandidate[];
}
export interface ExtractionResult {
  people: Person[];
  mergeCandidates: MergeCandidate[];
}
export interface BeeClientContract {
  listConversations(): Promise<unknown>;
  getConversation(id: string): Promise<unknown>;
  transcript(id: string): Promise<unknown>;
  facts(): Promise<unknown>;
  search(query: string): Promise<unknown>;
  locations(kind: "current" | "recent" | "clusters"): Promise<unknown>;
  createTodo(text: string, alarmAt?: string | null): Promise<unknown>;
  completeTodo(id: string, completed: boolean): Promise<unknown>;
}
