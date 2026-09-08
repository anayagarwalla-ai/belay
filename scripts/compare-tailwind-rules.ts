import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import postcss, { type Container, type Document } from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { Scanner } from '@tailwindcss/oxide';

const [beforePath, afterPath, output] = process.argv.slice(2);
assert(beforePath && afterPath && output, 'Usage: compare-tailwind-rules.ts BEFORE_CSS[.gz] AFTER_CSS OUTPUT_JSON');
const read = (path: string) => path.endsWith('.gz') ? gunzipSync(readFileSync(path)).toString() : readFileSync(path, 'utf8');
const source = readFileSync('app/globals.css', 'utf8');
const patterns = [...source.matchAll(/@source\s+['"]([^'"]+)['"]\s*;/g)].map(match => match[1]);
const scanner = new Scanner({ sources: patterns.map(pattern => ({ base: resolve('app'), pattern, negated: false })) });
const candidates = new Set(scanner.scan());
// Group/peer markers qualify another utility's selector; their presence alone does not require an unused utility.
const active = (name: string) => candidates.has(name) && !/^(?:group|peer)(?:\/|$)/.test(name) && name !== 'dark';
type Fact = { key: string; category: 'rule' | 'property' | 'keyframes'; name: string; classes: string[]; property: string; value: string };
// A whole-selector :is() group can be expanded only when each simple branch has
// equal specificity. Keep complex/unequal groups literal, so they fail closed.
function selectorBranches(selector: selectorParser.Selector) {
  const node = selector.nodes[0];
  if (selector.nodes.length !== 1 || node.type !== 'pseudo' || node.value !== ':is' || !node.nodes?.length) return [selector];
  const specificity = node.nodes.map(branch => {
    const score = [0, 0, 0];
    for (const part of branch.nodes) {
      if (part.type === 'id') score[0]++;
      else if (part.type === 'class' || part.type === 'attribute') score[1]++;
      else if (part.type === 'tag') score[2]++;
      else if (part.type === 'pseudo' && !part.nodes?.length) {
        if (part.value.startsWith('::') || /^:(before|after|first-line|first-letter)$/.test(part.value)) score[2]++;
        else score[1]++;
      } else if (part.type !== 'universal' && part.type !== 'combinator') return null;
    }
    return score.join(',');
  });
  return specificity[0] !== null && specificity.every(value => value === specificity[0]) ? node.nodes : [selector];
}
function inspect(text: string) {
  const root = postcss.parse(text), facts: Fact[] = [], classes = new Set<string>(), keyframes = new Set<string>();
  root.walkRules(rule => {
    assert(rule.parent?.type !== 'rule', 'Nested selectors require an explicit comparator update');
    const context: string[] = []; let category: Fact['category'] = 'rule', name = '';
    for (let parent: Container | Document | undefined = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) {
      if (parent.type === 'atrule') {
        const at = parent as postcss.AtRule; context.unshift(`@${at.name} ${at.params.trim().replace(/\s+/g, ' ')}`);
        if (at.name.endsWith('keyframes')) { category = 'keyframes'; name = at.params; keyframes.add(name); }
      }
    }
    const selectors = selectorParser().astSync(rule.selector, { lossless: false });
    for (const selector of selectors.nodes.flatMap(selectorBranches)) {
      const names: string[] = []; selector.walkClasses(node => { names.push(node.value); classes.add(node.value); });
      for (const node of rule.nodes) if (node.type === 'decl') {
        const key = JSON.stringify([context, selector.toString(), node.prop, node.value, Boolean(node.important)]);
        facts.push({ key, category, name, classes: names, property: node.prop, value: node.value });
      }
    }
  });
  root.walkAtRules('property', rule => {
    const context: string[] = []; for (let parent: Container | Document | undefined = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) {
      if (parent.type === 'atrule') { const at = parent as postcss.AtRule; context.unshift(`@${at.name} ${at.params.trim().replace(/\s+/g, ' ')}`); }
    }
    for (const node of rule.nodes ?? []) if (node.type === 'decl') facts.push({
      key: JSON.stringify([context, `@property ${rule.params}`, node.prop, node.value, Boolean(node.important)]),
      category: 'property', name: rule.params, classes: [], property: node.prop, value: node.value,
    });
  });
  return { facts, classes, keyframes };
}
const beforeText = read(beforePath), afterText = read(afterPath), before = inspect(beforeText), after = inspect(afterText);
const required = new Set<Fact>(before.facts.filter(fact => fact.category === 'rule' &&
  (fact.classes.some(active) || fact.classes.length === 0 && !fact.property.startsWith('--'))));
const variables = new Set<string>(), animations = new Set<string>();
let size = -1;
while (size !== required.size) {
  size = required.size;
  for (const fact of required) {
    for (const match of fact.value.matchAll(/var\(\s*(--[\w-]+)/g)) variables.add(match[1]);
    if (fact.property.startsWith('animation') || fact.property.startsWith('--animate')) for (const name of before.keyframes) {
      if (fact.value.split(/[\s,]+/).includes(name)) animations.add(name);
    }
  }
  for (const fact of before.facts) {
    if (fact.category === 'property' && variables.has(fact.name)
      || fact.category === 'keyframes' && animations.has(fact.name)
      || fact.category === 'rule' && fact.classes.length === 0 && variables.has(fact.property)) required.add(fact);
  }
}
const afterKeys = new Set(after.facts.map(fact => fact.key));
const requiredKeys = [...new Set([...required].map(fact => fact.key))].sort();
const unmatchedRules = requiredKeys.filter(key => !afterKeys.has(key));
// Tailwind drops optional wildcard registrations when no remaining utility sets
// the variable. Accept only initial-valued fallback scaffolding with no active
// setter, no setter anywhere in the new CSS, and an explicit fallback at every
// remaining read. An actual utility declaration still fails if it disappears.
const sourceTexts = scanner.files.map(path => ({ path, text: readFileSync(path, 'utf8') }));
const optionalInitializations = [...variables].flatMap(variable => {
  const registration = before.facts.filter(fact => fact.category === 'property' && fact.name === variable);
  if (registration.length !== 2 || !registration.some(fact => fact.property === 'syntax' && fact.value === '"*"')
    || !registration.some(fact => fact.property === 'inherits' && fact.value === 'false')) return [];
  if (after.facts.some(fact => fact.property === variable || fact.category === 'property' && fact.name === variable)
    || [...required].some(fact => fact.property === variable && fact.value !== 'initial')
    || sourceTexts.some(file => file.text.includes(variable)) || source.includes(variable)) return [];
  const reads = after.facts.flatMap(fact => [...fact.value.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)]
    .filter(match => match[1] === variable).map(match => ({ key: fact.key, explicitFallback: match[2] === ',' })));
  if (!reads.length || reads.some(read => !read.explicitFallback)) return [];
  const keys = [...required].filter(fact => fact.category === 'property' && fact.name === variable
    || fact.category === 'rule' && fact.classes.length === 0 && fact.property === variable && fact.value === 'initial'
    && JSON.parse(fact.key)[0][0] === '@layer properties').map(fact => fact.key).filter(key => unmatchedRules.includes(key));
  return keys.length ? [{ variable, omittedInitializationKeys: keys, remainingReads: reads,
    reason: 'Wildcard registration had no initial-value; all remaining reads have fallbacks, and current scanned sources/authored CSS/new emitted CSS contain no setter. Inference is scoped to these application styles, not arbitrary externally injected CSS or runtime property writes.' }] : [];
});
const acceptedKeys = new Set(optionalInitializations.flatMap(item => item.omittedInitializationKeys));
const missingRules = unmatchedRules.filter(key => !acceptedKeys.has(key));
const requiredClasses = [...before.classes].filter(active).sort(), missingClasses = requiredClasses.filter(name => !after.classes.has(name));
const preservedSource = readFileSync(resolve(dirname(beforePath), 'source-globals.css'), 'utf8');
const authored = (css: string) => css.slice(css.indexOf('@theme inline'));
const authoredRulesUnchanged = authored(source) === authored(preservedSource);
const report = { beforePath, afterPath, generatedAt: new Date().toISOString(),
  beforeSha256: createHash('sha256').update(beforeText).digest('hex'), afterSha256: createHash('sha256').update(afterText).digest('hex'),
  requiredClasses, missingClasses, requiredDeclarationCount: requiredKeys.length, requiredDeclarationSha256: createHash('sha256').update(JSON.stringify(requiredKeys)).digest('hex'),
  requiredVariables: [...variables].sort(), requiredKeyframes: [...animations].sort(), unmatchedRules,
  optionalInitializations, missingRules, authoredRulesUnchanged,
  scope: 'Compares exact normalized selector branches, at-rule contexts and declarations for active candidates; includes unclassed preflight/authored rules, referenced global variable definitions, @property declarations and used keyframes. Structural group/peer/dark markers alone do not select inactive utilities. No screenshot, GPU, cascade reordering or new overriding-rule equivalence is claimed.' };
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, requiredClasses: requiredClasses.length, requiredDeclarations: requiredKeys.length,
  missingClasses, missingRules: missingRules.length, authoredRulesUnchanged }, null, 2));
assert.deepEqual(missingClasses, [], 'Active class rules disappeared');
assert.deepEqual(missingRules, [], 'Active/global declarations disappeared or changed; inspect the saved diff');
assert(authoredRulesUnchanged, 'Authored gray-theme rules changed');
