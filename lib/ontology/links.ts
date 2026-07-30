import type { LinkTypeDef } from "./types";

export const linkTypes: Record<string, LinkTypeDef> = {
  // BlogPost -> User
  blog_authored_by: {
    apiName: "authored_by",
    label: "authored by",
    from: "BlogPost",
    to: "User",
    cardinality: "many-to-one",
    foreignKey: "authorId",
    reverse: "blog_posts",
  },

  // Chat -> User
  chat_owned_by: {
    apiName: "owned_by",
    label: "owned by",
    from: "Chat",
    to: "User",
    cardinality: "many-to-one",
    foreignKey: "userId",
    reverse: "chats",
  },

  // PokerPlayer -> PokerVote
  player_has_votes: {
    apiName: "has_votes",
    label: "has votes",
    from: "PokerPlayer",
    to: "PokerVote",
    cardinality: "one-to-many",
    foreignKey: "playerId",
  },

  // DriveFile -> DocChunk
  file_has_chunks: {
    apiName: "has_chunks",
    label: "has chunks",
    from: "DriveFile",
    to: "DocChunk",
    cardinality: "one-to-many",
    foreignKey: "driveFileId",
  },

  // Invite -> User
  invite_created_by: {
    apiName: "invited_by",
    label: "invited by",
    from: "Invite",
    to: "User",
    cardinality: "many-to-one",
    foreignKey: "invitedBy",
    reverse: "invites_created",
  },

  // Deal <-> Investor (M:N, join table created in Phase 2)
  deal_matched_investor: {
    apiName: "matched_with",
    label: "matched with investor",
    from: "Deal",
    to: "Investor",
    cardinality: "many-to-many",
  },

  // Contact -> Deal (same row, different view)
  contact_as_deal: {
    apiName: "as_deal",
    label: "as deal",
    from: "Contact",
    to: "Deal",
    cardinality: "one-to-one",
  },

  // GmailMessage -> User
  gmail_belongs_to: {
    apiName: "belongs_to",
    label: "belongs to",
    from: "GmailMessage",
    to: "User",
    cardinality: "many-to-one",
    foreignKey: "userId",
    reverse: "gmail_messages",
  },

  // GmailMessage -> Contact (matched by from/to email)
  gmail_relates_to: {
    apiName: "relates_to",
    label: "relates to contact",
    from: "GmailMessage",
    to: "Contact",
    cardinality: "many-to-one",
    // No FK — resolved at query time by matching from/to against contact email
  },

  // CalendarEvent -> User
  calendar_belongs_to: {
    apiName: "belongs_to",
    label: "belongs to",
    from: "CalendarEvent",
    to: "User",
    cardinality: "many-to-one",
    foreignKey: "userId",
    reverse: "calendar_events",
  },

  // CalendarEvent -> Contact (matched by attendee email)
  calendar_involves: {
    apiName: "involves",
    label: "involves contact",
    from: "CalendarEvent",
    to: "Contact",
    cardinality: "many-to-many",
    // No FK — resolved at query time by matching attendee emails
  },
};
