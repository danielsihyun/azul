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

  const sizeClass =
    size === "small" ? "tile-small" : size === "mini" ? "tile-mini" : "";

  if (color === "starter") {
    return (
      <div
        className={`tile tile-starter ${sizeClass} ${className}`}
        onClick={onClick}
      >
        1
      </div>
    );
  }

  return (
    <div
      className={`tile tile-${color} ${sizeClass} ${selected ? "ring-2 ring-white ring-offset-1 ring-offset-[var(--azul-panel)]" : ""} ${className}`}
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
}: {
  factory: { id: number; tiles: TileColor[] };
  selectedColor: TileColor | null;
  selectedSource: { type: string; id?: number } | null;
  onSelectColor: (factoryId: number, color: TileColor) => void;
  isInteractive: boolean;
}) {
  if (factory.tiles.length === 0) {
    return (
      <div className="factory opacity-30">
        <span className="col-span-2 text-xs text-[#445566]">Empty</span>
      </div>
    );
  }

  const isSelected =
    selectedSource?.type === "factory" && selectedSource?.id === factory.id;

  return (
    <div className={`factory ${isSelected ? "highlighted" : ""}`}>
      {factory.tiles.map((color, i) => (
        <Tile
          key={i}
          color={color}
          size="small"
          onClick={() => isInteractive && onSelectColor(factory.id, color)}
          selected={
            isSelected && selectedColor === color
          }
          className={
            isInteractive ? "cursor-pointer" : "cursor-default"
          }
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

  // Group tiles by color for display
  const grouped = useMemo(() => {
    const groups: Partial<Record<TileColor, number>> = {};
    for (const tile of tiles) {
      groups[tile] = (groups[tile] || 0) + 1;
    }
    return groups;
  }, [tiles]);

  if (tiles.length === 0 && !hasStartingMarker) {
    return (
      <div className="panel text-center py-4 opacity-50">
        <p className="text-xs text-[#556677]">Center Empty</p>
      </div>
    );
  }

  return (
    <div className={`panel ${isSelected ? "panel-active" : ""}`}>
      <div className="text-xs text-[#8899aa] mb-2 font-medium">
        Center of Table
      </div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {hasStartingMarker && <Tile color="starter" size="small" />}
        {Object.entries(grouped).map(([color, count]) => (
          <button
            key={color}
            onClick={() => isInteractive && onSelectColor(color as TileColor)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
              isSelected && selectedColor === color
                ? "bg-[rgba(74,158,255,0.2)] ring-1 ring-[var(--azul-accent)]"
                : isInteractive
                  ? "hover:bg-[rgba(255,255,255,0.05)]"
                  : ""
            }`}
          >
            <Tile color={color as TileColor} size="small" />
            {count! > 1 && (
              <span className="text-xs text-[#8899aa] font-medium ml-0.5">
                ×{count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Pattern Lines ──────────────────────────────────────────
function PatternLines({
  patternLines,
  wall,
  validTargetLines,
  onSelectLine,
  isCurrentPlayer,
}: {
  patternLines: { size: number; tiles: TileColor[]; color: TileColor | null }[];
  wall: (TileColor | null)[][];
  validTargetLines: number[];
  onSelectLine: (lineIndex: number) => void;
  isCurrentPlayer: boolean;
}) {
  return (
    <div className="space-y-1">
      {patternLines.map((line, rowIndex) => {
        const isValid = validTargetLines.includes(rowIndex);
        return (
          <div
            key={rowIndex}
            className="flex items-center justify-end gap-1"
          >
            {/* Empty slots (from left) */}
            {Array.from({ length: line.size }).map((_, slotIndex) => {
              const tileIndex = line.size - 1 - slotIndex;
              const hasTile = tileIndex < line.tiles.length;
              return (
                <div
                  key={slotIndex}
                  onClick={() =>
                    isCurrentPlayer && isValid && onSelectLine(rowIndex)
                  }
                  className={`pattern-slot ${
                    hasTile ? "" : isValid ? "valid-target" : ""
                  }`}
                >
                  {hasTile && (
                    <Tile color={line.tiles[tileIndex]} size="small" />
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
function WallDisplay({
  wall,
  useVariant,
}: {
  wall: (TileColor | null)[][];
  useVariant: boolean;
}) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {Array.from({ length: 5 }).map((_, row) =>
        Array.from({ length: 5 }).map((_, col) => {
          const placed = wall[row][col];
          const expectedColor = WALL_PATTERN[row][col];

          return (
            <div
              key={`${row}-${col}`}
              className={`wall-cell ${placed ? "filled" : "ghost"}`}
              style={
                placed
                  ? {
                      background: `linear-gradient(135deg, ${TILE_COLOR_HEX[placed]}dd, ${TILE_COLOR_HEX[placed]})`,
                      borderColor: "rgba(255,255,255,0.2)",
                    }
                  : !useVariant
                    ? {
                        background: `${TILE_COLOR_HEX[expectedColor]}`,
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
}: {
  floorLine: (TileColor | "starter")[];
  isValidTarget: boolean;
  onSelectFloor: () => void;
  isCurrentPlayer: boolean;
}) {
  return (
    <div className="flex gap-1 items-center">
      {Array.from({ length: 7 }).map((_, i) => {
        const tile = floorLine[i] || null;
        return (
          <div
            key={i}
            onClick={() => isCurrentPlayer && isValidTarget && !tile && onSelectFloor()}
            className={`floor-slot ${
              tile ? "filled" : isValidTarget ? "valid-target cursor-pointer" : ""
            }`}
          >
            {tile ? (
              <Tile color={tile} size="mini" />
            ) : (
              <span>{FLOOR_PENALTIES[i]}</span>
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
  isCurrentPlayer,
  validTargetLines,
  onSelectLine,
  onSelectFloor,
  useVariant,
  compact,
}: {
  player: GameState["players"][0];
  playerIndex: number;
  isCurrentPlayer: boolean;
  validTargetLines: number[];
  onSelectLine: (lineIndex: number) => void;
  onSelectFloor: () => void;
  useVariant: boolean;
  compact?: boolean;
}) {
  const isFloorValid = validTargetLines.includes(-1);

  return (
    <div
      className={`panel ${isCurrentPlayer ? "panel-active" : ""} ${
        compact ? "p-3" : ""
      }`}
    >
      {/* Player header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: PLAYER_COLORS[playerIndex] }}
          />
          <span
            className="font-semibold text-sm"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {player.name}
          </span>
          {isCurrentPlayer && (
            <span className="text-[10px] bg-[var(--azul-accent)] text-white px-2 py-0.5 rounded-full font-medium">
              YOUR TURN
            </span>
          )}
          {player.hasStartingMarker && (
            <span className="text-[10px] bg-[#555] text-white px-2 py-0.5 rounded-full font-medium">
              1ST
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-[var(--azul-gold)]">
            {player.score}
          </span>
          <span className="text-xs text-[#556677] ml-1">pts</span>
        </div>
      </div>

      {/* Board grid: pattern lines + wall */}
      <div className="flex gap-3 items-start">
        <PatternLines
          patternLines={player.patternLines}
          wall={player.wall}
          validTargetLines={isCurrentPlayer ? validTargetLines : []}
          onSelectLine={onSelectLine}
          isCurrentPlayer={isCurrentPlayer}
        />
        <div className="w-px bg-[rgba(255,255,255,0.06)] self-stretch" />
        <WallDisplay wall={player.wall} useVariant={useVariant} />
      </div>

      {/* Floor line */}
      <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-[#556677] uppercase tracking-wider">
            Floor Line
          </span>
        </div>
        <FloorLine
          floorLine={player.floorLine}
          isValidTarget={isCurrentPlayer && isFloorValid}
          onSelectFloor={onSelectFloor}
          isCurrentPlayer={isCurrentPlayer}
        />
      </div>
    </div>
  );
}

// ─── Game Log ───────────────────────────────────────────────
function GameLog({ log }: { log: GameState["gameLog"] }) {
  return (
    <div className="panel max-h-48 overflow-y-auto">
      <div className="text-xs text-[#8899aa] mb-2 font-medium">Game Log</div>
      <div className="space-y-1">
        {[...log].reverse().map((entry, i) => (
          <div key={i} className="text-xs text-[#667788]">
            <span className="text-[#556677]">[R{entry.round}]</span>{" "}
            <span className="text-[#8899aa]">{entry.playerName}</span>{" "}
            {entry.action}
          </div>
        ))}
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div
        className="panel max-w-lg w-full animate-fadeIn"
        style={{ background: "var(--azul-panel)" }}
      >
        <h2
          className="text-3xl font-bold text-center mb-6"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Game Over
        </h2>

        <div className="space-y-3 mb-6">
          {scorings.map((s, i) => {
            const isWinner = winnerIds.includes(s.playerId);
            const playerIndex = state.players.findIndex(
              (p) => p.id === s.playerId
            );
            return (
              <div
                key={s.playerId}
                className={`p-4 rounded-lg ${
                  isWinner
                    ? "bg-[rgba(74,158,255,0.1)] border border-[var(--azul-accent)]"
                    : "bg-[var(--azul-surface)]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isWinner && <span className="text-lg">👑</span>}
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: PLAYER_COLORS[playerIndex] }}
                    />
                    <span className="font-semibold">{s.playerName}</span>
                  </div>
                  <span className="text-2xl font-bold text-[var(--azul-gold)]">
                    {s.totalScore}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs text-[#8899aa]">
                  <div>
                    <div className="text-[#556677]">Base</div>
                    <div>{s.baseScore}</div>
                  </div>
                  <div>
                    <div className="text-[#556677]">Rows ×{s.horizontalRows}</div>
                    <div>+{s.horizontalBonus}</div>
                  </div>
                  <div>
                    <div className="text-[#556677]">Cols ×{s.verticalColumns}</div>
                    <div>+{s.verticalBonus}</div>
                  </div>
                  <div>
                    <div className="text-[#556677]">Colors ×{s.completeColors}</div>
                    <div>+{s.colorBonus}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {state.tieBreaker === "shared" && (
          <p className="text-center text-sm text-[#8899aa] mb-4">
            Tied! Victory is shared.
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={onNewGame} className="btn-primary flex-1">
            New Game
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="btn-secondary flex-1"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Phase Banner ───────────────────────────────────────────
function PhaseBanner({
  phase,
  round,
  currentPlayerName,
}: {
  phase: GamePhase;
  round: number;
  currentPlayerName: string;
}) {
  const phaseLabels: Record<GamePhase, string> = {
    [GamePhase.Setup]: "Setting Up",
    [GamePhase.FactoryOffer]: "Factory Offer",
    [GamePhase.WallTiling]: "Wall Tiling",
    [GamePhase.Scoring]: "Scoring",
    [GamePhase.Preparing]: "Preparing Next Round",
    [GamePhase.GameOver]: "Game Over",
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          <span className="text-[var(--azul-accent)]">A</span>
          <span className="text-[var(--azul-gold)]">Z</span>
          <span className="text-[var(--azul-cyan)]">U</span>
          <span className="text-[var(--azul-red)]">L</span>
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-xs text-[#556677] uppercase tracking-wider">
            Round {round}
          </div>
          <div className="text-sm font-medium text-[#8899aa]">
            {phaseLabels[phase]}
          </div>
        </div>
        {phase === GamePhase.FactoryOffer && (
          <div className="text-right">
            <div className="text-xs text-[#556677]">Current Turn</div>
            <div className="text-sm font-semibold text-[var(--azul-accent)]">
              {currentPlayerName}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN GAME PAGE
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
        // Fallback
        const state = createGame(["Player 1", "Player 2"]);
        setGameState(state);
      }
    } else {
      const state = createGame(["Player 1", "Player 2"]);
      setGameState(state);
    }
  }, [searchParams]);

  // Compute available moves when game state changes
  useEffect(() => {
    if (gameState && gameState.phase === GamePhase.FactoryOffer) {
      setAvailableMoves(getAvailableMoves(gameState));
    } else {
      setAvailableMoves([]);
    }
  }, [gameState]);

  // Select a color from factory
  const handleFactoryColorSelect = useCallback(
    (factoryId: number, color: TileColor) => {
      if (!gameState || gameState.phase !== GamePhase.FactoryOffer) return;

      if (
        selectedSource?.type === "factory" &&
        selectedSource.id === factoryId &&
        selectedColor === color
      ) {
        // Deselect
        setSelectedColor(null);
        setSelectedSource(null);
      } else {
        setSelectedColor(color);
        setSelectedSource({ type: "factory", id: factoryId });
      }
    },
    [gameState, selectedSource, selectedColor]
  );

  // Select a color from center
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

  // Get valid target lines for current selection
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

  // Place tiles on a pattern line
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

  // Place tiles on floor
  const handleSelectFloor = useCallback(() => {
    handleSelectLine(-1);
  }, [handleSelectLine]);

  // New game handler
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#556677]">Loading game...</div>
      </div>
    );
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isFactoryPhase = gameState.phase === GamePhase.FactoryOffer;

  return (
    <div className="min-h-screen p-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <PhaseBanner
        phase={gameState.phase}
        round={gameState.round}
        currentPlayerName={currentPlayer.name}
      />

      {/* Selection indicator */}
      {selectedColor && (
        <div className="mt-3 p-2 bg-[rgba(74,158,255,0.08)] border border-[rgba(74,158,255,0.2)] rounded-lg flex items-center gap-3 animate-fadeIn">
          <span className="text-xs text-[#8899aa]">Selected:</span>
          <Tile color={selectedColor} size="small" />
          <span className="text-xs text-[#8899aa]">
            from{" "}
            {selectedSource?.type === "factory"
              ? `Factory ${(selectedSource.id ?? 0) + 1}`
              : "Center"}
          </span>
          <span className="text-xs text-[#556677] ml-auto">
            Choose a pattern line or floor line to place
          </span>
          <button
            onClick={() => {
              setSelectedColor(null);
              setSelectedSource(null);
            }}
            className="text-xs text-[var(--azul-accent)] hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Left: Game Area */}
        <div className="space-y-4">
          {/* Factories */}
          <div className="panel">
            <div className="text-xs text-[#8899aa] mb-3 font-medium uppercase tracking-wider">
              Factory Displays
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
              {gameState.factories.map((factory) => (
                <FactoryDisplay
                  key={factory.id}
                  factory={factory}
                  selectedColor={selectedColor}
                  selectedSource={selectedSource}
                  onSelectColor={handleFactoryColorSelect}
                  isInteractive={isFactoryPhase}
                />
              ))}
            </div>
          </div>

          {/* Center Pool */}
          <CenterPool
            tiles={gameState.centerPool}
            hasStartingMarker={gameState.centerHasStartingMarker}
            selectedColor={selectedColor}
            selectedSource={selectedSource}
            onSelectColor={handleCenterColorSelect}
            isInteractive={isFactoryPhase}
          />

          {/* Player Boards */}
          <div className="space-y-3">
            {gameState.players.map((player, i) => (
              <PlayerBoard
                key={player.id}
                player={player}
                playerIndex={i}
                isCurrentPlayer={
                  isFactoryPhase && i === gameState.currentPlayerIndex
                }
                validTargetLines={
                  i === gameState.currentPlayerIndex ? validTargetLines : []
                }
                onSelectLine={handleSelectLine}
                onSelectFloor={handleSelectFloor}
                useVariant={gameState.useVariantWall}
              />
            ))}
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-4">
          {/* Score summary */}
          <div className="panel">
            <div className="text-xs text-[#8899aa] mb-3 font-medium uppercase tracking-wider">
              Scores
            </div>
            <div className="space-y-2">
              {gameState.players.map((player, i) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between py-1.5 px-2 rounded ${
                    isFactoryPhase && i === gameState.currentPlayerIndex
                      ? "bg-[rgba(74,158,255,0.08)]"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: PLAYER_COLORS[i] }}
                    />
                    <span className="text-sm">{player.name}</span>
                  </div>
                  <span className="font-bold text-[var(--azul-gold)]">
                    {player.score}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Game info */}
          <div className="panel">
            <div className="text-xs text-[#8899aa] mb-2 font-medium uppercase tracking-wider">
              Game Info
            </div>
            <div className="space-y-1 text-xs text-[#667788]">
              <div className="flex justify-between">
                <span>Bag</span>
                <span>{gameState.bag.length} tiles</span>
              </div>
              <div className="flex justify-between">
                <span>Discard</span>
                <span>{gameState.discardLid.length} tiles</span>
              </div>
              <div className="flex justify-between">
                <span>Variant Wall</span>
                <span>{gameState.useVariantWall ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>

          {/* How to play hint */}
          {isFactoryPhase && !selectedColor && (
            <div className="panel bg-[rgba(74,158,255,0.04)] border-[rgba(74,158,255,0.1)]">
              <div className="text-xs text-[#8899aa] mb-1 font-medium">
                How to Play
              </div>
              <ol className="text-xs text-[#667788] space-y-1 list-decimal list-inside">
                <li>Click a tile color on a factory or the center</li>
                <li>Click a pattern line row to place tiles</li>
                <li>Overflow goes to the floor (penalties!)</li>
              </ol>
            </div>
          )}

          {/* Game Log */}
          <GameLog log={gameState.gameLog} />
        </div>
      </div>

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
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-[#556677]">Loading game...</div>
        </div>
      }
    >
      <GamePageContent />
    </Suspense>
  );
}
