const cfg = window.OSHI_CONFIG || {};
let DATA = {
videos: [],
songs: [],
performances: []
};

const $ = (selector) => document.querySelector(selector);

function fmtDate(value) {
if (!value) return '日付未設定';

const d = new Date(value);
if (Number.isNaN(d.getTime())) return value;

return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function monthKey(value) {
if (!value) return '日付未設定';

const d = new Date(value);
if (Number.isNaN(d.getTime())) return '日付未設定';

return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月`;
}

function normalize(value) {
return String(value || '').toLowerCase().normalize('NFKC');
}

function youtubeUrl(videoId, seconds) {
if (!videoId) return '#';
return `https://www.youtube.com/watch?v=${videoId}${seconds ? `&t=${seconds}s` : ''}`;
}

function escapeHtml(value) {
return String(value || '').replace(/[&<>"]/g, (char) => {
return {
'&': '&',
'<': '<',
'>': '>',
'"': '"'
}[char];
});
}

async function loadData() {
const status = $('#status');

try {
let loadedData;

```
if (cfg.appsScriptUrl) {
  const url = `${cfg.appsScriptUrl}?action=public`;
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error('Apps Scriptから取得できませんでした');
  }

  loadedData = await response.json();
} else {
  const response = await fetch('./public.sample.json', { cache: 'no-store' });
  loadedData = await response.json();
}

DATA.videos = loadedData.videos || [];
DATA.songs = loadedData.songs || [];
DATA.performances = loadedData.performances || [];

if (status) {
  status.textContent = `読み込み完了：配信 ${DATA.videos.length}件 / 歌唱履歴 ${DATA.performances.length}件`;
}

renderAll();
```

} catch (error) {
if (status) {
status.textContent = `読み込み失敗：${error.message}`;
}
}
}

function videoCard(video) {
const videoId = video.videoId || '';
const url = video.url || youtubeUrl(videoId);

return `    <article class="card">
      ${video.thumbnail ?`<img src="${escapeHtml(video.thumbnail)}" alt="">`: ''}       <div class="cardBody">         <div class="cardTitle">${escapeHtml(video.title || 'タイトル未設定')}</div>         <div class="cardMeta">
          ${fmtDate(video.publishedAt)}${video.category ?` / ${escapeHtml(video.category)}`: ''}         </div>         <a class="openLink" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">配信へ飛ぶ</a>       </div>     </article>
 `;
}

function renderTimeline() {
const root = $('#timelineList');
if (!root) return;

const publicVideos = DATA.videos
.filter((video) => !video.memberOnly)
.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

if (publicVideos.length === 0) {
root.innerHTML = '<p>まだ配信データがありません。</p>';
return;
}

const groups = new Map();

publicVideos.forEach((video) => {
const key = monthKey(video.publishedAt);

```
if (!groups.has(key)) {
  groups.set(key, []);
}

groups.get(key).push(video);
```

});

root.innerHTML = Array.from(groups.entries()).map(([key, videos]) => {
return `       <section class="monthGroup">         <h3>${escapeHtml(key)}</h3>         <div class="cards">
          ${videos.map(videoCard).join('')}         </div>       </section>
    `;
}).join('');
}

function renderVideos() {
const input = $('#videoSearch');
const root = $('#videoResults');

if (!input || !root) return;

const q = normalize(input.value);

if (!q) {
root.innerHTML = '<p>検索ワードを入れると配信が表示されます。</p>';
return;
}

const hits = DATA.videos
.filter((video) => !video.memberOnly)
.filter((video) => {
const haystack = normalize([
video.title,
video.description,
video.category,
Array.isArray(video.tags) ? video.tags.join(' ') : video.tags
].join(' '));

```
  return haystack.includes(q);
});
```

root.innerHTML = hits.map(videoCard).join('') || '<p>該当する配信がありません。</p>';
}

function renderSongs() {
const input = $('#songSearch');
const root = $('#songResults');

if (!input || !root) return;

const q = normalize(input.value);

if (!q) {
root.innerHTML = '<p>検索ワードを入れると曲が表示されます。</p>';
return;
}

const songsById = new Map(DATA.songs.map((song) => [song.songId, song]));
const videosById = new Map(DATA.videos.map((video) => [video.videoId, video]));

const hits = DATA.performances
.filter((performance) => performance.status === '確認済み')
.filter((performance) => {
const song = songsById.get(performance.songId) || {};
const haystack = normalize([
song.title,
song.artist,
song.aliases,
performance.songTitle,
performance.note
].join(' '));

```
  return haystack.includes(q);
});
```

root.innerHTML = hits.map((performance) => {
const song = songsById.get(performance.songId) || {
title: performance.songTitle || '曲名未設定'
};

```
const video = videosById.get(performance.videoId) || {
  title: '配信未設定',
  videoId: performance.videoId
};

const seconds = Number(performance.seconds || 0);
const url = video.url || youtubeUrl(video.videoId, seconds);

return `
  <article class="songHit">
    <div>
      <strong>${escapeHtml(song.title || '曲名未設定')}</strong>${song.artist ? ` / ${escapeHtml(song.artist)}` : ''}
    </div>
    <div>${escapeHtml(video.title || '配信未設定')}</div>
    <div class="cardMeta">
      ${fmtDate(video.publishedAt)}${performance.timestamp ? ` / ${escapeHtml(performance.timestamp)}` : ''}
    </div>
    <a class="openLink" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">該当配信へ飛ぶ</a>
  </article>
`;
```

}).join('') || '<p>該当する曲がありません。</p>';
}

async function loadMembers(password) {
const message = $('#memberMessage');
const root = $('#memberResults');

if (!message || !root) return;

message.textContent = '確認中...';
root.innerHTML = '';

try {
if (!cfg.appsScriptUrl) {
message.textContent = 'Apps Script URLを設定すると、簡易パスワード付きエリアが使えます。';
return;
}

```
const url = `${cfg.appsScriptUrl}?action=member&password=${encodeURIComponent(password)}`;
const response = await fetch(url, { cache: 'no-store' });

if (!response.ok) {
  throw new Error('暗証番号が違うか、取得に失敗しました');
}

const data = await response.json();
const videos = data.videos || [];

message.textContent = `メン限データ：${videos.length}件`;
root.innerHTML = videos.map(videoCard).join('') || '<p>データがありません。</p>';
```

} catch (error) {
message.textContent = error.message;
}
}

function renderAll() {
renderTimeline();
renderVideos();
renderSongs();
}

function setupTabs() {
document.querySelectorAll('.tab').forEach((button) => {
button.addEventListener('click', () => {
document.querySelectorAll('.tab').forEach((tab) => {
tab.classList.remove('is-active');
});

```
  document.querySelectorAll('.panel').forEach((panel) => {
    panel.classList.remove('is-active');
  });

  button.classList.add('is-active');

  const targetPanel = $(`#${button.dataset.tab}`);
  if (targetPanel) {
    targetPanel.classList.add('is-active');
  }
});
```

});
}

function setupSearches() {
const videoSearch = $('#videoSearch');
const songSearch = $('#songSearch');

if (videoSearch) {
videoSearch.addEventListener('input', renderVideos);
}

if (songSearch) {
songSearch.addEventListener('input', renderSongs);
}
}

function setupMemberForm() {
const memberForm = $('#memberForm');

if (!memberForm) return;

memberForm.addEventListener('submit', (event) => {
event.preventDefault();

```
const passwordInput = $('#memberPassword');
const password = passwordInput ? passwordInput.value : '';

loadMembers(password);
```

});
}

function init() {
setupTabs();
setupSearches();
setupMemberForm();
loadData();
}

init();
