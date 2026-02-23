"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Agent,
  Relationship,
  ChatBubble,
  DEFAULT_AGENTS,
  MAP_WIDTH,
  MAP_HEIGHT,
  INTERACTION_DISTANCE,
  BUBBLE_DURATION,
  initializeAgents,
  newTarget,
  distance,
  relationshipKey,
  getConversationType,
} from "@/lib/village";

export default function VillagePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [relationships, setRelationships] = useState<Map<string, Relationship>>(new Map());
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [conversationLog, setConversationLog] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const [agentCount, setAgentCount] = useState(5);

  const agentsRef = useRef<Agent[]>([]);
  const relationshipsRef = useRef<Map<string, Relationship>>(new Map());
  const bubblesRef = useRef<ChatBubble[]>([]);
  const pendingChatsRef = useRef<Set<string>>(new Set());
  const animFrameRef = useRef<number>(0);

  // Initialize agents
  useEffect(() => {
    const templates = DEFAULT_AGENTS.slice(0, agentCount);
    const initialized = initializeAgents(templates);
    setAgents(initialized);
    agentsRef.current = initialized;
  }, [agentCount]);

  // Request conversation from AI
  const requestConversation = useCallback(async (agentA: Agent, agentB: Agent, rel: Relationship) => {
    const key = relationshipKey(agentA.id, agentB.id);
    if (pendingChatsRef.current.has(key)) return;
    pendingChatsRef.current.add(key);

    const convType = getConversationType(rel.meetCount);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentA: { name: agentA.name, emoji: agentA.emoji, personality: agentA.personality },
          agentB: { name: agentB.name, emoji: agentB.emoji, personality: agentB.personality },
          conversationType: convType,
          previousTopics: rel.lastTopics,
        }),
      });

      const data = await res.json();

      if (data.messages && data.messages.length > 0) {
        // Show messages as bubbles sequentially
        data.messages.forEach((msg: { speaker: string; text: string }, i: number) => {
          setTimeout(() => {
            const speakerAgent = agentsRef.current.find((a) => a.name === msg.speaker);
            if (speakerAgent) {
              const bubble: ChatBubble = {
                id: `${Date.now()}-${i}-${Math.random()}`,
                agentId: speakerAgent.id,
                text: msg.text,
                timestamp: Date.now(),
                duration: BUBBLE_DURATION,
              };
              bubblesRef.current = [...bubblesRef.current, bubble];
              setBubbles([...bubblesRef.current]);

              setConversationLog((prev) => [
                `${speakerAgent.emoji} ${speakerAgent.name}: ${msg.text}`,
                ...prev,
              ].slice(0, 50));
            }
          }, i * 2000); // 2 second delay between messages
        });

        // Update relationship
        const updatedRel = { ...rel };
        updatedRel.meetCount += 1;
        if (data.topic) {
          updatedRel.lastTopics = [...updatedRel.lastTopics, data.topic].slice(-3);
        }
        relationshipsRef.current.set(key, updatedRel);
        setRelationships(new Map(relationshipsRef.current));

        // Set agents to talking state temporarily
        const totalDuration = data.messages.length * 2000 + BUBBLE_DURATION;
        agentsRef.current = agentsRef.current.map((a) => {
          if (a.id === agentA.id) return { ...a, state: "talking" as const, talkingTo: agentB.id };
          if (a.id === agentB.id) return { ...a, state: "talking" as const, talkingTo: agentA.id };
          return a;
        });

        setTimeout(() => {
          agentsRef.current = agentsRef.current.map((a) => {
            if (a.id === agentA.id || a.id === agentB.id) {
              const target = newTarget();
              return { ...a, state: "walking" as const, talkingTo: null, ...target };
            }
            return a;
          });
          pendingChatsRef.current.delete(key);
        }, totalDuration);
      } else {
        pendingChatsRef.current.delete(key);
      }
    } catch {
      pendingChatsRef.current.delete(key);
    }
  }, []);

  // Game loop
  useEffect(() => {
    if (!isRunning || agents.length === 0) return;

    const gameLoop = () => {
      const now = Date.now();

      // Update agent positions
      agentsRef.current = agentsRef.current.map((agent) => {
        if (agent.state === "talking") return agent;

        const dx = agent.targetX - agent.x;
        const dy = agent.targetY - agent.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 5) {
          // Reached target, pick new one
          const target = newTarget();
          return { ...agent, ...target };
        }

        const moveX = (dx / dist) * agent.speed;
        const moveY = (dy / dist) * agent.speed;

        return {
          ...agent,
          x: agent.x + moveX,
          y: agent.y + moveY,
        };
      });

      // Check for nearby agents
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
              if (!rel) {
                rel = { agentA: a.id, agentB: b.id, meetCount: 0, lastTopics: [] };
                relationshipsRef.current.set(key, rel);
              }
              requestConversation(a, b, rel);
            }
          }
        }
      }

      // Clean old bubbles
      bubblesRef.current = bubblesRef.current.filter(
        (b) => now - b.timestamp < b.duration
      );
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

    // Clear
    ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // Draw grass background
    ctx.fillStyle = "#1a2e1a";
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // Draw grid dots
    ctx.fillStyle = "#2a3e2a";
    for (let x = 0; x < MAP_WIDTH; x += 30) {
      for (let y = 0; y < MAP_HEIGHT; y += 30) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw paths
    ctx.strokeStyle = "#3a4e3a";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(0, MAP_HEIGHT / 2);
    ctx.lineTo(MAP_WIDTH, MAP_HEIGHT / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(MAP_WIDTH / 2, 0);
    ctx.lineTo(MAP_WIDTH / 2, MAP_HEIGHT);
    ctx.stroke();

    // Draw some decorations (trees)
    const trees = [
      [100, 100], [700, 100], [100, 500], [700, 500],
      [400, 150], [200, 300], [600, 400], [350, 450],
    ];
    trees.forEach(([tx, ty]) => {
      ctx.fillStyle = "#2d5a2d";
      ctx.beginPath();
      ctx.arc(tx, ty, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a3a1a";
      ctx.beginPath();
      ctx.arc(tx, ty, 10, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw agents
    agents.forEach((agent) => {
      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(agent.x, agent.y + 18, 14, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body circle
      ctx.fillStyle = agent.color;
      ctx.beginPath();
      ctx.arc(agent.x, agent.y, 20, 0, Math.PI * 2);
      ctx.fill();

      // Border
      ctx.strokeStyle = agent.state === "talking" ? "#fbbf24" : "rgba(255,255,255,0.3)";
      ctx.lineWidth = agent.state === "talking" ? 3 : 1;
      ctx.stroke();

      // Emoji
      ctx.font = "22px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(agent.emoji, agent.x, agent.y - 1);

      // Name
      ctx.font = "bold 11px sans-serif";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(agent.name, agent.x, agent.y + 35);

      // Talking indicator
      if (agent.state === "talking") {
        ctx.fillStyle = "#fbbf24";
        ctx.font = "12px sans-serif";
        ctx.fillText("💬", agent.x + 22, agent.y - 18);
      }
    });

    // Draw chat bubbles
    bubbles.forEach((bubble) => {
      const agent = agents.find((a) => a.id === bubble.agentId);
      if (!agent) return;

      const bubbleX = agent.x;
      const bubbleY = agent.y - 50;
      const padding = 8;
      const maxWidth = 180;

      ctx.font = "12px sans-serif";
      const textWidth = Math.min(ctx.measureText(bubble.text).width + padding * 2, maxWidth);
      const boxHeight = 24;

      // Bubble background
      const opacity = Math.min(1, (bubble.duration - (Date.now() - bubble.timestamp)) / 1000);
      ctx.globalAlpha = opacity;

      ctx.fillStyle = "rgba(0,0,0,0.8)";
      const rx = bubbleX - textWidth / 2;
      const ry = bubbleY - boxHeight / 2;
      ctx.beginPath();
      ctx.roundRect(rx, ry, textWidth, boxHeight, 8);
      ctx.fill();

      // Bubble pointer
      ctx.beginPath();
      ctx.moveTo(bubbleX - 5, bubbleY + boxHeight / 2);
      ctx.lineTo(bubbleX, bubbleY + boxHeight / 2 + 6);
      ctx.lineTo(bubbleX + 5, bubbleY + boxHeight / 2);
      ctx.fill();

      // Text
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(bubble.text, bubbleX, bubbleY, maxWidth - padding * 2);

      ctx.globalAlpha = 1;
    });

    // Draw interaction lines between talking agents
    agents.forEach((agent) => {
      if (agent.state === "talking" && agent.talkingTo) {
        const partner = agents.find((a) => a.id === agent.talkingTo);
        if (partner && agent.id < partner.id) {
          ctx.strokeStyle = "rgba(251, 191, 36, 0.3)";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(agent.x, agent.y);
          ctx.lineTo(partner.x, partner.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    });
  }, [agents, bubbles]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          🏘️ Agent Village
        </h1>
        <p className="text-zinc-400 mt-2 text-sm">
          AI 에이전트들이 마을에서 살아가는 모습을 관찰하세요
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-4 flex-wrap justify-center">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
            isRunning
              ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
          }`}
        >
          {isRunning ? "⏸ 일시정지" : "▶️ 시작"}
        </button>

        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span>에이전트:</span>
          {[3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => {
                setAgentCount(n);
                setConversationLog([]);
                setRelationships(new Map());
                relationshipsRef.current = new Map();
                bubblesRef.current = [];
                pendingChatsRef.current = new Set();
              }}
              className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                agentCount === n
                  ? "bg-indigo-500 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {n}명
            </button>
          ))}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex flex-col lg:flex-row gap-4 w-full max-w-[1200px]">
        {/* Canvas */}
        <div className="flex-1 flex justify-center">
          <div className="relative rounded-xl overflow-hidden border border-zinc-800 shadow-2xl">
            <canvas
              ref={canvasRef}
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              className="block"
              style={{ maxWidth: "100%", height: "auto" }}
            />
          </div>
        </div>

        {/* Sidebar: Conversation Log + Relationships */}
        <div className="w-full lg:w-[320px] flex flex-col gap-4">
          {/* Relationships */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-sm font-bold text-zinc-300 mb-3 flex items-center gap-2">
              🤝 관계도
            </h3>
            <div className="space-y-2 max-h-[150px] overflow-y-auto">
              {Array.from(relationships.values()).map((rel) => {
                const a = agents.find((ag) => ag.id === rel.agentA);
                const b = agents.find((ag) => ag.id === rel.agentB);
                if (!a || !b) return null;
                const level =
                  rel.meetCount === 0 ? "모르는 사이" :
                  rel.meetCount <= 2 ? "아는 사이" : "친한 사이";
                const color =
                  rel.meetCount === 0 ? "text-zinc-500" :
                  rel.meetCount <= 2 ? "text-blue-400" : "text-emerald-400";
                return (
                  <div key={`${rel.agentA}-${rel.agentB}`} className="flex items-center justify-between text-xs">
                    <span>
                      {a.emoji} {a.name} ↔ {b.emoji} {b.name}
                    </span>
                    <span className={`font-bold ${color}`}>
                      {level} ({rel.meetCount}회)
                    </span>
                  </div>
                );
              })}
              {relationships.size === 0 && (
                <p className="text-xs text-zinc-600 italic">아직 만난 에이전트가 없습니다...</p>
              )}
            </div>
          </div>

          {/* Conversation Log */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex-1">
            <h3 className="text-sm font-bold text-zinc-300 mb-3 flex items-center gap-2">
              💬 대화 기록
            </h3>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {conversationLog.map((log, i) => (
                <div key={i} className="text-xs text-zinc-400 border-l-2 border-zinc-700 pl-2">
                  {log}
                </div>
              ))}
              {conversationLog.length === 0 && (
                <p className="text-xs text-zinc-600 italic">
                  에이전트들이 만나면 대화가 시작됩니다...
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
