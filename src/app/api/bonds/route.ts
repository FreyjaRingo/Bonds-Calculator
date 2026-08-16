import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bondSchema } from "@/lib/bond-schema";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const bonds = await prisma.bond.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { isinCode: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    take: 50,
  });
  return NextResponse.json(bonds);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = bondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" }, { status: 400 });
  }

  const existing = await prisma.bond.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return NextResponse.json({ error: `Obligasi "${parsed.data.name}" sudah ada di database.` }, { status: 409 });
  }

  const bond = await prisma.bond.create({ data: parsed.data });
  return NextResponse.json(bond, { status: 201 });
}
