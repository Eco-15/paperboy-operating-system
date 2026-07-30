import BlogApp from "@/components/blog/BlogApp";
import { auth } from "@/auth";
import { isStaff } from "@/lib/auth/guards";

export default async function BlogPage() {
  const session = await auth();
  const canCompose = isStaff(session?.user?.role);

  return (
    <>
      <main className="tool-main">
        <div className="tool-head">
          <div>
            <div className="tool-title">The Front Page</div>
            <div className="tool-sub">Insights from the emerging consumer brand world</div>
          </div>
        </div>
        <BlogApp canCompose={canCompose} />
      </main>
    </>
  );
}
