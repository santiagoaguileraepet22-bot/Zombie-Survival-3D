import React, { useState } from 'react';
import { PYTHON_CODE } from '../data/pythonCode';
import { Copy, Check, Download, Terminal, FileCode, Sparkles, BookOpen } from 'lucide-react';

export const CodeViewer: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleCopy = () => {
    navigator.clipboard.writeText(PYTHON_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleDownload = () => {
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

  const lines = PYTHON_CODE.split('\n');
  const filteredLines = searchQuery
    ? lines.map((line, idx) => ({ line, num: idx + 1 })).filter(item => item.line.toLowerCase().includes(searchQuery.toLowerCase()))
    : lines.map((line, idx) => ({ line, num: idx + 1 }));

  return (
    <div className="flex flex-col gap-6">
      {/* Barra de Instrucciones Rápidas y Comandos pip */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
                Instrucciones de Ejecución en Local
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-normal">
                  Python 3.8+
                </span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Para jugar en tu computadora personal, instala el motor Ursina Engine y ejecuta el archivo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? '¡Copiado al Portapapeles!' : 'Copiar Código'}
            </button>

            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Descargar .py
            </button>
          </div>
        </div>

        {/* Bloque de comandos listos para copiar */}
        <div className="mt-4 pt-4 border-t border-neutral-800/80 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-neutral-950 border border-neutral-800/90 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-amber-400 text-xs font-mono select-none">$</span>
              <code className="text-xs font-mono text-neutral-200 truncate">pip install ursina</code>
            </div>
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">1. Dependencia</span>
          </div>

          <div className="bg-neutral-950 border border-neutral-800/90 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-amber-400 text-xs font-mono select-none">$</span>
              <code className="text-xs font-mono text-neutral-200 truncate">python zombie_survival_3d.py</code>
            </div>
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">2. Ejecutar</span>
          </div>
        </div>
      </div>

      {/* Visor de Código Python con Estilo Editor */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Cabecera del archivo */}
        <div className="bg-neutral-900/90 px-4 py-3 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FileCode className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-mono font-medium text-neutral-200">zombie_survival_3d.py</span>
            <span className="text-[10px] text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded">
              {lines.length} líneas
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Buscar función o clase..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50 w-48 sm:w-64"
            />
          </div>
        </div>

        {/* Contenido con números de línea */}
        <div className="max-h-[620px] overflow-y-auto font-mono text-xs p-4 leading-relaxed bg-[#0d1117] text-neutral-300 select-text">
          {filteredLines.map(({ line, num }) => {
            const isComment = line.trim().startsWith('#') || line.trim().startsWith('"""') || line.trim().startsWith("'''");
            const isClass = line.includes('class ') && line.includes(':');
            const isDef = line.includes('def ') && line.includes(':');
            const isImport = line.startsWith('from ') || line.startsWith('import ');

            return (
              <div key={num} className="flex hover:bg-neutral-800/40 px-2 py-0.5 rounded group">
                <span className="w-12 text-right text-neutral-600 group-hover:text-neutral-400 pr-4 select-none shrink-0">
                  {num}
                </span>
                <span
                  className={`flex-1 whitespace-pre ${
                    isComment
                      ? 'text-emerald-500/90 italic'
                      : isClass
                      ? 'text-amber-300 font-bold'
                      : isDef
                      ? 'text-cyan-300 font-semibold'
                      : isImport
                      ? 'text-purple-400'
                      : 'text-neutral-200'
                  }`}
                >
                  {line}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
