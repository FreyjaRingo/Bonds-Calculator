import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { parseMaybankPriceIndicationText, isMaybankPriceIndicationText } from "@/lib/priceQuoteParser";

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "File PDF wajib diupload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File PDF wajib diupload." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parser = new PDFParse({ data: buffer });
  let text: string;
  try {
    const result = await parser.getText();
    text = result.text;
  } catch (err) {
    console.error("PDF parse error:", err);
    return NextResponse.json({ error: "Gagal membaca file PDF." }, { status: 400 });
  } finally {
    await parser.destroy();
  }

  if (!isMaybankPriceIndicationText(text)) {
    return NextResponse.json(
      { error: "Format PDF tidak dikenali. Upload file 'BOND PRICE INDICATION' dari Maybank." },
      { status: 422 }
    );
  }

  const parsed = parseMaybankPriceIndicationText(text);
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "Tidak ada baris harga yang berhasil terbaca dari PDF ini." }, { status: 422 });
  }

  return NextResponse.json(parsed);
}
