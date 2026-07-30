// Ontology objects the agent returns aren't just text — they're typed records the
// OS already has pages for. This maps an object back to its place in the app so a
// result in chat is one click from the real thing.

export function objectTitle(objectType: string, obj: Record<string, unknown>): string {
  const t =
    obj.company ??
    obj.groupName ??
    obj.title ??
    obj.name ??
    obj.subject ??
    obj.fileName ??
    obj.id;
  return String(t ?? "—");
}

/** Where this object lives in the OS (or on the web). Null = nowhere to go. */
export function objectHref(
  objectType: string,
  obj: Record<string, unknown>,
): { href: string; external: boolean } | null {
  const id = obj.id ? String(obj.id) : "";
  const str = (k: string) => (typeof obj[k] === "string" ? (obj[k] as string) : null);

  switch (objectType) {
    case "Deal":
      return id ? { href: `/crm/${id}`, external: false } : null;
    case "Investor":
      return { href: "/investors", external: false };
    case "BlogPost":
      return { href: "/blog", external: false };
    case "PokerPlayer":
      return { href: "/poker", external: false };
    case "NewsItem": {
      const u = str("url");
      return u ? { href: u, external: true } : null;
    }
    case "DriveFile": {
      const u = str("webLink");
      return u ? { href: u, external: true } : null;
    }
    default:
      return null;
  }
}

/** The columns worth showing for a given object type, in order. */
export function previewColumns(objectType: string, objs: Record<string, unknown>[]): string[] {
  const preferred: Record<string, string[]> = {
    Deal: ["company", "stage", "priority", "category", "contactName", "date"],
    Investor: ["groupName", "type", "city", "state"],
    NewsItem: ["title", "source", "category"],
    BlogPost: ["title", "category", "displayDate"],
    GmailMessage: ["from", "subject", "date"],
    CalendarEvent: ["title", "start", "location"],
    DriveFile: ["name", "title", "modifiedTime"],
    PokerPlayer: ["name", "company", "baseVotes"],
    User: ["email", "role", "name"],
    Contact: ["firstName", "lastName", "email", "company"],
  };
  const want = preferred[objectType];
  const present = new Set<string>();
  for (const o of objs) for (const k of Object.keys(o)) present.add(k);

  if (want) {
    const cols = want.filter((c) => present.has(c));
    if (cols.length) return cols;
  }
  // Fallback: first handful of scalar keys, id last.
  return [...present]
    .filter((k) => k !== "id" && k !== "origin")
    .slice(0, 5);
}
