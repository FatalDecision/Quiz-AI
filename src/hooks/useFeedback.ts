import { useState, useCallback, useRef, useEffect } from 'react';

interface FeedbackMessage {
  text: string;
  isCorrect: boolean;
  id: number;
}

export function useFeedback() {
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [currentId, setCurrentId] = useState(0);
  const timeoutsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const showMessage = useCallback((message: Omit<FeedbackMessage, 'id'>, duration: number = 2000) => {
    const newId = currentId + 1;
    setCurrentId(newId);
    
    const newMessage = { ...message, id: newId };
    setMessages(prev => [...prev, newMessage]);
    
    const timeout = setTimeout(() => {
      setMessages(prev => prev.filter(msg => msg.id !== newId));
      timeoutsRef.current.delete(newId);
    }, duration);
    
    timeoutsRef.current.set(newId, timeout);
    
    return newId;
  }, [currentId]);

  const clearMessage = useCallback((id: number) => {
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
    setMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  const clearAllMessages = useCallback(() => {
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current.clear();
    setMessages([]);
  }, []);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  return {
    messages,
    showMessage,
    clearMessage,
    clearAllMessages
  };
} 