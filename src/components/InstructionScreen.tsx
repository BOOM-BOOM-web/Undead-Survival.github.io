import React from "react";
import { 
  Keyboard, 
  MousePointer, 
  Activity, 
  RotateCcw, 
  Zap, 
  Flame, 
  Skull, 
  ShieldCheck, 
  TrendingUp,
  Radio,
  Sword,
  Map as MapIcon
} from "lucide-react";

interface InstructionScreenProps {
  onStart: () => void;
  selectedMap: string;
  setSelectedMap: (map: string) => void;
}

export const InstructionScreen: React.FC<InstructionScreenProps> = ({ onStart, selectedMap, setSelectedMap }) => {
  return (
    <div className="absolute inset-0 bg-stone-950 overflow-y-auto font-sans z-50 pointer-events-auto">
      <div className="min-h-full flex flex-col items-center justify-center p-6">
        <div className="max-w-4xl w-full bg-stone-900 border border-stone-850 rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-8 relative overflow-hidden">
        {/* Glow background decorations */}
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-red-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-violet-600/10 rounded-full blur-3xl" />

        {/* Title */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="bg-red-950/80 border border-red-500/30 px-3.5 py-1.5 rounded-full text-red-400 font-mono text-[10px] tracking-widest uppercase flex items-center gap-2">
            <Radio className="w-3 h-3 animate-ping" /> COD Zombies Classic Spiritual Successor
          </div>
          <h1 className="text-white font-extrabold text-5xl tracking-tight leading-none uppercase drop-shadow-md">
            UNDEAD SURVIVAL <span className="text-red-600">3D FPS</span>
          </h1>
          <p className="text-stone-400 text-sm max-w-lg mt-1 leading-relaxed">
            Survive endless, scaling waves of flesh-eating zombies. Earn cash from non-lethal headshots to unlock rooms, buy high-tier secondary firearms, flip the generator, and fortify yourself with perks.
          </p>
        </div>

        {/* Map Selection */}
        <div className="w-full flex flex-col items-center gap-4 mt-2">
          <h3 className="text-white font-black text-sm uppercase tracking-wider flex items-center gap-2 pb-2">
            <MapIcon className="w-4 h-4 text-red-500" /> Select Map Location
          </h3>
          <div className="flex gap-4">
            <button 
              onClick={() => setSelectedMap('town')}
              className={`px-8 py-3 rounded-xl border-2 transition-all font-bold tracking-wider uppercase ${selectedMap === 'town' ? 'bg-red-600/20 border-red-500 text-white' : 'bg-stone-950/50 border-stone-800 text-stone-400 hover:border-stone-600'}`}
            >
              Town center
            </button>
            <button 
              onClick={() => setSelectedMap('one_window')}
              className={`px-8 py-3 rounded-xl border-2 transition-all font-bold tracking-wider uppercase ${selectedMap === 'one_window' ? 'bg-red-600/20 border-red-500 text-white' : 'bg-stone-950/50 border-stone-800 text-stone-400 hover:border-stone-600'}`}
            >
              One Window
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mt-2">
          {/* Controls Column */}
          <div className="flex flex-col gap-4">
            <h3 className="text-white font-black text-sm uppercase tracking-wider flex items-center gap-2 border-b border-stone-800 pb-2">
              <Keyboard className="w-4 h-4 text-red-500" /> Keybinds & Shooter Controls
            </h3>
            
            <div className="grid grid-cols-2 gap-3 text-stone-300 font-mono text-xs">
              <div className="flex justify-between bg-stone-950 p-2.5 rounded-lg border border-stone-900">
                <span className="text-stone-500">Walk:</span>
                <span className="text-yellow-400 font-black">W A S D</span>
              </div>
              <div className="flex justify-between bg-stone-950 p-2.5 rounded-lg border border-stone-900">
                <span className="text-stone-500">Sprint Energy:</span>
                <span className="text-yellow-400 font-black">HOLD SHIFT</span>
              </div>
              <div className="flex justify-between bg-stone-950 p-2.5 rounded-lg border border-stone-900">
                <span className="text-stone-500">Aim Camera:</span>
                <span className="text-yellow-400 font-black">MOUSE LOOK</span>
              </div>
              <div className="flex justify-between bg-stone-950 p-2.5 rounded-lg border border-stone-900">
                <span className="text-stone-500">Shoot Gun:</span>
                <span className="text-yellow-400 font-black">LEFT CLICK</span>
              </div>
              <div className="flex justify-between bg-stone-950 p-2.5 rounded-lg border border-stone-900">
                <span className="text-stone-500">Aim Sights (ADS):</span>
                <span className="text-yellow-400 font-black">RIGHT CLICK</span>
              </div>
              <div className="flex justify-between bg-stone-950 p-2.5 rounded-lg border border-stone-900">
                <span className="text-stone-500">Tactical Reload:</span>
                <span className="text-yellow-400 font-black">R KEY</span>
              </div>
              <div className="flex justify-between bg-stone-950 p-2.5 rounded-lg border border-stone-900">
                <span className="text-stone-500">Swap Weapons:</span>
                <span className="text-yellow-400 font-black">TAB or Q</span>
              </div>
              <div className="flex justify-between bg-stone-950 p-2.5 rounded-lg border border-stone-900">
                <span className="text-stone-500">Interact / Buy:</span>
                <span className="text-yellow-400 font-black">E KEY</span>
              </div>
              <div className="flex justify-between bg-stone-950 p-2.5 rounded-lg border border-stone-900 col-span-2">
                <span className="text-stone-500">Crouch / Dodge Height:</span>
                <span className="text-yellow-400 font-black">C or CTRL KEY</span>
              </div>
            </div>

            <div className="p-3.5 bg-stone-950/60 rounded-xl border border-stone-850/40 text-stone-400 text-xs leading-normal">
              💡 <span className="text-stone-300 font-bold">Kiting Pro Tip:</span> Earn <span className="text-stone-200">+10pts</span> on hits, <span className="text-stone-200">+60pts</span> on standard kills, and <span className="text-stone-200 font-bold text-amber-400">+130pts</span> for crisp headshots! Align your sights using Ads (Right-click) to secure critical blows.
            </div>
          </div>

          {/* Gameplay Systems Column */}
          <div className="flex flex-col gap-4">
            <h3 className="text-white font-black text-sm uppercase tracking-wider flex items-center gap-2 border-b border-stone-800 pb-2">
              <Sword className="w-4 h-4 text-red-500" /> Map Progression & Boosters
            </h3>

            <div className="flex flex-col gap-2.5 text-xs text-stone-450 leading-relaxed">
              <div className="flex items-start gap-2.5 bg-stone-950 p-2.5 rounded-xl border border-stone-900">
                <div className="p-1 bg-red-650/10 rounded border border-red-500/25 mt-0.5">
                  <Activity className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <span className="font-extrabold text-stone-200 block">Juggernog Soda (2500 PTS)</span>
                  Triples maximum player health buffer, letting you survive 5 hits instead of 2 before collapsing.
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-stone-950 p-2.5 rounded-xl border border-stone-900">
                <div className="p-1 bg-emerald-650/10 rounded border border-emerald-500/25 mt-0.5">
                  <RotateCcw className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <span className="font-extrabold text-stone-200 block">Speed Coca-Cola (3000 PTS)</span>
                  Halves tactical reloading and weaponry swapping times. Essential for high intense pressure.
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-stone-950 p-2.5 rounded-xl border border-stone-900">
                <div className="p-1 bg-amber-650/10 rounded border border-amber-500/25 mt-0.5">
                  <Flame className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <span className="font-extrabold text-stone-200 block">Double Tap Soda (2000 PTS)</span>
                  Increases firing rate speed and elevates kinetic bullet bullet impact by 20%.
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-stone-950 p-2.5 rounded-xl border border-stone-900">
                <div className="p-1 bg-purple-650/10 rounded border border-purple-500/25 mt-0.5">
                  <Zap className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <span className="font-extrabold text-stone-200 block">A.E.S.I.R. Pack-a-Punch Station (5000 PTS)</span>
                  Fuses your current weapon, turning it into a magenta laser engine dealing nearly 3x raw damage.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Start CTA */}
        <button 
          className="mt-4 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-extrabold text-lg px-12 py-4.5 rounded-2xl shadow-xl shadow-red-600/25 pointer-events-auto transition-transform hover:scale-103 select-none flex items-center gap-2 cursor-pointer"
          onClick={onStart}
        >
          ENTER THE THEATRE OF THE UNDEAD
        </button>
        </div>
      </div>
    </div>
  );
};
