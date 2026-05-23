import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  ensurePlayerProfile,
  strapiRegister,
} from "@/lib/strapiAuth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      email?: string;
      password?: string;
    };

    const username = body.username?.trim();
    const email = body.email?.trim();
    const password = body.password?.trim();

    if (!username || !email || !password) {
      return NextResponse.json({ error: "username, email and password are required" }, { status: 400 });
    }

    const auth = await strapiRegister({ username, email, password });
    await ensurePlayerProfile(auth.jwt, auth.user.id, auth.user.username);

    const response = NextResponse.json({ ok: true, user: { id: auth.user.id, username: auth.user.username } });
    response.cookies.set(AUTH_COOKIE_NAME, auth.jwt, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
