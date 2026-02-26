import { NextRequest, NextResponse } from "next/server";
import { getTripoTaskStatus } from "@/lib/tripo3d";

// GET /api/tripo/status?taskId=xxx
// Response: { taskId, status, progress, output }
export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "缺少 taskId" }, { status: 400 });

  try {
    const result = await getTripoTaskStatus(taskId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[tripo/status] 失败:", err);
    return NextResponse.json(
      { error: "状态查询失败", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
