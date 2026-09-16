import React, { useState } from 'react';
import { Header } from './components/Header';
import { Game3D } from './components/Game3D';
import { CodeViewer } from './components/CodeViewer';
import { ArchitectureGuide } from './components/ArchitectureGuide';
import { AppTab } from './types';
import { Download, Terminal, Sparkles, Shield, Award, Play, Crosshair } from 'lucide-react';
import { PYTHON_CODE } from './data/pythonCode';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('game');
  const [liveStats, setLiveStats] = useState({ kills: 0, wave: 1, health: 100 });

  const handleDownloadPython = () => {
    const blob = new Blob([PYTHON_CODE], { type: 'text/x-python;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'zombie_survival_3d.py');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-neutral-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Barra de Navegación Superior */}
      <Header currentTab={activeTab} onSelectTab={setActiveTab} />

      {/* Contenedor Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        {/* Banner de Bienvenida y Acciones Rápidas */}
        <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-neutral-100">
                  Prototipo 3D en Tercera Persona contra Zombies
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Ursina Engine
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Prueba la simulación WebGL en vivo o descarga el código fuente completo en Python para tu terminal.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('code')}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-200 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Terminal className="w-4 h-4 text-amber-400" />
              <span>Ver Código Python</span>
            </button>

            <button
              onClick={handleDownloadPython}
              className="flex-1 sm:flex-none px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Descargar .py</span>
            </button>
          </div>
        </div>

        {/* Contenido Condicional según Pestaña */}
        {activeTab === 'game' && (
          <div className="flex flex-col gap-4">
            {/* Simulador de Juego 3D */}
            <Game3D onUpdateStats={setLiveStats} />

            {/* Ficha explicativa de la correspondencia con Ursina Engine */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                  <Play className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-200">Cámara en 3ª Persona</h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Rig orbital suave con ángulo de visión ajustable, límites de inclinación (pitch) y seguimiento lerp continuo.
                  </p>
                </div>
              </div>

              <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-200">IA de Persecución</h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Zombies calculan vectores directos hacia el jugador, infligen daño a corta distancia y retroceden al ser impactados.
                  </p>
                </div>
              </div>

              <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-200">Oleadas Progresivas</h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Spawneo dinámico en el perímetro exterior con incremento gradual de enemigos y velocidad por cada oleada superada.
                  </p>
                </div>
              </div>

              <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                  <Crosshair className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-200">Arsenal de 4 Armas</h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Cambio rápido con teclas 1-4: Pistola, Escopeta, Fusil automático y Lanzacohetes RPG con daño en área.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'code' && <CodeViewer />}

        {activeTab === 'guide' && <ArchitectureGuide />}
      </main>

      {/* Pie de Página */}
      <footer className="w-full border-t border-neutral-800/80 bg-neutral-950 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-500">
          <p>
            Prototipo 3D desarrollado con <strong className="text-neutral-400 font-semibold">Ursina Engine (Python)</strong> y simulador WebGL interactivo.
          </p>
          <div className="flex items-center gap-4">
            <span>pip install ursina</span>
            <span>•</span>
            <span>Python 3.8+</span>
            <span>•</span>
            <button
              onClick={() => setActiveTab('code')}
              className="text-amber-400 hover:underline cursor-pointer"
            >
              Ver código fuente
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

