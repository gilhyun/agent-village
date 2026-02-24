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
  Building,
  Decoration,
  generateDecorations,
  initializeAgents,
  newTarget,
  distance,
  relationshipKey,
  getConversationType,
} from "@/lib/village";
import {
  CHARACTER_PALETTES,
  PIXEL_SIZE,
  SPRITE_WIDTH,
  SPRITE_HEIGHT,
  drawSprite,
  getFrame,
} from "@/lib/sprites";

// Viewport size (what you see on screen)
const VIEWPORT_W = 800;
const VIEWPORT_H = 600;

// Darken a hex color
function darkenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
}

export default function VillagePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
  const [worldObjects, setWorldObjects] = useState<WorldObject[]>([]);
  const [showObjectPicker, setShowObjectPicker] = useState(false);
  const worldObjectsRef = useRef<WorldObject[]>([]);
  const OBJECT_INTERACT_DISTANCE = 50;

  // Camera
  const [cameraX, setCameraX] = useState(400); // Center of 1600 - 800/2
  const [cameraY, setCameraY] = useState(300);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const cameraStart = useRef({ x: 0, y: 0 });

  const agentsRef = useRef<Agent[]>([]);
  const relationshipsRef = useRef<Map<string, Relationship>>(new Map());
  const bubblesRef = useRef<ChatBubble[]>([]);
  const pendingChatsRef = useRef<Set<string>>(new Set());
  const animFrameRef = useRef<number>(0);
  const tickRef = useRef<number>(0);
  const decorationsRef = useRef<Decoration[]>([]);

  // Generate decorations once
  useEffect(() => {
    decorationsRef.current = generateDecorations();
  }, []);

  // Initialize agents
  useEffect(() => {
    const templates = DEFAULT_AGENTS.slice(0, agentCount);
    const initialized = initializeAgents(templates);
    setAgents(initialized);
    agentsRef.current = initialized;
  }, [agentCount]);

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
    const newX = Math.max(0, Math.min(MAP_WIDTH - VIEWPORT_W, cameraStart.current.x - dx));
    const newY = Math.max(0, Math.min(MAP_HEIGHT - VIEWPORT_H, cameraStart.current.y - dy));
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
    } catch (e) { console.error("God decree failed:", e); }
    setGodMessage("");
    setIsSendingDecree(false);
  }, [godMessage, isSendingDecree]);

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
        const updatedRel = { ...rel, meetCount: rel.meetCount + 1 };
        if (data.topic) updatedRel.lastTopics = [...updatedRel.lastTopics, data.topic].slice(-3);
        relationshipsRef.current.set(key, updatedRel);
        setRelationships(new Map(relationshipsRef.current));

        const totalDuration = data.messages.length * 2000 + BUBBLE_DURATION;
        setTimeout(() => {
          agentsRef.current = agentsRef.current.map((a) => {
            if (a.id === agentA.id || a.id === agentB.id) {
              return { ...a, state: "walking" as const, talkingTo: null, ...newTarget() };
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

      agentsRef.current = agentsRef.current.map((agent) => {
        if (agent.state === "talking") return agent;
        const dx = agent.targetX - agent.x;
        const dy = agent.targetY - agent.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 5) return { ...agent, ...newTarget() };
        return { ...agent, x: agent.x + (dx / dist) * agent.speed, y: agent.y + (dy / dist) * agent.speed };
      });

      for (let i = 0; i < agentsRef.current.length; i++) {
        for (let j = i + 1; j < agentsRef.current.length; j++) {
          const a = agentsRef.current[i];
          const b = agentsRef.current[j];
          if (a.state === "talking" || b.state === "talking") continue;
          const dist = distance(a, b);
          if (dist < INTERACTION_DISTANCE) {
            const key = relationshipKey(a.id, b.id);
            if (!pendingChatsRef.current.has(key)) {
              let rel = relationshipsRef.current.get(key);
              if (!rel) { rel = { agentA: a.id, agentB: b.id, meetCount: 0, lastTopics: [] }; relationshipsRef.current.set(key, rel); }
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

      bubblesRef.current = bubblesRef.current.filter((b) => now - b.timestamp < b.duration);
      setBubbles([...bubblesRef.current]);
      setAgents([...agentsRef.current]);
      animFrameRef.current = requestAnimationFrame(gameLoop);
    };
    animFrameRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isRunning, agents.length, requestConversation]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, VIEWPORT_W, VIEWPORT_H);
    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    // Background
    ctx.fillStyle = godEffect ? "#1a1028" : "#1a2e1a";
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

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

    // Grid dots
    ctx.fillStyle = godEffect ? "#2a2040" : "#2a3e2a";
    for (let x = 0; x < MAP_WIDTH; x += 40) {
      for (let y = 0; y < MAP_HEIGHT; y += 40) {
        ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Roads (grid-style, L-shaped connections from plaza center)
    const pathColor = godEffect ? "#3a2850" : "#5a6e5a";
    const pathBorder = godEffect ? "#2a1840" : "#4a5e4a";
    ctx.lineWidth = 20;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const plaza = VILLAGE_BUILDINGS.find(b => b.id === "plaza")!;
    const plazaCX = plaza.x + plaza.width / 2;
    const plazaCY = plaza.y + plaza.height / 2;

    // Main horizontal road through plaza
    ctx.strokeStyle = pathBorder; ctx.lineWidth = 24;
    ctx.beginPath(); ctx.moveTo(50, plazaCY); ctx.lineTo(MAP_WIDTH - 50, plazaCY); ctx.stroke();
    ctx.strokeStyle = pathColor; ctx.lineWidth = 20;
    ctx.beginPath(); ctx.moveTo(50, plazaCY); ctx.lineTo(MAP_WIDTH - 50, plazaCY); ctx.stroke();

    // Main vertical road through plaza
    ctx.strokeStyle = pathBorder; ctx.lineWidth = 24;
    ctx.beginPath(); ctx.moveTo(plazaCX, 50); ctx.lineTo(plazaCX, MAP_HEIGHT - 50); ctx.stroke();
    ctx.strokeStyle = pathColor; ctx.lineWidth = 20;
    ctx.beginPath(); ctx.moveTo(plazaCX, 50); ctx.lineTo(plazaCX, MAP_HEIGHT - 50); ctx.stroke();

    // L-shaped branch roads to each building
    VILLAGE_BUILDINGS.forEach((b) => {
      if (b.id === "plaza") return;
      const bCX = b.x + b.width / 2;
      const bCY = b.y + b.height / 2;
      // Draw L-shape: go horizontal first, then vertical
      ctx.strokeStyle = pathBorder; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.moveTo(plazaCX, bCY); ctx.lineTo(bCX, bCY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(plazaCX, plazaCY); ctx.lineTo(plazaCX, bCY); ctx.stroke();
      ctx.strokeStyle = pathColor; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(plazaCX, bCY); ctx.lineTo(bCX, bCY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(plazaCX, plazaCY); ctx.lineTo(plazaCX, bCY); ctx.stroke();
    });

    // Decorations (flowers, bushes, rocks, animals)
    decorationsRef.current.forEach((d) => {
      ctx.font = d.type === "cow" ? "24px serif" : d.type === "bush" ? "16px serif" : d.type === "rock" ? "14px serif" : "10px serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(d.emoji, d.x, d.y);
    });

    // Buildings (pixel-art style)
    VILLAGE_BUILDINGS.forEach((b) => {
      const isDark = godEffect;
      const wall = isDark ? "#2a2040" : b.wallColor;
      const roof = isDark ? "#3a2060" : b.roofColor;
      const wallDark = isDark ? "#1a1530" : darkenColor(b.wallColor, 0.8);
      const roofDark = isDark ? "#2a1050" : darkenColor(b.roofColor, 0.7);

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(b.x + 4, b.y + 4, b.width, b.height);

      // Wall base
      ctx.fillStyle = wall;
      ctx.fillRect(b.x, b.y, b.width, b.height);

      // Wall detail - horizontal lines (brick texture)
      ctx.strokeStyle = wallDark;
      ctx.lineWidth = 0.5;
      for (let wy = b.y + 8; wy < b.y + b.height; wy += 8) {
        ctx.beginPath(); ctx.moveTo(b.x, wy); ctx.lineTo(b.x + b.width, wy); ctx.stroke();
      }

      // Wall border
      ctx.strokeStyle = roofDark;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.width, b.height);

      // Roof
      ctx.fillStyle = roof;
      ctx.beginPath();
      ctx.moveTo(b.x - 6, b.y);
      ctx.lineTo(b.x + b.width / 2, b.y - 20);
      ctx.lineTo(b.x + b.width + 6, b.y);
      ctx.closePath();
      ctx.fill();
      // Roof border
      ctx.strokeStyle = roofDark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x - 6, b.y);
      ctx.lineTo(b.x + b.width / 2, b.y - 20);
      ctx.lineTo(b.x + b.width + 6, b.y);
      ctx.closePath();
      ctx.stroke();
      // Roof stripe
      ctx.strokeStyle = roofDark;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.x - 3, b.y - 2);
      ctx.lineTo(b.x + b.width / 2, b.y - 17);
      ctx.lineTo(b.x + b.width + 3, b.y - 2);
      ctx.stroke();

      // Door
      ctx.fillStyle = "#6b3a1f";
      const doorW = 10, doorH = 16;
      ctx.fillRect(b.x + b.width / 2 - doorW / 2, b.y + b.height - doorH, doorW, doorH);
      ctx.strokeStyle = "#4a2810";
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x + b.width / 2 - doorW / 2, b.y + b.height - doorH, doorW, doorH);
      // Door knob
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(b.x + b.width / 2 + 2, b.y + b.height - doorH / 2, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Windows
      if (b.width >= 80) {
        const winColor = isDark ? "#4a3870" : "#bae6fd";
        const winFrame = isDark ? "#2a1850" : "#7c3aed";
        [b.x + 14, b.x + b.width - 26].forEach((wx) => {
          // Window pane
          ctx.fillStyle = winColor;
          ctx.fillRect(wx, b.y + 10, 12, 12);
          // Cross frame
          ctx.strokeStyle = winFrame;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(wx + 6, b.y + 10); ctx.lineTo(wx + 6, b.y + 22); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(wx, b.y + 16); ctx.lineTo(wx + 12, b.y + 16); ctx.stroke();
          // Window border
          ctx.strokeStyle = roofDark;
          ctx.lineWidth = 1;
          ctx.strokeRect(wx, b.y + 10, 12, 12);
        });
      }

      // Name label
      ctx.font = "bold 10px sans-serif";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 3;
      ctx.fillText(b.name, b.x + b.width / 2, b.y + b.height + 14);
      ctx.shadowBlur = 0;
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
    const tick = tickRef.current;
    agents.forEach((agent) => {
      const palette = CHARACTER_PALETTES[agent.id] || CHARACTER_PALETTES["agent-1"];
      const frame = getFrame(agent.state, tick);
      const flip = agent.targetX < agent.x;

      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(agent.x, agent.y + SPRITE_HEIGHT * PIXEL_SIZE / 2 + 2, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      drawSprite(ctx, frame, palette, agent.x, agent.y, PIXEL_SIZE, flip);

      if (agent.state === "talking") {
        ctx.strokeStyle = "rgba(251, 191, 36, 0.6)"; ctx.lineWidth = 2;
        const sw = SPRITE_WIDTH * PIXEL_SIZE, sh = SPRITE_HEIGHT * PIXEL_SIZE;
        ctx.beginPath(); ctx.roundRect(agent.x - sw / 2 - 3, agent.y - sh / 2 - 3, sw + 6, sh + 6, 4); ctx.stroke();
      }

      ctx.font = "bold 10px sans-serif"; ctx.fillStyle = "#fff"; ctx.textAlign = "center";
      ctx.fillText(agent.name, agent.x, agent.y + SPRITE_HEIGHT * PIXEL_SIZE / 2 + 14);

      if (agent.state === "talking") {
        ctx.fillStyle = "#fbbf24"; ctx.font = "12px sans-serif";
        ctx.fillText("💬", agent.x + SPRITE_WIDTH * PIXEL_SIZE / 2 + 4, agent.y - SPRITE_HEIGHT * PIXEL_SIZE / 2);
      }
    });

    // Chat bubbles
    bubbles.forEach((bubble) => {
      const agent = agents.find((a) => a.id === bubble.agentId);
      if (!agent) return;
      const bx = agent.x, by = agent.y - SPRITE_HEIGHT * PIXEL_SIZE / 2 - 20;
      ctx.font = "12px sans-serif";
      const tw = Math.min(ctx.measureText(bubble.text).width + 16, 180);
      const opacity = Math.min(1, (bubble.duration - (Date.now() - bubble.timestamp)) / 1000);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.beginPath(); ctx.roundRect(bx - tw / 2, by - 12, tw, 24, 8); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx - 5, by + 12); ctx.lineTo(bx, by + 18); ctx.lineTo(bx + 5, by + 12); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(bubble.text, bx, by, 164);
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

    // Minimap (bottom-left corner)
    const mmW = 160, mmH = 120, mmX = 10, mmY = VIEWPORT_H - mmH - 10;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(mmX, mmY, mmW, mmH);
    ctx.strokeStyle = "#555"; ctx.lineWidth = 1;
    ctx.strokeRect(mmX, mmY, mmW, mmH);

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
      (VIEWPORT_W / MAP_WIDTH) * mmW,
      (VIEWPORT_H / MAP_HEIGHT) * mmH,
    );

  }, [agents, bubbles, godEffect, worldObjects, cameraX, cameraY]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center p-4 md:p-8">
      <div className="mb-4 text-center">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">🏘️ Agent Village</h1>
        <p className="text-zinc-400 mt-1 text-sm">AI 에이전트들이 마을에서 살아가는 모습을 관찰하세요 · 드래그로 이동</p>
      </div>

      <div className="flex items-center gap-4 mb-4 flex-wrap justify-center">
        <button onClick={() => setIsRunning(!isRunning)}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${isRunning ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"}`}>
          {isRunning ? "⏸ 일시정지" : "▶️ 시작"}
        </button>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span>에이전트:</span>
          {[3, 4, 5].map((n) => (
            <button key={n} onClick={() => { setAgentCount(n); setConversationLog([]); setRelationships(new Map()); relationshipsRef.current = new Map(); bubblesRef.current = []; pendingChatsRef.current = new Set(); }}
              className={`px-3 py-1 rounded text-xs font-bold transition-all ${agentCount === n ? "bg-indigo-500 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
              {n}명
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 w-full max-w-[1200px]">
        <div className="flex-1 flex justify-center">
          <div className={`relative rounded-xl overflow-hidden border shadow-2xl transition-all duration-500 ${godEffect ? "border-amber-500/60 shadow-amber-500/30" : "border-zinc-800"}`}
            style={{ cursor: isDragging.current ? "grabbing" : "grab" }}>
            <canvas ref={canvasRef} width={VIEWPORT_W} height={VIEWPORT_H} className="block"
              onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
              style={{ maxWidth: "100%", height: "auto" }} />
          </div>
        </div>

        <div className="w-full lg:w-[320px] flex flex-col gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-sm font-bold text-zinc-300 mb-3">🤝 관계도</h3>
            <div className="space-y-2 max-h-[150px] overflow-y-auto">
              {Array.from(relationships.values()).map((rel) => {
                const a = agents.find((ag) => ag.id === rel.agentA);
                const b = agents.find((ag) => ag.id === rel.agentB);
                if (!a || !b) return null;
                const level = rel.meetCount === 0 ? "모르는 사이" : rel.meetCount <= 2 ? "아는 사이" : "친한 사이";
                const color = rel.meetCount === 0 ? "text-zinc-500" : rel.meetCount <= 2 ? "text-blue-400" : "text-emerald-400";
                return (<div key={`${rel.agentA}-${rel.agentB}`} className="flex items-center justify-between text-xs"><span>{a.emoji} {a.name} ↔ {b.emoji} {b.name}</span><span className={`font-bold ${color}`}>{level} ({rel.meetCount}회)</span></div>);
              })}
              {relationships.size === 0 && <p className="text-xs text-zinc-600 italic">아직 만난 에이전트가 없습니다...</p>}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex-1">
            <h3 className="text-sm font-bold text-zinc-300 mb-3">💬 대화 기록</h3>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {conversationLog.map((log, i) => (
                <div key={i} className={`text-xs border-l-2 pl-2 ${log.startsWith("⚡") ? "text-amber-400 border-amber-500 font-bold" : "text-zinc-400 border-zinc-700"}`}>{log}</div>
              ))}
              {conversationLog.length === 0 && <p className="text-xs text-zinc-600 italic">에이전트들이 만나면 대화가 시작됩니다...</p>}
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-950/40 to-zinc-900 border border-amber-700/30 rounded-xl p-4">
            <h3 className="text-sm font-bold text-amber-400 mb-3">⚡ 신의 목소리</h3>
            <div className="mb-3">
              <button onClick={() => setShowObjectPicker(!showObjectPicker)} className="w-full px-3 py-2 text-xs font-bold rounded-lg bg-purple-600/30 text-purple-300 border border-purple-500/30 hover:bg-purple-600/40 transition-all">
                {showObjectPicker ? "✕ 닫기" : "🎁 오브젝트 소환"}
              </button>
              {showObjectPicker && (
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {SPAWNABLE_OBJECTS.map((obj) => (
                    <button key={obj.name} onClick={() => spawnObject(obj)} className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-zinc-800/80 hover:bg-purple-600/30 border border-zinc-700 hover:border-purple-500/40 transition-all">
                      <span className="text-lg">{obj.emoji}</span><span className="text-[10px] text-zinc-400">{obj.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {worldObjects.length > 0 && (
              <div className="mb-2 flex items-center justify-between text-xs text-purple-300/60">
                <span>마을 오브젝트: {worldObjects.length}개</span>
                <button onClick={() => { worldObjectsRef.current = []; setWorldObjects([]); }} className="text-red-400/60 hover:text-red-400 transition-colors">전부 제거</button>
              </div>
            )}
            {lastDecree && <div className="text-xs text-amber-300/60 mb-2 italic truncate">마지막 명령: &quot;{lastDecree}&quot;</div>}
            <div className="flex gap-2">
              <input type="text" value={godMessage} onChange={(e) => setGodMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendDecree()}
                placeholder="마을에 전할 말씀을..." className="flex-1 bg-zinc-800/80 border border-amber-700/30 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50" disabled={isSendingDecree} />
              <button onClick={sendDecree} disabled={isSendingDecree || !godMessage.trim()}
                className="px-4 py-2 bg-amber-600/80 hover:bg-amber-500/80 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-bold rounded-lg transition-all">
                {isSendingDecree ? "⏳" : "⚡"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
