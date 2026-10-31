console.log("Starting Simple Bot...");

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');

// ================= CONFIG =================
const HOST = 'sleepyempire.levyathan.ch';
const PORT = 25565;
const USERNAME = 'SkyBot'; // Make sure this name is registered
const PASSWORD = 'Streamersarenotcoolbeo'; 
// ==========================================

function connectBot() {
  console.log("Connecting to server...");

  const bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USERNAME,
    auth: 'offline'
  });

  bot.loadPlugin(pathfinder);

  // When the bot joins the server
  bot.once('spawn', async () => {
    console.log("✅ Bot joined the game!");
    
    // Wait 3 seconds for the server to load
    setTimeout(() => {
      console.log("Sending /login command...");
      bot.chat(`/login ${PASSWORD}`);
    }, 3000);

    const mcData = mcDataLoader(bot.version);

    // Simple loop: Every 8 seconds, do something
    setInterval(() => {
      if (!bot.entity) return;

      const action = Math.floor(Math.random() * 3);
      try {
        if (action === 0) {
          // Look around
          bot.look(bot.entity.yaw + 1, 0, false);
        } else if (action === 1) {
          // Jump
          bot.setControlState('jump', true);
          setTimeout(() => bot.setControlState('jump', false), 500);
        } else if (action === 2) {
          // Walk randomly
          const movements = new Movements(bot, mcData);
          bot.pathfinder.setMovements(movements);
          const pos = bot.entity.position;
          const goal = new goals.GoalNear(pos.x + (Math.random() - 0.5) * 10, pos.y, pos.z + (Math.random() - 0.5) * 10, 2);
          bot.pathfinder.goto(goal).catch(() => {});
        }
      } catch (err) {}
    }, 8000);
  });

  // Print errors to console
  bot.on('error', (err) => {
    console.log("Bot Error:", err.message);
  });

  // If the bot gets kicked or disconnects, wait 10 seconds and try again
  bot.on('end', (reason) => {
    console.log("Bot disconnected. Reason:", reason);
    console.log("Reconnecting in 10 seconds...");
    setTimeout(connectBot, 10000);
  });
}

// Start the bot
connectBot();
