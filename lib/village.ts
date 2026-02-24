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
}

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
    speed: 1.2,
    state: "walking",
    talkingTo: null,
    homeId: "house-minsu",
  },
  {
    id: "agent-2",
    name: "지은",
    emoji: "👩‍🎨",
    color: "#ec4899",
    personality: "감성적인 아티스트. 그림 그리기를 좋아하고 철학적인 대화를 즐긴다.",
    speed: 0.8,
    state: "walking",
    talkingTo: null,
    homeId: "house-jieun",
  },
  {
    id: "agent-3",
    name: "준호",
    emoji: "🧑‍🚀",
    color: "#14b8a6",
    personality: "모험을 좋아하는 탐험가. 우주와 미래에 대한 이야기를 좋아한다.",
    speed: 1.5,
    state: "walking",
    talkingTo: null,
    homeId: "house-junho",
  },
  {
    id: "agent-4",
    name: "하나",
    emoji: "👩‍🔬",
    color: "#f59e0b",
    personality: "논리적인 과학자. 데이터와 실험에 기반한 대화를 선호한다.",
    speed: 1.0,
    state: "walking",
    talkingTo: null,
    homeId: "house-hana",
  },
  {
    id: "agent-5",
    name: "태현",
    emoji: "🧑‍🍳",
    color: "#ef4444",
    personality: "유쾌한 셰프. 음식과 맛에 대한 이야기를 사랑하고 사람들을 웃기는 걸 좋아한다.",
    speed: 1.1,
    state: "walking",
    talkingTo: null,
    homeId: "house-taehyun",
  },
];

// Map dimensions
export const MAP_WIDTH = 1600;
export const MAP_HEIGHT = 1200;
export const INTERACTION_DISTANCE = 30; // 진짜 부딪혀야 대화 (캐릭터 반지름 20 × 2 = 40 → 30이면 겹침)
export const BUBBLE_DURATION = 5000; // 5 seconds

// Buildings
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
}

export const VILLAGE_BUILDINGS: Building[] = [
  { id: "house-minsu", name: "민수의 집", emoji: "🏠", x: 150, y: 150, width: 80, height: 60, roofColor: "#6366f1", wallColor: "#c7d2fe" },
  { id: "house-jieun", name: "지은의 집", emoji: "🏠", x: 1350, y: 150, width: 80, height: 60, roofColor: "#ec4899", wallColor: "#fbcfe8" },
  { id: "house-junho", name: "준호의 집", emoji: "🏠", x: 150, y: 950, width: 80, height: 60, roofColor: "#14b8a6", wallColor: "#ccfbf1" },
  { id: "house-hana", name: "하나의 집", emoji: "🏠", x: 1350, y: 950, width: 80, height: 60, roofColor: "#f59e0b", wallColor: "#fef3c7" },
  { id: "house-taehyun", name: "태현의 집", emoji: "🏠", x: 750, y: 100, width: 80, height: 60, roofColor: "#ef4444", wallColor: "#fecaca" },
  { id: "cafe", name: "마을 카페", emoji: "☕", x: 500, y: 500, width: 100, height: 70, roofColor: "#92400e", wallColor: "#fde68a" },
  { id: "library", name: "도서관", emoji: "📚", x: 1000, y: 500, width: 100, height: 70, roofColor: "#166534", wallColor: "#dcfce7" },
  { id: "plaza", name: "마을 광장", emoji: "⛲", x: 720, y: 550, width: 160, height: 120, roofColor: "#6b7280", wallColor: "#e5e7eb" },
  { id: "park", name: "공원", emoji: "🌳", x: 350, y: 850, width: 120, height: 80, roofColor: "#15803d", wallColor: "#86efac" },
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

// Pick a random destination building for an agent
// partnerHomeId: 연인/부부의 집 (있으면 목적지 후보에 포함)
export function pickDestination(agentId: string, homeId: string | null, currentDest: string | null, partnerHomeId?: string | null): { targetX: number; targetY: number; destination: string } {
  const candidates = VILLAGE_BUILDINGS.filter(b => b.id !== currentDest);

  // 30% chance to go home
  if (homeId && Math.random() < 0.3) {
    const home = VILLAGE_BUILDINGS.find(b => b.id === homeId);
    if (home && home.id !== currentDest) {
      return {
        targetX: home.x + home.width / 2 + (Math.random() - 0.5) * 30,
        targetY: home.y + home.height + 15 + Math.random() * 20,
        destination: home.id,
      };
    }
  }

  // 20% chance to visit partner's home (연인/부부)
  if (partnerHomeId && partnerHomeId !== homeId && Math.random() < 0.2) {
    const partnerHome = VILLAGE_BUILDINGS.find(b => b.id === partnerHomeId);
    if (partnerHome && partnerHome.id !== currentDest) {
      return {
        targetX: partnerHome.x + partnerHome.width / 2 + (Math.random() - 0.5) * 30,
        targetY: partnerHome.y + partnerHome.height + 15 + Math.random() * 20,
        destination: partnerHome.id,
      };
    }
  }

  // Random building
  const building = candidates[Math.floor(Math.random() * candidates.length)];
  return {
    targetX: building.x + building.width / 2 + (Math.random() - 0.5) * 30,
    targetY: building.y + building.height + 15 + Math.random() * 20,
    destination: building.id,
  };
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
export function getRelationshipStage(meetCount: number, currentStage: Relationship["stage"]): Relationship["stage"] {
  // Stage progression: stranger → acquaintance → friend → lover → married → parent
  // Each stage requires minimum meet count AND previous stage
  if (meetCount >= 20 && currentStage === "married") return "parent";
  if (meetCount >= 15 && currentStage === "lover") return "married";
  if (meetCount >= 10 && currentStage === "friend") return "lover";
  if (meetCount >= 5 && currentStage === "acquaintance") return "friend";
  if (meetCount >= 2 && currentStage === "stranger") return "acquaintance";
  return currentStage;
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

export function createBabyAgent(parentA: Agent, parentB: Agent): Omit<Agent, "x" | "y" | "targetX" | "targetY" | "destination"> {
  babyCounter++;
  const isBoy = Math.random() > 0.5;
  const names = isBoy ? BABY_NAMES_M : BABY_NAMES_F;
  const name = names[babyCounter % names.length];
  const color = BABY_COLORS[babyCounter % BABY_COLORS.length];

  // Mix parent traits
  const traits = [
    `${parentA.name}와(과) ${parentB.name}의 아이`,
    isBoy ? "남자아이" : "여자아이",
    "호기심이 많고 순수하다",
    `${parentA.name}의 성격과 ${parentB.name}의 성격을 닮았다`,
  ];

  return {
    id: `baby-${Date.now()}-${babyCounter}`,
    name,
    emoji: isBoy ? "👦" : "👧",
    color,
    personality: traits.join(". ") + ".",
    speed: 0.7 + Math.random() * 0.5,
    state: "walking",
    talkingTo: null,
    homeId: parentA.homeId, // lives with parents
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
