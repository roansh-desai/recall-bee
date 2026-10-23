# Bee feature requests

These are requests from building Recall, not claims that Bee lacks every related capability. Priority reflects this app's needs. Live schema conclusions remain limited to the inspected sample.

| Priority | Request | Finding and expected benefit |
| --- | --- | --- |
| P0 | Explicit wearer flag per utterance or conversation, with documented stability | Generic labels cannot safely establish who owes whom. Recall asks the user per conversation. A wearer flag would reduce setup without pretending to identify other people by voice. |
| P0 | Optional typed stream envelope and replay cursor | The docs warn against an `event` field, while live payloads included `type`; delivery is at most once. A type plus cursor would simplify recovery and distinguish overlapping deletion/update shapes. Keep raw mode for compatibility. |
| P1 | Structured person/organization entities with source utterance IDs and confirmation state | Recall must connect introductions to claims without guessing. Provenance and explicit uncertainty would support useful person cards while preserving correction controls. |
| P1 | Stable speaker IDs with clearly defined scope | Stability within/across a conversation should be documented and separable from person identity. No account-wide stability has been established in this build. |
| P1 | Explicit conversation-finished/processing-complete semantics | The documented update carries state, but a clear finalization contract would tell an app when a brief is ready and when later corrections can occur. |
| P1 | Documented location schemas and one canonical field naming convention | Live conversation lists used `primary_location`; stream docs use `location` with optional name. A canonical schema and privacy guidance would prevent accidental display of a home address as a meeting venue. |
| P1 | Todo creation idempotency key | If the network loses a successful create response, a retry can duplicate the task. A caller-supplied key would make recovery safe. |
| P2 | Documented utterance timestamp availability, units and timezone | When absent, Recall falls back to conversation plus quote. A stable timestamp contract would allow reliable moment links without inventing offsets. Validate actual sample coverage before calling this a missing feature. |
| P2 | Webhook retries and a delivery identifier | The documented CLI webhook is useful, but a documented durable-delivery/retry contract would reduce custom recovery plumbing. This build uses the stream directly, not webhooks. |
| P2 | Actionable credential-store errors and Developer Mode onboarding check | Sandboxed credential access produced code -50; a clear instruction to unlock/authorize the credential store would be more useful than a parameter error. |
