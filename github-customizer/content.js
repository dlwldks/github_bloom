/* GitHub Bloom — content.js v10
   테마/커스텀/깜빡임방지 유지 + 프로필 스크래핑 대폭 보강
   v10: 저장소 정보는 GitHub API로 이관, 여기선 잔디 통계만 담당
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

/* ══════════ 테마 적용 (기존 로직 유지) ══════════ */

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
    const level = Math.min(parseInt(cell.getAttribute('data-level') ?? '0', 10) || 0, 4);
    const color = palette[level];
    if (cell.tagName.toLowerCase() === 'rect') cell.style.fill = color;
    else cell.style.backgroundColor = color;
  });

  // 범례
  document.querySelectorAll('.ContributionCalendar-label ~ * [data-level]').forEach(cell => {
    const level = Math.min(parseInt(cell.getAttribute('data-level') ?? '0', 10) || 0, 4);
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
  if (!relevant) return;
  if (currentTheme !== 'github') hideGrass();

  clearTimeout(applyTimer);
  applyTimer = setTimeout(() => {
    if (currentTheme && currentTheme !== 'github') applyTheme(currentTheme, customColors);
    showGrass();
  }, 150);
});
observer.observe(document.body, { childList: true, subtree: true });

/* ══════════ 스크래핑 유틸 ══════════ */

/** 여러 줄/중복 공백을 한 칸으로 눌러줌 */
function norm(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

/** 셀렉터 목록을 순서대로 시도해서 첫 번째로 잡히는 텍스트 반환 */
function pickText(...selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const t = norm(el?.textContent);
    if (t) return t;
  }
  return '';
}

/** 문자열에서 첫 숫자 추출 (1.2k, 1,234 형태 지원) */
function pickNumber(s) {
  const m = norm(s).match(/[\d,]+(?:\.\d+)?\s*[kKmM]?/);
  return m ? m[0].replace(/\s+/g, '') : null;
}

/**
 * 프로필 상단 네비게이션(Repositories / Projects / Stars 등)의 카운터를 읽음.
 * GitHub이 클래스명을 바꿔도 href 기준으로 찾도록 여러 단계 폴백.
 */
function navCounter(tabName) {
  const candidates = [
    `a[href*="tab=${tabName}"] .Counter`,
    `[data-tab-item="${tabName}"] .Counter`,
    `[data-tab-item*="${tabName}"] .Counter`,
    `a[href*="tab=${tabName}"] [class*="ounter"]`
  ];
  for (const sel of candidates) {
    const n = pickNumber(document.querySelector(sel)?.textContent);
    if (n) return n;
  }
  // 마지막 폴백: 해당 탭 링크 전체 텍스트에서 숫자만 뽑기
  const link = document.querySelector(`a[href*="tab=${tabName}"]`);
  return pickNumber(link?.textContent);
}

/** 팔로워/팔로잉 카운트 */
function socialCount(tabName) {
  const link = document.querySelector(`a[href$="?tab=${tabName}"], a[href*="tab=${tabName}"]`);
  if (!link) return null;
  const bold = link.querySelector('.text-bold, [class*="bold"], span:first-child');
  return pickNumber(bold?.textContent) || pickNumber(link.textContent);
}

/* ══════════ 잔디에서 실제 커밋 통계 뽑기 ══════════ */

/** 셀 하나의 커밋 수를 알아냄 (data-count → 툴팁 → 레벨 추정 순) */
function cellCount(cell) {
  const dc = cell.getAttribute('data-count');
  if (dc != null && dc !== '') return parseInt(dc, 10) || 0;

  // GitHub은 <td id="..."> 와 <tool-tip for="..."> 를 쌍으로 렌더링함
  const id = cell.id;
  if (id) {
    const tip = document.querySelector(`tool-tip[for="${CSS.escape(id)}"]`);
    const text = norm(tip?.textContent);
    if (text) {
      if (/^No contributions/i.test(text)) return 0;
      const n = text.match(/\d[\d,]*/);
      if (n) return parseInt(n[0].replace(/,/g, ''), 10);
    }
  }
  return null; // 정확한 수를 못 구함 → 레벨만 사용
}

function scrapeContributions() {
  const cells = [...document.querySelectorAll('[data-date][data-level]')];
  if (!cells.length) return null;

  const days = cells
    .map(c => ({
      date: c.getAttribute('data-date'),
      level: Math.min(parseInt(c.getAttribute('data-level') ?? '0', 10) || 0, 4),
      count: cellCount(c)
    }))
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date || ''))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (!days.length) return null;

  const hasCounts = days.some(d => d.count !== null);
  const isActive = d => (d.count !== null ? d.count > 0 : d.level > 0);

  // 스트릭 계산
  let longest = 0, run = 0, current = 0;
  for (const d of days) {
    if (isActive(d)) { run++; longest = Math.max(longest, run); }
    else run = 0;
  }
  for (let i = days.length - 1; i >= 0; i--) {
    if (isActive(days[i])) current++;
    else break;
  }

  // 요일별 분포
  const WD = ['일','월','화','수','목','금','토'];
  const byWeekday = {};
  WD.forEach(w => byWeekday[w] = 0);
  for (const d of days) {
    const w = WD[new Date(d.date + 'T00:00:00').getDay()];
    byWeekday[w] += (d.count !== null ? d.count : d.level);
  }

  const activeDays = days.filter(isActive).length;
  const total = hasCounts
    ? days.reduce((s, d) => s + (d.count || 0), 0)
    : null;

  // 가장 바쁜 날
  const busiest = days.reduce((a, b) => {
    const av = a.count !== null ? a.count : a.level;
    const bv = b.count !== null ? b.count : b.level;
    return bv > av ? b : a;
  });

  // 최근 30일
  const last30 = days.slice(-30);
  const recent30Active = last30.filter(isActive).length;

  const weekend = byWeekday['토'] + byWeekday['일'];
  const weekdayTotal = Object.values(byWeekday).reduce((a, b) => a + b, 0);

  return {
    범위: `${days[0].date} ~ ${days[days.length - 1].date}`,
    총커밋: total,
    활동일수: `${activeDays}일 / ${days.length}일`,
    활동비율: `${Math.round((activeDays / days.length) * 100)}%`,
    최장연속: `${longest}일`,
    현재연속: `${current}일`,
    최근30일활동: `${recent30Active}일`,
    가장바쁜날: busiest.date,
    요일별: byWeekday,
    주말비중: weekdayTotal ? `${Math.round((weekend / weekdayTotal) * 100)}%` : '0%'
  };
}

/* ══════════ 프로필 전체 ══════════ */

function scrapeProfile() {
  const isProfilePage = !!document.querySelector('.js-yearly-contributions, .ContributionCalendar, [data-date][data-level]');

  if (!isProfilePage) {
    return { error: 'GitHub 프로필 페이지가 아니에요. github.com/사용자명 으로 이동한 뒤 다시 시도해주세요.' };
  }

  const contribHeading = pickText(
    '.js-yearly-contributions h2',
    '[class*="contribution"] h2',
    'h2.f4.text-normal'
  );

  const profile = {
    아이디: pickText('.p-nickname', '.vcard-username', '[itemprop="additionalName"]'),
    연간커밋: pickNumber(contribHeading)
  };

  Object.keys(profile).forEach(k => {
    if (!profile[k]) delete profile[k];
  });

  const stats = scrapeContributions();
  if (stats) profile.커밋통계 = stats;

  return profile;
}

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
    try {
      sendResponse(scrapeProfile());
    } catch (e) {
      console.error('[GitHub Bloom] 프로필 스크래핑 실패:', e);
      sendResponse({ error: e.message });
    }
  }
  return true;
});

/* 디버깅용: 콘솔에서 __bloomProfile() 로 직접 확인 가능 */
window.__bloomProfile = scrapeProfile;