import { NextRequest, NextResponse } from "next/server";

// GET /api/proxy/glb?url=<encoded_tripo_url>
// 服务端代理下载 Tripo3D 签名 URL 的 GLB 文件，解决浏览器 CORS 问题
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Missing url parameter", { status: 400 });

  try {
    const res = await fetch(decodeURIComponent(url), { cache: "no-store" });
    if (!res.ok) {
      return new NextResponse(`Upstream error: ${res.status}`, { status: 502 });
    }
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "model/gltf-binary",
        "Cache-Control": "public, max-age=7200",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[proxy/glb] fetch failed:", err);
    return new NextResponse(String(err), { status: 502 });
  }
}
