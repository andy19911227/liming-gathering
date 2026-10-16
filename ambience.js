/* Original procedural score: Dawn / 黎明. No recordings, network or dependencies. */
(() => {
  'use strict';
  const panel = document.querySelector('.ambience');
  const play = document.querySelector('#music-toggle');
  const label = play.querySelector('.music-label');
  const volume = document.querySelector('#music-volume');
  const output = document.querySelector('#volume-value');
  const status = document.querySelector('#music-status');
  const motion = document.querySelector('#motion-toggle');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  let ctx, master, timer = null, playing = false, busy = false, next = 0, bar = 0;
  const voices = new Set();
  const chords = [[48,55,59,64], [45,52,55,60], [41,48,55,57], [43,50,57,62]];
  const melody = [[76,79,74], [72,76,71], [69,72,67], [74,71,67]];
  const hz = midi => 440 * 2 ** ((midi - 69) / 12);
  const level = () => Number(volume.value) / 100 * 0.48;
  function ui(message) {
    play.setAttribute('aria-pressed', String(playing));
    label.textContent = playing ? '暫停音樂' : '播放音樂';
    panel.classList.toggle('is-playing', playing);
    status.textContent = message;
  }
  function note(midi, start, duration, gain, type, pan) {
    const osc = ctx.createOscillator(), env = ctx.createGain();
    const stereo = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.type = type; osc.frequency.value = hz(midi);
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(gain, start + Math.min(0.7, duration / 4));
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env);
    if (stereo) { stereo.pan.value = pan; env.connect(stereo); stereo.connect(master); }
    else env.connect(master);
    voices.add(osc);
    osc.onended = () => { voices.delete(osc); osc.disconnect(); env.disconnect(); if (stereo) stereo.disconnect(); };
    osc.start(start); osc.stop(start + duration + 0.05);
  }
  function schedule() {
    if (!playing) return;
    while (next < ctx.currentTime + 0.4) {
      const i = bar % 4;
      chords[i].forEach((midi, n) => note(midi, next + n * 0.12, 6.7, 0.07, 'sine', (n - 1.5) * 0.3));
      melody[i].forEach((midi, n) => {
        note(midi, next + 0.8 + n * 1.6, 2.8, 0.045, 'sine', n % 2 ? 0.25 : -0.25);
        note(midi + 12, next + 0.8 + n * 1.6, 1.5, 0.006, 'sine', 0);
      });
      next += 6.4; bar++;
    }
  }
  function clearVoices() {
    voices.forEach(osc => { try { osc.stop(); } catch (_) {} });
    voices.clear();
  }
  async function stop(message, immediate = false) {
    playing = false; clearInterval(timer); timer = null;
    ui(message);
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    if (immediate) master.gain.setValueAtTime(0, t);
    else {
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 0.35);
      await new Promise(resolve => setTimeout(resolve, 380));
    }
    clearVoices();
    await ctx.suspend();
  }
  play.addEventListener('click', async () => {
    if (busy) return;
    busy = true; play.disabled = true;
    try {
      if (playing) await stop('音樂已暫停。想聽時，再按播放。');
      else {
        // Context is created only inside this explicit user activation.
        if (!ctx) {
          const Audio = window.AudioContext || window.webkitAudioContext;
          ctx = new Audio(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
          ctx.addEventListener('statechange', () => {
            if (playing && ctx.state !== 'running' && !busy) {
              stop('音樂已被瀏覽器暫停，請按播放繼續。', true).catch(fail);
            }
          });
        }
        await ctx.resume();
        if (document.hidden) { await stop('離開分頁時已暫停，請按播放繼續。', true); return; }
        if (ctx.state !== 'running') throw new Error('Audio unavailable');
        playing = true; next = ctx.currentTime + 0.08; bar = 0;
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(0, ctx.currentTime);
        master.gain.linearRampToValueAtTime(level(), ctx.currentTime + 1.2);
        schedule(); timer = setInterval(schedule, 200);
        ui('正在播放「黎明」原創環境配樂 · 柔和和弦與稀疏旋律');
      }
    } catch (_) { fail(); }
    finally { busy = false; play.disabled = false; }
  });
  function fail() {
    playing = false; clearInterval(timer); timer = null; clearVoices();
    if (master && ctx) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.value = 0; }
    if (ctx) ctx.suspend().catch(() => {});
    ui('音樂暫時無法播放；可再試一次或改用較新的瀏覽器。');
  }
  volume.addEventListener('input', () => {
    output.value = volume.value + '%';
    if (playing) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(level(), ctx.currentTime, 0.1); }
  });
  const leave = () => { if (playing) stop('離開分頁時已暫停，回來後請按播放。', true).catch(fail); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) leave(); });
  window.addEventListener('pagehide', leave);
  function motionUI(paused) {
    root.classList.toggle('motion-paused', paused);
    motion.setAttribute('aria-pressed', String(paused));
    motion.textContent = reduced.matches ? '已減少動畫（系統設定）' : paused ? '繼續動畫' : '暫停動畫';
    motion.disabled = reduced.matches;
    document.querySelectorAll('.pond-ripple').forEach(el => el.remove());
  }
  motionUI(reduced.matches);
  motion.addEventListener('click', () => motionUI(!root.classList.contains('motion-paused')));
  reduced.addEventListener('change', () => motionUI(reduced.matches));
  const pond = document.querySelector('.water');
  pond.removeAttribute('aria-hidden');
  Array.from(pond.children).forEach(el => el.setAttribute('aria-hidden', 'true'));
  const touch = document.createElement('button');
  touch.type = 'button'; touch.className = 'pond-touch'; touch.textContent = '輕點水面 · 泛起微光';
  pond.append(touch);
  touch.addEventListener('click', () => {
    if (reduced.matches || root.classList.contains('motion-paused')) return;
    if (pond.querySelectorAll('.pond-ripple').length >= 3) return;
    const ring = document.createElement('span');
    ring.className = 'pond-ripple'; ring.setAttribute('aria-hidden', 'true');
    ring.style.left = '50%'; ring.style.top = '72%'; pond.append(ring);
    ring.addEventListener('animationend', () => ring.remove(), {once:true});
  });
  if (!(window.AudioContext || window.webkitAudioContext)) {
    play.disabled = true; volume.disabled = true;
    ui('此瀏覽器不支援背景音樂；仍可完整瀏覽網站。');
  }
  panel.hidden = false;
})();
