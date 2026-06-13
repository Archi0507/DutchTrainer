const frame = document.querySelector("#appFrame");
const results = document.querySelector("#results");
const runAgain = document.querySelector("#runAgain");

runAgain.addEventListener("click", runTests);
runTests();

async function runTests() {
  results.innerHTML = "";
  const tests = [
    ["full 20-question pass path", testPassPath],
    ["full 20-question fail path", testFailPath],
    ["localStorage persistence after reload", testPersistence],
    ["failed lesson does not mark completion", testFailedNoCompletion],
    ["passed lesson updates SRS records", testPassedUpdatesSrs],
    ["missed words appear in Practice Mistakes", testPracticeMistakes]
  ];

  for (const [name, test] of tests) {
    try {
      await test();
      addResult(name, true);
    } catch (error) {
      addResult(name, false, error.message);
    }
  }
}

async function loadApp(label = Date.now()) {
  frame.src = `../?dev=1&test=${label}`;
  await new Promise((resolve) => {
    frame.addEventListener("load", resolve, { once: true });
  });
  await waitFor(() => frame.contentWindow.dutchTrainerDev);
  return frame.contentWindow.dutchTrainerDev;
}

async function testPassPath() {
  const dev = await loadApp("pass");
  dev.clearAllProgress();
  const lesson = dev.simulatePassingLesson();
  const progress = dev.getProgress();

  assert(lesson.finished, "lesson should be finished");
  assert(lesson.correct >= 14, "lesson should pass");
  assert(progress.completedLessons.length === 1, "completed lesson should be saved");
  assert(progress.failedAttempts.length === 0, "failed attempts should stay empty");
  assert(progress.xp > 0, "passing should award XP");
}

async function testFailPath() {
  const dev = await loadApp("fail");
  dev.clearAllProgress();
  const lesson = dev.simulateFailingLesson();
  const progress = dev.getProgress();

  assert(lesson.finished, "lesson should be finished");
  assert(lesson.correct < 14, "lesson should fail");
  assert(progress.failedAttempts.length === 1, "failed attempt should be saved");
  assert(progress.completedLessons.length === 0, "failed lesson should not complete");
}

async function testPersistence() {
  const dev = await loadApp("persist-a");
  dev.clearAllProgress();
  dev.simulatePassingLesson();
  const before = dev.getProgress();

  const reloaded = await loadApp("persist-b");
  const after = reloaded.getProgress();

  assert(after.xp === before.xp, "XP should persist after reload");
  assert(after.completedLessons.length === before.completedLessons.length, "completed lessons should persist");
}

async function testFailedNoCompletion() {
  const dev = await loadApp("failed-no-completion");
  dev.clearAllProgress();
  dev.simulateFailingLesson();
  const progress = dev.getProgress();

  assert(progress.completedLessons.length === 0, "failed lesson should not mark completion");
  assert(progress.failedAttempts.length === 1, "failed lesson should be tracked");
}

async function testPassedUpdatesSrs() {
  const dev = await loadApp("srs-update");
  dev.clearAllProgress();
  dev.simulatePassingLesson();
  const rows = dev.getSrsRows();
  const reviewed = rows.filter((row) => row.totalCorrect > 0 || row.totalIncorrect > 0);

  assert(reviewed.length > 0, "some SRS rows should be reviewed");
  assert(reviewed.some((row) => row.nextReviewAt), "reviewed rows should have nextReviewAt");
}

async function testPracticeMistakes() {
  const dev = await loadApp("mistakes");
  dev.clearAllProgress();
  dev.simulateFailingLesson();
  const progress = dev.getProgress();
  const missed = new Set(progress.failedAttempts[0].incorrectIds);
  const lesson = dev.practiceMistakesForTest();
  const lessonIds = new Set(lesson.tasks.flatMap(taskIds));

  assert(missed.size > 0, "failed lesson should have missed words");
  assert([...missed].some((id) => lessonIds.has(id)), "mistake practice should include missed words");
}

function taskIds(task) {
  if (task.items) return task.items.map((item) => item.id);
  if (task.item) return [task.item.id];
  return [];
}

function addResult(name, passed, detail = "") {
  const row = document.createElement("div");
  row.className = `result ${passed ? "pass" : "fail"}`;
  row.textContent = `${passed ? "PASS" : "FAIL"}: ${name}${detail ? ` - ${detail}` : ""}`;
  results.appendChild(row);
}

async function waitFor(fn, timeoutMs = 3000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for app test API");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
