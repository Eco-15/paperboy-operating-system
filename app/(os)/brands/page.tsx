import { redirect } from "next/navigation";

// The Brand Library merged into the Investment CRM (Jul 2026): every brand's
// knowledge card now renders on its deal page, so the standalone tab is gone.
// Old bookmarks land on the pipeline.
export default function BrandsPage() {
  redirect("/crm");
}
