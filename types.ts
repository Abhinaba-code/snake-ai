export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

export interface Point {
  x: number;
  y: number;
}

export enum GameStatus {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export interface GameState {
  snake: Point[];
  food: Point;
  direction: Direction;
  score: number;
  status: GameStatus;
  highScore: number;
  isAutoMode: boolean;
}

export interface Commentary {
  text: string;
  timestamp: number;
  type: 'info' | 'success' | 'failure' | 'ai';
}