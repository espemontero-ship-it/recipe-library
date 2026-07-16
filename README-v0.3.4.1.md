# Recipe Library v0.3.4.1 — Nutrition parser fix

This patch normalizes Markdown before extracting nutrition values.

It fixes inputs such as:

- `**Calories:** approximately 540–565 kcal`
- `**Protein:** approximately 47 g`
- `**Fibre:** approximately 0.3 g`

Copy the `app` folder into the repository root and replace
`app/paste/page.tsx`.

Then restart the local server and test **Load salmon example** again.
