import React from 'react';

export const JoystickHint: React.FC = () => {
  return (
    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-8 text-gray-500 text-sm font-arcade opacity-70">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 border-2 border-current rounded-full flex items-center justify-center mb-1">
          <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
        </div>
        <span>NAVEGAR</span>
        <span className="text-[10px]">(SETAS)</span>
      </div>
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 border-2 border-green-500 text-green-500 rounded-full flex items-center justify-center mb-1 bg-green-900/20">
          A
        </div>
        <span className="text-green-500">CONFIRMAR</span>
        <span className="text-[10px] text-green-500">(ENTER/ESPAÇO)</span>
      </div>
    </div>
  );
};