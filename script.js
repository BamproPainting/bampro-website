// Mobile menu
const toggle = document.querySelector('.menu-toggle');
const nav = document.getElementById('nav');
const setMenu = open => {
  nav.classList.toggle('open', open);
  document.body.classList.toggle('menu-open', open);
  toggle.setAttribute('aria-expanded', open);
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
};
toggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));

// Header shrinks once you scroll
const header = document.querySelector('.site-header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Highlight the menu item for the section in view
const links = [...nav.querySelectorAll('a[href^="#"]')];
const spy = new IntersectionObserver(entries => entries.forEach(e => {
  if (!e.isIntersecting) return;
  links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
}), { rootMargin: '-45% 0px -50% 0px' });
['about', 'services', 'work', 'areas', 'contact'].forEach(id => {
  const el = document.getElementById(id); if (el) spy.observe(el);
});

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Before & after sliders
document.querySelectorAll('.ba').forEach(ba => {
  const range = ba.querySelector('.ba-range');
  range.addEventListener('input', () => ba.style.setProperty('--pos', range.value + '%'));
});

// One-time hint: the roller sweeps when the slider first comes into view
function hint(ba) {
  if (!ba || reduce || ba.dataset.hinted) return;
  ba.dataset.hinted = '1';
  const range = ba.querySelector('.ba-range');
  const frames = [50, 25, 75, 50];
  let i = 0, from = 50, start = null;
  const step = t => {
    if (!start) start = t;
    const p = Math.min((t - start) / 600, 1);
    const ease = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const v = from + (frames[i + 1] - from) * ease;
    ba.style.setProperty('--pos', v + '%'); range.value = v;
    if (p < 1) return requestAnimationFrame(step);
    i++; from = frames[i]; start = null;
    if (i < frames.length - 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const io = new IntersectionObserver(entries => entries.forEach(e => {
  if (e.isIntersecting) { hint(e.target); io.unobserve(e.target); }
}), { threshold: 0.6 });
document.querySelectorAll('.ba-panel:not([hidden]) .ba').forEach(ba => io.observe(ba));

// Show one service on its own (used by the dropdown)
function clearSolo(panel) {
  if (!panel || !panel.classList.contains('solo')) return;
  panel.classList.remove('solo');
  panel.querySelectorAll('.is-solo').forEach(c => c.classList.remove('is-solo'));
}
function showSolo(card) {
  const panel = card.closest('.svc-panel');
  let bar = panel.querySelector('.solo-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'solo-bar';
    bar.innerHTML = '<span>Showing <b></b></span><button type="button"></button>';
    bar.querySelector('button').addEventListener('click', () => {
      clearSolo(panel);
      document.getElementById('services').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
    panel.prepend(bar);
  }
  const cat = document.querySelector('[aria-controls="' + panel.id + '"]').textContent;
  bar.querySelector('b').textContent = card.querySelector('h3').textContent;
  bar.querySelector('button').textContent = 'See all ' + cat + ' services';
  panel.querySelectorAll('.is-solo').forEach(c => c.classList.remove('is-solo'));
  card.classList.add('is-solo');
  panel.classList.add('solo');
}

// Tabs (services and before & after)
document.querySelectorAll('.pill-tabs').forEach(list => {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const select = tab => {
    tabs.forEach(t => clearSolo(document.getElementById(t.getAttribute('aria-controls'))));
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    hint(panel.querySelector('.ba'));
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', e => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      const next = tabs[(i + d + tabs.length) % tabs.length];
      next.focus(); select(next);
    });
  });
});

// Where we work: real street map (OpenStreetMap via Leaflet) that flies to the chosen suburb
const subBtns = [...document.querySelectorAll('#suburbs button[data-s]')];
const card = document.getElementById('map-card');
const mapEl = document.getElementById('street-map');
const SUBURBS = JSON.parse(document.getElementById('suburb-data').textContent);
const COLORS = { north: '#3d6a1a', central: '#7BC142', south: '#0a0d0c', nsw: '#8a938d' };
let map = null, pinMarker = null;
const markers = {};
const allBounds = () => L.latLngBounds(SUBURBS.map(s => [s.lat, s.lon]));
if (window.L && mapEl) {
  map = L.map(mapEl, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  map.fitBounds(allBounds(), { padding: [24, 24] });
  SUBURBS.forEach(s => {
    const m = L.circleMarker([s.lat, s.lon], {
      radius: 7, color: '#fff', weight: 2, fillColor: COLORS[s.k], fillOpacity: 1
    }).addTo(map);
    m.bindTooltip(s.n, { direction: 'top', offset: [0, -6] });
    m.on('click', () => focusSuburb(s.n));
    markers[s.n] = m;
  });
  // the map only knows its size once its view is shown (phone menu views, tabs)
  new ResizeObserver(() => map.invalidateSize()).observe(mapEl);
}
const highlight = name => subBtns.forEach(b => b.classList.toggle('on', b.dataset.s === name));
function focusSuburb(name) {
  const s = SUBURBS.find(x => x.n === name);
  if (!s || !map) return;
  highlight(name);
  map.flyTo([s.lat, s.lon], 14, { duration: reduce ? 0 : 1.6 });
  if (pinMarker) map.removeLayer(pinMarker);
  pinMarker = L.marker([s.lat, s.lon], {
    icon: L.divIcon({ className: 'bp-pin', html: '<span></span>', iconSize: [34, 44], iconAnchor: [17, 37] }),
    interactive: false, keyboard: false
  }).addTo(map);
  document.getElementById('mc-name').textContent = name;
  document.getElementById('mc-region').textContent = '\u2713 We paint here \u00b7 ' + s.r;
  card.hidden = false;
  document.getElementById('map-hint').hidden = true;
}
function resetMap() {
  highlight('');
  if (pinMarker && map) { map.removeLayer(pinMarker); pinMarker = null; }
  if (map) map.flyToBounds(allBounds(), { padding: [24, 24], duration: reduce ? 0 : 1.2 });
  card.hidden = true;
  document.getElementById('map-hint').hidden = false;
  const sel = document.getElementById('area-select'); if (sel) sel.value = '';
  document.getElementById('area-found').textContent = '';
}
card.querySelector('.mc-reset').addEventListener('click', resetMap);
subBtns.forEach(b => {
  b.addEventListener('mouseenter', () => { const m = markers[b.dataset.s]; if (m) m.openTooltip(); });
  b.addEventListener('mouseleave', () => { const m = markers[b.dataset.s]; if (m) m.closeTooltip(); });
  b.addEventListener('click', () => focusSuburb(b.dataset.s));
});

// Phone suburb picker
{
  const sel = document.getElementById('area-select');
  if (sel) sel.addEventListener('change', () => {
    if (!sel.value) return resetMap();
    focusSuburb(sel.value);
    document.getElementById('area-found').textContent = '';
    document.querySelector('.map-box').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  });
}

// Gentle reveal as sections scroll into view
if (!reduce && 'IntersectionObserver' in window) {
  const targets = document.querySelectorAll('.section-head, .about-intro, .values li, .steps li, .promise-inner, .suburbs, .map-wrap, .reviews-grid, .contact-grid > *');
  targets.forEach(el => el.classList.add('reveal'));
  const rv = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); rv.unobserve(e.target); }
  }), { threshold: 0.12 });
  targets.forEach(el => rv.observe(el));
}

// Phone: each menu item is its own view (uses the URL hash, so Back works)
const phone = window.matchMedia('(max-width: 760px)');
const VIEW_OF = { about: 'about', services: 'services', process: 'services', work: 'work', areas: 'areas' };
function setView(v) {
  if (document.body.dataset.view === v) return;
  document.body.dataset.view = v;
  document.querySelectorAll('main > section').forEach(s => {
    s.classList.remove('view-in');
    if (!reduce && getComputedStyle(s).display !== 'none') { void s.offsetWidth; s.classList.add('view-in'); }
  });
  window.scrollTo(0, 0);
}
function route() {
  if (!phone.matches) { delete document.body.dataset.view; return; }
  const id = location.hash.slice(1);
  if (VIEW_OF[id]) { setView(VIEW_OF[id]); return; }
  setView('home');
  const el = id && id !== 'top' && document.getElementById(id);
  if (el) requestAnimationFrame(() => el.scrollIntoView());
}
window.addEventListener('hashchange', route);
phone.addEventListener('change', route);
route();

// Services dropdown
const drop = document.querySelector('.nav-drop');
const dropBtn = drop.querySelector('.nav-drop-btn');
const setDrop = open => { drop.classList.toggle('open', open); dropBtn.setAttribute('aria-expanded', open); };
dropBtn.addEventListener('click', e => { e.stopPropagation(); setDrop(!drop.classList.contains('open')); });
document.addEventListener('click', e => { if (!drop.contains(e.target)) setDrop(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { setDrop(false); dropBtn.focus(); } });
drop.querySelectorAll('a').forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  setDrop(false); setMenu(false);
  drop.classList.add('closing');
  drop.addEventListener('mouseleave', () => drop.classList.remove('closing'), { once: true });
  if (phone.matches) { history.pushState(null, '', '#services'); setView('services'); }
  const tab = document.getElementById(a.dataset.tab);
  if (tab) tab.click();
  document.getElementById('services').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
}));

// Quote form: photo/video uploads (Netlify accepts 8 MB per submission)
{
  const form = document.querySelector('.quote-form');
  const pick = document.getElementById('upload-pick');
  const zone = form.querySelector('.dropzone');
  const list = document.getElementById('thumbs');
  const note = document.getElementById('upload-note');
  const meter = form.querySelector('.upload-meter');
  const msg = document.getElementById('form-msg');
  const MAX_FILES = 5, MAX_BYTES = 7.5 * 1024 * 1024;
  const baseNote = note.textContent;
  let files = [];
  const total = () => files.reduce((s, f) => s + f.size, 0);
  const mb = n => (n / 1048576).toFixed(n < 1048576 ? 2 : 1) + ' MB';

  const shrink = file => new Promise(resolve => {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') return resolve(file);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => {
        if (!b || b.size >= file.size) return resolve(file);
        resolve(new File([b], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); }; // e.g. HEIC on some browsers: send as is
    img.src = url;
  });

  const render = () => {
    list.innerHTML = '';
    files.forEach((f, i) => {
      const li = document.createElement('li');
      const url = URL.createObjectURL(f);
      const media = document.createElement(f.type.startsWith('video/') ? 'video' : 'img');
      media.src = url; if (media.tagName === 'VIDEO') { media.muted = true; media.playsInline = true; }
      else media.alt = f.name;
      li.appendChild(media);
      if (f.type.startsWith('video/')) { const v = document.createElement('span'); v.className = 'vid'; v.textContent = 'VIDEO'; li.appendChild(v); }
      const s = document.createElement('span'); s.className = 'size'; s.textContent = mb(f.size); li.appendChild(s);
      const x = document.createElement('button'); x.type = 'button'; x.textContent = '×';
      x.setAttribute('aria-label', 'Remove ' + f.name);
      x.addEventListener('click', () => { files.splice(i, 1); render(); });
      li.appendChild(x);
      list.appendChild(li);
    });
    const t = total();
    meter.hidden = !files.length;
    meter.classList.toggle('full', t > MAX_BYTES);
    meter.querySelector('span').style.width = Math.min(100, t / MAX_BYTES * 100) + '%';
    if (t > MAX_BYTES) { note.textContent = 'Too large: ' + mb(t) + ' of 7.5 MB. Remove a file, or text big videos to 0411 804 355.'; note.classList.add('warn'); }
    else if (files.length) { note.textContent = files.length + ' of ' + MAX_FILES + ' files, ' + mb(t) + ' of 7.5 MB used.'; note.classList.remove('warn'); }
    else { note.textContent = baseNote; note.classList.remove('warn'); }
  };

  const add = async list => {
    msg.hidden = true;
    for (const f of list) {
      if (!/^(image|video)\//.test(f.type)) continue;
      if (files.length >= MAX_FILES) { msg.textContent = 'You can add up to 5 files.'; msg.hidden = false; break; }
      files.push(await shrink(f));
      render();
    }
  };

  pick.addEventListener('change', () => { add([...pick.files]); pick.value = ''; });
  ['dragenter', 'dragover'].forEach(t => zone.addEventListener(t, e => { e.preventDefault(); zone.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => zone.addEventListener(t, e => { e.preventDefault(); zone.classList.remove('over'); }));
  zone.addEventListener('drop', e => add([...e.dataTransfer.files]));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.hidden = true;
    if (/^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname)) { msg.textContent = 'Preview only: the form sends from the live website, not this local preview.'; msg.hidden = false; return; }
    if (total() > MAX_BYTES) { msg.textContent = 'Your files are over 7.5 MB in total. Please remove one before sending.'; msg.hidden = false; return; }
    const btn = form.querySelector('button[type="submit"]');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = files.length ? 'Uploading…' : 'Sending…';
    const data = new FormData(form);
    for (let i = 1; i <= MAX_FILES; i++) data.delete('attachment' + i);
    files.forEach((f, i) => data.append('attachment' + (i + 1), f, f.name));
    try {
      const res = await fetch('/', { method: 'POST', body: data });
      if (!res.ok) throw new Error(res.status);
      // Analytics: count the enquiry as a lead, then go to the thank-you page
      let left = false;
      const go = () => { if (left) return; left = true; window.location.href = '/thanks.html'; };
      if (typeof gtag === 'function') {
        gtag('event', 'generate_lead', { form_name: 'quote', project_type: data.get('service') || '', event_callback: go, event_timeout: 1500 });
        setTimeout(go, 1600);
      } else go();
    } catch (err) {
      msg.textContent = 'Something went wrong sending your enquiry. Please try again, or call 0411 804 355.';
      msg.hidden = false;
      btn.disabled = false; btn.textContent = label;
    }
  });
}

// Analytics: taps on phone, email and social links
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a || typeof gtag !== 'function') return;
  const href = a.getAttribute('href');
  const where = a.closest('section, header, footer');
  const place = where ? (where.id || where.className.split(' ')[0]) : 'page';
  if (href.startsWith('tel:')) gtag('event', 'phone_click', { link_location: place });
  else if (href.startsWith('mailto:')) gtag('event', 'email_click', { link_location: place });
  else if (/facebook\.com|instagram\.com/.test(href)) gtag('event', 'social_click', { network: href.includes('facebook') ? 'facebook' : 'instagram', link_location: place });
});
