import { redirect } from "react-router";

export function loader() {
  return redirect("/posts/configuring-routes");
}

export default function Home() {
  return null;
}
