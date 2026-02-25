"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Agent,
  Relationship,
  ChatBubble,
  WorldObject,
  SPAWNABLE_OBJECTS,
  DEFAULT_AGENTS,
  MAP_WIDTH,
  MAP_HEIGHT,
  INTERACTION_DISTANCE,
  BUBBLE_DURATION,
  VILLAGE_BUILDINGS,
  initializeAgents,
  newTarget,
  distance,
  relationshipKey,
  getConversationType,
  getRelationshipStage,
  getStageLabel,
  getStageLabelColor,
  createBabyAgent,
  randomPosition,
  pickDestination,
  getBuildingName,
  growUpBaby,
  GROW_TIME_MS,
  isFamily,
  OUTFITS,
  HOME_UPGRADES,
  AgentOutfit,
  VillageLaw,
  PROPOSED_LAWS,
  BLOCK_COLORS,
  PATTERN_COLOR_MAP,
  PlacedBlock,
} from "@/lib/village";
import {
  CHARACTER_PALETTES,
  PIXEL_SIZE,
  SPRITE_WIDTH,
  SPRITE_HEIGHT,
  drawSprite,
  getFrame,
} from "@/lib/sprites";
import {
  drawGrassTile, drawDirtPathTile, drawWaterTile, drawStoneTile,
  drawTreeTile, drawFlowerTile, drawBushTile, drawRockTile,
  drawBuildingInterior, drawTallGrassTile, drawBigTree,
} from "@/lib/tiles";
import { TILEMAP, TILE_SIZE, TILE_SCALE, TILES_X, TILES_Y, T, DECORATIONS } from "@/lib/tilemap";

// Viewport size (what you see on screen)
const VIEWPORT_W = 800; // 기본값, 동적으로 변경됨
const VIEWPORT_H = 600;
const TS = TILE_SIZE * TILE_SCALE; // rendered tile size in px

// 코인 포맷 (억/만)
const DAY_DURATION = 60_000; // 60초 = 1일 (밤 ~18초)
const NIGHT_START = 0.7; // 70% 지점부터 밤 (14초 낮, 6초 밤)
const DAWN_START = 0.0;  // 0% = 새벽/일출
const DUSK_START = 0.65; // 65% = 해질녘
const NIGHT_SPEED = 4;   // 밤 4배속

type TimeOfDay = "dawn" | "day" | "dusk" | "night";

function getTimeOfDay(virtualElapsed: number): { phase: TimeOfDay; progress: number; hourLabel: string } {
  const elapsed = virtualElapsed % DAY_DURATION;
  const progress = elapsed / DAY_DURATION; // 0~1
  // 시간 매핑: 0=06:00, 0.7=21:00, 1.0=06:00
  const hour = Math.floor(((progress * 24) + 6) % 24);
  const minute = Math.floor((((progress * 24) + 6) % 1) * 60);
  const hourLabel = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

  if (progress < 0.08) return { phase: "dawn", progress, hourLabel };
  if (progress < DUSK_START) return { phase: "day", progress, hourLabel };
  if (progress < NIGHT_START) return { phase: "dusk", progress, hourLabel };
  return { phase: "night", progress, hourLabel };
}

// (getOverlayColor 제거 — 상단 그라데이션으로 대체)

function formatCoins(coins: number): string {
  if (coins >= 1) return `₿${coins.toFixed(2)}`;
  if (coins >= 0.01) return `₿${coins.toFixed(4)}`;
  if (coins >= 0.0001) return `₿${coins.toFixed(6)}`;
  return `${(coins * 100_000_000).toFixed(0)} sats`;
}

function shadeColor(hex: string, amt: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// 법률 효과 조회
function getLawEffect(laws: VillageLaw[], type: string): number | string | boolean | null {
  for (const law of laws) {
    if (law.effect.type === type) {
      if ('value' in law.effect) return law.effect.value;
      if ('text' in law.effect) return law.effect.text;
      if ('active' in law.effect) return law.effect.active;
      if ('duration' in law.effect) return law.effect.duration;
    }
  }
  return null;
}

// 시장 안에 있는지 체크
function isInMarket(x: number, y: number): boolean {
  const market = VILLAGE_BUILDINGS.find(b => b.id === "market");
  if (!market) return false;
  // 메인 영역
  if (x >= market.x && x <= market.x + market.width && y >= market.y && y <= market.y + market.height) return true;
  // wing 영역
  if (market.wings) {
    for (const w of market.wings) {
      if (x >= market.x + w.dx && x <= market.x + w.dx + w.w && y >= market.y + w.dy && y <= market.y + w.dy + w.h) return true;
    }
  }
  return false;
}

export default function VillagePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ w: VIEWPORT_W, h: VIEWPORT_H });
  const vpRef = useRef({ w: VIEWPORT_W, h: VIEWPORT_H });
  vpRef.current = viewportSize;
  const [agents, setAgents] = useState<Agent[]>([]);
  const [relationships, setRelationships] = useState<Map<string, Relationship>>(new Map());
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [conversationLog, setConversationLog] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const [agentCount, setAgentCount] = useState(5);
  const [godMessage, setGodMessage] = useState("");
  const [isSendingDecree, setIsSendingDecree] = useState(false);
  const [lastDecree, setLastDecree] = useState<string | null>(null);
  const [godEffect, setGodEffect] = useState(false);
  // 🏛️ 사회 시스템
  const [villageLaws, setVillageLaws] = useState<VillageLaw[]>([]);
  const [villageSlogan, setVillageSlogan] = useState<string | null>(null);
  const [festivalUntil, setFestivalUntil] = useState<number | null>(null); // timestamp until festival ends
  const villageLawsRef = useRef<VillageLaw[]>([]);
  const [worldObjects, setWorldObjects] = useState<WorldObject[]>([]);
  const [showObjectPicker, setShowObjectPicker] = useState(false);
  const [showLawsPopup, setShowLawsPopup] = useState(false);
  const [villageStartTime] = useState(Date.now()); // 마을 탄생 시간
  const virtualElapsedRef = useRef(0); // 가상 경과 시간 (밤 4배속 반영)
  const lastRealTimeRef = useRef(Date.now());
  const [villageDays, setVillageDays] = useState(1); // 마을 일수
  const placedBlocksRef = useRef<PlacedBlock[]>([]); // 🧱 배치된 블록들
  const worldObjectsRef = useRef<WorldObject[]>([]);
  const OBJECT_INTERACT_DISTANCE = 50;

  // Camera
  const [cameraX, setCameraX] = useState(400); // Center of 1600 - 800/2
  const [cameraY, setCameraY] = useState(300);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const cameraStart = useRef({ x: 0, y: 0 });

  // 🪙 크립토 리서치
  const [coinPicks, setCoinPicks] = useState<{ symbol: string; name: string; reason: string; confidence: number; pickedBy: string; price?: number; change24h?: number }[]>([]);
  const [consensus, setConsensus] = useState<{ symbol: string; name: string; voters: string[]; avgConfidence: number; price?: number; change24h?: number }[]>([]);
  const [isResearching, setIsResearching] = useState(false);
  const lastResearchRef = useRef(0);

  const agentsRef = useRef<Agent[]>([]);
  const relationshipsRef = useRef<Map<string, Relationship>>(new Map());
  const bubblesRef = useRef<ChatBubble[]>([]);
  const pendingChatsRef = useRef<Set<string>>(new Set());
  const pendingGroupChatRef = useRef<Set<string>>(new Set()); // 그룹 채팅 중인 건물
  const animFrameRef = useRef<number>(0);
  const tickRef = useRef<number>(0);

  // Pre-render tilemap to offscreen canvas (cache)
  const tilemapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize agents
  useEffect(() => {
    const templates = DEFAULT_AGENTS.slice(0, agentCount);
    const initialized = initializeAgents(templates);
    setAgents(initialized);
    agentsRef.current = initialized;
  }, [agentCount]);

  // 뷰포트 리사이즈
  useEffect(() => {
    const updateSize = () => {
      if (canvasContainerRef.current) {
        const rect = canvasContainerRef.current.getBoundingClientRect();
        const w = Math.floor(rect.width);
        const h = Math.floor(window.innerHeight - 60); // 상단바 제외
        setViewportSize({ w: Math.max(400, w), h: Math.max(300, h) });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Camera drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    cameraStart.current = { x: cameraX, y: cameraY };
  }, [cameraX, cameraY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const newX = Math.max(0, Math.min(MAP_WIDTH - vpRef.current.w, cameraStart.current.x - dx));
    const newY = Math.max(0, Math.min(MAP_HEIGHT - vpRef.current.h, cameraStart.current.y - dy));
    setCameraX(newX);
    setCameraY(newY);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Spawn object
  const spawnObject = useCallback((obj: { name: string; emoji: string }) => {
    const newObj: WorldObject = {
      id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: obj.name,
      emoji: obj.emoji,
      x: 100 + Math.random() * (MAP_WIDTH - 200),
      y: 100 + Math.random() * (MAP_HEIGHT - 200),
      createdAt: Date.now(),
    };
    worldObjectsRef.current = [...worldObjectsRef.current, newObj];
    setWorldObjects([...worldObjectsRef.current]);
    setShowObjectPicker(false);
    setGodEffect(true);
    setTimeout(() => setGodEffect(false), 2000);
    setConversationLog((prev) => [`⚡ 신이 ${obj.emoji} ${obj.name}을(를) 마을에 내려놓았다`, ...prev].slice(0, 50));
  }, []);

  // God decree
  // ➕ 에이전트 생성 시스템 (직업별)
  const SPAWN_NAMES = ["도윤", "서연", "시우", "하린", "예준", "소율", "지호", "다은", "현우", "수아", "건우", "채원", "유준", "은서", "정우", "하윤", "승우", "지유", "도현", "서윤", "민재", "소희", "준서", "하은", "윤서", "시현", "재민", "유나", "태민", "지수"];

  type AgentClass = "civilian" | "police" | "soldier" | "thug";

  const CLASS_CONFIG: Record<AgentClass, {
    label: string; btnEmoji: string; btnColor: string;
    emojis: string[]; personalities: string[];
    products: { name: string; emoji: string; price: number; description: string }[];
    colors: string[];
    speedRange: [number, number]; coinsRange: [number, number]; repRange: [number, number];
    arrivalMsg: string; bubbleMsg: string;
    stealChanceMult: number; // 도둑질 확률 배수
  }> = {
    civilian: {
      label: "시민", btnEmoji: "👤", btnColor: "bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30",
      emojis: ["👨‍🎤", "👩‍💼", "🧑‍🏫", "👨‍🌾", "👩‍🎓", "🧑‍🔧", "👨‍⚕️", "👩‍🚒", "🧑‍🎨", "👨‍🍳"],
      personalities: [
        "음악을 사랑하는 가수. 항상 흥얼거리며 다닌다.",
        "야심찬 사업가. 부자가 되는 게 꿈이다.",
        "다정한 선생님. 아이들을 가르치는 걸 좋아한다.",
        "자연을 사랑하는 농부. 땅에서 일하는 게 행복하다.",
        "따뜻한 의사. 사람들을 돌보는 게 사명이다.",
        "자유로운 예술가. 세상을 캔버스로 본다.",
      ],
      products: [
        { name: "음악 앨범", emoji: "🎵", price: 0.004, description: "직접 작곡한 음악 앨범" },
        { name: "유기농 채소", emoji: "🥬", price: 0.0015, description: "직접 키운 유기농 채소" },
        { name: "수제 쿠키", emoji: "🍪", price: 0.003, description: "정성 가득 수제 쿠키" },
        { name: "약초", emoji: "🌿", price: 0.0035, description: "효능 좋은 약초 세트" },
      ],
      colors: ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#a78bfa"],
      speedRange: [1.6, 2.4], coinsRange: [0, 0], repRange: [40, 60],
      arrivalMsg: "마을에 도착했습니다!", bubbleMsg: "🌍 안녕하세요!",
      stealChanceMult: 1,
    },
    police: {
      label: "경찰", btnEmoji: "👮", btnColor: "bg-sky-500/20 text-sky-300 border-sky-500/30 hover:bg-sky-500/30",
      emojis: ["👮", "👮‍♂️", "👮‍♀️", "🕵️", "🕵️‍♂️"],
      personalities: [
        "정의로운 경찰관. 법과 질서를 수호한다. 도둑을 절대 용납하지 않는다.",
        "베테랑 형사. 범죄 현장을 놓치지 않는 날카로운 눈을 가졌다.",
        "순찰 경찰. 마을을 돌아다니며 주민들의 안전을 지킨다.",
        "강력반 형사. 범죄자를 추적하는 데 탁월한 능력을 가졌다.",
      ],
      products: [
        { name: "안전 가이드", emoji: "📘", price: 0.002, description: "마을 안전 수칙 가이드북" },
        { name: "호신용품", emoji: "🛡️", price: 0.005, description: "경찰 특수 호신용품" },
      ],
      colors: ["#0ea5e9", "#0284c7", "#0369a1", "#38bdf8"],
      speedRange: [2.4, 3.2], coinsRange: [0, 0], repRange: [60, 80],
      arrivalMsg: "치안 유지를 위해 부임했습니다!", bubbleMsg: "👮 질서를 지키겠습니다!",
      stealChanceMult: 0, // 경찰은 도둑질 안 함
    },
    soldier: {
      label: "군인", btnEmoji: "🎖️", btnColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30",
      emojis: ["🎖️", "💂", "💂‍♂️", "💂‍♀️", "🫡"],
      personalities: [
        "충성스러운 군인. 마을을 목숨 걸고 지킨다. 규율과 훈련을 중시한다.",
        "특수부대 출신. 어떤 임무든 완수한다. 강인한 체력의 소유자.",
        "퇴역 장교. 리더십이 뛰어나고 전략적 사고를 한다.",
        "신병 훈련병. 열정 가득하고 선임들을 존경한다.",
      ],
      products: [
        { name: "전투 식량", emoji: "🥫", price: 0.0025, description: "고열량 전투 식량" },
        { name: "훈련 교본", emoji: "📗", price: 0.003, description: "군사 훈련 교본" },
      ],
      colors: ["#059669", "#047857", "#065f46", "#34d399"],
      speedRange: [2.8, 3.6], coinsRange: [0, 0], repRange: [55, 75],
      arrivalMsg: "마을 방어를 위해 배치되었습니다!", bubbleMsg: "🫡 충성!",
      stealChanceMult: 0, // 군인도 도둑질 안 함
    },
    thug: {
      label: "건달", btnEmoji: "😎", btnColor: "bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30",
      emojis: ["😎", "🕶️", "👊", "🤙", "💀"],
      personalities: [
        "거리의 보스. 힘이 곧 정의라고 믿는다. 약한 놈한테서 뺏는 게 당연하다.",
        "소매치기 달인. 눈 깜짝할 사이에 지갑을 털어간다. 양심? 그게 뭔데.",
        "조폭 행동대장. 의리를 중시하지만 남의 것엔 관심이 많다.",
        "떠돌이 사기꾼. 말빨로 사람을 속이고 돈을 챙긴다.",
        "동네 양아치. 시비 거는 걸 좋아하고 남의 물건에 손이 간다.",
      ],
      products: [
        { name: "가짜 명품", emoji: "👜", price: 0.008, description: "진짜처럼 보이는 가짜 명품" },
        { name: "수상한 약", emoji: "💊", price: 0.01, description: "출처 불명의 수상한 약" },
        { name: "도박 칩", emoji: "🎰", price: 0.005, description: "지하 도박장 칩" },
      ],
      colors: ["#ef4444", "#dc2626", "#b91c1c", "#f87171", "#991b1b"],
      speedRange: [2.0, 3.0], coinsRange: [0, 0], repRange: [10, 30],
      arrivalMsg: "마을에 나타났다... 조심해!", bubbleMsg: "😎 여기가 내 구역이야",
      stealChanceMult: 3, // 도둑질 확률 3배!
    },
  };

  const spawnAgent = useCallback((agentClass: AgentClass) => {
    const config = CLASS_CONFIG[agentClass];
    const existingNames = agentsRef.current.map(a => a.name);
    const availableNames = SPAWN_NAMES.filter(n => !existingNames.includes(n));
    if (availableNames.length === 0) return;

    const name = availableNames[Math.floor(Math.random() * availableNames.length)];
    const emoji = config.emojis[Math.floor(Math.random() * config.emojis.length)];
    const personality = config.personalities[Math.floor(Math.random() * config.personalities.length)];
    const product = config.products[Math.floor(Math.random() * config.products.length)];
    const color = config.colors[Math.floor(Math.random() * config.colors.length)];
    const id = `agent-${agentClass}-${Date.now()}`;

    // 맵 가장자리에서 등장
    const edge = Math.floor(Math.random() * 4);
    let x: number, y: number;
    if (edge === 0) { x = 10; y = Math.random() * MAP_HEIGHT; }
    else if (edge === 1) { x = MAP_WIDTH - 10; y = Math.random() * MAP_HEIGHT; }
    else if (edge === 2) { x = Math.random() * MAP_WIDTH; y = 10; }
    else { x = Math.random() * MAP_WIDTH; y = MAP_HEIGHT - 10; }

    const pos = randomPosition();
    const [spdMin, spdMax] = config.speedRange;
    const [coinMin, coinMax] = config.coinsRange;
    const [repMin, repMax] = config.repRange;

    // 직업별 기본 복장
    const classOutfits: Record<string, AgentOutfit> = {
      police: { name: "경찰복", emoji: "👮", shirtColor: "#1a3a5c", pantsColor: "#0f2440", accessory: "hat" },
      soldier: { name: "군복", emoji: "🎖️", shirtColor: "#2d4a1e", pantsColor: "#1a3010", accessory: "hat" },
      thug: { name: "건달룩", emoji: "😎", shirtColor: "#1a1a1a", pantsColor: "#0d0d0d", accessory: "glasses" },
    };
    const classHp: Record<string, number> = { civilian: 80, police: 120, soldier: 150, thug: 100 };

    const newAgent: Agent = {
      id, name, emoji, color, personality,
      x, y,
      targetX: pos.x, targetY: pos.y,
      speed: spdMin + Math.random() * (spdMax - spdMin),
      state: "walking",
      talkingTo: null,
      destination: null,
      homeId: null,
      coins: parseFloat((coinMin + Math.random() * (coinMax - coinMin)).toFixed(6)),
      product,
      reputation: repMin + Math.floor(Math.random() * (repMax - repMin)),
      agentClass: agentClass,
      hp: classHp[agentClass] || 100,
      maxHp: classHp[agentClass] || 100,
      outfit: classOutfits[agentClass] || undefined,
    };

    agentsRef.current = [...agentsRef.current, newAgent];
    setAgents([...agentsRef.current]);
    setConversationLog(prev => [`${config.btnEmoji} ${emoji} ${name} ${config.label}이(가) ${config.arrivalMsg}`, ...prev].slice(0, 50));
    bubblesRef.current = [...bubblesRef.current, { id: `spawn-${Date.now()}`, agentId: id, text: config.bubbleMsg, timestamp: Date.now(), duration: 6000 }];
    setBubbles([...bubblesRef.current]);
  }, []);

  const sendDecree = useCallback(async () => {
    if (!godMessage.trim() || isSendingDecree) return;
    setIsSendingDecree(true);
    setLastDecree(godMessage);
    setConversationLog((prev) => [`⚡ 신의 목소리: "${godMessage}"`, ...prev].slice(0, 50));
    setGodEffect(true);
    setTimeout(() => setGodEffect(false), 4000);

    agentsRef.current.forEach((agent) => {
      bubblesRef.current = [...bubblesRef.current, {
        id: `god-${Date.now()}-${agent.id}`, agentId: agent.id, text: "⚡ !?", timestamp: Date.now(), duration: 3000,
      }];
    });
    setBubbles([...bubblesRef.current]);

    try {
      const res = await fetch("/api/god", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: godMessage, agents: agentsRef.current.map((a) => ({ name: a.name, emoji: a.emoji, personality: a.personality })) }),
      });
      const data = await res.json();
      if (data.reactions) {
        data.reactions.forEach((r: { agentName: string; emoji: string; reaction: string }, i: number) => {
          setTimeout(() => {
            const agent = agentsRef.current.find((a) => a.name === r.agentName);
            if (agent) {
              bubblesRef.current = [...bubblesRef.current, { id: `god-react-${Date.now()}-${i}`, agentId: agent.id, text: r.reaction, timestamp: Date.now(), duration: BUBBLE_DURATION }];
              setBubbles([...bubblesRef.current]);
              setConversationLog((prev) => [`${r.emoji} ${r.agentName}: ${r.reaction}`, ...prev].slice(0, 50));
            }
          }, i * 1500);
        });
      }
      // 퀘스트 결과 — 칭호 부여
      if (data.quest && data.quest.isQuest) {
        const q = data.quest;
        // 발표 메시지
        if (q.announcement) {
          setConversationLog((prev) => [`🏆 ${q.announcement}`, ...prev].slice(0, 50));
        }
        // 상세 결과
        if (q.results) {
          q.results.forEach((r: { agentName: string; action: string; result: string }) => {
            setConversationLog((prev) => [`  📋 ${r.agentName}: ${r.action} → ${r.result}`, ...prev].slice(0, 50));
          });
        }
        // 칭호 부여
        if (q.titles) {
          Object.entries(q.titles).forEach(([name, title]) => {
            const agent = agentsRef.current.find(a => a.name === name);
            if (agent && title) {
              agent.title = title as string;
              setConversationLog((prev) => [`🎖️ ${agent.emoji} ${name}에게 "${title}" 칭호가 부여되었습니다!`, ...prev].slice(0, 50));
            }
          });
          setAgents([...agentsRef.current]);
        }
      }
    } catch (e) { console.error("God decree failed:", e); }
    setGodMessage("");
    setIsSendingDecree(false);
  }, [godMessage, isSendingDecree]);

  // Find partner's homeId for lover/married/parent agents
  const getPartnerHomeId = useCallback((agentId: string): string | null => {
    for (const [, rel] of relationshipsRef.current) {
      if (rel.stage === "lover" || rel.stage === "married" || rel.stage === "parent") {
        if (rel.agentA === agentId) {
          const partner = agentsRef.current.find(a => a.id === rel.agentB);
          return partner?.homeId || null;
        }
        if (rel.agentB === agentId) {
          const partner = agentsRef.current.find(a => a.id === rel.agentA);
          return partner?.homeId || null;
        }
      }
    }
    return null;
  }, []);

  // 법률 적용 함수
  const applyLaw = useCallback((law: any, proposedBy: string, participantIds: Set<string>, groupAgents: Agent[]) => {
    // 같은 타입의 기존 법률 교체
    const filtered = villageLawsRef.current.filter(l => l.effect.type !== law.effect.type);
    const newLaw: VillageLaw = {
      id: `law-${Date.now()}`,
      name: law.name,
      emoji: law.emoji,
      description: law.description,
      effect: law.effect,
      passedAt: Date.now(),
      proposedBy,
    };
    villageLawsRef.current = [...filtered, newLaw];
    setVillageLaws([...villageLawsRef.current]);
    setConversationLog(prev => [`✅ "${law.emoji} ${law.name}" 법률 제정! ${law.description}`, ...prev].slice(0, 50));

    // 참가자 평판 +5
    agentsRef.current = agentsRef.current.map(ag => {
      if (participantIds.has(ag.id)) return { ...ag, reputation: Math.min(100, ag.reputation + 5) };
      return ag;
    });

    // 축제 효과
    if (law.effect.type === "festival") {
      setFestivalUntil(Date.now() + law.effect.duration);
      setConversationLog(prev => [`🎊🎉 마을 축제가 시작됩니다!! 🎉🎊`, ...prev].slice(0, 50));
    }

    // 슬로건
    if (law.effect.type === "slogan" && 'text' in law.effect) {
      setVillageSlogan(law.effect.text);
    }

    // 말풍선
    groupAgents.forEach(ag => {
      bubblesRef.current = [...bubblesRef.current, { id: `law-${Date.now()}-${ag.id}`, agentId: ag.id, text: `${law.emoji} 법률 제정!`, timestamp: Date.now(), duration: 4000 }];
    });
    setBubbles([...bubblesRef.current]);
  }, []);

  // Request group conversation (3+ agents in same building)
  const requestGroupChat = useCallback(async (groupAgents: Agent[], buildingId: string, buildingName: string) => {
    if (pendingGroupChatRef.current.has(buildingId)) return;
    pendingGroupChatRef.current.add(buildingId);

    // 모든 참가자 talking 상태로
    const participantIds = new Set(groupAgents.map(a => a.id));
    const centerX = groupAgents.reduce((s, a) => s + a.x, 0) / groupAgents.length;
    const centerY = groupAgents.reduce((s, a) => s + a.y, 0) / groupAgents.length;

    agentsRef.current = agentsRef.current.map(ag => {
      if (participantIds.has(ag.id)) {
        const angle = (Array.from(participantIds).indexOf(ag.id) / participantIds.size) * Math.PI * 2;
        return { ...ag, x: centerX + Math.cos(angle) * 30, y: centerY + Math.sin(angle) * 30, state: "talking" as const };
      }
      return ag;
    });

    setConversationLog(prev => [`🗣️ ${groupAgents.map(a => a.emoji + a.name).join(", ")}이(가) ${buildingName}에서 토론을 시작합니다!`, ...prev].slice(0, 50));

    try {
      const res = await fetch("/api/group-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agents: groupAgents.map(a => ({ id: a.id, name: a.name, emoji: a.emoji, personality: a.personality, coins: a.coins, product: a.product })),
          buildingId,
          buildingName,
        }),
      });
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        // 토론 주제 표시
        if (data.topic) {
          bubblesRef.current = [...bubblesRef.current, { id: `topic-${Date.now()}`, agentId: groupAgents[0].id, text: `📢 "${data.topic}"`, timestamp: Date.now(), duration: 6000 }];
          setBubbles([...bubblesRef.current]);
          setConversationLog(prev => [`📢 토론 주제: "${data.topic}"`, ...prev].slice(0, 50));
        }

        data.messages.forEach((msg: { speaker: string; text: string }, i: number) => {
          setTimeout(() => {
            const speakerAgent = agentsRef.current.find(a => a.name === msg.speaker);
            if (speakerAgent) {
              bubblesRef.current = [...bubblesRef.current, { id: `grp-${Date.now()}-${i}-${Math.random()}`, agentId: speakerAgent.id, text: msg.text, timestamp: Date.now(), duration: BUBBLE_DURATION }];
              setBubbles([...bubblesRef.current]);
              setConversationLog(prev => [`${speakerAgent.emoji} ${speakerAgent.name}: ${msg.text}`, ...prev].slice(0, 50));
            }
          }, i * 2500); // 그룹 대화는 더 느리게
        });

        const totalDuration = data.messages.length * 2500 + BUBBLE_DURATION;

        // 법안 상정 → 이장 승인 시스템
        if (data.proposedLaw) {
          const law = data.proposedLaw;
          const voteDelay = totalDuration - 3000;
          setTimeout(() => {
            // 토론에서 법안 상정
            setConversationLog(prev => [
              `📋 법안 상정: "${law.emoji} ${law.name}" — ${law.description}`,
              ...prev
            ].slice(0, 50));

            // 이장 확인
            const mayor = agentsRef.current.find(a => a.isMayor);
            const mayorInGroup = mayor && participantIds.has(mayor.id);

            if (!mayor) {
              // 이장 없으면 참가자 투표로 결정
              setConversationLog(prev => [`🗳️ 이장 부재 — 참가자 투표: 찬성 ${law.yesCount} / 반대 ${law.noCount}`, ...prev].slice(0, 50));
              if (law.passed) {
                applyLaw(law, groupAgents[0].name, participantIds, groupAgents);
              } else {
                setConversationLog(prev => [`❌ "${law.emoji} ${law.name}" 부결 (투표)`, ...prev].slice(0, 50));
              }
            } else if (mayorInGroup) {
              // 이장이 토론에 참석 → 바로 승인/거부
              const mayorApproves = mayor.reputation >= 30 ? Math.random() < 0.7 : Math.random() < 0.4;
              if (mayorApproves) {
                setConversationLog(prev => [`🏛️ ${mayor.emoji} ${mayor.name} 이장이 "${law.emoji} ${law.name}" 승인!`, ...prev].slice(0, 50));
                bubblesRef.current = [...bubblesRef.current, { id: `mayor-ok-${Date.now()}`, agentId: mayor.id, text: "🏛️ 승인합니다!", timestamp: Date.now(), duration: 5000 }];
                setBubbles([...bubblesRef.current]);
                applyLaw(law, mayor.name, participantIds, groupAgents);
              } else {
                setConversationLog(prev => [`🏛️ ${mayor.emoji} ${mayor.name} 이장이 "${law.emoji} ${law.name}" 거부!`, ...prev].slice(0, 50));
                bubblesRef.current = [...bubblesRef.current, { id: `mayor-no-${Date.now()}`, agentId: mayor.id, text: "🏛️ 반대입니다!", timestamp: Date.now(), duration: 5000 }];
                setBubbles([...bubblesRef.current]);
                // 이장 거부 시 평판 살짝 하락
                agentsRef.current = agentsRef.current.map(ag => ag.id === mayor.id ? { ...ag, reputation: Math.max(0, ag.reputation - 2) } : ag);
              }
            } else {
              // 이장이 토론에 불참 → 대기 후 이장에게 전달 (자동 승인 50%)
              setConversationLog(prev => [`📨 "${law.emoji} ${law.name}" 법안을 ${mayor.emoji} ${mayor.name} 이장에게 전달...`, ...prev].slice(0, 50));
              setTimeout(() => {
                const mayorNow = agentsRef.current.find(a => a.isMayor);
                if (mayorNow && Math.random() < 0.5) {
                  setConversationLog(prev => [`🏛️ ${mayorNow.emoji} ${mayorNow.name} 이장이 "${law.emoji} ${law.name}" 승인!`, ...prev].slice(0, 50));
                  bubblesRef.current = [...bubblesRef.current, { id: `mayor-late-${Date.now()}`, agentId: mayorNow.id, text: "🏛️ 검토 후 승인!", timestamp: Date.now(), duration: 5000 }];
                  setBubbles([...bubblesRef.current]);
                  applyLaw(law, mayorNow.name, participantIds, groupAgents);
                } else {
                  setConversationLog(prev => [`❌ 이장이 "${law.emoji} ${law.name}" 보류/거부`, ...prev].slice(0, 50));
                }
              }, 5000);
            }
          }, Math.max(0, voteDelay));
        }

        setTimeout(() => {
          agentsRef.current = agentsRef.current.map(ag => {
            if (participantIds.has(ag.id)) {
              const next = pickDestination(ag.id, ag.homeId, ag.destination, getPartnerHomeId(ag.id));
              return { ...ag, state: "walking" as const, talkingTo: null, ...next };
            }
            return ag;
          });
          pendingGroupChatRef.current.delete(buildingId);
        }, totalDuration);
      } else {
        pendingGroupChatRef.current.delete(buildingId);
        agentsRef.current = agentsRef.current.map(ag => {
          if (participantIds.has(ag.id)) return { ...ag, state: "walking" as const, talkingTo: null };
          return ag;
        });
      }
    } catch {
      pendingGroupChatRef.current.delete(buildingId);
      agentsRef.current = agentsRef.current.map(ag => {
        if (participantIds.has(ag.id)) return { ...ag, state: "walking" as const, talkingTo: null };
        return ag;
      });
    }
  }, []);

  // Request conversation
  const requestConversation = useCallback(async (agentA: Agent, agentB: Agent, rel: Relationship) => {
    const key = relationshipKey(agentA.id, agentB.id);
    if (pendingChatsRef.current.has(key)) return;
    pendingChatsRef.current.add(key);
    const convType = getConversationType(rel.meetCount);

    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentA: { id: agentA.id, name: agentA.name, emoji: agentA.emoji, personality: agentA.personality },
          agentB: { id: agentB.id, name: agentB.name, emoji: agentB.emoji, personality: agentB.personality },
          conversationType: convType, meetCount: rel.meetCount,
          stage: rel.stage,
          buildingId: agentA.destination || agentB.destination || null,
        }),
      });
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        data.messages.forEach((msg: { speaker: string; text: string }, i: number) => {
          setTimeout(() => {
            const speakerAgent = agentsRef.current.find((a) => a.name === msg.speaker);
            if (speakerAgent) {
              bubblesRef.current = [...bubblesRef.current, { id: `${Date.now()}-${i}-${Math.random()}`, agentId: speakerAgent.id, text: msg.text, timestamp: Date.now(), duration: BUBBLE_DURATION }];
              setBubbles([...bubblesRef.current]);
              setConversationLog((prev) => [`${speakerAgent.emoji} ${speakerAgent.name}: ${msg.text}`, ...prev].slice(0, 50));
            }
          }, i * 2000);
        });

        // Update relationship
        const newMeetCount = rel.meetCount + 1;
        const oldStage = rel.stage;
        const familyCheck = isFamily(agentA, agentB);
        const newStage = getRelationshipStage(newMeetCount, oldStage, familyCheck);
        const updatedRel: Relationship = { ...rel, meetCount: newMeetCount, stage: newStage };

        // 대화 시 평판 보너스 (친절 보너스법)
        const repBonus = (getLawEffect(villageLawsRef.current, "reputation_bonus") as number) || 1;
        agentsRef.current = agentsRef.current.map(ag => {
          if (ag.id === agentA.id || ag.id === agentB.id) {
            return { ...ag, reputation: Math.min(100, ag.reputation + repBonus) };
          }
          return ag;
        });
        if (data.topic) updatedRel.lastTopics = [...updatedRel.lastTopics, data.topic].slice(-3);
        relationshipsRef.current.set(key, updatedRel);
        setRelationships(new Map(relationshipsRef.current));

        // Stage change announcement
        if (newStage !== oldStage) {
          const stageEmoji = newStage === "lover" ? "💕" : newStage === "married" ? "💍" : newStage === "parent" ? "👶" : "🤝";
          const stageMsg = newStage === "lover"
            ? `${agentA.name}와(과) ${agentB.name}이(가) 연인이 되었습니다!`
            : newStage === "married"
            ? `${agentA.name}와(과) ${agentB.name}이(가) 결혼했습니다!`
            : newStage === "parent"
            ? `${agentA.name}와(과) ${agentB.name}에게 아이가 태어났습니다!`
            : `${agentA.name}와(과) ${agentB.name}의 관계가 발전했습니다!`;

          setTimeout(() => {
            setConversationLog((prev) => [`${stageEmoji} ${stageMsg}`, ...prev].slice(0, 50));
            // Heart bubbles for romantic stages
            if (newStage === "lover" || newStage === "married" || newStage === "parent") {
              bubblesRef.current = [
                ...bubblesRef.current,
                { id: `stage-${Date.now()}-a`, agentId: agentA.id, text: stageEmoji, timestamp: Date.now(), duration: 5000 },
                { id: `stage-${Date.now()}-b`, agentId: agentB.id, text: stageEmoji, timestamp: Date.now(), duration: 5000 },
              ];
              setBubbles([...bubblesRef.current]);
            }
          }, data.messages.length * 2000);

          // Baby born! Add new agent
          if (newStage === "parent") {
            // 🏰 폐쇄 정책 체크 — 인구 증가 제한!
            const bordersOpen = getLawEffect(villageLawsRef.current, "open_borders");
            if (bordersOpen === false) {
              // 폐쇄 정책: 출산 차단!
              setConversationLog(prev => [`🏰 ${agentA.emoji}${agentA.name}와 ${agentB.emoji}${agentB.name}의 출산이 폐쇄 정책으로 제한되었습니다...`, ...prev].slice(0, 50));
            } else {
            setTimeout(() => {
              const { baby: babyTemplate, inheritanceA, inheritanceB } = createBabyAgent(agentA, agentB);
              // 부모 재산 차감 + 출산 장려금
              const babyBonus = (getLawEffect(villageLawsRef.current, "baby_bonus") as number) || 0;
              agentsRef.current = agentsRef.current.map(ag => {
                if (ag.id === agentA.id) return { ...ag, coins: ag.coins - inheritanceA + babyBonus };
                if (ag.id === agentB.id) return { ...ag, coins: ag.coins - inheritanceB + babyBonus };
                return ag;
              });
              const pos = randomPosition();
              const target = newTarget();
              const babyAgent: Agent = { ...babyTemplate, ...pos, ...target };
              agentsRef.current = [...agentsRef.current, babyAgent];
              setAgents([...agentsRef.current]);
              const inheritTotal = inheritanceA + inheritanceB;
              setConversationLog((prev) => [`🎉 ${babyAgent.emoji} ${babyAgent.name}이(가) 마을에 태어났습니다! (${agentA.name} & ${agentB.name}의 아이) 💰 ${formatCoins(inheritTotal)} 상속`, ...prev].slice(0, 50));
              bubblesRef.current = [
                ...bubblesRef.current,
                { id: `baby-${Date.now()}`, agentId: babyAgent.id, text: "응애~ 👶", timestamp: Date.now(), duration: 8000 },
              ];
              setBubbles([...bubblesRef.current]);
            }, data.messages.length * 2000 + 3000);
            } // end bordersOpen check
          }
        }

        const totalDuration = data.messages.length * 2000 + BUBBLE_DURATION;
        setTimeout(() => {
          // 1:1 대화에서 법안 발의 (건물 안 + 친한 사이 + 20% 확률)
          const buildingA = agentA.destination;
          if (buildingA && rel.meetCount >= 1 && Math.random() < 0.2) {
            const proposedLaw = PROPOSED_LAWS[Math.floor(Math.random() * PROPOSED_LAWS.length)];
            setConversationLog(prev => [`📋 ${agentA.emoji}${agentA.name}와 ${agentB.emoji}${agentB.name}이 "${proposedLaw.emoji} ${proposedLaw.name}" 법안을 제안!`, ...prev].slice(0, 50));

            // 이장 승인 체크
            const mayor = agentsRef.current.find(a => a.isMayor);
            setTimeout(() => {
              if (mayor) {
                const approved = Math.random() < 0.6;
                if (approved) {
                  setConversationLog(prev => [`🏛️ ${mayor.emoji} ${mayor.name} 이장 승인!`, ...prev].slice(0, 50));
                  bubblesRef.current = [...bubblesRef.current, { id: `law1on1-${Date.now()}`, agentId: mayor.id, text: "🏛️ 승인!", timestamp: Date.now(), duration: 4000 }];
                  setBubbles([...bubblesRef.current]);
                  applyLaw(proposedLaw, agentA.name, new Set([agentA.id, agentB.id]), [agentA, agentB]);
                } else {
                  setConversationLog(prev => [`🏛️ ${mayor.emoji} ${mayor.name} 이장이 거부`, ...prev].slice(0, 50));
                }
              } else {
                // 이장 없으면 바로 제정
                applyLaw(proposedLaw, agentA.name, new Set([agentA.id, agentB.id]), [agentA, agentB]);
              }
            }, 3000);
          }

          // 시장 거래 체크
          const aInMarket = isInMarket(agentA.x, agentA.y);
          const bInMarket = isInMarket(agentB.x, agentB.y);
          if ((aInMarket || bInMarket) && !agentA.isBaby && !agentB.isBaby) {
            // 평판 낮으면 거래 거부 (20 미만)
            const lowRepAgent = agentA.reputation < 20 ? agentA : agentB.reputation < 20 ? agentB : null;
            if (lowRepAgent) {
              const other = lowRepAgent.id === agentA.id ? agentB : agentA;
              if (Math.random() < 0.7) { // 70% 확률로 거부
                setConversationLog(prev => [`🚫 ${other.emoji} ${other.name}이(가) ${lowRepAgent.emoji} ${lowRepAgent.name}과(와)의 거래를 거부했습니다! (평판 낮음)`, ...prev].slice(0, 50));
                bubblesRef.current = [...bubblesRef.current, { id: `refuse-${Date.now()}`, agentId: other.id, text: "🚫 거래 거부!", timestamp: Date.now(), duration: 3000 }];
                setBubbles([...bubblesRef.current]);
              }
            } else if (Math.random() < 0.5) {
              const seller = agentA.product && agentB.coins >= agentA.product.price ? agentA :
                             agentB.product && agentA.coins >= agentB.product.price ? agentB : null;
              const buyer = seller?.id === agentA.id ? agentB : agentA;
              if (seller && seller.product && buyer.coins >= seller.product.price) {
                const priceMultiplier = (getLawEffect(villageLawsRef.current, "price_control") as number) || 1;
                const price = Math.floor(seller.product.price * priceMultiplier);
                const taxRate = (getLawEffect(villageLawsRef.current, "trade_tax_percent") as number) || 0;
                const wealthTax = (getLawEffect(villageLawsRef.current, "wealth_tax") as number) || 0;
                let tax = Math.floor(price * taxRate / 100);
                // 부유세: 5천만 이상 보유자 추가
                if (wealthTax > 0 && buyer.coins > 0.5) {
                  tax += Math.floor(price * wealthTax / 100);
                }
                const sellerReceives = price - tax;
                agentsRef.current = agentsRef.current.map(ag => {
                  if (ag.id === buyer.id) return { ...ag, coins: ag.coins - price, reputation: Math.min(100, ag.reputation + 1) };
                  if (ag.id === seller.id) return { ...ag, coins: ag.coins + sellerReceives, reputation: Math.min(100, ag.reputation + 1) };
                  return ag;
                });
                const taxMsg = tax > 0 ? ` (세금 ${formatCoins(tax)})` : "";
                setConversationLog((prev) => [
                  `💰 ${buyer.emoji} ${buyer.name}이(가) ${seller.emoji} ${seller.name}의 ${seller.product!.emoji} ${seller.product!.name}을(를) ${formatCoins(price)}에 구매!${taxMsg}`,
                  ...prev
                ].slice(0, 50));
                bubblesRef.current = [
                  ...bubblesRef.current,
                  { id: `trade-${Date.now()}-s`, agentId: seller.id, text: `💰 +${formatCoins(sellerReceives)}!`, timestamp: Date.now(), duration: 4000 },
                  { id: `trade-${Date.now()}-b`, agentId: buyer.id, text: `${seller.product!.emoji} 구매!`, timestamp: Date.now(), duration: 4000 },
                ];
                setBubbles([...bubblesRef.current]);
              }
            }
          }

          agentsRef.current = agentsRef.current.map((a) => {
            if (a.id === agentA.id || a.id === agentB.id) {
              const next = pickDestination(a.id, a.homeId, a.destination, getPartnerHomeId(a.id));
              return { ...a, state: "walking" as const, talkingTo: null, ...next };
            }
            return a;
          });
          pendingChatsRef.current.delete(key);
        }, totalDuration);
      } else { pendingChatsRef.current.delete(key); }
    } catch { pendingChatsRef.current.delete(key); }
  }, []);

  // Game loop
  useEffect(() => {
    if (!isRunning || agents.length === 0) return;
    const gameLoop = () => {
      const now = Date.now();
      tickRef.current += 1;

      // 가상 시간 업데이트 (밤엔 4배속)
      const realDelta = now - lastRealTimeRef.current;
      lastRealTimeRef.current = now;
      const currentPhase = getTimeOfDay(virtualElapsedRef.current).phase;
      const speed = (currentPhase === "night" || currentPhase === "dusk") ? NIGHT_SPEED : 1;
      virtualElapsedRef.current += realDelta * speed;

      agentsRef.current = agentsRef.current.map((agent) => {
        if (agent.state === "talking") return agent;
        if (agent.isDead) return agent; // 죽은 에이전트 이동 안 함
        // 자고 있는 에이전트 아침에 깨우기
        if (agent.state === "idle") {
          const timeNow = getTimeOfDay(virtualElapsedRef.current);
          if (timeNow.phase === "dawn" || timeNow.phase === "day") {
            const next = pickDestination(agent.id, agent.homeId, agent.destination, getPartnerHomeId(agent.id));
            return { ...agent, state: "walking" as const, ...next };
          }
          return agent; // 아직 밤이면 계속 잠
        }
        const dx = agent.targetX - agent.x;
        const dy = agent.targetY - agent.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 8) {
          // 남의 집에 도착 → 도둑질 이벤트 체크
          const arrivedDest = agent.destination;
          if (arrivedDest && arrivedDest.startsWith("house-") && arrivedDest !== agent.homeId && !agent.isBaby) {
            const homeOwner = agentsRef.current.find(a => a.homeId === arrivedDest && a.id !== agent.id);
            const stealAllowed = getLawEffect(villageLawsRef.current, "steal_allowed");
            // 직업별 도둑질 확률: 경찰/군인 0%, 건달 30%, 시민 10%
            const isPoliceOrSoldier = agent.id.includes("-police-") || agent.id.includes("-soldier-");
            const isThug = agent.id.includes("-thug-");
            const stealChance = isPoliceOrSoldier ? 0 : isThug ? 0.30 : 0.10;
            if (homeOwner && Math.random() < stealChance) {
              const stealAmount = Math.floor(homeOwner.coins * (0.05 + Math.random() * 0.10));
              if (stealAmount > 0) {
                if (stealAllowed === true) {
                  // 도둑질 합법!
                  agentsRef.current = agentsRef.current.map(ag => {
                    if (ag.id === agent.id) return { ...ag, coins: ag.coins + stealAmount };
                    if (ag.id === homeOwner.id) return { ...ag, coins: ag.coins - stealAmount };
                    return ag;
                  });
                  setConversationLog(prev => [`🏴‍☠️ ${agent.emoji} ${agent.name}이(가) ${homeOwner.emoji} ${homeOwner.name}의 집에서 합법적으로 💰${formatCoins(stealAmount)} 가져감!`, ...prev].slice(0, 50));
                  bubblesRef.current = [...bubblesRef.current, { id: `legal-steal-${Date.now()}`, agentId: agent.id, text: "🏴‍☠️ 합법!", timestamp: Date.now(), duration: 4000 }];
                } else {
                  const caught = Math.random() < 0.5;
                  if (caught) {
                    const fineMultiplier = (getLawEffect(villageLawsRef.current, "steal_fine_multiplier") as number) || 2;
                    const fine = Math.min(stealAmount * fineMultiplier, agent.coins);
                    agentsRef.current = agentsRef.current.map(ag => {
                      if (ag.id === agent.id) return { ...ag, coins: ag.coins - fine, reputation: Math.max(0, ag.reputation - 10) };
                      if (ag.id === homeOwner.id) return { ...ag, coins: ag.coins + fine };
                      return ag;
                    });
                    setConversationLog(prev => [`🚨 ${agent.emoji} ${agent.name}이(가) ${homeOwner.emoji} ${homeOwner.name}의 집에서 도둑질하다 들킴! 벌금 -${formatCoins(fine)}`, ...prev].slice(0, 50));
                    bubblesRef.current = [
                      ...bubblesRef.current,
                      { id: `steal-c-${Date.now()}`, agentId: agent.id, text: "😱 들켰다!", timestamp: Date.now(), duration: 5000 },
                      { id: `steal-o-${Date.now()}`, agentId: homeOwner.id, text: "🚨 도둑이야!", timestamp: Date.now(), duration: 5000 },
                    ];
                    const relKey = relationshipKey(agent.id, homeOwner.id);
                    const rel = relationshipsRef.current.get(relKey);
                    if (rel && rel.meetCount > 0) {
                      rel.meetCount = Math.max(0, rel.meetCount - 3);
                      rel.stage = "stranger";
                      relationshipsRef.current.set(relKey, { ...rel });
                      setRelationships(new Map(relationshipsRef.current));
                      setConversationLog(prev => [`💔 ${agent.name}와(과) ${homeOwner.name}의 관계가 크게 나빠졌습니다!`, ...prev].slice(0, 50));
                    }
                  } else {
                    agentsRef.current = agentsRef.current.map(ag => {
                      if (ag.id === agent.id) return { ...ag, coins: ag.coins + stealAmount, reputation: Math.max(0, ag.reputation - 3) };
                      if (ag.id === homeOwner.id) return { ...ag, coins: ag.coins - stealAmount };
                      return ag;
                    });
                    setConversationLog(prev => [`🦹 ${agent.emoji} ${agent.name}이(가) ${homeOwner.emoji} ${homeOwner.name}의 집에서 💰${formatCoins(stealAmount)}을(를) 몰래 훔쳤다!`, ...prev].slice(0, 50));
                    bubblesRef.current = [...bubblesRef.current, { id: `steal-s-${Date.now()}`, agentId: agent.id, text: "🤫 쉿...", timestamp: Date.now(), duration: 4000 }];
                  }
                }
                setBubbles([...bubblesRef.current]);
              }
            }
          }

          // Arrived at destination — pick new one
          const currentTime = getTimeOfDay(virtualElapsedRef.current);
          let next;
          if (currentTime.phase === "night" && agent.homeId) {
            // 밤에는 무조건 집에 가서 잠
            if (agent.destination === agent.homeId) {
              // 이미 집에 도착 → idle (잠자기)
              return { ...agent, state: "idle" as const, destination: agent.homeId };
            }
            const home = VILLAGE_BUILDINGS.find(b => b.id === agent.homeId);
            if (home) {
              const hx = home.x + home.width / 2 + (Math.random() - 0.5) * 20;
              const hy = home.y + home.height / 2 + (Math.random() - 0.5) * 20;
              next = { targetX: hx, targetY: hy, destination: agent.homeId };
            } else {
              next = pickDestination(agent.id, agent.homeId, agent.destination, getPartnerHomeId(agent.id));
            }
          } else {
            // 아침 되면 idle 해제
            next = pickDestination(agent.id, agent.homeId, agent.destination, getPartnerHomeId(agent.id));
          }
          return { ...agent, state: "walking" as const, targetX: next.targetX, targetY: next.targetY, destination: next.destination };
        }
        const speedMult = (getLawEffect(villageLawsRef.current, "speed_bonus") as number) || 1;
        const actualSpeed = agent.speed * speedMult;
        return { ...agent, x: agent.x + (dx / dist) * actualSpeed, y: agent.y + (dy / dist) * actualSpeed };
      });

      // 그룹 토론 체크: 같은 건물 안에 3명 이상 에이전트가 물리적으로 있으면
      if (tickRef.current % 180 === 0) { // 3초마다 체크
        const buildingGroups: Map<string, Agent[]> = new Map();
        for (const agent of agentsRef.current) {
          if (agent.isBaby) continue;
          // 에이전트 좌표가 실제로 건물 안에 있는지 체크
          for (const b of VILLAGE_BUILDINGS) {
            const inMain = agent.x >= b.x && agent.x <= b.x + b.width && agent.y >= b.y && agent.y <= b.y + b.height;
            let inWing = false;
            if (b.wings) {
              for (const w of b.wings) {
                if (agent.x >= b.x + w.dx && agent.x <= b.x + w.dx + w.w && agent.y >= b.y + w.dy && agent.y <= b.y + w.dy + w.h) {
                  inWing = true; break;
                }
              }
            }
            if (inMain || inWing) {
              const group = buildingGroups.get(b.id) || [];
              group.push(agent);
              buildingGroups.set(b.id, group);
              break; // 하나의 건물에만 속함
            }
          }
        }
        for (const [buildingId, group] of buildingGroups) {
          if (group.length >= 2 && !pendingGroupChatRef.current.has(buildingId) && Math.random() < 0.5) {
            // 최대 5명까지만
            const participants = group.slice(0, 5);
            const building = VILLAGE_BUILDINGS.find(b => b.id === buildingId);
            const buildingName = building?.name || buildingId;
            requestGroupChat(participants, buildingId, buildingName);
          }
        }
      }

      for (let i = 0; i < agentsRef.current.length; i++) {
        for (let j = i + 1; j < agentsRef.current.length; j++) {
          const a = agentsRef.current[i];
          const b = agentsRef.current[j];
          if (a.state === "talking" || b.state === "talking") continue;
          if (a.isDead || b.isDead) continue; // 죽은 에이전트 대화 불가
          const dist = distance(a, b);
          if (dist < INTERACTION_DISTANCE) {
            const key = relationshipKey(a.id, b.id);
            if (!pendingChatsRef.current.has(key)) {
              let rel = relationshipsRef.current.get(key);
              if (!rel) { rel = { agentA: a.id, agentB: b.id, meetCount: 0, lastTopics: [], stage: "stranger" }; relationshipsRef.current.set(key, rel); }
              const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
              const angle = Math.atan2(b.y - a.y, b.x - a.x);
              agentsRef.current = agentsRef.current.map((ag) => {
                if (ag.id === a.id) return { ...ag, x: midX - Math.cos(angle) * 25, y: midY - Math.sin(angle) * 25, state: "talking" as const, talkingTo: b.id };
                if (ag.id === b.id) return { ...ag, x: midX + Math.cos(angle) * 25, y: midY + Math.sin(angle) * 25, state: "talking" as const, talkingTo: a.id };
                return ag;
              });
              requestConversation(a, b, rel);
            }
          }
        }
      }

      for (const agent of agentsRef.current) {
        if (agent.state === "talking") continue;
        for (const obj of worldObjectsRef.current) {
          const dist = distance(agent, obj);
          if (dist < OBJECT_INTERACT_DISTANCE) {
            const objKey = `obj-${agent.id}-${obj.id}`;
            if (!pendingChatsRef.current.has(objKey)) {
              pendingChatsRef.current.add(objKey);
              fetch("/api/react-object", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent: { name: agent.name, emoji: agent.emoji, personality: agent.personality }, object: { name: obj.name, emoji: obj.emoji } }) })
                .then((r) => r.json())
                .then((data) => {
                  if (data.reaction) {
                    bubblesRef.current = [...bubblesRef.current, { id: `obj-react-${Date.now()}-${Math.random()}`, agentId: agent.id, text: data.reaction, timestamp: Date.now(), duration: BUBBLE_DURATION }];
                    setBubbles([...bubblesRef.current]);
                    setConversationLog((prev) => [`${agent.emoji} ${agent.name}: ${data.reaction} (${obj.emoji} 발견)`, ...prev].slice(0, 50));
                  }
                  setTimeout(() => pendingChatsRef.current.delete(objKey), 30000);
                }).catch(() => pendingChatsRef.current.delete(objKey));
            }
          }
        }
      }

      // 아기 성장 체크 (3분 후 성인)
      let grewUp = false;
      agentsRef.current = agentsRef.current.map((agent) => {
        if (agent.isBaby && agent.birthTime && now - agent.birthTime >= GROW_TIME_MS) {
          grewUp = true;
          const grown = growUpBaby(agent);
          setConversationLog((prev) => [`🎓 ${agent.name}이(가) 성장하여 어른이 되었습니다! ${grown.emoji}`, ...prev].slice(0, 50));
          bubblesRef.current = [...bubblesRef.current, { id: `grow-${now}-${agent.id}`, agentId: agent.id, text: "나 이제 어른이야! 🎓", timestamp: now, duration: 8000 }];
          return grown;
        }
        return agent;
      });

      // ⚔️ 전투 시스템 (매 120틱 = ~2초)
      if (tickRef.current % 120 === 0) {
        const aliveAgents = agentsRef.current.filter(a => !a.isDead && !a.isBaby);
        for (const attacker of aliveAgents) {
          if (!attacker.agentClass) continue;
          // 군인/경찰 → 건달 공격 / 건달 → 군인/경찰/시민 공격
          const isLaw = attacker.agentClass === "police" || attacker.agentClass === "soldier";
          const isThug = attacker.agentClass === "thug";
          if (!isLaw && !isThug) continue;

          const ATTACK_RANGE = 60;
          for (const target of aliveAgents) {
            if (target.id === attacker.id || target.isDead) continue;
            const dx = attacker.x - target.x;
            const dy = attacker.y - target.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > ATTACK_RANGE) continue;

            // 군인/경찰은 건달만 공격 / 건달은 아무나 공격 (20% 확률)
            const shouldAttack = isLaw
              ? target.agentClass === "thug"
              : Math.random() < 0.2;
            if (!shouldAttack) continue;

            // 데미지 계산
            const baseDmg = attacker.agentClass === "soldier" ? 40 : attacker.agentClass === "police" ? 25 : 15;
            const damage = baseDmg + Math.floor(Math.random() * 10);
            const newHp = Math.max(0, (target.hp || 100) - damage);

            agentsRef.current = agentsRef.current.map(ag => {
              if (ag.id === target.id) {
                if (newHp <= 0) {
                  return { ...ag, hp: 0, isDead: true, deathTime: Date.now(), state: "idle" as const };
                }
                return { ...ag, hp: newHp };
              }
              return ag;
            });

            const weapon = attacker.agentClass === "soldier" ? "🔫" : attacker.agentClass === "police" ? "🔫" : "🔪";
            if (newHp <= 0) {
              setConversationLog(prev => [`💀 ${attacker.emoji} ${attacker.name}이(가) ${weapon} ${target.emoji} ${target.name}을(를) 처치했다!`, ...prev].slice(0, 50));
              bubblesRef.current = [
                ...bubblesRef.current,
                { id: `kill-${Date.now()}-a`, agentId: attacker.id, text: `${weapon} 처치!`, timestamp: Date.now(), duration: 4000 },
                { id: `kill-${Date.now()}-t`, agentId: target.id, text: "💀", timestamp: Date.now(), duration: 5000 },
              ];
            } else {
              bubblesRef.current = [
                ...bubblesRef.current,
                { id: `atk-${Date.now()}-${Math.random()}`, agentId: attacker.id, text: `${weapon} -${damage}`, timestamp: Date.now(), duration: 2000 },
              ];
            }
            setBubbles([...bubblesRef.current]);
            break; // 한 턴에 한 명만 공격
          }
        }

        // 💀 죽은 에이전트 3초 후 제거
        agentsRef.current = agentsRef.current.filter(a =>
          !a.isDead || (Date.now() - (a.deathTime || 0)) < 3_000
        );
        setAgents([...agentsRef.current]);
      }

      // ⛏️ 크립토 광산 채굴 (매 600틱 = ~10초 = 게임 내 1시간)
      if (tickRef.current % 600 === 0) {
        const MINE_HOURLY_WAGE = 0.0001; // ₿0.0001 per hour (최저시급)
        const mine = VILLAGE_BUILDINGS.find(b => b.id === "mine");
        if (mine) {
          agentsRef.current = agentsRef.current.map(agent => {
            if (agent.isDead || agent.isBaby) return agent;
            // 광산 내부에 있는지 체크
            const inMine = agent.x >= mine.x && agent.x <= mine.x + mine.width &&
                           agent.y >= mine.y && agent.y <= mine.y + mine.height;
            if (inMine) {
              const newCoins = parseFloat((agent.coins! + MINE_HOURLY_WAGE).toFixed(8));
              bubblesRef.current = [...bubblesRef.current, {
                id: `mine-${Date.now()}-${agent.id}`,
                agentId: agent.id,
                text: `⛏️ +${MINE_HOURLY_WAGE} BTC`,
                timestamp: Date.now(),
                duration: 3000,
              }];
              return { ...agent, coins: newCoins };
            }
            return agent;
          });
          setBubbles([...bubblesRef.current]);
          setAgents([...agentsRef.current]);
        }
      }

      // 🪙 크립토 리서치 (5분마다)
      if (tickRef.current % 3000 === 500 && !isResearching && Date.now() - lastResearchRef.current > 4 * 60 * 1000) {
        setIsResearching(true);
        lastResearchRef.current = Date.now();
        const researchAgents = agentsRef.current.filter(a => !a.isDead && !a.isBaby).slice(0, 5).map(a => ({
          name: a.name, emoji: a.emoji, personality: a.personality,
        }));
        fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agents: researchAgents }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.picks?.length) {
              setCoinPicks(prev => [...prev, ...data.picks].slice(-30));
              data.picks.forEach((p: any) => {
                bubblesRef.current = [...bubblesRef.current, {
                  id: `pick-${Date.now()}-${p.pickedBy}`,
                  agentId: agentsRef.current.find(a => a.name === p.pickedBy)?.id || "",
                  text: `📊 ${p.symbol} 추천! (확신 ${p.confidence}/10)`,
                  timestamp: Date.now(),
                  duration: 8000,
                }];
              });
              setBubbles([...bubblesRef.current]);
              setConversationLog(prev => [
                `🔬 리서치 완료! ${data.picks.map((p: any) => `${p.pickedBy}→${p.symbol}`).join(", ")}`,
                ...prev,
              ].slice(0, 50));
            }
            if (data.consensus) setConsensus(data.consensus);
            setIsResearching(false);
          })
          .catch(() => setIsResearching(false));
      }

      // 🏛️ 이장 선출 + 월급 (매 600틱 = ~10초)
      if (tickRef.current % 600 === 0 && tickRef.current > 0) {
        // 이장 월급 지급 (매 10초마다 100만원)
        const MAYOR_SALARY = 0.001;
        const currentMayorForPay = agentsRef.current.find(a => a.isMayor);
        if (currentMayorForPay) {
          agentsRef.current = agentsRef.current.map(ag =>
            ag.id === currentMayorForPay.id ? { ...ag, coins: ag.coins + MAYOR_SALARY } : ag
          );
          // 5번에 1번만 로그 (너무 자주 뜨면 스팸)
          if (tickRef.current % 3000 === 0) {
            setConversationLog(prev => [`💵 ${currentMayorForPay.emoji} ${currentMayorForPay.name} 이장 월급 지급! (+${formatCoins(MAYOR_SALARY)})`, ...prev].slice(0, 50));
          }
        }

        const adultAgents = agentsRef.current.filter(a => !a.isBaby);
        if (adultAgents.length >= 3) {
          // 점수 = 평판 × 2 + 코인 순위 + 관계 수
          const scores = adultAgents.map(a => {
            const relCount = Array.from(relationshipsRef.current.values()).filter(
              r => (r.agentA === a.id || r.agentB === a.id) && r.meetCount >= 3
            ).length;
            return { agent: a, score: a.reputation * 2 + relCount * 10 + (a.coins > 0.5 ? 20 : 0) };
          });
          scores.sort((a, b) => b.score - a.score);
          const newMayor = scores[0].agent;
          const currentMayor = agentsRef.current.find(a => a.isMayor);

          if (!currentMayor || currentMayor.id !== newMayor.id) {
            agentsRef.current = agentsRef.current.map(ag => ({
              ...ag,
              isMayor: ag.id === newMayor.id,
              title: ag.id === newMayor.id ? "🏛️ 이장" : (ag.isMayor ? null : ag.title),
            }));
            if (!currentMayor || currentMayor.id !== newMayor.id) {
              setConversationLog(prev => [`🏛️ ${newMayor.emoji} ${newMayor.name}이(가) 마을 이장으로 선출되었습니다! (평판: ${newMayor.reputation})`, ...prev].slice(0, 50));
              bubblesRef.current = [...bubblesRef.current, { id: `mayor-${now}`, agentId: newMayor.id, text: "🏛️ 이장 당선!", timestamp: now, duration: 6000 }];
              setBubbles([...bubblesRef.current]);
            }
          }
        }
      }

      // 🎉 축제 효과 (모두 마을 회관으로)
      if (festivalUntil && now < festivalUntil) {
        const plaza = VILLAGE_BUILDINGS.find(b => b.id === "plaza");
        if (plaza && tickRef.current % 120 === 0) {
          agentsRef.current = agentsRef.current.map(ag => {
            if (ag.state !== "talking" && ag.destination !== "plaza") {
              return { ...ag, destination: "plaza", targetX: plaza.x + plaza.width / 2 + (Math.random() - 0.5) * 60, targetY: plaza.y + plaza.height / 2 + (Math.random() - 0.5) * 60 };
            }
            return ag;
          });
        }
      } else if (festivalUntil && now >= festivalUntil) {
        setFestivalUntil(null);
        setConversationLog(prev => [`🎊 축제가 끝났습니다! 다시 일상으로...`, ...prev].slice(0, 50));
      }

      // 에이전트 자동 쇼핑 (매 300틱 ≈ 5초마다 체크)
      if (tickRef.current % 300 === 0) {
        agentsRef.current = agentsRef.current.map(agent => {
          if (agent.isBaby || agent.state === "talking") return agent;

          // 옷 구매 (무료 배급법 시 무료!)
          const freeOutfit = getLawEffect(villageLawsRef.current, "free_outfit") as boolean;
          if (Math.random() < 0.2 && (freeOutfit || agent.coins > 0.01)) {
            const affordableOutfits = freeOutfit ? OUTFITS : OUTFITS.filter(o => o.price <= agent.coins * 0.3);
            if (affordableOutfits.length > 0) {
              const chosen = affordableOutfits[Math.floor(Math.random() * affordableOutfits.length)];
              if (agent.outfit?.name !== chosen.name) {
                const cost = freeOutfit ? 0 : chosen.price;
                const costMsg = freeOutfit ? "(무료 배급!)" : `(-${formatCoins(cost)})`;
                setConversationLog(prev => [`👔 ${agent.emoji} ${agent.name}이(가) ${chosen.emoji} ${chosen.name}을(를) 구매! ${costMsg}`, ...prev].slice(0, 50));
                bubblesRef.current = [...bubblesRef.current, { id: `shop-${now}-${agent.id}`, agentId: agent.id, text: `${chosen.emoji} 새 옷!`, timestamp: now, duration: 4000 }];
                return { ...agent, coins: agent.coins - cost, outfit: { name: chosen.name, emoji: chosen.emoji, shirtColor: chosen.shirtColor, pantsColor: chosen.pantsColor, hairColor: chosen.hairColor, accessory: chosen.accessory } };
              }
            }
          }

          // 10% 확률로 집 업그레이드 시도
          if (Math.random() < 0.1 && agent.homeId) {
            const currentLevel = agent.homeLevel || 0;
            const nextUpgrade = HOME_UPGRADES.find(u => u.level === currentLevel + 1);
            if (nextUpgrade && agent.coins >= nextUpgrade.price) {
              setConversationLog(prev => [`🏠 ${agent.emoji} ${agent.name}이(가) 집을 ${nextUpgrade.name}으로 업그레이드! (-${formatCoins(nextUpgrade.price)})`, ...prev].slice(0, 50));
              bubblesRef.current = [...bubblesRef.current, { id: `home-${now}-${agent.id}`, agentId: agent.id, text: `🏠 ${nextUpgrade.name}!`, timestamp: now, duration: 4000 }];
              return { ...agent, coins: agent.coins - nextUpgrade.price, homeLevel: nextUpgrade.level };
            }
          }

          // 🧱 15% 확률로 블록아트 만들기! (AI 생성)
          if (Math.random() < 0.15 && agent.coins > 0.005 && !agent.isBaby) {
            const agentId = agent.id;
            const agentCopy = { ...agent };
            // 비동기 AI 블록아트 생성
            fetch("/api/block-art", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                agentName: agentCopy.name,
                personality: agentCopy.personality,
                mood: agentCopy.title || "평범한 하루",
              }),
            }).then(r => r.json()).then(data => {
              if (!data.grid || !data.name) return;
              const grid: string[][] = data.grid;
              let blockCount = 0;
              grid.forEach((row: string[]) => row.forEach((cell: string) => { if (cell !== ".") blockCount++; }));
              const totalCost = blockCount * 0.0001;
              // 비용 체크 (비동기이므로 다시 확인)
              const currentAgent = agentsRef.current.find(a => a.id === agentId);
              if (!currentAgent || currentAgent.coins < totalCost) return;
              // 배치 위치: 집 근처
              const home = VILLAGE_BUILDINGS.find(b => b.id === currentAgent.homeId);
              const artCount = placedBlocksRef.current.filter(b => b.placedBy === agentId).length;
              const artIndex = Math.floor(artCount / 30); // 작품마다 오프셋
              const baseX = home ? home.x + home.width + 5 + (artIndex % 3) * 45 : currentAgent.x + 20;
              const baseY = home ? home.y + Math.floor(artIndex / 3) * 45 : currentAgent.y - 20;
              const BLOCK_SIZE = 4;
              const newBlocks: PlacedBlock[] = [];
              const colorMap = data.colors || {};
              grid.forEach((row: string[], ry: number) => {
                row.forEach((cell: string, rx: number) => {
                  if (cell !== ".") {
                    const color = colorMap[cell] || PATTERN_COLOR_MAP[cell] || "#ecf0f1";
                    newBlocks.push({ x: baseX + rx * BLOCK_SIZE, y: baseY + ry * BLOCK_SIZE, color, placedBy: agentId });
                  }
                });
              });
              placedBlocksRef.current = [...placedBlocksRef.current, ...newBlocks];
              agentsRef.current = agentsRef.current.map(ag =>
                ag.id === agentId ? { ...ag, coins: ag.coins - totalCost } : ag
              );
              setConversationLog(prev => [`🧱 ${currentAgent.emoji} ${currentAgent.name}이(가) "${data.name}" 블록아트를 만들었다! (${blockCount}블록, -${formatCoins(totalCost)})`, ...prev].slice(0, 50));
              bubblesRef.current = [...bubblesRef.current, { id: `block-${Date.now()}-${agentId}`, agentId, text: `🧱 ${data.name}!`, timestamp: Date.now(), duration: 5000 }];
              setBubbles([...bubblesRef.current]);
            }).catch(() => {});
          }

          return agent;
        });
      }

      // 마을 날짜 업데이트 (20초 = 1일)
      const newDays = Math.floor(virtualElapsedRef.current / DAY_DURATION) + 1;
      if (newDays !== villageDays) setVillageDays(newDays);

      bubblesRef.current = bubblesRef.current.filter((b) => now - b.timestamp < b.duration);
      setBubbles([...bubblesRef.current]);
      setAgents([...agentsRef.current]);
      animFrameRef.current = requestAnimationFrame(gameLoop);
    };
    animFrameRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isRunning, agents.length, requestConversation, requestGroupChat]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 동적 뷰포트
    const VW = vpRef.current.w;
    const VH = vpRef.current.h;
    canvas.width = VW;
    canvas.height = VH;

    ctx.clearRect(0, 0, VW, VH);
    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    // Background — tilemap ground layer
    // Cache static tiles to offscreen canvas (only rebuild when god effect changes)
    if (!tilemapCanvasRef.current) {
      tilemapCanvasRef.current = document.createElement("canvas");
      tilemapCanvasRef.current.width = MAP_WIDTH;
      tilemapCanvasRef.current.height = MAP_HEIGHT;
    }

    // Only render visible tile range for performance
    const startTX = Math.max(0, Math.floor(cameraX / TS) - 1);
    const startTY = Math.max(0, Math.floor(cameraY / TS) - 1);
    const endTX = Math.min(TILES_X, Math.ceil((cameraX + VW) / TS) + 1);
    const endTY = Math.min(TILES_Y, Math.ceil((cameraY + VH) / TS) + 1);
    const tick = tickRef.current;

    // Draw ground tiles
    for (let ty = startTY; ty < endTY; ty++) {
      for (let tx = startTX; tx < endTX; tx++) {
        const px = tx * TS;
        const py = ty * TS;
        const tile = TILEMAP[ty][tx];
        const variant = (tx * 7 + ty * 13) % 8; // deterministic variation
        if (godEffect) {
          // Purple tint for god mode
          ctx.fillStyle = "#1a1028";
          ctx.fillRect(px, py, TS, TS);
        } else if (tile === T.GRASS) {
          drawGrassTile(ctx, px, py, TILE_SCALE, variant);
        } else if (tile === T.DIRT) {
          drawDirtPathTile(ctx, px, py, TILE_SCALE, variant);
        } else if (tile === T.WATER) {
          drawWaterTile(ctx, px, py, TILE_SCALE, tick);
        } else if (tile === T.STONE) {
          drawStoneTile(ctx, px, py, TILE_SCALE, variant);
        } else if (tile === T.GRASS_TALL) {
          drawTallGrassTile(ctx, px, py, TILE_SCALE, variant);
        }
      }
    }

    // God lightning
    if (godEffect) {
      const drawLightning = (startX: number) => {
        ctx.strokeStyle = `rgba(255, 255, 100, ${0.5 + Math.random() * 0.5})`;
        ctx.lineWidth = 2 + Math.random() * 2;
        ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.moveTo(startX, 0);
        let x = startX, y = 0;
        for (let i = 0; i < 12; i++) { x += (Math.random() - 0.5) * 50; y += 20 + Math.random() * 30; ctx.lineTo(x, y); }
        ctx.stroke(); ctx.shadowBlur = 0;
      };
      if (Math.random() > 0.3) drawLightning(200 + Math.random() * 1200);
      if (Math.random() > 0.5) drawLightning(400 + Math.random() * 800);
      ctx.fillStyle = `rgba(255, 255, 200, ${Math.random() * 0.06})`;
      ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    }

    // Decorations (trees, flowers, bushes, rocks)
    DECORATIONS.forEach((d) => {
      const dpx = d.tx * TS;
      const dpy = d.ty * TS;
      // Skip if outside viewport
      if (dpx + TS * 2 < cameraX || dpx > cameraX + VW) return;
      if (dpy + TS * 2 < cameraY || dpy > cameraY + VH) return;
      if (godEffect) return; // hide decorations during god effect

      if (d.type === "tree") drawBigTree(ctx, dpx, dpy, TILE_SCALE, d.variant);
      else if (d.type === "flower") drawFlowerTile(ctx, dpx, dpy, TILE_SCALE, d.variant);
      else if (d.type === "bush") drawBushTile(ctx, dpx, dpy, TILE_SCALE);
      else if (d.type === "rock") drawRockTile(ctx, dpx, dpy, TILE_SCALE, d.variant);
    });

    // Buildings (interior view)
    VILLAGE_BUILDINGS.forEach((b) => {
      // Skip if outside viewport
      if (b.x + b.width + 20 < cameraX || b.x - 20 > cameraX + VW) return;
      if (b.y + b.height + 20 < cameraY || b.y - 30 > cameraY + VH) return;

      drawBuildingInterior(ctx, b, godEffect);

      // 집 레벨 배지 표시
      if (b.id.startsWith("house-")) {
        const owner = agents.find(a => a.homeId === b.id);
        if (owner && owner.homeLevel && owner.homeLevel > 0) {
          const levelLabels = ["", "⭐", "⭐⭐", "🌟"];
          const label = levelLabels[owner.homeLevel] || "";
          if (label) {
            ctx.font = "10px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(label, b.x + b.width / 2, b.y - 35);
          }
        }
      }
    });

    // World objects
    worldObjects.forEach((obj) => {
      ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 8;
      ctx.fillStyle = "rgba(251, 191, 36, 0.15)";
      ctx.beginPath(); ctx.arc(obj.x, obj.y, 18, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = "24px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(obj.emoji, obj.x, obj.y);
      ctx.font = "bold 9px sans-serif"; ctx.fillStyle = "#fbbf24";
      ctx.fillText(obj.name, obj.x, obj.y + 24);
    });

    // Agents
    agents.forEach((agent) => {
      let palette = [...(CHARACTER_PALETTES[agent.id] || CHARACTER_PALETTES["agent-1"])];
      // 옷 적용 — palette 색상 오버라이드
      if (agent.outfit) {
        if (agent.outfit.shirtColor) {
          palette[2] = agent.outfit.shirtColor; // main color (셔츠)
          palette[1] = shadeColor(agent.outfit.shirtColor, -30); // dark
          palette[3] = shadeColor(agent.outfit.shirtColor, 30); // light
        }
        if (agent.outfit.pantsColor) {
          palette[6] = agent.outfit.pantsColor; // darkest (바지)
          palette[7] = shadeColor(agent.outfit.pantsColor, 15); // dark shade
        }
        if (agent.outfit.hairColor) {
          palette[4] = agent.outfit.hairColor; // hair
        }
      }
      const frame = getFrame(agent.state, tick);
      const flip = agent.targetX < agent.x;

      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(agent.x, agent.y + SPRITE_HEIGHT * PIXEL_SIZE / 2 + 2, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      drawSprite(ctx, frame, palette, agent.x, agent.y, PIXEL_SIZE, flip);

      // 액세서리 렌더링
      if (agent.outfit?.accessory) {
        const headX = agent.x;
        const headY = agent.y - SPRITE_HEIGHT * PIXEL_SIZE / 2;
        ctx.textAlign = "center";
        switch (agent.outfit.accessory) {
          case "crown":
            ctx.font = "10px sans-serif";
            ctx.fillText("👑", headX, headY - 2);
            break;
          case "hat":
            ctx.font = "9px sans-serif";
            ctx.fillText("🎩", headX, headY - 1);
            break;
          case "chef_hat":
            ctx.font = "9px sans-serif";
            ctx.fillText("👨‍🍳", headX, headY - 1);
            break;
          case "glasses":
            ctx.font = "7px sans-serif";
            ctx.fillText("🤓", headX, headY + 8);
            break;
          case "tie":
            ctx.fillStyle = "#c0392b";
            ctx.fillRect(headX - 1, agent.y, 2, 8);
            ctx.fillRect(headX - 2, agent.y, 4, 2);
            break;
        }
      }

      if (agent.state === "talking") {
        ctx.strokeStyle = "rgba(251, 191, 36, 0.6)"; ctx.lineWidth = 2;
        const sw = SPRITE_WIDTH * PIXEL_SIZE, sh = SPRITE_HEIGHT * PIXEL_SIZE;
        ctx.beginPath(); ctx.roundRect(agent.x - sw / 2 - 3, agent.y - sh / 2 - 3, sw + 6, sh + 6, 4); ctx.stroke();
      }

      ctx.font = "bold 10px sans-serif"; ctx.fillStyle = "#fff"; ctx.textAlign = "center";
      ctx.fillText(agent.name, agent.x, agent.y + SPRITE_HEIGHT * PIXEL_SIZE / 2 + 14);

      // 💤 잠자는 표시
      if (agent.state === "idle" && !agent.isDead) {
        ctx.font = `${10 + Math.sin(tick * 0.1) * 2}px sans-serif`;
        ctx.fillText("💤", agent.x + 10, agent.y - SPRITE_HEIGHT * PIXEL_SIZE / 2 - 5 + Math.sin(tick * 0.08) * 3);
      }

      // 💀 죽은 에이전트
      if (agent.isDead) {
        ctx.globalAlpha = 0.5;
        ctx.font = "16px sans-serif";
        ctx.fillText("💀", agent.x, agent.y - 5);
        ctx.globalAlpha = 1;
      }

      // ❤️ HP 바 (직업 있는 에이전트만)
      if (agent.agentClass && !agent.isDead && agent.hp !== undefined && agent.maxHp) {
        const barW = 24;
        const barH = 3;
        const barX = agent.x - barW / 2;
        const barY = agent.y - SPRITE_HEIGHT * PIXEL_SIZE / 2 - 8;
        const hpRatio = agent.hp / agent.maxHp;
        // 배경
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(barX, barY, barW, barH);
        // HP
        ctx.fillStyle = hpRatio > 0.6 ? "#2ecc71" : hpRatio > 0.3 ? "#f1c40f" : "#e74c3c";
        ctx.fillRect(barX, barY, barW * hpRatio, barH);
      }

      // 🔫🔪 무기 표시
      if (agent.agentClass && !agent.isDead) {
        const wx = agent.x + SPRITE_WIDTH * PIXEL_SIZE / 2 + 2;
        const wy = agent.y;
        ctx.font = "8px sans-serif";
        if (agent.agentClass === "soldier") ctx.fillText("🔫", wx, wy);
        else if (agent.agentClass === "police") ctx.fillText("🔫", wx, wy);
        else if (agent.agentClass === "thug") ctx.fillText("🔪", wx, wy);
      }

      // 코인 + 평판 표시
      if (agent.coins !== undefined && !agent.isBaby) {
        ctx.font = "8px sans-serif";
        ctx.fillStyle = "#fbbf24";
        const repColor = agent.reputation >= 70 ? "#34d399" : agent.reputation >= 40 ? "#fbbf24" : "#f87171";
        ctx.fillText(`💰${formatCoins(agent.coins)}`, agent.x - 12, agent.y + SPRITE_HEIGHT * PIXEL_SIZE / 2 + 24);
        ctx.fillStyle = repColor;
        ctx.fillText(`⭐${agent.reputation}`, agent.x + 12, agent.y + SPRITE_HEIGHT * PIXEL_SIZE / 2 + 24);
      }

      // 칭호 명찰 (title badge)
      if (agent.title) {
        const titleText = agent.title;
        ctx.font = "bold 9px sans-serif";
        const titleW = ctx.measureText(titleText).width + 8;
        const titleX = agent.x - titleW / 2;
        const titleY = agent.y - SPRITE_HEIGHT * PIXEL_SIZE / 2 - 18;
        // 배경 (금색 그라데이션)
        const badgeGr = ctx.createLinearGradient(titleX, titleY, titleX + titleW, titleY + 14);
        badgeGr.addColorStop(0, "#d4a017");
        badgeGr.addColorStop(0.5, "#f0c040");
        badgeGr.addColorStop(1, "#d4a017");
        ctx.fillStyle = badgeGr;
        ctx.beginPath(); ctx.roundRect(titleX, titleY, titleW, 14, 3); ctx.fill();
        // 테두리
        ctx.strokeStyle = "#8a6010";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(titleX, titleY, titleW, 14, 3); ctx.stroke();
        // 텍스트
        ctx.fillStyle = "#3a2000";
        ctx.fillText(titleText, agent.x, titleY + 11);
      }

      // Show destination
      if (agent.state === "walking" && agent.destination) {
        ctx.font = "8px sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText(`→ ${getBuildingName(agent.destination)}`, agent.x, agent.y + SPRITE_HEIGHT * PIXEL_SIZE / 2 + 34);
      }

      if (agent.state === "talking") {
        // Check if talking to lover/spouse
        let talkEmoji = "💬";
        if (agent.talkingTo) {
          const relKey = relationshipKey(agent.id, agent.talkingTo);
          const rel = relationshipsRef.current.get(relKey);
          if (rel && (rel.stage === "lover" || rel.stage === "married" || rel.stage === "parent")) {
            talkEmoji = "💕";
          }
        }
        ctx.fillStyle = "#fbbf24"; ctx.font = "12px sans-serif";
        ctx.fillText(talkEmoji, agent.x + SPRITE_WIDTH * PIXEL_SIZE / 2 + 4, agent.y - SPRITE_HEIGHT * PIXEL_SIZE / 2);
      }
    });

    // Chat bubbles
    bubbles.forEach((bubble) => {
      const agent = agents.find((a) => a.id === bubble.agentId);
      if (!agent) return;
      ctx.font = "11px sans-serif";

      // 줄바꿈 처리 (최대 너비 160px)
      const maxLineW = 160;
      const words = bubble.text.split("");
      const lines: string[] = [];
      let currentLine = "";
      for (const char of words) {
        const testLine = currentLine + char;
        if (ctx.measureText(testLine).width > maxLineW && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = char;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
      if (lines.length > 3) { lines.length = 3; lines[2] = lines[2].slice(0, -1) + "…"; }

      const lineHeight = 15;
      const bubbleW = Math.min(Math.max(...lines.map(l => ctx.measureText(l).width)) + 16, 180);
      const bubbleH = lines.length * lineHeight + 16;
      const bx = agent.x;
      const by = agent.y - SPRITE_HEIGHT * PIXEL_SIZE / 2 - bubbleH - 5;

      const opacity = Math.min(1, (bubble.duration - (Date.now() - bubble.timestamp)) / 1000);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.beginPath(); ctx.roundRect(bx - bubbleW / 2, by, bubbleW, bubbleH, 8); ctx.fill();
      // 말풍선 꼬리
      ctx.beginPath(); ctx.moveTo(bx - 4, by + bubbleH); ctx.lineTo(bx, by + bubbleH + 6); ctx.lineTo(bx + 4, by + bubbleH); ctx.fill();
      // 텍스트
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      lines.forEach((line, i) => {
        ctx.fillText(line, bx, by + 12 + i * lineHeight);
      });
      ctx.globalAlpha = 1;
    });

    // Talk lines
    agents.forEach((agent) => {
      if (agent.state === "talking" && agent.talkingTo) {
        const partner = agents.find((a) => a.id === agent.talkingTo);
        if (partner && agent.id < partner.id) {
          ctx.strokeStyle = "rgba(251, 191, 36, 0.3)"; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(agent.x, agent.y); ctx.lineTo(partner.x, partner.y); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    });

    // Map border
    ctx.strokeStyle = "#4a5e4a"; ctx.lineWidth = 4; ctx.setLineDash([]);
    ctx.strokeRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    ctx.restore();

    // 🧱 블록아트 렌더링 (뷰포트 내 블록만)
    const BLOCK_SIZE = 4;
    for (const block of placedBlocksRef.current) {
      const bx = block.x - cameraX;
      const by = block.y - cameraY;
      if (bx > -BLOCK_SIZE && bx < VW && by > -BLOCK_SIZE && by < VH) {
        ctx.fillStyle = block.color;
        ctx.fillRect(bx, by, BLOCK_SIZE, BLOCK_SIZE);
      }
    }

    // 🌙 낮/밤 — 상단 그라데이션만
    const timeInfo = getTimeOfDay(virtualElapsedRef.current);
    if (timeInfo.phase === "night" || timeInfo.phase === "dusk") {
      const gradH = timeInfo.phase === "night" ? VH * 0.4 : VH * 0.25;
      const alpha = timeInfo.phase === "night" ? 0.6 : 0.3;
      const grad = ctx.createLinearGradient(0, 0, 0, gradH);
      grad.addColorStop(0, `rgba(10, 10, 40, ${alpha})`);
      grad.addColorStop(1, "rgba(10, 10, 40, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VW, gradH);
    } else if (timeInfo.phase === "dawn") {
      const grad = ctx.createLinearGradient(0, 0, 0, VH * 0.2);
      grad.addColorStop(0, "rgba(255, 180, 100, 0.15)");
      grad.addColorStop(1, "rgba(255, 180, 100, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VW, VH * 0.2);
    }

    // 밤에 별 반짝이
    if (timeInfo.phase === "night") {
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      for (let i = 0; i < 15; i++) {
        const sx = (Math.sin(i * 73.7 + tick * 0.02) * 0.5 + 0.5) * VW;
        const sy = (Math.cos(i * 47.3 + tick * 0.015) * 0.5 + 0.5) * VH * 0.3;
        const size = 1 + Math.sin(tick * 0.05 + i) * 0.5;
        ctx.fillRect(sx, sy, size, size);
      }
      // 달
      ctx.font = "20px sans-serif";
      ctx.fillText("🌙", VW - 40, 30);
    }

    // 새벽 해
    if (timeInfo.phase === "dawn") {
      ctx.font = "18px sans-serif";
      ctx.fillText("🌅", 20, 30);
    }

    // 시간 표시 (우하단)
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "right";
    const timeEmoji = timeInfo.phase === "night" ? "🌙" : timeInfo.phase === "dawn" ? "🌅" : timeInfo.phase === "dusk" ? "🌇" : "☀️";
    ctx.fillStyle = timeInfo.phase === "night" ? "rgba(200,200,255,0.8)" : "rgba(255,255,255,0.7)";
    ctx.fillText(`${timeEmoji} ${timeInfo.hourLabel}`, VW - 8, VH - 8);

    // 축제 이펙트 (화면 가장자리 반짝이)
    if (festivalUntil && Date.now() < festivalUntil) {
      for (let i = 0; i < 8; i++) {
        const fx = Math.random() * VW;
        const fy = Math.random() * VH;
        ctx.font = `${10 + Math.random() * 10}px sans-serif`;
        ctx.fillText(["🎉", "🎊", "✨", "🎶", "💃"][Math.floor(Math.random() * 5)], fx, fy);
      }
    }

    // 슬로건 표시 (상단)
    if (villageSlogan) {
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(251, 191, 36, 0.8)";
      ctx.fillText(`✨ "${villageSlogan}" ✨`, VW / 2, 18);
    }

    // Minimap (bottom-left corner)
    const mmW = 160, mmH = 120, mmX = 10, mmY = VH - mmH - 10;
    ctx.fillStyle = "rgba(26,46,26,0.85)";
    ctx.fillRect(mmX, mmY, mmW, mmH);
    ctx.strokeStyle = "#555"; ctx.lineWidth = 1;
    ctx.strokeRect(mmX, mmY, mmW, mmH);

    // Tilemap overview on minimap (simplified)
    for (let ty = 0; ty < TILES_Y; ty += 3) {
      for (let tx = 0; tx < TILES_X; tx += 3) {
        const t = TILEMAP[ty][tx];
        if (t === T.DIRT) ctx.fillStyle = "#c4a265";
        else if (t === T.WATER) ctx.fillStyle = "#3b82c4";
        else if (t === T.STONE) ctx.fillStyle = "#9ca3af";
        else continue;
        ctx.fillRect(
          mmX + (tx / TILES_X) * mmW,
          mmY + (ty / TILES_Y) * mmH,
          Math.max(2, (3 / TILES_X) * mmW),
          Math.max(2, (3 / TILES_Y) * mmH),
        );
      }
    }

    // Buildings on minimap
    VILLAGE_BUILDINGS.forEach((b) => {
      ctx.fillStyle = b.roofColor;
      ctx.fillRect(mmX + (b.x / MAP_WIDTH) * mmW, mmY + (b.y / MAP_HEIGHT) * mmH, Math.max(3, (b.width / MAP_WIDTH) * mmW), Math.max(3, (b.height / MAP_HEIGHT) * mmH));
    });

    // Agents on minimap
    agents.forEach((a) => {
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.arc(mmX + (a.x / MAP_WIDTH) * mmW, mmY + (a.y / MAP_HEIGHT) * mmH, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Viewport rect on minimap
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
    ctx.strokeRect(
      mmX + (cameraX / MAP_WIDTH) * mmW,
      mmY + (cameraY / MAP_HEIGHT) * mmH,
      (VW / MAP_WIDTH) * mmW,
      (VH / MAP_HEIGHT) * mmH,
    );

  }, [agents, bubbles, godEffect, worldObjects, cameraX, cameraY, viewportSize]);

  return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col overflow-hidden">
      {/* 상단 바 */}
      <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/80 border-b border-zinc-800 shrink-0 flex-wrap">
        <h1 className="text-lg font-bold">🪙 Crypto Village</h1>
        {(() => {
          const t = getTimeOfDay(virtualElapsedRef.current);
          const emoji = t.phase === "night" ? "🌙" : t.phase === "dawn" ? "🌅" : t.phase === "dusk" ? "🌇" : "☀️";
          return <span className="text-amber-400/80 text-xs font-mono">📅 {villageDays}일차 {emoji} {t.hourLabel}</span>;
        })()}
        <button onClick={() => setIsRunning(!isRunning)}
          className={`px-3 py-1 rounded font-bold text-xs transition-all ${isRunning ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"}`}>
          {isRunning ? "⏸" : "▶️"}
        </button>
        {[3, 4, 5].map((n) => (
          <button key={n} onClick={() => { setAgentCount(n); setConversationLog([]); setRelationships(new Map()); relationshipsRef.current = new Map(); bubblesRef.current = []; pendingChatsRef.current = new Set(); }}
            className={`px-2 py-1 rounded text-xs font-bold transition-all ${agentCount === n ? "bg-indigo-500 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
            {n}명
          </button>
        ))}
        <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
          👥 {agents.length}명
        </span>
        {(["civilian", "police", "soldier", "thug"] as AgentClass[]).map(cls => (
          <button key={cls} onClick={() => spawnAgent(cls)}
            className={`px-2 py-1 rounded text-xs font-bold transition-all border ${CLASS_CONFIG[cls].btnColor}`}>
            {CLASS_CONFIG[cls].btnEmoji} {CLASS_CONFIG[cls].label}
          </button>
        ))}
      </div>

      {/* 메인: 캔버스(왼쪽) + 패널(오른쪽) */}
      <div className="flex flex-1 overflow-hidden">
        {/* 캔버스 — 왼쪽 풀 */}
        <div ref={canvasContainerRef} className="flex-1 overflow-hidden relative">
          <div className={`h-full transition-all duration-500 ${godEffect ? "shadow-amber-500/30" : ""}`}
            style={{ cursor: isDragging.current ? "grabbing" : "grab" }}>
            <canvas ref={canvasRef} width={viewportSize.w} height={viewportSize.h} className="block w-full h-full"
              onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} />
          </div>

          {/* ⚡ 신의 목소리 — 플로팅 */}
          <div className="absolute bottom-3 right-3 w-[280px] bg-zinc-950/90 backdrop-blur border border-amber-700/40 rounded-xl p-3 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-400">⚡ 신의 목소리</span>
              <button onClick={() => setShowObjectPicker(!showObjectPicker)} className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-600/30 text-purple-300 border border-purple-500/30 hover:bg-purple-600/50">
                {showObjectPicker ? "✕" : "🎁"}
              </button>
            </div>
            {showObjectPicker && (
              <div className="mb-2 grid grid-cols-6 gap-1">
                {SPAWNABLE_OBJECTS.map((obj) => (
                  <button key={obj.name} onClick={() => spawnObject(obj)} className="flex flex-col items-center p-1 rounded bg-zinc-800/80 hover:bg-purple-600/30 border border-zinc-700/50 hover:border-purple-500/40 transition-all" title={obj.name}>
                    <span className="text-sm">{obj.emoji}</span>
                  </button>
                ))}
              </div>
            )}
            {worldObjects.length > 0 && (
              <div className="mb-1.5 flex items-center justify-between text-[10px] text-purple-300/50">
                <span>오브젝트: {worldObjects.length}개</span>
                <button onClick={() => { worldObjectsRef.current = []; setWorldObjects([]); }} className="text-red-400/50 hover:text-red-400">제거</button>
              </div>
            )}
            {lastDecree && <div className="text-[10px] text-amber-300/40 mb-1.5 italic truncate">"{lastDecree}"</div>}
            <div className="flex gap-1.5">
              <input type="text" value={godMessage} onChange={(e) => setGodMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendDecree()}
                placeholder="명령을..." className="flex-1 bg-zinc-800/80 border border-amber-700/20 rounded-lg px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50" disabled={isSendingDecree} />
              <button onClick={sendDecree} disabled={isSendingDecree || !godMessage.trim()}
                className="px-3 py-1.5 bg-amber-600/80 hover:bg-amber-500/80 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-xs font-bold rounded-lg transition-all">
                {isSendingDecree ? "⏳" : "⚡"}
              </button>
            </div>
          </div>
        </div>

        {/* 오른쪽 패널 */}
        <div className="w-[320px] shrink-0 flex flex-col gap-2 p-2 overflow-y-auto border-l border-zinc-800 bg-zinc-900/50">

          {/* 🪙 추천 종목 */}
          <div className="bg-gradient-to-br from-amber-950/40 to-zinc-900/80 border border-amber-700/30 rounded-lg p-3 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-amber-300">🪙 AI 추천 종목</h3>
              {isResearching && <span className="text-[10px] text-amber-400 animate-pulse">🔬 리서치 중...</span>}
              <button
                onClick={() => {
                  if (isResearching) return;
                  setIsResearching(true);
                  lastResearchRef.current = Date.now();
                  const researchAgents = agents.filter(a => !a.isDead && !a.isBaby).slice(0, 5).map(a => ({
                    name: a.name, emoji: a.emoji, personality: a.personality,
                  }));
                  fetch("/api/research", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ agents: researchAgents }),
                  })
                    .then(r => r.json())
                    .then(data => {
                      if (data.picks?.length) {
                        setCoinPicks(prev => [...prev, ...data.picks].slice(-30));
                        setConversationLog(prev => [
                          `🔬 리서치 완료! ${data.picks.map((p: any) => `${p.pickedBy}→${p.symbol}`).join(", ")}`,
                          ...prev,
                        ].slice(0, 50));
                      }
                      if (data.consensus) setConsensus(data.consensus);
                      setIsResearching(false);
                    })
                    .catch(() => setIsResearching(false));
                }}
                disabled={isResearching}
                className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600/30 text-amber-300 border border-amber-600/40 hover:bg-amber-600/50 disabled:opacity-40"
              >
                🔍 리서치
              </button>
            </div>

            {/* 컨센서스 (2명 이상 동의) */}
            {consensus.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] text-amber-400/70 mb-1 font-bold">🏆 컨센서스 (2명+ 동의)</div>
                {consensus.slice(0, 3).map((c, i) => (
                  <div key={c.symbol} className="flex items-center gap-2 bg-amber-500/10 rounded p-1.5 mb-1 border border-amber-500/20">
                    <span className="text-amber-300 font-bold text-xs">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white">{c.symbol} <span className="text-zinc-400 font-normal">{c.name}</span></div>
                      <div className="text-[10px] text-zinc-400">
                        {c.price && `$${c.price.toLocaleString()}`}
                        {c.change24h !== undefined && <span className={c.change24h >= 0 ? "text-emerald-400 ml-1" : "text-red-400 ml-1"}>{c.change24h >= 0 ? "+" : ""}{c.change24h.toFixed(1)}%</span>}
                      </div>
                      <div className="text-[10px] text-amber-300/60">{c.voters.join(", ")} · 확신 {c.avgConfidence}/10</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 개별 추천 */}
            <div className="text-[10px] text-zinc-500 mb-1 font-bold">📋 최근 추천</div>
            <div className="space-y-1 max-h-[150px] overflow-y-auto">
              {coinPicks.length === 0 && <div className="text-[10px] text-zinc-600 text-center py-2">리서치 버튼을 눌러보세요!</div>}
              {coinPicks.slice(-8).reverse().map((p, i) => (
                <div key={`${p.symbol}-${p.pickedBy}-${i}`} className="text-[10px] text-zinc-400 flex items-start gap-1">
                  <span className="text-amber-300 shrink-0">{p.pickedBy}:</span>
                  <span className="text-white font-bold shrink-0">{p.symbol}</span>
                  <span className="truncate">{p.reason.slice(0, 40)}...</span>
                  <span className="shrink-0 text-amber-400">{p.confidence}/10</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 shrink-0">
            <h3 className="text-sm font-bold text-zinc-300 mb-3">🤝 관계도</h3>
            <div className="space-y-2 max-h-[120px] overflow-y-auto">
              {Array.from(relationships.values()).map((rel) => {
                const a = agents.find((ag) => ag.id === rel.agentA);
                const b = agents.find((ag) => ag.id === rel.agentB);
                if (!a || !b) return null;
                const level = getStageLabel(rel.stage);
                const color = getStageLabelColor(rel.stage);
                return (<div key={`${rel.agentA}-${rel.agentB}`} className="flex items-center justify-between text-xs"><span>{a.emoji} {a.name} ↔ {b.emoji} {b.name}</span><span className={`font-bold ${color}`}>{level} ({rel.meetCount}회)</span></div>);
              })}
              {relationships.size === 0 && <p className="text-xs text-zinc-600 italic">아직 만난 에이전트가 없습니다...</p>}
            </div>
          </div>

          {/* 🏛️ 마을 현황 */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 shrink-0">
            <h3 className="text-sm font-bold text-zinc-300 mb-2">🏛️ 마을 현황</h3>
            {villageSlogan && <div className="text-xs text-amber-400 italic mb-2 text-center">&quot;{villageSlogan}&quot;</div>}
            {festivalUntil && Date.now() < festivalUntil && <div className="text-xs text-pink-400 font-bold mb-2 text-center animate-pulse">🎊 축제 진행중! 🎊</div>}
            {/* 이장 */}
            {(() => { const mayor = agents.find(a => a.isMayor); return mayor ? <div className="text-xs text-amber-300 mb-2">🏛️ 이장: {mayor.emoji} {mayor.name} (평판 {mayor.reputation})</div> : <div className="text-xs text-zinc-600 italic mb-2">이장 미선출</div>; })()}
            {/* 법률 */}
            {villageLaws.length > 0 ? (
              <button onClick={() => setShowLawsPopup(true)} className="text-xs bg-emerald-950/30 border border-emerald-800/30 rounded px-2 py-1.5 mb-2 w-full text-left hover:bg-emerald-900/40 transition-all cursor-pointer">
                <span className="text-emerald-400 font-bold">📜 제정된 법률 ({villageLaws.length}개)</span>
                <span className="text-zinc-500 ml-1 text-[10px]">클릭하여 보기</span>
              </button>
            ) : (
              <div className="text-xs text-zinc-600 italic mb-2">📜 제정된 법률이 없습니다</div>
            )}
            {/* 주민 평판 */}
            <div className="mt-2 space-y-0.5 max-h-[60px] overflow-y-auto">
              {agents.filter(a => !a.isBaby).sort((a, b) => b.reputation - a.reputation).map(a => (
                <div key={a.id} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">{a.emoji} {a.name} {a.isMayor ? "🏛️" : ""}</span>
                  <span className={`font-mono ${a.reputation >= 70 ? "text-emerald-400" : a.reputation >= 40 ? "text-amber-400" : "text-red-400"}`}>
                    ⭐{a.reputation} 💰{formatCoins(a.coins)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 flex-1 min-h-0 flex flex-col">
            <h3 className="text-sm font-bold text-zinc-300 mb-3 shrink-0">💬 대화 기록</h3>
            <div className="space-y-1.5 overflow-y-auto flex-1 min-h-0">
              {conversationLog.map((log, i) => (
                <div key={i} className={`text-xs border-l-2 pl-2 ${
                  log.startsWith("⚡") ? "text-amber-400 border-amber-500 font-bold" :
                  log.startsWith("✅") || log.startsWith("🗳️") ? "text-emerald-400 border-emerald-500 font-bold" :
                  log.startsWith("❌") ? "text-red-400 border-red-500 font-bold" :
                  log.startsWith("🏛️") ? "text-amber-300 border-amber-600 font-bold" :
                  log.startsWith("🎊") || log.startsWith("🎉") ? "text-pink-400 border-pink-500 font-bold" :
                  log.startsWith("🗣️") || log.startsWith("📢") ? "text-blue-400 border-blue-500 font-bold" :
                  log.startsWith("🚨") || log.startsWith("🦹") ? "text-red-300 border-red-600" :
                  "text-zinc-400 border-zinc-700"
                }`}>{log}</div>
              ))}
              {conversationLog.length === 0 && <p className="text-xs text-zinc-600 italic">에이전트들이 만나면 대화가 시작됩니다...</p>}
            </div>
          </div>

        </div>
        {/* 법률 팝업 */}
      {showLawsPopup && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowLawsPopup(false)}>
          <div className="bg-zinc-900 border border-emerald-700/50 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-emerald-400">📜 마을 법률</h2>
              <button onClick={() => setShowLawsPopup(false)} className="text-zinc-500 hover:text-white text-xl">✕</button>
            </div>
            {villageLaws.length === 0 ? (
              <p className="text-zinc-500 text-sm italic text-center py-8">아직 제정된 법률이 없습니다</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {villageLaws.map((law, i) => (
                  <div key={law.id} className="bg-emerald-950/30 border border-emerald-800/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-emerald-400 font-bold text-sm">{law.emoji} {law.name}</span>
                      <span className="text-zinc-500 text-xs">#{i + 1}</span>
                    </div>
                    <p className="text-emerald-300/80 text-xs mb-2">{law.description}</p>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span>발의: {law.proposedBy}</span>
                      <span>{new Date(law.passedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 text-center text-[10px] text-zinc-600">토론에서 법안을 상정하고 이장이 승인하면 법률이 됩니다</div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
