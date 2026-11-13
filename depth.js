// The agents' hidden depth (Fez-style): the page stays flat and untouched; Hugo and the dove carry a lane z the page never sees.
// READ-ONLY on the page: this file may read the DOM, never write a style or attribute to a page element.
// Loaded as a classic script before the agents (window.DEPTH); node can require it for its self-test (depth.test.js).
(G => {
  // Nearest ancestor that clips its content (overflow other than visible): a phone carousel, a scroll box. memo: Map per scan.
  function clipOf(node, memo) {
    const path = []; let p = node.parentElement, c = null;
    for (; p && p.tagName !== 'BODY' && p.tagName !== 'HTML'; p = p.parentElement) {
      if (memo.has(p)) { c = memo.get(p); break; }
      path.push(p);
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { c = p; break; }
    }
    for (const q of path) memo.set(q, c);
    return c;
  }
  const D = { clipOf };
  G.DEPTH = D;
  if (typeof module !== 'undefined') module.exports = D;
})(typeof window !== 'undefined' ? window : globalThis);
