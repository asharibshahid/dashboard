import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { NotFoundError, requireOwnedRestaurant } from "@/lib/guards";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const owner_id = await requireUserId();
    const sb = supabaseServer();

    await requireOwnedRestaurant(sb, id, owner_id);

    const { data, error } = await sb
      .from("bot_sessions")
      .select("id,restaurant_id,status,service_url,render_service_id,qr_text,qr_ready_at,last_connected_at,updated_at")
      .eq("restaurant_id", id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, session: data ?? null });
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (e instanceof NotFoundError) return NextResponse.json({ ok: false, error: "Restaurant not found" }, { status: 404 });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
