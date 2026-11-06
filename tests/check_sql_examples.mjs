/** Execute all built SQL editors against the exact SQLite runtime in the book.
 * Run check_build.py first. Node.js with native ES module support is required.
 */
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = resolve(root, "build/html/_static/tb-code");
const input = JSON.parse(await readFile(resolve(root, "build/sql-inputs.json"), "utf8"));
const init = createRequire(import.meta.url)(resolve(assets, "vendor/sql-wasm.js"));
const SQL = await init({ wasmBinary: await readFile(resolve(assets, "vendor/sql-wasm.wasm")) });
const { executeSql } = await import(pathToFileURL(resolve(assets, "sqlite-engine.js")));
const files = [{ filename: "textbook.sqlite3", encoding: "base64", content: input.seed }];
const expectedErrors = new Map([
  ["constraints-example-primary-key", /UNIQUE constraint failed/],
  ["constraints-example-foreign-key", /FOREIGN KEY constraint failed/],
  ["constraints-example-other", /UNIQUE constraint failed/],
]);
const report = { editors: 0, suppliedQueries: 0, blankExercises: 0,
  successful: 0, answersChecked: 0, expectedConstraintErrors: [], truncated: [], unexpectedErrors: [] };
const executionSource = (exercise, source) => [
  ...exercise.runBefore, source, ...exercise.runAfter,
].join("\n");
for (const exercise of input.exercises) {
  report.editors += 1;
  if (exercise.source.trim() === "-- Write your query here.") report.blankExercises += 1;
  else report.suppliedQueries += 1;
  const result = executeSql(SQL, { source: executionSource(exercise, exercise.source), files });
  const message = result.messages.join("\n");
  if (expectedErrors.has(exercise.name)) {
    if (result.status !== "Run failed." || !expectedErrors.get(exercise.name).test(message)) {
      report.unexpectedErrors.push({ name: exercise.name, message: "Expected constraint failure was not reproduced", result });
    } else report.expectedConstraintErrors.push({ name: exercise.name, message });
  } else if (result.status === "Run failed.") {
    report.unexpectedErrors.push({ name: exercise.name, document: exercise.document, message });
  } else {
    report.successful += 1;
  }
  if (result.status.includes("truncated")) report.truncated.push(exercise.name);
  for (const [index, answer] of exercise.answers.entries()) {
    const result = executeSql(SQL, { source: executionSource(exercise, answer), files });
    report.answersChecked += 1;
    if (result.status !== "Run complete.") {
      report.unexpectedErrors.push({ name: exercise.name, answer: index + 1, result });
    }
  }
}
// Verify DROP has a real table to remove, and that every fresh Run restores it.
const drop = input.exercises.find(exercise => exercise.name === "table-creation-self-test-drop");
for (let run = 0; run < 2; run++) {
  const result = executeSql(SQL, { files, source: executionSource(drop, `
    SELECT name FROM sqlite_master WHERE name = 'my_table';
    DROP TABLE my_table;
    SELECT name FROM sqlite_master WHERE name = 'my_table';
  `) });
  if (result.status !== "Run complete." || result.results[0]?.values.length !== 1
      || result.results[1]?.values.length !== 0) {
    report.unexpectedErrors.push({ name: drop.name, run, result });
  }
}
await writeFile(resolve(root, "build/sql-validation.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (report.unexpectedErrors.length) process.exitCode = 1;
