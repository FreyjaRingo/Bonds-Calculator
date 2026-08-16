import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const market = request.nextUrl.searchParams.get("market");
  const holidays = await prisma.holiday.findMany({
    where: market === "IDR" || market === "USD" ? { market } : undefined,
    orderBy: { date: "asc" },
  });
  return NextResponse.json(holidays);
}
