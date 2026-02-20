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

// Mini-game difficulty per rare fish — zoneW is fraction of bar width, speed is bar-widths/sec
const RARE_MINI_GAME = {
  'Sturgeon':      { zoneW: 0.38, speed: 0.45 },
  'Swordfish':     { zoneW: 0.28, speed: 0.62 },
  'Anglerfish':    { zoneW: 0.22, speed: 0.80 },
  'Legendary Koi': { zoneW: 0.14, speed: 1.05 },
};

// Bait types — index 0 is "no bait"
const BAIT_TYPES = [
  { name: 'No Bait',      color: '#666',    cost: 0,   amount: 0 },
  { name: 'Worm',          color: '#8B5E3C', cost: 10,  amount: 5 },
  { name: 'Shrimp',        color: '#E8A090', cost: 30,  amount: 5 },
  { name: 'Glowworm',      color: '#80FF80', cost: 75,  amount: 5 },
  { name: 'Golden Lure',   color: '#FFD700', cost: 200, amount: 3 },
];

// Net tiers — purchased at the net shop
const NET_TYPES = [
  { name: 'Basic Net',    color: '#a0c890', speedMult: 1.0,  rareMult: 1.0, cost: 60  },
  { name: 'Crab Net',     color: '#60a870', speedMult: 0.75, rareMult: 1.5, cost: 150 },
  { name: 'Lobster Trap', color: '#3a8850', speedMult: 0.5,  rareMult: 2.2, cost: 350 },
  { name: 'Deep Trap',    color: '#1a6030', speedMult: 0.35, rareMult: 3.5, cost: 800 },
];

// Shared achievement progress — read by game.js (loaded after player.js)
const achieveProgress = {
  fishCaught: 0,
  crustaceansCaught: 0,
  bootsCaught: 0,
  rareCaught: 0,
  nightCaught: 0,
  cooked: 0,
  eaten: 0,
  goldEarned: 0,
  sleeps: 0,
  npcTrades: 0,
  legendaryKoi: false,
};

// Crustaceans — caught with nets in water
const CRUSTACEAN_TYPES = [
  { name: 'Shrimp',         weight: 40 },
  { name: 'Crayfish',       weight: 25 },
  { name: 'Blue Crab',      weight: 15 },
  { name: 'Dungeness Crab', weight: 10 },
  { name: 'Lobster',        weight: 6  },
  { name: 'King Crab',      weight: 3  },
  { name: 'Giant Squid',    weight: 1  },
];

const TREASURE_LOOT = [
  { name: 'Golden Fish',    weight: 10, heal: 50, sell: 80  },
  { name: 'Pearl',          weight: 20, heal: 0,  sell: 50  },
  { name: 'Ruby',           weight: 15, heal: 0,  sell: 70  },
  { name: 'Ancient Coin',   weight: 25, heal: 0,  sell: 40  },
  { name: 'Magic Potion',   weight: 15, heal: 80, sell: 35  },
  { name: 'Diamond',        weight: 5,  heal: 0,  sell: 150 },
  { name: 'Crown',          weight: 2,  heal: 0,  sell: 250 },
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

function pickCrustacean(rareMult) {
  rareMult = rareMult || 1;
  const weights = CRUSTACEAN_TYPES.map((c, i) => i >= 3 ? c.weight * rareMult : c.weight);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return CRUSTACEAN_TYPES[i].name;
  }
  return CRUSTACEAN_TYPES[0].name;
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

function createPlayer(startCol, startRow, colors, getDirection, actionKey, eatKey, baitKey, netKey) {
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
    netTier: -1,           // -1 = no net, 0+ = net tier owned
    netting: null,         // active netting state
    netKey,
    inBed: false,          // waiting for the other player to sleep
    stats: {               // per-player statistics for leaderboard
      fishCaught: 0,
      crustaceansCaught: 0,
      goldEarned: 0,
      npcTrades: 0,
      cooked: 0,
      eaten: 0,
    },

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

      // In bed — frozen, waiting for the other player
      if (this.inBed) {
        if (Input.justPressed(this.eatKey)) {
          this.inBed = false;
          if (typeof sleepReady !== 'undefined') {
            if (this === Player1) sleepReady.p1 = false;
            else sleepReady.p2 = false;
          }
          this.eatMessage = { text: 'Got out of bed.', timer: 1500 };
        }
        this.moving = false;
        return;
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
                achieveProgress.eaten++;
                this.stats.eaten++;
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
        if (wantsMove && this.fishing.state !== 'minigame') {
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
            const isRare = RARE_FISH.some(r => r.name === this.fishing.fish);
            if (isRare) {
              // Start the timing mini-game
              const cfg = RARE_MINI_GAME[this.fishing.fish] || { zoneW: 0.30, speed: 0.55 };
              this.fishing.state = 'minigame';
              this.fishing.miniGame = {
                markerPos: 0,
                markerDir: 1,
                speed: cfg.speed,
                zoneStart: 0.5 - cfg.zoneW / 2,
                zoneEnd:   0.5 + cfg.zoneW / 2,
                result: null,
                resultTimer: 0,
              };
            } else {
              this.inventory.push({ name: this.fishing.fish, cooked: false });
              recordCatch(this.fishing.fish, this);
              const isNightCatch = typeof worldTime !== 'undefined' && (worldTime > 0.625 || worldTime < 0.125);
              if (isNightCatch && this.fishing.fish !== 'Old Boot' && this.fishing.fish !== 'Treasure Chest') {
                achieveProgress.nightCaught++;
              }
              // Consume bait
              if (this.fishing.usedBait > 0) {
                this.baitCounts[this.fishing.usedBait]--;
                if (this.baitCounts[this.baitType] <= 0) this.baitType = 0;
              }
              this.fishing = null;
            }
          } else if (this.fishing.state === 'minigame') {
            const mg = this.fishing.miniGame;
            if (mg.result) {
              // Waiting for result display to finish
              mg.resultTimer -= dt;
              if (mg.resultTimer <= 0) {
                if (mg.result === 'success') {
                  this.inventory.push({ name: this.fishing.fish, cooked: false });
                  recordCatch(this.fishing.fish, this);
                  const isNightCatch = typeof worldTime !== 'undefined' && (worldTime > 0.625 || worldTime < 0.125);
                  if (isNightCatch) achieveProgress.nightCaught++;
                  this.eatMessage = { text: `Caught ${this.fishing.fish}!`, timer: 2500 };
                } else {
                  this.eatMessage = { text: `${this.fishing.fish} got away!`, timer: 2500 };
                }
                if (this.fishing.usedBait > 0) {
                  this.baitCounts[this.fishing.usedBait]--;
                  if (this.baitCounts[this.baitType] <= 0) this.baitType = 0;
                }
                this.fishing = null;
              }
            } else {
              // Animate the marker
              mg.markerPos += mg.markerDir * mg.speed * dt / 1000;
              if (mg.markerPos >= 1) { mg.markerPos = 1; mg.markerDir = -1; }
              if (mg.markerPos <= 0) { mg.markerPos = 0; mg.markerDir = 1; }
              if (Input.justPressed(this.actionKey)) {
                const inZone = mg.markerPos >= mg.zoneStart && mg.markerPos <= mg.zoneEnd;
                mg.result = inZone ? 'success' : 'fail';
                mg.resultTimer = 1400;
              }
            }
          }
        }
        this.moving = false;
        return;
      }

      // Netting logic
      if (this.netting) {
        if (wantsMove) {
          this.netting = null;
        } else {
          this.netting.timer -= dt;
          if (this.netting.state === 'throwing' && this.netting.timer <= 0) {
            const waitTime = (3000 + Math.random() * 3000) * NET_TYPES[this.netTier].speedMult;
            this.netting.state = 'waiting';
            this.netting.timer = waitTime;
          } else if (this.netting.state === 'waiting' && this.netting.timer <= 0) {
            this.netting.state = 'caught';
            this.netting.crustacean = pickCrustacean(NET_TYPES[this.netTier].rareMult);
          } else if (this.netting.state === 'caught' && Input.justPressed(this.netKey)) {
            this.inventory.push({ name: this.netting.crustacean, cooked: false });
            recordCatch(this.netting.crustacean, this);
            this.netting = null;
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
        // Bed — both players must get in bed to sleep
        if (ft.tile === 9) {
          if (!sleepState.active) {
            const tod = getTimeOfDay();
            if (tod === 'Night' || tod === 'Dusk') {
              if (!this.inBed) {
                this.inBed = true;
                if (typeof sleepReady !== 'undefined') {
                  if (this === Player1) sleepReady.p1 = true;
                  else sleepReady.p2 = true;
                }
                fridgeMessage.text = 'In bed — waiting for the other player... (Eat key to cancel)';
                fridgeMessage.timer = 4000;
              }
            } else {
              fridgeMessage.text = 'Can only sleep at Night or Dusk!';
              fridgeMessage.timer = 2000;
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
        // Net shop — open net shop
        if (ft.tile === 15) {
          if (typeof netShopState !== 'undefined') {
            netShopState.open = true;
            netShopState.player = this;
          }
          return;
        }
        // Furnace — cook a raw fish
        if (ft.tile === 11) {
          const rawIdx = this.inventory.findIndex(f => !f.cooked && f.name !== 'Old Boot' && f.name !== 'Treasure Chest');
          if (rawIdx !== -1) {
            this.inventory[rawIdx].cooked = true;
            achieveProgress.cooked++;
            this.stats.cooked++;
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

      // Net key — cast net into facing water tile
      if (Input.justPressed(this.netKey)) {
        if (this.netTier < 0) {
          this.eatMessage = { text: 'Need a net! Visit the Net Shop.', timer: 2000 };
        } else {
          const ft = getFacingTile(this);
          if (ft.tile === 2) {
            this.netting = {
              state: 'throwing',
              timer: 600,
              throwDuration: 600,
              targetX: ft.col * TILE + TILE / 2,
              targetY: ft.row * TILE + TILE / 2,
              crustacean: null,
            };
            this.moving = false;
          } else {
            this.eatMessage = { text: 'Face water to cast net!', timer: 1500 };
          }
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

      // Zzz above head when in bed waiting
      if (this.inBed) {
        const zSize = 9 + Math.sin(Date.now() / 500) * 2;
        ctx.fillStyle = '#90c8f0';
        ctx.font = `bold ${Math.round(zSize)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('Zzz', sx + this.w / 2, sy - 14);
        ctx.textAlign = 'left';
      }

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

      // Netting visuals
      if (this.netting) {
        const netSX = this.netting.targetX - camera.x;
        const netSY = this.netting.targetY - camera.y;
        const handX = sx + this.w / 2;
        const handY = sy + this.h / 2;

        ctx.strokeStyle = NET_TYPES[this.netTier].color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(handX, handY);
        if (this.netting.state === 'throwing') {
          const prog = 1 - (this.netting.timer / (this.netting.throwDuration || 600));
          ctx.lineTo(handX + (netSX - handX) * prog, handY + (netSY - handY) * prog);
        } else {
          ctx.lineTo(netSX, netSY);
        }
        ctx.stroke();

        if (this.netting.state !== 'throwing') {
          const pulse = Math.sin(Date.now() / 400) * 2;
          ctx.strokeStyle = NET_TYPES[this.netTier].color;
          ctx.lineWidth = 1;
          // Draw net circle
          ctx.beginPath();
          ctx.arc(netSX, netSY, 8 + pulse, 0, Math.PI * 2);
          ctx.stroke();
          // Cross lines inside circle
          ctx.beginPath();
          ctx.moveTo(netSX - 6, netSY); ctx.lineTo(netSX + 6, netSY);
          ctx.moveTo(netSX, netSY - 6); ctx.lineTo(netSX, netSY + 6);
          ctx.stroke();
        }

        if (this.netting.state === 'caught') {
          ctx.fillStyle = '#ffff00';
          ctx.font = 'bold 16px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('!', sx + this.w / 2, sy - 12);
          ctx.textAlign = 'left';
          ctx.fillStyle = '#a0f0c0';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(this.netting.crustacean, sx + this.w / 2, sy - 22);
          ctx.textAlign = 'left';
        }
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
}, () => Input.getDirectionWASD(), 'KeyF', 'KeyE', 'KeyQ', 'KeyG');

// Player 2: Arrows - cool colors
const Player2 = createPlayer(20 + 16, 15 + 8, {
  body: '#70b8e0',
  head: '#c8e0f0',
  hair: '#2a4a6a',
  legs: '#a05a4a',
}, () => Input.getDirectionArrows(), 'Slash', 'Period', 'Comma', 'KeyM');
