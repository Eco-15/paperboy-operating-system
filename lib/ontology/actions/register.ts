// ── Handler Registration ─────────────────────────────────────────────────────
// Imports all action handlers and registers them with the dispatcher.
// Import this file once at API boundary to wire everything up.

import { registerHandler } from "./execute";
import { createDeal } from "./handlers/create-deal";
import { updateDeal } from "./handlers/update-deal";
import { createBlogPost } from "./handlers/create-blog-post";
import { castVote } from "./handlers/cast-vote";
import { eliminatePlayer } from "./handlers/eliminate-player";
import { addPokerPlayer } from "./handlers/add-poker-player";
import { submitInquiry } from "./handlers/submit-inquiry";
import { addSubscriber } from "./handlers/add-subscriber";
import { syncGmail } from "./handlers/sync-gmail";
import { syncCalendar } from "./handlers/sync-calendar";
import { syncDrive } from "./handlers/sync-drive";

registerHandler("CreateDeal", createDeal);
registerHandler("UpdateDeal", updateDeal);
registerHandler("CreateBlogPost", createBlogPost);
registerHandler("CastVote", castVote);
registerHandler("EliminatePlayer", eliminatePlayer);
registerHandler("AddPokerPlayer", addPokerPlayer);
registerHandler("SubmitInquiry", submitInquiry);
registerHandler("AddSubscriber", addSubscriber);
registerHandler("SyncGmail", syncGmail);
registerHandler("SyncCalendar", syncCalendar);
registerHandler("SyncDrive", syncDrive);

// RefreshNews is a long-running operation that delegates to lib/news/run-news.ts.
// It will be registered when that subsystem is refactored to expose an ActionHandler.
