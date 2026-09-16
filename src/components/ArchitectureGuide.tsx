import React from 'react';
import { Layers, User, Skull, Crosshair, Monitor, Cpu, CheckCircle2, ArrowRight, Target } from 'lucide-react';

export const ArchitectureGuide: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 text-neutral-200">
      {/* Resumen del Enfoque Técnico */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-neutral-100 flex items-center gap-2.5 mb-2">
          <Layers className="w-5 h-5 text-amber-400" />
          Arquitectura Orientada a Objetos en Ursina Engine
        </h2>
        <p className="text-sm text-neutral-400 leading-relaxed max-w-3xl">
          El prototipo está estructurado bajo principios de código limpio y modularidad. Dado que Tkinter está diseñado exclusivamente para renderizado 2D y carece de pipeline 3D por hardware nativo, 
          <strong className="text-neutral-200"> Ursina Engine</strong> es la solución idónea en Python: ofrece un pipeline acelerado por GPU (basado en Panda3D y OpenGL) con una sintaxis concisa y potente para cámaras en tercera persona y sistemas de entidades.
        </p>
      </div>

      {/* Tarjetas de Clases Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Clase Player */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 hover:border-neutral-700 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100 font-mono">Clase Player(Entity)</h3>
              <span className="text-[11px] text-neutral-400">Personaje y control del usuario</span>
            </div>
          </div>
          <ul className="space-y-2 text-xs text-neutral-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>
                <strong>Movimiento WASD Relativo a la Cámara:</strong> Los vectores de movimiento se proyectan según el ángulo azimutal (yaw) de la cámara.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>
                <strong>Rotación Suave:</strong> El personaje gira automáticamente hacia la dirección en la que camina mediante interpolación lineal (lerp).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>
                <strong>Sistema de Disparo:</strong> Calcula la trayectoria exacta hacia donde apunta el centro de la cámara y proyecta la bala desde el arma.
              </span>
            </li>
          </ul>
        </div>

        {/* Clase Zombie */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 hover:border-neutral-700 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Skull className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100 font-mono">Clase Zombie(Entity)</h3>
              <span className="text-[11px] text-neutral-400">Inteligencia artificial y ataque</span>
            </div>
          </div>
          <ul className="space-y-2 text-xs text-neutral-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Persecución Continua:</strong> En cada frame calcula el vector normalizado hacia el jugador con <code className="text-emerald-400">look_at_2d()</code>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Retroalimentación de Daño:</strong> Al ser impactado, el material cambia instantáneamente a rojo vivo y retrocede ligeramente.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Rango de Ataque y Cooldown:</strong> Inflige daño al jugador únicamente cuando la distancia es menor a 1.6 unidades.
              </span>
            </li>
          </ul>
        </div>

        {/* Sistema de Aimlock (Auto-Target Lock) */}
        <div className="bg-neutral-900/90 border border-red-500/30 rounded-2xl p-5 hover:border-red-500/50 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100 font-mono">Sistema Aimlock</h3>
              <span className="text-[11px] text-neutral-400">Fijación de blanco y seguimiento</span>
            </div>
          </div>
          <ul className="space-y-2 text-xs text-neutral-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>
                <strong>Cálculo Conical y Ponderado:</strong> Evalúa proximidad angular al centro de la mira y distancia tridimensional para priorizar la amenaza más inmediata.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>
                <strong>Seguimiento Orbital y Corrección Balística:</strong> Ajusta los ángulos Yaw/Pitch de la cámara en 3ª persona e imanta los proyectiles directamente al pecho del zombie.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>
                <strong>Controles Rápidos:</strong> Conmutación con tecla <kbd className="bg-neutral-800 px-1 rounded text-red-300 font-mono">E</kbd> / <kbd className="bg-neutral-800 px-1 rounded text-red-300 font-mono">F</kbd> o fijación continua sosteniendo el <strong>Clic Derecho</strong>.
              </span>
            </li>
          </ul>
        </div>

        {/* Clase Bullet y Arsenal */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 hover:border-neutral-700 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100 font-mono">Arsenal & Balística (Bullet)</h3>
              <span className="text-[11px] text-neutral-400">Dispersión, daño en área y cadencia</span>
            </div>
          </div>
          <ul className="space-y-2 text-xs text-neutral-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>4 Tipos de Armamento:</strong> Pistola táctica precisa (tecla 1), escopeta divergente (tecla 2), fusil automático (tecla 3) y lanzacohetes RPG (tecla 4).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Daño Radial (Splash):</strong> Los cohetes aplican onda de choque con empuje y daño escalado según la distancia del epicentro.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Retroalimentación Física:</strong> Recoil en el modelo del arma, destello luminoso y chispas de impacto.
              </span>
            </li>
          </ul>
        </div>

        {/* Clase Game */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 hover:border-neutral-700 transition-colors md:col-span-2 lg:col-span-2">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100 font-mono">Clase Game</h3>
              <span className="text-[11px] text-neutral-400">Control maestro, oleadas y UI</span>
            </div>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-neutral-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>
                <strong>Rig de Cámara 3ª Persona:</strong> Nodo pivote con seguimiento suave al jugador y control orbital por mouse (Yaw y Pitch).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>
                <strong>Generador de Oleadas:</strong> Spawnea enemigos en radio circular aleatorio a distancia prudencial (25-40 unidades).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>
                <strong>HUD y Game Over:</strong> Muestra la barra de salud, conteo de zombies y panel modal con reinicio instantáneo mediante la tecla <kbd className="bg-neutral-800 px-1 rounded text-purple-300 font-mono">R</kbd>.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Guía de Instalación y Requisitos Paso a Paso */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2 mb-4">
          <Cpu className="w-5 h-5 text-cyan-400" />
          Guía de Configuración e Instalación en tu Sistema Operativo
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-4">
            <div className="text-xs font-bold text-neutral-200 mb-2 flex items-center gap-1.5">
              <span>🪟 Windows</span>
            </div>
            <p className="text-xs text-neutral-400 mb-3">
              Abre PowerShell o Símbolo del Sistema y ejecuta:
            </p>
            <div className="bg-neutral-900 p-2.5 rounded-lg font-mono text-[11px] text-amber-300 border border-neutral-800">
              pip install ursina<br />
              python zombie_survival_3d.py
            </div>
          </div>

          <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-4">
            <div className="text-xs font-bold text-neutral-200 mb-2 flex items-center gap-1.5">
              <span>🍎 macOS</span>
            </div>
            <p className="text-xs text-neutral-400 mb-3">
              Abre Terminal. Si usas Python 3 con Homebrew:
            </p>
            <div className="bg-neutral-900 p-2.5 rounded-lg font-mono text-[11px] text-amber-300 border border-neutral-800">
              pip3 install ursina<br />
              python3 zombie_survival_3d.py
            </div>
          </div>

          <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-4">
            <div className="text-xs font-bold text-neutral-200 mb-2 flex items-center gap-1.5">
              <span>🐧 Linux (Ubuntu / Debian)</span>
            </div>
            <p className="text-xs text-neutral-400 mb-3">
              Requiere librerías OpenGL de sistema:
            </p>
            <div className="bg-neutral-900 p-2.5 rounded-lg font-mono text-[11px] text-amber-300 border border-neutral-800">
              sudo apt install python3-pip<br />
              pip3 install ursina
            </div>
          </div>
        </div>

        {/* Nota sobre empaquetado a ejecutable */}
        <div className="mt-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs text-neutral-300">
          <ArrowRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-300">¿Quieres compilar el juego en un .EXE independiente para compartirlo?</strong>
            <p className="mt-0.5 text-neutral-400">
              Puedes empaquetar todo el juego en un único ejecutable sin necesidad de que otros tengan Python instalado usando PyInstaller: <code className="text-amber-300 font-mono">pip install pyinstaller</code> y luego <code className="text-amber-300 font-mono">pyinstaller --onefile --noconsole zombie_survival_3d.py</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
