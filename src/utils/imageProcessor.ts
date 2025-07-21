// src/utils/imageProcessor.ts

import { PlayerData, ProcessedImage, AggregatedStats } from '../types/player';

export const processImages = async (
  files: File[]
): Promise<{
  processedImages: ProcessedImage[];
  aggregatedPlayers: PlayerData[];
  statistics: AggregatedStats;
}> => {
  console.log('Creating FormData with files:', files.map(f => f.name));

  // 1) Build FormData with the original files (no client‐side cropping)
  const formData = new FormData();
  files.forEach(file => {
    formData.append('images', file);
    console.log(`  • added ${file.name} (${file.size} bytes)`);
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

  // 4) Parse JSON response
  const data = await response.json();
  console.log('Response data:', data);

  if (!data.success) {
    throw new Error(data.error || 'Processing failed');
  }

  // 5) Return structured result
  return {
    processedImages: data.processed_images as ProcessedImage[],
    aggregatedPlayers: data.aggregated_players as PlayerData[],
    statistics: {
      uniquePlayers: data.statistics.unique_players,
      totalImages:   data.statistics.total_images,
      totalEXP:      data.statistics.total_exp,
      avgEXP:        data.statistics.avg_exp,
    },
  };
};
