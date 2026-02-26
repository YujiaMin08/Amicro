import { NextRequest, NextResponse } from "next/server";
import { convertToClayStyle } from "@/lib/nanobanana";

export const maxDuration = 60;

// POST /api/generate/style
// 上传原始图片 → 返回黏土风格 2D 图片
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) return NextResponse.json({ error: "请上传图片" }, { status: 400 });
    if (!imageFile.type.startsWith("image/")) return NextResponse.json({ error: "只支持图片格式" }, { status: 400 });
    if (imageFile.size > 10 * 1024 * 1024) return NextResponse.json({ error: "图片不能超过 10MB" }, { status: 400 });

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

    console.log("[style] 调用 nanobanana...");
    const result = await convertToClayStyle(imageBuffer, imageFile.type);
    console.log("[style] 完成 ✓");

    return NextResponse.json({ styledImageDataUrl: result.imageDataUrl });
  } catch (err) {
    console.error("[style] 失败:", err);
    return NextResponse.json(
      { error: "风格转换失败", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
