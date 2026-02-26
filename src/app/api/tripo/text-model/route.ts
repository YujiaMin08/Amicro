import { NextRequest, NextResponse } from "next/server";
import { createTripoTask, pollTripoTask, extractModelUrl } from "@/lib/tripo3d";

export const maxDuration = 60;

// POST /api/tripo/text-model
// Body: { gender: "male" | "female", name?: string }
// Response: { taskId, modelUrl }
export async function POST(request: NextRequest) {
  try {
    const { gender, name } = await request.json() as {
      gender: "male" | "female";
      name?: string;
    };

    const characterDesc = gender === "female"
      ? "cute female chibi character, girl, feminine features, round face"
      : "cute male chibi character, boy, masculine features, round face";

    const nameDesc = name ? ` named ${name}` : "";

    const prompt = `${characterDesc}${nameDesc}, clay figurine style, smooth matte clay texture, big round head, small compact body, big expressive eyes, neutral standing pose, plain white background, studio lighting, collectible art toy, high quality 3D render`;

    console.log("[text-model] prompt:", prompt);

    const taskId = await createTripoTask({
      type: "text_to_model",
      prompt,
      negative_prompt: "low quality, blurry, distorted, deformed, extra limbs, ugly, multiple characters, animal, quadruped",
    });

    const result = await pollTripoTask(taskId, "text_to_model", 5000, 180_000);
    const rawUrl = extractModelUrl(result);
    const modelUrl = `/api/proxy/glb?url=${encodeURIComponent(rawUrl)}`;

    console.log("[text-model] 完成 ✓ taskId:", taskId);
    return NextResponse.json({ taskId, modelUrl });
  } catch (err) {
    console.error("[text-model] 失败:", err);
    return NextResponse.json(
      { error: "Random character generation failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
