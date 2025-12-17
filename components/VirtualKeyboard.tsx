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
const MAX_LEN = 12;

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({ initialName, onComplete, onCancel }) => {
  const [text, setText] = useState(initialName);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleKeyClick = (char: string) => {
    if (text.length < MAX_LEN) {
      setText(prev => prev + char);
      audioService.playSelect();
    }
  };

  const confirmName = () => {
    if (text.length > 0) {
      audioService.playSelect();
      onComplete(text);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 md:p-8 bg-black/95 border-4 border-blue-500 rounded-xl shadow-[0_0_50px_rgba(59,130,246,0.5)] max-w-4xl w-full mx-auto">
      <h2 className="text-xl md:text-3xl text-blue-300 font-arcade mb-4">DIGITE O NOME</h2>
      
      <div className="w-full bg-gray-900 border-2 border-gray-600 p-4 mb-6 text-center min-h-[60px] flex items-center justify-center">
        <span className="text-2xl md:text-4xl text-yellow-400 font-arcade tracking-widest">
          {text}<span className="animate-pulse">_</span>
        </span>
      </div>

      {/* Grid Responsivo: 5 colunas no celular, 10 no PC */}
      <div className="grid grid-cols-5 md:grid-cols-10 gap-2 md:gap-3 mb-8">
        {KEYS.map((char, idx) => (
          <button
            key={idx}
            onClick={() => handleKeyClick(char)}
            className="w-12 h-12 md:w-12 md:h-12 flex items-center justify-center font-arcade text-lg border-2 rounded transition-all active:scale-90 active:bg-blue-500 bg-gray-800 border-gray-700 text-gray-400"
          >
            {char === " " ? "␣" : char}
          </button>
        ))}
      </div>

      <div className="flex flex-row gap-4 w-full">
         <button 
           onClick={() => setText(prev => prev.slice(0, -1))}
           className="flex-1 py-4 bg-red-900/50 border border-red-500 rounded font-arcade text-red-200 active:bg-red-800"
         >
           DEL
         </button>
         
         <button 
           onClick={confirmName}
           className="flex-[2] py-4 bg-green-600 border-2 border-green-400 rounded text-white font-arcade shadow-lg active:scale-95"
         >
           START
         </button>
      </div>
    </div>
  );
};