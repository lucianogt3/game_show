import React, { useEffect, useState } from 'react';
import { audioService } from '../services/audioService';

interface VirtualKeyboardProps {
  initialName: string;
  onComplete: (name: string) => void;
  onCancel: () => void;
}

const KEYS = [
  "A","B","C","D","E","F","G","H","I","J",
  "K","L","M","N","O","P","Q","R","S","T",
  "U","V","W","X","Y","Z","0","1","2","3",
  "4","5","6","7","8","9"," ","-","_","."
];
const COLS = 10;
const MAX_LEN = 12;

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({ initialName, onComplete, onCancel }) => {
  const [text, setText] = useState(initialName);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow F5, reload, etc
      if (e.ctrlKey || e.metaKey || e.key.startsWith("F")) return;

      // Arcade Navigation
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - COLS >= 0 ? prev - COLS : prev));
        audioService.playNavigate();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + COLS < KEYS.length ? prev + COLS : prev));
        audioService.playNavigate();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedIndex(prev => (prev % COLS !== 0 ? prev - 1 : prev));
        audioService.playNavigate();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedIndex(prev => ((prev + 1) % COLS !== 0 && prev + 1 < KEYS.length ? prev + 1 : prev));
        audioService.playNavigate();
      } 
      // Arcade Actions
      else if (e.key === 'Enter') {
        e.preventDefault();
        // If focusing on a key via arcade navigation, type it
        const char = KEYS[selectedIndex];
        if (text.length < MAX_LEN) {
          setText(prev => prev + char);
          audioService.playSelect();
        }
      } 
      // Physical Keyboard Typing
      else if (e.key.length === 1) {
        // Valid chars for arcade name
        const key = e.key.toUpperCase();
        if (/[A-Z0-9 ._-]/.test(key) && text.length < MAX_LEN) {
          setText(prev => prev + key);
          // Find index to visually update grid (optional UX polish)
          const idx = KEYS.indexOf(key);
          if (idx !== -1) setSelectedIndex(idx);
          audioService.playNavigate();
        }
      }
      
      // Deletion
      if (e.key === 'Backspace') {
        setText(prev => prev.slice(0, -1));
        audioService.playBack();
      } 
      
      // Confirmation (Shift is typically Arcade Start, but we can also use a specific logic)
      if (e.key === 'Shift' || (e.key === 'Enter' && e.ctrlKey)) {
         confirmName();
      } 
      
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [text, selectedIndex, onComplete, onCancel]);

  const confirmName = () => {
    if (text.length > 0) {
      audioService.playSelect();
      onComplete(text);
    }
  };

  const handleKeyClick = (char: string) => {
    if (text.length < MAX_LEN) {
      setText(prev => prev + char);
      audioService.playSelect();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-black/95 border-4 border-blue-500 rounded-xl shadow-[0_0_50px_rgba(59,130,246,0.5)] max-w-4xl w-full">
      <h2 className="text-3xl text-blue-300 font-arcade mb-2">DIGITE O NOME</h2>
      
      {/* Display */}
      <div className="w-full bg-gray-900 border-2 border-gray-600 p-4 mb-8 text-center min-h-[80px] flex items-center justify-center">
        <span className="text-4xl text-yellow-400 font-arcade tracking-widest">{text}<span className="animate-pulse">_</span></span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-10 gap-2 md:gap-3 mb-8">
        {KEYS.map((char, idx) => (
          <button
            key={idx}
            onMouseEnter={() => setSelectedIndex(idx)}
            onClick={() => handleKeyClick(char)}
            className={`
              w-10 h-10 md:w-12 md:h-12 flex items-center justify-center font-arcade text-xl border-2 rounded transition-transform
              ${selectedIndex === idx 
                ? 'bg-blue-600 border-white text-white scale-110 shadow-lg z-10' 
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}
            `}
          >
            {char === " " ? "␣" : char}
          </button>
        ))}
      </div>

      {/* Hints / Controls */}
      <div className="flex flex-col md:flex-row gap-8 items-center justify-center text-xs md:text-sm font-arcade text-gray-400 w-full">
         {/* Mouse UI Buttons */}
         <button 
           onClick={() => setText(prev => prev.slice(0, -1))}
           className="px-4 py-2 bg-red-900/50 border border-red-500 rounded hover:bg-red-800 text-red-200"
         >
           BACKSPACE (DEL)
         </button>
         
         <button 
           onClick={confirmName}
           className="px-6 py-3 bg-green-600 border-2 border-green-400 rounded text-white shadow-[0_0_15px_rgba(34,197,94,0.5)] hover:bg-green-500 hover:scale-105 transition-all"
         >
           START (CONFIRMAR)
         </button>
      </div>
      
      <p className="mt-4 text-[10px] text-gray-600">Pode usar teclado físico ou mouse</p>
    </div>
  );
};