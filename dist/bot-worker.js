// Plans a bot's next spot off the main thread (bot.js decide), so a hard bot never stutters the game.
import {decide} from './bot.js';
self.onmessage = ({data}) => {
  try { const bot = data.bot, plan = decide(bot, data.input); self.postMessage({id: data.id, piece: plan?.piece ?? null, rng: bot.rng}); }
  catch (error) { self.postMessage({id: data.id, error: String(error)}); }
};
