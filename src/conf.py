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
root_doc = 'index'
source_suffix = '.rst'
exclude_patterns = ['**/*.tex',
                    '**/*.drawio',
                    '**/Makefile',
                    '_static/theme-overrides.css',
                    'appendix-a-datasets/*.sql',
                    'appendix-a-datasets/textbook.sqlite3',
                    'PART4*/*',
                    'PART5*/*'
]
extensions = ['sphinx.ext.mathjax',
              'sphinx.ext.graphviz',
              'sphinx.ext.extlinks',
              'sphinx_accessibility',
              'sphinx_copybutton',
              'sphinx_touchbook'
]
graphviz_output_format = 'svg'
extlinks = {
    'wiki': ('https://en.wikipedia.org/wiki/%s', '%s'),
    'issue': ('https://github.com/DaveParillo/practical_db_textbook/issues/%s', 'issue %s'),
}


html_theme = 'sphinx_nefertiti'
html_js_files = [
  'nefertiti-logo-scheme.js',
]
html_theme_options = {
     'doc_headers_font': 'Nunito',
     'header_links': [
         {
             'text': 'on GitHub',
             'link': 'https://github.com/DaveParillo/practical_db_textbook',
         },
     ],
     'logo': 'touchbook-logo.svg',
     'logo_alt': 'Practical DB textbook home',
     'logo_width': 40,
     'logo_height': 24,
     'pygments_light_style': 'a11y-light',
     'pygments_dark_style': 'a11y-dark',
     'style_header_neutral': True,
 }

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
