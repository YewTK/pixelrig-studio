'use strict';
// Tiny DOM helpers for building the side panel.
PR.ui = {
  el(tag, attrs = {}, kids = []) {
    const e = document.createElement(tag);
    for (const k in attrs) {
      const v = attrs[k];
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(kids)) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
    return e;
  },
  card(title, kids) { return PR.ui.el('div', { class: 'card' }, [PR.ui.el('h3', { text: title }), ...[].concat(kids)]); },
  row(label, ctl) { return PR.ui.el('div', { class: 'row' }, [PR.ui.el('label', { text: label }), ctl]); },
  select(opts, value, onChange) {
    // opts: [[value, label]] or [{group, items:[[v,l]]}]
    const s = PR.ui.el('select', { onchange: () => onChange(s.value) });
    const add = (parent, [v, l]) => parent.append(PR.ui.el('option', { value: v, text: l, selected: String(v) === String(value) }));
    for (const o of opts) {
      if (o.group) { const g = PR.ui.el('optgroup', { label: o.group }); o.items.forEach((it) => add(g, it)); s.append(g); }
      else add(s, o);
    }
    return s;
  },
  range(min, max, step, value, onInput, fmt = (v) => v) {
    const val = PR.ui.el('span', { class: 'val', text: fmt(value) });
    const r = PR.ui.el('input', { type: 'range', min, max, step, value, oninput: () => { val.textContent = fmt(+r.value); onInput(+r.value); } });
    const wrap = PR.ui.el('div', { class: 'rv' }, [r, val]);
    wrap.input = r; wrap.set = (v) => { r.value = v; val.textContent = fmt(v); };
    return wrap;
  },
  button(label, onClick, cls = '') { return PR.ui.el('button', { class: 'btn ' + cls, onclick: onClick, type: 'button' }, label); },
  toast(msg, ms = 1800) {
    const t = PR.ui.el('div', { class: 'toast', text: msg });
    document.body.append(t);
    setTimeout(() => t.remove(), ms);
  },
  download(blob, name) {
    const a = PR.ui.el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  },
  async copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = PR.ui.el('textarea', {}, text); document.body.append(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (_) { /* ignore */ }
      ta.remove(); return ok;
    }
  },
  store: {
    get(k, def) { try { const v = localStorage.getItem('pixelrig.' + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem('pixelrig.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  },
};
