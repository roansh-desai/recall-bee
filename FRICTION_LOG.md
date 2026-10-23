# Friction log

Observed during the 23 October 2026 Recall build. **Environment failures, documentation findings, synthetic tests, and live account results are distinguished.** No private names, quotes, addresses, credentials, or raw payload values are included.

| # | Task and steps | Expected → actual | Severity | Workaround | Suggestion | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Start from a new phone using Sign-in with Amazon; check available history | Owner initially reported no history → after CLI approval, two real class-recording conversations were available | High for demo readiness | Build an explicitly labelled fixture while connecting the actual account; use class data privately for schema checks only | First-capture checklist and clear account/history indicator | Owner report, then live list |
| 2 | Read onboarding and run `bee status` | App sign-in might appear sufficient → Developer Mode requires five Version-row taps; sandboxed status returned macOS code -50 | Blocking | Rerun outside sandbox: status correctly said not logged in. `bee login --no-wait` generated an approval link; user approved successfully | Explicit Developer Mode readiness and actionable credential-store diagnostics | Docs + observed environment failure + live login success; not a Bee outage |
| 3 | Consume `bee stream --json`; inspect documented and real payloads | An event-name field would make routing simple → no documented `event` field; initial probe emitted only `{timestamp:number}`, while a later live payload also contained a `type` key | Medium | Parse structural keys. Treat the timestamp-only payload as a stream signal, never a new conversation. Preserve the last actual data-event timestamp | Optional typed envelope | Docs, parser tests, live probe |
| 4 | Rely on stream delivery; simulate a mid-fetch update | A stream alone is tempting → delivery is at most once, and concurrent refreshes can lose an update | High | Paginated startup/reconnect/60-second backfill; serialize fetches and repeat when a new update arrives during one | Replay cursor with documented recovery semantics | Documented delivery contract + passing synthetic worker test |
| 5 | Normalize live conversation get and transcript output | Assumed flat utterances and timestamp field → get nested them in `transcriptions[].utterances`; transcript used `spoken_at`, plus processing `created_at` | High | Flatten the real nesting and prefer spoken time. Never call processing time a spoken moment | Full JSON schema and timestamp field semantics | 469-entry live transcript; regression test |
| 6 | Derive a meeting location | Named venue would be useful → actual list/get had `primary_location.address`, and location endpoints returned addresses/coordinates rather than a selected venue name | Medium | Omit location from brief/demo. Do not reverse-geocode or display the address by default | Canonical location shape and a privacy-aware display-name field | Live get/list/current/recent/clusters shapes |
| 7 | Stop the 60-second probe | Killing the npm CLI wrapper should stop streaming → native Bee child outlived its wrapper and kept the probe's pipes open | Medium | Terminated the specific orphan, then made owned Bee streams detached process groups and terminate the full group | Forward signals from the npm wrapper to its native child | Observed process tree and shutdown fix |
| 8 | Preserve private probe evidence while supporting Forget | Raw dumps ease debugging → retaining them would create a second transcript store outside SQLite erasure | High for privacy | Keep raw probe responses in process memory only; persist redacted shapes, counts and generic labels | Built-in schema-only diagnostics mode | Local privacy audit and implementation fix |
| 9 | Create source-grounded todo alarms | One date format and safe retries are desirable → API input is ISO 8601, output is epoch ms; no create-idempotency contract shown | Medium | Send only explicit resolvable due times; keep vague hints and visible sync failures; preserve returned todo IDs | Todo idempotency key and unified date documentation | Documentation + HTTP-contract test; no live todo write claimed |

## Actual probe outcome

On 23 October 2026, authenticated calls succeeded for conversation get, transcript, facts, keyword search, current location, recent locations, and clusters. The selected conversation contained **469 transcript entries**; all had a numeric `spoken_at` field. No conversation name field was present. Facts returned **2 records**. Search returned **1 result** for the neutral subject term `math`.

**Deviation from the requested name probe:** the available sample was a class recording, not a consented person-introduction/promise exchange. The probe used a subject query; this does not establish person-name search accuracy, a people card, or todo completion. The recorded class remains private and is not authorized for public demo screenshots by this log.

The location schemas were:

```text
conversation.primary_location: {address, latitude, longitude, created_at}
current: {location:{id, latitude, longitude, address, source_device_id, created_at, updated_at}, age_ms, is_recent, recent_threshold_ms, timezone}
recent: {visits:[{visit_id, start_at, end_at, duration_ms, latitude, longitude, sample_count, address, source_device_ids}], from, to, timezone}
clusters: {clusters:[{cluster_id, latitude, longitude, representative_address, visit_count, sample_count, total_dwell_ms, first_visit_at, last_visit_at}], from, to, min_visits, timezone}
```

No raw values from those location fields are retained in this document. The first 60-second stream probe received **one timestamp-only payload**, with shape `{timestamp:number}`; no new conversation, summary, location, or utterance payload arrived in that initial interval. The final integrated worker subsequently received an actual conversation-update payload at 2026-10-23 16:13:47 UTC; `/api/state` reported that event and a connected stream. An event log alone does not establish promise direction or a completed todo write. Separately, the integrated app stored three conversations; a short self-recorded sample produced a sourced card, handle, unresolved promise and four-line brief. Live Ask returned a Bee-search source, and the proxy todos GET returned HTTP 200. These reads are not proof of todo creation or completion.

The private redacted summary records field types and counts, not raw quotes. A follow-up local database check confirmed the generic label was exactly `Unknown` across the sampled conversations. This does not identify the wearer or distinguish participants. Do not map an undifferentiated Unknown label to a person. **Still unestablished:** which label is the wearer, stability across conversations, person-introduction extraction quality on live data, capture-to-card latency, and real todo acceptance/completion. A user must confirm the wearer for each conversation. Fixture tests do not establish these facts.

## Reproduce without retaining raw recordings

```sh
npm run probe -- --conversation CONVERSATION_ID --query 'CONSENTED_NAME' --seconds 60
```

This invokes get, transcript, facts, search, all three location commands, and the stream. Raw responses stay in process memory; only `data/private/probes/<time>/redacted-summary.json` is written. Review it before sharing. Never commit a real transcript or raw Bee response.

## Second 60-second live stream probe

The immediate all-event probe ran **16:16:28–16:17:28 UTC**. It received one stream signal, one conversation payload at **16:17:10.879 UTC**, and one utterance payload at **16:17:10.959 UTC**. The probe exited cleanly after the process-group fix. The final app also received the update, stored the new sentence as a fourth conversation, and displayed it in its live local UI. A new conversation is kept separate; Recall does not silently attach it to an existing person.

These are actual redacted structural shapes, not documentation examples:

```text
{timestamp:number}
{type:string, conversation:{id:number, start_time:string, end_time:null, conversation_uuid:string, device_type:string, device_id:null, summary:null, short_summary:null, state:string, primary_location:null, template:null, city:null, business:null, bookmarked:boolean}}
{type:string, conversation_uuid:string, utterance:{id:number, sample_id:string, start:null, end:number, text:string, spoken_at:string}}
```

The actual utterance event had no speaker field. The live payload did contain a `type` field, although the documentation emphasizes structural routing and warns against expecting `event`. Recall uses structural keys and does not depend on either undocumented values or a missing `event` field.

The user initially opened another service through `localhost:5173` (IPv6); Recall was running correctly on **http://127.0.0.1:5173**. Use that exact IPv4 loopback URL. The frontend and backend responded successfully, and the real UI was visually checked without committing private screenshots.
