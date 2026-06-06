import React from "react";
import { PlayerStats, HitMarker, PerkType } from "../types";
import { 
  Flame, 
  Activity, 
  Zap, 
  RotateCcw, 
  Skull, 
  TrendingUp, 
  Coins, 
  Target, 
  Crosshair as CrosshairIcon, 
  CornerDownRight, 
  Check,
  Pause,
  Play
} from "lucide-react";

interface GameHUDProps {
  stats: PlayerStats;
  staminaPercent: number;
  powerupTimers: { insta_kill: number; double_points: number };
  hitmarkers: HitMarker[];
  prompt: string | null;
  interactionPrompt: { text: string; subtext: string; cost: number } | null;
  radarData: { player: { x: number, z: number, yaw: number }, zombies: { id: string, x: number, z: number }[] };
  onRestart: () => void;
  onGoLobby: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  stats,
  staminaPercent,
  powerupTimers,
  hitmarkers,
  prompt,
  interactionPrompt,
  radarData,
  onRestart,
  onGoLobby
}) => {
  const [isPaused, setIsPaused] = React.useState(false);
  const lastExitTimeRef = React.useRef<number>(0);

  const requestSafePointerLock = React.useCallback((element: Element | null) => {
    if (!element) return;
    const now = Date.now();
    if (now - lastExitTimeRef.current < 1200) {
      console.warn("Suppressing requestPointerLock due to exit cooldown.");
      return;
    }
    try {
      const promise = element.requestPointerLock() as any;
      if (promise && typeof promise.catch === "function") {
        promise.catch((err: any) => {
          console.warn("Pointer lock request was rejected:", err);
        });
      }
    } catch (err) {
      console.warn("Pointer lock request threw synchronous error:", err);
    }
  }, []);

  React.useEffect(() => {
    const handlePointerLockChange = () => {
      if (document.pointerLockElement) {
        setIsPaused(false);
      } else {
        lastExitTimeRef.current = Date.now();
        if (!stats.isDead) { // Don't show pause if dead
          setIsPaused(true);
        }
      }
    };
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    return () => document.removeEventListener("pointerlockchange", handlePointerLockChange);
  }, [stats.isDead]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyP" && !stats.isDead && !prompt) {
        if (document.pointerLockElement) {
          document.exitPointerLock();
        } else {
          setIsPaused(prev => !prev);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stats.isDead, prompt]);

  React.useEffect(() => {
    if (stats.isDead && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [stats.isDead]);

  // Safe accessor for current gun
  const gun = stats.weapons[stats.currentWeaponIndex] || {
    name: "Unarmed",
    currentMag: 0,
    maxMag: 0,
    currentReserve: 0,
    isPackAPunched: false,
    ammoTypeName: "No Ammo"
  };

  const isLowAmmo = gun.currentMag < gun.maxMag * 0.3 && gun.maxMag > 0;
  const isCriticalHealth = stats.health < stats.maxHealth * 0.35 && !stats.isDead;

  // Render recent hitmarker
  const latestHit = hitmarkers.length > 0 ? hitmarkers[hitmarkers.length - 1] : null;

  return (
    <div className="absolute inset-0 pointer-events-none select-none font-sans overflow-hidden">
      {/* 1. ATMOSPHERIC CRITICAL HEALTH OVERLAY */}
      {isCriticalHealth && (
        <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_40%,rgba(185,28,28,0.45)_100%)] animate-pulse border-8 border-red-700/60 z-10" />
      )}

      {/* PAUSE BUTTON (In level with the top cards, clean modern brutalist/military button style) */}
      {!stats.isDead && !prompt && (
        <button
          id="manual_pause_button"
          className="absolute top-10 right-[240px] z-30 pointer-events-auto bg-stone-950/85 hover:bg-stone-900 border border-stone-800 hover:border-stone-700 text-stone-300 hover:text-white px-4 py-2.5 rounded-lg flex items-center gap-2.5 shadow-xl backdrop-blur-md cursor-pointer transition-all active:scale-95 select-none"
          onClick={() => {
            if (document.pointerLockElement) {
              document.exitPointerLock();
            } else {
              setIsPaused(p => !p);
            }
          }}
          title="Pause Game [Esc or P]"
        >
          {isPaused ? <Play className="w-4 h-4 text-emerald-400 fill-emerald-400/20" /> : <Pause className="w-4 h-4 text-red-500 fill-red-500/20" />}
          <span className="font-mono text-xs font-bold tracking-wider uppercase">
            {isPaused ? "Resume" : "Pause [P]"}
          </span>
        </button>
      )}

      {/* 1.5 TOP LEFT MINIMAP */}
      <div className="absolute top-10 left-10 flex flex-col gap-1 z-20 opacity-85">
        <span className="text-stone-500 font-mono tracking-widest text-[10px] uppercase">Radar uplink</span>
        <div className="w-[160px] h-[160px] bg-stone-900/60 border-2 border-stone-800 rounded-full overflow-hidden relative shadow-[0_0_20px_rgba(30,41,59,0.5)] backdrop-blur-sm">
          {/* Radar scanline */}
          <div className="absolute inset-0 border-[0.5px] border-emerald-500/10 rounded-full m-[10%]" />
          <div className="absolute inset-x-0 top-1/2 h-[1px] bg-emerald-500/10" />
          <div className="absolute inset-y-0 left-1/2 w-[1px] bg-emerald-500/10" />
          
          {/* Map wrapper - rotates against player yaw to keep player facing UP */}
          <div 
            className="absolute inset-0 transition-transform duration-75 will-change-transform"
            style={{ 
              transformOrigin: 'center center',
              transform: `rotate(${radarData.player.yaw * (180/Math.PI)}deg)` 
            }}
          >
            <div 
              className="absolute will-change-transform"
              style={{
                width: 300, height: 300,
                left: '50%', top: '50%',
                transform: `translate(calc(-50% - ${radarData.player.x * 3}px), calc(-50% - ${radarData.player.z * 3}px))`
              }}
            >
              {/* Central PaP lava */}
              <div className="absolute top-[calc(50%)] left-[calc(50%)] w-[16px] h-[16px] bg-amber-500/30 rounded-full blur-[2px] -translate-x-1/2 -translate-y-1/2" />

              {/* Zombies */}
              {radarData.zombies.map(z => (
                <div 
                  key={z.id}
                  className="absolute w-2 h-2 rounded-full bg-red-500 border border-red-900 shadow-[0_0_4px_rgba(239,68,68,0.8)]"
                  style={{
                    left: `calc(50% + ${z.x * 3}px)`,
                    top: `calc(50% + ${z.z * 3}px)`,
                    transform: 'translate(-50%, -50%)'
                  }}
                />
              ))}
            </div>
          </div>
          
          {/* Player marker (Always in center facing UP) */}
          <div className="absolute top-1/2 left-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[10px] border-b-emerald-400 -translate-x-1/2 -translate-y-1/2 filter drop-shadow-[0_0_4px_rgba(52,211,153,1)]" />
        </div>
      </div>

      {/* CROSSHAIR */}
      {!stats.isDead && !stats.isADS && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-30 z-10 transition-opacity">
          <div className="w-1 h-1 bg-white/80 rounded-full"></div>
          <div className="absolute w-4 h-[1px] bg-white opacity-50 -translate-x-[16px]"></div>
          <div className="absolute w-4 h-[1px] bg-white opacity-50 translate-x-[16px]"></div>
          <div className="absolute h-4 w-[1px] bg-white opacity-50 -translate-y-[16px]"></div>
          <div className="absolute h-4 w-[1px] bg-white opacity-50 translate-y-[16px]"></div>
        </div>
      )}

      {/* 2. CORE STATS LEFT PANEL: ROUND TALLY COUNTER */}
      <div className="absolute bottom-10 left-10 flex flex-col items-start gap-3 z-20">
        <div className="flex items-center gap-1">
          {stats.perks.includes("juggernog") && (
            <div className="bg-red-950/80 border border-red-500 rounded px-2.5 py-1 text-red-400 font-mono text-xs flex items-center gap-1.5 shadow-lg shadow-red-950/40 animate-pulse">
              <Activity className="w-3.5 h-3.5" /> JUGGERNOG FORTIFIED
            </div>
          )}
        </div>

        {/* Bloody round tracker */}
        <div className="flex flex-col">
          <span className="text-stone-500 font-mono tracking-widest text-[10px] uppercase">Survival Round</span>
          <div className="flex items-baseline gap-2">
            <h1 className="text-gray-400/80 font-normal tracking-wider text-5xl select-none font-mono">
              {stats.round}
            </h1>
            <span className="text-gray-600/60 font-mono text-2xl font-bold">//</span>
            <span className="text-gray-500/50 font-mono text-sm">Undead Cleared</span>
          </div>
        </div>

        {/* ACTIVE PERK BADGES */}
        {stats.perks.length > 0 && (
          <div className="flex gap-2 mt-2">
            {stats.perks.map((perkId) => {
              const bg = perkId === "juggernog" ? "bg-red-900/40 border-red-900/50 text-red-200" : perkId === "speed_cola" ? "bg-emerald-900/40 border-emerald-900/50 text-emerald-200" : perkId === "double_tap" ? "bg-amber-900/40 border-amber-900/50 text-amber-200" : "bg-orange-900/40 border-orange-900/50 text-orange-200";
              const label = perkId === "juggernog" ? "JUG" : perkId === "speed_cola" ? "SPD" : perkId === "double_tap" ? "TAP" : "STM";
              const icon = perkId === "juggernog" ? <Activity className="w-3 h-3" /> : perkId === "speed_cola" ? <RotateCcw className="w-3 h-3" /> : perkId === "double_tap" ? <Flame className="w-3 h-3" /> : <Zap className="w-3 h-3" />;
              return (
                <div key={perkId} className={`${bg} font-mono font-medium text-[10px] px-2.5 py-1 rounded-sm flex items-center gap-1.5 border animate-fade-in`}>
                  {icon}
                  {label}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. LIME GREEN SCOREBOARD / POINTS TRACKER: RIGHT COLUMN */}
      <div className="absolute top-10 right-10 flex flex-col items-end gap-1.5 z-20">
        <span className="text-stone-500 font-mono tracking-widest text-[10px] uppercase">Survivor Points</span>
        <div className="bg-transparent border-r-2 border-stone-800 pr-4 flex flex-col items-end gap-1 min-w-[150px]">
          <span className="text-emerald-500/80 font-normal text-3xl tracking-wide font-mono">
            {stats.points.toLocaleString()} <span className="text-sm text-emerald-600/50 font-normal">PTS</span>
          </span>
          <div className="flex justify-between w-full text-stone-500 text-xs font-mono mt-2">
            <span>KILLS:</span>
            <span className="text-white font-bold">{stats.kills}</span>
          </div>
          <div className="flex justify-between w-full text-stone-400 text-xs font-mono">
            <span>HEADSHOTS:</span>
            <span className="text-amber-400 font-bold">{stats.headshots}</span>
          </div>
          <div className="flex justify-between w-full text-stone-400 text-xs font-mono mt-0.5">
            <span>ELECTRIC POWER:</span>
            <span className={`${stats.isPowerOn ? "text-emerald-400" : "text-red-500"} font-bold flex items-center gap-1`}>
              <span className={`w-1.5 h-1.5 rounded-full ${stats.isPowerOn ? "bg-emerald-400" : "bg-red-500"} animate-ping`} />
              {stats.isPowerOn ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        </div>
      </div>

      {/* 4. GUN AMMO HUD: BOTTOM RIGHT */}
      <div className="absolute bottom-10 right-10 flex flex-col items-end gap-2 z-20">
        <div className="bg-transparent border-l-2 border-stone-800 pl-4 flex flex-col items-end gap-1.5 min-w-[200px]">
          <div className="flex flex-col items-end w-full">
            <span className={`font-mono text-xl tracking-wide uppercase ${gun.isPackAPunched ? "text-fuchsia-300 font-bold drop-shadow-[0_0_8px_rgba(217,70,239,0.4)]" : "text-stone-300 font-normal"}`}>
              {gun.name}
            </span>
          </div>

          {/* Ammo clip meters */}
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className={`font-mono text-4xl font-normal ${isLowAmmo ? "text-red-400 animate-pulse" : "text-stone-200"}`}>
              {gun.currentMag}
            </span>
            <span className="text-stone-700 text-2xl font-light">/</span>
            <span className="text-stone-500 font-mono text-2xl font-normal">
              {gun.currentReserve}
            </span>
          </div>

          {/* STAMINA METER */}
          <div className="w-full mt-2">
            <div className="flex justify-between text-[8px] text-stone-600 font-mono mb-1 uppercase opacity-50">
              <span>stamina</span>
            </div>
            <div className="w-full bg-stone-900 rounded-sm h-[3px] overflow-hidden">
              <div 
                className={`h-full rounded-sm transition-all duration-75 ${
                  stats.perks.includes("stamin_up") ? "bg-orange-500/80" : "bg-stone-500/60"
                }`}
                style={{ width: `${staminaPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 5. CENTER SCREEN CROSSHAIR & HITMARKER TICK GRAPHICS */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center -z-10 pointer-events-none">
        {/* Dynamic Hitmarker flash when bullet clips undead */}
        {latestHit && (
          <div className="absolute w-12 h-12 flex items-center justify-center animate-ping">
            <div className={`text-xl font-mono font-medium opacity-60 ${
              latestHit.isKill ? "text-red-500 drop-shadow-[0_2px_10px_rgba(220,38,38,0.3)]" : 
              latestHit.isHeadshot ? "text-amber-500/80" : "text-stone-400"
            }`}>
              {latestHit.isKill ? "X" : latestHit.isHeadshot ? "O" : "+"}
            </div>
            {/* Hitmarker ticks */}
            <div className={`absolute border w-5 h-5 rotate-45 border-transparent opacity-40 ${
              latestHit.isKill ? "border-red-600 border-l-red-600 border-r-red-600" : "border-stone-400"
            }`} style={{ borderWidth: "1px" }} />
          </div>
        )}
      </div>

      {/* 6. CENTER LOWER INTERACTION ACTION PROMPTS */}
      <div className="absolute bottom-40 inset-x-0 flex flex-col items-center justify-center gap-1.5 z-20">
        {interactionPrompt && (
          <div className="bg-transparent text-center animate-fade-in pointer-events-none drop-shadow-md">
            <span className="text-gray-300 font-normal text-md tracking-wider font-mono">{interactionPrompt.text}</span>
            <br />
            <span className="text-stone-500 text-xs font-mono lowercase">{interactionPrompt.subtext}</span>
            {interactionPrompt.cost > 0 && (
              <div className="mt-2 text-[10px] uppercase font-mono">
                 <span className={`${stats.points >= interactionPrompt.cost ? "text-emerald-500/80" : "text-red-500/80"}`}>
                   {interactionPrompt.cost.toLocaleString()} pts
                 </span>
              </div>
            )}
          </div>
        )}

        {/* POWER-UP ALIGN TIMERS */}
        <div className="flex gap-4 mt-4">
          {powerupTimers.insta_kill > 0 && (
            <div className="bg-red-950/90 border border-red-500 px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg animate-pulse">
              <Skull className="w-4 h-4 text-red-500" />
              <div className="flex flex-col text-left">
                <span className="text-red-300 font-bold text-[10px] uppercase tracking-wider">Insta-Kill active</span>
                <span className="text-white font-mono font-black text-xs">{powerupTimers.insta_kill}s remaining</span>
              </div>
            </div>
          )}

          {powerupTimers.double_points > 0 && (
            <div className="bg-amber-950/90 border border-amber-500 px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg animate-pulse">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <div className="flex flex-col text-left">
                <span className="text-amber-300 font-bold text-[10px] uppercase tracking-wider">Double Points (2x)</span>
                <span className="text-white font-mono font-black text-xs">{powerupTimers.double_points}s remaining</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 7. MIDDLE PROMPT (CLICK TO LOCK) */}
      {prompt && (
        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-center z-50 pointer-events-auto">
          <div className="max-w-md p-8 bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl flex flex-col items-center gap-6">
            <div className="p-4 bg-red-600/10 rounded-full border border-red-600/30">
              <CrosshairIcon className="w-12 h-12 text-red-500 animate-spin" />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <h2 className="text-white text-2xl font-black uppercase tracking-wider">Lock Control Camera</h2>
              <p className="text-stone-400 text-sm">
                This game runs completely in high-performance 3D. Click below to lock your pointer inside the viewport to track and look around.
              </p>
            </div>

            <button 
              className="bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-red-600/20 pointer-events-auto transition-all cursor-pointer select-none text-base w-full"
              onClick={() => {
                const el = document.querySelector("canvas");
                requestSafePointerLock(el);
              }}
            >
              ENGAGE SHOOTER ENGINE
            </button>
          </div>
        </div>
      )}

      {/* 8. PAUSE AND GAME OVER SCREENS OVERLAY */}
      {isPaused && !stats.isDead && !prompt && (
        <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto z-50 animate-in fade-in zoom-in duration-200">
          <h1 className="text-6xl font-black text-white tracking-widest uppercase mb-8 drop-shadow-xl border-b-2 border-stone-800 pb-4">GAME PAUSED</h1>
          <div className="flex gap-4">
            <button 
              className="px-8 py-4 bg-white text-stone-950 font-black text-lg tracking-wider rounded-xl shadow-xl hover:bg-stone-200 cursor-pointer uppercase"
              onClick={() => {
                const el = document.querySelector("canvas");
                requestSafePointerLock(el);
              }}
            >
              Resume Game
            </button>
            <button 
              className="px-8 py-4 border-2 border-stone-700 text-stone-300 font-bold text-lg tracking-wider rounded-xl transition-all hover:border-red-500 hover:text-white cursor-pointer uppercase"
              onClick={onGoLobby}
            >
              Back to Main Menu
            </button>
          </div>
        </div>
      )}

      {stats.isDead && (
        <div className="absolute inset-0 bg-stone-950/98 bg-[radial-gradient(circle,rgba(220,38,38,0.15)_0%,rgba(0,0,0,0.8)_100%)] flex flex-col items-center justify-center text-center z-[100] pointer-events-auto">
          <div className="max-w-lg p-10 bg-stone-900 border border-red-950 rounded-3xl shadow-[0_10px_50px_rgba(185,28,28,0.2)] flex flex-col items-center gap-6">
            
            <h1 className="text-red-600 font-extrabold tracking-tighter text-6xl uppercase font-mono filter drop-shadow-[0_4px_10px_rgba(185,28,28,0.4)] animate-bounce">
              YOU WERE OVERWHELMED
            </h1>
            
            <p className="text-stone-400 text-sm leading-relaxed max-w-sm">
              The endless waves of the undead finally breached your perimeter. Your statistics will be preserved.
            </p>

            <div className="w-full h-[1px] bg-stone-800 my-2" />

            {/* Statistics recap scoreboard */}
            <div className="grid grid-cols-3 gap-6 w-full text-center">
              <div className="flex flex-col">
                <span className="text-stone-500 font-mono text-[9px] uppercase tracking-wider">Rounds Survived</span>
                <span className="text-white font-black font-mono text-3xl">{stats.round}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-stone-500 font-mono text-[9px] uppercase tracking-wider">Total Kills</span>
                <span className="text-red-500 font-black font-mono text-3xl">{stats.kills}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-stone-500 font-mono text-[9px] uppercase tracking-wider">Headshots achieved</span>
                <span className="text-amber-400 font-black font-mono text-3xl">{stats.headshots}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full mt-6">
              <button 
                className="bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold px-8 py-4 rounded-xl shadow-lg shadow-red-600/30 transition-all cursor-pointer text-base w-full select-none"
                onClick={onRestart}
              >
                DEPLOY NEW SURVIVOR MATCH
              </button>
              <button 
                className="bg-stone-800 border-2 border-stone-700 hover:border-stone-500 text-stone-300 font-bold px-8 py-3 rounded-xl shadow-lg transition-all cursor-pointer text-base w-full select-none"
                onClick={onGoLobby}
              >
                MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
