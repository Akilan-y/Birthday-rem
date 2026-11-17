import 'dotenv/config';
import express, {type Request, type Response} from 'express';
import path from 'path';
import {fileURLToPath} from 'url';
import {GoogleGenAI} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type AssistantPersona = 'eco-gifting' | 'milestone-planner' | 'quick-wishes';

interface IncomingHistoryItem {
  role: 'user' | 'model';
  text: string;
}

interface ChatRequestBody {
  message?: string;
  persona?: AssistantPersona;
  history?: IncomingHistoryItem[];
  birthdayContext?: string;
}

const PERSONA_CONFIG: Record<
  AssistantPersona,
  {model: string; systemInstruction: string}
> = {
  'eco-gifting': {
    model: 'gemini-4-hydrogen',
    systemInstruction:
      'You are Broll, a thoughtful, eco-friendly birthday gifting and celebration advisor. Suggest sustainable, low-waste, experiential, handmade, or locally sourced gift ideas tailored to the recipient details shared by the user. Keep responses warm, practical, concise (around 120-220 words unless asked for more), and free of fluff.',
  },
  'milestone-planner': {
    model: 'gemini-4-hydrogen',
    systemInstruction:
      'You are Broll Milestone Planner, specializing in meaningful milestone birthdays (18th, 21st, 30th, 50th, 75th, 100th). Help the user organize low-impact gatherings, memory keepsakes, group tributes, and thoughtful timelines. Keep recommendations structured, warm, and actionable.',
  },
  'quick-wishes': {
    model: 'gemini-3.1-flash-lite',
    systemInstruction:
      'You are Broll Note Writer. Craft sincere, human, concise birthday messages suitable for handwritten recycled-paper cards, postcards, or short personal texts. Provide 2-3 distinct tone options (warm, brief, playful) unless the user asks for one specific style.',
  },
};

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add it in Settings > Secrets to enable the Gemini assistant.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT ?? 3000);
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({limit: '1mb'}));

  app.post('/api/gemini/chat', async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as ChatRequestBody;
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message) {
        res.status(400).json({error: 'Message is required.'});
        return;
      }

      const persona: AssistantPersona =
        body.persona && body.persona in PERSONA_CONFIG
          ? body.persona
          : 'eco-gifting';
      const config = PERSONA_CONFIG[persona];

      const rawHistory = Array.isArray(body.history) ? body.history : [];
      const sanitizedHistory = rawHistory
        .filter(
          (item): item is IncomingHistoryItem =>
            (item?.role === 'user' || item?.role === 'model') &&
            typeof item?.text === 'string' &&
            item.text.trim().length > 0
        )
        .slice(-20)
        .map((item) => ({
          role: item.role,
          parts: [{text: item.text.slice(0, 6000)}],
        }));

      const contextSection =
        typeof body.birthdayContext === 'string' && body.birthdayContext.trim().length > 0
          ? `\n\nUser's upcoming birthday list for reference:\n${body.birthdayContext.slice(0, 2500)}`
          : '';

      const ai = createGeminiClient();
      const chat = ai.chats.create({
        model: config.model,
        history: sanitizedHistory,
        config: {
          systemInstruction: `${config.systemInstruction}${contextSection}`,
        },
      });

      const response = await chat.sendMessage({
        message: message.slice(0, 4000),
      });

      const replyText = response.text?.trim();
      if (!replyText) {
        res.status(502).json({error: 'Gemini returned an empty response. Please try again.'});
        return;
      }

      res.json({
        reply: replyText,
        model: config.model,
        persona,
      });
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Failed to communicate with Gemini API.';
      console.error('Gemini chat error:', msg);
      res.status(500).json({error: msg});
    }
  });

  if (!isProd) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
