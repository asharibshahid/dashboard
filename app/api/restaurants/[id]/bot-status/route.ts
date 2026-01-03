
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
      .select("status,service_url,qr_text")
      .eq("restaurant_id", id)
      .maybeSingle();

    if (error) return NextResponse.json({ data: null, restaurant_status: "disconnected" });
    return NextResponse.json({ data, restaurant_status: data?.status ?? "disconnected" });
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
