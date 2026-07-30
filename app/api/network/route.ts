import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { brandApps, inquiries, investors } from "@/lib/db/schema";
import { isStaff } from "@/lib/auth/guards";

// The Network: one people directory over everything the OS already knows —
// founder contacts from the deal book (brand_app + inquiry) and the investor
// database. Read-only, staff-only, trimmed fields; deduped by email first,
// then by normalized name+company. This is the seed of the Paperboy Graph:
// the empty `contact` table becomes its spine later, this endpoint is the
// merge that will populate it.

export interface NetworkPerson {
  id: string;
  name: string;
  company: string | null;
  kind: "founder" | "investor";
  email: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  linkedin: string | null;
  dealId: string | null;
  investorType: string | null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [apps, forms, invs] = await Promise.all([
    db
      .select({
        id: brandApps.id,
        company: brandApps.company,
        contactName: brandApps.contactName,
        contactEmail: brandApps.contactEmail,
        website: brandApps.website,
      })
      .from(brandApps),
    db
      .select({
        id: inquiries.id,
        company: inquiries.company,
        firstName: inquiries.firstName,
        lastName: inquiries.lastName,
        email: inquiries.email,
      })
      .from(inquiries),
    db
      .select({
        id: investors.id,
        type: investors.type,
        groupName: investors.groupName,
        city: investors.city,
        state: investors.state,
        website: investors.website,
        linkedin: investors.linkedin,
      })
      .from(investors),
  ]);

  const people: NetworkPerson[] = [];
  const seenEmail = new Set<string>();
  const seenNameCo = new Set<string>();

  function pushFounder(p: {
    dealId: string;
    name: string | null;
    company: string | null;
    email: string | null;
    website?: string | null;
  }) {
    const name = p.name?.trim();
    if (!name) return; // contactless deals aren't people
    const email = p.email?.trim().toLowerCase() || null;
    if (email) {
      if (seenEmail.has(email)) return;
      seenEmail.add(email);
    } else {
      const key = norm(name) + "|" + norm(p.company ?? "");
      if (seenNameCo.has(key)) return;
      seenNameCo.add(key);
    }
    people.push({
      id: `deal:${p.dealId}`,
      name,
      company: p.company?.trim() || null,
      kind: "founder",
      email,
      city: null,
      state: null,
      website: p.website?.trim() || null,
      linkedin: null,
      dealId: p.dealId,
      investorType: null,
    });
  }

  for (const a of apps) {
    pushFounder({
      dealId: a.id,
      name: a.contactName,
      company: a.company,
      email: a.contactEmail,
      website: a.website,
    });
  }
  for (const f of forms) {
    pushFounder({
      dealId: f.id,
      name: [f.firstName, f.lastName].filter(Boolean).join(" ") || null,
      company: f.company,
      email: f.email,
    });
  }

  for (const inv of invs) {
    people.push({
      id: `inv:${inv.id}`,
      name: inv.groupName,
      company: null,
      kind: "investor",
      email: null,
      city: inv.city,
      state: inv.state,
      website: inv.website,
      linkedin: inv.linkedin,
      dealId: null,
      investorType: inv.type,
    });
  }

  people.sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ people });
}
