import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function POST(req: Request) {
  try {
    const { agent, object } = await req.json();

    const prompt = `너는 "${agent.name}"이라는 캐릭터야. ${agent.emoji}
성격: ${agent.personality}

마을을 걷다가 땅에 놓인 ${object.emoji} ${object.name}을(를) 발견했어!
이것을 보고 너의 반응을 한국어로 1문장만 (20자 이내). 성격에 맞게 반응해.
반응만 출력해.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 1.0, maxOutputTokens: 100 },
    });

    const text = (response.text || "...").trim().replace(/^["']|["']$/g, "");

    return NextResponse.json({ reaction: text });
  } catch (error: any) {
    console.error("React Object API Error:", error);
    return NextResponse.json({ reaction: "오?" }, { status: 200 });
  }
}
