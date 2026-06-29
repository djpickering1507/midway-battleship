const SHIPS = [
  { name: 'USS Yorktown (CV-5)', size: 5 },
  { name: 'USS Enterprise (CV-6)', size: 4 },
  { name: 'USS Hornet (CV-8)', size: 3 },
  { name: 'USS Astoria (CA-34)', size: 3 },
  { name: 'USS Hammann (DD-412)', size: 2 },
];

const JP_SHIPS = [
  { name: 'IJN Akagi', size: 5 },
  { name: 'IJN Kaga', size: 4 },
  { name: 'IJN Sōryū', size: 3 },
  { name: 'IJN Hiryū', size: 3 },
  { name: 'IJN Nagara', size: 2 },
];

const SIZE = 10;
const COLS = 'ABCDEFGHIJ';

function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function placeShips(shipDefs) {
  const grid = emptyGrid();
  const placed = [];
  for (const def of shipDefs) {
    let ok = false, attempts = 0;
    while (!ok && attempts < 1000) {
      attempts++;
      const horiz = Math.random() < 0.5;
      const r = Math.floor(Math.random() * (SIZE - (horiz ? 0 : def.size)));
      const c = Math.floor(Math.random() * (SIZE - (horiz ? def.size : 0)));
      let clear = true;
      for (let i = 0; i < def.size; i++) {
        const rr = horiz ? r : r + i, cc = horiz ? c + i : c;
        if (grid[rr][cc] !== 0) { clear = false; break; }
      }
      if (clear) {
        const cells = [];
        for (let i = 0; i < def.size; i++) {
          const rr = horiz ? r : r + i, cc = horiz ? c + i : c;
          grid[rr][cc] = placed.length + 1;
          cells.push([rr, cc]);
        }
        placed.push({ ...def, cells, hits: 0, sunk: false });
        ok = true;
      }
    }
  }
  return { grid, placed };
}

function registerHit(ships, grid, r, c) {
  const idx = grid[r][c] - 1;
  const ship = ships[idx];
  ship.hits++;
  if (ship.hits >= ship.size) {
    ship.sunk = true;
    ship.cells.forEach(([rr, cc]) => { grid[rr][cc] = 'sunk'; });
    return { sunk: true, ship };
  }
  grid[r][c] = 'hit';
  return { sunk: false, ship };
}

function allSunk(ships) {
  return ships.every(s => s.sunk);
}

function createAI() {
  return { mode: 'hunt', queue: [], tried: new Set() };
}

function aiSelectTarget(ai, playerBoard) {
  let r, c, found = false;

  if (ai.mode === 'destroy' && ai.queue.length > 0) {
    while (ai.queue.length > 0) {
      const [pr, pc] = ai.queue.shift();
      if (pr >= 0 && pr < SIZE && pc >= 0 && pc < SIZE && !ai.tried.has(pr + ',' + pc)) {
        r = pr; c = pc; found = true; break;
      }
    }
    if (!found) ai.mode = 'hunt';
  }

  if (!found) {
    ai.mode = 'hunt';
    let attempts = 0;
    do {
      r = Math.floor(Math.random() * SIZE);
      c = Math.floor(Math.random() * SIZE);
      attempts++;
    } while (ai.tried.has(r + ',' + c) && attempts < 200);
  }

  return { r, c };
}

function processAIShot(ai, playerBoard, playerShips, r, c) {
  ai.tried.add(r + ',' + c);
  const v = playerBoard[r][c];

  if (typeof v === 'number' && v > 0) {
    const { sunk, ship } = registerHit(playerShips, playerBoard, r, c);
    if (sunk) {
      ai.mode = 'hunt';
      ai.queue = [];
      return { hit: true, sunk: true, ship, allSunk: allSunk(playerShips) };
    } else {
      ai.mode = 'destroy';
      [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !ai.tried.has(nr + ',' + nc)) {
          ai.queue.push([nr, nc]);
        }
      });
      return { hit: true, sunk: false, ship, allSunk: false };
    }
  } else {
    if (v === 0) playerBoard[r][c] = 'miss';
    return { hit: false, sunk: false, ship: null, allSunk: false };
  }
}

function processPlayerShot(enemyBoard, enemyShips, r, c) {
  const v = enemyBoard[r][c];
  if (v === 'hit' || v === 'miss' || v === 'sunk') {
    return { alreadyShot: true, hit: false, sunk: false, ship: null, allSunk: false };
  }
  if (typeof v === 'number' && v > 0) {
    const { sunk, ship } = registerHit(enemyShips, enemyBoard, r, c);
    return { alreadyShot: false, hit: true, sunk, ship, allSunk: allSunk(enemyShips) };
  }
  enemyBoard[r][c] = 'miss';
  return { alreadyShot: false, hit: false, sunk: false, ship: null, allSunk: false };
}

function coordLabel(r, c) {
  return COLS[c] + (r + 1);
}

module.exports = {
  SHIPS,
  JP_SHIPS,
  SIZE,
  COLS,
  emptyGrid,
  placeShips,
  registerHit,
  allSunk,
  createAI,
  aiSelectTarget,
  processAIShot,
  processPlayerShot,
  coordLabel,
};
