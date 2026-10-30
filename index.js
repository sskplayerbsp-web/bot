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
    { host: 'sleepyempire.levyathan.ch', port: 25565, version: '1.20.1', username: 'VoidReaper',   auth: 'offline', password: 'YourPass123' },
    { host: 'vega.pufferhost.com',       port: 25565, version: '1.20.1', username: 'ShadowByte',   auth: 'offline', password: 'YourPass123' },
    { host: 'sleepy.free.enzonic.com',   port: 25565, version: '1.20.1', username: 'PhantomMiner', auth: 'offline', password: 'YourPass123' }
  ];
}

const SESSION_MINUTES = parseInt(process.env.SESSION_MINUTES || '60', 10); // Longer session for AFK
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
        if (!sentRegister) { sentRegister = true; bot.chat(`/register ${password} ${password}`); }
        return;
      }
      if (/login|log in|authenticate|password/i.test(text)) {
        if (!sentLogin) { sentLogin = true; bot.chat(`/login ${password}`); }
      }
    };

    bot.on('message', (msg) => handleText(msg.toString()));
    bot.on('chat', (username, message) => { if (username !== bot.username) handleText(message); });

    setTimeout(() => { if (!done && !sentLogin && !sentRegister) { sentLogin = true; bot.chat(`/login ${password}`); } }, 4000);
    setTimeout(() => { if (!done && !sentRegister) { sentRegister = true; bot.chat(`/register ${password} ${password}`); } }, 9000);
    setTimeout(() => finish('timeout'), AUTH_TIMEOUT_MS);
  });
}

// ================= AFK BEHAVIOR =================
async function doAFKAction(bot) {
  // Pick a random action to look like a real player stretching / looking around
  const action = Math.floor(Math.random() * 5);
  try {
    switch (action) {
      case 0: // Look around
        await bot.look((Math.random() - 0.5) * 2 * Math.PI, (Math.random() - 0.5) * Math.PI / 3, false);
        break;
      case 1: // Jump
        bot.setControlState('jump', true);
        await delay(200, 400);
        bot.setControlState('jump', false);
        break;
      case 2: // Walk forward a tiny bit
        bot.setControlState('forward', true);
        await delay(500, 1500);
        bot.setControlState('forward', false);
        break;
      case 3: // Sneak (crouch)
        bot.setControlState('sneak', true);
        await delay(800, 2000);
        bot.setControlState('sneak', false);
        break;
      case 4: // Swing arm (left click)
        bot.swingArm();
        break;
    }
  } catch (e) {}
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

        // 1) Login
        if (cfg.password) await waitForAuth(bot, cfg.password);

        const mcData = mcDataLoader(bot.version);
        const movements = new Movements(bot, mcData);
        bot.pathfinder.setMovements(movements);

        const end = Date.now() + SESSION_MINUTES * 60 * 1000;
        
        // 2) AFK Loop
        while (Date.now() < end && bot && bot.entity) {
          await doAFKAction(bot);
          await delay(4000, 10000); // Wait 4 to 10 seconds between actions
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
      // Stagger joins slightly so they don't join in the same tick
      await delay(5000, 10000); 
    }
    await Promise.all(promises);
    console.log('===== Cycle done. Restarting in 30s =====\n');
    await delay(30000, 60000);
  }
})();
