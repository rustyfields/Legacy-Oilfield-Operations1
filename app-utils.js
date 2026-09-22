const $ = (s) => document.querySelector(s);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.add('hidden'), 3500);
}

function statusChip(text) {
  return `<span class="statuschip">${esc(text)}</span>`;
}

function breadcrumb(parts = []) {
  return `<div class="breadcrumb">${parts.map((p, i) =>
    `${i ? '<span class="sep">›</span>' : ''}<span>${esc(p)}</span>`
  ).join('')}</div>`;
}

function contractorName(id) {
  return refs.contractors.find(x => x.id === id)?.name || '';
}

function wellLabel(w) {
  if (!w) return '';
  return w.well_number ? `${w.name || ''} #${w.well_number}` : (w.name || '');
}

async function loadRefs() {
  try {
    const [leases, wells, contractors, tanks, removalTypes, purchasers] = await Promise.all([
      sb.from('leases').select('*').order('name'),
      sb.from('wells').select('*').order('name'),
      sb.from('contractors').select('*').order('name'),
      sb.from('tanks').select('*').order('name'),
      sb.from('tank_removal_material_types').select('*').order('name'),
      sb.from('crude_purchasers').select('*').order('name')
    ]);
    refs.leases = leases.data || [];
    refs.wells = wells.data || [];
    refs.contractors = contractors.data || [];
    refs.tanks = tanks.data || [];
    refs.removalTypes = removalTypes.data || [];
    refs.purchasers = purchasers.data || [];

    await cacheRef('leases', refs.leases);
    await cacheRef('wells', refs.wells);
    await cacheRef('contractors', refs.contractors);
    await cacheRef('tanks', refs.tanks);
  } catch (e) {
    console.warn('loadRefs failed, trying cache', e);
    refs.leases = (await getCachedRef('leases')) || [];
    refs.wells = (await getCachedRef('wells')) || [];
    refs.contractors = (await getCachedRef('contractors')) || [];
    refs.tanks = (await getCachedRef('tanks')) || [];
  }
}

const pages = [
  ['dashboard', 'Dashboard'],
  ['status', 'Daily Operations'],
  ['workovers', 'Workovers'],
  ['incidents', 'Incidents / Spills'],
  ['acid', 'Acid Jobs'],
  ['chemical', 'Chemical Treatments'],
  ['tankgauges', 'Tank Gauges'],
  ['reports', 'Reports'],
  ['equipment', 'Equipment'],
  ['wells', 'Well Master'],
  ['contractors', 'Contractors'],
  ['admin', 'Users / Access']
];

function renderNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  nav.innerHTML = pages.map(([id, label]) =>
    `<button class="${current === id ? 'active' : ''}" data-page="${id}">${esc(label)}</button>`
  ).join('');
  nav.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => go(btn.dataset.page);
  });
}

async function go(page) {
  current = page || 'dashboard';
  const title = pages.find(p => p[0] === current)?.[1] || 'Dashboard';
  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) pageTitle.textContent = title;
  renderNav();

  const content = document.getElementById('content');
  if (!content) return;

  content.innerHTML = '<div class="empty">Loading…</div>';

  try {
    if (typeof window['render_' + current] === 'function') {
      await window['render_' + current]();
    } else {
      content.innerHTML = `<div class="panel"><h2>${esc(title)}</h2><p class="muted">This section is still in the main file. Full split coming next.</p></div>`;
    }
  } catch (e) {
    console.error(e);
    content.innerHTML = `<div class="panel"><h2>Error</h2><p class="muted">${esc(e.message)}</p></div>`;
  }
}
