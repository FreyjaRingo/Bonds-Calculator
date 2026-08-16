import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bondSchema } from "@/lib/bond-schema";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const bond = await prisma.bond.findUnique({ where: { id } });
  if (!bond) return NextResponse.json({ error: "Obligasi tidak ditemukan" }, { status: 404 });
  return NextResponse.json(bond);
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const body = await request.json();
  const parsed = bondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" }, { status: 400 });
  }

  const conflict = await prisma.bond.findFirst({ where: { name: parsed.data.name, NOT: { id } } });
  if (conflict) {
    return NextResponse.json({ error: `Obligasi "${parsed.data.name}" sudah ada di database.` }, { status: 409 });
  }

  try {
    const bond = await prisma.bond.update({ where: { id }, data: parsed.data });
    return NextResponse.json(bond);
  } catch {
    return NextResponse.json({ error: "Obligasi tidak ditemukan" }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    await prisma.bond.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Obligasi tidak ditemukan" }, { status: 404 });
  }
}
