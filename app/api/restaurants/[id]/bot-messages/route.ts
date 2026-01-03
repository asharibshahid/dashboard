
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { sbAdmin } from "@/lib/supabase-admin";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { NotFoundError, requireOwnedRestaurant } from "@/lib/guards";
import { BotMessagesSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const owner_id = await requireUserId();
    const sb = supabaseServer();

    await requireOwnedRestaurant(sb, id, owner_id);

    const body = await req.json();
    const parsed = BotMessagesSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "Invalid bot messages payload";
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    // Store latest templates as a single "outgoing" message payload so it fits the current table structure.
    const { error: deleteError } = await sbAdmin
      .from("bot_messages")
      .delete()
      .eq("restaurant_id", id)
      .eq("user_phone", "template");
    if (deleteError) throw new Error(deleteError.message);

    const { data, error } = await sbAdmin
      .from("bot_messages")
      .insert({
        restaurant_id: id,
        user_phone: "template",
        message_type: "outgoing",
        message_text: JSON.stringify(parsed.data),
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ data });
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
