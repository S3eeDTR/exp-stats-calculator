// src/utils/imageProcessor.ts

import { PlayerData, ProcessedImage, AggregatedStats } from '../types/player';

/**
 * If a number has more than 10 digits (i.e. merged junk), 
 * drop its first 5 digits to recover the true EXP.
 */
function sanitizeTotalEXP(n: number): number {
  const s = n.toString();
  return s.length > 10 ? Number(s.slice(5)) : n;
}

export const processImages = async (
  files: File[]
): Promise<{
  processedImages: ProcessedImage[];
  aggregatedPlayers: PlayerData[];
  statistics: AggregatedStats;
}> => {
  // 1) Build FormData
  const formData = new FormData();
  files.forEach(f => formData.append('images', f));

  // 2) POST to backend
  const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
  const res     = await fetch(`${BACKEND}/process`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Upload failed: ${res.status} – ${txt}`);
  }
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Processing failed');

  // 3) Keep raw per-image results
  const processedImages: ProcessedImage[] = data.processed_images;

  // 4) Sanitize and map aggregated players
  const aggregatedPlayers: PlayerData[] = data.aggregated_players.map((p: any) => ({
    nickname:      p.nickname,
    totalEXP:      sanitizeTotalEXP(p.totalEXP),
    appearances:   p.appearances,
    bestTime:      p.bestTime,
    timeOverCount: p.timeOverCount,
    images:        p.images
  }));

  // 5) Sanitize summary statistics
  const statistics: AggregatedStats = {
    uniquePlayers: data.statistics.unique_players,
    totalImages:   data.statistics.total_images,
    totalEXP:      sanitizeTotalEXP(data.statistics.total_exp),
    avgEXP:        sanitizeTotalEXP(data.statistics.avg_exp)
  };

  return { processedImages, aggregatedPlayers, statistics };
};
