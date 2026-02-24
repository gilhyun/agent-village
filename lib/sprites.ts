// Pixel art character sprites - drawn directly on canvas
// Each character has idle and walk frames (2 frames each)
// Sprite format: 2D array where each number = color index

type SpriteFrame = number[][];
type CharacterSprite = {
  idle: SpriteFrame[];
  walk: SpriteFrame[];
};

// Color palettes for each character
export const CHARACTER_PALETTES: Record<string, string[]> = {
  "agent-1": ["transparent", "#4f46e5", "#6366f1", "#818cf8", "#fbbf24", "#f5d0a9", "#1e1b4b", "#312e81"], // 민수 - 파랑 개발자
  "agent-2": ["transparent", "#db2777", "#ec4899", "#f9a8d4", "#fbbf24", "#f5d0a9", "#831843", "#9d174d"], // 지은 - 핑크 아티스트
  "agent-3": ["transparent", "#0d9488", "#14b8a6", "#5eead4", "#fbbf24", "#f5d0a9", "#134e4a", "#115e59"], // 준호 - 청록 탐험가
  "agent-4": ["transparent", "#d97706", "#f59e0b", "#fcd34d", "#fbbf24", "#f5d0a9", "#78350f", "#92400e"], // 하나 - 주황 과학자
  "agent-5": ["transparent", "#dc2626", "#ef4444", "#fca5a5", "#fbbf24", "#f5d0a9", "#7f1d1d", "#991b1b"], // 태현 - 빨강 셰프
};

// 0 = transparent
// 1 = dark main color
// 2 = main color
// 3 = light main color
// 4 = hair/accent (gold)
// 5 = skin
// 6 = darkest
// 7 = dark shade

// Generic humanoid sprite (12x16 pixels)
// Idle frame 1
const IDLE_1: SpriteFrame = [
  [0,0,0,0,4,4,4,4,0,0,0,0],
  [0,0,0,4,4,4,4,4,4,0,0,0],
  [0,0,0,4,4,4,4,4,4,0,0,0],
  [0,0,0,5,5,5,5,5,5,0,0,0],
  [0,0,0,5,6,5,5,6,5,0,0,0],
  [0,0,0,5,5,5,5,5,5,0,0,0],
  [0,0,0,0,5,5,5,5,0,0,0,0],
  [0,0,0,2,2,2,2,2,2,0,0,0],
  [0,0,2,2,2,2,2,2,2,2,0,0],
  [0,5,2,2,2,2,2,2,2,2,5,0],
  [0,5,0,2,2,2,2,2,2,0,5,0],
  [0,0,0,2,2,2,2,2,2,0,0,0],
  [0,0,0,2,2,0,0,2,2,0,0,0],
  [0,0,0,1,1,0,0,1,1,0,0,0],
  [0,0,0,6,6,0,0,6,6,0,0,0],
  [0,0,6,6,6,0,0,6,6,6,0,0],
];

// Idle frame 2 (slight bob)
const IDLE_2: SpriteFrame = [
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,4,4,4,4,0,0,0,0],
  [0,0,0,4,4,4,4,4,4,0,0,0],
  [0,0,0,4,4,4,4,4,4,0,0,0],
  [0,0,0,5,5,5,5,5,5,0,0,0],
  [0,0,0,5,6,5,5,6,5,0,0,0],
  [0,0,0,5,5,5,5,5,5,0,0,0],
  [0,0,0,0,5,5,5,5,0,0,0,0],
  [0,0,0,2,2,2,2,2,2,0,0,0],
  [0,0,2,2,2,2,2,2,2,2,0,0],
  [0,5,2,2,2,2,2,2,2,2,5,0],
  [0,5,0,2,2,2,2,2,2,0,5,0],
  [0,0,0,2,2,0,0,2,2,0,0,0],
  [0,0,0,1,1,0,0,1,1,0,0,0],
  [0,0,0,6,6,0,0,6,6,0,0,0],
  [0,0,6,6,6,0,0,6,6,6,0,0],
];

// Walk frame 1 (left leg forward)
const WALK_1: SpriteFrame = [
  [0,0,0,0,4,4,4,4,0,0,0,0],
  [0,0,0,4,4,4,4,4,4,0,0,0],
  [0,0,0,4,4,4,4,4,4,0,0,0],
  [0,0,0,5,5,5,5,5,5,0,0,0],
  [0,0,0,5,6,5,5,6,5,0,0,0],
  [0,0,0,5,5,5,5,5,5,0,0,0],
  [0,0,0,0,5,5,5,5,0,0,0,0],
  [0,0,0,2,2,2,2,2,2,0,0,0],
  [0,0,2,2,2,2,2,2,2,2,0,0],
  [0,5,2,2,2,2,2,2,2,2,5,0],
  [0,5,0,2,2,2,2,2,2,0,5,0],
  [0,0,0,2,2,2,2,2,2,0,0,0],
  [0,0,1,1,0,0,0,0,1,1,0,0],
  [0,1,1,0,0,0,0,0,0,1,1,0],
  [0,6,6,0,0,0,0,0,0,6,6,0],
  [6,6,6,0,0,0,0,0,0,6,6,6],
];

// Walk frame 2 (right leg forward)
const WALK_2: SpriteFrame = [
  [0,0,0,0,4,4,4,4,0,0,0,0],
  [0,0,0,4,4,4,4,4,4,0,0,0],
  [0,0,0,4,4,4,4,4,4,0,0,0],
  [0,0,0,5,5,5,5,5,5,0,0,0],
  [0,0,0,5,6,5,5,6,5,0,0,0],
  [0,0,0,5,5,5,5,5,5,0,0,0],
  [0,0,0,0,5,5,5,5,0,0,0,0],
  [0,0,0,2,2,2,2,2,2,0,0,0],
  [0,0,2,2,2,2,2,2,2,2,0,0],
  [0,5,2,2,2,2,2,2,2,2,5,0],
  [0,5,0,2,2,2,2,2,2,0,5,0],
  [0,0,0,2,2,2,2,2,2,0,0,0],
  [0,0,0,0,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,0,0,1,0,0,0,0],
  [0,0,0,6,6,0,0,6,6,0,0,0],
  [0,0,6,6,6,0,0,6,6,6,0,0],
];

export const SPRITE_DATA: CharacterSprite = {
  idle: [IDLE_1, IDLE_2],
  walk: [WALK_1, WALK_2],
};

export const PIXEL_SIZE = 3; // Each pixel = 3x3 on canvas
export const SPRITE_WIDTH = 12;
export const SPRITE_HEIGHT = 16;

// Draw a sprite frame on canvas
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  frame: SpriteFrame,
  palette: string[],
  x: number,
  y: number,
  pixelSize: number = PIXEL_SIZE,
  flip: boolean = false,
) {
  const totalWidth = SPRITE_WIDTH * pixelSize;
  const totalHeight = SPRITE_HEIGHT * pixelSize;
  const startX = x - totalWidth / 2;
  const startY = y - totalHeight / 2;

  for (let row = 0; row < frame.length; row++) {
    for (let col = 0; col < frame[row].length; col++) {
      const colorIdx = frame[row][col];
      if (colorIdx === 0) continue; // transparent

      const color = palette[colorIdx];
      if (!color || color === "transparent") continue;

      ctx.fillStyle = color;
      const drawCol = flip ? (SPRITE_WIDTH - 1 - col) : col;
      ctx.fillRect(
        startX + drawCol * pixelSize,
        startY + row * pixelSize,
        pixelSize,
        pixelSize,
      );
    }
  }
}

// Get the right frame based on agent state and time
export function getFrame(state: "walking" | "talking" | "idle", tick: number): SpriteFrame {
  const frameIdx = Math.floor(tick / 15) % 2; // Animate every 15 ticks (~250ms at 60fps)

  if (state === "walking") {
    return SPRITE_DATA.walk[frameIdx];
  }
  return SPRITE_DATA.idle[frameIdx];
}
