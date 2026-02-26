import { NextRequest, NextResponse } from "next/server";
import { convertToClayStyle } from "@/lib/nanobanana";
import { generate3DFromImage } from "@/lib/copilot3d";

export const maxDuration = 60;

// ─── POST /api/generate ────────────────────────────────────────────────────────
// 完整管道：图片 → nanobanana 黏土风格 → Copilot 3D → GLB 模型
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;

    // ── 基本校验 ────────────────────────────────────────────────────────────
    if (!imageFile) {
      return NextResponse.json({ error: "请上传图片文件" }, { status: 400 });
    }
    if (!imageFile.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "只支持图片格式（JPG、PNG、WEBP 等）" },
        { status: 400 }
      );
    }
    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "图片大小不能超过 10MB" },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

    // ── Step 1: nanobanana —— 转换为黏土玩具风格 ────────────────────────────
    console.log("[generate] Step 1: 调用 nanobanana 进行风格转换...");
    let styledImageBuffer: Buffer;
    let styledMimeType: string;

    try {
      const result = await convertToClayStyle(imageBuffer, imageFile.type);

      // imageDataUrl 格式：data:<mime>;base64,<data>
      const base64Data = result.imageDataUrl.split(",")[1];
      styledImageBuffer = Buffer.from(base64Data, "base64");
      styledMimeType = result.mimeType;
      console.log("[generate] Step 1 完成 ✓ mime:", styledMimeType);
    } catch (err) {
      console.error("[generate] nanobanana 调用失败:", err);
      return NextResponse.json(
        {
          error: "图片风格转换失败",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 502 }
      );
    }

    // ── Step 2: Copilot 3D —— 生成 GLB 3D 模型 ──────────────────────────────
    console.log("[generate] Step 2: 调用 Copilot 3D 生成模型...");
    try {
      const result = await generate3DFromImage(styledImageBuffer, styledMimeType);
      console.log("[generate] Step 2 完成 ✓ modelUrl:", result.modelUrl ? result.modelUrl : "(base64)");

      return NextResponse.json({
        // 直接返回 URL（若 Copilot 3D 返回 URL）
        modelUrl: result.modelUrl,
        // 或返回 base64（若 Copilot 3D 返回 base64 GLB）
        modelBase64: result.modelBase64,
      });
    } catch (err) {
      console.error("[generate] Copilot 3D 调用失败:", err);
      return NextResponse.json(
        {
          error: "3D 模型生成失败",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("[generate] 未知错误:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
