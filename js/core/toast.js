// ============================================================
// TOAST — lightweight notification stack
// ============================================================

function ensureStack() {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  return stack;
}

const ICONS = {
  success: 'fa-circle-check',
  error: 'fa-circle-exclamation',
  warning: 'fa-triangle-exclamation',
  info: 'fa-circle-info',
};

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {number} duration ms
 */
export function toast(message, type = 'info', duration = 3500) {
  const stack = ensureStack();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fa-solid ${ICONS[type] || ICONS.info}"></i><span>${message}</span>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.25s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 250);
  }, duration);
}

export const toastSuccess = (msg, d) => toast(msg, 'success', d);
export const toastError = (msg, d) => toast(msg, 'error', d);
export const toastWarning = (msg, d) => toast(msg, 'warning', d);
export const toastInfo = (msg, d) => toast(msg, 'info', d);
