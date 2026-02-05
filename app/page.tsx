"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LobbyPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");

  const generateRoomCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const handleCreate = () => {
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }
    const code = generateRoomCode();
    router.push(`/game/${code}?name=${encodeURIComponent(playerName.trim())}`);
  };

  const handleJoin = () => {
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!roomCode.trim() || roomCode.trim().length !== 4) {
      setError("Please enter a 4-character room code");
      return;
    }
    router.push(`/game/${roomCode.toUpperCase().trim()}?name=${encodeURIComponent(playerName.trim())}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(255,255,255,0.5) 40px, rgba(255,255,255,0.5) 41px)`,
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse,rgba(74,158,255,0.08),transparent_70%)]" />

      {/* Title */}
      <div className="relative z-10 text-center mb-8">
        <h1
          className="text-6xl sm:text-7xl font-bold tracking-tight mb-3"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          <span className="text-[#4a9eff]">A</span>
          <span className="text-[#c9a84c]">Z</span>
          <span className="text-[#3ab8b0]">U</span>
          <span className="text-[#c43a3a]">L</span>
        </h1>
        <p className="text-[#8899aa] text-base sm:text-lg tracking-wide">
          Online Multiplayer
        </p>
      </div>

      {/* Main Card */}
      <div className="relative z-10 bg-[#132240] border border-white/10 rounded-xl p-6 w-full max-w-sm">
        {mode === "menu" && (
          <div className="space-y-4">
            <button
              onClick={() => setMode("create")}
              className="w-full bg-[#4a9eff] text-white font-semibold py-3 rounded-lg hover:bg-[#3a8eef] transition-colors text-base"
            >
              Create Room
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full bg-[#1a2d4d] text-[#c0d0e0] font-semibold py-3 rounded-lg hover:bg-[#243a5e] border border-white/10 transition-colors text-base"
            >
              Join Room
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className="space-y-4">
            <button
              onClick={() => { setMode("menu"); setError(""); }}
              className="text-sm text-[#8899aa] hover:text-white mb-2"
            >
              ← Back
            </button>
            
            <h2 className="text-lg font-semibold">Create a Room</h2>
            
            <div>
              <label className="block text-sm text-[#8899aa] mb-2">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => { setPlayerName(e.target.value); setError(""); }}
                placeholder="Enter your name"
                maxLength={16}
                className="w-full bg-[#1a2d4d] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#4a9eff] transition-colors"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              onClick={handleCreate}
              className="w-full bg-[#4a9eff] text-white font-semibold py-3 rounded-lg hover:bg-[#3a8eef] transition-colors"
            >
              Create Room
            </button>
            
            <p className="text-xs text-[#556677] text-center">
              A room code will be generated for others to join
            </p>
          </div>
        )}

        {mode === "join" && (
          <div className="space-y-4">
            <button
              onClick={() => { setMode("menu"); setError(""); }}
              className="text-sm text-[#8899aa] hover:text-white mb-2"
            >
              ← Back
            </button>
            
            <h2 className="text-lg font-semibold">Join a Room</h2>
            
            <div>
              <label className="block text-sm text-[#8899aa] mb-2">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => { setPlayerName(e.target.value); setError(""); }}
                placeholder="Enter your name"
                maxLength={16}
                className="w-full bg-[#1a2d4d] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#4a9eff] transition-colors"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm text-[#8899aa] mb-2">Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => { setRoomCode(e.target.value.toUpperCase()); setError(""); }}
                placeholder="XXXX"
                maxLength={4}
                className="w-full bg-[#1a2d4d] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#4a9eff] transition-colors uppercase tracking-widest text-center text-lg font-mono"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              onClick={handleJoin}
              className="w-full bg-[#4a9eff] text-white font-semibold py-3 rounded-lg hover:bg-[#3a8eef] transition-colors"
            >
              Join Room
            </button>
          </div>
        )}
      </div>

      <p className="relative z-10 mt-6 text-[#445566] text-xs">
        2-4 players • Real-time multiplayer
      </p>
    </div>
  );
}