"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [playerCount, setPlayerCount] = useState(2);
  const [playerNames, setPlayerNames] = useState([
    "Player 1",
    "Player 2",
    "Player 3",
    "Player 4",
  ]);
  const [useVariant, setUseVariant] = useState(false);

  const handleNameChange = (index: number, name: string) => {
    const names = [...playerNames];
    names[index] = name;
    setPlayerNames(names);
  };

  const handleStart = () => {
    const names = playerNames.slice(0, playerCount);
    const params = new URLSearchParams({
      players: JSON.stringify(names),
      variant: useVariant ? "1" : "0",
    });
    router.push(`/game/local?${params.toString()}`);
  };

  const playerColors = ["#4a9eff", "#e8a838", "#c43a3a", "#3ab8b0"];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(255,255,255,0.5) 40px, rgba(255,255,255,0.5) 41px)`,
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse,rgba(74,158,255,0.08),transparent_70%)]" />

      <div className="relative z-10 text-center mb-10 animate-fadeIn">
        <h1
          className="text-7xl font-bold tracking-tight mb-3"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          <span className="text-[var(--azul-accent)]">A</span>
          <span className="text-[var(--azul-gold)]">Z</span>
          <span className="text-[var(--azul-cyan)]">U</span>
          <span className="text-[var(--azul-red)]">L</span>
        </h1>
        <p className="text-[#8899aa] text-lg tracking-wide">
          The Royal Palace of Evora awaits
        </p>
      </div>

      <div
        className="relative z-10 panel w-full max-w-md animate-fadeIn"
        style={{ animationDelay: "0.1s" }}
      >
        <h2
          className="text-xl font-semibold mb-6 text-center"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          New Game
        </h2>

        {/* Player count selector */}
        <div className="mb-6">
          <label className="block text-sm text-[#8899aa] mb-3 font-medium">
            Number of Players
          </label>
          <div className="flex gap-2">
            {[2, 3, 4].map((count) => (
              <button
                key={count}
                onClick={() => setPlayerCount(count)}
                className={`flex-1 py-3 rounded-lg font-semibold transition-all text-sm ${
                  playerCount === count
                    ? "bg-[var(--azul-accent)] text-white shadow-lg shadow-blue-500/20"
                    : "bg-[var(--azul-surface)] text-[#8899aa] hover:text-white hover:bg-[#243a5e]"
                }`}
              >
                {count} Players
              </button>
            ))}
          </div>
          <p className="text-xs text-[#556677] mt-2">
            {playerCount === 2
              ? "5 factories"
              : playerCount === 3
                ? "7 factories"
                : "9 factories"}
          </p>
        </div>

        {/* Player names */}
        <div className="mb-6 space-y-3">
          <label className="block text-sm text-[#8899aa] mb-1 font-medium">
            Player Names
          </label>
          {Array.from({ length: playerCount }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: playerColors[i] }}
              />
              <input
                type="text"
                value={playerNames[i]}
                onChange={(e) => handleNameChange(i, e.target.value)}
                maxLength={16}
                className="w-full bg-[var(--azul-surface)] border border-[rgba(255,255,255,0.08)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--azul-accent)] transition-colors"
                placeholder={`Player ${i + 1}`}
              />
            </div>
          ))}
        </div>

        {/* Variant toggle */}
        <div className="mb-8 flex items-center justify-between py-3 px-4 bg-[var(--azul-surface)] rounded-lg">
          <div>
            <span className="text-sm font-medium">Gray Wall Variant</span>
            <p className="text-xs text-[#556677] mt-0.5">
              Free tile placement on wall
            </p>
          </div>
          <button
            onClick={() => setUseVariant(!useVariant)}
            className={`w-12 h-6 rounded-full transition-all relative ${
              useVariant ? "bg-[var(--azul-accent)]" : "bg-[#2a3a55]"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${
                useVariant ? "left-[26px]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {/* Start button */}
        <button onClick={handleStart} className="btn-primary w-full text-base py-3">
          Start Game
        </button>
      </div>

      <p
        className="relative z-10 mt-8 text-[#445566] text-xs animate-fadeIn"
        style={{ animationDelay: "0.2s" }}
      >
        Local multiplayer — take turns on this device
      </p>
    </div>
  );
}
