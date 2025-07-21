import React from 'react';
import { Users, Images, TrendingUp, Calculator } from 'lucide-react';
import { AggregatedStats, ProcessedImage } from '../types/player';

interface StatsSummaryProps {
  stats: AggregatedStats;
  processedImages: ProcessedImage[];
}

const StatsSummary: React.FC<StatsSummaryProps> = ({ stats, processedImages }) => {
  const formatEXP = (exp: number) => {
    if (exp >= 1000000) {
      return `${(exp / 1000000).toFixed(1)}M`;
    }
    if (exp >= 1000) {
      return `${(exp / 1000).toFixed(1)}K`;
    }
    return exp.toLocaleString();
  };

  const summaryCards = [
    {
      title: 'Unique Players',
      value: stats.uniquePlayers,
      icon: Users,
      color: 'from-blue-500 to-cyan-500',
      suffix: 'players'
    },
    {
      title: 'Images Processed',
      value: stats.totalImages,
      icon: Images,
      color: 'from-purple-500 to-pink-500',
      suffix: 'images'
    },
    {
      title: 'Total EXP',
      value: formatEXP(stats.totalEXP),
      icon: TrendingUp,
      color: 'from-yellow-500 to-orange-500',
      suffix: 'points'
    },
    {
      title: 'Average EXP',
      value: formatEXP(stats.avgEXP),
      icon: Calculator,
      color: 'from-green-500 to-emerald-500',
      suffix: 'per player'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {summaryCards.map((card, index) => (
        <div
          key={index}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-300 text-sm font-medium">{card.title}</p>
              <p className="text-white text-2xl font-bold mt-1">{card.value}</p>
              <p className="text-slate-400 text-xs mt-1">{card.suffix}</p>
            </div>
            <div className={`bg-gradient-to-r ${card.color} p-3 rounded-xl`}>
              <card.icon className="h-6 w-6 text-white" />
            </div>
          </div>
          
          {/* Progress indicator for processing */}
          <div className="mt-3 bg-white/5 rounded-full h-1 overflow-hidden">
            <div 
              className={`h-full bg-gradient-to-r ${card.color} transition-all duration-1000`}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsSummary;