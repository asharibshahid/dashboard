import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { sbAdmin } from "@/lib/supabase-admin";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { NotFoundError, requireOwnedRestaurant } from "@/lib/guards";

type Ctx = { params: Promise<{ id: string }> };

const AdminNumberInputSchema = z.object({
  phone: z.string().min(7, "Phone is required"),
  role: z.literal("admin").optional().default("admin"),
  is_active: z.boolean().default(true),
});

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id: restaurant_id } = await ctx.params;
    const owner_id = await requireUserId();
    const sb = supabaseServer();

    await requireOwnedRestaurant(sb, restaurant_id, owner_id);

    const { data, error } = await sb
      .from("admin_numbers")
      .select("id,phone,role,is_active")
      .eq("restaurant_id", restaurant_id)
      .order("id", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: data ?? [] });
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id: restaurant_id } = await ctx.params;
    const owner_id = await requireUserId();
    const sb = supabaseServer();

    await requireOwnedRestaurant(sb, restaurant_id, owner_id);

    const body = await req.json();
    const parsed = AdminNumberInputSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "Invalid admin number payload";
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    const { data, error } = await sbAdmin
      .from("admin_numbers")
      .insert({
        restaurant_id,
        phone: parsed.data.phone,
        role: "admin",
        is_active: parsed.data.is_active,
      })
      .select("id,phone,role,is_active")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ data });
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
