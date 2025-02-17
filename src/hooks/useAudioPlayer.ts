import { useEffect, useRef, useState, useCallback } from 'react';

interface AudioPlayerOptions {
  volume?: number;
  autoplay?: boolean;
}

export function useAudioPlayer(playlist: string[], options: AudioPlayerOptions = {}) {
  const [isPlaying, setIsPlaying] = useState(() => {
    const saved = localStorage.getItem('brainquest_audio_playing');
    return saved ? JSON.parse(saved) : true;
  });
  const [currentTrack, setCurrentTrack] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasInteractedRef = useRef(false);

  // Save audio state to localStorage
  useEffect(() => {
    localStorage.setItem('brainquest_audio_playing', JSON.stringify(isPlaying));
  }, [isPlaying]);

  // Initialize audio once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = options.volume ?? 0.5;
    audio.loop = false; // Disable loop for individual tracks

    if (playlist.length > 0) {
      audio.src = playlist[currentTrack];
      audioRef.current = audio;

      // Handle track ending
      audio.addEventListener('ended', () => {
        const nextTrack = (currentTrack + 1) % playlist.length;
        setCurrentTrack(nextTrack);
        audio.src = playlist[nextTrack];
        if (isPlaying) {
          audio.play().catch(console.error);
        }
      });

      // Try to autoplay
      if (isPlaying) {
        const playPromise = audio.play();
        if (playPromise) {
          playPromise.catch(() => {
            console.log('Autoplay prevented, waiting for user interaction');
          });
        }
      }
    }

    // Add interaction listener
    const handleInteraction = () => {
      if (!hasInteractedRef.current) {
        hasInteractedRef.current = true;
        if (isPlaying && audio.paused) {
          audio.play().catch(console.error);
        }
        // Remove listeners after first interaction
        window.removeEventListener('click', handleInteraction);
        window.removeEventListener('touchstart', handleInteraction);
        window.removeEventListener('keydown', handleInteraction);
      }
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);
    window.addEventListener('keydown', handleInteraction);

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, []); // Only run once on mount

  // Handle track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playlist.length) return;

    const currentSrc = audio.src.split('/').pop(); // Get current filename
    const newSrc = playlist[currentTrack].split('/').pop(); // Get new filename

    // Only change track if it's actually different
    if (currentSrc !== newSrc) {
      const wasPlaying = !audio.paused;
      audio.src = playlist[currentTrack];
      if (wasPlaying && isPlaying) {
        audio.play().catch(console.error);
      }
    }
  }, [currentTrack, playlist]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !playlist.length) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        hasInteractedRef.current = true;
        await audio.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  }, [isPlaying, playlist.length]);

  const setVolume = useCallback((value: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, value));
    }
  }, []);

  return {
    isPlaying,
    currentTrack,
    togglePlay,
    setVolume
  };
} 