const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const SCREEN_W = window.innerWidth;
const SCREEN_H = window.innerHeight;
canvas.width = SCREEN_W;
canvas.height = SCREEN_H;

const camera = { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H };

const DAY_DURATION_MS = 120000; // 2 minutes per full cycle
let worldTime = 0.25; // Start at noon

// Fridge storage (shared between houses)
const fridgeStorage = [];
const fridgeMessage = { text: '', timer: 0 };

// Fish index — shared catch log across both players
const fishIndex = {};
let showFishIndex = false;

// Sleep state
const sleepState = { active: false, phase: 'none', alpha: 0 };
const sleepReady = { p1: false, p2: false }; // each player must get in bed

// Shop state
const shopState = { open: false, player: null, cursor: 0 };

// Bait shop state
const baitShopState = { open: false, player: null, cursor: 1 };

// Net shop state
const netShopState = { open: false, player: null, cursor: 0 };

// Give gold state — player-to-player money transfer
const giveGoldState = { open: false, giver: null, receiver: null, cursor: 0 };
const GIVE_AMOUNTS = [10, 50, 100, 500, 'All'];

// ── Game state ──────────────────────────────────────────────────────────
let gameState = 'start'; // 'start' | 'playing'
let startScreenTime = 0;

// Pre-generate star field for start screen
const START_STARS = [];
for (let i = 0; i < 90; i++) {
  START_STARS.push({
    x: Math.random() * SCREEN_W,
    y: Math.random() * 260,
    r: Math.random() * 1.5 + 0.4,
    phase: Math.random() * Math.PI * 2,
  });
}

// ── Achievements ────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  // Fishing
  { id: 'first_cast',  name: 'First Cast',       desc: 'Catch your first fish',             tag: 'F', check: p => p.fishCaught >= 1,                                    prog: p => `${Math.min(p.fishCaught,1)}/1`            },
  { id: 'fisherman',   name: 'Fisherman',          desc: 'Catch 10 fish',                     tag: 'F', check: p => p.fishCaught >= 10,                                   prog: p => `${Math.min(p.fishCaught,10)}/10`          },
  { id: 'angler',      name: 'Master Angler',      desc: 'Catch 50 fish',                     tag: 'F', check: p => p.fishCaught >= 50,                                   prog: p => `${Math.min(p.fishCaught,50)}/50`          },
  { id: 'night_owl',   name: 'Night Owl',          desc: 'Catch 5 fish at night',             tag: 'N', check: p => p.nightCaught >= 5,                                   prog: p => `${Math.min(p.nightCaught,5)}/5`           },
  { id: 'rare_find',   name: 'Rare Find',          desc: 'Catch a rare bait fish',            tag: '*', check: p => p.rareCaught >= 1,                                    prog: p => `${Math.min(p.rareCaught,1)}/1`            },
  { id: 'legendary',   name: 'Legend',             desc: 'Catch the Legendary Koi',           tag: '!', check: p => p.legendaryKoi,                                       prog: p => p.legendaryKoi ? '1/1' : '0/1'             },
  { id: 'treasure',    name: 'Treasure Hunter',    desc: 'Fish up a Treasure Chest',          tag: 'T', check: () => (fishIndex['Treasure Chest']||0) >= 1,               prog: () => `${Math.min(fishIndex['Treasure Chest']||0,1)}/1` },
  { id: 'boot_camp',   name: 'Boot Camp',          desc: 'Catch 3 Old Boots',                 tag: 'B', check: p => p.bootsCaught >= 3,                                   prog: p => `${Math.min(p.bootsCaught,3)}/3`           },
  // Crustaceans
  { id: 'net_rookie',  name: 'Net Rookie',         desc: 'Catch your first crustacean',       tag: 'C', check: p => p.crustaceansCaught >= 1,                             prog: p => `${Math.min(p.crustaceansCaught,1)}/1`     },
  { id: 'shell_king',  name: 'Shell King',         desc: 'Catch 10 crustaceans',              tag: 'C', check: p => p.crustaceansCaught >= 10,                            prog: p => `${Math.min(p.crustaceansCaught,10)}/10`   },
  { id: 'king_crab',   name: 'King of the Sea',    desc: 'Catch a King Crab',                 tag: 'K', check: () => (fishIndex['King Crab']||0) >= 1,                    prog: () => `${Math.min(fishIndex['King Crab']||0,1)}/1` },
  { id: 'deep_one',    name: 'Deep One',           desc: 'Catch a Giant Squid',               tag: '!', check: () => (fishIndex['Giant Squid']||0) >= 1,                  prog: () => `${Math.min(fishIndex['Giant Squid']||0,1)}/1` },
  // Food
  { id: 'chef',        name: 'Chef',               desc: 'Cook 10 meals at the furnace',      tag: '~', check: p => p.cooked >= 10,                                       prog: p => `${Math.min(p.cooked,10)}/10`              },
  { id: 'gourmet',     name: 'Gourmet',            desc: 'Eat 20 cooked meals',               tag: '~', check: p => p.eaten >= 20,                                        prog: p => `${Math.min(p.eaten,20)}/20`               },
  // Economy
  { id: 'gold_rush',   name: 'Gold Rush',          desc: 'Earn 500g from NPC trades',         tag: '$', check: p => p.goldEarned >= 500,                                  prog: p => `${Math.min(p.goldEarned,500)}/500g`       },
  { id: 'tycoon',      name: 'Tycoon',             desc: 'Earn 2000g from NPC trades',        tag: '$', check: p => p.goldEarned >= 2000,                                 prog: p => `${Math.min(p.goldEarned,2000)}/2000g`     },
  { id: 'trader',      name: 'Trader',             desc: 'Complete 10 NPC trades',            tag: 't', check: p => p.npcTrades >= 10,                                    prog: p => `${Math.min(p.npcTrades,10)}/10`           },
  // Equipment
  { id: 'golden_rod',  name: 'Golden Fisher',      desc: 'Own the Golden Rod',                tag: 'G', check: () => Player1.rodTier >= 4 || Player2.rodTier >= 4,        prog: () => (Player1.rodTier >= 4 || Player2.rodTier >= 4) ? 'done!' : `rod ${Math.max(Player1.rodTier,Player2.rodTier)+1}/5` },
  { id: 'deep_trap',   name: 'Deep Trapper',       desc: 'Own the Deep Trap net',             tag: 'D', check: () => Player1.netTier >= 3 || Player2.netTier >= 3,        prog: () => (Player1.netTier >= 3 || Player2.netTier >= 3) ? 'done!' : `net ${Math.max(Player1.netTier,Player2.netTier)+1}/4` },
  // Discovery
  { id: 'collector',   name: 'Collector',          desc: 'Discover 15 different species',     tag: '?', check: () => Object.keys(fishIndex).length >= 15,                 prog: () => `${Object.keys(fishIndex).length}/15`     },
  // Sleep
  { id: 'early_riser', name: 'Early Riser',        desc: 'Sleep through the night 3 times',   tag: 'z', check: p => p.sleeps >= 3,                                        prog: p => `${Math.min(p.sleeps,3)}/3`                },
];

const unlockedAchievements = new Set();
let achieveNotify = null; // { name, desc, timer }
let showAchievements = false;
let showLeaderboard = false;

// ── Achievement helpers ─────────────────────────────────────────────────
function checkAchievements() {
  for (const ach of ACHIEVEMENTS) {
    if (unlockedAchievements.has(ach.id)) continue;
    if (ach.check(achieveProgress)) {
      unlockedAchievements.add(ach.id);
      achieveNotify = { name: ach.name, desc: ach.desc, timer: 4500 };
    }
  }
}

function drawAchievementNotify() {
  if (!achieveNotify) return;
  const t = achieveNotify.timer / 4500; // 1→0
  const alpha = t > 0.9 ? (1 - t) / 0.1 : t < 0.15 ? t / 0.15 : 1;
  ctx.globalAlpha = alpha;

  const panelW = 300;
  const panelH = 50;
  const px = (SCREEN_W - panelW) / 2;
  const py = 10;

  ctx.fillStyle = 'rgba(10,10,20,0.95)';
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = '#f0c860';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, panelW, panelH);

  ctx.fillStyle = '#f0c860';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Achievement Unlocked!', px + panelW / 2, py + 16);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(achieveNotify.name, px + panelW / 2, py + 31);
  ctx.fillStyle = '#aaa';
  ctx.font = '9px monospace';
  ctx.fillText(achieveNotify.desc, px + panelW / 2, py + 44);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function drawAchievements() {
  if (!showAchievements) return;

  const panelW = 610;
  const panelH = 400;
  const px = (SCREEN_W - panelW) / 2;
  const py = (SCREEN_H - panelH) / 2;
  const colW = panelW / 2;
  const lineH = 34;
  const headerH = 38;
  const half = Math.ceil(ACHIEVEMENTS.length / 2);

  ctx.fillStyle = 'rgba(5,5,15,0.96)';
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = '#f0c860';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, panelW, panelH);

  // Column divider
  ctx.strokeStyle = '#2a2a3a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + colW, py + headerH);
  ctx.lineTo(px + colW, py + panelH - 18);
  ctx.stroke();

  // Title
  const unlockCount = unlockedAchievements.size;
  ctx.fillStyle = '#f0c860';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`Achievements  (${unlockCount} / ${ACHIEVEMENTS.length})`, px + panelW / 2, py + 24);
  ctx.fillStyle = '#555';
  ctx.font = '9px monospace';
  ctx.fillText('P to close', px + panelW / 2, py + 36);

  for (let i = 0; i < ACHIEVEMENTS.length; i++) {
    const ach = ACHIEVEMENTS[i];
    const col = i < half ? 0 : 1;
    const row = i < half ? i : i - half;
    const ax = px + col * colW + 10;
    const ay = py + headerH + row * lineH;
    const unlocked = unlockedAchievements.has(ach.id);

    // Check box
    ctx.fillStyle = unlocked ? '#3a6a3a' : '#1a1a2a';
    ctx.fillRect(ax, ay + 4, 22, 22);
    ctx.strokeStyle = unlocked ? '#4c4' : '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(ax, ay + 4, 22, 22);
    ctx.fillStyle = unlocked ? '#4c4' : '#555';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(unlocked ? '+' : ' ', ax + 11, ay + 19);
    ctx.textAlign = 'left';

    // Tag badge
    ctx.fillStyle = unlocked ? '#2a4a2a' : '#1a1a2a';
    ctx.fillRect(ax + 26, ay + 5, 16, 12);
    ctx.fillStyle = unlocked ? '#80c870' : '#444';
    ctx.font = '8px monospace';
    ctx.fillText(ach.tag, ax + 28, ay + 14);

    // Name
    ctx.fillStyle = unlocked ? '#fff' : '#555';
    ctx.font = (unlocked ? 'bold ' : '') + '11px monospace';
    ctx.fillText(ach.name, ax + 46, ay + 15);

    // Desc + progress
    const prog = ach.prog(achieveProgress);
    ctx.fillStyle = unlocked ? '#888' : '#3a3a4a';
    ctx.font = '9px monospace';
    ctx.fillText(`${ach.desc}  [${prog}]`, ax + 46, ay + 27);
  }

  ctx.fillStyle = '#444';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Progress tracks both players combined', px + panelW / 2, py + panelH - 6);
  ctx.textAlign = 'left';
}

// ── Start screen ────────────────────────────────────────────────────────
function drawCharPreview(x, y, colors, s) {
  s = s || 1;
  ctx.fillStyle = colors.body;
  ctx.fillRect(x + 4*s, y + 6*s, 16*s, 14*s);
  ctx.fillStyle = colors.head;
  ctx.fillRect(x + 6*s, y,       12*s, 10*s);
  ctx.fillStyle = colors.hair;
  ctx.fillRect(x + 5*s, y - s,   14*s, 5*s);
  ctx.fillStyle = '#222';
  ctx.fillRect(x + 8*s,  y + 4*s, 2*s, 2*s);
  ctx.fillRect(x + 14*s, y + 4*s, 2*s, 2*s);
  ctx.fillStyle = colors.legs;
  ctx.fillRect(x + 6*s,  y + 20*s, 5*s, 4*s);
  ctx.fillRect(x + 13*s, y + 20*s, 5*s, 4*s);
}

function drawStartScreen(dt) {
  startScreenTime += dt;
  const t = startScreenTime / 1000;

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, SCREEN_H * 0.65);
  skyGrad.addColorStop(0, '#050815');
  skyGrad.addColorStop(0.7, '#0d1e3a');
  skyGrad.addColorStop(1, '#1a3060');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H * 0.65);

  // Water
  const waterY = Math.floor(SCREEN_H * 0.63);
  const waterGrad = ctx.createLinearGradient(0, waterY, 0, SCREEN_H);
  waterGrad.addColorStop(0, '#0d2e50');
  waterGrad.addColorStop(1, '#051828');
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, waterY, SCREEN_W, SCREEN_H - waterY);

  // Stars
  for (const star of START_STARS) {
    const bri = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.4 + star.phase));
    ctx.fillStyle = `rgba(255,255,255,${bri.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Moon
  ctx.fillStyle = '#f0e8c0';
  ctx.beginPath();
  ctx.arc(560, 55, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0d1e3a';
  ctx.beginPath();
  ctx.arc(570, 52, 20, 0, Math.PI * 2);
  ctx.fill();

  // Moon reflection strip
  const mReflW = 50 + Math.sin(t * 0.9) * 12;
  ctx.fillStyle = 'rgba(240,232,192,0.07)';
  ctx.fillRect(SCREEN_W / 2 - mReflW / 2, waterY + 5, mReflW, SCREEN_H - waterY - 5);

  // Animated waves
  for (let w = 0; w < 4; w++) {
    ctx.strokeStyle = `rgba(80,160,255,${0.12 + w * 0.04})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= SCREEN_W; x += 3) {
      const wy = waterY + w * 18 + Math.sin(x / 55 + t * 0.9 + w * 0.8) * 5;
      if (x === 0) ctx.moveTo(x, wy); else ctx.lineTo(x, wy);
    }
    ctx.stroke();
  }

  // ── Title ──
  ctx.textAlign = 'center';
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.font = 'bold 42px monospace';
  ctx.fillText('FISHING  COVE', SCREEN_W / 2 + 3, 85);
  // Main
  ctx.fillStyle = '#f0c860';
  ctx.fillText('FISHING  COVE', SCREEN_W / 2, 83);
  // Subtitle
  ctx.fillStyle = '#80bcd8';
  ctx.font = '13px monospace';
  ctx.fillText('A 2-Player Fishing Adventure', SCREEN_W / 2, 108);

  // ── Separator ──
  ctx.strokeStyle = '#2a3a5a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px => 60, 118); ctx.moveTo(60, 118);
  ctx.lineTo(SCREEN_W - 60, 118);
  ctx.stroke();

  // ── Player 1 preview ──
  const p1cx = SCREEN_W / 2 - 200, charY = 165;
  drawCharPreview(p1cx - 24, charY, Player1.colors, 2);
  // Rod line
  ctx.strokeStyle = FISHING_RODS[0].color;
  ctx.lineWidth = 1.5;
  const rod1EndX = p1cx + 65 + Math.sin(t * 1.8) * 6;
  const rod1EndY = charY + 75 + Math.sin(t * 1.8) * 4;
  ctx.beginPath();
  ctx.moveTo(p1cx + 18, charY + 10);
  ctx.lineTo(rod1EndX, rod1EndY);
  ctx.stroke();
  ctx.fillStyle = '#e04040';
  ctx.beginPath();
  ctx.arc(rod1EndX, rod1EndY + Math.sin(t * 2.5) * 4, 3, 0, Math.PI * 2);
  ctx.fill();
  // Labels
  ctx.fillStyle = '#e8c170';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PLAYER 1', p1cx, charY - 12);
  ctx.fillStyle = '#aaa';
  ctx.font = '10px monospace';
  ctx.fillText('WASD + F:Fish + G:Net', p1cx, charY + 64);
  ctx.fillStyle = '#777';
  ctx.font = '9px monospace';
  ctx.fillText('E:Eat  Q:Bait  Tab:Index', p1cx, charY + 76);

  // ── Player 2 preview ──
  const p2cx = SCREEN_W / 2 + 200, p2charY = 165;
  drawCharPreview(p2cx - 24, p2charY, Player2.colors, 2);
  ctx.strokeStyle = FISHING_RODS[0].color;
  ctx.lineWidth = 1.5;
  const rod2EndX = p2cx - 65 + Math.sin(t * 2.1) * 6;
  const rod2EndY = p2charY + 75 + Math.sin(t * 2.1) * 4;
  ctx.beginPath();
  ctx.moveTo(p2cx + 6, p2charY + 10);
  ctx.lineTo(rod2EndX, rod2EndY);
  ctx.stroke();
  ctx.fillStyle = '#e04040';
  ctx.beginPath();
  ctx.arc(rod2EndX, rod2EndY + Math.sin(t * 2.2) * 4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#70b8e0';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PLAYER 2', p2cx, p2charY - 12);
  ctx.fillStyle = '#aaa';
  ctx.font = '10px monospace';
  ctx.fillText('Arrows + /:Fish + M:Net', p2cx, p2charY + 64);
  ctx.fillStyle = '#777';
  ctx.font = '9px monospace';
  ctx.fillText('.:Eat  ,:Bait  Tab:Index', p2cx, p2charY + 76);

  // ── Feature blurb ──
  ctx.fillStyle = '#607080';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Explore a 3x3 world  ~  Trade with NPCs  ~  Buy rods, bait & nets', SCREEN_W / 2, 298);
  ctx.fillText('Cook your catch  ~  Sleep through the night  ~  Unlock achievements', SCREEN_W / 2, 312);

  // ── Press any key (blinking) ──
  const blink = (Math.sin(t * 3) + 1) / 2;
  ctx.fillStyle = `rgba(255,255,255,${0.4 + blink * 0.6})`;
  ctx.font = 'bold 16px monospace';
  ctx.fillText('~ Press Any Key to Start ~', SCREEN_W / 2, 374);

  // ── Bottom hints ──
  ctx.fillStyle = '#384050';
  ctx.font = '9px monospace';
  ctx.fillText('[Tab] Species Index     [L] Leaderboard     [P] Achievements     [B] Music', SCREEN_W / 2, 460);

  ctx.textAlign = 'left';
}

function getTimeOfDay() {
  if (worldTime < 0.125)  return 'Dawn';
  if (worldTime < 0.375)  return 'Day';
  if (worldTime < 0.625)  return 'Dusk';
  return 'Night';
}

function updateCamera() {
  const midX = (Player1.x + Player1.w / 2 + Player2.x + Player2.w / 2) / 2;
  const midY = (Player1.y + Player1.h / 2 + Player2.y + Player2.h / 2) / 2;

  camera.x = midX - SCREEN_W / 2;
  camera.y = midY - SCREEN_H / 2;

  camera.x = Math.max(0, Math.min(camera.x, GameMap.widthPx - SCREEN_W));
  camera.y = Math.max(0, Math.min(camera.y, GameMap.heightPx - SCREEN_H));
}

function updateSleep(dt) {
  if (!sleepState.active) return;

  if (sleepState.phase === 'fadeOut') {
    sleepState.alpha += dt / 1000; // 1 second fade out
    if (sleepState.alpha >= 1) {
      sleepState.alpha = 1;
      sleepState.phase = 'sleeping';
      // Advance time to dawn
      worldTime = 0.125;
    }
  } else if (sleepState.phase === 'sleeping') {
    achieveProgress.sleeps++;
    sleepState.phase = 'fadeIn';
  } else if (sleepState.phase === 'fadeIn') {
    sleepState.alpha -= dt / 1000; // 1 second fade in
    if (sleepState.alpha <= 0) {
      sleepState.alpha = 0;
      sleepState.phase = 'none';
      sleepState.active = false;
    }
  }
}

function drawSleepOverlay() {
  if (!sleepState.active) return;

  ctx.fillStyle = `rgba(0, 0, 0, ${sleepState.alpha})`;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  if (sleepState.alpha > 0.5) {
    ctx.fillStyle = `rgba(255, 255, 255, ${(sleepState.alpha - 0.5) * 2})`;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Zzz...', SCREEN_W / 2, SCREEN_H / 2);
    ctx.textAlign = 'left';
  }
}

function drawDayNight() {
  // Darkness: cosine curve, 0 at noon (0.25), max at midnight (0.75)
  const darkness = 0.65 * (0.5 - 0.5 * Math.cos((worldTime - 0.25) * Math.PI * 2));

  // Night overlay
  if (darkness > 0.01) {
    ctx.fillStyle = `rgba(10, 10, 40, ${darkness})`;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }

  // Warm tint at dawn (near 0) and dusk (near 0.5)
  const dawnDist = Math.min(Math.abs(worldTime), Math.abs(worldTime - 1));
  const duskDist = Math.abs(worldTime - 0.5);
  const warmth = Math.max(
    Math.max(0, 1 - dawnDist / 0.1) * 0.15,
    Math.max(0, 1 - duskDist / 0.1) * 0.15
  );
  if (warmth > 0.01) {
    ctx.fillStyle = `rgba(255, 140, 50, ${warmth})`;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }
}

function invSummary(inv) {
  const raw = inv.filter(f => !f.type && !f.cooked && f.name !== 'Old Boot' && f.name !== 'Treasure Chest').length;
  const cooked = inv.filter(f => f.cooked).length;
  const treasure = inv.filter(f => f.type === 'treasure' || f.name === 'Treasure Chest').length;
  const junk = inv.filter(f => f.name === 'Old Boot').length;
  const parts = [];
  if (cooked) parts.push(`${cooked}ckd`);
  if (raw) parts.push(`${raw}raw`);
  if (treasure) parts.push(`${treasure}loot`);
  if (junk) parts.push(`${junk}junk`);
  return parts.length ? parts.join(' ') : '0';
}

function recordCatch(name, player) {
  fishIndex[name] = (fishIndex[name] || 0) + 1;
  const isCrust = CRUSTACEAN_TYPES.some(c => c.name === name);
  const isRare  = RARE_FISH.some(r => r.name === name);
  if (isCrust) {
    achieveProgress.crustaceansCaught++;
    if (player) player.stats.crustaceansCaught++;
  } else if (name === 'Old Boot') {
    achieveProgress.bootsCaught++;
  } else if (name !== 'Treasure Chest') {
    achieveProgress.fishCaught++;
    if (player) player.stats.fishCaught++;
    if (isRare) {
      achieveProgress.rareCaught++;
      if (name === 'Legendary Koi') achieveProgress.legendaryKoi = true;
    }
  }
}

function drawFishIndex() {
  if (!showFishIndex) return;

  // Combine normal + rare fish + crustaceans for the index
  const allEntries = [];
  for (const f of FISH_TYPES) {
    allEntries.push({ name: f.name, weight: f.weight, rare: false });
  }
  for (const f of RARE_FISH) {
    allEntries.push({ name: f.name, weight: f.weight, rare: true, bait: f.bait });
  }
  allEntries.push({ divider: true, label: '~~ Crustaceans ~~' });
  for (const c of CRUSTACEAN_TYPES) {
    allEntries.push({ name: c.name, weight: c.weight, crustacean: true });
  }

  const panelW = 260;
  const lineH = 18;
  const headerH = 28;
  const panelH = headerH + allEntries.length * lineH + 12;
  const px = (SCREEN_W - panelW) / 2;
  const py = (SCREEN_H - panelH) / 2;

  // Panel background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, panelW, panelH);

  // Title
  ctx.fillStyle = '#f0c860';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Fish Index [Tab]', px + panelW / 2, py + 20);
  ctx.textAlign = 'left';

  // Entries
  for (let i = 0; i < allEntries.length; i++) {
    const entry = allEntries[i];
    const y = py + headerH + i * lineH + 14;

    // Divider row
    if (entry.divider) {
      ctx.fillStyle = '#4a8a6a';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(entry.label, px + panelW / 2, y);
      ctx.textAlign = 'left';
      continue;
    }

    const count = fishIndex[entry.name] || 0;
    const caught = count > 0;

    // Name (or ??? if never caught)
    ctx.font = '12px monospace';
    if (caught) {
      ctx.fillStyle = entry.crustacean ? '#80d0a0' : (entry.rare ? '#c8a0ff' : '#fff');
      ctx.fillText(entry.name, px + 14, y);
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'right';
      ctx.fillText(`x${count}`, px + panelW - 14, y);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = entry.crustacean ? '#2a4a38' : (entry.rare ? '#403060' : '#555');
      ctx.fillText(entry.crustacean ? '???' : (entry.rare ? '??? (bait)' : '???'), px + 14, y);
    }

    // Rarity dot
    let dot = '#4c4';
    if (entry.crustacean) dot = '#80d0a0';
    else if (entry.rare) dot = '#c8a0ff';
    else if (entry.weight <= 5) dot = '#e44';
    else if (entry.weight <= 15) dot = '#e0e040';
    ctx.fillStyle = caught ? dot : '#333';
    ctx.beginPath();
    ctx.arc(px + panelW - 30, y - 4, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Total (exclude divider entries from count)
  const catchableEntries = allEntries.filter(e => !e.divider);
  const total = Object.values(fishIndex).reduce((a, b) => a + b, 0);
  const discovered = Object.keys(fishIndex).length;
  ctx.fillStyle = '#888';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${discovered}/${catchableEntries.length} discovered  |  ${total} total caught`, px + panelW / 2, py + panelH - 6);
  ctx.textAlign = 'left';
}

function updateShop() {
  if (!shopState.open) return;
  const p = shopState.player;

  // Navigate with both player control schemes
  if (Input.justPressed('KeyW') || Input.justPressed('ArrowUp')) {
    shopState.cursor = Math.max(0, shopState.cursor - 1);
  }
  if (Input.justPressed('KeyS') || Input.justPressed('ArrowDown')) {
    shopState.cursor = Math.min(FISHING_RODS.length - 1, shopState.cursor + 1);
  }

  // Buy with action key
  if (Input.justPressed(p.actionKey)) {
    const rod = FISHING_RODS[shopState.cursor];
    if (shopState.cursor <= p.rodTier) {
      fridgeMessage.text = shopState.cursor === p.rodTier ? 'Already equipped!' : 'Already own a better rod!';
      fridgeMessage.timer = 1500;
    } else if (p.gold < rod.cost) {
      fridgeMessage.text = `Need ${rod.cost}g! (have ${p.gold}g)`;
      fridgeMessage.timer = 1500;
    } else {
      p.gold -= rod.cost;
      p.rodTier = shopState.cursor;
      fridgeMessage.text = `Bought ${rod.name}!`;
      fridgeMessage.timer = 2500;
    }
  }

  // Close with eat key or Escape
  if (Input.justPressed(p.eatKey) || Input.justPressed('Escape')) {
    shopState.open = false;
    shopState.player = null;
  }
}

function drawShop() {
  if (!shopState.open) return;
  const p = shopState.player;

  const panelW = 300;
  const lineH = 28;
  const headerH = 32;
  const footerH = 24;
  const panelH = headerH + FISHING_RODS.length * lineH + footerH;
  const px = (SCREEN_W - panelW) / 2;
  const py = (SCREEN_H - panelH) / 2;

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = '#c09050';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, panelW, panelH);

  // Title
  ctx.fillStyle = '#f0c860';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Rod Shop', px + panelW / 2, py + 22);
  ctx.textAlign = 'left';

  // Rod list
  for (let i = 0; i < FISHING_RODS.length; i++) {
    const rod = FISHING_RODS[i];
    const y = py + headerH + i * lineH;
    const selected = i === shopState.cursor;
    const owned = i <= p.rodTier;
    const equipped = i === p.rodTier;
    const canAfford = p.gold >= rod.cost;

    // Selection highlight
    if (selected) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(px + 4, y + 2, panelW - 8, lineH - 4);
      // Cursor arrow
      ctx.fillStyle = '#f0c860';
      ctx.font = '12px monospace';
      ctx.fillText('>', px + 8, y + 18);
    }

    // Rod color swatch
    ctx.fillStyle = rod.color;
    ctx.fillRect(px + 22, y + 8, 14, 10);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 22, y + 8, 14, 10);

    // Rod name
    ctx.fillStyle = owned ? '#aaa' : (canAfford ? '#fff' : '#666');
    ctx.font = '12px monospace';
    ctx.fillText(rod.name, px + 42, y + 18);

    // Speed label
    const speedPct = Math.round((1 - rod.speedMult) * 100);
    ctx.fillStyle = '#888';
    ctx.font = '9px monospace';
    ctx.fillText(speedPct > 0 ? `${speedPct}% faster` : 'base speed', px + 150, y + 17);

    // Price / status
    ctx.textAlign = 'right';
    if (equipped) {
      ctx.fillStyle = '#4c4';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('EQUIPPED', px + panelW - 12, y + 18);
    } else if (owned) {
      ctx.fillStyle = '#888';
      ctx.font = '11px monospace';
      ctx.fillText('OWNED', px + panelW - 12, y + 18);
    } else {
      ctx.fillStyle = canAfford ? '#ffd700' : '#664400';
      ctx.font = '11px monospace';
      ctx.fillText(`${rod.cost}g`, px + panelW - 12, y + 18);
    }
    ctx.textAlign = 'left';
  }

  // Footer
  ctx.fillStyle = '#888';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  const footY = py + panelH - 8;
  ctx.fillText(`Your gold: ${p.gold}g  |  W/S or Up/Down: browse  |  Action: buy  |  Eat/Esc: close`, px + panelW / 2, footY);
  ctx.textAlign = 'left';
}

function updateBaitShop() {
  if (!baitShopState.open) return;
  const p = baitShopState.player;

  // Navigate (skip index 0 = "No Bait" which isn't purchasable)
  if (Input.justPressed('KeyW') || Input.justPressed('ArrowUp')) {
    baitShopState.cursor = Math.max(1, baitShopState.cursor - 1);
  }
  if (Input.justPressed('KeyS') || Input.justPressed('ArrowDown')) {
    baitShopState.cursor = Math.min(BAIT_TYPES.length - 1, baitShopState.cursor + 1);
  }

  // Buy with action key
  if (Input.justPressed(p.actionKey)) {
    const bait = BAIT_TYPES[baitShopState.cursor];
    if (p.gold < bait.cost) {
      fridgeMessage.text = `Need ${bait.cost}g! (have ${p.gold}g)`;
      fridgeMessage.timer = 1500;
    } else {
      p.gold -= bait.cost;
      p.baitCounts[baitShopState.cursor] += bait.amount;
      p.baitType = baitShopState.cursor;
      fridgeMessage.text = `Bought ${bait.amount}x ${bait.name}! (${p.baitCounts[baitShopState.cursor]} total)`;
      fridgeMessage.timer = 2500;
    }
  }

  // Select bait with eat key (cycle through owned bait)
  if (Input.justPressed('KeyQ') || Input.justPressed('Comma')) {
    // Cycle to next bait type that has stock (or no bait)
    let next = (p.baitType + 1) % BAIT_TYPES.length;
    while (next !== 0 && p.baitCounts[next] <= 0) {
      next = (next + 1) % BAIT_TYPES.length;
    }
    p.baitType = next;
    const name = BAIT_TYPES[p.baitType].name;
    const count = p.baitType > 0 ? ` (${p.baitCounts[p.baitType]} left)` : '';
    fridgeMessage.text = `Equipped: ${name}${count}`;
    fridgeMessage.timer = 1500;
  }

  // Close with eat key or Escape
  if (Input.justPressed(p.eatKey) || Input.justPressed('Escape')) {
    baitShopState.open = false;
    baitShopState.player = null;
  }
}

function drawBaitShop() {
  if (!baitShopState.open) return;
  const p = baitShopState.player;

  const items = BAIT_TYPES.slice(1); // skip "No Bait"
  const panelW = 320;
  const lineH = 28;
  const headerH = 32;
  const footerH = 36;
  const panelH = headerH + items.length * lineH + footerH;
  const px = (SCREEN_W - panelW) / 2;
  const py = (SCREEN_H - panelH) / 2;

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = '#6a9a5a';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, panelW, panelH);

  // Title
  ctx.fillStyle = '#8fc870';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Bait Shop', px + panelW / 2, py + 22);
  ctx.textAlign = 'left';

  // Bait list
  for (let i = 0; i < items.length; i++) {
    const bait = items[i];
    const baitIdx = i + 1; // actual index in BAIT_TYPES
    const y = py + headerH + i * lineH;
    const selected = baitIdx === baitShopState.cursor;
    const owned = p.baitCounts[baitIdx] > 0;
    const equipped = p.baitType === baitIdx;
    const canAfford = p.gold >= bait.cost;

    // Selection highlight
    if (selected) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(px + 4, y + 2, panelW - 8, lineH - 4);
      ctx.fillStyle = '#8fc870';
      ctx.font = '12px monospace';
      ctx.fillText('>', px + 8, y + 18);
    }

    // Bait color swatch
    ctx.fillStyle = bait.color;
    ctx.beginPath();
    ctx.arc(px + 28, y + 14, 5, 0, Math.PI * 2);
    ctx.fill();

    // Bait name
    ctx.fillStyle = canAfford ? '#fff' : '#666';
    ctx.font = '12px monospace';
    ctx.fillText(bait.name, px + 42, y + 18);

    // Rare fish it unlocks
    const rareFish = RARE_FISH.find(rf => rf.bait === baitIdx);
    if (rareFish) {
      ctx.fillStyle = '#aaa';
      ctx.font = '9px monospace';
      ctx.fillText(`Catches: ${rareFish.name}`, px + 130, y + 17);
    }

    // Price + stock
    ctx.textAlign = 'right';
    if (equipped && owned) {
      ctx.fillStyle = '#4c4';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`ACTIVE x${p.baitCounts[baitIdx]}`, px + panelW - 12, y + 18);
    } else if (owned) {
      ctx.fillStyle = '#aaa';
      ctx.font = '10px monospace';
      ctx.fillText(`x${p.baitCounts[baitIdx]}`, px + panelW - 50, y + 18);
      ctx.fillStyle = canAfford ? '#ffd700' : '#664400';
      ctx.fillText(`${bait.cost}g/${bait.amount}`, px + panelW - 12, y + 18);
    } else {
      ctx.fillStyle = canAfford ? '#ffd700' : '#664400';
      ctx.font = '10px monospace';
      ctx.fillText(`${bait.cost}g / ${bait.amount}x`, px + panelW - 12, y + 18);
    }
    ctx.textAlign = 'left';
  }

  // Current bait display
  const curBait = BAIT_TYPES[p.baitType];
  ctx.fillStyle = '#888';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  const footY = py + panelH - 20;
  ctx.fillText(`Equipped: ${curBait.name}${p.baitType > 0 ? ' ('+p.baitCounts[p.baitType]+' left)' : ''}`, px + panelW / 2, footY);
  ctx.fillStyle = '#666';
  ctx.font = '9px monospace';
  ctx.fillText(`Gold: ${p.gold}g | Action:Buy | Q/,:Switch Bait | Eat/Esc:Close`, px + panelW / 2, footY + 12);
  ctx.textAlign = 'left';
}

function updateNetShop() {
  if (!netShopState.open) return;
  const p = netShopState.player;

  if (Input.justPressed('KeyW') || Input.justPressed('ArrowUp')) {
    netShopState.cursor = Math.max(0, netShopState.cursor - 1);
  }
  if (Input.justPressed('KeyS') || Input.justPressed('ArrowDown')) {
    netShopState.cursor = Math.min(NET_TYPES.length - 1, netShopState.cursor + 1);
  }

  if (Input.justPressed(p.actionKey)) {
    const net = NET_TYPES[netShopState.cursor];
    if (netShopState.cursor <= p.netTier) {
      fridgeMessage.text = netShopState.cursor === p.netTier ? 'Already equipped!' : 'Already own a better net!';
      fridgeMessage.timer = 1500;
    } else if (p.gold < net.cost) {
      fridgeMessage.text = `Need ${net.cost}g! (have ${p.gold}g)`;
      fridgeMessage.timer = 1500;
    } else {
      p.gold -= net.cost;
      p.netTier = netShopState.cursor;
      fridgeMessage.text = `Bought ${net.name}! Press G/M near water to net.`;
      fridgeMessage.timer = 3000;
    }
  }

  if (Input.justPressed(p.eatKey) || Input.justPressed('Escape')) {
    netShopState.open = false;
    netShopState.player = null;
  }
}

function drawNetShop() {
  if (!netShopState.open) return;
  const p = netShopState.player;

  const panelW = 320;
  const lineH = 28;
  const headerH = 32;
  const footerH = 24;
  const panelH = headerH + NET_TYPES.length * lineH + footerH;
  const px = (SCREEN_W - panelW) / 2;
  const py = (SCREEN_H - panelH) / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = '#4a9a6a';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, panelW, panelH);

  ctx.fillStyle = '#80d0a0';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Net Shop', px + panelW / 2, py + 22);
  ctx.textAlign = 'left';

  for (let i = 0; i < NET_TYPES.length; i++) {
    const net = NET_TYPES[i];
    const y = py + headerH + i * lineH;
    const selected = i === netShopState.cursor;
    const owned = i <= p.netTier;
    const equipped = i === p.netTier;
    const canAfford = p.gold >= net.cost;

    if (selected) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(px + 4, y + 2, panelW - 8, lineH - 4);
      ctx.fillStyle = '#80d0a0';
      ctx.font = '12px monospace';
      ctx.fillText('>', px + 8, y + 18);
    }

    ctx.fillStyle = net.color;
    ctx.fillRect(px + 22, y + 8, 14, 10);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 22, y + 8, 14, 10);

    ctx.fillStyle = owned ? '#aaa' : (canAfford ? '#fff' : '#666');
    ctx.font = '12px monospace';
    ctx.fillText(net.name, px + 42, y + 18);

    const speedPct = Math.round((1 - net.speedMult) * 100);
    ctx.fillStyle = '#888';
    ctx.font = '9px monospace';
    ctx.fillText(speedPct > 0 ? `${speedPct}% faster` : 'base speed', px + 160, y + 17);

    ctx.textAlign = 'right';
    if (equipped) {
      ctx.fillStyle = '#4c4';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('EQUIPPED', px + panelW - 12, y + 18);
    } else if (owned) {
      ctx.fillStyle = '#888';
      ctx.font = '11px monospace';
      ctx.fillText('OWNED', px + panelW - 12, y + 18);
    } else {
      ctx.fillStyle = canAfford ? '#ffd700' : '#664400';
      ctx.font = '11px monospace';
      ctx.fillText(`${net.cost}g`, px + panelW - 12, y + 18);
    }
    ctx.textAlign = 'left';
  }

  ctx.fillStyle = '#888';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`Gold: ${p.gold}g  |  W/S: browse  |  Action: buy  |  Eat/Esc: close`, px + panelW / 2, py + panelH - 8);
  ctx.textAlign = 'left';
}

// ── Rare fish mini-game overlay ─────────────────────────────────────────
function drawMiniGame() {
  const ACTION_KEY_LABELS = { 'KeyF': 'F', 'Slash': '/' };
  for (const player of [Player1, Player2]) {
    if (!player.fishing || player.fishing.state !== 'minigame') continue;
    const mg = player.fishing.miniGame;

    const panelW = 340;
    const panelH = 130;
    const px = (SCREEN_W - panelW) / 2;
    const py = SCREEN_H / 2 - 170;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(px, py, panelW, panelH);

    // Border — colour signals result
    if (mg.result === 'success')   ctx.strokeStyle = '#4fc44f';
    else if (mg.result === 'fail') ctx.strokeStyle = '#c44444';
    else                           ctx.strokeStyle = '#c8a0ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, panelW, panelH);

    ctx.textAlign = 'center';

    // Fish name banner
    ctx.fillStyle = '#c8a0ff';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('\u2605 RARE CATCH: ' + player.fishing.fish + ' \u2605', px + panelW / 2, py + 22);

    if (mg.result) {
      ctx.fillStyle = mg.result === 'success' ? '#4fc44f' : '#c44444';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(mg.result === 'success' ? 'CAUGHT!' : 'GOT AWAY!', px + panelW / 2, py + 82);
    } else {
      // Instruction
      ctx.fillStyle = '#aaa';
      ctx.font = '10px monospace';
      ctx.fillText('Press [Action] when the marker hits the green zone!', px + panelW / 2, py + 40);

      // Timing bar
      const barX = px + 20;
      const barY = py + 52;
      const barW = panelW - 40;
      const barH = 30;

      // Bar background
      ctx.fillStyle = '#111122';
      ctx.fillRect(barX, barY, barW, barH);

      // Green zone
      const zoneX     = barX + mg.zoneStart * barW;
      const zoneDrawW = (mg.zoneEnd - mg.zoneStart) * barW;
      ctx.fillStyle = '#1a4a1a';
      ctx.fillRect(zoneX, barY, zoneDrawW, barH);
      ctx.strokeStyle = '#4fc44f';
      ctx.lineWidth = 1;
      ctx.strokeRect(zoneX, barY, zoneDrawW, barH);

      // Moving marker
      const markerX = barX + mg.markerPos * barW;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(markerX - 3, barY - 3, 6, barH + 6);

      // Bar border
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);

      // Key hint
      const keyLabel = ACTION_KEY_LABELS[player.actionKey] || player.actionKey;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('[ ' + keyLabel + ' ]', px + panelW / 2, py + 112);
    }
    ctx.textAlign = 'left';
  }
}

// ── Give gold (player-to-player transfer) ───────────────────────────────
function playersAreClose() {
  const dx = (Player1.x + Player1.w / 2) - (Player2.x + Player2.w / 2);
  const dy = (Player1.y + Player1.h / 2) - (Player2.y + Player2.h / 2);
  return Math.sqrt(dx * dx + dy * dy) <= 60;
}

function updateGiveGold() {
  if (!giveGoldState.open) {
    if (!playersAreClose()) return;
    if (Input.justPressed('KeyT')) {
      giveGoldState.open = true;
      giveGoldState.giver = Player1;
      giveGoldState.receiver = Player2;
      giveGoldState.cursor = 0;
    } else if (Input.justPressed('KeyN')) {
      giveGoldState.open = true;
      giveGoldState.giver = Player2;
      giveGoldState.receiver = Player1;
      giveGoldState.cursor = 0;
    }
    return;
  }

  if (Input.justPressed('KeyW') || Input.justPressed('ArrowUp')) {
    giveGoldState.cursor = Math.max(0, giveGoldState.cursor - 1);
  }
  if (Input.justPressed('KeyS') || Input.justPressed('ArrowDown')) {
    giveGoldState.cursor = Math.min(GIVE_AMOUNTS.length - 1, giveGoldState.cursor + 1);
  }

  if (Input.justPressed(giveGoldState.giver.actionKey)) {
    const selected = GIVE_AMOUNTS[giveGoldState.cursor];
    const amount = selected === 'All' ? giveGoldState.giver.gold : Math.min(selected, giveGoldState.giver.gold);
    if (amount > 0) {
      giveGoldState.giver.gold -= amount;
      giveGoldState.receiver.gold += amount;
      const gn = giveGoldState.giver    === Player1 ? 'P1' : 'P2';
      const rn = giveGoldState.receiver === Player1 ? 'P1' : 'P2';
      fridgeMessage.text = `${gn} gave ${amount}g to ${rn}!`;
      fridgeMessage.timer = 2500;
    } else {
      fridgeMessage.text = 'No gold to give!';
      fridgeMessage.timer = 1500;
    }
    giveGoldState.open = false;
  }

  if (Input.justPressed('Escape') || Input.justPressed(giveGoldState.giver.eatKey)) {
    giveGoldState.open = false;
  }
}

function drawGiveGold() {
  if (!giveGoldState.open) return;
  const giver    = giveGoldState.giver;
  const receiver = giveGoldState.receiver;
  const giverName    = giver    === Player1 ? 'Player 1' : 'Player 2';
  const receiverName = receiver === Player1 ? 'Player 1' : 'Player 2';
  const giverColor    = giver    === Player1 ? '#e8c170' : '#70b8e0';
  const receiverColor = receiver === Player1 ? '#e8c170' : '#70b8e0';

  const panelW = 280;
  const lineH  = 30;
  const headerH = 58;
  const footerH = 26;
  const panelH = headerH + GIVE_AMOUNTS.length * lineH + footerH;
  const px = (SCREEN_W - panelW) / 2;
  const py = (SCREEN_H - panelH) / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.92)';
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, panelW, panelH);

  // Title
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Give Gold', px + panelW / 2, py + 22);

  // Transfer arrow
  const mid = px + panelW / 2;
  ctx.font = '11px monospace';
  ctx.fillStyle = giverColor;
  ctx.textAlign = 'right';
  ctx.fillText(giverName, mid - 16, py + 44);
  ctx.fillStyle = '#aaa';
  ctx.textAlign = 'center';
  ctx.fillText('→', mid, py + 44);
  ctx.fillStyle = receiverColor;
  ctx.textAlign = 'left';
  ctx.fillText(receiverName, mid + 16, py + 44);

  // Amount list
  for (let i = 0; i < GIVE_AMOUNTS.length; i++) {
    const amt      = GIVE_AMOUNTS[i];
    const y        = py + headerH + i * lineH;
    const selected = i === giveGoldState.cursor;
    const canAfford = amt === 'All' ? giver.gold > 0 : giver.gold >= amt;
    const label    = amt === 'All' ? `All  (${giver.gold}g)` : `${amt}g`;

    if (selected) {
      ctx.fillStyle = 'rgba(255,215,0,0.12)';
      ctx.fillRect(px + 4, y + 2, panelW - 8, lineH - 4);
      ctx.fillStyle = '#ffd700';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('▶', px + 10, y + 21);
    }

    ctx.fillStyle = canAfford ? (selected ? '#fff' : '#ccc') : '#444';
    ctx.font = (selected ? 'bold ' : '') + '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, px + panelW / 2, y + 21);
  }

  // Footer
  ctx.fillStyle = '#666';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('W/S ↑↓: pick  |  Action: give  |  Eat/Esc: cancel', px + panelW / 2, py + panelH - 8);
  ctx.textAlign = 'left';
}

// ── Sleep-ready check ───────────────────────────────────────────────────
function updateSleepReady() {
  if (sleepState.active) return;
  if (sleepReady.p1 && sleepReady.p2) {
    sleepState.active = true;
    sleepState.phase = 'fadeOut';
    sleepState.alpha = 0;
    sleepReady.p1 = false;
    sleepReady.p2 = false;
    Player1.inBed = false;
    Player2.inBed = false;
  }
}

// ── Leaderboard ─────────────────────────────────────────────────────────
function computeScore(p) {
  return p.stats.fishCaught * 10
       + p.stats.crustaceansCaught * 15
       + Math.floor(p.gold / 10)
       + p.stats.goldEarned
       + p.stats.cooked * 5
       + p.stats.eaten * 3
       + p.stats.npcTrades * 20;
}

function drawLeaderboard() {
  if (!showLeaderboard) return;

  const panelW = 460;
  const panelH = 340;
  const px = (SCREEN_W - panelW) / 2;
  const py = (SCREEN_H - panelH) / 2;

  ctx.fillStyle = 'rgba(5,5,15,0.96)';
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = '#f0c860';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, panelW, panelH);

  const s1 = computeScore(Player1);
  const s2 = computeScore(Player2);

  // Header
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f0c860';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('Leaderboard', px + panelW / 2, py + 24);
  ctx.fillStyle = '#555';
  ctx.font = '9px monospace';
  ctx.fillText('L to close', px + panelW / 2, py + 36);

  // Column headers
  const labelX = px + 16;
  const c1 = px + 280;
  const c2 = px + 380;
  const headerY = py + 48;

  ctx.fillStyle = '#e8c170';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('P1', c1, headerY);
  ctx.fillStyle = '#70b8e0';
  ctx.fillText('P2', c2, headerY);

  ctx.strokeStyle = '#2a2a4a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + 8, headerY + 6); ctx.lineTo(px + panelW - 8, headerY + 6);
  ctx.stroke();

  const rows = [
    { label: 'Fish Caught',      v1: Player1.stats.fishCaught,        v2: Player2.stats.fishCaught        },
    { label: 'Crustaceans',      v1: Player1.stats.crustaceansCaught,  v2: Player2.stats.crustaceansCaught  },
    { label: 'Gold in Pocket',   v1: Player1.gold,                    v2: Player2.gold                    },
    { label: 'Gold Earned',      v1: Player1.stats.goldEarned,        v2: Player2.stats.goldEarned        },
    { label: 'NPC Trades',       v1: Player1.stats.npcTrades,         v2: Player2.stats.npcTrades         },
    { label: 'Meals Cooked',     v1: Player1.stats.cooked,            v2: Player2.stats.cooked            },
    { label: 'Meals Eaten',      v1: Player1.stats.eaten,             v2: Player2.stats.eaten             },
    { label: 'Rod Tier',         v1: Player1.rodTier + 1,             v2: Player2.rodTier + 1             },
    { label: 'Net Tier',         v1: Math.max(0, Player1.netTier + 1), v2: Math.max(0, Player2.netTier + 1) },
  ];

  const lineH = 24;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const y = headerY + 14 + i * lineH;
    const p1w = row.v1 > row.v2;
    const p2w = row.v2 > row.v1;

    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(px + 8, y - 4, panelW - 16, lineH);
    }

    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(row.label, labelX, y + 11);

    ctx.font = (p1w ? 'bold ' : '') + '12px monospace';
    ctx.fillStyle = p1w ? '#e8c170' : (p2w ? '#555' : '#aaa');
    ctx.textAlign = 'center';
    ctx.fillText(p1w ? `▶ ${row.v1}` : `${row.v1}`, c1, y + 11);

    ctx.font = (p2w ? 'bold ' : '') + '12px monospace';
    ctx.fillStyle = p2w ? '#70b8e0' : (p1w ? '#555' : '#aaa');
    ctx.fillText(p2w ? `▶ ${row.v2}` : `${row.v2}`, c2, y + 11);
  }

  // Score row
  const scoreY = headerY + 14 + rows.length * lineH + 10;
  ctx.strokeStyle = '#f0c860';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + 8, scoreY - 8); ctx.lineTo(px + panelW - 8, scoreY - 8);
  ctx.stroke();

  ctx.fillStyle = '#f0c860';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('SCORE', labelX, scoreY + 5);

  ctx.textAlign = 'center';
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = s1 > s2 ? '#ffd700' : s1 < s2 ? '#666' : '#aaa';
  ctx.fillText(s1 > s2 ? `★ ${s1}` : `${s1}`, c1, scoreY + 5);
  ctx.fillStyle = s2 > s1 ? '#ffd700' : s2 < s1 ? '#666' : '#aaa';
  ctx.fillText(s2 > s1 ? `★ ${s2}` : `${s2}`, c2, scoreY + 5);

  // Winner banner
  const bannerY = scoreY + 24;
  if (s1 !== s2) {
    const isP1 = s1 > s2;
    ctx.fillStyle = isP1 ? '#e8c170' : '#70b8e0';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(isP1 ? 'Player 1 is leading!' : 'Player 2 is leading!', px + panelW / 2, bannerY);
  } else {
    ctx.fillStyle = '#aaa';
    ctx.font = '12px monospace';
    ctx.fillText("It's a tie!", px + panelW / 2, bannerY);
  }

  ctx.fillStyle = '#384050';
  ctx.font = '9px monospace';
  ctx.fillText('Score = fish×10 + crust×15 + gold/10 + earned + cooked×5 + eaten×3 + trades×20', px + panelW / 2, py + panelH - 8);
  ctx.textAlign = 'left';
}

function drawHUDBar(x, y, w, h, value, max, colorFn, label) {
  ctx.fillStyle = '#222';
  ctx.fillRect(x, y, w, h);
  const ratio = value / max;
  ctx.fillStyle = colorFn(ratio);
  ctx.fillRect(x, y, w * ratio, h);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h - 1);
  ctx.textAlign = 'left';
}

function drawHUDPlayerBars(x, y, w, player) {
  // HP bar
  drawHUDBar(x, y, w, 7, player.hp, player.maxHp,
    r => r > 0.5 ? '#4c4' : r > 0.25 ? '#cc4' : '#c44',
    `HP ${player.hp}/${player.maxHp}`
  );
  // Hunger bar (show fullness: 100 - hunger)
  const fullness = player.maxHunger - player.hunger;
  drawHUDBar(x, y + 9, w, 7, fullness, player.maxHunger,
    r => r > 0.5 ? '#c90' : r > 0.25 ? '#c60' : '#c30',
    `Food ${fullness}/${player.maxHunger}`
  );
}

function drawHUD() {
  const tod = getTimeOfDay();

  // P1 status
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(8, 8, 180, 70);
  ctx.fillStyle = '#e8c170';
  ctx.font = '13px monospace';
  ctx.fillText('P1', 16, 22);
  ctx.fillStyle = '#fff';
  ctx.font = '10px monospace';
  ctx.fillText(`${invSummary(Player1.inventory)}`, 40, 22);
  // Gold
  ctx.fillStyle = '#ffd700';
  ctx.fillText(`${Player1.gold}g`, 150, 22);
  // Rod indicator
  ctx.fillStyle = FISHING_RODS[Player1.rodTier].color;
  ctx.fillRect(170, 14, 6, 6);
  // Net indicator
  if (Player1.netTier >= 0) {
    ctx.fillStyle = NET_TYPES[Player1.netTier].color;
    ctx.fillRect(162, 14, 6, 6);
  }
  // Bait indicator
  if (Player1.baitType > 0 && Player1.baitCounts[Player1.baitType] > 0) {
    ctx.fillStyle = BAIT_TYPES[Player1.baitType].color;
    ctx.beginPath();
    ctx.arc(157, 17, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // HP + Hunger bars
  drawHUDPlayerBars(16, 27, 160, Player1);
  ctx.fillStyle = '#aaa';
  ctx.font = '10px monospace';
  ctx.fillText('WASD:Move F:Fish E:Eat Q:Bait G:Net', 16, 56);
  ctx.fillStyle = '#666';
  ctx.font = '9px monospace';
  ctx.fillText('T:Give Gold  |  Walk into NPCs', 16, 66);

  // P2 status
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(SCREEN_W - 188, 8, 180, 70);
  ctx.fillStyle = '#70b8e0';
  ctx.font = '13px monospace';
  ctx.fillText('P2', SCREEN_W - 180, 22);
  ctx.fillStyle = '#fff';
  ctx.font = '10px monospace';
  ctx.fillText(`${invSummary(Player2.inventory)}`, SCREEN_W - 156, 22);
  // Gold
  ctx.fillStyle = '#ffd700';
  ctx.fillText(`${Player2.gold}g`, SCREEN_W - 38, 22);
  // Rod indicator
  ctx.fillStyle = FISHING_RODS[Player2.rodTier].color;
  ctx.fillRect(SCREEN_W - 18, 14, 6, 6);
  // Net indicator
  if (Player2.netTier >= 0) {
    ctx.fillStyle = NET_TYPES[Player2.netTier].color;
    ctx.fillRect(SCREEN_W - 26, 14, 6, 6);
  }
  // Bait indicator
  if (Player2.baitType > 0 && Player2.baitCounts[Player2.baitType] > 0) {
    ctx.fillStyle = BAIT_TYPES[Player2.baitType].color;
    ctx.beginPath();
    ctx.arc(SCREEN_W - 33, 17, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // HP + Hunger bars
  drawHUDPlayerBars(SCREEN_W - 172, 27, 160, Player2);
  ctx.fillStyle = '#aaa';
  ctx.font = '10px monospace';
  ctx.fillText('Arrows:Move /:Fish .:Eat ,:Bait M:Net', SCREEN_W - 188, 56);
  ctx.fillStyle = '#666';
  ctx.font = '9px monospace';
  ctx.fillText('N:Give Gold  |  Walk into NPCs', SCREEN_W - 180, 66);

  // Time of day
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  const todWidth = ctx.measureText(tod).width + 16;
  ctx.fillRect(SCREEN_W / 2 - todWidth / 2, 8, todWidth, 22);
  ctx.fillStyle = '#fff';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(tod, SCREEN_W / 2, 24);
  ctx.textAlign = 'left';

  // Music mute indicator (top center, subtle)
  if (AudioSystem.isMuted()) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(SCREEN_W / 2 - 34, 2, 68, 14);
    ctx.fillStyle = '#e07050';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('\u266a MUTED [B]', SCREEN_W / 2, 12);
    ctx.textAlign = 'left';
  }

  // Controls help bar at bottom
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, SCREEN_H - 20, SCREEN_W, 20);
  ctx.fillStyle = '#ccc';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Action: interact/fish/bed  |  Tab: Species  |  L: Leaderboard  |  P: Achievements  |  B: Music', SCREEN_W / 2, SCREEN_H - 6);
  ctx.textAlign = 'left';

  // Message popup (fridge/furnace messages)
  if (fridgeMessage.timer > 0) {
    ctx.font = '13px monospace';
    const msgW = ctx.measureText(fridgeMessage.text).width + 24;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(SCREEN_W / 2 - msgW / 2, SCREEN_H - 56, msgW, 28);
    ctx.fillStyle = '#d0d8e0';
    ctx.textAlign = 'center';
    ctx.fillText(fridgeMessage.text, SCREEN_W / 2, SCREEN_H - 38);
    ctx.textAlign = 'left';
  }
}

// Draw player name tags
function drawNameTag(ctx, camera, player, name, color) {
  const sx = player.x - camera.x;
  const sy = player.y - camera.y;
  ctx.fillStyle = color;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(name, sx + player.w / 2, sy - 6);
  ctx.textAlign = 'left';
}

let lastTime = 0;

function gameLoop(timestamp) {
  const dt = Math.min(timestamp - lastTime, 100); // cap to prevent huge first-frame dt
  lastTime = timestamp;

  ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);

  // ── Start screen ──
  if (gameState === 'start') {
    drawStartScreen(dt);
    const anyJustPressed = Object.keys(Input.keys).some(k => Input.keys[k] && !Input.prevKeys[k]);
    if (anyJustPressed) {
      gameState = 'playing';
      lastTime = timestamp; // reset so first game dt is 0
      AudioSystem.init();
    }
    Input.update();
    requestAnimationFrame(gameLoop);
    return;
  }

  // ── Playing ──

  // Update world time (pause during sleep)
  if (!sleepState.active) {
    worldTime += dt / DAY_DURATION_MS;
    if (worldTime >= 1) worldTime -= 1;
  }

  updateSleep(dt);
  updateSleepReady();

  // Update timers
  if (fridgeMessage.timer > 0) fridgeMessage.timer -= dt;
  if (achieveNotify) {
    achieveNotify.timer -= dt;
    if (achieveNotify.timer <= 0) achieveNotify = null;
  }

  // Toggle overlays (mutually exclusive)
  if (Input.justPressed('Tab')) { showFishIndex = !showFishIndex; showAchievements = false; showLeaderboard = false; }
  if (Input.justPressed('KeyP')) { showAchievements = !showAchievements; showFishIndex = false; showLeaderboard = false; }
  if (Input.justPressed('KeyL')) { showLeaderboard = !showLeaderboard; showAchievements = false; showFishIndex = false; }
  if (Input.justPressed('KeyB')) { AudioSystem.toggle(); }

  // Shop interactions
  updateShop();
  updateBaitShop();
  updateNetShop();
  updateGiveGold();

  // Run achievement checks every frame
  checkAchievements();

  // Freeze movement when a shop or full-screen overlay is open
  const anyOverlay = shopState.open || baitShopState.open || netShopState.open || giveGoldState.open || showAchievements || showLeaderboard;
  if (!anyOverlay) {
    Player1.update(dt, Player2);
    Player2.update(dt, Player1);
  }
  NPCManager.update(dt, [Player1, Player2]);
  updateCamera();

  GameMap.draw(ctx, camera);

  Player1.draw(ctx, camera);
  drawNameTag(ctx, camera, Player1, 'P1', '#e8c170');

  Player2.draw(ctx, camera);
  drawNameTag(ctx, camera, Player2, 'P2', '#70b8e0');

  NPCManager.draw(ctx, camera);

  GameMap.drawRoofs(ctx, camera, [Player1, Player2]);

  drawDayNight();
  drawSleepOverlay();
  drawMiniGame();

  drawHUD();
  drawFishIndex();
  drawShop();
  drawBaitShop();
  drawNetShop();
  drawAchievements();
  drawLeaderboard();
  drawGiveGold();
  drawAchievementNotify();

  Input.update();
  requestAnimationFrame(gameLoop);
}

Input.init();
requestAnimationFrame(gameLoop);
