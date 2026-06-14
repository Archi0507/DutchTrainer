# DutchTrainer

DutchTrainer is a mobile-first Progressive Web App for English speakers learning Dutch from beginner foundations toward B1.

It works in iPhone Safari, can be added to the Home Screen, and supports offline use after the first visit.

## Features

- Multiple-choice translation
- Typed translation
- Word matching
- XP system
- Daily streak
- Local profile screen
- Topic-based progress
- SM-2-inspired spaced repetition
- 20-exercise daily lessons
- Lesson pass/fail scoring
- Browser-native sound effects with mute/unmute
- Dark mode
- Offline support with a service worker
- Local JSON content

## Lesson rules

Each lesson has 20 exercises.

The app mixes three exercise types inside each lesson:

- Multiple-choice translation
- Typed translation
- Word matching

Sentence-pair translation exercises can run in both directions from the same Dutch-English content item:

- Dutch to English: the learner sees Dutch and answers in English.
- English to Dutch: the learner sees English and answers in Dutch.

For source-backed Tatoeba content, the app keeps one bilingual sentence-pair record and uses `directions` plus level guidance to decide which direction to practice.

When enough unseen words are available, a daily lesson introduces up to 20 new Dutch words. Lessons are built in this order:

1. Due spaced-repetition review items
2. New Dutch words
3. Weak or missed words if more cards are needed

The normal session is designed for about 15-20 minutes.

A lesson is only completed successfully when the learner gets at least 70% correct:

- 14/20 or higher: lesson passed and saved as completed
- 13/20 or lower: lesson failed and saved as a failed attempt

Failed lessons are not marked complete. The retry screen shows incorrect Dutch words and their English translations as suggested review.

XP is awarded at the end of a lesson, not after every question. Passing earns base XP. Bonus XP is awarded for 90%+ accuracy, perfect lessons, and maintaining a streak. Failed lessons receive no completion credit and only reduced XP.

## Spaced repetition

Each reviewed vocabulary item stores an SRS record:

```json
{
  "itemId": "word-001",
  "easeFactor": 2.5,
  "intervalDays": 1,
  "repetitions": 1,
  "lastReviewedAt": "2026-06-11T12:00:00.000Z",
  "nextReviewAt": "2026-06-12T12:00:00.000Z",
  "totalCorrect": 1,
  "totalIncorrect": 0,
  "masteryLevel": "learning"
}
```

New words begin as unseen. Correct answers increase repetitions and grow the interval. Incorrect answers reduce ease, reduce/reset repetitions, and make the item come back sooner. Mastery levels are simple labels: `unseen`, `weak`, `learning`, `familiar`, and `strong`.

Progress saved locally includes:

- Learner name
- XP
- Daily streak
- Completed lessons
- Failed attempts
- Introduced words
- Spaced-repetition item state
- Sound mute/unmute setting

## Live Content

Live app content lives in:

```text
data/vocabulary.json
data/sentences.json
data/lesson-plan.json
data/curriculum.json
```

Current live private-app content:

- 2,547 vocabulary items
- 3,100 bilingual Dutch-English sentence pairs
- 155 structured lessons
- 45 A1 lessons
- 60 A2 lessons
- 50 B1 lessons
- 2,448 Duome-derived vocabulary items approved for this private two-person app

The sentence pack uses curated source-backed Tatoeba Dutch-English pairs. Each sentence keeps both directions available through `directions: ["nl_to_en", "en_to_nl"]`.

The vocabulary pack combines the original DutchTrainer seed vocabulary with Duome-derived vocabulary marked for this private app context. Duome vocabulary is used for vocabulary practice, matching, quick review, SRS review, and lesson reinforcement.

`data/curriculum.json` is the curriculum map from A0 to B1.

## Production Content Policy

AI-generated or template-generated Dutch content is not production content. Generated content may only be used for app stress testing, importer validation, storage checks, and UI performance testing. It must not be used for learner-facing lessons.

Production DutchTrainer content must come from reliable external sources with documented licensing and attribution. Production content should include these source metadata fields whenever available:

- `sourceName`
- `sourceUrl`
- `sourceLicense`
- `sourceAttribution`
- `sourceId`

Do not promote files from `tools/generated-output` into `data/`. Treat that folder as technical load-test output only.

## Curriculum Map

DutchTrainer uses `data/curriculum.json` as a planning structure for growing from first exposure to independent everyday communication.

- `A0`: first survival Dutch. Learners focus on greetings, introductions, numbers, family, food, and very short memorized phrases.
- `A1`: everyday basics. Learners build simple present-tense sentences for shopping, transport, housing, food, appointments, weather, and daily routines.
- `A2`: everyday independence. Learners expand into work, study, services, health, opinions, past events, and future plans.
- `B1`: confident everyday communication. Learners practice longer explanations, opinions with reasons, short stories, problem solving, culture, work, health, and public topics.

Each level defines target vocabulary and sentence counts, grammar goals, practical topics, lesson groups, review ratio, estimated lesson count, and example lesson names. The review ratio should guide the lesson builder as content grows: lower levels introduce more new material, while higher levels reserve more space for SRS review and consolidation.

The curriculum is intentionally separate from app progress. It is a content planning file, not a learner state file.

## Content pipeline

Content import tools live in `tools/`. They can import Dutch-English vocabulary from CSV or JSON and sentence pairs from CSV or TSV.

For source-backed production content planning, start with:

- `DATA_SOURCES.md` for approved source strategy, licensing notes, and manual download guidance
- `tools/README.md` for exact importer, Tatoeba ingestion, and Wiktionary frequency commands

Run the sample pipeline without replacing the current app data:

```bash
ruby tools/import_content.rb \
  --vocab tools/sample-input/vocabulary.csv \
  --vocab tools/sample-input/vocabulary.json \
  --sentences tools/sample-input/sentences.tsv \
  --output tools/sample-output
```

The pipeline:

- Cleans malformed rows and duplicate Dutch prompts
- Assigns IDs and normalizes fields
- Assigns items to curriculum lesson groups from `data/curriculum.json`
- Validates required fields and unique IDs
- Writes app-ready `vocabulary.json` and `sentences.json`
- Generates `content-report.md`

The content report warns when lesson groups have too few words, CEFR levels are under-filled, topics have words but no sentences, or sentences are too long for their assigned level.

Only validated and approved content should be written to `data/` for learner-facing lessons. Generated/template content must not be promoted to live app data.

## Run locally

Because service workers require a local web server, do not open `index.html` directly from Finder.

From the `DutchTrainer` folder, run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

On iPhone Safari, use your Mac's local network address instead of `localhost`.

## Developer tools

Open the app with `?dev=1` to show the hidden developer panel:

```text
http://localhost:8000/?dev=1
```

The panel includes:

- Clear all local progress
- Reset today's lesson
- Mark 10 items due for review
- Simulate passing a lesson
- Simulate failing a lesson
- SRS debug table with item ID, Dutch text, status, ease factor, interval, repetitions, next review date, total correct, and total incorrect

The SRS status values shown in the table are:

- `unseen`
- `due`
- `learning`
- `mastered`
- `weak`

## Browser tests

With the local server running, open:

```text
http://localhost:8000/tests/browser-tests.html
```

The lightweight browser test runner loads DutchTrainer in an iframe with `?dev=1` and checks:

- Full 20-question pass path
- Full 20-question fail path
- LocalStorage persistence after reload
- Failed lesson does not mark completion
- Passed lesson updates SRS records
- Missed words appear in Practice Mistakes

These tests are intentionally framework-free so they can run in Safari, Chrome, or the Codex in-app browser.

## Install on iPhone

1. Open the app in Safari.
2. Tap the Share button.
3. Tap Add to Home Screen.
4. Open DutchTrainer from the Home Screen.

After the first load, the app shell and JSON files are cached for offline practice.

## Deploy to GitHub Pages

1. Create a GitHub repository.
2. Commit the contents of this `DutchTrainer` folder.
3. Push to GitHub.
4. In GitHub, open Settings.
5. Go to Pages.
6. Set Source to Deploy from a branch.
7. Choose your branch and the folder that contains `index.html`.
8. Save.

If `index.html` is at the repository root, use the root folder. If you keep this app inside a `DutchTrainer` folder, choose that folder or move the files to the repository root.

The app uses relative paths, so it works on GitHub Pages project URLs like:

```text
https://archi0507.github.io/DutchTrainer/
```

Current project URL:

```text
https://archi0507.github.io/DutchTrainer/
```

Preview URL:

```text
https://archi0507.github.io/DutchTrainer/?content=preview
```

After publishing an update, iPhone Safari or the Home Screen app may need one reload cycle to receive the new service worker cache:

1. Open the site in Safari.
2. Refresh once.
3. If the Home Screen app still shows old content, close it fully and reopen it.
4. If it is still stale, remove and re-add the Home Screen icon.

## Add more vocabulary

Edit `data/vocabulary.json` and add an item with a unique `id`:

```json
{
  "id": "word-101",
  "dutch": "boek",
  "english": "book",
  "topic": "Home",
  "exampleDutch": "Ik lees een boek.",
  "exampleEnglish": "I read a book.",
  "sourceName": "Source name",
  "sourceUrl": "https://example.com/source",
  "sourceLicense": "License name",
  "sourceAttribution": "Attribution text",
  "sourceId": "source-row-or-entry-id"
}
```

New topics appear automatically.

## Add more sentences

Edit `data/sentences.json` and add an item with a unique `id`:

```json
{
  "id": "sentence-051",
  "dutch": "Ik heb een boek.",
  "english": "I have a book.",
  "topic": "Home",
  "sourceName": "Source name",
  "sourceUrl": "https://example.com/source",
  "sourceLicense": "License name",
  "sourceAttribution": "Attribution text",
  "sourceId": "source-row-or-entry-id"
}
```

Keep sentences short and literal for A0/A1 learners.

## Reset progress

Progress is stored in the browser with `localStorage`. XP, streaks, completed lessons, failed attempts, topic progress, sound settings, and spaced repetition data are saved after each answer and again when the app is hidden or closed.

This means progress should still be there when the learner closes Safari or launches DutchTrainer again from the Home Screen. Progress can be removed if the learner clears Safari site data, uses private browsing, changes browser/device, or deletes the installed Home Screen app data.

Progress is device-specific and browser-specific. Two people using different browsers, different devices, or different Safari profiles will have separate progress. The app does not write progress to shared files and does not sync progress between users. Cloud sync would need to be added later for cross-device accounts.

During development, clear site data in the browser to reset XP, streaks, and spaced repetition.

## Production content workflow

Live app files in `data/` should only be updated after a staged content pack has passed validation and human review.

The production content workflow is:

```text
raw source
  -> source adapter
  -> canonical staged output
  -> schema validation
  -> review queue
  -> human approval
  -> promotion validation
  -> live data update
```

The canonical schema is documented in `docs/CONTENT_SCHEMA.md`.

Useful checks:

```sh
ruby tools/validate_content_schema.rb --input tools/source-output/curated-pack-v1
ruby tools/validate_promotion_ready.rb --input tools/source-output/curated-pack-v1
```

For this private two-person app, Duome-derived vocabulary is allowed in the `production-private` lane. It must keep source metadata and should not be treated as generally publishable open content.

AI-generated or template-generated Dutch content is not production learning content. Generated content may only be used for stress testing and tooling checks. Production content must preserve source metadata, licensing, attribution, source IDs where available, and an explicit content lane.

## Preview content mode

Staged content can be tested without replacing live app data:

```text
?content=preview
```

Preview mode loads `data-preview/` and stores progress separately under `dutchTrainerProgressPreview`, so normal local progress remains separate.

## Rollback

Before live promotion, timestamped backups are written under:

```text
tools/backups/
```

To roll back a promotion, copy the backed-up files from the relevant timestamped folder back to their original paths, then bump the service worker cache version in `sw.js` so installed PWAs fetch the restored files.
