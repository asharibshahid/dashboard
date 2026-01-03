import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { NotFoundError, requireOwnedRestaurant } from "@/lib/guards";

type Ctx = { params: Promise<{ id: string }> };

// SQL migration (run in Supabase):
// CREATE TABLE IF NOT EXISTS restaurant_deals (
//   id uuid primary key default gen_random_uuid(),
//   restaurant_id uuid not null references restaurants(id) on delete cascade,
//   title text not null,
//   price integer null,
//   description text null,
//   is_active boolean not null default true,
//   created_at timestamptz not null default now()
// );
// CREATE INDEX IF NOT EXISTS restaurant_deals_restaurant_id_idx ON restaurant_deals(restaurant_id);

const DealSchema = z.object({
  title: z.string().min(1, "Title is required"),
  price: z.coerce.number().int().optional().nullable(),
  description: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  items_json: z.any().optional().default([]),
});

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const owner_id = await requireUserId();
    const sb = supabaseServer();

    await requireOwnedRestaurant(sb, id, owner_id);

    const { data, error } = await sb
      .from("restaurant_deals")
      .select("id,restaurant_id,title,price,description,is_active,items_json,created_at")
      .eq("restaurant_id", id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (e instanceof NotFoundError) return NextResponse.json({ ok: false, error: "Restaurant not found" }, { status: 404 });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const owner_id = await requireUserId();
    const sb = supabaseServer();

    await requireOwnedRestaurant(sb, id, owner_id);

    const body = await req.json();
    const parsed = DealSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "Invalid deal payload";
      return NextResponse.json({ ok: false, error: msg }, { status: 422 });
    }

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("restaurant_deals")
      .insert({
        restaurant_id: id,
        title: parsed.data.title,
        price: parsed.data.price ?? null,
        description: parsed.data.description ?? null,
        is_active: parsed.data.is_active,
        items_json: parsed.data.items_json ?? [],
      })
      .select("id,restaurant_id,title,price,description,is_active,items_json,created_at")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (e instanceof NotFoundError) return NextResponse.json({ ok: false, error: "Restaurant not found" }, { status: 404 });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
