/* ==========================================================
   FullPage – 섹션 단위 스크롤
   ----------------------------------------------------------
   · 짧은 섹션(한 화면에 다 들어옴): 휠 / 스와이프 / 키 한 번에 바로 이동
   · 긴 섹션(화면보다 김): 섹션 안에서 스크롤
       → 끝에 닿은 그 스크롤은 막힘
       → 휠이 잠깐 멈춘 뒤 다음 스크롤에 이동
   · .fp-auto 섹션(푸터 등)은 높이 auto, data-nav="false" 는 도트 제외
   · 휠 / 터치 / 키보드 / 도트 / 앵커(#apply) 지원
   · 화면 안내 문구 없음
   · 외부 라이브러리 없음 (Vanilla JS)
========================================================== */
(function () {
  'use strict';

  const OPT = {
    duration: 800,      // 섹션 전환 시간(ms) – CSS --dur 와 동일
    edgeIdle: 180,      // 긴 섹션 끝에서 막힌 뒤 휠이 이만큼 멈춰야 "다음 스크롤 준비"
    wheelThreshold: 60, // 준비 상태에서 이만큼 휠이 쌓이면 이동
    touchThreshold: 70, // 스와이프 거리(px)
    cooldown: 250,      // 전환 직후 관성 무시(ms)
    edgeGap: 2          // 끝 판정 허용 오차(px)
  };

  const wrap = document.getElementById('fullpage');
  const track = document.getElementById('fpTrack');
  const sections = Array.from(track.querySelectorAll('.fp-section'));
  const navList = document.getElementById('fpNav');
  const header = document.getElementById('header');
  const navWrap = document.querySelector('.fp-nav');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let index = 0;
  let animating = false;
  let cooldownUntil = 0;

  // 긴 섹션 끝 상태: 'none' → 'wait'(막힘, 관성 소진 대기) → 'armed'(다음 스크롤에 이동)
  let edge = { state: 'none', dir: 0, timer: null, acc: 0 };

  /* ---------- helpers ---------- */
  const scrollable = (s) => s.scrollHeight - s.clientHeight > OPT.edgeGap; // 화면보다 긴 섹션인지
  const atBottom = (s) => s.scrollTop + s.clientHeight >= s.scrollHeight - OPT.edgeGap;
  const atTop = (s) => s.scrollTop <= OPT.edgeGap;
  const atEdge = (s, dir) => (dir > 0 ? atBottom(s) : atTop(s));
  const isDark = (s) => s.classList.contains('s-home') || s.dataset.theme === 'dark';

  // 섹션 위치 (마지막 auto 섹션은 화면 하단에 맞춤)
  const offsetOf = (i) => Math.max(0, Math.min(sections[i].offsetTop, track.offsetHeight - wrap.clientHeight));
  const moveTrack = () => { track.style.transform = `translate3d(0, ${-offsetOf(index)}px, 0)`; };

  function resetEdge() {
    clearTimeout(edge.timer);
    edge = { state: 'none', dir: 0, timer: null, acc: 0 };
  }
  // 바로 준비 상태로 (터치·키보드용 – 관성 대기 불필요)
  function arm(dir) {
    resetEdge();
    edge.state = 'armed';
    edge.dir = dir;
  }
  // 끝에 닿음 → 막힘. 입력이 edgeIdle 동안 멈추면 준비 상태로
  function waitThenArm(dir) {
    clearTimeout(edge.timer);
    edge.state = 'wait';
    edge.dir = dir;
    edge.acc = 0;
    edge.timer = setTimeout(() => { edge.state = 'armed'; edge.acc = 0; }, OPT.edgeIdle);
  }

  /* ---------- 이동 ---------- */
  function go(next, opts = {}) {
    if (next < 0 || next >= sections.length || (next === index && !opts.force)) return;
    const dir = next > index ? 1 : -1;
    const target = sections[next];

    // 아래로 → 섹션 맨 위, 위로 → 섹션 맨 아래 (긴 섹션의 자연스러운 연결)
    target.scrollTop = (opts.toTop || dir > 0) ? 0 : target.scrollHeight;

    index = next;
    animating = true;
    resetEdge();

    if (opts.instant) { track.style.transition = 'none'; moveTrack(); void track.offsetHeight; track.style.transition = ''; }
    else moveTrack();

    const dur = reduceMotion || opts.instant ? 0 : OPT.duration;
    setTimeout(() => {
      animating = false;
      cooldownUntil = opts.instant ? 0 : performance.now() + OPT.cooldown;
      // 긴 섹션에 도착한 끝(맨 위/맨 아래)은 바로 "준비" 상태
      // → 도착 직후 되돌아가는 스크롤 1번에 바로 이동
      if (scrollable(target)) arm(atTop(target) ? -1 : 1);
      target.focus({ preventScroll: true });
    }, dur);

    updateUI();
    if (!opts.silent && target.dataset.nav !== 'false') history.replaceState(null, '', '#' + target.id);
  }

  function goById(id, opts) {
    const i = sections.findIndex((s) => s.id === id);
    if (i > -1) go(i, Object.assign({ toTop: true }, opts));
  }

  /* ---------- 휠 ---------- */
  wrap.addEventListener('wheel', (e) => {
    if (e.ctrlKey) return;                       // 핀치 줌 허용
    const dir = Math.sign(e.deltaY);
    if (!dir) return;                            // 가로 휠은 무시(슬라이더 등)
    const s = sections[index];

    if (animating || performance.now() < cooldownUntil) { e.preventDefault(); return; }

    // 짧은 섹션 → 바로 이동
    if (!scrollable(s)) {
      e.preventDefault();
      if (sections[index + dir]) go(index + dir);
      return;
    }

    // 긴 섹션 – 아직 끝이 아니면 내부 스크롤
    if (!atEdge(s, dir)) { if (edge.state !== 'none') resetEdge(); return; }

    // 긴 섹션 – 끝
    e.preventDefault();
    if (!sections[index + dir]) return;          // 첫/마지막 섹션
    if (edge.dir !== dir) resetEdge();
    edge.dir = dir;

    if (edge.state === 'armed') {                // 준비 상태 → 쌓이면 이동
      edge.acc += Math.abs(e.deltaY);
      if (edge.acc >= OPT.wheelThreshold) go(index + dir);
      return;
    }

    // 끝에서 들어온 휠(관성 포함) → 막힘 유지, 멈추면 준비 상태로
    waitThenArm(dir);
  }, { passive: false });

  // 섹션 내부 스크롤 감시
  // · 스크롤이 끝에 "도달한 순간" = 그 스크롤이 막힘 → 멈추면 바로 준비 상태
  //   (끝에 정확히 멈춰 끝에서 들어온 휠이 없어도 다음 스크롤 1번에 이동)
  // · 끝을 벗어나면 해제
  sections.forEach((s) => {
    s.addEventListener('scroll', () => {
      updateProgress();
      if (animating || s !== sections[index]) return;  // 섹션 이동 중 위치 보정은 무시
      const dir = atBottom(s) ? 1 : atTop(s) ? -1 : 0;
      if (!dir) { if (edge.state !== 'none') resetEdge(); return; }
      if (edge.state === 'armed' && edge.dir === dir) return;
      waitThenArm(dir);
    }, { passive: true });
  });

  /* ---------- 터치 ---------- */
  let touch = null;

  wrap.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { touch = null; return; }
    const s = sections[index];
    touch = {
      x: e.touches[0].clientX, y: e.touches[0].clientY, dy: 0, dir: 0, axis: null, moved: false,
      startTop: atTop(s), startBottom: atBottom(s)
    };
  }, { passive: true });

  wrap.addEventListener('touchmove', (e) => {
    if (!touch || animating) return;
    const dx = touch.x - e.touches[0].clientX;
    const dy = touch.y - e.touches[0].clientY;

    // 방향 결정: 가로 스와이프는 슬라이더 등에 양보
    if (!touch.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      touch.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (touch.axis === 'x') return;

    const dir = dy > 0 ? 1 : -1;
    touch.dir = dir;
    touch.dy = dy;

    // 짧은 섹션 → 스와이프 거리만 넘으면 바로 이동
    if (!scrollable(sections[index])) {
      if (!sections[index + dir]) return;
      e.preventDefault();
      if (Math.abs(dy) >= OPT.touchThreshold && !touch.moved) { touch.moved = true; go(index + dir); }
      return;
    }

    // 긴 섹션 – 스와이프 시작 시점에 끝이 아니었으면 내부 스크롤
    const startedAtEdge = dir > 0 ? touch.startBottom : touch.startTop;
    if (!startedAtEdge || !sections[index + dir]) return;

    e.preventDefault();
    if (edge.state === 'armed' && edge.dir === dir &&
        Math.abs(dy) >= OPT.touchThreshold && !touch.moved) {
      touch.moved = true;
      go(index + dir);
    }
  }, { passive: false });

  wrap.addEventListener('touchend', () => {
    if (!touch) return;
    const { moved, axis, dir, dy } = touch;
    touch = null;
    if (moved || axis !== 'y' || !dir) return;
    const s = sections[index];

    // 긴 섹션 끝에서 막힌(또는 끝에 닿은) 스와이프 → 준비 상태
    if (scrollable(s) && atEdge(s, dir) && sections[index + dir] && Math.abs(dy) >= 10) {
      if (!(edge.state === 'armed' && edge.dir === dir)) arm(dir);
    }
  }, { passive: true });

  /* ---------- 키보드 ---------- */
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable) return;
    if (document.querySelector('.layer:not([hidden]), .m-menu:not([hidden])')) return;
    if (animating) return;

    const s = sections[index];
    const down = ['ArrowDown', 'PageDown'].includes(e.key) || (e.key === ' ' && !e.shiftKey);
    const up = ['ArrowUp', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey);

    if (down || up) {
      const dir = down ? 1 : -1;
      // 짧은 섹션 → 바로 이동
      if (!scrollable(s)) { e.preventDefault(); go(index + dir); return; }
      // 긴 섹션 – 끝이 아니면 내부 스크롤
      if (!atEdge(s, dir)) return;
      e.preventDefault();
      if (!sections[index + dir]) return;
      if (edge.state === 'armed' && edge.dir === dir) go(index + dir);
      else arm(dir);                             // 끝에서 첫 입력은 막힘
    } else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(sections.length - 1); }
  });

  /* ---------- 도트 내비 (data-nav="false" 제외) ---------- */
  const dots = [];
  sections.forEach((s, i) => {
    if (s.dataset.nav === 'false') return;
    const li = document.createElement('li');
    li.dataset.index = i;
    li.innerHTML = `<button type="button" aria-label="${s.dataset.title} 섹션으로 이동"><span class="name">${s.dataset.title}</span><span class="dot"><i></i></span></button>`;
    li.querySelector('button').addEventListener('click', () => go(i, { toTop: true }));
    navList.appendChild(li);
    dots.push(li);
  });

  // 현재 섹션의 도트 (도트 제외 섹션이면 바로 앞 섹션의 도트)
  function activeDot() {
    for (let i = index; i >= 0; i--) {
      const d = dots.find((x) => +x.dataset.index === i);
      if (d) return d;
    }
    return null;
  }

  function updateProgress() {
    const s = sections[index];
    const max = s.scrollHeight - s.clientHeight;
    const p = max > 0 ? s.scrollTop / max : 1;
    const d = activeDot();
    if (d) d.querySelector('i').style.height = Math.round(p * 100) + '%';
  }

  function updateUI() {
    const cur = activeDot();
    dots.forEach((d) => {
      const on = d === cur;
      d.classList.toggle('on', on);
      d.querySelector('button').setAttribute('aria-current', on ? 'true' : 'false');
      if (!on) d.querySelector('i').style.height = '0';
    });
    const id = sections[index].id;
    document.querySelectorAll('.gnb a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + id));
    if (header) header.classList.toggle('on-dark', isDark(sections[index]));
    if (navWrap) navWrap.classList.toggle('on-dark', isDark(sections[index]));
    updateProgress();
  }

  /* ---------- 앵커 링크 ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-fp-link]');
    if (!a) return;
    const id = (a.getAttribute('href') || '').replace('#', '');
    if (!id) return;
    e.preventDefault();
    document.dispatchEvent(new CustomEvent('fp:navigate'));
    goById(id);
  });
  window.addEventListener('hashchange', () => goById(location.hash.slice(1)));

  /* ---------- 리사이즈 ---------- */
  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      track.style.transition = 'none';
      moveTrack();
      void track.offsetHeight;
      track.style.transition = '';
      updateProgress();
    }, 100);
  });

  /* ---------- init ---------- */
  const startId = location.hash.slice(1);
  const startIdx = Math.max(0, sections.findIndex((s) => s.id === startId));
  go(startIdx, { instant: true, force: true, toTop: true, silent: !startId });

  // 외부(ui.js)에서 사용
  window.FullPage = { go, goById, get index() { return index; }, sections };
})();
