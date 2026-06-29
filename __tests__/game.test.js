const {
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
} = require('../src/game');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe('constants', () => {
  test('SIZE is 10', () => {
    expect(SIZE).toBe(10);
  });

  test('COLS has 10 letters A-J', () => {
    expect(COLS).toBe('ABCDEFGHIJ');
    expect(COLS.length).toBe(SIZE);
  });

  test('SHIPS has 5 US ships with correct sizes', () => {
    expect(SHIPS).toHaveLength(5);
    expect(SHIPS.map(s => s.size)).toEqual([5, 4, 3, 3, 2]);
    SHIPS.forEach(s => {
      expect(s).toHaveProperty('name');
      expect(s).toHaveProperty('size');
      expect(typeof s.name).toBe('string');
      expect(s.size).toBeGreaterThanOrEqual(2);
      expect(s.size).toBeLessThanOrEqual(5);
    });
  });

  test('JP_SHIPS has 5 Japanese ships with correct sizes', () => {
    expect(JP_SHIPS).toHaveLength(5);
    expect(JP_SHIPS.map(s => s.size)).toEqual([5, 4, 3, 3, 2]);
    JP_SHIPS.forEach(s => {
      expect(s).toHaveProperty('name');
      expect(s).toHaveProperty('size');
    });
  });

  test('US and JP fleets have the same total size', () => {
    const usTotal = SHIPS.reduce((sum, s) => sum + s.size, 0);
    const jpTotal = JP_SHIPS.reduce((sum, s) => sum + s.size, 0);
    expect(usTotal).toBe(jpTotal);
  });
});

// ---------------------------------------------------------------------------
// emptyGrid
// ---------------------------------------------------------------------------
describe('emptyGrid', () => {
  test('returns a 10x10 grid', () => {
    const grid = emptyGrid();
    expect(grid).toHaveLength(SIZE);
    grid.forEach(row => {
      expect(row).toHaveLength(SIZE);
    });
  });

  test('all cells are 0', () => {
    const grid = emptyGrid();
    grid.forEach(row => {
      row.forEach(cell => {
        expect(cell).toBe(0);
      });
    });
  });

  test('rows are independent (mutating one does not affect another)', () => {
    const grid = emptyGrid();
    grid[0][0] = 99;
    expect(grid[1][0]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// placeShips
// ---------------------------------------------------------------------------
describe('placeShips', () => {
  test('places all ships on the grid', () => {
    const { grid, placed } = placeShips(SHIPS);
    expect(placed).toHaveLength(SHIPS.length);
  });

  test('each placed ship has correct properties', () => {
    const { placed } = placeShips(SHIPS);
    placed.forEach((ship, i) => {
      expect(ship.name).toBe(SHIPS[i].name);
      expect(ship.size).toBe(SHIPS[i].size);
      expect(ship.hits).toBe(0);
      expect(ship.sunk).toBe(false);
      expect(ship.cells).toHaveLength(ship.size);
    });
  });

  test('all ship cells are within bounds', () => {
    const { placed } = placeShips(SHIPS);
    placed.forEach(ship => {
      ship.cells.forEach(([r, c]) => {
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(SIZE);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(SIZE);
      });
    });
  });

  test('ship cells are contiguous (horizontal or vertical)', () => {
    const { placed } = placeShips(SHIPS);
    placed.forEach(ship => {
      if (ship.cells.length < 2) return;
      const rows = ship.cells.map(([r]) => r);
      const cols = ship.cells.map(([, c]) => c);
      const isHorizontal = new Set(rows).size === 1;
      const isVertical = new Set(cols).size === 1;
      expect(isHorizontal || isVertical).toBe(true);

      if (isHorizontal) {
        const sorted = [...cols].sort((a, b) => a - b);
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i] - sorted[i - 1]).toBe(1);
        }
      } else {
        const sorted = [...rows].sort((a, b) => a - b);
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i] - sorted[i - 1]).toBe(1);
        }
      }
    });
  });

  test('ships do not overlap on the grid', () => {
    const { grid } = placeShips(SHIPS);
    const occupiedCells = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] !== 0) occupiedCells.push(`${r},${c}`);
      }
    }
    const uniqueCells = new Set(occupiedCells);
    expect(uniqueCells.size).toBe(occupiedCells.length);
  });

  test('grid values correspond to 1-indexed ship IDs', () => {
    const { grid, placed } = placeShips(SHIPS);
    placed.forEach((ship, i) => {
      ship.cells.forEach(([r, c]) => {
        expect(grid[r][c]).toBe(i + 1);
      });
    });
  });

  test('total occupied cells equals sum of ship sizes', () => {
    const { grid } = placeShips(SHIPS);
    let count = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] !== 0) count++;
      }
    }
    const expected = SHIPS.reduce((sum, s) => sum + s.size, 0);
    expect(count).toBe(expected);
  });

  test('works with JP_SHIPS too', () => {
    const { grid, placed } = placeShips(JP_SHIPS);
    expect(placed).toHaveLength(JP_SHIPS.length);
    let count = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] !== 0) count++;
      }
    }
    expect(count).toBe(JP_SHIPS.reduce((sum, s) => sum + s.size, 0));
  });

  test('works with a single small ship', () => {
    const { grid, placed } = placeShips([{ name: 'Tiny', size: 1 }]);
    expect(placed).toHaveLength(1);
    expect(placed[0].cells).toHaveLength(1);
  });

  test('placements are random (two calls produce different results most of the time)', () => {
    const results = [];
    for (let i = 0; i < 10; i++) {
      const { placed } = placeShips(SHIPS);
      results.push(JSON.stringify(placed.map(s => s.cells)));
    }
    const unique = new Set(results);
    expect(unique.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// registerHit
// ---------------------------------------------------------------------------
describe('registerHit', () => {
  function makeShipSetup() {
    const grid = emptyGrid();
    grid[0][0] = 1; grid[0][1] = 1; grid[0][2] = 1;
    const ships = [
      { name: 'TestShip', size: 3, cells: [[0, 0], [0, 1], [0, 2]], hits: 0, sunk: false },
    ];
    return { grid, ships };
  }

  test('increments hit count on the ship', () => {
    const { grid, ships } = makeShipSetup();
    registerHit(ships, grid, 0, 0);
    expect(ships[0].hits).toBe(1);
  });

  test('marks grid cell as "hit" when ship is not yet sunk', () => {
    const { grid, ships } = makeShipSetup();
    registerHit(ships, grid, 0, 0);
    expect(grid[0][0]).toBe('hit');
    expect(grid[0][1]).toBe(1);
  });

  test('returns sunk:false when ship still has unhit cells', () => {
    const { grid, ships } = makeShipSetup();
    const result = registerHit(ships, grid, 0, 0);
    expect(result.sunk).toBe(false);
    expect(result.ship).toBe(ships[0]);
  });

  test('sinks ship when all cells are hit', () => {
    const { grid, ships } = makeShipSetup();
    registerHit(ships, grid, 0, 0);
    registerHit(ships, grid, 0, 1);
    const result = registerHit(ships, grid, 0, 2);
    expect(result.sunk).toBe(true);
    expect(ships[0].sunk).toBe(true);
    expect(ships[0].hits).toBe(3);
  });

  test('marks all cells as "sunk" when ship sinks', () => {
    const { grid, ships } = makeShipSetup();
    registerHit(ships, grid, 0, 0);
    registerHit(ships, grid, 0, 1);
    registerHit(ships, grid, 0, 2);
    expect(grid[0][0]).toBe('sunk');
    expect(grid[0][1]).toBe('sunk');
    expect(grid[0][2]).toBe('sunk');
  });

  test('works with multiple ships on the grid', () => {
    const grid = emptyGrid();
    grid[0][0] = 1; grid[0][1] = 1;
    grid[2][0] = 2; grid[2][1] = 2; grid[2][2] = 2;
    const ships = [
      { name: 'Ship A', size: 2, cells: [[0, 0], [0, 1]], hits: 0, sunk: false },
      { name: 'Ship B', size: 3, cells: [[2, 0], [2, 1], [2, 2]], hits: 0, sunk: false },
    ];

    registerHit(ships, grid, 2, 1);
    expect(ships[1].hits).toBe(1);
    expect(ships[0].hits).toBe(0);
    expect(grid[2][1]).toBe('hit');
  });
});

// ---------------------------------------------------------------------------
// allSunk
// ---------------------------------------------------------------------------
describe('allSunk', () => {
  test('returns false when no ships are sunk', () => {
    const ships = [
      { sunk: false },
      { sunk: false },
    ];
    expect(allSunk(ships)).toBe(false);
  });

  test('returns false when some ships are sunk', () => {
    const ships = [
      { sunk: true },
      { sunk: false },
      { sunk: true },
    ];
    expect(allSunk(ships)).toBe(false);
  });

  test('returns true when all ships are sunk', () => {
    const ships = [
      { sunk: true },
      { sunk: true },
      { sunk: true },
    ];
    expect(allSunk(ships)).toBe(true);
  });

  test('returns true for an empty array', () => {
    expect(allSunk([])).toBe(true);
  });

  test('works with a single ship', () => {
    expect(allSunk([{ sunk: false }])).toBe(false);
    expect(allSunk([{ sunk: true }])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// coordLabel
// ---------------------------------------------------------------------------
describe('coordLabel', () => {
  test('returns correct labels for corners', () => {
    expect(coordLabel(0, 0)).toBe('A1');
    expect(coordLabel(0, 9)).toBe('J1');
    expect(coordLabel(9, 0)).toBe('A10');
    expect(coordLabel(9, 9)).toBe('J10');
  });

  test('returns correct labels for interior cells', () => {
    expect(coordLabel(4, 4)).toBe('E5');
    expect(coordLabel(2, 7)).toBe('H3');
  });
});

// ---------------------------------------------------------------------------
// createAI
// ---------------------------------------------------------------------------
describe('createAI', () => {
  test('initializes with hunt mode', () => {
    const ai = createAI();
    expect(ai.mode).toBe('hunt');
  });

  test('initializes with empty queue', () => {
    const ai = createAI();
    expect(ai.queue).toEqual([]);
  });

  test('initializes with empty tried set', () => {
    const ai = createAI();
    expect(ai.tried).toBeInstanceOf(Set);
    expect(ai.tried.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// aiSelectTarget
// ---------------------------------------------------------------------------
describe('aiSelectTarget', () => {
  test('returns coordinates within bounds in hunt mode', () => {
    const ai = createAI();
    const board = emptyGrid();
    for (let i = 0; i < 50; i++) {
      const { r, c } = aiSelectTarget(ai, board);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(SIZE);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(SIZE);
    }
  });

  test('selects from queue in destroy mode', () => {
    const ai = createAI();
    ai.mode = 'destroy';
    ai.queue = [[3, 4], [5, 6]];
    const { r, c } = aiSelectTarget(ai, emptyGrid());
    expect(r).toBe(3);
    expect(c).toBe(4);
  });

  test('skips already-tried cells in queue', () => {
    const ai = createAI();
    ai.mode = 'destroy';
    ai.queue = [[3, 4], [5, 6]];
    ai.tried.add('3,4');
    const { r, c } = aiSelectTarget(ai, emptyGrid());
    expect(r).toBe(5);
    expect(c).toBe(6);
  });

  test('falls back to hunt mode when queue is exhausted', () => {
    const ai = createAI();
    ai.mode = 'destroy';
    ai.queue = [[3, 4]];
    ai.tried.add('3,4');
    const { r, c } = aiSelectTarget(ai, emptyGrid());
    expect(ai.mode).toBe('hunt');
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(SIZE);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThan(SIZE);
  });

  test('skips out-of-bounds cells in queue', () => {
    const ai = createAI();
    ai.mode = 'destroy';
    ai.queue = [[-1, 0], [0, -1], [SIZE, 0], [0, SIZE], [2, 2]];
    const { r, c } = aiSelectTarget(ai, emptyGrid());
    expect(r).toBe(2);
    expect(c).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// processAIShot
// ---------------------------------------------------------------------------
describe('processAIShot', () => {
  function makeBoard() {
    const grid = emptyGrid();
    grid[1][1] = 1; grid[1][2] = 1;
    const ships = [
      { name: 'Target', size: 2, cells: [[1, 1], [1, 2]], hits: 0, sunk: false },
    ];
    return { grid, ships };
  }

  test('records a miss on empty water', () => {
    const { grid, ships } = makeBoard();
    const ai = createAI();
    const result = processAIShot(ai, grid, ships, 0, 0);
    expect(result.hit).toBe(false);
    expect(result.sunk).toBe(false);
    expect(result.ship).toBeNull();
    expect(grid[0][0]).toBe('miss');
  });

  test('records a hit on a ship', () => {
    const { grid, ships } = makeBoard();
    const ai = createAI();
    const result = processAIShot(ai, grid, ships, 1, 1);
    expect(result.hit).toBe(true);
    expect(result.sunk).toBe(false);
    expect(result.ship.name).toBe('Target');
    expect(ai.mode).toBe('destroy');
    expect(ai.queue.length).toBeGreaterThan(0);
  });

  test('records the target in tried set', () => {
    const { grid, ships } = makeBoard();
    const ai = createAI();
    processAIShot(ai, grid, ships, 3, 3);
    expect(ai.tried.has('3,3')).toBe(true);
  });

  test('sinks a ship and resets to hunt mode', () => {
    const { grid, ships } = makeBoard();
    const ai = createAI();
    processAIShot(ai, grid, ships, 1, 1);
    const result = processAIShot(ai, grid, ships, 1, 2);
    expect(result.hit).toBe(true);
    expect(result.sunk).toBe(true);
    expect(result.ship.sunk).toBe(true);
    expect(ai.mode).toBe('hunt');
    expect(ai.queue).toEqual([]);
  });

  test('reports allSunk when last ship sinks', () => {
    const { grid, ships } = makeBoard();
    const ai = createAI();
    processAIShot(ai, grid, ships, 1, 1);
    const result = processAIShot(ai, grid, ships, 1, 2);
    expect(result.allSunk).toBe(true);
  });

  test('allSunk is false when other ships remain', () => {
    const grid = emptyGrid();
    grid[0][0] = 1;
    grid[2][0] = 2; grid[2][1] = 2;
    const ships = [
      { name: 'A', size: 1, cells: [[0, 0]], hits: 0, sunk: false },
      { name: 'B', size: 2, cells: [[2, 0], [2, 1]], hits: 0, sunk: false },
    ];
    const ai = createAI();
    const result = processAIShot(ai, grid, ships, 0, 0);
    expect(result.sunk).toBe(true);
    expect(result.allSunk).toBe(false);
  });

  test('adds adjacent cells to queue on hit', () => {
    const { grid, ships } = makeBoard();
    const ai = createAI();
    processAIShot(ai, grid, ships, 1, 1);
    const queueCoords = ai.queue.map(([r, c]) => `${r},${c}`);
    expect(queueCoords).toContain('1,2');
    expect(queueCoords).toContain('1,0');
    expect(queueCoords).toContain('0,1');
    expect(queueCoords).toContain('2,1');
  });

  test('does not add out-of-bounds cells to queue', () => {
    const grid = emptyGrid();
    grid[0][0] = 1; grid[0][1] = 1;
    const ships = [
      { name: 'Corner', size: 2, cells: [[0, 0], [0, 1]], hits: 0, sunk: false },
    ];
    const ai = createAI();
    processAIShot(ai, grid, ships, 0, 0);
    ai.queue.forEach(([r, c]) => {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(SIZE);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(SIZE);
    });
  });

  test('does not add already-tried cells to queue', () => {
    const { grid, ships } = makeBoard();
    const ai = createAI();
    ai.tried.add('0,1');
    processAIShot(ai, grid, ships, 1, 1);
    const queueCoords = ai.queue.map(([r, c]) => `${r},${c}`);
    expect(queueCoords).not.toContain('0,1');
  });

  test('does not mark already-missed cell again', () => {
    const { grid, ships } = makeBoard();
    grid[5][5] = 'miss';
    const ai = createAI();
    processAIShot(ai, grid, ships, 5, 5);
    expect(grid[5][5]).toBe('miss');
  });
});

// ---------------------------------------------------------------------------
// processPlayerShot
// ---------------------------------------------------------------------------
describe('processPlayerShot', () => {
  function makeEnemyBoard() {
    const grid = emptyGrid();
    grid[3][3] = 1; grid[3][4] = 1;
    const ships = [
      { name: 'Enemy', size: 2, cells: [[3, 3], [3, 4]], hits: 0, sunk: false },
    ];
    return { grid, ships };
  }

  test('miss on empty water', () => {
    const { grid, ships } = makeEnemyBoard();
    const result = processPlayerShot(grid, ships, 0, 0);
    expect(result.alreadyShot).toBe(false);
    expect(result.hit).toBe(false);
    expect(result.sunk).toBe(false);
    expect(grid[0][0]).toBe('miss');
  });

  test('hit on enemy ship', () => {
    const { grid, ships } = makeEnemyBoard();
    const result = processPlayerShot(grid, ships, 3, 3);
    expect(result.alreadyShot).toBe(false);
    expect(result.hit).toBe(true);
    expect(result.sunk).toBe(false);
    expect(result.ship.name).toBe('Enemy');
  });

  test('sinks enemy ship when all cells hit', () => {
    const { grid, ships } = makeEnemyBoard();
    processPlayerShot(grid, ships, 3, 3);
    const result = processPlayerShot(grid, ships, 3, 4);
    expect(result.hit).toBe(true);
    expect(result.sunk).toBe(true);
    expect(result.allSunk).toBe(true);
  });

  test('rejects shot on already-hit cell', () => {
    const { grid, ships } = makeEnemyBoard();
    processPlayerShot(grid, ships, 3, 3);
    const result = processPlayerShot(grid, ships, 3, 3);
    expect(result.alreadyShot).toBe(true);
    expect(result.hit).toBe(false);
  });

  test('rejects shot on already-missed cell', () => {
    const { grid, ships } = makeEnemyBoard();
    processPlayerShot(grid, ships, 0, 0);
    const result = processPlayerShot(grid, ships, 0, 0);
    expect(result.alreadyShot).toBe(true);
  });

  test('rejects shot on sunk cell', () => {
    const { grid, ships } = makeEnemyBoard();
    processPlayerShot(grid, ships, 3, 3);
    processPlayerShot(grid, ships, 3, 4);
    const result = processPlayerShot(grid, ships, 3, 3);
    expect(result.alreadyShot).toBe(true);
  });

  test('allSunk is false when other ships remain', () => {
    const grid = emptyGrid();
    grid[0][0] = 1;
    grid[5][5] = 2; grid[5][6] = 2;
    const ships = [
      { name: 'A', size: 1, cells: [[0, 0]], hits: 0, sunk: false },
      { name: 'B', size: 2, cells: [[5, 5], [5, 6]], hits: 0, sunk: false },
    ];
    const result = processPlayerShot(grid, ships, 0, 0);
    expect(result.sunk).toBe(true);
    expect(result.allSunk).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration: full game simulation
// ---------------------------------------------------------------------------
describe('full game simulation', () => {
  test('a complete game can be played to conclusion', () => {
    const { grid: enemyGrid, placed: enemyShips } = placeShips(JP_SHIPS);
    const { grid: playerGrid, placed: playerShips } = placeShips(SHIPS);
    const ai = createAI();

    let playerWon = false;
    let aiWon = false;
    let turns = 0;
    const maxTurns = 200;

    while (!playerWon && !aiWon && turns < maxTurns) {
      turns++;

      // Player fires at every cell systematically
      let playerFired = false;
      for (let r = 0; r < SIZE && !playerFired; r++) {
        for (let c = 0; c < SIZE && !playerFired; c++) {
          const v = enemyGrid[r][c];
          if (v !== 'hit' && v !== 'miss' && v !== 'sunk') {
            const result = processPlayerShot(enemyGrid, enemyShips, r, c);
            if (result.allSunk) playerWon = true;
            playerFired = true;
          }
        }
      }

      if (playerWon) break;

      // AI fires
      const target = aiSelectTarget(ai, playerGrid);
      const result = processAIShot(ai, playerGrid, playerShips, target.r, target.c);
      if (result.allSunk) aiWon = true;
    }

    expect(playerWon || aiWon).toBe(true);
    expect(turns).toBeLessThan(maxTurns);
  });

  test('player systematically sinking all ships', () => {
    const { grid, placed } = placeShips(JP_SHIPS);

    placed.forEach(ship => {
      ship.cells.forEach(([r, c]) => {
        if (grid[r][c] !== 'hit' && grid[r][c] !== 'sunk') {
          processPlayerShot(grid, placed, r, c);
        }
      });
    });

    expect(allSunk(placed)).toBe(true);
  });
});
