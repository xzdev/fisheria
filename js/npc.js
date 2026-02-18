// NPC encounter types with weighted random outcomes
const NPC_TYPES = [
  // Friendly NPCs — give rewards for fish
  {
    name: 'Old Fisherman',
    colors: { body: '#8B7355', head: '#d4a878', hair: '#aaa', legs: '#555' },
    friendly: true, weight: 25,
    dialogue: [
      "Howdy! Got any fish?",
      "I'll trade ya for that fish!",
      "Nice catch! Here's something for ya.",
    ],
  },
  {
    name: 'Hungry Traveler',
    colors: { body: '#6a8a5a', head: '#e0c8a0', hair: '#4a3020', legs: '#7a6a50' },
    friendly: true, weight: 20,
    dialogue: [
      "I'm so hungry... got a fish?",
      "Please, any fish will do!",
      "You're a lifesaver!",
    ],
  },
  {
    name: 'Fish Collector',
    colors: { body: '#9060a0', head: '#f0d0b0', hair: '#e0c030', legs: '#404060' },
    friendly: true, weight: 15,
    dialogue: [
      "I collect rare fish!",
      "Ooh, what do you have?",
      "Let me see your catch!",
    ],
  },
  {
    name: 'Mysterious Merchant',
    colors: { body: '#c0a020', head: '#f0e0c0', hair: '#202020', legs: '#303030' },
    friendly: true, weight: 5, bigReward: true,
    dialogue: [
      "I sense great fortune...",
      "The fish gods smile upon you!",
      "A rare trade, just for you...",
    ],
  },
  // Thieves — steal fish
  {
    name: 'Sneaky Cat',
    colors: { body: '#888', head: '#999', hair: '#666', legs: '#777' },
    friendly: false, weight: 15,
    dialogue: [
      "Meow! *snatches fish*",
      "Hiss! Mine now!",
      "*steals your fish and runs*",
    ],
  },
  {
    name: 'Bandit',
    colors: { body: '#333', head: '#c0a080', hair: '#222', legs: '#444' },
    friendly: false, weight: 12,
    dialogue: [
      "Hand over the fish!",
      "Your fish or your life!",
      "Yoink! Thanks, sucker!",
    ],
  },
  {
    name: 'Raccoon',
    colors: { body: '#605040', head: '#706050', hair: '#333', legs: '#504030' },
    friendly: false, weight: 8,
    dialogue: [
      "*rummages through your bag*",
      "Chitter chitter! *steals*",
      "*grabs fish and waddles away*",
    ],
  },
];

// Reward tiers for friendly NPCs
const NPC_REWARDS = [
  { type: 'gold', amount: 10, weight: 30, text: '+{n} gold!' },
  { type: 'gold', amount: 25, weight: 20, text: '+{n} gold!' },
  { type: 'gold', amount: 50, weight: 10, text: '+{n} gold! Generous!' },
  { type: 'gold', amount: 100, weight: 3, text: '+{n} gold!! Jackpot!' },
  { type: 'heal', amount: 40, weight: 15, text: 'Healed +{n}HP!' },
  { type: 'fish', name: 'Salmon', weight: 10, text: 'Gave you a Salmon!' },
  { type: 'fish', name: 'Catfish', weight: 7, text: 'Gave you a Catfish!' },
];

const NPC_BIG_REWARDS = [
  { type: 'gold', amount: 200, weight: 20, text: '+{n} gold!! Amazing!' },
  { type: 'goldenRod', weight: 15, text: 'Golden Fishing Rod!!' },
  { type: 'fish', name: 'Treasure Chest', weight: 10, text: 'Gave you a Treasure Chest!' },
  { type: 'heal', amount: 100, weight: 15, text: 'Full heal! +{n}HP!' },
  { type: 'gold', amount: 500, weight: 5, text: '+{n} gold!!! LEGENDARY!' },
];

function pickWeighted(arr) {
  const total = arr.reduce((a, b) => a + b.weight, 0);
  let r = Math.random() * total;
  for (const item of arr) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return arr[0];
}

function pickNpcType() {
  return pickWeighted(NPC_TYPES);
}

function findSpawnTile() {
  // Try to find a random walkable grass/path tile not near players
  for (let attempt = 0; attempt < 50; attempt++) {
    const col = Math.floor(Math.random() * GameMap.cols);
    const row = Math.floor(Math.random() * GameMap.rows);
    const tile = GameMap.getTile(col, row);
    if (tile !== 0 && tile !== 3) continue; // Only grass or path

    const wx = col * TILE + TILE / 2;
    const wy = row * TILE + TILE / 2;

    // Not too close to either player (at least 6 tiles away)
    const d1 = Math.abs(wx - Player1.x) + Math.abs(wy - Player1.y);
    const d2 = Math.abs(wx - Player2.x) + Math.abs(wy - Player2.y);
    if (d1 < TILE * 6 || d2 < TILE * 6) continue;

    // Not too far either (within 15 tiles of at least one player)
    if (d1 > TILE * 15 && d2 > TILE * 15) continue;

    return { col, row };
  }
  return null;
}

function createNpc() {
  const spot = findSpawnTile();
  if (!spot) return null;

  const type = pickNpcType();
  return {
    x: spot.col * TILE,
    y: spot.row * TILE,
    w: 24,
    h: 24,
    type,
    triggered: false,
    result: null,     // { text, timer, color }
    fadeOut: 0,       // fade after interaction
    bobTimer: 0,      // idle bobbing animation
    exclamation: true, // show "?" above head
  };
}

const NPCManager = {
  npcs: [],
  spawnTimer: 0,
  spawnInterval: 15000, // Try spawning every 15 seconds
  maxNpcs: 3,

  update(dt, players) {
    // Spawn timer
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval && this.npcs.length < this.maxNpcs) {
      this.spawnTimer = 0;
      const npc = createNpc();
      if (npc) this.npcs.push(npc);
    }

    for (const npc of this.npcs) {
      npc.bobTimer += dt;

      // Already triggered — count down and fade
      if (npc.triggered) {
        if (npc.result) {
          npc.result.timer -= dt;
          if (npc.result.timer <= 0) {
            npc.fadeOut += dt;
          }
        }
        continue;
      }

      // Check collision with players
      for (const player of players) {
        const dx = (player.x + player.w / 2) - (npc.x + npc.w / 2);
        const dy = (player.y + player.h / 2) - (npc.y + npc.h / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 20) {
          this.triggerEncounter(npc, player);
          break;
        }
      }
    }

    // Remove fully faded NPCs
    this.npcs = this.npcs.filter(n => n.fadeOut < 2000);
  },

  triggerEncounter(npc, player) {
    npc.triggered = true;
    npc.exclamation = false;
    const type = npc.type;
    const dialogue = type.dialogue[Math.floor(Math.random() * type.dialogue.length)];

    if (type.friendly) {
      // Friendly NPC — needs fish to give reward
      const fishIdx = player.inventory.findIndex(f =>
        !f.type && f.name !== 'Old Boot' && f.name !== 'Treasure Chest'
      );

      if (fishIdx !== -1) {
        const fish = player.inventory.splice(fishIdx, 1)[0];
        const rewardPool = type.bigReward ? NPC_BIG_REWARDS : NPC_REWARDS;
        const reward = pickWeighted(rewardPool);

        let rewardText = '';
        if (reward.type === 'gold') {
          player.gold += reward.amount;
          rewardText = reward.text.replace('{n}', reward.amount);
        } else if (reward.type === 'heal') {
          const oldHp = player.hp;
          player.hp = Math.min(player.maxHp, player.hp + reward.amount);
          rewardText = reward.text.replace('{n}', player.hp - oldHp);
        } else if (reward.type === 'fish') {
          player.inventory.push({ name: reward.name, cooked: false });
          rewardText = reward.text;
        } else if (reward.type === 'goldenRod') {
          player.hasGoldenRod = true;
          rewardText = reward.text;
        }

        npc.result = {
          line1: `${type.name}: "${dialogue}"`,
          line2: `Took your ${fish.cooked ? 'Cooked ' : ''}${fish.name}`,
          line3: rewardText,
          timer: 3500,
          color: type.bigReward ? '#ffd700' : '#4c4',
        };
      } else {
        // No fish to give
        npc.result = {
          line1: `${type.name}: "Got any fish?"`,
          line2: 'You have no fish to trade...',
          line3: '*walks away disappointed*',
          timer: 2500,
          color: '#aaa',
        };
      }
    } else {
      // Thief NPC — steals fish
      const fishCount = player.inventory.filter(f =>
        !f.type && f.name !== 'Old Boot'
      ).length;

      if (fishCount > 0) {
        // Steal 1-3 fish
        const stealCount = Math.min(fishCount, 1 + Math.floor(Math.random() * 3));
        const stolen = [];
        for (let i = 0; i < stealCount; i++) {
          const idx = player.inventory.findIndex(f =>
            !f.type && f.name !== 'Old Boot'
          );
          if (idx !== -1) stolen.push(player.inventory.splice(idx, 1)[0]);
        }

        npc.result = {
          line1: `${type.name}: "${dialogue}"`,
          line2: `Stole ${stolen.length} fish from you!`,
          line3: stolen.map(f => f.name).join(', '),
          timer: 3000,
          color: '#e44',
        };
      } else {
        // Nothing to steal
        npc.result = {
          line1: `${type.name}: "${dialogue}"`,
          line2: `...but you have nothing to steal!`,
          line3: '*leaves empty-handed*',
          timer: 2500,
          color: '#cc4',
        };
      }
    }
  },

  draw(ctx, camera) {
    for (const npc of this.npcs) {
      const sx = npc.x - camera.x;
      const sy = npc.y - camera.y;

      // Skip if off screen
      if (sx < -40 || sx > SCREEN_W + 40 || sy < -40 || sy > SCREEN_H + 40) continue;

      // Fade out alpha
      const alpha = npc.fadeOut > 0 ? Math.max(0, 1 - npc.fadeOut / 2000) : 1;
      ctx.globalAlpha = alpha;

      const bob = Math.sin(npc.bobTimer / 400) * 1.5;

      // Body
      ctx.fillStyle = npc.type.colors.body;
      ctx.fillRect(sx + 4, sy + 6 + bob, 16, 14);

      // Head
      ctx.fillStyle = npc.type.colors.head;
      ctx.fillRect(sx + 6, sy + bob, 12, 10);

      // Hair
      ctx.fillStyle = npc.type.colors.hair;
      ctx.fillRect(sx + 5, sy - 1 + bob, 14, 5);

      // Eyes (always facing down)
      ctx.fillStyle = '#222';
      ctx.fillRect(sx + 8, sy + 4 + bob, 2, 2);
      ctx.fillRect(sx + 14, sy + 4 + bob, 2, 2);

      // Legs
      ctx.fillStyle = npc.type.colors.legs;
      ctx.fillRect(sx + 6, sy + 20 + bob, 5, 4);
      ctx.fillRect(sx + 13, sy + 20 + bob, 5, 4);

      // "?" above head if not yet triggered
      if (npc.exclamation && !npc.triggered) {
        const bounce = Math.sin(npc.bobTimer / 250) * 3;
        ctx.fillStyle = npc.type.friendly ? '#4c4' : '#e44';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('?', sx + npc.w / 2, sy - 8 + bounce);
        ctx.textAlign = 'left';
      }

      // Result bubble
      if (npc.result && npc.result.timer > 0) {
        ctx.globalAlpha = Math.min(alpha, 1);
        ctx.font = '10px monospace';
        const w1 = ctx.measureText(npc.result.line1).width;
        const w2 = ctx.measureText(npc.result.line2).width;
        const w3 = ctx.measureText(npc.result.line3).width;
        const bubbleW = Math.max(w1, w2, w3) + 16;
        const bubbleH = 46;
        const bx = sx + npc.w / 2 - bubbleW / 2;
        const by = sy - 60 + bob;

        // Bubble background
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(bx, by, bubbleW, bubbleH);
        ctx.strokeStyle = npc.result.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx, by, bubbleW, bubbleH);

        // Text
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(npc.result.line1, sx + npc.w / 2, by + 12);
        ctx.fillStyle = '#ccc';
        ctx.fillText(npc.result.line2, sx + npc.w / 2, by + 26);
        ctx.fillStyle = npc.result.color;
        ctx.font = 'bold 10px monospace';
        ctx.fillText(npc.result.line3, sx + npc.w / 2, by + 40);
        ctx.textAlign = 'left';
      }

      ctx.globalAlpha = 1;
    }
  },
};
