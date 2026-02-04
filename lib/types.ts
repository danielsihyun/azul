// ─── Tile Colors ───────────────────────────────────────────────
export enum TileColor {
  Blue = "blue",
  Yellow = "yellow",
  Red = "red",
  Black = "black",
  Cyan = "cyan",
}

export const ALL_COLORS: TileColor[] = [
  TileColor.Blue,
  TileColor.Yellow,
  TileColor.Red,
  TileColor.Black,
  TileColor.Cyan,
];

// ─── Game Phase ───────────────────────────────────────────────
export enum GamePhase {
  Setup = "setup",
  FactoryOffer = "factoryOffer",
  WallTiling = "wallTiling",
  Scoring = "scoring",
  Preparing = "preparing",
  GameOver = "gameOver",
}

// ─── Tile Placement Target ────────────────────────────────────
export type PlacementTarget =
  | { type: "patternLine"; lineIndex: number }
  | { type: "floorLine" };

// ─── Factory Display ──────────────────────────────────────────
export interface FactoryDisplay {
  id: number;
  tiles: TileColor[];
}

// ─── Pattern Line ─────────────────────────────────────────────
export interface PatternLine {
  size: number; // 1-5
  tiles: TileColor[]; // filled from right to left (stored as array)
  color: TileColor | null; // locked color once tiles are placed
}

// ─── Wall ─────────────────────────────────────────────────────
// 5x5 grid, each cell is either a TileColor or null
export type WallGrid = (TileColor | null)[][];

// ─── Player State ─────────────────────────────────────────────
export interface PlayerState {
  id: string;
  name: string;
  score: number;
  patternLines: PatternLine[];
  wall: WallGrid;
  floorLine: (TileColor | "starter")[]; // starter marker is special
  hasStartingMarker: boolean;
}

// ─── Game State ───────────────────────────────────────────────
export interface GameState {
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
  startingPlayerIndex: number; // who starts next round
  useVariantWall: boolean;
  gameLog: GameLogEntry[];
  winner: string | null;
  tieBreaker: string | null;
}

// ─── Move Types ───────────────────────────────────────────────
export interface FactoryPickMove {
  type: "factoryPick";
  factoryId: number;
  color: TileColor;
  targetLine: number; // 0-4 for pattern lines, -1 for floor line
}

export interface CenterPickMove {
  type: "centerPick";
  color: TileColor;
  targetLine: number; // 0-4 for pattern lines, -1 for floor line
}

export type GameMove = FactoryPickMove | CenterPickMove;

// ─── Validation Result ────────────────────────────────────────
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ─── Game Log ─────────────────────────────────────────────────
export interface GameLogEntry {
  round: number;
  playerName: string;
  action: string;
  timestamp: number;
}

// ─── Scoring Breakdown (endgame) ──────────────────────────────
export interface EndgameScoring {
  playerId: string;
  playerName: string;
  baseScore: number;
  horizontalRows: number;
  horizontalBonus: number;
  verticalColumns: number;
  verticalBonus: number;
  completeColors: number;
  colorBonus: number;
  totalScore: number;
}

// ─── Available Move (for UI highlighting) ─────────────────────
export interface AvailableMove {
  source: "factory" | "center";
  factoryId?: number;
  color: TileColor;
  validTargetLines: number[]; // -1 = floor, 0-4 = pattern lines
}
