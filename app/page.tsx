import { redirect } from "next/navigation";
import { getSessionUser } from "../lib/auth";

export default async function IndexPage() {
  const user = await getSessionUser();

  if (user) {
    redirect("/lobby");
  } else {
    redirect("/login");
  }
}
