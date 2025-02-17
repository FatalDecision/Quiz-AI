import { useState, useCallback } from 'react';
import { GeneratedQuestion } from '../lib/gemini';

interface QuizState {
  currentQuestion: number;
  score: number;
  showScore: boolean;
  questions: (GeneratedQuestion & { id: number })[];
  streak: number;
  comboLevel: number;
  baseScore: number;
  feedback: { text: string; isCorrect: boolean } | null;
  lastAnswerCorrect: boolean | null;
}

interface UseQuizStateReturn extends QuizState {
  setQuestions: (questions: GeneratedQuestion[]) => void;
  handleAnswer: (isCorrect: boolean, points: number, isEndlessMode?: boolean) => void;
  resetQuiz: () => void;
  setFeedback: (feedback: { text: string; isCorrect: boolean } | null) => void;
}

export function useQuizState(): UseQuizStateReturn {
  const [state, setState] = useState<QuizState>({
    currentQuestion: 0,
    score: 0,
    showScore: false,
    questions: [],
    streak: 0,
    comboLevel: 0,
    baseScore: 0,
    feedback: null,
    lastAnswerCorrect: null
  });

  const setQuestions = useCallback((questions: GeneratedQuestion[]) => {
    setState(prev => ({
      ...prev,
      questions: questions.map((q, index) => ({ ...q, id: index + 1 })),
      currentQuestion: 0,
      score: 0,
      showScore: false,
      streak: 0,
      comboLevel: 0,
      baseScore: 0
    }));
  }, []);

  const handleAnswer = useCallback((isCorrect: boolean, points: number, isEndlessMode?: boolean) => {
    setState(prev => ({
      ...prev,
      score: isCorrect ? prev.score + 1 : prev.score,
      streak: isCorrect ? prev.streak + 1 : 0,
      comboLevel: isCorrect ? Math.min(prev.comboLevel + 1, 4) : 0,
      baseScore: prev.baseScore + points,
      lastAnswerCorrect: isCorrect,
      currentQuestion: prev.currentQuestion + 1,
      showScore: isEndlessMode ? !isCorrect : prev.currentQuestion + 1 >= prev.questions.length
    }));
  }, []);

  const resetQuiz = useCallback(() => {
    setState({
      currentQuestion: 0,
      score: 0,
      showScore: false,
      questions: [],
      streak: 0,
      comboLevel: 0,
      baseScore: 0,
      feedback: null,
      lastAnswerCorrect: null
    });
  }, []);

  const setFeedbackState = useCallback((feedback: { text: string; isCorrect: boolean } | null) => {
    setState(prev => ({
      ...prev,
      feedback
    }));
  }, []);

  return {
    ...state,
    setQuestions,
    handleAnswer,
    resetQuiz,
    setFeedback: setFeedbackState
  };
} 