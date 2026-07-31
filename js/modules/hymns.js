// ============================================================
// MODULE: Hymn Booklet (public, read-only, searchable)
// ============================================================

import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { loadAndApplyBranding } from '../core/theme.js';

const confNameEl = document.getElementById('confName');
let hymns = [];

async function init() {
  try {
    const [hymnData, settings] = await Promise.all([
      apiCall('getHymns'),
      loadAndApplyBranding(),
    ]);
    hymns = hymnData.map((h) => ({ ...h, sections: parseContent(h.content) }));
    if (settings?.conferenceName) confNameEl.textContent = `${settings.conferenceName} — Hymns`;
    render();
  } catch (err) {
    document.getElementById('hymnsList').innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${escapeHtml(err.message)}</p></div>`;
  }
}

/** Parses "[Verse 1]\nline\nline\n[Refrain]\nline" into [{label, lines}]. */
function parseContent(content) {
  const sections = [];
  let current = null;
  (content || '').split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    const match = line.match(/^\[(.+)\]$/);
    if (match) {
      current = { label: match[1], lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    } else {
      current = { label: '', lines: [line] };
      sections.push(current);
    }
  });
  return sections;
}

function matches(hymn, query) {
  if (!query) return true;
  const haystack = [hymn.title, hymn.author, ...hymn.sections.flatMap((s) => s.lines)].join(' ').toLowerCase();
  return haystack.includes(query);
}

function render() {
  const query = document.getElementById('searchBox').value.trim().toLowerCase();
  const listEl = document.getElementById('hymnsList');
  const results = hymns.filter((h) => matches(h, query));

  if (!results.length) {
    listEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><p>${hymns.length ? `No hymns match "${escapeHtml(query)}".` : 'No hymns have been posted yet.'}</p></div>`;
    return;
  }

  listEl.innerHTML = results.map((h) => `
    <div class="card mb-4">
      <h3 style="margin-bottom:2px;">${escapeHtml(h.title)}</h3>
      ${h.author ? `<p class="text-muted" style="font-style:italic; margin-bottom:16px;">Author: ${escapeHtml(h.author)}</p>` : ''}
      ${h.sections.map((s) => `
        <div style="margin-bottom:14px;">
          ${s.label ? `<div style="font-weight:600; color: var(--color-coral); margin-bottom:4px;">${escapeHtml(s.label)}</div>` : ''}
          ${s.lines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
        </div>
      `).join('')}
    </div>
  `).join('');
}

document.getElementById('searchBox').addEventListener('input', render);
init();
