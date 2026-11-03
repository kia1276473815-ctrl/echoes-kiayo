// Korean is the source language. Chinese lives in zh.js: page text matched per slide by the
// start of the Korean text, and short strings used by scripts matched exactly.
import { ZH_PAGE, ZH, ZH_NOTES } from './zh.js';

const INLINE = new Set(['B', 'I', 'EM', 'SPAN', 'KBD', 'BR', 'STRONG', 'SUP', 'SUB', 'A']);
const HANGUL = /[가-힣]/;
const norm = (s) => s.replace(/\s+/g, ' ').trim();
// a span styled as its own label (e.g. the slider's captions) is a block of text in its own right
const inline = (el) => INLINE.has(el.tagName) && !(el.tagName === 'SPAN' && el.matches('.eyebrow, .cap'));

let lang = 'ko';
try { if (localStorage.getItem('echoes-lang') === 'zh') lang = 'zh'; } catch (e) { /* storage blocked */ }
const blocks = [];

export const getLang = () => lang;
export const t = (s) => (lang === 'zh' && s != null && ZH[s] != null ? ZH[s] : s);
export const notesFor = (id, ko) => (lang === 'zh' && ZH_NOTES[id]) || ko;

// every element that holds Korean text of its own (directly, or through inline children)
export function collect(slides) {
  const missing = [];
  slides.forEach((slide) => {
    const page = (ZH_PAGE[slide.dataset.id] || []).slice();
    const all = [slide, ...slide.querySelectorAll('*')];
    all.forEach((el) => {
      if (inline(el) || el.closest('svg') || el.dataset.i18n === 'js') return;
      const own = [...el.childNodes].some((n) => (n.nodeType === 3 && HANGUL.test(n.data)) || (n.nodeType === 1 && inline(n) && HANGUL.test(n.textContent)));
      if (!own) return;
      const key = norm(el.textContent);
      const k = page.findIndex(([pre]) => key.startsWith(norm(pre)));
      const shared = (ZH_PAGE['*'] || []).find(([pre]) => key === norm(pre));   // e.g. the running header
      const zh = k >= 0 ? page.splice(k, 1)[0][1] : shared ? shared[1] : null;
      if (zh == null) missing.push(`${slide.dataset.id}: ${key.slice(0, 40)}`);
      blocks.push({ el, ko: el.innerHTML, zh });
    });
  });
  if (missing.length) console.warn('zh missing', missing);
  return blocks;
}

export function setLang(l) {
  lang = l;
  try { localStorage.setItem('echoes-lang', l); } catch (e) { /* storage blocked */ }
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'ko';
  blocks.forEach((b) => (b.el.innerHTML = l === 'zh' && b.zh != null ? b.zh : b.ko));
  return blocks.map((b) => b.el);
}
