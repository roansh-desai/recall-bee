# Recall — recording script (2:40 target; hard cap 2:59)

Record this yourself using **live Bee mode and only people who consented to the recording and public demo**. The committed fake fixture is useful for rehearsal and screenshots, but cannot establish the Bee-track live-data requirement. This document is a script, not evidence that a video has been recorded or published.

## Record the source conversation first

Enable Developer Mode in the Bee app (Settings → tap Version five times), authenticate the CLI, then run `npm run dev`. Keep the Bee physically near both speakers. Ask your friend for permission to capture the conversation, store the derived details locally, and show the agreed details publicly. They can use a chosen demo name. Do not include private contacts or handles without permission.

Use this structure with **truthful, consented details**, not the fake fixture:

1. You: “My name is [your chosen name]. We both agree to record this conversation and show these details in the Recall demo.”
2. Friend: “My name is [their chosen name]. I'm a [real role] at [organization they agree to share].”
3. Friend: “We met at [real event]. We discussed [real topic]. I am building [real project]. I enjoy [real interest].”
4. Friend: “My Instagram is @[their consented handle].” If they prefer, say “Find me on LinkedIn” and demonstrate a mention without a guessed link.
5. You: “[Name], I'll send you [an actual item you intend to send] by [day].”
6. Friend: “I'll share [an actual item they intend to share] tomorrow.”

Pause between speakers and let Bee process the conversation. Set **which speaker is me** in Recall by reading the source quotes; generic speaker labels are not voice identities. If the processed transcription misses the name, record a clearer self-introduction rather than modifying the source to fabricate evidence. Relative dates without a time and timezone remain displayed hints. Bee alarms support ISO date-times or “tomorrow at 5 pm IST,” “2026-10-24 at 17:00 +05:30,” and equivalent explicit UTC/GMT forms. “Tomorrow” is anchored to the conversation's date in the stated timezone.

## Shot list

| Time | Picture | Spoken copy / action |
|---|---|---|
| 0:00–0:12 | You, then the empty search bar | “I meet dozens of people at events. I remember a few. The hardest part is remembering what mattered to them—and what I promised.” |
| 0:12–0:30 | Show the Bee on you and Recall on the laptop | “Recall is a local people memory. My Bee captures consented conversations; Recall turns the processed text into sourced people cards and follow-ups.” |
| 0:30–1:05 | Split screen: the consenting conversation and terminal event categories; Recall live badge | Say a short self-introduction and real promise near Bee. Show an actual event arriving and the conversation count changing. The terminal worker logs event types and receipt times without raw private payloads. Allow for real processing latency. Do not simulate an event or label a fixture live. |
| 1:05–1:35 | Set your speaker if needed; search “Who is [name]?”; brief and person card | “Here is who they are, what we discussed, and what we owe each other. Every detail has its original quote. This handle is here because they said it—not because Recall searched a social network.” Show the link target; do not open a private profile on camera. |
| 1:35–2:05 | Promises board; then Bee todo screen or token-free CLI output | “I promised to send the deck. Recall creates that follow-up in Bee. When I finish the task, checking it here completes the same Bee todo.” Only tick after actually fulfilling the promise, or agree beforehand that this is a demonstration task. Show the remote completion; do not imply local checkbox proof is Bee proof. |
| 2:05–2:30 | Ask a question known to match the real transcript; source quote; Privacy page | “Ask searches Bee and shows the retrieved words. If it lacks evidence, it says so. Recall stores its database on this Mac. Forget removes the person and the local source conversations that contained them.” Demonstrate Forget on a disposable consented recording; explain that Bee originals are separate. |
| 2:30–2:40 | App and public repository | “Bee made ambient context useful at the next meeting. Recall is open source, local, and built to remember the details without inventing them. Thanks.” |

If live data is delayed, show the real delay honestly and use a previously processed consented conversation for the card demonstration. Keep the worker running; do not claim an end-to-end live update unless it occurred. If todo write-back is unverified or failing, say so and omit that claim rather than faking completion. The demo still needs real Bee ingestion and useful sourced cards.

**Current-recording alternative for 1:35–2:05:** the inspected recordings have `Unknown` speaker labels. Show the unresolved promise and its source, and say: “Bee captured the promise, but didn't distinguish the speakers here. Recall keeps it visible without guessing who owes whom. Bee todo write-back is implemented, but I haven't verified it on this recording.” Do not tick a box and describe it as a successful remote todo completion.

## Pre-recording checklist

- [ ] Real device or Apple Watch recording; all participants and shown details consented.
- [ ] `npm run dev` running in live mode; no FAKE FIXTURE badge.
- [ ] Source transcript contains a self-introduced name and a real promise; correct wearer selected.
- [ ] Live worker running, actual stream event visible, newest sync time updates.
- [ ] Bee todo creation and completion tested; choose a harmless genuine demo task.
- [ ] Clean desktop, notifications off, browser zoom 125%; app fits the frame.
- [ ] No tokens, `.env`, raw dumps, unrelated people, emails, private handles, or private account screens visible.
- [ ] English narration; no copyrighted music (silence is fine).
- [ ] Record to 2:40; exported video is under 3:00 and plays correctly.
- [ ] Upload publicly to YouTube or Vimeo, verify signed-out playback, paste URL into SUBMISSION.md and Devpost.
- [ ] Submit the Devpost entry; saving a draft does not submit it.

Deadline supplied by the event: **October 23, 2026 at 12:00 p.m. PDT = October 24, 2026 at 12:30 a.m. IST**. Verify the event page before submission.
