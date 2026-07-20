import { AdminGate } from "@/components/AdminGate";
import { runParserTestBench } from "@/lib/parserTestBench";
import styles from "./parserLab.module.css";

function formatValue(value: unknown) {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return value || '""';
  return JSON.stringify(value, null, 2);
}

export default function ParserLabPage() {
  const report = runParserTestBench();

  return (
    <AdminGate>
      <main className={styles.page}>
        <header className={styles.header}>
          <p className="eyebrow">Parser v2</p>
          <h1>Parser test bench</h1>
          <p>
            The regression suite verifies Parser v2 against fixed examples. It never saves or
            modifies recipes.
          </p>
        </header>

        <section className={styles.metrics} aria-label="Parser v2 regression summary">
          <article>
            <span>Total fixtures</span>
            <strong>{report.summary.total}</strong>
          </article>
          <article>
            <span>Passing</span>
            <strong>{report.summary.passed}</strong>
          </article>
          <article>
            <span>Failures</span>
            <strong>{report.summary.failed}</strong>
          </article>
          <article>
            <span>Recipe / ingredient</span>
            <strong>
              {report.summary.recipePassed}/{report.summary.recipeTotal} · {report.summary.ingredientPassed}/
              {report.summary.ingredientTotal}
            </strong>
          </article>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <p className="eyebrow">Full recipes</p>
              <h2>{report.summary.recipeTotal} representative imports</h2>
            </div>
            <p>Title, source, URL, servings, times, ingredient boundaries and steps.</p>
          </div>

          <div className={styles.results}>
            {report.recipes.map((result) => (
              <details className={result.passed ? styles.pass : styles.fail} key={result.fixture.id}>
                <summary>
                  <span className={styles.status}>{result.passed ? "PASS" : "FAIL"}</span>
                  <span>
                    <strong>{result.fixture.name}</strong>
                    <small>{result.fixture.source}</small>
                  </span>
                  <span className={styles.count}>
                    {result.passed ? "All expected fields match" : `${result.diffs.length} differences`}
                  </span>
                </summary>

                <div className={styles.detailBody}>
                  {!result.passed && (
                    <div className={styles.diffList}>
                      {result.diffs.map((diff) => (
                        <article key={diff.field}>
                          <h3>{diff.field}</h3>
                          <div>
                            <section>
                              <span>Expected</span>
                              <pre>{formatValue(diff.expected)}</pre>
                            </section>
                            <section>
                              <span>Current parser</span>
                              <pre>{formatValue(diff.actual)}</pre>
                            </section>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  <details className={styles.rawText}>
                    <summary>Show pasted sample</summary>
                    <pre>{result.fixture.raw}</pre>
                  </details>
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <p className="eyebrow">Ingredient syntax</p>
              <h2>{report.summary.ingredientTotal} line formats</h2>
            </div>
            <p>Amounts, ranges, units, connectors, fractions, package weights and notes.</p>
          </div>

          <div className={styles.results}>
            {report.ingredients.map((result) => (
              <details className={result.passed ? styles.pass : styles.fail} key={result.fixture.id}>
                <summary>
                  <span className={styles.status}>{result.passed ? "PASS" : "FAIL"}</span>
                  <span>
                    <strong>{result.fixture.input}</strong>
                    <small>{result.fixture.id}</small>
                  </span>
                  <span className={styles.count}>
                    {result.passed ? "Correctly structured" : `${result.diffs.length} differences`}
                  </span>
                </summary>

                {!result.passed && (
                  <div className={styles.detailBody}>
                    <div className={styles.diffList}>
                      {result.diffs.map((diff) => (
                        <article key={diff.field}>
                          <h3>{diff.field}</h3>
                          <div>
                            <section>
                              <span>Expected</span>
                              <pre>{formatValue(diff.expected)}</pre>
                            </section>
                            <section>
                              <span>Current parser</span>
                              <pre>{formatValue(diff.actual)}</pre>
                            </section>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </details>
            ))}
          </div>
        </section>
      </main>
    </AdminGate>
  );
}
