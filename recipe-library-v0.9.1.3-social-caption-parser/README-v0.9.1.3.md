# Recipe Library v0.9.1.3

Improves pasted social-caption parsing.

## Fixes
- Detects ingredient blocks without an explicit `Ingredients` heading.
- Supports subsection headings such as `The Base:` and `The Mix-Ins:`.
- Detects ingredient lines beginning with quantities, fractions, parenthetical gram weights, `Pinch`, and similar forms.
- Removes trailing `See less` / `Ver menos` text.
- Extracts social handles such as `@thecheatcodekitchen` as author.
- Detects Ninja Creami as a cooking method.
- Adds berries, milk, protein powder, and xanthan gum to inferred main ingredients.
- Removes leading emoji from the title while preserving the title text.

## Verified sample
The Berry Burst caption extracts:
- title
- author
- 6 ingredient lines
- calories, protein, carbs, and fat
- Ninja Creami method

Production build passed with Next.js 16.2.10.
