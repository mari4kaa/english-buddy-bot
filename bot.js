import express from "express";
import { Telegraf } from "telegraf";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import dotenv from "dotenv";

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

const MENU = {
  VOCAB: "Vocabulary Practice",
  GRAMMAR: "Grammar Check",
  PHRASAL: "Phrasal Verbs Learning",
};

const MAIN_MENU = [[MENU.VOCAB, MENU.GRAMMAR], [MENU.PHRASAL]];

// Helper to call Gemini via generateText
async function callGemini(systemPrompt, userPrompt) {
  try {
    const { text } = await generateText({
      model: google("models/gemini-2.0-flash-exp"),
      prompt: `${systemPrompt}\nUser: ${userPrompt}\nAnswer:`,
      temperature: 0.6,
      max_output_tokens: 400,
    });
    return text.trim();
  } catch (err) {
    console.error(err);
    return "❌ Error connecting to Gemini API.";
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

// Middleware for session
bot.use((ctx, next) => {
  if (!ctx.session) ctx.session = {};
  return next();
});

// Menu handlers
bot.hears(MENU.VOCAB, (ctx) => {
  ctx.session.mode = "vocab";
  ctx.reply(
    "✏️ Send me a word or collocation and I'll give you examples + a memorization tip."
  );
});

bot.hears(MENU.GRAMMAR, (ctx) => {
  ctx.session.mode = "grammar";
  ctx.reply(
    "📜 Send me a sentence or short text. I'll correct grammar and explain briefly."
  );
});

bot.hears(MENU.PHRASAL, async (ctx) => {
  ctx.session.mode = null;
  ctx.reply("🔍 Fetching a random phrasal verb...");

  const systemPrompt = `You are an experienced English teacher. Provide:
1) One common phrasal verb + definition,
2) Three example sentences in different contexts,
3) One short memorization tip.
Format with labels.`;

  const userPrompt = "Give me a phrasal verb, 3 usage examples, and a quick tip.";
  const answer = await callGemini(systemPrompt, userPrompt);

  ctx.reply(answer, {
    reply_markup: { keyboard: MAIN_MENU, resize_keyboard: true },
  });
});

// Handle user text based on mode
bot.on("text", async (ctx) => {
  const mode = ctx.session.mode;
  const text = ctx.message.text;

  if (!mode) return;

  if (mode === "vocab") {
    ctx.reply("📝 Creating examples and a tip...");
    const systemPrompt = `You are an English teacher. For a word or collocation, return:
Definition:, 3 short Examples:, and a Tip:. Keep it concise.`;
    const answer = await callGemini(systemPrompt, text);
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
    const answer = await callGemini(systemPrompt, text);
    ctx.reply(answer, {
      reply_markup: { keyboard: MAIN_MENU, resize_keyboard: true },
    });
    ctx.session.mode = null;
  }
});

// Webhook for production
if (process.env.NODE_ENV === "production") {
  const app = express();
  app.use(bot.webhookCallback(`/bot${process.env.TELEGRAM_TOKEN}`));
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Bot running on port ${port}`));
}

// Local polling
if (process.env.NODE_ENV !== "production") {
  bot.launch().then(() => console.log("✅ Bot running in polling mode"));
}
