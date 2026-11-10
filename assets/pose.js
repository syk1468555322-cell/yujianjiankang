/* ===== 支线：姿势小游戏「把手机放对位置」 =====
   侧面视角的拖动小游戏：拖动手机，改变"低头角度"与"眼屏距离"，
   两项目标同时满足才过关。纯前端 Canvas-free 实现，不依赖 React 状态。
   ================================================ */
(function () {
  'use strict';

  var KEY = 'yujian-pose-v1';

  /* ---------- 几何（舞台坐标系 340 x 300） ---------- */
  var W = 340;
  var H = 300;
  var EYE = { x: 80, y: 68 };
  var BOX = { x0: 175, y0: 62, x1: 320, y1: 175 };
  var START = { x: 172, y: 175 };
  var BEST = { x: 300, y: 118 };

  var PASS_ANGLE = 22; /* 视线向下角度上限 */
  var PASS_CM = 28; /* 眼屏距离下限 */
  var PX_CM = 0.2; /* 1 舞台像素约 2mm */

  var mask = null;
  var phone = null;
  var parts = null;
  var pos = { x: START.x, y: START.y };
  var locked = false;

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function geo(p) {
    var dx = p.x - EYE.x;
    var dy = p.y - EYE.y;
    var dist = Math.sqrt(dx * dx + dy * dy) || 1;
    var ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (ang < 0) ang = 0;
    return { dx: dx, dy: dy, dist: dist, cm: dist * PX_CM, ang: ang };
  }

  function stateOf(g) {
    if (g.ang > 42) {
      return { k: 'low', color: '#b4472f', text: '这样太低。颈部要一直用力稳住头，看久了就僵。' };
    }
    if (g.ang > PASS_ANGLE) {
      return { k: 'mid', color: '#a9761c', text: '还是偏低。把屏幕再抬高一点，让上沿接近视线。' };
    }
    if (g.cm < PASS_CM) {
      return { k: 'near', color: '#2155dc', text: '角度够了，但离得太近。往后放一些，留出一臂的距离。' };
    }
    return { k: 'ok', color: '#3f7a52', text: '这个位置，不用低头也能看清。' };
  }

  function readDone() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || 'null');
      return !!(o && o.done);
    } catch (e) {
      return false;
    }
  }

  function saveDone(best) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ done: 1, best: Math.round(best), at: Date.now() }));
    } catch (e) {
      /* 隐私模式下写不进去，不影响本次体验 */
    }
  }

  /* ---------- 场景 SVG ---------- */
  function sceneSVG() {
    return (
      '<svg class="pose-scene" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' +
      '<line x1="0" y1="292" x2="340" y2="292" stroke="#e2e8dd" stroke-width="2"/>' +
      /* 凳子 */
      '<rect x="24" y="206" width="102" height="9" rx="4.5" fill="#cdd9c8"/>' +
      '<line x1="40" y1="215" x2="35" y2="291" stroke="#cdd9c8" stroke-width="7" stroke-linecap="round"/>' +
      '<line x1="112" y1="215" x2="117" y2="291" stroke="#cdd9c8" stroke-width="7" stroke-linecap="round"/>' +
      /* 桌子 */
      '<line x1="140" y1="178" x2="137" y2="291" stroke="#e4eae0" stroke-width="9" stroke-linecap="round"/>' +
      '<line x1="312" y1="178" x2="315" y2="291" stroke="#e4eae0" stroke-width="9" stroke-linecap="round"/>' +
      '<rect x="118" y="169" width="222" height="9" rx="4" fill="#e4eae0"/>' +
      /* 小腿 / 大腿 / 躯干 */
      '<line x1="151" y1="207" x2="156" y2="286" stroke="#a9bda6" stroke-width="17" stroke-linecap="round"/>' +
      '<line x1="156" y1="288" x2="170" y2="288" stroke="#a9bda6" stroke-width="13" stroke-linecap="round"/>' +
      '<line x1="50" y1="205" x2="151" y2="205" stroke="#a9bda6" stroke-width="19" stroke-linecap="round"/>' +
      '<line x1="52" y1="114" x2="44" y2="201" stroke="#a9bda6" stroke-width="26" stroke-linecap="round"/>' +
      /* 颈（随低头动态） */
      '<line class="pose-neck" x1="57" y1="92" x2="52" y2="116" stroke="#b9cbb6" stroke-width="13" stroke-linecap="round"/>' +
      /* 头（随低头旋转） */
      '<g class="pose-head" transform="rotate(0 58 96)">' +
      '<circle cx="57" cy="74" r="21" fill="#b9cbb6"/>' +
      '<path d="M48 58 a21 21 0 0 1 13 -3 l1 9 a12 12 0 0 0 -11 4z" fill="#a2b99f"/>' +
      '<circle cx="70" cy="72" r="2.4" fill="#33423b"/>' +
      '<circle cx="70" cy="72" r="6.4" fill="none" stroke="#33423b" stroke-width="1.5" opacity=".55"/>' +
      '<path d="M74 78 l6 3.4 l-6 3.2z" fill="#a2b99f"/>' +
      '<path d="M68 87 q4 2.2 7 0" stroke="#9db59a" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '</g>' +
      /* 水平参考线 + 视线 + 角度弧 */
      '<line class="pose-level" x1="90" y1="68" x2="150" y2="68" stroke="#c9d5c6" stroke-width="1.5" stroke-dasharray="4 5"/>' +
      '<line class="pose-sight" x1="80" y1="68" x2="200" y2="178" stroke="#8ba392" stroke-width="1.6" stroke-dasharray="5 5"/>' +
      '<path class="pose-arc" d="" fill="none" stroke="#a9761c" stroke-width="2.2" stroke-linecap="round"/>' +
      /* 手机架：手机离开桌面时才出现，暗示"垫高"这件事 */
      '<g class="pose-stand" style="display:none">' +
      '<line class="pose-stand-bar" x1="300" y1="148" x2="300" y2="169" stroke="#b3c1af" stroke-width="4" stroke-linecap="round"/>' +
      '<line class="pose-stand-base" x1="289" y1="170" x2="311" y2="170" stroke="#b3c1af" stroke-width="4.5" stroke-linecap="round"/>' +
      '</g>' +
      '</svg>'
    );
  }

  function phoneSVG() {
    return (
      '<svg viewBox="0 0 28 48" aria-hidden="true">' +
      '<rect x="1" y="1" width="26" height="46" rx="5" fill="#2c3b35"/>' +
      '<rect x="3.4" y="4.6" width="21.2" height="34.8" rx="2" fill="#dcefe2"/>' +
      '<line x1="8" y1="12" x2="20" y2="12" stroke="#93b19c" stroke-width="2" stroke-linecap="round"/>' +
      '<line x1="8" y1="17" x2="17" y2="17" stroke="#93b19c" stroke-width="2" stroke-linecap="round"/>' +
      '<line x1="8" y1="22" x2="19" y2="22" stroke="#c3d8c9" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="14" cy="43.4" r="1.7" fill="#6c7e75"/>' +
      '</svg>'
    );
  }

  function cardHTML() {
    return (
      '<div class="pose-card" role="dialog" aria-modal="true" aria-labelledby="pose-title">' +
      '<button type="button" class="pose-close" aria-label="关闭">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      '</button>' +
      '<p class="pose-eyebrow">SIDE QUEST · 姿势小游戏</p>' +
      '<h2 class="pose-title" id="pose-title">把手机放对位置</h2>' +
      '<p class="pose-sub">拖动画面里的手机，让这个人不用低头也能看清屏幕。</p>' +
      '<div class="pose-stage">' +
      sceneSVG() +
      '<div class="pose-phone" tabindex="0" role="slider" aria-label="手机位置" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
      phoneSVG() +
      '<span class="pose-drag-tip" aria-hidden="true">拖动</span>' +
      '</div>' +
      '</div>' +
      '<div class="pose-read">' +
      '<span class="pose-angle">低头 43°</span>' +
      '<span class="pose-sep">·</span>' +
      '<span class="pose-dist">距眼 33cm</span>' +
      '</div>' +
      '<p class="pose-hint">这样太低。颈部要一直用力稳住头，看久了就僵。</p>' +
      '<button type="button" class="pose-skip">直接看标准位置</button>' +
      '<div class="pose-done" hidden>' +
      '<p class="pose-done-title">摆对了</p>' +
      '<p class="pose-done-text">屏幕略低于视线、离眼睛约一臂（35–45cm）时，颈部几乎不用低头。</p>' +
      '<p class="pose-note">低头角度越大，颈部肌肉要出的力成倍增加：低头 60° 时，颈椎承受的负荷约为头重的 5 倍（Hansraj 2014）。所以先把屏幕抬起来，比事后拉伸更省力。</p>' +
      '<button type="button" class="pose-again">再玩一次</button>' +
      '</div>' +
      '</div>'
    );
  }

  /* ---------- 渲染 ---------- */
  function arcPath(g) {
    var r = Math.min(46, Math.max(24, g.dist * 0.5));
    var deg = Math.max(4, g.ang);
    var rad = (deg * Math.PI) / 180;
    var x1 = EYE.x + r;
    var y1 = EYE.y;
    var x2 = EYE.x + r * Math.cos(rad);
    var y2 = EYE.y + r * Math.sin(rad);
    return 'M' + x1.toFixed(1) + ' ' + y1 + 'A' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 0 1 ' + x2.toFixed(1) + ' ' + y2.toFixed(1);
  }

  function paint() {
    if (!parts) return;
    var g = geo(pos);
    var st = stateOf(g);

    phone.style.left = ((pos.x / W) * 100).toFixed(2) + '%';
    phone.style.top = ((pos.y / H) * 100).toFixed(2) + '%';

    var rot = g.dy > 0 ? clamp(g.ang * 0.5, 0, 28) : clamp(g.dy * 0.4, -9, 0);
    parts.head.setAttribute('transform', 'rotate(' + rot.toFixed(1) + ' 58 96)');

    /* 颈部跟头一起微微弯 */
    var nx = (52 + (rot > 0 ? -rot * 0.06 : 0)).toFixed(1);
    parts.neck.setAttribute('x2', nx);

    parts.sight.setAttribute('x2', pos.x.toFixed(1));
    parts.sight.setAttribute('y2', pos.y.toFixed(1));
    parts.arc.setAttribute('d', arcPath(g));
    parts.arc.setAttribute('stroke', st.color);
    parts.arc.style.display = g.ang < 6 ? 'none' : '';

    /* 手机离开桌面就把支架画出来，让"垫高"这件事看起来是可行的 */
    var phoneBottom = pos.y + 30;
    var deskTop = 169;
    if (phoneBottom < deskTop - 14) {
      parts.stand.style.display = '';
      parts.standBar.setAttribute('x1', pos.x.toFixed(1));
      parts.standBar.setAttribute('x2', pos.x.toFixed(1));
      parts.standBar.setAttribute('y1', phoneBottom.toFixed(1));
      parts.standBar.setAttribute('y2', (deskTop - 1).toFixed(1));
      parts.standBase.setAttribute('x1', (pos.x - 11).toFixed(1));
      parts.standBase.setAttribute('x2', (pos.x + 11).toFixed(1));
    } else {
      parts.stand.style.display = 'none';
    }

    parts.angle.textContent = g.ang < 4 ? '基本平视' : '低头 ' + Math.round(g.ang) + '°';
    parts.dist.textContent = '距眼 ' + Math.round(g.cm) + 'cm';
    parts.hint.textContent = st.text;
    parts.hint.style.color = st.color;
    parts.read.style.color = st.color;

    phone.setAttribute('aria-valuenow', String(Math.round(((pos.x - BOX.x0) / (BOX.x1 - BOX.x0)) * 100)));
    phone.setAttribute('aria-valuetext', '低头 ' + Math.round(g.ang) + ' 度，距眼 ' + Math.round(g.cm) + ' 厘米');

    if (st.k === 'ok' && !locked) win(g);
  }

  function win(g) {
    locked = true;
    if (!mask) return;
    mask.querySelector('.pose-card').classList.add('is-win');
    mask.querySelector('.pose-done').hidden = false;
    mask.querySelector('.pose-skip').hidden = true;
    phone.classList.add('is-best');
    pos.x = BEST.x;
    pos.y = BEST.y;
    paint();
    saveDone(geo(pos).ang);
    refreshEntry();
    try {
      navigator.vibrate && navigator.vibrate(18);
    } catch (e) {}
  }

  function moveTo(x, y, animate) {
    pos.x = clamp(x, BOX.x0, BOX.x1);
    pos.y = clamp(y, BOX.y0, BOX.y1);
    if (animate) phone.classList.add('is-anim');
    else phone.classList.remove('is-anim');
    paint();
  }

  /* ---------- 拖动 ---------- */
  function toStage(clientX, clientY) {
    var r = phone.parentNode.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * W,
      y: ((clientY - r.top) / r.height) * H
    };
  }

  function bindDrag() {
    var dragging = false;
    var off = { x: 0, y: 0 };

    function down(e) {
      if (locked) return;
      dragging = true;
      var p = toStage(e.clientX, e.clientY);
      off.x = pos.x - p.x;
      off.y = pos.y - p.y;
      phone.classList.remove('is-anim');
      phone.classList.add('is-grab');
      mask.querySelector('.pose-drag-tip').hidden = true;
      if (e.cancelable) e.preventDefault();
    }

    function move(e) {
      if (!dragging || locked) return;
      var p = toStage(e.clientX, e.clientY);
      moveTo(p.x + off.x, p.y + off.y, false);
      if (e.cancelable) e.preventDefault();
    }

    function up() {
      dragging = false;
      phone.classList.remove('is-grab');
    }

    if (window.PointerEvent) {
      phone.addEventListener('pointerdown', function (e) {
        down(e);
        try {
          phone.setPointerCapture(e.pointerId);
        } catch (x) {}
      });
      phone.addEventListener('pointermove', move);
      phone.addEventListener('pointerup', up);
      phone.addEventListener('pointercancel', up);
    } else {
      phone.addEventListener(
        'touchstart',
        function (e) {
          down(e.touches[0]);
        },
        { passive: false }
      );
      phone.addEventListener(
        'touchmove',
        function (e) {
          move(e.touches[0]);
        },
        { passive: false }
      );
      phone.addEventListener('touchend', up);
      phone.addEventListener('mousedown', down);
      document.addEventListener('mousemove', function (e) {
        if (dragging) move(e);
      });
      document.addEventListener('mouseup', up);
    }

    /* 键盘也能玩：方向键微调，Shift 加速 */
    phone.addEventListener('keydown', function (e) {
      if (locked) return;
      var step = e.shiftKey ? 12 : 4;
      var handled = true;
      if (e.key === 'ArrowLeft') moveTo(pos.x - step, pos.y, false);
      else if (e.key === 'ArrowRight') moveTo(pos.x + step, pos.y, false);
      else if (e.key === 'ArrowUp') moveTo(pos.x, pos.y - step, false);
      else if (e.key === 'ArrowDown') moveTo(pos.x, pos.y + step, false);
      else handled = false;
      if (handled) e.preventDefault();
    });
  }

  /* ---------- 弹层 ---------- */
  function open() {
    if (mask) return;
    mask = document.createElement('div');
    mask.className = 'pose-mask';
    mask.innerHTML = cardHTML();
    document.body.appendChild(mask);

    var card = mask.querySelector('.pose-card');
    phone = mask.querySelector('.pose-phone');
    parts = {
      head: mask.querySelector('.pose-head'),
      neck: mask.querySelector('.pose-neck'),
      sight: mask.querySelector('.pose-sight'),
      arc: mask.querySelector('.pose-arc'),
      angle: mask.querySelector('.pose-angle'),
      dist: mask.querySelector('.pose-dist'),
      hint: mask.querySelector('.pose-hint'),
      read: mask.querySelector('.pose-read'),
      stand: mask.querySelector('.pose-stand'),
      standBar: mask.querySelector('.pose-stand-bar'),
      standBase: mask.querySelector('.pose-stand-base')
    };

    locked = false;
    pos = { x: START.x, y: START.y };
    mask.querySelector('.pose-done').hidden = true;
    mask.querySelector('.pose-skip').hidden = false;
    card.classList.remove('is-win');

    bindDrag();
    paint();

    mask.querySelector('.pose-close').addEventListener('click', close);
    mask.addEventListener('click', function (e) {
      if (e.target === mask) close();
    });
    mask.querySelector('.pose-skip').addEventListener('click', function () {
      if (locked) return;
      pos.x = BEST.x;
      pos.y = BEST.y;
      phone.classList.add('is-anim');
      paint();
    });
    mask.querySelector('.pose-again').addEventListener('click', function () {
      locked = false;
      pos = { x: START.x, y: START.y };
      card.classList.remove('is-win');
      mask.querySelector('.pose-done').hidden = true;
      mask.querySelector('.pose-skip').hidden = false;
      phone.classList.remove('is-best');
      paint();
    });

    document.addEventListener('keydown', escClose);
  }

  function escClose(e) {
    if (e.key === 'Escape') close();
  }

  function close() {
    document.removeEventListener('keydown', escClose);
    if (mask && mask.parentNode) mask.parentNode.removeChild(mask);
    mask = null;
    phone = null;
    parts = null;
  }

  /* ---------- 样式 ---------- */
  function injectStyle() {
    if (document.getElementById('fix-pose-style')) return;
    var css = [
      '.pose-mask{position:fixed;inset:0;z-index:80;display:flex;align-items:flex-end;justify-content:center;',
      'background:rgba(16,31,25,.46);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}',
      '.pose-card{position:relative;width:100%;max-width:430px;max-height:92vh;overflow-y:auto;-webkit-overflow-scrolling:touch;',
      'background:#f7f9f2;border-radius:22px 22px 0 0;padding:22px 18px calc(20px + env(safe-area-inset-bottom,0px));',
      'box-shadow:0 -8px 32px rgba(16,31,25,.18);animation:poseUp .26s ease-out}',
      '@keyframes poseUp{from{transform:translateY(24px);opacity:.6}to{transform:none;opacity:1}}',
      '.pose-close{position:absolute;top:10px;right:10px;width:40px;height:40px;display:flex;align-items:center;',
      'justify-content:center;border:0;border-radius:50%;background:#eaefe3;color:#3c4a43;cursor:pointer}',
      '.pose-close:active{background:#dde5d5}',
      '.pose-eyebrow{font-size:11px;letter-spacing:.16em;font-weight:800;color:#657265;margin:0 52px 6px 0}',
      '.pose-title{font-size:21px;font-weight:800;color:#17251f;margin:0 0 6px;line-height:1.3}',
      '.pose-sub{font-size:13.5px;line-height:1.6;color:#4f6058;margin:0 0 14px}',
      '.pose-stage{position:relative;width:100%;aspect-ratio:340/300;border-radius:16px;overflow:hidden;',
      'background:linear-gradient(180deg,#f2f6ec 0%,#eaf0e4 100%);border:1px solid #e0e7db;touch-action:pan-y}',
      '.pose-scene{position:absolute;inset:0;width:100%;height:100%;display:block}',
      '.pose-phone{position:absolute;left:50.6%;top:58.3%;width:10%;aspect-ratio:28/48;transform:translate(-50%,-50%);',
      'cursor:grab;touch-action:none;filter:drop-shadow(0 4px 6px rgba(23,37,31,.22));',
      'display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent}',
      '.pose-phone svg{width:100%;height:100%;display:block}',
      '.pose-phone.is-grab{cursor:grabbing}',
      '.pose-phone.is-anim{transition:left .42s cubic-bezier(.3,.9,.3,1),top .42s cubic-bezier(.3,.9,.3,1)}',
      '.pose-phone.is-best{filter:drop-shadow(0 0 8px rgba(63,122,82,.55))}',
      '.pose-phone:focus-visible{outline:2px solid #2155dc;outline-offset:6px;border-radius:6px}',
      '.pose-drag-tip{position:absolute;left:50%;bottom:calc(100% + 4px);transform:translateX(-50%);',
      'font-size:10px;font-weight:800;color:#3f5a46;background:#fff;border-radius:99px;padding:2px 7px;',
      'white-space:nowrap;box-shadow:0 2px 6px rgba(23,37,31,.14);animation:poseBob 1.6s ease-in-out infinite}',
      '@keyframes poseBob{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-3px)}}',
      '.pose-read{display:flex;align-items:center;justify-content:center;gap:8px;margin:12px 0 6px;',
      'font-size:14px;font-weight:800;font-variant-numeric:tabular-nums;color:#a9761c;transition:color .2s}',
      '.pose-sep{opacity:.4}',
      '.pose-hint{margin:0 0 12px;font-size:13px;line-height:1.6;text-align:center;min-height:42px;color:#a9761c}',
      '.pose-skip{display:block;margin:0 auto 4px;padding:10px 14px;border:0;background:none;color:#657265;',
      'font-size:12.5px;text-decoration:underline;text-underline-offset:3px;cursor:pointer;min-height:40px}',
      '.pose-done{margin-top:4px;padding:14px 14px 12px;border-radius:14px;background:#eef3e9;border:1px solid #d9e4d4}',
      '.pose-done[hidden]{display:none}',
      '.pose-done-title{margin:0 0 4px;font-size:15px;font-weight:800;color:#3f7a52}',
      '.pose-done-text{margin:0 0 8px;font-size:13px;line-height:1.6;color:#33423b}',
      '.pose-note{margin:0 0 12px;font-size:12px;line-height:1.65;color:#5f6d64}',
      '.pose-again{display:block;width:100%;min-height:44px;border-radius:12px;border:1.5px solid #b7c9b4;',
      'background:#fff;color:#3f5a46;font-size:14px;font-weight:800;cursor:pointer}',
      '.is-win .pose-hint{color:#3f7a52}',
      '.fix-pose-entry{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:48px;',
      'margin:12px 0;border-radius:14px;border:1.5px dashed #b7c9b4;background:#f7faf3;color:#3f5a46;',
      'font-size:15px;font-weight:800;cursor:pointer}',
      '.fix-pose-entry.is-done{border-style:solid;background:#eef3e9;color:#3f7a52}',
      '.fix-pose-entry .pose-tag{font-size:11px;font-weight:800;letter-spacing:.06em;background:#dfeadd;',
      'color:#3f7a52;border-radius:99px;padding:2px 7px}',
      '@media (prefers-reduced-motion:reduce){.pose-card{animation:none}.pose-drag-tip{animation:none}}',
      '.pose-phone.is-anim{will-change:left,top}'
    ].join('');
    var s = document.createElement('style');
    s.id = 'fix-pose-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---------- 入口 ---------- */
  function entryOf() {
    return document.querySelector('.fix-pose-entry');
  }

  function refreshEntry(el) {
    var b = el || entryOf();
    if (!b) return;
    var done = readDone();
    b.classList.toggle('is-done', done);
    b.innerHTML =
      '<span>' + (done ? '姿势小游戏已通关' : '支线 · 把手机放对位置') + '</span>' +
      '<span class="pose-tag">' + (done ? '✓' : '小游戏') + '</span>';
  }

  function buildEntry() {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'fix-pose-entry';
    b.addEventListener('click', open);
    refreshEntry(b);
    return b;
  }

  /* 第 5 站的找茬没做完之前不插支线，免得把主任务打断 */
  function cluesDone() {
    var t = document.body.textContent || '';
    return t.indexOf('三个细节都找到了') >= 0 || t.indexOf('已发现 3 / 3') >= 0;
  }

  function addEntry() {
    if (entryOf()) return;
    var btns = document.querySelectorAll('button');
    var anchor = null;
    var after = null;

    for (var i = 0; i < btns.length; i++) {
      if ((btns[i].textContent || '').trim() === '领取通关纪念') {
        anchor = btns[i];
        break;
      }
    }
    if (anchor && !cluesDone()) return;
    if (!anchor) {
      after = document.querySelector('.fix-report-entry');
      if (after) anchor = after;
    }
    if (!anchor || !anchor.parentNode) return;

    var b = buildEntry();
    if (after) anchor.parentNode.insertBefore(b, anchor.nextSibling);
    else anchor.parentNode.insertBefore(b, anchor);
  }

  function boot() {
    injectStyle();
    addEntry();
    var timer = 0;
    new MutationObserver(function () {
      if (entryOf()) return;
      if (timer) return;
      timer = setTimeout(function () {
        timer = 0;
        addEntry();
      }, 320);
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
