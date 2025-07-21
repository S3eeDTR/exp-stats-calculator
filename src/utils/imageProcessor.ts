// src/utils/imageProcessor.ts

import { PlayerData, ProcessedImage, AggregatedStats } from '../types/player';

interface CropBox { left: number; top: number; width: number; height: number; }

// Adjust these numbers to match the region you want to crop
const CROP_BOX: CropBox = { left: 700, top: 530, width: 300, height: 340 };

async function cropFile(file: File, box: CropBox): Promise<File> {
  // 1) Load the image into an <img>
  const dataUrl = await new Promise<string>((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result as string);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const image = new Image();
    image.onload  = () => res(image);
    image.onerror = rej;
    image.src     = dataUrl;
  });

  // 2) Draw the crop region into a canvas
  const canvas = document.createElement('canvas');
  canvas.width  = box.width;
  canvas.height = box.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    img,
    box.left, box.top, box.width, box.height,  // source
    0,       0,       box.width, box.height   // destination
  );

  // 3) Convert canvas back into a File
  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, file.type)
  );
  if (!blob) throw new Error('Canvas is empty');

  // Use the same filename or tag it to show it’s cropped
  return new File([blob], file.name.replace(/(\.\w+)$/, '_crop$1'), {
    type: file.type
  });
}

export const processImages = async (files: File[]) : Promise<{
  processedImages: ProcessedImage[];
  aggregatedPlayers: PlayerData[];
  statistics: AggregatedStats;
}> => {
  // 1) Crop all files in parallel
  const croppedFiles = await Promise.all(files.map(f => cropFile(f, CROP_BOX)));

  // 2) Build FormData
  const formData = new FormData();
  croppedFiles.forEach(f => formData.append('images', f));

  // 3) Send to your Flask API
  const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
  const response = await fetch(`${BACKEND}/process`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Upload failed: ${response.status} – ${err}`);
  }

  // 4) Parse result
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Processing failed');

  return {
    processedImages: data.processed_images,
    aggregatedPlayers: data.aggregated_players,
    statistics: {
      uniquePlayers: data.statistics.unique_players,
      totalImages:   data.statistics.total_images,
      totalEXP:      data.statistics.total_exp,
      avgEXP:        data.statistics.avg_exp
    }
  };
};
