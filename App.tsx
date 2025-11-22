import React, { useState, useEffect, useCallback, useRef } from 'react';
import SnakeBoard from './components/SnakeBoard';
import CommentaryPanel from './components/CommentaryPanel';
import { Direction, GameStatus, Point, Commentary } from './types';
import { BOARD_WIDTH, BOARD_HEIGHT, SPEED_LEVELS } from './constants';
import { getNextAutoMove } from './utils/pathfinding';
import { generateGameCommentary, checkApiKey } from './services/geminiService';
import { 
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, 
  Play, Ban, Bot, Gamepad2, Gauge, 
  Sun, Moon, Zap, Trophy, User
} from 'lucide-react';

// Initial State Helpers
const getInitialSnake = (): Point[] => [
  { x: 10, y: 10 },
  { x: 10, y: 11 },
  { x: 10, y: 12 },
];

const getRandomFood = (snake: Point[]): Point => {
  let newFood: Point;
  while (true) {
    newFood = {
      x: Math.floor(Math.random() * BOARD_WIDTH),
      y: Math.floor(Math.random() * BOARD_HEIGHT),
    };
    const isOnSnake = snake.some((s) => s.x === newFood.x && s.y === newFood.y);
    if (!isOnSnake) break;
  }
  return newFood;
};

const App: React.FC = () => {
  // Game State
  const [snake, setSnake] = useState<Point[]>(getInitialSnake());
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Direction>(Direction.UP);
  const [status, setStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isAutoMode, setIsAutoMode] = useState(true);
  
  // UI State
  const [comments, setComments] = useState<Commentary[]>([]);
  const [speed, setSpeed] = useState(SPEED_LEVELS['Normal']);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Refs
  const directionRef = useRef(Direction.UP);
  const gameLoopRef = useRef<number | null>(null);
  
  const isDark = theme === 'dark';

  // Helpers
  const addComment = useCallback((text: string, type: Commentary['type'] = 'info') => {
    setComments(prev => [...prev.slice(-19), { text, timestamp: Date.now(), type }]);
  }, []);

  const triggerAIComment = useCallback(async (event: 'START' | 'GAME_OVER' | 'MILESTONE') => {
    if (!checkApiKey()) return;
    const text = await generateGameCommentary(score, highScore, event);
    addComment(text, 'ai');
  }, [score, highScore, addComment]);

  const startGame = useCallback(() => {
    setSnake(getInitialSnake());
    setDirection(Direction.UP);
    directionRef.current = Direction.UP;
    setScore(0);
    setStatus(GameStatus.PLAYING);
    setFood(getRandomFood(getInitialSnake())); 
    
    setComments([]);
    addComment(`Game Started. Mode: ${isAutoMode ? 'Auto-Pilot' : 'Manual'}`);
    triggerAIComment('START');
  }, [isAutoMode, addComment, triggerAIComment]);

  // Auto-start on load
  useEffect(() => {
    const timer = setTimeout(() => {
       startGame();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleDirectionChange = (newDir: Direction) => {
    if (isAutoMode || status !== GameStatus.PLAYING) return;

    const currentDir = directionRef.current;
    let allowed = false;

    switch (newDir) {
      case Direction.UP: if (currentDir !== Direction.DOWN) allowed = true; break;
      case Direction.DOWN: if (currentDir !== Direction.UP) allowed = true; break;
      case Direction.LEFT: if (currentDir !== Direction.RIGHT) allowed = true; break;
      case Direction.RIGHT: if (currentDir !== Direction.LEFT) allowed = true; break;
    }

    if (allowed) {
      directionRef.current = newDir;
      setDirection(newDir);
    }
  };

  // Keyboard Input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAutoMode) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (status !== GameStatus.PLAYING) {
        if (e.code === 'Space' || e.key === 'Enter') startGame();
        return;
      }

      switch (e.key) {
        case 'ArrowUp': handleDirectionChange(Direction.UP); break;
        case 'ArrowDown': handleDirectionChange(Direction.DOWN); break;
        case 'ArrowLeft': handleDirectionChange(Direction.LEFT); break;
        case 'ArrowRight': handleDirectionChange(Direction.RIGHT); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, isAutoMode, startGame]);

  // Game Loop
  const moveSnake = useCallback(() => {
    setSnake((prevSnake) => {
      const head = prevSnake[0];
      let nextHead: Point = { ...head };
      let moveDir = directionRef.current;

      if (isAutoMode) {
        const autoDir = getNextAutoMove(prevSnake, food);
        if (autoDir) {
          moveDir = autoDir;
          directionRef.current = autoDir;
          setDirection(autoDir);
        } else {
          setStatus(GameStatus.GAME_OVER);
          addComment("Auto-Pilot trapped!", "failure");
          triggerAIComment('GAME_OVER');
          return prevSnake;
        }
      }

      switch (moveDir) {
        case Direction.UP: nextHead.y -= 1; break;
        case Direction.DOWN: nextHead.y += 1; break;
        case Direction.LEFT: nextHead.x -= 1; break;
        case Direction.RIGHT: nextHead.x += 1; break;
      }

      // Wall Collision
      if (nextHead.x < 0 || nextHead.x >= BOARD_WIDTH || nextHead.y < 0 || nextHead.y >= BOARD_HEIGHT) {
        setStatus(GameStatus.GAME_OVER);
        addComment("Hit the wall!", "failure");
        triggerAIComment('GAME_OVER');
        return prevSnake;
      }

      // Self Collision
      const isSelfCollision = prevSnake.some((segment, index) => {
        if (index === prevSnake.length - 1) return false; 
        return segment.x === nextHead.x && segment.y === nextHead.y;
      });

      if (isSelfCollision) {
        setStatus(GameStatus.GAME_OVER);
        addComment("Ouch! Self collision.", "failure");
        triggerAIComment('GAME_OVER');
        return prevSnake;
      }

      const newSnake = [nextHead, ...prevSnake];

      if (nextHead.x === food.x && nextHead.y === food.y) {
        setScore(s => {
          const newScore = s + 10;
          if (newScore % 50 === 0) triggerAIComment('MILESTONE');
          return newScore;
        });
        setFood(getRandomFood(newSnake));
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [food, isAutoMode, addComment, triggerAIComment]);

  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      gameLoopRef.current = window.setInterval(moveSnake, speed);
    } else {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    }
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [status, moveSnake, speed]);

  useEffect(() => {
    if (status === GameStatus.GAME_OVER) {
      if (score > highScore) setHighScore(score);
    }
  }, [status, score, highScore]);

  const toggleAutoMode = () => {
    setIsAutoMode(!isAutoMode);
    addComment(`Switched to ${!isAutoMode ? 'Auto-Pilot' : 'Manual'}`, 'info');
  };

  // Common Button Styles
  const btnBase = "transition-all duration-200 font-bold rounded-lg flex items-center justify-center gap-2 shadow-md active:scale-95";
  const cardBase = `p-4 rounded-xl border shadow-lg transition-colors duration-300 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white/80 border-slate-200'}`;

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden transition-colors duration-500 ${isDark ? 'bg-[#0f172a] text-slate-100' : 'bg-slate-100 text-slate-800'}`}>
      
      {/* 1. Header */}
      <div className={`shrink-0 p-4 border-b flex justify-between items-center z-20 transition-colors duration-300 ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
             <Zap className={`w-6 h-6 ${isDark ? 'text-cyan-400' : 'text-purple-600'}`} fill="currentColor" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className={`text-2xl font-black tracking-tight leading-none bg-gradient-to-r bg-clip-text text-transparent ${isDark ? 'from-cyan-400 to-purple-500' : 'from-purple-600 to-pink-600'}`}>
                roypradhan snake AI
              </h1>
              <span className={`flex items-center gap-1 text-sm font-bold opacity-70 border-l pl-3 ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-500'}`}>
                <User className="w-3 h-3" /> by Roy Pradhan
              </span>
            </div>
            <div className={`text-[10px] font-bold tracking-widest uppercase mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Autonomous Gaming System</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`flex gap-4 px-4 py-2 rounded-full border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
             <div className="flex flex-col items-end leading-tight">
                <span className={`text-[10px] font-bold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Current</span>
                <span className={`font-mono text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{score}</span>
             </div>
             <div className={`w-px h-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
             <div className="flex flex-col items-start leading-tight">
                <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${isDark ? 'text-purple-400' : 'text-purple-500'}`}><Trophy className="w-3 h-3" /> High</span>
                <span className={`font-mono text-lg font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>{highScore}</span>
             </div>
          </div>

          <button 
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`p-2 rounded-full transition-colors ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-yellow-400' : 'bg-slate-200 hover:bg-slate-300 text-slate-600'}`}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* 2. Main Dashboard */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[300px_1fr_320px] gap-4 p-4 min-h-0">
        
        {/* Left Panel: Controls */}
        <div className="flex flex-col gap-3 overflow-y-auto pr-1 lg:pr-0">
          
          {/* Control Center */}
          <div className={cardBase}>
            <div className="flex justify-between items-center mb-4">
               <span className={`text-xs uppercase tracking-wider font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Operations</span>
               <span className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                 status === GameStatus.PLAYING 
                   ? (isDark ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-green-100 text-green-700 border border-green-200') 
                   : (isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500')
               }`}>
                 {status}
               </span>
            </div>
            
            <div className="space-y-2">
              <button
                onClick={status === GameStatus.PLAYING ? () => setStatus(GameStatus.IDLE) : startGame}
                className={`w-full py-3 ${btnBase} ${
                  status === GameStatus.PLAYING 
                    ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20' 
                    : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-cyan-500/20'
                }`}
              >
                {status === GameStatus.PLAYING ? <><Ban className="w-4 h-4" /> STOP SYSTEM</> : <><Play className="w-4 h-4"/> {status === GameStatus.GAME_OVER ? 'RETRY GAME' : 'INITIALIZE'}</>}
              </button>

              <button
                onClick={toggleAutoMode}
                className={`w-full py-3 ${btnBase} border ${
                  isAutoMode 
                    ? (isDark ? 'bg-purple-600 text-white border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-purple-600 text-white border-purple-500 shadow-purple-500/30')
                    : (isDark ? 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200')
                }`}
              >
                 {isAutoMode ? <><Bot className="w-5 h-5" /> AUTO PILOT</> : <><Gamepad2 className="w-5 h-5" /> MANUAL MODE</>}
              </button>
            </div>
          </div>

          {/* Speed Control */}
          <div className={`${cardBase} flex-1 flex flex-col`}>
            <div className={`flex items-center gap-2 text-xs font-bold mb-3 uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Gauge className="w-3 h-3" /> Processing Speed
            </div>
            <div className="grid grid-cols-1 gap-2">
              {(Object.entries(SPEED_LEVELS) as [string, number][]).map(([label, value]) => (
                <button
                  key={label}
                  onClick={() => setSpeed(value)}
                  className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all text-left flex justify-between items-center group ${
                    speed === value 
                      ? (isDark ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'bg-cyan-50 border-cyan-400 text-cyan-700') 
                      : (isDark ? 'bg-slate-700/30 border-slate-600 text-slate-500 hover:bg-slate-700/50' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100')
                  }`}
                >
                  {label}
                  {speed === value && <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-cyan-400 shadow-[0_0_8px_cyan]' : 'bg-cyan-500'}`} />}
                </button>
              ))}
            </div>
            
            {/* Manual Controls Section (Visible when in Manual Mode) */}
            {!isAutoMode && (
              <div className="mt-auto pt-6 animate-fade-in">
                 <div className={`text-center text-[10px] font-bold uppercase mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Manual Override</div>
                 <div className="flex justify-center">
                   <div className="grid grid-cols-3 gap-2 w-[140px]">
                      <div />
                      <button 
                        className={`h-10 rounded-lg flex items-center justify-center active:scale-90 transition-transform ${isDark ? 'bg-slate-700 text-cyan-400 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 shadow-sm'}`} 
                        onPointerDown={(e) => { e.preventDefault(); handleDirectionChange(Direction.UP); }}
                      ><ArrowUp className="w-5 h-5" /></button>
                      <div />
                      <button 
                        className={`h-10 rounded-lg flex items-center justify-center active:scale-90 transition-transform ${isDark ? 'bg-slate-700 text-cyan-400 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 shadow-sm'}`} 
                        onPointerDown={(e) => { e.preventDefault(); handleDirectionChange(Direction.LEFT); }}
                      ><ArrowLeft className="w-5 h-5" /></button>
                      <button 
                        className={`h-10 rounded-lg flex items-center justify-center active:scale-90 transition-transform ${isDark ? 'bg-slate-700 text-cyan-400 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 shadow-sm'}`} 
                        onPointerDown={(e) => { e.preventDefault(); handleDirectionChange(Direction.DOWN); }}
                      ><ArrowDown className="w-5 h-5" /></button>
                      <button 
                        className={`h-10 rounded-lg flex items-center justify-center active:scale-90 transition-transform ${isDark ? 'bg-slate-700 text-cyan-400 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 shadow-sm'}`} 
                        onPointerDown={(e) => { e.preventDefault(); handleDirectionChange(Direction.RIGHT); }}
                      ><ArrowRight className="w-5 h-5" /></button>
                   </div>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Middle Panel: Game Board */}
        <div className={`relative flex items-center justify-center rounded-2xl border p-4 min-h-0 transition-colors duration-300 ${isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200 shadow-inner'}`}>
           <div className="relative w-full h-full flex items-center justify-center">
               <SnakeBoard snake={snake} food={food} isAutoMode={isAutoMode} theme={theme} />
               
               {status === GameStatus.GAME_OVER && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10 rounded-xl">
                   <div className="text-center animate-bounce-in p-8 bg-white rounded-2xl shadow-2xl border-4 border-red-500">
                     <h2 className="text-5xl font-black text-red-600 drop-shadow-md mb-2">GAME OVER</h2>
                     <p className="text-2xl text-slate-800 font-mono font-bold">Score: {score}</p>
                     <button onClick={startGame} className="mt-6 px-8 py-3 bg-red-600 text-white font-bold rounded-full hover:bg-red-700 hover:scale-105 transition-all shadow-xl">
                       Reboot System
                     </button>
                   </div>
                 </div>
               )}
               
               {status === GameStatus.IDLE && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10 rounded-xl">
                    <div className={`text-center p-10 border shadow-2xl rounded-3xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <div className={`font-mono mb-4 text-xl tracking-[0.2em] font-bold animate-pulse ${isDark ? 'text-cyan-400' : 'text-purple-600'}`}>AI SYSTEM READY</div>
                      <button onClick={startGame} className="px-10 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all">
                        INITIALIZE SEQUENCE
                      </button>
                    </div>
                 </div>
               )}
           </div>
        </div>

        {/* Right Panel: Commentary */}
        <div className="h-full min-h-0 hidden lg:block">
          <CommentaryPanel comments={comments} theme={theme} />
        </div>

        {/* Mobile Commentary (Bottom) */}
        <div className="lg:hidden h-48">
           <CommentaryPanel comments={comments} theme={theme} />
        </div>

      </div>
    </div>
  );
};

export default App;