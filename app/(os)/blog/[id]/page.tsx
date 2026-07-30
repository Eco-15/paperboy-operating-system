import { requireRole } from "@/lib/auth/guards";
import BlogEditorApp from "@/components/blog/editor/BlogEditorApp";

// Staff-only post editor — write/edit here, publish to the public /press blog.
export default async function BlogEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "internal"]);
  const { id } = await params;
  return <BlogEditorApp id={id} />;
}
