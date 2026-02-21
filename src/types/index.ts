// src/types/index.ts - 全ての型定義を集約

export interface BannedUser {
  zoom_username: string;
  zoom_email: string | null;
}

export interface NgWord {
  id: string;
  word: string;
  category: string;
  severity: string;
  is_regex: boolean;
}

export interface BotConfig {
  webinarId: string;
  webinarName: string;
  aiThreshold: number; // 0.0〜1.0
  autoDelete: boolean;
  autoKick: boolean;
  blockReentry: boolean;
  sheetsSync: boolean;
  ngWords: NgWord[];
  bannedUsers: BannedUser[];
}

export interface ModerationResult {
  score: number;
  category: 'clean' | 'hate' | 'spam' | 'harassment' | 'troll';
  reason: string;
}

export interface ChatMessage {
  username: string;
  message: string;
  msgId: string;
  timestamp: Date;
}

export interface ModLog {
  webinar_id: string;
  webinar_name: string;
  username: string;
  message: string;
  action: 'deleted' | 'kicked' | 'warned' | 'passed' | 're-blocked';
  detection_method: 'ngword' | 'ai' | 'blacklist';
  ai_score: number;
  ai_reason: string;
  ai_category: string;
  matched_word: string | null;
}

export interface BanRecord {
  bannedAt: string;
  webinarId: string;
  webinarName: string;
  username: string;
  email: string | null;
  message: string;
  detectionMethod: 'ngword' | 'ai';
  aiScore: number;
  aiReason: string;
  matchedWord: string | null;
  action: string;
  banType: 'permanent' | 'temporary';
  banExpiry: string | null;
  moderator: string;
  note: string;
}

export interface BotStatus {
  isRunning: boolean;
  processedCount: number;
  webinarId: string | null;
  webinarName: string | null;
  startedAt: string | null;
}

export interface BotSettings {
  id: string;
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
}

export interface BlacklistEntry {
  id: string;
  zoom_username: string;
  zoom_email: string | null;
  reason: string;
  original_message: string | null;
  ai_score: number | null;
  ban_type: 'permanent' | 'temporary';
  banned_at: string;
  expires_at: string | null;
  webinar_id: string | null;
  webinar_name: string | null;
  sheets_synced: boolean;
  is_active: boolean;
}