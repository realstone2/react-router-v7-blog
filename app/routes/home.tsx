import { redirect } from "react-router";
import { getNavigation } from "~/lib/navigation.server";

export function loader() {
  const nav = getNavigation();
  const firstSlug = nav[0]?.items[0]?.slug ?? "configuring-routes";
  return redirect(`/posts/${firstSlug}`);
}

export default function Home() {
  return null;
}
