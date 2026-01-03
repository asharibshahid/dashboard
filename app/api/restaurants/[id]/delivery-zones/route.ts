import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { NotFoundError, requireOwnedRestaurant } from "@/lib/guards";

type Ctx = { params: Promise<{ id: string }> };

// SQL reference (run in Supabase if needed):
// CREATE TABLE IF NOT EXISTS delivery_zones (
//   id uuid primary key default gen_random_uuid(),
//   restaurant_id uuid not null references restaurants(id) on delete cascade,
//   city text not null,
//   zone_name text not null,
//   delivery_fee integer not null default 0,
//   min_order_amount integer not null default 0,
//   is_active boolean not null default true,
//   created_at timestamptz not null default now()
// );
// ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS city text;
// CREATE UNIQUE INDEX IF NOT EXISTS delivery_zones_unique
// ON delivery_zones (restaurant_id, city, zone_name);

const NormalizedZonesSchema = z.object({
  zones: z
    .array(
      z.object({
        city: z.string().min(1),
        zone_name: z.string().min(1),
        delivery_fee: z.number().min(0).finite(),
        min_order_amount: z.number().min(0).finite(),
        is_active: z.boolean().default(true),
      })
    )
    .min(1),
});

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : NaN;
}

function toString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeZone(input: any, fallbackCity: string) {
  const city = toString(input?.city) || fallbackCity;
  const zoneName = toString(input?.zone_name) || toString(input?.area);
  const deliveryFee = toNumber(input?.delivery_fee ?? input?.deliveryFee);
  const minOrder = toNumber(input?.min_order_amount ?? input?.minOrder ?? input?.min_order);
  const isActive = typeof input?.is_active === "boolean" ? input.is_active : typeof input?.active === "boolean" ? input.active : true;

  return {
    city,
    zone_name: zoneName,
    delivery_fee: Number.isFinite(deliveryFee ?? NaN) ? (deliveryFee as number) : NaN,
    min_order_amount: Number.isFinite(minOrder ?? NaN) ? (minOrder as number) : 0,
    is_active: isActive,
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const owner_id = await requireUserId();
    const sb = supabaseServer();

    await requireOwnedRestaurant(sb, id, owner_id);

    const { data, error } = await sb
      .from("delivery_zones")
      .select("id,city,zone_name,delivery_fee,min_order_amount,is_active,created_at")
      .eq("restaurant_id", id)
      .order("city", { ascending: true })
      .order("zone_name", { ascending: true });

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
    const fallbackCity = toString(body?.city);
    const rawZones = Array.isArray(body?.zones)
      ? body.zones
      : [
          {
            city: body?.city,
            zone_name: body?.zone_name,
            area: body?.area,
            delivery_fee: body?.delivery_fee,
            deliveryFee: body?.deliveryFee,
            min_order_amount: body?.min_order_amount,
            minOrder: body?.minOrder,
            min_order: body?.min_order,
            is_active: body?.is_active,
            active: body?.active,
          },
        ];

    const normalized = rawZones.map((zone: any) => normalizeZone(zone, fallbackCity));
    const parsed = NormalizedZonesSchema.safeParse({ zones: normalized });
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "Invalid delivery zones payload";
      return NextResponse.json({ ok: false, error: msg, issues: parsed.error.issues }, { status: 400 });
    }

    const rows = parsed.data.zones.map((zone) => ({
      restaurant_id: id,
      city: zone.city,
      zone_name: zone.zone_name,
      delivery_fee: zone.delivery_fee,
      min_order_amount: zone.min_order_amount,
      is_active: zone.is_active,
    }));

    const admin = supabaseAdmin();
    const zonesByCity = new Map<string, string[]>();
    rows.forEach((zone) => {
      const list = zonesByCity.get(zone.city) || [];
      list.push(zone.zone_name);
      zonesByCity.set(zone.city, list);
    });

    for (const [city, zoneNames] of zonesByCity.entries()) {
      const { error } = await admin
        .from("delivery_zones")
        .delete()
        .eq("restaurant_id", id)
        .eq("city", city)
        .in("zone_name", zoneNames);

      if (error) throw new Error(error.message);
    }

    const { error } = await admin.from("delivery_zones").insert(rows);

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, count: rows.length });
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (e instanceof NotFoundError) return NextResponse.json({ ok: false, error: "Restaurant not found" }, { status: 404 });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
