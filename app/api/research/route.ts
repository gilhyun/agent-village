import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// ── 에이전트 리서치 소스 ──
// 크립토 뉴스 + 트렌딩 + 시세 + 소셜 시그널을 수집

interface CoinPick {
  symbol: string;
  name: string;
  reason: string;
  confidence: number; // 1-10
  pickedBy: string;
  timestamp: number;
  price?: number;
  change24h?: number;
}

interface ResearchData {
  topCoins: any[];
  trending: any[];
  gainers: any[];
  news: string[];
  timestamp: number;
}

// 캐시: 10분
let researchCache: ResearchData | null = null;
let researchCacheTime = 0;

// 추천 종목 저장소 (서버 메모리)
export const coinPicks: CoinPick[] = [];
// 투표 집계
export const pickVotes: Map<string, { voters: string[]; score: number }> = new Map();

async function gatherResearch(): Promise<ResearchData> {
  const now = Date.now();
  if (researchCache && now - researchCacheTime < 10 * 60 * 1000) {
    return researchCache;
  }

  const results: ResearchData = { topCoins: [], trending: [], gainers: [], news: [], timestamp: now };

  // 1. CoinGecko 시세 (TOP 30)
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1&sparkline=false&price_change_percentage=1h,24h,7d");
    results.topCoins = await res.json();
  } catch {}

  // 2. 트렌딩
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/search/trending");
    const data = await res.json();
    results.trending = (data?.coins || []).map((c: any) => ({
      name: c.item?.name,
      symbol: c.item?.symbol,
      marketCapRank: c.item?.market_cap_rank,
      price: c.item?.data?.price,
      change24h: c.item?.data?.price_change_percentage_24h?.usd,
    }));
  } catch {}

  // 3. 24h 급등 코인 (page 1, volume 순)
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h");
    const all = await res.json();
    if (Array.isArray(all)) {
      results.gainers = all
        .filter((c: any) => c.price_change_percentage_24h > 5)
        .sort((a: any, b: any) => b.price_change_percentage_24h - a.price_change_percentage_24h)
        .slice(0, 10)
        .map((c: any) => ({
          symbol: c.symbol?.toUpperCase(),
          name: c.name,
          price: c.current_price,
          change24h: c.price_change_percentage_24h,
          volume: c.total_volume,
        }));
    }
  } catch {}

  // 4. 크립토 뉴스 (무료 API)
  try {
    const res = await fetch("https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=popular&limit=10");
    const data = await res.json();
    results.news = (data?.Data || []).slice(0, 8).map((n: any) => `${n.title} — ${n.source}`);
  } catch {}

  researchCache = results;
  researchCacheTime = now;
  return results;
}

// 에이전트가 리서치 후 종목 추천
export async function POST(req: Request) {
  try {
    const { agents } = await req.json();

    const research = await gatherResearch();

    // 리서치 데이터 요약
    const marketSummary = Array.isArray(research.topCoins)
      ? research.topCoins.slice(0, 15).map((c: any) =>
          `${c.symbol?.toUpperCase()}: $${c.current_price} (24h: ${c.price_change_percentage_24h?.toFixed(1)}%, 7d: ${c.price_change_percentage_7d_in_currency?.toFixed(1)}%, vol: $${(c.total_volume / 1e6).toFixed(0)}M)`
        ).join("\n")
      : "";

    const trendingSummary = research.trending.map((c: any) =>
      `${c.symbol} (${c.name}) - rank #${c.marketCapRank || "?"}, 24h: ${c.change24h?.toFixed(1) || "?"}%`
    ).join("\n");

    const gainersSummary = research.gainers.map((c: any) =>
      `🚀 ${c.symbol}: $${c.price} (+${c.change24h?.toFixed(1)}%, vol: $${(c.volume / 1e6).toFixed(0)}M)`
    ).join("\n");

    const newsSummary = research.news.join("\n");

    const fullContext = `[시가총액 TOP 15]\n${marketSummary}\n\n[트렌딩 코인]\n${trendingSummary}\n\n[24h 급등 코인]\n${gainersSummary}\n\n[최신 뉴스]\n${newsSummary}`;

    // 이전 추천 히스토리
    const prevPicks = coinPicks.slice(-10).map(p =>
      `${p.pickedBy}: ${p.symbol} (${p.reason}) — 확신도 ${p.confidence}/10`
    ).join("\n");

    // 각 에이전트에게 분석 요청
    const picks: CoinPick[] = [];
    const analyses: { agent: string; analysis: string; pick: CoinPick | null }[] = [];

    for (const agent of (agents || []).slice(0, 5)) {
      try {
        const prompt = `너는 "${agent.name}" — ${agent.personality}

아래 실시간 크립토 데이터를 분석해서, 앞으로 크게 오를 것 같은 코인 1개를 추천해.

${fullContext}

${prevPicks ? `\n[다른 전문가들의 이전 추천]\n${prevPicks}` : ""}

## 규칙
- 너의 전문분야(${agent.personality.slice(0, 20)}...)에 맞는 관점에서 분석
- 반드시 JSON으로 응답:
{
  "analysis": "2-3문장 한국어 분석 (왜 이 코인인지)",
  "symbol": "추천 코인 심볼 (예: BTC, SOL, PEPE)",
  "name": "코인 이름",
  "confidence": 1-10 확신도
}
- 데이터 근거 필수! 감이 아닌 숫자로.
- 이미 다른 사람이 추천한 코인도 OK (동의하면)`;

        const res = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            temperature: 0.8,
            maxOutputTokens: 400,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
          },
        });

        const text = (res.text || "").trim();
        const parsed = JSON.parse(text);

        if (parsed.symbol) {
          const coinData = research.topCoins.find((c: any) => c.symbol?.toUpperCase() === parsed.symbol?.toUpperCase());
          const pick: CoinPick = {
            symbol: parsed.symbol.toUpperCase(),
            name: parsed.name || parsed.symbol,
            reason: parsed.analysis || "",
            confidence: parsed.confidence || 5,
            pickedBy: agent.name,
            timestamp: Date.now(),
            price: coinData?.current_price,
            change24h: coinData?.price_change_percentage_24h,
          };
          picks.push(pick);
          coinPicks.push(pick);
          analyses.push({ agent: agent.name, analysis: parsed.analysis, pick });

          // 투표 집계
          const key = pick.symbol;
          const existing = pickVotes.get(key) || { voters: [], score: 0 };
          if (!existing.voters.includes(agent.name)) {
            existing.voters.push(agent.name);
            existing.score += pick.confidence;
          }
          pickVotes.set(key, existing);
        }
      } catch (e) {
        console.error(`Research error for ${agent.name}:`, e);
      }
    }

    // 컨센서스: 2명 이상 추천한 코인 = "오늘의 추천"
    const consensus: { symbol: string; name: string; voters: string[]; totalScore: number; avgConfidence: number; price?: number; change24h?: number }[] = [];
    pickVotes.forEach((v, symbol) => {
      if (v.voters.length >= 2) {
        const latestPick = coinPicks.filter(p => p.symbol === symbol).pop();
        consensus.push({
          symbol,
          name: latestPick?.name || symbol,
          voters: v.voters,
          totalScore: v.score,
          avgConfidence: Math.round(v.score / v.voters.length * 10) / 10,
          price: latestPick?.price,
          change24h: latestPick?.change24h,
        });
      }
    });
    consensus.sort((a, b) => b.totalScore - a.totalScore);

    // 최근 50개만 유지
    while (coinPicks.length > 50) coinPicks.shift();

    return NextResponse.json({
      analyses,
      picks,
      consensus,
      allPicks: coinPicks.slice(-20),
      researchTimestamp: research.timestamp,
    });
  } catch (e) {
    console.error("research error:", e);
    return NextResponse.json({ analyses: [], picks: [], consensus: [], allPicks: [] }, { status: 500 });
  }
}

// GET: 현재 추천 상태
export async function GET() {
  const consensus: any[] = [];
  pickVotes.forEach((v, symbol) => {
    if (v.voters.length >= 2) {
      const latestPick = coinPicks.filter(p => p.symbol === symbol).pop();
      consensus.push({
        symbol,
        name: latestPick?.name || symbol,
        voters: v.voters,
        totalScore: v.score,
        avgConfidence: Math.round(v.score / v.voters.length * 10) / 10,
        price: latestPick?.price,
        change24h: latestPick?.change24h,
      });
    }
  });
  consensus.sort((a, b) => b.totalScore - a.totalScore);

  return NextResponse.json({
    consensus,
    recentPicks: coinPicks.slice(-20),
    totalResearches: coinPicks.length,
  });
}
