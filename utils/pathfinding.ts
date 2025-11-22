import { Point, Direction } from '../types';
import { BOARD_WIDTH, BOARD_HEIGHT } from '../constants';

// --- Types & Helpers ---

const isSamePoint = (p1: Point, p2: Point) => p1.x === p2.x && p1.y === p2.y;

// Get valid neighbors (inside board, not hitting obstacles)
// obstacles is usually the snake body
const getNeighbors = (head: Point, obstacles: Point[]): { point: Point; direction: Direction }[] => {
  const moves = [
    { point: { x: head.x, y: head.y - 1 }, direction: Direction.UP },
    { point: { x: head.x, y: head.y + 1 }, direction: Direction.DOWN },
    { point: { x: head.x - 1, y: head.y }, direction: Direction.LEFT },
    { point: { x: head.x + 1, y: head.y }, direction: Direction.RIGHT },
  ];

  const obstacleSet = new Set(obstacles.map(p => `${p.x},${p.y}`));

  return moves.filter(m => {
    // Check Bounds
    if (m.point.x < 0 || m.point.x >= BOARD_WIDTH || m.point.y < 0 || m.point.y >= BOARD_HEIGHT) {
      return false;
    }
    // Check Obstacles
    if (obstacleSet.has(`${m.point.x},${m.point.y}`)) {
      return false;
    }
    return true;
  });
};

// BFS to find shortest path from start to target
const getPath = (start: Point, target: Point, obstacles: Point[]): Direction[] | null => {
  const queue: { point: Point; path: Direction[] }[] = [{ point: start, path: [] }];
  const visited = new Set<string>();
  visited.add(`${start.x},${start.y}`);
  
  // Optimization: If obstacles block almost everything, BFS is slow. 
  // We use a simplified check for the target in the loop.

  while (queue.length > 0) {
    const { point, path } = queue.shift()!;

    if (isSamePoint(point, target)) {
      return path;
    }

    const neighbors = getNeighbors(point, obstacles);
    for (const { point: nextPoint, direction } of neighbors) {
      const key = `${nextPoint.x},${nextPoint.y}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ point: nextPoint, path: [...path, direction] });
      }
    }
  }
  return null;
};

// Flood Fill to count accessible space from a point
const getAccessibleAreaSize = (start: Point, obstacles: Point[]): number => {
  const queue: Point[] = [start];
  const visited = new Set<string>();
  visited.add(`${start.x},${start.y}`);
  const obstacleSet = new Set(obstacles.map(p => `${p.x},${p.y}`));
  let count = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    count++;

    const moves = [
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
    ];

    for (const m of moves) {
      // Check bounds
      if (m.x < 0 || m.x >= BOARD_WIDTH || m.y < 0 || m.y >= BOARD_HEIGHT) continue;
      
      const key = `${m.x},${m.y}`;
      if (!visited.has(key) && !obstacleSet.has(key)) {
        visited.add(key);
        queue.push(m);
      }
    }
  }
  return count;
};

// --- Main AI Logic ---

export const getNextAutoMove = (snake: Point[], food: Point): Direction | null => {
  const head = snake[0];
  const currentTail = snake[snake.length - 1];
  
  // The body parts that act as obstacles.
  // IMPORTANT: In the next frame, the tail will move (unless we eat), so the current tail is NOT an obstacle for the *result* of the move.
  // However, for pathfinding *to* food, we treat the whole body as solid.
  const snakeBodySet = new Set(snake.slice(0, -1).map(p => `${p.x},${p.y}`)); 
  // Obstacles for immediate move validation (exclude tail because it moves away)
  const obstaclesForMove = snake.slice(0, -1);

  // 1. Can we find a path to food?
  const pathToFood = getPath(head, food, snake); // Use full snake as obstacle to be safe

  if (pathToFood && pathToFood.length > 0) {
    // SIMULATION: If we take this step, is it safe?
    // A move is safe if, after taking it, we can still reach our own tail.
    // This ensures we don't trap ourselves in a dead end while chasing food.
    
    const nextMoveDir = pathToFood[0];
    let nextHead = { ...head };
    if (nextMoveDir === Direction.UP) nextHead.y--;
    else if (nextMoveDir === Direction.DOWN) nextHead.y++;
    else if (nextMoveDir === Direction.LEFT) nextHead.x--;
    else if (nextMoveDir === Direction.RIGHT) nextHead.x++;

    // Create a virtual snake after the move
    // If we eat food, length increases (tail stays). If not, tail moves.
    // To be perfectly safe, we assume we might grow or we just check connectivity to the *new* tail position.
    
    // Virtual move: Head moves to nextHead. Tail moves to snake[snake.length - 2] (new tail).
    const virtualSnake = [nextHead, ...snake.slice(0, -1)];
    const virtualTail = virtualSnake[virtualSnake.length - 1];
    
    // Can the new head reach the new tail?
    // We strictly use the virtual snake as obstacles.
    const pathToTail = getPath(nextHead, virtualTail, virtualSnake.slice(0, -1)); // Exclude virtual tail from obstacles (it's the target)

    if (pathToTail) {
      return nextMoveDir; // Safe to eat/move towards food
    }
  }

  // 2. Fallback: Path to food is blocked OR unsafe.
  // Strategy: Follow own tail. This keeps us in a loop until space opens up.
  // We exclude the *current* tail from obstacles because it will move.
  const pathToTail = getPath(head, currentTail, snake.slice(0, -1));

  if (pathToTail && pathToTail.length > 0) {
    // If we have a path to tail, take it. 
    // Ideally, we want the longest path to stall, but BFS gives shortest.
    // For now, taking the step towards tail is usually safe enough to survive.
    
    // Optimization: Check neighbors. Pick the one that allows reaching the tail AND maximizes distance if possible, 
    // or just strictly follow the valid path to tail.
    return pathToTail[0];
  }

  // 3. Emergency: Can't reach food, can't reach tail.
  // Strategy: Maximize Space (Flood Fill). Pick the neighbor with the most open cells.
  const neighbors = getNeighbors(head, obstaclesForMove);
  
  let bestMove: Direction | null = null;
  let maxSpace = -1;

  for (const { point, direction } of neighbors) {
    const space = getAccessibleAreaSize(point, obstaclesForMove);
    if (space > maxSpace) {
      maxSpace = space;
      bestMove = direction;
    }
  }

  return bestMove;
};