# Verification — 23 October 2026

This records observed behavior, not a claim that the video or Devpost entry has been submitted. No real names, handles, transcript text, account identifiers, or addresses are included.

## Live Bee evidence

- The owner confirmed that the demo recordings came from a **physical Bee device**. The API's `device_type` field reported `unknown`, so hardware provenance is owner-confirmed, not inferred from that field. Show the physical device in the video.
- Bee CLI authenticated after owner approval. Recall was started with `npm run dev`, which runs the proxy, API/ingest worker, and frontend together.
- Real conversation-list, conversation-get, transcript, facts, keyword search, and all three location commands succeeded. One class recording supplied 469 transcript entries; each had a `spoken_at` value. Facts returned two records; a subject search returned one result.
- A new owner-recorded sample produced a person card, a spoken social link, a sourced brief, and an unresolved promise. The brief used only available evidence rather than padding missing details.
- The running application received a real conversation update at **16:13:47 UTC**. A later live probe observed another conversation event at **16:17:10.879 UTC**, followed by an utterance event at **16:17:10.959 UTC**. The additional recording appeared in SQLite and in the visible dashboard. Four real conversations were present at that check.
- The live dashboard was opened in Chrome at **http://127.0.0.1:5173** and showed Connected to Bee, the new source conversation, and its latest conversation-update indicator. The frontend and API both returned HTTP 200.
- The live Ask path called Bee search and returned a cited result. The local proxy's todo-list endpoint returned HTTP 200.

## Unverified or deliberately unresolved

- Bee returned `Unknown` for speaker attribution in the inspected recordings. Recall refuses to select that as the wearer. Promise direction stays unresolved, and the UI marks person attribution as unconfirmed. No stable wearer label, voice identification, or cross-conversation speaker identity is claimed.
- Real todo creation/completion has **not** been verified. The sample does not safely establish an `I owe` promise. Automated tests cover creation, returned IDs, remote acknowledgement, alarms, and failure handling; these are not live write proof.
- Locations contain addresses/coordinates without a useful venue name, so they are omitted from briefs and the demo.
- The public demo video is not recorded or uploaded by this project. The owner records it. Devpost submission remains a separate required action.

## Automated and visual checks

**34 tests passed.** `npm test` covers transcript normalization, real-shape regression cases, stream/backfill behavior, missed-update recovery, forgotten-source suppression, extraction, ambiguous identity, sourced briefs, retrieval abstention, promise write-back, and the HTTP privacy flow. `npm run build` passed TypeScript checking and a Vite production build.

The browser checks use invented fixture records, with screenshots under `docs/screens/`. Desktop and 360px mobile views cover home, brief, person, promises, privacy, and the empty state. Reduced-motion/touch behavior keeps the ambient background static. Live account data is not captured in public screenshots. The owner explicitly replaced the initial dark requirement with the portfolio’s light palette. The final UI uses warm paper, black Geist type, a restrained holographic wash, indexed people rows and small gold accents on search/selection/live status. Browser interaction verified that the ambient layer follows pointer movement, while reduced-motion and emulated touch both compute a static transform. No horizontal overflow was observed at 360px on home, brief, promises or privacy. Navigation resets scroll so page headings stay visible. The ten public screenshots were refreshed from invented fixture data. Local real-data UI footage was captured separately for the owner’s video handoff; this is processed-data playback, not footage of a fresh recording arriving.

## Publication boundary

Only source, tests, invented fixtures, documentation, and fixture screenshots belong in Git. `data/`, `.env`, logs, dependencies, and build output are ignored. The local video handoff is not part of the public application. Publication uses **`feat/recall`**, never `main`.

GitHub reports the repository public, its default branch `feat/recall`, and its detected license MIT. The initial publication scan found no staged private transcript text/conversation IDs, credential-pattern matches, or files under `data/`. A `git log -p` review of token/bearer matches found only configuration references, documentation, package names, and an invented test credential.

See [DEMO.md](../DEMO.md) for the recording script and [SUBMISSION.md](../SUBMISSION.md) for the final acceptance checklist. Do not substitute fixture evidence for the required real Bee demonstration.
