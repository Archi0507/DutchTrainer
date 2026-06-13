const LESSON_SIZE = 20;
const PASSING_SCORE = 14;
const NEW_WORD_TARGET = 20;
const DAILY_GOAL_LESSONS = 1;
const LESSON_ESTIMATE_MINUTES = "15-20 min";
const BASE_PASS_XP = 120;
const FAIL_XP = 10;
const HIGH_ACCURACY_BONUS_XP = 30;
const PERFECT_BONUS_XP = 50;
const STREAK_BONUS_XP = 15;

const state = {
  words: [],
  sentences: [],
  topic: "",
  lesson: null,
  feedback: "",
  selectedDutchId: "",
  selectedEnglish: "",
  progress: loadProgress()
};

const els = {
  xp: document.querySelector("#xpValue"),
  streak: document.querySelector("#streakValue"),
  due: document.querySelector("#dueValue"),
  topicCount: document.querySelector("#topicCount"),
  topicList: document.querySelector("#topicList"),
  practiceTitle: document.querySelector("#practiceTitle"),
  practiceMeta: document.querySelector("#practiceMeta"),
  exerciseArea: document.querySelector("#exerciseArea"),
  themeToggle: document.querySelector("#themeToggle"),
  soundToggle: document.querySelector("#soundToggle")
};

let audioContext;
let devPanel;

init();

async function init() {
  state.progress = normalizeProgress(state.progress);
  applySavedTheme();
  bindEvents();

  const [words, sentences] = await Promise.all([
    fetchJson("data/vocabulary.json"),
    fetchJson("data/sentences.json")
  ]);

  state.words = words;
  state.sentences = sentences;
  ensureVocabularySrsRecords();
  state.topic = topics()[0] || "";
  setupDeveloperTools();
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return response.json();
}

function bindEvents() {
  window.dutchTrainerActions = {
    startLesson: () => {
      startLesson();
      render();
    },
    retryLesson: () => {
      startLesson();
      render();
    },
    practiceMistakes: () => {
      startLesson({ mistakesOnly: true });
      render();
    },
    continueLesson,
    checkTyped: () => {
      const input = document.querySelector("#answerInput");
      answerTask(currentTask(), input?.value || "");
    }
  };

  window.addEventListener("pagehide", saveProgress);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveProgress();
  });

  els.themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("dutchTrainerTheme", next);
  });

  els.soundToggle.addEventListener("click", () => {
    state.progress.soundMuted = !state.progress.soundMuted;
    saveProgress();
    renderSoundButton();
  });

  els.exerciseArea.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("onclick")) return;

    if (button.dataset.action === "start-lesson") {
      startLesson();
      render();
    }

    if (button.dataset.action === "retry-lesson") {
      startLesson();
      render();
    }

    if (button.dataset.action === "practice-mistakes") {
      startLesson({ mistakesOnly: true });
      render();
    }

    if (button.dataset.action === "continue-lesson") {
      continueLesson();
    }

    if (button.dataset.action === "check-typed") {
      const input = document.querySelector("#answerInput");
      answerTask(currentTask(), input?.value || "");
    }
  });
}

function applySavedTheme() {
  const saved = localStorage.getItem("dutchTrainerTheme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = saved || (prefersDark ? "dark" : "light");
}

function render() {
  renderStats();
  renderSoundButton();
  renderTopics();
  renderLesson();
  renderDeveloperPanel();
}

function renderStats() {
  els.xp.textContent = state.progress.xp;
  els.streak.textContent = state.progress.streak;
  els.due.textContent = dueCount();
}

function renderSoundButton() {
  els.soundToggle.textContent = state.progress.soundMuted ? "🔇" : "♪";
  els.soundToggle.setAttribute("aria-label", state.progress.soundMuted ? "Unmute sounds" : "Mute sounds");
}

function renderTopics() {
  const allTopics = topics();
  els.topicCount.textContent = `${allTopics.length} topics`;
  els.topicList.innerHTML = allTopics.map((topic) => {
    const total = allItemsForTopic(topic).length;
    const learned = learnedCount(topic);
    const percent = total ? Math.round((learned / total) * 100) : 0;

    return `
      <button class="topic-button ${topic === state.topic ? "active" : ""}" type="button" data-topic="${escapeHtml(topic)}">
        <span class="topic-row">
          <span class="topic-name">${escapeHtml(topic)}</span>
          <span class="progress-label">${learned}/${total}</span>
        </span>
        <span class="progress-track" aria-hidden="true">
          <span class="progress-fill" style="width: ${percent}%"></span>
        </span>
      </button>
    `;
  }).join("");

  els.topicList.querySelectorAll(".topic-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.topic = button.dataset.topic;
      state.lesson = null;
      state.feedback = "";
      render();
    });
  });
}

function setupDeveloperTools() {
  window.dutchTrainerDev = {
    clearAllProgress,
    resetTodaysLesson,
    markItemsDue,
    simulatePassingLesson,
    simulateFailingLesson,
    practiceMistakesForTest,
    getProgress: () => JSON.parse(JSON.stringify(state.progress)),
    getLesson: () => JSON.parse(JSON.stringify(state.lesson)),
    getSrsRows,
    render: () => render()
  };

  const params = new URLSearchParams(window.location.search);
  if (!params.has("dev")) return;

  devPanel = document.createElement("section");
  devPanel.id = "devPanel";
  devPanel.className = "panel dev-panel";
  document.querySelector("main").appendChild(devPanel);
  renderDeveloperPanel();
}

function renderDeveloperPanel() {
  if (!devPanel) return;

  const rows = getSrsRows();
  devPanel.innerHTML = `
    <div class="section-title">
      <h2>Developer</h2>
      <span>${rows.length} SRS rows</span>
    </div>
    <div class="dev-actions">
      <button type="button" data-dev-action="clear">Clear all local progress</button>
      <button type="button" data-dev-action="reset-today">Reset today's lesson</button>
      <button type="button" data-dev-action="due">Mark 10 items due</button>
      <button type="button" data-dev-action="pass">Simulate passing a lesson</button>
      <button type="button" data-dev-action="fail">Simulate failing a lesson</button>
    </div>
    <div class="srs-debug">
      <table>
        <thead>
          <tr>
            <th>itemId</th>
            <th>Dutch</th>
            <th>Status</th>
            <th>Ease</th>
            <th>Interval</th>
            <th>Reps</th>
            <th>Next review</th>
            <th>Correct</th>
            <th>Incorrect</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.itemId)}</td>
              <td>${escapeHtml(row.dutch)}</td>
              <td>${escapeHtml(row.status)}</td>
              <td>${row.easeFactor.toFixed(2)}</td>
              <td>${row.intervalDays}</td>
              <td>${row.repetitions}</td>
              <td>${escapeHtml(formatDateTime(row.nextReviewAt))}</td>
              <td>${row.totalCorrect}</td>
              <td>${row.totalIncorrect}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  devPanel.querySelectorAll("[data-dev-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.devAction;
      if (action === "clear") clearAllProgress();
      if (action === "reset-today") resetTodaysLesson();
      if (action === "due") markItemsDue();
      if (action === "pass") simulatePassingLesson();
      if (action === "fail") simulateFailingLesson();
      render();
    });
  });
}

function clearAllProgress() {
  state.progress = defaultProgress();
  state.lesson = null;
  state.feedback = "";
  state.selectedDutchId = "";
  state.selectedEnglish = "";
  ensureVocabularySrsRecords();
  saveProgress();
}

function resetTodaysLesson() {
  const today = dayKey(new Date());
  state.lesson = null;
  state.feedback = "";
  state.progress.completedLessons = state.progress.completedLessons.filter((lesson) => dayKey(new Date(lesson.completedAt)) !== today);
  state.progress.failedAttempts = state.progress.failedAttempts.filter((lesson) => dayKey(new Date(lesson.completedAt)) !== today);
  saveProgress();
}

function markItemsDue(count = 10) {
  const now = new Date().toISOString();
  state.words.slice(0, count).forEach((word) => {
    const record = state.progress.srs[word.id] || newSrsRecord(word.id);
    record.masteryLevel = record.masteryLevel === "unseen" ? "learning" : record.masteryLevel;
    record.lastReviewedAt ||= now;
    record.nextReviewAt = now;
    record.totalCorrect = Math.max(record.totalCorrect, 1);
    record.repetitions = Math.max(record.repetitions, 1);
    record.intervalDays = 0;
    state.progress.srs[word.id] = record;
    if (!state.progress.introducedWordIds.includes(word.id)) {
      state.progress.introducedWordIds.push(word.id);
    }
  });
  saveProgress();
}

function simulatePassingLesson() {
  return simulateLessonOutcome(16);
}

function simulateFailingLesson() {
  return simulateLessonOutcome(8);
}

function simulateLessonOutcome(correctTarget) {
  const wasMuted = state.progress.soundMuted;
  state.progress.soundMuted = true;
  startLesson();
  state.lesson.tasks.forEach((task, index) => {
    const correct = index < correctTarget;
    const items = task.type === "matching" ? task.items : [task.item];
    task.answered = true;
    finishTask(task, correct, items, { soundAlreadyPlayed: true });
  });
  state.lesson.index = LESSON_SIZE - 1;
  completeLesson();
  state.progress.soundMuted = wasMuted;
  saveProgress();
  render();
  return JSON.parse(JSON.stringify(state.lesson));
}

function practiceMistakesForTest() {
  startLesson({ mistakesOnly: true });
  render();
  return JSON.parse(JSON.stringify(state.lesson));
}

function getSrsRows() {
  return allPracticeItems().map((item) => {
    const record = state.progress.srs[item.id] || newSrsRecord(item.id);
    return {
      itemId: item.id,
      dutch: item.dutch,
      status: srsStatus(item.id, record),
      easeFactor: record.easeFactor,
      intervalDays: record.intervalDays,
      repetitions: record.repetitions,
      nextReviewAt: record.nextReviewAt,
      totalCorrect: record.totalCorrect,
      totalIncorrect: record.totalIncorrect
    };
  });
}

function srsStatus(itemId, record) {
  if (record.masteryLevel === "unseen") return "unseen";
  if (isDue(itemId)) return "due";
  if (record.masteryLevel === "weak") return "weak";
  if (record.masteryLevel === "strong") return "mastered";
  return "learning";
}

function renderLesson() {
  if (!state.lesson) {
    renderLessonStart();
    return;
  }

  if (state.lesson.finished) {
    renderLessonResult();
    return;
  }

  const task = currentTask();
  els.practiceTitle.textContent = "Daily Lesson";
  els.practiceMeta.textContent = `${state.lesson.index + 1}/${LESSON_SIZE} • ${taskLabel(task.type)}`;

  if (task.type === "multiple") renderMultipleChoice(task);
  if (task.type === "typed") renderTyped(task);
  if (task.type === "matching") renderMatching(task);
}

function renderLessonStart() {
  const plan = buildLessonPlan();
  const dailyDone = lessonsCompletedToday();
  const dailyPercent = Math.min(100, Math.round((dailyDone / DAILY_GOAL_LESSONS) * 100));
  const lastAttempt = state.progress.failedAttempts[state.progress.failedAttempts.length - 1];

  els.practiceTitle.textContent = "Today's Lesson";
  els.practiceMeta.textContent = `${LESSON_ESTIMATE_MINUTES} • ${LESSON_SIZE} exercises`;
  els.exerciseArea.innerHTML = `
    <div class="lesson-card today-card">
      <p class="prompt-label">Today</p>
      <h3>Keep your Dutch moving</h3>
      <p class="hint">Reviews come first, then new words, then extra practice for weak words.</p>
      <div class="today-rings">
        <div>
          <strong>${plan.newWords.length}</strong>
          <span>new words</span>
        </div>
        <div>
          <strong>${plan.reviews.length}</strong>
          <span>reviews</span>
        </div>
        <div>
          <strong>${LESSON_ESTIMATE_MINUTES}</strong>
          <span>duration</span>
        </div>
      </div>
      <div class="daily-goal">
        <div class="lesson-progress">
          <span>Daily goal</span>
          <span>${dailyDone}/${DAILY_GOAL_LESSONS}</span>
        </div>
        <div class="progress-track" aria-hidden="true">
          <span class="progress-fill" style="width: ${dailyPercent}%"></span>
        </div>
      </div>
      ${lastAttempt ? `<p class="hint">Missed words from your last attempt will be prioritized next.</p>` : ""}
      <button id="startLesson" class="primary-button" type="button" data-action="start-lesson" onclick="window.dutchTrainerActions.startLesson()">Start lesson</button>
    </div>
  `;
}

function currentTask() {
  return state.lesson.tasks[state.lesson.index];
}

function renderMultipleChoice(task) {
  const item = task.item;
  const choices = answerChoices(item);

  els.exerciseArea.innerHTML = `
    ${lessonProgressHtml()}
    ${promptHtml(item, "Translate to English")}
    <div class="choice-grid">
      ${choices.map((choice) => `<button class="choice-button" type="button" data-answer="${escapeHtml(choice)}">${escapeHtml(choice)}</button>`).join("")}
    </div>
    ${feedbackHtml()}
  `;

  els.exerciseArea.querySelectorAll(".choice-button").forEach((button) => {
    button.addEventListener("click", () => answerTask(task, button.dataset.answer));
  });
}

function renderTyped(task) {
  els.exerciseArea.innerHTML = `
    ${lessonProgressHtml()}
    ${promptHtml(task.item, "Type the English translation")}
    <input id="answerInput" class="answer-input" autocomplete="off" autocapitalize="none" placeholder="English translation">
    <button id="checkTyped" class="primary-button" type="button" data-action="check-typed" onclick="window.dutchTrainerActions.checkTyped()">Check</button>
    ${feedbackHtml()}
  `;

  const input = document.querySelector("#answerInput");
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") answerTask(task, input.value);
  });
  if (!task.answered) input.focus();
}

function renderMatching(task) {
  els.exerciseArea.innerHTML = `
    ${lessonProgressHtml()}
    <p class="hint">Match each Dutch word to English. One mistake makes this exercise incorrect, but you can still finish the set.</p>
    <div class="match-columns">
      <div class="match-grid">
        ${task.items.map((item) => matchButton(item.dutch, "dutch", item.id, state.selectedDutchId === item.id, task.matchedIds.includes(item.id))).join("")}
      </div>
      <div class="match-grid">
        ${task.englishChoices.map((english) => {
          const matched = task.items.some((item) => task.matchedIds.includes(item.id) && item.english === english);
          return matchButton(english, "english", english, state.selectedEnglish === english, matched);
        }).join("")}
      </div>
    </div>
    ${feedbackHtml(false)}
    ${task.answered ? '<button id="continueLesson" class="primary-button" type="button" data-action="continue-lesson" onclick="window.dutchTrainerActions.continueLesson()">Continue</button>' : ""}
  `;

  els.exerciseArea.querySelectorAll(".match-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (task.answered) return;
      if (button.dataset.side === "dutch") state.selectedDutchId = button.dataset.value;
      if (button.dataset.side === "english") state.selectedEnglish = button.dataset.value;
      tryMatch(task);
      render();
    });
  });
}

function renderLessonResult() {
  const passed = state.lesson.correct >= PASSING_SCORE;
  const incorrectItems = state.lesson.incorrectIds
    .map((id) => findItemById(id))
    .filter(Boolean);
  const nextReview = nextReviewEstimate();
  const learnedCount = state.lesson.newWordIds.filter((id) => {
    const srs = state.progress.srs[id];
    return srs && srs.totalCorrect > 0;
  }).length;

  els.practiceTitle.textContent = passed ? "Lesson Complete" : "Try Again";
  els.practiceMeta.textContent = `${state.lesson.correct}/${LESSON_SIZE} correct`;
  els.exerciseArea.innerHTML = `
    <div class="lesson-card result-card ${passed ? "passed" : "failed"}">
      <p class="prompt-label">${passed ? "Passed" : "Not passed yet"}</p>
      <h3>${passed ? "Great work." : "You are close."}</h3>
      <p class="score-number">${state.lesson.correct}/${LESSON_SIZE}</p>
      <div class="summary-grid">
        <span><strong>${state.lesson.xpEarned || 0}</strong> XP earned</span>
        <span><strong>${learnedCount}</strong> words learned</span>
        <span><strong>${incorrectItems.length}</strong> to review</span>
        <span><strong>${nextReview}</strong> next review</span>
      </div>
      <p class="hint">${passed ? "This lesson is saved as complete." : "No completion credit yet. Practice your mistakes, then retry."}</p>
      ${incorrectItems.length ? reviewListHtml(incorrectItems) : ""}
      ${!passed && incorrectItems.length ? '<button id="practiceMistakes" class="secondary-button" type="button" data-action="practice-mistakes" onclick="window.dutchTrainerActions.practiceMistakes()">Practice Mistakes</button>' : ""}
      <button id="retryLesson" class="primary-button" type="button" data-action="retry-lesson" onclick="window.dutchTrainerActions.retryLesson()">${passed ? "Start another lesson" : "Retry lesson"}</button>
    </div>
  `;
}

function startLesson(options = {}) {
  const plan = buildLessonPlan(options);
  const newWords = plan.newWords;
  const lessonItems = buildLessonItems(plan);
  const tasks = buildTasks(lessonItems);

  state.lesson = {
    id: `lesson-${Date.now()}`,
    topic: state.topic,
    startedAt: new Date().toISOString(),
    newWordIds: newWords.map((word) => word.id),
    reviewIds: plan.reviews.map((item) => item.id),
    tasks,
    index: 0,
    correct: 0,
    incorrectIds: [],
    answeredTaskIds: [],
    xpEarned: 0,
    finished: false
  };
  state.feedback = "";
  state.selectedDutchId = "";
  state.selectedEnglish = "";
}

function buildLessonPlan(options = {}) {
  const mistakeItems = missedItems();
  const reviews = options.mistakesOnly ? mistakeItems : reviewItems();
  const reviewIds = new Set(reviews.map((item) => item.id));
  const newWords = options.mistakesOnly
    ? []
    : pickNewWords(reviewIds);
  const usedIds = new Set([...reviewIds, ...newWords.map((word) => word.id)]);
  const weak = weakItems().filter((item) => !usedIds.has(item.id));

  return {
    reviews,
    newWords,
    weak
  };
}

function pickNewWords(excludeIds = new Set()) {
  const unseen = unseenWords().filter((word) => !excludeIds.has(word.id));
  const preferred = unseen.filter((word) => word.topic === state.topic);
  return uniqueById([...preferred, ...unseen]).slice(0, NEW_WORD_TARGET);
}

function buildLessonItems(plan) {
  const planIds = new Set([...plan.reviews, ...plan.newWords, ...plan.weak].map((item) => item.id));
  const fallback = shuffle(allPracticeItems()).filter((item) => !planIds.has(item.id));
  return uniqueById([...plan.reviews, ...plan.newWords, ...plan.weak, ...fallback]).slice(0, LESSON_SIZE);
}

function buildTasks(items) {
  const enoughWords = state.words.length >= 3;
  return Array.from({ length: LESSON_SIZE }, (_, index) => {
    const item = items[index % items.length];
    const type = index % 3 === 0
      ? "multiple"
      : index % 3 === 1
        ? "typed"
        : "matching";

    if (type === "matching" && enoughWords) {
      const matchItems = matchingItemsFor(item);
      return {
        id: `task-${index}`,
        type,
        items: matchItems,
        englishChoices: shuffle(matchItems.map((matchItem) => matchItem.english)),
        matchedIds: [],
        hadMistake: false,
        answered: false,
        primaryId: item.id
      };
    }

    return {
      id: `task-${index}`,
      type: type === "matching" ? "multiple" : type,
      item,
      answered: false
    };
  });
}

function matchingItemsFor(primaryItem) {
  const primaryWord = primaryItem.kind === "word" ? primaryItem : wordForTopic(primaryItem.topic);
  const candidates = state.words
    .filter((word) => word.id !== primaryWord.id)
    .map((word) => ({ ...word, kind: "word" }));
  return uniqueById([primaryWord, ...shuffle(candidates)]).slice(0, 3);
}

function answerTask(task, answer) {
  if (task.answered) return;

  const correct = normalize(answer) === normalize(task.item.english);
  task.answered = true;
  state.feedback = correct ? "Correct!" : `Answer: ${task.item.english}`;
  finishTask(task, correct, [task.item]);
  render();
}

function tryMatch(task) {
  if (!state.selectedDutchId || !state.selectedEnglish) return;

  const item = task.items.find((candidate) => candidate.id === state.selectedDutchId);
  const correct = item && item.english === state.selectedEnglish;

  if (correct) {
    task.matchedIds.push(item.id);
    state.feedback = "Correct!";
    playSound("correct");
  } else if (item) {
    task.hadMistake = true;
    state.feedback = `Answer: ${item.dutch} = ${item.english}`;
    playSound("wrong");
  }

  state.selectedDutchId = "";
  state.selectedEnglish = "";

  if (task.matchedIds.length === task.items.length) {
    task.answered = true;
    finishTask(task, !task.hadMistake, task.items, { soundAlreadyPlayed: true });
  }
}

function finishTask(task, correct, items, options = {}) {
  if (state.lesson.answeredTaskIds.includes(task.id)) return;

  updateStreak();
  state.lesson.answeredTaskIds.push(task.id);

  if (correct) {
    state.lesson.correct += 1;
  } else {
    items.forEach((item) => addIncorrectId(item.id));
  }

  items.forEach((item) => updateSrs(item, correct));
  state.lesson.newWordIds.forEach((id) => {
    if (!state.progress.introducedWordIds.includes(id)) {
      state.progress.introducedWordIds.push(id);
    }
  });

  if (!options.soundAlreadyPlayed) playSound(correct ? "correct" : "wrong");
  saveProgress();
  renderStats();
}

function addIncorrectId(id) {
  if (!state.lesson.incorrectIds.includes(id)) {
    state.lesson.incorrectIds.push(id);
  }
}

function continueLesson() {
  if (!state.lesson) return;

  state.feedback = "";
  state.selectedDutchId = "";
  state.selectedEnglish = "";

  if (state.lesson.index + 1 >= LESSON_SIZE) {
    completeLesson();
  } else {
    state.lesson.index += 1;
  }

  saveProgress();
  render();
}

function completeLesson() {
  const passed = state.lesson.correct >= PASSING_SCORE;
  const xpEarned = calculateLessonXp(passed);
  const summary = {
    id: state.lesson.id,
    topic: state.lesson.topic,
    completedAt: new Date().toISOString(),
    score: state.lesson.correct,
    total: LESSON_SIZE,
    accuracy: state.lesson.correct / LESSON_SIZE,
    xpEarned,
    newWordIds: state.lesson.newWordIds,
    incorrectIds: state.lesson.incorrectIds
  };

  if (passed) {
    state.progress.xp += xpEarned;
    state.progress.completedLessons.push(summary);
    playSound("complete");
  } else {
    state.progress.xp += xpEarned;
    state.progress.failedAttempts.push(summary);
    playSound("wrong");
  }

  state.lesson.xpEarned = xpEarned;
  state.lesson.finished = true;
  saveProgress();
}

function calculateLessonXp(passed) {
  if (!passed) return state.lesson.correct >= 10 ? FAIL_XP : 0;

  const accuracy = state.lesson.correct / LESSON_SIZE;
  let xp = BASE_PASS_XP;
  if (accuracy >= 0.9) xp += HIGH_ACCURACY_BONUS_XP;
  if (state.lesson.correct === LESSON_SIZE) xp += PERFECT_BONUS_XP;
  if (state.progress.streak > 1) xp += STREAK_BONUS_XP;
  return xp;
}

function lessonProgressHtml() {
  const answered = state.lesson.answeredTaskIds.length;
  const percent = Math.round((answered / LESSON_SIZE) * 100);
  return `
    <div class="lesson-progress">
      <span>${state.lesson.index + 1}/${LESSON_SIZE}</span>
      <span>${state.lesson.correct} correct</span>
    </div>
    <div class="progress-track" aria-hidden="true">
      <span class="progress-fill" style="width: ${percent}%"></span>
    </div>
  `;
}

function promptHtml(item, label) {
  return `
    <div class="prompt-card">
      <span class="prompt-label">${escapeHtml(label)}</span>
      <strong class="prompt-text">${escapeHtml(item.dutch)}</strong>
    </div>
  `;
}

function feedbackHtml(showNext = true) {
  if (!state.feedback) return `<p class="feedback"></p>`;
  const kind = state.feedback === "Correct!" ? "correct" : "wrong";
  return `
    <p class="feedback ${kind}">${escapeHtml(state.feedback)}</p>
    ${showNext ? '<button id="continueLesson" class="primary-button" type="button" data-action="continue-lesson" onclick="window.dutchTrainerActions.continueLesson()">Continue</button>' : ""}
  `;
}

function matchButton(label, side, value, selected, done) {
  return `
    <button
      class="match-button ${selected ? "selected" : ""} ${done ? "done" : ""}"
      type="button"
      data-side="${side}"
      data-value="${escapeHtml(value)}"
      ${done ? "disabled" : ""}
    >${escapeHtml(label)}</button>
  `;
}

function reviewListHtml(items) {
  return `
    <div class="review-list">
      <h4>Suggested review</h4>
      ${items.slice(0, 8).map((item) => `
        <p><strong>${escapeHtml(item.dutch)}</strong><span>${escapeHtml(item.english)}</span></p>
      `).join("")}
    </div>
  `;
}

function lessonsCompletedToday() {
  const today = dayKey(new Date());
  return state.progress.completedLessons.filter((lesson) => dayKey(new Date(lesson.completedAt)) === today).length;
}

function nextReviewEstimate() {
  const next = Object.values(state.progress.srs)
    .filter((record) => record.nextReviewAt && record.masteryLevel !== "unseen")
    .sort((a, b) => new Date(a.nextReviewAt) - new Date(b.nextReviewAt))[0];

  if (!next) return "none";

  const days = Math.max(0, Math.ceil((new Date(next.nextReviewAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `${days} days`;
}

function answerChoices(item) {
  const allAnswers = allPracticeItems()
    .map((candidate) => candidate.english)
    .filter((answer) => answer !== item.english);

  return shuffle([item.english, ...shuffle(allAnswers).slice(0, 3)]);
}

function updateSrs(item, correct) {
  const now = Date.now();
  const record = state.progress.srs[item.id] || newSrsRecord(item.id);

  record.lastReviewedAt = new Date(now).toISOString();

  if (correct) {
    record.totalCorrect += 1;
    record.repetitions += 1;
    record.easeFactor = Math.min(2.8, record.easeFactor + 0.05);

    if (record.repetitions === 1) {
      record.intervalDays = 1;
    } else if (record.repetitions === 2) {
      record.intervalDays = 3;
    } else {
      record.intervalDays = Math.max(1, Math.round(record.intervalDays * record.easeFactor));
    }
  } else {
    record.totalIncorrect += 1;
    record.repetitions = Math.max(0, record.repetitions - 1);
    record.easeFactor = Math.max(1.3, record.easeFactor - 0.25);
    record.intervalDays = record.totalCorrect > 0 ? 1 : 0;
  }

  record.nextReviewAt = new Date(now + record.intervalDays * 24 * 60 * 60 * 1000).toISOString();
  record.masteryLevel = masteryLevel(record);
  state.progress.srs[item.id] = record;
}

function newSrsRecord(itemId) {
  return {
    itemId,
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    lastReviewedAt: null,
    nextReviewAt: null,
    totalCorrect: 0,
    totalIncorrect: 0,
    masteryLevel: "unseen"
  };
}

function masteryLevel(record) {
  if (record.totalCorrect === 0 && record.totalIncorrect === 0) return "unseen";
  if (record.totalIncorrect > record.totalCorrect) return "weak";
  if (record.repetitions < 2) return "learning";
  if (record.intervalDays < 7) return "familiar";
  return "strong";
}

function updateStreak() {
  const today = dayKey(new Date());
  if (state.progress.lastPracticeDay === today) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  state.progress.streak = state.progress.lastPracticeDay === dayKey(yesterday)
    ? state.progress.streak + 1
    : 1;
  state.progress.lastPracticeDay = today;
}

function playSound(kind) {
  if (state.progress.soundMuted) return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  audioContext ||= new AudioContext();
  if (audioContext.state === "suspended") audioContext.resume();

  const patterns = {
    correct: [{ frequency: 660, start: 0, duration: 0.08 }, { frequency: 880, start: 0.08, duration: 0.1 }],
    wrong: [{ frequency: 220, start: 0, duration: 0.16 }],
    complete: [{ frequency: 523, start: 0, duration: 0.1 }, { frequency: 659, start: 0.1, duration: 0.1 }, { frequency: 784, start: 0.2, duration: 0.16 }]
  };

  patterns[kind].forEach((tone) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const startsAt = audioContext.currentTime + tone.start;
    const endsAt = startsAt + tone.duration;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(tone.frequency, startsAt);
    gain.gain.setValueAtTime(0.0001, startsAt);
    gain.gain.exponentialRampToValueAtTime(0.08, startsAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startsAt);
    oscillator.stop(endsAt + 0.02);
  });
}

function isDue(id) {
  const srs = state.progress.srs[id];
  return Boolean(
    srs &&
    srs.masteryLevel !== "unseen" &&
    srs.nextReviewAt &&
    new Date(srs.nextReviewAt).getTime() <= Date.now()
  );
}

function dueCount() {
  return reviewItems().length;
}

function learnedCount(topic) {
  return allItemsForTopic(topic).filter((item) => {
    const srs = state.progress.srs[item.id];
    return srs && srs.totalCorrect > 0;
  }).length;
}

function unseenWords() {
  return state.words
    .filter((word) => {
      const srs = state.progress.srs[word.id];
      return (!srs || srs.masteryLevel === "unseen") && !state.progress.introducedWordIds.includes(word.id);
    })
    .map((word) => ({ ...word, kind: "word" }));
}

function reviewItems() {
  return allPracticeItems()
    .filter((item) => isDue(item.id))
    .sort((a, b) => new Date(state.progress.srs[a.id].nextReviewAt) - new Date(state.progress.srs[b.id].nextReviewAt));
}

function weakItems() {
  return allPracticeItems()
    .filter((item) => {
      const srs = state.progress.srs[item.id];
      return srs && (srs.masteryLevel === "weak" || srs.totalIncorrect > 0);
    })
    .sort((a, b) => {
      const aRecord = state.progress.srs[a.id];
      const bRecord = state.progress.srs[b.id];
      return (bRecord.totalIncorrect - aRecord.totalIncorrect) || (aRecord.totalCorrect - bRecord.totalCorrect);
    });
}

function missedItems() {
  const lastAttempt = state.progress.failedAttempts[state.progress.failedAttempts.length - 1];
  if (!lastAttempt) return weakItems();
  return uniqueById([
    ...lastAttempt.incorrectIds.map((id) => findItemById(id)).filter(Boolean),
    ...weakItems()
  ]);
}

function allPracticeItems() {
  const words = state.words.map((item) => ({ ...item, kind: "word" }));
  const sentences = state.sentences.map((item) => ({ ...item, kind: "sentence" }));
  return [...words, ...sentences];
}

function allItemsForTopic(topic) {
  return allPracticeItems().filter((item) => item.topic === topic);
}

function topics() {
  return [...new Set([...state.words, ...state.sentences].map((item) => item.topic))].sort();
}

function findItemById(id) {
  return allPracticeItems().find((item) => item.id === id);
}

function wordForTopic(topic) {
  return state.words.find((word) => word.topic === topic)
    ? { ...state.words.find((word) => word.topic === topic), kind: "word" }
    : { ...state.words[0], kind: "word" };
}

function taskLabel(type) {
  if (type === "multiple") return "Multiple choice";
  if (type === "typed") return "Typed translation";
  return "Word matching";
}

function loadProgress() {
  const saved = localStorage.getItem("dutchTrainerProgress");
  if (!saved) return defaultProgress();

  try {
    return JSON.parse(saved);
  } catch {
    return defaultProgress();
  }
}

function normalizeProgress(progress) {
  const srs = progress.srs || migrateCardsToSrs(progress.cards || {});
  return {
    ...defaultProgress(),
    ...progress,
    srs,
    completedLessons: progress.completedLessons || [],
    failedAttempts: progress.failedAttempts || [],
    introducedWordIds: progress.introducedWordIds || [],
    soundMuted: Boolean(progress.soundMuted)
  };
}

function ensureVocabularySrsRecords() {
  state.words.forEach((word) => {
    if (!state.progress.srs[word.id]) {
      state.progress.srs[word.id] = newSrsRecord(word.id);
    }
  });
  saveProgress();
}

function defaultProgress() {
  return {
    xp: 0,
    streak: 0,
    lastPracticeDay: "",
    srs: {},
    completedLessons: [],
    failedAttempts: [],
    introducedWordIds: [],
    soundMuted: false
  };
}

function migrateCardsToSrs(cards) {
  return Object.fromEntries(Object.entries(cards).map(([itemId, card]) => {
    const totalCorrect = card.correctCount || 0;
    const totalIncorrect = card.wrongCount || 0;
    const record = {
      itemId,
      easeFactor: 2.5,
      intervalDays: card.intervalDays || 0,
      repetitions: totalCorrect,
      lastReviewedAt: card.dueDate ? new Date(card.dueDate).toISOString() : null,
      nextReviewAt: new Date(card.dueAt || card.dueDate || Date.now()).toISOString(),
      totalCorrect,
      totalIncorrect,
      masteryLevel: "learning"
    };
    record.masteryLevel = masteryLevel(record);
    return [itemId, record];
  }));
}

function saveProgress() {
  localStorage.setItem("dutchTrainerProgress", JSON.stringify(state.progress));
}

function dayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function formatDateTime(value) {
  if (!value) return "none";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
