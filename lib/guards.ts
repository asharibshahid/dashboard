import { supabaseServer } from "@/lib/supabase-server";

export class NotFoundError extends Error {
  constructor(message = "Restaurant not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

// Verifies the restaurant belongs to the logged-in user.
// Returns void on success; throws NotFoundError on mismatch/missing.
export async function requireOwnedRestaurant(
  sb: ReturnType<typeof supabaseServer>,
  restaurantId: string,
  ownerId: string
) {
  const { data, error } = await sb
    .from("restaurants")
    .select("id")
    .eq("id", restaurantId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new NotFoundError();
}

