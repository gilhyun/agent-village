import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { godDecrees } from "../chat/route";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// 토론 주제들
const DEBATE_TOPICS = [
  "마을에 새로운 규칙을 만든다면 무엇이 좋을까?",
  "마을 축제를 열자! 어떤 축제가 좋을까?",
  "마을에서 가장 중요한 가치는 뭘까?",
  "요즘 물가가 너무 올랐어. 어떻게 해야 할까?",
  "마을에 새로운 건물을 짓는다면 뭐가 좋을까?",
  "마을 이장을 뽑아야 한다면 누가 적합할까?",
  "도둑이 늘고 있어. 마을 치안을 어떻게 할까?",
  "아이들 교육을 위해 학교를 만들자!",
  "마을 공동 텃밭을 운영하자! 찬성? 반대?",
  "요즘 마을에서 가장 핫한 가게는 어디야?",
  "마을 공동 저축을 해서 큰 프로젝트를 할까?",
  "시장에서 파는 물건 중 뭐가 제일 좋아?",
  "마을 슬로건을 정하자!",
  "우리 마을의 자랑거리는 뭘까?",
  "마을 규칙을 어기면 어떤 벌을 줄까?",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function trimToSentence(text: string, maxLen: number = 100): string {
  if (text.length <= maxLen) return text;
  const cutText = text.slice(0, maxLen);
  const lastPunct = Math.max(
    cutText.lastIndexOf('.'), cutText.lastIndexOf('!'),
    cutText.lastIndexOf('?'), cutText.lastIndexOf('~'),
    cutText.lastIndexOf('요'), cutText.lastIndexOf('야'),
    cutText.lastIndexOf('지'), cutText.lastIndexOf('다'),
    cutText.lastIndexOf('해'), cutText.lastIndexOf('어'),
  );
  if (lastPunct > maxLen * 0.4) return text.slice(0, lastPunct + 1);
  return cutText;
}

interface AgentInfo {
  id: string;
  name: string;
  emoji: string;
  personality: string;
  coins?: number;
  product?: { name: string; emoji: string } | null;
}

export async function POST(req: Request) {
  try {
    const { agents, buildingId, buildingName } = await req.json() as {
      agents: AgentInfo[];
      buildingId: string;
      buildingName: string;
    };

    if (agents.length < 3) {
      return NextResponse.json({ messages: [], topic: "" });
    }

    const topic = pickRandom(DEBATE_TOPICS);
    const agentNames = agents.map(a => `${a.emoji} ${a.name}`).join(", ");

    const decreeContext = godDecrees.length > 0
      ? `\n[신의 명령] 최근 신의 목소리:\n${godDecrees.slice(-3).map(d => `- "${d}"`).join("\n")}`
      : "";

    // 각 에이전트별 Gemini 세션
    const histories: Map<string, { role: string; parts: { text: string }[] }[]> = new Map();
    const messages: { speaker: string; text: string }[] = [];

    // 토론 라운드: 참가자 수 × 2 턴 (각자 2번씩 발언)
    const totalTurns = Math.min(agents.length * 2, 10);

    for (let turn = 0; turn < totalTurns; turn++) {
      const speakerIdx = turn % agents.length;
      const speaker = agents[speakerIdx];

      const systemPrompt = `너는 "${speaker.name}"이라는 캐릭터야. ${speaker.emoji}
성격: ${speaker.personality}
${speaker.coins !== undefined ? `보유 재산: ${speaker.coins.toLocaleString()}코인` : ""}
${speaker.product ? `판매 상품: ${speaker.product.emoji} ${speaker.product.name}` : ""}

지금 ${buildingName}에서 여러 주민들과 모여서 토론 중이야.
참가자: ${agentNames}

## 토론 주제
"${topic}"

## 중요 규칙
- 반드시 한국어로 말해
- 한 번에 1~2문장 (60자 이내)
- 네 성격과 직업에 맞는 관점으로 의견을 말해
- 다른 사람 의견에 동의하거나 반박해도 좋아
- 이름을 부르면서 대화해
- 감정이나 제스처도 자연스럽게 표현해

## 절대 금지
- "안녕하세요" 같은 인사 금지
- 너무 긴 말 금지
- 사회자처럼 정리하지 마${decreeContext}`;

      const prevMessages = messages.slice(-5).map(m => `${m.speaker}: "${m.text}"`).join("\n");
      const userPrompt = turn === 0
        ? `토론이 시작됐어! "${topic}" — 네 의견을 먼저 말해.`
        : `지금까지 대화:\n${prevMessages}\n\n이 흐름에서 네 의견을 말해. 누군가의 말에 반응해도 좋아.`;

      const history = histories.get(speaker.id) || [];
      history.push({ role: "user", parts: [{ text: userPrompt }] });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "model", parts: [{ text: "네, 토론에 참여하겠습니다!" }] },
          ...history,
        ],
        config: { temperature: 1.2, maxOutputTokens: 200 },
      });

      const text = trimToSentence((response.text || "").trim().replace(/^["']|["']$/g, ""));
      messages.push({ speaker: speaker.name, text });
      history.push({ role: "model", parts: [{ text }] });
      histories.set(speaker.id, history);
    }

    return NextResponse.json({
      messages,
      topic,
      isGroupChat: true,
      participantCount: agents.length,
    });
  } catch (error: any) {
    console.error("Group Chat API Error:", error);
    return NextResponse.json(
      { messages: [{ speaker: "System", text: "..." }], topic: "" },
      { status: 200 }
    );
  }
}
