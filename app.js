const cfg = window.OSHI_CONFIG || {};

let DATA = {
  videos: [],
  songs: [],
  performances: []
};

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value || '').replace(/[&<>\"]/g, (char) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    }[char];
  });
}

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function fmtDate(value) {
  if (!value) return '日付未設定';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function monthKey(value) {
  if (!value) return '日付未設定';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '日付未設定';
  return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月`;
}

function youtubeUrl(videoId, seconds) {
  if (!videoId) return '#';
  return `https://www.youtube.com/watch?v=${videoId}${seconds ? `&t=${seconds}s` : ''}`;
}

function getValue(obj, keys, fallback = '') {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      return obj[key];
    }
  }
  return fallback;
}

function arrayToText(value) {
  if (Array.isArray(value)) return value.join(' ');
  return value || '';
}

function objectText(obj) {
  try {
    return JSON.stringify(obj || {});
  } catch (error) {
    return '';
  }
}

function getVideoId(video) {
  return getValue(video, ['videoId', 'video_id', 'id']);
}

function getVideoTitle(video) {
  return getValue(video, ['title', 'videoTitle', 'video_title', 'name'], 'タイトル未設定');
}

function getVideoDate(video) {
  return getValue(video, ['publishedAt', 'published_at', 'published', 'date', 'createdAt', 'created_at']);
}

function getVideoThumbnail(video) {
  return getValue(video, ['thumbnail', 'thumbnailUrl', 'thumbnail_url', 'thumb', 'image']);
}

function getVideoUrl(video) {
  const url = getValue(video, ['url', 'videoUrl', 'video_url', 'link']);
  if (url) return url;
  return youtubeUrl(getVideoId(video));
}

function getVideoCategory(video) {
  return getValue(video, ['category', 'type']);
}

function isMemberOnly(video) {
  return Boolean(video.memberOnly || video.member_only || video.isMemberOnly);
}

function getSongId(song) {
  return getValue(song, ['songId', 'song_id', 'id']);
}

function getSongTitle(song) {
  return getValue(song, ['title', 'songTitle', 'song_title', 'name'], '曲名未設定');
}

function getSongArtist(song) {
  return getValue(song, ['artist', 'artistName', 'artist_name']);
}

function getPerformanceSongId(performance) {
  return getValue(performance, ['songId', 'song_id']);
}

function getPerformanceVideoId(performance) {
  return getValue(performance, ['videoId', 'video_id']);
}

function getPerformanceSongTitle(performance) {
  return getValue(performance, ['songTitle', 'song_title', 'title', 'name']);
}

function getPerformanceTimestamp(performance) {
  return getValue(performance, ['timestamp', 'time']);
}

function getPerformanceSeconds(performance) {
  const value = getValue(performance, ['seconds', 'startSeconds', 'start_seconds'], 0);
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeSongGroupKey(title, artist) {
  return normalize(`${title} / ${artist}`)
    .replace(/[♪♫🎵🎶]/g, '')
    .replace(/[「」『』【】（）()［］\[\]！!？?]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getActualPerformanceCount() {
  const songsById = new Map(DATA.songs.map((song) => [getSongId(song), song]));
  const uniqueKeys = new Set();

  DATA.performances.forEach((performance) => {
    const songId = getPerformanceSongId(performance);
    const videoId = getPerformanceVideoId(performance);
    const seconds = getPerformanceSeconds(performance);
    const timestamp = getPerformanceTimestamp(performance);

    const song = songsById.get(songId) || {
      title: getPerformanceSongTitle(performance) || '曲名未設定'
    };

    const songTitle = getSongTitle(song);
    const artist = getSongArtist(song);
    const songKey = normalizeSongGroupKey(songTitle, artist);

    const uniqueKey = [
      songKey,
      String(videoId || '').trim(),
      String(seconds || 0),
      normalize(timestamp)
    ].join('__');

    uniqueKeys.add(uniqueKey);
  });

  return uniqueKeys.size;
}

function isShortVideo(video) {
  const title = getVideoTitle(video);

  if (title === '【初配信告知】神引き！？ガチャ引いてみた！【 #水森りんご / #新人Vtuber 】') {
    return false;
  }

  const durationSeconds = Number(getValue(video, ['durationSeconds', 'duration_seconds'], 0));

  return Number.isFinite(durationSeconds) && durationSeconds > 0 && durationSeconds <= 120;
}

function getDaysFromFirstDate(firstDate) {
  const start = new Date(firstDate);
  const today = new Date();

  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - start.getTime();
  return Math.floor(diffMs / 86400000) + 1;
}

function getActivityYear(firstDate) {
  const start = new Date(firstDate);
  const today = new Date();

  let years = today.getFullYear() - start.getFullYear();

  const hasNotReachedAnniversary =
    today.getMonth() < start.getMonth() ||
    (today.getMonth() === start.getMonth() && today.getDate() < start.getDate());

  if (hasNotReachedAnniversary) years--;

  return years + 1;
}

function renderStats() {
  const root = $('#statsSummary');
  if (!root) return;

  const publicVideos = getPublicVideosSortedOldest();

  if (publicVideos.length === 0) {
    root.innerHTML = '<p>まだ集計できる配信データがありません。</p>';
    return;
  }

  const shortCount = publicVideos.filter(isShortVideo).length;
  const videoCount = publicVideos.length - shortCount;

  const nonShortVideos = publicVideos.filter((video) => !isShortVideo(video));
  const firstVideo = nonShortVideos[0] || publicVideos[0];
  const firstDate = getVideoDate(firstVideo);

  const activityYear = getActivityYear(firstDate);
  const daysFromFirst = getDaysFromFirstDate(firstDate);
  const actualPerformanceCount = getActualPerformanceCount();

  root.innerHTML = `
    <div class="statCard">
      <div class="statLabel">ショート動画投稿回数</div>
      <div class="statNumber">${shortCount}</div>
    </div>
    <div class="statCard">
      <div class="statLabel">動画・配信回数</div>
      <div class="statNumber">${videoCount}</div>
    </div>
    <div class="statCard">
      <div class="statLabel">歌唱履歴</div>
      <div class="statNumber">${actualPerformanceCount}</div>
    </div>
    <div class="statCard">
      <div class="statLabel">活動</div>
      <div class="statNumber">${activityYear}年目</div>
    </div>
    <div class="statCard">
      <div class="statLabel">初配信から</div>
      <div class="statNumber">${daysFromFirst}日目</div>
    </div>
    <div class="statNote">
      初配信日：${fmtDate(firstDate)} / ${escapeHtml(getVideoTitle(firstVideo))}
    </div>
  `;
}

function videoCard(video) {
  const title = getVideoTitle(video);
  const thumbnail = getVideoThumbnail(video);
  const url = getVideoUrl(video);
  const date = getVideoDate(video);
  const category = getVideoCategory(video);

  return `
    <article class="card">
      ${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="">` : ''}
      <div class="cardBody">
        <div class="cardTitle">${escapeHtml(title)}</div>
        <div class="cardMeta">${fmtDate(date)}${category ? ` / ${escapeHtml(category)}` : ''}</div>
        <a class="openLink" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">配信へ飛ぶ</a>
      </div>
    </article>
  `;
}

async function loadData() {
  const status = $('#status');

  try {
    let loadedData;

    if (cfg.appsScriptUrl) {
      const response = await fetch(`${cfg.appsScriptUrl}?action=public&cacheBust=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Apps Scriptから取得できませんでした');
      loadedData = await response.json();
    } else {
      const response = await fetch('./public.sample.json', { cache: 'no-store' });
      loadedData = await response.json();
    }

    DATA.videos = Array.isArray(loadedData.videos) ? loadedData.videos : [];
    DATA.songs = Array.isArray(loadedData.songs) ? loadedData.songs : [];
    DATA.performances = Array.isArray(loadedData.performances) ? loadedData.performances : [];

    if (status) {
      const actualPerformanceCount = getActualPerformanceCount();
      status.textContent = `読み込み完了：配信 ${DATA.videos.length}件 / 歌唱履歴 ${actualPerformanceCount}件`;
    }

    renderAll();
  } catch (error) {
    if (status) status.textContent = `読み込み失敗：${error.message}`;
  }
}

function renderTimeline() {
  const root = $('#timelineList');
  if (!root) return;

  const publicVideos = DATA.videos
    .filter((video) => !isMemberOnly(video))
    .sort((a, b) => {
      const dateA = new Date(getVideoDate(a)).getTime();
      const dateB = new Date(getVideoDate(b)).getTime();
      return (Number.isFinite(dateB) ? dateB : 0) - (Number.isFinite(dateA) ? dateA : 0);
    });

  if (publicVideos.length === 0) {
    root.innerHTML = '<p>まだ配信データがありません。</p>';
    return;
  }

  const groups = new Map();
  publicVideos.forEach((video) => {
    const key = monthKey(getVideoDate(video));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(video);
  });

  root.innerHTML = Array.from(groups.entries()).map(([key, videos]) => {
    return `
      <section class="monthGroup">
        <h3>${escapeHtml(key)}</h3>
        <div class="cards">${videos.map(videoCard).join('')}</div>
      </section>
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
    .filter((video) => !isMemberOnly(video))
    .filter((video) => {
      const text = normalize([
        getVideoTitle(video),
        getVideoCategory(video),
        getValue(video, ['description', 'desc']),
        arrayToText(getValue(video, ['tags'])),
        objectText(video)
      ].join(' '));

      return text.includes(q);
    })
    .sort((a, b) => {
      const dateA = new Date(getVideoDate(a)).getTime();
      const dateB = new Date(getVideoDate(b)).getTime();
      return (Number.isFinite(dateB) ? dateB : 0) - (Number.isFinite(dateA) ? dateA : 0);
    });

  if (hits.length === 0) {
    root.innerHTML = '<p>該当する配信がありません。</p>';
    return;
  }

  const grouped = new Map();

  hits.forEach((video) => {
    const title = getVideoTitle(video);
    const key = normalize(title);

    if (!grouped.has(key)) {
      grouped.set(key, {
        title,
        videos: []
      });
    }

    grouped.get(key).videos.push(video);
  });

  root.innerHTML = Array.from(grouped.values()).map((group) => {
    const videos = group.videos;

    if (videos.length === 1) {
      return videoCard(videos[0]);
    }

    return `
      <details class="resultFold duplicateVideos">
        <summary>
          ${escapeHtml(group.title)}
          <span class="foldCount">重複 ${videos.length}件</span>
        </summary>
        <div class="cards foldContent">
          ${videos.map(videoCard).join('')}
        </div>
      </details>
    `;
  }).join('');
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

  const songsById = new Map(DATA.songs.map((song) => [getSongId(song), song]));
  const videosById = new Map(DATA.videos.map((video) => [getVideoId(video), video]));

  const matchedPerformances = DATA.performances.filter((performance) => {
    const songId = getPerformanceSongId(performance);
    const videoId = getPerformanceVideoId(performance);

    const song = songsById.get(songId) || {};
    const video = videosById.get(videoId) || {};

    const text = normalize([
      getSongTitle(song),
      getSongArtist(song),
      arrayToText(getValue(song, ['aliases', 'alias'])),
      getPerformanceSongTitle(performance),
      getPerformanceTimestamp(performance),
      getVideoTitle(video),
      objectText(song),
      objectText(performance)
    ].join(' '));

    return text.includes(q);
  });

  const grouped = new Map();

  matchedPerformances.forEach((performance) => {
    const songId = getPerformanceSongId(performance);
    const videoId = getPerformanceVideoId(performance);

    const song = songsById.get(songId) || {
      title: getPerformanceSongTitle(performance) || '曲名未設定'
    };

    const video = videosById.get(videoId) || {
      videoId,
      title: '配信未設定'
    };

    const songTitle = getSongTitle(song);
    const artist = getSongArtist(song);
    const groupKey = normalizeSongGroupKey(songTitle, artist);

    const dateTime = new Date(getVideoDate(video)).getTime();
    const safeDateTime = Number.isFinite(dateTime) ? dateTime : 0;
    const seconds = getPerformanceSeconds(performance);
    const timestamp = getPerformanceTimestamp(performance);

    const uniquePerformanceKey = [
      String(videoId || '').trim(),
      String(seconds || 0),
      normalize(timestamp)
    ].join('__');

    const item = {
      performance,
      song,
      video,
      dateTime: safeDateTime,
      seconds
    };

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        songTitle,
        artist,
        count: 0,
        seenPerformances: new Set(),
        latest: item
      });
    }

    const group = grouped.get(groupKey);

    if (!group.seenPerformances.has(uniquePerformanceKey)) {
      group.seenPerformances.add(uniquePerformanceKey);
      group.count++;
    }

    const latestDateTime = group.latest.dateTime;
    const latestSeconds = group.latest.seconds;

    if (
      safeDateTime > latestDateTime ||
      (safeDateTime === latestDateTime && seconds > latestSeconds)
    ) {
      group.latest = item;
      group.songTitle = songTitle;
      group.artist = artist;
    }
  });

  const hits = Array.from(grouped.values())
    .sort((a, b) => b.latest.dateTime - a.latest.dateTime);

  root.innerHTML = hits.map((group) => {
    const { songTitle, artist, count, latest } = group;

    const performance = latest.performance;
    const video = latest.video;

    const videoId = getPerformanceVideoId(performance);
    const videoTitle = getVideoTitle(video);
    const seconds = getPerformanceSeconds(performance);
    const timestamp = getPerformanceTimestamp(performance);
    const url = videoId ? youtubeUrl(videoId, seconds) : getVideoUrl(video);

    return `
      <article class="songHit">
        <div>
          <strong>${escapeHtml(songTitle)}</strong>
          ${artist ? ` / ${escapeHtml(artist)}` : ''}
        </div>
        <div>${escapeHtml(videoTitle)}</div>
        <div class="cardMeta">
          ${fmtDate(getVideoDate(video))}
          ${timestamp ? ` / ${escapeHtml(timestamp)}` : ''}
          ${count > 1 ? ` / 歌唱回数 ${count}回` : ''}
        </div>
        <a class="openLink" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">最新の該当配信へ飛ぶ</a>
      </article>
    `;
  }).join('') || '<p>該当する曲がありません。</p>';
}

function renderAll() {
  renderStats();
  renderTimeline();
  renderVideos();
  renderSongs();
}

function setupSearches() {
  const videoSearch = $('#videoSearch');
  const songSearch = $('#songSearch');

  if (videoSearch) {
    videoSearch.addEventListener('input', renderVideos);
    videoSearch.addEventListener('change', renderVideos);
    videoSearch.addEventListener('keyup', renderVideos);
  }

  if (songSearch) {
    songSearch.addEventListener('input', renderSongs);
    songSearch.addEventListener('change', renderSongs);
    songSearch.addEventListener('keyup', renderSongs);
  }
}

function init() {
  setupSearches();
  loadData();
}

init();
