import tomllib
from pathlib import Path


def project_version() -> str:
    pyproject = Path(__file__).resolve().parents[1] / 'pyproject.toml'
    with pyproject.open('rb') as stream:
        data = tomllib.load(stream)
    return data['project']['version']


project = 'A Practical Introduction to Databases'
author = 'Christopher Painter-Wakefield'
copyright = r'''
2022 Christopher Painter-Wakefield.
<a rel="license" href="https://creativecommons.org/licenses/by-sa/4.0/">
    <img src="https://i.creativecommons.org/l/by-sa/4.0/80x15.png"
         alt="Creative Commons Attribution-ShareAlike 4.0"
         width="80" height="15">
</a>
Licensed under a
<a rel="license" href="https://creativecommons.org/licenses/by-sa/4.0/">
    Creative Commons Attribution-ShareAlike 4.0 International License
</a>.
'''
version = project_version()
release = version
language = 'en'
extensions = ['sphinx.ext.mathjax', 'sphinx_touchbook']
root_doc = 'index'
source_suffix = '.rst'
exclude_patterns = ['**/*.tex',
                    '**/*.drawio',
                    '**/Makefile',
                    '_static/theme-overrides.css',
                    'appendix-a-datasets/*.sql',
                    'appendix-a-datasets/textbook.sqlite3',
                    'PART4*/*',
                    'PART5*/*']
html_theme = 'sphinx_nefertiti'
html_static_path = ['_static']
highlight_language = 'sql'
numfig = True
numfig_secnum_depth = 1
tb_code_default_language = 'sql'
tb_code_block_defaults = {'linenos': True}
rst_prolog = r'''
.. |chapter-end| unicode:: U+274F

.. |license-notice| replace:: Licensed under `CC BY-SA 4.0 <https://creativecommons.org/licenses/by-sa/4.0/>`__.
'''
