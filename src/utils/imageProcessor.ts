// src/utils/imageProcessor.ts

import { PlayerData, ProcessedImage, AggregatedStats } from '../types/player';

/**
 * Sends the given images to your Flask backend and returns
 * the raw per‐image details plus aggregated player data.
 */
export async function processImages(files: File[]): Promise<{
  processedImages: ProcessedImage[];
  aggregatedPlayers: PlayerData[];
  statistics: AggregatedStats;
}> {
  if (!files.length) {
    throw new Error("No files provided");
  }

  // 1) Build FormData
  const formData = new FormData();
  files.forEach(f => formData.append("images", f));

  // 2) POST to your backend
  const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const res = await fetch(`${BACKEND}/process`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Upload failed: ${res.status} – ${txt}`);
  }

  // 3) Parse JSON
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Processing failed");
  }

  // 4) Map to our types
  const processedImages: ProcessedImage[] = data.processed_images;
  const aggregatedPlayers: PlayerData[]     = data.aggregated_players.map((p: any) => ({
    nickname:    p.nickname,
    totalEXP:    p.totalEXP,
    appearances: p.appearances,
    images:      p.images,
  }));
  const statistics: AggregatedStats        = {
    uniquePlayers: data.statistics.unique_players,
    totalImages:   data.statistics.total_images,
    totalEXP:      data.statistics.total_exp,
    avgEXP:        data.statistics.avg_exp,
  };

  return { processedImages, aggregatedPlayers, statistics };
}
