require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

// Simple in-memory cache
const cache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_SIZE = 100;

// Rate limiting
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30; // 30 requests per minute

app.use(cors());
app.use(express.json());

function cleanJsonResponse(text) {
  // Remove markdown code blocks and any other non-JSON text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  return jsonMatch[0].replace(/[\u201C\u201D]/g, '"'); // Replace curly quotes with straight quotes
}

function getCacheKey(topic, count) {
  return `${topic.toLowerCase()}_${count}`;
}

function cleanCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      cache.delete(key);
    }
  }
  
  // If still too large, remove oldest entries
  if (cache.size > MAX_CACHE_SIZE) {
    const sortedEntries = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    const entriesToRemove = sortedEntries.slice(0, sortedEntries.length - MAX_CACHE_SIZE);
    entriesToRemove.forEach(([key]) => cache.delete(key));
  }
}

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimit.get(ip) || { count: 0, timestamp: now };
  
  if (now - userRequests.timestamp > RATE_LIMIT_WINDOW) {
    userRequests.count = 1;
    userRequests.timestamp = now;
  } else {
    userRequests.count++;
  }
  
  rateLimit.set(ip, userRequests);
  return userRequests.count <= MAX_REQUESTS;
}

// Clean cache periodically
setInterval(cleanCache, 5 * 60 * 1000); // Every 5 minutes

// Endpoint untuk generate questions
app.post('/api/generate-questions', async (req, res) => {
  try {
    const { topic, count = 5 } = req.body;
    const ip = req.ip;
    
    console.log(`[${new Date().toISOString()}] Menerima request untuk topik: ${topic}, jumlah: ${count}`);
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    // Check rate limit
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: RATE_LIMIT_WINDOW / 1000
      });
    }

    // Check cache
    const cacheKey = getCacheKey(topic, count);
    const cachedResult = cache.get(cacheKey);
    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_DURATION) {
      console.log(`[${new Date().toISOString()}] Menggunakan cache untuk: ${cacheKey}`);
      return res.json(cachedResult.data);
    }

    const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=" + process.env.GEMINI_API_KEY;
    
    console.log(`[${new Date().toISOString()}] Mengirim request ke Gemini API...`);
    console.log('API Key yang digunakan:', process.env.GEMINI_API_KEY ? 'Terkonfigurasi' : 'Tidak ada');
    
    const startTime = Date.now();
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Buatkan ${count} pertanyaan quiz yang sangat menarik, menantang, dan edukatif tentang ${topic}. 

PENTING: 
1. Berikan respons dalam format array JSON yang valid
2. Jangan tambahkan teks atau komentar apapun di luar array JSON
3. Setiap pertanyaan dan jawaban HARUS 100% akurat dan terverifikasi
4. Untuk game/film/media, HARUS menggunakan informasi resmi dan terbaru

Format yang diharapkan:
[
  {
    "question": "pertanyaan yang spesifik dengan fakta yang terverifikasi",
    "options": [
      "jawaban yang 100% akurat berdasarkan sumber resmi",
      "pengecoh yang masuk akal tapi salah",
      "pengecoh yang relevan tapi kurang tepat",
      "pengecoh yang mirip tapi memiliki kesalahan"
    ],
    "correctAnswer": "jawaban yang 100% akurat berdasarkan sumber resmi"
  }
]

Panduan Konten untuk Game/Media:
1. HANYA gunakan fakta resmi dari developer/publisher
2. Pastikan informasi sesuai dengan versi terbaru
3. Untuk skill/kemampuan hero, HARUS sesuai dengan in-game description
4. Untuk item/equipment, HARUS sesuai dengan stats in-game
5. Untuk lore/cerita, HARUS dari sumber canon resmi

Panduan Umum:
1. Setiap pertanyaan harus spesifik dan dapat diverifikasi
2. Hindari informasi yang ambigu atau bisa berubah
3. Jika ragu tentang suatu fakta, JANGAN digunakan
4. Lebih baik pertanyaan sederhana tapi akurat, daripada kompleks tapi tidak pasti
5. Selalu cek ulang apakah jawaban benar sesuai dengan sumber resmi`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      })
    });

    const endTime = Date.now();
    console.log(`[${new Date().toISOString()}] Gemini API merespons dalam ${endTime - startTime}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${new Date().toISOString()}] Error Gemini API:`, response.status, '-', errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0].text) {
      throw new Error('Invalid response format from Gemini API');
    }

    const text = data.candidates[0].content.parts[0].text;
    console.log('Raw response:', text); // Untuk debug
    
    let questions;
    try {
      // Coba parse langsung
      questions = JSON.parse(text);
      
      // Validasi struktur
      if (!Array.isArray(questions)) {
        throw new Error('Response bukan array');
      }

      // Validasi setiap pertanyaan
      questions.forEach((q, idx) => {
        if (!q.question || !Array.isArray(q.options) || !q.correctAnswer) {
          throw new Error(`Invalid question format at index ${idx}`);
        }
        if (!q.options.includes(q.correctAnswer)) {
          throw new Error(`Correct answer not found in options at index ${idx}`);
        }
      });

      console.log(`[${new Date().toISOString()}] Berhasil parse ${questions.length} pertanyaan`);
    } catch (error) {
      console.error('Parse error:', error);
      console.error('Response text:', text);
      
      // Coba clean dan parse ulang
      const cleanedText = text.replace(/^[\s\S]*?\[/, '[').replace(/\][\s\S]*$/, ']');
      try {
        questions = JSON.parse(cleanedText);
        if (!Array.isArray(questions)) {
          throw new Error('Cleaned response still not an array');
        }
        console.log(`[${new Date().toISOString()}] Berhasil parse setelah cleaning: ${questions.length} pertanyaan`);
      } catch (secondError) {
        console.error('Second parse error:', secondError);
        throw new Error('Failed to parse questions from Gemini API response');
      }
    }

    // Cache the result
    cache.set(cacheKey, {
      data: questions,
      timestamp: Date.now()
    });

    res.json(questions);
  } catch (error) {
    console.error('Error generating questions:', error);
    res.status(500).json({
      error: 'Failed to generate questions',
      details: error.message
    });
  }
});

// Test endpoint untuk verifikasi API key
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'ok',
    apiKeyConfigured: !!process.env.GEMINI_API_KEY,
    apiKeyLength: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Key configured: ${process.env.GEMINI_API_KEY ? 'Yes' : 'No'}`);
}); 