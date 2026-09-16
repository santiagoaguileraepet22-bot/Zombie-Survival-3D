import React from 'react';
import { AppTab } from '../types';
import { Gamepad2, FileCode2, BookOpen, Skull, Terminal, ExternalLink } from 'lucide-react';

interface HeaderProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onSelectTab }) => {
  return (
    <header className="w-full bg-neutral-900/90 border-b border-neutral-800 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo y Título */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center text-neutral-950 font-black shadow-lg shadow-amber-500/20">
            <Skull className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-neutral-100 flex items-center gap-2">
              Zombie Survival 3D
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Ursina & Python
              </span>
            </h1>
            <p className="text-xs text-neutral-400 hidden sm:block">
              Prototipo en 3ª persona contra oleadas de zombies
            </p>
          </div>
        </div>

        {/* Pestañas de Navegación */}
        <nav className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
          <button
            onClick={() => onSelectTab('game')}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              currentTab === 'game'
                ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Simulador 3D</span>
          </button>

          <button
            onClick={() => onSelectTab('code')}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              currentTab === 'code'
                ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Código Python</span>
          </button>

          <button
            onClick={() => onSelectTab('guide')}
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              currentTab === 'guide'
                ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Arquitectura</span>
            <span className="sm:hidden">Guía</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
