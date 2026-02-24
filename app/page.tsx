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
const VIEWPORT_W = 800;
const VIEWPORT_H = 600;
const TS = TILE_SIZE * TILE_SCALE; // rendered tile size in px

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

  // Pre-render tilemap to offscreen canvas (cache)
  const tilemapCanvasRef = useRef<HTMLCanvasElement | null>(null);

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
        const newStage = getRelationshipStage(newMeetCount, oldStage);
        const updatedRel: Relationship = { ...rel, meetCount: newMeetCount, stage: newStage };
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
            setTimeout(() => {
              const babyTemplate = createBabyAgent(agentA, agentB);
              const pos = randomPosition();
              const target = newTarget();
              const babyAgent: Agent = { ...babyTemplate, ...pos, ...target };
              agentsRef.current = [...agentsRef.current, babyAgent];
              setAgents([...agentsRef.current]);
              setConversationLog((prev) => [`🎉 ${babyAgent.emoji} ${babyAgent.name}이(가) 마을에 태어났습니다! (${agentA.name} & ${agentB.name}의 아이)`, ...prev].slice(0, 50));
              bubblesRef.current = [
                ...bubblesRef.current,
                { id: `baby-${Date.now()}`, agentId: babyAgent.id, text: "응애~ 👶", timestamp: Date.now(), duration: 8000 },
              ];
              setBubbles([...bubblesRef.current]);
            }, data.messages.length * 2000 + 3000);
          }
        }

        const totalDuration = data.messages.length * 2000 + BUBBLE_DURATION;
        setTimeout(() => {
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

      agentsRef.current = agentsRef.current.map((agent) => {
        if (agent.state === "talking") return agent;
        const dx = agent.targetX - agent.x;
        const dy = agent.targetY - agent.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 8) {
          // Arrived at destination — pick new one
          const next = pickDestination(agent.id, agent.homeId, agent.destination, getPartnerHomeId(agent.id));
          return { ...agent, targetX: next.targetX, targetY: next.targetY, destination: next.destination };
        }
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
    const endTX = Math.min(TILES_X, Math.ceil((cameraX + VIEWPORT_W) / TS) + 1);
    const endTY = Math.min(TILES_Y, Math.ceil((cameraY + VIEWPORT_H) / TS) + 1);
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
      if (dpx + TS * 2 < cameraX || dpx > cameraX + VIEWPORT_W) return;
      if (dpy + TS * 2 < cameraY || dpy > cameraY + VIEWPORT_H) return;
      if (godEffect) return; // hide decorations during god effect

      if (d.type === "tree") drawBigTree(ctx, dpx, dpy, TILE_SCALE, d.variant);
      else if (d.type === "flower") drawFlowerTile(ctx, dpx, dpy, TILE_SCALE, d.variant);
      else if (d.type === "bush") drawBushTile(ctx, dpx, dpy, TILE_SCALE);
      else if (d.type === "rock") drawRockTile(ctx, dpx, dpy, TILE_SCALE, d.variant);
    });

    // Buildings (interior view)
    VILLAGE_BUILDINGS.forEach((b) => {
      // Skip if outside viewport
      if (b.x + b.width + 20 < cameraX || b.x - 20 > cameraX + VIEWPORT_W) return;
      if (b.y + b.height + 20 < cameraY || b.y - 30 > cameraY + VIEWPORT_H) return;

      drawBuildingInterior(ctx, b, godEffect);
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

      // Show destination
      if (agent.state === "walking" && agent.destination) {
        ctx.font = "8px sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText(`→ ${getBuildingName(agent.destination)}`, agent.x, agent.y + SPRITE_HEIGHT * PIXEL_SIZE / 2 + 24);
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
                const level = getStageLabel(rel.stage);
                const color = getStageLabelColor(rel.stage);
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
