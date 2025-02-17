export interface GeneratedQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000; // Menambah timeout jadi 30 detik
const RETRY_DELAY = 2000; // Menambah delay jadi 2 detik

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithTimeout(url: string, options: RequestInit, timeout: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    // Jika error karena timeout/abort, berikan pesan yang lebih jelas
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout - server tidak merespons dalam waktu yang ditentukan. Silakan coba lagi.');
    }
    throw error;
  }
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function generateQuestions(topic: string, count: number = 5): Promise<GeneratedQuestion[]> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Mencoba kembali ${attempt + 1}/${MAX_RETRIES}`);
        await wait(RETRY_DELAY * (attempt + 1)); // Progressive delay
      }

      const response = await fetchWithTimeout(`${API_URL}/generate-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic, count })
      }, TIMEOUT_MS);

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Error dari server: ${response.status}. Detail: ${errorData}`);
      }

      const data = await response.json();
      
      // Validate response data
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format: expected array');
      }
      
      if (data.length === 0) {
        throw new Error('No questions generated');
      }
      
      // Validate each question
      data.forEach((q, idx) => {
        if (!q.question || !Array.isArray(q.options) || !q.correctAnswer) {
          throw new Error(`Invalid question format at index ${idx}`);
        }
        if (!q.options.includes(q.correctAnswer)) {
          throw new Error(`Correct answer not found in options at index ${idx}`);
        }
      });

      // Acak urutan pertanyaan dan opsi jawaban
      return data.map(q => ({
        ...q,
        options: shuffleArray(q.options)
      }));
    } catch (error) {
      console.warn(`Attempt ${attempt + 1} failed:`, error);
      lastError = error as Error;
      
      // If it's a 429 (rate limit) error, wait longer
      if (error instanceof Error && error.message.includes('429')) {
        await wait(RETRY_DELAY * 3); // Wait 3x longer for rate limits
        continue;
      }
      
      // If it's a 500 error, try again
      if (error instanceof Error && error.message.includes('500')) {
        continue;
      }
      
      // For other errors, throw immediately
      if (error instanceof Error && !error.message.includes('500')) {
        throw error;
      }
    }
  }

  // If we've exhausted all retries
  throw new Error(`Failed after ${MAX_RETRIES} attempts. Last error: ${lastError?.message}`);
} 