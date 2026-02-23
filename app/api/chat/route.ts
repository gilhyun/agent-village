import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function POST(req: Request) {
  try {
    const { agentA, agentB, conversationType, previousTopics } = await req.json();

    let systemPrompt = "";

    if (conversationType === "greeting") {
      systemPrompt = `두 AI 에이전트가 마을에서 처음 만났습니다. 서로 자연스럽게 인사를 나눕니다.

${agentA.name} (${agentA.emoji}): ${agentA.personality}
${agentB.name} (${agentB.emoji}): ${agentB.personality}

아래 형식으로 짧은 인사 대화를 2-3턴 생성해주세요. 각 대사는 15자 이내로 짧게.
형식:
${agentA.name}: (대사)
${agentB.name}: (대사)`;
    } else if (conversationType === "smalltalk") {
      systemPrompt = `두 AI 에이전트가 마을에서 다시 만났습니다. 가벼운 스몰토크를 합니다.

${agentA.name} (${agentA.emoji}): ${agentA.personality}
${agentB.name} (${agentB.emoji}): ${agentB.personality}

이전 화제: ${previousTopics?.join(", ") || "없음"}

아래 형식으로 가벼운 대화를 2-3턴 생성해주세요. 각 대사는 20자 이내로 짧게.
형식:
${agentA.name}: (대사)
${agentB.name}: (대사)`;
    } else {
      systemPrompt = `두 AI 에이전트가 마을에서 자주 만나는 사이입니다. 친한 친구처럼 자유롭게 대화합니다.

${agentA.name} (${agentA.emoji}): ${agentA.personality}
${agentB.name} (${agentB.emoji}): ${agentB.personality}

이전 화제: ${previousTopics?.join(", ") || "없음"}

아래 형식으로 친근한 대화를 3-4턴 생성해주세요. 각 대사는 25자 이내로. 성격에 맞는 재밌는 대화를 해주세요.
형식:
${agentA.name}: (대사)
${agentB.name}: (대사)`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
      config: {
        temperature: 0.9,
        maxOutputTokens: 200,
      },
    });

    const text = response.text || "";

    // Parse lines into structured messages
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    const messages: { speaker: string; text: string }[] = [];

    for (const line of lines) {
      const match = line.match(/^(.+?)[:：]\s*(.+)$/);
      if (match) {
        messages.push({ speaker: match[1].trim(), text: match[2].trim() });
      }
    }

    // Extract topic from conversation for memory
    const topic = messages.map((m) => m.text).join(" ").slice(0, 50);

    return NextResponse.json({ messages, topic });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { messages: [{ speaker: "System", text: "..." }], topic: "" },
      { status: 200 }
    );
  }
}
