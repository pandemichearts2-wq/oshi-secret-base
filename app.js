const cfg = window.OSHI_CONFIG || {};
let DATA = { videos: [], songs: [], performances: [] };

const $ = (sel) => document.querySelector(sel);

const fmtDate = (value) => {
if (!value) return '日付未設定';
const d = new Date(value);
if (Number.isNaN(d.getTime())) return value;
return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

const monthKey = (value) => {
const d = new Date(value);
if (Number.isNaN(d.getTime())) return '日付未設定';
return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月`;
};

const normalize = (s) => (s || '').toString().toLowerCase().normalize('NFKC');

const youtubeUrl = (videoId, seconds) =>
`https://www.youtube.com/watch?v=${videoId}${seconds ? `&t=${seconds}s` : ''}`;

function escapeHtml(s) {
return (s || '').toString().replace(/[&<>"]/g, (c) => ({
'&': '&',
'<': '<',
'>': '>',
'"': '"'
}[c]));
}

async function loadData() {
const status = $('#status');

try {
if (cfg.appsScriptUrl) {
const res = await fetch(`${cfg.appsScriptUrl}?action=public`, { cache: 'no-store' });
if (!res.ok) throw new Error('Apps Scriptから取得できませんでした');
DATA = await res.json();
} else {
const res = await fetch('./data/public.sample.json', { cache: 'no-store' });
DATA = await res.json();
}

```
DATA.videos = DATA.videos || [];
DATA.songs = DATA.songs || [];
DATA.performances = DATA.performances || [];

if (status) {
  status.textContent = `読み込み完了：配信 ${DATA.videos.length}件 / 歌唱履歴 ${DATA.performances.length}件`;
}

renderAll();
```

} catch (err) {
if (status) {
status.textContent = `読み込み失敗：${err.message}`;
}
}
}

function videoCard(video) {
const url = video.url || youtubeUrl(video.videoId);

return `<article class="card">
    ${video.thumbnail ? `<img src="${escapeHtml(video.thumbnail)}" alt="">`: ''}     <div class="cardBody">       <div class="cardTitle">${escapeHtml(video.title)}</div>       <div class="cardMeta">${fmtDate(video.publishedAt)}${video.category ?` / ${escapeHtml(video.category)}` : ''}</div> <a class="openLink" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">配信へ飛ぶ</a> </div>

  </article>`;
}

function renderTimeline() {
const root = $('#timelineList');
if (!root) return;

const groups = new Map();

[...DATA.videos]
.filter(v => !v.memberOnly)
.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
.forEach(v => {
const key = monthKey(v.publishedAt);
if (!groups.has(key)) groups.set(key, []);
groups.get(key).push(v);
});

root.innerHTML = [...groups.entries()].map(([key, videos]) => `    <section class="monthGroup">       <h3>${escapeHtml(key)}</h3>
      ${videos.map(v =>` <div class="timelineItem"> <span class="cardMeta">${fmtDate(v.publishedAt)}</span><br> <a href="${escapeHtml(v.url || youtubeUrl(v.videoId))}" target="_blank" rel="noopener noreferrer">${escapeHtml(v.title)}</a> </div>
`).join('')}     </section>
  `).join('') || '<p>まだデータがありません。</p>';
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

const hits = DATA.videos.filter(v => !v.memberOnly).filter(v => {
const hay = normalize([v.title, v.description, v.category, (v.tags || []).join(' ')].join(' '));
return hay.includes(q);
});

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

const songsById = new Map(DATA.songs.map(s => [s.songId, s]));
const videosById = new Map(DATA.videos.map(v => [v.videoId, v]));

const hits = DATA.performances.filter(p => p.status === '確認済み').filter(p => {
const song = songsById.get(p.songId) || {};
const hay = normalize([song.title, song.artist, song.aliases, p.note].join(' '));
return hay.includes(q);
});

root.innerHTML = hits.map(p => {
const song = songsById.get(p.songId) || { title: p.songTitle || '曲名未設定' };
const video = videosById.get(p.videoId) || { title: '配信未設定', videoId: p.videoId };
const seconds = Number(p.seconds || 0);
const url = video.videoId ? youtubeUrl(video.videoId, seconds) : video.url;

```
return `<article class="songHit">
  <div><strong>${escapeHtml(song.title)}</strong>${song.artist ? ` / ${escapeHtml(song.artist)}` : ''}</div>
  <div>${escapeHtml(video.title)}</div>
  <div class="cardMeta">${fmtDate(video.publishedAt)}${p.timestamp ? ` / ${escapeHtml(p.timestamp)}` : ''}</div>
  <a class="openLink" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">該当配信へ飛ぶ</a>
</article>`;
```

}).join('') || '<p>該当する曲がありません。</p>';
}

async function loadMembers(password) {
const msg = $('#memberMessage');
const root = $('#memberResults');

if (!msg || !root) return;

msg.textContent = '確認中...';
root.innerHTML = '';

try {
if (!cfg.appsScriptUrl) {
msg.textContent = 'Apps Script URLを設定すると、簡易パスワード付きエリアが使えます。';
return;
}

```
const url = `${cfg.appsScriptUrl}?action=member&password=${encodeURIComponent(password)}`;
const res = await fetch(url, { cache: 'no-store' });

if (!res.ok) throw new Error('暗証番号が違うか、取得に失敗しました');

const data = await res.json();
const videos = data.videos || [];

msg.textContent = `メン限データ：${videos.length}件`;
root.innerHTML = videos.map(videoCard).join('') || '<p>データがありません。</p>';
```

} catch (err) {
msg.textContent = err.message;
}
}

function renderAll() {
renderTimeline();
renderVideos();
renderSongs();
}

function setupEvents() {
document.querySelectorAll('.tab').forEach(btn => {
btn.addEventListener('click', () => {
document.querySelectorAll('.tab').forEach(b => b.classList.remove('is-active'));
document.querySelectorAll('.panel').forEach(p => p.classList.remove('is-active'));

```
  btn.classList.add('is-active');

  const panel = $(`#${btn.dataset.tab}`);
  if (panel) panel.classList.add('is-active');
});
```

});

const videoSearch = $('#videoSearch');
if (videoSearch) videoSearch.addEventListener('input', renderVideos);

const songSearch = $('#songSearch');
if (songSearch) songSearch.addEventListener('input', renderSongs);

const memberForm = $('#memberForm');
if (memberForm) {
memberForm.addEventListener('submit', (e) => {
e.preventDefault();
const password = $('#memberPassword') ? $('#memberPassword').value : '';
loadMembers(password);
});
}
}

setupEvents();
loadData();
