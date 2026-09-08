The scoped Tailwind scanner built successfully at source commit `3dd42f542d0652f25498e48ca2603f0c6336452a`. The resulting CSS is **20,560 bytes**, compared with the **169,812-byte** local output preserved before building. All 99 previously emitted active candidate classes remain. Offline declaration comparison has zero unresolved differences after the specific normalization and initialization checks below. DOM, pixel, GPU, load-time and entry-time verification remain deferred.

| Root-route dependency payload | Preserved raw | New raw | Preserved gzip 6 | New gzip 6 | Preserved Brotli 5 | New Brotli 5 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CSS, one file | 169,812 | 20,560 | 25,860 | 4,733 | 23,558 | 4,452 |
| JavaScript, six files | 1,185,649 | 1,186,700 | 335,333 | 335,815 | 315,648 | 316,092 |
| Total | 1,355,461 | 1,207,260 | 361,193 | 340,548 | 339,206 | 320,544 |

The observed CSS difference is −149,252 raw bytes (−87.89%), −21,127 gzip bytes and −19,106 Brotli bytes. Root-route totals fall by 148,201 raw bytes, 20,645 gzip bytes and 18,662 Brotli bytes. JavaScript grows by 1,051 raw bytes; no JavaScript change is credited to scanner scope. The old producing commit is unknown and includes earlier client code, so this is a historical-to-current comparison, **not a same-source A/B or an exclusive causal byte attribution**. The separate historical main-checkout audit had 170,055 CSS bytes; that is not this preserved baseline.

The payload is the distinct emitted bootstrap/client-reference/server-resource dependency union for the single root route. Ancillary favicon and compatibility manifests are excluded. No font or WASM client asset was emitted. Compression numbers are local per-file estimates, not HTTP transfers; HTML/RSC, request overhead, execution, styling and GPU time are excluded. The build still warns about a JavaScript chunk over 500 kB. No library, import or further production-source rewrite was made during validation.

The one authorized build ran from **2026-09-08 00:23:13.314 to 00:23:18.555 UTC**, following the evidence task's direct window confirmation. START was announced at 00:23:00 UTC and RELEASE at completion. Four benchmark workers continued unchanged, so the interval is shared-host contention and is not an isolated timing benchmark. Limits were a 180-second deadline, 1,536 MiB Node heap cap, one Rayon thread and a 1.5 GiB available-memory abort floor. Exit code was 0; no bound fired. Minimum one-second build sample was 3,520,086,016 available bytes; the separate post-cleanup sample was 3,426,631,680 bytes. These are sampled host headroom, not peak RSS measurements.

`build-receipt.json` records clean tracked source, unchanged HEAD and unchanged SHA-256 values for 102 build-relevant tracked files before/after. `build-once.mjs` preserves the executed wrapper; `build.log.gz` losslessly preserves its raw output (including original whitespace); the receipt hash addresses the decompressed log. The owned build process group was terminated, and a subsequent process-group check returned no remaining processes. No dev server or browser was launched. This task owns no active process or automation.

| Identity | Value |
| --- | --- |
| Producing source | `3dd42f542d0652f25498e48ca2603f0c6336452a` |
| New build ID | `6af961a1-d96b-4e82-9900-df6e321762c9` |
| Old build ID; source unknown | `d777468d-5770-4186-aa47-d0dc371212f2` |
| Old CSS SHA-256 | `4c2770f72ac6a0089ff8b1a7c8460be946fddb4722ab0f7dbe500f6c0e6bc002` |
| New CSS SHA-256 | `1b681aaac66ec6871eac2bba81ecaade1dd1c3036165c53d38c8e7272d701e85` |
| Build log SHA-256 | `3a1a60c3cbbd32f3e34ff280913052449777b34ed9aef243fa6da8834eae1fca` |

Both compiled CSS files are losslessly preserved as gzip archives alongside public asset manifests, inventory hashes and size estimates in `before/` and `after/`. Private server runtime configuration was not included. `after/preservation.json` records installed tool versions; Tailwind/PostCSS integration and native scanner were 4.2.1, Vite 8.2.2 and vinext 1.0.0-beta.9 under Node v26.5.0. The before inventory explicitly retains unknown build provenance; the after inventory links the observed build receipt.

The source checker selects 16 runtime-source files and extracts 993 native candidate strings, including non-utility tokens. It confirms all six currently reachable class producers are selected, including all Button variants and imperative viewport labels. New UI class producers must be registered in the explicit scanner scope. Neither this check nor the CSS comparison proves arbitrary future dynamic class construction.

The initial literal comparator result is retained in `initial-strict-rule-comparison.json`: 99 classes, 705 unique declaration facts and 21 unmatched facts. Inspection found three differences caused by the minifier merging focus-ring selector aliases inside `:is()`. The comparator now expands only whole-selector, simple-branch `:is()` groups with equal specificity; complex or unequal groups remain literal. This preserves the active branch semantics under the [Selectors Level 4 specificity rule](https://www.w3.org/TR/selectors-4/#specificity-rules).

The other 18 differences are the removed wildcard registrations and initial-valued fallback scaffolding for `--tw-leading`, `--tw-ease` and `--tw-duration`. All remaining reads have explicit fallbacks; current scanned source, authored stylesheet and emitted CSS contain no setter. Each old registration has only `syntax: "*"` and `inherits: false`, with no initial value. A wildcard registration with no initial value uses the guaranteed-invalid value, as defined by the [Properties and Values API draft](https://www.w3.org/TR/css-properties-values-api-1/#initial-value-descriptor). Their omission therefore preserves these application fallback reads under the checked conditions. This is a scoped static inference, not a claim about arbitrary injected CSS, runtime property writes or browser rendering.

The final `rule-comparison.json` records 711 normalized required declaration facts: **693 exact retained facts and 18 explicitly justified initialization omissions**, zero missing classes, zero unresolved rules, and an unchanged authored stylesheet body from `@theme inline` onward. It includes responsive/state contexts, referenced global variables, property registrations and used keyframes. It does not establish cascade ordering, absence of newly overriding rules, or visual equivalence.

`comparator-controls.json` records a passing baseline self-comparison and three negative controls against offline CSS copies. Removing `.gate-button` fails on seven declarations; removing the active focus-ring rule fails on its class and two declarations; adding a duration setter makes the six omitted duration initialization facts fail instead of being accepted. No control changed production source or rebuilt CSS. Final TypeScript, scoped lint, scanner-source coverage and `git diff --check` passed. The initial comparator type errors were corrected before these final checks.

To repeat the offline rule check from this source tree:

```sh
RAYON_NUM_THREADS=1 node --import tsx scripts/compare-tailwind-rules.ts \
  reports/phase2-tailwind-build-validation/before/index.DehHp_8M.css.gz \
  reports/phase2-tailwind-build-validation/after/index.DTH9dJZE.css.gz \
  work/tailwind-rule-comparison.json
```

Only this assigned build and offline validation were performed. The work queue is frozen; no further build, browser check, investigation or review is scheduled by this task. Human feel and Phase 2 acceptance remain outside this evidence.
