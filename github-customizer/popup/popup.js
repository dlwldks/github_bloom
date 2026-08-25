/* GitHub Bloom — popup.js v9 */

/* 모델명은 여기 한 곳에서만 관리 (버전 퇴역 시 이 줄만 교체) */
const MODEL = 'claude-sonnet-4-6';

/* 응답 길이 제한 (글자 수) */
const MAX_CHARS = 400;

const THEMES = {
  github: { label: '깃허브', colors: ['#ebedf0','#9be9a8','#40c463','#30a14e','#216e39'] },
  ocean:  { label: '오션',   colors: ['#e8f4fd','#a8d8ea','#4fb3d9','#1a7fa3','#0a4d6e'] },
  sunset: { label: '선셋',   colors: ['#fef0e6','#f9c784','#f4874b','#e05c28','#a33010'] },
  purple: { label: '퍼플',   colors: ['#EEEDFE','#AFA9EC','#7F77DD','#534AB7','#26215C'] },
  pink:   { label: '핑크',   colors: ['#FBEAF0','#ED93B1','#D4537E','#993556','#4B1528'] },
  mono:   { label: '모노',   colors: ['#f0f0f0','#c0c0c0','#888888','#555555','#222222'] },
  fire:   { label: '파이어', colors: ['#fff8e1','#ffcc80','#ff7043','#e53935','#880e4f'] },
};

const SEED = [0,1,0,2,0,3,1,0,4,2,0,1,3,0,2,1,0,4,0,1,2,0,3,1,0,2,0,1,0,3,2,0,4,1,0,2,0,1,3,0,1,0,2,0,4,0,1,0,3,2];

let selectedTheme = 'github';
let customColors = ['#ebedf0','#9be9a8','#40c463','#30a14e','#216e39'];
let usingCustom = false;
let hexInputs = [];
let aiBusy = false;

/* ── 현재 팔레트 ── */
function getPalette() {
  return usingCustom ? customColors : (THEMES[selectedTheme]?.colors || THEMES.github.colors);
}

/* ── 탭 전환 ── */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});

/* ── 테마 그리드 ── */
function buildThemeGrid() {
  const grid = document.getElementById('theme-grid');
  grid.innerHTML = '';
  Object.entries(THEMES).forEach(([key, t]) => {
    const item = document.createElement('div');
    item.className = 'theme-item' + (!usingCustom && key === selectedTheme ? ' active' : '');
    item.innerHTML = `
      <div class="theme-swatch">
        ${t.colors.slice(1).map(c => `<div class="swatch-cell" style="background:${c}"></div>`).join('')}
      </div>
      <div class="theme-name">${t.label}</div>`;
    item.addEventListener('click', () => {
      selectedTheme = key;
      usingCustom = false;
      customColors = [...t.colors];
      document.querySelectorAll('.theme-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      syncColorPicker();
      renderMiniGrass();
    });
    grid.appendChild(item);
  });
}

/* ── 커스텀 색상 피커 ── */
function buildColorPicker() {
  const dotsWrap = document.getElementById('color-dots');
  const hexWrap = document.getElementById('hex-inputs');
  dotsWrap.innerHTML = '';
  hexWrap.innerHTML = '';

  customColors.forEach((color, i) => {
    // 색상 원형 피커
    const dot = document.createElement('div');
    dot.className = 'color-dot';
    dot.style.background = color;
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = color;
    dot.appendChild(picker);
    dotsWrap.appendChild(dot);

    // Hex 입력
    const hex = document.createElement('input');
    hex.type = 'text';
    hex.className = 'hex-input';
    hex.value = color;
    hex.maxLength = 7;
    hexWrap.appendChild(hex);

    // 서로를 직접 참조하도록 연결 (전역 hexInputs 의존 제거)
    picker.addEventListener('input', () => {
      customColors[i] = picker.value;
      dot.style.background = picker.value;
      hex.value = picker.value;
      activateCustom();
    });

    hex.addEventListener('input', () => {
      const val = hex.value.startsWith('#') ? hex.value : '#' + hex.value;
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        customColors[i] = val;
        dot.style.background = val;
        picker.value = val;
        activateCustom();
      }
    });
  });

  hexInputs = [...hexWrap.querySelectorAll('.hex-input')];
}

function syncColorPicker() {
  const dots = document.querySelectorAll('#color-dots .color-dot');
  const pickers = document.querySelectorAll('#color-dots input[type="color"]');
  hexInputs = [...document.querySelectorAll('#hex-inputs .hex-input')];
  customColors.forEach((c, i) => {
    if (dots[i]) dots[i].style.background = c;
    if (pickers[i]) pickers[i].value = c;
    if (hexInputs[i]) hexInputs[i].value = c;
  });
}

function activateCustom() {
  usingCustom = true;
  document.querySelectorAll('.theme-item').forEach(i => i.classList.remove('active'));
  renderMiniGrass();
}

/* ── 미니 잔디 미리보기 ── */
function renderMiniGrass() {
  const container = document.getElementById('mini-grass');
  container.innerHTML = '';
  const palette = getPalette();
  let idx = 0;
  for (let w = 0; w < 26; w++) {
    const col = document.createElement('div');
    col.className = 'mini-col';
    for (let d = 0; d < 7; d++) {
      const cell = document.createElement('div');
      cell.className = 'mini-cell';
      cell.style.background = palette[SEED[idx++ % SEED.length]];
      col.appendChild(cell);
    }
    container.appendChild(col);
  }
}

/* ── 탭에 메시지 전송 (에러 방어) ── */
async function sendToTab(msg) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    return await chrome.tabs.sendMessage(tab.id, msg);
  } catch (e) {
    // "Receiving end does not exist" — GitHub 탭이 아니거나 content script 미주입 상태
    console.debug('[GitHub Bloom] content script 없음:', e.message);
    return null;
  }
}

/* ── 적용 버튼 ── */
document.getElementById('btn-apply').addEventListener('click', async () => {
  const theme = usingCustom ? 'custom' : selectedTheme;
  await chrome.storage.sync.set({ theme, customColors });
  await sendToTab({ type: 'APPLY_THEME', theme, customColors });
  const btn = document.getElementById('btn-apply');
  btn.textContent = '✓ 적용됨!';
  setTimeout(() => { btn.textContent = '현재 탭에 적용'; }, 1500);
});

/* ── 리셋 버튼 ── */
document.getElementById('btn-reset').addEventListener('click', async () => {
  selectedTheme = 'github';
  usingCustom = false;
  customColors = [...THEMES.github.colors];
  await chrome.storage.sync.set({ theme: 'github', customColors: null });
  await sendToTab({ type: 'RESET_THEME' });
  buildThemeGrid();
  buildColorPicker();
  renderMiniGrass();
});

/* ── API 키 읽기 (local 우선, 예전 sync 저장분은 자동 이전) ── */
async function getApiKey() {
  const local = await chrome.storage.local.get(['apiKey']);
  if (local.apiKey) return local.apiKey;

  // v5 이하에서 sync에 저장해둔 키 마이그레이션
  const legacy = await chrome.storage.sync.get(['apiKey']);
  if (legacy.apiKey) {
    await chrome.storage.local.set({ apiKey: legacy.apiKey });
    await chrome.storage.sync.remove('apiKey');
    return legacy.apiKey;
  }
  return null;
}

/* ── 마크다운 제거 (모델이 규칙을 어겼을 때의 안전망) ── */
function stripMarkdown(s) {
  return (s || '')
    .replace(/```[\s\S]*?```/g, '')        // 코드 블록
    .replace(/^\s*#{1,6}\s*/gm, '')        // 제목
    .replace(/\*\*(.*?)\*\*/g, '$1')       // 굵게
    .replace(/__(.*?)__/g, '$1')           // 굵게(밑줄형)
    .replace(/\*(.*?)\*/g, '$1')           // 기울임
    .replace(/_(.*?)_/g, '$1')             // 기울임(밑줄형)
    .replace(/`(.*?)`/g, '$1')             // 인라인 코드
    .replace(/^\s*[-*+]\s+/gm, '')         // 불릿
    .replace(/^\s*\d+\.\s+/gm, '')         // 번호 목록
    .replace(/^\s*>\s?/gm, '')             // 인용
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')    // 링크
    .replace(/^\s*[-=]{3,}\s*$/gm, '')     // 구분선
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/* ── 글자 수 제한 (문장 단위로 자연스럽게 자름) ── */
function capLength(s, max = MAX_CHARS) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  // 마지막 문장 끝에서 자르기
  const lastEnd = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
  return lastEnd > max * 0.5 ? cut.slice(0, lastEnd + 1) : cut.trim() + '…';
}

/* ══════════ GitHub API ══════════ */

/** 현재 탭 URL에서 사용자명 추출 (github.com/이름) */
async function getUsernameFromTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return null;
  try {
    const url = new URL(tab.url);
    if (url.hostname !== 'github.com') return null;
    const seg = url.pathname.split('/').filter(Boolean);
    if (!seg.length) return null;
    // 예약어 경로 제외
    const reserved = ['orgs','settings','notifications','explore','marketplace','pulls','issues','codespaces','sponsors','topics','collections','trending','features','about','pricing'];
    if (reserved.includes(seg[0].toLowerCase())) return null;
    return seg[0];
  } catch {
    return null;
  }
}

/** 저장소 목록에서 언어 분포 집계 */
function summarizeLanguages(repos) {
  const count = {};
  repos.forEach(r => { if (r.language) count[r.language] = (count[r.language] || 0) + 1; });
  const total = Object.values(count).reduce((a, b) => a + b, 0);
  if (!total) return null;
  return Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang, n]) => `${lang} ${Math.round((n / total) * 100)}%`)
    .join(', ');
}

/** 저장소 하나를 프롬프트용으로 축약 */
function briefRepo(r) {
  const o = { 이름: r.name };
  if (r.language) o.언어 = r.language;
  if (r.description) o.설명 = r.description.slice(0, 100);
  if (r.stargazers_count) o.스타 = r.stargazers_count;
  if (r.fork) o.포크됨 = true;
  if (r.updated_at) o.최근수정 = r.updated_at.slice(0, 10);
  return o;
}

/** GitHub 공개 API로 사용자 정보 + 저장소 목록 가져오기 */
async function fetchGitHubData(username) {
  const opts = { headers: { 'Accept': 'application/vnd.github+json' } };

  const [userRes, repoRes] = await Promise.all([
    fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, opts),
    fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100`, opts)
  ]);

  if (userRes.status === 403 || repoRes.status === 403) {
    throw new Error('GitHub API 요청 한도를 초과했어요. 한 시간 뒤 다시 시도해주세요.');
  }
  if (!userRes.ok) {
    throw new Error(`GitHub 사용자 조회 실패 (${userRes.status})`);
  }

  const user = await userRes.json();
  const repos = repoRes.ok ? await repoRes.json() : [];

  const own = repos.filter(r => !r.fork);
  const byStars = [...own].sort((a, b) => b.stargazers_count - a.stargazers_count);

  const out = {};
  if (user.name) out.이름 = user.name;
  if (user.login) out.아이디 = user.login;
  if (user.bio) out.소개 = user.bio;
  if (user.company) out.회사 = user.company;
  if (user.location) out.위치 = user.location;
  if (user.public_repos != null) out.공개저장소수 = user.public_repos;
  if (user.followers != null) out.팔로워 = user.followers;
  if (user.created_at) out.가입일 = user.created_at.slice(0, 10);

  const langs = summarizeLanguages(own);
  if (langs) out.언어분포 = langs;

  if (own.length) {
    out.최근작업저장소 = own.slice(0, 6).map(briefRepo);
    const starred = byStars.filter(r => r.stargazers_count > 0).slice(0, 3);
    if (starred.length) out.스타받은저장소 = starred.map(briefRepo);
  }

  const forkCount = repos.length - own.length;
  if (forkCount > 0) out.포크한저장소수 = forkCount;

  return out;
}

/* ── AI 분석 ── */
async function runAI(question) {
  if (aiBusy) return;

  const resp = document.getElementById('ai-resp');
  const askBtn = document.getElementById('btn-ask');

  const show = (text, isError = false) => {
    resp.textContent = text;
    // 'loaded'를 항상 붙여야 에러 메시지도 화면에 보임
    resp.className = 'ai-response loaded' + (isError ? ' error' : '');
  };

  aiBusy = true;
  askBtn.disabled = true;
  show('분석 중...');

  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      show('⚠️ 설정 탭에서 API 키를 먼저 입력해주세요.', true);
      return;
    }

    // 1) 잔디 통계는 DOM에서 (API로는 못 가져옴)
    const domData = (await sendToTab({ type: 'GET_PROFILE' })) || {};

    if (domData.error) {
      show(`⚠️ ${domData.error}`, true);
      return;
    }

    // 2) 저장소·언어 정보는 GitHub API에서
    const username = await getUsernameFromTab();
    if (!username) {
      show('⚠️ GitHub 프로필 페이지에서 실행해주세요. (github.com/사용자명)', true);
      return;
    }

    show('GitHub 정보 불러오는 중...');

    let apiData = {};
    try {
      apiData = await fetchGitHubData(username);
    } catch (e) {
      // API가 실패해도 잔디 통계만으로 분석은 계속 진행
      console.warn('[GitHub Bloom] GitHub API 실패:', e.message);
    }

    const profile = { ...apiData, ...domData };
    console.debug('[GitHub Bloom] AI에 전달할 프로필:', profile);

    show('분석 중...');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system: `당신은 GitHub 프로필을 읽고 날카로운 통찰을 주는 개발 멘토입니다.

[분석 방식]
- 데이터에서 남들이 놓칠 법한 패턴을 하나 짚어내세요. "커밋이 적다", "꾸준히 하세요" 같은 뻔한 요약은 금지입니다.
- 저장소 이름과 설명, 언어 구성을 근거로 이 사람이 실제로 무엇에 끌리는지 추론하세요. 숫자만 나열하지 마세요.
- 관찰 뒤에는 반드시 구체적인 다음 행동을 하나 제안하세요. "포트폴리오를 채우세요" 같은 일반론 대신, 이 사람의 기존 저장소나 언어를 실제로 언급하며 제안하세요.
- 데이터에 없는 사실은 절대 지어내지 마세요. 정보가 부족한 항목은 언급하지 않으면 됩니다.
- 사용자에게 추가 데이터를 요청하지 마세요. 주어진 정보만으로 답을 완성하세요.
- "데이터가 없어서 어렵다"는 식의 변명을 쓰지 마세요. 있는 정보에서 최대한 끌어내세요.
- 칭찬으로 시작하지 마세요. 관찰로 바로 들어가세요.

[출력 형식]
- 순수 텍스트로만 답하세요. 마크다운 기호(**, ##, -, \`)를 절대 쓰지 마세요.
- 제목, 소제목, 목록 없이 문단 하나로만 쓰세요.
- 전체 ${MAX_CHARS}자 이내.
- 이모지는 최대 1개까지만.

프로필: ${JSON.stringify(profile)}`,
        messages: [{ role: 'user', content: question }]
      })
    });

    const data = await res.json().catch(() => null);

    // 에러 응답을 삼키지 않고 그대로 노출
    if (!res.ok) {
      const detail = data?.error?.message || `HTTP ${res.status}`;
      console.error('[GitHub Bloom] API 오류:', res.status, data);
      show(`오류 (${res.status}): ${detail}`, true);
      return;
    }

    const text = data?.content
      ?.filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    if (!text) {
      console.error('[GitHub Bloom] 예상치 못한 응답 형태:', data);
      show('응답이 비어 있어요. 콘솔에서 원본 응답을 확인해주세요.', true);
      return;
    }

    show(capLength(stripMarkdown(text)));
  } catch (e) {
    // fetch 자체가 실패 = 네트워크 차단 또는 CORS
    console.error('[GitHub Bloom] 요청 실패:', e);
    show(`요청 실패: ${e.message}\n(네트워크 연결 또는 host_permissions 설정을 확인해주세요)`, true);
  } finally {
    aiBusy = false;
    askBtn.disabled = false;
  }
}

document.getElementById('btn-ask').addEventListener('click', () => {
  const q = document.getElementById('ai-input').value.trim();
  if (q) runAI(q);
});
document.getElementById('ai-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('btn-ask').click(); }
});
document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', () => runAI(btn.dataset.q));
});

/* ── 설정 저장 ── */
document.getElementById('btn-save-key').addEventListener('click', async () => {
  const key = document.getElementById('api-key-input').value.trim();
  const globalApply = document.getElementById('toggle-global').checked;
  const msg = document.getElementById('save-msg');

  if (key && !key.startsWith('sk-ant-')) {
    msg.textContent = '⚠️ 키 형식이 이상해요 (sk-ant- 로 시작해야 함)';
    setTimeout(() => { msg.textContent = ''; }, 3000);
    return;
  }

  await chrome.storage.local.set({ apiKey: key });   // 키는 기기 내부에만
  await chrome.storage.sync.set({ globalApply });    // 설정은 동기화 OK

  msg.textContent = '✓ 저장됐어요!';
  setTimeout(() => { msg.textContent = ''; }, 2000);
});

/* ── 초기화 ── */
async function init() {
  const { theme, customColors: savedColors, globalApply } =
    await chrome.storage.sync.get(['theme', 'customColors', 'globalApply']);

  if (theme === 'custom' && savedColors) {
    usingCustom = true;
    customColors = savedColors;
  } else {
    selectedTheme = theme || 'github';
    customColors = savedColors || [...(THEMES[selectedTheme]?.colors || THEMES.github.colors)];
  }

  const apiKey = await getApiKey();
  if (apiKey) document.getElementById('api-key-input').value = apiKey;
  if (globalApply !== undefined) document.getElementById('toggle-global').checked = globalApply;

  buildThemeGrid();
  buildColorPicker();
  renderMiniGrass();
}

init();