import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await requireUserId();
    return NextResponse.json({ userId });
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}

