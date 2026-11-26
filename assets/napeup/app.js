// 납읍리 동네탐험지도 화면 동작
(() => {
  const D = window.MAP_DATA;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = s => document.querySelector(s);
  const svg = $('#map'), wrap = $('#mapwrap'), pop = $('#pop'), panel = $('#panel');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (tag, attrs = {}, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };

  // ---- 지도 그림 ----
  // 인쇄용 재단선이 보이지 않게 지도 안쪽만 잘라 보여줌
  const cp = el('clipPath', { id: 'crop' }, el('defs'));
  el('rect', { x: D.image.view[0], y: D.image.view[1], width: D.image.view[2], height: D.image.view[3] }, cp);
  el('image', { href: D.image.src, x: 0, y: 0, width: D.image.w, height: D.image.h, 'clip-path': 'url(#crop)' });
  const layers = {};
  const addLayer = (name, items, r, onClick) => {
    const g = el('g', { 'data-layer': name }); layers[name] = g;
    items.forEach((it, i) => {
      const h = el('g', { class: 'hot', tabindex: 0 }, g);
      el('circle', { class: 'ring', cx: it.x, cy: it.y, r }, h);
      const open = () => onClick(it, i, h);
      h.addEventListener('click', e => { e.stopPropagation(); open(); });
      h.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
    });
  };
  const placePop = it => `<h3>${esc(it.name)}</h3>${it.tag ? `<span class="tag">${esc(it.tag)}</span>` : ''}<div class="addr">${esc(it.addr)}</div><p>${esc(it.text)}${it.note ? `<br><br><small>${esc(it.note)}</small>` : ''}</p>`;
  addLayer('clover', D.clovers, 14, (it, i, h) => showPop(h, it, `<h3>탐험가이드</h3><p>${esc(it.text)}</p>`));
  addLayer('safety', D.safety, 14, (it, i, h) => showPop(h, it, `<h3>안전 안내</h3><p>${esc(it.text)}</p>`));
  addLayer('restroom', D.restrooms, 13, (it, i, h) => showPop(h, it, `<h3>공공화장실</h3><p>탐험 중 쉬어가세요.</p>`));
  addLayer('start', [D.start], 18, (it, i, h) => showPop(h, it, `<h3>${esc(it.title)}</h3><p>${esc(it.text)}</p>`));
  addLayer('place', D.places, 14, (it, i, h) => showPop(h, it, placePop(it)));

  // ---- 확대·이동 ----
  const [vx0, vy0, vw0, vh0] = D.image.view;
  let vb = { x: vx0, y: vy0, w: vw0, h: vh0 };
  const fit = () => {
    const r = wrap.clientWidth / wrap.clientHeight, ir = vw0 / vh0;
    if (r > ir) { const w = vh0 * r; vb = { x: vx0 - (w - vw0) / 2, y: vy0, w, h: vh0 }; }
    else { const h = vw0 / r; vb = { x: vx0, y: vy0 - (h - vh0) / 2, w: vw0, h }; }
    // 화면이 넓으면 지도 위쪽을 조금 확대해서 시작
    if (r > 1) zoomAt(1.6, vx0 + vw0 / 2, vy0 + vh0 * 0.38, true); else apply();
  };
  const apply = () => { svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`); hidePop(); };
  const zoomAt = (f, cx, cy, center) => {
    const nw = Math.min(Math.max(vb.w / f, 150), vw0 * 2.2), k = nw / vb.w, nh = vb.h * k;
    if (center) vb = { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
    else vb = { x: cx - (cx - vb.x) * k, y: cy - (cy - vb.y) * k, w: nw, h: nh };
    apply();
  };
  const toMap = (px, py) => { const r = svg.getBoundingClientRect(), s = Math.max(vb.w / r.width, vb.h / r.height);
    return { x: vb.x + (px - r.left) * s - (r.width * s - vb.w) / 2, y: vb.y + (py - r.top) * s - (r.height * s - vb.h) / 2 }; };
  $('#zin').onclick = () => zoomAt(1.4, vb.x + vb.w / 2, vb.y + vb.h / 2);
  $('#zout').onclick = () => zoomAt(1 / 1.4, vb.x + vb.w / 2, vb.y + vb.h / 2);
  $('#zfit').onclick = () => { const r = wrap.clientWidth / wrap.clientHeight; vb = { x: vx0, y: vy0, w: vw0, h: vh0 };
    if (r > vw0 / vh0) { vb.w = vh0 * r; vb.x -= (vb.w - vw0) / 2; } else { vb.h = vw0 / r; vb.y -= (vb.h - vh0) / 2; } apply(); };
  wrap.addEventListener('wheel', e => { e.preventDefault(); const p = toMap(e.clientX, e.clientY); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y); }, { passive: false });

  const pts = new Map(); let last = null, moved = 0;
  svg.addEventListener('pointerdown', e => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); last = null; moved = 0; wrap.classList.add('drag'); });
  window.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = svg.getBoundingClientRect(), s = Math.max(vb.w / r.width, vb.h / r.height);
    if (pts.size === 1) {
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y; moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 4) { vb.x -= dx * s; vb.y -= dy * s; apply(); }
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (last) { const p = toMap((a.x + b.x) / 2, (a.y + b.y) / 2); zoomAt(d / last, p.x, p.y); }
      last = d; moved = 99;
    }
  });
  const up = e => { pts.delete(e.pointerId); if (!pts.size) wrap.classList.remove('drag'); last = null; };
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  // 끌어서 옮긴 뒤에는 클릭으로 치지 않음
  svg.addEventListener('click', e => { if (moved > 4) e.stopPropagation(); else hidePop(); }, true);

  // ---- 팝업 ----
  let popItem = null, popHot = null;
  function showPop(hot, it, html) {
    if (moved > 4) return;
    document.querySelectorAll('.hot.on').forEach(h => h.classList.remove('on'));
    hot.classList.add('on'); popItem = it; popHot = hot;
    $('#popBody').innerHTML = html; pop.classList.add('show'); placePopup();
  }
  function placePopup() {
    if (!popItem) return;
    const r = svg.getBoundingClientRect(), w = wrap.getBoundingClientRect(), s = Math.max(vb.w / r.width, vb.h / r.height);
    const px = (popItem.x - vb.x + (r.width * s - vb.w) / 2) / s + r.left - w.left;
    const py = (popItem.y - vb.y + (r.height * s - vb.h) / 2) / s + r.top - w.top;
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = px + 20, top = py - 30;
    const right = w.width - (panel.classList.contains('show') && innerWidth > 720 ? panel.offsetWidth : 0);
    if (left + pw > right - 12) left = px - pw - 20;
    left = Math.max(12, left); top = Math.min(Math.max(12, top), w.height - ph - 12);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  function hidePop() { if (!popItem) return; pop.classList.remove('show'); popHot && popHot.classList.remove('on'); popItem = popHot = null; }
  pop.querySelector('.x').onclick = hidePop;
  pop.addEventListener('pointerdown', e => e.stopPropagation());

  // 오른쪽 패널이 열려 있으면 패널에 가리지 않게 장소를 왼쪽 빈 곳 가운데로
  const focusOn = it => { const pw = panel.classList.contains('show') && innerWidth > 720 ? panel.offsetWidth : 0;
    const share = pw / wrap.clientWidth, nw = 600 / (1 - share);
    zoomAt(vb.w / nw, it.x + nw * share / 2 + 80, it.y, true); setTimeout(() => {
    const h = [...layers.place.children][D.places.indexOf(it)]; moved = 0; showPop(h, it, placePop(it)); }, 0); };

  // ---- 왼쪽 메뉴 패널 ----
  const panels = {
    course: () => `<div class="eyebrow">발걸음에 맞는 코스를 골라보세요</div><h2>탐험코스</h2>
      <div class="card"><b>${esc(D.course.name)}</b><small>${esc(D.course.info)}</small></div>
      <p class="empty">${esc(D.course.start)}</p>
      ${D.places.map(p => `<div class="card click" data-place="${p.n}"><b><span class="num">${p.n}</span>${esc(p.name)}</b></div>`).join('')}`,
    mine: () => `<div class="eyebrow">내가 발견한 곳</div><h2>나만의 장소</h2><p class="empty">탐험하며 발견한 나만의 장소를 탐험수첩의 My Note에 기록해 보세요.</p>`,
    mycourse: () => `<div class="eyebrow">내가 만든 길</div><h2>나만의 코스</h2><p class="empty">지도를 보며 가고 싶은 곳을 이어 나만의 탐험 루트를 정해서 걸어보세요.</p>`,
    charm: () => `<div class="eyebrow">주민과 탐험가가 찾은</div><h2>동네의 매력</h2>${D.charm.map(c => `<div class="card"><b>${esc(c.title)}</b>${c.by ? `<small>${esc(c.by)}</small>` : ''}<p>${esc(c.text)}</p></div>`).join('')}`,
    keep: () => `<div class="eyebrow">오래 남았으면 하는 것</div><h2>지켜졌으면!</h2>${D.keep.map(c => `<div class="card"><b>${esc(c.title)}</b><small>${esc(c.by)}</small><p>${esc(c.text)}</p></div>`).join('')}`,
    story: () => `<div class="eyebrow">제주시 애월읍</div><h2>동네이야기</h2>${D.story.map(t => `<p class="empty" style="color:var(--ink)">${esc(t)}</p>`).join('')}
      <h2 style="font-size:17px;margin-top:22px">장소 이야기</h2>${D.places.map(p => `<div class="card click" data-place="${p.n}"><b><span class="num">${p.n}</span>${esc(p.name)}</b><small>${esc(p.addr)}</small></div>`).join('')}`
  };
  const rail = document.querySelectorAll('.rail button');
  rail.forEach(b => b.onclick = () => {
    const on = b.classList.contains('on');
    rail.forEach(x => x.classList.remove('on'));
    if (on) { panel.classList.remove('show'); return; }
    b.classList.add('on'); $('#panelBody').innerHTML = panels[b.dataset.panel](); panel.classList.add('show'); panel.scrollTop = 0;
  });
  panel.querySelector('.x').onclick = () => { panel.classList.remove('show'); rail.forEach(x => x.classList.remove('on')); };
  panel.addEventListener('click', e => { const c = e.target.closest('[data-place]'); if (!c) return;
    if (innerWidth <= 720) { panel.classList.remove('show'); rail.forEach(x => x.classList.remove('on')); }
    focusOn(D.places.find(p => p.n == c.dataset.place)); });

  // ---- 머리줄 버튼 창 ----
  const modals = {
    guide: () => `<h2>동네 탐험 가이드</h2><ol class="list">${D.guide.map(t => `<li>${esc(t)}</li>`).join('')}</ol>`,
    etiquette: () => `<h2>동네 탐험 에티켓</h2><ul class="list">${D.etiquette.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`,
    about: () => `<h2>${esc(D.title)}</h2><p class="empty">동네 곳곳에 숨어 있는 이야기들을 찾아 기록합니다.<br>기획: 문화를 심은 왓, Lab.왓 · 일러스트: 황예지<br>ⓒ2026. 동네안내소 왓집 all rights reserved</p>`
  };
  const mbg = $('#modalBg');
  document.querySelectorAll('[data-modal]').forEach(b => b.onclick = () => { $('#modalBody').innerHTML = modals[b.dataset.modal](); mbg.classList.add('show'); });
  mbg.addEventListener('click', e => { if (e.target === mbg || e.target.closest('.x')) mbg.classList.remove('show'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { mbg.classList.remove('show'); hidePop(); } });

  addEventListener('resize', () => { fit(); });
  fit();
})();
