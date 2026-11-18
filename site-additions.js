/* TTWL site additions: keeps the existing Discord CTA and Rules navigation.
   Loads new features without replacing app.js, leaderboard.js, or styles.css. */
(() => {
  'use strict';
  const base = new URL('./', document.currentScript?.src || location.href);
  function addStyle(name) {
    if (document.querySelector('link[data-ttwl-extra="'+name+'"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = new URL(name, base).href;
    link.dataset.ttwlExtra = name; document.head.appendChild(link);
  }
  function addScript(name) {
    if (document.querySelector('script[data-ttwl-extra="'+name+'"]')) return;
    const script = document.createElement('script');
    script.defer = true; script.src = new URL(name, base).href;
    script.dataset.ttwlExtra = name; document.head.appendChild(script);
  }
  function install() {
    const header = document.querySelector('.site-header-inner');
    if (header && !document.getElementById('discordCta')) {
      const configured = window.WALLHOPS_CONFIG && window.WALLHOPS_CONFIG.discordUrl;
      let invite = '';
      try { const parsed = new URL(String(configured || '').trim()); if (/^https?:$/.test(parsed.protocol)) invite = parsed.href; } catch (_) {}
      const button = document.createElement(invite ? 'a' : 'span');
      button.id = 'discordCta';
      button.className = 'discord-cta' + (invite ? '' : ' is-unconfigured');
      if (invite) { button.href = invite; button.target = '_blank'; button.rel = 'noopener noreferrer'; button.setAttribute('aria-label', 'Join Discord'); }
      else button.title = 'Set discordUrl in config.js';
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.73 5.12a18.9 18.9 0 0 0-4.72-1.47l-.58 1.19a17.9 17.9 0 0 0-4.86 0l-.59-1.19a18.9 18.9 0 0 0-4.71 1.47C1.3 9.48.49 13.74.9 17.94a19.1 19.1 0 0 0 5.78 2.92l1.24-2.02c-.67-.25-1.32-.56-1.94-.92l.47-.36c3.73 1.71 7.93 1.71 11.62 0l.47.36c-.62.36-1.27.67-1.94.92l1.24 2.02a19.1 19.1 0 0 0 5.78-2.92c.49-4.87-.83-9.09-3.89-12.82ZM8.52 15.37c-1.12 0-2.05-1.02-2.05-2.26s.9-2.26 2.05-2.26c1.16 0 2.07 1.02 2.05 2.26 0 1.24-.9 2.26-2.05 2.26Zm6.96 0c-1.12 0-2.05-1.02-2.05-2.26s.9-2.26 2.05-2.26c1.16 0 2.07 1.02 2.05 2.26 0 1.24-.89 2.26-2.05 2.26Z"/></svg><span>Discord</span>';
      header.appendChild(button);
    }
    if (!document.body.classList.contains('rules-page')) {
      document.addEventListener('click', e => {
        if (!e.target.closest('#rulesButton')) return;
        e.preventDefault(); e.stopImmediatePropagation();
        location.assign(new URL('./rules.html', base).href);
      }, true);
    }
    addStyle('ttwl-updates.css');
    addScript('ttwl-updates.js');
    addStyle('ttwl-split.css');
    addScript('ttwl-split.js');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
