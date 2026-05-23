import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  ensurePlayerProfile,
  strapiLogin,
} from "@/lib/strapiAuth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      identifier?: string;
      password?: string;
    };

    const identifier = body.identifier?.trim();
    const password = body.password?.trim();

    if (!identifier || !password) {
      return NextResponse.json({ error: "identifier and password are required" }, { status: 400 });
    }

    const auth = await strapiLogin({ identifier, password });
    await ensurePlayerProfile(auth.jwt, auth.user.id, auth.user.username);

    const response = NextResponse.json({ ok: true, user: { id: auth.user.id, username: auth.user.username } });
    response.cookies.set(AUTH_COOKIE_NAME, auth.jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    response.cookies.delete("mock_user");

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
