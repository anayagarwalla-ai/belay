# Phase 2 Tailwind source-scan correction

The existing 170,055-byte stylesheet contains demonstrably avoidable utilities from inactive scaffold files. **Byte improvement remains unmeasured until one later production build.** This task performed source enumeration, native candidate extraction and parsing of existing CSS only; no CSS compilation, bundler, browser, dev server or simulation ran.

## Cause and evidence

The root stylesheet imported Tailwind without a source boundary. The installed @tailwindcss/postcss implementation defaults its base to process.cwd() and, when the compiler has no explicit source root, constructs an Oxide scanner for **/* beneath that base. This source scanning is independent of the JavaScript import graph: a component does not need to be imported to contribute utility candidates.

During the recorded enumeration, the main checkout's default scanner selected **355 files**, including all **60 scaffold component files**, **134 report files** and **18 test-fixture files**. Report counts changed from 133 to 134 while other work continued; they are point-in-time observations, not a frozen build input manifest. Current .gitignore excludes dist/work/node_modules but not tests or reports. The sole scaffold component in the active route graph is components/ui/button.tsx; 59 other component files are unused by this route.

The inspected existing CSS has **1354 distinct class selectors**. Native extraction from the 59 inactive component files found **1231 distinct selectors already present in that CSS and absent from the proposed runtime source set**. For example:

- components/ui/sidebar.tsx contributes candidates matching 130 such selectors, including sidebar off-canvas positioning and side-specific resize cursors.
- components/ui/calendar.tsx contributes candidates matching 82 such selectors, including selected-day range corners and --cell-size/--cell-radius utilities.
- tests/client-presentation.test.ts contains the candidate collapse, which matches an existing utility outside the runtime set.
- reports/phase2-client-latency.json contains collapse and relative candidates with the same property. The sampled client-preview fixture is eligible for scanning but produced no additional matching selector outside the runtime set.

Counts overlap between files and must not be summed. The current report samples postdate the original CSS build; this proves scanner eligibility and candidate overlap, not exclusive historical attribution to that report or a per-file byte saving. The existing CSS SHA-256 is 1c2aa855b57b47c578eef568646e312b93e8a4e14fcb4dfc491ed6e7ca42d0d3. Full evidence and per-file examples are in [the JSON report](phase2-tailwind-source-audit.json).

The second stylesheet import, shadcn/tailwind.css, defines custom variants/utilities plus global properties and keyframes. It also contributes CSS, but this patch retains it entirely; eliminating imported definitions would require a separate appearance/build comparison. Tailwind preflight, theme imports and all authored rules are likewise retained.

## Small production patch

Only **app/globals.css** changes production behavior:

```css
@import 'tailwindcss' source(none);
@import 'shadcn/tailwind.css';
@source './**/*.{ts,tsx}';
@source '../client/**/*.{ts,tsx}';
@source '../components/ui/button.tsx';
@source '../lib/**/*.{ts,tsx}';
```

This selects the two app TSX files, all twelve client TS/TSX files, the shared Button file and lib/utils.ts: **16 source files**. Tests, fixtures, reports, documentation and inactive scaffold components are excluded. The complete Button source remains registered, retaining every finite CVA variant. Runtime DOM labels from client/viewport.ts remain registered. Runtime class strings, controls, authored styles and both stylesheet imports are unchanged; dependencies, tuning and features are untouched. The authored CSS from @theme inline onward is byte-for-byte unchanged; SHA-256 79f526e93a45a2d5240b353ddb8dfeb3b06541c4732a05749162ad2824426a86.

## Coverage and remaining validation

Run **RAYON_NUM_THREADS=1 node --import tsx scripts/check-tailwind-sources.ts**. The check uses the installed native scanner with the stylesheet's actual patterns, walks local runtime imports from app/page.tsx and app/layout.tsx, and requires each current JSX/CVA/cn/imperative class producer to be included. Every candidate extracted from those full producer files must appear in the selected candidate set. It also rejects selection of tests/reports/docs/work/node_modules. It does not compile CSS.

Coverage passed with **993 candidate strings**, and **zero omitted candidates** across these six class-producing files:

- client/GateClient.tsx
- client/IncidentEvidence.tsx
- client/OperatorControls.tsx
- client/viewport.ts
- components/ui/button.tsx
- lib/utils.ts

Candidate strings include non-utility tokens; this count is not a generated-rule count. Source hashes and the runtime import graph are recorded in JSON. Future shared component imports must be registered; the check fails when a newly reachable class producer is absent. Future dynamic class construction outside these current patterns still needs review.

A later isolated production build must establish actual CSS raw/compressed sizes and validate that the scoped sources behave as expected in compiled output. Gray appearance, focus/disabled states, responsive controls and fixture presentation need a later visual check when allowed. **No byte saving, 3-second load pass or 10-second entry pass is claimed by this patch.**
