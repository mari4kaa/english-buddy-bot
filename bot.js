// bot.js
import express from "express";
import { Telegraf } from "telegraf";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MENU = {
    VOCAB: "Vocabulary Practice",
    GRAMMAR: "Grammar Check",
    PHRASAL: "Phrasal Verbs Learning",
  };
  
  const MAIN_MENU = [[MENU.VOCAB, MENU.GRAMMAR], [MENU.PHRASAL]];
  
  // Helper to call ChatGPT
  async function callChatGPT(systemPrompt, userPrompt) {
    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 400,
      });
      return response.choices[0].message.content.trim();
    } catch (err) {
      console.error(err);
      return "❌ Error connecting to ChatGPT API.";
    }
  }
  
  // /start command
  bot.start((ctx) => {
    ctx.reply(
      "Hi! I'm your Language Learning Buddy 🤖.\nChoose an option from the menu:",
      {
        reply_markup: {
          keyboard: MAIN_MENU,
          resize_keyboard: true,
        },
      }
    );
    ctx.session = { mode: null };
  });
  
  // Middleware to keep track of session state
  bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    return next();
  });
  
  // Handle menu taps
  bot.hears(MENU.VOCAB, (ctx) => {
    ctx.session.mode = "vocab";
    ctx.reply("✏️ Send me a word or collocation and I\'ll give you examples + a memorization tip.");
  });
  
  bot.hears(MENU.GRAMMAR, (ctx) => {
    ctx.session.mode = "grammar";
    ctx.reply("📜 Send me a sentence or short text. I'll correct grammar and explain briefly.");
  });
  
  bot.hears(MENU.PHRASAL, async (ctx) => {
    ctx.session.mode = null; // reset mode
    ctx.reply("🔍 Fetching a random phrasal verb...");
  
    const systemPrompt = `You are an experienced English teacher. Provide:
  1) One common phrasal verb + definition,
  2) Three example sentences in different contexts,
  3) One short memorization tip.
  Format with labels.`;
    const userPrompt = "Give me a phrasal verb, 3 usage examples, and a quick tip.";
    const answer = await callChatGPT(systemPrompt, userPrompt);
  
    ctx.reply(answer, {
      reply_markup: { keyboard: MAIN_MENU, resize_keyboard: true },
    });
  });
  
  // Handle user text depending on mode
  bot.on("text", async (ctx) => {
    const mode = ctx.session.mode;
    const text = ctx.message.text;
  
    if (!mode) return; // message already handled above
  
    if (mode === "vocab") {
      ctx.reply("📝 Creating examples and a tip...");
      const systemPrompt = `You are an English teacher. For a word or collocation, return:
  Definition:, 3 short Examples:, and a Tip:. Keep it concise.`;
      const answer = await callChatGPT(systemPrompt, text);
      ctx.reply(answer, {
        reply_markup: { keyboard: MAIN_MENU, resize_keyboard: true },
      });
      ctx.session.mode = null;
    }
  
    if (mode === "grammar") {
      ctx.reply("🔎 Checking grammar...");
      const systemPrompt = `You are a friendly English grammar corrector. For given text, return:
  1) Corrected text,
  2) 1–3 bullet explanations of corrections,
  3) One short tip.`;
      const answer = await callChatGPT(systemPrompt, text);
      ctx.reply(answer, {
        reply_markup: { keyboard: MAIN_MENU, resize_keyboard: true },
      });
      ctx.session.mode = null;
    }
  });

const app = express();
app.use(await bot.createWebhook({ domain: process.env.WEBHOOK_URL }));

// Expose webhook endpoint
app.post(`/bot${process.env.TELEGRAM_TOKEN}`, (req, res) => {
  res.send("ok");
});

// Listen on port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot is running on port ${PORT}`);
});
