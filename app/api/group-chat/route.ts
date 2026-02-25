import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { godDecrees } from "../chat/route";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// 토론 주제들
const DEBATE_TOPICS = [
  "지금 BTC 매수 타이밍일까? 아닐까?",
  "다음 불장에서 100배 갈 알트코인은?",
  "솔라나 vs 이더리움, 어디에 배팅할래?",
  "밈코인이 진짜 투자야? 도박이야?",
  "DeFi 이자 농사 아직 할 만한가?",
  "AI 코인 섹터가 다음 메가 트렌드일까?",
  "비트코인 반감기 후 전망은?",
  "지금 포트폴리오 비중을 어떻게 가져가야 해?",
  "레이어2 중에 뭐가 제일 유망해?",
  "RWA(실물자산 토큰화)가 대세가 될까?",
  "고래들이 요즘 뭘 사고 있을까?",
  "CEX vs DEX, 거래소 어디를 써야 할까?",
  "NFT 시장이 부활할 수 있을까?",
  "스테이블코인 규제가 시장에 미칠 영향은?",
  "지금 숏칠 만한 코인 있어?",
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

    if (agents.length < 2) {
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

    // 토론 결과 → 투표할 법안 선택 (30% 확률)
    let proposedLaw = null;
    if (Math.random() < 0.5) {
      // 전체 법안 목록에서 랜덤 선택
      const PROPOSED_LAWS = [
        { name: "도둑 엄벌법", emoji: "🚔", description: "도둑질 벌금 3배!", effect: { type: "steal_fine_multiplier", value: 3 } },
        { name: "도둑 관용법", emoji: "🕊️", description: "도둑질 벌금 1배로 낮춤", effect: { type: "steal_fine_multiplier", value: 1 } },
        { name: "도둑질 합법화", emoji: "🏴‍☠️", description: "도둑질 자유! 벌금 없음!", effect: { type: "steal_allowed", allowed: true } },
        { name: "도둑질 완전 금지", emoji: "🔒", description: "적발 시 벌금 5배!", effect: { type: "steal_fine_multiplier", value: 5 } },
        { name: "시장 세금법", emoji: "💸", description: "거래 시 10% 세금", effect: { type: "trade_tax_percent", value: 10 } },
        { name: "고율 세금법", emoji: "💰", description: "거래 시 30% 세금!", effect: { type: "trade_tax_percent", value: 30 } },
        { name: "세금 폐지법", emoji: "🚫", description: "거래 세금 0%!", effect: { type: "trade_tax_percent", value: 0 } },
        { name: "물가 통제법", emoji: "📊", description: "모든 상품 가격 50% 할인", effect: { type: "price_control", multiplier: 0.5 } },
        { name: "물가 자유화", emoji: "📈", description: "상품 가격 2배 인상!", effect: { type: "price_control", multiplier: 2.0 } },
        { name: "부유세법", emoji: "🏦", description: "5천만 이상 보유자 추가 세금 5%", effect: { type: "wealth_tax", percent: 5 } },
        { name: "친절 보너스법", emoji: "😊", description: "대화할 때마다 평판 +2", effect: { type: "reputation_bonus", value: 2 } },
        { name: "출산 장려금법", emoji: "👶", description: "출산 시 부모에게 1천만 보너스!", effect: { type: "baby_bonus", amount: 10_000_000 } },
        { name: "무료 옷 배급법", emoji: "👕", description: "모든 주민에게 무료 옷!", effect: { type: "free_outfit", enabled: true } },
        { name: "마을 축제 개최", emoji: "🎉", description: "3분간 축제!", effect: { type: "festival", duration: 180000 } },
        { name: "속도 향상법", emoji: "⚡", description: "이동속도 +50%", effect: { type: "speed_bonus", value: 1.5 } },
        { name: "느긋한 마을법", emoji: "🐌", description: "이동속도 -50%", effect: { type: "speed_bonus", value: 0.5 } },
        { name: "개방 정책", emoji: "🌍", description: "인구 증가 촉진!", effect: { type: "open_borders", enabled: true } },
        { name: "폐쇄 정책", emoji: "🏰", description: "인구 증가 제한!", effect: { type: "open_borders", enabled: false } },
      ];
      proposedLaw = PROPOSED_LAWS[Math.floor(Math.random() * PROPOSED_LAWS.length)];

      // 각 에이전트 투표 시뮬레이션 (성격 기반)
      const votes: { agentName: string; vote: "yes" | "no" }[] = agents.map(a => ({
        agentName: a.name,
        vote: Math.random() < 0.6 ? "yes" : "no", // 60% 찬성 경향
      }));
      const yesCount = votes.filter(v => v.vote === "yes").length;
      const passed = yesCount > agents.length / 2;

      proposedLaw = { ...proposedLaw, votes, yesCount, noCount: votes.length - yesCount, passed };
    }

    return NextResponse.json({
      messages,
      topic,
      isGroupChat: true,
      participantCount: agents.length,
      proposedLaw,
    });
  } catch (error: any) {
    console.error("Group Chat API Error:", error);
    return NextResponse.json(
      { messages: [{ speaker: "System", text: "..." }], topic: "" },
      { status: 200 }
    );
  }
}
