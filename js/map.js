const TILE = 32;

// Tile types: 0=grass, 1=wall, 2=water, 3=path, 4=tree, 5=house_wall, 6=door, 7=house_floor, 8=furniture, 9=bed, 10=fridge, 11=furnace, 12=trashcan, 13=shop, 14=baitshop
const TILE_COLORS = {
  0: '#4a7c3f', // grass
  1: '#6b6b6b', // wall
  2: '#3b6ea5', // water
  3: '#c2a85d', // path
  4: '#2d5a1e', // tree
  5: '#8b6f47', // house wall
  6: '#5a3a1a', // door
  7: '#b89a6a', // house floor
  8: '#6e4e2e', // furniture
  9: '#b89a6a', // bed (floor color, drawn over)
  10: '#b89a6a', // fridge (floor color, drawn over)
  11: '#4a7c3f', // furnace (grass base, drawn over)
  12: '#4a7c3f', // trashcan (grass base, drawn over)
  13: '#4a7c3f', // shop counter (grass base, drawn over)
  14: '#4a7c3f', // bait shop counter (grass base, drawn over)
};

const SOLID_TILES = new Set([1, 2, 4, 5, 8, 9, 10, 11, 12, 13, 14]);

const CHUNK_COLS = 20;
const CHUNK_ROWS = 15;

// ── Chunk definitions ──────────────────────────────────────────────────
// Each chunk is { data: 20x15 array, houses: [] }
// Edge conventions for seamless paths:
//   Vertical path openings:   col 7=0, col 8=3, col 9=0
//   Horizontal path openings: row 8=0, row 9=3, row 10=0

const CHUNK_FOREST_NW = { data: [
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,0,0,0,0,0,4,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,0,0,0,0,0,0,0,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,0,0,0,0,0,0,0,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,0,0,0,0,0,0,0,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,0,0,0,0,3,3,3,3,3,3,3,3,3,3,3,0],
  [4,4,4,4,4,4,4,0,3,0,4,4,4,4,4,4,4,4,4,3],
  [4,4,4,4,4,4,4,0,0,0,4,4,4,4,4,4,4,4,4,0],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
], houses: [] };

const CHUNK_FOREST_N = { data: [
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,4,0,0,0,4,4,4,4,4,4,4,4,4,4,0,0,4,4,4],
  [4,0,0,0,0,0,4,4,4,4,4,4,4,4,0,0,0,0,4,4],
  [4,0,0,0,0,0,4,4,4,4,4,4,4,4,0,0,0,0,4,4],
  [4,4,0,0,0,4,4,4,4,4,4,4,4,4,4,0,0,4,4,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,4,4,4,0,3,0,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,4,4,0,0,3,0,0,4,4,4,4,4,4,4,4,4],
  [0,3,3,3,3,3,3,0,3,0,0,3,3,3,3,3,3,3,3,0],
  [3,4,4,4,4,4,4,0,3,0,4,4,4,4,4,4,4,4,4,3],
  [0,4,4,4,4,4,0,0,3,0,0,4,4,4,4,4,4,4,4,0],
  [4,4,4,4,4,4,4,0,3,0,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,4,4,4,0,3,0,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,4,4,4,0,3,0,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,4,4,4,0,3,0,4,4,4,4,4,4,4,4,4,4],
], houses: [] };

const CHUNK_FOREST_NE = { data: [
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,4,4,4,4,4,4,2,2,2,2,4,4,4,4,4,4],
  [4,4,4,4,4,4,4,4,4,2,2,2,2,2,2,4,4,4,4,4],
  [4,4,4,4,4,4,4,4,2,2,2,2,2,2,2,4,4,4,4,4],
  [4,4,4,4,4,4,4,4,2,2,2,2,2,2,4,4,4,4,4,4],
  [4,4,4,4,4,4,4,4,4,2,2,2,2,4,4,4,4,4,4,4],
  [0,3,3,3,3,3,3,0,4,4,2,2,4,4,4,4,4,4,4,4],
  [3,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [0,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
], houses: [] };

const CHUNK_PLAINS = { data: [
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,4,4,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,4,4,0,0,0,0,4],
  [4,0,0,0,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [4,0,0,0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
  [4,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0],
  [4,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,4],
  [4,4,4,4,4,4,4,0,3,0,4,4,4,4,4,4,4,4,4,4],
], houses: [] };

const CHUNK_VILLAGE = { data: [
  [4,4,4,4,4,4,4,0,3,0,4,4,2,2,2,4,4,4,4,4],
  [4,0,5,5,5,5,5,0,3,0,0,0,2,2,2,0,0,0,0,4],
  [4,0,5,7,7,7,5,0,3,0,0,0,0,2,0,0,0,0,0,4],
  [4,0,5,9,7,7,5,0,3,0,0,0,0,0,5,5,5,5,5,4],
  [4,0,5,7,7,10,5,0,3,0,0,0,0,0,5,7,7,9,5,4],
  [4,0,5,5,6,5,5,0,3,0,0,0,0,0,5,7,7,7,5,4],
  [4,0,12,0,3,0,11,0,3,0,0,4,4,0,5,10,7,7,5,4],
  [4,0,0,0,3,3,3,3,3,0,0,4,4,0,5,5,6,5,5,4],
  [0,0,0,0,0,0,0,0,3,0,0,0,0,11,0,0,3,12,0,0],
  [3,0,0,0,0,0,0,0,3,3,3,3,3,3,3,3,3,0,0,3],
  [0,0,0,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [4,0,0,4,4,0,0,0,0,0,0,0,0,4,4,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,4,4,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,4,4,4,4,4,4,0,3,0,4,4,4,4,4,4,4,4,4,4],
], houses: [
  {
    roof: { col: 2, row: 1, w: 5, h: 5 },
    inside: { col: 3, row: 2, w: 3, h: 3 },
    doorCol: 4, doorRow: 5,
  },
  {
    roof: { col: 14, row: 3, w: 5, h: 5 },
    inside: { col: 15, row: 4, w: 3, h: 3 },
    doorCol: 16, doorRow: 7,
  },
] };

const CHUNK_LAKE = { data: [
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
  [4,0,0,5,5,5,0,0,0,4,4,4,4,4,4,4,4,4,0,4],
  [4,0,0,5,13,5,0,0,0,4,2,2,2,2,2,4,4,0,0,4],
  [4,0,0,0,3,0,0,0,4,2,2,2,2,2,2,2,4,0,0,4],
  [4,0,0,0,0,0,0,4,2,2,2,2,2,2,2,2,2,0,0,4],
  [4,0,0,0,0,0,0,4,2,2,2,2,2,2,2,2,0,0,0,4],
  [4,0,0,0,0,0,0,0,4,2,2,2,2,2,2,4,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,4,2,2,2,2,4,0,0,0,0,4],
  [0,0,0,0,0,0,0,0,0,0,4,2,2,4,0,0,0,0,0,4],
  [3,3,3,3,3,3,3,0,3,0,0,0,0,0,0,0,0,0,0,4],
  [0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,4],
  [4,4,4,4,4,4,4,0,3,0,4,4,4,4,4,4,4,4,4,4],
], houses: [] };

const CHUNK_MEADOW = { data: [
  [4,4,4,4,4,4,4,0,3,0,4,4,4,4,4,4,4,4,4,4],
  [4,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,5,5,5,5,0,3,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,5,7,7,5,0,3,0,0,0,0,4,4,0,0,0,0,4],
  [4,0,0,5,9,7,5,0,3,0,0,0,0,4,4,0,0,0,0,4],
  [4,0,0,5,5,6,5,0,3,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,3,3,3,3,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0],
  [4,0,0,0,0,0,0,0,3,3,3,3,3,3,3,3,3,3,3,3],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,2,2,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,2,2,2,2,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,2,2,0,0,0,0,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
], houses: [
  {
    roof: { col: 3, row: 3, w: 4, h: 4 },
    inside: { col: 4, row: 4, w: 2, h: 2 },
    doorCol: 5, doorRow: 6,
  },
] };

const CHUNK_FARM = { data: [
  [4,4,4,4,4,4,4,0,3,0,4,4,4,4,4,4,4,4,4,4],
  [4,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,3,3,3,3,0,0,0,0,0,0,0,4],
  [4,0,0,1,1,0,0,0,0,0,0,3,0,0,1,1,0,0,0,4],
  [4,0,0,1,1,0,0,0,0,0,0,3,0,0,1,1,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,3,3,3,0,0,0,0,0,4],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0],
  [3,3,3,3,3,0,0,0,0,0,0,0,0,3,0,0,0,3,3,3],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,0,0,0,0],
  [4,0,0,1,1,0,0,0,0,0,0,0,0,0,0,3,0,0,0,4],
  [4,0,0,1,1,0,0,0,0,0,0,0,0,0,0,3,3,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
], houses: [] };

const CHUNK_SWAMP = { data: [
  [4,4,4,4,4,4,4,0,3,0,4,4,4,4,4,4,4,4,4,4],
  [4,0,0,0,2,2,0,0,3,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,2,2,2,2,0,3,0,0,0,0,0,0,2,2,0,0,4],
  [4,0,0,0,2,2,0,0,3,0,5,5,5,0,2,2,2,2,0,4],
  [4,0,0,0,0,0,0,0,3,0,5,14,5,0,0,2,2,0,0,4],
  [4,0,0,0,0,0,0,0,3,3,3,3,0,0,0,0,0,0,0,4],
  [4,0,0,2,2,0,0,0,3,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,2,2,2,2,0,0,3,0,0,0,0,2,2,0,0,0,0,4],
  [0,0,0,2,2,0,0,0,3,0,0,0,2,2,2,2,0,0,0,4],
  [3,3,3,3,3,3,3,3,3,0,0,0,0,2,2,0,0,0,0,4],
  [0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,4],
  [4,0,0,0,0,0,4,4,0,0,0,0,0,0,0,2,2,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,0,0,4],
  [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,4],
  [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
], houses: [] };

// ── World grid (3x3 chunks) ───────────────────────────────────────────
const WORLD_GRID = [
  [CHUNK_FOREST_NW, CHUNK_FOREST_N, CHUNK_FOREST_NE],
  [CHUNK_PLAINS,    CHUNK_VILLAGE,   CHUNK_LAKE      ],
  [CHUNK_MEADOW,    CHUNK_FARM,      CHUNK_SWAMP     ],
];

const WORLD_COLS = WORLD_GRID[0].length; // 3 chunks wide
const WORLD_ROWS = WORLD_GRID.length;    // 3 chunks tall

// ── Build global HOUSES array with world offsets ──────────────────────
const HOUSES = [];
for (let gr = 0; gr < WORLD_ROWS; gr++) {
  for (let gc = 0; gc < WORLD_COLS; gc++) {
    const chunk = WORLD_GRID[gr][gc];
    const offCol = gc * CHUNK_COLS;
    const offRow = gr * CHUNK_ROWS;
    for (const h of chunk.houses) {
      HOUSES.push({
        roof: {
          col: h.roof.col + offCol,
          row: h.roof.row + offRow,
          w: h.roof.w,
          h: h.roof.h,
        },
        inside: {
          col: h.inside.col + offCol,
          row: h.inside.row + offRow,
          w: h.inside.w,
          h: h.inside.h,
        },
        doorCol: h.doorCol + offCol,
        doorRow: h.doorRow + offRow,
      });
    }
  }
}

function isPlayerInHouse(player, house) {
  const pcol = Math.floor((player.x + player.w / 2) / TILE);
  const prow = Math.floor((player.y + player.h / 2) / TILE);
  const ins = house.inside;
  return (
    (pcol >= ins.col && pcol < ins.col + ins.w && prow >= ins.row && prow < ins.row + ins.h) ||
    (pcol === house.doorCol && prow === house.doorRow)
  );
}

const GameMap = {
  cols: WORLD_COLS * CHUNK_COLS,   // 60
  rows: WORLD_ROWS * CHUNK_ROWS,   // 45
  widthPx: WORLD_COLS * CHUNK_COLS * TILE,
  heightPx: WORLD_ROWS * CHUNK_ROWS * TILE,

  getTile(col, row) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return 1;
    const gc = Math.floor(col / CHUNK_COLS);
    const gr = Math.floor(row / CHUNK_ROWS);
    const chunk = WORLD_GRID[gr][gc];
    return chunk.data[row - gr * CHUNK_ROWS][col - gc * CHUNK_COLS];
  },

  isSolid(col, row) {
    return SOLID_TILES.has(this.getTile(col, row));
  },

  draw(ctx, camera) {
    const startCol = Math.max(0, Math.floor(camera.x / TILE));
    const startRow = Math.max(0, Math.floor(camera.y / TILE));
    const endCol = Math.min(this.cols, Math.ceil((camera.x + camera.w) / TILE) + 1);
    const endRow = Math.min(this.rows, Math.ceil((camera.y + camera.h) / TILE) + 1);

    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const tile = this.getTile(c, r);
        const x = c * TILE - camera.x;
        const y = r * TILE - camera.y;

        ctx.fillStyle = TILE_COLORS[tile] || '#000';
        ctx.fillRect(x, y, TILE, TILE);

        // Tree detail
        if (tile === 4) {
          ctx.fillStyle = '#1a4010';
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, 10, 0, Math.PI * 2);
          ctx.fill();
        }

        // Water detail
        if (tile === 2) {
          ctx.fillStyle = 'rgba(255,255,255,0.1)';
          ctx.fillRect(x + 4, y + 8, 12, 2);
          ctx.fillRect(x + 16, y + 20, 10, 2);
        }

        // Door detail
        if (tile === 6) {
          ctx.fillStyle = '#3a2510';
          ctx.fillRect(x + 8, y + 4, 16, 28);
          ctx.fillStyle = '#d4a030';
          ctx.fillRect(x + 20, y + 16, 3, 3);
        }

        // Furniture detail (table/chest)
        if (tile === 8) {
          ctx.fillStyle = '#b89a6a';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#5a3e1e';
          ctx.fillRect(x + 4, y + 4, 24, 24);
          ctx.fillStyle = '#7a5e3e';
          ctx.fillRect(x + 6, y + 6, 20, 20);
          ctx.fillStyle = '#d4a030';
          ctx.fillRect(x + 14, y + 14, 4, 4);
        }

        // Bed detail
        if (tile === 9) {
          // Floor base
          ctx.fillStyle = '#b89a6a';
          ctx.fillRect(x, y, TILE, TILE);
          // Bed frame
          ctx.fillStyle = '#5a3e1e';
          ctx.fillRect(x + 2, y + 2, 28, 28);
          // Mattress
          ctx.fillStyle = '#e8e0d0';
          ctx.fillRect(x + 4, y + 4, 24, 24);
          // Pillow
          ctx.fillStyle = '#f5f0e8';
          ctx.fillRect(x + 6, y + 4, 10, 8);
          // Blanket
          ctx.fillStyle = '#4a6fa5';
          ctx.fillRect(x + 4, y + 14, 24, 14);
          ctx.fillStyle = '#3a5f95';
          ctx.fillRect(x + 4, y + 20, 24, 8);
        }

        // Fridge detail
        if (tile === 10) {
          // Floor base
          ctx.fillStyle = '#b89a6a';
          ctx.fillRect(x, y, TILE, TILE);
          // Fridge body
          ctx.fillStyle = '#d0d8e0';
          ctx.fillRect(x + 4, y + 2, 24, 28);
          // Fridge outline
          ctx.fillStyle = '#b0b8c0';
          ctx.fillRect(x + 4, y + 2, 24, 2);
          ctx.fillRect(x + 4, y + 28, 24, 2);
          ctx.fillRect(x + 4, y + 2, 2, 28);
          ctx.fillRect(x + 26, y + 2, 2, 28);
          // Divider line (freezer/fridge)
          ctx.fillStyle = '#a0a8b0';
          ctx.fillRect(x + 6, y + 14, 20, 2);
          // Handle
          ctx.fillStyle = '#707880';
          ctx.fillRect(x + 22, y + 8, 2, 4);
          ctx.fillRect(x + 22, y + 18, 2, 4);
        }

        // Furnace detail
        if (tile === 11) {
          // Stone base
          ctx.fillStyle = '#5a5a5a';
          ctx.fillRect(x + 3, y + 4, 26, 26);
          // Inner stone
          ctx.fillStyle = '#707070';
          ctx.fillRect(x + 5, y + 6, 22, 22);
          // Fire opening
          ctx.fillStyle = '#2a2a2a';
          ctx.fillRect(x + 8, y + 16, 16, 12);
          // Fire glow
          ctx.fillStyle = '#e05020';
          ctx.fillRect(x + 10, y + 20, 12, 6);
          ctx.fillStyle = '#f0a030';
          ctx.fillRect(x + 12, y + 22, 8, 3);
          // Chimney
          ctx.fillStyle = '#5a5a5a';
          ctx.fillRect(x + 12, y + 2, 8, 6);
          ctx.fillStyle = '#707070';
          ctx.fillRect(x + 13, y + 2, 6, 4);
        }

        // Shop counter detail
        if (tile === 13) {
          // Counter body
          ctx.fillStyle = '#6e4e2e';
          ctx.fillRect(x + 2, y + 6, 28, 22);
          // Counter top
          ctx.fillStyle = '#8b6f47';
          ctx.fillRect(x + 1, y + 4, 30, 6);
          // Sign board
          ctx.fillStyle = '#c09050';
          ctx.fillRect(x + 6, y - 2, 20, 8);
          ctx.fillStyle = '#3a6ea5';
          ctx.font = 'bold 7px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('RODS', x + TILE / 2, y + 4);
          ctx.textAlign = 'left';
          // Fish icon on counter
          ctx.fillStyle = '#3b6ea5';
          ctx.fillRect(x + 10, y + 12, 12, 6);
          ctx.fillStyle = '#5090c0';
          ctx.fillRect(x + 11, y + 13, 10, 4);
        }

        // Bait shop counter detail
        if (tile === 14) {
          // Counter body
          ctx.fillStyle = '#4e3e2e';
          ctx.fillRect(x + 2, y + 6, 28, 22);
          // Counter top
          ctx.fillStyle = '#6b5f47';
          ctx.fillRect(x + 1, y + 4, 30, 6);
          // Sign board
          ctx.fillStyle = '#6a9a5a';
          ctx.fillRect(x + 6, y - 2, 20, 8);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 7px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('BAIT', x + TILE / 2, y + 4);
          ctx.textAlign = 'left';
          // Worm icon on counter
          ctx.fillStyle = '#8B5E3C';
          ctx.beginPath();
          ctx.arc(x + 12, y + 15, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#E8A090';
          ctx.beginPath();
          ctx.arc(x + 20, y + 17, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Trash can detail
        if (tile === 12) {
          // Can body
          ctx.fillStyle = '#666';
          ctx.fillRect(x + 8, y + 8, 16, 20);
          // Can taper at bottom
          ctx.fillStyle = '#555';
          ctx.fillRect(x + 10, y + 24, 12, 4);
          // Lid
          ctx.fillStyle = '#777';
          ctx.fillRect(x + 6, y + 6, 20, 4);
          // Lid handle
          ctx.fillStyle = '#888';
          ctx.fillRect(x + 14, y + 3, 4, 4);
          // Ridges
          ctx.fillStyle = '#5a5a5a';
          ctx.fillRect(x + 8, y + 14, 16, 1);
          ctx.fillRect(x + 8, y + 20, 16, 1);
        }

        // House floor plank lines
        if (tile === 7) {
          ctx.strokeStyle = 'rgba(0,0,0,0.1)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y + 8); ctx.lineTo(x + TILE, y + 8);
          ctx.moveTo(x, y + 16); ctx.lineTo(x + TILE, y + 16);
          ctx.moveTo(x, y + 24); ctx.lineTo(x + TILE, y + 24);
          ctx.stroke();
        }
      }
    }
  },

  drawRoofs(ctx, camera, players) {
    for (const house of HOUSES) {
      const anyoneInside = players.some(p => isPlayerInHouse(p, house));
      if (anyoneInside) continue;

      const r = house.roof;
      const px = r.col * TILE - camera.x;
      const py = r.row * TILE - camera.y;
      const pw = r.w * TILE;
      const ph = r.h * TILE;

      // Main roof body
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(px, py, pw, ph);

      // Roof peak (triangle top)
      ctx.fillStyle = '#a0522d';
      ctx.beginPath();
      ctx.moveTo(px - 4, py + ph * 0.45);
      ctx.lineTo(px + pw / 2, py - 8);
      ctx.lineTo(px + pw + 4, py + ph * 0.45);
      ctx.closePath();
      ctx.fill();

      // Roof ridge line
      ctx.strokeStyle = '#6b3410';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px - 4, py + ph * 0.45);
      ctx.lineTo(px + pw / 2, py - 8);
      ctx.lineTo(px + pw + 4, py + ph * 0.45);
      ctx.stroke();

      // Horizontal plank lines on roof body
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      for (let i = 1; i < r.h; i++) {
        const ly = py + i * TILE;
        ctx.beginPath();
        ctx.moveTo(px, ly);
        ctx.lineTo(px + pw, ly);
        ctx.stroke();
      }
    }
  }
};
