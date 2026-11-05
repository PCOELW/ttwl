/**
 * TTWL Victor Discord bridge — ORIGINAL Google Sheet.
 * Spreadsheet ID and tab names are intentionally fixed to prevent accidental edits.
 * Reads wallhop names from column B, edits only NOTES attached to column M.
 * Does not edit cell values, formulas, colors, any mobile tab, or TTWL website.
 */
const TTWL_SHEET_ID = '1IL_rmiXINST07Hb04RX3qpfQ2pM98FBqnxWwN4Xt7o0';
const TTWL_TABS = Object.freeze({
  pc: 'Top PC Wallhops',
  legacy: 'Legacy List (PC)',
});
const FIRST_WALLHOP_ROW = 3;
const TITLE_COLUMN = 2; // B
const VICTORS_NOTE_COLUMN = 13; // M
const SECRET_PROPERTY = 'TTWL_BOT_SECRET';
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return reply_({ok: true, service: 'TTWL Victor Bot', message: 'Discord commands: /victor add, remove, list'});
}

/** Run this once in the Apps Script editor to grant read/write authorization. */
function authorizeConnection() {
  const ss = SpreadsheetApp.openById(TTWL_SHEET_ID);
  const names = ss.getSheets().map(s => s.getName());
  Logger.log('Connected original spreadsheet. Tabs: ' + names.join(' | '));
  for (const tabName of Object.values(TTWL_TABS)) {
    if (names.indexOf(tabName) === -1) {
      throw new Error('Missing tab: ' + tabName + '. Actual tabs: ' + names.join(' | '));
    }
  }
  return 'Connected to ORIGINAL TTWL. PC and Legacy tabs found.';
}

function normalizeTitle_(s) {
  return String(s || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function parseVictors_(note) {
  const words = String(note || '').trim().split(/\s+/).filter(Boolean);
  const invalid = words.find(word => !USERNAME_RE.test(word));
  if (invalid) {
    throw new Error('M-column note contains non-username text. No changes made. Inspect the note manually.');
  }
  return words;
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (_) {
    return reply_({ok: false, error: 'Invalid request JSON'});
  }

  // Never disclose the shared secret or return it to the caller.
  const savedSecret = PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY);
  if (!savedSecret || savedSecret.length < 24 || typeof body.secret !== 'string' || body.secret !== savedSecret) {
    return reply_({ok: false, error: 'Authentication failed'});
  }

  const action = String(body.action || '').trim().toLowerCase();
  const section = String(body.section || '').trim().toLowerCase();
  const wallhop = String(body.wallhop || '').trim();
  const username = String(body.username || '').trim();

  if (!['add', 'remove', 'list'].includes(action)) return reply_({ok: false, error: 'Invalid action'});
  if (!Object.prototype.hasOwnProperty.call(TTWL_TABS, section)) return reply_({ok: false, error: 'Choose PC or Legacy'});
  if (!wallhop || wallhop.length > 180) return reply_({ok: false, error: 'Enter a valid wallhop name (up to 180 characters)'});
  if (action !== 'list' && !USERNAME_RE.test(username)) return reply_({ok: false, error: 'Roblox username must be 3-20 letters, digits or underscores'});

  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    lock.waitLock(20000);
    locked = true;
    const ss = SpreadsheetApp.openById(TTWL_SHEET_ID);
    const tab = ss.getSheetByName(TTWL_TABS[section]);
    if (!tab) return reply_({ok: false, error: 'Sheet tab missing: ' + TTWL_TABS[section]});
    const lastRow = tab.getLastRow();
    if (lastRow < FIRST_WALLHOP_ROW) return reply_({ok: false, error: 'No wallhops in that tab'});

    // Only read B (wallhop name); rank in A is never used as the key.
    const titles = tab.getRange(FIRST_WALLHOP_ROW, TITLE_COLUMN, lastRow - FIRST_WALLHOP_ROW + 1, 1)
      .getDisplayValues();
    const wanted = normalizeTitle_(wallhop);
    const matches = [];
    for (let i = 0; i < titles.length; i++) {
      if (normalizeTitle_(titles[i][0]) === wanted) matches.push(FIRST_WALLHOP_ROW + i);
    }
    if (!matches.length) return reply_({ok: false, error: 'Wallhop not found in ' + TTWL_TABS[section]});
    if (matches.length > 1) return reply_({ok: false, error: 'Multiple identical wallhop titles at rows ' + matches.join(', ') + '. No changes made.'});

    const row = matches[0];
    const noteCell = tab.getRange(row, VICTORS_NOTE_COLUMN);
    const originalNote = noteCell.getNote() || '';
    const existing = parseVictors_(originalNote);
    const exactTitle = String(titles[row - FIRST_WALLHOP_ROW][0]).trim();
    const base = {section, sheet: TTWL_TABS[section], wallhop: exactTitle, row};

    if (action === 'list') {
      return reply_(Object.assign({ok: true, status: 'listed', count: existing.length, victors: existing}, base));
    }

    const lower = username.toLowerCase();
    const found = existing.some(name => name.toLowerCase() === lower);
    if (action === 'add' && found) {
      return reply_(Object.assign({ok: true, status: 'exists', count: existing.length, username}, base));
    }
    if (action === 'remove' && !found) {
      return reply_(Object.assign({ok: true, status: 'missing', count: existing.length, username}, base));
    }

    const updated = (action === 'add')
      ? existing.concat(username)
      : existing.filter(name => name.toLowerCase() !== lower);
    // Only touch a NOTE on column M. Never setValue(), clear(), or edit another column.
    noteCell.setNote(updated.join(' '));
    SpreadsheetApp.flush();
    return reply_(Object.assign({ok: true, status: action === 'add' ? 'added' : 'removed', count: updated.length, username}, base));
  } catch (err) {
    return reply_({ok: false, error: 'Google Sheets operation failed: ' + String((err && err.message) || err)});
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (_) {} }
  }
}
