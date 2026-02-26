import { NextRequest, NextResponse } from "next/server";
import { generateClayCharacterFromText } from "@/lib/nanobanana";

export const maxDuration = 60;

// POST /api/generate/text-style
// Body: { gender: "male" | "female", name?: string }
// Response: { styledImageDataUrl: string }
// 根据文字描述生成 2D 黏土风格角色图（随机创建流程）
export async function POST(request: NextRequest) {
  try {
    const { gender, name } = await request.json() as {
      gender: "male" | "female";
      name?: string;
    };

    if (!gender) return NextResponse.json({ error: "缺少 gender 参数" }, { status: 400 });

    console.log("[text-style] 生成角色:", gender, name);
    const result = await generateClayCharacterFromText(gender, name);
    console.log("[text-style] 完成 ✓");

    return NextResponse.json({ styledImageDataUrl: result.imageDataUrl });
  } catch (err) {
    console.error("[text-style] 失败:", err);
    return NextResponse.json(
      { error: "角色图生成失败", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
