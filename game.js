'use strict';

/* ===== SHIP DEFINITIONS — historically accurate for Midway ===== */
const US_SHIPS = [
  { name: 'USS Yorktown (CV-5)',    size: 5, type: 'Carrier' },
  { name: 'USS Enterprise (CV-6)',  size: 4, type: 'Carrier' },
  { name: 'USS Hornet (CV-8)',      size: 3, type: 'Carrier' },
  { name: 'USS Astoria (CA-34)',    size: 3, type: 'Cruiser' },
  { name: 'USS Hammann (DD-412)',   size: 2, type: 'Destroyer' },
];
const JP_SHIPS = [
  { name: 'IJN Akagi',   size: 5, type: 'Carrier' },
  { name: 'IJN Kaga',    size: 4, type: 'Carrier' },
  { name: 'IJN S\u014dry\u016b',  size: 3, type: 'Carrier' },
  { name: 'IJN Hiry\u016b',  size: 3, type: 'Carrier' },
  { name: 'IJN Nagara',  size: 2, type: 'Cruiser' },
];

const GRID = 10;
const COLS = 'ABCDEFGHIJ';

let playerGrid, enemyGrid, playerShips, enemyShips;
let turn, gameOver, playerShotCount, aiShotCount, combatLog;
let ai;

/* ===== GRID & PLACEMENT ===== */
function emptyGrid() {
  return Array.from({ length: GRID }, () => Array(GRID).fill(0));
}

function placeShips(defs) {
  const grid = emptyGrid();
  const ships = [];
  for (const def of defs) {
    let placed = false;
    for (let attempt = 0; attempt < 2000 && !placed; attempt++) {
      const horiz = Math.random() < 0.5;
      const r = Math.floor(Math.random() * (horiz ? GRID : GRID - def.size));
      const c = Math.floor(Math.random() * (horiz ? GRID - def.size : GRID));
      let clear = true;
      for (let i = 0; i < def.size && clear; i++) {
        const rr = horiz ? r : r + i;
        const cc = horiz ? c + i : c;
        if (grid[rr][cc] !== 0) clear = false;
      }
      if (clear) {
        const cells = [];
        for (let i = 0; i < def.size; i++) {
          const rr = horiz ? r : r + i;
          const cc = horiz ? c + i : c;
          grid[rr][cc] = ships.length + 1;
          cells.push([rr, cc]);
        }
        ships.push({ ...def, cells, hits: 0, sunk: false, horiz });
        placed = true;
      }
    }
  }
  return { grid, ships };
}

/* ===== GAME INIT ===== */
function startGame() {
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('main').style.display = 'block';
  resetGame();
}

function resetGame() {
  const p = placeShips(US_SHIPS);
  const e = placeShips(JP_SHIPS);
  playerGrid = p.grid; playerShips = p.ships;
  enemyGrid = e.grid;  enemyShips = e.ships;
  turn = 'player'; gameOver = false;
  playerShotCount = 0; aiShotCount = 0;
  combatLog = [];
  ai = {
    mode: 'hunt',
    targets: [],
    hits: [],
    tried: new Set()
  };
  renderBoards();
  setStatus('\u{1F4E1}', 'Awaiting your orders, Admiral. Select a target in enemy waters.');
  setBadge('player');
  updateFleets();
  updateShotCounts();
  renderLog();
}

/* ===== RENDERING ===== */
function cellRef(r, c) { return COLS[c] + (r + 1); }

function renderBoard(id, grid, isEnemy) {
  const tbl = document.getElementById(id);
  let html = '<tr><td class="coord-cell"><span></span></td>';
  for (let c = 0; c < GRID; c++) html += '<td class="coord-cell"><span>' + COLS[c] + '</span></td>';
  html += '</tr>';
  for (let r = 0; r < GRID; r++) {
    html += '<tr><td class="coord-cell"><span>' + (r + 1) + '</span></td>';
    for (let c = 0; c < GRID; c++) {
      const v = grid[r][c];
      let cls = 'water', content = '';
      if (v === 'hit')       { cls = 'ship-hit'; content = '\u2715'; }
      else if (v === 'sunk') { cls = 'sunk';     content = '\u2715'; }
      else if (v === 'miss') { cls = 'miss';     content = '\u00B7'; }
      else if (!isEnemy && typeof v === 'number' && v > 0) { cls = 'ship-show'; }
      const clickable = isEnemy && !gameOver && v !== 'hit' && v !== 'miss' && v !== 'sunk';
      if (clickable) cls += ' enemy-target';
      html += '<td class="' + cls + '"' + (clickable ? ' data-r="' + r + '" data-c="' + c + '"' : '') + '><span>' + content + '</span></td>';
    }
    html += '</tr>';
  }
  tbl.innerHTML = html;
}

function renderBoards() {
  renderBoard('player-board', playerGrid, false);
  renderBoard('enemy-board', enemyGrid, true);
}

function animateCell(boardId, r, c, animClass) {
  const tbl = document.getElementById(boardId);
  if (!tbl) return;
  const row = tbl.rows[r + 1];
  if (!row) return;
  const cell = row.cells[c + 1];
  if (!cell) return;
  cell.classList.add(animClass);
  setTimeout(function() { cell.classList.remove(animClass); }, 600);
}

function setStatus(icon, msg) {
  document.getElementById('status-icon').textContent = icon;
  document.getElementById('status-text').textContent = msg;
}

function setBadge(who) {
  const el = document.getElementById('turn-badge');
  if (who === 'player') {
    el.className = 'turn-badge turn-us'; el.textContent = 'Your turn';
  } else if (who === 'ai') {
    el.className = 'turn-badge turn-jp'; el.textContent = 'IJN firing...';
  } else {
    el.className = 'turn-badge turn-over'; el.textContent = 'Battle over';
  }
}

function updateShotCounts() {
  document.getElementById('jp-shots').textContent = 'Shots: ' + playerShotCount;
  document.getElementById('us-shots').textContent = 'Shots: ' + aiShotCount;
}

function updateFleets() {
  var usEl = document.getElementById('us-fleet');
  usEl.textContent = '';
  playerShips.forEach(function(s) {
    var div = document.createElement('div');
    div.className = 'ship-row' + (s.sunk ? ' sunk-ship' : '');
    var pipsSpan = document.createElement('span');
    pipsSpan.className = 'ship-pips';
    for (var i = 0; i < s.size; i++) {
      var pip = document.createElement('span');
      pip.className = 'pip' + (i < s.hits ? ' pip-hit' : '');
      pipsSpan.appendChild(pip);
    }
    div.appendChild(pipsSpan);
    div.appendChild(document.createTextNode(' ' + (s.sunk ? '\u2620 ' : '\u25B8 ') + s.name));
    usEl.appendChild(div);
  });

  var jpEl = document.getElementById('jp-fleet');
  jpEl.textContent = '';
  enemyShips.forEach(function(s) {
    var div = document.createElement('div');
    div.className = 'ship-row' + (s.sunk ? ' sunk-ship' : '');
    var pipsSpan = document.createElement('span');
    pipsSpan.className = 'ship-pips';
    for (var i = 0; i < s.size; i++) {
      var pip = document.createElement('span');
      pip.className = 'pip' + (i < s.hits ? ' pip-hit' : '');
      pipsSpan.appendChild(pip);
    }
    div.appendChild(pipsSpan);
    div.appendChild(document.createTextNode(' ' + (s.sunk ? '\u2620 ' : '\u25B8 ') + s.name));
    jpEl.appendChild(div);
  });
}

function addLog(msg, type) {
  combatLog.unshift({ msg: msg, type: type });
  if (combatLog.length > 30) combatLog.pop();
  renderLog();
}

function renderLog() {
  var el = document.getElementById('combat-log');
  el.textContent = '';
  combatLog.forEach(function(e) {
    var div = document.createElement('div');
    div.className = 'log-entry log-' + e.type;
    div.textContent = e.msg;
    el.appendChild(div);
  });
}

/* ===== HIT REGISTRATION ===== */
function registerHit(ships, grid, r, c) {
  const idx = grid[r][c] - 1;
  const ship = ships[idx];
  ship.hits++;
  if (ship.hits >= ship.size) {
    ship.sunk = true;
    ship.cells.forEach(function(cell) { grid[cell[0]][cell[1]] = 'sunk'; });
    return { sunk: true, ship: ship };
  }
  grid[r][c] = 'hit';
  return { sunk: false, ship: ship };
}

function allSunk(ships) { return ships.every(function(s) { return s.sunk; }); }

/* ===== END GAME ===== */
function endGame(winner) {
  gameOver = true;
  renderBoards();
  setBadge('over');
  const usWon = winner === 'player';
  const overlay = document.getElementById('overlay');
  const accuracy = usWon
    ? (playerShotCount > 0 ? Math.round((enemyShips.reduce(function(a, s) { return a + s.size; }, 0) / playerShotCount) * 100) : 0)
    : (aiShotCount > 0 ? Math.round((playerShips.reduce(function(a, s) { return a + s.size; }, 0) / aiShotCount) * 100) : 0);

  var modal = overlay.querySelector('.modal');
  modal.textContent = '';

  var header = document.createElement('div');
  header.setAttribute('style', 'font-size:10px;letter-spacing:4px;color:#3a5a7a;text-transform:uppercase;margin-bottom:12px');
  header.textContent = 'After action report';
  modal.appendChild(header);

  var h3 = document.createElement('h3');
  h3.textContent = usWon ? 'Victory at Midway' : 'The IJN prevails';
  modal.appendChild(h3);

  var p = document.createElement('p');
  p.textContent = usWon
    ? 'All four Japanese carriers \u2014 Akagi, Kaga, S\u014dry\u016b, and Hiry\u016b \u2014 have been sunk. A decisive turning point in the Pacific War. History remembers this engagement.'
    : 'The Imperial Japanese Navy has neutralized the Pacific Fleet. Midway Atoll falls. A dark chapter for the United States Navy.';
  modal.appendChild(p);

  var stats = document.createElement('div');
  stats.className = 'stats';
  stats.textContent = 'Your shots fired: ' + playerShotCount + ' | IJN shots fired: ' + aiShotCount + ' | Winner accuracy: ' + accuracy + '%';
  modal.appendChild(stats);

  var btn = document.createElement('button');
  btn.className = 'btn';
  btn.id = 'btn-again';
  btn.textContent = 'Fight again';
  modal.appendChild(btn);

  overlay.classList.remove('hidden');
}

/* ===== PLAYER FIRE ===== */
function playerFire(r, c) {
  if (turn !== 'player' || gameOver) return;
  const v = enemyGrid[r][c];
  if (v === 'hit' || v === 'miss' || v === 'sunk') return;

  playerShotCount++;

  if (typeof v === 'number' && v > 0) {
    const { sunk, ship } = registerHit(enemyShips, enemyGrid, r, c);
    renderBoards();
    animateCell('enemy-board', r, c, sunk ? 'just-sunk' : 'just-hit');
    if (sunk) {
      setStatus('\u{1F4A5}', ship.name + ' sunk! The Imperial fleet takes a decisive blow, Admiral.');
      addLog('You sank ' + ship.name + '!', 'sunk');
    } else {
      setStatus('\u{1F3AF}', 'Hit at ' + cellRef(r, c) + '! Enemy vessel struck.');
      addLog('Hit at ' + cellRef(r, c), 'hit');
    }
    if (allSunk(enemyShips)) { updateFleets(); updateShotCounts(); endGame('player'); return; }
  } else {
    enemyGrid[r][c] = 'miss';
    renderBoards();
    animateCell('enemy-board', r, c, 'just-miss');
    setStatus('\u{1F30A}', 'Miss at ' + cellRef(r, c) + '. Shells fall into the Pacific.');
    addLog('Miss at ' + cellRef(r, c), 'miss');
  }

  updateFleets();
  updateShotCounts();
  turn = 'ai';
  setBadge('ai');
  setTimeout(aiFire, 800);
}

/* ===== AI — INTELLIGENT HUNT/TARGET ===== */

function aiGetHuntTarget() {
  const candidates = [];
  const fallback = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (ai.tried.has(r * GRID + c)) continue;
      if ((r + c) % 2 === 0) candidates.push([r, c]);
      else fallback.push([r, c]);
    }
  }
  const pool = candidates.length > 0 ? candidates : fallback;
  return pool[Math.floor(Math.random() * pool.length)];
}

function aiAddAdjacentTargets(r, c) {
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (const [dr, dc] of dirs) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && !ai.tried.has(nr * GRID + nc)) {
      if (!ai.targets.some(function(t) { return t[0] === nr && t[1] === nc; })) {
        ai.targets.push([nr, nc]);
      }
    }
  }
}

function aiPrioritizeLineTargets() {
  if (ai.hits.length < 2) return;

  const sorted = [...ai.hits].sort(function(a, b) { return a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]; });
  let isHoriz = true, isVert = true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i][0] !== sorted[0][0]) isHoriz = false;
    if (sorted[i][1] !== sorted[0][1]) isVert = false;
  }

  const priority = [];
  if (isHoriz) {
    const row = sorted[0][0];
    const minC = Math.min(...sorted.map(function(h) { return h[1]; }));
    const maxC = Math.max(...sorted.map(function(h) { return h[1]; }));
    if (minC - 1 >= 0 && !ai.tried.has(row * GRID + (minC - 1)))
      priority.push([row, minC - 1]);
    if (maxC + 1 < GRID && !ai.tried.has(row * GRID + (maxC + 1)))
      priority.push([row, maxC + 1]);
  } else if (isVert) {
    const col = sorted[0][1];
    const minR = Math.min(...sorted.map(function(h) { return h[0]; }));
    const maxR = Math.max(...sorted.map(function(h) { return h[0]; }));
    if (minR - 1 >= 0 && !ai.tried.has((minR - 1) * GRID + col))
      priority.push([minR - 1, col]);
    if (maxR + 1 < GRID && !ai.tried.has((maxR + 1) * GRID + col))
      priority.push([maxR + 1, col]);
  }

  if (priority.length > 0) {
    const rest = ai.targets.filter(function(t) {
      return !priority.some(function(p) { return p[0] === t[0] && p[1] === t[1]; });
    });
    ai.targets = [...priority, ...rest];
  }
}

function aiClearSunkShipTargets(ship) {
  const sunkSet = new Set(ship.cells.map(function(cell) { return cell[0] * GRID + cell[1]; }));
  ai.hits = ai.hits.filter(function(h) { return !sunkSet.has(h[0] * GRID + h[1]); });

  if (ai.hits.length === 0) {
    ai.targets = [];
    ai.mode = 'hunt';
  } else {
    ai.targets = [];
    for (const [hr, hc] of ai.hits) {
      aiAddAdjacentTargets(hr, hc);
    }
    aiPrioritizeLineTargets();
  }
}

function aiFire() {
  if (gameOver) return;
  let r, c;

  if (ai.mode === 'target' && ai.targets.length > 0) {
    aiPrioritizeLineTargets();
    while (ai.targets.length > 0) {
      const [tr, tc] = ai.targets.shift();
      if (!ai.tried.has(tr * GRID + tc)) {
        r = tr; c = tc;
        break;
      }
    }
    if (r === undefined) ai.mode = 'hunt';
  }

  if (r === undefined) {
    ai.mode = 'hunt';
    const cell = aiGetHuntTarget();
    if (!cell) { turn = 'player'; setBadge('player'); return; }
    r = cell[0]; c = cell[1];
  }

  ai.tried.add(r * GRID + c);
  aiShotCount++;
  const v = playerGrid[r][c];

  if (typeof v === 'number' && v > 0) {
    const { sunk, ship } = registerHit(playerShips, playerGrid, r, c);
    renderBoards();
    animateCell('player-board', r, c, sunk ? 'just-sunk' : 'just-hit');

    if (sunk) {
      aiClearSunkShipTargets(ship);
      setStatus('\u{1F480}', ship.name + ' has been sunk by the IJN!');
      addLog('IJN sank ' + ship.name + '!', 'sunk');
    } else {
      ai.mode = 'target';
      ai.hits.push([r, c]);
      aiAddAdjacentTargets(r, c);
      aiPrioritizeLineTargets();
      setStatus('\u26A0\uFE0F', 'IJN hit at ' + cellRef(r, c) + '! Your vessel is taking damage.');
      addLog('IJN hit at ' + cellRef(r, c), 'hit');
    }
    if (allSunk(playerShips)) { updateFleets(); updateShotCounts(); endGame('ai'); return; }
  } else {
    if (v === 0) playerGrid[r][c] = 'miss';
    renderBoards();
    animateCell('player-board', r, c, 'just-miss');
    setStatus('\u{1F60E}', 'IJN miss at ' + cellRef(r, c) + '. Your fleet holds. Return fire, Admiral.');
    addLog('IJN miss at ' + cellRef(r, c), 'miss');
  }

  updateFleets();
  updateShotCounts();
  turn = 'player';
  setBadge('player');
}

/* ===== EVENT LISTENERS (no inline handlers) ===== */
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-reset').addEventListener('click', resetGame);

  document.getElementById('enemy-board').addEventListener('click', function(e) {
    var td = e.target.closest('td[data-r][data-c]');
    if (!td) return;
    var r = parseInt(td.getAttribute('data-r'), 10);
    var c = parseInt(td.getAttribute('data-c'), 10);
    if (isNaN(r) || isNaN(c) || r < 0 || r >= GRID || c < 0 || c >= GRID) return;
    playerFire(r, c);
  });

  document.getElementById('overlay').addEventListener('click', function(e) {
    if (e.target.id === 'btn-again') {
      document.getElementById('overlay').classList.add('hidden');
      resetGame();
    }
  });
});
