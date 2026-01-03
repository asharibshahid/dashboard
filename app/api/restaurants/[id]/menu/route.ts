
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { NotFoundError, requireOwnedRestaurant } from "@/lib/guards";

type Ctx = { params: Promise<{ id: string }> };

// SQL migration (run in Supabase):
// ALTER TABLE menus ADD COLUMN IF NOT EXISTS menu_image_url text;
// ALTER TABLE menus ADD COLUMN IF NOT EXISTS menu_items_json jsonb;
// ALTER TABLE menus ADD COLUMN IF NOT EXISTS menu_ocr_text text;
// CREATE UNIQUE INDEX IF NOT EXISTS menus_restaurant_id_unique ON menus(restaurant_id);
const ItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.coerce.number().nonnegative(),
  description: z.string().optional(),
});

const MenuUpsertSchema = z
  .object({
    menu_items_json: z
      .union([z.array(ItemSchema), z.array(z.object({ name: z.string().min(1), items: z.array(ItemSchema) }))])
      .optional(),
    menu_image_url: z.string().url().optional().nullable(),
    menu_ocr_text: z.string().optional().nullable(),
  })
  .refine((data) => data.menu_items_json !== undefined || data.menu_image_url !== undefined || data.menu_ocr_text !== undefined, {
    message: "menu_items_json, menu_image_url, or menu_ocr_text is required",
  });

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const owner_id = await requireUserId();
    const sb = supabaseServer();

    await requireOwnedRestaurant(sb, id, owner_id);

    const body = await req.json();
    const parsed = MenuUpsertSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "Invalid menu payload";
      return NextResponse.json({ ok: false, error: msg }, { status: 422 });
    }

    const upsertRow: {
      restaurant_id: string;
      menu_image_url?: string | null;
      menu_items_json?: any;
      updated_at?: string;
      menu_ocr_text?: string | null;
    } = {
      restaurant_id: id,
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.menu_items_json !== undefined) upsertRow.menu_items_json = parsed.data.menu_items_json;
    if (parsed.data.menu_image_url !== undefined) upsertRow.menu_image_url = parsed.data.menu_image_url ?? null;
    if (parsed.data.menu_ocr_text !== undefined) upsertRow.menu_ocr_text = parsed.data.menu_ocr_text ?? null;

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("menus")
      .upsert(upsertRow, { onConflict: "restaurant_id" })
      .select("menu_image_url,menu_items_json,menu_ocr_text,updated_at")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (e instanceof NotFoundError) return NextResponse.json({ ok: false, error: "Restaurant not found" }, { status: 404 });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const owner_id = await requireUserId();
    const sb = supabaseServer();

    await requireOwnedRestaurant(sb, id, owner_id);

    const { data, error } = await sb
      .from("menus")
      .select("menu_image_url,menu_items_json,menu_ocr_text,updated_at")
      .eq("restaurant_id", id)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({
      ok: true,
      data:
        data || {
          menu_image_url: null,
          menu_items_json: [],
          menu_ocr_text: null,
        },
    });
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (e instanceof NotFoundError) return NextResponse.json({ ok: false, error: "Restaurant not found" }, { status: 404 });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
