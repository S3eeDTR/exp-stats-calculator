// src/components/PlayerTable.tsx

import React from 'react';
import { Trophy, Clock, Target, TrendingUp } from 'lucide-react';
import { PlayerData } from '../types/player';

interface PlayerTableProps {
  players: PlayerData[];
}

const PlayerTable: React.FC<PlayerTableProps> = ({ players }) => {
  const sortedPlayers = [...players].sort((a, b) => b.totalEXP - a.totalEXP);

  const formatEXP = (exp: number) => exp.toLocaleString();

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-400" />;
    if (index === 1) return <Trophy className="h-5 w-5 text-gray-300" />;
    if (index === 2) return <Trophy className="h-5 w-5 text-amber-600" />;
    return <span className="text-slate-400 font-bold">{index + 1}</span>;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-blue-600/30">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-blue-900/40">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-blue-200">Rank</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-blue-200">Player</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-blue-200">Total EXP</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-blue-200">Appearances</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-blue-200">Best Time</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-blue-200">Time Over</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-600/20">
            {sortedPlayers.map((player, index) => (
              <tr
                key={player.nickname}
                className={`
                  hover:bg-blue-800/30 transition-colors duration-200
                  ${index % 2 === 0 ? 'bg-blue-900/20' : 'bg-transparent'}
                  ${index < 3 ? 'bg-gradient-to-r from-yellow-500/10 to-transparent' : ''}
                `}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    {getRankIcon(index)}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {player.nickname.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-semibold">{player.nickname}</p>
                      <p className="text-blue-300 text-sm">
                        Found in {player.images.length} image{player.images.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <TrendingUp className="h-4 w-4 text-yellow-400" />
                    <span className="text-yellow-400 font-bold text-lg">
                      {formatEXP(player.totalEXP)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm font-medium">
                    {player.appearances}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Clock className="h-4 w-4 text-green-400" />
                    <span className="text-green-400 font-mono">
                      {player.bestTime}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  {player.timeOverCount > 0 ? (
                    <span className="bg-red-500/20 text-red-300 px-3 py-1 rounded-full text-sm font-medium">
                      {player.timeOverCount}
                    </span>
                  ) : (
                    <span className="text-slate-500">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlayerTable;
