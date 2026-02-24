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
}

export interface Relationship {
  agentA: string;
  agentB: string;
  meetCount: number;
  lastTopics: string[];
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
export const DEFAULT_AGENTS: Omit<Agent, "x" | "y" | "targetX" | "targetY">[] = [
  {
    id: "agent-1",
    name: "민수",
    emoji: "🧑‍💻",
    color: "#6366f1",
    personality: "호기심 많은 개발자. 항상 새로운 기술에 관심이 많고 열정적이다.",
    speed: 1.2,
    state: "walking",
    talkingTo: null,
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
  },
];

// Map dimensions
export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 600;
export const INTERACTION_DISTANCE = 30; // 진짜 부딪혀야 대화 (캐릭터 반지름 20 × 2 = 40 → 30이면 겹침)
export const BUBBLE_DURATION = 5000; // 5 seconds

// Generate a random position within map bounds
export function randomPosition() {
  return {
    x: 50 + Math.random() * (MAP_WIDTH - 100),
    y: 50 + Math.random() * (MAP_HEIGHT - 100),
  };
}

// Generate a new random target for an agent to walk to
export function newTarget() {
  return {
    targetX: 50 + Math.random() * (MAP_WIDTH - 100),
    targetY: 50 + Math.random() * (MAP_HEIGHT - 100),
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

// Initialize agents with random positions
export function initializeAgents(templates: typeof DEFAULT_AGENTS): Agent[] {
  return templates.map((t) => {
    const pos = randomPosition();
    const target = newTarget();
    return {
      ...t,
      ...pos,
      ...target,
    };
  });
}
