# Bee product feedback

Project: Recall, a local people memory. Evidence labels below distinguish documentation review, automated fixture tests, and live account observations. They are not a claim that a video was recorded or a submission was made.

## CLI and onboarding

**Used for:** account status and login, conversation enumeration and transcript retrieval; the runtime also invokes conversation and search commands. The builder reported a fresh phone using Sign-in with Amazon, with no prior history assumed available. Developer Mode requires five taps on the Version row; this prerequisite was verified in the official instructions, not inferred from login failure.

**What worked:** CLI 0.9.0 was installed and its version command worked. `bee login --no-wait` produced an approval link, enabling the user to authorize from the phone while coding continued. After approval, conversation listing returned two real records. The CLI let the local app avoid handling a bearer token in the browser.

**What needs work:** a sandboxed status check returned a macOS parameter error, code -50. Running the same status command outside the sandbox correctly reported not logged in. This was an execution-environment credential access issue, not evidence of a Bee outage. A clearer credential-store diagnostic would shorten this path. Developer Mode is also easy to miss after signing into a new phone.

**Would I build with it again?** Yes for local personal tools: subprocess integration keeps the browser away from credentials. I would make the onboarding prerequisite and credential-store failure easier to diagnose.

## Stream

**Used for:** a long-running live worker, refreshing full conversations after conversation, summary, and location payloads. Automated tests exercise an update arriving while a previous fetch is in flight and prove it triggers another read.

**What worked:** the documentation explicitly says JSON mode emits raw payloads without a top-level event name. Recall uses structural keys and the CLI type filter. Tests confirm backfill pagination and suppression of forgotten/in-flight forgotten conversations.

**What needs work:** the documented `event` field is absent, while a later real payload did include `type`; deletion/update shapes can overlap structurally. A canonical versioned schema would remove this uncertainty. A typed envelope would remove ambiguity. At-most-once delivery requires an additional recovery path; Recall lists all conversations on startup and periodically. The 60-second live probe received one timestamp-only signal and no conversation update. Later, the final integrated worker received real conversation updates and displayed their receipt times; a second all-event probe saw one conversation payload and one utterance payload. The new sentence appeared as a separate fourth conversation in SQLite and the local UI. This establishes live event delivery; it does not resolve Unknown speaker identity or prove todo completion. Observed transcript speaker labels were all `Unknown`; wearer identity cannot be recovered from that label.

**Would I build with it again?** Yes, with backfill and explicit status rather than treating stream availability as guaranteed delivery.

## REST through the local proxy

**Used for:** todo POST and PUT requests from the Node backend, via loopback `bee proxy`. The CLI remains responsible for auth and transcript reads.

**What worked:** the official API documents public HTTPS and a local proxy. The proxy means the app needs no private-CA handling. Automated HTTP-contract tests verify the URL, method, body and redacted failure path.

**What needs work:** developers can confuse the public API host with the CLI's private-CA transport host. Documentation now distinguishes them; a short decision table near installation would help. The proxy is unauthenticated locally, so its loopback binding matters.

**Would I build with it again?** Yes for this local-only architecture. The live proxy returned HTTP 200 for GET /v1/todos. This proves a read path, not creation/completion; write-back remains unverified because the real sample has no usable wearer labels.

## Search

**Used for:** the Ask path starts with Bee conversation keyword search. A live probe uses the neutral term `math` because the available real sample is a class recording, not the requested person-introduction sample. This deviation does not establish name-search accuracy.

**What worked:** the CLI supports a conversation-only scope, so Recall can attach returned material to source conversations. The code refuses to manufacture an answer when retrieval has no supporting snippets.

**What needs work:** response schema examples with provenance fields would make source attribution easier. Neural retrieval was not enabled or benchmarked; no latency comparison is claimed from this build.

**Would I build with it again?** Yes, with returned quote/source validation and a clear unavailable answer.

## Facts

**Used for:** `BeeClient.facts()` and the live probe's facts-list call. Facts are deliberately not used to assign unnamed assertions to people.

**What worked:** the API/CLI provides a separate facts surface, allowing an explicit experiment instead of conflating summaries and verbatim utterances.

**What needs work:** a person-memory app needs reliable subject identity and supporting conversation/utterance references before turning a fact into a person-card claim. The live facts probe returned two records with text/tags but no explicit person identity or source-utterance fields in the observed shape. They were not turned into person claims.

**Would I build with it again?** Yes for a future provenance-aware enrichment step; the current product uses utterance evidence.

## Todos API

**Used for:** creating an `I owe` promise and setting its completion through the proxy. Only real-mode promises can invoke Bee write-back. No fixture promise is sent to Bee.

**What worked:** create/update input fields are documented. `alarm_at` is ISO 8601 on input and epoch milliseconds on output; the adapter sends an alarm only when extraction has a grounded exact time. Contract tests verify this.

**What needs work:** an idempotency key for todo creation would make interrupted-response retries safer. A fixture HTTP response is not a successful real todo write; the final demo must show the actual Bee task.

**Would I build with it again?** Yes, with visible failures and conservative retry behavior.

## Locations

**Used for:** current/recent/clusters live probes and a named-location-only normalization path. The first real list response had `primary_location` coordinates and an address; those details stay private. Recall does not reverse-geocode coordinates or invent a venue.

**What needs work:** a canonical schema across conversation location and stream location responses would reduce adapter work. Without a useful named place, leave location out of the brief and demo.

**Would I build with it again?** Only when the location improves the user workflow and consent permits showing it.

## Tools not used

Bee MCP and Bee Agent Skills were not loaded or called. Bedrock, AgentCore, Strands and other AWS model services were not used. No feedback or mini-challenge claim is made for those tools.
