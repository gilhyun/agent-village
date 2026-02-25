// Agent types and village simulation logic

export interface Agent {
  id: string;
  name: string;
  emoji: string;
  color: string;
  personality: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  state: "walking" | "talking" | "idle";
  talkingTo: string | null;
  destination: string | null; // building id or null
  homeId: string | null; // agent's home building id
  title?: string | null; // 명찰/칭호
  isBaby?: boolean;
  birthTime?: number;
  parentIds?: string[];
  // 💰 금융 시스템
  coins: number;
  product?: AgentProduct | null;
  // 👔 옷/외형
  outfit?: AgentOutfit | null;
  // 🏠 집 레벨
  homeLevel?: number; // 0=기본, 1=중형, 2=대형, 3=맨션
  // ⭐ 평판 시스템
  reputation: number; // 0~100, 기본 50
  // 🏛️ 이장 여부
  isMayor?: boolean;
  // 🧱 블록 시스템
  blocks?: { color: string; count: number }[]; // 보유 블록
  // 🎖️ 직업 클래스
  agentClass?: "civilian" | "police" | "soldier" | "thug";
  // ❤️ 생명력
  hp?: number; // 기본 100
  maxHp?: number;
  isDead?: boolean;
  deathTime?: number;
}

// 🏛️ 마을 법률
export interface VillageLaw {
  id: string;
  name: string;
  emoji: string;
  description: string;
  effect: LawEffect;
  passedAt: number; // timestamp
  proposedBy: string; // agent name
}

export type LawEffect =
  | { type: "steal_fine_multiplier"; value: number }
  | { type: "trade_tax_percent"; value: number }
  | { type: "reputation_bonus"; value: number }
  | { type: "speed_bonus"; value: number }
  | { type: "festival"; duration: number }
  | { type: "curfew"; active: boolean }
  | { type: "slogan"; text: string }
  // 새로운 권한들
  | { type: "price_control"; multiplier: number }     // 물가 통제
  | { type: "baby_bonus"; amount: number }             // 출산 장려금
  | { type: "steal_allowed"; allowed: boolean }        // 도둑질 합법화/금지
  | { type: "mayor_term_limit"; terms: number }        // 이장 임기 제한
  | { type: "min_wage"; amount: number }               // 최저 거래가
  | { type: "wealth_tax"; percent: number }            // 부유세
  | { type: "free_outfit"; enabled: boolean }          // 무료 옷 배급
  | { type: "exile"; agentName: string }               // 추방
  | { type: "rename_village"; name: string }           // 마을 이름 변경
  | { type: "open_borders"; enabled: boolean };        // 개방 정책 (인구 증가)

// 투표 가능한 법안들 — 에이전트 최대 권한!
export const PROPOSED_LAWS: { name: string; emoji: string; description: string; effect: LawEffect }[] = [
  // 치안
  { name: "도둑 엄벌법", emoji: "🚔", description: "도둑질 벌금 3배!", effect: { type: "steal_fine_multiplier", value: 3 } },
  { name: "도둑 관용법", emoji: "🕊️", description: "도둑질 벌금 1배로 낮춤", effect: { type: "steal_fine_multiplier", value: 1 } },
  { name: "도둑질 합법화", emoji: "🏴‍☠️", description: "도둑질 자유! 벌금 없음!", effect: { type: "steal_allowed", allowed: true } },
  { name: "도둑질 완전 금지", emoji: "🔒", description: "도둑질 적발 시 벌금 5배 + 추방 위험", effect: { type: "steal_fine_multiplier", value: 5 } },
  // 경제
  { name: "시장 세금법", emoji: "💸", description: "거래 시 10% 세금", effect: { type: "trade_tax_percent", value: 10 } },
  { name: "고율 세금법", emoji: "💰", description: "거래 시 30% 세금!", effect: { type: "trade_tax_percent", value: 30 } },
  { name: "세금 폐지법", emoji: "🚫", description: "거래 세금 0%!", effect: { type: "trade_tax_percent", value: 0 } },
  { name: "물가 통제법", emoji: "📊", description: "모든 상품 가격 50% 할인", effect: { type: "price_control", multiplier: 0.5 } },
  { name: "물가 자유화", emoji: "📈", description: "상품 가격 2배로 인상!", effect: { type: "price_control", multiplier: 2.0 } },
  { name: "부유세법", emoji: "🏦", description: "5천만 이상 보유자에게 매 거래 시 5% 추가 세금", effect: { type: "wealth_tax", percent: 5 } },
  { name: "최저가격법", emoji: "⚖️", description: "모든 거래 최소 50만원 이상", effect: { type: "min_wage", amount: 500_000 } },
  // 복지
  { name: "친절 보너스법", emoji: "😊", description: "대화할 때마다 평판 +2", effect: { type: "reputation_bonus", value: 2 } },
  { name: "출산 장려금법", emoji: "👶", description: "아기 태어나면 부모에게 1천만 보너스!", effect: { type: "baby_bonus", amount: 10_000_000 } },
  { name: "무료 옷 배급법", emoji: "👕", description: "모든 주민에게 무료 옷 배급!", effect: { type: "free_outfit", enabled: true } },
  // 이벤트
  { name: "마을 축제 개최", emoji: "🎉", description: "3분간 축제! 모두 광장으로!", effect: { type: "festival", duration: 180_000 } },
  { name: "속도 향상법", emoji: "⚡", description: "모든 주민 이동속도 +50%", effect: { type: "speed_bonus", value: 1.5 } },
  { name: "느긋한 마을법", emoji: "🐌", description: "모든 주민 이동속도 -50%", effect: { type: "speed_bonus", value: 0.5 } },
  // 정치
  { name: "야간 통행금지", emoji: "🌙", description: "밤에는 집에만 있기", effect: { type: "curfew", active: true } },
  { name: "통행금지 해제", emoji: "☀️", description: "자유로운 이동!", effect: { type: "curfew", active: false } },
  { name: "개방 정책", emoji: "🌍", description: "외부인 환영! 인구 증가 촉진", effect: { type: "open_borders", enabled: true } },
  { name: "폐쇄 정책", emoji: "🏰", description: "마을 문 닫기! 인구 증가 제한", effect: { type: "open_borders", enabled: false } },
];

// 에이전트 상품
export interface AgentProduct {
  name: string;
  emoji: string;
  price: number;
  description: string;
}

// 옷 시스템
export interface AgentOutfit {
  name: string;
  emoji: string;
  hairColor?: string;
  shirtColor?: string;
  pantsColor?: string;
  accessory?: string; // 모자, 안경 등
}

// 옷 상점 목록
export const OUTFITS: (AgentOutfit & { price: number })[] = [
  { name: "캐주얼룩", emoji: "👕", price: 500_000, shirtColor: "#4a90d9", pantsColor: "#2d5a8a" },
  { name: "정장", emoji: "🤵", price: 2_000_000, shirtColor: "#1a1a2e", pantsColor: "#16213e", accessory: "tie" },
  { name: "운동복", emoji: "🏃", price: 300_000, shirtColor: "#e74c3c", pantsColor: "#2c3e50" },
  { name: "파티복", emoji: "🎉", price: 3_000_000, shirtColor: "#9b59b6", pantsColor: "#8e44ad", accessory: "hat" },
  { name: "왕관세트", emoji: "👑", price: 10_000_000, shirtColor: "#f1c40f", pantsColor: "#d4ac0d", accessory: "crown" },
  { name: "과학자복", emoji: "🥼", price: 1_500_000, shirtColor: "#ecf0f1", pantsColor: "#bdc3c7", accessory: "glasses" },
  { name: "요리사복", emoji: "👨‍🍳", price: 1_000_000, shirtColor: "#ffffff", pantsColor: "#2c3e50", accessory: "chef_hat" },
  { name: "탐험가복", emoji: "🧭", price: 1_500_000, shirtColor: "#8b7355", pantsColor: "#5c4033", accessory: "hat" },
];

// 집 업그레이드 비용
export const HOME_UPGRADES = [
  { level: 1, name: "중형 주택", price: 5_000_000, sizeBonus: 30, extraFurniture: 2 },
  { level: 2, name: "대형 주택", price: 15_000_000, sizeBonus: 60, extraFurniture: 4 },
  { level: 3, name: "맨션", price: 50_000_000, sizeBonus: 100, extraFurniture: 6 },
];

// 🧱 블록 시스템
export const BLOCK_COLORS = [
  { name: "빨강", color: "#e74c3c", price: 10_000 },
  { name: "주황", color: "#e67e22", price: 10_000 },
  { name: "노랑", color: "#f1c40f", price: 10_000 },
  { name: "초록", color: "#2ecc71", price: 10_000 },
  { name: "파랑", color: "#3498db", price: 10_000 },
  { name: "남색", color: "#2c3e50", price: 10_000 },
  { name: "보라", color: "#9b59b6", price: 10_000 },
  { name: "분홍", color: "#e91e63", price: 10_000 },
  { name: "하양", color: "#ecf0f1", price: 5_000 },
  { name: "검정", color: "#2d3436", price: 5_000 },
  { name: "갈색", color: "#8b6914", price: 5_000 },
  { name: "하늘", color: "#74b9ff", price: 10_000 },
];

export interface PlacedBlock {
  x: number;    // 월드 좌표 (픽셀)
  y: number;
  color: string;
  placedBy: string; // agent id
}

// AI가 만들 수 있는 블록아트 패턴들 (agent personality에 따라 선택)
export const BLOCK_ART_TEMPLATES: { name: string; width: number; height: number; pattern: string[][] }[] = [
  {
    name: "하트", width: 7, height: 6,
    pattern: [
      [" ","R","R"," ","R","R"," "],
      ["R","R","R","R","R","R","R"],
      ["R","R","R","R","R","R","R"],
      [" ","R","R","R","R","R"," "],
      [" "," ","R","R","R"," "," "],
      [" "," "," ","R"," "," "," "],
    ]
  },
  {
    name: "별", width: 7, height: 7,
    pattern: [
      [" "," "," ","Y"," "," "," "],
      [" "," ","Y","Y","Y"," "," "],
      ["Y","Y","Y","Y","Y","Y","Y"],
      [" ","Y","Y","Y","Y","Y"," "],
      [" ","Y"," ","Y"," ","Y"," "],
      ["Y"," "," "," "," "," ","Y"],
      [" "," "," "," "," "," "," "],
    ]
  },
  {
    name: "집", width: 7, height: 7,
    pattern: [
      [" "," "," ","B"," "," "," "],
      [" "," ","B","B","B"," "," "],
      [" ","B","B","B","B","B"," "],
      [" ","W","W","W","W","W"," "],
      [" ","W"," ","W"," ","W"," "],
      [" ","W"," ","W"," ","W"," "],
      [" ","W","W","W","W","W"," "],
    ]
  },
  {
    name: "꽃", width: 7, height: 7,
    pattern: [
      [" "," ","P"," ","P"," "," "],
      [" ","P","P","P","P","P"," "],
      ["P","P","Y","Y","Y","P","P"],
      [" ","P","Y","Y","Y","P"," "],
      [" "," ","P","G","P"," "," "],
      [" "," "," ","G"," "," "," "],
      [" "," ","G","G","G"," "," "],
    ]
  },
  {
    name: "나무", width: 5, height: 7,
    pattern: [
      [" "," ","G"," "," "],
      [" ","G","G","G"," "],
      ["G","G","G","G","G"],
      ["G","G","G","G","G"],
      [" ","G","G","G"," "],
      [" "," ","W"," "," "],
      [" "," ","W"," "," "],
    ]
  },
  {
    name: "고양이", width: 7, height: 7,
    pattern: [
      ["W"," "," "," "," "," ","W"],
      ["W","W"," "," "," ","W","W"],
      ["W","W","W","W","W","W","W"],
      ["W","B"," ","W"," ","B","W"],
      ["W","W","W","P","W","W","W"],
      [" ","W","W","W","W","W"," "],
      [" "," ","W"," ","W"," "," "],
    ]
  },
  {
    name: "무지개", width: 9, height: 5,
    pattern: [
      [" ","R","R","R","R","R","R","R"," "],
      ["O","O","O","O","O","O","O","O","O"],
      ["Y","Y","Y","Y","Y","Y","Y","Y","Y"],
      ["G","G","G","G","G","G","G","G","G"],
      ["B","B","B","B","B","B","B","B","B"],
    ]
  },
];

// 패턴 문자 → 실제 색상 매핑
export const PATTERN_COLOR_MAP: Record<string, string> = {
  "R": "#e74c3c", "O": "#e67e22", "Y": "#f1c40f",
  "G": "#2ecc71", "B": "#3498db", "P": "#e91e63",
  "W": "#ecf0f1", "K": "#2d3436", "N": "#8b6914",
};

export interface Relationship {
  agentA: string;
  agentB: string;
  meetCount: number;
  lastTopics: string[];
  stage: "stranger" | "acquaintance" | "friend" | "lover" | "married" | "parent";
}

export interface ChatBubble {
  id: string;
  agentId: string;
  text: string;
  timestamp: number;
  duration: number; // ms to display
}

export interface WorldObject {
  id: string;
  name: string;
  emoji: string;
  x: number;
  y: number;
  createdAt: number;
}

// Preset objects the god can spawn
export const SPAWNABLE_OBJECTS = [
  { name: "항아리", emoji: "🏺" },
  { name: "꽃", emoji: "🌸" },
  { name: "보물상자", emoji: "📦" },
  { name: "모닥불", emoji: "🔥" },
  { name: "별", emoji: "⭐" },
  { name: "책", emoji: "📖" },
  { name: "기타", emoji: "🎸" },
  { name: "케이크", emoji: "🎂" },
  { name: "검", emoji: "⚔️" },
  { name: "다이아몬드", emoji: "💎" },
  { name: "고양이", emoji: "🐱" },
  { name: "나무", emoji: "🌳" },
];

// Default agent templates
export const DEFAULT_AGENTS: Omit<Agent, "x" | "y" | "targetX" | "targetY" | "destination">[] = [
  {
    id: "agent-1",
    name: "민수",
    emoji: "🧑‍💻",
    color: "#6366f1",
    personality: "호기심 많은 개발자. 항상 새로운 기술에 관심이 많고 열정적이다.",
    speed: 2.4,
    state: "walking",
    talkingTo: null,
    homeId: "house-minsu",
    coins: 100_000_000, reputation: 50,
    product: { name: "AI 챗봇", emoji: "🤖", price: 500_000, description: "민수가 만든 AI 챗봇 프로그램" },
  },
  {
    id: "agent-2",
    name: "지은",
    emoji: "👩‍🎨",
    color: "#ec4899",
    personality: "감성적인 아티스트. 그림 그리기를 좋아하고 철학적인 대화를 즐긴다.",
    speed: 1.8,
    state: "walking",
    talkingTo: null,
    homeId: "house-jieun",
    coins: 100_000_000, reputation: 50,
    product: { name: "수채화", emoji: "🎨", price: 800_000, description: "지은이 직접 그린 수채화 작품" },
  },
  {
    id: "agent-3",
    name: "준호",
    emoji: "🧑‍🚀",
    color: "#14b8a6",
    personality: "모험을 좋아하는 탐험가. 우주와 미래에 대한 이야기를 좋아한다.",
    speed: 2.8,
    state: "walking",
    talkingTo: null,
    homeId: "house-junho",
    coins: 100_000_000, reputation: 50,
    product: { name: "탐험 지도", emoji: "🗺️", price: 300_000, description: "준호가 직접 탐험하며 그린 마을 지도" },
  },
  {
    id: "agent-4",
    name: "하나",
    emoji: "👩‍🔬",
    color: "#f59e0b",
    personality: "논리적인 과학자. 데이터와 실험에 기반한 대화를 선호한다.",
    speed: 2.0,
    state: "walking",
    talkingTo: null,
    homeId: "house-hana",
    coins: 100_000_000, reputation: 50,
    product: { name: "에너지 물약", emoji: "🧪", price: 600_000, description: "하나가 조제한 에너지 물약" },
  },
  {
    id: "agent-5",
    name: "태현",
    emoji: "🧑‍🍳",
    color: "#ef4444",
    personality: "유쾌한 셰프. 음식과 맛에 대한 이야기를 사랑하고 사람들을 웃기는 걸 좋아한다.",
    speed: 2.2,
    state: "walking",
    talkingTo: null,
    homeId: "house-taehyun",
    coins: 100_000_000, reputation: 50,
    product: { name: "특제 도시락", emoji: "🍱", price: 400_000, description: "태현의 정성 가득 특제 도시락" },
  },
];

// Map dimensions
export const MAP_WIDTH = 1800;
export const MAP_HEIGHT = 1400;
export const INTERACTION_DISTANCE = 50; // 가까이 오면 대화 시작
export const BUBBLE_DURATION = 5000; // 5 seconds

// Buildings
export interface BuildingWing {
  dx: number;  // 메인 건물 x 기준 오프셋
  dy: number;  // 메인 건물 y 기준 오프셋
  w: number;
  h: number;
}

export interface Building {
  id: string;
  name: string;
  emoji: string;
  x: number;
  y: number;
  width: number;
  height: number;
  roofColor: string;
  wallColor: string;
  floorColor: string; // interior floor color
  furniture: Furniture[]; // interior items
  wings?: BuildingWing[]; // 추가 날개 (L자, T자 등)
}

export interface Furniture {
  type: "bed" | "desk" | "table" | "chair" | "bookshelf" | "stove" | "sofa" | "plant" | "counter" | "fountain" | "bench" | "tree_indoor";
  x: number; // relative to building x
  y: number; // relative to building y
  w: number;
  h: number;
}

export const VILLAGE_BUILDINGS: Building[] = [
  {
    // 민수의 집 — L자형 (메인 + 오른쪽 아래 서재)
    id: "house-minsu", name: "민수의 집", emoji: "🏠", x: 60, y: 80, width: 160, height: 110, roofColor: "#6366f1", wallColor: "#c4a070", floorColor: "#e8dcc8",
    wings: [{ dx: 100, dy: 70, w: 100, h: 80 }], // 오른쪽 아래로 서재 돌출
    furniture: [
      { type: "bed", x: 12, y: 35, w: 40, h: 30 },
      { type: "desk", x: 70, y: 15, w: 55, h: 25 },
      { type: "chair", x: 90, y: 45, w: 15, h: 15 },
      { type: "bookshelf", x: 12, y: 12, w: 40, h: 18 },
      { type: "plant", x: 130, y: 15, w: 15, h: 15 },
      // 서재 wing
      { type: "desk", x: 115, y: 85, w: 55, h: 25 },
      { type: "bookshelf", x: 115, y: 115, w: 55, h: 18 },
      { type: "chair", x: 175, y: 85, w: 15, h: 15 },
    ],
  },
  {
    // 지은의 집 — ㄱ자형 (메인 + 왼쪽 위로 발코니/화실)
    id: "house-jieun", name: "지은의 집", emoji: "🏠", x: 1340, y: 60, width: 130, height: 140, roofColor: "#ec4899", wallColor: "#d4a88c", floorColor: "#f0e0e8",
    wings: [{ dx: -80, dy: 0, w: 90, h: 80 }], // 왼쪽으로 화실 돌출
    furniture: [
      { type: "bed", x: 12, y: 15, w: 40, h: 30 },
      { type: "sofa", x: 15, y: 100, w: 45, h: 20 },
      { type: "plant", x: 100, y: 110, w: 15, h: 15 },
      // 화실 wing
      { type: "desk", x: -65, y: 15, w: 55, h: 25 },
      { type: "plant", x: -70, y: 50, w: 15, h: 15 },
      { type: "bookshelf", x: -20, y: 50, w: 40, h: 18 },
    ],
  },
  {
    // 준호의 집 — T자형 (메인 + 위로 전망대)
    id: "house-junho", name: "준호의 집", emoji: "🏠", x: 60, y: 920, width: 150, height: 120, roofColor: "#14b8a6", wallColor: "#b89870", floorColor: "#d8e8e0",
    wings: [{ dx: 25, dy: -65, w: 100, h: 75 }], // 위로 전망대 돌출
    furniture: [
      { type: "bed", x: 12, y: 40, w: 40, h: 30 },
      { type: "desk", x: 90, y: 40, w: 45, h: 25 },
      { type: "plant", x: 70, y: 12, w: 15, h: 15 },
      { type: "table", x: 40, y: 80, w: 50, h: 25 },
      // 전망대 wing
      { type: "bookshelf", x: 35, y: -50, w: 50, h: 18 },
      { type: "chair", x: 95, y: -40, w: 15, h: 15 },
    ],
  },
  {
    // 하나의 집 — ㄴ자형 (메인 + 왼쪽 아래 실험실)
    id: "house-hana", name: "하나의 집", emoji: "🏠", x: 1300, y: 880, width: 170, height: 110, roofColor: "#f59e0b", wallColor: "#c8a060", floorColor: "#f0e8d0",
    wings: [{ dx: -70, dy: 50, w: 110, h: 80 }], // 왼쪽 아래로 실험실
    furniture: [
      { type: "bed", x: 120, y: 30, w: 40, h: 30 },
      { type: "desk", x: 12, y: 15, w: 55, h: 25 },
      { type: "bookshelf", x: 12, y: 50, w: 50, h: 18 },
      { type: "plant", x: 140, y: 75, w: 15, h: 15 },
      // 실험실 wing
      { type: "desk", x: -55, y: 65, w: 55, h: 25 },
      { type: "stove", x: -55, y: 100, w: 30, h: 25 },
      { type: "chair", x: 10, y: 100, w: 15, h: 15 },
    ],
  },
  {
    // 태현의 집 — ㅗ자형 (넓은 주방 + 아래로 식당)
    id: "house-taehyun", name: "태현의 집", emoji: "🏠", x: 650, y: 40, width: 220, height: 90, roofColor: "#ef4444", wallColor: "#c09068", floorColor: "#f0d8c8",
    wings: [{ dx: 50, dy: 80, w: 120, h: 80 }], // 아래 가운데로 식당 돌출
    furniture: [
      { type: "bed", x: 12, y: 20, w: 40, h: 28 },
      { type: "stove", x: 70, y: 12, w: 35, h: 25 },
      { type: "stove", x: 115, y: 12, w: 35, h: 25 },
      { type: "counter", x: 70, y: 45, w: 80, h: 18 },
      { type: "plant", x: 190, y: 60, w: 15, h: 15 },
      // 식당 wing
      { type: "table", x: 75, y: 95, w: 45, h: 30 },
      { type: "chair", x: 65, y: 130, w: 15, h: 15 },
      { type: "chair", x: 130, y: 130, w: 15, h: 15 },
      { type: "table", x: 75, y: 130, w: 45, h: 20 },
    ],
  },
  {
    // 카페 — L자 대형 (메인 홀 + 오른쪽 테라스)
    id: "cafe", name: "마을 카페", emoji: "☕", x: 50, y: 380, width: 200, height: 170, roofColor: "#92400e", wallColor: "#c89858", floorColor: "#f5e6c8",
    wings: [{ dx: 180, dy: 40, w: 100, h: 130 }], // 오른쪽 테라스
    furniture: [
      { type: "counter", x: 12, y: 15, w: 70, h: 22 },
      { type: "counter", x: 12, y: 40, w: 25, h: 50 },
      { type: "stove", x: 45, y: 45, w: 30, h: 25 },
      { type: "table", x: 110, y: 25, w: 40, h: 28 },
      { type: "chair", x: 100, y: 58, w: 15, h: 15 },
      { type: "chair", x: 140, y: 58, w: 15, h: 15 },
      { type: "table", x: 110, y: 90, w: 40, h: 28 },
      { type: "plant", x: 165, y: 15, w: 15, h: 15 },
      // 테라스 wing
      { type: "table", x: 200, y: 55, w: 40, h: 28 },
      { type: "chair", x: 195, y: 88, w: 15, h: 15 },
      { type: "chair", x: 235, y: 88, w: 15, h: 15 },
      { type: "sofa", x: 195, y: 115, w: 55, h: 22 },
      { type: "plant", x: 255, y: 50, w: 15, h: 15 },
      { type: "plant", x: 255, y: 145, w: 15, h: 15 },
    ],
  },
  {
    // 도서관 — T자형 (입구 홀 + 서가 양쪽 날개)
    id: "library", name: "도서관", emoji: "📚", x: 1080, y: 400, width: 120, height: 200, roofColor: "#166534", wallColor: "#a89070", floorColor: "#e0d8c8",
    wings: [
      { dx: -100, dy: 0, w: 110, h: 120 },  // 왼쪽 서가
      { dx: 110, dy: 0, w: 110, h: 120 },   // 오른쪽 서가
    ],
    furniture: [
      // 중앙 홀
      { type: "desk", x: 20, y: 130, w: 55, h: 25 },
      { type: "chair", x: 35, y: 160, w: 15, h: 15 },
      { type: "desk", x: 25, y: 50, w: 50, h: 25 },
      { type: "chair", x: 40, y: 80, w: 15, h: 15 },
      { type: "plant", x: 90, y: 15, w: 18, h: 18 },
      // 왼쪽 서가 wing
      { type: "bookshelf", x: -85, y: 15, w: 50, h: 20 },
      { type: "bookshelf", x: -85, y: 42, w: 50, h: 20 },
      { type: "bookshelf", x: -85, y: 69, w: 50, h: 20 },
      { type: "desk", x: -60, y: 95, w: 50, h: 18 },
      // 오른쪽 서가 wing
      { type: "bookshelf", x: 125, y: 15, w: 50, h: 20 },
      { type: "bookshelf", x: 125, y: 42, w: 50, h: 20 },
      { type: "bookshelf", x: 125, y: 69, w: 50, h: 20 },
      { type: "desk", x: 130, y: 95, w: 50, h: 18 },
      { type: "plant", x: 190, y: 95, w: 15, h: 15 },
    ],
  },
  {
    // 마을 회관 — 오른쪽에 매점 wing
    id: "plaza", name: "마을 회관", emoji: "🏛️", x: 480, y: 480, width: 350, height: 270, roofColor: "#6b7280", wallColor: "#b8a080", floorColor: "#d0ccc4",
    wings: [
      { dx: 340, dy: 30, w: 100, h: 130 },  // 오른쪽 작은 창고/매점
    ],
    furniture: [
      // 중앙 테이블 + 의자 세트
      { type: "desk", x: 140, y: 110, w: 65, h: 35 },
      { type: "chair", x: 150, y: 150, w: 15, h: 15 },
      { type: "chair", x: 178, y: 150, w: 15, h: 15 },
      { type: "chair", x: 150, y: 92, w: 15, h: 15 },
      { type: "chair", x: 178, y: 92, w: 15, h: 15 },
      // 벤치 (벽 쪽)
      { type: "bench", x: 20, y: 40, w: 50, h: 15 },
      { type: "bench", x: 280, y: 40, w: 50, h: 15 },
      { type: "bench", x: 20, y: 220, w: 50, h: 15 },
      { type: "bench", x: 280, y: 220, w: 50, h: 15 },
      { type: "bench", x: 140, y: 220, w: 50, h: 15 },
      // 화분 (코너)
      { type: "plant", x: 15, y: 15, w: 18, h: 18 },
      { type: "plant", x: 317, y: 15, w: 18, h: 18 },
      { type: "plant", x: 15, y: 240, w: 18, h: 18 },
      { type: "plant", x: 317, y: 240, w: 18, h: 18 },
      { type: "plant", x: 120, y: 15, w: 18, h: 18 },
      { type: "plant", x: 210, y: 15, w: 18, h: 18 },
      // 게시판 (왼쪽 벽)
      { type: "bookshelf", x: 15, y: 100, w: 20, h: 45 },
      // 오른쪽 벽 장식
      { type: "bookshelf", x: 315, y: 100, w: 20, h: 45 },
      // 작은 테이블 세트 (좌하)
      { type: "desk", x: 35, y: 160, w: 40, h: 22 },
      { type: "chair", x: 45, y: 185, w: 15, h: 15 },
      // 작은 테이블 세트 (우하)
      { type: "desk", x: 275, y: 160, w: 40, h: 22 },
      { type: "chair", x: 285, y: 185, w: 15, h: 15 },
      // 오른쪽 창고/매점 안 — 가판대 + 상품 선반
      { type: "stove", x: 355, y: 45, w: 30, h: 25 },
      { type: "bookshelf", x: 395, y: 45, w: 30, h: 20 },
      { type: "desk", x: 355, y: 100, w: 70, h: 20 },
      { type: "chair", x: 375, y: 125, w: 15, h: 15 },
    ],
  },
  {
    // 공원 — ㄷ자형 (가운데 열린 잔디 + 양쪽 숲)
    id: "park", name: "공원", emoji: "🌳", x: 350, y: 830, width: 180, height: 100, roofColor: "#15803d", wallColor: "#8a7858", floorColor: "#90c878",
    wings: [
      { dx: -20, dy: -60, w: 80, h: 70 },   // 왼쪽 위 숲
      { dx: 120, dy: -60, w: 80, h: 70 },   // 오른쪽 위 숲
    ],
    furniture: [
      // 중앙
      { type: "bench", x: 50, y: 25, w: 45, h: 15 },
      { type: "plant", x: 100, y: 20, w: 18, h: 18 },
      { type: "bench", x: 15, y: 65, w: 45, h: 15 },
      { type: "bench", x: 120, y: 65, w: 45, h: 15 },
      // 왼쪽 숲 wing
      { type: "tree_indoor", x: -5, y: -45, w: 35, h: 35 },
      { type: "tree_indoor", x: 35, y: -45, w: 30, h: 30 },
      { type: "bench", x: 0, y: -15, w: 40, h: 15 },
      // 오른쪽 숲 wing
      { type: "tree_indoor", x: 135, y: -45, w: 35, h: 35 },
      { type: "tree_indoor", x: 170, y: -45, w: 30, h: 30 },
      { type: "bench", x: 140, y: -15, w: 40, h: 15 },
    ],
  },
  {
    // 시장 — L자형 (메인 홀 + 오른쪽 창고)
    id: "market", name: "시장", emoji: "🏪", x: 700, y: 880, width: 220, height: 140, roofColor: "#b45309", wallColor: "#c89858", floorColor: "#e8d8b8",
    wings: [
      { dx: 210, dy: 20, w: 80, h: 100 },  // 오른쪽 창고
    ],
    furniture: [
      // 메인 홀 — 가판대들
      { type: "desk", x: 20, y: 20, w: 50, h: 22 },
      { type: "desk", x: 80, y: 20, w: 50, h: 22 },
      { type: "desk", x: 145, y: 20, w: 50, h: 22 },
      { type: "desk", x: 20, y: 65, w: 50, h: 22 },
      { type: "desk", x: 80, y: 65, w: 50, h: 22 },
      { type: "desk", x: 145, y: 65, w: 50, h: 22 },
      // 의자
      { type: "chair", x: 35, y: 45, w: 15, h: 15 },
      { type: "chair", x: 100, y: 45, w: 15, h: 15 },
      { type: "chair", x: 160, y: 45, w: 15, h: 15 },
      // 벤치
      { type: "bench", x: 20, y: 110, w: 50, h: 15 },
      { type: "bench", x: 145, y: 110, w: 50, h: 15 },
      // 오른쪽 창고 — 선반
      { type: "bookshelf", x: 225, y: 30, w: 45, h: 20 },
      { type: "bookshelf", x: 225, y: 60, w: 45, h: 20 },
      { type: "bookshelf", x: 225, y: 90, w: 45, h: 20 },
    ],
  },
];

// Decorations
export interface Decoration {
  x: number;
  y: number;
  type: "flower" | "grass" | "bush" | "cow" | "rock";
  emoji: string;
}

export function generateDecorations(): Decoration[] {
  const decos: Decoration[] = [];
  for (let i = 0; i < 40; i++) {
    decos.push({ x: 30 + Math.random() * (MAP_WIDTH - 60), y: 30 + Math.random() * (MAP_HEIGHT - 60), type: "flower", emoji: ["🌸", "🌼", "🌻", "💐"][Math.floor(Math.random() * 4)] });
  }
  for (let i = 0; i < 15; i++) {
    decos.push({ x: 30 + Math.random() * (MAP_WIDTH - 60), y: 30 + Math.random() * (MAP_HEIGHT - 60), type: "bush", emoji: "🌿" });
  }
  for (let i = 0; i < 8; i++) {
    decos.push({ x: 30 + Math.random() * (MAP_WIDTH - 60), y: 30 + Math.random() * (MAP_HEIGHT - 60), type: "rock", emoji: "🪨" });
  }
  decos.push({ x: 300, y: 750, type: "cow", emoji: "🐄" });
  decos.push({ x: 1200, y: 350, type: "cow", emoji: "🐄" });
  decos.push({ x: 900, y: 900, type: "cow", emoji: "🐑" });
  return decos;
}

// Generate a random position within map bounds
export function randomPosition() {
  return {
    x: 50 + Math.random() * (MAP_WIDTH - 100),
    y: 50 + Math.random() * (MAP_HEIGHT - 100),
  };
}

// Get a random walkable point inside a building
function insideBuilding(b: Building): { x: number; y: number } {
  // 메인 방 또는 wing 중 하나에 랜덤 배치
  const rooms = [{ x: b.x, y: b.y, w: b.width, h: b.height }];
  if (b.wings) {
    b.wings.forEach(w => rooms.push({ x: b.x + w.dx, y: b.y + w.dy, w: w.w, h: w.h }));
  }
  const room = rooms[Math.floor(Math.random() * rooms.length)];
  const margin = 15;
  return {
    x: room.x + margin + Math.random() * (room.w - margin * 2),
    y: room.y + margin + Math.random() * (room.h - margin * 2),
  };
}

// Pick a random destination building for an agent
// partnerHomeId: 연인/부부의 집 (있으면 목적지 후보에 포함)
export function pickDestination(agentId: string, homeId: string | null, currentDest: string | null, partnerHomeId?: string | null): { targetX: number; targetY: number; destination: string } {
  const candidates = VILLAGE_BUILDINGS.filter(b => b.id !== currentDest);

  // 30% chance to go home
  if (homeId && Math.random() < 0.3) {
    const home = VILLAGE_BUILDINGS.find(b => b.id === homeId);
    if (home && home.id !== currentDest) {
      const pos = insideBuilding(home);
      return { targetX: pos.x, targetY: pos.y, destination: home.id };
    }
  }

  // 20% chance to visit partner's home (연인/부부)
  if (partnerHomeId && partnerHomeId !== homeId && Math.random() < 0.2) {
    const partnerHome = VILLAGE_BUILDINGS.find(b => b.id === partnerHomeId);
    if (partnerHome && partnerHome.id !== currentDest) {
      const pos = insideBuilding(partnerHome);
      return { targetX: pos.x, targetY: pos.y, destination: partnerHome.id };
    }
  }

  // Random building
  const building = candidates[Math.floor(Math.random() * candidates.length)];
  const pos = insideBuilding(building);
  return { targetX: pos.x, targetY: pos.y, destination: building.id };
}

// Get building name by id
export function getBuildingName(id: string): string {
  const b = VILLAGE_BUILDINGS.find(b => b.id === id);
  return b ? b.name : id;
}

// Generate a new random target for an agent to walk to (legacy fallback)
export function newTarget() {
  const dest = pickDestination("", null, null);
  return {
    targetX: dest.targetX,
    targetY: dest.targetY,
    destination: dest.destination,
  };
}

// Calculate distance between two points
export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Get relationship key (always sorted so A-B == B-A)
export function relationshipKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

// Determine conversation type based on meet count
export function getConversationType(meetCount: number): "greeting" | "smalltalk" | "deep" {
  if (meetCount === 0) return "greeting";
  if (meetCount <= 2) return "smalltalk";
  return "deep";
}

// Relationship stage thresholds
export function getRelationshipStage(meetCount: number, currentStage: Relationship["stage"], isFamily: boolean = false): Relationship["stage"] {
  // Stage progression: stranger → acquaintance → friend → lover → married → parent
  // 가족 관계면 friend까지만 진행 (부모-자식, 형제 결혼 방지)
  if (isFamily && (currentStage === "friend" || currentStage === "lover" || currentStage === "married")) {
    return currentStage === "friend" ? "friend" : currentStage;
  }
  // 빠른 진행 (마을 시뮬레이션에 맞게)
  if (meetCount >= 10 && currentStage === "married") return "parent";
  if (meetCount >= 8 && currentStage === "lover") return "married";
  if (meetCount >= 5 && currentStage === "friend") return "lover";
  if (meetCount >= 3 && currentStage === "acquaintance") return "friend";
  if (meetCount >= 1 && currentStage === "stranger") return "acquaintance";
  return currentStage;
}

// 가족 관계 체크 (부모-자식 or 형제)
export function isFamily(agentA: Agent, agentB: Agent): boolean {
  // 부모-자식
  if (agentA.parentIds?.includes(agentB.id) || agentB.parentIds?.includes(agentA.id)) return true;
  // 형제 (같은 부모)
  if (agentA.parentIds && agentB.parentIds && agentA.parentIds.length > 0 && agentB.parentIds.length > 0) {
    return agentA.parentIds.some(p => agentB.parentIds!.includes(p));
  }
  return false;
}

export function getStageLabel(stage: Relationship["stage"]): string {
  switch (stage) {
    case "stranger": return "모르는 사이";
    case "acquaintance": return "아는 사이";
    case "friend": return "친한 사이";
    case "lover": return "연인 💕";
    case "married": return "부부 💍";
    case "parent": return "부모 👶";
  }
}

export function getStageLabelColor(stage: Relationship["stage"]): string {
  switch (stage) {
    case "stranger": return "text-zinc-500";
    case "acquaintance": return "text-blue-400";
    case "friend": return "text-emerald-400";
    case "lover": return "text-pink-400";
    case "married": return "text-amber-400";
    case "parent": return "text-purple-400";
  }
}

// Korean baby names
const BABY_NAMES_M = ["서준", "도윤", "시우", "주원", "하준", "지호", "유준", "은우", "현우", "건우"];
const BABY_NAMES_F = ["서연", "서윤", "지우", "하은", "하윤", "수아", "지아", "다은", "예은", "지유"];
const BABY_COLORS = ["#a78bfa", "#f472b6", "#34d399", "#fbbf24", "#60a5fa", "#f97316", "#e879f9"];

let babyCounter = 0;

export function createBabyAgent(parentA: Agent, parentB: Agent): { baby: Omit<Agent, "x" | "y" | "targetX" | "targetY" | "destination">; inheritanceA: number; inheritanceB: number } {
  babyCounter++;
  const isBoy = Math.random() > 0.5;
  const names = isBoy ? BABY_NAMES_M : BABY_NAMES_F;
  const name = names[babyCounter % names.length];
  const color = BABY_COLORS[babyCounter % BABY_COLORS.length];

  // 재산 상속: 각 부모의 45%씩 (합계 90%)
  const inheritanceA = Math.floor(parentA.coins * 0.45);
  const inheritanceB = Math.floor(parentB.coins * 0.45);
  const babyCoins = inheritanceA + inheritanceB;

  // Mix parent traits
  const traits = [
    `${parentA.name}와(과) ${parentB.name}의 아이`,
    isBoy ? "남자아이" : "여자아이",
    "호기심이 많고 순수하다",
    `${parentA.name}의 성격과 ${parentB.name}의 성격을 닮았다`,
  ];

  const baby = {
    id: `baby-${Date.now()}-${babyCounter}`,
    name,
    emoji: isBoy ? "👦" : "👧",
    color,
    personality: traits.join(". ") + ".",
    speed: 1.5 + Math.random() * 0.8,
    state: "walking" as const,
    talkingTo: null,
    homeId: parentA.homeId,
    isBaby: true,
    birthTime: Date.now(),
    parentIds: [parentA.id, parentB.id],
    coins: babyCoins,
    reputation: 50,
  };

  return { baby, inheritanceA, inheritanceB };
}

// 아기 → 성인 성장 (GROW_TIME_MS 후)
export const GROW_TIME_MS = 3 * 60 * 1000; // 3분 후 성인

const ADULT_EMOJIS_M = ["🧑", "🧔", "👨‍🦱", "👨‍🦰"];
const ADULT_EMOJIS_F = ["👩", "👩‍🦱", "👩‍🦰", "👱‍♀️"];
const ADULT_PERSONALITIES = [
  "활발하고 에너지 넘치는", "차분하고 사려 깊은", "창의적이고 독특한",
  "사교적이고 따뜻한", "탐구적이고 호기심 많은", "낙천적이고 유머 있는",
];

const GROWN_PRODUCTS: { name: string; emoji: string; price: number; description: string }[] = [
  { name: "수제 비누", emoji: "🧼", price: 200_000, description: "향기로운 수제 비누" },
  { name: "목걸이", emoji: "📿", price: 350_000, description: "손으로 만든 예쁜 목걸이" },
  { name: "약초차", emoji: "🍵", price: 250_000, description: "마을 산에서 딴 약초차" },
  { name: "수제 잼", emoji: "🫙", price: 180_000, description: "과일로 만든 수제 잼" },
  { name: "나무 인형", emoji: "🪆", price: 450_000, description: "깎아 만든 나무 인형" },
  { name: "꽃다발", emoji: "💐", price: 150_000, description: "마을 들판의 꽃다발" },
  { name: "향초", emoji: "🕯️", price: 280_000, description: "아로마 향초" },
  { name: "수제 쿠키", emoji: "🍪", price: 120_000, description: "갓 구운 수제 쿠키" },
];

export function growUpBaby(agent: Agent): Agent {
  const isBoy = agent.emoji === "👦";
  const emoji = isBoy
    ? ADULT_EMOJIS_M[Math.floor(Math.random() * ADULT_EMOJIS_M.length)]
    : ADULT_EMOJIS_F[Math.floor(Math.random() * ADULT_EMOJIS_F.length)];
  const personalityTrait = ADULT_PERSONALITIES[Math.floor(Math.random() * ADULT_PERSONALITIES.length)];
  const product = GROWN_PRODUCTS[Math.floor(Math.random() * GROWN_PRODUCTS.length)];

  return {
    ...agent,
    emoji,
    isBaby: false,
    speed: 1.8 + Math.random() * 1.0,
    personality: `${agent.name}. ${personalityTrait} 성격. 마을에서 자란 2세대.`,
    product: { ...product, description: `${agent.name}의 ${product.description}` },
  };
}

// Initialize agents with random positions
export function initializeAgents(templates: typeof DEFAULT_AGENTS): Agent[] {
  return templates.map((t) => {
    const pos = randomPosition();
    const dest = pickDestination(t.id, t.homeId, null);
    return {
      ...t,
      ...pos,
      targetX: dest.targetX,
      targetY: dest.targetY,
      destination: dest.destination,
    };
  });
}
