/* ==========================================================
   UI – 모바일 메뉴 / 프로그램 탭 / 신청 폼 (프론트 검증만)
========================================================== */
(function () {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- 모바일 메뉴 ---------- */
  const mMenu = $('#mMenu');
  const btnMenu = $('.btn-menu');
  const openMenu = () => { mMenu.hidden = false; btnMenu.setAttribute('aria-expanded', 'true'); $('.btn-close', mMenu).focus(); };
  const closeMenu = () => { if (mMenu.hidden) return; mMenu.hidden = true; btnMenu.setAttribute('aria-expanded', 'false'); };
  btnMenu.addEventListener('click', openMenu);
  $('.btn-close', mMenu).addEventListener('click', () => { closeMenu(); btnMenu.focus(); });
  document.addEventListener('fp:navigate', closeMenu);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); closeLayer(); } });

  /* ---------- 프로그램 탭 필터 ---------- */
  const tabs = $$('#programTab [role="tab"]');
  const cards = $$('#programList > li');
  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    const f = t.dataset.filter;
    cards.forEach((c) => { c.hidden = !(f === 'all' || c.dataset.cat === f); });
  }));
})();
