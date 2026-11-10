/* ===== 个人肩颈画像（收尾报告） =====
   数据来源：localStorage 的 yujian-progress-v1
   { page, quiz[3](true/false/null), habits[3](0/1/2/null), action(index|null), foundClues[] }
   纯前端模板渲染，不调用任何模型，不做医学判断。
   ===================================== */
(function () {
  'use strict';

  var KEY = 'yujian-progress-v1';
  var QUIZ_CORRECT = [false, true, false];
  var ACTIONS = ['肩胛轻后缩', '轻收下巴', '上斜方肌轻舒展', '颈部轻侧屈'];

  /* ---------- 打分 ---------- */
  var SCREEN = [6, 14, 22];
  var SYMPTOM = [4, 12, 22];
  var POSTURE = [4, 10, 16];

  /* 与站内「习惯自查」保持同一套分层，避免前后说法打架 */
  var TIERS = [
    { title: '习惯守护者', color: '#3f7a52', desc: '已有一些良好习惯，继续保持活动。这不代表医学上的健康结论。' },
    { title: '调整行动派', color: '#a9761c', desc: '从一个小改变开始：抬高屏幕，定时离开座位活动。' },
    { title: '休息优先派', color: '#b4472f', desc: '减少连续低头与久坐，优先调整日常节奏；不适持续请就医。' }
  ];

  function readData() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || 'null');
      return o && typeof o === 'object' ? o : null;
    } catch (e) {
      return null;
    }
  }

  function pick(arr, i) {
    return typeof i === 'number' && arr[i] != null ? arr[i] : null;
  }

  function buildReport(d) {
    var habits = Array.isArray(d.habits) ? d.habits : [];
    var quiz = Array.isArray(d.quiz) ? d.quiz : [];
    var found = Array.isArray(d.foundClues) ? d.foundClues.length : 0;

    var h = [pick(SCREEN, habits[0]), pick(SYMPTOM, habits[1]), pick(POSTURE, habits[2])];
    var answered = h.filter(function (v) {
      return v !== null;
    }).length;

    var wrong = 0;
    for (var i = 0; i < QUIZ_CORRECT.length; i++) {
      if (quiz[i] === true || quiz[i] === false) {
        if (quiz[i] !== QUIZ_CORRECT[i]) wrong++;
      }
    }

    var score = 8;
    h.forEach(function (v) {
      if (v !== null) score += v;
    });
    score += wrong * 4;
    if (score > 88) score = 88;

    var hsum = 0;
    var hcount = 0;
    habits.forEach(function (v) {
      if (Number.isInteger(v) && v >= 0 && v <= 2) {
        hsum += v;
        hcount++;
      }
    });
    var tierIdx = hcount === 3 ? (hsum <= 1 ? 0 : hsum <= 3 ? 1 : 2) : 1;

    /* 三条观察 */
    var s1 = ['每天低头看手机不到 1 小时，颈部有喘息窗口。', '每天低头 1–4 小时，颈部大部分时间在低头位。', '每天低头 4 小时以上，颈部几乎没有休息窗口。'];
    var s2 = ['近一周几乎没有肩颈不适的信号。', '近一周偶尔出现肩颈不适。', '近一周频繁不适，已经影响到生活。'];
    var s3 = ['你会主动起身活动，这是很好的底子。', '你想起来才活动，容易一坐到底。', '你常常一坐很久，中间缺少中断。'];

    var signals = [
      { label: '屏幕时长', text: habits[0] == null ? '这题没有作答，不计入自评。' : s1[habits[0]], risk: h[0] || 0 },
      { label: '不适频率', text: habits[1] == null ? '这题没有作答，不计入自评。' : s2[habits[1]], risk: h[1] || 0 },
      { label: '姿势切换', text: habits[2] == null ? '这题没有作答，不计入自评。' : s3[habits[2]], risk: h[2] || 0 }
    ];

    /* 三条建议：按风险从高到低，凑满 3 条 */
    var pool = [];
    if (h[0] >= 14) pool.push('把屏幕抬到与视线齐平：用支架或书堆垫高，别把手机放在大腿上。');
    if (h[2] >= 10) pool.push('设一个 40–50 分钟的中断：起身接水、走两步都算，不需要专门运动。');
    if (h[1] >= 12) pool.push('给不适设一条线：持续数周不缓解、明显加重，或伴手麻无力，就去评估。');
    if (wrong > 0) pool.push('别自己暴力扳颈：弹响不等于放松，活动要轻柔可控。');

    var action = ACTIONS[d.action] || '';
    if (!action) {
      action = h[0] >= 14 ? '轻收下巴' : h[1] >= 12 ? '上斜方肌轻舒展' : '肩胛轻后缩';
    }
    pool.push('挑一个动作固定下来：' + action + '，每天 3 次、每次约 5 秒，不追求幅度。');

    if (pool.length < 3) {
      pool.push('把起身活动固定到两个时间点，比如午饭后和晚饭前。');
    }
    if (pool.length < 3) {
      pool.push('出现新的不适信号时，回到第 1 站再看一遍，别靠闯关代替就诊。');
    }

    return {
      score: score,
      pct: Math.round((score / 88) * 100),
      tier: TIERS[tierIdx],
      tierIdx: tierIdx,
      signals: signals,
      advice: pool.slice(0, 3),
      action: action,
      wrong: wrong,
      answered: answered,
      found: found
    };
  }

  /* ---------- 样式（只注入一次） ---------- */
  function injectStyle() {
    if (document.getElementById('fix-report-style')) return;
    var css = [
      '.fix-report-entry{display:inline-flex;align-items:center;gap:6px;margin-top:10px}',
      '.rpt-mask{position:fixed;inset:0;background:rgba(16,31,25,.55);z-index:9000;display:flex;align-items:flex-end;justify-content:center}',
      '.rpt-card{width:100%;max-width:520px;max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch;background:#fff;border-radius:22px 22px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -8px 40px rgba(0,0,0,.18)}',
      '@media (min-width:560px){.rpt-mask{align-items:center}.rpt-card{border-radius:22px;max-height:86vh;padding-bottom:22px}}',
      '.rpt-eyebrow{font-size:11px;letter-spacing:.16em;color:#657265;font-weight:800;margin:0 0 6px;padding-right:44px}',
      '.rpt-title{font-size:24px;line-height:1.25;margin:0 0 14px;color:#17251f}',
      '.rpt-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}',
      '.rpt-badge{flex:0 0 auto;border-radius:999px;padding:7px 14px;color:#fff;font-weight:800;font-size:14px}',
      '.rpt-score{font-size:13px;color:#657265;line-height:1.4}',
      '.rpt-meter{height:8px;border-radius:999px;background:#e7ece5;overflow:hidden;margin:0 0 8px}',
      '.rpt-meter>i{display:block;height:100%;border-radius:999px;transition:width .5s ease}',
      '.rpt-desc{font-size:14px;line-height:1.7;color:#3c4a43;margin:0 0 18px}',
      '.rpt-h{font-size:13px;font-weight:800;color:#17251f;margin:18px 0 10px;display:flex;align-items:center;gap:8px}',
      '.rpt-h::after{content:"";flex:1;height:1px;background:#e7ece5}',
      '.rpt-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}',
      '.rpt-list li{display:flex;gap:10px;font-size:14px;line-height:1.65;color:#33423b}',
      '.rpt-list b{color:#17251f}',
      '.rpt-dot{flex:0 0 auto;width:7px;height:7px;border-radius:50%;margin-top:9px;background:#8ba392}',
      '.rpt-num{flex:0 0 auto;width:20px;height:20px;border-radius:6px;background:#eef3e9;color:#3f5a46;font-size:12px;font-weight:800;display:grid;place-items:center;margin-top:3px}',
      '.rpt-note{font-size:12.5px;line-height:1.7;color:#5f6d64;margin:18px 0 16px;padding-top:14px;border-top:1px dashed #e2e8e0}',
      '.rpt-actions{display:grid;gap:10px}',
      '.rpt-btn{width:100%;min-height:46px;border-radius:12px;border:0;font-size:15px;font-weight:800;cursor:pointer}',
      '.rpt-btn.primary{background:#2155dc;color:#fff}',
      '.rpt-btn.ghost{background:#f1f4ee;color:#33423b}',
      '.rpt-close{position:absolute;right:14px;top:14px;width:44px;height:44px;border-radius:50%;border:0;background:transparent;font-size:22px;color:#657265;cursor:pointer}',
      '.rpt-preview img{width:100%;border-radius:14px;display:block;box-shadow:0 6px 24px rgba(0,0,0,.14)}',
      '.rpt-hint{font-size:13px;color:#657265;text-align:center;margin:12px 0 0;line-height:1.6}'
    ].join('\n');
    var el = document.createElement('style');
    el.id = 'fix-report-style';
    el.textContent = css;
    document.head.appendChild(el);
  }

  /* ---------- 弹层 ---------- */
  function closeModal(mask) {
    if (!mask) return;
    mask.remove();
    document.documentElement.removeAttribute('data-fix-report');
  }

  function openReport() {
    var data = readData();
    if (!data) {
      alert('还没有可用的作答记录，先往下闯两站再来。');
      return;
    }
    var r = buildReport(data);
    injectStyle();

    var mask = document.createElement('div');
    mask.className = 'rpt-mask';
    var card = document.createElement('div');
    card.className = 'rpt-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-label', '你的肩颈画像');
    card.style.position = 'relative';

    var signals = r.signals
      .map(function (s) {
        return '<li><span class="rpt-dot"></span><span><b>' + s.label + '：</b>' + s.text + '</span></li>';
      })
      .join('');
    var advice = r.advice
      .map(function (t, i) {
        return '<li><span class="rpt-num">0' + (i + 1) + '</span><span>' + t + '</span></li>';
      })
      .join('');

    card.innerHTML =
      '<button class="rpt-close" type="button" aria-label="关闭">×</button>' +
      '<p class="rpt-eyebrow">YOUR SHOULDER &amp; NECK PROFILE</p>' +
      '<h2 class="rpt-title">你的肩颈画像</h2>' +
      '<div class="rpt-head">' +
      '<span class="rpt-badge" style="background:' + r.tier.color + '">' + r.tier.title + '</span>' +
      '<span class="rpt-score">自评 ' + r.score + '/88 · 知识点 ' + (3 - r.wrong) + '/3</span>' +
      '</div>' +
      '<div class="rpt-meter"><i style="width:' + r.pct + '%;background:' + r.tier.color + '"></i></div>' +
      '<p class="rpt-desc">' + r.tier.desc + '</p>' +
      '<div class="rpt-h">从你的作答看到</div>' +
      '<ul class="rpt-list">' + signals + '</ul>' +
      '<div class="rpt-h">接下来先做三件事</div>' +
      '<ul class="rpt-list">' + advice + '</ul>' +
      '<p class="rpt-note">这份画像是根据你刚才的选择，用固定规则拼出来的学习反馈，<b>不是诊断、不是评分，也不能替代就医</b>。' +
      '持续或加重的不适，请到正规医疗机构评估。</p>' +
      '<div class="rpt-actions">' +
      '<button class="rpt-btn primary" type="button" data-act="save">保存这张画像</button>' +
      '<button class="rpt-btn ghost" type="button" data-act="close">继续</button>' +
      '</div>';

    mask.appendChild(card);
    document.body.appendChild(mask);
    document.documentElement.setAttribute('data-fix-report', '1');

    card.querySelector('[data-act="close"]').addEventListener('click', function () {
      closeModal(mask);
    });
    card.querySelector('.rpt-close').addEventListener('click', function () {
      closeModal(mask);
    });
    card.querySelector('[data-act="save"]').addEventListener('click', function () {
      try {
        showPreview(r, card);
      } catch (e) {
        alert('生成图片失败，可以直接截屏保存这一页。');
      }
    });
    mask.addEventListener('click', function (e) {
      if (e.target === mask) closeModal(mask);
    });
  }

  /* ---------- 生成竖版长图 ---------- */
  function drawCard(r) {
    var W = 900;
    var probe = document.createElement('canvas').getContext('2d');
    if (!probe) throw new Error('no 2d');
    var need = paint(probe, W, 4000, r);
    var H = Math.max(900, Math.ceil(need));
    var cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    var c = cv.getContext('2d');
    if (!c) throw new Error('no 2d');
    paint(c, W, H, r);
    return cv;
  }

  var PAD = 72;
  var BODY = 900 - PAD * 2;

  function fontOf(size, weight) {
    return (weight || 400) + ' ' + size + "px system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
  }

  /* 一次完整的绘制；返回内容底部坐标，用于决定整张图高度 */
  function paint(c, W, H, r) {
    var barW = W - PAD * 2;
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#f4f6ee';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#2155dc';
    c.fillRect(0, 0, W, 24);

    c.fillStyle = '#657265';
    c.font = fontOf(22, 800);
    c.fillText('SHOULDER & NECK PROFILE', PAD, 120);

    c.fillStyle = '#17251f';
    c.font = fontOf(56, 800);
    c.fillText('你的肩颈画像', PAD, 196);

    c.font = fontOf(28, 800);
    var badge = r.tier.title;
    var bw = c.measureText(badge).width + 56;
    c.fillStyle = r.tier.color;
    roundRect(c, PAD, 240, bw, 62, 31);
    c.fill();
    c.fillStyle = '#fff';
    c.fillText(badge, PAD + 28, 281);

    c.fillStyle = '#657265';
    c.font = fontOf(24);
    c.fillText('自评 ' + r.score + ' / 88', PAD + bw + 24, 281);

    c.fillStyle = '#e2e8dd';
    roundRect(c, PAD, 340, barW, 14, 7);
    c.fill();
    c.fillStyle = r.tier.color;
    roundRect(c, PAD, 340, Math.max(14, Math.round((barW * r.pct) / 100)), 14, 7);
    c.fill();

    var y = 424;
    c.fillStyle = '#3c4a43';
    c.font = fontOf(26);
    y = wrap(c, r.tier.desc, PAD, y, barW, 40) + 40;

    c.fillStyle = '#17251f';
    c.font = fontOf(30, 800);
    c.fillText('从你的作答看到', PAD, y);
    y += 46;
    c.font = fontOf(26);
    r.signals.forEach(function (s) {
      c.fillStyle = '#8ba392';
      c.beginPath();
      c.arc(PAD + 6, y - 9, 6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#33423b';
      y = wrap(c, s.label + '：' + s.text, PAD + 28, y, barW - 28, 40) + 18;
    });

    y += 22;
    c.fillStyle = '#17251f';
    c.font = fontOf(30, 800);
    c.fillText('接下来先做三件事', PAD, y);
    y += 48;
    r.advice.forEach(function (t, i) {
      c.fillStyle = '#eef3e9';
      roundRect(c, PAD, y - 26, 34, 34, 8);
      c.fill();
      c.fillStyle = '#3f5a46';
      c.font = fontOf(20, 800);
      c.fillText('0' + (i + 1), PAD + 9, y - 3);
      c.fillStyle = '#33423b';
      c.font = fontOf(26);
      y = wrap(c, t, PAD + 48, y, barW - 48, 40) + 24;
    });

    /* 分隔线 + 免责声明（高度随内容走） */
    y += 8;
    c.strokeStyle = '#dfe5da';
    c.setLineDash([6, 8]);
    c.beginPath();
    c.moveTo(PAD, y);
    c.lineTo(W - PAD, y);
    c.stroke();
    c.setLineDash([]);

    c.fillStyle = '#5f6d64';
    c.font = fontOf(23);
    y = wrap(
      c,
      '根据你的选择用固定规则生成的学习反馈，不是诊断、不是评分，也不能替代就医。持续或加重的不适请到正规医疗机构评估。',
      PAD,
      y + 36,
      barW,
      35
    );

    y += 34;
    c.fillStyle = '#2155dc';
    c.font = fontOf(22, 800);
    c.fillText('豫见健康 · 肩颈大作战', PAD, y);
    c.fillStyle = '#9aa79e';
    c.font = fontOf(20);
    c.textAlign = 'right';
    c.fillText('yujianjiankang', W - PAD, y);
    c.textAlign = 'left';

    return y + 60;
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* 中文按字符断行；标点不放在行首 */
  function wrap(c, text, x, y, maxW, lineH) {
    var NO_START = '，。、；：？！）》」』%”’.!?,:;)]}';
    var line = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var test = line + ch;
      if (c.measureText(test).width > maxW && line) {
        if (NO_START.indexOf(ch) >= 0) {
          c.fillText(line + ch, x, y);
          y += lineH;
          line = '';
          continue;
        }
        c.fillText(line, x, y);
        y += lineH;
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) {
      c.fillText(line, x, y);
      y += lineH;
    }
    return y;
  }

  function showPreview(r, card) {
    var cv = drawCard(r);
    var url = cv.toDataURL('image/png');

    var mask = document.createElement('div');
    mask.className = 'rpt-mask';
    var box = document.createElement('div');
    box.className = 'rpt-card rpt-preview';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', '画像长图预览');
    box.style.position = 'relative';
    box.innerHTML =
      '<button class="rpt-close" type="button" aria-label="关闭">×</button>' +
      '<p class="rpt-eyebrow">保存到相册</p>' +
      '<img alt="你的肩颈画像长图" src="' + url + '">' +
      '<p class="rpt-hint">微信里长按上面这张图 →「保存图片」；电脑上可点下面的按钮下载。</p>' +
      '<div class="rpt-actions" style="margin-top:12px">' +
      '<button class="rpt-btn primary" type="button" data-act="dl">下载图片</button>' +
      '<button class="rpt-btn ghost" type="button" data-act="back">返回</button>' +
      '</div>';

    mask.appendChild(box);
    document.body.appendChild(mask);

    var close = function () {
      mask.remove();
    };
    box.querySelector('.rpt-close').addEventListener('click', close);
    box.querySelector('[data-act="back"]').addEventListener('click', close);
    box.querySelector('[data-act="dl"]').addEventListener('click', function () {
      try {
        var a = document.createElement('a');
        a.href = url;
        a.download = '肩颈画像.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (e) {
        alert('这个浏览器不支持直接下载，请长按图片保存。');
      }
    });
    mask.addEventListener('click', function (e) {
      if (e.target === mask) close();
    });
  }

  /* ---------- 在结尾页插入入口 ---------- */
  function entryExists() {
    return !!document.querySelector('.fix-report-entry');
  }

  function addEntry() {
    if (entryExists()) return;
    var btns = document.querySelectorAll('button');
    var anchor = null;
    for (var i = 0; i < btns.length; i++) {
      var t = (btns[i].textContent || '').trim();
      if (t.indexOf('生成通关海报') === 0 || t === '生成通关海报') {
        anchor = btns[i];
        break;
      }
    }
    if (!anchor) {
      for (var j = 0; j < btns.length; j++) {
        var t2 = (btns[j].textContent || '').trim();
        if (t2.indexOf('重新闯关') === 0) {
          anchor = btns[j];
          break;
        }
      }
    }
    if (!anchor) return;

    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'fix-report-entry';
    b.textContent = '看我的肩颈画像 ›';
    b.style.cssText =
      'display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;margin-top:12px;' +
      'border-radius:14px;border:1.5px solid #cdd9e8;background:#fff;color:#2155dc;font-size:15px;font-weight:800;cursor:pointer';
    b.addEventListener('click', openReport);
    anchor.parentNode.insertBefore(b, anchor.nextSibling);
  }

  function scan() {
    if (entryExists()) return;
    addEntry();
  }

  function boot() {
    injectStyle();
    scan();
    var timer = 0;
    var mo = new MutationObserver(function () {
      if (entryExists()) return;
      if (timer) return;
      timer = setTimeout(function () {
        timer = 0;
        scan();
      }, 300);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
