import React from 'react';
import { WeaponId } from '../types';
import { WEAPON_LIST } from '../data/weapons';
import { Shield, Zap, Target, Flame, Crosshair, Sparkles, Cpu } from 'lucide-react';

interface WeaponSelectorProps {
  currentWeapon: WeaponId;
  onSelectWeapon: (weaponId: WeaponId) => void;
}

export const WeaponSelector: React.FC<WeaponSelectorProps> = ({
  currentWeapon,
  onSelectWeapon,
}) => {
  const getIcon = (id: WeaponId) => {
    switch (id) {
      case 'pistol':
        return <Target className="w-4 h-4 text-amber-400" />;
      case 'shotgun':
        return <Shield className="w-4 h-4 text-orange-400" />;
      case 'rifle':
        return <Zap className="w-4 h-4 text-sky-400" />;
      case 'rocket':
        return <Flame className="w-4 h-4 text-rose-500" />;
      case 'sniper':
        return <Crosshair className="w-4 h-4 text-purple-400" />;
      case 'plasma':
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
      case 'minigun':
        return <Cpu className="w-4 h-4 text-yellow-400" />;
    }
  };

  return (
    <div className="bg-neutral-900/90 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-neutral-800 shadow-xl">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
            Arsenal Completo (7 Armas de Combate)
          </h3>
        </div>
        <span className="text-[11px] text-neutral-400">
          Usa teclas <b className="text-neutral-200">1 al 7</b> o recoge cajas en la arena
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {WEAPON_LIST.map((weapon) => {
          const isSelected = currentWeapon === weapon.id;
          return (
            <button
              key={weapon.id}
              onClick={() => onSelectWeapon(weapon.id)}
              className={`text-left p-2.5 rounded-xl border transition-all duration-200 flex flex-col justify-between cursor-pointer relative overflow-hidden group ${
                isSelected
                  ? 'bg-neutral-800 border-amber-500/80 shadow-[0_0_18px_rgba(245,158,11,0.22)]'
                  : 'bg-neutral-950/60 border-neutral-800/80 hover:bg-neutral-850 hover:border-neutral-700'
              }`}
            >
              {/* Barra indicadora superior */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 transition-all ${
                  isSelected ? 'bg-amber-400' : 'bg-transparent group-hover:bg-neutral-700'
                }`}
              />

              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
                      isSelected
                        ? 'bg-neutral-900 border-amber-500/40'
                        : 'bg-neutral-900 border-neutral-800'
                    }`}
                  >
                    {getIcon(weapon.id)}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      {weapon.category}
                    </span>
                    <h4 className="text-xs font-bold text-neutral-100 group-hover:text-white leading-tight">
                      {weapon.name}
                    </h4>
                  </div>
                </div>

                <span
                  className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    isSelected
                      ? 'bg-amber-500 text-neutral-950'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                  }`}
                >
                  [{weapon.keyNum}]
                </span>
              </div>

              {/* Especificaciones de combate */}
              <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-neutral-800/80 text-[10px]">
                <div>
                  <span className="text-neutral-500 block">DAÑO</span>
                  <span className="font-mono font-semibold text-neutral-200">
                    {weapon.damage} {weapon.pellets > 1 ? `x${weapon.pellets}` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block">CADENCIA</span>
                  <span className="font-mono font-semibold text-neutral-200">
                    {weapon.fireRate < 0.15 ? 'Alta' : weapon.fireRate < 0.35 ? 'Media' : 'Lenta'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
