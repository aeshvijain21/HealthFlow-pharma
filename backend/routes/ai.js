const express = require("express");
const router = express.Router();

// Simple in-memory rate limiter (10 requests/min per IP)
const rateLimitMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 10;
  if (!rateLimitMap.has(ip)) { rateLimitMap.set(ip, { count: 1, start: now }); return false; }
  const entry = rateLimitMap.get(ip);
  if (now - entry.start > windowMs) { rateLimitMap.set(ip, { count: 1, start: now }); return false; }
  if (entry.count >= maxRequests) return true;
  entry.count++;
  return false;
}

router.post("/analyze", async (req, res) => {
  try {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    if (isRateLimited(ip)) {
      return res.status(429).json({ reply: "⏳ Too many messages. Please wait a minute." });
    }

    if (!process.env.GROQ_API_KEY) {
      try { require("dotenv").config(); } catch (_) {}
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ reply: "❌ GROQ_API_KEY is missing from .env" });
    }

    const history = req.body?.history || [];
    if (!history.length) {
      return res.status(400).json({ reply: "No message provided." });
    }

    const messages = [
      {
        role: "system",
        content:
          "You are HealthFlow AI, a helpful and empathetic medical health assistant. " +
          "You help patients understand their symptoms, medications, and general health queries. " +
          "Always recommend consulting a licensed doctor for serious conditions. " +
          "Be concise, clear, and supportive in your responses.",
      },
      ...history.map((msg) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      })),
    ];

    // Try current active Groq models in order
    const models = [
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b"
      ];

    let lastError = null;

    for (const model of models) {
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, max_tokens: 1024, temperature: 0.7 }),
      });

      const data = await groqRes.json();

      if (!groqRes.ok) {
        console.warn(`⚠️ Model ${model} failed:`, data?.error?.message);
        lastError = data?.error?.message;
        continue; // try next model
      }

      const text = data?.choices?.[0]?.message?.content || "No response from AI.";
      console.log(`✅ Responded using model: ${model}`);
      return res.json({ reply: text });
    }

    return res.status(502).json({
      reply: `❌ All models failed. Last error: ${lastError}`,
    });

  } catch (err) {
    console.error("🔥 AI route crash:", err.message);
    res.status(500).json({ reply: `❌ Server error: ${err.message}` });
  }
});

module.exports = router;
