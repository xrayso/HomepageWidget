(() => {
  const script   = document.currentScript;
  const apiBase  = (script.dataset.apiBase || '').replace(/\/$/, '');
  const lang     = (script.dataset.lang  || 'en').toLowerCase();
  const themeOpt = (script.dataset.theme || 'auto').toLowerCase();
  const refreshMs = 30 * 60 * 1000;   // 30 min

  // Intl strings
  const i18n = {
    en: {
      nationalDebt: 'National Debt',
      interest:      'Interest on Debt',
      deficit:       'Budgetary Deficit',
      procurement:   'Procurement Spend',
      payroll:       'Federal Payroll',
      billions: 'B',
      millions: 'M',
      asOf: 'as of'
    },
    fr: {
      nationalDebt: 'Dette nationale',
      interest:      'Intérêts de la dette',
      deficit:       'Déficit budgétaire',
      procurement:   'Dépenses d\u2019approvisionnement',
      payroll:       'Rémunération fédérale',
      billions: ' G$',
      millions: ' M$',
      asOf: 'au'
    }
  };

  // Order the metrics appear in the badge
  const metricOrder = ['deficit', 'payroll', 'nationalDebt', 'interest', 'procurement'];

  const endpointMap = {
    nationalDebt:  'national-debt',
    interest:      'interest',
    deficit:       'deficit',
    procurement:   'procurement',
    payroll:       'payroll'
  };

  // Fallback hard‑coded values (update occasionally)
  const fallbackData = {
    nationalDebt: { value: 1_287_000_000_000, asOf: '2025-Q1' },
    interest:     { value: 34_000_000_000,    asOf: '2025-03-31' },
    deficit:      { value: -23_000_000_000,   asOf: '2025-03-01' },
    procurement:  { value: 4_700_000_000,     asOf: '2025-05-01' },
    payroll:      { value: 12_000_000_000,    asOf: '2025-03-31' }
  };

  // Format currency compact (B / M)
  function fmt(val) {
    if (Math.abs(val) >= 1e9)
      return (val / 1e9).toFixed(1) + i18n[lang].billions;
    return (val / 1e6).toFixed(0) + i18n[lang].millions;
  }

  async function fetchMetric(key) {
    const ep  = endpointMap[key];
    const url = apiBase ? `${apiBase}/${ep}` : `/${ep}`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const json = await res.json();
      return json;
    } catch (err) {
      console.warn(`[CFB] ${key} api failed → using fallback`, err);
      return fallbackData[key];
    }
  }

  // Build badge once host node is inserted
  function buildBadge(shadow) {
    // Styles
    const style = document.createElement('style');
    style.textContent = `
      :host{all:initial}
      .badge{font-family:system-ui,Arial,sans-serif;display:grid;gap:.5rem;padding:.75rem 1rem;border-radius:.75rem;min-width:260px;max-width:360px;border:1px solid transparent;box-sizing:border-box}
      .metric{display:flex;justify-content:space-between;align-items:baseline}
      .metric-label{font-size:.875rem;opacity:.85}
      .metric-value{font-size:1.25rem;font-weight:600;white-space:nowrap}
      .asof{font-size:.75rem;opacity:.75;text-align:right}
      .light{background:#fff;color:#000;border-color:#d0d7de}
      .dark{background:#002f6c;color:#fff;border-color:#004080}`;
    shadow.appendChild(style);

    // Container
    const box = shadow.appendChild(document.createElement('div'));
    box.className = 'badge';

    // Theme handling
    const applyTheme = th => {
      box.classList.remove('light','dark');
      box.classList.add(th);
    };
    if (themeOpt === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mq.matches ? 'dark' : 'light');
      mq.addEventListener('change', e => applyTheme(e.matches ? 'dark' : 'light'));
    } else {
      applyTheme(themeOpt);
    }

    // Placeholders for metrics
    const els = {};
    metricOrder.forEach(k => {
      const row = document.createElement('div');
      row.className = 'metric';
      row.innerHTML = `<span class="metric-label">${i18n[lang][k]}</span><span class="metric-value" id="${k}">…</span>`;
      box.appendChild(row);
      els[k] = row.querySelector('#'+k);
    });

    // As‑of element
    const asofEl = document.createElement('div');
    asofEl.className = 'asof';
    box.appendChild(asofEl);

    // Fetch + render loop
    async function refresh() {
      const results = await Promise.all(metricOrder.map(fetchMetric));
      let newest = '1900-01-01';
      metricOrder.forEach((k,i) => {
        const { value, asOf } = results[i] || fallbackData[k];
        els[k].textContent = fmt(value);
        if (asOf && asOf > newest) newest = asOf;
      });
      asofEl.textContent = `${i18n[lang].asOf} ${newest}`;
    }
    refresh();
    setInterval(refresh, refreshMs);
  }

  // Inject host & shadow
  function init() {
    const host = document.createElement('div');
    script.parentNode.insertBefore(host, script.nextSibling);
    const shadow = host.attachShadow({ mode: 'open' });
    buildBadge(shadow);
  }
  (document.readyState === 'loading') ? document.addEventListener('DOMContentLoaded', init)
                                       : init();
})();
