import { TileColor, WallGrid, PlayerState, EndgameScoring, ALL_COLORS } from "./types";
import {
  FLOOR_PENALTIES,
  HORIZONTAL_ROW_BONUS,
  VERTICAL_COLUMN_BONUS,
  COMPLETE_COLOR_BONUS,
} from "./constants";

// ─── Score a newly placed tile on the wall ─────────────────────
// Returns points gained for placing a tile at (row, col)
export function scoreTilePlacement(wall: WallGrid, row: number, col: number): number {
  let points = 0;
  let horizontalCount = 0;
  let verticalCount = 0;

  // Count horizontally linked tiles (left)
  for (let c = col - 1; c >= 0; c--) {
    if (wall[row][c] !== null) horizontalCount++;
    else break;
  }
  // Count horizontally linked tiles (right)
  for (let c = col + 1; c < 5; c++) {
    if (wall[row][c] !== null) horizontalCount++;
    else break;
  }

  // Count vertically linked tiles (up)
  for (let r = row - 1; r >= 0; r--) {
    if (wall[r][col] !== null) verticalCount++;
    else break;
  }
  // Count vertically linked tiles (down)
  for (let r = row + 1; r < 5; r++) {
    if (wall[r][col] !== null) verticalCount++;
    else break;
  }

  if (horizontalCount === 0 && verticalCount === 0) {
    // No adjacent tiles - gain 1 point
    return 1;
  }

  // If horizontally linked, count all linked tiles including the new one
  if (horizontalCount > 0) {
    points += horizontalCount + 1; // +1 for the newly placed tile
  }

  // If vertically linked, count all linked tiles including the new one
  if (verticalCount > 0) {
    points += verticalCount + 1; // +1 for the newly placed tile
  }

  return points;
}

// ─── Calculate floor line penalty ──────────────────────────────
export function calculateFloorPenalty(floorTileCount: number): number {
  let penalty = 0;
  for (let i = 0; i < Math.min(floorTileCount, FLOOR_PENALTIES.length); i++) {
    penalty += FLOOR_PENALTIES[i];
  }
  return penalty; // Returns negative number
}

// ─── Endgame scoring ───────────────────────────────────────────
export function calculateEndgameScoring(player: PlayerState): EndgameScoring {
  const wall = player.wall;
  let horizontalRows = 0;
  let verticalColumns = 0;
  let completeColors = 0;

  // Count complete horizontal rows
  for (let row = 0; row < 5; row++) {
    if (wall[row].every((cell) => cell !== null)) {
      horizontalRows++;
    }
  }

  // Count complete vertical columns
  for (let col = 0; col < 5; col++) {
    let complete = true;
    for (let row = 0; row < 5; row++) {
      if (wall[row][col] === null) {
        complete = false;
        break;
      }
    }
    if (complete) verticalColumns++;
  }

  // Count complete colors (all 5 tiles of one color placed)
  for (const color of ALL_COLORS) {
    let count = 0;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (wall[row][col] === color) count++;
      }
    }
    if (count === 5) completeColors++;
  }

  const horizontalBonus = horizontalRows * HORIZONTAL_ROW_BONUS;
  const verticalBonus = verticalColumns * VERTICAL_COLUMN_BONUS;
  const colorBonus = completeColors * COMPLETE_COLOR_BONUS;

  return {
    playerId: player.id,
    playerName: player.name,
    baseScore: player.score,
    horizontalRows,
    horizontalBonus,
    verticalColumns,
    verticalBonus,
    completeColors,
    colorBonus,
    totalScore: player.score + horizontalBonus + verticalBonus + colorBonus,
  };
}

// ─── Check if any player has completed a horizontal row ────────
export function hasCompletedHorizontalRow(wall: WallGrid): boolean {
  for (let row = 0; row < 5; row++) {
    if (wall[row].every((cell) => cell !== null)) {
      return true;
    }
  }
  return false;
}
