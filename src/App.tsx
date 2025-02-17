import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateQuestions, GeneratedQuestion } from './lib/gemini'
import confetti from 'canvas-confetti'
import React from 'react'
import gameMusic1 from './assets/Game Music.mp3'
import gameMusic2 from './assets/Musik Game.mp3'
import { useAudioPlayer } from './hooks/useAudioPlayer'
import { useQuizState } from './hooks/useQuizState'
import { useEndlessMode } from './hooks/useEndlessMode'
import { useConfetti } from './hooks/useConfetti'
import { useFeedback } from './hooks/useFeedback'
import { useQuizPerformance } from './hooks/useQuizPerformance'

{/* 
  BrainQuest - Interactive Quiz App
  --------------------------------
  Developer: Morino Samjaya
  Designer: Morino Samjaya
  Original Concept: Morino Samjaya
  Copyright © 2025. All rights reserved.
*/}

interface Question extends GeneratedQuestion {
  id: number;
}

interface ComboBonus {
  multiplier: number;
  message: string;
}

const COMBO_BONUSES: ComboBonus[] = [
  { multiplier: 1, message: "🎯 Normal" },
  { multiplier: 1.5, message: "🔥 Hot!" },
  { multiplier: 2, message: "🌟 Super!" },
  { multiplier: 2.5, message: "⚡ Ultra!" },
  { multiplier: 3, message: "👑 Legendary!" }
];

const CORRECT_SOUNDS = [
  "🎯 Tepat Sasaran!",
  "🌟 Brilian!",
  "💫 Luar Biasa!",
  "🎨 Jenius!",
  "🚀 Mantap!",
  "💪 Keren!",
  "🎮 Pro!",
  "🏆 Champion!",
  "🌈 Perfect!",
  "✨ Excellent!"
];

const WRONG_SOUNDS = [
  "🎯 Hampir!",
  "💫 Coba Lagi!",
  "🌟 Semangat!",
  "💪 Jangan Menyerah!",
  "🚀 Tetap Fokus!",
  "🎮 Next Level!",
  "🌈 Masih Ada Kesempatan!",
  "✨ Kamu Bisa!",
  "🎨 Terus Belajar!",
  "🏆 Tetap Semangat!"
];

const QuizOption = React.memo(({ option, index, onClick }: { 
  option: string; 
  index: number; 
  onClick: () => void; 
}) => (
  <motion.button
    key={`option-${index}`}
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.99 }}
    onClick={onClick}
    className="quiz-option group text-base sm:text-lg py-3 sm:py-4 px-4 sm:px-6"
    initial={false}
  >
    <span className="inline-block w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3 text-center leading-6 sm:leading-8 bg-primary/10 text-primary rounded-lg group-hover:bg-primary group-hover:text-white transition-colors text-sm sm:text-base">
      {String.fromCharCode(65 + index)}
    </span>
    {option}
  </motion.button>
));

const POPULAR_TOPICS = [
  { name: "Sejarah Indonesia", emoji: "🏛️" },
  { name: "Sains & Teknologi", emoji: "🔬" },
  { name: "Budaya & Seni", emoji: "🎨" },
  { name: "Olahraga", emoji: "⚽" },
  { name: "Geografi", emoji: "🌏" },
  { name: "Kuliner", emoji: "🍜" }
] as const;

const SPECIAL_MODES = [
  { id: 'normal', name: "Normal", emoji: "🎯", description: "Mode standar quiz" },
  { id: 'endless', name: "Endless", emoji: "♾️", description: "Pertanyaan tanpa batas sampai salah" }
] as const;

interface Stats {
  totalQuizzes: number;
  totalQuestions: number;
  correctAnswers: number;
  highestStreak: number;
  highestScore: number;
  lastPlayed: Date;
}

const styles = `
.stat-card {
  @apply p-3 rounded-xl bg-white/50 dark:bg-gray-700/50 flex flex-col items-center justify-center text-center transition-transform hover:scale-105;
}

.achievement-card {
  @apply p-3 rounded-xl bg-white/50 dark:bg-gray-700/50 flex items-center gap-3 transition-transform hover:scale-102;
}

/* Prevent text selection and copying */
.no-select {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -webkit-touch-callout: none; /* iOS Safari */
}

/* Allow text selection only for input fields */
input {
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}
`;

export default function App() {
  // State declarations
  const [topic, setTopic] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCredits, setShowCredits] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [questionCount, setQuestionCount] = useState(5);
  const [selectedMode, setSelectedMode] = useState<string>('normal');
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<Stats>(() => {
    const saved = localStorage.getItem('brainquest_stats');
    return saved ? JSON.parse(saved) : {
      totalQuizzes: 0,
      totalQuestions: 0,
      correctAnswers: 0,
      highestStreak: 0,
      highestScore: 0,
      lastPlayed: new Date()
    };
  });

  // Refs
  const tapTimeout = useRef<NodeJS.Timeout | null>(null);
  const resetConfirmTimer = useRef<NodeJS.Timeout | null>(null);

  // Audio setup
  const musicList = [gameMusic1, gameMusic2];
  const { isPlaying: isMusicPlaying, togglePlay: toggleMusic } = useAudioPlayer(musicList, {
    volume: 0.8,
    autoplay: false
  });

  // Custom hooks
  const {
    currentQuestion,
    score,
    showScore,
    questions,
    streak,
    comboLevel,
    baseScore,
    lastAnswerCorrect,
    setQuestions,
    handleAnswer,
    resetQuiz
  } = useQuizState();

  const { messages: feedbackMessages, showMessage: showFeedback, clearAllMessages: clearAllFeedback } = useFeedback();
  const confettiEffect = useConfetti();
  const { getMetrics, optimizeRendering, debounceRender } = useQuizPerformance();

  const endlessMode = useEndlessMode(topic);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'c') {
        setShowCredits(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleStartQuiz = async () => {
    if (!topic) {
      setError("Mohon masukkan topik quiz");
      return;
    }

    if (selectedMode !== 'endless' && (questionCount < 1 || questionCount > 20)) {
      setError("Jumlah soal harus antara 1-20");
      return;
    }

    setIsLoading(true);
    setError(null);
    // Reset state sebelum memulai quiz baru
    resetQuiz();
    clearAllFeedback();

    try {
      let generatedQuestions;
      if (selectedMode === 'endless') {
        await endlessMode.resetQuestions();
        await endlessMode.appendQuestions();
        generatedQuestions = endlessMode.questions;
      } else {
        generatedQuestions = await generateQuestions(topic, questionCount);
      }
      
      setQuestions(generatedQuestions);
    } catch (err) {
      setError("Gagal membuat pertanyaan. Silakan coba lagi.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getRandomFeedback = (isCorrect: boolean) => {
    const array = isCorrect ? CORRECT_SOUNDS : WRONG_SOUNDS;
    return array[Math.floor(Math.random() * array.length)];
  };

  const getComboBonus = (comboLevel: number): ComboBonus => {
    return COMBO_BONUSES[Math.min(comboLevel, COMBO_BONUSES.length - 1)];
  };

  const calculateScore = (isCorrect: boolean) => {
    if (!isCorrect) return 0;
    const { multiplier } = getComboBonus(comboLevel);
    return Math.floor(100 * multiplier);
  };

  const handleAnswerClick = useCallback(async (selectedAnswer: string) => {
    if (!questions[currentQuestion]) return;
    
    const isCorrect = selectedAnswer === questions[currentQuestion].correctAnswer;
    const points = calculateScore(isCorrect);
    
    await optimizeRendering();
    
    try {
      if (selectedMode === 'endless' && isCorrect && currentQuestion >= questions.length - 2) {
        await endlessMode.appendQuestions();
        if (!endlessMode.error) {
          await optimizeRendering();
          setQuestions(endlessMode.questions);
        }
      }
      
      if (!isCorrect && selectedMode === 'endless') {
        handleAnswer(isCorrect, points, true);
        return;
      }

      // Efek visual dengan optimasi
      if (isCorrect) {
        await optimizeRendering();
        confettiEffect.fire();
        if (streak >= 2) {
          confettiEffect.fireSchoolPride();
        }
      } else {
        const element = document.querySelector('.card');
        if (element) {
          await optimizeRendering();
          element.animate([
            { transform: 'translateX(-5px)' },
            { transform: 'translateX(5px)' },
            { transform: 'translateX(-5px)' },
            { transform: 'translateX(5px)' },
            { transform: 'translateX(0)' }
          ], {
            duration: 300,
            easing: 'ease-in-out'
          });
        }
      }

      handleAnswer(isCorrect, points, selectedMode === 'endless');

      if (showScore && score + (isCorrect ? 1 : 0) >= questions.length * 0.8) {
        await optimizeRendering();
        confettiEffect.fireCelebration();
      }
    } catch (error) {
      console.error('Error handling answer:', error);
      setError('Terjadi kesalahan saat memproses jawaban');
    }
  }, [currentQuestion, questions, selectedMode, streak, showScore, score]);

  const handleRestart = () => {
    resetQuiz();
    setTopic("");
    setError(null);
    clearAllFeedback();
    if (selectedMode === 'endless') {
      endlessMode.resetQuestions();
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: {
        duration: 0.2
      }
    },
    exit: { 
      opacity: 0,
      transition: { duration: 0.15 }
    }
  };

  // Optimasi render untuk particle effect
  const particles = useMemo(() => {
    const metrics = getMetrics();
    const particleCount = metrics.fps > 30 ? 20 : 10; // Kurangi jumlah partikel jika FPS rendah
    
    const items = [];
    const colors = [
      'rgba(79, 70, 229, 0.8)',
      'rgba(16, 185, 129, 0.8)',
      'rgba(245, 158, 11, 0.8)',
    ];

    for (let i = 0; i < particleCount; i++) {
      const left = `${Math.random() * 100}%`;
      const top = `${Math.random() * 100}%`;
      const duration = `${40 + Math.random() * 20}s`;
      const size = `${0.5 + Math.random() * 1.5}rem`;
      const moveX = `${-50 + Math.random() * 100}px`;
      const moveY = `${-50 + Math.random() * 100}px`;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const opacity = 0.1 + Math.random() * 0.2;
      
      items.push(
        <div
          key={`particle-${i}`}
          className="particle"
          style={{
            position: 'absolute',
            left,
            top,
            width: size,
            height: size,
            '--duration': duration,
            '--move-x': moveX,
            '--move-y': moveY,
            '--particle-color': color,
            '--particle-opacity': opacity,
          } as React.CSSProperties}
        />
      );
    }
    return items;
  }, [getMetrics]);

  const handleTitleTap = () => {
    setTapCount(prev => prev + 1);
    
    // Reset tap count after 500ms of no taps
    if (tapTimeout.current) {
      clearTimeout(tapTimeout.current);
    }
    
    tapTimeout.current = setTimeout(() => {
      setTapCount(0);
    }, 500);

    // Show credits after 3 taps
    if (tapCount === 2) { // Will become 3 after this tap
      setShowCredits(prev => !prev);
      setTapCount(0);
      if (tapTimeout.current) {
        clearTimeout(tapTimeout.current);
      }
    }
  };

  // Update stats
  useEffect(() => {
    if (showScore) {
      const newStats = {
        ...stats,
        totalQuizzes: stats.totalQuizzes + 1,
        totalQuestions: stats.totalQuestions + questions.length,
        correctAnswers: stats.correctAnswers + score,
        highestStreak: Math.max(stats.highestStreak, streak),
        highestScore: Math.max(stats.highestScore, baseScore),
        lastPlayed: new Date()
      };
      setStats(newStats);
      localStorage.setItem('brainquest_stats', JSON.stringify(newStats));
    }
  }, [showScore]);

  const handleShare = async () => {
    // Hitung statistik tambahan
    const accuracy = Math.round((score / questions.length) * 100);
    
    // Emoji dinamis berdasarkan performa
    const streakEmoji = streak >= 15 ? "🔥🔥🔥" : streak >= 10 ? "🔥🔥" : streak >= 5 ? "🔥" : "✨";
    const gradeEmoji = accuracy === 100 ? "👑" 
      : accuracy >= 90 ? "🏆" 
      : accuracy >= 80 ? "🌟" 
      : accuracy >= 70 ? "💫"
      : accuracy >= 60 ? "🎯"
      : "💪";
    const modeEmoji = selectedMode === 'endless' ? "♾️" : "🎯";
    
    // Tentukan rank berdasarkan skor
    const getRank = (accuracy: number) => {
      if (accuracy === 100) return "🎖️ S+ Rank";
      if (accuracy >= 90) return "🏅 S Rank";
      if (accuracy >= 80) return "🥇 A Rank";
      if (accuracy >= 70) return "🥈 B Rank";
      if (accuracy >= 60) return "🥉 C Rank";
      return "🎮 D Rank";
    };

    // Tentukan achievement berdasarkan performa
    const getAchievements = () => {
      const achievements = [];
      if (accuracy === 100) achievements.push("🏆 Perfect Score");
      if (streak >= 10) achievements.push("⚡ Lightning Streak");
      if (accuracy >= 90) achievements.push("🏆 Great Score");
      if (accuracy >= 80) achievements.push("🌟 Excellent Score");
      if (accuracy >= 70) achievements.push("💫 Good Score");
      if (accuracy >= 60) achievements.push("🎯 Good Score");
      return achievements;
    };

    // Dapatkan quotes random berdasarkan performa
    const getQuote = (accuracy: number) => {
      const quotes = {
        perfect: [
          "🌟 Kejeniusanmu Tak Tertandingi!",
          "✨ Kamu Memang Luar Biasa!",
          "🎯 Akurasi Sempurna!"
        ],
        great: [
          "💫 Hampir Sempurna!",
          "🌟 Prestasi Membanggakan!",
          "✨ Terus Pertahankan!"
        ],
        good: [
          "💪 Potensimu Sangat Besar!",
          "🎯 Terus Tingkatkan!",
          "✨ Kamu Bisa Lebih Baik!"
        ],
        motivational: [
          "🌱 Setiap Usaha Membawa Hasil!",
          "💫 Terus Semangat!",
          "✨ Percaya Pada Prosesmu!"
        ]
      };
      
      const category = accuracy === 100 ? quotes.perfect 
        : accuracy >= 80 ? quotes.great 
        : accuracy >= 60 ? quotes.good 
        : quotes.motivational;
      
      return category[Math.floor(Math.random() * category.length)];
    };

    const achievements = getAchievements();
    const rank = getRank(accuracy);
    const quote = getQuote(accuracy);

    // Format statistik dalam bentuk yang lebih menarik dengan border
    const statsDisplay = [
      `${gradeEmoji} Performa Quiz ${gradeEmoji}`,
      `┏━━━━━━━━━━━━━━━━━━━━┓`,
      `┃ 📊 Skor: ${score}/${questions.length} (${accuracy}%) ┃`,
      `┃ ${streakEmoji} Streak: ${streak}x         ┃`,
      `┃ 🎯 Total Skor: ${baseScore}     ┃`,
      `┗━━━━━━━━━━━━━━━━━━━━┛`,
      `\n${modeEmoji} Mode: ${selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1)}`,
      `📚 Topik: "${topic}"`,
      `\n${rank}`,
      achievements.length > 0 ? `\n🎊 Achievements Unlocked 🎊\n${achievements.join('\n')}` : '',
      `\n "${quote}"`
    ].filter(Boolean).join('\n');

    // Format teks untuk social media dengan hashtag
    const shareText = `
╔════ BrainQuest Result ════╗

${statsDisplay}

╚═══════════════════════════╝

🎮 Tantang dirimu di BrainQuest!
brainquest.vercel.app

#BrainQuest #Quiz #Education
#Learning #Knowledge #${topic.replace(/\s+/g, '')}
`.trim();

    try {
      await navigator.clipboard.writeText(shareText);
      
      showFeedback({
        text: "📋 Hasil telah disalin! Paste (Ctrl+V) ke social media favoritmu!",
          isCorrect: true
        });

      setTimeout(() => {
        showFeedback({
          text: "💡 Tips: Gunakan notepad dulu untuk hasil terbaik!",
          isCorrect: true
        }, 3000);
      }, 2500);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      showFeedback({
        text: "❌ Gagal menyalin hasil",
        isCorrect: false
      });
    }
  };

  const handleResetStats = () => {
    showFeedback({
      text: "❓ Klik sekali lagi untuk konfirmasi reset statistik",
      isCorrect: true
    }, 3000);

    if (resetConfirmTimer.current) {
      clearTimeout(resetConfirmTimer.current);
      resetConfirmTimer.current = null;

      const defaultStats = {
        totalQuizzes: 0,
        totalQuestions: 0,
        correctAnswers: 0,
        highestStreak: 0,
        highestScore: 0,
        lastPlayed: new Date()
      };
      
      setStats(defaultStats);
      localStorage.setItem('brainquest_stats', JSON.stringify(defaultStats));
      
      showFeedback({
        text: "✨ Statistik berhasil direset!",
        isCorrect: true
      });
    } else {
      resetConfirmTimer.current = setTimeout(() => {
        resetConfirmTimer.current = null;
      }, 3000);
    }
  };

  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Optimasi untuk fungsi yang sering dipanggil
  const debouncedHandleShare = useMemo(() => 
    debounceRender(handleShare, 300)
  , [handleShare, debounceRender]);

  const debouncedHandleResetStats = useMemo(() => 
    debounceRender(handleResetStats, 300)
  , [handleResetStats, debounceRender]);

  return (
    <div className="min-h-screen bg-[url('/quiz-bg.svg')] bg-cover bg-center bg-no-repeat flex items-center justify-center p-2 sm:p-6 md:p-8 relative overflow-hidden no-select">
      <div className="particles">{particles}</div>
      <div className="animated-bg" />

      {/* Tombol Toggle Musik */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={toggleMusic}
        className="fixed bottom-2 left-2 sm:bottom-4 sm:left-4 p-2 sm:p-3 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg hover:shadow-xl transition-all duration-200 z-50"
      >
        {isMusicPlaying ? (
          <span className="text-xl sm:text-2xl" role="img" aria-label="Mute Music">
            🔊
          </span>
        ) : (
          <span className="text-xl sm:text-2xl" role="img" aria-label="Unmute Music">
            🔇
          </span>
        )}
      </motion.button>

      {showCredits && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-4 right-4 p-6 card glass-card text-sm space-y-4 max-w-xs z-50 backdrop-blur-md bg-white/80 dark:bg-gray-800/80 shadow-xl border border-white/20 dark:border-gray-700/20"
        >
          <div className="relative">
            <h3 className="font-black text-2xl gradient-text mb-4">Credits</h3>
            <div className="absolute -top-6 -right-4 text-6xl opacity-10 rotate-12">👨‍💻</div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <span className="text-primary">👨‍💻</span>
              <div>
                <p className="font-medium">Developer</p>
                <p className="text-gray-600 dark:text-gray-400">Morino Samjaya</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-primary">🎨</span>
              <div>
                <p className="font-medium">Designer</p>
                <p className="text-gray-600 dark:text-gray-400">Morino Samjaya</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-primary">💡</span>
              <div>
                <p className="font-medium">Original Concept</p>
                <p className="text-gray-600 dark:text-gray-400">Morino Samjaya</p>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <span className="text-primary">⌨️</span> Press Ctrl + Alt + C to toggle
            </p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <span className="text-primary">📱</span> Triple tap on title to toggle
            </p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <span className="text-primary">©️</span> 2025. All rights reserved.
            </p>
          </div>
        </motion.div>
      )}
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed top-4 left-4 p-6 card glass-card text-sm space-y-4 max-w-xs z-50 backdrop-blur-md bg-white/80 dark:bg-gray-800/80 shadow-xl border border-white/20 dark:border-gray-700/20"
          >
            <div className="flex justify-between items-start">
              <div className="relative">
                <h3 className="font-black text-2xl gradient-text">Statistik</h3>
                <p className="text-xs text-gray-500 mt-1">Performa Keseluruhanmu</p>
                <div className="absolute -top-6 -left-4 text-6xl opacity-10 -rotate-12">📊</div>
              </div>
              <button 
                onClick={() => setShowStats(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="stat-card">
                <span className="text-2xl">📊</span>
                <p className="font-medium">{stats.totalQuizzes}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Total Quiz</p>
              </div>
              <div className="stat-card">
                <span className="text-2xl">❓</span>
                <p className="font-medium">{stats.totalQuestions}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Total Soal</p>
              </div>
              <div className="stat-card">
                <span className="text-2xl">✅</span>
                <p className="font-medium">{stats.correctAnswers}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Jawaban Benar</p>
              </div>
              <div className="stat-card">
                <span className="text-2xl">🎯</span>
                <p className="font-medium">
                  {stats.totalQuestions > 0 ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100) : 0}%
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Akurasi</p>
              </div>
            </div>
            <div className="space-y-3 pt-2">
              <div className="achievement-card">
                <span className="text-xl">⚡</span>
                <div>
                  <p className="font-medium">{stats.highestStreak}x</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Streak Tertinggi</p>
                </div>
              </div>
              <div className="achievement-card">
                <span className="text-xl">🏆</span>
                <div>
                  <p className="font-medium">{stats.highestScore}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Skor Tertinggi</p>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                <span>🕒</span> Terakhir Main: {new Date(stats.lastPlayed).toLocaleDateString()}
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={debouncedHandleResetStats}
                className="w-full px-4 py-2 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <span>🗑️</span>
                Reset Statistik
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="card glass-card w-full max-w-2xl p-3 sm:p-6 md:p-8 mx-2 sm:mx-6 relative"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/10 dark:from-gray-800/40 dark:to-gray-800/10 pointer-events-none" />
        <AnimatePresence mode="wait">
          {questions.length === 0 ? (
            <motion.div
              key="start"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="space-y-4 sm:space-y-6 relative"
            >
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-center mb-4 sm:mb-6 md:mb-8 space-y-2">
                <motion.span
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="block text-xl sm:text-2xl md:text-3xl text-gray-600 dark:text-gray-400 floating"
                >
                  ✨ Powered by AI ✨
                </motion.span>
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    delay: 0.2
                  }}
                  className="gradient-text flex justify-center items-center gap-2 sm:gap-3 floating"
                  onClick={handleTitleTap}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="text-3xl sm:text-4xl md:text-5xl">BrainQuest</span>
                </motion.div>
                <motion.span
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="block text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-400 mt-2 sm:mt-4 floating"
                >
                  Jelajahi Pengetahuan Tanpa Batas
                </motion.span>
              </h1>
              <div className="space-y-4 relative">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mode Quiz
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {SPECIAL_MODES.map(mode => (
                      <button
                        key={mode.id}
                        onClick={() => setSelectedMode(mode.id)}
                        className={`p-2 sm:p-3 rounded-xl transition-all duration-200 ${
                          selectedMode === mode.id
                            ? 'bg-primary text-white'
                            : 'bg-white/50 dark:bg-gray-800/50 hover:bg-primary/10'
                        }`}
                      >
                        <div className="text-base sm:text-lg mb-1">{mode.emoji}</div>
                        <div className="font-medium text-xs sm:text-sm">{mode.name}</div>
                        <div className="text-xs opacity-75 hidden sm:block">{mode.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
                {selectedMode !== 'endless' && (
                    <div>
                      <label htmlFor="questionCount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Jumlah Soal
                      </label>
                      <div className="mt-1 relative">
                        <input
                          type="number"
                          id="questionCount"
                          min="1"
                          max="20"
                          value={questionCount}
                          onChange={(e) => setQuestionCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="input-primary text-base w-full"
                          placeholder="1-20 soal"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-500">
                          soal
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Topik Populer
                  </label>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
                    {POPULAR_TOPICS.map(topic => (
                      <button
                        key={topic.name}
                        onClick={() => setTopic(topic.name)}
                        className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-white/50 dark:bg-gray-800/50 hover:bg-primary/10 transition-colors text-xs sm:text-sm"
                      >
                        <span className="mr-1">{topic.emoji}</span>
                        <span>{topic.name}</span>
                      </button>
                    ))}
                  </div>
                  <label htmlFor="topic" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Topik Quiz
                  </label>
                  <input
                    type="text"
                    id="topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Contoh: Sejarah Indonesia"
                    className="input-primary text-base sm:text-lg"
                    onKeyDown={(e) => e.key === 'Enter' && handleStartQuiz()}
                  />
                </div>
              </div>
              {error && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-500 text-sm sm:text-base"
                >
                  {error}
                </motion.p>
              )}
              <div className="flex justify-center">
                <button
                  onClick={() => setShowStats(prev => !prev)}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors"
                >
                  📊 Lihat Statistik
                </button>
              </div>
              <button
                onClick={handleStartQuiz}
                disabled={isLoading}
                className="btn-primary w-full group text-base sm:text-lg"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Membuat Quiz...
                  </span>
                ) : (
                  <span className="flex items-center justify-center group-hover:scale-105 transition-transform">
                    <span className="mr-2">🚀</span>
                    Mulai Quiz
                  </span>
                )}
              </button>
            </motion.div>
          ) : showScore ? (
            <motion.div
              key="score"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="text-center space-y-4 sm:space-y-6"
            >
              <h2 className="text-3xl sm:text-4xl font-black mb-2 sm:mb-4 floating">
                Skor Anda: <span className="gradient-text">{score}/{questions.length}</span>
              </h2>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-4 text-base sm:text-lg text-gray-600 dark:text-gray-400">
                <span className="floating">🎯 Akurasi: {Math.round((score / questions.length) * 100)}%</span>
              </div>
              <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 floating">
                {score === questions.length 
                  ? "Sempurna! 🎉 Kamu Jenius!" 
                  : score > questions.length * 0.8
                    ? "Luar Biasa! 🌟 Hampir Sempurna!"
                    : score > questions.length * 0.6
                      ? "Bagus Sekali! 👏 Terus Berlatih!"
                      : "Ayo Coba Lagi! 💪 Kamu Pasti Bisa!"}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center">
                <button
                  onClick={debouncedHandleShare}
                  className="btn-primary group text-base sm:text-lg bg-gradient-to-r from-blue-500 via-blue-400 to-blue-300"
                >
                  <span className="flex items-center justify-center group-hover:scale-105 transition-transform">
                    <span className="mr-2">📤</span>
                    Bagikan Hasil
                  </span>
                </button>
                <button
                  onClick={handleRestart}
                  className="btn-primary group text-base sm:text-lg"
                >
                  <span className="flex items-center justify-center group-hover:scale-105 transition-transform">
                    <span className="mr-2">🔄</span>
                    Quiz Baru
                  </span>
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="quiz"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative"
            >
              <div className="mb-6 sm:mb-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 mb-4 sm:mb-6">
                  <div className="space-y-1 w-full sm:w-auto">
                    <h2 className="text-lg sm:text-xl font-bold floating">
                      Pertanyaan {currentQuestion + 1}/{questions.length}
                    </h2>
                  </div>
                  <div className="space-y-1 w-full sm:w-auto text-left sm:text-right">
                    <div className="flex flex-col sm:items-end gap-1">
                      <span className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 bg-primary/10 text-primary rounded-lg font-medium text-sm sm:text-base floating">
                        Skor: {baseScore}
                      </span>
                      {streak > 0 && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-sm sm:text-base text-orange-500 dark:text-orange-400 floating"
                        >
                          🔥 Combo: {getComboBonus(comboLevel).message}
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-bold leading-relaxed">
                  {questions[currentQuestion].question}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                {questions[currentQuestion].options.map((option, index) => (
                  <QuizOption
                    key={`quiz-option-${currentQuestion}-${index}`}
                    option={option}
                    index={index}
                    onClick={() => handleAnswerClick(option)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Enhanced feedback overlay */}
        <AnimatePresence>
          {feedbackMessages.map((feedback, index) => (
            <motion.div
              key={feedback.id}
              initial={{ opacity: 0, scale: 0.5, y: 20 * index }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className={`absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-2xl z-${10 + index} ${
                feedback.isCorrect ? 'text-green-400' : 'text-orange-400'
              }`}
            >
              <motion.span
                initial={{ scale: 0.5 }}
                animate={{ scale: [0.5, 1.2, 1] }}
                transition={{ duration: 0.5 }}
                className="text-2xl sm:text-4xl md:text-6xl font-bold text-center px-4 floating"
              >
                {feedback.text}
              </motion.span>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
