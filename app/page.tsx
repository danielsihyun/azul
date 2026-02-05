"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  GameState,
  GamePhase,
  TileColor,
  GameMove,
  AvailableMove,
} from "@/lib/types";
import {
  createGame,
  executeMove,
  getAvailableMoves,
  validateMove,
} from "@/lib/gameEngine";
import { calculateEndgameScoring } from "@/lib/scoring";
import {
  WALL_PATTERN,
  FLOOR_PENALTIES,
  TILE_COLOR_HEX,
  PLAYER_COLORS,
} from "@/lib/constants";

// ─── Tile Component ─────────────────────────────────────────
function Tile({
  color,
  size = "normal",
  onClick,
  selected,
  className = "",
}: {
  color: TileColor | "starter" | null;
  size?: "normal" | "small" | "mini";
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}) {
  if (!color) return null;

  const sizeClasses = {
    normal: "w-8 h-8 sm:w-9 sm:h-9",
    small: "w-6 h-6 sm:w-7 sm:h-7",
    mini: "w-5 h-5 sm:w-6 sm:h-6",
  };

  if (color === "starter") {
    return (
      <div
        className={`${sizeClasses[size]} rounded bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center font-bold text-gray-800 text-xs shadow-md ${className}`}
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
      className={`${sizeClasses[size]} rounded bg-gradient-to-br ${colorStyles[color]} shadow-md border border-white/20 ${selected ? "ring-2 ring-white ring-offset-1 ring-offset-[#0c1a2e]" : ""} ${className}`}
      onClick={onClick}
    />
  );
}

// ─── Factory Display ────────────────────────────────────────
function FactoryDisplay({
  factory,
  selectedColor,
  selectedSource,
  onSelectColor,
  isInteractive,
  compact,
}: {
  factory: { id: number; tiles: TileColor[] };
  selectedColor: TileColor | null;
  selectedSource: { type: string; id?: number } | null;
  onSelectColor: (factoryId: number, color: TileColor) => void;
  isInteractive: boolean;
  compact?: boolean;
}) {
  const isSelected =
    selectedSource?.type === "factory" && selectedSource?.id === factory.id;

  const size = compact ? "w-16 h-16 sm:w-20 sm:h-20" : "w-20 h-20 sm:w-24 sm:h-24";

  if (factory.tiles.length === 0) {
    return (
      <div
        className={`${size} rounded-full bg-[#1a2d4d] border-2 border-[#2a4a6e] opacity-40 flex items-center justify-center`}
      >
        <span className="text-[10px] text-[#556677]">Empty</span>
      </div>
    );
  }

  return (
    <div
      className={`${size} rounded-full bg-gradient-to-br from-[#1e3456] to-[#152845] border-2 ${isSelected ? "border-[#4a9eff] shadow-lg shadow-blue-500/30" : "border-[#2a4a6e]"} grid grid-cols-2 place-items-center p-2 transition-all`}
    >
      {factory.tiles.map((color, i) => (
        <Tile
          key={i}
          color={color}
          size="mini"
          onClick={() => isInteractive && onSelectColor(factory.id, color)}
          selected={isSelected && selectedColor === color}
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
  selectedColor,
  selectedSource,
  onSelectColor,
  isInteractive,
}: {
  tiles: TileColor[];
  hasStartingMarker: boolean;
  selectedColor: TileColor | null;
  selectedSource: { type: string; id?: number } | null;
  onSelectColor: (color: TileColor) => void;
  isInteractive: boolean;
}) {
  const isSelected = selectedSource?.type === "center";

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

  return (
    <div
      className={`min-w-20 min-h-20 sm:min-w-28 sm:min-h-28 max-w-32 rounded-full bg-[#0c1a2e] border-2 ${isSelected ? "border-[#4a9eff] shadow-lg shadow-blue-500/30" : "border-[#2a4a6e]"} flex flex-wrap items-center justify-center gap-1 p-2 sm:p-3 transition-all`}
    >
      {hasStartingMarker && <Tile color="starter" size="mini" />}
      {Object.entries(grouped).map(([color, count]) => (
        <button
          key={color}
          onClick={() => isInteractive && onSelectColor(color as TileColor)}
          className={`flex items-center gap-0.5 p-1 rounded transition-all ${
            isSelected && selectedColor === color
              ? "bg-[rgba(74,158,255,0.3)]"
              : isInteractive
                ? "hover:bg-[rgba(255,255,255,0.1)]"
                : ""
          }`}
        >
          <Tile color={color as TileColor} size="mini" />
          {count! > 1 && (
            <span className="text-[10px] text-[#8899aa] font-medium">
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Circular Factory Layout ────────────────────────────────
function FactoryCircle({
  factories,
  centerPool,
  centerHasStartingMarker,
  selectedColor,
  selectedSource,
  onSelectFactoryColor,
  onSelectCenterColor,
  isInteractive,
}: {
  factories: GameState["factories"];
  centerPool: TileColor[];
  centerHasStartingMarker: boolean;
  selectedColor: TileColor | null;
  selectedSource: { type: string; id?: number } | null;
  onSelectFactoryColor: (factoryId: number, color: TileColor) => void;
  onSelectCenterColor: (color: TileColor) => void;
  isInteractive: boolean;
}) {
  const count = factories.length;
  const mobileRadius = count <= 5 ? 70 : count <= 7 ? 85 : 95;
  const desktopRadius = count <= 5 ? 110 : count <= 7 ? 130 : 150;

  return (
    <div 
      className="relative flex items-center justify-center"
      style={{ 
        width: '100%',
        height: `${mobileRadius * 2 + 80}px`,
      }}
    >
      <style jsx>{`
        @media (min-width: 640px) {
          div {
            height: ${desktopRadius * 2 + 100}px !important;
          }
        }
      `}</style>
      
      {/* Factories in a circle */}
      {factories.map((factory, i) => {
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        const mobileX = Math.cos(angle) * mobileRadius;
        const mobileY = Math.sin(angle) * mobileRadius;
        const desktopX = Math.cos(angle) * desktopRadius;
        const desktopY = Math.sin(angle) * desktopRadius;
        
        return (
          <div
            key={factory.id}
            className="absolute"
            style={{
              left: '50%',
              top: '50%',
            }}
          >
            {/* Mobile */}
            <div 
              className="sm:hidden"
              style={{
                transform: `translate(calc(-50% + ${mobileX}px), calc(-50% + ${mobileY}px))`,
              }}
            >
              <FactoryDisplay
                factory={factory}
                selectedColor={selectedColor}
                selectedSource={selectedSource}
                onSelectColor={onSelectFactoryColor}
                isInteractive={isInteractive}
                compact
              />
            </div>
            {/* Desktop */}
            <div 
              className="hidden sm:block"
              style={{
                transform: `translate(calc(-50% + ${desktopX}px), calc(-50% + ${desktopY}px))`,
              }}
            >
              <FactoryDisplay
                factory={factory}
                selectedColor={selectedColor}
                selectedSource={selectedSource}
                onSelectColor={onSelectFactoryColor}
                isInteractive={isInteractive}
              />
            </div>
          </div>
        );
      })}

      {/* Center pool in the middle */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <CenterPool
          tiles={centerPool}
          hasStartingMarker={centerHasStartingMarker}
          selectedColor={selectedColor}
          selectedSource={selectedSource}
          onSelectColor={onSelectCenterColor}
          isInteractive={isInteractive}
        />
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
  patternLines: { size: number; tiles: TileColor[]; color: TileColor | null }[];
  validTargetLines: number[];
  onSelectLine: (lineIndex: number) => void;
  isCurrentPlayer: boolean;
  compact?: boolean;
}) {
  const slotSize = compact ? "w-4 h-4 sm:w-5 sm:h-5" : "w-6 h-6 sm:w-7 sm:h-7";

  return (
    <div className="space-y-0.5 sm:space-y-1">
      {patternLines.map((line, rowIndex) => {
        const isValid = validTargetLines.includes(rowIndex);
        return (
          <div key={rowIndex} className="flex items-center justify-end gap-0.5">
            {Array.from({ length: line.size }).map((_, slotIndex) => {
              const tileIndex = line.size - 1 - slotIndex;
              const hasTile = tileIndex < line.tiles.length;
              return (
                <div
                  key={slotIndex}
                  onClick={() => isCurrentPlayer && isValid && onSelectLine(rowIndex)}
                  className={`${slotSize} rounded border ${
                    hasTile
                      ? "border-transparent"
                      : isValid
                        ? "border-[#4a9eff] bg-[rgba(74,158,255,0.15)] cursor-pointer hover:bg-[rgba(74,158,255,0.3)]"
                        : "border-dashed border-[#2a4a6e]"
                  } flex items-center justify-center transition-all`}
                >
                  {hasTile && <Tile color={line.tiles[tileIndex]} size="mini" />}
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
function WallDisplay({
  wall,
  useVariant,
  compact,
}: {
  wall: (TileColor | null)[][];
  useVariant: boolean;
  compact?: boolean;
}) {
  const cellSize = compact ? "w-4 h-4 sm:w-5 sm:h-5" : "w-6 h-6 sm:w-7 sm:h-7";

  return (
    <div className="grid grid-cols-5 gap-0.5">
      {Array.from({ length: 5 }).map((_, row) =>
        Array.from({ length: 5 }).map((_, col) => {
          const placed = wall[row][col];
          const expectedColor = WALL_PATTERN[row][col];

          return (
            <div
              key={`${row}-${col}`}
              className={`${cellSize} rounded-sm border transition-all ${
                placed ? "border-white/30" : "border-white/5"
              }`}
              style={
                placed
                  ? {
                      background: `linear-gradient(135deg, ${TILE_COLOR_HEX[placed]}dd, ${TILE_COLOR_HEX[placed]})`,
                    }
                  : !useVariant
                    ? {
                        background: `${TILE_COLOR_HEX[expectedColor]}33`,
                      }
                    : { background: "rgba(255,255,255,0.03)" }
              }
            />
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
  const slotSize = compact ? "w-4 h-4 sm:w-5 sm:h-5" : "w-6 h-6 sm:w-7 sm:h-7";

  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: 7 }).map((_, i) => {
        const tile = floorLine[i] || null;
        return (
          <div
            key={i}
            onClick={() => isCurrentPlayer && isValidTarget && !tile && onSelectFloor()}
            className={`${slotSize} rounded border flex items-center justify-center text-[8px] sm:text-[9px] font-semibold transition-all ${
              tile
                ? "border-white/20"
                : isValidTarget
                  ? "border-[#4a9eff] bg-[rgba(74,158,255,0.15)] cursor-pointer hover:bg-[rgba(74,158,255,0.3)]"
                  : "border-dashed border-[#2a4a6e] text-red-400/50"
            }`}
          >
            {tile ? <Tile color={tile} size="mini" /> : FLOOR_PENALTIES[i]}
          </div>
        );
      })}
    </div>
  );
}

// ─── Opponent Board (Compact) ───────────────────────────────
function OpponentBoard({
  player,
  playerIndex,
  isCurrentTurn,
  useVariant,
}: {
  player: GameState["players"][0];
  playerIndex: number;
  isCurrentTurn: boolean;
  useVariant: boolean;
}) {
  return (
    <div
      className={`bg-[#132240] rounded-lg sm:rounded-xl p-2 sm:p-3 border ${
        isCurrentTurn ? "border-[#4a9eff] shadow-lg shadow-blue-500/20" : "border-white/5"
      } transition-all`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 sm:mb-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div
            className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full"
            style={{ background: PLAYER_COLORS[playerIndex] }}
          />
          <span className="font-semibold text-[10px] sm:text-xs truncate max-w-[60px] sm:max-w-[80px]">
            {player.name}
          </span>
          {isCurrentTurn && (
            <span className="text-[7px] sm:text-[9px] bg-[#4a9eff] text-white px-1 sm:px-1.5 py-0.5 rounded-full font-medium">
              TURN
            </span>
          )}
        </div>
        <span className="text-sm sm:text-lg font-bold text-[#c9a84c]">{player.score}</span>
      </div>

      {/* Board */}
      <div className="flex gap-1.5 sm:gap-2 items-start">
        <PatternLines
          patternLines={player.patternLines}
          validTargetLines={[]}
          onSelectLine={() => {}}
          isCurrentPlayer={false}
          compact
        />
        <WallDisplay wall={player.wall} useVariant={useVariant} compact />
      </div>

      {/* Floor indicator */}
      {player.floorLine.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1">
          <span className="text-[8px] text-[#556677]">Floor:</span>
          <span className="text-[9px] text-red-400">{player.floorLine.length}</span>
        </div>
      )}
    </div>
  );
}

// ─── Current Player Board (Full) ────────────────────────────
function CurrentPlayerBoard({
  player,
  playerIndex,
  isCurrentTurn,
  validTargetLines,
  onSelectLine,
  onSelectFloor,
  useVariant,
}: {
  player: GameState["players"][0];
  playerIndex: number;
  isCurrentTurn: boolean;
  validTargetLines: number[];
  onSelectLine: (lineIndex: number) => void;
  onSelectFloor: () => void;
  useVariant: boolean;
}) {
  const isFloorValid = validTargetLines.includes(-1);

  return (
    <div
      className={`bg-[#132240] rounded-xl p-3 sm:p-4 border ${
        isCurrentTurn ? "border-[#4a9eff] shadow-lg shadow-blue-500/20" : "border-white/5"
      } transition-all`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: PLAYER_COLORS[playerIndex] }}
          />
          <span className="font-semibold text-sm sm:text-base">{player.name}</span>
          {isCurrentTurn && (
            <span className="text-[9px] sm:text-[10px] bg-[#4a9eff] text-white px-1.5 sm:px-2 py-0.5 rounded-full font-medium">
              YOUR TURN
            </span>
          )}
          {player.hasStartingMarker && (
            <span className="text-[9px] sm:text-[10px] bg-[#555] text-white px-1.5 sm:px-2 py-0.5 rounded-full font-medium">
              1ST
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="text-xl sm:text-2xl font-bold text-[#c9a84c]">{player.score}</span>
          <span className="text-[10px] sm:text-xs text-[#556677] ml-1">pts</span>
        </div>
      </div>

      {/* Board grid: pattern lines + wall */}
      <div className="flex gap-2 sm:gap-3 items-start justify-center">
        <PatternLines
          patternLines={player.patternLines}
          validTargetLines={isCurrentTurn ? validTargetLines : []}
          onSelectLine={onSelectLine}
          isCurrentPlayer={isCurrentTurn}
        />
        <div className="w-px bg-[rgba(255,255,255,0.1)] self-stretch" />
        <WallDisplay wall={player.wall} useVariant={useVariant} />
      </div>

      {/* Floor line */}
      <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] sm:text-[10px] text-[#556677] uppercase tracking-wider">Floor Line</span>
        </div>
        <FloorLine
          floorLine={player.floorLine}
          isValidTarget={isCurrentTurn && isFloorValid}
          onSelectFloor={onSelectFloor}
          isCurrentPlayer={isCurrentTurn}
        />
      </div>
    </div>
  );
}

// ─── Endgame Summary ────────────────────────────────────────
function EndgameSummary({
  state,
  onNewGame,
}: {
  state: GameState;
  onNewGame: () => void;
}) {
  const scorings = state.players.map((p) => calculateEndgameScoring(p));
  scorings.sort((a, b) => b.totalScore - a.totalScore);

  const winnerIds = state.winner?.split(",") || [];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#132240] rounded-xl p-4 sm:p-6 max-w-md w-full border border-white/10">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4 sm:mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>
          Game Over
        </h2>

        <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
          {scorings.map((s) => {
            const isWinner = winnerIds.includes(s.playerId);
            const playerIndex = state.players.findIndex((p) => p.id === s.playerId);
            return (
              <div
                key={s.playerId}
                className={`p-3 rounded-lg ${
                  isWinner
                    ? "bg-[rgba(74,158,255,0.15)] border border-[#4a9eff]"
                    : "bg-[#1a2d4d]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {isWinner && <span>👑</span>}
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: PLAYER_COLORS[playerIndex] }}
                    />
                    <span className="font-semibold text-sm">{s.playerName}</span>
                  </div>
                  <span className="text-xl font-bold text-[#c9a84c]">{s.totalScore}</span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-[10px] text-[#8899aa]">
                  <div>
                    <div className="text-[#556677]">Base</div>
                    <div>{s.baseScore}</div>
                  </div>
                  <div>
                    <div className="text-[#556677]">Rows</div>
                    <div>+{s.horizontalBonus}</div>
                  </div>
                  <div>
                    <div className="text-[#556677]">Cols</div>
                    <div>+{s.verticalBonus}</div>
                  </div>
                  <div>
                    <div className="text-[#556677]">Colors</div>
                    <div>+{s.colorBonus}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onNewGame}
            className="flex-1 bg-[#4a9eff] text-white font-semibold py-2.5 rounded-lg hover:bg-[#3a8eef] transition-colors"
          >
            New Game
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="flex-1 bg-[#1a2d4d] text-[#8899aa] font-semibold py-2.5 rounded-lg hover:bg-[#243a5e] transition-colors"
          >
            Lobby
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN GAME PAGE CONTENT
// ═══════════════════════════════════════════════════════════════
function GamePageContent() {
  const searchParams = useSearchParams();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedColor, setSelectedColor] = useState<TileColor | null>(null);
  const [selectedSource, setSelectedSource] = useState<{
    type: "factory" | "center";
    id?: number;
  } | null>(null);
  const [availableMoves, setAvailableMoves] = useState<AvailableMove[]>([]);

  // For local version, player 0 is "you"
  const localPlayerIndex = 0;

  // Initialize game
  useEffect(() => {
    const playersParam = searchParams.get("players");
    const variantParam = searchParams.get("variant");
    if (playersParam) {
      try {
        const names = JSON.parse(playersParam) as string[];
        const variant = variantParam === "1";
        const state = createGame(names, variant);
        setGameState(state);
      } catch {
        const state = createGame(["You", "Opponent"]);
        setGameState(state);
      }
    } else {
      const state = createGame(["You", "Opponent"]);
      setGameState(state);
    }
  }, [searchParams]);

  // Compute available moves
  useEffect(() => {
    if (gameState && gameState.phase === GamePhase.FactoryOffer) {
      setAvailableMoves(getAvailableMoves(gameState));
    } else {
      setAvailableMoves([]);
    }
  }, [gameState]);

  const handleFactoryColorSelect = useCallback(
    (factoryId: number, color: TileColor) => {
      if (!gameState || gameState.phase !== GamePhase.FactoryOffer) return;

      if (
        selectedSource?.type === "factory" &&
        selectedSource.id === factoryId &&
        selectedColor === color
      ) {
        setSelectedColor(null);
        setSelectedSource(null);
      } else {
        setSelectedColor(color);
        setSelectedSource({ type: "factory", id: factoryId });
      }
    },
    [gameState, selectedSource, selectedColor]
  );

  const handleCenterColorSelect = useCallback(
    (color: TileColor) => {
      if (!gameState || gameState.phase !== GamePhase.FactoryOffer) return;

      if (selectedSource?.type === "center" && selectedColor === color) {
        setSelectedColor(null);
        setSelectedSource(null);
      } else {
        setSelectedColor(color);
        setSelectedSource({ type: "center" });
      }
    },
    [gameState, selectedSource, selectedColor]
  );

  const validTargetLines = useMemo(() => {
    if (!selectedColor || !selectedSource) return [];
    const move = availableMoves.find((m) => {
      if (m.color !== selectedColor) return false;
      if (m.source === "factory" && selectedSource.type === "factory") {
        return m.factoryId === selectedSource.id;
      }
      if (m.source === "center" && selectedSource.type === "center") {
        return true;
      }
      return false;
    });
    return move?.validTargetLines || [];
  }, [selectedColor, selectedSource, availableMoves]);

  const handleSelectLine = useCallback(
    (lineIndex: number) => {
      if (!gameState || !selectedColor || !selectedSource) return;

      const move: GameMove =
        selectedSource.type === "factory"
          ? {
              type: "factoryPick",
              factoryId: selectedSource.id!,
              color: selectedColor,
              targetLine: lineIndex,
            }
          : {
              type: "centerPick",
              color: selectedColor,
              targetLine: lineIndex,
            };

      const validation = validateMove(gameState, move);
      if (validation.valid) {
        try {
          const newState = executeMove(gameState, move);
          setGameState(newState);
          setSelectedColor(null);
          setSelectedSource(null);
        } catch (e) {
          console.error("Move execution failed:", e);
        }
      }
    },
    [gameState, selectedColor, selectedSource]
  );

  const handleSelectFloor = useCallback(() => {
    handleSelectLine(-1);
  }, [handleSelectLine]);

  const handleNewGame = useCallback(() => {
    if (!gameState) return;
    const names = gameState.players.map((p) => p.name);
    const newState = createGame(names, gameState.useVariantWall);
    setGameState(newState);
    setSelectedColor(null);
    setSelectedSource(null);
  }, [gameState]);

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c1a2e]">
        <div className="text-[#556677]">Loading game...</div>
      </div>
    );
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isFactoryPhase = gameState.phase === GamePhase.FactoryOffer;
  const isMyTurn = gameState.currentPlayerIndex === localPlayerIndex;

  const opponents = gameState.players.filter((_, i) => i !== localPlayerIndex);
  const opponentIndices = gameState.players
    .map((_, i) => i)
    .filter((i) => i !== localPlayerIndex);

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-[#0c1a2e] overflow-x-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-3 py-2 bg-[#132240] border-b border-white/5">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            <span className="text-[#4a9eff]">A</span>
            <span className="text-[#c9a84c]">Z</span>
            <span className="text-[#3ab8b0]">U</span>
            <span className="text-[#c43a3a]">L</span>
          </h1>
          <div className="text-right">
            <div className="text-[9px] sm:text-xs text-[#556677]">Round {gameState.round}</div>
            <div className="text-xs sm:text-sm font-medium text-[#8899aa]">
              {isMyTurn ? "Your turn" : `${currentPlayer.name}'s turn`}
            </div>
          </div>
        </div>
      </header>

      {/* Selection indicator */}
      {selectedColor && (
        <div className="flex-shrink-0 px-3 py-1.5 sm:py-2 bg-[rgba(74,158,255,0.1)] border-b border-[rgba(74,158,255,0.2)]">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs text-[#8899aa]">Selected:</span>
              <Tile color={selectedColor} size="mini" />
              <span className="text-[10px] sm:text-xs text-[#556677]">
                from {selectedSource?.type === "factory" ? `Factory ${(selectedSource.id ?? 0) + 1}` : "Center"}
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedColor(null);
                setSelectedSource(null);
              }}
              className="text-[10px] sm:text-xs text-[#4a9eff] hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main game area */}
      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-2 sm:px-4 py-2 gap-2 sm:gap-3 overflow-y-auto">
        {/* Top: Opponents */}
        <section className="flex-shrink-0">
          <div
            className={`grid gap-2 ${
              opponents.length === 1
                ? "grid-cols-1 max-w-xs mx-auto"
                : opponents.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-3"
            }`}
          >
            {opponents.map((player, i) => (
              <OpponentBoard
                key={player.id}
                player={player}
                playerIndex={opponentIndices[i]}
                isCurrentTurn={gameState.currentPlayerIndex === opponentIndices[i]}
                useVariant={gameState.useVariantWall}
              />
            ))}
          </div>
        </section>

        {/* Middle: Factories in circle */}
        <section className="flex-1 flex items-center justify-center">
          <FactoryCircle
            factories={gameState.factories}
            centerPool={gameState.centerPool}
            centerHasStartingMarker={gameState.centerHasStartingMarker}
            selectedColor={selectedColor}
            selectedSource={selectedSource}
            onSelectFactoryColor={handleFactoryColorSelect}
            onSelectCenterColor={handleCenterColorSelect}
            isInteractive={isFactoryPhase && isMyTurn}
          />
        </section>

        {/* Bottom: Your board */}
        <section className="flex-shrink-0 pb-2">
          <CurrentPlayerBoard
            player={gameState.players[localPlayerIndex]}
            playerIndex={localPlayerIndex}
            isCurrentTurn={isMyTurn}
            validTargetLines={isMyTurn ? validTargetLines : []}
            onSelectLine={handleSelectLine}
            onSelectFloor={handleSelectFloor}
            useVariant={gameState.useVariantWall}
          />
        </section>
      </main>

      {/* Endgame overlay */}
      {gameState.phase === GamePhase.GameOver && (
        <EndgameSummary state={gameState} onNewGame={handleNewGame} />
      )}
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0c1a2e]">
          <div className="text-[#556677]">Loading game...</div>
        </div>
      }
    >
      <GamePageContent />
    </Suspense>
  );
}