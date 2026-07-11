/**
 * Form draft recovery — paste on [TARGET_SITE] (or bundle into bookmarklet).
 * Saves form values + current stage to localStorage so user can recover after errors.
 *
 * Configure CONFIG below for your [APP] before use.
 *
 * Usage (Console, after pasting this file):
 *   DraftStore.init({ recordId: '[RECORD-ID]' });
 */
(function (global) {
  'use strict';

  // --- Edit on [TARGET_MACHINE] (do not commit site-specific values) ---
  const CONFIG = {
    STORAGE_PREFIX: 'bk-draft:',
    PANEL_ID: 'bk-draft-panel',
    // Add your [DIALOG_SELECTOR] first in the list if needed
    DIALOG_SELECTOR: '[role="dialog"], .modal, .dialog',
    DEFAULT_TTL_DAYS: 30,
  };

  const PREFIX = CONFIG.STORAGE_PREFIX;
  const PANEL_ID = CONFIG.PANEL_ID;
  const DEFAULT_TTL_DAYS = CONFIG.DEFAULT_TTL_DAYS;
  const DAY_MS = 24 * 60 * 60 * 1000;

  function storageKey(recordId) {
    return PREFIX + recordId;
  }

  function ttlMs(days) {
    return (days == null ? DEFAULT_TTL_DAYS : days) * DAY_MS;
  }

  function draftAgeMs(savedAt) {
    if (!savedAt) return Infinity;
    const t = Date.parse(savedAt);
    return Number.isNaN(t) ? Infinity : Date.now() - t;
  }

  function isDraftExpired(savedAt, maxAgeMs) {
    return draftAgeMs(savedAt) > maxAgeMs;
  }

  function parseDraftRaw(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function pruneExpiredDrafts(maxAgeMs) {
    const removed = [];
    const keysToCheck = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) keysToCheck.push(k);
    }

    keysToCheck.forEach(function (key) {
      const draft = parseDraftRaw(localStorage.getItem(key));
      if (!draft || isDraftExpired(draft.savedAt, maxAgeMs)) {
        localStorage.removeItem(key);
        removed.push(key.slice(PREFIX.length));
      }
    });

    return removed;
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function fieldKey(el, root) {
    if (el.name) return el.name;
    if (el.id) return el.id;
    const parts = [];
    let node = el;
    while (node && node !== root) {
      const tag = node.tagName ? node.tagName.toLowerCase() : '';
      const idx = node.parentElement
        ? Array.from(node.parentElement.children).indexOf(node)
        : 0;
      parts.unshift(tag + '[' + idx + ']');
      node = node.parentElement;
    }
    return parts.join('/');
  }

  function collectFields(root) {
    root = root || document;
    const fields = $$('input, select, textarea', root).filter(function (el) {
      if (el.disabled || el.type === 'password' || el.type === 'file') return false;
      if (el.type === 'hidden' && !el.name && !el.id) return false;
      return true;
    });

    const out = {};
    fields.forEach(function (el) {
      const key = fieldKey(el, root);
      if (el.type === 'checkbox') {
        out[key] = { type: 'checkbox', value: el.checked };
      } else if (el.type === 'radio') {
        if (el.checked) out[key] = { type: 'radio', value: el.value };
      } else {
        out[key] = { type: el.tagName.toLowerCase(), value: el.value };
      }
    });
    return out;
  }

  function restoreFields(data, root) {
    root = root || document;
    if (!data || !data.fields) return { restored: 0, missing: 0 };

    let restored = 0;
    let missing = 0;

    Object.keys(data.fields).forEach(function (key) {
      const spec = data.fields[key];
      let el =
        (spec.name && root.querySelector('[name="' + CSS.escape(spec.name) + '"]')) ||
        (spec.id && root.querySelector('#' + CSS.escape(spec.id))) ||
        null;

      if (!el) {
        const candidates = $$('input, select, textarea', root);
        el = candidates.find(function (node) {
          return fieldKey(node, root) === key;
        });
      }

      if (!el) {
        missing++;
        return;
      }

      if (spec.type === 'checkbox') {
        el.checked = !!spec.value;
      } else if (spec.type === 'radio') {
        const group = root.querySelectorAll('[name="' + CSS.escape(el.name) + '"]');
        group.forEach(function (r) {
          r.checked = r.value === spec.value;
        });
      } else {
        el.value = spec.value == null ? '' : String(spec.value);
      }

      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      restored++;
    });

    return { restored, missing };
  }

  function readDraft(recordId, maxAgeMs) {
    const key = storageKey(recordId);
    try {
      const raw = localStorage.getItem(key);
      const draft = parseDraftRaw(raw);
      if (!draft) return null;

      if (isDraftExpired(draft.savedAt, maxAgeMs)) {
        localStorage.removeItem(key);
        return null;
      }

      return draft;
    } catch (e) {
      console.warn('[DraftStore] read failed', e);
      return null;
    }
  }

  function writeDraft(recordId, payload) {
    payload.expiresAt = new Date(Date.now() + payload.ttlMs).toISOString();
    localStorage.setItem(storageKey(recordId), JSON.stringify(payload));
  }

  function detectStage() {
    const dialog = $(CONFIG.DIALOG_SELECTOR);
    if (dialog) {
      const title =
        $('.dialog-title, .modal-title, h1, h2', dialog) ||
        $('[class*="title"]', dialog);
      if (title && title.textContent.trim()) return title.textContent.trim();
    }
    const step =
      $('[class*="step"][class*="active"], .wizard-step.active, .step-active') ||
      $('[aria-current="step"]');
    if (step && step.textContent.trim()) return step.textContent.trim();
    return location.hash || location.pathname;
  }

  function buildPanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.style.cssText =
      'position:fixed;bottom:12px;right:12px;z-index:2147483647;' +
      'font:13px/1.4 system-ui,sans-serif;background:#1a1a1a;color:#eee;' +
      'border:1px solid #444;border-radius:10px;padding:10px 12px;min-width:260px;' +
      'box-shadow:0 8px 24px rgba(0,0,0,.45);';

    panel.innerHTML =
      '<div style="font-weight:600;margin-bottom:8px">Draft recovery</div>' +
      '<label style="display:block;margin-bottom:6px">[RECORD] ID<br>' +
      '<input id="bk-draft-record-id" style="width:100%;box-sizing:border-box;margin-top:2px;padding:4px 6px" placeholder="[RECORD-ID]"></label>' +
      '<label style="display:block;margin-bottom:6px">Stage (optional)<br>' +
      '<input id="bk-draft-stage" style="width:100%;box-sizing:border-box;margin-top:2px;padding:4px 6px" placeholder="auto-detected"></label>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' +
      '<button type="button" id="bk-draft-save" style="cursor:pointer;padding:4px 8px">Save now</button>' +
      '<button type="button" id="bk-draft-restore" style="cursor:pointer;padding:4px 8px">Restore</button>' +
      '<button type="button" id="bk-draft-clear" style="cursor:pointer;padding:4px 8px">Clear</button>' +
      '</div>' +
      '<div id="bk-draft-status" style="margin-top:8px;font-size:12px;color:#9f9"></div>';

    document.body.appendChild(panel);
    return panel;
  }

  function setStatus(msg, isError) {
    const el = document.getElementById('bk-draft-status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? '#f88' : '#9f9';
  }

  const DraftStore = {
    _recordId: null,
    _scope: null,
    _autoTimer: null,
    _pruneTimer: null,
    _autoMs: 0,
    _ttlMs: ttlMs(DEFAULT_TTL_DAYS),

    init: function (opts) {
      opts = opts || {};
      this._scope = opts.scope ? $(opts.scope) : null;
      this._autoMs = opts.autoSaveMs || 15000;
      this._ttlMs = ttlMs(opts.ttlDays != null ? opts.ttlDays : DEFAULT_TTL_DAYS);

      const pruned = this.pruneExpired();
      if (pruned.length) {
        console.log('[DraftStore] pruned expired drafts:', pruned);
      }

      buildPanel();

      const idInput = document.getElementById('bk-draft-record-id');
      const stageInput = document.getElementById('bk-draft-stage');

      if (opts.recordId) {
        idInput.value = opts.recordId;
        this._recordId = opts.recordId;
      }

      const self = this;

      document.getElementById('bk-draft-save').onclick = function () {
        self.save();
      };
      document.getElementById('bk-draft-restore').onclick = function () {
        self.restore();
      };
      document.getElementById('bk-draft-clear').onclick = function () {
        self.clear();
      };

      idInput.addEventListener('change', function () {
        self._recordId = idInput.value.trim() || null;
      });

      if (opts.autoRestore) {
        setTimeout(function () {
          if (idInput.value.trim() && readDraft(idInput.value.trim(), self._ttlMs)) {
            self.restore();
          }
        }, opts.restoreDelayMs || 800);
      }

      if (this._autoMs > 0) {
        this._autoTimer = setInterval(function () {
          if (self._recordId || idInput.value.trim()) {
            stageInput.value = stageInput.value.trim() || detectStage();
            self.save({ silent: true });
          }
        }, this._autoMs);
      }

      this._pruneTimer = setInterval(function () {
        self.pruneExpired();
      }, DAY_MS);

      const ttlDays = Math.round(this._ttlMs / DAY_MS);
      const pruneNote = pruned.length ? ' Removed ' + pruned.length + ' expired.' : '';
      setStatus(
        'Ready. Auto-save every ' +
          this._autoMs / 1000 +
          's. Drafts expire after ' +
          ttlDays +
          'd.' +
          pruneNote
      );
      return this;
    },

    pruneExpired: function () {
      return pruneExpiredDrafts(this._ttlMs);
    },

    save: function (opts) {
      opts = opts || {};
      const idInput = document.getElementById('bk-draft-record-id');
      const stageInput = document.getElementById('bk-draft-stage');
      const recordId = (idInput && idInput.value.trim()) || this._recordId;

      if (!recordId) {
        setStatus('Set [RECORD] ID first.', true);
        return null;
      }

      this._recordId = recordId;
      const root = this._scope || document;
      const stage = (stageInput && stageInput.value.trim()) || detectStage();
      if (stageInput && !stageInput.value.trim()) stageInput.value = stage;

      const fields = collectFields(root);
      const payload = {
        recordId: recordId,
        stage: stage,
        url: location.href,
        savedAt: new Date().toISOString(),
        ttlMs: this._ttlMs,
        fields: fields,
      };

      this.pruneExpired();
      writeDraft(recordId, payload);
      if (!opts.silent) {
        setStatus(
          'Saved ' + Object.keys(fields).length + ' fields @ ' + payload.savedAt.slice(11, 19)
        );
      }
      return payload;
    },

    restore: function () {
      const idInput = document.getElementById('bk-draft-record-id');
      const stageInput = document.getElementById('bk-draft-stage');
      const recordId = (idInput && idInput.value.trim()) || this._recordId;

      if (!recordId) {
        setStatus('Set [RECORD] ID first.', true);
        return null;
      }

      const draft = readDraft(recordId, this._ttlMs);
      if (!draft) {
        setStatus(
          'No draft for "' +
            recordId +
            '" (or expired after ' +
            Math.round(this._ttlMs / DAY_MS) +
            'd).',
          true
        );
        return null;
      }

      if (stageInput) stageInput.value = draft.stage || '';

      const root = this._scope || document;
      const result = restoreFields(draft, root);

      setStatus(
        'Restored ' +
          result.restored +
          ' fields (stage: ' +
          (draft.stage || '?') +
          '). Missing: ' +
          result.missing +
          '.'
      );
      return draft;
    },

    clear: function () {
      const idInput = document.getElementById('bk-draft-record-id');
      const recordId = (idInput && idInput.value.trim()) || this._recordId;
      if (!recordId) {
        setStatus('Set [RECORD] ID first.', true);
        return;
      }
      localStorage.removeItem(storageKey(recordId));
      setStatus('Cleared draft for "' + recordId + '".');
    },

    listDrafts: function () {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || k.indexOf(PREFIX) !== 0) continue;
        const draft = parseDraftRaw(localStorage.getItem(k));
        const recordId = k.slice(PREFIX.length);
        const ageDays = draft ? Math.floor(draftAgeMs(draft.savedAt) / DAY_MS) : null;
        out.push({
          recordId: recordId,
          savedAt: draft && draft.savedAt,
          ageDays: ageDays,
          expired: draft ? isDraftExpired(draft.savedAt, this._ttlMs) : true,
        });
      }
      return out;
    },

    destroy: function () {
      if (this._autoTimer) clearInterval(this._autoTimer);
      if (this._pruneTimer) clearInterval(this._pruneTimer);
      const panel = document.getElementById(PANEL_ID);
      if (panel) panel.remove();
    },
  };

  global.DraftStore = DraftStore;
})(typeof window !== 'undefined' ? window : global);

// --- After paste on [TARGET_SITE]:
// DraftStore.init({ recordId: '[RECORD-ID]', autoRestore: true, ttlDays: 30 });
// DraftStore.listDrafts();
