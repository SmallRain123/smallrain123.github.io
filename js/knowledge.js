(function () {
  const root = document.getElementById('knowledge-app');
  if (!root) return;

  const grid = document.getElementById('kb-grid');
  const chips = document.getElementById('kb-categories');
  const count = document.getElementById('kb-count');
  const empty = document.getElementById('kb-empty');
  const search = document.getElementById('kb-search-input');
  const sort = document.getElementById('kb-sort');
  const more = document.getElementById('kb-more');
  const moreWrap = document.getElementById('kb-more-wrap');
  const statTotal = document.getElementById('kb-stat-total');
  const statCats = document.getElementById('kb-stat-cats');
  const sideTotal = document.getElementById('kb-side-total');
  const sideCatsCount = document.getElementById('kb-side-cats-count');
  const sideTagsCount = document.getElementById('kb-side-tags-count');
  const sideCats = document.getElementById('kb-side-cats');
  const sideTags = document.getElementById('kb-side-tags');
  const sideRecent = document.getElementById('kb-side-recent');
  const PAGE_SIZE = 12;

  const CATEGORY_META = {
    'Linux / 系统': { icon: '🐧', color: '#5f9fd8' },
    'AI / 工具': { icon: '🤖', color: '#8f7bff' },
    '办公工具': { icon: '💼', color: '#56a99a' },
    'GPU / 驱动': { icon: '⚡', color: '#e9a23b' },
    '开发环境': { icon: '🛠️', color: '#e26a9c' },
    'Docker / 容器': { icon: '🐳', color: '#2f9bd0' },
    '使用指南': { icon: '✨', color: '#ec6a9e' },
    '后端': { icon: '🧩', color: '#7d6de0' },
    '工程化': { icon: '⚙️', color: '#5a8f8a' },
    '其他': { icon: '📎', color: '#a08ba6' },
  };

  let entries = [];
  let activeCategory = '全部';
  let visible = PAGE_SIZE;

  const metaFor = category => CATEGORY_META[category] || CATEGORY_META['其他'];

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const fmtDate = value => {
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return '';
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const readingMinutes = entry => Math.max(1, Math.ceil((entry.content || '').length / 350));

  function categoriesWithCounts() {
    const counter = new Map();
    entries.forEach(entry => counter.set(entry.category, (counter.get(entry.category) || 0) + 1));
    return [
      { name: '全部', count: entries.length },
      ...[...counter.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count })),
    ];
  }

  function setCategory(name) {
    activeCategory = name;
    visible = PAGE_SIZE;
    renderCategories();
    renderSidebar();
    render();
  }

  function renderCategories() {
    chips.textContent = '';
    categoriesWithCounts().forEach(({ name, count }) => {
      const meta = metaFor(name);
      const button = el('button', 'kb-chip');
      button.type = 'button';
      button.classList.toggle('is-active', name === activeCategory);
      button.style.setProperty('--kb-accent', meta.color);
      button.appendChild(el('span', 'kb-chip-icon', meta.icon));
      button.appendChild(el('span', 'kb-chip-name', name));
      button.appendChild(el('span', 'kb-chip-count', count));
      button.addEventListener('click', () => setCategory(name));
      chips.appendChild(button);
    });
  }

  function renderSidebar() {
    const categories = categoriesWithCounts();
    const tags = new Map();
    entries.forEach(entry => (entry.tags || []).forEach(tag => tags.set(tag, (tags.get(tag) || 0) + 1)));

    sideTotal.textContent = entries.length;
    sideCatsCount.textContent = categories.length - 1;
    sideTagsCount.textContent = tags.size;
    sideCats.textContent = '';
    sideTags.textContent = '';
    sideRecent.textContent = '';

    categories.forEach(({ name, count }) => {
      const meta = metaFor(name);
      const button = el('button', 'kb-side-cat');
      button.type = 'button';
      button.classList.toggle('is-active', name === activeCategory);
      button.style.setProperty('--kb-accent', meta.color);
      const left = el('span', 'kb-side-cat-left');
      left.appendChild(el('span', 'kb-side-cat-icon', meta.icon));
      left.appendChild(el('span', 'kb-side-cat-name', name));
      button.appendChild(left);
      button.appendChild(el('span', 'kb-side-cat-count', count));
      button.addEventListener('click', () => {
        setCategory(name);
        document.querySelector('.kb-main').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      sideCats.appendChild(button);
    });

    [...tags.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([tag, tagCount]) => {
        const button = el('button', 'kb-side-tag');
        button.type = 'button';
        button.textContent = `#${tag}`;
        button.title = `${tagCount} 条`;
        button.addEventListener('click', () => {
          search.value = tag;
          setCategory('全部');
          document.querySelector('.kb-main').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        sideTags.appendChild(button);
      });

    [...entries]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 4)
      .forEach(entry => {
        const link = el('a', 'kb-side-recent-item');
        link.href = entry.url;
        link.appendChild(el('span', 'kb-side-recent-title', entry.title));
        link.appendChild(el('span', 'kb-side-recent-date', fmtDate(entry.date)));
        sideRecent.appendChild(link);
      });
  }

  function sortedEntries() {
    return [...entries]
      .filter(entry => activeCategory === '全部' || entry.category === activeCategory)
      .filter(entry => {
        const keyword = search.value.trim().toLowerCase();
        if (!keyword) return true;
        return [entry.title, entry.summary, entry.category, ...(entry.tags || []), entry.content]
          .join(' ')
          .toLowerCase()
          .includes(keyword);
      })
      .sort((a, b) => {
        if (sort.value === 'title') return a.title.localeCompare(b.title, 'zh-CN');
        return new Date(b.date) - new Date(a.date);
      });
  }

  function card(entry, index) {
    const meta = metaFor(entry.category);
    const link = el('a', 'kb-card');
    link.href = entry.url;
    link.style.setProperty('--kb-accent', meta.color);

    const top = el('div', 'kb-card-top');
    top.appendChild(el('span', 'kb-icon', meta.icon));
    top.appendChild(el('span', 'kb-cat', entry.category || '未分类'));
    top.appendChild(el('time', 'kb-date', fmtDate(entry.date)));
    link.appendChild(top);

    link.appendChild(el('span', 'kb-no', String(index + 1).padStart(2, '0')));
    link.appendChild(el('h3', 'kb-title', entry.title));
    link.appendChild(el('p', 'kb-summary', entry.summary || ''));

    const tags = el('div', 'kb-tags');
    (entry.tags || []).slice(0, 4).forEach(tag => tags.appendChild(el('span', 'kb-tag', `#${tag}`)));
    link.appendChild(tags);

    const footer = el('div', 'kb-card-footer');
    footer.appendChild(el('span', 'kb-readtime', `约 ${readingMinutes(entry)} 分钟阅读`));
    footer.appendChild(el('span', 'kb-arrow', '阅读笔记 →'));
    link.appendChild(footer);

    return link;
  }

  function render() {
    const visibleEntries = sortedEntries();
    const shown = visibleEntries.slice(0, visible);

    grid.textContent = '';
    empty.hidden = visibleEntries.length > 0;
    count.textContent = `共 ${visibleEntries.length} 条 · 显示 ${shown.length} 条`;
    statTotal.textContent = entries.length;
    statCats.textContent = new Set(entries.map(entry => entry.category)).size;

    shown.forEach((entry, index) => grid.appendChild(card(entry, index)));

    if (visibleEntries.length > shown.length) {
      moreWrap.hidden = false;
      more.textContent = `加载更多（还有 ${visibleEntries.length - shown.length} 条）`;
    } else {
      moreWrap.hidden = true;
    }
  }

  function refresh(reset = true) {
    if (reset) visible = PAGE_SIZE;
    renderCategories();
    renderSidebar();
    render();
  }

  more.addEventListener('click', () => {
    visible += PAGE_SIZE;
    render();
  });
  sort.addEventListener('change', () => refresh(true));
  search.addEventListener('input', () => refresh(true));

  document.addEventListener('keydown', event => {
    if (event.key === '/' && document.activeElement !== search) {
      event.preventDefault();
      search.focus();
    }
    if (event.key === 'Escape' && document.activeElement === search) {
      search.value = '';
      search.blur();
      refresh(true);
    }
  });

  fetch('/knowledge.json', { cache: 'no-cache' })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      entries = Array.isArray(data) ? data : [];
      refresh(true);
    })
    .catch(error => {
      count.textContent = '加载失败';
      empty.hidden = false;
      empty.textContent = `知识库数据加载失败：${error.message}`;
    });
})();
