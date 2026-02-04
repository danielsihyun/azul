import {
  TileColor,
  ALL_COLORS,
  GameState,
  GamePhase,
  PlayerState,
  PatternLine,
  WallGrid,
  FactoryDisplay,
  GameMove,
  FactoryPickMove,
  CenterPickMove,
  ValidationResult,
  AvailableMove,
  GameLogEntry,
} from "./types";
import {
  FACTORY_COUNT,
  TILES_PER_COLOR,
  TILES_PER_FACTORY,
  FLOOR_LINE_SIZE,
  WALL_PATTERN,
  getWallColumnForColor,
  isColorOnWallRow,
} from "./constants";
import {
  scoreTilePlacement,
  calculateFloorPenalty,
  calculateEndgameScoring,
  hasCompletedHorizontalRow,
} from "./scoring";

// ─── Utility: Shuffle array (Fisher-Yates) ────────────────────
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Create initial bag with 100 tiles ─────────────────────────
function createBag(): TileColor[] {
  const bag: TileColor[] = [];
  for (const color of ALL_COLORS) {
    for (let i = 0; i < TILES_PER_COLOR; i++) {
      bag.push(color);
    }
  }
  return shuffle(bag);
}

// ─── Create empty pattern lines ────────────────────────────────
function createPatternLines(): PatternLine[] {
  return Array.from({ length: 5 }, (_, i) => ({
    size: i + 1,
    tiles: [],
    color: null,
  }));
}

// ─── Create empty wall ─────────────────────────────────────────
function createEmptyWall(): WallGrid {
  return Array.from({ length: 5 }, () => Array(5).fill(null));
}

// ─── Create a player ───────────────────────────────────────────
function createPlayer(id: string, name: string): PlayerState {
  return {
    id,
    name,
    score: 0,
    patternLines: createPatternLines(),
    wall: createEmptyWall(),
    floorLine: [],
    hasStartingMarker: false,
  };
}

// ─── Create initial game state ─────────────────────────────────
export function createGame(
  playerNames: string[],
  useVariant: boolean = false
): GameState {
  const playerCount = playerNames.length;
  if (playerCount < 2 || playerCount > 4) {
    throw new Error("Azul requires 2-4 players");
  }

  const factoryCount = FACTORY_COUNT[playerCount];
  const bag = createBag();

  // Create factories
  const factories: FactoryDisplay[] = [];
  const remainingBag = [...bag];

  for (let i = 0; i < factoryCount; i++) {
    const tiles: TileColor[] = [];
    for (let t = 0; t < TILES_PER_FACTORY; t++) {
      if (remainingBag.length > 0) {
        tiles.push(remainingBag.pop()!);
      }
    }
    factories.push({ id: i, tiles });
  }

  // Create players
  const players = playerNames.map((name, i) =>
    createPlayer(`player-${i}`, name)
  );

  // First player gets the starting marker conceptually
  const startingPlayerIndex = 0;

  return {
    id: `game-${Date.now()}`,
    phase: GamePhase.FactoryOffer,
    round: 1,
    currentPlayerIndex: startingPlayerIndex,
    players,
    factories,
    centerPool: [],
    centerHasStartingMarker: true, // Marker starts in center
    bag: remainingBag,
    discardLid: [],
    startingPlayerIndex,
    useVariantWall: useVariant,
    gameLog: [
      {
        round: 1,
        playerName: "System",
        action: `Game started with ${playerCount} players. Round 1 begins.`,
        timestamp: Date.now(),
      },
    ],
    winner: null,
    tieBreaker: null,
  };
}

// ─── Get unique colors available in a source ───────────────────
function getUniqueColors(tiles: TileColor[]): TileColor[] {
  return [...new Set(tiles)];
}

// ─── Check if a pattern line can accept a color ────────────────
function canPlaceOnPatternLine(
  player: PlayerState,
  lineIndex: number,
  color: TileColor,
  useVariant: boolean
): boolean {
  const line = player.patternLines[lineIndex];

  // Line is full
  if (line.tiles.length >= line.size) return false;

  // Line has a different color
  if (line.color !== null && line.color !== color) return false;

  if (!useVariant) {
    // Standard wall: check if color is already on wall row
    if (isColorOnWallRow(player.wall, lineIndex, color)) return false;
  } else {
    // Variant: check if color is already anywhere in that wall row
    if (player.wall[lineIndex].includes(color)) return false;
  }

  return true;
}

// ─── Get all available moves for current player ────────────────
export function getAvailableMoves(state: GameState): AvailableMove[] {
  const player = state.players[state.currentPlayerIndex];
  const moves: AvailableMove[] = [];

  // Factory picks
  for (const factory of state.factories) {
    if (factory.tiles.length === 0) continue;
    const colors = getUniqueColors(factory.tiles);
    for (const color of colors) {
      const validTargets: number[] = [];
      for (let line = 0; line < 5; line++) {
        if (canPlaceOnPatternLine(player, line, color, state.useVariantWall)) {
          validTargets.push(line);
        }
      }
      // Floor line is always an option
      validTargets.push(-1);
      moves.push({
        source: "factory",
        factoryId: factory.id,
        color,
        validTargetLines: validTargets,
      });
    }
  }

  // Center picks
  if (state.centerPool.length > 0) {
    const colors = getUniqueColors(state.centerPool);
    for (const color of colors) {
      const validTargets: number[] = [];
      for (let line = 0; line < 5; line++) {
        if (canPlaceOnPatternLine(player, line, color, state.useVariantWall)) {
          validTargets.push(line);
        }
      }
      validTargets.push(-1);
      moves.push({
        source: "center",
        color,
        validTargetLines: validTargets,
      });
    }
  }

  return moves;
}

// ─── Validate a move ───────────────────────────────────────────
export function validateMove(
  state: GameState,
  move: GameMove
): ValidationResult {
  if (state.phase !== GamePhase.FactoryOffer) {
    return { valid: false, error: "Not in factory offer phase" };
  }

  const player = state.players[state.currentPlayerIndex];

  if (move.type === "factoryPick") {
    const factory = state.factories.find((f) => f.id === move.factoryId);
    if (!factory) return { valid: false, error: "Invalid factory" };
    if (factory.tiles.length === 0)
      return { valid: false, error: "Factory is empty" };
    if (!factory.tiles.includes(move.color))
      return { valid: false, error: "Color not in factory" };
  } else if (move.type === "centerPick") {
    if (state.centerPool.length === 0)
      return { valid: false, error: "Center is empty" };
    if (!state.centerPool.includes(move.color))
      return { valid: false, error: "Color not in center" };
  }

  // Validate target line
  if (move.targetLine >= 0 && move.targetLine < 5) {
    if (
      !canPlaceOnPatternLine(
        player,
        move.targetLine,
        move.color,
        state.useVariantWall
      )
    ) {
      return { valid: false, error: "Cannot place on this pattern line" };
    }
  } else if (move.targetLine !== -1) {
    return { valid: false, error: "Invalid target line" };
  }

  return { valid: true };
}

// ─── Execute a move ────────────────────────────────────────────
export function executeMove(state: GameState, move: GameMove): GameState {
  const validation = validateMove(state, move);
  if (!validation.valid) {
    throw new Error(`Invalid move: ${validation.error}`);
  }

  // Deep clone state
  const newState: GameState = JSON.parse(JSON.stringify(state));
  const player = newState.players[newState.currentPlayerIndex];

  let pickedTiles: TileColor[] = [];
  let logAction = "";

  if (move.type === "factoryPick") {
    const factory = newState.factories.find((f) => f.id === move.factoryId)!;
    // Pick all tiles of the chosen color
    pickedTiles = factory.tiles.filter((t) => t === move.color);
    // Move remaining to center
    const remaining = factory.tiles.filter((t) => t !== move.color);
    newState.centerPool.push(...remaining);
    factory.tiles = [];
    logAction = `picked ${pickedTiles.length} ${move.color} from Factory ${move.factoryId + 1}`;
  } else {
    // Center pick
    pickedTiles = newState.centerPool.filter((t) => t === move.color);
    newState.centerPool = newState.centerPool.filter((t) => t !== move.color);

    // First center pick: take starting marker
    if (newState.centerHasStartingMarker) {
      newState.centerHasStartingMarker = false;
      player.hasStartingMarker = true;
      // Place starting marker on floor line
      if (player.floorLine.length < FLOOR_LINE_SIZE) {
        player.floorLine.push("starter");
      }
      // If floor is full, marker just goes away (per PRD: excess beyond floor → discard)
      newState.startingPlayerIndex = newState.currentPlayerIndex;
      logAction = `picked ${pickedTiles.length} ${move.color} from center (+ starting marker)`;
    } else {
      logAction = `picked ${pickedTiles.length} ${move.color} from center`;
    }
  }

  // Place tiles
  if (move.targetLine >= 0 && move.targetLine < 5) {
    const line = player.patternLines[move.targetLine];
    line.color = move.color;
    let placed = 0;
    for (const tile of pickedTiles) {
      if (line.tiles.length < line.size) {
        line.tiles.push(tile);
        placed++;
      } else {
        // Overflow to floor
        if (player.floorLine.length < FLOOR_LINE_SIZE) {
          player.floorLine.push(tile);
        } else {
          newState.discardLid.push(tile);
        }
      }
    }
    logAction += ` → line ${move.targetLine + 1}`;
    if (placed < pickedTiles.length) {
      logAction += ` (${pickedTiles.length - placed} overflow to floor)`;
    }
  } else {
    // All to floor
    for (const tile of pickedTiles) {
      if (player.floorLine.length < FLOOR_LINE_SIZE) {
        player.floorLine.push(tile);
      } else {
        newState.discardLid.push(tile);
      }
    }
    logAction += " → floor line";
  }

  // Log the action
  newState.gameLog.push({
    round: newState.round,
    playerName: player.name,
    action: logAction,
    timestamp: Date.now(),
  });

  // Check if factory offer phase is over
  const allFactoriesEmpty = newState.factories.every(
    (f) => f.tiles.length === 0
  );
  const centerEmpty = newState.centerPool.length === 0;

  if (allFactoriesEmpty && centerEmpty) {
    // Move to wall tiling phase
    newState.phase = GamePhase.WallTiling;
    return executeWallTiling(newState);
  } else {
    // Next player's turn
    newState.currentPlayerIndex =
      (newState.currentPlayerIndex + 1) % newState.players.length;
    return newState;
  }
}

// ─── Execute wall tiling phase ─────────────────────────────────
function executeWallTiling(state: GameState): GameState {
  const newState: GameState = JSON.parse(JSON.stringify(state));

  for (const player of newState.players) {
    // Process pattern lines from top to bottom
    for (let row = 0; row < 5; row++) {
      const line = player.patternLines[row];
      if (line.tiles.length === line.size && line.color !== null) {
        // Line is complete
        if (!newState.useVariantWall) {
          // Standard wall: place in predetermined position
          const col = getWallColumnForColor(row, line.color);

          if (player.wall[row][col] === null) {
            player.wall[row][col] = line.color;
            const points = scoreTilePlacement(player.wall, row, col);
            player.score += points;

            newState.gameLog.push({
              round: newState.round,
              playerName: player.name,
              action: `placed ${line.color} on wall (${row},${col}) for ${points} points`,
              timestamp: Date.now(),
            });
          }
        } else {
          // Variant wall: needs player choice (for now, auto-place in first valid spot)
          let placed = false;
          for (let col = 0; col < 5; col++) {
            if (player.wall[row][col] === null) {
              // Check vertical constraint
              let colorInColumn = false;
              for (let r = 0; r < 5; r++) {
                if (player.wall[r][col] === line.color) {
                  colorInColumn = true;
                  break;
                }
              }
              if (!colorInColumn) {
                player.wall[row][col] = line.color;
                const points = scoreTilePlacement(player.wall, row, col);
                player.score += points;
                placed = true;
                break;
              }
            }
          }
          if (!placed) {
            // No valid space: all tiles to floor
            for (const tile of line.tiles) {
              if (player.floorLine.length < FLOOR_LINE_SIZE) {
                player.floorLine.push(tile);
              } else {
                newState.discardLid.push(tile);
              }
            }
            line.tiles = [];
            line.color = null;
            continue;
          }
        }

        // Remove remaining tiles from pattern line → discard
        const remaining = line.tiles.length - 1; // one goes to wall
        for (let i = 0; i < remaining; i++) {
          newState.discardLid.push(line.color!);
        }
        line.tiles = [];
        line.color = null;
      }
      // Incomplete lines stay
    }

    // Apply floor line penalties
    const floorCount = player.floorLine.length;
    if (floorCount > 0) {
      const penalty = calculateFloorPenalty(floorCount);
      player.score = Math.max(0, player.score + penalty);

      newState.gameLog.push({
        round: newState.round,
        playerName: player.name,
        action: `floor penalty: ${penalty} points (${floorCount} tiles)`,
        timestamp: Date.now(),
      });

      // Move floor tiles to discard (except starting marker)
      for (const tile of player.floorLine) {
        if (tile !== "starter") {
          newState.discardLid.push(tile);
        }
      }
      player.floorLine = [];
      // hasStartingMarker stays true for the player who took it
    }
  }

  // Check for game end
  let gameEnds = false;
  for (const player of newState.players) {
    if (hasCompletedHorizontalRow(player.wall)) {
      gameEnds = true;
      break;
    }
  }

  if (gameEnds) {
    return executeEndgame(newState);
  } else {
    return prepareNextRound(newState);
  }
}

// ─── Prepare next round ────────────────────────────────────────
function prepareNextRound(state: GameState): GameState {
  const newState: GameState = JSON.parse(JSON.stringify(state));
  newState.round++;
  newState.phase = GamePhase.FactoryOffer;

  // The player with starting marker goes first
  newState.currentPlayerIndex = newState.startingPlayerIndex;

  // Reset starting marker
  for (const player of newState.players) {
    player.hasStartingMarker = false;
  }

  // Starting marker goes back to center
  newState.centerHasStartingMarker = true;

  // Refill factories
  for (const factory of newState.factories) {
    factory.tiles = [];
    for (let t = 0; t < TILES_PER_FACTORY; t++) {
      if (newState.bag.length === 0) {
        // Refill bag from discard lid
        if (newState.discardLid.length > 0) {
          newState.bag = shuffle(newState.discardLid);
          newState.discardLid = [];
        } else {
          // No tiles left anywhere - leave factory partially filled
          break;
        }
      }
      if (newState.bag.length > 0) {
        factory.tiles.push(newState.bag.pop()!);
      }
    }
  }

  newState.gameLog.push({
    round: newState.round,
    playerName: "System",
    action: `Round ${newState.round} begins.`,
    timestamp: Date.now(),
  });

  return newState;
}

// ─── Execute endgame scoring ───────────────────────────────────
function executeEndgame(state: GameState): GameState {
  const newState: GameState = JSON.parse(JSON.stringify(state));
  newState.phase = GamePhase.GameOver;

  const scorings = newState.players.map((p) => calculateEndgameScoring(p));

  // Apply bonuses
  for (const scoring of scorings) {
    const player = newState.players.find((p) => p.id === scoring.playerId)!;
    player.score = scoring.totalScore;
  }

  // Determine winner
  const sorted = [...scorings].sort((a, b) => b.totalScore - a.totalScore);
  const topScore = sorted[0].totalScore;
  const tied = sorted.filter((s) => s.totalScore === topScore);

  if (tied.length === 1) {
    newState.winner = tied[0].playerId;
  } else {
    // Tiebreaker: most horizontal rows
    tied.sort((a, b) => b.horizontalRows - a.horizontalRows);
    if (tied[0].horizontalRows > tied[1].horizontalRows) {
      newState.winner = tied[0].playerId;
      newState.tieBreaker = "horizontal rows";
    } else {
      // Shared victory
      newState.winner = tied.map((t) => t.playerId).join(",");
      newState.tieBreaker = "shared";
    }
  }

  newState.gameLog.push({
    round: newState.round,
    playerName: "System",
    action: `Game over! ${
      newState.tieBreaker === "shared"
        ? "Shared victory!"
        : `Winner determined${newState.tieBreaker ? ` by ${newState.tieBreaker}` : ""}.`
    }`,
    timestamp: Date.now(),
  });

  return newState;
}


