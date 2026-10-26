const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');

// ================= BOT LIST: env var first, hardcoded fallback =================
let BOTS = null;
if (process.env.BOTS_JSON) {
  try {
    BOTS = JSON.parse(process.env.BOTS_JSON);
    console.log(`✅ Loaded ${BOTS.length} bots from BOTS_JSON env var`);
  } catch (e) {
    console.error('❌ BOTS_JSON is not valid JSON:', e.message);
  }
}
if (!BOTS || !BOTS.length) {
  console.log('⚠️ BOTS_JSON not set/invalid — using hardcoded fallback');
  BOTS = [
    { host: 'sleepy.seedloaf.gg',        port: 25565, version: '1.20.1', username: 'Steve1', auth: 'offline' },
    { host: 'sleepyempire.levyathan.ch', port: 25565, version: '1.20.1', username: 'Alex2',  auth: 'offline' },
    { host: 'sleepy.free.enzonic.com',   port: 25565, version: '1.20.1', username: 'Notch3', auth: 'offline' }
  ];
}

const SESSION_MINUTES = parseInt(process.env.SESSION_MINUTES || '30', 10);
const SPAWN_GAP_MS    = parseInt(process.env.SPAWN_GAP_MS    || '20000', 10);
const RTP_WAIT_MS     = parseInt(process.env.RTP_WAIT_MS     || '10000', 10);
// ==============================================================================

const delay = (min = 1000, max = 4000) =>
  new Promise(r => setTimeout(r, Math.random() * (max - min) + min));

// ------------------ human-like helpers ------------------
async function humanLook(bot) {
  await bot.look((Math.random() - 0.5) * 2 * Math.PI, (Math.random() - 0.5) * Math.PI / 3, false);
  await delay(400, 1500);
}

async function wander(bot, mcData) {
  const m = new Movements(bot, mcData);
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

// ------------------ /rtp after join ------------------
async function doRtp(bot) {
  console.log(`[${bot.username}] sending /rtp`);
  bot.chat('/rtp');
  // Wait for teleport to land (10s default; can be overridden by RTP_WAIT_MS)
  await delay(RTP_WAIT_MS, RTP_WAIT_MS + 2000);
  console.log(`[${bot.username}] rtp wait done, position: ${bot.entity.position}`);
}

// ------------------ one bot = one promise ------------------
function runBot(cfg) {
  return new Promise(resolve => {
    const tag = `[${cfg.username}@${cfg.host}]`;
    const bot = mineflayer.createBot({
      host: cfg.host, port: cfg.port, username: cfg.username,
      version: cfg.version, auth: cfg.auth, viewDistance: 'tiny'
    });
    bot.loadPlugin(pathfinder);

    let done = false;
    const finish = (reason) => {
      if (done) return; done = true;
      console.log(`${tag} done: ${reason}`);
      try { bot.quit(reason); } catch (e) {}
      resolve();
    };

    bot.once('spawn', async () => {
      console.log(`${tag} spawned`);
      const mcData = mcDataLoader(bot.version);

      // 1) Send /rtp first, wait for teleport
      await doRtp(bot);

      // 2) Now start the mining/wandering loop
      const end = Date.now() + SESSION_MINUTES * 60 * 1000;
      while (Date.now() < end && !done) {
        try {
          const mined = await mineTree(bot);
          if (!mined) await wander(bot, mcData);
          if (Math.random() < 0.3) await humanLook(bot);
          if (Math.random() < 0.2) await randomJump(bot);
        } catch (e) {}
        await delay(2000, 6000);
      }
      finish('session over');
    });

    bot.on('error', e => { console.log(`${tag} err ${e.message}`); finish('error'); });
    bot.on('kicked', r => finish('kicked: ' + r));
    bot.on('end', () => finish('end'));
    setTimeout(() => finish('timeout'), (SESSION_MINUTES + 5) * 60 * 1000);

    // Optional: log chat so you can see /rtp confirmation server messages
    bot.on('message', (jsonMsg) => {
      const text = jsonMsg.toString();
      if (/rtp|teleport|random/i.test(text)) {
        console.log(`${tag} chat: ${text}`);
      }
    });
  });
}

// ------------------ main loop (runs forever) ------------------
(async () => {
  while (true) {
    console.log(`\n===== Starting cycle with ${BOTS.length} bots =====`);
    const promises = [];
    for (let i = 0; i < BOTS.length; i++) {
      promises.push(runBot(BOTS[i]));
      await delay(SPAWN_GAP_MS, SPAWN_GAP_MS + 5000);
    }
    await Promise.all(promises);
    console.log('===== Cycle done. Restarting in 30s =====\n');
    await delay(30000, 60000);
  }
  // NOTE: no process.exit() here — keeps Hostless container alive forever
})();
