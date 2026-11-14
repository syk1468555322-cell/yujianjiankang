/* Interactive posture side quests; pointer events work with touch and mouse. */
(function(){
  'use strict';
  var done={};
  var games=[
    {id:'screen',title:'抬高学习屏幕',sub:'拖动屏幕，试着让人物不用低头也能看清。',start:[265,224],target:[265,125],range:38,
      tip:'屏幕接近自然视线、肩膀放松即可；笔记本抬高后可配外接键盘。'},
    {id:'feet',title:'给双脚找支撑',sub:'把脚踏拖到悬空的双脚下方。',start:[280,240],target:[182,265],range:34,
      tip:'椅子偏高时，稳固脚踏可让双脚有支撑。坐姿可以经常变换。'},
    {id:'bag',title:'给背包减负',sub:'把不需要带走的厚书拖到书架上。',start:[157,170],target:[278,157],range:42,
      tip:'减轻负重并使用双肩背带，走路时会更容易保持舒适。'}
  ];
  var current=null, xy=null, dragging=false;
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function save(){} // Progress lives only in this page; refreshing starts a new round.
  function close(){var m=document.getElementById('px-mask');if(m)m.remove();document.body.style.overflow='';}
  function shell(html){close();var m=document.createElement('div');m.id='px-mask';m.className='px-mask';m.innerHTML='<section class="px-card" role="dialog" aria-modal="true" aria-label="姿势小游戏"><button class="px-close" type="button" aria-label="关闭">×</button>'+html+'</section>';document.body.appendChild(m);document.body.style.overflow='hidden';m.querySelector('.px-close').onclick=close;m.onclick=function(e){if(e.target===m)close();};}
  function progress(){return games.filter(function(g){return done[g.id];}).length;}
  function menu(){current=null;shell('<p class="px-kicker">SIDE QUEST · 姿势小游戏</p><h2>拖一拖，找舒服的位置</h2><p class="px-sub">完成 '+progress()+' / 3 关。每一关都可以重新尝试。</p>'+games.map(function(g,i){return '<button class="px-game" data-i="'+i+'"><strong>'+g.title+'</strong><span>'+(done[g.id]?'已完成 ✓':'开始 →')+'</span></button>';}).join('')+'<p class="px-note">画面为习惯示意，不测量或诊断身体状况。</p>');document.querySelectorAll('.px-game').forEach(function(b){b.onclick=function(){open(games[+b.dataset.i]);};});}
  function scene(g){
    var common='<rect x="0" y="0" width="340" height="300" fill="#edf3e9"/><path d="M0 290H340" stroke="#d6e2d1" stroke-width="3"/>';
    if(g.id==='screen')return common+'<path d="M45 215V290M135 215V290M45 215H135" stroke="#b9cdb5" stroke-width="9" stroke-linecap="round"/><path d="M185 207H335M205 207V290M320 207V290" stroke="#d1ddcf" stroke-width="9" stroke-linecap="round"/><path d="M72 205H142V290" fill="none" stroke="#91ad97" stroke-width="22" stroke-linecap="round"/><path d="M72 205V122" stroke="#91ad97" stroke-width="27" stroke-linecap="round"/><path id="px-neck" d="M72 123L72 104" stroke="#a9c2a9" stroke-width="14" stroke-linecap="round"/><g id="px-head"><circle cx="75" cy="80" r="25" fill="#b5cbb2"/><circle cx="88" cy="77" r="3" fill="#30463d"/><path d="M86 92q7 4 11-1" fill="none" stroke="#739575" stroke-width="2"/></g><path d="M101 80H307" stroke="#acc7ad" stroke-dasharray="5 6" stroke-width="2"/><path d="M174 207H340" stroke="#cfdacf" stroke-width="5"/>';
    if(g.id==='feet')return common+'<path d="M28 164V290M28 164H157M150 164V290" stroke="#c3d3be" stroke-width="10" stroke-linecap="round"/><path d="M76 157V81" stroke="#91ad97" stroke-width="28" stroke-linecap="round"/><circle cx="80" cy="56" r="22" fill="#b5cbb2"/><path d="M80 161H177L188 230" stroke="#91ad97" stroke-width="22" fill="none" stroke-linecap="round"/><path d="M188 230L178 252" stroke="#91ad97" stroke-width="19" stroke-linecap="round"/><path d="M169 252H195" stroke="#91ad97" stroke-width="13" stroke-linecap="round"/><path d="M170 252H195" stroke="#7f9f84" stroke-width="2" stroke-dasharray="4 4"/><rect x="137" y="267" width="82" height="8" rx="4" fill="#b9d2b6" opacity=".5"/>';
    return common+
      '<path d="M30 231H310M45 231V290M295 231V290" stroke="#ccdac8" stroke-width="9" stroke-linecap="round"/>'+
      '<path d="M238 63V223M238 63H322M238 140H322M238 220H322" stroke="#9eb59d" stroke-width="8" stroke-linecap="round"/>'+
      /* human-scale figure: head, neck, shoulders, torso, articulated arms and legs */
      '<path d="M89 194 L113 194 L107 249 L103 283 L79 283 L83 244 Z" fill="#355b67"/>'+
      '<path d="M111 194 L132 192 L139 241 L150 279 L127 284 L112 248 Z" fill="#355b67"/>'+
      '<path d="M78 278 Q90 275 103 281 L104 288 L73 288 Z M127 279 Q139 275 151 279 L157 288 L125 288 Z" fill="#415954"/>'+
      '<path d="M95 101 L115 101 L119 117 L91 118 Z" fill="#d9aa84"/>'+
      '<path d="M74 118 Q86 108 102 109 L117 109 Q131 110 141 121 L135 195 Q109 205 79 196 Z" fill="#5b897c" stroke="#426e63" stroke-width="2"/>'+
      '<path d="M80 120 Q69 124 66 141 L55 177 Q53 183 61 187 L69 185 L85 146 Z" fill="#5b897c" stroke="#426e63" stroke-width="2"/>'+
      '<ellipse cx="62" cy="187" rx="8" ry="10" fill="#d9aa84"/>'+
      '<path d="M132 122 Q147 127 149 145 L157 174 Q160 182 152 186 L145 183 L130 150 Z" fill="#5b897c" stroke="#426e63" stroke-width="2"/>'+
      '<ellipse cx="151" cy="186" rx="8" ry="10" fill="#d9aa84"/>'+
      '<ellipse cx="105" cy="76" rx="23" ry="27" fill="#d9aa84" stroke="#aa8069" stroke-width="1.5"/>'+
      '<path d="M82 76 Q79 46 103 44 Q129 42 130 72 Q117 57 105 59 Q92 60 82 76 Z" fill="#344b47"/>'+
      '<circle cx="96" cy="77" r="2" fill="#263f3b"/><circle cx="114" cy="77" r="2" fill="#263f3b"/>'+
      '<path d="M100 91 Q106 95 112 91" fill="none" stroke="#a07865" stroke-width="1.7" stroke-linecap="round"/>'+
      /* backpack sits on the shoulder and behind the arm, not through the torso */
      '<path d="M139 126 Q150 120 164 128 Q176 137 176 155 L176 207 Q174 216 166 217 L146 217 Q138 215 138 206 Z" fill="#547b6b" stroke="#3d6558" stroke-width="2"/>'+
      '<path d="M129 123 Q141 118 146 132 L149 192" fill="none" stroke="#c4d7c7" stroke-width="5" stroke-linecap="round"/>'+
      '<path d="M155 137 L155 205" stroke="#c4d7c7" stroke-width="4" stroke-linecap="round"/>'+
      '<text x="250" y="112" fill="#466a50" font-size="13">书架</text>';
  }
  function object(g){if(g.id==='screen')return '<rect x="-44" y="-32" width="88" height="64" rx="7" fill="#263d36"/><rect x="-37" y="-25" width="74" height="46" rx="3" fill="#d4e8d7"/><path d="M-17-8H17M-17 2H9" stroke="#85aa8e" stroke-width="3" stroke-linecap="round"/><path d="M-30 35H30" stroke="#263d36" stroke-width="5"/>';
    if(g.id==='feet')return '<rect x="-41" y="-13" width="82" height="25" rx="6" fill="#537b62"/><path d="M-31 12V28M31 12V28" stroke="#537b62" stroke-width="6"/>';
    return '<rect x="-22" y="-31" width="44" height="62" rx="3" fill="#f8d57b" stroke="#98713b" stroke-width="3"/><path d="M-14-24V24M-6-24V24" stroke="#c19649" stroke-width="2"/>';
  }
  function update(){if(!current)return;var g=current,el=document.getElementById('px-move');if(!el)return;el.setAttribute('transform','translate('+xy[0]+' '+xy[1]+')');var dist=Math.hypot(xy[0]-g.target[0],xy[1]-g.target[1]),ok=dist<g.range;
    var f=document.getElementById('px-feedback');f.textContent=ok?'位置合适，松开手指即可完成。':g.id==='screen'?'试着把屏幕向上移，眼睛自然平视。':g.id==='feet'?'把脚踏放在双脚下方的虚线区域。':'把厚书放回右侧书架。';f.style.color=ok?'#2b7649':'#a85b36';
    if(g.id==='screen'){var h=document.getElementById('px-head');h.setAttribute('transform','rotate('+clamp((xy[1]-g.target[1])*.22,0,20)+' 75 105)');}
  }
  function open(g){current=g;xy=g.start.slice();shell('<p class="px-kicker">姿势小游戏 · '+(games.indexOf(g)+1)+'/3</p><h2>'+g.title+'</h2><p class="px-sub">'+g.sub+'</p><div class="px-stage"><svg id="px-svg" viewBox="0 0 340 300" aria-label="可拖动的姿势画面">'+scene(g)+'<circle cx="'+g.target[0]+'" cy="'+g.target[1]+'" r="'+g.range+'" fill="#5ba979" opacity=".15" stroke="#3f8b58" stroke-width="2" stroke-dasharray="5 5"/><g id="px-move" class="px-move" tabindex="0" role="button" aria-label="拖动物体">'+object(g)+'</g></svg></div><p id="px-feedback" class="px-feedback" aria-live="polite"></p><div id="px-result" aria-live="polite"></div><button class="px-back" type="button">← 返回游戏列表</button>');document.querySelector('.px-back').onclick=menu;update();
    var svg=document.getElementById('px-svg'),move=document.getElementById('px-move');
    function point(e){var r=svg.getBoundingClientRect();return [clamp((e.clientX-r.left)*340/r.width,28,312),clamp((e.clientY-r.top)*300/r.height,32,270)];}
    move.onpointerdown=function(e){dragging=true;move.setPointerCapture(e.pointerId);e.preventDefault();};
    move.onpointermove=function(e){if(!dragging)return;xy=point(e);update();};
    move.onpointerup=function(e){dragging=false;try{move.releasePointerCapture(e.pointerId);}catch(x){}if(Math.hypot(xy[0]-g.target[0],xy[1]-g.target[1])<g.range){done[g.id]=true;save();document.getElementById('px-result').innerHTML='<strong>做得好！</strong><p>'+g.tip+'</p><button class="px-next" type="button">继续选关</button>';document.querySelector('.px-next').onclick=menu;refresh();}};
    move.onkeydown=function(e){var step=10;if(e.key==='ArrowUp')xy[1]-=step;else if(e.key==='ArrowDown')xy[1]+=step;else if(e.key==='ArrowLeft')xy[0]-=step;else if(e.key==='ArrowRight')xy[0]+=step;else return;e.preventDefault();xy[0]=clamp(xy[0],28,312);xy[1]=clamp(xy[1],32,270);update();};
  }
  function refresh(){var b=document.querySelector('.px-entry');if(b)b.innerHTML='更多姿势小游戏 <span>'+progress()+'/3 已完成</span>';}
  function entry(){if(document.querySelector('.px-entry'))return;var old=document.querySelector('.fix-pose-entry');if(!old||!old.parentNode)return;var b=document.createElement('button');b.type='button';b.className='px-entry';b.onclick=menu;old.parentNode.insertBefore(b,old.nextSibling);refresh();}
  var css='.px-entry{display:flex;justify-content:space-between;align-items:center;width:100%;padding:15px;margin:8px 0 15px;border:1px solid #b8cfc0;border-radius:14px;background:#eff8f0;color:#1a4934;font-size:15px;font-weight:800;cursor:pointer}.px-entry span{font-size:12px}.px-mask{position:fixed;inset:0;z-index:90;background:#13251ac0;display:flex;align-items:flex-end;justify-content:center}.px-card{position:relative;box-sizing:border-box;width:100%;max-width:430px;max-height:92dvh;overflow:auto;padding:25px 20px calc(22px + env(safe-area-inset-bottom,0px));border-radius:22px 22px 0 0;background:#f7f9f2;color:#182a22;font-family:inherit}.px-card h2{font-size:23px;margin:4px 40px 8px 0}.px-close{position:absolute;right:14px;top:12px;width:38px;height:38px;border:0;border-radius:50%;font-size:27px;background:#e8eee2;color:#233c30}.px-kicker{margin:0;color:#607266;font-size:11px;font-weight:800;letter-spacing:.12em}.px-sub{color:#56675c;line-height:1.6;font-size:14px}.px-game,.px-next{display:flex;width:100%;justify-content:space-between;align-items:center;box-sizing:border-box;min-height:56px;margin:10px 0;padding:13px 15px;border:1px solid #ccd9cb;border-radius:13px;background:#fff;color:#203b2d;font:inherit;text-align:left;cursor:pointer}.px-game span{font-size:12px;color:#477457}.px-back{margin-top:18px;padding:10px 0;border:0;background:none;color:#53685a;text-decoration:underline}.px-stage{width:100%;aspect-ratio:340/300;border:1px solid #dbe7d8;border-radius:16px;overflow:hidden}.px-stage svg{width:100%;height:100%;display:block;touch-action:none}.px-move{cursor:grab;filter:drop-shadow(0 4px 5px #344a3855)}.px-move:active{cursor:grabbing}.px-move:focus-visible{outline:3px solid #2457db}.px-feedback,#px-result{min-height:24px;font-size:14px;line-height:1.6;margin:11px 0}.px-next{justify-content:center;background:#276849;color:white;font-weight:800}#px-result strong{color:#28744a}#px-result p{margin:5px 0;font-size:13px}';var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){entry();new MutationObserver(entry).observe(document.body,{childList:true,subtree:true});});else{entry();new MutationObserver(entry).observe(document.body,{childList:true,subtree:true});}
})();
