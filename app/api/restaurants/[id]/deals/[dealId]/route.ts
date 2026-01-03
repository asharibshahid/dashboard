import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { sbAdmin } from "@/lib/supabase-admin";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { NotFoundError, requireOwnedRestaurant } from "@/lib/guards";

type Ctx = { params: Promise<{ id: string; dealId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id: restaurant_id, dealId } = await ctx.params;
    const owner_id = await requireUserId();
    const sb = supabaseServer();

    await requireOwnedRestaurant(sb, restaurant_id, owner_id);

    const { error } = await sbAdmin
      .from("restaurant_deals")
      .delete()
      .eq("id", dealId)
      .eq("restaurant_id", restaurant_id);

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
