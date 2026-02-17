const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const SCREEN_W = 640;
const SCREEN_H = 480;
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

function recordCatch(name) {
  fishIndex[name] = (fishIndex[name] || 0) + 1;
}

function drawFishIndex() {
  if (!showFishIndex) return;

  const allNames = FISH_TYPES.map(f => f.name);
  const panelW = 240;
  const lineH = 18;
  const headerH = 28;
  const panelH = headerH + allNames.length * lineH + 12;
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
  for (let i = 0; i < allNames.length; i++) {
    const name = allNames[i];
    const count = fishIndex[name] || 0;
    const y = py + headerH + i * lineH + 14;
    const caught = count > 0;

    // Fish name (or ??? if never caught)
    ctx.font = '12px monospace';
    if (caught) {
      ctx.fillStyle = '#fff';
      ctx.fillText(name, px + 14, y);
      // Count
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'right';
      ctx.fillText(`x${count}`, px + panelW - 14, y);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = '#555';
      ctx.fillText('???', px + 14, y);
    }

    // Rarity indicator
    const rarity = FISH_TYPES[i].weight;
    let dot = '#4c4';
    if (rarity <= 5) dot = '#e44';
    else if (rarity <= 15) dot = '#e0e040';
    ctx.fillStyle = caught ? dot : '#333';
    ctx.beginPath();
    ctx.arc(px + panelW - 30, y - 4, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Total
  const total = Object.values(fishIndex).reduce((a, b) => a + b, 0);
  const discovered = Object.keys(fishIndex).length;
  ctx.fillStyle = '#888';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${discovered}/${allNames.length} discovered  |  ${total} total caught`, px + panelW / 2, py + panelH - 6);
  ctx.textAlign = 'left';
}

function drawHUDHealthBar(x, y, w, h, player) {
  // Background
  ctx.fillStyle = '#222';
  ctx.fillRect(x, y, w, h);
  // Health fill
  const ratio = player.hp / player.maxHp;
  const color = ratio > 0.5 ? '#4c4' : ratio > 0.25 ? '#cc4' : '#c44';
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * ratio, h);
  // Border
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  // HP text
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${player.hp}/${player.maxHp}`, x + w / 2, y + h - 1);
  ctx.textAlign = 'left';
}

function drawHUD() {
  const tod = getTimeOfDay();

  // P1 status
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(8, 8, 180, 52);
  ctx.fillStyle = '#e8c170';
  ctx.font = '13px monospace';
  ctx.fillText('P1', 16, 24);
  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText(`${invSummary(Player1.inventory)}`, 40, 24);
  // HP bar
  drawHUDHealthBar(16, 29, 160, 8, Player1);
  ctx.fillStyle = '#aaa';
  ctx.font = '10px monospace';
  ctx.fillText('WASD:Move F:Act E:Eat', 16, 52);

  // P2 status
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(SCREEN_W - 188, 8, 180, 52);
  ctx.fillStyle = '#70b8e0';
  ctx.font = '13px monospace';
  ctx.fillText('P2', SCREEN_W - 180, 24);
  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText(`${invSummary(Player2.inventory)}`, SCREEN_W - 156, 24);
  // HP bar
  drawHUDHealthBar(SCREEN_W - 172, 29, 160, 8, Player2);
  ctx.fillStyle = '#aaa';
  ctx.font = '10px monospace';
  ctx.fillText('Arrows:Move /:Act .:Eat', SCREEN_W - 180, 52);

  // Time of day
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  const todWidth = ctx.measureText(tod).width + 16;
  ctx.fillRect(SCREEN_W / 2 - todWidth / 2, 8, todWidth, 22);
  ctx.fillStyle = '#fff';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(tod, SCREEN_W / 2, 24);
  ctx.textAlign = 'left';

  // Controls help bar at bottom
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, SCREEN_H - 20, SCREEN_W, 20);
  ctx.fillStyle = '#ccc';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Action: water/bed/fridge/furnace/trash  |  Eat: fish, chests, potions  |  Tab: Fish Index', SCREEN_W / 2, SCREEN_H - 6);
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
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  // Update world time (pause during sleep)
  if (!sleepState.active) {
    worldTime += dt / DAY_DURATION_MS;
    if (worldTime >= 1) worldTime -= 1;
  }

  // Update sleep transition
  updateSleep(dt);

  // Update fridge message timer
  if (fridgeMessage.timer > 0) fridgeMessage.timer -= dt;

  // Toggle fish index
  if (Input.justPressed('Tab')) showFishIndex = !showFishIndex;

  Player1.update(dt, Player2);
  Player2.update(dt, Player1);
  updateCamera();

  ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
  GameMap.draw(ctx, camera);

  Player1.draw(ctx, camera);
  drawNameTag(ctx, camera, Player1, 'P1', '#e8c170');

  Player2.draw(ctx, camera);
  drawNameTag(ctx, camera, Player2, 'P2', '#70b8e0');

  // Draw roofs over houses where no player is inside
  GameMap.drawRoofs(ctx, camera, [Player1, Player2]);

  // Day/night overlay
  drawDayNight();

  // Sleep overlay (on top of everything)
  drawSleepOverlay();

  drawHUD();
  drawFishIndex();

  // Snapshot input state at end of frame
  Input.update();

  requestAnimationFrame(gameLoop);
}

Input.init();
requestAnimationFrame(gameLoop);
