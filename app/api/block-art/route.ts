import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const VALID_COLORS: Record<string, string> = {
  "R": "#e74c3c", // 빨강
  "O": "#e67e22", // 주황
  "Y": "#f1c40f", // 노랑
  "G": "#2ecc71", // 초록
  "B": "#3498db", // 파랑
  "N": "#2c3e50", // 남색
  "V": "#9b59b6", // 보라
  "P": "#e91e63", // 분홍
  "W": "#ecf0f1", // 하양
  "K": "#2d3436", // 검정
  "T": "#8b6914", // 갈색
  "S": "#74b9ff", // 하늘
  ".": "",         // 빈칸
};

export async function POST(req: NextRequest) {
  try {
    const { agentName, personality, mood } = await req.json();

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `너는 "${agentName}"이라는 캐릭터야. 성격: ${personality}.
지금 기분: ${mood || "좋음"}

블록으로 픽셀아트를 만들어줘! 뭐든 자유롭게 — 동물, 음식, 풍경, 감정, 물건, 추상화 뭐든!
네 성격과 기분에 맞는 걸 만들어.

규칙:
- 크기: 가로 5~10칸, 세로 5~10칸
- 사용 가능한 색: R(빨강) O(주황) Y(노랑) G(초록) B(파랑) N(남색) V(보라) P(분홍) W(하양) K(검정) T(갈색) S(하늘) .(빈칸)
- 각 줄은 같은 길이여야 해

JSON만 응답해:
{"name": "작품이름", "grid": ["RRGGBB", "RRGGBB", ...]}

예시:
{"name": "선인장", "grid": ["..G..","..G..",".GGG.","..G..","..T.."]}`,
      config: {
        temperature: 1.5,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
      },
    });

    const text = result.text || "";
    const parsed = JSON.parse(text);

    if (!parsed.name || !parsed.grid || !Array.isArray(parsed.grid)) {
      return NextResponse.json({ error: "invalid format" }, { status: 400 });
    }

    // 그리드 유효성 검증 + 색상 변환
    const grid: string[][] = [];
    const width = parsed.grid[0]?.length || 0;
    for (const row of parsed.grid) {
      if (typeof row !== "string") continue;
      const cells: string[] = [];
      for (const ch of row) {
        if (VALID_COLORS[ch] !== undefined) {
          cells.push(ch);
        } else {
          cells.push("."); // 알 수 없는 문자 → 빈칸
        }
      }
      // 너비 맞추기
      while (cells.length < width) cells.push(".");
      grid.push(cells.slice(0, Math.min(width, 12)));
    }

    return NextResponse.json({
      name: parsed.name.slice(0, 20),
      grid: grid.slice(0, 12),
      colors: VALID_COLORS,
    });
  } catch (e: unknown) {
    console.error("block-art error:", e);
    return NextResponse.json({ error: "generation failed" }, { status: 500 });
  }
}
