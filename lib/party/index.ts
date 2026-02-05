import type * as Party from "partykit/server";

// ─── Types ──────────────────────────────────────────────────
enum TileColor {
  Blue = "blue",
  Yellow = "yellow",
  Red = "red",
  Black = "black",
  Cyan = "cyan",
}

const ALL_COLORS: TileColor[] = [
  TileColor.Blue,
  TileColor.Yellow,
  TileColor.Red,
  TileColor.Black,
  TileColor.Cyan,
];

enum GamePhase {
  Lobby = "lobby",
  FactoryOffer = "factoryOffer",
  WallTiling = "wallTiling",
  GameOver = "gameOver",
}

interface PatternLine {
  size: number;
  tiles: TileColor[];
  color: TileColor | null;
}

interface PlayerState {
  id: string;
  name: string;
  score: number;
  patternLines: PatternLine[];
  wall: (TileColor | null)[][];
  floorLine: (TileColor | "starter")[];
  hasStartingMarker: boolean;
  connected: boolean;
}

interface FactoryDisplay {
  id: number;
  tiles: TileColor[];
}

interface RoomState {
  id: string;
  phase: GamePhase;
  round: number;
  currentPlayerIndex: number;
  players: PlayerState[];
  factories: FactoryDisplay[];
  centerPool: TileColor[];
  centerHasStartingMarker: boolean;
  bag: TileColor[];
  discardLid: TileColor[];
  startingPlayerIndex: number;
  hostId: string;
  maxPlayers: number;
  // Pending placement state
  pendingTiles: TileColor[];
  pendingColor: TileColor | null;
  pendingPlayerId: string | null;
}

// ─── Constants ──────────────────────────────────────────────
const WALL_PATTERN: TileColor[][] = [
  [TileColor.Blue, TileColor.Yellow, TileColor.Red, TileColor.Black, TileColor.Cyan],
  [TileColor.Cyan, TileColor.Blue, TileColor.Yellow, TileColor.Red, TileColor.Black],
  [TileColor.Black, TileColor.Cyan, TileColor.Blue, TileColor.Yellow, TileColor.Red],
  [TileColor.Red, TileColor.Black, TileColor.Cyan, TileColor.Blue, TileColor.Yellow],
  [TileColor.Yellow, TileColor.Red, TileColor.Black, TileColor.Cyan, TileColor.Blue],
];

const FLOOR_PENALTIES = [-1, -1, -2, -2, -2, -3, -3];
const FLOOR_LINE_SIZE = 7;
const TILES_PER_COLOR = 20;
const TILES_PER_FACTORY = 4;

const FACTORY_COUNT: Record<number, number> = { 2: 5, 3: 7, 4: 9 };

// ─── Utility Functions ──────────────────────────────────────
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createBag(): TileColor[] {
  const bag: TileColor[] = [];
  for (const color of ALL_COLORS) {
    for (let i = 0; i < TILES_PER_COLOR; i++) {
      bag.push(color);
    }
  }
  return shuffle(bag);
}

function createPatternLines(): PatternLine[] {
  return Array.from({ length: 5 }, (_, i) => ({
    size: i + 1,
    tiles: [],
    color: null,
  }));
}

function createEmptyWall(): (TileColor | null)[][] {
  return Array.from({ length: 5 }, () => Array(5).fill(null));
}

function getWallColumnForColor(row: number, color: TileColor): number {
  return WALL_PATTERN[row].indexOf(color);
}

function isColorOnWallRow(wall: (TileColor | null)[][], row: number, color: TileColor): boolean {
  const col = getWallColumnForColor(row, color);
  return wall[row][col] !== null;
}

function canPlaceOnPatternLine(player: PlayerState, lineIndex: number, color: TileColor): boolean {
  const line = player.patternLines[lineIndex];
  if (line.tiles.length >= line.size) return false;
  if (line.color !== null && line.color !== color) return false;
  if (isColorOnWallRow(player.wall, lineIndex, color)) return false;
  return true;
}

function scoreTilePlacement(wall: (TileColor | null)[][], row: number, col: number): number {
  let horizontalCount = 0;
  let verticalCount = 0;

  for (let c = col - 1; c >= 0; c--) {
    if (wall[row][c] !== null) horizontalCount++;
    else break;
  }
  for (let c = col + 1; c < 5; c++) {
    if (wall[row][c] !== null) horizontalCount++;
    else break;
  }
  for (let r = row - 1; r >= 0; r--) {
    if (wall[r][col] !== null) verticalCount++;
    else break;
  }
  for (let r = row + 1; r < 5; r++) {
    if (wall[r][col] !== null) verticalCount++;
    else break;
  }

  if (horizontalCount === 0 && verticalCount === 0) return 1;

  let points = 0;
  if (horizontalCount > 0) points += horizontalCount + 1;
  if (verticalCount > 0) points += verticalCount + 1;
  return points;
}

function calculateFloorPenalty(count: number): number {
  let penalty = 0;
  for (let i = 0; i < Math.min(count, FLOOR_PENALTIES.length); i++) {
    penalty += FLOOR_PENALTIES[i];
  }
  return penalty;
}

function hasCompletedHorizontalRow(wall: (TileColor | null)[][]): boolean {
  for (let row = 0; row < 5; row++) {
    if (wall[row].every((cell) => cell !== null)) return true;
  }
  return false;
}

// ─── Game Logic ─────────────────────────────────────────────
function initializeGame(state: RoomState): RoomState {
  const playerCount = state.players.length;
  const factoryCount = FACTORY_COUNT[playerCount] || 5;
  const bag = createBag();

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

  // Reset player boards
  for (const player of state.players) {
    player.score = 0;
    player.patternLines = createPatternLines();
    player.wall = createEmptyWall();
    player.floorLine = [];
    player.hasStartingMarker = false;
  }

  return {
    ...state,
    phase: GamePhase.FactoryOffer,
    round: 1,
    currentPlayerIndex: 0,
    factories,
    centerPool: [],
    centerHasStartingMarker: true,
    bag: remainingBag,
    discardLid: [],
    startingPlayerIndex: 0,
    pendingTiles: [],
    pendingColor: null,
    pendingPlayerId: null,
  };
}

function executePickup(
  state: RoomState,
  playerId: string,
  source: { type: "factory"; factoryId: number } | { type: "center" },
  color: TileColor
): RoomState | null {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex !== state.currentPlayerIndex) return null;
  if (state.pendingTiles.length > 0) return null;

  const player = state.players[playerIndex];
  let pickedTiles: TileColor[] = [];

  if (source.type === "factory") {
    const factory = state.factories.find((f) => f.id === source.factoryId);
    if (!factory || factory.tiles.length === 0) return null;
    if (!factory.tiles.includes(color)) return null;

    pickedTiles = factory.tiles.filter((t) => t === color);
    const remaining = factory.tiles.filter((t) => t !== color);
    state.centerPool.push(...remaining);
    factory.tiles = [];
  } else {
    if (state.centerPool.length === 0) return null;
    if (!state.centerPool.includes(color)) return null;

    pickedTiles = state.centerPool.filter((t) => t === color);
    state.centerPool = state.centerPool.filter((t) => t !== color);

    if (state.centerHasStartingMarker) {
      state.centerHasStartingMarker = false;
      player.hasStartingMarker = true;
      if (player.floorLine.length < FLOOR_LINE_SIZE) {
        player.floorLine.push("starter");
      }
      state.startingPlayerIndex = playerIndex;
    }
  }

  return {
    ...state,
    pendingTiles: pickedTiles,
    pendingColor: color,
    pendingPlayerId: playerId,
  };
}

function executePlacement(state: RoomState, playerId: string, targetLine: number): RoomState | null {
  if (state.pendingPlayerId !== playerId) return null;
  if (state.pendingTiles.length === 0 || !state.pendingColor) return null;

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  const player = state.players[playerIndex];
  const remaining: TileColor[] = [];

  if (targetLine >= 0 && targetLine < 5) {
    if (!canPlaceOnPatternLine(player, targetLine, state.pendingColor)) return null;

    const line = player.patternLines[targetLine];
    line.color = state.pendingColor;
    for (const tile of state.pendingTiles) {
      if (line.tiles.length < line.size) {
        line.tiles.push(tile);
      } else {
        remaining.push(tile);
      }
    }
  } else if (targetLine === -1) {
    // Floor line
    for (const tile of state.pendingTiles) {
      if (player.floorLine.length < FLOOR_LINE_SIZE) {
        player.floorLine.push(tile);
      } else {
        state.discardLid.push(tile);
      }
    }
  } else {
    return null;
  }

  if (remaining.length > 0) {
    return { ...state, pendingTiles: remaining };
  }

  // All tiles placed - check if round ends
  state.pendingTiles = [];
  state.pendingColor = null;
  state.pendingPlayerId = null;

  const allFactoriesEmpty = state.factories.every((f) => f.tiles.length === 0);
  const centerEmpty = state.centerPool.length === 0;

  if (allFactoriesEmpty && centerEmpty) {
    return executeWallTiling(state);
  } else {
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    return state;
  }
}

function executeWallTiling(state: RoomState): RoomState {
  for (const player of state.players) {
    for (let row = 0; row < 5; row++) {
      const line = player.patternLines[row];
      if (line.tiles.length === line.size && line.color !== null) {
        const col = getWallColumnForColor(row, line.color);
        if (player.wall[row][col] === null) {
          player.wall[row][col] = line.color;
          const points = scoreTilePlacement(player.wall, row, col);
          player.score += points;
        }
        const remaining = line.tiles.length - 1;
        for (let i = 0; i < remaining; i++) {
          state.discardLid.push(line.color!);
        }
        line.tiles = [];
        line.color = null;
      }

      // Clear incomplete lines too (per user request)
      if (line.tiles.length > 0) {
        for (const tile of line.tiles) {
          state.discardLid.push(tile);
        }
        line.tiles = [];
        line.color = null;
      }
    }

    // Floor penalties
    const floorCount = player.floorLine.length;
    if (floorCount > 0) {
      const penalty = calculateFloorPenalty(floorCount);
      player.score = Math.max(0, player.score + penalty);

      for (const tile of player.floorLine) {
        if (tile !== "starter") {
          state.discardLid.push(tile);
        }
      }
      player.floorLine = [];
    }
  }

  // Check for game end
  for (const player of state.players) {
    if (hasCompletedHorizontalRow(player.wall)) {
      return executeEndgame(state);
    }
  }

  return prepareNextRound(state);
}

function prepareNextRound(state: RoomState): RoomState {
  state.round++;
  state.phase = GamePhase.FactoryOffer;
  state.currentPlayerIndex = state.startingPlayerIndex;

  for (const player of state.players) {
    player.hasStartingMarker = false;
  }
  state.centerHasStartingMarker = true;

  for (const factory of state.factories) {
    factory.tiles = [];
    for (let t = 0; t < TILES_PER_FACTORY; t++) {
      if (state.bag.length === 0) {
        if (state.discardLid.length > 0) {
          state.bag = shuffle(state.discardLid);
          state.discardLid = [];
        } else {
          break;
        }
      }
      if (state.bag.length > 0) {
        factory.tiles.push(state.bag.pop()!);
      }
    }
  }

  return state;
}

function executeEndgame(state: RoomState): RoomState {
  state.phase = GamePhase.GameOver;

  // Calculate endgame bonuses
  for (const player of state.players) {
    let horizontalBonus = 0;
    let verticalBonus = 0;
    let colorBonus = 0;

    // Horizontal rows
    for (let row = 0; row < 5; row++) {
      if (player.wall[row].every((cell) => cell !== null)) {
        horizontalBonus += 2;
      }
    }

    // Vertical columns
    for (let col = 0; col < 5; col++) {
      let complete = true;
      for (let row = 0; row < 5; row++) {
        if (player.wall[row][col] === null) {
          complete = false;
          break;
        }
      }
      if (complete) verticalBonus += 7;
    }

    // Complete colors
    for (const color of ALL_COLORS) {
      let count = 0;
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          if (player.wall[row][col] === color) count++;
        }
      }
      if (count === 5) colorBonus += 10;
    }

    player.score += horizontalBonus + verticalBonus + colorBonus;
  }

  return state;
}

function getValidPlacementLines(state: RoomState, playerId: string): number[] {
  if (state.pendingPlayerId !== playerId || !state.pendingColor) return [];

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  const player = state.players[playerIndex];
  const validLines: number[] = [];

  for (let line = 0; line < 5; line++) {
    if (canPlaceOnPatternLine(player, line, state.pendingColor)) {
      validLines.push(line);
    }
  }
  validLines.push(-1); // Floor always valid

  return validLines;
}

// ─── Message Types ──────────────────────────────────────────
type ClientMessage =
  | { type: "join"; playerName: string }
  | { type: "start" }
  | { type: "pickup"; source: { type: "factory"; factoryId: number } | { type: "center" }; color: TileColor }
  | { type: "place"; targetLine: number }
  | { type: "leave" };

type ServerMessage =
  | { type: "state"; state: RoomState; validLines: number[] }
  | { type: "error"; message: string }
  | { type: "joined"; playerId: string };

// ─── PartyKit Server ────────────────────────────────────────
export default class AzulRoom implements Party.Server {
  state: RoomState;
  connections: Map<string, string> = new Map(); // odnnectionId -> playerId

  constructor(readonly room: Party.Room) {
    this.state = {
      id: room.id,
      phase: GamePhase.Lobby,
      round: 0,
      currentPlayerIndex: 0,
      players: [],
      factories: [],
      centerPool: [],
      centerHasStartingMarker: true,
      bag: [],
      discardLid: [],
      startingPlayerIndex: 0,
      hostId: "",
      maxPlayers: 4,
      pendingTiles: [],
      pendingColor: null,
      pendingPlayerId: null,
    };
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // Send current state
    this.sendToConnection(conn, {
      type: "state",
      state: this.state,
      validLines: [],
    });
  }

  onClose(conn: Party.Connection) {
    const playerId = this.connections.get(conn.id);
    if (playerId) {
      const player = this.state.players.find((p) => p.id === playerId);
      if (player) {
        player.connected = false;
      }
      this.connections.delete(conn.id);
      this.broadcast();
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const msg: ClientMessage = JSON.parse(message);
      this.handleMessage(msg, sender);
    } catch (e) {
      this.sendToConnection(sender, { type: "error", message: "Invalid message" });
    }
  }

  handleMessage(msg: ClientMessage, sender: Party.Connection) {
    switch (msg.type) {
      case "join":
        this.handleJoin(msg.playerName, sender);
        break;
      case "start":
        this.handleStart(sender);
        break;
      case "pickup":
        this.handlePickup(msg.source, msg.color, sender);
        break;
      case "place":
        this.handlePlace(msg.targetLine, sender);
        break;
      case "leave":
        this.handleLeave(sender);
        break;
    }
  }

  handleJoin(playerName: string, sender: Party.Connection) {
    if (this.state.phase !== GamePhase.Lobby) {
      // Check if reconnecting
      const existingPlayer = this.state.players.find(
        (p) => p.name === playerName && !p.connected
      );
      if (existingPlayer) {
        existingPlayer.connected = true;
        this.connections.set(sender.id, existingPlayer.id);
        this.sendToConnection(sender, { type: "joined", playerId: existingPlayer.id });
        this.broadcast();
        return;
      }
      this.sendToConnection(sender, { type: "error", message: "Game already in progress" });
      return;
    }

    if (this.state.players.length >= this.state.maxPlayers) {
      this.sendToConnection(sender, { type: "error", message: "Room is full" });
      return;
    }

    // Check if name already taken
    if (this.state.players.some((p) => p.name === playerName)) {
      this.sendToConnection(sender, { type: "error", message: "Name already taken" });
      return;
    }

    const playerId = `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const newPlayer: PlayerState = {
      id: playerId,
      name: playerName,
      score: 0,
      patternLines: createPatternLines(),
      wall: createEmptyWall(),
      floorLine: [],
      hasStartingMarker: false,
      connected: true,
    };

    this.state.players.push(newPlayer);
    this.connections.set(sender.id, playerId);

    if (this.state.players.length === 1) {
      this.state.hostId = playerId;
    }

    this.sendToConnection(sender, { type: "joined", playerId });
    this.broadcast();
  }

  handleStart(sender: Party.Connection) {
    const playerId = this.connections.get(sender.id);
    if (playerId !== this.state.hostId) {
      this.sendToConnection(sender, { type: "error", message: "Only host can start" });
      return;
    }

    if (this.state.players.length < 2) {
      this.sendToConnection(sender, { type: "error", message: "Need at least 2 players" });
      return;
    }

    this.state = initializeGame(this.state);
    this.broadcast();
  }

  handlePickup(
    source: { type: "factory"; factoryId: number } | { type: "center" },
    color: TileColor,
    sender: Party.Connection
  ) {
    const playerId = this.connections.get(sender.id);
    if (!playerId) return;

    const newState = executePickup(this.state, playerId, source, color);
    if (newState) {
      this.state = newState;
      this.broadcast();
    } else {
      this.sendToConnection(sender, { type: "error", message: "Invalid pickup" });
    }
  }

  handlePlace(targetLine: number, sender: Party.Connection) {
    const playerId = this.connections.get(sender.id);
    if (!playerId) return;

    const newState = executePlacement(this.state, playerId, targetLine);
    if (newState) {
      this.state = newState;
      this.broadcast();
    } else {
      this.sendToConnection(sender, { type: "error", message: "Invalid placement" });
    }
  }

  handleLeave(sender: Party.Connection) {
    const playerId = this.connections.get(sender.id);
    if (playerId) {
      const player = this.state.players.find((p) => p.id === playerId);
      if (player) {
        player.connected = false;
      }
      this.connections.delete(sender.id);
      this.broadcast();
    }
  }

  broadcast() {
    for (const [connId, playerId] of this.connections) {
      const conn = this.room.getConnection(connId);
      if (conn) {
        const validLines = getValidPlacementLines(this.state, playerId);
        this.sendToConnection(conn, {
          type: "state",
          state: this.state,
          validLines,
        });
      }
    }
  }

  sendToConnection(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }
}