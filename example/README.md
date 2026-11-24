# Example site

Dummy stories for trying the gem's tags: 5 story modes and 7 thematic map styles.
The data is made up; `_tools/make_data.mjs` regenerates it (`node _tools/make_data.mjs`).

From this folder, with Docker:

```
docker run --rm -p 127.0.0.1:4002:4000 -v "${PWD}/..:/gem" -w /gem/example ruby:3.4 sh -c "bundle install && bundle exec jekyll serve --host 0.0.0.0 --force_polling"
```

Then open http://127.0.0.1:4002. The Light/Dark button flips `html[data-theme]`,
which lungkui follows for its default basemap.
