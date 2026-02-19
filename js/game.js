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

// Shop state
const shopState = { open: false, player: null, cursor: 0 };

// Bait shop state
const baitShopState = { open: false, player: null, cursor: 1 };

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

  // Combine normal + rare fish for the index
  const allEntries = [];
  for (const f of FISH_TYPES) {
    allEntries.push({ name: f.name, weight: f.weight, rare: false });
  }
  for (const f of RARE_FISH) {
    allEntries.push({ name: f.name, weight: f.weight, rare: true, bait: f.bait });
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
    const count = fishIndex[entry.name] || 0;
    const y = py + headerH + i * lineH + 14;
    const caught = count > 0;

    // Fish name (or ??? if never caught)
    ctx.font = '12px monospace';
    if (caught) {
      ctx.fillStyle = entry.rare ? '#c8a0ff' : '#fff';
      ctx.fillText(entry.name, px + 14, y);
      // Count
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'right';
      ctx.fillText(`x${count}`, px + panelW - 14, y);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = entry.rare ? '#403060' : '#555';
      ctx.fillText(entry.rare ? '??? (bait)' : '???', px + 14, y);
    }

    // Rarity indicator
    let dot = '#4c4';
    if (entry.rare) dot = '#c8a0ff';
    else if (entry.weight <= 5) dot = '#e44';
    else if (entry.weight <= 15) dot = '#e0e040';
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
  ctx.fillText(`${discovered}/${allEntries.length} discovered  |  ${total} total caught`, px + panelW / 2, py + panelH - 6);
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
  // Bait indicator
  if (Player1.baitType > 0 && Player1.baitCounts[Player1.baitType] > 0) {
    ctx.fillStyle = BAIT_TYPES[Player1.baitType].color;
    ctx.beginPath();
    ctx.arc(163, 17, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // HP + Hunger bars
  drawHUDPlayerBars(16, 27, 160, Player1);
  ctx.fillStyle = '#aaa';
  ctx.font = '10px monospace';
  ctx.fillText('WASD:Move F:Act E:Eat Q:Bait', 16, 56);
  ctx.fillStyle = '#666';
  ctx.font = '9px monospace';
  ctx.fillText('Walk into NPCs to interact', 16, 66);

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
  // Bait indicator
  if (Player2.baitType > 0 && Player2.baitCounts[Player2.baitType] > 0) {
    ctx.fillStyle = BAIT_TYPES[Player2.baitType].color;
    ctx.beginPath();
    ctx.arc(SCREEN_W - 25, 17, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // HP + Hunger bars
  drawHUDPlayerBars(SCREEN_W - 172, 27, 160, Player2);
  ctx.fillStyle = '#aaa';
  ctx.font = '10px monospace';
  ctx.fillText('Arrows:Move /:Act .:Eat ,:Bait', SCREEN_W - 180, 56);
  ctx.fillStyle = '#666';
  ctx.font = '9px monospace';
  ctx.fillText('Walk into NPCs to interact', SCREEN_W - 180, 66);

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

  // Shop interactions
  updateShop();
  updateBaitShop();

  // Skip player updates if any shop is open (freeze movement)
  if (!shopState.open && !baitShopState.open) {
    Player1.update(dt, Player2);
    Player2.update(dt, Player1);
  }
  NPCManager.update(dt, [Player1, Player2]);
  updateCamera();

  ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
  GameMap.draw(ctx, camera);

  Player1.draw(ctx, camera);
  drawNameTag(ctx, camera, Player1, 'P1', '#e8c170');

  Player2.draw(ctx, camera);
  drawNameTag(ctx, camera, Player2, 'P2', '#70b8e0');

  NPCManager.draw(ctx, camera);

  // Draw roofs over houses where no player is inside
  GameMap.drawRoofs(ctx, camera, [Player1, Player2]);

  // Day/night overlay
  drawDayNight();

  // Sleep overlay (on top of everything)
  drawSleepOverlay();

  drawHUD();
  drawFishIndex();
  drawShop();
  drawBaitShop();

  // Snapshot input state at end of frame
  Input.update();

  requestAnimationFrame(gameLoop);
}

Input.init();
requestAnimationFrame(gameLoop);
