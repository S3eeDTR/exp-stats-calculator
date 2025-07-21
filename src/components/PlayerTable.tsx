// src/components/StatsTable.tsx

import React, { useState } from "react";
import { processImages }    from "../utils/imageProcessor";
import { PlayerData, AggregatedStats } from "../types/player";

export function StatsTable() {
  const [files, setFiles]         = useState<File[]>([]);
  const [players, setPlayers]     = useState<PlayerData[]>([]);
  const [stats, setStats]         = useState<AggregatedStats>({
    uniquePlayers: 0,
    totalImages:   0,
    totalEXP:      0,
    avgEXP:        0,
  });
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string|null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { aggregatedPlayers, statistics } = await processImages(files);
      setPlayers(aggregatedPlayers);
      setStats(statistics);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleUpload}>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={e => setFiles(Array.from(e.target.files || []))}
        />
        <button type="submit" disabled={loading || !files.length}>
          {loading ? "Processing…" : "Upload & Process"}
        </button>
      </form>

      {error && <div style={{ color: "red" }}>{error}</div>}

      <h2>Aggregated Statistics</h2>
      <ul>
        <li>Unique Players: {stats.uniquePlayers}</li>
        <li>Total Images:   {stats.totalImages}</li>
        <li>Total EXP:      {stats.totalEXP.toLocaleString()}</li>
        <li>Avg EXP:        {stats.avgEXP.toLocaleString()}</li>
      </ul>

      <h2>Player Breakdown</h2>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Total EXP</th>
            <th>Appearances</th>
            <th>Images</th>
          </tr>
        </thead>
        <tbody>
          {players.map(p => (
            <tr key={p.nickname}>
              <td>{p.nickname}</td>
              <td>{p.totalEXP.toLocaleString()}</td>
              <td>{p.appearances}</td>
              <td>{p.images.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
