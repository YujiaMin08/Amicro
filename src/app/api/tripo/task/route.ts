import { NextRequest, NextResponse } from "next/server";
import { createTripoTask } from "@/lib/tripo3d";

// POST /api/tripo/task
// 通用任务创建：image_to_model / animate_rig / animate_retarget
// Body: { type, ...params }
// Response: { taskId: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const { type } = body;

    if (!type) return NextResponse.json({ error: "缺少 type 字段" }, { status: 400 });

    console.log(`[tripo/task] 创建任务 type=${type}`);
    const taskId = await createTripoTask(body);
    console.log(`[tripo/task] 完成 ✓ taskId=${taskId}`);

    return NextResponse.json({ taskId });
  } catch (err) {
    console.error("[tripo/task] 失败:", err);
    return NextResponse.json(
      { error: "任务创建失败", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
