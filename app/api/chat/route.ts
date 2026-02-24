import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// In-memory agent conversation histories (persistent during server lifetime)
// Key: agentId, Value: array of { role, parts } for Gemini multi-turn
const agentMemories: Map<string, { role: string; parts: { text: string }[] }[]> = new Map();

// Relationship memories: what each agent remembers about the other
// Key: "agentA:agentB", Value: summary of past interactions
const relationshipMemories: Map<string, string[]> = new Map();

// God's decrees — shared across all agents
export const godDecrees: string[] = [];

function getRelKey(a: string, b: string) {
  return `${a}→${b}`;
}

function getSystemPrompt(agent: { name: string; emoji: string; personality: string }) {
  const decreeContext = godDecrees.length > 0
    ? `\n\n[신의 명령] 최근 하늘에서 신의 목소리가 들렸어:\n${godDecrees.slice(-3).map(d => `- "${d}"`).join("\n")}\n이 명령을 기억하고 대화에 자연스럽게 반영해.`
    : "";

  return `너는 "${agent.name}"이라는 캐릭터야. ${agent.emoji}
성격: ${agent.personality}

너는 작은 마을에 살고 있어. 마을을 돌아다니다가 다른 주민을 만나면 대화해.
- 반드시 한국어로 말해
- 한 번에 1~2문장만 (25자 이내로 짧게!)
- 네 성격에 맞게 말해
- 상대방 이름을 자연스럽게 불러
- 이전 대화를 기억하고 이어가${decreeContext}`;
}

export async function POST(req: Request) {
  try {
    const { agentA, agentB, conversationType, meetCount } = await req.json();

    // Get or initialize relationship memories
    const relKeyAB = getRelKey(agentA.id, agentB.id);
    const relKeyBA = getRelKey(agentB.id, agentA.id);
    const memoriesAB = relationshipMemories.get(relKeyAB) || [];
    const memoriesBA = relationshipMemories.get(relKeyBA) || [];

    // Build context for each agent
    const contextForA = memoriesAB.length > 0
      ? `\n[${agentB.name}과의 기억]\n${memoriesAB.slice(-5).join("\n")}`
      : `\n[${agentB.name}을(를) 처음 만남]`;

    const contextForB = memoriesBA.length > 0
      ? `\n[${agentA.name}과의 기억]\n${memoriesBA.slice(-5).join("\n")}`
      : `\n[${agentA.name}을(를) 처음 만남]`;

    // Determine conversation starter based on type
    let situationA = "";
    if (conversationType === "greeting") {
      situationA = `마을에서 ${agentB.name}을(를) 처음 만났어. 인사해봐.`;
    } else if (conversationType === "smalltalk") {
      situationA = `마을에서 ${agentB.name}을(를) 또 만났어 (${meetCount}번째). 가볍게 말 걸어봐.`;
    } else {
      situationA = `친한 친구 ${agentB.name}을(를) 만났어 (${meetCount}번째). 편하게 대화해.`;
    }

    const messages: { speaker: string; text: string }[] = [];
    const turns = conversationType === "deep" ? 4 : 3;

    // Agent A starts the conversation
    const systemA = getSystemPrompt(agentA) + contextForA;
    const historyA: { role: string; parts: { text: string }[] }[] = [];

    // Agent B's system
    const systemB = getSystemPrompt(agentB) + contextForB;
    const historyB: { role: string; parts: { text: string }[] }[] = [];

    // First turn: A speaks
    historyA.push({ role: "user", parts: [{ text: situationA }] });

    const responseA1 = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: systemA }] },
        { role: "model", parts: [{ text: "네, 알겠습니다." }] },
        ...historyA,
      ],
      config: { temperature: 0.9, maxOutputTokens: 200 },
    });

    const textA1 = (responseA1.text || "").trim().replace(/^["']|["']$/g, "");
    messages.push({ speaker: agentA.name, text: textA1 });
    historyA.push({ role: "model", parts: [{ text: textA1 }] });

    // Alternating turns
    for (let i = 1; i < turns; i++) {
      const isATurn = i % 2 === 0;

      if (isATurn) {
        // A responds to B's last message
        const lastBMsg = messages[messages.length - 1].text;
        historyA.push({ role: "user", parts: [{ text: `${agentB.name}이(가) 말했어: "${lastBMsg}"` }] });

        const resA = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            { role: "user", parts: [{ text: systemA }] },
            { role: "model", parts: [{ text: "네, 알겠습니다." }] },
            ...historyA,
          ],
          config: { temperature: 0.9, maxOutputTokens: 200 },
        });

        const textA = (resA.text || "").trim().replace(/^["']|["']$/g, "");
        messages.push({ speaker: agentA.name, text: textA });
        historyA.push({ role: "model", parts: [{ text: textA }] });
      } else {
        // B responds to A's last message
        const lastAMsg = messages[messages.length - 1].text;
        const situationB = i === 1
          ? `마을에서 ${agentA.name}이(가) 너한테 말을 걸었어: "${lastAMsg}"`
          : `${agentA.name}이(가) 말했어: "${lastAMsg}"`;

        historyB.push({ role: "user", parts: [{ text: situationB }] });

        const resB = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            { role: "user", parts: [{ text: systemB }] },
            { role: "model", parts: [{ text: "네, 알겠습니다." }] },
            ...historyB,
          ],
          config: { temperature: 0.9, maxOutputTokens: 200 },
        });

        const textB = (resB.text || "").trim().replace(/^["']|["']$/g, "");
        messages.push({ speaker: agentB.name, text: textB });
        historyB.push({ role: "model", parts: [{ text: textB }] });
      }
    }

    // Save relationship memories
    const convoSummary = messages.map((m) => `${m.speaker}: ${m.text}`).join(" | ");
    const timestamp = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

    memoriesAB.push(`[${timestamp}] ${convoSummary}`);
    memoriesBA.push(`[${timestamp}] ${convoSummary}`);
    relationshipMemories.set(relKeyAB, memoriesAB.slice(-10)); // Keep last 10
    relationshipMemories.set(relKeyBA, memoriesBA.slice(-10));

    const topic = messages.map((m) => m.text).join(" ").slice(0, 50);

    return NextResponse.json({
      messages,
      topic,
      multiAgent: true, // Flag: each message was generated by independent AI
    });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { messages: [{ speaker: "System", text: "..." }], topic: "" },
      { status: 200 }
    );
  }
}
