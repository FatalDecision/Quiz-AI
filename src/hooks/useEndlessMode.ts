import { useState, useCallback } from 'react';
import { GeneratedQuestion, generateQuestions } from '../lib/gemini';

interface UseEndlessModeReturn {
  questions: (GeneratedQuestion & { id: number })[];
  isLoading: boolean;
  error: string | null;
  appendQuestions: () => Promise<void>;
  resetQuestions: () => void;
}

export function useEndlessMode(topic: string, batchSize: number = 10): UseEndlessModeReturn {
  const [questions, setQuestions] = useState<(GeneratedQuestion & { id: number })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedQuestions] = useState(new Set<string>());

  const appendQuestions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const newQuestions = await generateQuestions(topic, batchSize);
      
      // Filter pertanyaan yang belum pernah muncul
      const uniqueQuestions = newQuestions.filter(q => {
        const questionKey = q.question.toLowerCase().trim();
        if (usedQuestions.has(questionKey)) return false;
        usedQuestions.add(questionKey);
        return true;
      });

      setQuestions(prev => {
        // Gabungkan pertanyaan lama dengan baru, lalu acak sebagian
        const allQuestions = [...prev];
        const startIdx = Math.max(0, allQuestions.length - 10); // Ambil 10 pertanyaan terakhir
        const questionsToShuffle = allQuestions.slice(startIdx);
        const newShuffledQuestions = [...questionsToShuffle, ...uniqueQuestions]
          .sort(() => Math.random() - 0.5)
          .map((q, idx) => ({ ...q, id: startIdx + idx + 1 }));
        
        return [
          ...allQuestions.slice(0, startIdx),
          ...newShuffledQuestions
        ];
      });
    } catch (err) {
      setError('Gagal mengambil pertanyaan baru');
      console.error('Failed to generate more questions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [topic, batchSize, usedQuestions]);

  const resetQuestions = useCallback(() => {
    setQuestions([]);
    setError(null);
    usedQuestions.clear();
  }, [usedQuestions]);

  return {
    questions,
    isLoading,
    error,
    appendQuestions,
    resetQuestions
  };
} 