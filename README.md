# _A Practical Introduction to Databases_: Touchbook edition

This fork converts *A Practical Introduction to Databases* by Christopher
Painter-Wakefield to
[sphinx-touchbook](https://github.com/DaveParillo/shpinx-touchbook).

## Build and preview

Run these commands from the repository root. Python 3.11 or newer is required.
Dependencies are declared in `pyproject.toml`.

```bash
python3 -m venv venv
source venv/bin/activate
python -m pip install -e '.[docs,test,dev]'
python -m sphinx -E -b html src build/html --fail-on-warning
python -m http.server 8766 --bind 127.0.0.1 --directory build/html
```

Open [the local book](http://127.0.0.1:8766/index.html).

Touchbook 0.9.0 is required for browser SQL and is installed from PyPI.

## Verification

The default tox run builds HTML, checks all SQL editors and their database
attachments, and executes every supplied query and self-check answer.
Node.js 22 or newer is required for SQL checks.

```bash
tox
```

Run individual environments or include the browser checks:

```bash
tox -e tests
tox -e browser
```

The browser environment also checks interactive controls and runs the SQL
answers in a headless Chromium-compatible browser. It uses a temporary test
server and defaults to Brave on macOS. Set `CHROME_PATH` to use another
Chromium executable. LaTeX and PDF builds remain deferred.

To use a local Touchbook checkout in tox's isolated environments:

```bash
tox -x 'testenv.deps=-e ../touch-book'
tox -e browser -x 'testenv.deps=-e ../touch-book'
```

## Version updates

Update `[project].version` in `pyproject.toml` to change the book version.
`src/conf.py` reads that value for both Sphinx `version` and `release`, using
the same approach as `cisc187-reader`. The cover's release notice uses the
same value through the standard `|release|` substitution.

## GitHub Pages

The `Publish Docs` workflow runs the HTML/SQL tox checks on pull requests and
pushes to `master`. After successful checks, pushes to `master` publish
`build/html` to GitHub Pages. You can also run the workflow manually from
`master`. Text, LaTeX, and PDF builds are not part of this workflow.

In the repository's **Settings → Pages**, set **Build and deployment → Source**
to **GitHub Actions**. The published book will be available at
<https://daveparillo.github.io/practical_db_textbook/>.

CI installs Touchbook from PyPI using the dependency declared in `pyproject.toml`.
