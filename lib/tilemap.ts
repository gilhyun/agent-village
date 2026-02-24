// Tilemap data — 100×75 grid (16px tiles → 1600×1200 map)
import { VILLAGE_BUILDINGS } from "./village";

export const TILE_SIZE = 16;
export const TILE_SCALE = 2;
export const TILES_X = 57; // 1800 / 32 ≈ 56.25
export const TILES_Y = 44;  // 1400 / 32 ≈ 43.75

// Tile types
export const T = {
  GRASS: 0,
  DIRT: 1,
  WATER: 2,
  STONE: 3,
  GRASS_TALL: 4, // 풀숲 (짙은 잔디)
} as const;

export type TileType = (typeof T)[keyof typeof T];

// Build tilemap
function buildTilemap(): TileType[][] {
  // Initialize all grass
  const map: TileType[][] = [];
  for (let y = 0; y < TILES_Y; y++) {
    map[y] = [];
    for (let x = 0; x < TILES_X; x++) {
      map[y][x] = T.GRASS;
    }
  }

  // Plaza center (tiles) — plaza is at pixel (720,550) size (160,120)
  // In tiles at 32px: x=22, y=17, w=5, h=4
  const plazaTX = 22, plazaTY = 17, plazaTW = 5, plazaTH = 4;
  for (let y = plazaTY; y < plazaTY + plazaTH; y++) {
    for (let x = plazaTX; x < plazaTX + plazaTW; x++) {
      map[y][x] = T.STONE;
    }
  }

  // Plaza center point (for roads)
  const centerTX = 25; // plazaTX + plazaTW/2
  const centerTY = 19; // plazaTY + plazaTH/2

  // Main horizontal road through plaza center
  const roadWidth = 1;
  for (let x = 2; x < TILES_X - 2; x++) {
    for (let dy = 0; dy <= roadWidth; dy++) {
      const ry = centerTY + dy;
      if (ry >= 0 && ry < TILES_Y && map[ry][x] === T.GRASS) {
        map[ry][x] = T.DIRT;
      }
    }
  }

  // Main vertical road through plaza center
  for (let y = 2; y < TILES_Y - 2; y++) {
    for (let dx = 0; dx <= roadWidth; dx++) {
      const rx = centerTX + dx;
      if (rx >= 0 && rx < TILES_X && map[y][rx] === T.GRASS) {
        map[y][rx] = T.DIRT;
      }
    }
  }

  // Branch roads to each building (L-shaped: vertical from center, then horizontal)
  const tilePixels = TILE_SIZE * TILE_SCALE;
  VILLAGE_BUILDINGS.forEach((b) => {
    if (b.id === "plaza") return;
    const bCenterTX = Math.floor((b.x + b.width / 2) / tilePixels);
    const bCenterTY = Math.floor((b.y + b.height / 2) / tilePixels);

    // Vertical segment from centerTY to bCenterTY
    const yStart = Math.min(centerTY, bCenterTY);
    const yEnd = Math.max(centerTY, bCenterTY);
    for (let y = yStart; y <= yEnd; y++) {
      for (let dx = 0; dx < roadWidth; dx++) {
        const rx = centerTX + dx;
        if (rx >= 0 && rx < TILES_X && y >= 0 && y < TILES_Y) {
          if (map[y][rx] === T.GRASS) map[y][rx] = T.DIRT;
        }
      }
    }

    // Horizontal segment at bCenterTY
    const xStart = Math.min(centerTX, bCenterTX);
    const xEnd = Math.max(centerTX, bCenterTX);
    for (let x = xStart; x <= xEnd; x++) {
      for (let dy = 0; dy < roadWidth; dy++) {
        const ry = bCenterTY + dy;
        if (x >= 0 && x < TILES_X && ry >= 0 && ry < TILES_Y) {
          if (map[ry][x] === T.GRASS) map[ry][x] = T.DIRT;
        }
      }
    }
  });

  // Small pond in park area (park pixel 350,850 → tile ~11,27 at 32px)
  const pondCX = 13, pondCY = 29;
  const pondTiles = [
    [0,2,2,0],
    [2,2,2,2],
    [2,2,2,2],
    [0,2,2,0],
  ];
  pondTiles.forEach((row, dy) => {
    row.forEach((t, dx) => {
      if (t === 2) {
        const py = pondCY + dy;
        const ppx = pondCX + dx;
        if (py >= 0 && py < TILES_Y && ppx >= 0 && ppx < TILES_X) {
          map[py][ppx] = T.WATER;
        }
      }
    });
  });

  // Tall grass patches (풀숲) - scattered around the map
  const tallGrassPatches = [
    { cx: 5, cy: 5, r: 3 },
    { cx: 45, cy: 5, r: 2 },
    { cx: 8, cy: 20, r: 2 },
    { cx: 48, cy: 22, r: 3 },
    { cx: 3, cy: 35, r: 2 },
    { cx: 52, cy: 35, r: 2 },
    { cx: 20, cy: 8, r: 2 },
    { cx: 35, cy: 40, r: 2 },
    { cx: 50, cy: 12, r: 2 },
    { cx: 15, cy: 40, r: 3 },
  ];
  tallGrassPatches.forEach(({ cx, cy, r }) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          const ty = cy + dy;
          const tx = cx + dx;
          if (ty >= 0 && ty < TILES_Y && tx >= 0 && tx < TILES_X && map[ty][tx] === T.GRASS) {
            map[ty][tx] = T.GRASS_TALL;
          }
        }
      }
    }
  });

  return map;
}

export const TILEMAP = buildTilemap();

// ── Decoration positions ──
export interface DecoPos {
  tx: number; // tile x
  ty: number; // tile y
  type: "tree" | "flower" | "bush" | "rock" | "fence_h" | "fence_v";
  variant: number;
}

function buildDecorations(): DecoPos[] {
  const decos: DecoPos[] = [];
  const occupied = new Set<string>();

  // Mark building tiles as occupied
  const tPx = TILE_SIZE * TILE_SCALE;
  VILLAGE_BUILDINGS.forEach((b) => {
    const tx1 = Math.floor(b.x / tPx) - 1;
    const ty1 = Math.floor(b.y / tPx) - 2;
    const tx2 = Math.ceil((b.x + b.width) / tPx) + 1;
    const ty2 = Math.ceil((b.y + b.height) / tPx) + 1;
    for (let y = ty1; y <= ty2; y++) {
      for (let x = tx1; x <= tx2; x++) {
        occupied.add(`${x},${y}`);
      }
    }
  });

  // Check if tile is available (grass, not on road/water/building)
  const isAvailable = (tx: number, ty: number) => {
    if (tx < 1 || tx >= TILES_X - 1 || ty < 1 || ty >= TILES_Y - 1) return false;
    if (TILEMAP[ty][tx] !== T.GRASS) return false;
    if (occupied.has(`${tx},${ty}`)) return false;
    return true;
  };

  // Seeded random (deterministic)
  let seed = 42;
  const rand = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; };

  // Trees (30)
  for (let i = 0; i < 30; i++) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const tx = Math.floor(rand() * (TILES_X - 4)) + 2;
      const ty = Math.floor(rand() * (TILES_Y - 4)) + 2;
      if (isAvailable(tx, ty) && isAvailable(tx + 1, ty) && isAvailable(tx, ty + 1)) {
        decos.push({ tx, ty, type: "tree", variant: Math.floor(rand() * 4) });
        occupied.add(`${tx},${ty}`);
        occupied.add(`${tx + 1},${ty}`);
        occupied.add(`${tx},${ty + 1}`);
        break;
      }
    }
  }

  // Flowers (50)
  for (let i = 0; i < 50; i++) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const tx = Math.floor(rand() * (TILES_X - 2)) + 1;
      const ty = Math.floor(rand() * (TILES_Y - 2)) + 1;
      if (isAvailable(tx, ty)) {
        decos.push({ tx, ty, type: "flower", variant: Math.floor(rand() * 5) });
        occupied.add(`${tx},${ty}`);
        break;
      }
    }
  }

  // Bushes (20)
  for (let i = 0; i < 20; i++) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const tx = Math.floor(rand() * (TILES_X - 2)) + 1;
      const ty = Math.floor(rand() * (TILES_Y - 2)) + 1;
      if (isAvailable(tx, ty)) {
        decos.push({ tx, ty, type: "bush", variant: 0 });
        occupied.add(`${tx},${ty}`);
        break;
      }
    }
  }

  // Rocks (12)
  for (let i = 0; i < 12; i++) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const tx = Math.floor(rand() * (TILES_X - 2)) + 1;
      const ty = Math.floor(rand() * (TILES_Y - 2)) + 1;
      if (isAvailable(tx, ty)) {
        decos.push({ tx, ty, type: "rock", variant: Math.floor(rand() * 3) });
        occupied.add(`${tx},${ty}`);
        break;
      }
    }
  }

  return decos;
}

export const DECORATIONS = buildDecorations();
