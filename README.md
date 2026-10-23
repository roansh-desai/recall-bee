# Recall

A local people memory, grounded in conversations recorded and processed by Bee.

Recall is for someone who meets people at events and wants to remember the details that make a useful follow-up: who they are, what you discussed, their explicitly spoken social handle, and what each of you promised. Search a name before a meeting to get a short brief with quotes you can check.

**Evidence status:** fixture tests and a production build pass. Live retrieval stored four real conversations; a short self-recorded sample produced one person card, one handle, one unresolved promise, and a four-line brief with sources. Live Ask returned a Bee-search source, and the proxy accepted a read of the todos endpoint. The initial isolated stream probe received only a connection signal; subsequently the final running ingest worker received an actual conversation-update payload at 2026-10-23 16:13:47 UTC and updated its live status. A later spoken sentence generated a conversation update plus utterance event, was stored as a separate fourth conversation, and appeared in the live UI. See [verification evidence](docs/VERIFICATION.md). Actual todo creation/completion, user-recorded video, and Devpost submission are not claimed. Unknown speaker labels leave promise direction unresolved. Fixture mode is explicitly labelled and never writes fake todos to Bee.

## Run locally

Use Node.js 22.12+ or 24, npm, and a Bee device or Apple Watch running Bee software for live mode.

```sh
git clone --branch feat/recall https://github.com/roansh-desai/recall-bee.git
cd recall-bee
npm install
npm install -g @beeai/cli
npm run dev:fixture
```

Open **http://127.0.0.1:5173** exactly (not `localhost`, which can resolve to another service on IPv6). This starts frontend and backend in one command with invented people from `fixtures/conversations.json`. The fixture database is separate from live data. Stop with Ctrl-C before switching modes.

For live mode, update the Bee iOS app, sign in to your account, open **Settings**, and tap the **Version** row **five times** to enable Developer Mode. Then:

```sh
bee login --no-wait
# Open the printed link and approve the connection in Bee.
bee status
npm run dev
```

`npm run dev` starts `bee proxy --port 8787`, the Node backend with its stream worker, and Vite together. The web app binds to loopback only. Do not expose the proxy or app through a public tunnel. If login fails, update Bee and repeat the five taps. The new-phone Sign-in with Amazon setup does not provide old-account conversation history.

Optional configuration: copy `.env.example` to `.env`. The default uses Bee CLI-managed credentials; no token is needed in the project. If a proxy already runs on port 8787, set `RECALL_MANAGE_PROXY=false`. Only the todo HTTP calls use `BEE_API_URL`; conversation retrieval and search still use the authenticated CLI.

## Record a consented sample

Ask a friend for permission to record and show their words and handle publicly. Use their actual chosen details, or record only yourself. Do not treat the fake fixture's names and handles as a real person.

1. Start Recall in live mode and keep its terminal visible.
2. Friend: “My name is [name]. I work as [role] at [organization]. We met at [event]. I am working on [specific topic]. My Instagram handle is [handle]. I will send you [item].”
3. You: “My name is [your name]. I will send you the deck by [an explicit date, time, and time zone].”
4. Let Bee process the conversation. In Recall, choose **which speaker is you** for that conversation. Generic labels are never assumed to identify the wearer.
5. Check the quotes, name transcription, handle, brief, and promise direction before recording the demo. If all labels are `Unknown`, Recall blocks wearer selection and leaves direction unresolved; record a sample with usable diarization before demonstrating two-direction todo write-back. An ambiguous due phrase remains a hint instead of becoming an invented alarm.

If no conversation appears yet, finish the recording in Bee, wait for processing, check `bee conversations list --json`, and press Sync in Recall. Do not present fixture screenshots as live evidence.

## How Bee is used at runtime

```text
Bee device / Apple Watch
        |
        v
Bee processing -> Bee CLI stream + conversation / transcript reads
                              |
                              v
                       Node ingest worker
                       startup + 60s backfill
                              |
                              v
                 local rules -> SQLite in data/private/
                              |
                              v
                      React local dashboard
                      |                  |
                Bee CLI search     Bee proxy -> todos API
```

| Runtime path | Code |
| --- | --- |
| App startup and worker lifecycle | `scripts/dev.ts`, `server/index.ts`, `server/app.ts` |
| Live stream child process | `BeeClient.stream()` in `server/bee.ts` |
| Full transcript fetch on conversation, summary, or location update; startup and periodic paginated backfill | `startIngest()` in `server/ingest.ts` |
| CLI conversation, transcript, facts, search and location wrappers | `BeeClient` in `server/bee.ts` |
| Raw JSON event payload normalization | `streamShape()` and `normalizeConversation()` in `server/normalize.ts` |
| Rules and explicit source attribution | `server/extract.ts`, `server/brief.ts` |
| Search-first answers, with retrieved quotes or an unavailable answer | `server/ask.ts` |
| Promise creation and completion through POST/PUT todos | `server/todos.ts`, `BeeClient.createTodo()` / `completeTodo()` |
| SQLite storage and local erasure | `Store` in `server/db.ts` |

The worker runs `bee stream --types new-conversation,update-conversation,update-conversation-summary,update-location --json`. It fetches the full transcript again on relevant events. Bee's stream does not guarantee delivery, so complete paginated conversation-list backfill runs at startup, reconnect, and every minute. Console output contains event categories and receipt times, not transcript payloads. Connection and synchronization indicators are separate: an available API is not proof that a fresh event arrived.

Facts and locations have wrappers and probe coverage; they are not silently assigned to a person. People claims come from source utterances. Location is shown only when a named location is actually present. No calendar integration is required for pre-meeting use: search the person's name before the meeting.

## Data probes and verification

After a real consented conversation exists:

```sh
npm run probe -- --conversation CONVERSATION_ID --query 'NAME_SAID' --seconds 60
# Immediate all-event stream-only probe while speaking:
node --import tsx scripts/probe-stream.ts 60
npm test
npm run build
```

The probe calls conversation get, transcript, facts, search, all three location commands, and captures the raw JSON stream for 60 seconds. Raw responses remain in process memory; only a redacted shape summary is written to ignored `data/private/probes/`. It records generic speaker labels, timestamp availability, name-field keys, named-location presence, and distinct stream payload shapes. Speaker stability remains unknown without comparison and human confirmation. Missing timestamps are cited by conversation ID and quote, without invented time offsets.

Screenshots under `docs/screens/` must contain only the invented fixture. Live captures and exports belong outside Git. See [DEMO.md](DEMO.md) and [SUBMISSION.md](SUBMISSION.md) for recording and submission steps.

## PRIVACY

Recall keeps its own conversation transcripts, people, quotes, handles, promises, wearer choices, and resolution decisions in SQLite under **`data/private/`**, which Git ignores. There is no cloud database, analytics, or extraction LLM. No transcript is sent to OpenAI, Bedrock, or another model provider. Bee already processes recordings in its service; runtime retrieval, search queries, and explicit promise write-back necessarily communicate with Bee. “Local” describes Recall's storage and extraction, not an offline replacement for Bee.

Only social handles or URLs actually spoken in the source are extracted. Recall does not scrape social networks, search for profiles, or guess a profile from a name. A platform mentioned without a handle is retained as a mention with its quote and no link. Opening a social link leaves the local app and contacts that platform.

**Forget person** deletes that person's containing conversations and all derived claims from those conversations, including shared details about other participants. It blocks those conversation IDs from backfill so they cannot immediately reappear. This is deliberately broader than deleting a card while retaining its transcript. It does not delete originals or todos in Bee, files you exported, operating-system backups, or screenshots. Delete those separately where necessary. Probe summaries contain structural metadata only, never raw quotes or handles.

The same erasure is available from the command line; stop the app first:

```sh
npm run forget -- PERSON_ID
# For the isolated fixture database:
RECALL_MODE=fixture npm run forget -- PERSON_ID
```

**Export my data** downloads local JSON. Treat the downloaded file as private. `.env`, databases, logs, raw Bee dumps, and real-person screenshots must never be committed. Credentials stay in Bee's credential store or an ignored `.env`; the frontend never receives a token. File permissions restrict the SQLite file to its owner, but this is not database encryption.

## Limitations

- Bee provides processed transcripts, summaries and facts, not raw audio. Recall performs no audio or voice analysis.
- Speaker labels are generic and may change between conversations. A user selects the wearer per conversation when usable labels are available. The observed class samples all used `Unknown`, which cannot distinguish participants. Recall never merges people using a speaker label.
- Rule-based extraction needs clear introductions and promises. It can miss natural phrasing and transcription errors. Rename and merge-confirm controls remain necessary; cross-conversation identities are not silently merged.
- Small consented samples do not establish accuracy across accents, languages, names, or busy events.
- Quotes make claims reviewable, but a transcription mistake can still appear in a quoted source.
- Stream events can be missed; backfill trades speed and additional CLI requests for recovery.
- Recall's Forget operation is local. Deleting a conversation in Bee is not currently a bidirectional deletion sync.
- Todo failures remain visible. No successful Bee write is claimed until the API responds. Repeated manual retries after an ambiguous network failure can create duplicates; check Bee before retrying.
- No optional LLM has been enabled or implemented. Bedrock/AWS Builder is not claimed.

## Future work

When someone asks me a question and I stay silent for a few seconds, a phone could vibrate with a suggested answer from my past conversations. **Future work only:** Recall does not detect silence, listen to raw audio, infer questions in real time, or send phone vibrations.

## Project origin and licenses

Recall is a fresh standalone project created during the hackathon, with no dependency on another personal project. No pre-existing application snippet is reused. The owner’s portfolio supplied the approved light palette and layout direction (large Geist type, warm paper, a holographic wash and generous spacing); Recall implements those styles independently. Gold is restricted to selection/search accents and the live badge. Motion uses short entrances, a sourced-brief blur fade, count transitions and a pointer-following ambient layer that stays static for touch and reduced motion. The hand-written blur fade, number ticker, empty state, and toast follow the supplied design descriptions; no remote component source was copied. React, Vite, Tailwind, Motion and Phosphor are dependencies; Geist fonts carry their own SIL Open Font License. Recall source is [MIT licensed](LICENSE).

[Product feedback](PRODUCT_FEEDBACK.md) · [Friction log](FRICTION_LOG.md) · [Feature requests](FEATURE_REQUESTS.md)

References: [Bee CLI](https://docs.bee.computer/docs/cli), [Developer Mode](https://docs.bee.computer/docs/developer-mode), [API](https://docs.bee.computer/docs/api), [Realtime](https://docs.bee.computer/docs/realtime), [Search](https://docs.bee.computer/docs/search), [Hackathon rules](https://amazonappdev2026.devpost.com/rules). The published deadline is October 23, 2026 at noon PDT, equivalent to **October 24, 2026 at 00:30 IST**. A fixture alone is not a qualifying Bee demonstration.
