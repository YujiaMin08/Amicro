import { NextRequest, NextResponse } from "next/server";
import { uploadImageToTripo } from "@/lib/tripo3d";

// POST /api/tripo/upload
// Body: FormData { image: File } or JSON { base64: string, mimeType: string }
// Response: { fileToken: string }
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    let imageBuffer: Buffer;
    let mimeType: string;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("image") as File | null;
      if (!file) return NextResponse.json({ error: "缺少 image 文件" }, { status: 400 });
      imageBuffer = Buffer.from(await file.arrayBuffer());
      mimeType = file.type;
    } else {
      // JSON with base64
      const body = await request.json() as { base64: string; mimeType: string };
      imageBuffer = Buffer.from(body.base64, "base64");
      mimeType = body.mimeType ?? "image/png";
    }

    console.log("[tripo/upload] 上传图片, size:", Math.round(imageBuffer.length / 1024), "KB");
    const fileToken = await uploadImageToTripo(imageBuffer, mimeType);
    console.log("[tripo/upload] 完成 ✓ fileToken:", fileToken.slice(0, 20) + "...");

    return NextResponse.json({ fileToken });
  } catch (err) {
    console.error("[tripo/upload] 失败:", err);
    return NextResponse.json(
      { error: "上传失败", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
