/** Real-browser checks for the converted book; build HTML and run check_build.py first.
 * node tests/check_browser.mjs
 * CHROME_PATH may select another Chromium executable.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(project, "build/html");
const input = JSON.parse(await readFile(resolve(project, "build/sql-inputs.json"), "utf8"));
const missing = [];
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (!pathname.startsWith("/book/")) throw new Error("Outside book root");
    const path = resolve(root, pathname.slice("/book/".length));
    if (!path.startsWith(root + sep)) throw new Error("Outside book root");
    const content = await readFile(path);
    response.writeHead(200, { "Content-Type": {
      ".js": "text/javascript", ".html": "text/html", ".wasm": "application/wasm",
      ".css": "text/css", ".svg": "image/svg+xml", ".jpg": "image/jpeg",
    }[extname(path)] || "application/octet-stream" });
    response.end(content);
  } catch {
    missing.push(request.url);
    response.writeHead(404);
    response.end("Not found");
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const profile = await mkdtemp(resolve(tmpdir(), "tb-code-browser-"));
const executable = process.env.CHROME_PATH || "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const child = spawn(executable, ["--headless", "--disable-gpu", "--no-first-run",
  "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"],
{ stdio: ["ignore", "ignore", "pipe"] });
let browserLog = "";
child.stderr.on("data", chunk => { browserLog += chunk; });
child.on("error", error => { browserLog += error.message; });
let socket;
try {
  let port;
  for (let attempt = 0; attempt < 200; attempt++) {
    try { port = (await readFile(resolve(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]; break; }
    catch { await delay(50); }
  }
  if (!port) throw new Error(`Browser did not start: ${browserLog}`);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find(target => target.type === "page");
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let serial = 0;
  const pending = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    const task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const serviceRequests = [];
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.method === "Network.requestWillBeSent" && /\/restapi\//.test(message.params.request.url)) {
      serviceRequests.push(message.params.request.url);
    }
  });
  await command("Network.enable");
  await command("Network.setBlockedURLs", { urls: ["*/restapi/*"] });
  const evaluate = async (expression) => {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const navigate = async (relative) => {
    const path = `/book/${relative}`;
    await command("Page.navigate", { url: `http://127.0.0.1:${server.address().port}${path}` });
    for (let n = 0; n < 200; n++) {
      if (await evaluate(`location.pathname === ${JSON.stringify(path)} && document.readyState === 'complete'`)) return;
      await delay(50);
    }
    throw new Error(`Page did not finish loading: ${relative}`);
  };
  const report = { sqlEditors: 0, suppliedQueriesRun: 0, blankEditorChecked: false,
    answersChecked: 0, dependentDropRuns: 0,
    choicesChecked: 0, blanksChecked: 0, matchesChecked: 0, revealsChecked: 0,
    pages: [], serviceRequests, missingAssets: [] };
  const expectedErrors = ["constraints-example-primary-key", "constraints-example-foreign-key", "constraints-example-other"];
  const sqlPages = [...new Set(input.exercises.map(exercise => exercise.document))];
  for (const page of sqlPages) {
    await navigate(page);
    const expected = input.exercises.filter(exercise => exercise.document === page).length;
    const result = await evaluate(`(async () => {
      const check = (condition, text) => { if (!condition) throw new Error(text); };
      const wait = async (condition) => {
        const start = performance.now();
        while (!condition()) {
          if (performance.now() - start > 15000) throw new Error('Timed out waiting for controls');
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      };
      const blocks = [...document.querySelectorAll('tb-code')];
      check(blocks.length === ${expected}, 'Incorrect editor count');
      await wait(() => blocks.every(block => block.querySelector('.tb-code__controls')));
      let supplied = 0;
      let blank = false;
      let answersChecked = 0;
      let dependentDropRuns = 0;
      const answersByName = ${JSON.stringify(Object.fromEntries(input.exercises.filter(exercise => exercise.document === page).map(exercise => [exercise.name, exercise.answers])))};
      for (const block of blocks) {
        const config = JSON.parse(block.querySelector('.tb-code__config').textContent);
        const attachments = block.querySelector('.tb-code__attached-files');
        check(attachments.hidden && !attachments.childElementCount,
          'Hidden database attachment is visible: ' + block.id);
        const controls = [...block.querySelectorAll('.tb-code__controls button')];
        const run = controls.find(button => button.textContent === 'Run');
        const edit = controls.find(button => button.textContent === 'Edit');
        check(run && edit, 'Run/Edit missing: ' + block.id);
        if (config.source.trim() === '-- Write your query here.') {
          edit.click();
          const editor = block.querySelector('.tb-code__editor');
          check(editor.value.trim() === config.source.trim(), 'Setup leaked into editor: ' + block.id);
          const execute = async (source) => {
            editor.value = source;
            editor.dispatchEvent(new Event('change', { bubbles: true }));
            run.click();
            await wait(() => !run.disabled);
            check(block.querySelector('.tb-code__status').textContent === 'Run complete.',
              'Edited query failed: ' + block.id + ': ' + block.querySelector('.tb-code__output').textContent);
          };
          if (!blank) {
            await execute('SELECT COUNT(*) AS book_count FROM simple_books;');
            check(block.querySelector('table th').textContent === 'book_count', 'Edited query result missing');
          }
          for (const answer of answersByName[block.id]) {
            await execute(answer);
            answersChecked += 1;
          }
          if (block.id === 'table-creation-self-test-drop') {
            for (let run = 0; run < 2; run++) {
              await execute('DROP TABLE my_table;');
              check(!editor.value.includes('CREATE'), 'Setup leaked into DROP editor');
              dependentDropRuns += 1;
            }
          }
          blank = true;
          continue;
        }
        run.click();
        await wait(() => !run.disabled);
        const status = block.querySelector('.tb-code__status').textContent;
        const expectedFailure = ${JSON.stringify(expectedErrors)}.includes(block.id);
        check(expectedFailure ? status === 'Run failed.' : status.startsWith('Run complete'), block.id + ': ' + status);
        supplied += 1;
      }
      let reveals = 0;
      for (const reveal of document.querySelectorAll('tb-reveal')) {
        const details = reveal.querySelector('details');
        const summary = details.querySelector('summary');
        summary.click(); check(details.open, 'Reveal did not open');
        summary.click(); check(!details.open, 'Reveal did not close');
        reveals += 1;
      }
      return { editors: blocks.length, supplied, blank, reveals, answersChecked, dependentDropRuns };
    })()`);
    report.sqlEditors += result.editors;
    report.suppliedQueriesRun += result.supplied;
    report.blankEditorChecked ||= result.blank;
    report.answersChecked += result.answersChecked;
    report.dependentDropRuns += result.dependentDropRuns;
    report.revealsChecked += result.reveals;
    report.pages.push(page);
    console.log(`Checked ${page}: ${result.editors} editors, ${result.supplied} supplied queries, ${result.answersChecked} answers`);
  }
  for (const page of ["PART2_DATA_MODELING/02-ERD/ERD.html",
    "PART2_DATA_MODELING/03-ERD-to-relational/ERD-to-relational.html",
    "PART3_RELATIONAL_DATABASE_THEORY/01-relational-model/relational-model.html"]) {
    await navigate(page);
    const result = await evaluate(`(() => {
      const check = (condition, text) => { if (!condition) throw new Error(text); };
      let choices = 0, blanks = 0, matches = 0, reveals = 0;
      for (const choice of document.querySelectorAll('tb-choice')) {
        for (const option of choice.querySelectorAll('.tb-choice__option')) {
          const input = option.querySelector('input');
          input.checked = option.dataset.correct === 'true';
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        choice.querySelector('.tb-choice__check').click();
        check(choice.querySelector('.tb-choice__status').textContent === 'Correct.', 'Choice grading failed: ' + choice.id);
        choices += 1;
      }
      for (const blank of document.querySelectorAll('tb-blank')) {
        const config = JSON.parse(blank.querySelector('.tb-blank__config').textContent);
        for (const input of blank.querySelectorAll('input')) {
          input.value = config.answers[input.dataset.blankId].matches[0];
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        blank.querySelector('.tb-blank__check').click();
        check(blank.querySelector('.tb-blank__status').textContent.startsWith('Correct.'), 'Blank grading failed: ' + blank.id);
        blanks += 1;
      }
      for (const match of document.querySelectorAll('tb-match')) {
        for (const select of match.querySelectorAll('select')) {
          select.value = select.dataset.answer;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        match.querySelector('.tb-match__check').click();
        check(match.querySelector('.tb-match__status').textContent === 'Correct.', 'Matching failed: ' + match.id);
        matches += 1;
      }
      for (const reveal of document.querySelectorAll('tb-reveal')) {
        const details = reveal.querySelector('details');
        details.querySelector('summary').click();
        check(details.open, 'Reveal did not open');
        reveals += 1;
      }
      return { choices, blanks, matches, reveals };
    })()`);
    report.choicesChecked += result.choices;
    report.blanksChecked += result.blanks;
    report.matchesChecked += result.matches;
    report.revealsChecked += result.reveals;
    report.pages.push(page);
  }
  await navigate('index.html');
  report.cover = await evaluate(`({ title: document.querySelector('h1')?.textContent,
    image: Boolean(document.querySelector('img[alt="Library at Trinity College."]')),
    license: [...document.links].some(link => {
      const url = new URL(link.href);
      return url.hostname === 'creativecommons.org' && url.pathname === '/licenses/by-sa/4.0/';
    }) })`);
  if (!report.cover.image || !report.cover.license) throw new Error(`Cover image or license missing: ${JSON.stringify(report.cover)}`);
  const screenshot = await command('Page.captureScreenshot', { format: 'png' });
  await writeFile(resolve(project, 'build/browser-cover.png'), Buffer.from(screenshot.data, 'base64'));
  report.missingAssets = missing.filter(path => /_static|_images/.test(path));
  if (report.sqlEditors !== 107 || report.suppliedQueriesRun !== 49 || report.choicesChecked !== 17
      || report.answersChecked !== 60 || report.dependentDropRuns !== 2
      || report.blanksChecked !== 4 || report.matchesChecked !== 4 || report.revealsChecked !== 63
      || serviceRequests.length || report.missingAssets.length) throw new Error(JSON.stringify(report));
  await writeFile(resolve(project, 'build/browser-validation.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  socket?.close();
  child.kill('SIGTERM');
  await new Promise(resolve => server.close(resolve));
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(2000)]);
  await rm(profile, { recursive: true, force: true });
}
