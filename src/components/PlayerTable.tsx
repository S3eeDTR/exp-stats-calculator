// src/components/PlayerTable.tsx

import React from 'react';
import { PlayerData } from '../types/player';

interface PlayerTableProps {
  players: PlayerData[];
}

const PlayerTable: React.FC<PlayerTableProps> = ({ players }) => {
  if (players.length === 0) {
    return <p>No players to display.</p>;
  }

  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead>
        <tr>
          <th style={{ border: '1px solid #ddd', padding: '8px' }}>Player</th>
          <th style={{ border: '1px solid #ddd', padding: '8px' }}>Total EXP</th>
          <th style={{ border: '1px solid #ddd', padding: '8px' }}>Appearances</th>
          <th style={{ border: '1px solid #ddd', padding: '8px' }}>Images</th>
        </tr>
      </thead>
      <tbody>
        {players.map(p => (
          <tr key={p.nickname}>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{p.nickname}</td>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>
              {p.totalEXP.toLocaleString()}
            </td>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>
              {p.appearances}
            </td>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>
              {p.images.join(', ')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default PlayerTable;
