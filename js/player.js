const FISH_TYPES = [
  { name: 'Bluegill',       weight: 40 },
  { name: 'Bass',           weight: 25 },
  { name: 'Trout',          weight: 15 },
  { name: 'Salmon',         weight: 10 },
  { name: 'Catfish',        weight: 5  },
  { name: 'Old Boot',       weight: 4  },
  { name: 'Treasure Chest', weight: 1  },
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

function pickFish(isNight) {
  const weights = FISH_TYPES.map((f, i) => {
    if (isNight) {
      return i < 2 ? f.weight * 0.5 : f.weight * 2;
    }
    return f.weight;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return FISH_TYPES[i].name;
  }
  return FISH_TYPES[0].name;
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

function createPlayer(startCol, startRow, colors, getDirection, actionKey, eatKey) {
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
    fishing: null,
    inventory: [],    // { name, cooked } for fish, { name, type:'treasure', heal } for loot
    eatMessage: null,  // { text, timer }
    gold: 0,
    hasGoldenRod: false,
    hp: 100,
    maxHp: 100,
    hungerTimer: 0,

    update(dt, otherPlayer) {
      const dir = this.getDirection();
      const wantsMove = dir.dx !== 0 || dir.dy !== 0;

      // Passive hunger drain — lose 1 HP every 15 seconds
      this.hungerTimer += dt;
      if (this.hungerTimer >= 15000) {
        this.hungerTimer -= 15000;
        if (this.hp > 1) this.hp -= 1;
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
              const oldHp = this.hp;
              this.hp = Math.min(this.maxHp, this.hp + item.heal);
              this.eatMessage = { text: `Used ${item.name}! +${this.hp - oldHp}HP`, timer: 2000 };
            } else {
              const heal = item.cooked ? 30 : 10;
              const oldHp = this.hp;
              this.hp = Math.min(this.maxHp, this.hp + heal);
              const healed = this.hp - oldHp;
              if (item.cooked) {
                this.eatMessage = { text: `Ate Cooked ${item.name}! +${healed}HP`, timer: 2000 };
              } else {
                this.eatMessage = { text: `Ate Raw ${item.name}... +${healed}HP`, timer: 2000 };
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

      // Fishing logic
      if (this.fishing) {
        if (wantsMove) {
          this.fishing = null;
        } else {
          this.fishing.timer -= dt;
          if (this.fishing.state === 'casting' && this.fishing.timer <= 0) {
            const isNight = typeof worldTime !== 'undefined' && (worldTime > 0.625 || worldTime < 0.125);
            const rodMult = this.hasGoldenRod ? 0.5 : 1;
            const waitTime = (isNight ? (2000 + Math.random() * 2000) : (3000 + Math.random() * 3000)) * rodMult;
            this.fishing.state = 'waiting';
            this.fishing.timer = waitTime;
          } else if (this.fishing.state === 'waiting' && this.fishing.timer <= 0) {
            const isNight = typeof worldTime !== 'undefined' && (worldTime > 0.625 || worldTime < 0.125);
            this.fishing.state = 'caught';
            this.fishing.fish = pickFish(isNight);
          } else if (this.fishing.state === 'caught' && Input.justPressed(this.actionKey)) {
            this.inventory.push({ name: this.fishing.fish, cooked: false });
            recordCatch(this.fishing.fish);
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
            timer: this.hasGoldenRod ? 250 : 500,
            castDuration: this.hasGoldenRod ? 250 : 500,
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
      const barY = sy - 4;
      // Background
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, barY, barW, barH);
      // Health fill
      const hpRatio = this.hp / this.maxHp;
      const hpColor = hpRatio > 0.5 ? '#4c4' : hpRatio > 0.25 ? '#cc4' : '#c44';
      ctx.fillStyle = hpColor;
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
      // Border
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(barX, barY, barW, barH);

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

        ctx.strokeStyle = this.hasGoldenRod ? '#ffd700' : '#8B7355';
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
}, () => Input.getDirectionWASD(), 'KeyF', 'KeyE');

// Player 2: Arrows - cool colors
const Player2 = createPlayer(20 + 16, 15 + 8, {
  body: '#70b8e0',
  head: '#c8e0f0',
  hair: '#2a4a6a',
  legs: '#a05a4a',
}, () => Input.getDirectionArrows(), 'Slash', 'Period');
