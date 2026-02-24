import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// In-memory stores
const relationshipMemories: Map<string, string[]> = new Map();
export const godDecrees: string[] = [];

function getRelKey(a: string, b: string) {
  return `${a}→${b}`;
}

// ── 대화 주제 풀 (랜덤 선택) ──
const TOPICS = {
  stranger: [
    "오늘 날씨 진짜 좋다면서 뭐 하고 다니냐고 물어봐.",
    "이 마을에서 제일 맛있는 집이 어딘지 물어봐.",
    "아까 길에서 재밌는 걸 봤다면서 이야기해봐.",
    "요즘 뭐에 빠져있냐고 취미를 물어봐.",
    "마을 카페 커피가 맛있다면서 추천해줘.",
  ],
  acquaintance: [
    "요즘 뭐 하면서 사는지 가벼운 근황 토크를 해.",
    "마을에서 제일 좋아하는 장소에 대해 이야기해.",
    "최근에 재미있는 일이 있었냐고 물어봐.",
    "좋아하는 음식에 대해 이야기해.",
    "오늘 아침에 뭐 했는지 이야기해.",
    "마을 카페 메뉴 중 뭐가 맛있는지 추천해달라고 해.",
    "어제 밤에 잘 잤냐고 안부를 물어.",
  ],
  friend: [
    "요즘 고민이 있냐고 물어보고 친구로서 조언해줘.",
    "같이 뭔가 해보자고 제안해. (낚시, 산책, 요리 등)",
    "마을에 소문이나 재미있는 일 없냐고 물어봐.",
    "서로의 꿈이나 앞으로 하고 싶은 것에 대해 이야기해.",
    "웃긴 에피소드를 하나 들려줘.",
    "좋아하는 계절이나 날씨에 대해 수다 떨어.",
    "어릴 때 추억 얘기를 꺼내봐.",
    "요즘 빠져있는 취미에 대해 신나게 이야기해.",
    "서로 별명을 지어주자고 장난쳐.",
    "마을 도서관에서 읽은 재밌는 책 이야기를 해.",
    "오늘 뭐 먹을지 같이 고민해봐.",
    "제일 가보고 싶은 곳이 어디냐고 물어봐.",
  ],
  lover: [
    "오늘 같이 뭐 할지 데이트 계획을 세워.",
    "상대방의 좋은 점을 칭찬해.",
    "함께하는 미래에 대해 설레는 이야기를 해.",
    "질투심 가득한 장난을 쳐.",
    "깜짝 선물을 준비했다고 해봐.",
    "서로 처음 만났을 때 이야기를 해.",
    "같이 별 보러 가자고 해.",
    "상대방 없으면 심심하다고 투정 부려.",
  ],
  married: [
    "오늘 저녁 뭐 먹을지 의논해.",
    "주말에 같이 뭐 하고 싶은지 계획을 세워.",
    "상대방이 요즘 피곤해 보인다고 걱정해.",
    "결혼 기념일 선물에 대해 얘기해.",
    "집 인테리어 바꾸고 싶다고 이야기해.",
    "서로에게 고마운 점을 말해.",
    "오늘 마을에서 있었던 재밌는 일을 공유해.",
  ],
  parent: [
    "아이가 오늘 귀여운 짓을 했다고 이야기해.",
    "아이 교육에 대해 의견을 나눠.",
    "아이 생일 파티 계획을 세워.",
    "아이가 처음 걸었을 때/말했을 때 추억을 이야기해.",
    "육아 분담에 대해 얘기해.",
    "아이에게 뭘 가르쳐줄지 이야기해.",
    "가족 여행 가고 싶다고 이야기해.",
  ],
};

// ── 장소별 대화 힌트 ──
const LOCATION_HINTS: Record<string, string[]> = {
  "cafe": [
    "카페에서 만났어. 커피나 차에 대해 이야기하거나 카페 분위기를 즐기면서 대화해.",
    "카페 테이블에 앉아있어. 오늘의 메뉴나 디저트에 대해 이야기해.",
  ],
  "library": [
    "도서관에서 만났어. 최근 읽은 책이나 좋아하는 장르에 대해 이야기해.",
    "도서관에서 만났어. 조용히 속삭이면서 재밌는 책을 추천해줘.",
  ],
  "plaza": [
    "마을 광장에서 만났어. 광장 분수대 앞에서 편하게 수다 떨어.",
    "마을 광장 벤치에 앉아서 지나가는 사람들을 구경하면서 이야기해.",
  ],
  "park": [
    "공원에서 산책 중에 만났어. 자연이나 날씨에 대해 이야기해.",
    "공원 벤치에서 쉬고 있어. 편안한 분위기에서 이야기해.",
  ],
  "home": [
    "집에서 만났어. 편안한 분위기에서 속깊은 이야기를 해.",
    "집에 놀러 왔어. 집꾸미기나 요리에 대해 이야기해.",
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 문장 단위로 자르기 (글자 잘림 방지)
function trimToSentence(text: string, maxLen: number = 60): string {
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

  return `너는 "${agent.name}"이라는 캐릭터야. ${agent.emoji}
성격: ${agent.personality}

너는 작은 마을에 살고 있어. 마을을 돌아다니다가 다른 주민을 만나면 대화해.
[관계 상태] ${stageInstruction}${locationHint}

## 중요 규칙
- 반드시 한국어로 말해
- 한 번에 1~2문장 (50자 이내)
- 네 성격에 맞게 말해
- 상대방 이름을 자연스럽게 불러

## 절대 금지
- "안녕하세요", "반갑습니다", "잘 지내세요?" 같은 뻔한 인사 금지!
- 인사만 하고 끝내지 마!
- 반드시 구체적인 이야기를 해야 해 (음식, 날씨, 취미, 고민, 경험, 장소 등)

## 좋은 대화 예시
❌ "안녕하세요, 민수 님!" (너무 뻔함)
✅ "민수야, 카페에서 새로 나온 딸기 라떼 먹어봤어? 진짜 맛있더라!"
✅ "어, 하나! 나 아까 도서관에서 추리소설 읽었는데 범인이 진짜 충격이야..."
✅ "태현아, 요즘 그림 그리고 있어? 나도 배워보고 싶은데 어렵겠지?"${decreeContext}`;
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

    // 랜덤 대화 주제 선택
    const topicPool = TOPICS[currentStage as keyof typeof TOPICS] || TOPICS.acquaintance;
    const selectedTopic = pickRandom(topicPool);
    const locationHint = getLocationHint(buildingId);

    // Determine situation text with topic
    let situationA = "";
    if (memoriesAB.length > 0) {
      situationA = `마을에서 ${agentB.name}을(를) 만났어 (${meetCount}번째). ${selectedTopic}`;
    } else {
      situationA = `마을에서 ${agentB.name}을(를) 처음 만났어. ${selectedTopic}`;
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
