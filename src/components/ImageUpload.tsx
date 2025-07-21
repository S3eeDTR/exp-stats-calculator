import React, { useCallback, useState } from 'react';
import { Upload, Image, Loader2 } from 'lucide-react';

interface ImageUploadProps {
  onImagesUpload: (files: File[]) => void;
  isProcessing: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onImagesUpload, isProcessing }) => {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(file => 
        file.type.startsWith('image/')
      );
      console.log('Files dropped:', files.map(f => f.name));
      if (files.length > 0) {
        onImagesUpload(files);
      } else {
        console.log('No valid image files found in drop');
        alert('Please upload image files only (PNG, JPG, etc.)');
      }
    }
  }, [onImagesUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      console.log('Files selected via input:', files.map(f => f.name));
      onImagesUpload(files);
    }
  }, [onImagesUpload]);

  return (
    <>
      <div
        className={`relative border-2 border-dashed rounded-xl p-12 transition-all duration-300 ${
          dragActive
            ? 'border-blue-400 bg-blue-500/20'
            : 'border-blue-400/50 hover:border-blue-400'
        } ${isProcessing ? 'pointer-events-none opacity-50' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing}
        />
        
        <div className="text-center">
          {isProcessing ? (
            <div className="flex flex-col items-center">
              <Loader2 className="h-16 w-16 text-blue-400 animate-spin mb-4" />
              <p className="text-lg font-semibold text-white mb-2">Processing Images...</p>
              <p className="text-blue-200 text-sm">Extracting player data using OCR</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="bg-blue-600/30 p-4 rounded-full mb-4">
                {dragActive ? (
                  <Upload className="h-8 w-8 text-blue-300" />
                ) : (
                  <Upload className="h-8 w-8 text-blue-300" />
                )}
              </div>
              <p className="text-white font-medium mb-2">
                {dragActive ? 'Drop screenshots here or' : 'Drop screenshots here or'}
              </p>
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200">
                Browse Files
              </button>
              <p className="text-blue-300 text-sm mt-3">
                Supports JPG, PNG, GIF
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ImageUpload;