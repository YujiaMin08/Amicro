/**
 * Copilot 3D API — 图片转 3D 模型 (GLB)
 * Endpoint: http://57.152.82.155:8000/v1/generation3d
 * 使用 Node.js 原生 http 模块（避免 fetch 对大体积 body 的兼容性问题）
 */

import http from "http";

const COPILOT3D_HOST = process.env.COPILOT3D_HOST ?? "57.152.82.155";
const COPILOT3D_PORT = parseInt(process.env.COPILOT3D_PORT ?? "8000", 10);

export interface Generate3DResult {
  modelUrl: string | null;
  modelBase64: string | null;
}

/**
 * 用 Node.js http.request 发送大体积 JSON，比 fetch 更稳定
 * 返回 { buffer, contentType } — 调用方决定如何解读内容
 */
function httpPost(
  host: string,
  port: number,
  path: string,
  body: string
): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      host,
      port,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 300_000, // 5 分钟超时（3D 生成耗时较长）
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const contentType = res.headers["content-type"] ?? "";
        if (res.statusCode && res.statusCode >= 400) {
          reject(
            new Error(
              `Copilot 3D API 错误 ${res.statusCode}: ${buffer.toString("utf8")}`
            )
          );
        } else {
          resolve({ buffer, contentType });
        }
      });
    });

    req.on("error", (err) => {
      console.error("[copilot3d] http.request 错误:", err);
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Copilot 3D 请求超时（5 分钟）"));
    });

    req.write(body);
    req.end();
  });
}

/**
 * 调用 Copilot 3D，将图片转为 GLB 3D 模型
 */
export async function generate3DFromImage(
  imageBuffer: Buffer,
  _mimeType: string
): Promise<Generate3DResult> {
  const base64Image = imageBuffer.toString("base64");

  const requestBody = JSON.stringify({
    image_base64: base64Image,
    output_format: "glb",
    seed: 0,
    simplify: 0.95,
    texture_size: 1024,
    randomize_seed: true,
    ss_guidance_strength: 7.5,
    ss_sampling_steps: 12,
    slat_guidance_strength: 3,
    slat_sampling_steps: 12,
  });

  console.log(
    "[copilot3d] 发送请求 body size:",
    Math.round(requestBody.length / 1024),
    "KB"
  );

  const { buffer, contentType } = await httpPost(
    COPILOT3D_HOST,
    COPILOT3D_PORT,
    "/v1/generation3d",
    requestBody
  );

  console.log(
    "[copilot3d] 收到响应, size:",
    Math.round(buffer.length / 1024),
    "KB, Content-Type:",
    contentType
  );

  // ── 判断响应类型 ─────────────────────────────────────────────────────────

  // 1. 二进制 GLB（直接返回模型文件）
  //    GLB 文件魔数：0x46546C67（"glTF"）
  if (
    buffer.length > 4 &&
    buffer[0] === 0x67 && buffer[1] === 0x6c && buffer[2] === 0x54 && buffer[3] === 0x46
  ) {
    console.log("[copilot3d] 检测到二进制 GLB 文件，转为 base64");
    return { modelUrl: null, modelBase64: buffer.toString("base64") };
  }

  // 2. JSON 或纯文本（URL / base64 字符串）
  const resultText = buffer.toString("utf8").trim().replace(/^"|"$/g, "");

  // 尝试解析 JSON（如 {"url": "...", "model_url": "..."}）
  try {
    const json = JSON.parse(resultText) as Record<string, unknown>;
    const url = (json.model_url ?? json.url ?? json.modelUrl ?? json.glb_url) as string | undefined;
    if (url && typeof url === "string") {
      console.log("[copilot3d] JSON 响应，model URL:", url);
      return { modelUrl: url, modelBase64: null };
    }
    // JSON 里找不到 URL，尝试把整体当 base64
    const base64Field = (json.base64 ?? json.data ?? json.model) as string | undefined;
    if (base64Field) {
      return { modelUrl: null, modelBase64: base64Field };
    }
  } catch {
    // 不是 JSON，继续往下
  }

  // 3. 直接是 URL
  if (resultText.startsWith("http://") || resultText.startsWith("https://")) {
    console.log("[copilot3d] 纯文本 URL:", resultText.slice(0, 80));
    return { modelUrl: resultText, modelBase64: null };
  }

  // 4. 纯 base64 字符串（只含 A-Za-z0-9+/=）
  console.log("[copilot3d] 视为 base64 GLB，长度:", resultText.length);
  return { modelUrl: null, modelBase64: resultText };
}
