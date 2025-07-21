// src/App.tsx

import React, { useState } from 'react';
import {
  Upload,
  Search,
  Users,
  TrendingUp,
  Clock,
  Medal,
  Target,
  Calculator,
} from 'lucide-react';
import ImageUpload from './components/ImageUpload';
import PlayerTable from './components/PlayerTable';
import SearchBar from './components/SearchBar';
import StatsSummary from './components/StatsSummary';
import EXPGoalCalculator from './components/EXPGoalCalculator';
import { PlayerData, ProcessedImage, AggregatedStats } from './types/player';
import { processImages } from './utils/imageProcessor';

function App() {
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
  const [aggregatedPlayers, setAggregatedPlayers] = useState<PlayerData[]>([]);
  const [cumulativeData, setCumulativeData] = useState<{
    allProcessedImages: ProcessedImage[];
    allPlayers: PlayerData[];
    totalStats: AggregatedStats;
  }>({
    allProcessedImages: [],
    allPlayers: [],
    totalStats: { uniquePlayers: 0, totalImages: 0, totalEXP: 0, avgEXP: 0 },
  });
  const [stats, setStats] = useState<AggregatedStats>({
    uniquePlayers: 0,
    totalImages: 0,
    totalEXP: 0,
    avgEXP: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCumulative, setShowCumulative] = useState(false);

  // Merge two lists of PlayerData by nickname, summing EXP and appearances
  const mergePlayerData = (
    existing: PlayerData[],
    addition: PlayerData[]
  ) => {
    const map = new Map<string, PlayerData>();
    existing.forEach(p => map.set(p.nickname, { ...p }));
    addition.forEach(p => {
      if (map.has(p.nickname)) {
        const e = map.get(p.nickname)!;
        map.set(p.nickname, {
          ...e,
          totalEXP:    e.totalEXP + p.totalEXP,
          appearances: e.appearances + p.appearances,
          images:      [...e.images, ...p.images],
        });
      } else {
        map.set(p.nickname, { ...p });
      }
    });
    return Array.from(map.values());
  };

  const handleImagesUpload = async (files: File[]) => {
    setIsProcessing(true);
    try {
      const { processedImages, aggregatedPlayers, statistics } =
        await processImages(files);

      // update this session
      setProcessedImages(processedImages);
      setAggregatedPlayers(aggregatedPlayers);
      setStats(statistics);

      // update cumulative
      setCumulativeData(prev => {
        const allImages = [...prev.allProcessedImages, ...processedImages];
        const allPlayers = mergePlayerData(
          prev.allPlayers,
          aggregatedPlayers
        );
        const totalEXP = allPlayers.reduce((sum, p) => sum + p.totalEXP, 0);
        return {
          allProcessedImages: allImages,
          allPlayers,
          totalStats: {
            uniquePlayers: allPlayers.length,
            totalImages:   allImages.length,
            totalEXP,
            avgEXP:
              allPlayers.length > 0
                ? Math.floor(totalEXP / allPlayers.length)
                : 0,
          },
        };
      });
    } catch (err: any) {
      console.error('Error processing images:', err);
      alert(`Error: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAllData = () => {
    if (
      window.confirm(
        'Are you sure? This will clear all uploaded images and stats.'
      )
    ) {
      setProcessedImages([]);
      setAggregatedPlayers([]);
      setStats({ uniquePlayers: 0, totalImages: 0, totalEXP: 0, avgEXP: 0 });
      setCumulativeData({
        allProcessedImages: [],
        allPlayers:         [],
        totalStats:         { uniquePlayers: 0, totalImages: 0, totalEXP: 0, avgEXP: 0 },
      });
      setShowCumulative(false);
      setSearchTerm('');
    }
  };

  const currentPlayers = showCumulative
    ? cumulativeData.allPlayers
    : aggregatedPlayers;
  const currentStats = showCumulative
    ? cumulativeData.totalStats
    : stats;
  const currentImages = showCumulative
    ? cumulativeData.allProcessedImages
    : processedImages;

  const filteredPlayers = currentPlayers.filter(p =>
    p.nickname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center space-x-3">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-3 rounded-xl">
            <TrendingUp className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">
              EXP Stats Calculator
            </h1>
            <p className="text-blue-200">
              Process screenshots and aggregate player EXP
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8 grid lg:grid-cols-3 gap-8">
        {/* Left panel */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-blue-800/30 backdrop-blur-md p-6 rounded-2xl border border-blue-600/30">
            <ImageUpload
              onImagesUpload={handleImagesUpload}
              isProcessing={isProcessing}
            />
          </div>

          <EXPGoalCalculator />

          <div className="bg-blue-800/30 backdrop-blur-md p-6 rounded-2xl border border-blue-600/30">
            <div className="flex items-center gap-3 mb-4">
              <Calculator className="h-5 w-5 text-yellow-300 bg-yellow-600/30 p-2 rounded-lg" />
              <h3 className="text-lg font-bold text-white">
                Coordinate OCR Extraction
              </h3>
            </div>
            <p className="text-blue-200 text-sm">
              Automatically crops each nickname & EXP cell by pixel
              coordinates and runs OCR for precise results.
            </p>
          </div>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-6">
          {(processedImages.length || cumulativeData.allProcessedImages.length) > 0 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex space-x-4">
                  <button
                    onClick={() => setShowCumulative(false)}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      !showCumulative
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-blue-800/40 text-blue-200 hover:bg-blue-700/40'
                    }`}
                  >
                    Current Session ({stats.totalImages})
                  </button>
                  <button
                    onClick={() => setShowCumulative(true)}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      showCumulative
                        ? 'bg-purple-500 text-white shadow-lg'
                        : 'bg-blue-800/40 text-blue-200 hover:bg-blue-700/40'
                    }`}
                  >
                    All Sessions ({cumulativeData.totalStats.totalImages})
                  </button>
                </div>
                {cumulativeData.allProcessedImages.length > 0 && (
                  <button
                    onClick={clearAllData}
                    className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg border border-red-500/30 hover:bg-red-500/30"
                  >
                    Clear All Data
                  </button>
                )}
              </div>

              <div className="bg-blue-800/30 backdrop-blur-md p-6 rounded-2xl border border-blue-600/30">
                <div className="flex items-center gap-3 mb-4">
                  <Search className="h-5 w-5 text-gray-400" />
                  <SearchBar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                  />
                </div>
              </div>

              <StatsSummary stats={currentStats} />

              <div className="bg-blue-800/30 backdrop-blur-md p-6 rounded-2xl border border-blue-600/30">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-4">
                  <Users className="h-6 w-6" />
                  Player Statistics
                  {showCumulative ? ' (All Sessions)' : ' (Current)'}
                </h2>
                <PlayerTable players={filteredPlayers} />
                {filteredPlayers.length === 0 && (
                  <div className="text-center py-8 text-blue-200">
                    <Search className="h-12 w-12 mx-auto mb-4" />
                    No players match "{searchTerm}"
                  </div>
                )}
              </div>

              <div className="bg-blue-800/30 backdrop-blur-md p-6 rounded-2xl border border-blue-600/30">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Medal className="h-5 w-5" /> Processed Images (
                  {currentImages.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentImages.map((img, idx) => (
                    <div
                      key={idx}
                      className="bg-blue-900/40 p-4 rounded-lg border border-blue-600/20"
                    >
                      <h4 className="font-semibold text-white truncate mb-2">
                        {img.filename}
                      </h4>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-200">Players:</span>
                        <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                          {img.player_count}
                        </span>
                      </div>
                      {img.error && (
                        <p className="text-red-400 text-xs mt-2">
                          Error: {img.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {currentPlayers.length === 0 && (
            <div className="bg-blue-800/30 backdrop-blur-md p-6 rounded-2xl border border-blue-600/30 text-blue-200 text-sm">
              <h3 className="font-bold mb-2">How to Use</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Upload one or more screenshots via the upload box.</li>
                <li>Ensure each image is 1920×1080 for the coordinate crops.</li>
                <li>
                  The system will extract nickname & EXP from each row and
                  aggregate across uploads.
                </li>
                <li>
                  Toggle between current session and all sessions to compare.
                </li>
                <li>Use the search bar to find specific players instantly.</li>
                <li>Click “Clear All Data” to reset cumulative stats.</li>
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
