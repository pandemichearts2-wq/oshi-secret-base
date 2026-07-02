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
  const favoriteKey = getFavoriteKey('video', title, url);

  return `
    <article class="card">
      ${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="">` : ''}
      <div class="cardBody">
        <div class="cardTitle">${escapeHtml(title)}</div>
        <div class="cardMeta">${fmtDate(date)}${category ? ` / ${escapeHtml(category)}` : ''}</div>
        <div class="cardActions">
          <a class="openLink" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">配信へ飛ぶ</a>
          ${favoriteButtonHtml({
            key: favoriteKey,
            typeLabel: '配信',
            title,
            sub: category ? `${fmtDate(date)} / ${category}` : fmtDate(date),
            url
          })}
        </div>
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
    const artist = cleanArtistForSearch(getSongArtist(song));

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

    const favoriteKey = getFavoriteKey('song', songTitle, artist || videoTitle);

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
        <div class="cardActions">
          <a class="openLink" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">最新の該当配信へ飛ぶ</a>
          ${favoriteButtonHtml({
            key: favoriteKey,
            typeLabel: '曲',
            title: songTitle,
            sub: artist || videoTitle,
            url
          })}
        </div>
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



function toHiraganaForSort(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/^[\s"'“”‘’「」『』【】（）()［］\[\]{}<>＜＞:：;；,，.。・･!！?？\-ー―〜～~♪♫♬★☆◆◇■□●○◎※]+/g, '')
    .replace(/[ァ-ン]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .toLowerCase()
    .trim();
}

function getQuickIndexSortGroup(value) {
  const key = toHiraganaForSort(value);
  if (!key) return 9;

  const first = key.charAt(0);

  // 日本語の見やすさ優先：
  // かな → 漢字 → アルファベット → 数字 → その他
  if (/^[ぁ-ん]/.test(first)) return 1;
  if (/^[一-龥々〆ヵヶ]/.test(first)) return 2;
  if (/^[a-z]/.test(first)) return 3;
  if (/^[0-9]/.test(first)) return 4;

  return 8;
}

function compareQuickIndexText(a, b) {
  const groupA = getQuickIndexSortGroup(a);
  const groupB = getQuickIndexSortGroup(b);

  if (groupA !== groupB) return groupA - groupB;

  const keyA = toHiraganaForSort(a);
  const keyB = toHiraganaForSort(b);

  const compared = keyA.localeCompare(keyB, 'ja-JP', {
    numeric: true,
    sensitivity: 'base'
  });

  if (compared !== 0) return compared;

  return String(a).localeCompare(String(b), 'ja-JP', {
    numeric: true,
    sensitivity: 'base'
  });
}


function isLikelyArtistName(value) {
  const text = String(value || '').trim();
  if (!text) return false;

  const normalizedText = normalize(text);
  if (!normalizedText) return false;

  if (isUnsetSongTitle(text) || isIgnoredSongTitle(text)) return false;

  // アーティスト欄に混ざりやすい説明・配信メモ系は一覧から除外する
  if (/[0-9０-９]{1,2}[:：][0-9０-９]{2}/.test(text)) return false;
  if (/https?:\/\//i.test(text)) return false;
  if (/(歌枠|雑談|配信|ライブ|live|shorts|切り抜き|メドレー|リレー|耐久|初見|記念|コラボ|枠|回目|弾き語り|カラオケ|karaoke|cover|covered|歌ってみた|歌唱|セトリ|セットリスト)/i.test(text)) return false;

  return true;
}

function getQuickIndexItems() {
  const songMap = new Map();
  const artistMap = new Map();

  DATA.songs.forEach((song) => {
    const rawTitle = getSongTitle(song);
    const title = cleanSongTitleForRanking(rawTitle);
    const artist = getSongArtistForSearch(song);

    if (title && !isUnsetSongTitle(title) && !isIgnoredSongTitle(title)) {
      const key = normalizeSongRankingKey(title);
      if (!songMap.has(key)) songMap.set(key, title);
    }

    if (isLikelyArtistName(artist)) {
      const key = normalize(artist);
      if (key && !artistMap.has(key)) artistMap.set(key, artist);
    }
  });

  const songs = Array.from(songMap.values())
    .sort(compareQuickIndexText);

  const artists = Array.from(artistMap.values())
    .sort(compareQuickIndexText);

  return { songs, artists };
}

function quickIndexButton(kind, value) {
  return `<button type="button" class="quickIndexItem" data-kind="${escapeHtml(kind)}" data-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`;
}

function renderQuickIndex() {
  const songRoot = $('#songTitleIndex');
  const artistRoot = $('#artistIndex');

  if (!songRoot || !artistRoot) return;

  const { songs, artists } = getQuickIndexItems();

  songRoot.innerHTML = songs.length
    ? songs.map((title) => quickIndexButton('song', title)).join('')
    : '<p>表示できる曲名がありません。</p>';

  artistRoot.innerHTML = artists.length
    ? artists.map((artist) => quickIndexButton('artist', artist)).join('')
    : '<p>表示できるアーティスト名がありません。</p>';
}

function applyQuickIndexValue(kind, value) {
  const songTitleSearch = $('#songTitleSearch') || $('#songSearch');
  const artistSearch = $('#artistSearch');

  if (kind === 'song' && songTitleSearch) {
    songTitleSearch.value = value;
    songTitleSearch.dispatchEvent(new Event('input', { bubbles: true }));
    songTitleSearch.focus();
  }

  if (kind === 'artist' && artistSearch) {
    artistSearch.value = value;
    artistSearch.dispatchEvent(new Event('input', { bubbles: true }));
    artistSearch.focus();
  }
}

function renderAll() {
  safeRender_('renderQuickIndex', renderQuickIndex);
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


function setupHorrorEasterEgg() {
  const heroImage = $('.hero__image');
  const escapeBox = $('#horrorEscape');
  const escapeInput = $('#horrorEscapeInput');
  const horrorAudio = $('#horrorLoopAudio') || new Audio('./horror-loop.mp3');

  if (!heroImage || !escapeBox || !escapeInput || !horrorAudio) return;

  let clickCount = 0;
  let timer = null;
  let horrorLocked = false;

  horrorAudio.loop = true;
  horrorAudio.preload = 'auto';
  horrorAudio.volume = 0.85;

  function isHorrorMode() {
    return document.body.classList.contains('horrorMode');
  }

  function pushHorrorHistory() {
    if (!horrorLocked) return;

    try {
      window.history.pushState({ horrorMode: true }, '', window.location.href);
    } catch (error) {
      // ブラウザ側で履歴操作が拒否されても、演出本体は続ける
    }
  }

  function tryPlayHorrorAudio() {
    if (!isHorrorMode()) return;

    horrorAudio.muted = false;
    horrorAudio.loop = true;
    horrorAudio.volume = 0.85;

    horrorAudio.play().catch(() => {
      // 自動再生が止められた場合は、次のタップ/クリックで再試行する
    });
  }

  function stopHorrorAudio() {
    horrorAudio.pause();
    horrorAudio.currentTime = 0;
  }

  function enterHorrorMode() {
    horrorLocked = true;
    document.body.classList.add('horrorMode');
    escapeBox.hidden = false;
    escapeInput.value = '';

    horrorAudio.src = './horror-loop.mp3';
    horrorAudio.load();
    horrorAudio.currentTime = 0;
    tryPlayHorrorAudio();

    pushHorrorHistory();
    setTimeout(() => escapeInput.focus(), 80);
  }

  function leaveHorrorMode() {
    horrorLocked = false;
    document.body.classList.remove('horrorMode');
    escapeBox.hidden = true;
    escapeInput.value = '';
    stopHorrorAudio();
    clickCount = 0;
  }

  heroImage.addEventListener('click', () => {
    if (isHorrorMode()) return;

    clickCount += 1;

    clearTimeout(timer);
    timer = setTimeout(() => {
      clickCount = 0;
    }, 5000);

    if (clickCount >= 10) {
      clearTimeout(timer);
      enterHorrorMode();
    }
  });

  // ブラウザが音声再生を止めた時の保険。
  // ホラー画面中にどこかをタップ/クリックしたら、その操作で音声を再試行する。
  ['pointerdown', 'click', 'keydown', 'touchstart'].forEach((eventName) => {
    window.addEventListener(eventName, () => {
      if (!isHorrorMode() || !horrorLocked) return;
      tryPlayHorrorAudio();
    }, { passive: true });
  });

  escapeInput.addEventListener('input', () => {
    if (escapeInput.value.trim() === 'ごめんなさい') {
      leaveHorrorMode();
    }
  });

  escapeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && escapeInput.value.trim() === 'ごめんなさい') {
      leaveHorrorMode();
    }
  });

  window.addEventListener('popstate', () => {
    if (!isHorrorMode() || !horrorLocked) return;

    pushHorrorHistory();
    setTimeout(() => escapeInput.focus(), 80);
    tryPlayHorrorAudio();
  });

  window.addEventListener('beforeunload', (event) => {
    if (!isHorrorMode() || !horrorLocked) return;

    event.preventDefault();
    event.returnValue = '';
  });
}


function setupToolUrlCopy() {
  const button = $('#copyToolUrlButton');
  if (!button) return;

  const url = 'https://rurua-dayo.github.io/oshi-secret-base/';
  const defaultText = button.textContent;

  function showCopied() {
    button.textContent = 'コピーしました';
    setTimeout(() => {
      button.textContent = defaultText;
    }, 1600);
  }

  function fallbackCopy() {
    const input = document.createElement('textarea');
    input.value = url;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.select();

    try {
      document.execCommand('copy');
      showCopied();
    } finally {
      document.body.removeChild(input);
    }
  }

  button.addEventListener('click', () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url)
        .then(showCopied)
        .catch(fallbackCopy);
      return;
    }

    fallbackCopy();
  });
}


const SEARCH_HISTORY_KEY = 'oshiSecretBaseSearchHistoryV1';
const FAVORITES_KEY = 'oshiSecretBaseFavoritesV1';

function readJsonStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {}
}

function addSearchHistory(kind, label, value) {
  const text = String(value || '').trim();
  if (!text) return;

  const item = {
    kind,
    label,
    value: text,
    savedAt: Date.now()
  };

  const current = readJsonStorage(SEARCH_HISTORY_KEY, []);
  const filtered = current.filter((entry) => !(entry.kind === kind && entry.value === text));
  filtered.unshift(item);

  writeJsonStorage(SEARCH_HISTORY_KEY, filtered.slice(0, 10));
  renderSearchHistory();
}

function renderSearchHistory() {
  const root = $('#searchHistoryList');
  if (!root) return;

  const history = readJsonStorage(SEARCH_HISTORY_KEY, []);

  if (!history.length) {
    root.innerHTML = '<p>まだ検索履歴がありません。</p>';
    return;
  }

  root.innerHTML = history.map((item) => `
    <button class="memoryItem searchHistoryItem" type="button" data-kind="${escapeHtml(item.kind)}" data-value="${escapeHtml(item.value)}">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </button>
  `).join('');
}

function applySearchHistory(kind, value) {
  const videoSearch = $('#videoSearch');
  const songTitleSearch = $('#songTitleSearch') || $('#songSearch');
  const artistSearch = $('#artistSearch');

  if (kind === 'video' && videoSearch) {
    videoSearch.value = value;
    videoSearch.dispatchEvent(new Event('input', { bubbles: true }));
    videoSearch.focus();
    return;
  }

  if (kind === 'song' && songTitleSearch) {
    songTitleSearch.value = value;
    songTitleSearch.dispatchEvent(new Event('input', { bubbles: true }));
    songTitleSearch.focus();
    return;
  }

  if (kind === 'artist' && artistSearch) {
    artistSearch.value = value;
    artistSearch.dispatchEvent(new Event('input', { bubbles: true }));
    artistSearch.focus();
  }
}

function getFavoriteKey(type, main, sub) {
  return `${type}__${normalize(main)}__${normalize(sub || '')}`;
}

function readFavorites() {
  return readJsonStorage(FAVORITES_KEY, []);
}

function isFavorite(key) {
  return readFavorites().some((item) => item.key === key);
}

function toggleFavorite(item) {
  const favorites = readFavorites();
  const exists = favorites.some((favorite) => favorite.key === item.key);

  const next = exists
    ? favorites.filter((favorite) => favorite.key !== item.key)
    : [{ ...item, savedAt: Date.now() }, ...favorites].slice(0, 30);

  writeJsonStorage(FAVORITES_KEY, next);
  renderFavorites();
  renderVideos();
  renderSongs();
}

function renderFavorites() {
  const root = $('#favoritesList');
  if (!root) return;

  const favorites = readFavorites();

  if (!favorites.length) {
    root.innerHTML = '<p>まだお気に入りがありません。</p>';
    return;
  }

  root.innerHTML = favorites.map((item) => `
    <div class="memoryFavorite">
      <div>
        <span>${escapeHtml(item.typeLabel)}</span>
        <strong>${escapeHtml(item.title)}</strong>
        ${item.sub ? `<small>${escapeHtml(item.sub)}</small>` : ''}
      </div>
      <div class="memoryFavoriteActions">
        ${item.url ? `<a class="miniOpenLink" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">開く</a>` : ''}
        <button class="miniRemoveButton favoriteRemoveButton" type="button" data-key="${escapeHtml(item.key)}">解除</button>
      </div>
    </div>
  `).join('');
}

function favoriteButtonHtml(item) {
  const active = isFavorite(item.key);
  return `
    <button
      class="favoriteButton${active ? ' isActive' : ''}"
      type="button"
      data-key="${escapeHtml(item.key)}"
      data-type-label="${escapeHtml(item.typeLabel)}"
      data-title="${escapeHtml(item.title)}"
      data-sub="${escapeHtml(item.sub || '')}"
      data-url="${escapeHtml(item.url || '')}"
      aria-pressed="${active ? 'true' : 'false'}"
    >${active ? 'お気に入り済み' : 'お気に入り'}</button>
  `;
}

function setupOmikuji() {
  const button = $('#oshiOmikujiButton');
  const result = $('#oshiOmikujiResult');
  if (!button || !result) return;

  const fortunes = [
    { rank: '水森吉', text: '幸せな１日になりそう🍎' },
    { rank: '大吉', text: '今日のあなたはラッキー✨' },
    { rank: '中吉', text: 'そこそこ良いこと起きるかもっ！' },
    { rank: '小吉', text: '茹でたまごがしっかり半熟になりそう' },
    { rank: '吉', text: 'たぶん部屋から1円見つかる' },
    { rank: '末吉', text: 'ウグイスの鳴き声が聞こえるかもね' },
    { rank: '凶', text: '世界が滅びます' }
  ];

  button.addEventListener('click', () => {
    const item = fortunes[Math.floor(Math.random() * fortunes.length)];
    result.innerHTML = `<strong>${escapeHtml(item.rank)}</strong><span>${escapeHtml(item.text)}</span>`;
    startEmojiRain(['🍎', '🍏'], 22);
  });
}

function startEmojiRain(emojis, count = 24) {
  const layer = document.createElement('div');
  layer.className = 'emojiRainLayer';
  document.body.appendChild(layer);

  for (let i = 0; i < count; i++) {
    const drop = document.createElement('span');
    drop.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.animationDelay = `${Math.random() * 0.9}s`;
    drop.style.animationDuration = `${2.4 + Math.random() * 1.6}s`;
    drop.style.fontSize = `${20 + Math.random() * 18}px`;
    layer.appendChild(drop);
  }

  setTimeout(() => layer.remove(), 5200);
}

function showOtterPop() {
  const pop = document.createElement('div');
  pop.className = 'otterPop';
  pop.textContent = '🦦';
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 2600);
}

function setupKeyboardCommands() {
  let typed = '';

  window.addEventListener('keydown', (event) => {
    const target = event.target;
    const tagName = target && target.tagName ? target.tagName.toLowerCase() : '';

    if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) return;
    if (event.key.length !== 1) return;

    typed = `${typed}${event.key.toLowerCase()}`.slice(-20);

    if (typed.endsWith('ringo')) {
      startEmojiRain(['🍎', '🍏'], 40);
      typed = '';
    }

    if (typed.endsWith('kawauso')) {
      showOtterPop();
      typed = '';
    }

    if (typed.endsWith('momori')) {
      startEmojiRain(['🍎', '🍏', '🦦'], 48);
      typed = '';
    }
  });
}

function setupMemoryFeatures() {
  renderSearchHistory();
  renderFavorites();

  const searchTargets = [
    { selector: '#videoSearch', kind: 'video', label: '配信' },
    { selector: '#songTitleSearch', kind: 'song', label: '曲名' },
    { selector: '#artistSearch', kind: 'artist', label: 'アーティスト' }
  ];

  searchTargets.forEach(({ selector, kind, label }) => {
    const input = $(selector);
    if (!input) return;

    input.addEventListener('change', () => addSearchHistory(kind, label, input.value));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') addSearchHistory(kind, label, input.value);
    });
  });

  document.addEventListener('click', (event) => {
    const historyButton = event.target.closest('.searchHistoryItem');
    if (historyButton) {
      applySearchHistory(historyButton.dataset.kind || '', historyButton.dataset.value || '');
      return;
    }

    const favoriteButton = event.target.closest('.favoriteButton');
    if (favoriteButton) {
      toggleFavorite({
        key: favoriteButton.dataset.key || '',
        typeLabel: favoriteButton.dataset.typeLabel || '',
        title: favoriteButton.dataset.title || '',
        sub: favoriteButton.dataset.sub || '',
        url: favoriteButton.dataset.url || ''
      });
      return;
    }

    const removeButton = event.target.closest('.favoriteRemoveButton');
    if (removeButton) {
      const key = removeButton.dataset.key || '';
      writeJsonStorage(FAVORITES_KEY, readFavorites().filter((item) => item.key !== key));
      renderFavorites();
      renderVideos();
      renderSongs();
    }
  });
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


  const songTitleIndexToggle = $('#songTitleIndexToggle');
  const artistIndexToggle = $('#artistIndexToggle');
  const quickIndexPanel = $('#quickIndexPanel');
  const songTitleIndex = $('#songTitleIndex');
  const artistIndex = $('#artistIndex');

  function showQuickIndex(target) {
    if (!quickIndexPanel || !songTitleIndex || !artistIndex) return;

    quickIndexPanel.hidden = false;
    songTitleIndex.closest('.quickIndexColumn').hidden = target === 'artist';
    artistIndex.closest('.quickIndexColumn').hidden = target === 'song';
  }

  if (songTitleIndexToggle) {
    songTitleIndexToggle.addEventListener('click', () => {
      showQuickIndex('song');
    });
  }

  if (artistIndexToggle) {
    artistIndexToggle.addEventListener('click', () => {
      showQuickIndex('artist');
    });
  }

  [songTitleIndex, artistIndex].forEach((root) => {
    if (!root) return;

    root.addEventListener('click', (event) => {
      const button = event.target.closest('.quickIndexItem');
      if (!button) return;

      applyQuickIndexValue(button.dataset.kind || '', button.dataset.value || '');
    });
  });

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
  setupHorrorEasterEgg();
  setupToolUrlCopy();
  setupOmikuji();
  setupMemoryFeatures();
  setupKeyboardCommands();
  loadData();
}

init();
