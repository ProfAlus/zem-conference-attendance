// ============================================================
// MODAL — generic modal + confirmation dialog
// ============================================================

/**
 * Open a modal with custom HTML body.
 * @param {string} title
 * @param {string} bodyHtml
 * @param {{label:string, className:string, onClick:Function}[]} actions
 * @returns {HTMLElement} the backdrop element (call .remove() to close)
 */
export function openModal(title, bodyHtml, actions = []) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer"></div>
    </div>
  `;
  const footer = backdrop.querySelector('.modal-footer');
  actions.forEach((a) => {
    const btn = document.createElement('button');
    btn.className = `btn ${a.className || 'btn-outline'}`;
    btn.textContent = a.label;
    btn.addEventListener('click', () => a.onClick?.(backdrop));
    footer.appendChild(btn);
  });

  backdrop.querySelector('.modal-close').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') { backdrop.remove(); document.removeEventListener('keydown', escHandler); }
  });

  document.body.appendChild(backdrop);
  return backdrop;
}

/** Convenience: yes/no confirmation dialog. Returns a Promise<boolean>. */
export function confirmDialog(message, { title = 'Please confirm', confirmLabel = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    const backdrop = openModal(title, `<p>${message}</p>`, [
      { label: 'Cancel', className: 'btn-ghost', onClick: (b) => { b.remove(); resolve(false); } },
      { label: confirmLabel, className: danger ? 'btn-danger' : 'btn-primary', onClick: (b) => { b.remove(); resolve(true); } },
    ]);
  });
}
