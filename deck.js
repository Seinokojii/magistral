(function () {
  'use strict';

  var root = document.documentElement;
  var SVG = 'http://www.w3.org/2000/svg';
  var slides = [].slice.call(document.querySelectorAll('.s'));
  var N = slides.length;
  var mq = window.matchMedia('(min-width: 900px) and (min-aspect-ratio: 1/1)');
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stage = false;
  var cur = 0;
  var io = null;
  var taps = [];

  function $(id) { return document.getElementById(id); }

  root.classList.add('js');

  /* ---------- рейка: отвод на каждый слайд ---------- */

  slides.forEach(function (s, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tap';
    b.title = s.getAttribute('data-title');
    b.setAttribute('aria-label', s.getAttribute('data-title'));
    b.addEventListener('click', function () { go(i); });
    $('taps').appendChild(b);
    taps.push(b);
  });

  function mark() {
    taps.forEach(function (t, i) {
      if (i === cur) t.setAttribute('aria-current', 'true');
      else t.removeAttribute('aria-current');
    });
  }

  /* ---------- сцена ---------- */

  function fit() {
    root.style.setProperty('--s', Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
  }

  function go(n, instant) {
    n = Math.max(0, Math.min(N - 1, n));
    var old = cur;
    cur = n;
    if (!stage) {
      slides[n].scrollIntoView();
      return;
    }
    slides.forEach(function (s, i) {
      s.classList.toggle('is-past', i < n);
      s.classList.toggle('is-active', i === n);
      s.classList.remove('is-leaving');
      if (instant && i !== n) s.classList.remove('is-on');
    });
    clearTimeout(slides[n]._t);
    if (old !== n && !instant) {
      var o = slides[old];
      o.classList.add('is-leaving');
      clearTimeout(o._t);
      o._t = setTimeout(function () { o.classList.remove('is-leaving', 'is-on'); }, 720);
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { slides[n].classList.add('is-on'); });
    });
    root.style.setProperty('--p', N > 1 ? n / (N - 1) : 0);
    mark();
    if (slides[n].id === 'cycle' && old !== n) cycle.restart();
    if (history.replaceState) history.replaceState(null, '', '#' + slides[n].id);
  }

  /* ---------- чтение: слайды лентой ---------- */

  function onScroll() {
    var max = root.scrollHeight - window.innerHeight;
    root.style.setProperty('--p', max > 0 ? Math.min(1, window.scrollY / max) : 0);
  }

  function watch() {
    if (!('IntersectionObserver' in window)) {
      slides.forEach(function (s) { s.classList.add('is-on'); });
      return;
    }
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-on');
        cur = slides.indexOf(e.target);
      });
    }, { threshold: 0.12 });
    slides.forEach(function (s) { io.observe(s); });
  }

  function setMode() {
    stage = mq.matches;
    root.classList.toggle('st', stage);
    if (io) { io.disconnect(); io = null; }
    if (stage) {
      window.removeEventListener('scroll', onScroll);
      fit();
      go(cur, true);
    } else {
      setNotes(false);
      slides.forEach(function (s) { s.classList.remove('is-past', 'is-active', 'is-leaving'); });
      window.addEventListener('scroll', onScroll, { passive: true });
      watch();
      onScroll();
    }
  }

  /* ---------- текст доклада и полный экран ---------- */

  function setNotes(on) {
    root.classList.toggle('show-notes', on);
    $('b-notes').setAttribute('aria-pressed', on ? 'true' : 'false');
    [].forEach.call(document.querySelectorAll('.notes'), function (d) { d.open = on; });
  }

  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (root.requestFullscreen) root.requestFullscreen();
  }

  $('b-prev').addEventListener('click', function () { go(cur - 1); });
  $('b-next').addEventListener('click', function () { go(cur + 1); });
  $('b-notes').addEventListener('click', function () { setNotes(!root.classList.contains('show-notes')); });
  $('b-full').addEventListener('click', fullscreen);

  document.addEventListener('keydown', function (e) {
    if (!stage || e.ctrlKey || e.metaKey || e.altKey) return;
    var onButton = e.target && e.target.tagName === 'BUTTON';
    var onCycle = slides[cur].id === 'cycle';
    switch (e.code) {
      case 'ArrowRight': case 'PageDown': go(cur + 1); break;
      case 'ArrowLeft': case 'PageUp': go(cur - 1); break;
      case 'Space': if (onButton) return; go(cur + (e.shiftKey ? -1 : 1)); break;
      case 'Home': go(0); break;
      case 'End': go(N - 1); break;
      case 'ArrowDown': if (!onCycle) return; cycle.step(1); break;
      case 'ArrowUp': if (!onCycle) return; cycle.step(-1); break;
      case 'KeyF': fullscreen(); break;
      case 'KeyN': setNotes(!root.classList.contains('show-notes')); break;
      case 'Escape': setNotes(false); return;
      default: return;
    }
    e.preventDefault();
  });

  var touchX = null;
  document.addEventListener('touchstart', function (e) {
    touchX = stage && e.touches.length === 1 ? e.touches[0].clientX : null;
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 60) go(cur + (dx < 0 ? 1 : -1));
  }, { passive: true });

  window.addEventListener('resize', function () { if (stage) fit(); });
  window.addEventListener('hashchange', function () {
    var i = indexOfHash();
    if (i >= 0 && i !== cur) go(i);
  });

  function indexOfHash() {
    var id = location.hash.slice(1);
    for (var i = 0; i < N; i++) if (slides[i].id === id) return i;
    return -1;
  }

  /* ---------- 45 связей против одной магистрали ---------- */

  function el(name, attrs, parent) {
    var n = document.createElementNS(SVG, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n);
    return n;
  }

  (function drawMesh() {
    var mesh = $('mesh'), bus = $('onebus'), pts = [], i, j, k = 0, line;
    for (i = 0; i < 10; i++) {
      var a = Math.PI * 2 * i / 10 - Math.PI / 2;
      pts.push([100 + 84 * Math.cos(a), 100 + 84 * Math.sin(a)]);
    }
    for (i = 0; i < 10; i++) {
      for (j = i + 1; j < 10; j++) {
        line = el('line', { x1: pts[i][0], y1: pts[i][1], x2: pts[j][0], y2: pts[j][1], pathLength: 1, 'class': 'draw' }, mesh);
        line.style.transitionDelay = (700 + k++ * 40) + 'ms';
      }
    }
    pts.forEach(function (p) { el('circle', { cx: p[0], cy: p[1], r: 8 }, mesh); });

    line = el('line', { x1: 12, y1: 100, x2: 188, y2: 100, pathLength: 1, 'class': 'draw trunk' }, bus);
    line.style.transitionDelay = '700ms';
    for (i = 0; i < 5; i++) {
      var x = 28 + i * 36;
      [36, 164].forEach(function (y, row) {
        line = el('line', { x1: x, y1: y, x2: x, y2: 100, pathLength: 1, 'class': 'draw stub' }, bus);
        line.style.transitionDelay = (1100 + (i * 2 + row) * 60) + 'ms';
        el('circle', { cx: x, cy: y, r: 8 }, bus);
      });
    }
  })();

  /* ---------- цикл чтения и записи ---------- */

  var cycle = (function () {
    // b — шина (0 адрес, 1 управление, 2 данные), d — направление (1: от процессора к памяти)
    var S = [
      { w: 0, b: 0, d: 1, l: 'адрес 1024', t: 'Процессор выставляет на шину адреса номер ячейки: 1024' },
      { w: 0, b: 1, d: 1, l: 'ЧТЕНИЕ', t: 'По шине управления идёт сигнал «Чтение»' },
      { w: 0, b: 2, d: -1, l: '42', g: 'c1', t: 'Память кладёт содержимое ячейки (42) на шину данных' },
      { w: 0, b: -1, g: 'reg', t: 'Процессор забрал число 42 — чтение завершено' },
      { w: 1, b: 0, d: 1, l: 'адрес 2048', t: 'Процессор выставляет на шину адреса ячейку 2048' },
      { w: 1, b: 2, d: 1, l: '77', t: 'Процессор кладёт на шину данных число 77' },
      { w: 1, b: 1, d: 1, l: 'ЗАПИСЬ', t: 'По шине управления идёт сигнал «Запись»' },
      { w: 1, b: -1, g: 'c2', t: 'Память сохранила 77 в ячейке 2048 — запись завершена' }
    ];
    var box = $('cyc');
    var lanes = [].slice.call(box.querySelectorAll('.lane'));
    var dots = [].slice.call($('cyc-dots').children);
    var i = 0, playing = !calm, timer = null;

    function show() {
      var s = S[i];
      $('cyc-mode').textContent = s.w ? 'Запись' : 'Чтение';
      $('cyc-mode').classList.toggle('w', !!s.w);
      $('cyc-text').textContent = s.t;
      dots.forEach(function (d, k) { d.classList.toggle('on', k === i % 4); });
      $('cyc-reg').textContent = 'регистр: ' + (i >= 3 ? '42' : '—');
      $('cyc-c2').textContent = '[2048] = ' + (i >= 7 ? '77' : '0');
      $('cyc-reg').classList.toggle('hl', s.g === 'reg');
      $('cyc-c1').classList.toggle('hl', s.g === 'c1');
      $('cyc-c2').classList.toggle('hl', s.g === 'c2');
      $('cyc-cpu').classList.toggle('glow', s.g === 'reg');
      $('cyc-ram').classList.toggle('glow', s.g === 'c1' || s.g === 'c2');
      lanes.forEach(function (lane, k) {
        lane.classList.toggle('dim', s.b >= 0 && s.b !== k);
        lane.classList.toggle('live', s.b === k);
        if (s.b !== k) return;
        lane.querySelector('.lane__pk').textContent = s.l;
        lane.classList.add('no-tr');
        lane.classList.toggle('at-r', s.d < 0);
        void lane.offsetWidth;
        lane.classList.remove('no-tr');
        lane.classList.toggle('at-r', s.d > 0);
      });
    }

    function tick() {
      if (!box.closest('.s').classList.contains('is-on')) return;
      i = (i + 1) % S.length;
      show();
    }

    function setPlaying(on) {
      playing = on;
      clearInterval(timer);
      if (on) timer = setInterval(tick, 3000);
      $('cyc-play-ic').setAttribute('href', on ? '#i-pause' : '#i-play');
      $('cyc-play').setAttribute('aria-label', on ? 'Пауза' : 'Запустить');
    }

    function step(dir) {
      setPlaying(false);
      i = (i + dir + S.length) % S.length;
      show();
    }

    $('cyc-prev').addEventListener('click', function () { step(-1); });
    $('cyc-next').addEventListener('click', function () { step(1); });
    $('cyc-play').addEventListener('click', function () { setPlaying(!playing); });

    show();
    setPlaying(playing);

    return {
      step: step,
      restart: function () { i = 0; show(); setPlaying(playing); }
    };
  })();

  /* ---------- запуск ---------- */

  var start = indexOfHash();
  if (start >= 0) cur = start;
  if (mq.addEventListener) mq.addEventListener('change', setMode);
  else mq.addListener(setMode);
  setMode();
})();
