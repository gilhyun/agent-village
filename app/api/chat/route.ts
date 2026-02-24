import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// In-memory stores
const relationshipMemories: Map<string, string[]> = new Map();
export const godDecrees: string[] = [];

function getRelKey(a: string, b: string) {
  return `${a}→${b}`;
}

function getSystemPrompt(
  agent: { name: string; emoji: string; personality: string },
  stage: string
) {
  const decreeContext = godDecrees.length > 0
    ? `\n\n[신의 명령] 최근 하늘에서 신의 목소리가 들렸어:\n${godDecrees.slice(-3).map(d => `- "${d}"`).join("\n")}\n이 명령을 기억하고 대화에 자연스럽게 반영해.`
    : "";

  let stageInstruction = "";
  switch (stage) {
    case "stranger":
      stageInstruction = "처음 만나는 사이. 조심스럽고 예의 바르게 인사해.";
      break;
    case "acquaintance":
      stageInstruction = "몇 번 만난 사이. 가볍게 안부를 묻고 스몰토크해.";
      break;
    case "friend":
      stageInstruction = "친한 친구. 편하게 반말하고 농담도 해.";
      break;
    case "lover":
      stageInstruction = "연인 사이! 💕 다정하고 애정표현을 자연스럽게 해. 서로 좋아하는 감정을 표현해. 데이트, 미래 계획 등 연인다운 대화를 해.";
      break;
    case "married":
      stageInstruction = "부부 사이! 💍 결혼한 사이답게 일상적이고 편안한 대화. '여보', '자기' 같은 호칭 사용. 함께하는 삶에 대한 이야기.";
      break;
    case "parent":
      stageInstruction = "아이가 있는 부부! 👶 아이 이야기, 육아, 가정 이야기를 자연스럽게 해. 행복한 가정의 모습.";
      break;
  }

  return `너는 "${agent.name}"이라는 캐릭터야. ${agent.emoji}
성격: ${agent.personality}

너는 작은 마을에 살고 있어. 마을을 돌아다니다가 다른 주민을 만나면 대화해.
[관계 상태] ${stageInstruction}
- 반드시 한국어로 말해
- 한 번에 1~2문장만 (25자 이내로 짧게!)
- 네 성격에 맞게 말해
- 상대방 이름을 자연스럽게 불러
- 이전 대화를 기억하고 이어가${decreeContext}`;
}

export async function POST(req: Request) {
  try {
    const { agentA, agentB, conversationType, meetCount, stage } = await req.json();

    const currentStage = stage || "stranger";

    // Get or initialize relationship memories
    const relKeyAB = getRelKey(agentA.id, agentB.id);
    const relKeyBA = getRelKey(agentB.id, agentA.id);
    const memoriesAB = relationshipMemories.get(relKeyAB) || [];
    const memoriesBA = relationshipMemories.get(relKeyBA) || [];

    // Build context
    const contextForA = memoriesAB.length > 0
      ? `\n[${agentB.name}과의 기억]\n${memoriesAB.slice(-5).join("\n")}`
      : `\n[${agentB.name}을(를) 처음 만남]`;

    const contextForB = memoriesBA.length > 0
      ? `\n[${agentA.name}과의 기억]\n${memoriesBA.slice(-5).join("\n")}`
      : `\n[${agentA.name}을(를) 처음 만남]`;

    // Determine situation text
    let situationA = "";
    if (currentStage === "lover") {
      situationA = `연인 ${agentB.name}을(를) 만났어. 다정하게 말해봐.`;
    } else if (currentStage === "married") {
      situationA = `배우자 ${agentB.name}을(를) 만났어. 편하게 말해.`;
    } else if (currentStage === "parent") {
      situationA = `아이의 엄마/아빠인 ${agentB.name}을(를) 만났어. 아이 이야기도 해봐.`;
    } else if (conversationType === "greeting") {
      situationA = `마을에서 ${agentB.name}을(를) 처음 만났어. 인사해봐.`;
    } else if (conversationType === "smalltalk") {
      situationA = `마을에서 ${agentB.name}을(를) 또 만났어 (${meetCount}번째). 가볍게 말 걸어봐.`;
    } else {
      situationA = `친한 친구 ${agentB.name}을(를) 만났어 (${meetCount}번째). 편하게 대화해.`;
    }

    const messages: { speaker: string; text: string }[] = [];
    const turns = currentStage === "lover" || currentStage === "married" || currentStage === "parent" ? 4 : conversationType === "deep" ? 4 : 3;

    const systemA = getSystemPrompt(agentA, currentStage) + contextForA;
    const historyA: { role: string; parts: { text: string }[] }[] = [];
    const systemB = getSystemPrompt(agentB, currentStage) + contextForB;
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
    relationshipMemories.set(relKeyAB, memoriesAB.slice(-10));
    relationshipMemories.set(relKeyBA, memoriesBA.slice(-10));

    const topic = messages.map((m) => m.text).join(" ").slice(0, 50);

    return NextResponse.json({
      messages,
      topic,
      multiAgent: true,
    });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { messages: [{ speaker: "System", text: "..." }], topic: "" },
      { status: 200 }
    );
  }
}
