# Recall — Devpost submission copy

**Status:** Submission preparation. This file does not prove that live end-to-end verification, the public video, or Devpost submission has happened. Complete the acceptance checklist below and remove unsupported claims from the final entry if any capability is cut.

## Project name

Recall

## Tagline

A local people memory that turns consented Bee conversations into sourced briefs and promises you can keep.

## Inspiration

Meeting someone is easy; remembering the details that make the next conversation thoughtful is harder. A name, a project, a social handle, and a small promise can disappear between events. Recall brings those details back at the moment they are useful, with the original quote beside each claim.

## What it does

Recall is a standalone local web app for people who meet collaborators, classmates, and friends. It builds people cards from explicit self-introductions in Bee's processed transcripts. Search “who is [name]?” to see a short brief: who they are, the last recorded conversation, topics discussed, promises in both directions, and an opener grounded in a prior detail. The same brief works before a meeting.

Social links come only from handles or URLs actually spoken in the conversation. A bare “find me on LinkedIn” becomes a sourced mention with no invented profile. Promises retain their source quote and due hint. Recall never treats generic speaker labels as voice identification: the wearer selects their own speaker for each conversation, and possible cross-conversation identity matches require confirmation.

## How we built it

React, Vite, TypeScript, Tailwind, Motion, Geist, and Phosphor form the interface. A local Node/Express server and a shared TypeScript ingestion worker store data in SQLite under a gitignored private directory. Extraction uses deterministic local rules; no cloud LLM receives transcripts. The application listens only on the loopback interface.

The Bee integration runs in the application, not just in this description:

- **Stream:** a long-running `bee stream` process listens for conversation and location updates. It fetches the processed conversation and transcript, then refreshes local sourced records. Startup and periodic backfill recover events missed by the at-most-once stream.
- **Conversations/transcripts:** Bee CLI calls retrieve the source content used by person cards, promises, and briefs.
- **Search:** Ask calls Bee search first in live mode, returns cited retrieved text, and abstains when evidence is missing. It does not fabricate an answer from a name.
- **Facts:** the Bee client and probe include the facts endpoint for integration diagnostics. Facts are not silently attached to people without reliable attribution.
- **Todos:** local proxy API calls create Bee todos for confirmed “I owe” promises and update the same todo on completion. Ambiguous creation failures are shown instead of blindly retried. Dates without an explicit time and timezone remain hints. Alarms support ISO timestamps and explicit date/today/tomorrow plus a time and IST, UTC, GMT, or numeric UTC offset.

The fake fixture is clearly labeled and is only for tests, development, and public screenshots. The Bee-track demo must show useful behavior based on live data captured by the actual device or Apple Watch.

## Challenges and limitations

Bee provides processed text, not raw audio. Generic speaker labels, name transcription errors, and short conversations make identity attribution uncertain. Recall resolves this with explicit self-introductions, a per-conversation wearer setting, source quotes, and confirmation before merging people. Rule-based extraction deliberately misses ambiguous wording. There is no voice analysis, social scraping, or automatic profile lookup. The tested sample is small; the final entry should state the actual real-data validation performed.

## Privacy

Recall's database stays on the local Mac, with no analytics or cloud database. Bee itself remains the upstream provider and processes device recordings under its own service. A Forget action deletes the selected person's local source conversations and derived data, including shared-conversation records, and blocks those conversation IDs from backfill. It does not delete Bee's originals or already-created Bee todos. Export downloads the local Recall records. Only consenting people and agreed details belong in the public demo; no real transcripts, tokens, raw dumps, or third-party personal details belong in the repository.

## What is next

Future work only: real-time assistance when someone asks a question and the wearer stays silent for a few seconds, with a phone vibration and an answer grounded in prior conversations. That behavior is not implemented, and Recall currently has no access to raw audio or silence detection.

## Built with

Bee CLI; Bee stream; Bee conversations and transcripts; Bee search; Bee local proxy / todos API; Node.js; TypeScript; Express; React; Vite; Tailwind CSS; Motion; SQLite; better-sqlite3; Geist; Phosphor.

## Track and mini challenges

- Track: **Bee**.
- Mini challenge: **Open Source**, with a public repository and MIT license.
- AWS Builder: **do not select**; Bedrock is not used in this implementation.

## Originality statement

Recall was created as a fresh repository during the hackathon, with no dependency on the author's other projects. It uses open-source npm dependencies. The short blur-fade, count-tween, empty-state, and toast components were implemented directly from the supplied design specification. The demo must distinguish committed invented fixtures from real device data.

## Links to paste

- Repository: https://github.com/roansh-desai/recall-bee
- Demo video: **REPLACE_WITH_PUBLIC_YOUTUBE_OR_VIMEO_URL**
- Product feedback: repository `PRODUCT_FEEDBACK.md`
- Feature requests: repository `FEATURE_REQUESTS.md`
- Friction log: repository `FRICTION_LOG.md`

## Before pressing Submit

- [ ] Live Bee ingest works in the final public revision and the demo shows it.
- [ ] Repo public, MIT LICENSE present, no secrets or private data in files/history.
- [ ] README includes exact Bee-at-runtime pointers, PRIVACY, and Future work.
- [ ] Video under 3:00, public on YouTube/Vimeo, English, no copyrighted music, consented people/details only.
- [ ] Devpost Bee track selected; description, repo URL, video URL, feedback, and friction log present.
- [ ] Pressed **SUBMIT**, not only saved a draft, before **October 24, 2026 at 12:30 a.m. IST**.

Rules reference: https://amazonappdev2026.devpost.com/rules
