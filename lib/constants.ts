import { TileColor } from "./types";

// ─── Standard Wall Pattern ─────────────────────────────────────
// Each row has a fixed color order (shifted by 1 each row)
// Row 0: Blue, Yellow, Red, Black, Cyan
// Row 1: Cyan, Blue, Yellow, Red, Black
// Row 2: Black, Cyan, Blue, Yellow, Red
// Row 3: Red, Black, Cyan, Blue, Yellow
// Row 4: Yellow, Red, Black, Cyan, Blue
export const WALL_PATTERN: TileColor[][] = [
  [TileColor.Blue, TileColor.Yellow, TileColor.Red, TileColor.Black, TileColor.Cyan],
  [TileColor.Cyan, TileColor.Blue, TileColor.Yellow, TileColor.Red, TileColor.Black],
  [TileColor.Black, TileColor.Cyan, TileColor.Blue, TileColor.Yellow, TileColor.Red],
  [TileColor.Red, TileColor.Black, TileColor.Cyan, TileColor.Blue, TileColor.Yellow],
  [TileColor.Yellow, TileColor.Red, TileColor.Black, TileColor.Cyan, TileColor.Blue],
];

// ─── Floor Line Penalties ──────────────────────────────────────
// Positions 0-6, penalties: -1, -1, -2, -2, -2, -3, -3
export const FLOOR_PENALTIES = [-1, -1, -2, -2, -2, -3, -3];
export const FLOOR_LINE_SIZE = 7;

// ─── Factory Display Count ─────────────────────────────────────
export const FACTORY_COUNT: Record<number, number> = {
  2: 5,
  3: 7,
  4: 9,
};

// ─── Tiles per Color ───────────────────────────────────────────
export const TILES_PER_COLOR = 20;
export const TILES_PER_FACTORY = 4;

// ─── Endgame Bonuses ───────────────────────────────────────────
export const HORIZONTAL_ROW_BONUS = 2;
export const VERTICAL_COLUMN_BONUS = 7;
export const COMPLETE_COLOR_BONUS = 10;

// ─── Get wall column for a color on a given row ────────────────
export function getWallColumnForColor(row: number, color: TileColor): number {
  return WALL_PATTERN[row].indexOf(color);
}

// ─── Get the color at a wall position ──────────────────────────
export function getWallColorAt(row: number, col: number): TileColor {
  return WALL_PATTERN[row][col];
}

// ─── Check if a color is already on a wall row ─────────────────
export function isColorOnWallRow(
  wall: (TileColor | null)[][],
  row: number,
  color: TileColor
): boolean {
  const col = getWallColumnForColor(row, color);
  return wall[row][col] !== null;
}

// ─── Player Colors for UI ──────────────────────────────────────
export const PLAYER_COLORS = ["#4a9eff", "#e8a838", "#c43a3a", "#3ab8b0"];
export const PLAYER_NAMES_DEFAULT = ["Player 1", "Player 2", "Player 3", "Player 4"];

// ─── Tile Color Display Names ──────────────────────────────────
export const TILE_COLOR_HEX: Record<TileColor, string> = {
  [TileColor.Blue]: "#1a6fb0",
  [TileColor.Yellow]: "#e8a838",
  [TileColor.Red]: "#c43a3a",
  [TileColor.Black]: "#4a4a4a",
  [TileColor.Cyan]: "#3ab8b0",
};

export const TILE_COLOR_NAMES: Record<TileColor, string> = {
  [TileColor.Blue]: "Blue",
  [TileColor.Yellow]: "Yellow",
  [TileColor.Red]: "Red",
  [TileColor.Black]: "Black",
  [TileColor.Cyan]: "Cyan",
};