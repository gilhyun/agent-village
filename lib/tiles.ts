// Pixel art tile drawing functions — 16x16 tiles drawn with fillRect
// Each function draws at (x, y) with given pixel scale
// Inspired by Stardew Valley / classic SNES RPG tilesets

type Ctx = CanvasRenderingContext2D;

// ── Helpers ──
function px(ctx: Ctx, x: number, y: number, s: number, px_x: number, px_y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x + px_x * s, y + px_y * s, s, s);
}

function rect(ctx: Ctx, x: number, y: number, s: number, px_x: number, px_y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x + px_x * s, y + px_y * s, w * s, h * s);
}

// ── Color palette — rich, Stardew Valley inspired ──
const GRASS = {
  base: "#5b9e47",
  dark: "#4a8a38",
  darker: "#3d7a2d",
  light: "#6db55a",
  highlight: "#80c86e",
  flower1: "#e87ea1",
  flower2: "#f9d84a",
  flower3: "#8fb5e8",
};

const DIRT = {
  base: "#c9a96a",
  dark: "#b08f54",
  light: "#dabe82",
  edge: "#a07d42",
  pebble: "#8a7040",
};

const WATER = {
  base: "#4a9ed6",
  dark: "#3a82b8",
  mid: "#62b4e6",
  light: "#8ecef0",
  shine: "#b8e4ff",
};

const STONE = {
  base: "#a0a8b4",
  dark: "#808890",
  light: "#c0c8d0",
  line: "#606870",
};

// ── Grass Tile (lush, varied) ──
export function drawGrassTile(ctx: Ctx, x: number, y: number, s: number, variant: number = 0) {
  // Rich base gradient feel
  rect(ctx, x, y, s, 0, 0, 16, 16, GRASS.base);

  // Dithered dark/light patches for depth
  const v = variant % 12;
  const patterns: [number, number, string][][] = [
    [[2,3,GRASS.dark],[5,7,GRASS.dark],[10,2,GRASS.light],[13,11,GRASS.light],[8,14,GRASS.dark],[3,12,GRASS.light]],
    [[1,5,GRASS.light],[6,1,GRASS.dark],[12,8,GRASS.light],[9,13,GRASS.dark],[4,9,GRASS.light],[14,4,GRASS.dark]],
    [[3,2,GRASS.darker],[7,6,GRASS.highlight],[11,10,GRASS.darker],[2,14,GRASS.light],[14,1,GRASS.dark],[8,4,GRASS.light]],
    [[0,8,GRASS.dark],[5,0,GRASS.light],[10,5,GRASS.dark],[15,12,GRASS.light],[3,15,GRASS.dark],[12,3,GRASS.highlight]],
    [[4,4,GRASS.light],[8,8,GRASS.dark],[12,12,GRASS.light],[2,10,GRASS.dark],[14,6,GRASS.light],[7,2,GRASS.darker]],
    [[1,1,GRASS.dark],[6,6,GRASS.light],[11,11,GRASS.dark],[3,8,GRASS.highlight],[9,3,GRASS.dark],[13,14,GRASS.light]],
    [[2,6,GRASS.light],[7,12,GRASS.dark],[13,3,GRASS.light],[5,10,GRASS.darker],[10,7,GRASS.highlight],[15,0,GRASS.dark]],
    [[0,4,GRASS.darker],[4,0,GRASS.light],[8,12,GRASS.dark],[12,4,GRASS.highlight],[6,8,GRASS.dark],[14,14,GRASS.light]],
    [[3,3,GRASS.highlight],[9,9,GRASS.dark],[1,13,GRASS.light],[13,1,GRASS.dark],[7,7,GRASS.light],[11,5,GRASS.darker]],
    [[5,5,GRASS.dark],[11,1,GRASS.light],[2,9,GRASS.dark],[14,7,GRASS.highlight],[8,15,GRASS.dark],[0,11,GRASS.light]],
    [[4,1,GRASS.dark],[10,4,GRASS.light],[1,10,GRASS.darker],[13,13,GRASS.light],[7,7,GRASS.dark],[6,14,GRASS.highlight]],
    [[3,7,GRASS.light],[9,2,GRASS.dark],[0,14,GRASS.light],[12,9,GRASS.darker],[5,11,GRASS.light],[15,5,GRASS.dark]],
  ];

  patterns[v].forEach(([px_x, px_y, color]) => {
    px(ctx, x, y, s, px_x, px_y, color);
  });

  // Extra grass blades (subtle vertical lines)
  if (v % 3 === 0) {
    px(ctx, x, y, s, 4, 6, GRASS.darker);
    px(ctx, x, y, s, 4, 5, GRASS.dark);
    px(ctx, x, y, s, 11, 9, GRASS.darker);
    px(ctx, x, y, s, 11, 8, GRASS.dark);
  }

  // Small flowers on some variants
  if (v === 2) {
    px(ctx, x, y, s, 6, 3, GRASS.flower2);
    px(ctx, x, y, s, 13, 11, GRASS.flower1);
  }
  if (v === 7) {
    px(ctx, x, y, s, 4, 10, GRASS.flower1);
    px(ctx, x, y, s, 12, 5, GRASS.flower3);
  }
  if (v === 10) {
    px(ctx, x, y, s, 8, 2, GRASS.flower2);
  }
}

// ── Tall Grass (풀숲 — darker, bushier) ──
export function drawTallGrassTile(ctx: Ctx, x: number, y: number, s: number, variant: number = 0) {
  // Darker base
  rect(ctx, x, y, s, 0, 0, 16, 16, GRASS.dark);

  const v = variant % 6;
  // Dense grass blade pattern
  const blades: [number, number, string][] = [
    [2, 3, GRASS.darker], [3, 2, GRASS.darker], [4, 4, GRASS.base],
    [6, 1, GRASS.darker], [7, 3, GRASS.dark], [8, 2, GRASS.darker],
    [10, 4, GRASS.base], [11, 1, GRASS.darker], [13, 3, GRASS.darker],
    [1, 7, GRASS.darker], [3, 6, GRASS.base], [5, 8, GRASS.darker],
    [7, 7, GRASS.dark], [9, 6, GRASS.darker], [11, 8, GRASS.base],
    [13, 7, GRASS.darker], [14, 6, GRASS.darker],
    [2, 10, GRASS.darker], [4, 11, GRASS.base], [6, 10, GRASS.darker],
    [8, 12, GRASS.dark], [10, 10, GRASS.darker], [12, 11, GRASS.base],
    [14, 10, GRASS.darker],
    [1, 14, GRASS.darker], [3, 13, GRASS.base], [5, 14, GRASS.darker],
    [9, 14, GRASS.dark], [11, 13, GRASS.darker], [13, 14, GRASS.base],
  ];
  blades.forEach(([bx, by, color]) => {
    px(ctx, x, y, s, (bx + v) % 16, by, color);
  });

  // Tall grass tips (lighter, sticking up)
  if (v % 2 === 0) {
    px(ctx, x, y, s, 4, 1, GRASS.light);
    px(ctx, x, y, s, 10, 0, GRASS.light);
    px(ctx, x, y, s, 7, 5, GRASS.light);
    px(ctx, x, y, s, 13, 9, GRASS.light);
  } else {
    px(ctx, x, y, s, 2, 0, GRASS.light);
    px(ctx, x, y, s, 8, 1, GRASS.light);
    px(ctx, x, y, s, 5, 6, GRASS.light);
    px(ctx, x, y, s, 11, 10, GRASS.light);
  }

  // Occasional wildflower
  if (v === 3) px(ctx, x, y, s, 6, 9, "#e87ea1");
  if (v === 5) px(ctx, x, y, s, 12, 4, "#f9d84a");
}

// ── Dirt Path Tile ──
export function drawDirtPathTile(ctx: Ctx, x: number, y: number, s: number, variant: number = 0) {
  rect(ctx, x, y, s, 0, 0, 16, 16, DIRT.base);

  const v = variant % 6;
  // Texture variation
  const dirtPatterns: [number, number, string][][] = [
    [[3,5,DIRT.dark],[10,2,DIRT.light],[7,11,DIRT.dark],[13,8,DIRT.light],[6,9,DIRT.pebble]],
    [[5,3,DIRT.light],[12,10,DIRT.dark],[2,9,DIRT.dark],[8,14,DIRT.light],[11,5,DIRT.pebble]],
    [[1,1,DIRT.dark],[14,14,DIRT.dark],[6,7,DIRT.light],[9,3,DIRT.pebble],[4,12,DIRT.light]],
    [[9,4,DIRT.light],[4,12,DIRT.dark],[11,7,DIRT.dark],[2,2,DIRT.light],[7,10,DIRT.pebble]],
    [[3,8,DIRT.dark],[13,4,DIRT.light],[7,1,DIRT.dark],[10,13,DIRT.light],[5,6,DIRT.pebble]],
    [[8,2,DIRT.light],[2,11,DIRT.dark],[14,8,DIRT.pebble],[6,5,DIRT.dark],[12,14,DIRT.light]],
  ];
  dirtPatterns[v].forEach(([px_x, px_y, color]) => {
    px(ctx, x, y, s, px_x, px_y, color);
  });

  // Edge highlight (top-left lighter)
  if (v < 3) {
    px(ctx, x, y, s, 0, 0, DIRT.light);
    px(ctx, x, y, s, 1, 0, DIRT.light);
  }
}

// ── Dirt Edge (grass-to-dirt transition) ──
export function drawDirtEdgeTile(ctx: Ctx, x: number, y: number, s: number, side: "top" | "bottom" | "left" | "right") {
  rect(ctx, x, y, s, 0, 0, 16, 16, GRASS.base);
  if (side === "top") {
    rect(ctx, x, y, s, 0, 5, 16, 11, DIRT.base);
    // Dithered transition
    for (let i = 0; i < 16; i += 2) px(ctx, x, y, s, i, 4, DIRT.base);
    for (let i = 1; i < 16; i += 3) px(ctx, x, y, s, i, 3, DIRT.base);
  } else if (side === "bottom") {
    rect(ctx, x, y, s, 0, 0, 16, 11, DIRT.base);
    for (let i = 0; i < 16; i += 2) px(ctx, x, y, s, i, 11, DIRT.base);
    for (let i = 1; i < 16; i += 3) px(ctx, x, y, s, i, 12, DIRT.base);
  } else if (side === "left") {
    rect(ctx, x, y, s, 5, 0, 11, 16, DIRT.base);
    for (let i = 0; i < 16; i += 2) px(ctx, x, y, s, 4, i, DIRT.base);
    for (let i = 1; i < 16; i += 3) px(ctx, x, y, s, 3, i, DIRT.base);
  } else {
    rect(ctx, x, y, s, 0, 0, 11, 16, DIRT.base);
    for (let i = 0; i < 16; i += 2) px(ctx, x, y, s, 11, i, DIRT.base);
    for (let i = 1; i < 16; i += 3) px(ctx, x, y, s, 12, i, DIRT.base);
  }
}

// ── Water Tile (animated shimmer) ──
export function drawWaterTile(ctx: Ctx, x: number, y: number, s: number, tick: number = 0) {
  rect(ctx, x, y, s, 0, 0, 16, 16, WATER.base);

  // Animated ripple pattern
  const phase = Math.floor(tick / 15) % 6;
  for (let row = 1; row < 15; row += 3) {
    const offset = (phase + row * 2) % 6;
    for (let col = offset; col < 16; col += 6) {
      px(ctx, x, y, s, col, row, WATER.mid);
      if (col + 1 < 16) px(ctx, x, y, s, col + 1, row, WATER.light);
      if (col + 2 < 16) px(ctx, x, y, s, col + 2, row, WATER.mid);
    }
  }

  // Sparkle highlights (move with animation)
  const sparkleX = (phase * 3 + 5) % 14 + 1;
  const sparkleY = (phase * 5 + 3) % 12 + 2;
  px(ctx, x, y, s, sparkleX, sparkleY, WATER.shine);
  px(ctx, x, y, s, (sparkleX + 7) % 14 + 1, (sparkleY + 5) % 12 + 2, WATER.shine);

  // Depth shadows
  px(ctx, x, y, s, 4, 8, WATER.dark);
  px(ctx, x, y, s, 12, 4, WATER.dark);
  px(ctx, x, y, s, 8, 13, WATER.dark);
  px(ctx, x, y, s, 2, 3, WATER.dark);
}

// ── Stone/Cobblestone Tile ──
export function drawStoneTile(ctx: Ctx, x: number, y: number, s: number, variant: number = 0) {
  rect(ctx, x, y, s, 0, 0, 16, 16, STONE.base);

  // Brick pattern — offset rows
  // Row 1: two bricks
  rect(ctx, x, y, s, 0, 0, 7, 7, STONE.light);
  rect(ctx, x, y, s, 8, 0, 8, 7, STONE.base);
  // Row 2: offset bricks
  rect(ctx, x, y, s, 0, 8, 4, 8, STONE.base);
  rect(ctx, x, y, s, 5, 8, 7, 8, STONE.light);
  rect(ctx, x, y, s, 13, 8, 3, 8, STONE.base);

  // Mortar lines
  ctx.fillStyle = STONE.line;
  for (let i = 0; i < 16; i++) {
    ctx.fillRect(x + i * s, y + 7 * s, s, s);
    ctx.fillRect(x + i * s, y + 15 * s, s, s);
  }
  for (let j = 0; j < 7; j++) ctx.fillRect(x + 7 * s, y + j * s, s, s);
  for (let j = 8; j < 15; j++) {
    ctx.fillRect(x + 4 * s, y + j * s, s, s);
    ctx.fillRect(x + 12 * s, y + j * s, s, s);
  }

  // Subtle wear marks
  if (variant % 3 === 0) { px(ctx, x, y, s, 3, 3, STONE.dark); px(ctx, x, y, s, 10, 11, STONE.dark); }
  if (variant % 3 === 1) { px(ctx, x, y, s, 2, 5, STONE.dark); px(ctx, x, y, s, 9, 10, STONE.light); }
}

// ── Tree (lush, rounded canopy with highlights) ──
export function drawTreeTile(ctx: Ctx, x: number, y: number, s: number, variant: number = 0) {
  const greens = variant % 2 === 0
    ? ["#2a6318", "#38851e", "#4aa530", "#5cc044", "#70d458"]
    : ["#1e5a10", "#2c7818", "#3c9528", "#4cad38", "#5ec048"];

  // Shadow on ground
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(x + 8 * s, y + 15 * s, 7 * s, 2 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Trunk with bark detail
  rect(ctx, x, y, s, 6, 11, 4, 5, "#5a3010");
  rect(ctx, x, y, s, 7, 12, 2, 4, "#7a4820");
  px(ctx, x, y, s, 6, 13, "#4a2008");
  px(ctx, x, y, s, 9, 12, "#4a2008");

  // Canopy layers (bottom to top, light to dark for depth)
  rect(ctx, x, y, s, 4, 9, 8, 2, greens[2]);
  rect(ctx, x, y, s, 3, 7, 10, 2, greens[1]);
  rect(ctx, x, y, s, 2, 4, 12, 3, greens[2]);
  rect(ctx, x, y, s, 3, 2, 10, 2, greens[1]);
  rect(ctx, x, y, s, 4, 1, 8, 1, greens[0]);

  // Highlight spots (sun)
  px(ctx, x, y, s, 5, 3, greens[4]);
  px(ctx, x, y, s, 6, 2, greens[4]);
  px(ctx, x, y, s, 9, 4, greens[3]);
  px(ctx, x, y, s, 7, 5, greens[4]);

  // Shadow spots (depth)
  px(ctx, x, y, s, 3, 6, greens[0]);
  px(ctx, x, y, s, 11, 7, greens[0]);
  px(ctx, x, y, s, 4, 8, greens[0]);
  px(ctx, x, y, s, 10, 5, greens[0]);
}

// ── Big Tree (2x2 tile, 32x32 — lush RPG style) ──
export function drawBigTree(ctx: Ctx, x: number, y: number, s: number, variant: number = 0) {
  const greens = variant % 3 === 0
    ? ["#1e5510", "#2a6e18", "#388a22", "#48a530", "#5cc040", "#6cd850"]
    : variant % 3 === 1
    ? ["#1a5008", "#267214", "#329020", "#40a82c", "#50c03a", "#60d448"]
    : ["#225a14", "#2e781e", "#3c9528", "#4cb038", "#5ec848", "#70dc58"];

  // Ground shadow (large ellipse)
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath();
  ctx.ellipse(x + 16 * s, y + 30 * s, 12 * s, 3 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Trunk (thicker, bark texture)
  rect(ctx, x, y, s, 13, 22, 6, 10, "#4a2808");
  rect(ctx, x, y, s, 14, 23, 4, 9, "#6a3c14");
  rect(ctx, x, y, s, 15, 24, 2, 7, "#7a4c20");
  // Bark lines
  px(ctx, x, y, s, 13, 25, "#3a1c04");
  px(ctx, x, y, s, 14, 27, "#3a1c04");
  px(ctx, x, y, s, 17, 26, "#3a1c04");
  // Root bumps
  px(ctx, x, y, s, 12, 31, "#5a3010");
  px(ctx, x, y, s, 19, 31, "#5a3010");

  // Canopy — layered circles/ovals for organic shape
  // Bottom layer (darkest, widest)
  for (let row = 18; row <= 21; row++) {
    for (let col = 4; col <= 27; col++) {
      const dx = col - 16, dy = row - 14;
      if (dx * dx / 144 + dy * dy / 64 < 1) {
        px(ctx, x, y, s, col, row, greens[1]);
      }
    }
  }
  // Middle layer
  for (let row = 10; row <= 19; row++) {
    for (let col = 3; col <= 28; col++) {
      const dx = col - 16, dy = row - 13;
      if (dx * dx / 160 + dy * dy / 50 < 1) {
        px(ctx, x, y, s, col, row, greens[2]);
      }
    }
  }
  // Upper layer
  for (let row = 6; row <= 15; row++) {
    for (let col = 5; col <= 27; col++) {
      const dx = col - 16, dy = row - 10;
      if (dx * dx / 120 + dy * dy / 30 < 1) {
        px(ctx, x, y, s, col, row, greens[3]);
      }
    }
  }
  // Top layer (lightest, smallest)
  for (let row = 3; row <= 10; row++) {
    for (let col = 8; col <= 24; col++) {
      const dx = col - 16, dy = row - 6;
      if (dx * dx / 64 + dy * dy / 16 < 1) {
        px(ctx, x, y, s, col, row, greens[2]);
      }
    }
  }
  // Crown
  for (let row = 2; row <= 6; row++) {
    for (let col = 10; col <= 22; col++) {
      const dx = col - 16, dy = row - 4;
      if (dx * dx / 40 + dy * dy / 8 < 1) {
        px(ctx, x, y, s, col, row, greens[1]);
      }
    }
  }

  // Sun highlights (top-left bright spots)
  const highlights: [number, number][] = [
    [10, 5], [11, 4], [12, 3], [13, 5], [9, 7], [11, 8],
    [14, 4], [8, 9], [10, 10], [7, 12],
  ];
  highlights.forEach(([hx, hy]) => {
    px(ctx, x, y, s, hx, hy, greens[4]);
  });
  px(ctx, x, y, s, 11, 3, greens[5]);
  px(ctx, x, y, s, 12, 5, greens[5]);

  // Shadow depth (bottom-right dark)
  const shadows: [number, number][] = [
    [20, 14], [22, 13], [24, 12], [21, 16], [23, 15],
    [19, 18], [25, 11], [18, 19], [22, 17],
  ];
  shadows.forEach(([sx, sy]) => {
    px(ctx, x, y, s, sx, sy, greens[0]);
  });
}

// ── Flower (colorful, 3 petal styles) ──
export function drawFlowerTile(ctx: Ctx, x: number, y: number, s: number, variant: number = 0) {
  const colors = [
    ["#e63946", "#fca5a5", "#ff6b6b"], // red
    ["#e84393", "#f9a8d4", "#ff69b4"], // pink
    ["#f4a523", "#fde047", "#ffcd38"], // yellow
    ["#7c3aed", "#c4b5fd", "#a78bfa"], // purple
    ["#f97316", "#fdba74", "#fb923c"], // orange
  ];
  const [dark, light, mid] = colors[variant % colors.length];

  // Stem
  px(ctx, x, y, s, 8, 10, "#38851e");
  px(ctx, x, y, s, 8, 11, "#38851e");
  px(ctx, x, y, s, 8, 12, "#2a6318");
  // Leaves
  px(ctx, x, y, s, 7, 12, "#4aa530");
  px(ctx, x, y, s, 9, 11, "#4aa530");
  px(ctx, x, y, s, 6, 13, "#38851e");

  // Petals (cross + diagonal for fullness)
  px(ctx, x, y, s, 8, 7, dark);
  px(ctx, x, y, s, 7, 8, dark);
  px(ctx, x, y, s, 9, 8, dark);
  px(ctx, x, y, s, 8, 9, dark);
  px(ctx, x, y, s, 7, 7, mid);
  px(ctx, x, y, s, 9, 7, mid);
  px(ctx, x, y, s, 7, 9, mid);
  px(ctx, x, y, s, 9, 9, mid);
  // Center
  px(ctx, x, y, s, 8, 8, light);
}

// ── Bush (rounder, more lush) ──
export function drawBushTile(ctx: Ctx, x: number, y: number, s: number) {
  const d = "#1e5a10", m = "#2c7818", l = "#3c9528", h = "#4cad38";

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.beginPath();
  ctx.ellipse(x + 8 * s, y + 14 * s, 6 * s, 2 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  rect(ctx, x, y, s, 4, 8, 8, 1, l);
  rect(ctx, x, y, s, 3, 9, 10, 1, m);
  rect(ctx, x, y, s, 3, 10, 10, 3, l);
  rect(ctx, x, y, s, 4, 13, 8, 1, d);

  px(ctx, x, y, s, 6, 9, h);
  px(ctx, x, y, s, 8, 10, h);
  px(ctx, x, y, s, 4, 11, d);
  px(ctx, x, y, s, 11, 10, d);
}

// ── Rock (with highlight and shadow) ──
export function drawRockTile(ctx: Ctx, x: number, y: number, s: number, variant: number = 0) {
  const base = variant % 2 === 0 ? "#7c8594" : "#8c9aa4";
  const dark = "#5c6574";
  const light = "#b8c4ce";

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.beginPath();
  ctx.ellipse(x + 8 * s, y + 14 * s, 5 * s, 1.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  rect(ctx, x, y, s, 5, 9, 6, 1, dark);
  rect(ctx, x, y, s, 4, 10, 8, 3, base);
  rect(ctx, x, y, s, 5, 13, 6, 1, dark);

  px(ctx, x, y, s, 5, 10, light);
  px(ctx, x, y, s, 6, 10, light);
  px(ctx, x, y, s, 10, 12, dark);
  px(ctx, x, y, s, 11, 11, dark);
}

// ── Fence ──
export function drawFenceH(ctx: Ctx, x: number, y: number, s: number) {
  const wood = "#7a3a0e"; const light = "#a05a1e"; const hi = "#c87030";
  rect(ctx, x, y, s, 1, 8, 2, 6, wood);
  rect(ctx, x, y, s, 13, 8, 2, 6, wood);
  rect(ctx, x, y, s, 0, 9, 16, 2, light);
  rect(ctx, x, y, s, 0, 12, 16, 1, wood);
  px(ctx, x, y, s, 2, 9, hi); px(ctx, x, y, s, 14, 9, hi);
}

export function drawFenceV(ctx: Ctx, x: number, y: number, s: number) {
  const wood = "#7a3a0e"; const light = "#a05a1e";
  rect(ctx, x, y, s, 7, 0, 2, 16, wood);
  rect(ctx, x, y, s, 6, 0, 1, 16, light);
  rect(ctx, x, y, s, 10, 0, 1, 16, wood);
}

// ── House (multi-tile, external view - kept for reference) ──
export function drawHouse(
  ctx: Ctx, x: number, y: number, s: number,
  roofColor: string, wallColor: string, ts: number
) {
  const roofDark = shadeColor(roofColor, -30);
  const roofLight = shadeColor(roofColor, 30);
  const wallDark = shadeColor(wallColor, -20);
  const w = ts * 5;
  const h = ts * 4;

  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(x + 3, y + 3, w, h);

  ctx.fillStyle = wallColor;
  ctx.fillRect(x, y + ts, w, h - ts);
  ctx.strokeStyle = wallDark; ctx.lineWidth = s;
  ctx.strokeRect(x + s / 2, y + ts + s / 2, w - s, h - ts - s);

  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.moveTo(x - ts * 0.3, y + ts);
  ctx.lineTo(x + w / 2, y - ts * 0.2);
  ctx.lineTo(x + w + ts * 0.3, y + ts);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = roofDark; ctx.lineWidth = s;
  ctx.beginPath();
  ctx.moveTo(x - ts * 0.3, y + ts);
  ctx.lineTo(x + w / 2, y - ts * 0.2);
  ctx.lineTo(x + w + ts * 0.3, y + ts);
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = roofLight; ctx.lineWidth = s;
  ctx.beginPath();
  ctx.moveTo(x + ts * 0.3, y + ts - 2 * s);
  ctx.lineTo(x + w / 2, y + 2 * s);
  ctx.lineTo(x + w - ts * 0.3, y + ts - 2 * s);
  ctx.stroke();

  const doorX = x + w / 2 - 5 * s;
  const doorY = y + h - 14 * s;
  ctx.fillStyle = "#5a2a10";
  ctx.fillRect(doorX, doorY, 10 * s, 14 * s);
  ctx.strokeStyle = "#3a1808"; ctx.lineWidth = s;
  ctx.strokeRect(doorX, doorY, 10 * s, 14 * s);
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath(); ctx.arc(doorX + 8 * s, doorY + 8 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();

  const winW = 8 * s, winH = 8 * s;
  const winY = y + ts + 6 * s;
  [x + 6 * s, x + w - 14 * s].forEach((wx) => {
    ctx.fillStyle = "#bae6fd";
    ctx.fillRect(wx, winY, winW, winH);
    ctx.strokeStyle = wallDark; ctx.lineWidth = s;
    ctx.beginPath(); ctx.moveTo(wx + winW / 2, winY); ctx.lineTo(wx + winW / 2, winY + winH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx, winY + winH / 2); ctx.lineTo(wx + winW, winY + winH / 2); ctx.stroke();
    ctx.strokeStyle = roofDark; ctx.lineWidth = s;
    ctx.strokeRect(wx, winY, winW, winH);
  });
}

// ── Color shade helper ──
function shadeColor(hex: string, amt: number): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// ── Furniture drawing ──
import type { Furniture, Building } from "./village";

export function drawFurniture(ctx: Ctx, f: Furniture, bx: number, by: number) {
  const x = bx + f.x;
  const y = by + f.y;

  switch (f.type) {
    case "bed":
      ctx.fillStyle = "#7a5014";
      ctx.fillRect(x, y, f.w, f.h);
      ctx.fillStyle = "#e8ddd0";
      ctx.fillRect(x + 2, y + 2, f.w - 4, f.h - 4);
      ctx.fillStyle = "#f5f0ea";
      ctx.fillRect(x + 3, y + 3, 12, 8);
      ctx.fillStyle = "#6a90b8";
      ctx.fillRect(x + 3, y + 13, f.w - 6, f.h - 16);
      break;

    case "desk":
      ctx.fillStyle = "#906840";
      ctx.fillRect(x, y, f.w, f.h);
      ctx.fillStyle = "#a88058";
      ctx.fillRect(x + 2, y + 2, f.w - 4, f.h - 4);
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(x + f.w / 2 - 6, y + 3, 12, 9);
      ctx.fillStyle = "#4ac8ff";
      ctx.fillRect(x + f.w / 2 - 5, y + 4, 10, 7);
      break;

    case "table":
      ctx.fillStyle = "#906840";
      ctx.fillRect(x, y, f.w, f.h);
      ctx.fillStyle = "#b89068";
      ctx.fillRect(x + 3, y + 3, f.w - 6, f.h - 6);
      break;

    case "chair":
      ctx.fillStyle = "#7a5014";
      ctx.fillRect(x, y, f.w, f.h);
      ctx.fillStyle = "#906830";
      ctx.fillRect(x + 2, y + 2, f.w - 4, f.h - 4);
      break;

    case "bookshelf":
      ctx.fillStyle = "#5a3218";
      ctx.fillRect(x, y, f.w, f.h);
      ctx.fillStyle = "#7a5230";
      ctx.fillRect(x + 1, y + 1, f.w - 2, f.h - 2);
      const bookColors = ["#d44040", "#4088d4", "#38a848", "#d4a020", "#8050c0", "#d07030"];
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < Math.floor(f.w / 6); col++) {
          ctx.fillStyle = bookColors[(row * 5 + col) % bookColors.length];
          ctx.fillRect(x + 3 + col * 6, y + 3 + row * 9, 5, 7);
        }
      }
      break;

    case "stove":
      ctx.fillStyle = "#484848";
      ctx.fillRect(x, y, f.w, f.h);
      ctx.fillStyle = "#686868";
      ctx.fillRect(x + 2, y + 2, f.w - 4, f.h - 4);
      ctx.fillStyle = "#303030";
      ctx.beginPath(); ctx.arc(x + f.w / 3, y + f.h / 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + (f.w * 2) / 3, y + f.h / 2, 4, 0, Math.PI * 2); ctx.fill();
      break;

    case "sofa":
      ctx.fillStyle = "#7a4830";
      ctx.fillRect(x, y, f.w, f.h);
      ctx.fillStyle = "#b48060";
      ctx.fillRect(x + 3, y + 4, f.w - 6, f.h - 6);
      ctx.fillStyle = "#c49070";
      ctx.fillRect(x + 5, y + 5, (f.w - 14) / 2, f.h - 8);
      ctx.fillRect(x + f.w / 2 + 2, y + 5, (f.w - 14) / 2, f.h - 8);
      break;

    case "plant":
      ctx.fillStyle = "#b0582c";
      ctx.fillRect(x + 2, y + 8, f.w - 4, f.h - 8);
      ctx.fillStyle = "#2c7818";
      ctx.beginPath(); ctx.arc(x + f.w / 2, y + 5, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3c9528";
      ctx.beginPath(); ctx.arc(x + f.w / 2 - 3, y + 3, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + f.w / 2 + 3, y + 3, 4, 0, Math.PI * 2); ctx.fill();
      break;

    case "counter":
      ctx.fillStyle = "#7a5014";
      ctx.fillRect(x, y, f.w, f.h);
      ctx.fillStyle = "#c8b490";
      ctx.fillRect(x + 1, y + 1, f.w - 2, 4);
      break;

    case "fountain":
      ctx.fillStyle = "#90989e";
      ctx.beginPath(); ctx.arc(x + f.w / 2, y + f.h / 2, f.w / 2 - 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4a9ed6";
      ctx.beginPath(); ctx.arc(x + f.w / 2, y + f.h / 2, f.w / 2 - 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c0c8d0";
      ctx.fillRect(x + f.w / 2 - 3, y + f.h / 2 - 8, 6, 12);
      break;

    case "bench":
      ctx.fillStyle = "#7a5014";
      ctx.fillRect(x, y, f.w, f.h);
      ctx.fillStyle = "#906840";
      ctx.fillRect(x + 2, y + 2, f.w - 4, f.h - 6);
      ctx.fillStyle = "#5a3218";
      ctx.fillRect(x + 3, y + f.h - 3, 4, 3);
      ctx.fillRect(x + f.w - 7, y + f.h - 3, 4, 3);
      break;

    case "tree_indoor":
      ctx.fillStyle = "#5a3010";
      ctx.fillRect(x + f.w / 2 - 3, y + f.h / 2, 6, f.h / 2);
      ctx.fillStyle = "#2a6318";
      ctx.beginPath(); ctx.arc(x + f.w / 2, y + f.h / 3, f.w / 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#38851e";
      ctx.beginPath(); ctx.arc(x + f.w / 2 - 4, y + f.h / 3 - 3, f.w / 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + f.w / 2 + 4, y + f.h / 3 - 3, f.w / 4, 0, Math.PI * 2); ctx.fill();
      break;
  }
}

// ── Building interior rendering ──
export function drawBuildingInterior(ctx: Ctx, b: Building, isDark: boolean) {
  const wall = isDark ? "#2a2040" : b.wallColor;
  const floor = isDark ? "#1a1530" : b.floorColor;
  const roofC = isDark ? "#3a2060" : b.roofColor;
  const wallDark = shadeColor(wall, -30);
  const wallMid = shadeColor(wall, -15);
  const wallLight = shadeColor(wall, 20);

  // ── Constants ──
  const WALL_H = 28;       // 뒷벽 높이 (3D 느낌)
  const SIDE_W = 10;       // 옆벽 두께
  const BOTTOM_H = 8;      // 앞벽(하단) 두께
  const doorGap = 34;

  // ── Drop shadow (건물 전체) ──
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(b.x + 6, b.y + 6, b.width, b.height + WALL_H);

  // ── 뒷벽 (Back wall — 3D 높이) ──
  // 벽 면 (메인)
  const backY = b.y - WALL_H;
  ctx.fillStyle = wallMid;
  ctx.fillRect(b.x, backY, b.width, WALL_H);
  // 벽 상단 하이라이트
  ctx.fillStyle = wallLight;
  ctx.fillRect(b.x, backY, b.width, 3);
  // 벽 하단 그림자 (바닥 경계)
  ctx.fillStyle = wallDark;
  ctx.fillRect(b.x, b.y - 2, b.width, 2);
  // 벽돌/판넬 패턴
  ctx.strokeStyle = shadeColor(wall, -8);
  ctx.lineWidth = 0.5;
  for (let wy = backY + 8; wy < b.y; wy += 10) {
    ctx.beginPath(); ctx.moveTo(b.x + 2, wy); ctx.lineTo(b.x + b.width - 2, wy); ctx.stroke();
  }
  // 세로 패턴 (offset)
  for (let wx = b.x + 20; wx < b.x + b.width; wx += 25) {
    ctx.beginPath(); ctx.moveTo(wx, backY + 3); ctx.lineTo(wx, b.y - 2); ctx.stroke();
  }

  // ── 뒷벽 창문들 ──
  if (!isDark) {
    const winCount = Math.max(1, Math.floor(b.width / 60));
    const winW = 18, winH = 14;
    const winSpacing = b.width / (winCount + 1);
    for (let i = 1; i <= winCount; i++) {
      const wx = b.x + winSpacing * i - winW / 2;
      const wy = backY + 6;
      // Window frame
      ctx.fillStyle = wallDark;
      ctx.fillRect(wx - 1, wy - 1, winW + 2, winH + 2);
      // Glass
      ctx.fillStyle = "#88c8ee";
      ctx.fillRect(wx, wy, winW, winH);
      // Cross frame
      ctx.fillStyle = wallDark;
      ctx.fillRect(wx + winW / 2 - 0.5, wy, 1, winH);
      ctx.fillRect(wx, wy + winH / 2 - 0.5, winW, 1);
      // Glass highlight
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(wx + 1, wy + 1, winW / 2 - 2, winH / 2 - 2);
    }
  }

  // ── 바닥 (Floor) ──
  ctx.fillStyle = floor;
  ctx.fillRect(b.x, b.y, b.width, b.height);

  // 바닥 타일 패턴 (체커보드 느낌)
  const floorDark = shadeColor(floor, -10);
  const floorLight = shadeColor(floor, 8);
  const tileS = 16;
  for (let fy = b.y; fy < b.y + b.height; fy += tileS) {
    for (let fx = b.x; fx < b.x + b.width; fx += tileS) {
      const checker = (Math.floor((fx - b.x) / tileS) + Math.floor((fy - b.y) / tileS)) % 2;
      ctx.fillStyle = checker ? floorDark : floorLight;
      ctx.fillRect(fx, fy, tileS, tileS);
    }
  }
  // 바닥 그리드 선
  ctx.strokeStyle = shadeColor(floor, -18);
  ctx.lineWidth = 0.3;
  for (let fy = b.y; fy < b.y + b.height; fy += tileS) {
    ctx.beginPath(); ctx.moveTo(b.x, fy); ctx.lineTo(b.x + b.width, fy); ctx.stroke();
  }
  for (let fx = b.x; fx < b.x + b.width; fx += tileS) {
    ctx.beginPath(); ctx.moveTo(fx, b.y); ctx.lineTo(fx, b.y + b.height); ctx.stroke();
  }

  // ── 왼쪽 벽 (Left wall — 입체 사다리꼴) ──
  ctx.fillStyle = wallMid;
  ctx.beginPath();
  ctx.moveTo(b.x, backY);           // 뒷벽 왼쪽 상단
  ctx.lineTo(b.x, b.y + b.height);  // 바닥 왼쪽
  ctx.lineTo(b.x + SIDE_W, b.y + b.height); // 바닥 안쪽
  ctx.lineTo(b.x + SIDE_W, b.y);     // 바닥 경계 안쪽
  ctx.lineTo(b.x, backY);
  ctx.closePath();
  ctx.fill();
  // 왼벽 그림자 그라디언트
  const lgr = ctx.createLinearGradient(b.x, b.y, b.x + SIDE_W, b.y);
  lgr.addColorStop(0, wallDark);
  lgr.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = lgr;
  ctx.fillRect(b.x, b.y, SIDE_W, b.height);
  // 왼벽 내부 면 (밝은 쪽)
  ctx.fillStyle = shadeColor(wall, -5);
  ctx.fillRect(b.x, backY, SIDE_W, WALL_H);
  // 왼벽 가장자리 라인
  ctx.strokeStyle = wallDark;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(b.x + SIDE_W, b.y); ctx.lineTo(b.x + SIDE_W, b.y + b.height); ctx.stroke();

  // ── 오른쪽 벽 (Right wall — 입체) ──
  ctx.fillStyle = wallMid;
  ctx.beginPath();
  ctx.moveTo(b.x + b.width, backY);
  ctx.lineTo(b.x + b.width, b.y + b.height);
  ctx.lineTo(b.x + b.width - SIDE_W, b.y + b.height);
  ctx.lineTo(b.x + b.width - SIDE_W, b.y);
  ctx.lineTo(b.x + b.width, backY);
  ctx.closePath();
  ctx.fill();
  // 오른벽 어두운 면
  ctx.fillStyle = shadeColor(wall, -20);
  ctx.fillRect(b.x + b.width - SIDE_W, backY, SIDE_W, WALL_H);
  // 오른벽 바닥 그라디언트
  const rgr = ctx.createLinearGradient(b.x + b.width - SIDE_W, b.y, b.x + b.width, b.y);
  rgr.addColorStop(0, "rgba(0,0,0,0)");
  rgr.addColorStop(1, wallDark);
  ctx.fillStyle = rgr;
  ctx.fillRect(b.x + b.width - SIDE_W, b.y, SIDE_W, b.height);
  // 오른벽 가장자리 라인
  ctx.strokeStyle = wallDark;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(b.x + b.width - SIDE_W, b.y); ctx.lineTo(b.x + b.width - SIDE_W, b.y + b.height); ctx.stroke();

  // ── 앞벽 (Bottom wall — 문 포함) ──
  const doorX = b.x + b.width / 2 - doorGap / 2;
  // 앞벽 왼쪽
  ctx.fillStyle = wall;
  ctx.fillRect(b.x, b.y + b.height, doorX - b.x, BOTTOM_H);
  // 앞벽 오른쪽
  ctx.fillRect(doorX + doorGap, b.y + b.height, b.x + b.width - doorX - doorGap, BOTTOM_H);
  // 앞벽 상단 엣지 (밝은)
  ctx.fillStyle = wallLight;
  ctx.fillRect(b.x, b.y + b.height, doorX - b.x, 1.5);
  ctx.fillRect(doorX + doorGap, b.y + b.height, b.x + b.width - doorX - doorGap, 1.5);
  // 앞벽 하단 그림자
  ctx.fillStyle = wallDark;
  ctx.fillRect(b.x, b.y + b.height + BOTTOM_H - 1, b.width, 1);

  // ── 문 (Door opening) ──
  // 문 바닥
  ctx.fillStyle = shadeColor(floor, 20);
  ctx.fillRect(doorX, b.y + b.height, doorGap, BOTTOM_H);
  // 문턱
  ctx.fillStyle = "#8b6914";
  ctx.fillRect(doorX + 3, b.y + b.height + BOTTOM_H - 3, doorGap - 6, 3);
  // 문 옆 기둥 그림자
  ctx.fillStyle = wallDark;
  ctx.fillRect(doorX - 1, b.y + b.height, 2, BOTTOM_H);
  ctx.fillRect(doorX + doorGap - 1, b.y + b.height, 2, BOTTOM_H);

  // ── 벽-바닥 경계 그림자 (뒷벽 + 좌우벽 아래) ──
  const shadowGr = ctx.createLinearGradient(b.x, b.y, b.x, b.y + 8);
  shadowGr.addColorStop(0, "rgba(0,0,0,0.15)");
  shadowGr.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shadowGr;
  ctx.fillRect(b.x + SIDE_W, b.y, b.width - SIDE_W * 2, 8);

  // 좌벽 바닥 그림자
  const lShadow = ctx.createLinearGradient(b.x + SIDE_W, b.y, b.x + SIDE_W + 6, b.y);
  lShadow.addColorStop(0, "rgba(0,0,0,0.1)");
  lShadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = lShadow;
  ctx.fillRect(b.x + SIDE_W, b.y, 6, b.height);

  // ── 가구 (Furniture) ──
  if (!isDark) {
    b.furniture.forEach(f => drawFurniture(ctx, f, b.x, b.y));
  }

  // ── 외곽 라인 ──
  ctx.strokeStyle = wallDark;
  ctx.lineWidth = 2;
  // 뒷벽 외곽
  ctx.strokeRect(b.x, backY, b.width, WALL_H);
  // 전체 바닥 + 앞벽
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x, b.y + b.height + BOTTOM_H);
  ctx.lineTo(b.x + b.width, b.y + b.height + BOTTOM_H);
  ctx.lineTo(b.x + b.width, b.y);
  ctx.stroke();

  // ── 지붕 장식 (Roof ornament) ──
  ctx.fillStyle = roofC;
  ctx.beginPath();
  ctx.moveTo(b.x - 4, backY);
  ctx.lineTo(b.x + b.width / 2, backY - 18);
  ctx.lineTo(b.x + b.width + 4, backY);
  ctx.closePath();
  ctx.fill();
  // 지붕 하이라이트
  ctx.fillStyle = shadeColor(roofC, 25);
  ctx.beginPath();
  ctx.moveTo(b.x + 6, backY);
  ctx.lineTo(b.x + b.width / 2, backY - 12);
  ctx.lineTo(b.x + b.width / 2, backY);
  ctx.closePath();
  ctx.fill();
  // 지붕 외곽
  ctx.strokeStyle = shadeColor(roofC, -35);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(b.x - 4, backY);
  ctx.lineTo(b.x + b.width / 2, backY - 18);
  ctx.lineTo(b.x + b.width + 4, backY);
  ctx.closePath();
  ctx.stroke();

  // ── 건물 이름 ──
  ctx.font = "bold 11px sans-serif";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 5;
  ctx.fillText(b.name, b.x + b.width / 2, backY - 20);
  ctx.shadowBlur = 0;
}
