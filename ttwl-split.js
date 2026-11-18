/* Optional split layout. Names-only list on the left, full details on the right.
   YouTube thumbnails fade diagonally from the top-right corner. */
(() => {
 'use strict';
 const $ = s => document.querySelector(s);
 function videoId(raw){
   if(!raw)return '';
   try {
     const u=new URL(raw,location.href),host=u.hostname.toLowerCase().replace(/^www\./,'');
     let id='';
     if(host==='youtu.be')id=u.pathname.split('/').filter(Boolean)[0]||'';
     else if(host==='youtube.com'||host==='m.youtube.com'||host==='youtube-nocookie.com'){
       if(u.pathname==='/watch')id=u.searchParams.get('v')||'';
       else id=u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/)?.[1]||'';
     }
     return /^[\w-]{11}$/.test(id)?id:'';
   } catch(_) {return '';}
 }
 function installFilters(){
   const toolbar=$('.rankings-column .toolbar');
   if(!toolbar || $('.ttwl-split-filters'))return;
   const extra=[...toolbar.children].filter(e=>!e.classList.contains('toolbar-search'));
   if(!extra.length)return;
   const details=document.createElement('details');details.className='ttwl-split-filters';
   const summary=document.createElement('summary');summary.textContent='Filters';
   const panel=document.createElement('div');panel.className='ttwl-split-filter-panel';
   extra.forEach(el=>panel.append(el));details.append(summary,panel);toolbar.append(details);
 }
 // Compact Rank + Player table: keep all original leaderboard columns in the
 // DOM so switching back to the standard table does not lose information.
 function refineLeaderboard(){
   const table=$('.leaderboard-table');
   if(!table)return;
   const rankHeading=table.querySelector('thead th:first-child');
   if(rankHeading && rankHeading.textContent.trim()==='#') rankHeading.textContent='Rank';
   // A <colgroup> tells fixed-table layout to reserve only 90px for Rank.
   // Hidden metrics still exist in the original rows and detail panel.
   if(!table.querySelector('colgroup')){
     const group=document.createElement('colgroup');
     for(let i=0;i<5;i++)group.append(document.createElement('col'));
     table.insertBefore(group,table.firstChild);
   }
 }
 function installVideoHero(){
   const panel=$('#detailPanel'),link=$('#detailVideo');if(!panel||!link)return;
   let hero=panel.querySelector('.ttwl-video-hero');
   if(!hero){hero=document.createElement('div');hero.className='ttwl-video-hero';hero.setAttribute('aria-hidden','true');panel.prepend(hero);}
   function update(){
     const id=videoId(link.getAttribute('href'));
     hero.style.display=id?'block':'none';
     if(id)hero.style.backgroundImage=`url("https://i.ytimg.com/vi/${id}/hqdefault.jpg")`;
     else hero.style.backgroundImage='none';
   }
   new MutationObserver(update).observe(link,{attributes:true,attributeFilter:['href']});
   update();
 }
 function init(){
   document.body.classList.add('ttwl-split-ui');
   // Use the PC Wallhops panel layout across PC/Mobile/Legacy, Packs and Leaderboard.
   // Keep each page title inside its left list panel (instead of above the grid).
   const intro=$('main.page > .page-intro');
   const ranking=$('.rankings-column');
   if(intro && ranking && !ranking.contains(intro)) ranking.prepend(intro);
   installFilters();refineLeaderboard();installVideoHero();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
