const cfg = window.OSHI_CONFIG || {};

let DATA = {
  videos: [],
  songs: [],
  performances: []
};

let ACTIVE_TIMELINE_CATEGORY = '';

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

function getVideoViewCount(video) {
  const value = getValue(video, ['viewCount', 'view_count', 'views'], 0);
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function fmtNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return number.toLocaleString('ja-JP');
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

function getSongArtistForSearch(song) {
  const artist = cleanArtistForSearch(getSongArtist(song));
  if (artist) return artist;

  const title = getSongTitle(song);
  const slashParts = String(title || '').split(/[／/]/).map(s => s.trim()).filter(Boolean);
  if (slashParts.length >= 2) return cleanArtistForSearch(slashParts[1]);

  return '';
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

function cleanSongTitleForRanking(title) {
  let text = String(title || '')
    .replace(/[♪♫🎵🎶]/g, '')
    .replace(/[「」『』【】（）()［］\[\]！!？?]/g, '')
    .trim();

  // 既に title 側へ「曲名 / 歌手」ごと入ってしまった古いデータを、ランキングだけ曲名に戻す
  text = text.split(/[／/]/)[0].trim();

  // 先頭に混ざった区切り記号を除去
  text = text
    .replace(/^[\s:：・／/｜|\-－—–〜～~]+/, '')
    .replace(/[\s:：・／/｜|\-－—–〜～~]+$/, '')
    .trim();

  // 「ver」「cover」などが曲名側に混ざった場合の表記ゆれを軽く吸収
  text = text
    .replace(/\s*(?:谷山浩子|手嶌葵|deeen|deen)?\s*ver\.?$/i, '')
    .replace(/\s*(?:cover|covered by).+$/i, '')
    .trim();

  return text || String(title || '').trim();
}

function cleanArtistForSearch(artist) {
  return String(artist || '')
    .replace(/[♪♫🎵🎶]/g, '')
    .replace(/[「」『』【】（）()［］\[\]！!？?]/g, '')
    .replace(/^[\s:：・／/｜|\-－—–〜～~]+/, '')
    .replace(/[\s:：・／/｜|\-－—–〜～~]+$/, '')
    .trim();
}

function getDisplayTimestamp(value) {
  if (!value) return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const total = value.getHours() * 3600 + value.getMinutes() * 60 + value.getSeconds();
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const text = String(value || '').trim();

  const dateMatch = text.match(/1899-12-29T(\d{2}):(\d{2}):(\d{2})/);
  if (dateMatch) {
    const h = Number(dateMatch[1]);
    const m = Number(dateMatch[2]);
    const s = Number(dateMatch[3]);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  return text;
}

function normalizeSongRankingKey(title) {
  return normalize(cleanSongTitleForRanking(title))
    .replace(/[♪♫🎵🎶]/g, '')
    .replace(/[「」『』【】（）()［］\[\]！!？?]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUnsetSongTitle(title) {
  const key = normalize(String(title || ''))
    .replace(/[♪♫🎵🎶]/g, '')
    .replace(/[「」『』【】（）()［］\[\]！!？?]/g, '')
    .trim();

  return !key || key === '曲名未設定' || key === '未設定' || key === 'undefined' || key === 'null';
}

function isIgnoredSongTitle(title) {
  const key = normalize(String(title || ''))
    .replace(/[♪♫🎵🎶]/g, '')
    .replace(/[「」『』【】（）()［］\[\]！!？?]/g, '')
    .replace(/^[\s\-:：・▶]+/, '')
    .replace(/[\s\-:：・▶]+$/, '')
    .trim();

  const ignored = new Set([
    '開始',
    'start',
    '配信開始',
    '本編開始',
    'op',
    'opening',
    'オープニング',
    '待機',
    '待機画面',
    '待機所',
    '待機開け',
    '待機明け',
    'ed',
    'ending',
    'エンディング',
    '終了',
    'end',
    '配信終了',
    '休憩',
    'break',
    '雑談',
    'mc',
    '告知',
    '準備',
    '準備中',
    '音量調整',
    'マイク調整',
    'トイレ',
    '水分補給'
  ]);

  return ignored.has(key);
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
    if (isUnsetSongTitle(songTitle) || isIgnoredSongTitle(songTitle)) return;
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
  const videoId = getVideoId(video);

  if (videoId === 'JUEGLjU-lSo') {
    return false;
  }

  const durationSeconds = Number(getValue(video, ['durationSeconds', 'duration_seconds'], 0));

  return Number.isFinite(durationSeconds) && durationSeconds > 0 && durationSeconds <= 120;
}

function getPublicVideosSortedOldest() {
  return DATA.videos
    .filter((video) => !isMemberOnly(video))
    .filter((video) => getVideoDate(video))
    .sort((a, b) => {
      const dateA = new Date(getVideoDate(a)).getTime();
      const dateB = new Date(getVideoDate(b)).getTime();
      return (Number.isFinite(dateA) ? dateA : 0) - (Number.isFinite(dateB) ? dateB : 0);
    });
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

function getFirstStreamVideo(publicVideos) {
  const firstStreamVideoId = 'l1XC7QgWGxE';
  const found = publicVideos.find((video) => getVideoId(video) === firstStreamVideoId);

  if (found) return found;

  return {
    videoId: firstStreamVideoId,
    title: '初配信',
    publishedAt: '2024-10-24T00:00:00+09:00',
    url: 'https://www.youtube.com/watch?v=l1XC7QgWGxE',
    memberOnly: false
  };
}

function renderProfileLink() {
  const link = $('#litlinkHighlight');
  if (!link) return;

  const url = cfg.litlinkUrl || cfg.litLinkUrl || '';

  if (url) {
    link.href = url;
  } else {
    link.removeAttribute('href');
    link.textContent = 'リットリンクURL未設定';
  }
}

function getOriginalSongFeaturedVideo() {
  const originalSongVideoId = 'rY5kf-ML4V4';
  return DATA.videos.find((video) => getVideoId(video) === originalSongVideoId) || {
    videoId: originalSongVideoId,
    title: 'オリジナルソング',
    publishedAt: '',
    url: 'https://www.youtube.com/watch?v=rY5kf-ML4V4',
    thumbnail: '',
    category: 'オリジナルソング',
    memberOnly: false
  };
}

function getAquariumFeaturedVideo() {
  const aquariumVideoId = 'PhwJjKUSHuA';

  return DATA.videos.find((video) => getVideoId(video) === aquariumVideoId) || {
    videoId: aquariumVideoId,
    title: 'アクアリウムは踊らない',
    publishedAt: '',
    url: 'https://www.youtube.com/watch?v=PhwJjKUSHuA',
    thumbnail: '',
    category: '配信',
    memberOnly: false
  };
}

function getMostViewedVideo() {
  const publicVideos = DATA.videos
    .filter((video) => !isMemberOnly(video))
    .filter((video) => getVideoId(video))
    .filter((video) => getVideoId(video) !== 'rY5kf-ML4V4');

  if (publicVideos.length === 0) return null;

  const videosWithViews = publicVideos.filter((video) => getVideoViewCount(video) > 0);
  const targets = videosWithViews.length ? videosWithViews : publicVideos;

  return targets
    .slice()
    .sort((a, b) => getVideoViewCount(b) - getVideoViewCount(a))[0] || null;
}

function featuredCard(label, video, note) {
  if (!video) return '';

  const title = getVideoTitle(video);
  const thumbnail = getVideoThumbnail(video);
  const url = getVideoUrl(video);
  const date = getVideoDate(video);
  const category = getVideoCategory(video);
  const viewCount = getVideoViewCount(video);

  return `
    <article class="featuredCard">
      <div class="featuredBadge">${escapeHtml(label)}</div>
      ${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="">` : '<div class="featuredNoImage">🍎</div>'}
      <div class="featuredBody">
        <div class="featuredTitle">${escapeHtml(title)}</div>
        <div class="cardMeta">
          ${date ? fmtDate(date) : '日付未設定'}
          ${category ? ` / ${escapeHtml(category)}` : ''}
          ${viewCount ? ` / ${fmtNumber(viewCount)}回再生` : ''}
        </div>
        ${note ? `<p class="featuredNote">${escapeHtml(note)}</p>` : ''}
        <a class="openLink" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">見に行く</a>
      </div>
    </article>
  `;
}

function renderFeaturedVideos() {
  const root = $('#featuredVideos');
  if (!root) return;

  const originalSong = getOriginalSongFeaturedVideo();
  const aquarium = getAquariumFeaturedVideo();
  const mostViewed = getMostViewedVideo();

  const cards = [
    featuredCard('オリジナルソング', originalSong, 'まず聴いてほしい代表曲です。'),
    featuredCard('アクアリウムは踊らない', aquarium, '指定されたおすすめ配信です。'),
    featuredCard('いちばん見られている配信', mostViewed, getVideoViewCount(mostViewed) ? '視聴回数が一番多い公開動画・配信です。' : '視聴回数データ取得後に自動で更新されます。')
  ].filter(Boolean);

  root.innerHTML = cards.join('') || '<p>おすすめ動画を表示できませんでした。</p>';
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
  const firstVideo = getFirstStreamVideo(publicVideos) || nonShortVideos[0] || publicVideos[0];
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

function getNormalizedCategory(video) {
  const title = normalize(getVideoTitle(video));
  const category = normalize(getVideoCategory(video));
  const text = `${title} ${category}`;

  if (text.includes('正拳突き')) return '正拳突き';
  if (text.includes('朗読') || text.includes('読み聞かせ')) return '朗読';
  if (text.includes('歌ってみた') || text.includes('歌みた') || text.includes('cover')) return '歌ってみた';
  if (text.includes('コラボ') || text.includes('対談') || text.includes('ゲスト') || text.includes('凸待ち')) return 'コラボ';
  if (text.includes('pr') || text.includes('案件') || text.includes('winticket')) return 'PR';
  if (text.includes('歌枠') || text.includes('karaoke') || text.includes('sing')) return '歌枠';
  if (text.includes('朝活') || text.includes('おはよう') || text.includes('縦型朝活')) return '朝活';
  if (
    text.includes('実況') ||
    text.includes('ゲーム') ||
    text.includes('deltarune') ||
    text.includes('アクアリウムは踊らない') ||
    text.includes('初見プレイ') ||
    text.includes('プレイ')
  ) {
    return '実況';
  }
  if (text.includes('記念') || text.includes('周年') || text.includes('誕生日') || text.includes('登録者')) return '記念';
  if (text.includes('雑談') || text.includes('マシュマロ') || text.includes('挨拶') || text.includes('あいさつ')) return '雑談';

  return '';
}

function getCategoryCounts() {
  const counts = new Map();

  DATA.videos
    .filter((video) => !isMemberOnly(video))
    .forEach((video) => {
      const category = getNormalizedCategory(video);
      if (!category) return;
      counts.set(category, (counts.get(category) || 0) + 1);
    });

  const preferred = ['歌枠', '雑談', '朝活', 'コラボ', '歌ってみた', '実況', '朗読', '正拳突き', '記念', 'PR'];

  return Array.from(counts.entries())
    .sort((a, b) => {
      const ai = preferred.indexOf(a[0]);
      const bi = preferred.indexOf(b[0]);

      if (ai !== -1 || bi !== -1) {
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      }

      return b[1] - a[1] || a[0].localeCompare(b[0], 'ja');
    });
}

function renderCategoryButtons() {
  const root = $('#categoryButtons');
  if (!root) return;

  const counts = getCategoryCounts();

  if (counts.length === 0) {
    root.innerHTML = '<p>カテゴリを表示できる配信がありません。</p>';
    return;
  }

  root.innerHTML = [
    `<button type="button" class="categoryButton ${ACTIVE_TIMELINE_CATEGORY ? '' : 'isActive'}" data-category="">すべて</button>`,
    ...counts.map(([category, count]) => {
      const active = category === ACTIVE_TIMELINE_CATEGORY ? ' isActive' : '';
      return `<button type="button" class="categoryButton${active}" data-category="${escapeHtml(category)}">${escapeHtml(category)} <span>${count}</span></button>`;
    })
  ].join('');

  root.querySelectorAll('.categoryButton').forEach((button) => {
    button.addEventListener('click', () => {
      ACTIVE_TIMELINE_CATEGORY = button.dataset.category || '';
      renderCategoryButtons();
      renderTimeline();
    });
  });
}

function getTimelineFilterValues() {
  const year = Number(getValue($('#timelineYear'), ['value'], 0));
  const month = Number(getValue($('#timelineMonth'), ['value'], 0));
  const day = Number(getValue($('#timelineDay'), ['value'], 0));

  return {
    year: Number.isFinite(year) ? year : 0,
    month: Number.isFinite(month) ? month : 0,
    day: Number.isFinite(day) ? day : 0
  };
}

function matchesTimelineFilter(video, filter) {
  const value = getVideoDate(video);
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (filter.year && year !== filter.year) return false;
  if (filter.month && month !== filter.month) return false;
  if (filter.day && day !== filter.day) return false;

  return true;
}

function getTimelineFilterLabel(filter) {
  const parts = [];

  if (filter.year) parts.push(`${filter.year}年`);
  if (filter.month) parts.push(`${filter.month}月`);
  if (filter.day) parts.push(`${filter.day}日`);

  return parts.join('') || 'すべて';
}

function renderTimeline() {
  const root = $('#timelineList');
  if (!root) return;

  const filter = getTimelineFilterValues();

  const publicVideos = DATA.videos
    .filter((video) => !isMemberOnly(video))
    .filter((video) => matchesTimelineFilter(video, filter))
    .filter((video) => !ACTIVE_TIMELINE_CATEGORY || getNormalizedCategory(video) === ACTIVE_TIMELINE_CATEGORY)
    .sort((a, b) => {
      const dateA = new Date(getVideoDate(a)).getTime();
      const dateB = new Date(getVideoDate(b)).getTime();
      return (Number.isFinite(dateB) ? dateB : 0) - (Number.isFinite(dateA) ? dateA : 0);
    });

  if (publicVideos.length === 0) {
    const filterLabel = `${getTimelineFilterLabel(filter)}${ACTIVE_TIMELINE_CATEGORY ? ` / ${ACTIVE_TIMELINE_CATEGORY}` : ''}`;
    root.innerHTML = `<p>${escapeHtml(filterLabel)} に該当する配信がありません。</p>`;
    return;
  }

  const groups = new Map();
  publicVideos.forEach((video) => {
    const key = monthKey(getVideoDate(video));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(video);
  });

  root.innerHTML = `
    <p class="filterResult">表示中：${escapeHtml(`${getTimelineFilterLabel(filter)}${ACTIVE_TIMELINE_CATEGORY ? ` / ${ACTIVE_TIMELINE_CATEGORY}` : ''}`)} / ${publicVideos.length}件</p>
    ${Array.from(groups.entries()).map(([key, videos]) => {
      return `
        <section class="monthGroup">
          <h3>${escapeHtml(key)}</h3>
          <div class="cards">${videos.map(videoCard).join('')}</div>
        </section>
      `;
    }).join('')}
  `;
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

function getSongRanking(limit = 5) {
  const songsById = new Map(DATA.songs.map((song) => [getSongId(song), song]));
  const videosById = new Map(DATA.videos.map((video) => [getVideoId(video), video]));
  const grouped = new Map();

  DATA.performances.forEach((performance) => {
    const songId = getPerformanceSongId(performance);
    const videoId = getPerformanceVideoId(performance);
    const seconds = getPerformanceSeconds(performance);
    const timestamp = getPerformanceTimestamp(performance);

    const song = songsById.get(songId) || {
      title: getPerformanceSongTitle(performance) || '曲名未設定'
    };

    const video = videosById.get(videoId) || {
      videoId,
      title: '配信未設定'
    };

    const originalSongTitle = getSongTitle(song);
    const songTitle = cleanSongTitleForRanking(originalSongTitle);
    const artist = getSongArtist(song);
    if (isUnsetSongTitle(songTitle) || isIgnoredSongTitle(songTitle)) return;
    const groupKey = normalizeSongRankingKey(songTitle);
    const uniquePerformanceKey = [
      String(videoId || '').trim(),
      String(seconds || 0),
      normalize(timestamp)
    ].join('__');

    const dateTime = new Date(getVideoDate(video)).getTime();
    const safeDateTime = Number.isFinite(dateTime) ? dateTime : 0;

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
        artist: '',
        count: 0,
        seen: new Set(),
        latest: item
      });
    }

    const group = grouped.get(groupKey);

    if (!group.seen.has(uniquePerformanceKey)) {
      group.seen.add(uniquePerformanceKey);
      group.count++;
    }

    if (
      item.dateTime > group.latest.dateTime ||
      (item.dateTime === group.latest.dateTime && item.seconds > group.latest.seconds)
    ) {
      group.latest = item;
    }
  });

  return Array.from(grouped.values())
    .sort((a, b) => b.count - a.count || String(a.songTitle || '').localeCompare(String(b.songTitle || ''), 'ja'))
    .slice(0, limit);
}

function renderSongRanking() {
  const root = $('#songRanking');
  if (!root) return;

  const ranking = getSongRanking(5);

  if (ranking.length === 0) {
    root.innerHTML = '<p>まだランキングを作れる歌唱履歴がありません。</p>';
    return;
  }

  root.innerHTML = ranking.map((item, index) => {
    const latest = item.latest || {};
    const performance = latest.performance || {};
    const video = latest.video || {};
    const videoId = getPerformanceVideoId(performance);
    const seconds = getPerformanceSeconds(performance);
    const url = videoId ? youtubeUrl(videoId, seconds) : getVideoUrl(video);

    return `
      <article class="rankingItem">
        <div class="rankingRank">${index + 1}</div>
        <div class="rankingBody">
          <div class="rankingTitle">${escapeHtml(String(item.songTitle || '曲名未設定'))}${item.artist ? ` / ${escapeHtml(String(item.artist))}` : ''}</div>
          <div class="cardMeta">歌唱回数 ${item.count}回</div>
        </div>
        <a class="rankingListenButton" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">聞いてみる</a>
      </article>
    `;
  }).join('');
}

function renderSongs() {
  const titleInput = $('#songTitleSearch') || $('#songSearch');
  const artistInput = $('#artistSearch');
  const root = $('#songResults');
  if (!titleInput || !root) return;

  const titleQuery = normalize(titleInput.value);
  const artistQuery = normalize(artistInput ? artistInput.value : '');

  if (!titleQuery && !artistQuery) {
    root.innerHTML = '<p>曲名かアーティスト名を入れると曲が表示されます。</p>';
    return;
  }

  const songsById = new Map(DATA.songs.map((song) => [getSongId(song), song]));
  const videosById = new Map(DATA.videos.map((video) => [getVideoId(video), video]));

  const grouped = new Map();

  DATA.performances.forEach((performance) => {
    const songId = getPerformanceSongId(performance);
    const videoId = getPerformanceVideoId(performance);

    const song = songsById.get(songId) || {
      title: getPerformanceSongTitle(performance) || '曲名未設定'
    };

    const video = videosById.get(videoId) || {
      videoId,
      title: '配信未設定'
    };

    const originalSongTitle = getSongTitle(song) || getPerformanceSongTitle(performance);
    const songTitle = cleanSongTitleForRanking(originalSongTitle);
    const artist = getSongArtistForSearch(song);

    if (isUnsetSongTitle(songTitle) || isIgnoredSongTitle(songTitle)) return;

    const titleText = normalize(songTitle);
    const artistText = normalize(artist);

    const matchesTitle = !titleQuery || titleText.includes(titleQuery);
    const matchesArtist = !artistQuery || artistText.includes(artistQuery);
    if (!matchesTitle || !matchesArtist) return;

    const groupKey = [
      normalizeSongRankingKey(songTitle),
      normalize(artist)
    ].join('__');

    const dateTime = new Date(getVideoDate(video)).getTime();
    const safeDateTime = Number.isFinite(dateTime) ? dateTime : 0;
    const seconds = getPerformanceSeconds(performance);
    const timestamp = getDisplayTimestamp(getPerformanceTimestamp(performance));

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
      seconds,
      timestamp
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
    .sort((a, b) => b.latest.dateTime - a.latest.dateTime || String(a.songTitle || '').localeCompare(String(b.songTitle || ''), 'ja'));

  // 同じ配信タイトルは検索結果に1件だけ表示する
  const visibleHits = [];
  const seenVideoTitles = new Set();

  hits.forEach((group) => {
    const videoTitleKey = normalize(getVideoTitle(group.latest.video));
    if (videoTitleKey && seenVideoTitles.has(videoTitleKey)) return;
    if (videoTitleKey) seenVideoTitles.add(videoTitleKey);
    visibleHits.push(group);
  });

  root.innerHTML = visibleHits.map((group) => {
    const { songTitle, artist, count, latest } = group;

    const performance = latest.performance;
    const video = latest.video;

    const videoId = getPerformanceVideoId(performance);
    const videoTitle = getVideoTitle(video);
    const seconds = getPerformanceSeconds(performance);
    const timestamp = latest.timestamp || getDisplayTimestamp(getPerformanceTimestamp(performance));
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

function safeRender_(name, fn) {
  try {
    fn();
  } catch (error) {
    console.error(`${name} failed`, error);
  }
}

function renderAll() {
  safeRender_('renderProfileLink', renderProfileLink);
  safeRender_('renderFeaturedVideos', renderFeaturedVideos);
  safeRender_('renderSongRanking', renderSongRanking);
  safeRender_('renderCategoryButtons', renderCategoryButtons);
  safeRender_('renderStats', renderStats);
  safeRender_('renderTimeline', renderTimeline);
  safeRender_('renderVideos', renderVideos);
  safeRender_('renderSongs', renderSongs);
}


function resetSearchInput(input) {
  if (!input) return;
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function setupSearches() {
  const videoSearch = $('#videoSearch');
  const videoSearchClear = $('#videoSearchClear');
  const songTitleSearch = $('#songTitleSearch') || $('#songSearch');
  const artistSearch = $('#artistSearch');
  const songSearchClear = $('#songSearchClear');

  if (videoSearch) {
    videoSearch.addEventListener('input', renderVideos);
    videoSearch.addEventListener('change', renderVideos);
    videoSearch.addEventListener('keyup', renderVideos);
  }

  if (videoSearchClear) {
    videoSearchClear.addEventListener('click', () => {
      resetSearchInput(videoSearch);
      if (videoSearch) videoSearch.focus();
      renderVideos();
    });
  }

  [songTitleSearch, artistSearch].forEach((input) => {
    if (!input) return;
    input.addEventListener('input', renderSongs);
    input.addEventListener('change', renderSongs);
    input.addEventListener('keyup', renderSongs);
  });

  if (songSearchClear) {
    songSearchClear.addEventListener('click', () => {
      resetSearchInput(songTitleSearch);
      resetSearchInput(artistSearch);
      if (songTitleSearch) songTitleSearch.focus();
      renderSongs();
    });
  }

  ['#timelineYear', '#timelineMonth', '#timelineDay'].forEach((selector) => {
    const input = $(selector);
    if (!input) return;

    input.addEventListener('input', renderTimeline);
    input.addEventListener('change', renderTimeline);
    input.addEventListener('keyup', renderTimeline);
  });

  const timelineClear = $('#timelineClear');
  if (timelineClear) {
    timelineClear.addEventListener('click', () => {
      ['#timelineYear', '#timelineMonth', '#timelineDay'].forEach((selector) => {
        const input = $(selector);
        if (input) input.value = '';
      });
      ACTIVE_TIMELINE_CATEGORY = '';
      renderCategoryButtons();
      renderTimeline();
    });
  }
}

function init() {
  setupSearches();
  loadData();
}

init();
