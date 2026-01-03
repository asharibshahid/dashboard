import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { sbAdmin } from "@/lib/supabase-admin";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { NotFoundError, requireOwnedRestaurant } from "@/lib/guards";
import { RestaurantSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const owner_id = await requireUserId();
    const sb = supabaseServer();

    await requireOwnedRestaurant(sb, id, owner_id);

    const { data, error } = await sb
      .from("restaurants")
      .select("id,name,phone,address,is_active,created_at")
      .eq("id", id)
      .eq("owner_id", owner_id)
      .single();

    if (error) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const owner_id = await requireUserId();
    const sb = supabaseServer();

    await requireOwnedRestaurant(sb, id, owner_id);

    const body = await req.json();
    const parsed = RestaurantSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "Invalid restaurant payload";
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    const { data, error } = await sbAdmin
      .from("restaurants")
      .update({
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        is_active: parsed.data.is_active ?? true,
      })
      .eq("id", id)
      .eq("owner_id", owner_id)
      .select("id,name,phone,address,is_active,created_at")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
