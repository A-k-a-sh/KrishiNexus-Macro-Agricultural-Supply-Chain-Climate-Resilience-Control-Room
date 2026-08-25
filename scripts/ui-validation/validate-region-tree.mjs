// Validates the left-nav Division → District → Upazila tree and its search.
//
// The nav is the only way to reach an upazila without hunting for its polygon on
// the map, so a search that quietly drops a match makes a region unreachable. The
// rules under test:
//
//   * No query  → all 8 divisions present, every district, nothing force-opened.
//   * A district-name hit keeps that district with its FULL upazila subtree —
//     narrowing it would hide siblings the user can plainly see match.
//   * A division-name hit keeps every district under it, likewise unfiltered.
//   * An upazila-only hit keeps the district showing JUST the matching upazilas,
//     force-opened, so the reason it survived is visible without a click.
//   * A division a search emptied is dropped; an empty division while browsing is
//     kept, because its absence would read as "no such division".
//   * Bangla names (bnName) match on both levels — half the audience types Bangla.
//
// This script imports the SHIPPED module directly, so it runs the exact function
// the nav renders with.
import { buildRegionTree, DIVISION_NAMES, DIVISION_IDS } from '../../frontend/src/components/Dashboard/regionTree.js';

let failures = 0;
const assert = (cond, msg) => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};

// ── Fixture ───────────────────────────────────────────────────────────────────
// Shaped like the real API payload, small enough to reason about by hand. Four of
// the eight divisions are populated on purpose so the "empty division" rules get
// exercised.
const districts = [
  { _id: '1',  name: 'Comilla',   bnName: 'কুমিল্লা',  divisionId: '1', riskStatus: 'red' },
  { _id: '2',  name: 'Feni',      bnName: 'ফেনী',      divisionId: '1', riskStatus: 'green' },
  { _id: '18', name: 'Rajshahi',  bnName: 'রাজশাহী',  divisionId: '2', riskStatus: 'yellow' },
  { _id: '26', name: 'Khulna',    bnName: 'খুলনা',     divisionId: '3', riskStatus: 'red' },
  { _id: '48', name: 'Dhaka',     bnName: 'ঢাকা',      divisionId: '6', riskStatus: 'red' },
  { _id: '49', name: 'Gazipur',   bnName: 'গাজীপুর',  divisionId: '6', riskStatus: 'green' },
];

const upazilasByDistrict = {
  '1':  [{ _id: 'u1', name: 'Barura',   bnName: 'বরুড়া' },
         { _id: 'u2', name: 'Chandina', bnName: 'চান্দিনা' }],
  '2':  [{ _id: 'u3', name: 'Chhagalnaiya', bnName: 'ছাগলনাইয়া' }],
  '48': [{ _id: 'u4', name: 'Savar',    bnName: 'সাভার' },
         { _id: 'u5', name: 'Dhamrai',  bnName: 'ধামরাই' }],
  // Rajshahi, Khulna and Gazipur are deliberately unloaded — the tree must cope
  // with a partially populated cache, which is the normal state before a search
  // triggers the national fetch.
};

const build = (q) => buildRegionTree(districts, upazilasByDistrict, q);
const divisionById = (tree, id) => tree.find((d) => d.id === id);
const names = (tree) => tree.flatMap((d) => d.rows.map((r) => r.district.name));

console.log('\n  Running shipped buildRegionTree() from regionTree.js\n');

// ── Browsing (no query) ───────────────────────────────────────────────────────
console.log('  Browsing — no query');
console.log('  ' + '-'.repeat(62));

const all = build('');
assert(all.length === DIVISION_IDS.length,
  `all ${DIVISION_IDS.length} divisions listed, including the empty ones (got ${all.length})`);
assert(names(all).length === districts.length,
  `every district present: ${names(all).length} / ${districts.length}`);
assert(all.every((d) => d.rows.every((r) => r.forceOpen === false)),
  'nothing is force-opened while browsing — the user owns the carets');
assert(divisionById(all, '1').redCount === 1 && divisionById(all, '6').redCount === 1,
  'redCount counts only red districts in that division');
assert(divisionById(all, '5').rows.length === 0,
  'a division with no loaded districts is kept, with zero rows');
assert(all.every((d) => d.name === DIVISION_NAMES[d.id]),
  'each node carries its division name for the header');
assert(buildRegionTree(districts, upazilasByDistrict, undefined).length === DIVISION_IDS.length,
  'an undefined query behaves as "no filter", not as a match-nothing search');
assert(buildRegionTree([], {}, '').every((d) => d.rows.length === 0),
  'an empty district list yields 8 empty divisions rather than throwing');

// ── District-name search ──────────────────────────────────────────────────────
console.log('\n  Search — district name');
console.log('  ' + '-'.repeat(62));

const dhaka = build('comilla');
assert(dhaka.length === 1 && dhaka[0].id === '1',
  `"comilla" keeps only its own division (got ${dhaka.map((d) => d.name).join(', ') || 'nothing'})`);
assert(names(dhaka).join(',') === 'Comilla',
  `only the matching district survives, sibling Feni is dropped: ${names(dhaka).join(', ')}`);
assert(dhaka[0].rows[0].upazilas.length === 2,
  'a district matched by its own name shows its FULL subtree, not a filtered one');
assert(dhaka[0].rows[0].forceOpen === false,
  'a district-name hit is not force-opened — its own row is already the answer');

const partial = build('com');
assert(names(partial).join(',') === 'Comilla', 'partial prefixes match ("com" → Comilla)');
const upper = build('COMILLA');
assert(names(upper).join(',') === 'Comilla',
  'search is case-insensitive even if the caller forgets to normalize');
const padded = build('  comilla  ');
assert(names(padded).join(',') === 'Comilla', 'surrounding whitespace is ignored');

// Dhaka is BOTH a division and a district. The division rule fires first, so
// searching it correctly widens to the whole division rather than narrowing to the
// one district — surprising until you say it out loud, so it is pinned here.
const dhakaBoth = build('dhaka');
assert(dhakaBoth.length === 1 && dhakaBoth[0].id === '6',
  'a name that is both a division and a district resolves to that division');
assert(names(dhakaBoth).sort().join(',') === 'Dhaka,Gazipur',
  `so its sibling districts are kept too: ${names(dhakaBoth).join(', ')}`);

// ── Division-name search ──────────────────────────────────────────────────────
console.log('\n  Search — division name');
console.log('  ' + '-'.repeat(62));

const chattagram = build('chattagram');
assert(chattagram.length === 1 && chattagram[0].id === '1',
  'a division-name hit keeps that division');
assert(names(chattagram).sort().join(',') === 'Comilla,Feni',
  `every district under it is kept: ${names(chattagram).join(', ')}`);
assert(chattagram[0].rows.every((r) => r.forceOpen === false),
  'a division hit does not force-open its districts');
assert(chattagram[0].rows.find((r) => r.district.name === 'Comilla').upazilas.length === 2,
  'districts kept by a division hit show their full subtrees');

// A query that hits a division name AND a district name in another division must
// keep both — the rules are unioned, not prioritised.
const aQuery = build('a');
assert(aQuery.length >= 2, `"a" spans several divisions (got ${aQuery.length})`);
assert(names(aQuery).includes('Rajshahi') && names(aQuery).includes('Dhaka'),
  'division and district matches coexist in one result set');

// ── Upazila-only search ───────────────────────────────────────────────────────
console.log('\n  Search — upazila name only');
console.log('  ' + '-'.repeat(62));

const savar = build('savar');
assert(savar.length === 1 && savar[0].rows.length === 1 && savar[0].rows[0].district.name === 'Dhaka',
  'an upazila hit surfaces its parent district');
assert(savar[0].rows[0].upazilas.length === 1 && savar[0].rows[0].upazilas[0].name === 'Savar',
  `the subtree narrows to the hit: [${savar[0].rows[0].upazilas.map((u) => u.name)}]`);
assert(savar[0].rows[0].forceOpen === true,
  'the district is force-opened so the match is visible without a click');

const chQuery = build('chandina');
assert(names(chQuery).join(',') === 'Comilla' && chQuery[0].rows[0].upazilas.length === 1,
  'a second upazila-only hit behaves the same in a different division');

// ── Bangla names ──────────────────────────────────────────────────────────────
console.log('\n  Search — Bangla names on both levels');
console.log('  ' + '-'.repeat(62));

const bnDistrict = build('গাজীপুর');
assert(names(bnDistrict).join(',') === 'Gazipur', 'a district matches on bnName');
const bnUpazila = build('সাভার');
assert(bnUpazila.length === 1 && bnUpazila[0].rows[0].upazilas[0].name === 'Savar',
  'an upazila matches on bnName, and still force-opens');

// ── No results ────────────────────────────────────────────────────────────────
console.log('\n  Search — no results');
console.log('  ' + '-'.repeat(62));

const miss = build('zzzz');
assert(Array.isArray(miss) && miss.length === 0,
  'an unmatched query returns an empty tree, so the nav can show its empty state');

// A district whose upazilas are not loaded yet must still match on its own name —
// otherwise search silently depends on fetch timing.
const unloaded = build('khulna');
assert(names(unloaded).join(',') === 'Khulna' && unloaded[0].rows[0].upazilas.length === 0,
  'a district with an unloaded subtree still matches by name');

console.log(
  failures === 0
    ? '\n  All region-tree checks passed.\n'
    : `\n  ${failures} check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
