import React, { useEffect, useRef } from 'react';
import { Point } from '../types';
import { BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE } from '../constants';

interface SnakeBoardProps {
  snake: Point[];
  food: Point;
  isAutoMode: boolean;
  theme: 'light' | 'dark';
}

const SnakeBoard: React.FC<SnakeBoardProps> = ({ snake, food, isAutoMode, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isDark = theme === 'dark';
    
    // --- Configuration ---
    const bgColor = isDark ? '#0f172a' : '#f8fafc'; // slate-900 vs slate-50
    const gridColor = isDark ? '#1e293b' : '#e2e8f0'; // slate-800 vs slate-200
    
    // Clear Board
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Subtle Grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += CELL_SIZE) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }
    for (let y = 0; y <= canvas.height; y += CELL_SIZE) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    // --- Helper to get Snake Color (Gradient) ---
    const getSnakeColor = (index: number, total: number) => {
      // Manual: Green Gradient
      if (!isAutoMode) {
        if (index === 0) return isDark ? '#4ade80' : '#10b981'; // Head
        // Gradient for body: Green to Emerald
        const opacity = 1 - (index / (total + 5)) * 0.6;
        return isDark ? `rgba(74, 222, 128, ${opacity})` : `rgba(16, 185, 129, ${opacity})`;
      } 
      
      // Auto: Cyan/Purple Neon Gradient
      if (index === 0) return isDark ? '#22d3ee' : '#8b5cf6'; // Head
      
      // Calculate gradient hue shift
      // Dark: Cyan -> Blue | Light: Violet -> Indigo
      return isDark ? `rgba(34, 211, 238, ${1 - index/total * 0.8})` : `rgba(139, 92, 246, ${1 - index/total * 0.8})`;
    };

    // --- Draw Food (Glowing Orb) ---
    const foodX = food.x * CELL_SIZE + CELL_SIZE / 2;
    const foodY = food.y * CELL_SIZE + CELL_SIZE / 2;
    const foodColor = isAutoMode ? '#f472b6' : '#f87171'; // Pink or Red
    
    // Glow effect
    ctx.shadowBlur = isDark ? 20 : 10;
    ctx.shadowColor = foodColor;
    
    // Pulsing animation
    const pulse = Math.sin(Date.now() / 150) * 3;
    
    ctx.beginPath();
    ctx.fillStyle = foodColor;
    ctx.arc(foodX, foodY, (CELL_SIZE / 3) + pulse * 0.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner highlight for 3D effect
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(foodX - 3, foodY - 3, 2, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow for snake body (we handle it manually per segment)
    ctx.shadowBlur = 0;

    // --- Draw Snake ---
    snake.forEach((segment, index) => {
      const isHead = index === 0;
      const x = segment.x * CELL_SIZE;
      const y = segment.y * CELL_SIZE;
      const size = CELL_SIZE - 2; // slight gap for segmentation
      
      const color = getSnakeColor(index, snake.length);
      
      ctx.fillStyle = color;
      
      if (isHead) {
        // Head Glow
        ctx.shadowBlur = isDark ? 25 : 15;
        ctx.shadowColor = color;
        
        // Draw Head (Rounded Square or Circle)
        ctx.beginPath();
        ctx.roundRect(x, y, CELL_SIZE, CELL_SIZE, 8);
        ctx.fill();
        ctx.shadowBlur = 0; // Reset for details

        // Eyes
        // Determine facing direction roughly based on next segment
        let dx = 0, dy = 0;
        if (snake[1]) {
           dx = segment.x - snake[1].x;
           dy = segment.y - snake[1].y;
        } else {
           // Default right
           dx = 1; 
        }

        // Calculate Eye Positions
        const eyeOffset = CELL_SIZE * 0.25;
        const eyeSize = 4;
        let eye1X, eye1Y, eye2X, eye2Y;

        if (dy === -1) { // Up
           eye1X = x + eyeOffset; eye1Y = y + eyeOffset;
           eye2X = x + CELL_SIZE - eyeOffset; eye2Y = y + eyeOffset;
        } else if (dy === 1) { // Down
           eye1X = x + eyeOffset; eye1Y = y + CELL_SIZE - eyeOffset;
           eye2X = x + CELL_SIZE - eyeOffset; eye2Y = y + CELL_SIZE - eyeOffset;
        } else if (dx === -1) { // Left
           eye1X = x + eyeOffset; eye1Y = y + eyeOffset;
           eye2X = x + eyeOffset; eye2Y = y + CELL_SIZE - eyeOffset;
        } else { // Right
           eye1X = x + CELL_SIZE - eyeOffset; eye1Y = y + eyeOffset;
           eye2X = x + CELL_SIZE - eyeOffset; eye2Y = y + CELL_SIZE - eyeOffset;
        }

        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
        ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, 2, 0, Math.PI * 2);
        ctx.arc(eye2X, eye2Y, 2, 0, Math.PI * 2);
        ctx.fill();

      } else {
        // Body Segment
        // Connect slightly to make it look smoother or keep segmented for retro feel?
        // Let's do rounded segments
        ctx.beginPath();
        // Slightly smaller than head
        const margin = 2;
        ctx.roundRect(x + margin, y + margin, CELL_SIZE - margin*2, CELL_SIZE - margin*2, 6);
        ctx.fill();
      }
    });

  }, [snake, food, isAutoMode, theme]);

  return (
    <canvas
      ref={canvasRef}
      width={BOARD_WIDTH * CELL_SIZE}
      height={BOARD_HEIGHT * CELL_SIZE}
      className={`rounded-xl border-4 h-auto max-h-full w-auto max-w-full object-contain touch-none transition-colors duration-300 ${
        theme === 'dark' 
          ? 'shadow-[0_0_30px_rgba(15,23,42,0.6)] border-slate-700 bg-slate-900' 
          : 'shadow-2xl border-slate-200 bg-slate-50'
      }`}
    />
  );
};

export default SnakeBoard;