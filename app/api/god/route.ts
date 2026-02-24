import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { godDecrees } from "../chat/route";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// 퀘스트/이벤트 결과 저장 (in-memory)
export const questResults: { quest: string; result: string; titles: Record<string, string>; timestamp: number }[] = [];

interface AgentInfo {
  name: string;
  emoji: string;
  personality: string;
}

// AI로 퀘스트인지 판단 + 처리
async function processQuest(message: string, agents: AgentInfo[]) {
  const agentNames = agents.map(a => `${a.emoji}${a.name}(${a.personality})`).join(", ");

  const prompt = `너는 마을 시뮬레이션의 게임 마스터야.
신이 마을에 다음 명령을 내렸어: "${message}"

마을 주민: ${agentNames}

이 명령이 투표, 대회, 선발, 임명, 경쟁 등 주민들의 행동이 필요한 "퀘스트/이벤트"인지 판단해.

아래 JSON 형식으로만 응답해 (다른 텍스트 없이):
{
  "isQuest": true/false,
  "questType": "vote" | "contest" | "assign" | "event" | "none",
  "description": "이벤트 설명 (1줄)",
  "results": [
    { "agentName": "이름", "action": "무엇을 했는지", "result": "결과" }
  ],
  "winner": "당선/우승자 이름 또는 null",
  "titles": { "에이전트이름": "칭호" },
  "announcement": "마을 전체 발표 메시지 (1~2줄)"
}

규칙:
- 각 에이전트의 성격을 반영해서 현실적으로 결과를 만들어
- 투표라면 각 에이전트가 누구에게 투표했는지 보여줘
- 대회라면 각 에이전트의 성과를 보여줘
- titles에는 이벤트 결과로 받는 칭호를 넣어 (예: "마을 회장", "요리왕")
- 퀘스트가 아니면 isQuest: false, 나머지 빈 값`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.8, maxOutputTokens: 2048, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
    });

    const rawText = (response.text || "").trim();
    // 줄바꿈을 이스케이프 (JSON 문자열 내부 개행 문제 해결)
    const text = rawText.replace(/\n/g, "\\n");
    console.log("[Quest AI Response length]", rawText.length);
    try {
      const parsed = JSON.parse(text);
      console.log("[Quest OK]", parsed.isQuest, parsed.winner, JSON.stringify(parsed.titles));
      return parsed;
    } catch {
      // 원본도 시도
      try { return JSON.parse(rawText); } catch {}
      // JSON 추출 시도
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { return JSON.parse(jsonMatch[0].replace(/\n/g, "\\n")); } catch {}
        try { return JSON.parse(jsonMatch[0]); } catch {}
      }
      console.error("[Quest JSON Parse Failed] text:", rawText.slice(0, 200));
    }
  } catch (e) {
    console.error("Quest processing error:", e);
  }
  return { isQuest: false, questType: "none", results: [], winner: null, titles: {}, announcement: "" };
}

export async function POST(req: Request) {
  try {
    const { message, agents } = await req.json();

    // Save decree
    godDecrees.push(message);
    if (godDecrees.length > 5) godDecrees.shift();

    // 퀘스트 처리
    const questData = await processQuest(message, agents);

    // 퀘스트 결과가 있으면 저장
    if (questData.isQuest && questData.titles) {
      questResults.push({
        quest: message,
        result: questData.announcement || "",
        titles: questData.titles || {},
        timestamp: Date.now(),
      });
      // 최근 10개만 유지
      if (questResults.length > 10) questResults.shift();
    }

    // 각 에이전트 반응 생성 (병렬)
    const questContext = questData.isQuest
      ? `\n\n[퀘스트 결과]\n${questData.announcement}\n${questData.results?.map((r: any) => `- ${r.agentName}: ${r.action} → ${r.result}`).join("\n") || ""}`
      : "";

    const promises = agents.map(async (agent: AgentInfo) => {
      const myTitle = questData.titles?.[agent.name];
      const titleInfo = myTitle ? `\n너는 방금 "${myTitle}" 칭호를 받았어!` : "";

      const prompt = `너는 "${agent.name}"이라는 캐릭터야. ${agent.emoji}
성격: ${agent.personality}${titleInfo}

너는 작은 마을에 살고 있어. 갑자기 하늘에서 신의 목소리가 들렸어:
"${message}"${questContext}

신의 말씀과 결과에 대한 너의 반응을 한국어로 1~2문장 (40자 이내). 네 성격에 맞게 반응해.
${myTitle ? "칭호를 받은 것에 대한 감상도 포함해." : ""}
반응만 출력해. 이름이나 따옴표 없이.`;

      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { temperature: 1.0, maxOutputTokens: 150 },
        });

        const text = (response.text || "...").trim().replace(/^["']|["']$/g, "");
        return { agentName: agent.name, emoji: agent.emoji, reaction: text };
      } catch {
        return { agentName: agent.name, emoji: agent.emoji, reaction: "..." };
      }
    });

    const reactions = await Promise.all(promises);

    return NextResponse.json({
      reactions,
      decree: message,
      quest: questData.isQuest ? questData : null,
    });
  } catch (error: any) {
    console.error("God API Error:", error);
    return NextResponse.json({ reactions: [], decree: "", quest: null }, { status: 200 });
  }
}
