import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { NotFoundError, requireOwnedRestaurant } from "@/lib/guards";

const CreateBotSchema = z.object({
  restaurant_id: z.string().min(1),
});

type RenderCreateResponse = {
  id?: string;
  url?: string;
  service?: {
    id?: string;
    url?: string;
    serviceDetails?: { url?: string };
  };
  serviceDetails?: { url?: string };
};

// SQL migration (run in Supabase):
// ALTER TABLE bot_sessions ADD COLUMN IF NOT EXISTS render_service_id text;
// Optional: ensure a unique index for upserts on restaurant_id
// CREATE UNIQUE INDEX IF NOT EXISTS bot_sessions_restaurant_id_unique ON bot_sessions(restaurant_id);

export async function POST(req: Request) {
  let restaurantId = "";
  const sb = supabaseServer();
  try {
    const owner_id = await requireUserId();
    const body = await req.json();
    const parsed = CreateBotSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "restaurant_id required";
      return NextResponse.json({ ok: false, error: msg }, { status: 422 });
    }
    restaurantId = parsed.data.restaurant_id;

    await requireOwnedRestaurant(sb, restaurantId, owner_id);

    const renderApiKey = process.env.RENDER_API_KEY || "";
    const renderOwnerId = process.env.RENDER_OWNER_ID || "";
    const repo = process.env.RENDER_BOT_REPO_URL || "";
    const branch = process.env.RENDER_GITHUB_BRANCH || "main";
    const region = "oregon";
    const supabaseUrl = process.env.SUPABASE_URL || "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const openAiApiKey = process.env.OPENAI_API_KEY || "";

    if (!renderApiKey || !renderOwnerId) {
      throw new Error("Render API is not configured. Set RENDER_API_KEY and RENDER_OWNER_ID.");
    }
    if (!repo) {
      throw new Error("Bot repo not configured. Set RENDER_BOT_REPO_URL.");
    }
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase service role not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }

    const admin = supabaseAdmin();
    const nowIso = new Date().toISOString();
    const { error: initError } = await admin
      .from("bot_sessions")
      .upsert(
        {
          restaurant_id: restaurantId,
          status: "creating",
          service_url: null,
          render_service_id: null,
          created_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "restaurant_id" }
      );
    if (initError) throw new Error(initError.message);

    const serviceName = `restaurant-bot-${restaurantId}`;
    const envVars = [
      { key: "SUPABASE_URL", value: supabaseUrl },
      { key: "SUPABASE_SERVICE_ROLE_KEY", value: serviceRoleKey },
      { key: "RESTAURANT_ID", value: restaurantId },
      ...(openAiApiKey ? [{ key: "OPENAI_API_KEY", value: openAiApiKey }] : []),
    ];
    const payload = {
      type: "web_service",
      name: serviceName,
      ownerId: renderOwnerId,
      repo,
      branch,
      serviceDetails: {
        env: "node",
        plan: "starter",
        region,
        envSpecificDetails: {
          buildCommand: "npm install",
          startCommand: "npm start",
        },
        envVars,
      },
    };

    const debugPayload = {
      ...payload,
      serviceDetails: {
        ...payload.serviceDetails,
        envVars: payload.serviceDetails.envVars.map((env) =>
          env.key === "SUPABASE_SERVICE_ROLE_KEY" ? { ...env, value: "***" } : env
        ),
      },
    };
    console.log("Render create payload:", JSON.stringify(debugPayload));

    const createRes = await fetch("https://api.render.com/v1/services", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${renderApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const createText = await createRes.text();
    let createJson: RenderCreateResponse | null = null;
    let createRaw: unknown = null;
    try {
      createRaw = createText ? JSON.parse(createText) : null;
      createJson = (createRaw as RenderCreateResponse) || null;
    } catch {
      createRaw = null;
      createJson = null;
    }
    if (!createRes.ok) {
      console.error("Render create error:", createText);
      const errorObj = typeof createRaw === "object" && createRaw !== null ? (createRaw as { message?: string; error?: string }) : {};
      const errMsg = errorObj.message || errorObj.error || createText || `Render create failed (${createRes.status})`;
      await admin
        .from("bot_sessions")
        .upsert(
          {
            restaurant_id: restaurantId,
            status: "disconnected",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "restaurant_id" }
        );
      return NextResponse.json({ ok: false, error: errMsg }, { status: 400 });
    }

    const renderServiceId = createJson?.id || createJson?.service?.id;
    if (!renderServiceId) throw new Error("Render did not return a service id.");

    const serviceUrl =
      createJson?.service?.serviceDetails?.url ||
      createJson?.serviceDetails?.url ||
      createJson?.url ||
      createJson?.service?.url ||
      null;
    if (!serviceUrl) throw new Error("Render did not return a service URL.");

    const qrReadyAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const { error: updateError } = await admin
      .from("bot_sessions")
      .upsert(
        {
          restaurant_id: restaurantId,
          status: "creating",
          render_service_id: renderServiceId,
          service_url: serviceUrl,
          qr_ready_at: qrReadyAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "restaurant_id" }
      )
      .select("restaurant_id,status,service_url,render_service_id")
      .single();

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({
      ok: true,
      service_url: serviceUrl,
      render_service_id: renderServiceId,
      status: "creating",
      qr_ready_at: qrReadyAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (restaurantId) {
      const admin = supabaseAdmin();
      await admin
        .from("bot_sessions")
        .upsert(
          {
            restaurant_id: restaurantId,
            status: "disconnected",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "restaurant_id" }
        );
    }
    if (e instanceof UnauthorizedError) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (e instanceof NotFoundError) return NextResponse.json({ ok: false, error: "Restaurant not found" }, { status: 404 });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
