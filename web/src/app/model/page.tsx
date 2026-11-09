import { redirect } from "next/navigation";

/** the model now lives on the SYRUP page */
export default function ModelPage() {
  redirect("/syrup#model");
}
