# `loaders/slackLoader.ts`

## Purpose

Pull all messages from the 3 simulated Slack channels, paging through the rate-limited API until
each channel is fully consumed. Returns `RawDocument`s (see [types.md](types.md)), one per
channel.

## Process

1. **For each of the 3 channels** (`lab-notes`, `engineering`, `offtopic`), fetched **sequentially**
   (not in parallel — deliberately gentle on the rate-limited API):
   1. Start at `page=1`.
   2. `GET https://lev-boots-slack-api.jona-581.workers.dev/?channel=<channel>&page=<n>`. The
      response is `{ channel, page, limit, total, items: [{ id, channel, user, role, ts, text,
      thread_ts }] }` — verified against the live API.
   3. Collect `items` from that page.
   4. If the API returns `429`, back off (increasing delay per retry, up to 5 attempts) and retry
      the *same* page — don't skip it or advance the page counter on failure.
   5. Increment `page`, wait briefly (300ms) to stay easy on the rate limit, and repeat until a
      page comes back with an empty `items` array (confirmed against the live API: the page right
      after the last real one returns `items: []` with the same `total`/`limit`, rather than an
      error).
2. **Combine messages per channel** into one raw text blob: each message becomes `"<user>:
   <text>"`, and messages are joined with a **blank line** between them (`\n\n`) — so each message
   reads as its own paragraph to `chunking.ts`, which then merges short ones together and splits
   any oversized one, same as it does for articles.
3. **Output:** an array of `RawDocument` — `{ source: 'slack', source_id: <channel name>, text:
   <all messages in that channel, concatenated> }`, one entry per channel (3 total).

## Notes

- This is the only loader with pagination *and* rate-limiting to handle, since it's explicitly
  called out in the README as a "simulated API with pagination + rate limiting." In practice, no
  `429` was observed during testing (all channels, full pagination, ~27s total for all 3), but the
  retry path exists for when it does happen.
- `source_id` is just the channel name here (not page number), since messages from a channel are
  merged into one text blob before chunking — `chunk_index` (assigned later, during chunking)
  is what distinguishes individual chunks within that channel's content.
- Verified against the live API: `lab-notes` (71 messages → 3 chunks), `engineering` (4 chunks),
  `offtopic` (2 chunks) — word counts mostly in the 240–580 range.

## Used by

- `ragService.loadAllData` — one of the three sources combined before chunking/embedding.
