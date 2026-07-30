import type { ActionTypeDef } from "../types";

export const actionTypes: Record<string, ActionTypeDef> = {
  // ── CRM / Deal Actions ──────────────────────────────────────────────────────
  CreateDeal: {
    apiName: "CreateDeal",
    label: "Create Deal",
    description: "Add a company to the investment pipeline",
    parameters: {
      company:       { type: "string", label: "Company Name", required: true },
      category:      { type: "string", label: "Category" },
      subcategory:   { type: "string", label: "Subcategory" },
      stage:         { type: "enum",   label: "Stage",
                       enumValues: ["New", "Inbound", "Outreach", "Founder Call", "Diligence", "Watch", "Hold", "Closing", "Closed", "Passed"] },
      priority:      { type: "number", label: "Priority (1-6)" },
      contactName:   { type: "string", label: "Contact Name" },
      contactEmail:  { type: "email",  label: "Contact Email" },
      website:       { type: "url",    label: "Website" },
      message:       { type: "string", label: "Notes" },
      pitchdeckLink: { type: "url",    label: "Pitch Deck Link" },
    },
    modifies: ["Deal"],
    requiredRole: "internal",
  },

  UpdateDeal: {
    apiName: "UpdateDeal",
    label: "Update Deal",
    description: "Edit deal properties (stage, priority, contact info, etc.)",
    parameters: {
      dealId:       { type: "objectRef", label: "Deal", objectType: "Deal", required: true },
      origin:       { type: "enum",      label: "Origin", enumValues: ["app", "form"], required: true },
      stage:        { type: "enum",      label: "Stage",
                      enumValues: ["New", "Inbound", "Outreach", "Founder Call", "Diligence", "Watch", "Hold", "Closing", "Closed", "Passed"] },
      priority:     { type: "number",    label: "Priority" },
      category:     { type: "string",    label: "Category" },
      contactName:  { type: "string",    label: "Contact Name" },
      contactEmail: { type: "email",     label: "Contact Email" },
      website:      { type: "url",       label: "Website" },
      message:      { type: "string",    label: "Notes" },
    },
    modifies: ["Deal"],
    requiredRole: "internal",
  },

  // ── Blog Actions ────────────────────────────────────────────────────────────
  CreateBlogPost: {
    apiName: "CreateBlogPost",
    label: "Create Blog Post",
    description: "Write a new blog post or DEALS episode",
    parameters: {
      title:    { type: "string", label: "Title", required: true },
      category: { type: "string", label: "Category", required: true },
      date:     { type: "string", label: "Display Date" },
      image:    { type: "url",    label: "Cover Image" },
      body:     { type: "string", label: "Body (Markdown)" },
    },
    modifies: ["BlogPost"],
    requiredRole: "internal",
  },

  // ── Poker Actions ───────────────────────────────────────────────────────────
  CastVote: {
    apiName: "CastVote",
    label: "Cast Vote",
    description: "Cast a vote for a poker player (positive or negative delta)",
    parameters: {
      playerName: { type: "string", label: "Player Name", required: true },
      company:    { type: "string", label: "Company" },
      delta:      { type: "number", label: "Vote Delta", required: true },
      caster:     { type: "string", label: "Voter Name" },
    },
    modifies: ["PokerPlayer"],
    requiredRole: "any",
  },

  EliminatePlayer: {
    apiName: "EliminatePlayer",
    label: "Eliminate Player",
    description: "Toggle a poker player's eliminated status",
    parameters: {
      name: { type: "string", label: "Player Name", required: true },
    },
    modifies: ["PokerPlayer"],
    requiredRole: "internal",
  },

  AddPokerPlayer: {
    apiName: "AddPokerPlayer",
    label: "Add Poker Player",
    description: "Add a new player to the poker tournament",
    parameters: {
      name:    { type: "string", label: "Player Name", required: true },
      company: { type: "string", label: "Company", required: true },
    },
    modifies: ["PokerPlayer"],
    requiredRole: "any",
  },

  // ── Contact / Subscribe Actions ─────────────────────────────────────────────
  SubmitInquiry: {
    apiName: "SubmitInquiry",
    label: "Submit Inquiry",
    description: "Public contact form submission (investor, founder, or general)",
    parameters: {
      type:       { type: "enum",    label: "Type", enumValues: ["investor", "founder", "contact"], required: true },
      firstName:  { type: "string",  label: "First Name", required: true },
      lastName:   { type: "string",  label: "Last Name" },
      email:      { type: "email",   label: "Email", required: true },
      company:    { type: "string",  label: "Company" },
      position:   { type: "string",  label: "Position" },
      accredited: { type: "boolean", label: "Accredited" },
      deckName:   { type: "string",  label: "Deck Filename" },
      message:    { type: "string",  label: "Message" },
    },
    modifies: ["Contact", "Deal"],
    requiredRole: "public",
  },

  AddSubscriber: {
    apiName: "AddSubscriber",
    label: "Add Subscriber",
    description: "Sign up for the newsletter",
    parameters: {
      email: { type: "email", label: "Email", required: true },
    },
    modifies: ["Subscriber"],
    requiredRole: "public",
    sideEffects: ["beehiiv_create_subscription"],
  },

  // ── Admin / Sync Actions ────────────────────────────────────────────────────
  SyncDrive: {
    apiName: "SyncDrive",
    label: "Sync Drive",
    description: "Trigger a Google Drive to pgvector ingest",
    parameters: {},
    modifies: ["DriveFile"],
    requiredRole: "internal",
    sideEffects: ["drive_ingest", "embedding_generation"],
  },

  RefreshNews: {
    apiName: "RefreshNews",
    label: "Refresh News",
    description: "Regenerate the dashboard news feed from Exa.ai",
    parameters: {},
    modifies: ["NewsItem"],
    requiredRole: "internal",
    sideEffects: ["exa_search", "claude_ranking"],
  },

  SyncGmail: {
    apiName: "SyncGmail",
    label: "Sync Gmail",
    description: "Fetch latest Gmail messages for the current user and sync to database",
    parameters: {},
    modifies: ["GmailMessage"],
    requiredRole: "internal",
    sideEffects: ["gmail_api_fetch"],
  },

  SyncCalendar: {
    apiName: "SyncCalendar",
    label: "Sync Calendar",
    description: "Fetch upcoming calendar events for the current user and sync to database",
    parameters: {},
    modifies: ["CalendarEvent"],
    requiredRole: "internal",
    sideEffects: ["calendar_api_fetch"],
  },
};
