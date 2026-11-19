/* TTWL: link verifier / creator credits to the proper player profile tabs.
   Uses the existing detail nodes (re-rendered by app.js), without editing app.js. */
(() => {
  'use strict';
  const allowed = /^[A-Za-z0-9_]{3,20}$/;
  const ignored = new Set(['unknown','none','uncredited','anonymous','tbd']);
  function parts(value) {
    return String(value).split(/(\s*(?:[,;，；]|\s+\/\s+|\s+\|\s+|\s+&\s+|\s+\+\s+|\s+(?:and|or)\s+)\s*)/gi);
  }
  function linkCredits(target, tab) {
    if (!target) return;
    const value = target.textContent.trim();
    const already = target.querySelector('.ttwl-credit-link');
    if (already && already.closest('#'+target.id) && target.dataset.linkedValue === value) return;
    if (!value || value === '—') return;
    const fragment = document.createDocumentFragment();
    let linked = false;
    for (const segment of parts(value)) {
      const word = segment.trim();
      if (allowed.test(word) && !ignored.has(word.toLowerCase())) {
        const url = new URL('./leaderboard.html',location.href);
        url.searchParams.set('player',word);
        url.searchParams.set('tab',tab);
        const anchor=document.createElement('a');
        anchor.className='ttwl-credit-link'; anchor.textContent=word; anchor.href=url.href;
        anchor.title='View '+word+' on the leaderboard';
        fragment.append(anchor);linked=true;
      } else fragment.append(document.createTextNode(segment));
    }
    if (!linked) return;
    target.replaceChildren(fragment);
    target.dataset.linkedValue = target.textContent.trim();
  }
  function attach(id,tab) {
    const target=document.getElementById(id);
    if(!target)return;
    let scheduled=false;
    const schedule=()=>{
      if(scheduled)return;scheduled=true;
      queueMicrotask(()=>{scheduled=false;linkCredits(target,tab);});
    };
    new MutationObserver(schedule).observe(target,{childList:true,subtree:true,characterData:true});
    schedule();
  }
  function init(){attach('detailVerifier','verifications');attach('detailCreator','creations');}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
