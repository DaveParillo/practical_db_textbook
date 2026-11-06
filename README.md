# _A Practical Introduction to Databases_: Touchbook edition

[![Docs](https://img.shields.io/badge/docs-read-blue)](https://daveparillo.github.io/practical_db_textbook/)
[![Tests](https://img.shields.io/github/actions/workflow/status/DaveParillo/practical_db_textbook/publish-docs.yml?branch=master&label=tests)](https://github.com/DaveParillo/practical_db_textbook/actions/workflows/publish-docs.yml)
[![License: CC BY-SA 4.0](https://img.shields.io/badge/license-CC_BY--SA_4.0-lightgrey)](https://creativecommons.org/licenses/by-sa/4.0/)

This fork converts *A Practical Introduction to Databases* by Christopher
Painter-Wakefield to
[sphinx-touchbook](https://github.com/DaveParillo/sphinx-touchbook).

## Build and preview

Run these commands from the repository root. Python 3.11 or newer is required.
Dependencies are declared in `pyproject.toml`.

The easiest way to build is through a Python virtual environment:

```bash
python -m venv venv
source venv/bin/activate
python -m pip install -e '.[docs,test,dev]'
python -m sphinx -E -b html src build/html --fail-on-warning
python -m http.server 8766 --bind 127.0.0.1 --directory build/html
```

Open [the local book](http://127.0.0.1:8766/index.html).

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
Chromium executable.

## Version updates

Update `[project].version` in `pyproject.toml` to change the book version.
`src/conf.py` reads that value for both Sphinx `version` and `release`.
The cover's release notice uses the same value in the standard `|release|`
substitution.

## GitHub Pages

The `Publish Docs` workflow runs the HTML/SQL tox checks on pull requests and
pushes to `master`. After successful checks, pushes to `master` publish
`build/html` to GitHub Pages. You can also run the workflow manually.

