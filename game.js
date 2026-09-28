'use strict';

/* ============================================================
   NEON RUNNER — game.js  (GAMEPLAY IMPROVEMENT PASS)
   - Fast/responsive horizontal movement
   - Full jump system with squash/stretch + landing FX
   - XYZ collision
   - Jumpable obstacle patterns
   ============================================================ */

/* ------------------------------------------------------------
   1. CONFIG
   ------------------------------------------------------------ */
const CONFIG = {
    // ---- world / forward motion ----
    baseSpeed: 18,
    maxSpeed: 46,
    roadHalfWidth: 5,
    spawnAheadZ: 220,
    despawnZ: -2.5,

    // ---- player (horizontal) ----
    ballRadius: 0.45,
    playerMoveSpeed: 14,      // max horizontal speed (was 8.5)
    playerAccel: 22,          // response rate (exponential approach)
    playerBrake: 28,          // stop rate (exponential decay)

    // ---- player (jump) ----
    jumpForce: 9.5,           // upward velocity at takeoff
    gravity: 30,              // downward acceleration

    // ---- camera / projection ----
    camHeight: 2.6,
    camDist: 6.2,
    focalBase: 0.92,

    // ---- lives ----
    maxLives: 3,
    invulnDuration: 1.6,

    // ---- multiplier ----
    maxMultiplier: 5,
    multProgressPerCollect: 0.16,
    multProgressPerSecond: 0.018,
    multProgressPerPass: 0.03,

    // ---- score ----
    scorePerSecond: 12,
    scorePerCollect: 25,
    scorePerPass: 8,

    // ---- spawn spacing ----
    spawnSpacingMin: 42,
    spawnSpacingMax: 62,
    spawnSpacingMinAtMax: 32,
    firstSpawnDelay: 1.0,

    // ---- characters ----
    characters: {
        saeed:  { name: 'Saeed',  c1: '#5a5a6a', c2: '#1a1a22', c3: '#050508', accent: '#c4b5fd' },
        arshia: { name: 'Arshia', c1: '#d4f5e0', c2: '#86e0a8', c3: '#3aa870', accent: '#86e0a8' },
        nima:   { name: 'Nima',   c1: '#d4e9ff', c2: '#7ac0f5', c3: '#3a8fd4', accent: '#7ac0f5' },
        sevil:  { name: 'Sevil',  c1: '#f0dcff', c2: '#c39cf5', c3: '#8a5cd0', accent: '#c39cf5' },
    },

    wallPalette: ['#ef4444', '#3b82f6', '#fbbf24', '#f97316', '#a855f7', '#22c55e'],
    collectColors: ['#22c55e', '#a855f7', '#ef4444', '#fbbf24'],
};

/* ---- Theme colors (read from CSS, cached for performance) ---- */
const themeColors = {
    skyTop: '#eef1f7', skyMid: '#e0e5ee', skyBottom: '#c9d1de',
    skyline1: '#c9cfdd', skyline2: '#a8b2c8', skyline3: '#8792ab',
    skylineAccent: 'rgba(255,255,255,0.4)',
    skylineHaze: 'rgba(232, 236, 245, 0.9)',
    groundNear: '#c6cdd9', groundFar: '#97a1b1',
    roadFar: '#e6eaf3', roadMid: '#f4f6fb', roadNear: '#ffffff',
    roadEdge: 'rgba(120, 140, 180, 0.42)',
    roadDash: 'rgba(120, 135, 165, 0.55)',
    walls: ['#ef4444', '#3b82f6', '#fbbf24', '#f97316', '#a855f7', '#22c55e'],
    speedLine: '#ffffff',
};

function refreshThemeColors() {
    const s = getComputedStyle(document.documentElement);
    const get = (name, fallback) =>
        (s.getPropertyValue(name).trim() || fallback);

    themeColors.skyTop        = get('--game-sky-top', themeColors.skyTop);
    themeColors.skyMid        = get('--game-sky-mid', themeColors.skyMid);
    themeColors.skyBottom     = get('--game-sky-bottom', themeColors.skyBottom);
    themeColors.skyline1      = get('--game-skyline-1', themeColors.skyline1);
    themeColors.skyline2      = get('--game-skyline-2', themeColors.skyline2);
    themeColors.skyline3      = get('--game-skyline-3', themeColors.skyline3);
    themeColors.skylineAccent = get('--game-skyline-accent', themeColors.skylineAccent);
    themeColors.skylineHaze   = get('--game-skyline-haze', themeColors.skylineHaze);
    themeColors.groundNear    = get('--game-ground-near', themeColors.groundNear);
    themeColors.groundFar     = get('--game-ground-far', themeColors.groundFar);
    themeColors.roadFar       = get('--game-road-far', themeColors.roadFar);
    themeColors.roadMid       = get('--game-road-mid', themeColors.roadMid);
    themeColors.roadNear      = get('--game-road-near', themeColors.roadNear);
    themeColors.roadEdge      = get('--game-road-edge', themeColors.roadEdge);
    themeColors.roadDash      = get('--game-road-dash', themeColors.roadDash);
    themeColors.speedLine     = get('--game-speedline', themeColors.speedLine);

    themeColors.walls = [
        get('--game-wall-1', '#ef4444'),
        get('--game-wall-2', '#3b82f6'),
        get('--game-wall-3', '#fbbf24'),
        get('--game-wall-4', '#f97316'),
        get('--game-wall-5', '#a855f7'),
        get('--game-wall-6', '#22c55e'),
    ];
}

/* ------------------------------------------------------------
   2. DOM
   ------------------------------------------------------------ */
const canvas            = document.getElementById('gameCanvas');
const ctx               = canvas.getContext('2d');

const hudEl             = document.getElementById('gameHud');
const scoreEl           = document.getElementById('scoreValue');
const heartsEl          = Array.from(document.querySelectorAll('.heart'));
const multValueEl       = document.getElementById('multiplierValue');
const multFillEl        = document.getElementById('multiplierFill');
const hudCharNameEl     = document.getElementById('hudCharacterName');

const startScreenEl     = document.getElementById('startScreen');
const charOptions       = Array.from(document.querySelectorAll('.character-option'));
const selCharNameEl     = document.getElementById('selectedCharacterName');
const playButtonEl      = document.getElementById('playButton');

const pauseScreenEl     = document.getElementById('pauseScreen');
const pauseScoreEl      = document.getElementById('pauseScoreValue');
const pauseCharEl       = document.getElementById('pauseCharacterName');
const resumeButtonEl    = document.getElementById('resumeButton');
const quitButtonEl      = document.getElementById('quitButton');

const gameOverScreenEl  = document.getElementById('gameOverScreen');
const finalScoreEl      = document.getElementById('finalScoreValue');
const bestScoreEl       = document.getElementById('bestScoreValue');
const finalCharEl       = document.getElementById('finalCharacterName');
const newBestBadgeEl    = document.getElementById('newBestBadge');
const playAgainButtonEl = document.getElementById('playAgainButton');
const changeBallBtnEl   = document.getElementById('changeBallButton');

const pauseButtonEl     = document.getElementById('pauseButton');
const soundButtonEl     = document.getElementById('soundButton');
const damageFlashEl     = document.getElementById('damageFlash');

/* ------------------------------------------------------------
   3. CANVAS SIZING
   ------------------------------------------------------------ */
let W = 1, H = 1, DPR = 1;
let horizonY = 0;
let focal = 1;

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.floor(rect.width));
    H = Math.max(1, Math.floor(rect.height));
    canvas.width  = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    horizonY = H * 0.40;
    focal = H * CONFIG.focalBase;
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 120));

/* ------------------------------------------------------------
   4. AUDIO
   ------------------------------------------------------------ */
const Sound = {
    ctx: null,
    muted: false,
    init() {
        if (this.ctx) return;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) this.ctx = new AC();
        } catch (e) { this.ctx = null; }
    },
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    },
    tone(freq, dur, type, gain, when, slideTo) {
        if (this.muted || !this.ctx) return;
        const t0 = this.ctx.currentTime + (when || 0);
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(gain != null ? gain : 0.14, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g).connect(this.ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.03);
    },
    collect() {
        this.init();
        this.tone(880, 0.09, 'triangle', 0.12, 0);
        this.tone(1320, 0.12, 'triangle', 0.09, 0.06);
    },
    hit() {
        this.init();
        this.tone(220, 0.22, 'sawtooth', 0.14, 0, 60);
        this.tone(90, 0.30, 'square', 0.09, 0);
    },
    button() {
        this.init();
        this.tone(520, 0.06, 'square', 0.07, 0);
        this.tone(760, 0.09, 'square', 0.05, 0.05);
    },
    mult() {
        this.init();
        this.tone(660, 0.09, 'triangle', 0.10, 0);
        this.tone(990, 0.11, 'triangle', 0.10, 0.07);
        this.tone(1320, 0.13, 'triangle', 0.08, 0.14);
    },
    jump() {
        this.init();
        this.tone(320, 0.12, 'sine', 0.09, 0, 760);
    },
    gameover() {
        this.init();
        this.tone(440, 0.20, 'sine', 0.13, 0, 220);
        this.tone(220, 0.35, 'sine', 0.11, 0.15, 110);
    },
};

/* ------------------------------------------------------------
   5. STORAGE
   ------------------------------------------------------------ */
const KEYS = {
    best: 'neonrunner.best',
    character: 'neonrunner.character',
    muted: 'neonrunner.muted',
};

function loadBest() {
    const v = parseInt(localStorage.getItem(KEYS.best) || '0', 10);
    return Number.isFinite(v) ? v : 0;
}
function saveBest(v) { try { localStorage.setItem(KEYS.best, String(v)); } catch (e) {} }
function loadCharacter() {
    const v = localStorage.getItem(KEYS.character);
    return CONFIG.characters[v] ? v : 'saeed';
}
function saveCharacter(k) { try { localStorage.setItem(KEYS.character, k); } catch (e) {} }
function loadMuted() { return localStorage.getItem(KEYS.muted) === '1'; }
function saveMuted(m) { try { localStorage.setItem(KEYS.muted, m ? '1' : '0'); } catch (e) {} }

/* ------------------------------------------------------------
   6. STATE
   ------------------------------------------------------------ */
const MODE = { START: 'START', PLAYING: 'PLAYING', PAUSED: 'PAUSED', OVER: 'OVER' };

const state = {
    mode: MODE.START,
    selectedCharacter: loadCharacter(),
    best: loadBest(),

    score: 0,
    lives: CONFIG.maxLives,
    multiplier: 1,
    multProgress: 0,
    speed: CONFIG.baseSpeed,

    time: 0,
    scrollZ: 0,
    spawnTimer: CONFIG.firstSpawnDelay,
    spawnCount: 0,

    invulnTimer: 0,
    shakeTimer: 0,

    obstacles: [],
    collectibles: [],
    particles: [],

    player: {
        x: 0,
        y: 0,               // height above ground (bottom of ball)
        vx: 0,
        vy: 0,
        grounded: true,
        landSquash: 0,
        roll: 0,
        targetX: 0,
        hasTarget: false,
    },

    inputLeft: false,
    inputRight: false,

    touchActive: false,
    touchStartX: 0,
    touchStartY: 0,
    touchCurrentX: 0,
    touchCurrentY: 0,
    touchAnchorX: 0,
    touchStartTime: 0,
    touchJumped: false,

    cacheScore: -1,
    cacheMult: -1,
};

/* ------------------------------------------------------------
   7. HELPERS
   ------------------------------------------------------------ */
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function shade(hex, amount) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    let r = (num >> 16) & 0xff;
    let g = (num >> 8) & 0xff;
    let b = num & 0xff;
    if (amount >= 0) {
        r = Math.round(r + (255 - r) * amount);
        g = Math.round(g + (255 - g) * amount);
        b = Math.round(b + (255 - b) * amount);
    } else {
        const a = 1 + amount;
        r = Math.round(r * a);
        g = Math.round(g * a);
        b = Math.round(b * a);
    }
    return `rgb(${r},${g},${b})`;
}

function hexToRgba(hex, a) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    const r = (num >> 16) & 0xff;
    const g = (num >> 8) & 0xff;
    const b = num & 0xff;
    return `rgba(${r},${g},${b},${a})`;
}

/* ------------------------------------------------------------
   8. PROJECTION
   ------------------------------------------------------------ */
function project(x, y, z, playerX) {
    const d = z + CONFIG.camDist;
    if (d <= 0.05) return null;
    const s = focal / d;
    return {
        x: W * 0.5 + (x - playerX) * s,
        y: horizonY - (y - CONFIG.camHeight) * s,
        s: s,
        d: d,
    };
}

/* ------------------------------------------------------------
   9. SKYLINE
   ------------------------------------------------------------ */
const skylineLayers = [];

function buildSkyline() {
    skylineLayers.length = 0;
    const defs = [
        { count: 26, minH: 0.05, maxH: 0.12, color: themeColors.skyline1, parallax: 0.15 },
        { count: 20, minH: 0.08, maxH: 0.20, color: themeColors.skyline2, parallax: 0.28 },
        { count: 16, minH: 0.14, maxH: 0.30, color: themeColors.skyline3, parallax: 0.45 },
    ];
    for (const def of defs) {
        const buildings = [];
        for (let i = 0; i < def.count; i++) {
            buildings.push({
                x: Math.random(),
                w: 0.02 + Math.random() * 0.05,
                h: def.minH + Math.random() * (def.maxH - def.minH),
                accent: Math.random() < 0.25,
            });
        }
        skylineLayers.push({ def, buildings });
    }
}

function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, horizonY + 20);
    g.addColorStop(0, themeColors.skyTop);
    g.addColorStop(0.55, themeColors.skyMid);
    g.addColorStop(1, themeColors.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, horizonY + 20);
}

function drawSkyline() {
    const parallaxBase = (state.scrollZ * 0.0015) % 1;
    for (const layer of skylineLayers) {
        const { def, buildings } = layer;
        for (const b of buildings) {
            let bx = (b.x - parallaxBase * def.parallax) % 1;
            if (bx < 0) bx += 1;
            const bw = b.w * W;
            const px = bx * W - bw * 0.5;
            const bh = b.h * H;
            const py = horizonY - bh;

            ctx.fillStyle = def.color;
            ctx.fillRect(px, py, bw, bh);

            if (b.accent) {
                ctx.fillStyle = themeColors.skylineAccent;
                ctx.fillRect(px + bw * 0.15, py + bh * 0.08, bw * 0.7, Math.max(1, bh * 0.06));
            }
        }
    }
    const haze = ctx.createLinearGradient(0, horizonY - H * 0.25, 0, horizonY + 4);
    haze.addColorStop(0, 'rgba(232, 236, 245, 0)');
    haze.addColorStop(1, themeColors.skylineHaze);
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizonY - H * 0.25, W, H * 0.25 + 4);
}

/* ------------------------------------------------------------
   10. GROUND / ROAD
   ------------------------------------------------------------ */
   function drawGround() {
    const g = ctx.createLinearGradient(0, horizonY, 0, H);
    g.addColorStop(0, themeColors.groundNear);
    g.addColorStop(1, themeColors.groundFar);
    ctx.fillStyle = g;
    ctx.fillRect(0, horizonY, W, H - horizonY);
}

function drawRoad() {
    const px = state.player.x;
    const hw = CONFIG.roadHalfWidth;
    const zNear = -CONFIG.camDist + 0.4;
    const zFar = 300;

    const nl = project(-hw, 0, zNear, px);
    const nr = project( hw, 0, zNear, px);
    const fl = project(-hw, 0, zFar,  px);
    const fr = project( hw, 0, zFar,  px);
    if (!nl || !nr || !fl || !fr) return;

    const grad = ctx.createLinearGradient(0, fl.y, 0, nl.y);
    grad.addColorStop(0, themeColors.roadFar);
    grad.addColorStop(0.35, themeColors.roadMid);
    grad.addColorStop(1, themeColors.roadNear);
    ctx.beginPath();
    ctx.moveTo(nl.x, nl.y);
    ctx.lineTo(nr.x, nr.y);
    ctx.lineTo(fr.x, fr.y);
    ctx.lineTo(fl.x, fl.y);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = themeColors.roadEdge;
    ctx.lineWidth = Math.max(1, W * 0.0022);
    ctx.beginPath();
    ctx.moveTo(nl.x, nl.y); ctx.lineTo(fl.x, fl.y);
    ctx.moveTo(nr.x, nr.y); ctx.lineTo(fr.x, fr.y);
    ctx.stroke();

    drawRoadDashes(px);
    // Road diamond markings intentionally removed for a smoother, cleaner look.
}

function drawRoadDashes(px) {
    const dashLen = 2.2, gap = 2.2;
    const total = dashLen + gap;
    const offset = state.scrollZ % total;
    const startZ = -offset;
    const count = 42;

    for (let i = 0; i < count; i++) {
        const z0 = startZ + i * total;
        const z1 = z0 + dashLen;
        if (z1 < 0.6) continue;
        if (z0 > 260) break;

        const zz0 = Math.max(z0, 0.6);
        const zz1 = Math.min(z1, 260);
        const p0 = project(-0.06, 0.02, zz0, px);
        const p1 = project( 0.06, 0.02, zz0, px);
        const p2 = project( 0.06, 0.02, zz1, px);
        const p3 = project(-0.06, 0.02, zz1, px);
        if (!p0 || !p1 || !p2 || !p3) continue;

        const alpha = clamp(1.6 - p0.d / 180, 0, 1) * 0.55;
        if (alpha <= 0.02) continue;

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = themeColors.roadDash;
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

function drawRoadMarkings(px) {
    const spacing = 14;
    const offset = state.scrollZ % spacing;
    const startZ = -offset;
    const count = 16;

    for (let i = 0; i < count; i++) {
        const z = startZ + i * spacing;
        if (z < 2 || z > 260) continue;
        const x = ((i * 37) % 7 - 3) * 0.9;
        const p = project(x, 0.02, z, px);
        if (!p) continue;
        const size = 0.35 * p.s;
        if (size < 1.2) continue;
        const alpha = clamp(1.4 - p.d / 180, 0, 1) * 0.38;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = `rgba(150, 165, 195, ${alpha})`;
        ctx.fillRect(-size * 0.5, -size * 0.5, size, size);
        ctx.restore();
    }
}

/* ------------------------------------------------------------
   11. SIDE WALLS
   ------------------------------------------------------------ */
   function drawSideWalls() {
    const px = state.player.x;
    const wallX = CONFIG.roadHalfWidth + 0.55;
    const spacing = 2.0;
    const depth = 1.75;
    const offset = state.scrollZ % spacing;
    const startZ = -offset;
    const count = 120;
    const palette = themeColors.walls;

    for (let i = 0; i < count; i++) {
        const z = startZ + i * spacing;
        if (z + depth < 0.4) continue;
        if (z > 300) break;

        const seed = (i + Math.floor((state.scrollZ + offset) / spacing)) | 0;
        const colorR = palette[((seed % palette.length) + palette.length) % palette.length];
        const colorL = palette[(((seed + 3) % palette.length) + palette.length) % palette.length];
        const height = 3.2 + ((seed * 13) % 5) * 0.55;

        drawWallBlock( wallX, z, depth, height, colorR, px);
        drawWallBlock(-wallX, z, depth, height, colorL, px);
    }
}

function drawWallBlock(wallX, z, depth, height, color, playerX) {
    const zf = z;
    const zb = z + depth;

    const fl = project(wallX, 0,      zf, playerX);
    const fr = project(wallX, height, zf, playerX);
    const bl = project(wallX, 0,      zb, playerX);
    const br = project(wallX, height, zb, playerX);
    if (!fl || !fr || !bl || !br) return;

    const fade = clamp(1 - fl.d / 260, 0, 1);
    if (fade < 0.03) return;

    ctx.globalAlpha = fade;

    ctx.beginPath();
    ctx.moveTo(fl.x, fl.y);
    ctx.lineTo(fr.x, fr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();

    const g = ctx.createLinearGradient(fr.x, fr.y, fl.x, fl.y);
    g.addColorStop(0, shade(color, 0.4));
    g.addColorStop(1, shade(color, -0.08));
    ctx.fillStyle = g;
    ctx.fill();

    ctx.strokeStyle = 'rgba(20, 20, 40, 0.28)';
    ctx.lineWidth = Math.max(0.8, W * 0.0015);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(fr.x, fr.y);
    ctx.lineTo(br.x, br.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = Math.max(1, W * 0.002);
    ctx.stroke();

    ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------
   12. OBSTACLES
   ------------------------------------------------------------ */
function spawnObstacle(kind, x, z, opts) {
    opts = opts || {};
    state.obstacles.push({
        kind: kind,
        x: x,
        z: z,
        w: opts.w != null ? opts.w : 1.6,
        h: opts.h != null ? opts.h : 1.6,
        d: opts.d != null ? opts.d : 1.4,
        color: opts.color || '#ef4444',
        prevZ: z,
        hit: false,
        passed: false,
    });
}

function spawnPattern() {
    const diff = getDifficulty();

    // --- first few spawns: teach the player gently ---
    if (state.spawnCount < 2) {
        if (state.spawnCount === 0) {
            // Teach horizontal dodge
            const x = pick([-2.6, 2.6]);
            spawnObstacle('block', x, CONFIG.spawnAheadZ,
                { w: 2.2, h: 1.8, d: 1.3, color: '#ef4444' });
        } else {
            // Teach jump — full-road low barrier with reward arc
            spawnObstacle('barrier', 0, CONFIG.spawnAheadZ,
                { w: CONFIG.roadHalfWidth * 2 - 0.6, h: 0.65, d: 0.5, color: '#ef4444' });
            spawnCollectible(0, CONFIG.spawnAheadZ, 1.15);
        }
        state.spawnCount++;
        return;
    }
    state.spawnCount++;

    const patterns = [];

    // 1) single block in one lane (dodge)
    patterns.push(() => {
        const x = pick([-2.6, 0, 2.6]);
        spawnObstacle('block', x, CONFIG.spawnAheadZ,
            { w: 2.2, h: 1.8, d: 1.3, color: '#ef4444' });
    });

    // 2) two blocks with a center gap (dodge to center)
    patterns.push(() => {
        spawnObstacle('block', -3.2, CONFIG.spawnAheadZ,
            { w: 3.4, h: 1.9, d: 1.3, color: '#ef4444' });
        spawnObstacle('block',  3.2, CONFIG.spawnAheadZ,
            { w: 3.4, h: 1.9, d: 1.3, color: '#f97316' });
        spawnCollectible(0, CONFIG.spawnAheadZ + 4, 0.6);
        spawnCollectible(0, CONFIG.spawnAheadZ + 7, 0.6);
    });

    // 3) full-road low barrier (must JUMP) + collectible arc
    patterns.push(() => {
        spawnObstacle('barrier', 0, CONFIG.spawnAheadZ,
            { w: CONFIG.roadHalfWidth * 2 - 0.4, h: 0.7, d: 0.55, color: '#ef4444' });
        spawnCollectible(0,     CONFIG.spawnAheadZ, 1.15);
        spawnCollectible(0,     CONFIG.spawnAheadZ + 2.5, 1.15);
    });

    // 4) medium low barrier, offset to one side (dodge OR jump)
    patterns.push(() => {
        const side = Math.random() < 0.5 ? -1 : 1;
        const centerX = side * 1.8;
        spawnObstacle('barrier', centerX, CONFIG.spawnAheadZ,
            { w: 4.0, h: 0.72, d: 0.55, color: '#f97316' });
        // Collectible above the barrier (rewards jumping) and one on the free side
        spawnCollectible(centerX, CONFIG.spawnAheadZ, 1.1);
        spawnCollectible(-centerX, CONFIG.spawnAheadZ, 0.6);
    });

    // 5) gate: tall pillars with a gap (dodge through)
    patterns.push(() => {
        const gapX = pick([-2.4, 0, 2.4]);
        const gapHalf = 1.3;
        const leftInner  = gapX - gapHalf;
        const rightInner = gapX + gapHalf;
        const edgeL = -CONFIG.roadHalfWidth;
        const edgeR =  CONFIG.roadHalfWidth;

        if (leftInner - edgeL > 0.3) {
            const w = Math.min(2.3, leftInner - edgeL - 0.1);
            spawnObstacle('block', (edgeL + leftInner) * 0.5, CONFIG.spawnAheadZ,
                { w: w, h: 2.6, d: 0.8, color: '#a855f7' });
        }
        if (edgeR - rightInner > 0.3) {
            const w = Math.min(2.3, edgeR - rightInner - 0.1);
            spawnObstacle('block', (rightInner + edgeR) * 0.5, CONFIG.spawnAheadZ,
                { w: w, h: 2.6, d: 0.8, color: '#a855f7' });
        }
        for (let i = 0; i < 3; i++) {
            spawnCollectible(gapX, CONFIG.spawnAheadZ + 4 + i * 3, 0.65);
        }
    });

    // 6) full-road barrier + follow-up dodge block (jump THEN dodge)
    patterns.push(() => {
        spawnObstacle('barrier', 0, CONFIG.spawnAheadZ,
            { w: CONFIG.roadHalfWidth * 2 - 0.5, h: 0.7, d: 0.5, color: '#ef4444' });
        spawnCollectible(0, CONFIG.spawnAheadZ, 1.15);
        // Follow-up dodge block placed AFTER landing distance
        spawnObstacle('block', pick([-2.8, 2.8]), CONFIG.spawnAheadZ + 14,
            { w: 2.0, h: 1.7, d: 1.1, color: '#a855f7' });
    });

    // 7) triple blocks — one lane open (harder)
    if (diff > 0.2) {
        patterns.push(() => {
            const openLeft = Math.random() < 0.5;
            const xs = [-3.3, 0, 3.3];
            for (const bx of xs) {
                if (openLeft && bx < -1) continue;
                if (!openLeft && bx > 1) continue;
                spawnObstacle('block', bx, CONFIG.spawnAheadZ,
                    { w: 2.0, h: 1.7, d: 1.1,
                      color: pick(['#ef4444', '#f97316', '#fbbf24']) });
            }
            const lane = openLeft ? -3.3 : 3.3;
            spawnCollectible(lane, CONFIG.spawnAheadZ + 4, 0.6);
            spawnCollectible(lane, CONFIG.spawnAheadZ + 7, 0.6);
        });
    }

    // 8) narrow low barrier in the center — dodge around OR jump over
    if (diff > 0.15) {
        patterns.push(() => {
            spawnObstacle('barrier', 0, CONFIG.spawnAheadZ,
                { w: 3.4, h: 0.7, d: 0.55, color: '#f97316' });
            spawnCollectible(0, CONFIG.spawnAheadZ, 1.1);
            spawnCollectible(-2.9, CONFIG.spawnAheadZ, 0.6);
            spawnCollectible( 2.9, CONFIG.spawnAheadZ, 0.6);
        });
    }

    patterns[(Math.random() * patterns.length) | 0]();
}

function updateObstacles(dt, moveZ) {
    const r = CONFIG.ballRadius;
    const px = state.player.x;
    const py0 = state.player.y;
    const py1 = state.player.y + 2 * r;

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
        const o = state.obstacles[i];
        o.prevZ = o.z;
        o.z -= moveZ;

        // ----- Full XYZ AABB overlap -----
        if (!o.hit) {
            const ox0 = o.x - o.w * 0.5;
            const ox1 = o.x + o.w * 0.5;
            const oy0 = 0;
            const oy1 = o.h;
            const oz0 = o.z - o.d * 0.5;
            const oz1 = o.z + o.d * 0.5;

            const px0 = px - r;
            const px1 = px + r;
            const pz0 = -r;
            const pz1 = r;

            const overlapX = px0 < ox1 && px1 > ox0;
            const overlapY = py0 < oy1 && py1 > oy0;
            const overlapZ = pz0 < oz1 && pz1 > oz0;

            if (overlapX && overlapY && overlapZ) {
                o.hit = true;
                onPlayerHit(o);
            }
        }

        // Passing bonus
        if (!o.hit && !o.passed && (o.z + o.d * 0.5) < -0.1) {
            o.passed = true;
            state.score += CONFIG.scorePerPass * state.multiplier;
            addMultiplierProgress(CONFIG.multProgressPerPass);
        }

        if (o.z < CONFIG.despawnZ) {
            state.obstacles.splice(i, 1);
        }
    }
}

/* ------------------------------------------------------------
   13. COLLECTIBLES
   ------------------------------------------------------------ */
function spawnCollectible(x, z, y) {
    state.collectibles.push({
        x: x,
        z: z,
        y: y != null ? y : 0.6,
        size: 0.38,
        rot: Math.random() * Math.PI * 2,
        color: pick(CONFIG.collectColors),
        bob: Math.random() * Math.PI * 2,
    });
}

function updateCollectibles(dt, moveZ) {
    const r = CONFIG.ballRadius;
    const px = state.player.x;
    const ballCenterY = state.player.y + r;

    for (let i = state.collectibles.length - 1; i >= 0; i--) {
        const c = state.collectibles[i];
        c.z -= moveZ;
        c.rot += dt * 4.2;
        c.bob += dt * 3.0;

        if (c.z < 1.2 && c.z > -1.2) {
            const dx = c.x - px;
            const dy = c.y - ballCenterY;
            const rad = r + c.size * 0.95;
            if (dx * dx + dy * dy < rad * rad) {
                onCollect(c);
                state.collectibles.splice(i, 1);
                continue;
            }
        }

        if (c.z < CONFIG.despawnZ) {
            state.collectibles.splice(i, 1);
        }
    }
}

/* ------------------------------------------------------------
   14. PARTICLES
   ------------------------------------------------------------ */
function spawnParticles(x, y, z, color, count, opts) {
    opts = opts || {};
    for (let i = 0; i < count; i++) {
        state.particles.push({
            x: x, y: y, z: z,
            vx: (Math.random() - 0.5) * (opts.spread || 3),
            vy: (Math.random() * 0.7 + 0.2) * (opts.up || 3),
            vz: (Math.random() - 0.5) * (opts.spread || 3),
            life: opts.life || 0.7,
            maxLife: opts.life || 0.7,
            color: color,
            size: opts.size || 0.11,
            gravity: opts.gravity != null ? opts.gravity : 7,
        });
    }
}

function updateParticles(dt, moveZ) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.life -= dt;
        if (p.life <= 0) { state.particles.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt - moveZ;
        p.vy -= p.gravity * dt;
        if (p.y < 0) { p.y = 0; p.vy *= -0.4; }
    }
    if (state.particles.length > 220) {
        state.particles.splice(0, state.particles.length - 220);
    }
}

/* ------------------------------------------------------------
   15. RENDER ENTITIES
   ------------------------------------------------------------ */
function drawObstacles() {
    const list = state.obstacles.slice().sort((a, b) => b.z - a.z);
    for (const o of list) {
        if (o.z < -0.5) continue;
        drawObstacleBox(o);
    }
}

function drawObstacleBox(o) {
    const px = state.player.x;
    const x0 = o.x - o.w * 0.5;
    const x1 = o.x + o.w * 0.5;
    const y0 = 0;
    const y1 = o.h;
    const z0 = o.z - o.d * 0.5;
    const z1 = o.z + o.d * 0.5;

    if (z1 < 0.4) return;
    const zz0 = Math.max(z0, 0.4);
    const zz1 = Math.max(z1, 0.5);

    const flb = project(x0, y0, zz0, px);
    const frb = project(x1, y0, zz0, px);
    const flt = project(x0, y1, zz0, px);
    const frt = project(x1, y1, zz0, px);

    const blb = project(x0, y0, zz1, px);
    const brb = project(x1, y0, zz1, px);
    const blt = project(x0, y1, zz1, px);
    const brt = project(x1, y1, zz1, px);

    if (!flb || !frb || !flt || !frt) return;

    let fade = clamp(1 - flb.d / 250, 0, 1);
    if (o.z < 0.4) fade *= clamp((o.z + 0.5) / 0.9, 0, 1);
    if (fade < 0.03) return;

    ctx.globalAlpha = fade;
    const base = o.color;

    if (blt && brt) {
        ctx.beginPath();
        ctx.moveTo(flt.x, flt.y);
        ctx.lineTo(frt.x, frt.y);
        ctx.lineTo(brt.x, brt.y);
        ctx.lineTo(blt.x, blt.y);
        ctx.closePath();
        ctx.fillStyle = shade(base, 0.5);
        ctx.fill();
    }

    if (blt && brb && blb && brt) {
        const useRight = state.player.x < o.x;
        if (useRight) {
            ctx.beginPath();
            ctx.moveTo(frt.x, frt.y);
            ctx.lineTo(brt.x, brt.y);
            ctx.lineTo(brb.x, brb.y);
            ctx.lineTo(frb.x, frb.y);
            ctx.closePath();
            ctx.fillStyle = shade(base, -0.28);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.moveTo(flt.x, flt.y);
            ctx.lineTo(blt.x, blt.y);
            ctx.lineTo(blb.x, blb.y);
            ctx.lineTo(flb.x, flb.y);
            ctx.closePath();
            ctx.fillStyle = shade(base, -0.28);
            ctx.fill();
        }
    }

    ctx.beginPath();
    ctx.moveTo(flb.x, flb.y);
    ctx.lineTo(frb.x, frb.y);
    ctx.lineTo(frt.x, frt.y);
    ctx.lineTo(flt.x, flt.y);
    ctx.closePath();

    const g = ctx.createLinearGradient(frt.x, frt.y, flb.x, flb.y);
    g.addColorStop(0, shade(base, 0.22));
    g.addColorStop(1, shade(base, -0.14));
    ctx.fillStyle = g;
    ctx.fill();

    ctx.strokeStyle = 'rgba(20, 20, 40, 0.38)';
    ctx.lineWidth = Math.max(1, W * 0.0018);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(flt.x, flt.y);
    ctx.lineTo(frt.x, frt.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = Math.max(1, W * 0.002);
    ctx.stroke();

    drawObstacleShadow(o, fade);

    ctx.globalAlpha = 1;
}

function drawCollectibles() {
    const list = state.collectibles.slice().sort((a, b) => b.z - a.z);
    for (const c of list) {
        if (c.z < -0.5) continue;
        drawCollectible(c);
    }
}

function drawCollectible(c) {
    const px = state.player.x;
    const by = c.y + Math.sin(c.bob) * 0.08;
    const p = project(c.x, by, c.z, px);
    if (!p) return;

    const size = c.size * p.s;
    if (size < 1) return;

    let fade = clamp(1 - p.d / 230, 0, 1);
    if (c.z < 0.4) fade *= clamp((c.z + 0.5) / 0.9, 0, 1);
    if (fade < 0.04) return;

    const sp = project(c.x, 0, c.z, px);
    if (sp) {
        ctx.globalAlpha = 0.28 * fade;
        ctx.beginPath();
        ctx.ellipse(sp.x, sp.y, size * 0.7, size * 0.24, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
    }

    ctx.globalAlpha = fade;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(c.rot);

    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.4);
    glow.addColorStop(0, hexToRgba(c.color, 0.55));
    glow.addColorStop(1, hexToRgba(c.color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, size * 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.85, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size * 0.85, 0);
    ctx.closePath();

    const g = ctx.createLinearGradient(0, -size, 0, size);
    g.addColorStop(0, shade(c.color, 0.6));
    g.addColorStop(0.5, c.color);
    g.addColorStop(1, shade(c.color, -0.38));
    ctx.fillStyle = g;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = Math.max(1, size * 0.12);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -size * 0.55);
    ctx.lineTo(size * 0.35, 0);
    ctx.lineTo(0, size * 0.55);
    ctx.lineTo(-size * 0.35, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();

    ctx.restore();
    ctx.globalAlpha = 1;
}

function drawParticles() {
    const px = state.player.x;
    for (const p of state.particles) {
        const pr = project(p.x, p.y, p.z, px);
        if (!pr) continue;
        const alpha = clamp(p.life / p.maxLife, 0, 1);
        const size = p.size * pr.s;
        if (size < 0.5) continue;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------
   16. PLAYER BALL (jump-aware)
   ------------------------------------------------------------ */
function drawPlayer() {
    const ch = CONFIG.characters[state.selectedCharacter];
    const p = state.player;
    const r = CONFIG.ballRadius;

    // ---- Ground shadow (stays on road) ----
    const sp = project(p.x, 0.01, 0, p.x);
    if (sp) {
        const heightFactor = clamp(1 - p.y * 0.22, 0.45, 1);
        const opacity = clamp(0.55 - p.y * 0.22, 0.14, 0.55);
        const sr = r * sp.s * 1.15 * heightFactor;
        const sh = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sr);
        sh.addColorStop(0, `rgba(15, 20, 40, ${opacity})`);
        sh.addColorStop(0.6, `rgba(15, 20, 40, ${opacity * 0.35})`);
        sh.addColorStop(1, 'rgba(15, 20, 40, 0)');
        ctx.fillStyle = sh;
        ctx.beginPath();
        ctx.ellipse(sp.x, sp.y, sr, sr * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // ---- Ball ----
    const ballCenterY = p.y + r;
    const bp = project(p.x, ballCenterY, 0, p.x);
    if (!bp) return;
    const sr = r * bp.s;
    if (sr < 1) return;

    // squash / stretch
    let sx = 1, sy = 1;
    if (!p.grounded) {
        const stretch = clamp(Math.abs(p.vy) * 0.016, 0, 0.18);
        sy = 1 + stretch;
        sx = 1 - stretch * 0.5;
    }
    if (p.landSquash > 0) {
        const t = p.landSquash / 0.18;
        const amount = Math.sin(t * Math.PI) * 0.22;
        sy = 1 - amount;
        sx = 1 + amount * 0.7;
    }

    let alpha = 1;
    if (state.invulnTimer > 0) {
        alpha = 0.35 + 0.65 * Math.abs(Math.sin(state.invulnTimer * 22));
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    // Outer glow (unscaled)
    const glow = ctx.createRadialGradient(bp.x, bp.y, sr * 0.35, bp.x, bp.y, sr * 2);
    glow.addColorStop(0, hexToRgba(ch.accent, 0.4));
    glow.addColorStop(1, hexToRgba(ch.accent, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(bp.x, bp.y, sr * 2, 0, Math.PI * 2);
    ctx.fill();

    // Squash/stretch around ball center
    ctx.translate(bp.x, bp.y);
    ctx.scale(sx, sy);
    ctx.translate(-bp.x, -bp.y);

    // Sphere shading
    const grad = ctx.createRadialGradient(
        bp.x - sr * 0.35, bp.y - sr * 0.42, sr * 0.05,
        bp.x, bp.y, sr * 1.02
    );
    grad.addColorStop(0, ch.c1);
    grad.addColorStop(0.45, ch.c2);
    grad.addColorStop(1, ch.c3);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bp.x, bp.y, sr, 0, Math.PI * 2);
    ctx.fill();

    // Rolling bands clipped to sphere
    ctx.save();
    ctx.beginPath();
    ctx.arc(bp.x, bp.y, sr, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(bp.x, bp.y);
    ctx.rotate(p.roll);
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = Math.max(1, sr * 0.07);
    for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(i * sr * 0.55, 0, sr, -Math.PI * 0.42, Math.PI * 0.42);
        ctx.stroke();
    }
    ctx.restore();

    // Specular highlight
    const spec = ctx.createRadialGradient(
        bp.x - sr * 0.38, bp.y - sr * 0.45, 0,
        bp.x - sr * 0.38, bp.y - sr * 0.45, sr * 0.6
    );
    spec.addColorStop(0, 'rgba(255,255,255,0.98)');
    spec.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.beginPath();
    ctx.arc(bp.x, bp.y, sr, 0, Math.PI * 2);
    ctx.fill();

    // Bottom rim darkening
    const rim = ctx.createRadialGradient(
        bp.x, bp.y + sr * 0.55, sr * 0.15,
        bp.x, bp.y + sr * 0.55, sr * 1.05
    );
    rim.addColorStop(0, 'rgba(0,0,0,0)');
    rim.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(bp.x, bp.y, sr, 0, Math.PI * 2);
    ctx.fill();

    // ---- 8-ball logo overlay (Saeed only) ----
    if (state.selectedCharacter === 'saeed') {
        const circleR = sr * 0.34;
        const cx = bp.x;
        const cy = bp.y - sr * 0.04;

        // White circle
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
        ctx.fill();

        // Number "8"
        ctx.fillStyle = '#0a0a0a';
        ctx.font = `bold ${Math.max(7, circleR * 1.4)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('8', cx, cy + circleR * 0.05);
    }

    ctx.restore();
}

function drawGroundShadow(worldX, worldZ, worldRadius, alpha) {
    if (alpha <= 0.02) return;
    const p = project(worldX, 0.01, worldZ, state.player.x);
    if (!p) return;
    const r = worldRadius * p.s;
    if (r < 1) return;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(15,20,40,${0.35 * alpha})`;
    ctx.fill();
}

function drawObstacleShadow(o, fade) {
    if (fade < 0.05) return;
    const px = state.player.x;

    // Project front & back edges of the obstacle's ground footprint
    const frontZ = o.z - o.d * 0.5 - 0.15;
    const backZ  = o.z + o.d * 0.5 + 0.15;
    const cf = project(o.x, 0.01, frontZ, px);
    const cb = project(o.x, 0.01, backZ,  px);
    if (!cf || !cb) return;

    const cx = (cf.x + cb.x) * 0.5;
    const cy = (cf.y + cb.y) * 0.5;
    const rx = o.w * 0.62 * cf.s;
    // Vertical radius = half the projected footprint depth, expanded slightly
    const ry = Math.max(2.5, Math.abs(cf.y - cb.y) * 0.62 + o.w * 0.05 * cf.s);

    const radius = Math.max(rx, ry);
    if (radius < 1.5) return;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0.0, `rgba(15, 20, 40, ${0.42 * fade})`);
    grad.addColorStop(0.55, `rgba(15, 20, 40, ${0.22 * fade})`);
    grad.addColorStop(1.0, 'rgba(15, 20, 40, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
}

/* ------------------------------------------------------------
   17. EVENTS
   ------------------------------------------------------------ */
function getDifficulty() {
    return clamp(state.time / 90, 0, 1);
}

function onCollect(c) {
    state.score += Math.round(CONFIG.scorePerCollect * state.multiplier);
    addMultiplierProgress(CONFIG.multProgressPerCollect);

    spawnParticles(c.x, c.y, c.z, c.color, 10, {
        spread: 2.6, up: 2.6, life: 0.6, size: 0.1,
    });

    Sound.collect();
}

function onPlayerHit() {
    if (state.invulnTimer > 0) return;
    if (state.lives <= 0) return;

    state.lives -= 1;
    state.invulnTimer = CONFIG.invulnDuration;

    state.multiplier = 1;
    state.multProgress = 0;
    state.cacheMult = -1;

    state.shakeTimer = 0.42;

    spawnParticles(state.player.x, CONFIG.ballRadius + state.player.y, 0, '#ff5566', 16,
        { spread: 4, up: 3, life: 0.6, size: 0.14 });
    spawnParticles(state.player.x, CONFIG.ballRadius + state.player.y, 0, '#ffffff', 8,
        { spread: 3, up: 2, life: 0.4, size: 0.1 });

    damageFlashEl.classList.add('is-active');
    setTimeout(() => damageFlashEl.classList.remove('is-active'), 140);

    Sound.hit();
    updateHeartsUI(true);

    if (state.lives <= 0) {
        triggerGameOver();
    }
}

function addMultiplierProgress(amount) {
    if (state.multiplier >= CONFIG.maxMultiplier) {
        state.multProgress = 1;
        return;
    }
    state.multProgress += amount;
    while (state.multProgress >= 1 && state.multiplier < CONFIG.maxMultiplier) {
        state.multProgress -= 1;
        state.multiplier++;
        state.cacheMult = -1;
        Sound.mult();
    }
    if (state.multiplier >= CONFIG.maxMultiplier) state.multProgress = 1;
}

function triggerJump() {
    const p = state.player;
    if (!p.grounded) return;
    p.vy = CONFIG.jumpForce;
    p.grounded = false;
    p.landSquash = 0;
    Sound.jump();
}

/* ------------------------------------------------------------
   18. UI UPDATES
   ------------------------------------------------------------ */
function updateScoreUI() {
    const s = Math.floor(state.score);
    if (s !== state.cacheScore) {
        state.cacheScore = s;
        scoreEl.textContent = String(s);
    }
}

function updateHeartsUI(animateLast) {
    for (let i = 0; i < heartsEl.length; i++) {
        const el = heartsEl[i];
        if (i < state.lives) {
            el.classList.remove('is-lost');
            el.classList.remove('is-breaking');
        } else {
            if (animateLast && i === state.lives) {
                el.classList.add('is-breaking');
                setTimeout(() => el.classList.remove('is-breaking'), 500);
            }
            el.classList.add('is-lost');
        }
    }
}

function updateMultiplierUI() {
    if (state.multiplier !== state.cacheMult) {
        state.cacheMult = state.multiplier;
        multValueEl.textContent = 'x' + state.multiplier;
    }
    multFillEl.style.width = Math.round(state.multProgress * 100) + '%';
}

/* ------------------------------------------------------------
   19. GAME FLOW
   ------------------------------------------------------------ */
function resetGame() {
    state.score = 0;
    state.lives = CONFIG.maxLives;
    state.multiplier = 1;
    state.multProgress = 0;
    state.speed = CONFIG.baseSpeed;
    state.time = 0;
    state.scrollZ = 0;
    state.spawnTimer = CONFIG.firstSpawnDelay;
    state.spawnCount = 0;
    state.invulnTimer = 0;
    state.shakeTimer = 0;

    state.obstacles.length = 0;
    state.collectibles.length = 0;
    state.particles.length = 0;

    const p = state.player;
    p.x = 0;
    p.y = 0;
    p.vx = 0;
    p.vy = 0;
    p.grounded = true;
    p.landSquash = 0;
    p.roll = 0;
    p.targetX = 0;
    p.hasTarget = false;

    state.inputLeft = false;
    state.inputRight = false;
    state.touchActive = false;
    state.touchJumped = false;

    state.cacheScore = -1;
    state.cacheMult = -1;

    updateHeartsUI(false);
    updateScoreUI();
    updateMultiplierUI();
}

function startGame() {
    Sound.init();
    Sound.resume();

    resetGame();
    state.mode = MODE.PLAYING;

    hideAllScreens();
    hudEl.setAttribute('aria-hidden', 'false');
    hudCharNameEl.textContent = CONFIG.characters[state.selectedCharacter].name;

    lastTime = performance.now();
}

function triggerGameOver() {
    state.mode = MODE.OVER;
    Sound.gameover();

    const finalScore = Math.floor(state.score);
    const isNewBest = finalScore > state.best;
    if (isNewBest) {
        state.best = finalScore;
        saveBest(state.best);
    }

    finalScoreEl.textContent = String(finalScore);
    bestScoreEl.textContent = String(state.best);
    finalCharEl.textContent = CONFIG.characters[state.selectedCharacter].name;
    newBestBadgeEl.hidden = !isNewBest;

    hudEl.setAttribute('aria-hidden', 'true');
    showScreen(gameOverScreenEl);
}

function pauseGame() {
    if (state.mode !== MODE.PLAYING) return;
    state.mode = MODE.PAUSED;
    pauseScoreEl.textContent = String(Math.floor(state.score));
    pauseCharEl.textContent = CONFIG.characters[state.selectedCharacter].name;
    showScreen(pauseScreenEl);
}

function resumeGame() {
    if (state.mode !== MODE.PAUSED) return;
    state.mode = MODE.PLAYING;
    hideAllScreens();
    Sound.resume();
    lastTime = performance.now();
}

function goToMenu() {
    state.mode = MODE.START;
    hudEl.setAttribute('aria-hidden', 'true');
    refreshCharacterUI();
    showScreen(startScreenEl);
}

function hideAllScreens() {
    startScreenEl.classList.remove('is-active');
    pauseScreenEl.classList.remove('is-active');
    gameOverScreenEl.classList.remove('is-active');
}
function showScreen(el) {
    hideAllScreens();
    el.classList.add('is-active');
}

/* ------------------------------------------------------------
   20. INPUT
   ------------------------------------------------------------ */
function onKeyDown(e) {
    const k = e.key;

    if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        state.inputLeft = true;
        state.player.hasTarget = false;
        e.preventDefault();
    } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        state.inputRight = true;
        state.player.hasTarget = false;
        e.preventDefault();
    } else if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') {
        if (state.mode === MODE.PLAYING) {
            triggerJump();
        } else if (state.mode === MODE.START) {
            startGame();
        }
        e.preventDefault();
    } else if (k === 'Enter') {
        if (state.mode === MODE.START) {
            startGame();
            e.preventDefault();
        }
    } else if (k === 'Escape' || k === 'p' || k === 'P') {
        if (state.mode === MODE.PLAYING) pauseGame();
        else if (state.mode === MODE.PAUSED) resumeGame();
    }
}
function onKeyUp(e) {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') state.inputLeft = false;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') state.inputRight = false;
}

window.addEventListener('keydown', onKeyDown, { passive: false });
window.addEventListener('keyup', onKeyUp);

/* ---- touch / pointer ---- */
function pointerPos(e) {
    let x = 0, y = 0;
    if (e.touches && e.touches.length) {
        x = e.touches[0].clientX; y = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length) {
        x = e.changedTouches[0].clientX; y = e.changedTouches[0].clientY;
    } else {
        x = e.clientX; y = e.clientY;
    }
    return { x, y };
}

function onPointerDown(e) {
    if (state.mode !== MODE.PLAYING) return;
    const p = pointerPos(e);
    state.touchActive = true;
    state.touchStartX = p.x;
    state.touchStartY = p.y;
    state.touchCurrentX = p.x;
    state.touchCurrentY = p.y;
    state.touchAnchorX = p.x;
    state.touchStartTime = performance.now();
    state.touchJumped = false;
    e.preventDefault();
}

function onPointerMove(e) {
    if (!state.touchActive) return;
    if (state.mode !== MODE.PLAYING) return;
    const p = pointerPos(e);
    state.touchCurrentX = p.x;
    state.touchCurrentY = p.y;

    // Upward swipe → jump
    const dy = state.touchStartY - state.touchCurrentY;
    const dxTotal = state.touchCurrentX - state.touchStartX;
    if (!state.touchJumped && dy > 28 && dy > Math.abs(dxTotal) * 1.2) {
        triggerJump();
        state.touchJumped = true;
    }

    // Horizontal drag → set target position
    const hdx = state.touchCurrentX - state.touchAnchorX;
    const range = Math.max(45, W * 0.18);
    const norm = clamp(hdx / range, -1, 1);
    const limit = CONFIG.roadHalfWidth - CONFIG.ballRadius * 1.2;
    state.player.targetX = clamp(norm * limit, -limit, limit);
    state.player.hasTarget = true;

    e.preventDefault();
}

function onPointerUp(e) {
    if (!state.touchActive) return;
    state.touchActive = false;

    const dx = state.touchCurrentX - state.touchStartX;
    const dy = state.touchStartY - state.touchCurrentY;
    const duration = performance.now() - state.touchStartTime;

    // Quick horizontal swipe → nudge targetX further in that direction
    if (duration < 220 && Math.abs(dx) > 15 && Math.abs(dx) > Math.abs(dy)) {
        const dir = Math.sign(dx);
        const limit = CONFIG.roadHalfWidth - CONFIG.ballRadius * 1.2;
        const current = state.player.hasTarget ? state.player.targetX : state.player.x;
        state.player.targetX = clamp(current + dir * 1.4, -limit, limit);
        state.player.hasTarget = true;
    }

    if (e.cancelable) e.preventDefault();
}

canvas.addEventListener('touchstart', onPointerDown, { passive: false });
canvas.addEventListener('touchmove',  onPointerMove, { passive: false });
canvas.addEventListener('touchend',   onPointerUp,   { passive: false });
canvas.addEventListener('touchcancel', onPointerUp,  { passive: false });

canvas.addEventListener('mousedown', onPointerDown);
window.addEventListener('mousemove', onPointerMove);
window.addEventListener('mouseup',   onPointerUp);

/* ------------------------------------------------------------
   21. CHARACTER SELECT
   ------------------------------------------------------------ */
function refreshCharacterUI() {
    for (const el of charOptions) {
        const key = el.dataset.character;
        const isSel = key === state.selectedCharacter;
        el.classList.toggle('is-selected', isSel);
        el.setAttribute('aria-checked', isSel ? 'true' : 'false');
    }
    selCharNameEl.textContent = CONFIG.characters[state.selectedCharacter].name;
}

for (const el of charOptions) {
    el.addEventListener('click', () => {
        Sound.init();
        Sound.button();
        const key = el.dataset.character;
        if (CONFIG.characters[key]) {
            state.selectedCharacter = key;
            saveCharacter(key);
            refreshCharacterUI();
        }
    });
}

/* ------------------------------------------------------------
   22. BUTTONS
   ------------------------------------------------------------ */
playButtonEl.addEventListener('click', () => {
    Sound.init(); Sound.button(); startGame();
});
pauseButtonEl.addEventListener('click', () => {
    Sound.button();
    if (state.mode === MODE.PLAYING) pauseGame();
});
resumeButtonEl.addEventListener('click', () => {
    Sound.button(); resumeGame();
});
quitButtonEl.addEventListener('click', () => {
    Sound.button(); goToMenu();
});
playAgainButtonEl.addEventListener('click', () => {
    Sound.button(); startGame();
});
changeBallBtnEl.addEventListener('click', () => {
    Sound.button(); goToMenu();
});

function updateSoundButtonUI() {
    soundButtonEl.setAttribute('aria-pressed', Sound.muted ? 'false' : 'true');
}
soundButtonEl.addEventListener('click', () => {
    Sound.init();
    Sound.muted = !Sound.muted;
    saveMuted(Sound.muted);
    updateSoundButtonUI();
    if (!Sound.muted) Sound.button();
});

/* ------------------------------------------------------------
   THEME TOGGLE
   ------------------------------------------------------------ */
   const themeButtonEl = document.getElementById('themeButton');
   const THEME_KEY = 'neonrunner.theme';
   
   function loadTheme() {
       try {
           const v = localStorage.getItem(THEME_KEY);
           return v === 'neon' ? 'neon' : 'pastel';
       } catch (e) { return 'pastel'; }
   }
   
   function saveTheme(name) {
       try { localStorage.setItem(THEME_KEY, name); } catch (e) {}
   }
   
   function applyTheme(name) {
       document.documentElement.dataset.theme = name;
       saveTheme(name);
       refreshThemeColors();
       buildSkyline();  // رنگهای اسکایلاین بر اساس تم جدید بازسازی میشن
   }
   
   themeButtonEl.addEventListener('click', () => {
       Sound.init();
       Sound.button();
       const cur = document.documentElement.dataset.theme || 'pastel';
       applyTheme(cur === 'neon' ? 'pastel' : 'neon');
   });

/* ------------------------------------------------------------
   23. MAIN LOOP
   ------------------------------------------------------------ */
let lastTime = performance.now();

function frame(now) {
    const rawDt = (now - lastTime) / 1000;
    lastTime = now;
    const dt = clamp(rawDt, 0.001, 0.05);

    if (state.mode === MODE.PLAYING) {
        updateGame(dt);
    }
    render();

    requestAnimationFrame(frame);
}

function updateGame(dt) {
    state.time += dt;

    const diff = getDifficulty();
    state.speed = CONFIG.baseSpeed + (CONFIG.maxSpeed - CONFIG.baseSpeed) * diff;

    const moveZ = state.speed * dt;
    state.scrollZ += moveZ;

    state.score += CONFIG.scorePerSecond * dt * state.multiplier;
    updateScoreUI();

    if (state.multiplier < CONFIG.maxMultiplier) {
        addMultiplierProgress(CONFIG.multProgressPerSecond * dt);
    }
    updateMultiplierUI();

    if (state.invulnTimer > 0) state.invulnTimer = Math.max(0, state.invulnTimer - dt);
    if (state.shakeTimer  > 0) state.shakeTimer  = Math.max(0, state.shakeTimer  - dt);

    updatePlayer(dt);

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
        spawnPattern();
        const spacing = CONFIG.spawnSpacingMin
            + Math.random() * (CONFIG.spawnSpacingMax - CONFIG.spawnSpacingMin)
            - diff * (CONFIG.spawnSpacingMin - CONFIG.spawnSpacingMinAtMax);
        state.spawnTimer = Math.max(0.35, spacing / state.speed);
    }

    updateObstacles(dt, moveZ);
    updateCollectibles(dt, moveZ);
    updateParticles(dt, moveZ);
}

function updatePlayer(dt) {
    const p = state.player;
    const limit = CONFIG.roadHalfWidth - CONFIG.ballRadius * 1.2;

    let targetVx = 0;
    let hasInput = false;

    // Keyboard input has priority
    if (state.inputLeft)  { targetVx = -CONFIG.playerMoveSpeed; hasInput = true; }
    if (state.inputRight) { targetVx =  CONFIG.playerMoveSpeed; hasInput = true; }

    // Touch / persistent target (used for swipe nudges + drag)
    if (!hasInput && p.hasTarget) {
        const dx = p.targetX - p.x;
        if (Math.abs(dx) < 0.05) {
            p.hasTarget = false;
        } else {
            const k = 14;
            targetVx = clamp(dx * k, -CONFIG.playerMoveSpeed, CONFIG.playerMoveSpeed);
            hasInput = true;
        }
    }

    // Exponential approach when there's input, hard brake otherwise
    if (hasInput) {
        p.vx += (targetVx - p.vx) * Math.min(1, CONFIG.playerAccel * dt);
    } else {
        p.vx -= p.vx * Math.min(1, CONFIG.playerBrake * dt);
        if (Math.abs(p.vx) < 0.03) p.vx = 0;
    }

    // Hard clamp
    if (p.vx >  CONFIG.playerMoveSpeed) p.vx =  CONFIG.playerMoveSpeed;
    if (p.vx < -CONFIG.playerMoveSpeed) p.vx = -CONFIG.playerMoveSpeed;

    p.x += p.vx * dt;

    // Boundaries
    if (p.x < -limit) { p.x = -limit; p.vx = 0; if (p.hasTarget) p.targetX = -limit; }
    if (p.x >  limit) { p.x =  limit; p.vx = 0; if (p.hasTarget) p.targetX =  limit; }

    // ---- Vertical (jump) physics ----
    if (!p.grounded) {
        p.vy -= CONFIG.gravity * dt;
        p.y += p.vy * dt;

        if (p.y <= 0) {
            // Landing
            p.y = 0;
            p.vy = 0;
            p.grounded = true;
            p.landSquash = 0.18;

            spawnParticles(p.x, 0.05, 0, '#ffffff', 6,
                { spread: 2, up: 1.4, life: 0.35, size: 0.08, gravity: 12 });
        }
    }

    if (p.landSquash > 0) {
        p.landSquash = Math.max(0, p.landSquash - dt);
    }

    // Roll (visual)
    const rollForward = (state.speed * dt) / CONFIG.ballRadius;
    const rollSide    = (p.vx * dt) / CONFIG.ballRadius;
    p.roll += rollForward * 0.35 + rollSide * 0.65;
}

/* ------------------------------------------------------------
   24. RENDER
   ------------------------------------------------------------ */
function render() {
    ctx.save();

    if (state.shakeTimer > 0 && state.mode === MODE.PLAYING) {
        const t = state.shakeTimer / 0.42;
        const mag = 12 * t;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    ctx.fillStyle = '#e9edf5';
    ctx.fillRect(-24, -24, W + 48, H + 48);

    drawSky();
    drawSkyline();
    drawGround();
    drawRoad();
    drawSideWalls();
    drawObstacles();
    drawCollectibles();
    drawParticles();
    drawPlayer();

    if (state.mode === MODE.PLAYING) {
        const spd = (state.speed - CONFIG.baseSpeed) / (CONFIG.maxSpeed - CONFIG.baseSpeed);
        if (spd > 0.35) drawSpeedLines(spd);
    }

    ctx.restore();
}

function drawSpeedLines(intensity) {
    const count = Math.floor(5 + intensity * 12);
    const t = performance.now() * 0.001;
    ctx.save();
    ctx.globalAlpha = 0.06 + intensity * 0.12;
    ctx.strokeStyle = themeColors.speedLine;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < count; i++) {
        const seed = i * 71 + 13;
        const x = (seed * 13.7) % W;
        const y0 = horizonY + ((seed * 3.3) % (H - horizonY)) * 0.5;
        const len = 26 + ((seed * 5.5) % 70);
        const yy = y0 + ((t * 420 + seed * 50) % (H - y0));
        if (yy > H) continue;
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.lineTo(x, yy + len);
        ctx.stroke();
    }
    ctx.restore();
}

/* ------------------------------------------------------------
   25. BOOT
   ------------------------------------------------------------ */
function boot() {
    applyTheme(loadTheme());
    resizeCanvas();
    buildSkyline();

    Sound.muted = loadMuted();
    updateSoundButtonUI();

    refreshCharacterUI();
    updateHeartsUI(false);
    updateScoreUI();
    updateMultiplierUI();

    state.mode = MODE.START;
    hudEl.setAttribute('aria-hidden', 'true');
    showScreen(startScreenEl);

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

    lastTime = performance.now();
    requestAnimationFrame(frame);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}