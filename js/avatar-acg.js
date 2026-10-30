/*!
 * 小鱼技术栈 · 二次元头像光圈 & 随机二次元灯箱
 * 点击侧边栏 / 导航头像 → 从二次元图片 API 随机抽一张壁纸
 * 依赖：window.fetch（现代浏览器）；API 不可用时回退本地头像
 */
(function () {
  'use strict';

  var FALLBACK_IMG = '/img/avatar.jpg';
  var TIMEOUT_MS = 12000;
  var SOURCES = [
    /* tier 1：每次随机挑一个，安全向的壁纸站 */
    { name: '樱道 · 二次元', url: 'https://t.alcy.cc/ycy', cacheBust: true, tier: 1 },
    { name: '樱道 · 萌系壁纸', url: 'https://t.alcy.cc/moe', cacheBust: true, tier: 1 },
    { name: '樱道 · 电脑壁纸', url: 'https://t.alcy.cc/pc', cacheBust: true, tier: 1 },
    /* tier 2：仅在主源全部失败时兜底 */
    { name: 'LoliAPI · 二次元', url: 'https://www.loliapi.com/acg/', cacheBust: false, tier: 2 }
  ];

  var box = null;
  var objectUrl = null;
  var requestId = 0;
  var drawnCount = 0;
  var lastFocus = null;

  function shuffle(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function withBust(source) {
    if (!source.cacheBust) return source.url;
    return source.url + (source.url.indexOf('?') === -1 ? '?' : '&') + '_=' + Date.now();
  }

  function preload(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('image decode failed')); };
      img.src = src;
    });
  }

  function extensionOf(type) {
    if (type === 'image/webp') return '.webp';
    if (type === 'image/png') return '.png';
    if (type === 'image/gif') return '.gif';
    if (type === 'image/avif') return '.avif';
    return '.jpg';
  }

  function fetchImage(source) {
    var url = withBust(source);
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, TIMEOUT_MS);

    return fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.blob();
    }).then(function (blob) {
      if (!blob || !/^image\//.test(blob.type)) throw new Error('not an image');
      return blob;
    }).then(function (blob) {
      clearTimeout(timer);
      return blob;
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  function buildLightbox() {
    if (box) return box;

    var root = document.createElement('div');
    root.className = 'acg-lightbox';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', '随机二次元壁纸');
    root.innerHTML = [
      '<div class="acg-lightbox__backdrop" data-close="1"></div>',
      '<figure class="acg-lightbox__card">',
      '  <button class="acg-lightbox__close" type="button" aria-label="关闭" data-close="1">✕</button>',
      '  <div class="acg-lightbox__frame is-loading">',
      '    <div class="acg-lightbox__spinner" aria-hidden="true"><span></span></div>',
      '    <p class="acg-lightbox__hint">正在召唤二次元…</p>',
      '    <img class="acg-lightbox__img" alt="随机二次元壁纸" decoding="async" />',
      '  </div>',
      '  <figcaption class="acg-lightbox__meta">',
      '    <span class="acg-lightbox__tag">♡ 随机二次元</span>',
      '    <span class="acg-lightbox__source"></span>',
      '  </figcaption>',
      '  <div class="acg-lightbox__actions">',
      '    <button type="button" class="acg-lightbox__btn acg-lightbox__btn--primary" data-act="next">🎲 再抽一张</button>',
      '    <a class="acg-lightbox__btn acg-lightbox__btn--save" data-act="save" download>⬇ 保存图片</a>',
      '    <button type="button" class="acg-lightbox__btn acg-lightbox__btn--ghost" data-close="1">关闭</button>',
      '  </div>',
      '</figure>'
    ].join('\n');
    document.body.appendChild(root);

    root.addEventListener('click', function (event) {
      var target = event.target;
      if (!(target instanceof Element)) return;
      var act = target.closest('[data-act]');
      if (act && act.getAttribute('data-act') === 'next') {
        event.preventDefault();
        draw();
        return;
      }
      if (target.closest('[data-close]')) {
        event.preventDefault();
        close();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (!box || !box.root.classList.contains('is-open')) return;
      if (event.key === 'Escape') close();
      else if (event.key === 'ArrowRight') draw();
    });

    box = {
      root: root,
      frame: root.querySelector('.acg-lightbox__frame'),
      img: root.querySelector('.acg-lightbox__img'),
      hint: root.querySelector('.acg-lightbox__hint'),
      source: root.querySelector('.acg-lightbox__source'),
      save: root.querySelector('[data-act="save"]'),
      closeBtn: root.querySelector('.acg-lightbox__close')
    };
    return box;
  }

  function setFrame(state, message) {
    box.frame.classList.remove('is-loading', 'is-ready', 'is-error');
    box.frame.classList.add('is-' + state);
    box.hint.textContent = message || '';
  }

  function showBlob(blob, source) {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    objectUrl = URL.createObjectURL(blob);
    return preload(objectUrl).then(function () {
      box.img.src = objectUrl;
      setFrame('ready');
      box.source.textContent = source.name + ' · 第 ' + drawnCount + ' 张';
      box.save.href = objectUrl;
      box.save.setAttribute('download', 'acg-' + Date.now() + extensionOf(blob.type));
      box.save.removeAttribute('target');
      box.save.removeAttribute('rel');
      box.save.textContent = '⬇ 保存图片';
      box.save.classList.remove('is-disabled');
      box.save.removeAttribute('aria-disabled');
    });
  }

  function showDirect(url, source, ticket) {
    return preload(url).then(function () {
      if (ticket !== requestId) throw new Error('stale');
      box.img.src = url;
      setFrame('ready');
      box.source.textContent = source.name + ' · 第 ' + drawnCount + ' 张';
      box.save.href = url;
      box.save.removeAttribute('download');
      box.save.setAttribute('target', '_blank');
      box.save.setAttribute('rel', 'noopener noreferrer');
      box.save.textContent = '🌐 查看原图';
      box.save.classList.remove('is-disabled');
      box.save.removeAttribute('aria-disabled');
    });
  }

  function draw() {
    if (!box) buildLightbox();
    var ticket = ++requestId;
    drawnCount += 1;
    setFrame('loading', '正在召唤二次元…');
    box.source.textContent = '';

    var primary = SOURCES.filter(function (s) { return s.tier !== 2; });
    var backup = SOURCES.filter(function (s) { return s.tier === 2; });
    var queue = shuffle(primary).concat(backup);

    var chain = Promise.reject(new Error('start'));
    queue.forEach(function (source) {
      chain = chain.catch(function () {
        return fetchImage(source).then(function (blob) {
          if (ticket !== requestId) throw new Error('stale');
          return showBlob(blob, source);
        });
      });
    });

    return chain.catch(function () {
      /* 跨域被拦截时，退回浏览器直接加载图片（无需 CORS） */
      var direct = Promise.reject(new Error('start'));
      queue.forEach(function (source) {
        direct = direct.catch(function () {
          return showDirect(withBust(source), source, ticket);
        });
      });
      return direct;
    }).catch(function () {
      if (ticket !== requestId) return;
      setFrame('error', '没召唤出来…再点一次试试');
      box.img.src = FALLBACK_IMG;
      box.source.textContent = '本地头像兜底';
      box.save.removeAttribute('href');
      box.save.classList.add('is-disabled');
      box.save.setAttribute('aria-disabled', 'true');
    });
  }

  function open() {
    lastFocus = document.activeElement;
    if (!box) buildLightbox();
    document.documentElement.classList.add('acg-lock');
    box.root.classList.add('is-open');
    box.closeBtn.focus({ preventScroll: true });
    draw();
  }

  function close() {
    if (!box) return;
    box.root.classList.remove('is-open');
    document.documentElement.classList.remove('acg-lock');
    requestId += 1;
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus({ preventScroll: true });
    }
  }

  function decorateAvatars() {
    var nodes = document.querySelectorAll('.avatar-img');
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.classList.contains('acg-avatar')) return;
      node.classList.add('acg-avatar');
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
      node.setAttribute('title', '点我抽一张二次元壁纸');
      node.setAttribute('aria-label', '点我抽一张二次元壁纸');
      if (!node.querySelector('.acg-avatar__badge')) {
        var badge = document.createElement('span');
        badge.className = 'acg-avatar__badge';
        badge.setAttribute('aria-hidden', 'true');
        badge.textContent = '✦';
        node.appendChild(badge);
      }
      node.addEventListener('click', function (event) {
        event.preventDefault();
        open();
      });
      node.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    });
  }

  function boot() {
    decorateAvatars();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
