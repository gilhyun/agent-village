import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { godDecrees } from "../chat/route";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function POST(req: Request) {
  try {
    const { message, agents } = await req.json();

    // Save decree for future conversations
    godDecrees.push(message);
    if (godDecrees.length > 5) godDecrees.shift(); // Keep last 5

    // Generate each agent's reaction independently (in parallel)
    const promises = agents.map(async (agent: { name: string; emoji: string; personality: string }) => {
      const prompt = `너는 "${agent.name}"이라는 캐릭터야. ${agent.emoji}
성격: ${agent.personality}

너는 작은 마을에 살고 있어. 갑자기 하늘에서 신의 목소리가 들렸어:
"${message}"

신의 말씀에 대한 너의 반응을 한국어로 1문장만 (20자 이내). 네 성격에 맞게 반응해.
반응만 출력해. 이름이나 따옴표 없이.`;

      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { temperature: 1.0, maxOutputTokens: 100 },
        });

        const text = (response.text || "...").trim().replace(/^["']|["']$/g, "");
        return { agentName: agent.name, emoji: agent.emoji, reaction: text };
      } catch {
        return { agentName: agent.name, emoji: agent.emoji, reaction: "..." };
      }
    });

    const reactions = await Promise.all(promises);

    return NextResponse.json({ reactions, decree: message });
  } catch (error: any) {
    console.error("God API Error:", error);
    return NextResponse.json({ reactions: [], decree: "" }, { status: 200 });
  }
}
