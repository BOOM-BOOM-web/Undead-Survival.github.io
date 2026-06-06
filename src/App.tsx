/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { GameEngine } from "./game/Engine";
import { GameHUD } from "./components/GameHUD";
import { InstructionScreen } from "./components/InstructionScreen";
import { PlayerStats, HitMarker } from "./types";
import { sfx } from "./sound";

export default function App() {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedMap, setSelectedMap] = useState<string>("town");
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Synchronized Engine States
  const [stats, setStats] = useState<PlayerStats>({
    points: 500,
    health: 100,
    maxHealth: 100,
    round: 1,
    kills: 0,
    headshots: 0,
    perks: [],
    weapons: [],
    currentWeaponIndex: 0,
    isPowerOn: false,
    isDead: false,
    isADS: false
  });

  const [staminaPercent, setStaminaPercent] = useState<number>(100);
  const [powerupTimers, setPowerupTimers] = useState<{ insta_kill: number; double_points: number }>({
    insta_kill: 0,
    double_points: 0
  });
  const [hitmarkers, setHitmarkers] = useState<HitMarker[]>([]);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [interactionPrompt, setInteractionPrompt] = useState<{ text: string; subtext: string; cost: number } | null>(null);
  const [radarData, setRadarData] = useState<{ player: { x: number, z: number, yaw: number }, zombies: { id: string, x: number, z: number }[] }>({
    player: { x: 0, z: 0, yaw: 0 },
    zombies: []
  });

  // Initialize and Mount 3D Game Engine
  useEffect(() => {
    if (!isPlaying || !canvasContainerRef.current) return;

    // Warm sound system
    sfx.init();

    // Instantiate game engine
    const engine = new GameEngine(
      canvasContainerRef.current,
      selectedMap,
      (updatedStats) => {
        setStats(updatedStats);
      },
      (newPrompt) => {
        setPrompt(newPrompt);
      }
    );

    engineRef.current = engine;

    // High fidelity pooling routine to reconcile local HUD parameters every frame
    let active = true;
    const poolHUDParams = () => {
      if (!active || !engineRef.current) return;
      
      setStaminaPercent(engine.getStaminaPercent());
      setPowerupTimers(engine.getPowerupTimers());
      setHitmarkers([...engine.getHitmarkers()]);
      setInteractionPrompt(engine.getInteractionPrompt());
      setRadarData(engine.getRadarData());

      requestAnimationFrame(poolHUDParams);
    };
    poolHUDParams();

    // Handle viewport resize mapping
    const handleResize = () => {
      if (!canvasContainerRef.current) return;
      const canvas = canvasContainerRef.current.querySelector("canvas");
      if (canvas && engineRef.current) {
        // Redraw canvas boundaries dynamically
        const w = canvasContainerRef.current.clientWidth;
        const h = canvasContainerRef.current.clientHeight;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
    };
    window.addEventListener("resize", handleResize);

    // Cleanup hook on unmount
    return () => {
      active = false;
      window.removeEventListener("resize", handleResize);
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, [isPlaying, selectedMap]);

  const handleRestart = () => {
    // Teardown current engine
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
    // Re-trigger plays state instantiation
    setIsPlaying(false);
    setTimeout(() => {
      setIsPlaying(true);
    }, 100);
  };

  const handleGoLobby = () => {
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
    setIsPlaying(false);
  };

  return (
    <div className="w-full h-screen bg-stone-950 text-white relative select-none">
      {!isPlaying ? (
        <InstructionScreen 
          onStart={() => setIsPlaying(true)} 
          selectedMap={selectedMap}
          setSelectedMap={setSelectedMap}
        />
      ) : (
        <div className="w-full h-full relative overflow-hidden">
          {/* Main 3D WebGL Canvas Injection Port */}
          <div 
            ref={canvasContainerRef} 
            className="w-full h-full absolute inset-0 cursor-crosshair"
            id="three-canvas-container"
          />

          {/* Core HUD HUD elements layered directly on top of WebGL scene */}
          <GameHUD
            stats={stats}
            staminaPercent={staminaPercent}
            powerupTimers={powerupTimers}
            hitmarkers={hitmarkers}
            prompt={prompt}
            interactionPrompt={interactionPrompt}
            radarData={radarData}
            onRestart={handleRestart}
            onGoLobby={handleGoLobby}
          />
        </div>
      )}
    </div>
  );
}
