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
const MAX_LEN = 10;

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({ initialName, onComplete, onCancel }) => {
  const [text, setText] = useState(initialName);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.key.startsWith("F")) return;

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
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleKeyClick(KEYS[selectedIndex]);
      } else if (e.key.length === 1) {
        const key = e.key.toUpperCase();
        if (/[A-Z0-9 ._-]/.test(key) && text.length < MAX_LEN) {
          setText(prev => prev + key);
          audioService.playNavigate();
        }
      }
      
      if (e.key === 'Backspace') {
        setText(prev => prev.slice(0, -1));
        audioService.playBack();
      } 
      
      if (e.key === 'Escape') onCancel();
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
    <div className="flex flex-col items-center justify-center p-4 bg-black/95 border-4 border-blue-500 rounded-xl shadow-[0_0_50px_rgba(59,130,246,0.5)] max-w-lg w-full">
      <h2 className="text-xl text-blue-300 font-arcade mb-4">DIGITE SEU NOME</h2>
      
      <div className="w-full bg-gray-900 border-2 border-gray-600 p-3 mb-6 text-center min-h-[60px] flex items-center justify-center">
        <span className="text-2xl md:text-3xl text-yellow-400 font-arcade tracking-widest">{text}<span className="animate-pulse">_</span></span>
      </div>

      <div className="grid grid-cols-8 md:grid-cols-10 gap-1.5 mb-6">
        {KEYS.map((char, idx) => (
          <button
            key={idx}
            onClick={() => handleKeyClick(char)}
            className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center font-arcade text-xs md:text-lg border-2 rounded transition-all active:scale-90 ${selectedIndex === idx ? 'bg-blue-600 border-white text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
            onMouseEnter={() => setSelectedIndex(idx)}
          >
            {char === " " ? "␣" : char}
          </button>
        ))}
      </div>

      <div className="flex gap-4 w-full">
         <button onClick={() => { setText(prev => prev.slice(0, -1)); audioService.playBack(); }} className="flex-1 py-3 bg-red-900/50 border border-red-500 rounded font-arcade text-[10px] text-red-200">APAGAR</button>
         <button onClick={confirmName} className="flex-[2] py-3 bg-green-600 border-2 border-green-400 rounded text-white font-arcade text-[10px] shadow-[0_0_15px_rgba(34,197,94,0.5)]">CONFIRMAR</button>
      </div>
    </div>
  );
};