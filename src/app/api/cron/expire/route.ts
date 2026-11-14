import { createHash, timingSafeEqual } from "node:crypto";
import { rpc } from "@/lib/db";

export const runtime = "nodejs";

function digest(value: string) { return createHash("sha256").update(value).digest(); }

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const expired = await rpc<number>("expire_tokens", {});
    return Response.json({ expired });
  } catch (error) {
    console.error("Token expiry job failed", { error: error instanceof Error ? error.name : "unknown" });
    return Response.json({ error: "Expiry job failed" }, { status: 500 });
  }
}
