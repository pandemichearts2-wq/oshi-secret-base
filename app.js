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
const youtubeUrl = (videoId, seconds) => `https://www.youtube.com/watch?v=${videoId}${seconds ? `&t=${seconds}s` : ''}`;

function escapeHtml(s) {
  return (s || '').toString().replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
}

async function loadData() {
  const status = $('#status');
  try {
    if (cfg.appsScriptUrl) {
      const res = await fetch(`${cfg.appsScriptUrl}?action=public`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Apps Scriptから取得できませんでした');
      DATA = await res.json();
    } else {
     const res = await fetch('./public.sample.json', { cache: 'no-store' });
      DATA = await res.json();
    }
    DATA.videos = DATA.videos || [];
    DATA.songs = DATA.songs || [];
    DATA.performances = DATA.performances || [];
    status.textContent = `読み込み完了：配信 ${DATA.videos.length}件 / 歌唱履歴 ${DATA.performances.length}件`;
    renderAll();
  } catch (err) {
    status.textContent = `読み込み失敗：${err.message}`;
  }
}

function videoCard(video) {
  const url = video.url || youtubeUrl(video.videoId);
  return `<article class="card">
    ${video.thumbnail ? `<img src="${escapeHtml(video.thumbnail)}" alt="">` : ''}
    <div class="cardBody">
      <div class="cardTitle">${escapeHtml(video.title)}</div>
      <div class="cardMeta">${fmtDate(video.publishedAt)}${video.category ? ` / ${escapeHtml(video.category)}` : ''}</div>
      <a class="openLink" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">配信へ飛ぶ</a>
    </div>
  </article>`;
}

function renderTimeline() {
  const root = $('#timelineList');
  const groups = new Map();
  [...DATA.videos]
    .filter(v => !v.memberOnly)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .forEach(v => {
      const key = monthKey(v.publishedAt);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(v);
    });
  root.innerHTML = [...groups.entries()].map(([key, videos]) => `
    <section class="monthGroup">
      <h3>${escapeHtml(key)}</h3>
      ${videos.map(v => `<div class="timelineItem"><span class="cardMeta">${fmtDate(v.publishedAt)}</span><br><a href="${escapeHtml(v.url || youtubeUrl(v.videoId))}" target="_blank" rel="noopener noreferrer">${escapeHtml(v.title)}</a></div>`).join('')}
    </section>
  `).join('') || '<p>まだデータがありません。</p>';
}

function renderVideos() {
  const q = normalize($('#videoSearch').value);

  if (!q) {
    $('#videoResults').innerHTML = '<p>検索ワードを入れると配信が表示されます。</p>';
    return;
  }

  const hits = DATA.videos.filter(v => !v.memberOnly).filter(v => {
    const hay = normalize([v.title, v.description, v.category, (v.tags || []).join(' ')].join(' '));
    return hay.includes(q);
  });

  $('#videoResults').innerHTML = hits.map(videoCard).join('') || '<p>該当する配信がありません。</p>';
}

function renderSongs() {
  const q = normalize($('#songSearch').value);
  const songsById = new Map(DATA.songs.map(s => [s.songId, s]));
  const videosById = new Map(DATA.videos.map(v => [v.videoId, v]));
  const hits = DATA.performances.filter(p => p.status === '確認済み').filter(p => {
    const song = songsById.get(p.songId) || {};
    const hay = normalize([song.title, song.artist, song.aliases, p.note].join(' '));
    return !q || hay.includes(q);
  });
  $('#songResults').innerHTML = hits.map(p => {
    const song = songsById.get(p.songId) || { title: p.songTitle || '曲名未設定' };
    const video = videosById.get(p.videoId) || { title: '配信未設定', videoId: p.videoId };
    const seconds = Number(p.seconds || 0);
    return `<article class="songHit">
      <div><strong>${escapeHtml(song.title)}</strong>${song.artist ? ` / ${escapeHtml(song.artist)}` : ''}</div>
      <div>${escapeHtml(video.title)}</div>
      <div class="cardMeta">${fmtDate(video.publishedAt)}${p.timestamp ? ` / ${escapeHtml(p.timestamp)}` : ''}</div>
      <a class="openLink" href="${escapeHtml(video.url || youtubeUrl(video.videoId, seconds))}" target="_blank" rel="noopener noreferrer">該当配信へ飛ぶ</a>
    </article>`;
  }).join('') || '<p>該当する曲がありません。</p>';
}

async function loadMembers(password) {
  const msg = $('#memberMessage');
  const root = $('#memberResults');
  msg.textContent = '確認中...';
  root.innerHTML = '';
  try {
    if (!cfg.appsScriptUrl) {
      msg.textContent = 'Apps Script URLを設定すると、簡易パスワード付きエリアが使えます。';
      return;
    }
    const url = `${cfg.appsScriptUrl}?action=member&password=${encodeURIComponent(password)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('暗証番号が違うか、取得に失敗しました');
    const data = await res.json();
    const videos = data.videos || [];
    msg.textContent = `メン限データ：${videos.length}件`;
    root.innerHTML = videos.map(videoCard).join('') || '<p>データがありません。</p>';
  } catch (err) {
    msg.textContent = err.message;
  }
}

function renderAll() {
  renderTimeline();
  renderVideos();
  renderSongs();
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('is-active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('is-active'));
    btn.classList.add('is-active');
    $(`#${btn.dataset.tab}`).classList.add('is-active');
  });
});
$('#videoSearch').addEventListener('input', renderVideos);
$('#songSearch').addEventListener('input', renderSongs);
$('#memberForm').addEventListener('submit', (e) => {
  e.preventDefault();
  loadMembers($('#memberPassword').value);
});
loadData();
// 検索するまで配信検索・歌枠検索の結果を表示しない
window.addEventListener('load', () => {
  const videoSearch = document.getElementById('videoSearch');
  const videoResults = document.getElementById('videoResults');
  const songSearch = document.getElementById('songSearch');
  const songResults = document.getElementById('songResults');

  if (videoResults) {
    videoResults.innerHTML = '<p class="empty">検索ワードを入れると配信が表示されます。</p>';
  }

  if (songResults) {
    songResults.innerHTML = '<p class="empty">検索ワードを入れると曲が表示されます。</p>';
  }

  if (videoSearch && videoResults) {
    videoSearch.addEventListener('input', () => {
      if (!videoSearch.value.trim()) {
        videoResults.innerHTML = '<p class="empty">検索ワードを入れると配信が表示されます。</p>';
      }
    });
  }

  if (songSearch && songResults) {
    songSearch.addEventListener('input', () => {
      if (!songSearch.value.trim()) {
        songResults.innerHTML = '<p class="empty">検索ワードを入れると曲が表示されます。</p>';
      }
    });
  }
});
