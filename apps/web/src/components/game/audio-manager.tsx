"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

type AudioManagerConfig = {
  enabled: boolean;
  volume: number;
  sounds: Record<string, HTMLAudioElement | null>;
};

type AudioContextType = {
  playSound: (soundName: string) => void;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  enabled: boolean;
  volume: number;
  isSupported: boolean;
};

const AudioContext = createContext<AudioContextType | null>(null);

// Sound definitions - using data URIs for simple beep sounds
const SOUND_DEFINITIONS = {
  tick: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFA==",
  select:
    "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFA==",
  correct:
    "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFA==",
  incorrect:
    "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFA==",
  celebration:
    "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiR1/LNeSsFJHfH8N2QQAoUXrTp66hVFA==",
};

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AudioManagerConfig>({
    enabled: true,
    volume: 0.5,
    sounds: {},
  });
  const [isSupported, setIsSupported] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Check for audio support and initialize sounds
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkAudioSupport = () => {
      try {
        const audio = new Audio();
        setIsSupported(!!audio.canPlayType);
        return true;
      } catch {
        setIsSupported(false);
        return false;
      }
    };

    if (checkAudioSupport()) {
      // Initialize sounds
      const sounds: Record<string, HTMLAudioElement | null> = {};

      Object.entries(SOUND_DEFINITIONS).forEach(([name, dataUri]) => {
        try {
          const audio = new Audio(dataUri);
          audio.preload = "auto";
          audio.volume = config.volume;
          sounds[name] = audio;
        } catch (error) {
          console.warn(`Failed to load sound: ${name}`, error);
          sounds[name] = null;
        }
      });

      setConfig((prev) => ({ ...prev, sounds }));
    }
  }, []); // Remove config.volume dependency to prevent infinite loop

  // Update volume for all loaded sounds when volume changes
  useEffect(() => {
    Object.values(config.sounds).forEach((sound) => {
      if (sound) {
        sound.volume = config.volume;
      }
    });
  }, [config.volume, config.sounds]);

  // Wait for user interaction before allowing sounds
  useEffect(() => {
    const handleInteraction = () => {
      setHasUserInteracted(true);
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
    };

    document.addEventListener("click", handleInteraction);
    document.addEventListener("keydown", handleInteraction);
    document.addEventListener("touchstart", handleInteraction);

    return () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
    };
  }, []);

  const playSound = useCallback(
    (soundName: string) => {
      if (!config.enabled || !isSupported || !hasUserInteracted) return;

      const sound = config.sounds[soundName];
      if (!sound) return;

      try {
        sound.currentTime = 0;
        sound.volume = config.volume;
        const playPromise = sound.play();

        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.warn(`Failed to play sound: ${soundName}`, error);
          });
        }
      } catch (error) {
        console.warn(`Failed to play sound: ${soundName}`, error);
      }
    },
    [
      config.enabled,
      config.volume,
      config.sounds,
      isSupported,
      hasUserInteracted,
    ]
  );

  const setEnabled = useCallback((enabled: boolean) => {
    setConfig((prev) => ({ ...prev, enabled }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    setConfig((prev) => ({ ...prev, volume: clampedVolume }));
    // Volume update for sounds is now handled by useEffect
  }, []);

  const contextValue: AudioContextType = {
    playSound,
    setEnabled,
    setVolume,
    enabled: config.enabled,
    volume: config.volume,
    isSupported,
  };

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
}

// Convenience hook for common game sounds
export function useGameSounds() {
  const { playSound } = useAudio();

  return {
    playTick: () => playSound("tick"),
    playSelect: () => playSound("select"),
    playCorrect: () => playSound("correct"),
    playIncorrect: () => playSound("incorrect"),
    playCelebration: () => playSound("celebration"),
  };
}
