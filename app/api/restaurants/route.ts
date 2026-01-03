import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { sbAdmin } from "@/lib/supabase-admin";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { RestaurantSchema } from "@/lib/validators";

// List restaurants for the signed-in owner.
export async function GET() {
  try {
    const owner_id = await requireUserId();
    const sb = supabaseServer();

    const { data, error } = await sb
      .from("restaurants")
      .select("id,name,phone,address,is_active,created_at")
      .eq("owner_id", owner_id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: data ?? [] });
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

// Create restaurant owned by the signed-in user.
export async function POST(req: Request) {
  try {
    const owner_id = await requireUserId();

    const body = await req.json();
    const parsed = RestaurantSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "Invalid restaurant payload";
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    const { data, error } = await sbAdmin
      .from("restaurants")
      .insert({
        owner_id,
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        is_active: parsed.data.is_active ?? true,
      })
      .select("id,name,phone,address,is_active,created_at")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ data });
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
