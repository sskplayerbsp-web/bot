const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');
const http = require('http');

// ================= BOT LIST =================
let BOTS = null;
if (process.env.BOTS_JSON) {
  try {
    BOTS = JSON.parse(process.env.BOTS_JSON);
    console.log(`✅ Loaded ${BOTS.length} bots from BOTS_JSON`);
  } catch (e) {
    console.error('❌ Bad BOTS_JSON:', e.message);
  }
}
if (!BOTS || !BOTS.length) {
  console.log('⚠️ BOTS_JSON missing — using hardcoded fallback');
  BOTS = [
    { host: 'sleepyempire.levyathan.ch', port: 25565, version: '26.1', username: 'VoidReaper',   auth: 'offline', password: 'YourPass123' },
    { host: 'vega.pufferhost.com',       port: 25565, version: '26.1', username: 'ShadowByte',   auth: 'offline', password: 'YourPass123' },
    { host: 'sleepy.free.enzonic.com',   port: 25565, version: '26.1', username: 'PhantomMiner', auth: 'offline', password: 'YourPass123' }
  ];
}

const SESSION_MINUTES = parseInt(process.env.SESSION_MINUTES || '30', 10);
const SPAWN_GAP_MS    = parseInt(process.env.SPAWN_GAP_MS    || '20000', 10);
const RTP_WAIT_MS     = parseInt(process.env.RTP_WAIT_MS     || '10000', 10);
const MAX_RECONNECTS  = parseInt(process.env.MAX_RECONNECTS  || '20', 10);
const AUTH_TIMEOUT_MS = parseInt(process.env.AUTH_TIMEOUT_MS || '20000', 10);

// ================= HEALTH SERVER =================
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ok');
}).listen(PORT, () => console.log(`🌐 Health server on :${PORT}`));

// ================= HELPERS =================
const delay = (min = 1000, max = 4000) =>
  new Promise(r => setTimeout(r, Math.random() * (max - min) + min));

async function humanLook(bot) {
  await bot.look((Math.random() - 0.5) * 2 * Math.PI, (Math.random() - 0.5) * Math.PI / 3, false);
  await delay(400, 1500);
}

async function wander(bot, mcData) {
  const m = new Movements(bot, mcData);
  
  // 🛑 FIX: Avoid NPCs so the bot doesn't trigger broken server scripts
  m.entitiesToAvoid.add('armor_stand'); // Most NPCs are armor stands
  m.entitiesToAvoid.add('npc');         // Some plugins use a custom 'npc' entity
  m.canDig = false;                     // Don't dig when wandering around spawn
  
  bot.pathfinder.setMovements(m);
  const p = bot.entity.position;
  const goal = new goals.GoalNear(
    p.x + (Math.random() - 0.5) * 24, p.y, p.z + (Math.random() - 0.5) * 24, 2);
  try { await bot.pathfinder.goto(goal); } catch (e) {}
  await delay(1000, 3000);
}

async function mineTree(bot) {
  const logs = ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log'];
  const block = bot.findBlock({ matching: b => logs.includes(b.name), maxDistance: 48 });
  if (!block) return false;
  try {
    await bot.pathfinder.goto(new goals.GoalBlock(block.position.x, block.position.y, block.position.z));
    let cur = block;
    for (let i = 0; i < 5; i++) {
      if (!cur || !logs.includes(cur.name)) break;
      await bot.dig(cur);
      await delay(300, 900);
      cur = bot.blockAt(cur.position.offset(0, 1, 0));
    }
    return true;
  } catch (e) { return false; }
}

async function randomJump(bot) {
  if (Math.random() > 0.6) {
    bot.setControlState('jump', true);
    await delay(150, 350);
    bot.setControlState('jump', false);
  }
}

// ================= AUTH =================
function waitForAuth(bot, password) {
  return new Promise((resolve) => {
    const tag = `[${bot.username}]`;
    let done = false;
    let sentLogin = false;
    let sentRegister = false;

    const finish = (reason) => {
      if (done) return;
      done = true;
      console.log(`${tag} auth: ${reason}`);
      resolve(true);
    };

    const handleText = (text) => {
      if (done) return;
      if (/success|logged in|authenticated|welcome back|already logged|session/i.test(text)) return finish('success / session');
      if (/register|registration/i.test(text)) {
        if (!sentRegister) { sentRegister = true; console.log(`${tag} register → /register`); bot.chat(`/register ${password} ${password}`); }
        return;
      }
      if (/login|log in|authenticate|password/i.test(text)) {
        if (!sentLogin) { sentLogin = true; console.log(`${tag} login → /login`); bot.chat(`/login ${password}`); }
      }
    };

    bot.on('message', (msg) => handleText(msg.toString()));
    bot.on('chat', (username, message) => { if (username !== bot.username) handleText(message); });

    setTimeout(() => { if (!done && !sentLogin && !sentRegister) { sentLogin = true; bot.chat(`/login ${password}`); } }, 4000);
    setTimeout(() => { if (!done && !sentRegister) { sentRegister = true; bot.chat(`/register ${password} ${password}`); } }, 9000);
    setTimeout(() => finish('timeout'), AUTH_TIMEOUT_MS);
  });
}

// ================= /rtp =================
async function doRtp(bot) {
  console.log(`[${bot.username}] sending /rtp`);
  bot.chat('/rtp');
  await delay(RTP_WAIT_MS, RTP_WAIT_MS + 2000);
  console.log(`[${bot.username}] rtp done, pos: ${bot.entity.position}`);
}

// ================= ONE BOT =================
function runBot(cfg) {
  return new Promise(resolve => {
    let bot = null;
    let reconnectAttempts = 0;

    const startBot = () => {
      const tag = `[${cfg.username}@${cfg.host}]`;
      console.log(`${tag} connecting (attempt ${reconnectAttempts + 1})`);

      bot = mineflayer.createBot({
        host: cfg.host, port: cfg.port, username: cfg.username,
        version: cfg.version, auth: cfg.auth, viewDistance: 'tiny'
      });
      bot.loadPlugin(pathfinder);

      bot.once('spawn', async () => {
        reconnectAttempts = 0;
        console.log(`${tag} ✅ spawned`);

        if (cfg.password) await waitForAuth(bot, cfg.password);
        await doRtp(bot);

        const mcData = mcDataLoader(bot.version);
        const end = Date.now() + SESSION_MINUTES * 60 * 1000;
        while (Date.now() < end && bot && bot.entity) {
          try {
            const mined = await mineTree(bot);
            if (!mined) await wander(bot, mcData);
            if (Math.random() < 0.3) await humanLook(bot);
            if (Math.random() < 0.2) await randomJump(bot);
          } catch (e) {}
          await delay(2000, 6000);
        }
        try { bot.quit('session over'); } catch (e) {}
      });

      bot.on('error', e => console.log(`${tag} err ${e.message}`));
      bot.on('kicked', r => console.log(`${tag} kicked: ${JSON.stringify(r)}`));
      bot.on('end', () => {
        console.log(`${tag} disconnected`);
        if (reconnectAttempts < MAX_RECONNECTS) {
          reconnectAttempts++;
          const wait = Math.min(60000, 5000 * reconnectAttempts);
          console.log(`${tag} reconnecting in ${Math.round(wait / 1000)}s`);
          setTimeout(startBot, wait);
        } else { console.log(`${tag} ❌ giving up`); resolve(); }
      });
    };
    startBot();
  });
}

// ================= MAIN LOOP =================
(async () => {
  while (true) {
    console.log(`\n===== Cycle start: ${BOTS.length} bots =====`);
    const promises = [];
    for (let i = 0; i < BOTS.length; i++) {
      promises.push(runBot(BOTS[i]));
      await delay(SPAWN_GAP_MS, SPAWN_GAP_MS + 5000);
    }
    await Promise.all(promises);
    console.log('===== Cycle done. Restarting in 30s =====\n');
    await delay(30000, 60000);
  }
})();
