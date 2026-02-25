import { NextResponse } from "next/server";

// CoinGecko 무료 API (키 불필요)
const COINGECKO_API = "https://api.coingecko.com/api/v3";

export async function GET() {
  try {
    // 시가총액 상위 30 + 트렌딩 코인
    const [topCoins, trending] = await Promise.all([
      fetch(`${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1&sparkline=false&price_change_percentage=1h,24h,7d`)
        .then(r => r.json()).catch(() => []),
      fetch(`${COINGECKO_API}/search/trending`)
        .then(r => r.json()).catch(() => ({ coins: [] })),
    ]);

    const topList = Array.isArray(topCoins) ? topCoins.map((c: any) => ({
      symbol: c.symbol?.toUpperCase(),
      name: c.name,
      price: c.current_price,
      change24h: c.price_change_percentage_24h,
      change7d: c.price_change_percentage_7d_in_currency,
      marketCap: c.market_cap,
      volume: c.total_volume,
      rank: c.market_cap_rank,
    })) : [];

    const trendingList = (trending?.coins || []).map((c: any) => ({
      symbol: c.item?.symbol?.toUpperCase(),
      name: c.item?.name,
      rank: c.item?.market_cap_rank,
      score: c.item?.score,
    }));

    return NextResponse.json({
      topCoins: topList,
      trending: trendingList,
      timestamp: Date.now(),
    });
  } catch (e) {
    console.error("crypto-data error:", e);
    return NextResponse.json({ topCoins: [], trending: [], timestamp: Date.now() });
  }
}
