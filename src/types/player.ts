// src/types/player.ts

export interface ProcessedImage {
  filename: string;
  players: { nickname: string; exp: number }[];
  player_count: number;
  error?: string;
}

export interface PlayerData {
  nickname:    string;
  totalEXP:    number;
  appearances: number;
  images:      string[];
}

export interface AggregatedStats {
  uniquePlayers: number;
  totalImages:   number;
  totalEXP:      number;
  avgEXP:        number;
}
