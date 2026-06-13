# DutchTrainer

DutchTrainer is a mobile-first Progressive Web App for English speakers learning Dutch at A0/A1 level.

It works in iPhone Safari, can be added to the Home Screen, and supports offline use after the first visit.

## Features

- Multiple-choice translation
- Typed translation
- Word matching
- XP system
- Daily streak
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

- XP
- Daily streak
- Completed lessons
- Failed attempts
- Introduced words
- Spaced-repetition item state
- Sound mute/unmute setting

## Content

The sample content lives in:

```text
data/vocabulary.json
data/sentences.json
```

Included content:

- 100 Dutch A1 vocabulary words
- 50 beginner Dutch sentences

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
https://yourname.github.io/your-repo/
```

## Add more vocabulary

Edit `data/vocabulary.json` and add an item with a unique `id`:

```json
{
  "id": "word-101",
  "dutch": "boek",
  "english": "book",
  "topic": "Home",
  "exampleDutch": "Ik lees een boek.",
  "exampleEnglish": "I read a book."
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
  "topic": "Home"
}
```

Keep sentences short and literal for A0/A1 learners.

## Reset progress

Progress is stored in the browser with `localStorage`. XP, streaks, completed lessons, failed attempts, topic progress, sound settings, and spaced repetition data are saved after each answer and again when the app is hidden or closed.

This means progress should still be there when the learner closes Safari or launches DutchTrainer again from the Home Screen. Progress can be removed if the learner clears Safari site data, uses private browsing, changes browser/device, or deletes the installed Home Screen app data.

During development, clear site data in the browser to reset XP, streaks, and spaced repetition.
