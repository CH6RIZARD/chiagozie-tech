// Private copy-edit mode. index.html adds this file only when the URL carries ?edit=1.
// Every text block on the scrolling page becomes editable in place. Edits live in this browser's localStorage
// and nothing here sends them anywhere: "Save for Claude" downloads a file and opens a mail draft he sends himself.
(() => {
  const Q = new URLSearchParams(location.search), TEST = Q.get('selftest') === '1';
  const KEY = TEST ? 'chaze.edits.selftest' : 'chaze.edits', TO = 'daniel4chigs@gmail.com';   // the self-check never touches real edits
  // never editable: media, embedded apps, the store address bar (script-driven), this bar
  const SKIP = 'script,style,svg,iframe,canvas,img,video,input,textarea,select,.url,#editbar';
  const CE = (() => { try { document.createElement('i').contentEditable = 'plaintext-only'; return 'plaintext-only'; } catch { return 'true'; } })();
  const els = new Map();   // element -> its original { key, loc, text, html }
  let edits = {}, editing = true;
  const text = el => el.textContent.replace(/\s+/g, ' ').trim();
  const load = () => { try { edits = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { edits = {}; } };
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(edits)); } catch {} paint(); };
  const apply = () => { for (const [el, o] of els) { const c = edits[o.key]; if (c && el.innerHTML !== c.afterHtml) el.innerHTML = c.afterHtml; } };

  // A text block is the outermost element that directly holds text, so "words <a>link</a> words" is one block.
  const scan = (node, out) => {
    for (const el of node.children) {
      if (el.matches(SKIP)) continue;
      if ([...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim())) out.push(el); else scan(el, out);
    }
  };
  const seen = {};
  const attach = roots => {
    for (const root of roots) {
      const found = []; scan(root, found);
      for (const el of found) {
        if (els.has(el)) continue;
        const sec = el.closest('section[id],footer[id],nav'), where = sec ? (sec.id ? '#' + sec.id : 'nav ' + sec.getAttribute('aria-label')) : 'page';
        const t = text(el), id = where + '|' + el.localName + '|' + t;
        // key: section + tag + original text + which one of those it is. Survives the phone layout moving sections around.
        els.set(el, { key: id + '|' + (seen[id] = (seen[id] || 0) + 1), loc: where + ' ' + el.localName + (el.classList[0] ? '.' + el.classList[0] : ''), text: t, html: el.innerHTML });
      }
    }
    apply(); setMode(editing);
  };
  const setMode = on => { editing = on; for (const el of els.keys()) on ? el.setAttribute('contenteditable', CE) : el.removeAttribute('contenteditable'); paint(); };

  const list = () => Object.values(edits).map((c, i) => `${i + 1}. ${c.loc}\nBEFORE: ${c.before}\nAFTER: ${c.after}`);
  const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return [d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()), p(d.getHours()) + ':' + p(d.getMinutes())]; };
  const mailBody = (all, file) => {
    let body = '', n = 0;
    for (const item of all) { if (body.length + item.length > 1800) break; body += item + '\n\n'; n++; }
    if (!n) { body = all[0].slice(0, 1800) + '… (cut)\n\n'; n = 1; }
    if (n < all.length) body += `${all.length - n} more change${all.length - n === 1 ? '' : 's'} left out (mail length limit). `;
    return `${all.length} change${all.length === 1 ? '' : 's'} on ${location.origin + location.pathname}\n\n${body}Full list: ${file} (downloaded, attach it) or the Copy button.`;
  };
  const send = () => {
    const all = list(), [day, time] = stamp(); if (!all.length) return flash('No changes yet');
    const a = document.createElement('a'); a.download = `portfolio-edits-${day.replace(/-/g, '')}-${time.replace(':', '')}.json`;
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ page: location.origin + location.pathname, saved: new Date().toISOString(), changes: Object.values(edits) }, null, 2)], { type: 'application/json' }));
    document.body.append(a); a.click(); a.remove();
    // after the download has started, so the mail app opening does not cancel it
    setTimeout(() => { location.href = `mailto:${TO}?subject=${encodeURIComponent(`PORTFOLIO EDITS ${day} ${time}`)}&body=${encodeURIComponent(mailBody(all, a.download))}`; }, 400);
  };
  const copy = () => {
    const t = list().join('\n\n') || 'No changes';
    const fb = () => { const x = document.createElement('textarea'); x.value = t; x.style.cssText = 'position:fixed;opacity:0'; document.body.append(x); x.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} x.remove(); flash(ok ? 'Copied' : 'Copy failed'); };
    navigator.clipboard ? navigator.clipboard.writeText(t).then(() => flash('Copied'), fb) : fb();
  };
  const reset = () => { edits = {}; try { localStorage.removeItem(KEY); } catch {} for (const [el, o] of els) if (el.innerHTML !== o.html) el.innerHTML = o.html; paint(); };
  const exit = () => { Q.delete('edit'); Q.delete('selftest'); const s = Q.toString(); location.replace(location.pathname + (s ? '?' + s : '') + location.hash); };

  // ---- the bar ----
  document.head.append(Object.assign(document.createElement('meta'), { name: 'robots', content: 'noindex' }));
  document.head.append(Object.assign(document.createElement('style'), { textContent: `
#editbar{position:fixed;left:0;right:0;bottom:0;z-index:10060;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 12px calc(8px + env(safe-area-inset-bottom));background:var(--paper);border-top:1px solid var(--line);font:500 11px/1 var(--mono);letter-spacing:.04em;text-transform:uppercase;color:var(--ink)}
#editbar span{flex:1 0 auto;padding:4px 0}
#editbar button{font:inherit;letter-spacing:inherit;text-transform:inherit;color:var(--ink);background:none;border:1px solid var(--line);border-radius:2px;padding:9px 9px;cursor:pointer}
#editbar button[data-a=send]{color:var(--accent);border-color:var(--accent)}
[contenteditable]{-webkit-user-select:text;user-select:text;cursor:text}
[contenteditable]:focus{outline:2px solid var(--accent);outline-offset:3px}
.realm .about:focus{-webkit-line-clamp:unset;display:block}
.msheet .panel{padding-bottom:120px}` }));
  const bar = document.createElement('div'); bar.id = 'editbar';
  bar.innerHTML = '<span></span><button type="button" data-a="mode"></button><button type="button" data-a="send">Save for Claude</button><button type="button" data-a="copy">Copy</button><button type="button" data-a="reset">Reset</button><button type="button" data-a="exit">Exit</button>';
  const status = bar.firstChild, btn = a => bar.querySelector(`[data-a=${a}]`);
  let flashT = 0, armed = 0;
  function paint() { const n = Object.keys(edits).length; status.textContent = (editing ? 'Editing' : 'Browsing') + ' · ' + n + (n === 1 ? ' change' : ' changes'); btn('mode').textContent = editing ? 'Browse' : 'Edit'; }
  const flash = msg => { status.textContent = msg; clearTimeout(flashT); flashT = setTimeout(paint, 1600); };
  const disarm = () => { clearTimeout(armed); armed = 0; btn('reset').textContent = 'Reset'; };
  bar.addEventListener('click', e => {
    const a = e.target.dataset.a; if (!a) return;
    if (a === 'reset') { if (armed) { disarm(); reset(); flash('Reset'); } else { btn('reset').textContent = 'Sure? Tap again'; armed = setTimeout(disarm, 4000); } return; }
    disarm();
    ({ mode: () => setMode(!editing), send, copy, exit })[a]();   // Browse: taps work normally (open a project sheet, Read less), then Edit again
  });

  // ---- editing ----
  addEventListener('input', e => {
    const el = e.target, o = els.get(el); if (!o) return;
    if (el.innerHTML === o.html) delete edits[o.key]; else edits[o.key] = { loc: o.loc, before: o.text, after: text(el), beforeHtml: o.html, afterHtml: el.innerHTML };
    store();
  });
  addEventListener('keydown', e => { if (e.key === 'Enter' && els.has(e.target)) { e.preventDefault(); e.target.blur(); } });   // one block stays one block
  // while editing, a tap on a link, button or text places the caret and does nothing else
  addEventListener('click', e => { if (editing && !e.target.closest('#editbar') && e.target.closest('a,button,summary,[contenteditable]')) { e.preventDefault(); e.stopPropagation(); } }, true);

  load(); document.body.append(bar); document.body.style.paddingBottom = bar.offsetHeight + 'px';   // the footer clears the bar
  attach(document.querySelectorAll('nav,section,footer'));

  // ?edit=1&selftest=1: an edit is stored, comes back as it would on reload, is listed, and Reset restores the original.
  if (TEST) {
    const res = [], t = (name, ok) => { res.push(ok); console[ok ? 'log' : 'error']('[edit-mode selftest] ' + (ok ? 'PASS' : 'FAIL') + ' ' + name); };
    reset(); const [el, o] = [...els][0];
    el.textContent = 'SELFTEST EDIT'; el.dispatchEvent(new Event('input', { bubbles: true }));
    const saved = (JSON.parse(localStorage.getItem(KEY)) || {})[o.key];
    t('edit is stored with its original text', !!saved && saved.before === o.text && saved.after === 'SELFTEST EDIT');
    el.innerHTML = o.html; edits = {}; load(); apply();
    t('stored edit is re-applied (reload path)', text(el) === 'SELFTEST EDIT');
    t('change list shows BEFORE/AFTER', list().join('\n').includes('BEFORE: ' + o.text + '\nAFTER: SELFTEST EDIT') && mailBody(list(), 'x.json').includes('AFTER: SELFTEST EDIT'));
    reset();
    t('reset restores the original and clears storage', el.innerHTML === o.html && !localStorage.getItem(KEY) && !list().length);
    console.log('[edit-mode selftest] ' + (res.every(Boolean) ? 'PASS' : 'FAIL') + ' overall ' + res.filter(Boolean).length + '/' + res.length);
  }
})();
