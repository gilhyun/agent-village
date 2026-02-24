// Pixel art tile drawing functions — 16x16 tiles drawn with fillRect
// Each function draws at (x, y) with given pixel scale

type Ctx = CanvasRenderingContext2D;

// ── Helper ──
function px(ctx: Ctx, x: number, y: number, s: number, px_x: number, px_y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x + px_x * s, y + px_y * s, s, s);
}

function rect(ctx: Ctx, x: number, y: number, s: number, px_x: number, px_y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x + px_x * s, y + px_y * s, w * s, h * s);
}

// ── Grass Tile ──
const GRASS_BASE = "#4a8c3f";
const GRASS_DARK = "#3d7a34";
const GRASS_LIGHT = "#5a9c4f";
const GRASS_HIGHLIGHT = "#6aac5f";

// Precomputed grass variants (seeded by position)
export function drawGrassTile(ctx: Ctx, x: number, y: number, s: number, variant: number = 0) {
  // Base fill
  rect(ctx, x, y, s, 0, 0, 16, 16, GRASS_BASE);

  // Subtle variation patches based on variant
  const v = variant % 8;
  if (v === 0 || v === 3) {
    px(ctx, x, y, s, 3, 4, GRASS_DARK);
    px(ctx, x, y, s, 4, 4, GRASS_DARK);
    px(ctx, x, y, s, 10, 12, GRASS_DARK);
    px(ctx, x, y, s, 7, 8, GRASS_LIGHT);
  }
  if (v === 1 || v === 5) {
    px(ctx, x, y, s, 12, 3, GRASS_LIGHT);
    px(ctx, x, y, s, 2, 11, GRASS_LIGHT);
    px(ctx, x, y, s, 8, 6, GRASS_DARK);
    px(ctx, x, y, s, 14, 9, GRASS_DARK);
  }
  if (v === 2 || v === 6) {
    px(ctx, x, y, s, 5, 2, GRASS_HIGHLIGHT);
    px(ctx, x, y, s, 11, 10, GRASS_DARK);
    px(ctx, x, y, s, 1, 7, GRASS_LIGHT);
  }
  if (v === 4 || v === 7) {
    px(ctx, x, y, s, 9, 1, GRASS_DARK);
    px(ctx, x, y, s, 3, 13, GRASS_LIGHT);
    px(ctx, x, y, s, 13, 5, GRASS_HIGHLIGHT);
  }
  // Tiny flower dots on some variants
  if (v === 2) {
    px(ctx, x, y, s, 6, 3, "#f9e54a"); // yellow
    px(ctx, x, y, s, 13, 11, "#f9e54a");
  }
  if (v === 6) {
    px(ctx, x, y, s, 4, 10, "#e87ea1"); // pink
  }
}

// ── Dirt Path Tile ──
const DIRT_BASE = "#c4a265";
const DIRT_DARK = "#a8894f";
const DIRT_LIGHT = "#d4b87a";
const DIRT_EDGE = "#9a7d45";

export function drawDirtPathTile(ctx: Ctx, x: number, y: number, s: number, variant: number = 0) {
  rect(ctx, x, y, s, 0, 0, 16, 16, DIRT_BASE);
  // Texture
  const v = variant % 4;
  if (v === 0) {
    px(ctx, x, y, s, 3, 5, DIRT_DARK); px(ctx, x, y, s, 10, 2, DIRT_LIGHT);
    px(ctx, x, y, s, 7, 11, DIRT_DARK); px(ctx, x, y, s, 13, 8, DIRT_LIGHT);
  } else if (v === 1) {
    px(ctx, x, y, s, 5, 3, DIRT_LIGHT); px(ctx, x, y, s, 12, 10, DIRT_DARK);
    px(ctx, x, y, s, 2, 9, DIRT_DARK); px(ctx, x, y, s, 8, 14, DIRT_LIGHT);
  } else if (v === 2) {
    px(ctx, x, y, s, 1, 1, DIRT_DARK); px(ctx, x, y, s, 14, 14, DIRT_DARK);
    px(ctx, x, y, s, 6, 7, DIRT_LIGHT);
  } else {
    px(ctx, x, y, s, 9, 4, DIRT_LIGHT); px(ctx, x, y, s, 4, 12, DIRT_DARK);
    px(ctx, x, y, s, 11, 7, DIRT_DARK);
  }
  // Small pebbles
  if (v === 0 || v === 3) {
    px(ctx, x, y, s, 6, 9, DIRT_EDGE);
    px(ctx, x, y, s, 11, 4, DIRT_EDGE);
  }
}

// ── Dirt Path Edge (grass-to-dirt transition) ──
export function drawDirtEdgeTile(ctx: Ctx, x: number, y: number, s: number, side: "top" | "bottom" | "left" | "right") {
  // Draw grass base then dirt overlay
  rect(ctx, x, y, s, 0, 0, 16, 16, GRASS_BASE);
  if (side === "top") {
    rect(ctx, x, y, s, 0, 4, 16, 12, DIRT_BASE);
    for (let i = 0; i < 16; i += 3) px(ctx, x, y, s, i, 3, DIRT_BASE);
  } else if (side === "bottom") {
    rect(ctx, x, y, s, 0, 0, 16, 12, DIRT_BASE);
    for (let i = 1; i < 16; i += 3) px(ctx, x, y, s, i, 12, DIRT_BASE);
  } else if (side === "left") {
    rect(ctx, x, y, s, 4, 0, 12, 16, DIRT_BASE);
    for (let i = 0; i < 16; i += 3) px(ctx, x, y, s, 3, i, DIRT_BASE);
  } else {
    rect(ctx, x, y, s, 0, 0, 12, 16, DIRT_BASE);
    for (let i = 1; i < 16; i += 3) px(ctx, x, y, s, 12, i, DIRT_BASE);
  }
}

// ── Water Tile ──
const WATER_BASE = "#3b82c4";
const WATER_DARK = "#2d6ea8";
const WATER_LIGHT = "#5ba4e0";
const WATER_SHINE = "#8ec8f6";

export function drawWaterTile(ctx: Ctx, x: number, y: number, s: number, tick: number = 0) {
  rect(ctx, x, y, s, 0, 0, 16, 16, WATER_BASE);
  // Animated wave lines
  const phase = Math.floor(tick / 20) % 4;
  for (let row = 2; row < 16; row += 4) {
    const offset = (phase + row) % 4;
    for (let col = offset; col < 16; col += 5) {
      px(ctx, x, y, s, col, row, WATER_LIGHT);
      if (col + 1 < 16) px(ctx, x, y, s, col + 1, row, WATER_SHINE);
    }
  }
  // Dark depth spots
  px(ctx, x, y, s, 4, 7, WATER_DARK);
  px(ctx, x, y, s, 11, 3, WATER_DARK);
  px(ctx, x, y, s, 8, 13, WATER_DARK);
}

// ── Stone/Cobblestone Tile ──
const STONE_BASE = "#9ca3af";
const STONE_DARK = "#6b7280";
const STONE_LIGHT = "#d1d5db";
const STONE_LINE = "#4b5563";

export function drawStoneTile(ctx: Ctx, x: number, y: number, s: number, variant: number = 0) {
  rect(ctx, x, y, s, 0, 0, 16, 16, STONE_BASE);
  // Brick pattern
  // Row 1
  rect(ctx, x, y, s, 0, 0, 7, 7, STONE_LIGHT);
  rect(ctx, x, y, s, 8, 0, 8, 7, STONE_BASE);
  // Row 2
  rect(ctx, x, y, s, 0, 8, 4, 8, STONE_BASE);
  rect(ctx, x, y, s, 5, 8, 7, 8, STONE_LIGHT);
  rect(ctx, x, y, s, 13, 8, 3, 8, STONE_BASE);
  // Grid lines
  for (let i = 0; i < 16; i++) {
    px(ctx, x, y, s, i, 7, STONE_LINE);
    px(ctx, x, y, s, i, 15, STONE_LINE);
  }
  px(ctx, x, y, s, 7, 0, STONE_LINE); px(ctx, x, y, s, 7, 1, STONE_LINE);
  px(ctx, x, y, s, 7, 2, STONE_LINE); px(ctx, x, y, s, 7, 3, STONE_LINE);
  px(ctx, x, y, s, 7, 4, STONE_LINE); px(ctx, x, y, s, 7, 5, STONE_LINE);
  px(ctx, x, y, s, 7, 6, STONE_LINE);
  px(ctx, x, y, s, 4, 8, STONE_LINE); px(ctx, x, y, s, 4, 9, STONE_LINE);
  px(ctx, x, y, s, 4, 10, STONE_LINE); px(ctx, x, y, s, 4, 11, STONE_LINE);
  px(ctx, x, y, s, 4, 12, STONE_LINE); px(ctx, x, y, s, 4, 13, STONE_LINE);
  px(ctx, x, y, s, 4, 14, STONE_LINE);
  px(ctx, x, y, s, 12, 8, STONE_LINE); px(ctx, x, y, s, 12, 9, STONE_LINE);
  px(ctx, x, y, s, 12, 10, STONE_LINE); px(ctx, x, y, s, 12, 11, STONE_LINE);
  px(ctx, x, y, s, 12, 12, STONE_LINE); px(ctx, x, y, s, 12, 13, STONE_LINE);
  px(ctx, x, y, s, 12, 14, STONE_LINE);

  if (variant % 3 === 0) px(ctx, x, y, s, 3, 3, STONE_DARK);
  if (variant % 3 === 1) px(ctx, x, y, s, 10, 11, STONE_DARK);
}

// ── Tree ──
export function drawTreeTile(ctx: Ctx, x: number, y: number, s: number, variant: number = 0) {
  const greens = variant % 2 === 0
    ? ["#2d6a1e", "#3a8a2a", "#4ca338", "#60b84a"]
    : ["#1e5a14", "#2d7a20", "#3d932e", "#50a83c"];

  // Trunk
  rect(ctx, x, y, s, 6, 11, 4, 5, "#6b3a1f");
  rect(ctx, x, y, s, 7, 12, 2, 4, "#8b5a2f");

  // Canopy (round-ish)
  //       ##########
  //     ##############
  //     ##############
  //     ##############
  //       ##########
  rect(ctx, x, y, s, 3, 1, 10, 1, greens[1]);  // top
  rect(ctx, x, y, s, 2, 2, 12, 1, greens[0]);
  rect(ctx, x, y, s, 2, 3, 12, 3, greens[1]);
  rect(ctx, x, y, s, 2, 6, 12, 2, greens[2]);
  rect(ctx, x, y, s, 3, 8, 10, 2, greens[1]);
  rect(ctx, x, y, s, 4, 10, 8, 1, greens[2]);

  // Highlights
  px(ctx, x, y, s, 5, 3, greens[3]);
  px(ctx, x, y, s, 6, 4, greens[3]);
  px(ctx, x, y, s, 9, 3, greens[3]);
  px(ctx, x, y, s, 4, 6, greens[0]);
  px(ctx, x, y, s, 10, 7, greens[0]);

  // Shadow on trunk
  px(ctx, x, y, s, 6, 12, "#5a2a0f");
  px(ctx, x, y, s, 6, 13, "#5a2a0f");
}

// ── Flower ──
export function drawFlowerTile(ctx: Ctx, x: number, y: number, s: number, variant: number = 0) {
  const colors = [
    ["#ef4444", "#fca5a5"], // red
    ["#ec4899", "#f9a8d4"], // pink
    ["#eab308", "#fde047"], // yellow
    ["#8b5cf6", "#c4b5fd"], // purple
    ["#f97316", "#fdba74"], // orange
  ];
  const [dark, light] = colors[variant % colors.length];

  // Stem
  px(ctx, x, y, s, 8, 10, "#3a8a2a");
  px(ctx, x, y, s, 8, 11, "#3a8a2a");
  px(ctx, x, y, s, 8, 12, "#3a8a2a");
  px(ctx, x, y, s, 7, 13, "#4ca338"); // leaf
  px(ctx, x, y, s, 9, 12, "#4ca338"); // leaf

  // Petals
  px(ctx, x, y, s, 8, 7, dark); // top
  px(ctx, x, y, s, 7, 8, dark); // left
  px(ctx, x, y, s, 9, 8, dark); // right
  px(ctx, x, y, s, 8, 9, dark); // bottom
  px(ctx, x, y, s, 8, 8, light); // center

  px(ctx, x, y, s, 7, 7, light); // top-left
  px(ctx, x, y, s, 9, 7, light); // top-right
}

// ── Bush ──
export function drawBushTile(ctx: Ctx, x: number, y: number, s: number) {
  const d = "#2d6a1e", m = "#3a8a2a", l = "#4ca338";
  //     ########
  //   ############
  //   ############
  //     ########
  rect(ctx, x, y, s, 4, 8, 8, 1, m);
  rect(ctx, x, y, s, 3, 9, 10, 1, d);
  rect(ctx, x, y, s, 3, 10, 10, 3, m);
  rect(ctx, x, y, s, 4, 13, 8, 1, d);

  px(ctx, x, y, s, 6, 10, l);
  px(ctx, x, y, s, 8, 11, l);
  px(ctx, x, y, s, 5, 12, d);
  px(ctx, x, y, s, 10, 10, d);
}

// ── Rock ──
export function drawRockTile(ctx: Ctx, x: number, y: number, s: number, variant: number = 0) {
  const base = variant % 2 === 0 ? "#7c8594" : "#8c9aa4";
  const dark = "#5c6574";
  const light = "#b0bac4";

  // Rock shape
  rect(ctx, x, y, s, 5, 10, 6, 1, dark);
  rect(ctx, x, y, s, 4, 11, 8, 3, base);
  rect(ctx, x, y, s, 5, 14, 6, 1, dark);

  // Highlights
  px(ctx, x, y, s, 6, 11, light);
  px(ctx, x, y, s, 7, 11, light);
  // Shadows
  px(ctx, x, y, s, 10, 13, dark);
  px(ctx, x, y, s, 11, 12, dark);
}

// ── Fence ──
export function drawFenceH(ctx: Ctx, x: number, y: number, s: number) {
  const wood = "#92400e";
  const light = "#b45a1e";
  // Posts
  rect(ctx, x, y, s, 1, 8, 2, 6, wood);
  rect(ctx, x, y, s, 13, 8, 2, 6, wood);
  // Rails
  rect(ctx, x, y, s, 0, 9, 16, 2, light);
  rect(ctx, x, y, s, 0, 12, 16, 1, wood);
  // Highlight
  px(ctx, x, y, s, 2, 9, "#c87030");
  px(ctx, x, y, s, 14, 9, "#c87030");
}

export function drawFenceV(ctx: Ctx, x: number, y: number, s: number) {
  const wood = "#92400e";
  const light = "#b45a1e";
  // Post
  rect(ctx, x, y, s, 7, 0, 2, 16, wood);
  // Rails
  rect(ctx, x, y, s, 6, 0, 1, 16, light);
  rect(ctx, x, y, s, 10, 0, 1, 16, wood);
}

// ── House (multi-tile, drawn at top-left corner) ──
// Draws a cute RPG house: 5 tiles wide × 4 tiles tall
export function drawHouse(
  ctx: Ctx, x: number, y: number, s: number,
  roofColor: string, wallColor: string, ts: number
) {
  const roofDark = shadeColor(roofColor, -30);
  const roofLight = shadeColor(roofColor, 30);
  const wallDark = shadeColor(wallColor, -20);
  const wallLight = shadeColor(wallColor, 20);
  const w = ts * 5; // width in pixels
  const h = ts * 4;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(x + 3, y + 3, w, h);

  // Wall
  ctx.fillStyle = wallColor;
  ctx.fillRect(x, y + ts, w, h - ts);
  // Wall texture lines
  ctx.fillStyle = wallDark;
  for (let wy = y + ts + 6 * s; wy < y + h; wy += 6 * s) {
    ctx.fillRect(x, wy, w, s);
  }
  // Wall border
  ctx.strokeStyle = wallDark;
  ctx.lineWidth = s;
  ctx.strokeRect(x + s / 2, y + ts + s / 2, w - s, h - ts - s);

  // Roof
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.moveTo(x - ts * 0.3, y + ts);
  ctx.lineTo(x + w / 2, y - ts * 0.2);
  ctx.lineTo(x + w + ts * 0.3, y + ts);
  ctx.closePath();
  ctx.fill();
  // Roof border
  ctx.strokeStyle = roofDark;
  ctx.lineWidth = s;
  ctx.beginPath();
  ctx.moveTo(x - ts * 0.3, y + ts);
  ctx.lineTo(x + w / 2, y - ts * 0.2);
  ctx.lineTo(x + w + ts * 0.3, y + ts);
  ctx.closePath();
  ctx.stroke();
  // Roof inner stripe
  ctx.strokeStyle = roofLight;
  ctx.lineWidth = s;
  ctx.beginPath();
  ctx.moveTo(x + ts * 0.3, y + ts - 2 * s);
  ctx.lineTo(x + w / 2, y + 2 * s);
  ctx.lineTo(x + w - ts * 0.3, y + ts - 2 * s);
  ctx.stroke();

  // Door
  const doorX = x + w / 2 - 5 * s;
  const doorY = y + h - 14 * s;
  ctx.fillStyle = "#6b3a1f";
  ctx.fillRect(doorX, doorY, 10 * s, 14 * s);
  ctx.strokeStyle = "#4a2810";
  ctx.lineWidth = s;
  ctx.strokeRect(doorX, doorY, 10 * s, 14 * s);
  // Door knob
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(doorX + 8 * s, doorY + 8 * s, 1.5 * s, 0, Math.PI * 2);
  ctx.fill();

  // Windows
  const winW = 8 * s, winH = 8 * s;
  const winY = y + ts + 6 * s;
  [x + 6 * s, x + w - 14 * s].forEach((wx) => {
    ctx.fillStyle = "#bae6fd";
    ctx.fillRect(wx, winY, winW, winH);
    // Cross
    ctx.strokeStyle = wallDark;
    ctx.lineWidth = s;
    ctx.beginPath(); ctx.moveTo(wx + winW / 2, winY); ctx.lineTo(wx + winW / 2, winY + winH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx, winY + winH / 2); ctx.lineTo(wx + winW, winY + winH / 2); ctx.stroke();
    // Border
    ctx.strokeStyle = roofDark;
    ctx.lineWidth = s;
    ctx.strokeRect(wx, winY, winW, winH);
  });
}

// ── Shade helper ──
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
      // Frame
      ctx.fillStyle = "#8b6914";
      ctx.fillRect(x, y, f.w, f.h);
      // Mattress
      ctx.fillStyle = "#e8e0d0";
      ctx.fillRect(x + 2, y + 2, f.w - 4, f.h - 4);
      // Pillow
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(x + 3, y + 3, 12, 8);
      // Blanket
      ctx.fillStyle = "#7c9cbf";
      ctx.fillRect(x + 3, y + 13, f.w - 6, f.h - 16);
      break;

    case "desk":
      ctx.fillStyle = "#a0784c";
      ctx.fillRect(x, y, f.w, f.h);
      ctx.fillStyle = "#b8905c";
      ctx.fillRect(x + 2, y + 2, f.w - 4, f.h - 4);
      // Monitor/book on desk
      ctx.fillStyle = "#333";
      ctx.fillRect(x + f.w / 2 - 6, y + 3, 12, 9);
      ctx.fillStyle = "#4af";
      ctx.fillRect(x + f.w / 2 - 5, y + 4, 10, 7);
      break;

    case "table":
      ctx.fillStyle = "#a0784c";
      ctx.fillRect(x, y, f.w, f.h);
      ctx.fillStyle = "#c0986c";
      ctx.fillRect(x + 3, y + 3, f.w - 6, f.h - 6);
      break;

    case "chair":
      ctx.fillStyle = "#8b6914";
      ctx.fillRect(x, y, f.w, f.h);
      ctx.fillStyle = "#a07830";
      ctx.fillRect(x + 2, y + 2, f.w - 4, f.h - 4);
      break;

    case "bookshelf":
      ctx.fillStyle = "#6b4226";
      ctx.fillRect(x, y, f.w, f.h);
      // Shelves
      ctx.fillStyle = "#8b6240";
      ctx.fillRect(x + 1, y + 1, f.w - 2, f.h - 2);
      // Books (colorful rows)
      const bookColors = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#e67e22"];
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < Math.floor(f.w / 6); col++) {
          ctx.fillStyle = bookColors[(row * 5 + col) % bookColors.length];
          ctx.fillRect(x + 3 + col * 6, y + 3 + row * 9, 5, 7);
        }
      }
      break;

    case "stove":
      ctx.fillStyle = "#555";
      ctx.fillRect(x, y, f.w, f.h);
      ctx.fillStyle = "#777";
      ctx.fillRect(x + 2, y + 2, f.w - 4, f.h - 4);
      // Burners
      ctx.fillStyle = "#333";
      ctx.beginPath(); ctx.arc(x + f.w / 3, y + f.h / 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + (f.w * 2) / 3, y + f.h / 2, 4, 0, Math.PI * 2); ctx.fill();
      break;

    case "sofa":
      ctx.fillStyle = "#8b5a3c";
      ctx.fillRect(x, y, f.w, f.h);
      ctx.fillStyle = "#c49a6c";
      ctx.fillRect(x + 3, y + 4, f.w - 6, f.h - 6);
      // Cushions
      ctx.fillStyle = "#d4aa7c";
      ctx.fillRect(x + 5, y + 5, (f.w - 14) / 2, f.h - 8);
      ctx.fillRect(x + f.w / 2 + 2, y + 5, (f.w - 14) / 2, f.h - 8);
      break;

    case "plant":
      // Pot
      ctx.fillStyle = "#c0643c";
      ctx.fillRect(x + 2, y + 8, f.w - 4, f.h - 8);
      // Leaves
      ctx.fillStyle = "#3a8a2a";
      ctx.beginPath(); ctx.arc(x + f.w / 2, y + 5, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4ca338";
      ctx.beginPath(); ctx.arc(x + f.w / 2 - 3, y + 3, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + f.w / 2 + 3, y + 3, 4, 0, Math.PI * 2); ctx.fill();
      break;

    case "counter":
      ctx.fillStyle = "#8b6914";
      ctx.fillRect(x, y, f.w, f.h);
      ctx.fillStyle = "#d4c4a0";
      ctx.fillRect(x + 1, y + 1, f.w - 2, 4);
      break;

    case "fountain":
      // Basin
      ctx.fillStyle = "#9ca3af";
      ctx.beginPath(); ctx.arc(x + f.w / 2, y + f.h / 2, f.w / 2 - 2, 0, Math.PI * 2); ctx.fill();
      // Water
      ctx.fillStyle = "#60a5fa";
      ctx.beginPath(); ctx.arc(x + f.w / 2, y + f.h / 2, f.w / 2 - 6, 0, Math.PI * 2); ctx.fill();
      // Center pillar
      ctx.fillStyle = "#d1d5db";
      ctx.fillRect(x + f.w / 2 - 3, y + f.h / 2 - 8, 6, 12);
      break;

    case "bench":
      ctx.fillStyle = "#8b6914";
      ctx.fillRect(x, y, f.w, f.h);
      ctx.fillStyle = "#a0784c";
      ctx.fillRect(x + 2, y + 2, f.w - 4, f.h - 6);
      // Legs
      ctx.fillStyle = "#6b4226";
      ctx.fillRect(x + 3, y + f.h - 3, 4, 3);
      ctx.fillRect(x + f.w - 7, y + f.h - 3, 4, 3);
      break;

    case "tree_indoor":
      // Trunk
      ctx.fillStyle = "#6b3a1f";
      ctx.fillRect(x + f.w / 2 - 3, y + f.h / 2, 6, f.h / 2);
      // Canopy
      ctx.fillStyle = "#2d6a1e";
      ctx.beginPath(); ctx.arc(x + f.w / 2, y + f.h / 3, f.w / 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3a8a2a";
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
  const wallDark = shadeColor(wall, -20);

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(b.x + 4, b.y + 4, b.width, b.height);

  // Floor
  ctx.fillStyle = floor;
  ctx.fillRect(b.x, b.y, b.width, b.height);

  // Floor pattern (tile grid)
  ctx.strokeStyle = shadeColor(floor, -15);
  ctx.lineWidth = 0.5;
  for (let fy = b.y; fy < b.y + b.height; fy += 16) {
    ctx.beginPath(); ctx.moveTo(b.x, fy); ctx.lineTo(b.x + b.width, fy); ctx.stroke();
  }
  for (let fx = b.x; fx < b.x + b.width; fx += 16) {
    ctx.beginPath(); ctx.moveTo(fx, b.y); ctx.lineTo(fx, b.y + b.height); ctx.stroke();
  }

  // Walls (top + sides as thick borders)
  ctx.fillStyle = wall;
  ctx.fillRect(b.x, b.y, b.width, 8); // top wall
  ctx.fillRect(b.x, b.y, 6, b.height); // left wall
  ctx.fillRect(b.x + b.width - 6, b.y, 6, b.height); // right wall
  // Bottom wall with door gap
  const doorGap = 30;
  const doorX = b.x + b.width / 2 - doorGap / 2;
  ctx.fillRect(b.x, b.y + b.height - 6, doorX - b.x, 6);
  ctx.fillRect(doorX + doorGap, b.y + b.height - 6, b.x + b.width - doorX - doorGap, 6);

  // Wall border
  ctx.strokeStyle = wallDark;
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x, b.y, b.width, b.height);

  // Door opening indicator
  ctx.fillStyle = shadeColor(floor, 10);
  ctx.fillRect(doorX, b.y + b.height - 6, doorGap, 6);

  // Furniture
  if (!isDark) {
    b.furniture.forEach(f => drawFurniture(ctx, f, b.x, b.y));
  }

  // Roof label (floating above)
  ctx.fillStyle = roofC;
  ctx.beginPath();
  ctx.moveTo(b.x + b.width / 2 - 30, b.y - 2);
  ctx.lineTo(b.x + b.width / 2, b.y - 16);
  ctx.lineTo(b.x + b.width / 2 + 30, b.y - 2);
  ctx.closePath();
  ctx.fill();

  // Name label
  ctx.font = "bold 10px sans-serif";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 3;
  ctx.fillText(b.name, b.x + b.width / 2, b.y - 18);
  ctx.shadowBlur = 0;
}
