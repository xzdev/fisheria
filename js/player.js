const FISHING_RODS = [
  { name: 'Wooden Rod',   color: '#8B7355', speedMult: 1.0,  castTime: 500, rareMult: 1.0, cost: 0   },
  { name: 'Iron Rod',     color: '#8888aa', speedMult: 0.8,  castTime: 400, rareMult: 1.2, cost: 50  },
  { name: 'Steel Rod',    color: '#aabbcc', speedMult: 0.65, castTime: 350, rareMult: 1.5, cost: 150 },
  { name: 'Silver Rod',   color: '#c0c0d0', speedMult: 0.5,  castTime: 300, rareMult: 2.0, cost: 400 },
  { name: 'Golden Rod',   color: '#ffd700', speedMult: 0.35, castTime: 250, rareMult: 3.0, cost: 1000},
];

const FISH_TYPES = [
  { name: 'Bluegill',       weight: 40 },
  { name: 'Bass',           weight: 25 },
  { name: 'Trout',          weight: 15 },
  { name: 'Salmon',         weight: 10 },
  { name: 'Catfish',        weight: 5  },
  { name: 'Old Boot',       weight: 4  },
  { name: 'Treasure Chest', weight: 1  },
];

// Rare fish — only catchable with matching bait equipped
const RARE_FISH = [
  { name: 'Sturgeon',       weight: 8, bait: 1 },
  { name: 'Swordfish',      weight: 5, bait: 2 },
  { name: 'Anglerfish',     weight: 4, bait: 3 },
  { name: 'Legendary Koi',  weight: 2, bait: 4 },
];

// Bait types — index 0 is "no bait"
const BAIT_TYPES = [
  { name: 'No Bait',      color: '#666',    cost: 0,   amount: 0 },
  { name: 'Worm',          color: '#8B5E3C', cost: 10,  amount: 5 },
  { name: 'Shrimp',        color: '#E8A090', cost: 30,  amount: 5 },
  { name: 'Glowworm',      color: '#80FF80', cost: 75,  amount: 5 },
  { name: 'Golden Lure',   color: '#FFD700', cost: 200, amount: 3 },
];

const TREASURE_LOOT = [
  { name: 'Golden Fish',    weight: 10, heal: 50 },
  { name: 'Pearl',          weight: 20, heal: 0  },
  { name: 'Ruby',           weight: 15, heal: 0  },
  { name: 'Ancient Coin',   weight: 25, heal: 0  },
  { name: 'Magic Potion',   weight: 15, heal: 80 },
  { name: 'Diamond',        weight: 5,  heal: 0  },
  { name: 'Crown',          weight: 2,  heal: 0  },
];

function pickTreasure() {
  const total = TREASURE_LOOT.reduce((a, b) => a + b.weight, 0);
  let r = Math.random() * total;
  for (const loot of TREASURE_LOOT) {
    r -= loot.weight;
    if (r <= 0) return loot;
  }
  return TREASURE_LOOT[0];
}

function pickFish(isNight, rareMult, baitType) {
  rareMult = rareMult || 1;
  baitType = baitType || 0;

  // Build combined pool: normal fish + rare fish if bait matches
  const pool = [];
  const weights = [];

  for (let i = 0; i < FISH_TYPES.length; i++) {
    const f = FISH_TYPES[i];
    let w = f.weight;
    if (isNight) w = i < 2 ? w * 0.5 : w * 2;
    if (i >= 3 && rareMult > 1) w *= rareMult;
    pool.push(f.name);
    weights.push(w);
  }

  // Add rare fish if bait is equipped
  if (baitType > 0) {
    for (const rf of RARE_FISH) {
      if (rf.bait === baitType) {
        let w = rf.weight * rareMult;
        if (isNight && rf.bait === 3) w *= 3; // Glowworm bait bonus at night
        pool.push(rf.name);
        weights.push(w);
      }
    }
  }

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[0];
}

function getFacingTile(player) {
  const cx = Math.floor((player.x + player.w / 2) / TILE);
  const cy = Math.floor((player.y + player.h / 2) / TILE);
  let tx = cx, ty = cy;
  if (player.facing === 'up')    ty -= 1;
  if (player.facing === 'down')  ty += 1;
  if (player.facing === 'left')  tx -= 1;
  if (player.facing === 'right') tx += 1;
  return { col: tx, row: ty, tile: GameMap.getTile(tx, ty) };
}

function createPlayer(startCol, startRow, colors, getDirection, actionKey, eatKey, baitKey) {
  return {
    x: startCol * TILE,
    y: startRow * TILE,
    w: 24,
    h: 24,
    speed: 3,
    facing: 'down',
    frame: 0,
    frameTimer: 0,
    moving: false,
    colors,
    getDirection,
    actionKey,
    eatKey,
    baitKey,
    fishing: null,
    inventory: [],    // { name, cooked } for fish, { name, type:'treasure', heal } for loot
    eatMessage: null,  // { text, timer }
    gold: 0,
    rodTier: 0,  // index into FISHING_RODS
    hp: 100,
    maxHp: 100,
    hunger: 0,       // 0 = full, 100 = starving
    maxHunger: 100,
    hungerTimer: 0,
    baitType: 0,           // index into BAIT_TYPES (0 = no bait)
    baitCounts: [0, 0, 0, 0, 0], // count of each bait type owned

    update(dt, otherPlayer) {
      const dir = this.getDirection();
      const wantsMove = dir.dx !== 0 || dir.dy !== 0;

      // Hunger increases over time — +1 every 10 seconds
      this.hungerTimer += dt;
      if (this.hungerTimer >= 10000) {
        this.hungerTimer -= 10000;
        if (this.hunger < this.maxHunger) {
          this.hunger = Math.min(this.maxHunger, this.hunger + 2);
        }
        // Starving — lose HP when hunger is maxed
        if (this.hunger >= this.maxHunger && this.hp > 1) {
          this.hp -= 2;
        }
      }

      // Eat message timer
      if (this.eatMessage) {
        this.eatMessage.timer -= dt;
        if (this.eatMessage.timer <= 0) this.eatMessage = null;
      }

      // Eat key — eat fish or use healing treasure (prefers cooked fish, then healing potions, then raw)
      if (Input.justPressed(this.eatKey)) {
        // Open treasure chests first
        const chestIdx = this.inventory.findIndex(f => f.name === 'Treasure Chest');
        if (chestIdx !== -1) {
          this.inventory.splice(chestIdx, 1);
          const loot = pickTreasure();
          this.inventory.push({ name: loot.name, type: 'treasure', heal: loot.heal });
          this.eatMessage = { text: `Opened chest: ${loot.name}!`, timer: 2500 };
        } else {
          // Try healing potion/treasure
          const potionIdx = this.inventory.findIndex(f => f.type === 'treasure' && f.heal > 0);
          // Prefer cooked fish, then potion, then raw fish
          let eatIdx = this.inventory.findIndex(f => f.cooked && f.name !== 'Old Boot');
          if (eatIdx === -1) eatIdx = potionIdx;
          if (eatIdx === -1) eatIdx = this.inventory.findIndex(f => !f.type && f.name !== 'Old Boot' && f.name !== 'Treasure Chest');
          if (eatIdx !== -1) {
            const item = this.inventory.splice(eatIdx, 1)[0];
            if (item.type === 'treasure') {
              // Potions heal HP
              const oldHp = this.hp;
              this.hp = Math.min(this.maxHp, this.hp + item.heal);
              this.eatMessage = { text: `Used ${item.name}! +${this.hp - oldHp}HP`, timer: 2000 };
            } else {
              // Fish reduces hunger
              const feed = item.cooked ? 30 : 10;
              const oldHunger = this.hunger;
              this.hunger = Math.max(0, this.hunger - feed);
              const fed = oldHunger - this.hunger;
              if (item.cooked) {
                this.eatMessage = { text: `Ate Cooked ${item.name}! -${fed} Hunger`, timer: 2000 };
              } else {
                this.eatMessage = { text: `Ate Raw ${item.name}... -${fed} Hunger`, timer: 2000 };
              }
            }
          } else {
            // Sell non-healing treasures for gold
            const sellIdx = this.inventory.findIndex(f => f.type === 'treasure' && f.heal === 0);
            if (sellIdx !== -1) {
              this.eatMessage = { text: `${this.inventory[sellIdx].name} - not edible`, timer: 1500 };
            } else if (this.inventory.some(f => f.name === 'Old Boot')) {
              this.eatMessage = { text: `Can't eat that!`, timer: 1500 };
            } else {
              this.eatMessage = { text: `Nothing to eat!`, timer: 1500 };
            }
          }
        }
      }

      // Bait cycling with bait key
      if (Input.justPressed(this.baitKey)) {
        let next = (this.baitType + 1) % BAIT_TYPES.length;
        while (next !== 0 && this.baitCounts[next] <= 0) {
          next = (next + 1) % BAIT_TYPES.length;
        }
        this.baitType = next;
        const name = BAIT_TYPES[this.baitType].name;
        const count = this.baitType > 0 ? ` (${this.baitCounts[this.baitType]} left)` : '';
        this.eatMessage = { text: `Bait: ${name}${count}`, timer: 1500 };
      }

      // Fishing logic
      if (this.fishing) {
        if (wantsMove) {
          this.fishing = null;
        } else {
          this.fishing.timer -= dt;
          if (this.fishing.state === 'casting' && this.fishing.timer <= 0) {
            const isNight = typeof worldTime !== 'undefined' && (worldTime > 0.625 || worldTime < 0.125);
            const rod = FISHING_RODS[this.rodTier];
            const waitTime = (isNight ? (2000 + Math.random() * 2000) : (3000 + Math.random() * 3000)) * rod.speedMult;
            this.fishing.state = 'waiting';
            this.fishing.timer = waitTime;
          } else if (this.fishing.state === 'waiting' && this.fishing.timer <= 0) {
            const isNight = typeof worldTime !== 'undefined' && (worldTime > 0.625 || worldTime < 0.125);
            const activeBait = (this.baitType > 0 && this.baitCounts[this.baitType] > 0) ? this.baitType : 0;
            this.fishing.state = 'caught';
            this.fishing.fish = pickFish(isNight, FISHING_RODS[this.rodTier].rareMult, activeBait);
            this.fishing.usedBait = activeBait;
          } else if (this.fishing.state === 'caught' && Input.justPressed(this.actionKey)) {
            this.inventory.push({ name: this.fishing.fish, cooked: false });
            recordCatch(this.fishing.fish);
            // Consume bait
            if (this.fishing.usedBait > 0) {
              this.baitCounts[this.fishing.usedBait]--;
              if (this.baitCounts[this.baitType] <= 0) this.baitType = 0;
            }
            this.fishing = null;
          }
        }
        this.moving = false;
        return;
      }

      // Action key interactions
      if (Input.justPressed(this.actionKey)) {
        const ft = getFacingTile(this);
        // Fishing — face water
        if (ft.tile === 2) {
          this.fishing = {
            state: 'casting',
            timer: FISHING_RODS[this.rodTier].castTime,
            castDuration: FISHING_RODS[this.rodTier].castTime,
            bobX: ft.col * TILE + TILE / 2,
            bobY: ft.row * TILE + TILE / 2,
            fish: null,
          };
          this.moving = false;
          return;
        }
        // Bed — sleep through night
        if (ft.tile === 9) {
          if (typeof sleepState !== 'undefined' && !sleepState.active) {
            const tod = getTimeOfDay();
            if (tod === 'Night' || tod === 'Dusk') {
              sleepState.active = true;
              sleepState.phase = 'fadeOut';
              sleepState.alpha = 0;
            }
          }
          return;
        }
        // Fridge — deposit fish
        if (ft.tile === 10) {
          if (this.inventory.length > 0) {
            for (const fish of this.inventory) {
              fridgeStorage.push(fish);
            }
            fridgeMessage.text = `Stored ${this.inventory.length} fish! (${fridgeStorage.length} total)`;
            fridgeMessage.timer = 2000;
            this.inventory = [];
          } else {
            fridgeMessage.text = `Fridge: ${fridgeStorage.length} fish stored`;
            fridgeMessage.timer = 2000;
          }
          return;
        }
        // Trash can — throw away junk items one at a time
        if (ft.tile === 12) {
          const junkIdx = this.inventory.findIndex(f => f.name === 'Old Boot');
          if (junkIdx !== -1) {
            this.inventory.splice(junkIdx, 1);
            fridgeMessage.text = `Threw away Old Boot!`;
            fridgeMessage.timer = 2000;
          } else {
            // Throw away any non-fish item or let player discard last item
            const anyIdx = this.inventory.length - 1;
            if (anyIdx >= 0) {
              const item = this.inventory.splice(anyIdx, 1)[0];
              fridgeMessage.text = `Threw away ${item.cooked ? 'Cooked ' : ''}${item.name}!`;
              fridgeMessage.timer = 2000;
            } else {
              fridgeMessage.text = `Nothing to throw away!`;
              fridgeMessage.timer = 1500;
            }
          }
          return;
        }
        // Shop — open rod shop
        if (ft.tile === 13) {
          if (typeof shopState !== 'undefined') {
            shopState.open = true;
            shopState.player = this;
          }
          return;
        }
        // Bait shop — open bait shop
        if (ft.tile === 14) {
          if (typeof baitShopState !== 'undefined') {
            baitShopState.open = true;
            baitShopState.player = this;
          }
          return;
        }
        // Furnace — cook a raw fish
        if (ft.tile === 11) {
          const rawIdx = this.inventory.findIndex(f => !f.cooked && f.name !== 'Old Boot' && f.name !== 'Treasure Chest');
          if (rawIdx !== -1) {
            this.inventory[rawIdx].cooked = true;
            fridgeMessage.text = `Cooked ${this.inventory[rawIdx].name}!`;
            fridgeMessage.timer = 2000;
          } else if (this.inventory.some(f => f.cooked)) {
            fridgeMessage.text = `All fish already cooked!`;
            fridgeMessage.timer = 1500;
          } else {
            fridgeMessage.text = `No fish to cook!`;
            fridgeMessage.timer = 1500;
          }
          return;
        }
      }

      this.moving = wantsMove;

      if (this.moving) {
        let len = Math.sqrt(dir.dx * dir.dx + dir.dy * dir.dy);
        let mx = (dir.dx / len) * this.speed;
        let my = (dir.dy / len) * this.speed;

        if (Math.abs(dir.dx) > Math.abs(dir.dy)) {
          this.facing = dir.dx > 0 ? 'right' : 'left';
        } else {
          this.facing = dir.dy > 0 ? 'down' : 'up';
        }

        let newX = this.x + mx;
        if (!this._collides(newX, this.y, otherPlayer)) {
          this.x = newX;
        }

        let newY = this.y + my;
        if (!this._collides(this.x, newY, otherPlayer)) {
          this.y = newY;
        }

        this.frameTimer += dt;
        if (this.frameTimer > 150) {
          this.frame = (this.frame + 1) % 4;
          this.frameTimer = 0;
        }
      } else {
        this.frame = 0;
        this.frameTimer = 0;
      }
    },

    _collides(x, y, otherPlayer) {
      const pad = 4;
      const left = x + pad;
      const right = x + this.w - pad;
      const top = y + pad;
      const bottom = y + this.h - pad;

      if (
        GameMap.isSolid(Math.floor(left / TILE), Math.floor(top / TILE)) ||
        GameMap.isSolid(Math.floor(right / TILE), Math.floor(top / TILE)) ||
        GameMap.isSolid(Math.floor(left / TILE), Math.floor(bottom / TILE)) ||
        GameMap.isSolid(Math.floor(right / TILE), Math.floor(bottom / TILE))
      ) return true;

      if (otherPlayer) {
        const oPad = 4;
        const oLeft = otherPlayer.x + oPad;
        const oRight = otherPlayer.x + otherPlayer.w - oPad;
        const oTop = otherPlayer.y + oPad;
        const oBottom = otherPlayer.y + otherPlayer.h - oPad;

        if (right > oLeft && left < oRight && bottom > oTop && top < oBottom) {
          return true;
        }
      }

      return false;
    },

    draw(ctx, camera) {
      const sx = this.x - camera.x;
      const sy = this.y - camera.y;

      // Body
      ctx.fillStyle = this.colors.body;
      ctx.fillRect(sx + 4, sy + 6, 16, 14);

      // Head
      ctx.fillStyle = this.colors.head;
      ctx.fillRect(sx + 6, sy, 12, 10);

      // Hair
      ctx.fillStyle = this.colors.hair;
      ctx.fillRect(sx + 5, sy - 1, 14, 5);

      // Eyes
      ctx.fillStyle = '#222';
      if (this.facing === 'down') {
        ctx.fillRect(sx + 8, sy + 4, 2, 2);
        ctx.fillRect(sx + 14, sy + 4, 2, 2);
      } else if (this.facing === 'left') {
        ctx.fillRect(sx + 7, sy + 4, 2, 2);
      } else if (this.facing === 'right') {
        ctx.fillRect(sx + 15, sy + 4, 2, 2);
      }

      // Legs
      ctx.fillStyle = this.colors.legs;
      const legOffset = this.moving ? Math.sin(this.frame * Math.PI / 2) * 3 : 0;
      ctx.fillRect(sx + 6, sy + 20 + legOffset, 5, 4);
      ctx.fillRect(sx + 13, sy + 20 - legOffset, 5, 4);

      // Health bar above head
      const barW = 24;
      const barH = 3;
      const barX = sx + (this.w - barW) / 2;
      const barY = sy - 7;
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, barY, barW, barH);
      const hpRatio = this.hp / this.maxHp;
      const hpColor = hpRatio > 0.5 ? '#4c4' : hpRatio > 0.25 ? '#cc4' : '#c44';
      ctx.fillStyle = hpColor;
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(barX, barY, barW, barH);

      // Hunger bar below HP bar
      const hunBarY = barY + barH + 1;
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, hunBarY, barW, barH);
      const hungerRatio = 1 - (this.hunger / this.maxHunger); // full=green, empty=red
      const hunColor = hungerRatio > 0.5 ? '#c90' : hungerRatio > 0.25 ? '#c60' : '#c30';
      ctx.fillStyle = hunColor;
      ctx.fillRect(barX, hunBarY, barW * hungerRatio, barH);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(barX, hunBarY, barW, barH);

      // Eat message above head
      if (this.eatMessage) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.font = '10px monospace';
        const tw = ctx.measureText(this.eatMessage.text).width;
        ctx.fillRect(sx + this.w / 2 - tw / 2 - 4, sy - 36, tw + 8, 14);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(this.eatMessage.text, sx + this.w / 2, sy - 25);
        ctx.textAlign = 'left';
      }

      // Fishing visuals
      if (this.fishing) {
        const bobSX = this.fishing.bobX - camera.x;
        const bobSY = this.fishing.bobY - camera.y;

        let handX = sx + 12, handY = sy + 10;
        if (this.facing === 'right') handX = sx + 20;
        if (this.facing === 'left')  handX = sx + 4;
        if (this.facing === 'up')    handY = sy + 4;
        if (this.facing === 'down')  handY = sy + 16;

        ctx.strokeStyle = FISHING_RODS[this.rodTier].color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(handX, handY);

        if (this.fishing.state === 'casting') {
          const progress = 1 - (this.fishing.timer / (this.fishing.castDuration || 500));
          const lineEndX = handX + (bobSX - handX) * progress;
          const lineEndY = handY + (bobSY - handY) * progress;
          ctx.lineTo(lineEndX, lineEndY);
        } else {
          ctx.lineTo(bobSX, bobSY);
        }
        ctx.stroke();

        if (this.fishing.state !== 'casting') {
          const bobble = Math.sin(Date.now() / 300) * 2;
          ctx.fillStyle = '#ff3333';
          ctx.beginPath();
          ctx.arc(bobSX, bobSY + bobble, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(bobSX, bobSY + bobble - 2, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        if (this.fishing.state === 'caught') {
          ctx.fillStyle = '#ffff00';
          ctx.font = 'bold 16px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('!', sx + this.w / 2, sy - 12);
          ctx.textAlign = 'left';

          ctx.fillStyle = '#ffffff';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(this.fishing.fish, sx + this.w / 2, sy - 22);
          ctx.textAlign = 'left';
        }
      }
    }
  };
}

// Player 1: WASD - warm colors
const Player1 = createPlayer(20 + 4, 15 + 6, {
  body: '#e8c170',
  head: '#f5d6a8',
  hair: '#5a3a1a',
  legs: '#4a6fa5',
}, () => Input.getDirectionWASD(), 'KeyF', 'KeyE', 'KeyQ');

// Player 2: Arrows - cool colors
const Player2 = createPlayer(20 + 16, 15 + 8, {
  body: '#70b8e0',
  head: '#c8e0f0',
  hair: '#2a4a6a',
  legs: '#a05a4a',
}, () => Input.getDirectionArrows(), 'Slash', 'Period', 'Comma');
