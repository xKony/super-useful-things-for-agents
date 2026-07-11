// Paste into DevTools Console on https://www.google.com
// Or use bookmarklet.txt as a bookmark URL.

(function () {
  const KEY = 'bookmarklet-test';
  const prev = localStorage.getItem(KEY);
  const now = 'hello-' + Date.now();
  localStorage.setItem(KEY, now);
  const read = localStorage.getItem(KEY);

  const msg = prev
    ? 'localStorage works.\nPrevious: ' + prev + '\nNow: ' + read
    : 'localStorage works.\nFirst run stored: ' + read;

  console.log('[localStorage test]', { key: KEY, previous: prev, stored: read });

  const el = document.createElement('div');
  el.textContent = msg.replace(/\n/g, ' | ');
  el.style.cssText =
    'position:fixed;top:12px;right:12px;z-index:999999;padding:12px 16px;' +
    'background:#111;color:#0f0;font:14px monospace;border-radius:8px;' +
    'max-width:420px;box-shadow:0 4px 12px rgba(0,0,0,.4);';
  document.body.appendChild(el);
  setTimeout(function () {
    el.remove();
  }, 8000);
})();
