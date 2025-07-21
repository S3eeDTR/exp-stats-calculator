export interface PlayerData {
  nickname: string;
  totalEXP: number;
  appearances: number;
  bestTime: string;
  timeOverCount: number;
  images: string[];
}

export interface ProcessedImage {
  filename: string;
  players: any[];
  player_count: number;
  error?: string;
}

export interface AggregatedStats {
  uniquePlayers: number;
  totalImages: number;
  totalEXP: number;
  avgEXP: number;
}