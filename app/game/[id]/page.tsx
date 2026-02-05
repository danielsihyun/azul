"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import usePartySocket from "partysocket/react";
import {
  WALL_PATTERN,
  FLOOR_PENALTIES,
  TILE_COLOR_HEX,
  PLAYER_COLORS,
} from "@/lib/constants";

// ─── Types (matching server) ────────────────────────────────
enum TileColor {
  Blue = "blue",
  Yellow = "yellow",
  Red = "red",
  Black = "black",
  Cyan = "cyan",
}

enum GamePhase {
  Lobby = "lobby",
  FactoryOffer = "factoryOffer",
  WallTiling = "wallTiling",
  GameOver = "gameOver",
}

interface PlayerState {
  id: string;
  name: string;
  score: number;
  patternLines: { size: number; tiles: TileColor[]; color: TileColor | null }[];
  wall: (TileColor | null)[][];
  floorLine: (TileColor | "starter")[];
  hasStartingMarker: boolean;
  connected: boolean;
}

interface RoomState {
  id: string;
  phase: GamePhase;
  round: number;
  currentPlayerIndex: number;
  players: PlayerState[];
  factories: { id: number; tiles: TileColor[] }[];
  centerPool: TileColor[];
  centerHasStartingMarker: boolean;
  hostId: string;
  pendingTiles: TileColor[];
  pendingColor: TileColor | null;
  pendingPlayerId: string | null;
}

type ServerMessage =
  | { type: "state"; state: RoomState; validLines: number[] }
  | { type: "error"; message: string }
  | { type: "joined"; playerId: string };

// ─── Tile Component ─────────────────────────────────────────
function Tile({
  color,
  size = "normal",
  onClick,
  selected,
  className = "",
  messy = false,
  seed = 0,
}: {
  color: TileColor | "starter" | null;
  size?: "normal" | "small" | "mini" | "xs";
  onClick?: () => void;
  selected?: boolean;
  className?: string;
  messy?: boolean;
  seed?: number;
}) {
  if (!color) return null;

  const sizeClasses = {
    normal: "w-7 h-7 sm:w-8 sm:h-8",
    small: "w-6 h-6 sm:w-7 sm:h-7",
    mini: "w-5 h-5 sm:w-6 sm:h-6",
    xs: "w-4 h-4",
  };

  // Generate subtle random rotation based on seed
  const getMessyStyle = () => {
    if (!messy) return {};
    const rotation = ((seed * 17) % 9) - 4; // -4 to 4 degrees
    return { transform: `rotate(${rotation}deg)` };
  };

  if (color === "starter") {
    return (
      <div
        className={`${sizeClasses[size]} rounded bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center font-bold text-gray-800 text-[8px] shadow-md flex-shrink-0 ${className}`}
        style={getMessyStyle()}
        onClick={onClick}
      >
        1
      </div>
    );
  }

  const colorStyles: Record<TileColor, string> = {
    blue: "from-blue-500 to-blue-700",
    yellow: "from-yellow-400 to-yellow-600",
    red: "from-red-500 to-red-700",
    black: "from-gray-700 to-gray-900",
    cyan: "from-teal-400 to-teal-600",
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded bg-gradient-to-br ${colorStyles[color]} shadow-md border border-white/20 flex-shrink-0 ${selected ? "ring-2 ring-white" : ""} ${className}`}
      style={getMessyStyle()}
      onClick={onClick}
    />
  );
}

// ─── Factory Display ────────────────────────────────────────
function FactoryDisplay({
  factory,
  onSelectColor,
  isInteractive,
  compact,
}: {
  factory: { id: number; tiles: TileColor[] };
  onSelectColor: (factoryId: number, color: TileColor) => void;
  isInteractive: boolean;
  compact?: boolean;
}) {
  const size = compact ? "w-16 h-16 sm:w-20 sm:h-20" : "w-20 h-20 sm:w-24 sm:h-24";

  if (factory.tiles.length === 0) {
    return (
      <div className={`${size} rounded-full bg-[#1a2d4d] border-2 border-[#2a4a6e] opacity-40 flex items-center justify-center`}>
        <span className="text-[10px] text-[#556677]">Empty</span>
      </div>
    );
  }

  return (
    <div className={`${size} rounded-full bg-gradient-to-br from-[#1e3456] to-[#152845] border-2 border-[#2a4a6e] grid grid-cols-2 place-items-center p-2`}>
      {factory.tiles.map((color, i) => (
        <Tile
          key={i}
          color={color}
          size="mini"
          messy
          seed={factory.id * 10 + i}
          onClick={() => isInteractive && onSelectColor(factory.id, color)}
          className={isInteractive ? "cursor-pointer hover:scale-110 transition-transform" : ""}
        />
      ))}
    </div>
  );
}

// ─── Center Pool ────────────────────────────────────────────
function CenterPool({
  tiles,
  hasStartingMarker,
  onSelectColor,
  isInteractive,
}: {
  tiles: TileColor[];
  hasStartingMarker: boolean;
  onSelectColor: (color: TileColor) => void;
  isInteractive: boolean;
}) {
  const [expandedColor, setExpandedColor] = useState<TileColor | null>(null);

  const grouped = useMemo(() => {
    const groups: Partial<Record<TileColor, number>> = {};
    for (const tile of tiles) {
      groups[tile] = (groups[tile] || 0) + 1;
    }
    return groups;
  }, [tiles]);

  if (tiles.length === 0 && !hasStartingMarker) {
    return (
      <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-[#0c1a2e] border-2 border-dashed border-[#2a4a6e] flex items-center justify-center">
        <span className="text-[10px] text-[#445566]">Center</span>
      </div>
    );
  }

  const handleClick = (color: TileColor) => {
    if (!isInteractive) return;
    
    if (expandedColor === color) {
      onSelectColor(color);
      setExpandedColor(null);
    } else {
      setExpandedColor(color);
    }
  };

  return (
    <div className="min-w-24 min-h-24 sm:min-w-32 sm:min-h-32 rounded-full bg-[#0c1a2e] border-2 border-[#2a4a6e] flex flex-wrap items-center justify-center gap-3 p-3 sm:p-4 relative">
      {hasStartingMarker && <Tile color="starter" size="mini" messy seed={99} />}
      {Object.entries(grouped).map(([color, count], groupIndex) => {
        const isExpanded = expandedColor === color;
        const tileColor = color as TileColor;
        
        return (
          <div
            key={color}
            className="relative"
            onMouseEnter={() => !expandedColor && setExpandedColor(tileColor)}
            onMouseLeave={() => setExpandedColor(null)}
          >
            {isExpanded ? (
              // Expanded view - stack vertically upward
              <button
                onClick={() => handleClick(tileColor)}
                className={`relative transition-all ${isInteractive ? "cursor-pointer" : ""}`}
                style={{ 
                  width: '24px',
                  height: `${24 + (count! - 1) * 8}px`,
                }}
              >
                {Array.from({ length: count! }).map((_, i) => {
                  const seed = color.charCodeAt(0) + i;
                  const rotation = ((seed * 13) % 7) - 3;
                  const offsetX = ((seed * 7) % 5) - 2;
                  
                  return (
                    <div
                      key={i}
                      className="absolute left-0 transition-all duration-200"
                      style={{
                        bottom: `${i * 8}px`,
                        transform: `translateX(${offsetX}px) rotate(${rotation}deg)`,
                        zIndex: count! - i,
                      }}
                    >
                      <Tile color={tileColor} size="mini" />
                    </div>
                  );
                })}
              </button>
            ) : (
              // Stacked messy view
              <button
                onClick={() => handleClick(tileColor)}
                className={`relative transition-all ${isInteractive ? "cursor-pointer hover:scale-105" : ""}`}
                style={{ 
                  width: '28px',
                  height: '28px',
                }}
              >
                {Array.from({ length: Math.min(count!, 4) }).map((_, i) => {
                  const seed = color.charCodeAt(0) + i + groupIndex * 5;
                  const offsetX = ((seed * 7) % 7) - 3;
                  const offsetY = ((seed * 11) % 7) - 3;
                  const rotation = ((seed * 13) % 13) - 6;
                  
                  return (
                    <div
                      key={i}
                      className="absolute transition-transform"
                      style={{
                        left: '50%',
                        top: '50%',
                        transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg)`,
                        zIndex: i,
                      }}
                    >
                      <Tile color={tileColor} size="mini" />
                    </div>
                  );
                })}
                {count! > 1 && (
                  <div className="absolute -top-1.5 -right-1.5 bg-[#4a9eff] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center z-10 shadow-md">
                    {count}
                  </div>
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Factory Circle ─────────────────────────────────────────
function FactoryCircle({
  factories,
  centerPool,
  centerHasStartingMarker,
  onSelectFactoryColor,
  onSelectCenterColor,
  isInteractive,
}: {
  factories: RoomState["factories"];
  centerPool: TileColor[];
  centerHasStartingMarker: boolean;
  onSelectFactoryColor: (factoryId: number, color: TileColor) => void;
  onSelectCenterColor: (color: TileColor) => void;
  isInteractive: boolean;
}) {
  const count = factories.length;
  const mobileRadius = count <= 5 ? 70 : count <= 7 ? 85 : 95;
  const desktopRadius = count <= 5 ? 110 : count <= 7 ? 130 : 150;

  return (
    <div className="relative flex items-center justify-center" style={{ width: '100%', height: `${mobileRadius * 2 + 80}px` }}>
      {factories.map((factory, i) => {
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        const mobileX = Math.cos(angle) * mobileRadius;
        const mobileY = Math.sin(angle) * mobileRadius;
        const desktopX = Math.cos(angle) * desktopRadius;
        const desktopY = Math.sin(angle) * desktopRadius;

        return (
          <div key={factory.id} className="absolute" style={{ left: '50%', top: '50%' }}>
            <div className="sm:hidden" style={{ transform: `translate(calc(-50% + ${mobileX}px), calc(-50% + ${mobileY}px))` }}>
              <FactoryDisplay factory={factory} onSelectColor={onSelectFactoryColor} isInteractive={isInteractive} compact />
            </div>
            <div className="hidden sm:block" style={{ transform: `translate(calc(-50% + ${desktopX}px), calc(-50% + ${desktopY}px))` }}>
              <FactoryDisplay factory={factory} onSelectColor={onSelectFactoryColor} isInteractive={isInteractive} />
            </div>
          </div>
        );
      })}

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <CenterPool tiles={centerPool} hasStartingMarker={centerHasStartingMarker} onSelectColor={onSelectCenterColor} isInteractive={isInteractive} />
      </div>
    </div>
  );
}

// ─── Pattern Lines ──────────────────────────────────────────
function PatternLines({
  patternLines,
  validTargetLines,
  onSelectLine,
  isCurrentPlayer,
  compact,
}: {
  patternLines: PlayerState["patternLines"];
  validTargetLines: number[];
  onSelectLine: (lineIndex: number) => void;
  isCurrentPlayer: boolean;
  compact?: boolean;
}) {
  const slotSize = compact ? "w-5 h-5" : "w-8 h-8";
  const tileInnerSize = compact ? "w-4 h-4" : "w-7 h-7";

  const colorStyles: Record<string, string> = {
    blue: "from-blue-500 to-blue-700",
    yellow: "from-yellow-400 to-yellow-600",
    red: "from-red-500 to-red-700",
    black: "from-gray-700 to-gray-900",
    cyan: "from-teal-400 to-teal-600",
  };

  return (
    <div className="space-y-0.5">
      {patternLines.map((line, rowIndex) => {
        const isValid = validTargetLines.includes(rowIndex);
        const spaceLeft = line.size - line.tiles.length;
        return (
          <div key={rowIndex} className="flex items-center justify-end gap-0.5">
            {isValid && spaceLeft > 0 && !compact && (
              <span className="text-[8px] text-[#4a9eff] mr-1">{spaceLeft}</span>
            )}
            {Array.from({ length: line.size }).map((_, slotIndex) => {
              const tileIndex = line.size - 1 - slotIndex;
              const hasTile = tileIndex < line.tiles.length;
              const tileColor = hasTile ? line.tiles[tileIndex] : null;
              return (
                <div
                  key={slotIndex}
                  onClick={() => isCurrentPlayer && isValid && onSelectLine(rowIndex)}
                  className={`${slotSize} rounded border flex-shrink-0 ${
                    hasTile
                      ? "border-transparent"
                      : isValid
                        ? "border-[#4a9eff] bg-[rgba(74,158,255,0.15)] cursor-pointer hover:bg-[rgba(74,158,255,0.3)]"
                        : "border-dashed border-[#2a4a6e]"
                  } flex items-center justify-center`}
                >
                  {hasTile && tileColor && (
                    <div 
                      className={`${tileInnerSize} rounded bg-gradient-to-br ${colorStyles[tileColor]} shadow-md border border-white/20`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Wall Display ───────────────────────────────────────────
function WallDisplay({ wall, compact }: { wall: (TileColor | null)[][]; compact?: boolean }) {
  const cellSize = compact ? "w-5 h-5" : "w-8 h-8";
  const tileInnerSize = compact ? "w-4 h-4" : "w-7 h-7";

  return (
    <div className="grid grid-cols-5 gap-0.5">
      {Array.from({ length: 5 }).map((_, row) =>
        Array.from({ length: 5 }).map((_, col) => {
          const placed = wall[row][col];
          const expectedColor = WALL_PATTERN[row][col];

          return (
            <div
              key={`${row}-${col}`}
              className={`${cellSize} rounded-sm border flex-shrink-0 flex items-center justify-center ${placed ? "border-white/30" : "border-white/5"}`}
              style={!placed ? { background: `${TILE_COLOR_HEX[expectedColor]}22` } : undefined}
            >
              {placed && (
                <div
                  className={`${tileInnerSize} rounded-sm`}
                  style={{
                    background: `linear-gradient(135deg, ${TILE_COLOR_HEX[placed]}dd, ${TILE_COLOR_HEX[placed]})`,
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Floor Line ─────────────────────────────────────────────
function FloorLine({
  floorLine,
  isValidTarget,
  onSelectFloor,
  isCurrentPlayer,
  compact,
}: {
  floorLine: (TileColor | "starter")[];
  isValidTarget: boolean;
  onSelectFloor: () => void;
  isCurrentPlayer: boolean;
  compact?: boolean;
}) {
  const slotSize = compact ? "w-5 h-5" : "w-8 h-8";
  const tileInnerSize = compact ? "w-4 h-4" : "w-7 h-7";

  const colorStyles: Record<string, string> = {
    blue: "from-blue-500 to-blue-700",
    yellow: "from-yellow-400 to-yellow-600",
    red: "from-red-500 to-red-700",
    black: "from-gray-700 to-gray-900",
    cyan: "from-teal-400 to-teal-600",
  };

  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: 7 }).map((_, i) => {
        const tile = floorLine[i] || null;
        return (
          <div
            key={i}
            onClick={() => isCurrentPlayer && isValidTarget && onSelectFloor()}
            className={`${slotSize} rounded border flex-shrink-0 flex items-center justify-center text-[8px] font-semibold ${
              tile
                ? "border-white/20"
                : isValidTarget
                  ? "border-[#4a9eff] bg-[rgba(74,158,255,0.15)] cursor-pointer hover:bg-[rgba(74,158,255,0.3)]"
                  : "border-dashed border-[#2a4a6e] text-red-400/50"
            }`}
          >
            {tile ? (
              tile === "starter" ? (
                <div className={`${tileInnerSize} rounded bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center font-bold text-gray-800 text-[8px]`}>
                  1
                </div>
              ) : (
                <div className={`${tileInnerSize} rounded bg-gradient-to-br ${colorStyles[tile]} shadow-md border border-white/20`} />
              )
            ) : (
              FLOOR_PENALTIES[i]
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Player Board ───────────────────────────────────────────
function PlayerBoard({
  player,
  playerIndex,
  isCurrentTurn,
  isYou,
  validTargetLines,
  onSelectLine,
  onSelectFloor,
  compact,
}: {
  player: PlayerState;
  playerIndex: number;
  isCurrentTurn: boolean;
  isYou: boolean;
  validTargetLines: number[];
  onSelectLine: (lineIndex: number) => void;
  onSelectFloor: () => void;
  compact?: boolean;
}) {
  const isFloorValid = validTargetLines.includes(-1);

  if (compact) {
    return (
      <div className={`bg-[#132240] rounded-lg p-2 sm:p-3 border ${isCurrentTurn ? "border-[#4a9eff] shadow-lg shadow-blue-500/20" : "border-white/5"} ${!player.connected ? "opacity-50" : ""}`}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: PLAYER_COLORS[playerIndex] }} />
            <span className="font-semibold text-[10px] sm:text-xs truncate max-w-[60px]">{player.name}</span>
            {isCurrentTurn && <span className="text-[7px] bg-[#4a9eff] text-white px-1 py-0.5 rounded-full">TURN</span>}
            {!player.connected && <span className="text-[7px] text-red-400">(disconnected)</span>}
          </div>
          <span className="text-sm font-bold text-[#c9a84c]">{player.score}</span>
        </div>
        <div className="flex gap-1.5 items-start">
          <PatternLines patternLines={player.patternLines} validTargetLines={[]} onSelectLine={() => {}} isCurrentPlayer={false} compact />
          <WallDisplay wall={player.wall} compact />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-[#132240] rounded-xl p-3 sm:p-4 border ${isCurrentTurn ? "border-[#4a9eff] shadow-lg shadow-blue-500/20" : "border-white/5"}`}>
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: PLAYER_COLORS[playerIndex] }} />
          <span className="font-semibold text-sm sm:text-base">{player.name} {isYou && "(You)"}</span>
          {isCurrentTurn && <span className="text-[9px] bg-[#4a9eff] text-white px-1.5 py-0.5 rounded-full">YOUR TURN</span>}
          {player.hasStartingMarker && <span className="text-[9px] bg-[#555] text-white px-1.5 py-0.5 rounded-full">1ST</span>}
        </div>
        <span className="text-xl sm:text-2xl font-bold text-[#c9a84c]">{player.score}</span>
      </div>

      <div className="flex gap-2 sm:gap-3 items-start justify-center">
        <PatternLines patternLines={player.patternLines} validTargetLines={isYou && isCurrentTurn ? validTargetLines : []} onSelectLine={onSelectLine} isCurrentPlayer={isYou && isCurrentTurn} />
        <div className="w-px bg-[rgba(255,255,255,0.1)] self-stretch" />
        <WallDisplay wall={player.wall} />
      </div>

      <div className="mt-2 pt-2 border-t border-[rgba(255,255,255,0.06)]">
        <FloorLine floorLine={player.floorLine} isValidTarget={isYou && isCurrentTurn && isFloorValid} onSelectFloor={onSelectFloor} isCurrentPlayer={isYou && isCurrentTurn} />
      </div>
    </div>
  );
}

// ─── Lobby View ─────────────────────────────────────────────
function LobbyView({
  roomCode,
  state,
  playerId,
  onStart,
}: {
  roomCode: string;
  state: RoomState;
  playerId: string | null;
  onStart: () => void;
}) {
  const isHost = playerId === state.hostId;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="bg-[#132240] border border-white/10 rounded-xl p-6 w-full max-w-sm text-center">
        <h2 className="text-xl font-semibold mb-2">Room Code</h2>
        <div className="text-4xl font-mono font-bold tracking-widest text-[#4a9eff] mb-6">{roomCode}</div>

        <div className="mb-6">
          <p className="text-sm text-[#8899aa] mb-3">Players ({state.players.length}/4)</p>
          <div className="space-y-2">
            {state.players.map((player, i) => (
              <div key={player.id} className="flex items-center justify-between bg-[#1a2d4d] rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: PLAYER_COLORS[i] }} />
                  <span className="text-sm">{player.name}</span>
                  {player.id === playerId && <span className="text-[10px] text-[#4a9eff]">(You)</span>}
                  {player.id === state.hostId && <span className="text-[10px] text-[#c9a84c]">★ Host</span>}
                </div>
                {player.connected ? (
                  <span className="text-[10px] text-green-400">Connected</span>
                ) : (
                  <span className="text-[10px] text-red-400">Disconnected</span>
                )}
              </div>
            ))}
            {state.players.length < 4 && (
              <div className="border border-dashed border-[#2a4a6e] rounded-lg px-3 py-2 text-sm text-[#556677]">
                Waiting for players...
              </div>
            )}
          </div>
        </div>

        {isHost ? (
          <button
            onClick={onStart}
            disabled={state.players.length < 2}
            className="w-full bg-[#4a9eff] text-white font-semibold py-3 rounded-lg hover:bg-[#3a8eef] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.players.length < 2 ? "Need 2+ players" : "Start Game"}
          </button>
        ) : (
          <p className="text-sm text-[#8899aa]">Waiting for host to start...</p>
        )}
      </div>
    </div>
  );
}

// ─── Pending Tiles Bar ──────────────────────────────────────
function PendingTilesBar({ tiles, color, onSendAllToFloor }: { tiles: TileColor[]; color: TileColor; onSendAllToFloor: () => void }) {
  return (
    <div className="bg-[rgba(74,158,255,0.15)] border border-[#4a9eff] rounded-lg px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8899aa]">Place {tiles.length}:</span>
          <div className="flex gap-1">{tiles.map((_, i) => <Tile key={i} color={color} size="mini" />)}</div>
        </div>
        <button onClick={onSendAllToFloor} className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 bg-red-500/10 rounded">
          All to Floor
        </button>
      </div>
    </div>
  );
}

// ─── Game Over View ─────────────────────────────────────────
function GameOverView({ state, onBackToLobby }: { state: RoomState; onBackToLobby: () => void }) {
  const sorted = [...state.players].sort((a, b) => b.score - a.score);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#132240] rounded-xl p-6 max-w-md w-full border border-white/10">
        <h2 className="text-2xl font-bold text-center mb-6">Game Over</h2>
        <div className="space-y-3 mb-6">
          {sorted.map((player, i) => {
            const originalIndex = state.players.findIndex((p) => p.id === player.id);
            return (
              <div key={player.id} className={`p-3 rounded-lg ${i === 0 ? "bg-[rgba(74,158,255,0.15)] border border-[#4a9eff]" : "bg-[#1a2d4d]"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {i === 0 && <span>👑</span>}
                    <div className="w-3 h-3 rounded-full" style={{ background: PLAYER_COLORS[originalIndex] }} />
                    <span className="font-semibold">{player.name}</span>
                  </div>
                  <span className="text-xl font-bold text-[#c9a84c]">{player.score}</span>
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={onBackToLobby} className="w-full bg-[#4a9eff] text-white font-semibold py-3 rounded-lg">
          Back to Lobby
        </button>
      </div>
    </div>
  );
}

// ─── Main Game Content ──────────────────────────────────────
function GameContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomCode = params.id as string;
  const playerName = searchParams.get("name") || "Player";

  const [state, setState] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [validLines, setValidLines] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  // Connect to PartyKit
  const socket = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999",
    room: roomCode,
    onOpen() {
      setConnected(true);
    },
    onMessage(event) {
      const msg: ServerMessage = JSON.parse(event.data);
      if (msg.type === "state") {
        setState(msg.state);
        setValidLines(msg.validLines);
      } else if (msg.type === "joined") {
        setPlayerId(msg.playerId);
      } else if (msg.type === "error") {
        setError(msg.message);
        setTimeout(() => setError(null), 3000);
      }
    },
  });

  // Join room when connected
  useEffect(() => {
    if (connected && socket) {
      socket.send(JSON.stringify({ type: "join", playerName }));
    }
  }, [connected, socket, playerName]);

  const handleStart = useCallback(() => {
    socket?.send(JSON.stringify({ type: "start" }));
  }, [socket]);

  const handleFactoryColorSelect = useCallback((factoryId: number, color: TileColor) => {
    socket?.send(JSON.stringify({ type: "pickup", source: { type: "factory", factoryId }, color }));
  }, [socket]);

  const handleCenterColorSelect = useCallback((color: TileColor) => {
    socket?.send(JSON.stringify({ type: "pickup", source: { type: "center" }, color }));
  }, [socket]);

  const handleSelectLine = useCallback((targetLine: number) => {
    socket?.send(JSON.stringify({ type: "place", targetLine }));
  }, [socket]);

  const handleSelectFloor = useCallback(() => {
    handleSelectLine(-1);
  }, [handleSelectLine]);

  const handleSendAllToFloor = useCallback(() => {
    handleSelectLine(-1);
  }, [handleSelectLine]);

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c1a2e]">
        <div className="text-[#556677]">Connecting to room {roomCode}...</div>
      </div>
    );
  }

  // Lobby phase
  if (state.phase === GamePhase.Lobby) {
    return <LobbyView roomCode={roomCode} state={state} playerId={playerId} onStart={handleStart} />;
  }

  // Find current user
  const myIndex = state.players.findIndex((p) => p.id === playerId);
  const myPlayer = myIndex >= 0 ? state.players[myIndex] : null;
  const opponents = state.players.filter((_, i) => i !== myIndex);
  const opponentIndices = state.players.map((_, i) => i).filter((i) => i !== myIndex);

  const isMyTurn = state.currentPlayerIndex === myIndex;
  const isPlacingTiles = state.pendingPlayerId === playerId && state.pendingTiles.length > 0;
  const canSelectTiles = isMyTurn && !isPlacingTiles && state.phase === GamePhase.FactoryOffer;
  const currentPlayer = state.players[state.currentPlayerIndex];

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-[#0c1a2e] overflow-x-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-3 py-2 bg-[#132240] border-b border-white/5">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div>
            <h1 className="text-lg font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
              <span className="text-[#4a9eff]">A</span><span className="text-[#c9a84c]">Z</span><span className="text-[#3ab8b0]">U</span><span className="text-[#c43a3a]">L</span>
            </h1>
            <span className="text-[9px] text-[#556677]">Room: {roomCode}</span>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-[#556677]">Round {state.round}</div>
            <div className="text-xs font-medium text-[#8899aa]">
              {isMyTurn ? (isPlacingTiles ? "Place your tiles" : "Your turn!") : `${currentPlayer?.name}'s turn`}
            </div>
          </div>
        </div>
      </header>

      {/* Error toast */}
      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm z-50">
          {error}
        </div>
      )}

      {/* Pending tiles */}
      {isPlacingTiles && state.pendingColor && (
        <div className="flex-shrink-0 px-3 py-2">
          <div className="max-w-4xl mx-auto">
            <PendingTilesBar tiles={state.pendingTiles} color={state.pendingColor} onSendAllToFloor={handleSendAllToFloor} />
          </div>
        </div>
      )}

      {/* Main game */}
      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-2 py-2 gap-2 overflow-y-auto">
        {/* Opponents */}
        <section className="flex-shrink-0">
          <div className={`grid gap-2 ${opponents.length === 1 ? "grid-cols-1 max-w-xs mx-auto" : opponents.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {opponents.map((player, i) => (
              <PlayerBoard
                key={player.id}
                player={player}
                playerIndex={opponentIndices[i]}
                isCurrentTurn={state.currentPlayerIndex === opponentIndices[i]}
                isYou={false}
                validTargetLines={[]}
                onSelectLine={() => {}}
                onSelectFloor={() => {}}
                compact
              />
            ))}
          </div>
        </section>

        {/* Factories */}
        <section className="flex-1 flex items-center justify-center">
          <FactoryCircle
            factories={state.factories}
            centerPool={state.centerPool}
            centerHasStartingMarker={state.centerHasStartingMarker}
            onSelectFactoryColor={handleFactoryColorSelect}
            onSelectCenterColor={handleCenterColorSelect}
            isInteractive={canSelectTiles}
          />
        </section>

        {/* Your board */}
        {myPlayer && (
          <section className="flex-shrink-0 pb-2">
            <PlayerBoard
              player={myPlayer}
              playerIndex={myIndex}
              isCurrentTurn={isMyTurn}
              isYou={true}
              validTargetLines={isPlacingTiles ? validLines : []}
              onSelectLine={handleSelectLine}
              onSelectFloor={handleSelectFloor}
            />
          </section>
        )}
      </main>

      {/* Game over */}
      {state.phase === GamePhase.GameOver && (
        <GameOverView state={state} onBackToLobby={() => window.location.href = "/"} />
      )}
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0c1a2e]"><div className="text-[#556677]">Loading...</div></div>}>
      <GameContent />
    </Suspense>
  );
}