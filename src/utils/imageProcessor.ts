// src/utils/imageProcessor.ts

import { PlayerData, ProcessedImage, AggregatedStats } from '../types/player';

/**
 * If a number has more than 10 digits (i.e. a huge merged value),
 * drop its first 5 digits to recover the true EXP.
 */
function sanitizeExp(n: number): number {
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
  console.log('Creating FormData with files:', files.map(f => f.name));
  
  // 1) Build FormData
  const formData = new FormData();
  files.forEach(file => {
    formData.append('images', file);
    console.log('  • added', file.name, file.size, 'bytes');
  });

  // 2) Determine backend URL
  const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
  console.log('Uploading to backend at:', BACKEND);

  // 3) POST to /process
  const response = await fetch(`${BACKEND}/process`, {
    method: 'POST',
    body: formData,
  });
  console.log('Response status:', response.status);

  if (!response.ok) {
    const errText = await response.text();
    console.error('Upload failed:', errText);
    throw new Error(`Upload failed: ${response.status} – ${errText}`);
  }

  // 4) Parse JSON
  const data = await response.json();
  console.log('Raw response data:', data);

  if (!data.success) {
    throw new Error(data.error || 'Processing failed');
  }

  // 5) Sanitize EXP values in each player record
  const aggregatedPlayers: PlayerData[] = data.aggregated_players.map((p: any) => ({
    ...p,
    exp: sanitizeExp(p.exp),
    totalEXP: sanitizeExp(p.totalEXP ?? p.exp),
  }));

  // 6) Sanitize summary statistics
  const statistics: AggregatedStats = {
    uniquePlayers: data.statistics.unique_players,
    totalImages:   data.statistics.total_images,
    totalEXP:      sanitizeExp(data.statistics.total_exp),
    avgEXP:        sanitizeExp(data.statistics.avg_exp),
  };

  // 7) Return structured result
  return {
    processedImages: data.processed_images as ProcessedImage[],
    aggregatedPlayers,
    statistics,
  };
};
