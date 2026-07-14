/*
 * Prerequisite graph utilities.
 *
 * Computes the transitive closure of PREREQUISITE edges so every course knows
 * its full chain of upstream requirements (not just the direct ones). This is
 * done once at import/commit time and stored on each course doc, turning the
 * bot's multi-hop query into a single lookup.
 *
 * Corequisites are deliberately excluded - they are parallel, not upstream, so
 * they never propagate through the chain.
 */

// courses: [{ courseCode, courseName, prerequisites: [code, ...] }]
// Returns { closureByCode: Map<code, [{code, name}]>, cycles: [[code,...]] }
export function computeTransitiveClosure(courses) {
  const prereqMap = new Map();
  const nameMap = new Map();
  for (const c of courses) {
    prereqMap.set(c.courseCode, Array.from(new Set(c.prerequisites || [])));
    nameMap.set(c.courseCode, c.courseName || c.courseCode);
  }

  const memo = new Map(); // code -> Set<code> (transitive prereqs)
  const cycles = [];

  const visit = (code, onStack) => {
    if (memo.has(code)) return memo.get(code);

    const result = new Set();
    onStack.add(code);

    for (const p of prereqMap.get(code) || []) {
      if (onStack.has(p)) {
        cycles.push([...onStack, p]); // back-edge: prerequisite cycle
        continue;
      }
      result.add(p);
      if (prereqMap.has(p)) {
        for (const deep of visit(p, onStack)) result.add(deep);
      }
    }

    onStack.delete(code);
    memo.set(code, result);
    return result;
  };

  const closureByCode = new Map();
  for (const c of courses) {
    const set = visit(c.courseCode, new Set());
    closureByCode.set(
      c.courseCode,
      [...set].map((code) => ({ code, name: nameMap.get(code) || code }))
    );
  }

  return { closureByCode, cycles };
}
