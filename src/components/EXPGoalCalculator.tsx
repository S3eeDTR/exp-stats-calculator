import React, { useState } from 'react';
import { Target, Calculator } from 'lucide-react';

const EXPGoalCalculator: React.FC = () => {
  const [currentEXP, setCurrentEXP] = useState('');
  const [goalEXP, setGoalEXP] = useState('');
  const [result, setResult] = useState<{
    needed: number;
    percentage: number;
  } | null>(null);

  const parseEXPValue = (value: string): number => {
    if (!value) return 0;
    
    const cleanValue = value.toLowerCase().replace(/[,\s]/g, '');
    
    if (cleanValue.includes('k')) {
      return parseFloat(cleanValue.replace('k', '')) * 1000;
    }
    if (cleanValue.includes('m')) {
      return parseFloat(cleanValue.replace('m', '')) * 1000000;
    }
    if (cleanValue.includes('b')) {
      return parseFloat(cleanValue.replace('b', '')) * 1000000000;
    }
    
    return parseFloat(cleanValue) || 0;
  };

  const formatEXP = (exp: number): string => {
    if (exp >= 1000000000) {
      return `${(exp / 1000000000).toFixed(1)}B`;
    }
    if (exp >= 1000000) {
      return `${(exp / 1000000).toFixed(1)}M`;
    }
    if (exp >= 1000) {
      return `${(exp / 1000).toFixed(1)}K`;
    }
    return exp.toLocaleString();
  };

  const calculateGoal = () => {
    const current = parseEXPValue(currentEXP);
    const goal = parseEXPValue(goalEXP);
    
    if (current >= 0 && goal > current) {
      const needed = goal - current;
      const percentage = (current / goal) * 100;
      setResult({ needed, percentage });
    } else {
      setResult(null);
    }
  };

  React.useEffect(() => {
    if (currentEXP && goalEXP) {
      calculateGoal();
    } else {
      setResult(null);
    }
  }, [currentEXP, goalEXP]);

  return (
    <div className="bg-blue-800/30 backdrop-blur-md rounded-2xl border border-blue-600/30 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-green-600/30 p-2 rounded-lg">
          <Target className="h-5 w-5 text-green-300" />
        </div>
        <h3 className="text-lg font-bold text-white">EXP Goal Calculator</h3>
      </div>
      
      <p className="text-blue-200 text-sm mb-4">
        Calculate how much EXP you need to reach your next rank goal. Use formats like: 19B, 20B, 1.5M, 500K
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-blue-200 text-sm font-medium mb-2">Current EXP</label>
          <input
            type="text"
            placeholder="e.g., 19B"
            value={currentEXP}
            onChange={(e) => setCurrentEXP(e.target.value)}
            className="w-full px-4 py-3 bg-blue-900/40 border border-blue-600/30 rounded-lg text-white placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          />
        </div>

        <div>
          <label className="block text-blue-200 text-sm font-medium mb-2">Goal EXP</label>
          <input
            type="text"
            placeholder="e.g., 20B"
            value={goalEXP}
            onChange={(e) => setGoalEXP(e.target.value)}
            className="w-full px-4 py-3 bg-blue-900/40 border border-blue-600/30 rounded-lg text-white placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          />
        </div>

        {result && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="h-4 w-4 text-green-400" />
              <span className="text-green-400 font-semibold">Calculation Result</span>
            </div>
            <div className="space-y-2">
              <p className="text-white">
                <span className="text-green-400 font-bold">{formatEXP(result.needed)}</span> EXP needed
              </p>
              <p className="text-blue-200 text-sm">
                Progress: {result.percentage.toFixed(1)}% complete
              </p>
              <div className="w-full bg-blue-900/40 rounded-full h-2 mt-2">
                <div 
                  className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(result.percentage, 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EXPGoalCalculator;