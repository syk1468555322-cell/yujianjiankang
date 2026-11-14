/* ===== 体验修复补丁 v1（运行时增强） =====
   1. 动作演示视频：补封面帧 + 自动播放失败时给出可点的播放按钮
   2. 弹层无障碍：补 aria-modal / aria-labelledby，关闭按钮改中文
   3. 弹层滚动锁的兜底（不支持 :has 的浏览器）
   ================================================= */
(function () {
  'use strict';

  /* ---------- 视频 ---------- */
  /* 站点网关不支持 HTTP Range（返回 200 全量、无 Accept-Ranges），
     移动端播放器取不到元数据就会长时间转圈。这里把内联的四个视频转成
     Blob URL 直接喂给 <video>：不走网络、不依赖 Range，点开即出画面。 */
  var blobMap = Object.create(null);
  var blobReady = false;

  function b64ToBlob(b64) {
    var bin = atob(b64);
    var n = bin.length;
    var u8 = new Uint8Array(n);
    for (var i = 0; i < n; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: 'video/mp4' });
  }

  function buildBlobs() {
    if (blobReady) return;
    var raw = window.__FIX_VIDEOS;
    /* 内联数据是 async 加载的，可能晚于本脚本到达；没到就等事件，不占位 */
    if (!raw || !window.Blob || !window.URL || !URL.createObjectURL) return;
    blobReady = true;
    for (var k in raw) {
      if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
      try {
        blobMap[k] = URL.createObjectURL(b64ToBlob(raw[k]));
      } catch (e) {
        /* 解码失败就退回原地址，不影响播放 */
      }
    }
    /* 地址已就绪，把页面上已有的 <video> 也换成内存版本 */
    Array.prototype.forEach.call(document.querySelectorAll('video'), fixVideo);
  }

  document.addEventListener('fix-videos-ready', buildBlobs);

  function blobFor(src) {
    if (!src || src.indexOf('blob:') === 0) return '';
    if (blobMap[src]) return blobMap[src];
    var m = /(videos\/exercise-\d+\.mp4)/.exec(src);
    return m ? blobMap[m[1]] || '' : '';
  }

  function posterOf(src) {
    var m = /videos\/exercise-(\d+)\.mp4/.exec(src || '');
    return m ? 'posters/exercise-' + m[1] + '.jpg' : '';
  }

  function fixVideo(v) {
    var origin = v.getAttribute('src') || '';
    var blob = blobFor(origin);

    /* 已处理过的元素也可能被 React 复用换了地址，每次都校准一次 */
    if (blob && v.getAttribute('src') !== blob) {
      v.setAttribute('src', blob);
      try {
        v.load();
      } catch (e) {}
    }

    if (v.dataset.fixVideo === '1') {
      if (blob && v.paused) {
        var pp = v.play();
        if (pp && pp.catch) pp.catch(function () {});
      }
      return;
    }
    v.dataset.fixVideo = '1';

    var poster = posterOf(origin);
    if (poster && !v.getAttribute('poster')) v.setAttribute('poster', poster);
    /* 视频地址没拿到（源缺文件 / 网络失败）时的兜底：显示分解图，不留黑框
       只在 MediaError 真的存在时才切，避免把“还在加载”误判成失败 */
    function posterFallback() {
      if (!v.error) return;
      if (!poster || v.dataset.fixFallback === '1' || !v.parentElement) return;
      v.dataset.fixFallback = '1';
      v.style.display = 'none';
      var wrap = v.parentElement;
      wrap.classList.add('fix-video-wrap');
      var img = document.createElement('img');
      img.className = 'fix-poster';
      img.src = poster;
      img.alt = v.getAttribute('aria-label') || '肩颈动作分解示意';
      wrap.insertBefore(img, v);
      var tip = document.createElement('p');
      tip.className = 'fix-video-tip';
      tip.textContent = '演示视频暂时没加载出来，上面是同一动作的分解示意。';
      wrap.appendChild(tip);
    }
    /* 内存地址万一不被支持（个别老内核），先退回原文件地址重试一次，
       两次都失败才降级成分解图 */
    var reverted = 0;
    v.addEventListener('error', function () {
      if (blob && !reverted && origin && v.getAttribute('src') !== origin) {
        reverted = 1;
        v.setAttribute('src', origin);
        try {
          v.load();
        } catch (e) {}
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
        return;
      }
      posterFallback();
    });
    /* 有内存版本就预载整段（也只有十几 KB），首帧立即出 */
    v.setAttribute('preload', blob ? 'auto' : 'metadata');
    v.setAttribute('webkit-playsinline', '');
    v.setAttribute('x5-playsinline', '');
    v.setAttribute('aria-label', v.getAttribute('aria-label') || '肩颈动作演示');

    var overlay = null;
    function showPlay() {
      if (overlay || !v.parentElement || v.dataset.fixFallback === '1') return;
      overlay = document.createElement('button');
      overlay.type = 'button';
      overlay.className = 'fix-play';
      overlay.setAttribute('aria-label', '播放动作演示');
      overlay.innerHTML = '<span class="fix-play-icon">▶</span><span>播放演示</span>';
      overlay.addEventListener('click', function () {
        overlay.remove();
        overlay = null;
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      });
      v.parentElement.classList.add('fix-video-wrap');
      v.parentElement.appendChild(overlay);
    }

    function tryPlay() {
      var p = v.play();
      if (p && p.catch) {
        p.catch(function () {
          /* 自动播放被拦（iOS 低电量 / 省流模式）→ 给显式按钮 */
          showPlay();
        });
      }
    }

    v.addEventListener('loadeddata', function () {
      if (v.paused) tryPlay();
    });
    /* React 复用同一个 video 只换地址时，也拉回内存版本 */
    v.addEventListener('loadstart', function () {
      var cur = v.getAttribute('src') || '';
      var b = blobFor(cur);
      if (!b || cur === b) return;
      v.setAttribute('src', b);
      try {
        v.load();
      } catch (e) {}
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    });
    v.addEventListener('stalled', showPlay);
    v.addEventListener('error', showPlay);
    v.addEventListener('play', function () {
      if (overlay) {
        overlay.remove();
        overlay = null;
      }
    });
    /* 4 秒还没起播就不让用户干等黑屏 */
    setTimeout(function () {
      if (v.paused && v.readyState < 2) showPlay();
    }, 4000);

    /* 已经在补丁之前就加载失败的情况（有 MediaError 才算失败） */
    if (v.error) {
      posterFallback();
      return;
    }
    /* 起播 3 秒后仍然报错，才退化成分解图 */
    setTimeout(function () {
      if (v.error) posterFallback();
    }, 3000);

    tryPlay();
  }

  /* ---------- 动作演示弹层：贴底 + 限高 + 位置校正 ---------- */
  function fitSheet(d) {
    if (!d || !d.classList || !d.classList.contains('exercise-dialog')) return;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!vh) return;
    d.style.setProperty('max-height', Math.max(280, vh - 16) + 'px', 'important');
    d.style.setProperty('transform', 'translateY(0px)', 'important');
    var r = d.getBoundingClientRect();
    var dy = 0;
    if (r.bottom > vh - 2) dy = vh - 2 - r.bottom;
    if (r.top + dy < 6) dy = 6 - r.top;
    if (Math.abs(dy) > 0.5) {
      d.style.setProperty('transform', 'translateY(' + Math.round(dy) + 'px)', 'important');
    }
  }

  function arrangeSheet(d) {
    if (!d.classList || !d.classList.contains('exercise-dialog')) return;
    fitSheet(d);
    setTimeout(function () {
      fitSheet(d);
    }, 60);
    setTimeout(function () {
      fitSheet(d);
    }, 320);
  }

  /* ---------- 弹层无障碍 ---------- */
  function fixDialog(d) {
    if (d.getAttribute('aria-modal') !== 'true') d.setAttribute('aria-modal', 'true');

    arrangeSheet(d);

    Array.prototype.forEach.call(d.querySelectorAll('button'), function (b) {
      if (b.getAttribute('data-fix-close') === '1') return;
      var name = (b.getAttribute('aria-label') || b.textContent || '').trim();
      if (name === 'Close' || name === 'close') {
        b.setAttribute('aria-label', '关闭');
        b.setAttribute('data-fix-close', '1');
        b.setAttribute('title', '关闭');
      }
    });

    if (!d.hasAttribute('aria-labelledby') && !d.hasAttribute('aria-label')) {
      var h = d.querySelector('h1, h2, h3');
      if (h) {
        if (!h.id) h.id = 'fix-dialog-title';
        d.setAttribute('aria-labelledby', h.id);
      }
    }
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.tagName === 'VIDEO') fixVideo(root);
    if (root.matches && root.matches('[role="dialog"], [role="alertdialog"]')) fixDialog(root);
    if (!root.querySelectorAll) return;
    Array.prototype.forEach.call(root.querySelectorAll('video'), fixVideo);
    Array.prototype.forEach.call(
      root.querySelectorAll('[role="dialog"], [role="alertdialog"]'),
      fixDialog
    );
  }

  /* ---------- 滚动锁兜底 + 弹层补丁重试 ---------- */
  var locked = false;

  function inDialog(node) {
    while (node && node !== document.body) {
      if (node.getAttribute && (node.getAttribute('role') === 'dialog' || node.getAttribute('role') === 'alertdialog')) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  function syncLock() {
    var open = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
    locked = open.length > 0;
    if (locked) document.documentElement.setAttribute('data-modal-open', '');
    else document.documentElement.removeAttribute('data-modal-open');
    /* 弹层内容可能是分步渲染的，每次 DOM 变动后再补一次 */
    Array.prototype.forEach.call(open, fixDialog);
  }

  /* 背景不再跟着滚：只在“事件不在弹层内”或“弹层自身滚不动”时拦截 */
  function allowScroll(target) {
    var d = inDialog(target);
    if (!d) return false;
    return d.scrollHeight > d.clientHeight + 1;
  }

  window.addEventListener(
    'wheel',
    function (e) {
      if (!locked) return;
      if (allowScroll(e.target)) return;
      e.preventDefault();
    },
    { passive: false }
  );

  window.addEventListener(
    'touchmove',
    function (e) {
      if (!locked) return;
      if (e.touches && e.touches.length > 1) return;
      if (allowScroll(e.target)) return;
      e.preventDefault();
    },
    { passive: false }
  );

  var mo = new MutationObserver(function (muts) {
    var touched = false;
    for (var i = 0; i < muts.length; i++) {
      var nodes = muts[i].addedNodes;
      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j].nodeType === 1) {
          scan(nodes[j]);
          touched = true;
        }
      }
      if (muts[i].removedNodes && muts[i].removedNodes.length) touched = true;
    }
    if (touched) syncLock();
  });

  /* ---------- 场景插画预热 ---------- */
  /* 图书馆那两张 55KB 的插画，原本要等用户点到那一站才开始下载，
     网络稍差就是一个空白块。这里在首屏之后趁空闲提前取进缓存。 */
  var warmed = [];
  function warmImages() {
    setTimeout(function () {
      warmed.push(new Image());
      warmed[0].src = 'campus-library-scene.webp';
      setTimeout(function () {
        warmed.push(new Image());
        warmed[1].src = 'campus-library-after.webp';
      }, 900);
    }, 700);
  }

  function boot() {
    buildBlobs();
    warmImages();
    scan(document.body);
    syncLock();
    mo.observe(document.body, { childList: true, subtree: true });

    /* 视口变化（地址栏收起、横竖屏）时重新贴底 */
    var refit = function () {
      Array.prototype.forEach.call(
        document.querySelectorAll('[role="dialog"].exercise-dialog'),
        fitSheet
      );
    };
    window.addEventListener('resize', refit);
    window.addEventListener('orientationchange', refit);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', refit);
    window.addEventListener('scroll', refit, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

/* ---------- 习惯自查结果卡：标注「你的派系」，让每个人的结果一眼可辨 ---------- */
(function () {
  var FACTION_ACCENT = {
    '习惯守护者': { c: '#c8f061', s: 'rgba(200,240,97,.26)', t: '#e2f6b4' },
    '调整行动派': { c: '#ffd76a', s: 'rgba(255,215,106,.26)', t: '#ffeab5' },
    '休息优先派': { c: '#ffa07a', s: 'rgba(255,160,122,.26)', t: '#ffd0bc' }
  };

  /* 盾牌内的符号：绿派对号、黄派等号、橙派叉号。
     原图标是 lucide shield-check，盾牌骨架 M20 13… 固定，
     里面只挂一个勾路径，这里按派系换它的 d。坐标落在盾牌内区（x 9~15）。 */
  var FACTION_GLYPH = {
    '习惯守护者': 'm9 12 2 2 4-4',
    '调整行动派': 'M9 10.8h6M9 13.2h6',
    '休息优先派': 'M9.6 9.8l4.8 4.4M14.4 9.8l-4.8 4.4'
  };

  /* 改的是「除盾牌骨架之外」的那条路径，所以反复调用结果一致，不会越换越乱 */
  function applyGlyph(aside, name) {
    var glyph = FACTION_GLYPH[name];
    var svg = aside.firstElementChild;
    if (!glyph || !svg || svg.tagName.toLowerCase() !== 'svg') {
      svg = aside.querySelector('svg');
    }
    if (!glyph || !svg) return;
    var paths = svg.querySelectorAll('path');
    for (var i = 0; i < paths.length; i++) {
      var d = (paths[i].getAttribute('d') || '').replace(/^\s+/, '');
      if (d.indexOf('M20 13') !== 0) {
        paths[i].setAttribute('d', glyph);
        return;
      }
    }
  }

  /* 主包里写死的三句「下一步」，顺序不能动，只按派系换文案 */
  var SOURCE_ACTIONS = [
    '把手机屏幕抬高，给手臂找个支撑',
    '学习间隙起身走动，变换姿势',
    '不适持续或加重时，及时就医评估'
  ];

  var FACTION_ACTIONS = {
    '习惯守护者': [
      '每小时起身活动 1 分钟，把好习惯延续下去',
      '把屏幕抬到眼睛高度，让低头角度再小一点',
      '出现持续麻木或放射痛，及时就医评估'
    ],
    '调整行动派': [
      '把手机屏幕抬高，给手臂找个支撑',
      '学习 45 分钟就起身，换一种姿势',
      '调整两周仍不见缓解，及时就医评估'
    ],
    '休息优先派': [
      '先把连续低头时间压到 20 分钟以内',
      '睡前做 3 分钟轻柔舒展，不追求幅度',
      '不适频繁出现，尽早去做康复评估'
    ]
  };

  /* 所有派系文案 → 原始文案的反查表，用来把 DOM 归一，避免上一轮的痕迹残留 */
  var VARIANT_TO_SOURCE = {};
  (function () {
    for (var f in FACTION_ACTIONS) {
      if (!FACTION_ACTIONS.hasOwnProperty(f)) continue;
      var l = FACTION_ACTIONS[f];
      for (var i = 0; i < l.length; i++) VARIANT_TO_SOURCE[l[i]] = SOURCE_ACTIONS[i];
    }
  })();

  /* 先还原成主包原文，再套当前派系：跑多少次结果都一样，不会三行各属一派 */
  function rewrite(text, list) {
    var i;
    for (var k in VARIANT_TO_SOURCE) {
      if (VARIANT_TO_SOURCE.hasOwnProperty(k) && text.indexOf(k) !== -1) {
        text = text.split(k).join(VARIANT_TO_SOURCE[k]);
      }
    }
    for (i = 0; i < SOURCE_ACTIONS.length; i++) {
      if (list[i] !== SOURCE_ACTIONS[i] && text.indexOf(SOURCE_ACTIONS[i]) !== -1) {
        text = text.split(SOURCE_ACTIONS[i]).join(list[i]);
      }
    }
    return text;
  }

  /* 全局替换，保证第 4 站的按钮和第 8 站总结引用的是同一句 */
  function applyActionText(name) {
    var list = FACTION_ACTIONS[name];
    if (!list) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var v = node.nodeValue;
      if (!v || v.length < 6) continue;
      var next = rewrite(v, list);
      if (next !== v) node.nodeValue = next;
    }
  }

  /* 报告长图走 canvas 绘制，文本不经过 DOM，这里再兜一层 */
  if (window.CanvasRenderingContext2D) {
    var rawFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      if (typeof text === 'string' && currentFaction) {
        var list = FACTION_ACTIONS[currentFaction];
        if (list) text = rewrite(text, list);
      }
      return rawFillText.call(this, text, x, y, maxWidth);
    };
  }

  var currentFaction = null;

  function decorate() {
    var aside = document.querySelector('.habit-result');
    var h2 = aside ? aside.querySelector('h2') : null;
    var name = h2 ? (h2.textContent || '').replace(/\s+/g, '') : '';
    var accent = FACTION_ACCENT[name];

    /* 记住派系，离开第 4 站后（如第 8 站总结）也要保持文案一致 */
    if (accent) currentFaction = name;
    if (currentFaction) applyActionText(currentFaction);

    if (!aside || !h2) return;

    var head = aside.querySelector('.fix-faction-head');

    if (!accent) {
      aside.classList.remove('has-faction');
      if (head && head.parentNode) head.parentNode.removeChild(head);
      return;
    }

    aside.classList.add('has-faction');
    aside.style.setProperty('--faction-accent', accent.c);
    aside.style.setProperty('--faction-soft', accent.s);
    aside.style.setProperty('--faction-tint', accent.t);
    applyGlyph(aside, name);
    if (head) return;

    head = document.createElement('div');
    head.className = 'fix-faction-head';

    var badge = document.createElement('span');
    badge.className = 'fix-faction-badge';
    badge.textContent = '你的派系';

    var hint = document.createElement('span');
    hint.className = 'fix-faction-hint';
    hint.textContent = '根据上面 3 个选择生成';

    head.appendChild(badge);
    head.appendChild(hint);

    var eyebrow = aside.querySelector('.eyebrow');
    if (eyebrow && eyebrow.parentNode === aside) {
      eyebrow.parentNode.insertBefore(head, eyebrow.nextSibling);
    } else {
      h2.parentNode.insertBefore(head, h2);
    }
  }

  function bootFaction() {
    decorate();
    var root = document.getElementById('root');
    if (!root) return;
    var timer = null;
    new MutationObserver(function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(decorate, 60);
    }).observe(root, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootFaction);
  } else {
    bootFaction();
  }
})();

/* ---------- 动作视频：画面上叠一枚派系盾牌（对号 / 等号 / 叉号） ----------
   画面里的「肩颈轻后缩」「连续动作 01」「轻轻保持」都是烧进 mp4 的，
   改不了，所以这里用一层 fixed 浮标压在视频上，位置每帧跟 video 的实测矩形走。 */
(function () {
  var KEY = 'yujian-progress-v1';

  var SET = [
    { c: '#c8f061', glyph: 'm9 12 2 2 4-4' },
    { c: '#ffd76a', glyph: 'M9 10.8h6M9 13.2h6' },
    { c: '#ffa07a', glyph: 'M9.6 9.8l4.8 4.4M14.4 9.8l-4.8 4.4' }
  ];

  /* lucide shield 骨架，与结果卡那枚同形 */
  var SHELL = 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z';

  /* 与主包同一套换算：三项相加 ≤1 守护者、≤3 行动派、其余优先派 */
  function tier() {
    try {
      var p = JSON.parse(localStorage.getItem(KEY) || 'null');
      var h = p && p.habits;
      if (!h || h.length !== 3) return -1;
      for (var i = 0; i < 3; i++) {
        if (typeof h[i] !== 'number' || h[i] % 1 || h[i] < 0 || h[i] > 2) return -1;
      }
      var s = h[0] + h[1] + h[2];
      return s <= 1 ? 0 : s <= 3 ? 1 : 2;
    } catch (e) {
      return -1;
    }
  }

  var el = null;
  var timer = 0;
  var shown = -1;

  function make(t) {
    var f = SET[t];
    var d = document.createElement('div');
    d.className = 'fix-video-badge';
    d.setAttribute('aria-hidden', 'true');
    d.style.setProperty('--badge-accent', f.c);
    d.innerHTML =
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="' + SHELL + '"/><path d="' + f.glyph + '"/></svg>';
    return d;
  }

  function place(video) {
    var r = video.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth;
    /* 全屏播放时 video 会被撑满屏幕，这时不挂浮标 */
    if (!r.width || r.height < 60 || r.width > vw * 1.05) {
      el.style.visibility = 'hidden';
      return;
    }
    el.style.visibility = '';
    /* 挂在左上角「动作名」胶囊的下方，避免盖住人物和右上角的序号标签 */
    el.style.left = Math.round(r.left + Math.max(10, r.width * 0.035)) + 'px';
    el.style.top = Math.round(r.top + r.height * 0.225) + 'px';
  }

  function tick() {
    var video = document.querySelector('.exercise-dialog video');
    if (!video) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      el = null;
      shown = -1;
      schedule(400);
      return;
    }

    var t = tier();
    if (t < 0) {
      if (el) el.style.visibility = 'hidden';
    } else {
      if (!el || shown !== t) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
        el = make(t);
        shown = t;
        document.body.appendChild(el);
      }
      place(video);
    }

    schedule(90);
  }

  /* 弹层在时高频跟位，不在时低频守着；不用 rAF，后台标签页里 rAF 会停 */
  function schedule(ms) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(tick, ms);
  }

  function bootVideoBadge() {
    schedule(200);
    /* 弹层内滚动时立刻跟位，不用等下一轮轮询 */
    var nudge = function () {
      schedule(0);
    };
    document.addEventListener('scroll', nudge, true);
    window.addEventListener('resize', nudge);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootVideoBadge);
  } else {
    bootVideoBadge();
  }
})();
