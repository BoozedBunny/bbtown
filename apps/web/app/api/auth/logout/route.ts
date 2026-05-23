import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/strapiAuth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(AUTH_COOKIE_NAME);
  response.cookies.delete("bbtown_user");
  response.cookies.delete("mock_user");
  return response;
}
