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
