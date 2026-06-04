/* GitHub Bloom — popup.js v5 */

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
    picker.addEventListener('input', () => {
      customColors[i] = picker.value;
      dot.style.background = picker.value;
      hexInputs[i].value = picker.value;
      activateCustom();
    });
    dot.appendChild(picker);
    dotsWrap.appendChild(dot);

    // Hex 입력
    const hex = document.createElement('input');
    hex.type = 'text';
    hex.className = 'hex-input';
    hex.value = color;
    hex.maxLength = 7;
    hex.addEventListener('input', () => {
      const val = hex.value.startsWith('#') ? hex.value : '#' + hex.value;
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        customColors[i] = val;
        dot.style.background = val;
        picker.value = val;
        activateCustom();
      }
    });
    hexWrap.appendChild(hex);
  });
}

/* hex input 요소들 참조용 */
function getHexInputs() { return document.querySelectorAll('#hex-inputs .hex-input'); }
let hexInputs = [];

function syncColorPicker() {
  const dots = document.querySelectorAll('#color-dots .color-dot');
  hexInputs = [...document.querySelectorAll('#hex-inputs .hex-input')];
  const pickers = document.querySelectorAll('#color-dots input[type="color"]');
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
    if (!tab?.id) return;
    await chrome.tabs.sendMessage(tab.id, msg);
  } catch (e) {
    // "Receiving end does not exist" — GitHub 탭이 아니거나 content script 미주입 상태
    console.debug('[GitHub Bloom] content script 없음:', e.message);
  }
}

/* ── 적용 버튼 ── */
document.getElementById('btn-apply').addEventListener('click', async () => {
  const theme = usingCustom ? 'custom' : selectedTheme;
  const colors = usingCustom ? customColors : null;
  await chrome.storage.sync.set({ theme, customColors: customColors });
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
  syncColorPicker();
  renderMiniGrass();
});

/* ── AI 분석 ── */
async function runAI(question) {
  const resp = document.getElementById('ai-resp');
  resp.className = 'ai-response';
  resp.textContent = '분석 중...';

  const { apiKey } = await chrome.storage.sync.get(['apiKey']);
  if (!apiKey) { resp.textContent = '⚠️ 설정 탭에서 API 키를 먼저 입력해주세요.'; return; }

  let profile = {};
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) profile = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PROFILE' });
  } catch (_) {}

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: `당신은 GitHub 개발자 프로필 분석 도우미입니다. 한국어로 3문장 이내 간결하고 위트 있게 답변하세요.\n프로필: ${JSON.stringify(profile)}`,
        messages: [{ role: 'user', content: question }]
      })
    });
    const data = await res.json();
    resp.textContent = data.content?.[0]?.text || '응답을 가져오지 못했어요.';
    resp.className = 'ai-response loaded';
  } catch (e) {
    resp.textContent = `오류: ${e.message}`;
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
  await chrome.storage.sync.set({ apiKey: key, globalApply });
  const msg = document.getElementById('save-msg');
  msg.textContent = '✓ 저장됐어요!';
  setTimeout(() => { msg.textContent = ''; }, 2000);
});

/* ── 초기화 ── */
async function init() {
  const { theme, customColors: savedColors, apiKey, globalApply } = await chrome.storage.sync.get(['theme', 'customColors', 'apiKey', 'globalApply']);

  if (theme === 'custom' && savedColors) {
    usingCustom = true;
    customColors = savedColors;
  } else {
    selectedTheme = theme || 'github';
    customColors = savedColors || [...(THEMES[selectedTheme]?.colors || THEMES.github.colors)];
  }

  if (apiKey) document.getElementById('api-key-input').value = apiKey;
  if (globalApply !== undefined) document.getElementById('toggle-global').checked = globalApply;

  buildThemeGrid();
  buildColorPicker();
  hexInputs = [...document.querySelectorAll('#hex-inputs .hex-input')];
  renderMiniGrass();
}

init();
