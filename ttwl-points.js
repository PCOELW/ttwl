/* TTWL fixed XP by difficulty — rank-independent presentation add-on.
 * Based on numeric difficulty only, never list position or number of entries.
 * PC + Legacy only, Mobile excluded.
 * Fixed XP at integer difficulties:
 * 0=100, 1=200, 2=300, 3=400, 4=1,000, 5=7,000, 6=50,000.
 * Digits after the decimal add 0..99 XP: e.g. 2.20 -> +20, 2.02 -> +2.
 * Thus 0.01=101, 0.5=150, 2.2=320, 6.5=50,050.
 * This is an original TTWL model inspired by the tier/decimal approach of SCLP,
 * NOT a verified copy of SCLP's private XP rules.
 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const POINTS_CLASS = 'ttwl-points-cell';
  const DETAIL_ID = 'ttwl-points-detail';
  const POINTS_HEADER = 'ttwl-points-heading';
  const POINTS_COL = 'ttwl-points-col';
  const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

  // The integer difficulty sets the XP tier; decimals add fixed 0–99 XP.
  // Keep this table stable as the number of wallhops changes.
  const XP_AT_INTEGER_DIFFICULTY = Object.freeze([
    100,    // 0.0
    200,    // 1.0
    300,    // 2.0
    400,    // 3.0
    1000,   // 4.0
    7000,   // 5.0
    50000   // 6.0
  ]);

  function pointsFor(raw) {
    const text = String(raw ?? '').trim().replace(',', '.');
    // Reject unrated/empty and any ambiguous or out-of-range difficulty.
    if (!/^[0-6](?:\.\d{1,2})?$/.test(text)) return null;
    const difficulty = Number(text);
    if (!Number.isFinite(difficulty) || difficulty < 0 || difficulty >= 7) return null;
    const tier = Math.floor(difficulty);
    // Decimal digits determine the tens/ones exactly; 2.20 -> +20.
    const fractionalXP = Math.round((difficulty - tier) * 100);
    return XP_AT_INTEGER_DIFFICULTY[tier] + fractionalXP;
  }

  function platform() {
    const active = document.querySelector('.main-nav [data-platform].is-active');
    if (active && ['pc', 'mobile', 'legacy'].includes(active.dataset.platform)) {
      return active.dataset.platform;
    }
    const hash = window.location.hash.slice(1).toLowerCase();
    return ['pc', 'mobile', 'legacy'].includes(hash) ? hash : 'pc';
  }

  function pointsText(difficulty) {
    const result = pointsFor(difficulty);
    return result === null ? '—' : format.format(result);
  }

  function setTableColumn(show) {
    const table = document.querySelector('.rankings-table');
    if (!table) return;
    const headingRow = table.tHead?.rows?.[0];
    const colgroup = table.querySelector('colgroup');
    const heading = $(POINTS_HEADER);
    const column = table.querySelector('.' + POINTS_COL);
    if (!show) {
      heading?.remove();
      column?.remove();
      return;
    }
    if (headingRow && !heading) {
      const th = document.createElement('th');
      th.id = POINTS_HEADER;
      th.scope = 'col';
      th.textContent = 'XP';
      // After "Difficulty / Tier", before "Verifier(s)".
      headingRow.cells[2]?.after(th);
    }
    if (colgroup && !column) {
      const col = document.createElement('col');
      col.className = POINTS_COL;
      colgroup.children[2]?.after(col);
    }
  }

  function setRowPoints(show) {
    const tbody = $('rankingRows');
    if (!tbody) return;
    for (const tr of tbody.rows) {
      let pointsCell = tr.querySelector('.' + POINTS_CLASS);
      if (!show) {
        pointsCell?.remove();
        continue;
      }
      const difficulty = tr.querySelector('.difficulty-score');
      const thirdCell = tr.cells[2];
      if (!difficulty || !thirdCell) {
        // Loading / no results row uses a single colspan cell.
        if (tr.cells.length === 1 && tr.cells[0].colSpan !== 11) tr.cells[0].colSpan = 11;
        continue;
      }
      if (!pointsCell) {
        pointsCell = document.createElement('td');
        pointsCell.className = POINTS_CLASS;
        thirdCell.after(pointsCell);
      }
      const newValue = pointsText(difficulty.textContent);
      if (pointsCell.textContent !== newValue) pointsCell.textContent = newValue;
      pointsCell.title = 'Fixed XP based on difficulty';
    }
  }

  function setDetailPoints(show) {
    let line = $(DETAIL_ID);
    if (!show) {
      line?.remove();
      return;
    }
    const difficulty = $('detailDifficulty');
    const tier = $('detailTier');
    if (!difficulty || !tier) return;
    if (!line) {
      line = document.createElement('div');
      line.id = DETAIL_ID;
      line.className = 'detail-line';
      const dt = document.createElement('dt');
      dt.textContent = 'XP';
      const dd = document.createElement('dd');
      dd.id = 'ttwl-detail-points-value';
      line.append(dt, dd);
      const tierLine = tier.closest('.detail-line');
      if (tierLine) tierLine.after(line);
      else difficulty.closest('.detail-line')?.after(line);
    }
    const value = pointsText(difficulty.textContent);
    const label = $('ttwl-detail-points-value');
    if (label && label.textContent !== value) label.textContent = value;
  }

  let scheduled = false;
  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      const show = platform() !== 'mobile';
      setTableColumn(show);
      setRowPoints(show);
      setDetailPoints(show);
      document.title = 'TTWL';
    });
  }

  function init() {
    document.title = 'TTWL';
    const tbody = $('rankingRows');
    if (tbody) new MutationObserver(scheduleUpdate).observe(tbody, { childList: true });
    const difficulty = $('detailDifficulty');
    if (difficulty) new MutationObserver(scheduleUpdate).observe(difficulty, {
      childList: true, characterData: true, subtree: true
    });
    const detailTitle = $('detailTitle');
    if (detailTitle) new MutationObserver(scheduleUpdate).observe(detailTitle, {
      childList: true, characterData: true, subtree: true
    });
    window.addEventListener('hashchange', scheduleUpdate);
    document.querySelectorAll('[data-platform]').forEach(button => {
      button.addEventListener('click', scheduleUpdate);
    });
    scheduleUpdate();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  // Useful for quick console verification; does not modify the rankings data.
  window.TTWLPoints = Object.freeze({ calculate: pointsFor });
})();
