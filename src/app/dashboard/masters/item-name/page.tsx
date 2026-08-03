import { redirect } from "next/navigation";

/** Legacy route — Item/Asset Name for Type lives under Tool Type Master. */
export default function ItemNameRedirectPage() {
  redirect("/dashboard/masters/tool-types");
}
