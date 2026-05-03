import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const res = await fetch("https://trade-api.gateway.uniswap.org/v1/quote", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.UNISWAP_API_KEY || "",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
