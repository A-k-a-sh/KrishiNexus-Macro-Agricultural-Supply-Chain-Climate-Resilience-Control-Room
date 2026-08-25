// Pure tree/search logic for the left-nav region selector, kept out of the
// component so it can be unit-tested directly (see scripts/ui-validation/)
// rather than through a render. The component owns rows and carets; this owns
// what is in the tree and what a search does to it.

// Division names by bdapi division id.
export const DIVISION_NAMES = {
  '1': 'Chattagram', '2': 'Rajshahi', '3': 'Khulna',     '4': 'Barishal',
  '5': 'Sylhet',     '6': 'Dhaka',    '7': 'Rangpur',    '8': 'Mymensingh',
};
export const DIVISION_IDS = Object.keys(DIVISION_NAMES);

/**
 * Build the visible Division → District → Upazila tree.
 *
 * With no query every division is present. With a query, a district survives if
 * its own name matches, its division's name matches, or any of its upazilas
 * match — and a district kept only by upazila hits shows just those hits, forced
 * open, so the reason it survived is visible without a click.
 *
 * @param districts          flat district list from the API
 * @param upazilasByDistrict districtId → upazila[] (may be partially populated)
 * @param rawQuery           search text; '' or whitespace means no filter
 * @returns division nodes: { id, name, rows: [{ district, upazilas, forceOpen }], redCount }
 */
export function buildRegionTree(districts, upazilasByDistrict, rawQuery) {
  // Normalize here rather than trusting the caller: a search helper that silently
  // matches nothing when handed 'Dhaka' instead of 'dhaka' is a trap.
  const query = String(rawQuery || '').trim().toLowerCase();
  const matches = (value) => !!value && String(value).toLowerCase().includes(query);

  const byDivision = {};
  for (const d of districts || []) (byDivision[d.divisionId] ||= []).push(d);

  return DIVISION_IDS.map((divId) => {
    const divisionMatches = !!query && matches(DIVISION_NAMES[divId]);
    const rows = [];

    for (const district of byDivision[divId] || []) {
      const all = upazilasByDistrict[district._id] || [];
      const districtMatches = !!query && (matches(district.name) || matches(district.bnName));
      // A district already kept by its own or its division's name shows its full
      // subtree — narrowing it there would hide siblings the user can see match.
      const hits = query && !districtMatches && !divisionMatches
        ? all.filter((u) => matches(u.name) || matches(u.bnName))
        : [];

      if (query && !divisionMatches && !districtMatches && !hits.length) continue;
      rows.push({ district, upazilas: hits.length ? hits : all, forceOpen: hits.length > 0 });
    }

    // Drop a division a search emptied, but keep empty divisions when browsing —
    // their absence would read as "no such division" rather than "no results".
    if (query && !rows.length) return null;
    return {
      id: divId,
      name: DIVISION_NAMES[divId],
      rows,
      redCount: rows.filter((r) => r.district.riskStatus === 'red').length,
    };
  }).filter(Boolean);
}
