const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');
const http = require('http');

// Keep Hostless happy so it doesn't sleep the container
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!');
}).listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// ================= CONFIG =================
const BOT_PASSWORD = 'Streamersarenotcoolbeo'; 

const SERVERS = [
  { host: 'sleepyempire.levyathan.ch', port: 25565, username: 'SkyBot_1' },
  { host: 'sleepy.levyathan.ch',       port: 25565, username: 'SkyBot_2' } 
];
// ==========================================

const delay = (min = 1000, max = 4000) => new Promise(r => setTimeout(r, Math.random() * (max - min) + min));

async function doHumanAction(bot, mcData) {
  if (!bot.entity || !bot.entity.position) return;
  const action = Math.floor(Math.random() * 6);
  try {
    switch (action) {
      case 0: 
        await bot.look(bot.entity.yaw + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.5, false);
        break;
      case 1: 
        const movements = new Movements(bot, mcData);
        movements.canDig = false; 
        bot.pathfinder.setMovements(movements);
        const currentPos = bot.entity.position;
        const goal = new goals.GoalNear(currentPos.x + (Math.random() - 0.5) * 15, currentPos.y, currentPos.z + (Math.random() - 0.5) * 15, 2);
        await Promise.race([ bot.pathfinder.goto(goal), delay(4000, 5000) ]);
        break;
      case 2: 
        bot.setControlState('jump', true);
        await delay(200, 400);
        bot.setControlState('jump', false);
        break;
      case 3: bot.swingArm('right'); break;
      case 4: 
        bot.setControlState('sneak', true);
        await delay(500, 1500);
        bot.setControlState('sneak', false);
        break;
      case 5: bot.setQuickBarSlot(Math.floor(Math.random() * 9)); break;
    }
  } catch (e) {}
}

function startBot(config) {
  let isConnecting = false;
  let connectionTimeout = null;
  const tag = `[${config.username}@${config.host}]`;

  const run = () => {
    if (isConnecting) return;
    isConnecting = true;

    console.log(`\n${tag} Attempting to connect...`);

    const bot = mineflayer.createBot({
      host: config.host, port: config.port, username: config.username, auth: 'offline', version: false 
    });

    bot.loadPlugin(pathfinder);

    connectionTimeout = setTimeout(() => {
      if (isConnecting) { console.log(`${tag} ❌ Connection timed out. Forcing retry...`); bot.end(); }
    }, 45000);

    bot.once('spawn', async () => {
      isConnecting = false;
      clearTimeout(connectionTimeout); 
      console.log(`${tag} ✅ spawned and joined the game.`);
      await delay(3000, 4000);
      console.log(`${tag} Attempting /login...`);
      bot.chat(`/login ${BOT_PASSWORD}`);
      const mcData = mcDataLoader(bot.version);
      while (bot.entity) {
        await doHumanAction(bot, mcData);
        await delay(6000, 12000); 
      }
    });

    bot.on('message', (jsonMsg) => {
      const text = jsonMsg.toString();
      if (/register/i.test(text)) bot.chat(`/register ${BOT_PASSWORD} ${BOT_PASSWORD}`);
    });

    bot.on('error', (err) => {
      if (!err.message.includes('ECONNRESET')) console.log(`${tag} Error:`, err.message);
    });

    bot.on('kicked', (reason) => {
      const reasonStr = JSON.stringify(reason);
      isConnecting = true; 
      clearTimeout(connectionTimeout);
      bot.removeAllListeners(); 
      if (reasonStr.includes('already playing') || reasonStr.includes('already connected')) {
        console.log(`${tag} ⚠️ Kicked: Ghost session. Waiting 5 mins...`);
        setTimeout(() => { isConnecting = false; run(); }, 300000); 
      } else {
        console.log(`${tag} ❌ Kicked: ${reasonStr}. Reconnecting in 15s...`);
        setTimeout(() => { isConnecting = false; run(); }, 15000);
      }
    });

    bot.on('end', () => {
      clearTimeout(connectionTimeout);
      bot.removeAllListeners(); 
      if (!isConnecting) {
        isConnecting = true;
        console.log(`${tag} Disconnected. Reconnecting in 15s...`);
        setTimeout(() => { isConnecting = false; run(); }, 15000);
      }
    });
  };
  run(); 
}

console.log(`Starting ${SERVERS.length} independent bots...`);
SERVERS.forEach((server, index) => {
  setTimeout(() => startBot(server), index * 3000);
});
