import { NextRequest, NextResponse } from "next/server";
import { generate3DFromImage } from "@/lib/copilot3d";

export const maxDuration = 60;

// POST /api/generate/model
// 接收黏土风格图片 base64 → 返回 GLB 3D 模型
export async function POST(request: NextRequest) {
  try {
    const { styledImageBase64, mimeType } = await request.json() as {
      styledImageBase64: string;
      mimeType: string;
    };

    if (!styledImageBase64) return NextResponse.json({ error: "缺少图片数据" }, { status: 400 });

    const imageBuffer = Buffer.from(styledImageBase64, "base64");

    console.log("[model] 调用 Copilot 3D, size:", Math.round(imageBuffer.length / 1024), "KB");
    const result = await generate3DFromImage(imageBuffer, mimeType ?? "image/png");
    console.log("[model] 完成 ✓ modelUrl:", result.modelUrl ? result.modelUrl : "(base64)");

    return NextResponse.json({
      modelUrl: result.modelUrl,
      modelBase64: result.modelBase64,
    });
  } catch (err) {
    console.error("[model] 失败:", err);
    return NextResponse.json(
      { error: "3D 模型生成失败", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
