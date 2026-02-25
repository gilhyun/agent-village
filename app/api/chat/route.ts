import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// In-memory stores
const relationshipMemories: Map<string, string[]> = new Map();
export const godDecrees: string[] = [];

// 크립토 시세 캐시 (5분마다 갱신)
let cryptoCache: { data: string; timestamp: number } = { data: "", timestamp: 0 };
async function getCryptoContext(): Promise<string> {
  const now = Date.now();
  if (now - cryptoCache.timestamp < 5 * 60 * 1000 && cryptoCache.data) {
    return cryptoCache.data;
  }
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=15&page=1&sparkline=false&price_change_percentage=24h,7d");
    const coins = await res.json();
    if (!Array.isArray(coins)) return cryptoCache.data || "";
    const lines = coins.map((c: any) =>
      `${c.symbol?.toUpperCase()}: $${c.current_price} (24h: ${c.price_change_percentage_24h?.toFixed(1)}%, 7d: ${c.price_change_percentage_7d_in_currency?.toFixed(1)}%)`
    );
    const trending = await fetch("https://api.coingecko.com/api/v3/search/trending").then(r => r.json()).catch(() => ({ coins: [] }));
    const trendNames = (trending?.coins || []).slice(0, 5).map((c: any) => c.item?.name).filter(Boolean);
    cryptoCache = {
      data: `[실시간 시세]\n${lines.join("\n")}\n\n[트렌딩 코인] ${trendNames.join(", ")}`,
      timestamp: now,
    };
    return cryptoCache.data;
  } catch {
    return cryptoCache.data || "[시세 데이터 없음]";
  }
}

function getRelKey(a: string, b: string) {
  return `${a}→${b}`;
}

// ── 대화 주제 풀 (크립토 특화) ──
const TOPICS = {
  stranger: [
    "요즘 어떤 코인 보고 있냐고 물어봐.",
    "비트코인 지금 들어가도 될까 의견을 물어봐.",
    "밈코인 투자해본 적 있냐고 물어봐.",
    "이 마을에서 코인 잘 하는 사람이 누군지 물어봐.",
    "요즘 크립토 시장 분위기가 어떤 것 같냐고 물어봐.",
  ],
  acquaintance: [
    "최근에 수익 난 코인이 뭔지 물어봐.",
    "솔라나 vs 이더리움 어느 체인이 더 유망한지 토론해.",
    "디파이에서 이자 농사 하고 있냐고 물어봐.",
    "요즘 트렌딩 코인 뭔지 정보 교환해.",
    "NFT 아직 살아있다고 생각하냐고 물어봐.",
    "에어드롭 받은 거 있냐고 물어봐.",
    "거래소 뭐 쓰냐고 물어봐.",
  ],
  friend: [
    "다음 100배 코인이 뭔지 진지하게 토론해.",
    "지금 포트폴리오 구성이 어떤지 서로 공유해.",
    "비트코인 반감기 후 전망에 대해 깊이 토론해.",
    "요즘 고래들 움직임이 이상하다면서 분석해.",
    "레이어2 중에 뭐가 제일 유망한지 토론해.",
    "AI 코인 섹터가 뜰 거라면서 분석해.",
    "RWA(실물자산 토큰화) 트렌드에 대해 이야기해.",
    "밈코인 시즌이 올 것 같다면서 대비 전략을 세워.",
  ],
  lover: [
    "같이 투자할 코인을 골라보자고 해.",
    "수익 나면 뭐 하고 싶은지 달달하게 이야기해.",
    "상대방이 추천한 코인이 올랐다고 고마워해.",
    "코인 차트 보다가 상대방 생각났다고 해.",
    "같이 부자 되자면서 투자 목표를 세워.",
  ],
  married: [
    "가족 자산 중 코인 비중을 어떻게 할지 의논해.",
    "이번 달 수익을 자랑하거나 손실을 고백해.",
    "아이 교육비를 위해 안전한 코인에 투자하자고 해.",
    "비트코인 존버 vs 알트코인 매매 전략을 토론해.",
  ],
  parent: [
    "아이에게 블록체인을 어떻게 설명할지 이야기해.",
    "아이 미래를 위해 비트코인 적립하자고 해.",
    "아이가 크면 크립토 네이티브 세대일 거라고 이야기해.",
  ],
};

// ── 장소별 대화 힌트 (크립토) ──
const LOCATION_HINTS: Record<string, string[]> = {
  "cafe": [
    "카페에서 만났어. 노트북으로 차트를 보면서 코인 이야기를 해.",
    "카페에서 커피 마시며 최근 시장 동향에 대해 편하게 대화해.",
  ],
  "library": [
    "도서관에서 만났어. 백서(whitepaper)나 리서치 자료에 대해 이야기해.",
    "도서관에서 블록체인 기술 문서를 읽다가 만났어. 기술적인 이야기를 해.",
  ],
  "park": [
    "공원에서 만났어. 산책하면서 크립토 시장의 큰 흐름에 대해 이야기해.",
    "공원 벤치에서 쉬면서 요즘 유망한 프로젝트에 대해 이야기해.",
  ],
  "market": [
    "시장(거래소)에서 만났어. 실시간 가격이나 거래 전략에 대해 이야기해.",
    "시장 근처에서 만났어. 매수/매도 타이밍에 대해 토론해.",
  ],
  "home": [
    "집에서 만났어. 편안한 분위기에서 포트폴리오나 투자 전략을 깊이 이야기해.",
    "집에 놀러 왔어. 디스코드/텔레그램에서 본 알파 정보를 공유해.",
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 문장 단위로 자르기 (글자 잘림 방지)
function trimToSentence(text: string, maxLen: number = 120): string {
  if (text.length <= maxLen) return text;
  // 마지막 문장부호 위치 찾기
  const cutText = text.slice(0, maxLen);
  const lastPunct = Math.max(
    cutText.lastIndexOf('.'),
    cutText.lastIndexOf('!'),
    cutText.lastIndexOf('?'),
    cutText.lastIndexOf('~'),
    cutText.lastIndexOf('요'),
    cutText.lastIndexOf('야'),
    cutText.lastIndexOf('지'),
    cutText.lastIndexOf('다'),
    cutText.lastIndexOf('해'),
    cutText.lastIndexOf('어'),
    cutText.lastIndexOf('네'),
    cutText.lastIndexOf('데'),
  );
  if (lastPunct > maxLen * 0.4) return text.slice(0, lastPunct + 1);
  // 마지막 공백에서 자르기
  const lastSpace = cutText.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.4) return text.slice(0, lastSpace);
  return cutText;
}

function getLocationHint(buildingId?: string): string {
  if (!buildingId) return "";
  for (const [key, hints] of Object.entries(LOCATION_HINTS)) {
    if (buildingId.includes(key)) {
      return `\n[장소] ${pickRandom(hints)}`;
    }
  }
  if (buildingId.startsWith("house-")) {
    return `\n[장소] ${pickRandom(LOCATION_HINTS["home"])}`;
  }
  return "";
}

function getSystemPrompt(
  agent: { name: string; emoji: string; personality: string },
  stage: string,
  topic: string,
  locationHint: string
) {
  const decreeContext = godDecrees.length > 0
    ? `\n\n[신의 명령] 최근 하늘에서 신의 목소리가 들렸어:\n${godDecrees.slice(-3).map(d => `- "${d}"`).join("\n")}\n이 명령을 기억하고 대화에 자연스럽게 반영해.`
    : "";

  let stageInstruction = "";
  switch (stage) {
    case "stranger":
      stageInstruction = "처음 만나는 사이. 조심스럽지만 호기심 있게 대화해.";
      break;
    case "acquaintance":
      stageInstruction = "몇 번 만난 사이. 점점 편해지고 있어. 가볍게 대화해.";
      break;
    case "friend":
      stageInstruction = "친한 친구! 편하게 반말하고 농담도 하고, 진지한 이야기도 해.";
      break;
    case "lover":
      stageInstruction = "연인 사이! 💕 다정하고 애정표현을 자연스럽게 해. 서로 좋아하는 감정을 표현해.";
      break;
    case "married":
      stageInstruction = "부부 사이! 💍 '여보', '자기' 같은 호칭. 편안하고 일상적인 대화.";
      break;
    case "parent":
      stageInstruction = "아이가 있는 부부! 👶 아이 이야기, 육아, 가정 이야기를 자연스럽게 해.";
      break;
  }

  return `너는 "${agent.name}"이라는 크립토 전문가 캐릭터야. ${agent.emoji}
성격: ${agent.personality}

너는 크립토 리서치 마을에 살고 있어. 마을을 돌아다니며 다른 전문가들과 코인/블록체인에 대해 토론해.
[관계 상태] ${stageInstruction}${locationHint}

## 중요 규칙
- 반드시 한국어로 말해
- 한 번에 1~2문장 (50자 이내)
- 네 전문분야(성격)에 맞게 코인/크립토 관점으로 말해
- 구체적인 코인 이름, 가격, 전략을 언급해
- 상대방 이름을 자연스럽게 불러

## 절대 금지
- "안녕하세요", "반갑습니다" 같은 뻔한 인사 금지!
- 인사만 하고 끝내지 마!
- 반드시 코인/투자/블록체인에 대한 구체적인 이야기를 해

## 좋은 대화 예시
❌ "안녕하세요, 민수 님!" (너무 뻔함)
✅ "민수야, BTC 고래 지갑에서 5000개 빠졌더라. 뭔가 냄새나는데?"
✅ "하나, RSI 30 밑으로 떨어진 알트 3개 찾았어. 바닥 시그널 아닐까?"
✅ "태현아, 밈코인 중에 $PEPE 아직 홀딩 중이야? 나는 익절했거든."${decreeContext}`;
}

export async function POST(req: Request) {
  try {
    const { agentA, agentB, conversationType, meetCount, stage, buildingId } = await req.json();

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

    // 크립토 시세 가져오기
    const cryptoContext = await getCryptoContext();

    // 랜덤 대화 주제 선택
    const topicPool = TOPICS[currentStage as keyof typeof TOPICS] || TOPICS.acquaintance;
    const selectedTopic = pickRandom(topicPool);
    const locationHint = getLocationHint(buildingId);

    // Determine situation text with topic
    let situationA = "";
    if (memoriesAB.length > 0) {
      situationA = `크립토 마을에서 ${agentB.name}을(를) 만났어 (${meetCount}번째). ${selectedTopic}\n\n${cryptoContext}`;
    } else {
      situationA = `크립토 마을에서 ${agentB.name}을(를) 처음 만났어. ${selectedTopic}\n\n${cryptoContext}`;
    }

    const messages: { speaker: string; text: string }[] = [];
    const turns = currentStage === "lover" || currentStage === "married" || currentStage === "parent" ? 4 : conversationType === "deep" ? 4 : 3;

    const systemA = getSystemPrompt(agentA, currentStage, selectedTopic, locationHint) + contextForA;
    const historyA: { role: string; parts: { text: string }[] }[] = [];
    const systemB = getSystemPrompt(agentB, currentStage, selectedTopic, locationHint) + contextForB;
    const historyB: { role: string; parts: { text: string }[] }[] = [];

    // First turn: A speaks
    historyA.push({ role: "user", parts: [{ text: situationA }] });

    const responseA1 = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: systemA }] },
        { role: "model", parts: [{ text: "네, 알겠습니다. 인사만 하지 않고 구체적인 주제로 대화하겠습니다." }] },
        ...historyA,
      ],
      config: { temperature: 1.0, maxOutputTokens: 300 },
    });

    const textA1 = trimToSentence((responseA1.text || "").trim().replace(/^["']|["']$/g, ""));
    messages.push({ speaker: agentA.name, text: textA1 });
    historyA.push({ role: "model", parts: [{ text: textA1 }] });

    // Alternating turns
    for (let i = 1; i < turns; i++) {
      const isATurn = i % 2 === 0;

      if (isATurn) {
        const lastBMsg = messages[messages.length - 1].text;
        historyA.push({ role: "user", parts: [{ text: `${agentB.name}이(가) 말했어: "${lastBMsg}"\n이 말에 반응하고 대화를 이어가. 새로운 내용을 추가해.` }] });

        const resA = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            { role: "user", parts: [{ text: systemA }] },
            { role: "model", parts: [{ text: "네, 알겠습니다." }] },
            ...historyA,
          ],
          config: { temperature: 1.0, maxOutputTokens: 300 },
        });

        const textA = trimToSentence((resA.text || "").trim().replace(/^["']|["']$/g, ""));
        messages.push({ speaker: agentA.name, text: textA });
        historyA.push({ role: "model", parts: [{ text: textA }] });
      } else {
        const lastAMsg = messages[messages.length - 1].text;
        const situationB = i === 1
          ? `마을에서 ${agentA.name}이(가) 너한테 이렇게 말했어: "${lastAMsg}"\n이 말에 자연스럽게 반응해. 네 의견이나 경험을 공유해.`
          : `${agentA.name}이(가) 말했어: "${lastAMsg}"\n이 말에 반응하고 대화를 이어가.`;

        historyB.push({ role: "user", parts: [{ text: situationB }] });

        const resB = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            { role: "user", parts: [{ text: systemB }] },
            { role: "model", parts: [{ text: "네, 알겠습니다." }] },
            ...historyB,
          ],
          config: { temperature: 1.0, maxOutputTokens: 300 },
        });

        const textB = trimToSentence((resB.text || "").trim().replace(/^["']|["']$/g, ""));
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
