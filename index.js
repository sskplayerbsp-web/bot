console.log("🚀 STARTING PLAYERS (No Chat Mode)...");

process.on('uncaughtException', (err) => {
  if (err.message.includes('PartialReadError')) return; // Ignore harmless custom item errors
  console.log('❌ Caught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.log('❌ Unhandled Promise Rejection:', reason);
});

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const mcDataLoader = require('minecraft-data');
const net = require('net'); // Used for the connection test

// ================= CONFIG =================
const ACCOUNT_PASSWORD = 'Streamersarenotcoolbeo'; 

const SERVERS = [
  // Server 1
  { host: 'sleepyempire.levyathan.ch', port: 25565, username: 'Liam_Miller', version: '1.21.1' },
  
  // Server 2
  { host: 'sleepyem.mcsh.gg',          port: 25565, username: 'Noah_Davis',  version: '1.21.4' } 
];
// ==========================================

const delay = (min = 1000, max = 4000) => new Promise(r => setTimeout(r, Math.random() * (max - min) + min));

// 🛑 RAW TCP TEST
function testServerConnection(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(5000); // 5 second limit
    
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.on('error', () => { socket.destroy(); resolve(false); });
    
    socket.connect(port, host);
  });
}

async function performHumanAction(client, mcData) {
  if (!client.entity || !client.entity.position) return;

  const action = Math.floor(Math.random() * 7); 
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
    }
  } catch (e) {}
}

function startPlayer(config) {
  let isConnecting = false;
  let connectionTimeout = null;
  let isKicked = false;
  const tag = `[${config.username}@${config.host}]`;

  const run = async () => {
    if (isConnecting) return;
    isConnecting = true;
    isKicked = false;

    // 🛑 THIS LINE WILL PROVE IF THE CODE UPDATED
    console.log(`\n🎯 CHECKING NETWORK FOR ${tag}...`);

    const canReachServer = await testServerConnection(config.host, config.port);
    if (!canReachServer) {
      console.log(`❌ ${tag} FAILED TO REACH SERVER! Hostless is blocked by the server firewall or the server is offline.`);
      isConnecting = false;
      setTimeout(run, 30000); 
      return; 
    }

    console.log(`✅ ${tag} Network is reachable! Attempting to log in on version ${config.version}...`);

    let client;
    try {
      client = mineflayer.createBot({
        host: config.host,
        port: config.port,
        username: config.username,
        auth: 'offline',
        version: config.version,
        checkTimeoutInterval: 300 * 1000 
      });
    } catch (err) {
      console.log(`❌ ${tag} Failed to create instance:`, err.message);
      isConnecting = false;
      setTimeout(run, 30000);
      return;
    }

    client.loadPlugin(pathfinder);

    connectionTimeout = setTimeout(() => {
      if (isConnecting) {
        console.log(`❌ ${tag} Hard timeout after 60s. Forcing retry...`);
        client.end(); 
      }
    }, 60000);

    client.once('spawn', async () => {
      isConnecting = false;
      clearTimeout(connectionTimeout); 
      console.log(`✅ ${tag} spawned and joined the game.`);
      
      await delay(3000, 4000); 

      console.log(`🔑 ${tag} Attempting /login...`);
      client.chat(`/login ${ACCOUNT_PASSWORD}`);

      let mcData;
      try {
        mcData = mcDataLoader(client.version);
      } catch (e) {
        mcData = null;
      }
      
      while (client.entity) {
        await performHumanAction(client, mcData);
        await delay(5000, 12000); 
      }
    });

    client.on('message', (jsonMsg) => {
      const text = jsonMsg.toString();
      if (/register/i.test(text)) {
        console.log(`📝 ${tag} Registering...`);
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
      clearTimeout(connectionTimeout);
      client.removeAllListeners(); 
      
      if (reasonStr.includes('already playing') || reasonStr.includes('already connected')) {
        console.log(`⚠️ ${tag} Kicked: Ghost session. Waiting 5 minutes...`);
        setTimeout(() => { isConnecting = false; run(); }, 300000); 
      } else {
        console.log(`❌ ${tag} Kicked: ${reasonStr}. Reconnecting in 30s...`);
        setTimeout(() => { isConnecting = false; run(); }, 30000);
      }
    });

    client.on('end', () => {
      clearTimeout(connectionTimeout);
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
