# Azul Online

A faithful digital recreation of the Azul board game. Local multiplayer for 2–4 players.

## Project Structure

```
azul-online/
├── app/
│   ├── layout.tsx              # Root layout with fonts
│   ├── page.tsx                # Home / Lobby — create a new game
│   ├── globals.css             # Global styles, tile designs, animations
│   └── game/
│       └── [id]/
│           └── page.tsx        # Main game board — full interactive game
├── lib/
│   ├── types.ts                # All TypeScript types & enums
│   ├── constants.ts            # Wall patterns, penalties, factory counts
│   ├── scoring.ts              # Scoring logic (wall placement + endgame)
│   └── gameEngine.ts           # Core game engine (state machine, validation)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
└── next.config.js
```

## Routes

| Route | Page | Description |
|---|---|---|
| `/` | Home / Lobby | Set player count (2–4), names, variant toggle, start game |
| `/game/local?players=[...]&variant=0` | Game Board | Full interactive Azul game board |

## Setup & Run

```bash
# 1. Install dependencies
npm install

# 2. Run development server
npm run dev

# 3. Open in browser
open http://localhost:3000
```

## Game Rules Implemented

- ✅ 2–4 player support with correct factory counts (5/7/9)
- ✅ Factory Offer phase with proper tile picking
- ✅ Center pool with starting player marker
- ✅ Pattern line placement with all validation rules
- ✅ Floor line with correct penalties (−1, −1, −2, −2, −2, −3, −3)
- ✅ Wall tiling with adjacency scoring
- ✅ Bag exhaustion & discard lid refill
- ✅ Game end detection (completed horizontal row)
- ✅ Endgame bonuses (+2 rows, +7 columns, +10 complete colors)
- ✅ Tiebreaker rules (most horizontal rows, then shared victory)
- ✅ Gray Wall Variant (optional toggle)
- ✅ Full move validation — illegal moves are impossible
- ✅ Complete game log

## Deployment

```bash
npm run build
# Deploy to Vercel
vercel deploy
```
