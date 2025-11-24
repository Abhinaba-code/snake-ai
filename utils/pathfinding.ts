import { Point, Direction } from '../types';
import { BOARD_WIDTH, BOARD_HEIGHT } from '../constants';

const pKey = (p: Point) => `${p.x},${p.y}`;
const isSamePoint = (p1: Point, p2: Point) => p1.x === p2.x && p1.y === p2.y;

const getNeighbors = (head: Point, obstacleSet: Set<string>): { point: Point; direction: Direction }[] => {
  const moves = [
    { point: { x: head.x, y: head.y - 1 }, direction: Direction.UP },
    { point: { x: head.x, y: head.y + 1 }, direction: Direction.DOWN },
    { point: { x: head.x - 1, y: head.y }, direction: Direction.LEFT },
    { point: { x: head.x + 1, y: head.y }, direction: Direction.RIGHT },
  ];

  return moves.filter(m => {
    if (m.point.x < 0 || m.point.x >= BOARD_WIDTH || m.point.y < 0 || m.point.y >= BOARD_HEIGHT) return false;
    if (obstacleSet.has(pKey(m.point))) return false;
    return true;
  });
};

const getPath = (start: Point, target: Point, obstacleSet: Set<string>): Direction[] | null => {
  const queue: { point: Point; path: Direction[] }[] = [{ point: start, path: [] }];
  const visited = new Set<string>();
  visited.add(pKey(start));

  while (queue.length > 0) {
    const { point, path } = queue.shift()!;

    if (isSamePoint(point, target)) return path;

    const neighbors = getNeighbors(point, obstacleSet);
    for (const { point: nextPoint, direction } of neighbors) {
      const key = pKey(nextPoint);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ point: nextPoint, path: [...path, direction] });
      }
    }
  }
  return null;
};

const getAccessibleAreaSize = (start: Point, obstacleSet: Set<string>): number => {
  const queue: Point[] = [start];
  const visited = new Set<string>();
  visited.add(pKey(start));
  let count = 0;
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    count++;

    const nexts = [
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y }
    ];

    for (const n of nexts) {
       if (n.x < 0 || n.x >= BOARD_WIDTH || n.y < 0 || n.y >= BOARD_HEIGHT) continue;
       const key = pKey(n);
       if (!visited.has(key) && !obstacleSet.has(key)) {
         visited.add(key);
         queue.push(n);
       }
    }
  }
  return count;
};

export const getNextAutoMove = (snake: Point[], food: Point): Direction | null => {
  const head = snake[0];

  const possibleMoves = [
    { dir: Direction.UP, x: head.x, y: head.y - 1 },
    { dir: Direction.DOWN, x: head.x, y: head.y + 1 },
    { dir: Direction.LEFT, x: head.x - 1, y: head.y },
    { dir: Direction.RIGHT, x: head.x + 1, y: head.y }
  ];

  // 1. Filter out immediate collisions (Walls, Neck, Body)
  // Note: We exclude tail from body check here because it usually moves, 
  // but we will do a more rigorous simulation next.
  const neck = snake.length > 1 ? snake[1] : null;
  const validMoves = possibleMoves.filter(m => {
    if (m.x < 0 || m.x >= BOARD_WIDTH || m.y < 0 || m.y >= BOARD_HEIGHT) return false;
    if (neck && m.x === neck.x && m.y === neck.y) return false; 
    
    // Check strict body collision (excluding tail for now)
    const isBody = snake.slice(0, -1).some(p => p.x === m.x && p.y === m.y);
    if (isBody) return false;
    
    return true;
  });

  if (validMoves.length === 0) return null;

  // 2. Simulate moves to find Safe ones
  // A move is Safe if we can reach the tail after making it.
  const safeMoves: { dir: Direction, distToFood: number | null, space: number }[] = [];

  for (const move of validMoves) {
    const nextHead = { x: move.x, y: move.y };
    const willEat = nextHead.x === food.x && nextHead.y === food.y;

    // Build Virtual Snake state
    let virtualSnake: Point[];
    if (willEat) {
      virtualSnake = [nextHead, ...snake];
    } else {
      virtualSnake = [nextHead, ...snake.slice(0, -1)];
    }
    
    const virtualTail = virtualSnake[virtualSnake.length - 1];
    
    // Check Reachability to Tail
    const obstaclesArr = virtualSnake.slice(0, -1);
    const obstacleSet = new Set(obstaclesArr.map(pKey));
    
    const pathToTail = getPath(nextHead, virtualTail, obstacleSet);

    if (pathToTail !== null) {
      // Safe!
      // Calculate distance to food using the SAME virtual state
      const pathToFood = getPath(nextHead, food, obstacleSet);
      
      safeMoves.push({
        dir: move.dir,
        distToFood: pathToFood ? pathToFood.length : null,
        space: 0 // Defer calculation
      });
    }
  }

  // 3. Select Best Move
  
  // Strategy A: If safe paths to food exist, pick the shortest one.
  // This is greedy but safe because we verified tail reachability.
  const movesWithFood = safeMoves.filter(m => m.distToFood !== null);
  if (movesWithFood.length > 0) {
    movesWithFood.sort((a, b) => a.distToFood! - b.distToFood!);
    return movesWithFood[0].dir;
  }

  // Strategy B: If no path to food (or safe path to food), Maximize Space / Follow Tail.
  if (safeMoves.length > 0) {
    let bestDir = safeMoves[0].dir;
    let maxSpace = -1;

    for (const sm of safeMoves) {
       const nextHead = validMoves.find(vm => vm.dir === sm.dir)!;
       const willEat = nextHead.x === food.x && nextHead.y === food.y;
       // Reconstruct obstacle set for flood fill
       const virtualSnake = willEat 
         ? [{x: nextHead.x, y: nextHead.y}, ...snake] 
         : [{x: nextHead.x, y: nextHead.y}, ...snake.slice(0, -1)];
       
       const obsSet = new Set(virtualSnake.map(pKey));
       const space = getAccessibleAreaSize({x: nextHead.x, y: nextHead.y}, obsSet);
       
       if (space > maxSpace) {
         maxSpace = space;
         bestDir = sm.dir;
       }
    }
    return bestDir;
  }

  // Strategy C: Emergency (All moves are "unsafe" / trap eventually).
  // Just survive as long as possible by maximizing immediate space.
  let bestEmergencyDir: Direction | null = null;
  let maxEmergencySpace = -1;

  for (const move of validMoves) {
    const nextHead = { x: move.x, y: move.y };
    // Simple obstacle set (current snake excluding tail)
    const obsSet = new Set(snake.slice(0, -1).map(pKey));
    const space = getAccessibleAreaSize(nextHead, obsSet);
    
    if (space > maxEmergencySpace) {
      maxEmergencySpace = space;
      bestEmergencyDir = move.dir;
    }
  }

  return bestEmergencyDir || validMoves[0].dir;
};
