// ==================== CONFIG ====================
const CONFIG = {
    TMDB_API_KEY: '2dca580c2a14b55200e784d157207b4d',
    TMDB_BASE_URL: 'https://api.themoviedb.org/3',
    TMDB_IMG_BASE: 'https://image.tmdb.org/t/p',
    POSTER_SIZE: '/w500',
    BACKDROP_SIZE: '/original',
    PROFILE_SIZE: '/w185',
    LANGUAGE: 'id-ID',
    REGION: 'ID',
};

// ==================== VIDSRC & EMBED SERVERS ====================
const SERVERS = {
    'vidsrc.me': {
        movie: (id) => `https://vidsrc.me/embed/movie?tmdb=${id}`,
        tv: (id, s, e) => `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}`
    },
    'vidsrc.to': {
        movie: (id) => `https://vidsrc.to/embed/movie/${id}`,
        tv: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`
    },
    'vidsrc.xyz': {
        movie: (id) => `https://vidsrc.xyz/embed/movie?tmdb=${id}`,
        tv: (id, s, e) => `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}`
    },
    '2embed': {
        movie: (id) => `https://www.2embed.cc/embed/${id}`,
        tv: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`
    }
};

// ==================== API SERVICE ====================
const API = {
    async fetch(endpoint, params = {}) {
        const url = new URL(`${CONFIG.TMDB_BASE_URL}${endpoint}`);
        url.searchParams.set('api_key', CONFIG.TMDB_API_KEY);
        url.searchParams.set('language', CONFIG.LANGUAGE);
        url.searchParams.set('region', CONFIG.REGION);
        Object.entries(params).forEach(([key, val]) => url.searchParams.set(key, val));

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error('Fetch error:', err);
            return null;
        }
    },

    getTrending(timeWindow = 'week', page = 1) {
        return this.fetch(`/trending/all/${timeWindow}`, { page });
    },
    getPopularMovies(page = 1) {
        return this.fetch('/movie/popular', { page });
    },
    getTopRatedMovies(page = 1) {
        return this.fetch('/movie/top_rated', { page });
    },
    getNowPlayingMovies(page = 1) {
        return this.fetch('/movie/now_playing', { page });
    },
    getUpcomingMovies(page = 1) {
        return this.fetch('/movie/upcoming', { page });
    },
    getPopularTV(page = 1) {
        return this.fetch('/tv/popular', { page });
    },
    getTopRatedTV(page = 1) {
        return this.fetch('/tv/top_rated', { page });
    },
    getOnAirTV(page = 1) {
        return this.fetch('/tv/on_the_air', { page });
    },
    searchMulti(query, page = 1) {
        return this.fetch('/search/multi', { query, page });
    },
    getMovieDetails(id) {
        return this.fetch(`/movie/${id}`, { append_to_response: 'credits,videos,similar' });
    },
    getTVDetails(id) {
        return this.fetch(`/tv/${id}`, { append_to_response: 'credits,videos,similar' });
    },
    getMovieGenres() {
        return this.fetch('/genre/movie/list');
    },
    discoverMovies(genreId, page = 1) {
        return this.fetch('/discover/movie', { with_genres: genreId, sort_by: 'popularity.desc', page });
    },

    posterUrl(path) {
        return path ? `${CONFIG.TMDB_IMG_BASE}${CONFIG.POSTER_SIZE}${path}` : '';
    },
    backdropUrl(path) {
        return path ? `${CONFIG.TMDB_IMG_BASE}${CONFIG.BACKDROP_SIZE}${path}` : '';
    },
    profileUrl(path) {
        return path ? `${CONFIG.TMDB_IMG_BASE}${CONFIG.PROFILE_SIZE}${path}` : '';
    },
};

// ==================== DOM HELPERS ====================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function createElement(tag, className, html) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (html) el.innerHTML = html;
    return el;
}

// ==================== STATE ====================
const state = {
    currentPage: 'home',
    moviePage: 1,
    seriesPage: 1,
    currentGenre: null,
    heroMovie: null,
    favorites: JSON.parse(localStorage.getItem('nbt_favorites') || '[]'),
};

let playerState = {
    id: null,
    type: 'movie',
    title: '',
    server: 'vidsrc.me',
    season: 1,
    episode: 1,
    youtubeKey: null,
    seasonsData: []
};

// ==================== COMPONENTS ====================

// --- Movie Card ---
function createMovieCard(item, showBadge = false) {
    const title = item.title || item.name || 'Untitled';
    const year = (item.release_date || item.first_air_date || '').split('-')[0];
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
    const posterSrc = API.posterUrl(item.poster_path);

    const card = createElement('div', 'movie-card');
    card.setAttribute('data-id', item.id);
    card.setAttribute('data-type', mediaType);

    card.innerHTML = `
        ${showBadge && mediaType === 'tv' ? '<span class="card-badge">Series</span>' : ''}
        ${posterSrc ? `<img class="card-poster" src="${posterSrc}" alt="${title}" loading="lazy">` 
            : `<div class="card-poster" style="display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--text-muted);aspect-ratio:2/3;">No Image</div>`}
        <div class="card-overlay"></div>
        <div class="card-info">
            <div class="card-title">${title}</div>
            <div class="card-meta">
                <span class="card-rating">★ ${rating}</span>
                ${year ? `<span>${year}</span>` : ''}
            </div>
        </div>
    `;

    card.addEventListener('click', () => openMovieDetail(item.id, mediaType));
    return card;
}

// --- Skeleton Cards ---
function createSkeletons(count = 8) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
        fragment.appendChild(createElement('div', 'card-skeleton'));
    }
    return fragment;
}

// --- Movie Row ---
function createMovieRow(title, items, showBadge = false) {
    const row = createElement('div', 'movie-row');

    const scrollId = 'scroll-' + Math.random().toString(36).substr(2, 9);
    row.innerHTML = `
        <div class="row-header">
            <h2 class="row-title">${title}</h2>
        </div>
        <div class="row-scroll-container">
            <button class="scroll-btn left" data-scroll="${scrollId}" data-dir="-1">‹</button>
            <div class="row-scroll" id="${scrollId}"></div>
            <button class="scroll-btn right" data-scroll="${scrollId}" data-dir="1">›</button>
        </div>
    `;

    const scrollContainer = row.querySelector('.row-scroll');
    items.forEach(item => {
        if (item.poster_path) {
            scrollContainer.appendChild(createMovieCard(item, showBadge));
        }
    });

    // Scroll buttons
    row.querySelectorAll('.scroll-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const container = document.getElementById(btn.dataset.scroll);
            const dir = parseInt(btn.dataset.dir);
            container.scrollBy({ left: dir * 600, behavior: 'smooth' });
        });
    });

    return row;
}

// ==================== PAGES ====================

// --- Home Page ---
async function loadHomePage() {
    const homeRows = $('#homeRows');
    homeRows.innerHTML = '';

    // Show loading skeletons
    for (let i = 0; i < 4; i++) {
        const skelRow = createElement('div', 'movie-row');
        skelRow.innerHTML = `
            <div class="row-header"><div style="width:200px;height:24px;background:var(--bg-card);border-radius:4px;"></div></div>
            <div class="row-scroll-container"><div class="row-scroll"></div></div>
        `;
        skelRow.querySelector('.row-scroll').appendChild(createSkeletons(8));
        homeRows.appendChild(skelRow);
    }

    // Fetch all data in parallel
    const [trending, popular, topRated, nowPlaying, popularTV, topTV] = await Promise.all([
        API.getTrending('day'),
        API.getPopularMovies(),
        API.getTopRatedMovies(),
        API.getNowPlayingMovies(),
        API.getPopularTV(),
        API.getTopRatedTV(),
    ]);

    // Set hero
    if (trending && trending.results && trending.results.length > 0) {
        setupHero(trending.results[0]);
    }

    homeRows.innerHTML = '';

    // Build rows
    if (trending?.results) homeRows.appendChild(createMovieRow('🔥 Trending Hari Ini', trending.results, true));
    if (nowPlaying?.results) homeRows.appendChild(createMovieRow('🎬 Sedang Tayang', nowPlaying.results));
    if (popular?.results) homeRows.appendChild(createMovieRow('⭐ Film Populer', popular.results));
    if (popularTV?.results) homeRows.appendChild(createMovieRow('📺 Series Populer', popularTV.results, true));
    if (topRated?.results) homeRows.appendChild(createMovieRow('🏆 Top Rating Film', topRated.results));
    if (topTV?.results) homeRows.appendChild(createMovieRow('💎 Top Rating Series', topTV.results, true));
}

// --- Hero Section ---
function setupHero(movie) {
    state.heroMovie = movie;
    const title = movie.title || movie.name;
    const year = (movie.release_date || movie.first_air_date || '').split('-')[0];
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : '';
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');

    $('#heroBackdrop').style.backgroundImage = `url(${API.backdropUrl(movie.backdrop_path)})`;
    $('#heroTitle').textContent = title;
    
    let metaHtml = '';
    if (rating) metaHtml += `<span class="rating">★ ${rating}</span>`;
    if (year) metaHtml += `<span class="year">${year}</span>`;
    metaHtml += `<span class="genre-tag">${mediaType === 'tv' ? 'Series' : 'Film'}</span>`;
    $('#heroMeta').innerHTML = metaHtml;

    $('#heroDescription').textContent = movie.overview || 'Informasi belum tersedia.';

    // Hero button actions
    $('#heroPlayBtn').onclick = () => openPlayer(movie.id, mediaType, 'vidsrc.me');
    if ($('#heroTrailerBtn')) {
        $('#heroTrailerBtn').onclick = () => openPlayer(movie.id, mediaType, 'youtube');
    }
    $('#heroInfoBtn').onclick = () => openMovieDetail(movie.id, mediaType);
}

// --- Movies Page ---
async function loadMoviesPage(page = 1, genreId = null) {
    const grid = $('#movieGrid');
    
    if (page === 1) {
        grid.innerHTML = '';
        grid.appendChild(createSkeletons(20));
    }

    let data;
    if (genreId) {
        data = await API.discoverMovies(genreId, page);
    } else {
        data = await API.getPopularMovies(page);
    }

    if (page === 1) grid.innerHTML = '';

    if (data?.results) {
        data.results.forEach(item => {
            if (item.poster_path) {
                grid.appendChild(createMovieCard(item));
            }
        });
    }

    // Load genres if not loaded
    if ($('#genreFilters').children.length === 0) {
        const genres = await API.getMovieGenres();
        if (genres?.genres) {
            const allBtn = createElement('button', 'genre-btn active', 'Semua');
            allBtn.addEventListener('click', () => {
                $$('.genre-btn').forEach(b => b.classList.remove('active'));
                allBtn.classList.add('active');
                state.currentGenre = null;
                state.moviePage = 1;
                loadMoviesPage(1);
            });
            $('#genreFilters').appendChild(allBtn);

            genres.genres.forEach(genre => {
                const btn = createElement('button', 'genre-btn', genre.name);
                btn.addEventListener('click', () => {
                    $$('.genre-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    state.currentGenre = genre.id;
                    state.moviePage = 1;
                    loadMoviesPage(1, genre.id);
                });
                $('#genreFilters').appendChild(btn);
            });
        }
    }
}

// --- Series Page ---
async function loadSeriesPage(page = 1) {
    const grid = $('#seriesGrid');
    
    if (page === 1) {
        grid.innerHTML = '';
        grid.appendChild(createSkeletons(20));
    }

    const data = await API.getPopularTV(page);

    if (page === 1) grid.innerHTML = '';

    if (data?.results) {
        data.results.forEach(item => {
            if (item.poster_path) {
                const card = createMovieCard(item);
                card.setAttribute('data-type', 'tv');
                grid.appendChild(card);
            }
        });
    }
}

// --- Trending Page ---
async function loadTrendingPage() {
    const grid = $('#trendingGrid');
    grid.innerHTML = '';
    grid.appendChild(createSkeletons(20));

    const data = await API.getTrending('week');
    grid.innerHTML = '';

    if (data?.results) {
        data.results.forEach(item => {
            if (item.poster_path) {
                grid.appendChild(createMovieCard(item, true));
            }
        });
    }
}

// --- Search ---
let searchTimeout = null;
async function performSearch(query) {
    if (!query || query.trim().length < 2) return;

    navigateTo('search');
    const grid = $('#searchGrid');
    grid.innerHTML = '';
    grid.appendChild(createSkeletons(12));

    $('#searchResultTitle').textContent = `Hasil Pencarian: "${query}"`;

    const data = await API.searchMulti(query);
    grid.innerHTML = '';

    if (data?.results && data.results.length > 0) {
        data.results.forEach(item => {
            if ((item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path) {
                grid.appendChild(createMovieCard(item, true));
            }
        });

        if (grid.children.length === 0) {
            showEmptyState(grid, 'Tidak ada hasil', 'Coba kata kunci lain.');
        }
    } else {
        showEmptyState(grid, 'Tidak ada hasil', 'Coba kata kunci lain.');
    }
}

function showEmptyState(container, title, desc) {
    container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
            </svg>
            <h3>${title}</h3>
            <p>${desc}</p>
        </div>
    `;
}

// ==================== MOVIE DETAIL MODAL ====================
async function openMovieDetail(id, type = 'movie') {
    const overlay = $('#modalOverlay');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Reset content
    $('#modalTitle').textContent = 'Memuat...';
    $('#modalMeta').innerHTML = '';
    $('#modalOverview').textContent = '';
    $('#modalGenres').textContent = '';
    $('#modalRating').textContent = '';
    $('#modalLanguage').textContent = '';
    $('#modalDuration').textContent = '';
    $('#castList').innerHTML = '';
    $('#similarGrid').innerHTML = '';
    $('#modalBackdrop').style.backgroundImage = '';

    const data = type === 'tv' ? await API.getTVDetails(id) : await API.getMovieDetails(id);
    if (!data) return;

    const title = data.title || data.name;
    const year = (data.release_date || data.first_air_date || '').split('-')[0];
    const rating = data.vote_average ? data.vote_average.toFixed(1) : 'N/A';

    // Backdrop
    if (data.backdrop_path) {
        $('#modalBackdrop').style.backgroundImage = `url(${API.backdropUrl(data.backdrop_path)})`;
    }

    // Info
    $('#modalTitle').textContent = title;

    let metaHtml = `<span class="rating">★ ${rating}</span>`;
    if (year) metaHtml += `<span>${year}</span>`;
    if (data.status) metaHtml += `<span>${data.status}</span>`;
    if (data.vote_count) metaHtml += `<span>${data.vote_count.toLocaleString()} votes</span>`;
    $('#modalMeta').innerHTML = metaHtml;

    $('#modalOverview').textContent = data.overview || 'Sinopsis belum tersedia.';

    // Details
    const genres = data.genres ? data.genres.map(g => g.name).join(', ') : '-';
    $('#modalGenres').textContent = genres;
    $('#modalRating').innerHTML = `<span style="color:var(--accent-gold)">★</span> ${rating} / 10`;
    $('#modalLanguage').textContent = data.original_language ? data.original_language.toUpperCase() : '-';

    if (type === 'tv') {
        const seasons = data.number_of_seasons ? `${data.number_of_seasons} Season` : '-';
        const episodes = data.number_of_episodes ? `, ${data.number_of_episodes} Episode` : '';
        $('#modalDuration').textContent = seasons + episodes;
    } else {
        const runtime = data.runtime ? `${Math.floor(data.runtime / 60)}j ${data.runtime % 60}m` : '-';
        $('#modalDuration').textContent = runtime;
    }

    // Cast
    if (data.credits?.cast && data.credits.cast.length > 0) {
        const castList = $('#castList');
        castList.innerHTML = '';
        data.credits.cast.slice(0, 10).forEach(person => {
            const castItem = createElement('div', 'cast-item');
            castItem.innerHTML = `
                ${person.profile_path 
                    ? `<img class="cast-img" src="${API.profileUrl(person.profile_path)}" alt="${person.name}" loading="lazy">`
                    : `<div class="cast-img" style="display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text-muted);">👤</div>`}
                <div class="cast-name">${person.name}</div>
                <div class="cast-character">${person.character || ''}</div>
            `;
            castList.appendChild(castItem);
        });
        $('#modalCast').style.display = 'block';
    } else {
        $('#modalCast').style.display = 'none';
    }

    // Similar
    if (data.similar?.results && data.similar.results.length > 0) {
        const similarGrid = $('#similarGrid');
        similarGrid.innerHTML = '';
        data.similar.results.slice(0, 6).forEach(item => {
            if (item.poster_path) {
                similarGrid.appendChild(createMovieCard(item));
            }
        });
        $('#modalSimilar').style.display = 'block';
    } else {
        $('#modalSimilar').style.display = 'none';
    }

    // Modal Play button (VidSrc)
    $('#modalPlayBtn').onclick = () => {
        closeModal();
        openPlayer(id, type, 'vidsrc.me');
    };

    // Modal Trailer button (YouTube)
    if ($('#modalTrailerBtn')) {
        $('#modalTrailerBtn').onclick = () => {
            closeModal();
            openPlayer(id, type, 'youtube');
        };
    }

    // Favorite button
    const isFav = state.favorites.includes(id);
    updateFavoriteBtn(isFav);
    $('#modalFavoriteBtn').onclick = () => toggleFavorite(id);
}

function closeModal() {
    $('#modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

function toggleFavorite(id) {
    const idx = state.favorites.indexOf(id);
    if (idx > -1) {
        state.favorites.splice(idx, 1);
        showToast('Dihapus dari favorit');
    } else {
        state.favorites.push(id);
        showToast('Ditambahkan ke favorit ❤️');
    }
    localStorage.setItem('nbt_favorites', JSON.stringify(state.favorites));
    updateFavoriteBtn(state.favorites.includes(id));
}

function updateFavoriteBtn(isFav) {
    const btn = $('#modalFavoriteBtn');
    if (isFav) {
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="var(--accent-primary)" stroke="var(--accent-primary)" stroke-width="2" width="20" height="20">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
        `;
    } else {
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
        `;
    }
}

// ==================== VIDEO PLAYER (VIDSRC API) ====================
async function openPlayer(id, type = 'movie', server = 'vidsrc.me') {
    playerState.id = id;
    playerState.type = type;
    playerState.server = server;
    playerState.season = 1;
    playerState.episode = 1;

    const overlay = $('#playerOverlay');
    const iframe = $('#playerIframe');
    
    $('#playerTitle').textContent = 'Memuat Player...';
    $('#playerBadge').textContent = type === 'tv' ? 'Series' : 'Film';
    $('#serverSelect').value = server;

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Fetch details for title and videos
    const data = type === 'tv' ? await API.getTVDetails(id) : await API.getMovieDetails(id);
    if (!data) {
        showToast('Gagal memuat detail film.');
        closePlayer();
        return;
    }

    playerState.title = data.title || data.name;
    $('#playerTitle').textContent = playerState.title;

    // Populate details under video player
    const year = (data.release_date || data.first_air_date || '').split('-')[0];
    const rating = data.vote_average ? data.vote_average.toFixed(1) : 'N/A';
    const genres = data.genres ? data.genres.map(g => g.name).join(', ') : '-';

    if ($('#playerRating')) $('#playerRating').innerHTML = `★ ${rating}`;
    if ($('#playerYear')) $('#playerYear').textContent = year ? year : '';
    if ($('#playerGenres')) $('#playerGenres').textContent = genres;
    if ($('#playerOverview')) $('#playerOverview').textContent = data.overview || 'Sinopsis belum tersedia.';

    // Check YouTube trailer key
    let ytKey = null;
    if (data.videos?.results) {
        const trailer = data.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube')
            || data.videos.results.find(v => v.site === 'YouTube');
        if (trailer) ytKey = trailer.key;
    }
    playerState.youtubeKey = ytKey;

    // Handle TV Series selectors
    const tvSelector = $('#tvSelector');
    if (type === 'tv') {
        tvSelector.style.display = 'flex';
        const seasonSelect = $('#seasonSelect');
        seasonSelect.innerHTML = '';
        const seasons = data.seasons ? data.seasons.filter(s => s.season_number > 0) : [];
        playerState.seasonsData = seasons;

        if (seasons.length > 0) {
            seasons.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.season_number;
                opt.textContent = `Season ${s.season_number} (${s.episode_count} Ep)`;
                seasonSelect.appendChild(opt);
            });
            updateEpisodeDropdown(seasons[0].season_number, seasons[0].episode_count);
        } else {
            const opt = document.createElement('option');
            opt.value = 1;
            opt.textContent = 'Season 1';
            seasonSelect.appendChild(opt);
            updateEpisodeDropdown(1, 24);
        }
    } else {
        tvSelector.style.display = 'none';
    }

    updatePlayerSource();
}

function updateEpisodeDropdown(seasonNum, episodeCount) {
    const episodeSelect = $('#episodeSelect');
    episodeSelect.innerHTML = '';
    for (let ep = 1; ep <= episodeCount; ep++) {
        const opt = document.createElement('option');
        opt.value = ep;
        opt.textContent = `Episode ${ep}`;
        episodeSelect.appendChild(opt);
    }
    playerState.season = seasonNum;
    playerState.episode = 1;
}

function updatePlayerSource() {
    const iframe = $('#playerIframe');
    const { id, type, server, season, episode, youtubeKey } = playerState;

    if (server === 'youtube') {
        if (youtubeKey) {
            iframe.src = `https://www.youtube.com/embed/${youtubeKey}?autoplay=1&rel=0`;
        } else {
            showToast('Trailer YouTube tidak tersedia');
            $('#serverSelect').value = 'vidsrc.me';
            playerState.server = 'vidsrc.me';
            updatePlayerSource();
        }
        return;
    }

    if (SERVERS[server]) {
        const url = SERVERS[server][type](id, season, episode);
        iframe.src = url;
    }
}

function closePlayer() {
    const overlay = $('#playerOverlay');
    const iframe = $('#playerIframe');
    overlay.classList.remove('active');
    iframe.src = '';
    document.body.style.overflow = '';
}

// ==================== NAVIGATION ====================
function navigateTo(page) {
    state.currentPage = page;
    
    // Update pages
    $$('.page').forEach(p => p.classList.remove('active'));
    const pageEl = $(`#page-${page}`);
    if (pageEl) pageEl.classList.add('active');

    // Update nav links
    $$('.nav-link, .mobile-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });

    // Close mobile menu
    $('#mobileMenu').classList.remove('active');
    $('#menuToggle').classList.remove('active');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Load page data
    switch (page) {
        case 'home':
            // Already loaded
            break;
        case 'movies':
            state.moviePage = 1;
            loadMoviesPage(1, state.currentGenre);
            break;
        case 'series':
            state.seriesPage = 1;
            loadSeriesPage(1);
            break;
        case 'trending':
            loadTrendingPage();
            break;
    }
}

// ==================== TOAST ====================
function showToast(message) {
    let toast = $('.toast');
    if (!toast) {
        toast = createElement('div', 'toast');
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    // --- Loading Screen ---
    setTimeout(() => {
        $('#loadingScreen').classList.add('hidden');
    }, 2200);

    // --- Navbar Scroll ---
    window.addEventListener('scroll', () => {
        const navbar = $('#navbar');
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // --- Navigation Links ---
    $$('.nav-link, .mobile-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.page);
        });
    });

    // --- Logo Click ---
    $('#logo').addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo('home');
    });

    // --- Mobile Menu ---
    $('#menuToggle').addEventListener('click', () => {
        $('#menuToggle').classList.toggle('active');
        $('#mobileMenu').classList.toggle('active');
    });

    // --- Search ---
    $('#searchToggle').addEventListener('click', () => {
        $('#searchInputWrapper').classList.add('active');
        $('#searchInput').focus();
    });

    $('#searchClose').addEventListener('click', () => {
        $('#searchInputWrapper').classList.remove('active');
        $('#searchInput').value = '';
    });

    $('#searchInput').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch(e.target.value);
        }, 500);
    });

    $('#searchInput').addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            $('#searchInputWrapper').classList.remove('active');
            $('#searchInput').value = '';
        }
        if (e.key === 'Enter') {
            clearTimeout(searchTimeout);
            performSearch(e.target.value);
        }
    });

    // --- Modal ---
    $('#modalClose').addEventListener('click', closeModal);
    $('#modalOverlay').addEventListener('click', (e) => {
        if (e.target === $('#modalOverlay')) closeModal();
    });

    // --- Player Overlay Controls ---
    $('#serverSelect').addEventListener('change', (e) => {
        playerState.server = e.target.value;
        updatePlayerSource();
    });

    $('#seasonSelect').addEventListener('change', (e) => {
        const sNum = parseInt(e.target.value);
        const seasonObj = playerState.seasonsData.find(s => s.season_number === sNum);
        const epCount = seasonObj ? seasonObj.episode_count : 24;
        updateEpisodeDropdown(sNum, epCount);
        updatePlayerSource();
    });

    $('#episodeSelect').addEventListener('change', (e) => {
        playerState.episode = parseInt(e.target.value);
        updatePlayerSource();
    });

    $('#playerClose').addEventListener('click', closePlayer);
    $('#playerOverlay').addEventListener('click', (e) => {
        if (e.target === $('#playerOverlay')) closePlayer();
    });

    // --- Load More ---
    $('#loadMoreMovies').addEventListener('click', () => {
        state.moviePage++;
        loadMoviesPage(state.moviePage, state.currentGenre);
    });

    $('#loadMoreSeries').addEventListener('click', () => {
        state.seriesPage++;
        loadSeriesPage(state.seriesPage);
    });

    // --- Keyboard shortcuts ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if ($('#playerOverlay').classList.contains('active')) {
                closePlayer();
            } else if ($('#modalOverlay').classList.contains('active')) {
                closeModal();
            }
        }
    });

    // --- Load Home Page ---
    loadHomePage();
});

