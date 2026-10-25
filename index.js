const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');

// ================= EDIT ONLY THIS BLOCK =================
// Replace these placeholders with YOUR real server IPs and usernames.
const BOTS = [
  // Server 1 (3 bots)
  { host: 'YOUR_SERVER_1_IP', port: 25565, version: '1.20.1', username: 'Steve1', auth: 'offline' },
  { host: 'YOUR_SERVER_1_IP', port: 25565, version: '1.20.1', username: 'Alex2',  auth: 'offline' },
  { host: 'YOUR_SERVER_1_IP', port: 25565, version: '1.20.1', username: 'Notch3', auth: 'offline' },

  // Server 2 (2 bots)
  { host: 'YOUR_SERVER_2_IP', port: 25565, version: '1.20.1', username: 'Bot4',  auth: 'offline' },
  { host: 'YOUR_SERVER_2_IP', port: 25565, version: '1.20.1', username: 'Bot5',  auth: 'offline' },

  // Server 3 (1 bot)
  { host: 'YOUR_SERVER_3_IP', port: 25565, version: '1.20.1', username: 'Bot6',  auth: 'offline' }
];

const SESSION_MINUTES = 30;   // how long each bot stays online per cycle
const SPAWN_GAP_MS = 20000;   // 20s gap between joins (anti-bot)
// ========================================================

const delay = (min = 1000, max = 4000) =>
  new Promise(r => setTimeout(r, Math.random() * (max - min) + min));

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
  const block = bot.findBlock({ matching: b => logs.includes(b.name), maxDistance: 32 });
  if (!block) return;
  try {
    await bot.pathfinder.goto(new goals.GoalBlock(block.position.x, block.position.y, block.position.z));
    let cur = block;
    for (let i = 0; i < 4; i++) {
      if (!cur || !logs.includes(cur.name)) break;
      await bot.dig(cur);
      await delay(300, 900);
      cur = bot.blockAt(cur.position.offset(0, 1, 0));
    }
  } catch (e) {}
}

async function randomJump(bot) {
  if (Math.random() > 0.6) {
    bot.setControlState('jump', true);
    await delay(150, 350);
    bot.setControlState('jump', false);
  }
}

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
      const end = Date.now() + SESSION_MINUTES * 60 * 1000;
      while (Date.now() < end && !done) {
        const r = Math.random();
        try {
          if (r < 0.35) await wander(bot, mcData);
          else if (r < 0.65) await mineTree(bot);
          else if (r < 0.85) await humanLook(bot);
          else await randomJump(bot);
        } catch (e) {}
        await delay(2000, 6000);
      }
      finish('session over');
    });

    bot.on('error', e => { console.log(`${tag} err ${e.message}`); finish('error'); });
    bot.on('kicked', r => finish('kicked: ' + r));
    bot.on('end', () => finish('end'));
    setTimeout(() => finish('timeout'), (SESSION_MINUTES + 5) * 60 * 1000);
  });
}

(async () => {
  const promises = [];
  for (let i = 0; i < BOTS.length; i++) {
    promises.push(runBot(BOTS[i]));
    // Stagger joins so they don't all connect in the same second
    await delay(SPAWN_GAP_MS, SPAWN_GAP_MS + 5000);
  }
  await Promise.all(promises);
  console.log('All bot sessions finished. Exiting.');
  process.exit(0);
})();
