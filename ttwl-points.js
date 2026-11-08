/* TTWL Points by difficulty — rank-independent presentation add-on.
 * PC + Legacy only; Mobile excluded (same behavior as original site).
 * New continuous scale: 0.00=100, 1.00=200, ..., 6.00=700.
 * Fractional growth is adapted from the examples supplied for SCLP:
 * 8.00=100, 8.64=200, 8.99=296, 9.00=300.
 * This is a TTWL custom formula, not SCLP's verified internal formula.
 * A newly inserted wallhop NEVER alters existing wallhops' Points.
 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const POINTS_CLASS = 'ttwl-points-cell';
  const DETAIL_ID = 'ttwl-points-detail';
  const POINTS_HEADER = 'ttwl-points-heading';
  const POINTS_COL = 'ttwl-points-col';
  const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const CURVE = Math.log(0.5) / Math.log(0.64); // approximately 1.55314186

  function pointsFor(raw) {
    const value = String(raw ?? '').trim().replace(',', '.');
    if (!/^[0-6](?:\.\d{1,2})?$/.test(value)) return null;
    const difficulty = Number(value);
    if (!Number.isFinite(difficulty) || difficulty < 0 || difficulty >= 7) return null;
    const whole = Math.floor(difficulty);
    // Compute the fractional part in hundredths to avoid floating-point artifacts.
    const hundredths = Math.round(difficulty * 100) - whole * 100;
    const fraction = hundredths / 100;
    return 100 + whole * 100 + (hundredths === 0 ? 0 : Math.max(1, Math.floor(100 * (fraction ** CURVE) + 1e-9)));
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
    if (heading) heading.textContent = 'Points';
    if (headingRow && !heading) {
      const th = document.createElement('th');
      th.id = POINTS_HEADER;
      th.scope = 'col';
      th.textContent = 'Points';
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
        if (tr.cells.length === 1) {
          tr.cells[0].colSpan = document.querySelector('.rankings-table thead tr')?.cells.length || 10;
        }
        continue;
      }
      const difficulty = tr.querySelector('.difficulty-score');
      const thirdCell = tr.cells[2];
      if (!difficulty || !thirdCell) {
        if (tr.cells.length === 1) {
          tr.cells[0].colSpan = document.querySelector('.rankings-table thead tr')?.cells.length || 10;
        }
        continue;
      }
      if (!pointsCell) {
        pointsCell = document.createElement('td');
        pointsCell.className = POINTS_CLASS;
        thirdCell.after(pointsCell);
      }
      const newValue = pointsText(difficulty.textContent);
      if (pointsCell.textContent !== newValue) pointsCell.textContent = newValue;
      pointsCell.title = 'Points based on difficulty';
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
      dt.textContent = 'Points';
      const dd = document.createElement('dd');
      dd.id = 'ttwl-detail-points-value';
      line.append(dt, dd);
      const tierLine = tier.closest('.detail-line');
      if (tierLine) tierLine.after(line);
      else difficulty.closest('.detail-line')?.after(line);
    }
    const detailLabel = line.querySelector('dt');
    if (detailLabel) detailLabel.textContent = 'Points';
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
  window.TTWLPoints = Object.freeze({ calculate: pointsFor });
})();
