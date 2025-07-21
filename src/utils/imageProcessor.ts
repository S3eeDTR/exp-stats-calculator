import { PlayerData, ProcessedImage, AggregatedStats } from '../types/player';

export const processImages = async (files: File[]): Promise<{
  processedImages: ProcessedImage[];
  aggregatedPlayers: PlayerData[];
  statistics: AggregatedStats;
}> => {
  try {
    console.log('Creating FormData with files:', files.length);
    const formData = new FormData();
    files.forEach(file => {
      formData.append('images', file);
      console.log('Added file to FormData:', file.name, file.size, 'bytes');
    });

    console.log('Sending request to Flask server...');
    const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const response = await fetch(`${BACKEND}/process`, {
      method: 'POST',
      body: formData,
    });

    console.log('Response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Response error:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Response data:', data);
    if (!data.success) {
      throw new Error(data.error || 'Processing failed');
    }

    return {
      processedImages: data.processed_images,
      aggregatedPlayers: data.aggregated_players,
      statistics: {
        uniquePlayers: data.statistics.unique_players,
        totalImages: data.statistics.total_images,
        totalEXP: data.statistics.total_exp,
        avgEXP: data.statistics.avg_exp,
      }
    };
  } catch (error) {
    console.error('Error processing images:', error);
    throw error;
  }
};
