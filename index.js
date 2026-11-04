console.log("🚀 STARTING PLAYERS...");

process.on('uncaughtException', (err) => {
  console.log('❌ Caught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.log('❌ Unhandled Promise Rejection:', reason);
});

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');
const net = require('net'); // Used to test if the server is reachable

// ================= CONFIG =================
const ACCOUNT_PASSWORD = 'Streamersarenotcoolbeo'; 

// We use 1.21.1 because it's the most stable. 
// Change this to '1.20.4' or '1.21.3' if your server is on a different version.
const GAME_VERSION = '1.21.1'; 

const SERVERS = [
  { host: 'sleepy.mcwhost.de:25620', port: 25565, username: 'Liam_Miller' },
  { host: 'sleepy.levyathan.ch',       port: 25565, username: 'Noah_Davis' } 
];

const CHAT_MESSAGES = [
  "gg", "lol", "where is everyone?", "just got here", 
  "anyone wanna build?", "im bored", "hi", "bruh moment", 
  "this server is cool", "whats up"
];
// ==========================================

const delay = (min = 1000, max = 4000) => new Promise(r => setTimeout(r, Math.random() * (max - min) + min));

// 🛑 RAW TCP TEST: Checks if Hostless can physically see the IP/Port
function testServerConnection(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(5000); // 5 second limit
    
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.connect(port, host);
  });
}

async function performHumanAction(client, mcData) {
  if (!client.entity || !client.entity.position) return;

  const action = Math.floor(Math.random() * 8); 
  try {
    switch (action) {
      case 0: 
        const yaw = client.entity.yaw + (Math.random() - 0.5) * 2;
        const pitch = (Math.random() - 0.5) * 1.5;
        await client.look(yaw, pitch, false);
        break;
      case 1: 
        if (mcData) {
          const movements = new Movements(client, mcData);
          movements.canDig = false; 
          client.pathfinder.setMovements(movements);
          const pos = client.entity.position;
          const randomX = pos.x + (Math.random() - 0.5) * 15;
          const randomZ = pos.z + (Math.random() - 0.5) * 15;
          const goal = new goals.GoalNear(randomX, pos.y, randomZ, 2);
          await Promise.race([ client.pathfinder.goto(goal), delay(4000, 5000) ]);
        }
        break;
      case 2: 
        client.setControlState('jump', true);
        await delay(200, 400);
        client.setControlState('jump', false);
        break;
      case 3: 
        client.swingArm('right');
        break;
      case 4: 
        client.setControlState('sneak', true);
        await delay(500, 1500);
        client.setControlState('sneak', false);
        break;
      case 5: 
        client.setQuickBarSlot(Math.floor(Math.random() * 9));
        break;
      case 6: 
        await delay(1000, 3000);
        break;
      case 7: 
        const playerCount = Object.keys(client.players).length;
        if (playerCount > 1 && Math.random() < 0.3) { 
          const msg = CHAT_MESSAGES[Math.floor(Math.random() * CHAT_MESSAGES.length)];
          client.chat(msg);
          console.log(`[${client.username}] Sent chat: ${msg}`);
        }
        break;
    }
  } catch (e) {}
}

function startPlayer(config) {
  let isConnecting = false;
  let isKicked = false;
  const tag = `[${config.username}@${config.host}]`;

  const run = async () => {
    if (isConnecting) return;
    isConnecting = true;
    isKicked = false;

    console.log(`\n🎯 CHECKING CONNECTION FOR ${tag}...`);

    // 🛑 RUN THE TCP TEST FIRST
    const canReachServer = await testServerConnection(config.host, config.port);
    if (!canReachServer) {
      console.log(`❌ ${tag} FAILED TO REACH SERVER! The server is offline, the port is wrong, or your host (Hostless) is blocked by the server's firewall.`);
      isConnecting = false;
      setTimeout(run, 30000); // Wait 30s and try again
      return; // Stop here, don't try to login
    }

    console.log(`✅ ${tag} Server is reachable! Attempting to log in...`);

    let client;
    try {
      client = mineflayer.createBot({
        host: config.host,
        port: config.port,
        username: config.username,
        auth: 'offline',
        version: GAME_VERSION,
        checkTimeoutInterval: 60000 
      });
    } catch (err) {
      console.log(`❌ ${tag} Failed to create instance:`, err.message);
      isConnecting = false;
      setTimeout(run, 30000);
      return;
    }

    client.loadPlugin(pathfinder);

    client.once('spawn', async () => {
      isConnecting = false;
      console.log(`✅ ${tag} successfully joined the game.`);
      
      await delay(3000, 4000); 
      client.chat(`/login ${ACCOUNT_PASSWORD}`);

      let mcData;
      try { mcData = mcDataLoader(client.version); } catch (e) { mcData = null; }
      
      while (client.entity) {
        await performHumanAction(client, mcData);
        await delay(5000, 12000); 
      }
    });

    client.on('message', (jsonMsg) => {
      const text = jsonMsg.toString();
      if (/register/i.test(text)) {
        client.chat(`/register ${ACCOUNT_PASSWORD} ${ACCOUNT_PASSWORD}`);
      }
    });

    client.on('error', (err) => {
      if (!err.message.includes('ECONNRESET') && !err.message.includes('ETIMEDOUT')) {
        console.log(`⚠️ ${tag} Error:`, err.message);
      }
    });

    client.on('kicked', (reason) => {
      isKicked = true;
      const reasonStr = JSON.stringify(reason);
      isConnecting = true; 
      client.removeAllListeners(); 
      
      if (reasonStr.includes('already playing') || reasonStr.includes('already connected')) {
        console.log(`⚠️ ${tag} Kicked: Ghost session detected. Waiting 5 minutes...`);
        setTimeout(() => { isConnecting = false; run(); }, 300000); 
      } else {
        console.log(`❌ ${tag} Kicked: ${reasonStr}. Reconnecting in 30s...`);
        setTimeout(() => { isConnecting = false; run(); }, 30000);
      }
    });

    client.on('end', () => {
      client.removeAllListeners(); 
      if (!isKicked && !isConnecting) {
        isConnecting = true;
        console.log(`🔌 ${tag} Disconnected. Reconnecting in 30s...`);
        setTimeout(() => { isConnecting = false; run(); }, 30000);
      }
    });
  };

  run(); 
}

// ================= START ALL =================
console.log(`Starting ${SERVERS.length} players...`);
SERVERS.forEach((server, index) => {
  setTimeout(() => startPlayer(server), index * 5000);
});
