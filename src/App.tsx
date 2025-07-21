import React, { useState } from 'react';
import { Upload, Search, Users, TrendingUp, Clock, Medal, Target, Calculator } from 'lucide-react';
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
    totalStats: { uniquePlayers: 0, totalImages: 0, totalEXP: 0, avgEXP: 0 }
  });
  const [stats, setStats] = useState<AggregatedStats>({
    uniquePlayers: 0,
    totalImages: 0,
    totalEXP: 0,
    avgEXP: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCumulative, setShowCumulative] = useState(false);

  // Function to merge player data across sessions
  const mergePlayerData = (existingPlayers: PlayerData[], newPlayers: PlayerData[]): PlayerData[] => {
    const playerMap = new Map<string, PlayerData>();
    
    // Add existing players
    existingPlayers.forEach(player => {
      playerMap.set(player.nickname, { ...player });
    });
    
    // Merge new players
    newPlayers.forEach(newPlayer => {
      if (playerMap.has(newPlayer.nickname)) {
        const existing = playerMap.get(newPlayer.nickname)!;
        playerMap.set(newPlayer.nickname, {
          ...existing,
          totalEXP: existing.totalEXP + newPlayer.totalEXP,
          appearances: existing.appearances + newPlayer.appearances,
          bestTime: existing.bestTime === 'TIME OVER' ? newPlayer.bestTime : 
                   newPlayer.bestTime === 'TIME OVER' ? existing.bestTime :
                   newPlayer.bestTime < existing.bestTime ? newPlayer.bestTime : existing.bestTime,
          timeOverCount: existing.timeOverCount + newPlayer.timeOverCount,
          images: [...existing.images, ...newPlayer.images]
        });
      } else {
        playerMap.set(newPlayer.nickname, { ...newPlayer });
      }
    });
    
    return Array.from(playerMap.values());
  };

  const handleImagesUpload = async (files: File[]) => {
    console.log('Upload started with files:', files.map(f => f.name));
    setIsProcessing(true);
    try {
      const { processedImages, aggregatedPlayers, statistics } = await processImages(files);
      console.log('Processing completed:', { processedImages, aggregatedPlayers, statistics });
      
      // Update current session data
      setProcessedImages(processedImages);
      setAggregatedPlayers(aggregatedPlayers);
      setStats(statistics);
      
      // Update cumulative data
      setCumulativeData(prev => {
        const allImages = [...prev.allProcessedImages, ...processedImages];
        const mergedPlayers = mergePlayerData(prev.allPlayers, aggregatedPlayers);
        const totalEXP = mergedPlayers.reduce((sum, player) => sum + player.totalEXP, 0);
        
        return {
          allProcessedImages: allImages,
          allPlayers: mergedPlayers,
          totalStats: {
            uniquePlayers: mergedPlayers.length,
            totalImages: allImages.length,
            totalEXP: totalEXP,
            avgEXP: mergedPlayers.length > 0 ? Math.floor(totalEXP / mergedPlayers.length) : 0
          }
        };
      });
      
    } catch (error) {
      console.error('Error processing images:', error);
      alert(`Error processing images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAllData = () => {
    if (confirm('Are you sure you want to clear all data? This will remove all uploaded images and player statistics.')) {
      setProcessedImages([]);
      setAggregatedPlayers([]);
      setStats({ uniquePlayers: 0, totalImages: 0, totalEXP: 0, avgEXP: 0 });
      setCumulativeData({
        allProcessedImages: [],
        allPlayers: [],
        totalStats: { uniquePlayers: 0, totalImages: 0, totalEXP: 0, avgEXP: 0 }
      });
      setShowCumulative(false);
    }
  };

  const currentPlayers = showCumulative ? cumulativeData.allPlayers : aggregatedPlayers;
  const currentStats = showCumulative ? cumulativeData.totalStats : stats;
  const currentImages = showCumulative ? cumulativeData.allProcessedImages : processedImages;
  
  const filteredPlayers = currentPlayers.filter(player =>
    player.nickname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-3 rounded-xl">
              <TrendingUp className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">EXP Stats Calculator</h1>
              <p className="text-blue-200">Process multiple game screenshots and aggregate player statistics</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-800/40 backdrop-blur-md rounded-2xl border border-blue-600/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm font-medium">Images</p>
                <p className="text-white text-3xl font-bold">{currentStats.totalImages}</p>
              </div>
              <div className="bg-blue-600/30 p-3 rounded-xl">
                <Medal className="h-6 w-6 text-blue-300" />
              </div>
            </div>
          </div>

          <div className="bg-purple-800/40 backdrop-blur-md rounded-2xl border border-purple-600/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-sm font-medium">Unique Players</p>
                <p className="text-white text-3xl font-bold">{currentStats.uniquePlayers}</p>
              </div>
              <div className="bg-purple-600/30 p-3 rounded-xl">
                <Users className="h-6 w-6 text-purple-300" />
              </div>
            </div>
          </div>

          <div className="bg-green-800/40 backdrop-blur-md rounded-2xl border border-green-600/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-200 text-sm font-medium">Total Entries</p>
                <p className="text-white text-3xl font-bold">{currentPlayers.reduce((sum, p) => sum + p.appearances, 0)}</p>
              </div>
              <div className="bg-green-600/30 p-3 rounded-xl">
                <TrendingUp className="h-6 w-6 text-green-300" />
              </div>
            </div>
          </div>

          <div className="bg-yellow-800/40 backdrop-blur-md rounded-2xl border border-yellow-600/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-200 text-sm font-medium">Total EXP</p>
                <p className="text-white text-3xl font-bold">{currentStats.totalEXP.toLocaleString()}</p>
              </div>
              <div className="bg-yellow-600/30 p-3 rounded-xl">
                <Target className="h-6 w-6 text-yellow-300" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Upload & EXP Calculator */}
          <div className="lg:col-span-1 space-y-6">
            {/* Upload Section */}
            <div className="bg-blue-800/30 backdrop-blur-md rounded-2xl border border-blue-600/30 p-6">
              <ImageUpload onImagesUpload={handleImagesUpload} isProcessing={isProcessing} />
            </div>

            {/* EXP Goal Calculator */}
            <EXPGoalCalculator />

            {/* OCR Info Card */}
            <div className="bg-blue-800/30 backdrop-blur-md rounded-2xl border border-blue-600/30 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-yellow-600/30 p-2 rounded-lg">
                  <Calculator className="h-5 w-5 text-yellow-300" />
                </div>
                <h3 className="text-lg font-bold text-white">Coordinate-Based OCR Extraction</h3>
              </div>
              <p className="text-blue-200 text-sm leading-relaxed">
                Uses the same coordinate-based extraction method as the working Python Streamlit code. 
                Automatically crops each field and extracts nicknames and EXP values with high precision. 
                Select an image to process it manually or enable auto-processing above.
              </p>
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-2 space-y-6">
            {/* View Toggle and Search */}
            {(aggregatedPlayers.length > 0 || cumulativeData.allPlayers.length > 0) && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setShowCumulative(false)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        !showCumulative 
                          ? 'bg-blue-500 text-white shadow-lg' 
                          : 'bg-blue-800/40 text-blue-200 hover:bg-blue-700/40'
                      }`}
                    >
                      Current Session ({stats.totalImages} images)
                    </button>
                    <button
                      onClick={() => setShowCumulative(true)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        showCumulative 
                          ? 'bg-purple-500 text-white shadow-lg' 
                          : 'bg-blue-800/40 text-blue-200 hover:bg-blue-700/40'
                      }`}
                    >
                      All Sessions ({cumulativeData.totalStats.totalImages} total images)
                    </button>
                  </div>
                  
                  {cumulativeData.allPlayers.length > 0 && (
                    <button
                      onClick={clearAllData}
                      className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg font-medium hover:bg-red-500/30 transition-all duration-200 border border-red-500/30"
                    >
                      Clear All Data
                    </button>
                  )}
                </div>

                {/* Filter & Search */}
                <div className="bg-blue-800/30 backdrop-blur-md rounded-2xl border border-blue-600/30 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Filter & Search</h3>
                  <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
                </div>

                {/* Player Table */}
                <div className="bg-blue-800/30 backdrop-blur-md rounded-2xl border border-blue-600/30 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <Users className="h-6 w-6" />
                      Player Statistics {showCumulative ? '(All Sessions)' : '(Current Session)'}
                    </h2>
                  </div>
                  
                  <PlayerTable players={filteredPlayers} />
                  
                  {searchTerm && filteredPlayers.length === 0 && (
                    <div className="text-center py-8">
                      <Search className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                      <p className="text-blue-200">No players found matching "{searchTerm}"</p>
                    </div>
                  )}
                </div>

                {/* Processed Images Summary */}
                <div className="bg-blue-800/30 backdrop-blur-md rounded-2xl border border-blue-600/30 p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Medal className="h-5 w-5" />
                    Processed Images ({currentImages.length})
                    {showCumulative && cumulativeData.totalStats.totalImages > stats.totalImages && (
                      <span className="text-sm text-purple-300 ml-2">
                        (Across all sessions)
                      </span>
                    )}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentImages.map((image, index) => (
                      <div key={index} className="bg-blue-900/40 rounded-lg p-4 border border-blue-600/20">
                        <h4 className="font-semibold text-white mb-2 truncate">{image.filename}</h4>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-blue-200">Players found:</span>
                          <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                            {image.player_count}
                          </span>
                        </div>
                        {image.error && (
                          <p className="text-red-400 text-xs mt-2">Error: {image.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Instructions */}
            {currentPlayers.length === 0 && (
              <div className="bg-blue-800/30 backdrop-blur-md rounded-2xl border border-blue-600/30 p-6">
                <h3 className="text-lg font-bold text-white mb-3">How to Use - Cumulative Tracking</h3>
                <div className="space-y-2 text-blue-200 text-sm">
                  <p>• Upload multiple game screenshot images using the upload area</p>
                  <p>• Make Sure your picture is 1920x1080 !!!!</p>
                  <p>• <strong>Keep uploading more images</strong> - data accumulates across all upload sessions</p>
                  <p>• The system will automatically extract player data using OCR technology</p>
                  <p>• <strong>Player EXP is summed across ALL images</strong> you've ever uploaded</p>
                  <p>• Switch between "Current Session" and "All Sessions" to see different views</p>
                  <p>• Use the search bar to quickly find specific players</p>
                  <p>• Players are ranked by total EXP accumulated across all upload sessions</p>
                  <p>• Use "Clear All Data" to start fresh if needed</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
