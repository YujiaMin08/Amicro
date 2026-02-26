/**
 * Tripo3D API v2 客户端
 * Base URL: https://api.tripo3d.ai/v2/openapi
 * Docs: https://platform.tripo3d.ai/docs/
 *
 * 完整管道：
 *   uploadImage → image_to_model → animate_rig → animate_retarget → animated GLB
 */

const TRIPO_API_KEY = process.env.TRIPO_API_KEY ?? "";
const TRIPO_BASE = "https://api.tripo3d.ai/v2/openapi";

// ─── 通用工具 ────────────────────────────────────────────────────────────────

function tripoHeaders(contentType = "application/json") {
  return {
    Authorization: `Bearer ${TRIPO_API_KEY}`,
    "Content-Type": contentType,
  };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── 任务状态类型 ─────────────────────────────────────────────────────────────

export type TripoStatus = "queued" | "running" | "success" | "failed" | "cancelled" | "unknown";

export interface TripoTaskResult {
  taskId: string;
  status: TripoStatus;
  progress: number;
  // 完成后的输出
  output?: {
    model?: { url: string };
    pbr_model?: { url: string };
    base_model?: { url: string };
    rendered_image?: { url: string };
  };
}

// ─── 1. 上传图片 → file_token ─────────────────────────────────────────────────

export async function uploadImageToTripo(
  imageBuffer: Buffer,
  mimeType: string
): Promise<string> {
  if (!TRIPO_API_KEY) throw new Error("缺少 TRIPO_API_KEY 环境变量");

  const ext = mimeType.replace("image/", "").replace("jpeg", "jpg");
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([imageBuffer], { type: mimeType }),
    `image.${ext}`
  );

  const res = await fetch(`${TRIPO_BASE}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TRIPO_API_KEY}` },
    body: formData,
  });

  const data = (await res.json()) as { code: number; data?: { image_token?: string }; message?: string };
  console.log("[tripo] upload response:", JSON.stringify(data).slice(0, 200));

  if (data.code !== 0 || !data.data?.image_token) {
    throw new Error(`Tripo 上传失败 (code ${data.code}): ${data.message ?? JSON.stringify(data)}`);
  }
  return data.data.image_token;
}

// ─── 2. 创建任务 ──────────────────────────────────────────────────────────────

export async function createTripoTask(body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${TRIPO_BASE}/task`, {
    method: "POST",
    headers: tripoHeaders(),
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as { code: number; data?: { task_id?: string }; message?: string };
  console.log("[tripo] createTask response:", JSON.stringify(data).slice(0, 300));

  if (data.code !== 0 || !data.data?.task_id) {
    throw new Error(`Tripo 任务创建失败 (code ${data.code}): ${data.message ?? JSON.stringify(data)}`);
  }
  return data.data.task_id;
}

// ─── 3. 查询任务状态 ──────────────────────────────────────────────────────────

export async function getTripoTaskStatus(taskId: string): Promise<TripoTaskResult> {
  const res = await fetch(`${TRIPO_BASE}/task/${taskId}`, {
    headers: tripoHeaders(),
  });

  const data = (await res.json()) as {
    code: number;
    data?: {
      task_id: string;
      status: TripoStatus;
      progress: number;
      output?: Record<string, { url: string }>;
    };
    message?: string;
  };

  if (data.code !== 0) {
    throw new Error(`Tripo 状态查询失败 (code ${data.code}): ${data.message}`);
  }

  const d = data.data!;
  return {
    taskId: d.task_id,
    status: d.status ?? "unknown",
    progress: d.progress ?? 0,
    output: d.output as TripoTaskResult["output"],
  };
}

// ─── 4. 轮询直到完成 ──────────────────────────────────────────────────────────

export async function pollTripoTask(
  taskId: string,
  label: string,
  intervalMs = 4000,
  maxWaitMs = 300_000
): Promise<TripoTaskResult> {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await delay(intervalMs);
    const result = await getTripoTaskStatus(taskId);
    console.log(`[tripo] ${label} → ${result.status} ${result.progress}%`);

    if (result.status === "success") return result;
    if (result.status === "failed" || result.status === "cancelled") {
      throw new Error(`Tripo 任务 ${label} 失败 (${result.status})`);
    }
    // queued / running → 继续等待
  }
  throw new Error(`Tripo 任务 ${label} 超时（${maxWaitMs / 1000}s）`);
}

// ─── 5. 便捷步骤函数 ──────────────────────────────────────────────────────────

/** image_to_model：图片 → 3D 网格 */
export async function tripoImageToModel(fileToken: string): Promise<string> {
  const taskId = await createTripoTask({
    type: "image_to_model",
    file: { type: "png", file_token: fileToken },
  });
  await pollTripoTask(taskId, "image_to_model");
  return taskId;
}

/** animate_rig：给模型绑定人形骨骼 */
export async function tripoAnimateRig(originalModelTaskId: string): Promise<string> {
  const taskId = await createTripoTask({
    type: "animate_rig",
    original_model_task_id: originalModelTaskId,
  });
  await pollTripoTask(taskId, "animate_rig");
  return taskId;
}

/** animate_retarget：将预制动画套入已绑骨模型 */
export async function tripoAnimateRetarget(
  riggedTaskId: string,
  animation = "preset:idle"
): Promise<TripoTaskResult> {
  const taskId = await createTripoTask({
    type: "animate_retarget",
    original_model_task_id: riggedTaskId,
    animation,
  });
  return pollTripoTask(taskId, "animate_retarget");
}

/**
 * 从任务结果中提取最终 GLB URL
 * Tripo3D 返回格式可能是：
 *   { model: "https://..." }           ← 字符串
 *   { model: { url: "https://..." } }  ← 对象
 */
export function extractModelUrl(result: TripoTaskResult): string {
  const out = result.output as Record<string, unknown> | undefined;
  if (!out) throw new Error(`Tripo 结果 output 为空: ${JSON.stringify(result)}`);

  for (const key of ["model", "pbr_model", "base_model"]) {
    const val = out[key];
    if (typeof val === "string" && val.startsWith("http")) return val;
    if (val && typeof val === "object") {
      const url = (val as { url?: string }).url;
      if (typeof url === "string" && url.startsWith("http")) return url;
    }
  }
  throw new Error(`Tripo 结果中找不到模型 URL: ${JSON.stringify(out)}`);
}
