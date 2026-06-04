/* GitHub Bloom — content.js v7
   툴팁 제거, 테마/커스텀/깜빡임방지/에러방어 유지
*/

const THEMES = {
  github: { label: '깃허브', colors: ['#ebedf0','#9be9a8','#40c463','#30a14e','#216e39'] },
  ocean:  { label: '오션',   colors: ['#e8f4fd','#a8d8ea','#4fb3d9','#1a7fa3','#0a4d6e'] },
  sunset: { label: '선셋',   colors: ['#fef0e6','#f9c784','#f4874b','#e05c28','#a33010'] },
  purple: { label: '퍼플',   colors: ['#EEEDFE','#AFA9EC','#7F77DD','#534AB7','#26215C'] },
  pink:   { label: '핑크',   colors: ['#FBEAF0','#ED93B1','#D4537E','#993556','#4B1528'] },
  mono:   { label: '모노',   colors: ['#f0f0f0','#c0c0c0','#888888','#555555','#222222'] },
  fire:   { label: '파이어', colors: ['#fff8e1','#ffcc80','#ff7043','#e53935','#880e4f'] },
  custom: { label: '커스텀', colors: null }
};

let currentTheme = 'github';
let customColors = null;

function getColors() {
  if (currentTheme === 'custom' && customColors) return customColors;
  return THEMES[currentTheme]?.colors || THEMES.github.colors;
}

function applyTheme(themeName, colors) {
  currentTheme = themeName;
  if (colors) customColors = colors;

  const palette = getColors();
  if (!palette) return;

  document.querySelectorAll('td[data-level], rect[data-level], .ContributionCalendar-day').forEach(cell => {
    const level = Math.min(parseInt(cell.getAttribute('data-level') ?? '0', 10), 4);
    const color = palette[level];
    if (cell.tagName.toLowerCase() === 'rect') cell.style.fill = color;
    else cell.style.backgroundColor = color;
  });

  // 범례
  document.querySelectorAll('.ContributionCalendar-label ~ * [data-level]').forEach(cell => {
    const level = Math.min(parseInt(cell.getAttribute('data-level') ?? '0', 10), 4);
    cell.style.backgroundColor = palette[level];
  });
}

function resetTheme() {
  currentTheme = 'github';
  customColors = null;
  document.querySelectorAll('td[data-level], rect[data-level], .ContributionCalendar-day').forEach(cell => {
    cell.style.backgroundColor = '';
    cell.style.fill = '';
  });
}

/* ── 깜빡임 방지 ── */
function getGrassContainer() {
  return document.querySelector('.js-contribution-graph, .ContributionCalendar, .js-yearly-contributions');
}
function hideGrass() { const el = getGrassContainer(); if (el) el.style.visibility = 'hidden'; }
function showGrass() { const el = getGrassContainer(); if (el) el.style.visibility = ''; }

/* ── 초기 로드 ── */
chrome.storage.sync.get(['theme', 'customColors'], (result) => {
  currentTheme = result.theme || 'github';
  customColors = result.customColors || null;
  if (currentTheme !== 'github') applyTheme(currentTheme, customColors);
});

/* ── MutationObserver: 연도 탭 전환 대응 ── */
let applyTimer = null;
const observer = new MutationObserver((mutations) => {
  const relevant = mutations.some(m =>
    [...m.addedNodes].some(n =>
      n.nodeType === 1 && (n.querySelector?.('[data-level]') || n.matches?.('[data-level]'))
    )
  );
  if (relevant && currentTheme !== 'github') hideGrass();
  if (!relevant) return;

  clearTimeout(applyTimer);
  applyTimer = setTimeout(() => {
    if (currentTheme && currentTheme !== 'github') applyTheme(currentTheme, customColors);
    showGrass();
  }, 150);
});
observer.observe(document.body, { childList: true, subtree: true });

/* ── 메시지 수신 ── */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'APPLY_THEME') {
    applyTheme(msg.theme, msg.customColors || null);
    sendResponse({ ok: true });
  }
  if (msg.type === 'RESET_THEME') {
    resetTheme();
    sendResponse({ ok: true });
  }
  if (msg.type === 'GET_PROFILE') {
    sendResponse(scrapeProfile());
  }
  return true;
});

function scrapeProfile() {
  return {
    name: document.querySelector('.p-name')?.textContent?.trim() || document.querySelector('.vcard-username')?.textContent?.trim() || '',
    bio: document.querySelector('.p-note')?.textContent?.trim() || '',
    repos: document.querySelector('a[href*="tab=repositories"] .Counter')?.textContent?.trim() || '?',
    followers: document.querySelector('a[href*="followers"] .text-bold')?.textContent?.trim() || '?',
    contribText: document.querySelector('.js-yearly-contributions h2')?.textContent?.trim() || document.querySelector('[class*="contribution"] h2')?.textContent?.trim() || ''
  };
}
