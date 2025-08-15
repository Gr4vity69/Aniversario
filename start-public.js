const { exec } = require('child_process');
const ngrok = require('ngrok');
const http = require('http');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Verificar estado del servidor
function checkServer(port, retries = 15, delay = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    function tryConnect() {
      const req = http.get(`http://localhost:${port}`, (res) => {
        if (res.statusCode === 200) resolve();
        else if (++attempts < retries) setTimeout(tryConnect, delay);
        else reject(new Error('El servidor no respondió correctamente'));
      });
      
      req.on('error', () => {
        if (++attempts < retries) setTimeout(tryConnect, delay);
        else reject(new Error('El servidor no está disponible'));
      });
    }
    
    tryConnect();
  });
}

// Obtener token de Ngrok
async function getNgrokToken() {
  if (process.env.NGROK_AUTHTOKEN) return process.env.NGROK_AUTHTOKEN;
  
  const localTokenPath = path.join(__dirname, '.ngrok_token');
  if (fs.existsSync(localTokenPath)) {
    return fs.readFileSync(localTokenPath, 'utf8').trim();
  }

  try {
    const homeDir = require('os').homedir();
    const globalConfigPath = path.join(homeDir, '.ngrok2', 'ngrok.yml');
    if (fs.existsSync(globalConfigPath)) {
      const content = fs.readFileSync(globalConfigPath, 'utf8');
      const match = content.match(/authtoken:\s*([\w-]+)/);
      if (match) return match[1];
    }
  } catch (err) {
    console.log('No se pudo leer la configuración global de ngrok:', err.message);
  }
  
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('Introduce tu ngrok authtoken (https://dashboard.ngrok.com/get-started/your-authtoken): ', (token) => {
      rl.close();
      resolve(token.trim());
    });
  });
}

// Guardar token
function saveNgrokToken(token) {
  const tokenPath = path.join(__dirname, '.ngrok_token');
  try {
    fs.writeFileSync(tokenPath, token);
    console.log('✅ Token de Ngrok guardado para futuras sesiones');
  } catch (err) {
    console.log('⚠️ No se pudo guardar el token:', err.message);
  }
}

// Iniciar sistema
(async () => {
  console.log('🚀 Iniciando servidor...');
  
  // Iniciar servidor en segundo plano
  const serverProcess = exec('node server.js', (err) => {
    if (err) console.error('Error al iniciar servidor:', err);
  });
  
  // Capturar salidas
  serverProcess.stdout.on('data', (data) => console.log(data.toString()));
  serverProcess.stderr.on('data', (data) => console.error(data.toString()));
  
  try {
    // Esperar servidor
    await checkServer(3000);
    console.log('✅ Servidor listo en http://localhost:3000');
    
    // Configurar Ngrok
    const authtoken = await getNgrokToken();
    await ngrok.authtoken(authtoken);
    saveNgrokToken(authtoken);
    
    // Iniciar túnel
    let tunnelUrl = null;
    for (let i = 0; i < 3; i++) {
      try {
        tunnelUrl = await ngrok.connect(3000);
        break;
      } catch (err) {
        console.log(`⚠️ Intento ${i+1}/3 - Error al conectar Ngrok: ${err.message}`);
        await new Promise(res => setTimeout(res, 2000));
      }
    }
    
    if (!tunnelUrl) throw new Error('No se pudo conectar con Ngrok');
    
    console.log('\n🌈 ¡Servidor público listo!');
    console.log('🔗 Comparte este enlace para acceder desde cualquier dispositivo:');
    console.log(`   ${tunnelUrl}/configurator.html`);
    console.log('\n💡 Presiona Ctrl+C para detener el servidor');
    
  } catch (err) {
    console.error('❌ Error crítico:', err.message);
    serverProcess.kill();
    process.exit(1);
  }
})();

// Manejar cierre
process.on('SIGINT', () => {
  console.log('\nApagando servidor...');
  ngrok.kill();
  process.exit();
});