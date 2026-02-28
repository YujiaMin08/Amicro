/**
 * 聚鑫API — gemini-3-pro-image-preview (Nano Banana 2)
 * Base URL: https://api.jxincm.cn
 * Endpoint: POST /v1beta/models/gemini-3-pro-image-preview:generateContent
 * Auth: query param ?key=YOUR_API_KEY  +  Bearer header（双重鉴权）
 * Body: Gemini 原生格式（contents + generationConfig）
 */

const NANOBANANA_API_KEY = process.env.NANOBANANA_API_KEY ?? "";
const NANOBANANA_BASE_URL =
  process.env.NANOBANANA_BASE_URL ?? "https://api.jxincm.cn";

/**
 * 基于样例图片总结的黏土手办风格 Prompt
 *
 * 关键：明确要求 A-pose 和四肢清晰分离，确保 Tripo3D 自动骨骼绑定
 * 能正确识别关节位置，避免动画穿帮。
 */
const CLAY_STYLE_PROMPT = `
Transform the subject in this image into a cute clay figurine / collectible art toy style.

STYLE:
- Smooth matte clay / plasticine texture, soft rounded surfaces
- Chibi proportions: large rounded head (about 1/2 of total height), compact body
- Vibrant but slightly desaturated colors matching real clay material
- Soft studio diffuse lighting, plain pure white background, single centered subject
- High quality 3D render of a professional collectible vinyl / clay art toy

POSE — CRITICAL FOR 3D RIGGING (follow exactly):
- Full body visible from head to toe, character facing forward
- A-pose: both arms relaxed at approximately 45 degrees away from the body, hands visible and slightly open
- Legs straight, feet slightly apart (shoulder width), toes pointing forward
- Clear visible gap between each arm and the torso — arms must NOT touch or merge into the body
- Clear visible gap between the legs — legs must NOT touch each other
- Neck clearly visible between head and shoulders
- Wrists and ankles show slight narrowing to define joints

Output only the transformed image, no text or watermarks.
`.trim();

export interface NanobananaResult {
  /** 转换后的图片 data URL（含 data:image/... 前缀）*/
  imageDataUrl: string;
  mimeType: string;
}

/**
 * 纯文字 → 2D 黏土风格角色图（随机生成流程使用）
 */
export async function generateClayCharacterFromText(
  gender: "male" | "female",
  name?: string,
  profileHint?: string
): Promise<NanobananaResult> {
  if (!NANOBANANA_API_KEY) {
    throw new Error("缺少 NANOBANANA_API_KEY 环境变量");
  }

  const genderDesc = gender === "female"
    ? "cute female girl character, feminine, long hair or cute hairstyle, wearing a cute colorful outfit like a dress or jacket"
    : "cute male boy character, masculine, short hair, wearing a casual cool outfit like a hoodie or jacket";

  const nameDesc = name ? ` The character's name is ${name}.` : "";
  const profileDesc = profileHint?.trim()
    ? `\nADDITIONAL CHARACTER NOTES:\n${profileHint.trim().slice(0, 800)}\nUse these notes to influence outfit, vibe, and expression while keeping the same clay style and A-pose constraints.`
    : "";

  const prompt = `Create a high-quality illustration of a single cute chibi clay figurine character.

CHARACTER: ${genderDesc}.${nameDesc}

STYLE:
- Smooth matte clay / plasticine texture, soft rounded surfaces, no sharp edges
- Chibi proportions: very large round head (about half the total height), small compact body
- Cute expressive face with big eyes, small nose, friendly smile
- Wearing a complete colorful outfit with accessories matching the character personality
- Plain pure white background, single subject perfectly centered
- Soft studio diffuse lighting, gentle drop shadow beneath
- Colors: vibrant but slightly desaturated, matching real clay material
- Professional collectible vinyl / clay art toy product render quality

POSE — CRITICAL FOR 3D RIGGING (follow exactly):
- Full body visible from head to toe, character facing directly forward
- A-pose: arms relaxed at approximately 45 degrees away from the body, hands open and visible
- Legs straight, feet shoulder-width apart, toes pointing forward
- IMPORTANT: clear visible gap between each arm and the torso — arms must NOT touch the body
- IMPORTANT: clear visible gap between legs — legs must NOT touch each other
- Neck clearly visible between head and shoulders
- Wrists and ankles show slight narrowing to define joints clearly

NO text, NO watermarks, single character only.${profileDesc}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: "1K",
      },
    },
  };

  const url =
    `${NANOBANANA_BASE_URL}/v1beta/models/gemini-3-pro-image-preview:generateContent` +
    `?key=${encodeURIComponent(NANOBANANA_API_KEY)}`;

  console.log("[nanobanana] text-to-clay 请求...");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NANOBANANA_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`nanobanana API 错误 ${response.status}: ${errText}`);
  }

  const data = await response.json();
  console.log("[nanobanana] text-to-clay 收到响应:", JSON.stringify(data).slice(0, 200));

  const parts = data?.candidates?.[0]?.content?.parts as Array<{
    text?: string;
    thoughtSignature?: string;
    inlineData?: { mimeType: string; data: string };
    inline_data?: { mime_type: string; data: string };
  }> | undefined;

  if (Array.isArray(parts)) {
    for (const part of parts) {
      if (part.inlineData?.data) {
        const outputMime = part.inlineData.mimeType ?? "image/png";
        return { imageDataUrl: `data:${outputMime};base64,${part.inlineData.data}`, mimeType: outputMime };
      }
      if (part.inline_data?.data) {
        const outputMime = part.inline_data.mime_type ?? "image/png";
        return { imageDataUrl: `data:${outputMime};base64,${part.inline_data.data}`, mimeType: outputMime };
      }
    }
  }

  console.error("[nanobanana] text-to-clay 无图片响应:", JSON.stringify(data));
  throw new Error("nanobanana 未返回图片，请检查日志");
}

export async function convertToClayStyle(
  imageBuffer: Buffer,
  mimeType: string
): Promise<NanobananaResult> {
  if (!NANOBANANA_API_KEY) {
    throw new Error("缺少 NANOBANANA_API_KEY 环境变量");
  }

  const base64Image = imageBuffer.toString("base64");

  // Gemini 原生格式请求体
  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: CLAY_STYLE_PROMPT },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: "1K",
      },
    },
  };

  const url =
    `${NANOBANANA_BASE_URL}/v1beta/models/gemini-3-pro-image-preview:generateContent` +
    `?key=${encodeURIComponent(NANOBANANA_API_KEY)}`;

  console.log("[nanobanana] 发送请求...", url.replace(NANOBANANA_API_KEY, "***"));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NANOBANANA_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`nanobanana API 错误 ${response.status}: ${errText}`);
  }

  const data = await response.json();
  console.log("[nanobanana] 收到响应:", JSON.stringify(data).slice(0, 300));

  // 解析 Gemini 原生响应格式：candidates[0].content.parts
  // Gemini 响应使用驼峰命名（inlineData / mimeType），请求体用蛇形（inline_data）
  // 同时兼容两种格式，并跳过 thoughtSignature（模型内部思考 token）
  const parts = data?.candidates?.[0]?.content?.parts as Array<{
    text?: string;
    thoughtSignature?: string;
    // 驼峰（Gemini REST 响应实际格式）
    inlineData?: { mimeType: string; data: string };
    // 蛇形（兼容）
    inline_data?: { mime_type: string; data: string };
  }> | undefined;

  if (Array.isArray(parts)) {
    for (const part of parts) {
      // 驼峰格式（实际响应）
      if (part.inlineData?.data) {
        const outputMime = part.inlineData.mimeType ?? "image/png";
        const dataUrl = `data:${outputMime};base64,${part.inlineData.data}`;
        return { imageDataUrl: dataUrl, mimeType: outputMime };
      }
      // 蛇形格式（兼容）
      if (part.inline_data?.data) {
        const outputMime = part.inline_data.mime_type ?? "image/png";
        const dataUrl = `data:${outputMime};base64,${part.inline_data.data}`;
        return { imageDataUrl: dataUrl, mimeType: outputMime };
      }
    }
  }

  const fullResponse = JSON.stringify(data, null, 2);
  console.error("[nanobanana] 无法解析图片，完整响应:\n", fullResponse);
  // 把响应的前 500 字符也带到错误里，方便直接在浏览器里看
  throw new Error(
    "nanobanana 响应中未找到图片数据。响应内容: " +
      fullResponse.slice(0, 500)
  );
}
