/* StageX — motion system
   The page is a timeline. One rAF loop drives everything on it.

   1. helpers        2. word split      3. boot
   4. smooth scroll  5. frame loop      6. reveal + count-up
   7. frame scrub    8. menu            9. form                */

(() => {
  'use strict';

  /* ---------- 1. Helpers ---------- */
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine   = matchMedia('(pointer: fine)').matches;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pad = (n) => String(n).padStart(2, '0');
  const frames = (f) =>
    `${pad(Math.floor(f / 86400))}:${pad(Math.floor(f / 1440) % 60)}:${pad(Math.floor(f / 24) % 60)}:${pad(f % 24)}`;

  /* ---------- 2. Word split ---------- */
  /* Wraps each word in its own masked box so the headline can roll in
     word by word instead of line by line. Inner markup survives. */
  const split = (root) => {
    let i = 0;
    const box = (node) => {
      const wd = document.createElement('span');
      wd.className = 'wd';
      const inner = document.createElement('i');
      inner.appendChild(node);
      inner.style.setProperty('--i', i++);
      wd.appendChild(inner);
      return wd;
    };
    $$('.ln:not([data-nosplit])', root).forEach((ln) => {
      const out = document.createDocumentFragment();
      Array.from(ln.childNodes).forEach((node) => {
        if (node.nodeType === 3) {
          node.textContent.split(/(\s+)/).forEach((chunk) => {
            if (!chunk.trim()) { if (chunk) out.appendChild(document.createTextNode(' ')); return; }
            out.appendChild(box(document.createTextNode(chunk)));
          });
        } else {
          out.appendChild(box(node));
          out.appendChild(document.createTextNode(' '));
        }
      });
      ln.textContent = '';
      ln.appendChild(out);
    });
  };
  $$('[data-split]').forEach(split);

  /* ---------- 3. Boot ---------- */
  let booted = false;
  const boot = () => {
    if (booted) return;
    booted = true;
    document.body.classList.remove('boot');
    setTimeout(() => {
      $$('.hero [data-split], .hero .lines, .hero [data-reveal]').forEach((el) => el.classList.add('is-in'));
    }, 220);
  };
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(boot);
    setTimeout(boot, 1200);
  } else {
    addEventListener('load', boot);
  }

  /* ---------- 4. Smooth scroll ---------- */
  /* Native scroll position stays authoritative — we just ease our way
     toward it, so fixed elements, anchors and the scrollbar all behave. */
  const smooth = !reduce && fine;
  const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);

  let target = scrollY, current = scrollY, prev = scrollY, velocity = 0;

  if (smooth) {
    addEventListener('wheel', (e) => {
      if (document.body.classList.contains('is-open')) return;
      if (e.ctrlKey) return;                       // pinch-zoom
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
      target = clamp(target + e.deltaY * unit, 0, maxScroll());
    }, { passive: false });
  }

  const scrollToY = (y) => {
    y = clamp(y, 0, maxScroll());
    if (smooth) target = y;
    else scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  };

  /* ---------- 4a. Word rotor ----------
     Same motion as the framer-motion `animated-hero` component: each word sits
     absolutely in a masked box and springs to y:0 when it is the active one.
     framer's defaults are stiffness 50, damping 10, mass 1, so that is what the
     integrator below uses — the words always rise, like a drum. */
  const SPRING_K = 50, SPRING_D = 10, ROTOR_DWELL = 2400;
  const rotors = [];

  $$('[data-rotor]').forEach((rotor) => {
    const words = $$('.rotor__w', rotor);
    if (words.length < 2) return;

    const travel = () => (rotor.offsetHeight || 100) * 1.15;
    const st = words.map((el, i) => ({ el, y: i === 0 ? 0 : travel(), v: 0 }));
    let active = 0, outgoing = -1, since = 0;

    if (reduce) {
      /* cross-fade only, and slower — no vertical motion */
      words.forEach((el, i) => { el.style.opacity = i === 0 ? '1' : '0'; });
      setInterval(() => {
        active = (active + 1) % words.length;
        words.forEach((el, i) => { el.style.opacity = i === active ? '1' : '0'; });
      }, 3400);
      return;
    }

    rotors.push((dt, ms) => {
      const T = travel();
      since += ms;
      if (since >= ROTOR_DWELL) {
        since = 0;
        outgoing = active;                       // the word leaving exits upward
        active = (active + 1) % words.length;
      }

      st.forEach((s, i) => {
        /* active rises to centre, the one it replaced exits up, the rest wait below */
        const target = i === active ? 0 : (i === outgoing ? -T : T);
        const a = -SPRING_K * (s.y - target) - SPRING_D * s.v;
        s.v += a * dt;
        s.y += s.v * dt;
        /* once clear of the mask, park it underneath ready to rise again */
        if (i === outgoing && s.y <= -T * 0.98) { s.y = T; s.v = 0; outgoing = -1; }
        s.el.style.transform = `translate3d(0, ${s.y.toFixed(2)}px, 0)`;
        s.el.style.opacity = clamp(1 - Math.abs(s.y) / (T * 0.8), 0, 1).toFixed(3);
      });
    });
  });

  /* ---------- 4b. Hero ident ----------
     The sting runs once in full on arrival, then settles into a loop of its
     dark opening — the part that reads as atmosphere rather than as a second
     wordmark competing with the headline. Change data-loop-end to move the
     cut, or drop the attribute to loop the whole thing. */
  const vid = $('[data-hero-video]');
  let loopStart = 0, loopEnd = 0, firstPass = true;

  if (vid && !reduce && !(navigator.connection && navigator.connection.saveData)) {
    loopStart = parseFloat(vid.dataset.loopStart || 0);
    loopEnd = parseFloat(vid.dataset.loopEnd || 0);
    vid.addEventListener('canplay', () => vid.classList.add('is-playing'), { once: true });
    vid.addEventListener('ended', () => {          // full sting done — settle into the loop
      firstPass = false;
      vid.currentTime = loopStart;
      vid.play().catch(() => {});
    });
    const attach = () => {
      vid.src = vid.dataset.src;
      vid.play().catch(() => vid.classList.add('is-playing'));  // poster stands in if blocked
    };
    if (document.readyState === 'complete') attach();
    else addEventListener('load', attach, { once: true });
  }

  /* ---------- 5. The frame loop ---------- */
  const head       = $('#head');
  const heroStage  = $('.hero-stage');
  const hero       = $('.hero');
  const heroInner  = $('.hero__inner');
  const heroReel   = $('.hero__reel');
  const clock      = $('[data-clock]');
  const play       = $('.playhead');
  const playFill   = $('.playhead__fill');
  const playScene  = $('.playhead__scene');
  const playTc     = $('[data-page-tc]');
  const playTicks  = $('.playhead__ticks');
  const parallax   = $$('[data-par]');
  const scenes     = $$('[data-scene]');
  const mqTrack    = $('.marquee__track');

  /* ---------- 5a. Hero tilt ----------
     The `motion-tilt-card` pattern applied to the hero plate: pointer position
     maps to rotateX/rotateY, each on a spring (framer's stiffness 200 /
     damping 20). Two changes for full-bleed use — the angle is 6 rather than
     15, because at viewport scale 15 swings the edges clear out of frame, and
     only the plate tilts, never the type, which stays flat and legible. */
  const MAX_TILT = 10, TILT_K = 200, TILT_D = 20;
  const tilt = { rx: 0, ry: 0, tz: 0 };
  const tiltV = { rx: 0, ry: 0, tz: 0 };
  const tiltTo = { rx: 0, ry: 0, tz: 0 };
  let tiltOn = false;

  if (hero && vid && !reduce && fine) {
    tiltOn = true;
    hero.addEventListener('pointermove', (e) => {
      const b = hero.getBoundingClientRect();
      tiltTo.rx = MAX_TILT * (0.5 - (e.clientY - b.top) / b.height);
      tiltTo.ry = MAX_TILT * ((e.clientX - b.left) / b.width - 0.5);
    });
    hero.addEventListener('pointerenter', () => { tiltTo.tz = -18; });
    hero.addEventListener('pointerleave', () => { tiltTo.rx = tiltTo.ry = tiltTo.tz = 0; });
  }

  function stepTilt(dts) {
    /* once the hero has mostly scrolled away, let it settle back flat */
    if (scrollY > innerHeight * 0.9) { tiltTo.rx = tiltTo.ry = tiltTo.tz = 0; }
    for (const k of ['rx', 'ry', 'tz']) {
      tiltV[k] += (-TILT_K * (tilt[k] - tiltTo[k]) - TILT_D * tiltV[k]) * dts;
      tilt[k] += tiltV[k] * dts;
    }
    vid.style.setProperty('--rx', `${tilt.rx.toFixed(3)}deg`);
    vid.style.setProperty('--ry', `${tilt.ry.toFixed(3)}deg`);
    vid.style.setProperty('--tz', `${tilt.tz.toFixed(2)}px`);
  }



  /* playhead ticks — one per scene, positioned by where it sits on the page */
  let ticks = [];
  const layTicks = () => {
    if (!playTicks) return;
    const max = maxScroll() || 1;
    playTicks.innerHTML = '';
    ticks = scenes.map((sec) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.left = `${clamp((sec.offsetTop / max) * 100, 0, 100)}%`;
      b.setAttribute('aria-label', `Jump to ${sec.dataset.scene}`);
      b.addEventListener('click', () => scrollToY(sec.offsetTop));
      playTicks.appendChild(b);
      return { el: b, sec };
    });
  };
  layTicks();
  addEventListener('resize', layTicks);

  const RUNTIME = 24 * 60 * 11;     // the page reads as an 11 minute cut
  let lastScene = -1, lastHeadY = 0, mqX = 0, lastT = performance.now();
  const t0 = performance.now();

  const frame = (now) => {
    const dt = Math.min(64, now - lastT) / 16.667;
    lastT = now;

    /* --- ease toward the target ---
       While there is distance to cover we drive the page. Once settled we
       read it back, so keyboard, scrollbar, find-in-page and browser restore
       all take over cleanly instead of fighting us. */
    if (smooth) {
      const d = target - current;
      if (Math.abs(d) > 0.4) {
        current += d * (1 - Math.pow(1 - 0.11, dt));
        scrollTo(0, current);
      } else {
        current = target;
        if (Math.abs(scrollY - current) > 1) current = target = scrollY;
      }
    } else {
      current = scrollY;
    }
    velocity = current - prev;
    prev = current;

    /* --- hero exit: the page scrolls over a sticky frame --- */
    if (hero && heroStage && !reduce) {
      const span = heroStage.offsetHeight - innerHeight;
      const hp = clamp(current / (span || 1), 0, 1);
      hero.style.transform = `scale(${1 - hp * 0.09})`;
      hero.style.opacity = String(1 - hp * 0.9);
      hero.style.filter = hp > 0.01 ? `blur(${(hp * 5).toFixed(2)}px)` : '';
      if (heroInner) heroInner.style.transform = `translate3d(0, ${hp * -80}px, 0)`;
      if (heroReel) heroReel.style.transform = `translate3d(0, ${hp * 120}px, 0) scale(${1 + hp * 0.08})`;
    }

    /* --- header --- */
    if (head) {
      head.classList.toggle('is-stuck', current > 40);
      head.classList.toggle('is-hidden',
        current > innerHeight && current > lastHeadY + 3 && !head.contains(document.activeElement));
      lastHeadY = current;
    }

    /* --- parallax plates --- */
    if (!reduce) {
      for (const el of parallax) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > innerHeight + 200) continue;
        const mid = r.top + r.height / 2 - innerHeight / 2;
        el.style.setProperty('--py', `${(-mid * parseFloat(el.dataset.par || 0.12)).toFixed(1)}px`);
      }
    }

    /* --- playhead --- */
    if (play) {
      const p = clamp(current / (maxScroll() || 1), 0, 1);
      play.classList.toggle('is-live', current > innerHeight * 0.55);
      if (playFill) playFill.style.width = `${p * 100}%`;
      if (playTc) playTc.textContent = frames(Math.floor(p * RUNTIME));

      let idx = -1;
      for (let i = 0; i < scenes.length; i++) {
        if (scenes[i].getBoundingClientRect().top <= innerHeight * 0.45) idx = i; else break;
      }
      if (idx !== lastScene) {
        lastScene = idx;
        if (playScene) playScene.textContent = idx < 0 ? 'Intelligent series production' : scenes[idx].dataset.scene;
        ticks.forEach((t, i) => t.el.setAttribute('aria-current', String(i === idx)));
      }
    }

    /* --- marquee reacts to scroll speed --- */
    if (mqTrack && !reduce) {
      mqX -= (0.55 + Math.min(6, Math.abs(velocity) * 0.09)) * dt;
      if (mqX <= -mqTrack.scrollWidth / 2) mqX = 0;
      mqTrack.style.transform = `translate3d(${mqX.toFixed(1)}px,0,0)`;
    }

    /* --- hero ident: cut back to the dark opening, and idle it offscreen --- */
    if (vid && loopEnd) {
      if (!firstPass && (vid.currentTime >= loopEnd || vid.currentTime < loopStart - 0.1)) {
        vid.currentTime = loopStart;
      }
      const off = current > innerHeight * 1.35;
      if (off && !vid.paused) vid.pause();
      else if (!off && vid.paused && vid.src) vid.play().catch(() => {});
    }

    /* --- hero tilt --- */
    if (tiltOn) stepTilt(Math.min(64, dt * 16.667) / 1000);

    /* --- word rotor --- */
    if (rotors.length) {
      const ms = Math.min(64, dt * 16.667);
      const secs = ms / 1000;
      for (const r of rotors) r(secs, ms);
    }

    /* --- recording clock --- */
    if (clock && !reduce) clock.textContent = frames(Math.floor(((now - t0) / 1000) * 24));

    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  /* ---------- 6. Reveal + count-up ---------- */
  const countUp = (el) => {
    const to = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.dec || 0, 10);
    const suffix = el.dataset.suffix || '';
    const dur = 1100, start = performance.now();
    const step = (t) => {
      const k = clamp((t - start) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = (to * eased).toFixed(dec) + suffix;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const targets = $$('[data-reveal], .lines, [data-split], .plot, .scrub, .plate, .pos');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        $$('[data-count]', e.target).forEach(countUp);
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    targets.forEach((t) => { if (!t.closest('.hero')) io.observe(t); });
  } else {
    targets.forEach((t) => t.classList.add('is-in'));
    $$('[data-count]').forEach((el) => {
      el.textContent = parseFloat(el.dataset.count).toFixed(parseInt(el.dataset.dec || 0, 10)) + (el.dataset.suffix || '');
    });
  }

  /* ---------- 7. Frame scrub ---------- */
  $$('[data-scrub]').forEach((rig) => {
    const shots = $$('.scrub__frames img', rig);
    const fill  = $('.scrub__fill', rig);
    const out   = $('[data-tc-out]', rig);
    const caret = $('.scrub__cursor', rig);
    const marks = $('.scrub__ticks', rig);
    if (!shots.length) return;

    marks.innerHTML = shots.map(() => '<i></i>').join('');

    let index = 0;
    const show = (i, ratio) => {
      i = clamp(i, 0, shots.length - 1);
      if (i !== index) {
        shots[index].classList.remove('is-on');
        shots[i].classList.add('is-on');
        index = i;
      }
      const r = ratio ?? (shots.length > 1 ? i / (shots.length - 1) : 0);
      fill.style.width = `${r * 100}%`;
      if (caret) caret.style.left = `${r * 100}%`;
      if (out) out.textContent = shots[i].dataset.tc || '';
    };
    const fromPointer = (e) => {
      const b = rig.getBoundingClientRect();
      const r = clamp((e.clientX - b.left) / b.width, 0, 1);
      show(Math.round(r * (shots.length - 1)), r);
    };

    rig.addEventListener('pointerenter', () => rig.classList.add('is-live'));
    rig.addEventListener('pointerleave', () => rig.classList.remove('is-live'));
    rig.addEventListener('pointermove', fromPointer);
    rig.addEventListener('pointerdown', (e) => { rig.setPointerCapture?.(e.pointerId); fromPointer(e); });
    rig.addEventListener('touchmove', (e) => {
      if (!e.touches[0]) return;
      rig.classList.add('is-live');
      fromPointer(e.touches[0]);
    }, { passive: true });
    rig.addEventListener('focus', () => rig.classList.add('is-live'));
    rig.addEventListener('blur',  () => rig.classList.remove('is-live'));
    rig.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { show(index + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft')  { show(index - 1); e.preventDefault(); }
      if (e.key === 'Home')       { show(0); e.preventDefault(); }
      if (e.key === 'End')        { show(shots.length - 1); e.preventDefault(); }
    });

    show(0);

    if (!reduce) {
      const auto = setInterval(() => show((index + 1) % shots.length), 2600);
      ['pointerenter', 'touchstart', 'focus'].forEach((ev) =>
        rig.addEventListener(ev, () => clearInterval(auto), { once: true, passive: true }));
    }
  });

  /* ---------- 7b. Episode screen ----------
     The file is only fetched when someone asks for it, so the card costs
     nothing to anyone who scrolls past. */
  $$('[data-screen]').forEach((screen) => {
    const v = $('.screen__v', screen);
    const btn = $('.screen__play', screen);
    if (!v || !btn) return;

    btn.addEventListener('click', () => {
      if (!v.src) v.src = v.dataset.src;
      v.controls = true;
      screen.classList.add('is-live');
      v.play().catch(() => { v.controls = true; });
    });

    /* stop it when it scrolls away rather than letting it play to nobody */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (!e.isIntersecting && !v.paused) v.pause(); });
      }, { threshold: 0.15 }).observe(screen);
    }
  });

  /* ---------- 8. Menu ---------- */
  const menuBtn = $('.head__menu');
  const menu = $('#menu');
  if (menuBtn && menu) {
    menu.hidden = false;
    const setMenu = (open) => {
      document.body.classList.toggle('is-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      $('.label', menuBtn).textContent = open ? 'Close' : 'Menu';
    };
    menuBtn.addEventListener('click', () => setMenu(!document.body.classList.contains('is-open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  }

  /* ---------- 9. Form + misc ---------- */
  const form = $('#brief');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const missing = $$('[required]', form).filter((f) => !f.value.trim());
      if (missing.length) { missing[0].focus(); return; }
      /* Wire this to your endpoint — see README. */
      form.classList.add('is-sent');
    });
  }

  const yr = $('[data-year]');
  if (yr) yr.textContent = String(new Date().getFullYear());

  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      scrollToY(id === '#top' ? 0 : t.offsetTop);
      history.replaceState(null, '', id);
    });
  });
})();
