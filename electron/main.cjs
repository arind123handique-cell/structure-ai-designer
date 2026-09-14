const { app, BrowserWindow, ipcMain, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');
const { spawn } = require('child_process');

// Optimize Chromium flags for CAD / Three.js 3D performance and hardware VRAM allocation
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('high-dpi-support', '1');

// Register custom privileged scheme before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const http = require('http');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.ico': 'image/x-icon',
};

let localServer = null;

function startLocalServer(distDir, preferredPort = 37854) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        let reqPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        if (reqPath === '/' || !path.extname(reqPath)) {
          reqPath = '/index.html';
        }
        let filePath = path.normalize(path.join(distDir, reqPath));
        if (!filePath.startsWith(distDir) || !fs.existsSync(filePath)) {
          filePath = path.join(distDir, 'index.html');
        }
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(filePath).pipe(res);
      } catch (err) {
        res.writeHead(500);
        res.end('Server error');
      }
    });

    let currentPort = preferredPort;
    function tryListen() {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && currentPort < preferredPort + 20) {
          currentPort++;
          tryListen();
        } else {
          server.listen(0, '127.0.0.1', () => {
            const p = server.address().port;
            console.log(`[Desktop Local Server] Running on fallback port http://localhost:${p}`);
            localServer = server;
            resolve(p);
          });
        }
      });

      server.listen(currentPort, '127.0.0.1', () => {
        console.log(`[Desktop Local Server] Running persistently at http://localhost:${currentPort}`);
        localServer = server;
        resolve(currentPort);
      });
    }

    tryListen();
  });
}

function getDistDir() {
  const localDist = path.resolve(__dirname, '../dist');
  if (fs.existsSync(localDist)) return localDist;
  const resDist = path.resolve(process.resourcesPath || '', 'app/dist');
  if (fs.existsSync(resDist)) return resDist;
  return localDist;
}

function createWindow(serverPort) {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'StructureAI Designer — Native Desktop Edition',
    backgroundColor: '#090d16',
    show: false, // Gracefully wait until rendered
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
    autoHideMenuBar: true,
  });

  // Set clean Chrome User-Agent to avoid Google's disallowed_useragent block
  const originalUa = mainWindow.webContents.getUserAgent();
  const cleanUa = originalUa.replace(/Electron\/\S+\s?/, '');
  mainWindow.webContents.setUserAgent(cleanUa);

  // Allow popup windows (e.g. Firebase Google sign-in)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 500,
        height: 650,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false,
        },
      },
    };
  });

  const showFallback = setTimeout(() => {
    if (!mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 1500);

  mainWindow.once('ready-to-show', () => {
    clearTimeout(showFallback);
    mainWindow.show();
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const msg = typeof event === 'object' && event.message ? event.message : message;
    console.log(`[Renderer]: ${msg}`);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Load Error]: ${errorCode} - ${errorDescription} (${validatedURL})`);
  });

  const distDir = getDistDir();
  const indexHtml = path.join(distDir, 'index.html');
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production' && !fs.existsSync(indexHtml);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else if (serverPort) {
    mainWindow.loadURL(`http://localhost:${serverPort}/index.html`);
  } else {
    mainWindow.loadURL('app://localhost/index.html');
  }
}

function decodeTextBuffer(buffer) {
  if (!buffer || buffer.length === 0) return '';
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf16le');
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf8');
  }
  let nulls = 0;
  const sampleLen = Math.min(buffer.length, 512);
  for (let i = 0; i < sampleLen; i++) {
    if (buffer[i] === 0) nulls++;
  }
  if (nulls > sampleLen * 0.2) {
    return buffer.toString('utf16le');
  }
  return buffer.toString('utf8');
}

// Native Desktop File Open Dialog
ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: options?.filters || [
      { name: 'STAAD & BIM Files', extensions: ['std', 'anl', 'rcdx', 'ifc', 'txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePaths.length) return null;

  const filePath = result.filePaths[0];
  const buffer = fs.readFileSync(filePath);
  return {
    filePath,
    fileName: path.basename(filePath),
    content: decodeTextBuffer(buffer),
    data: buffer,
  };
});

// Read file directly from path (e.g. for drag-and-drop in desktop)
ipcMain.handle('fs:readFile', async (event, filePath) => {
  if (!fs.existsSync(filePath)) throw new Error('File not found: ' + filePath);
  const buffer = fs.readFileSync(filePath);
  return {
    filePath,
    fileName: path.basename(filePath),
    content: decodeTextBuffer(buffer),
    data: buffer,
  };
});

// Native Desktop Local Hard Drive Storage (%APPDATA%\StructureAI Designer\projects\)
function getProjectsDir() {
  const dir = path.join(app.getPath('userData'), 'projects');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

ipcMain.handle('storage:saveProject', async (event, project) => {
  try {
    const dir = getProjectsDir();
    const filePath = path.join(dir, `${project.metadata.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(project), 'utf8');
    return { success: true, path: filePath };
  } catch (err) {
    console.error('[Storage Error] Failed to save project to disk:', err);
    throw err;
  }
});

ipcMain.handle('storage:getProject', async (event, id) => {
  try {
    const dir = getProjectsDir();
    const filePath = path.join(dir, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('[Storage Error] Failed to get project from disk:', err);
    return null;
  }
});

ipcMain.handle('storage:getAllProjects', async () => {
  try {
    const dir = getProjectsDir();
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    const projects = [];
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(dir, file), 'utf8');
        projects.push(JSON.parse(raw));
      } catch (e) {
        console.warn('Failed to parse project file:', file, e);
      }
    }
    return projects;
  } catch (err) {
    console.error('[Storage Error] Failed to get all projects from disk:', err);
    return [];
  }
});

ipcMain.handle('storage:deleteProject', async (event, id) => {
  try {
    const dir = getProjectsDir();
    const filePath = path.join(dir, `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (err) {
    console.error('[Storage Error] Failed to delete project from disk:', err);
    throw err;
  }
});

// Native C++ Solver IPC Handler
ipcMain.handle('solver:nativeSolve', async (event, payload) => {
  return new Promise((resolve, reject) => {
    const solverPath = path.join(__dirname, '../native/build/structure-solver.exe');

    if (!fs.existsSync(solverPath)) {
      return reject(new Error('Native C++ solver binary not found at: ' + solverPath));
    }

    const child = spawn(solverPath, ['--json']);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });

    child.on('close', (code) => {
      if (code === 0) {
        try {
          const parsed = JSON.parse(stdout);
          resolve(parsed);
        } catch (e) {
          resolve({ success: true, message: stdout });
        }
      } else {
        reject(new Error(`Native solver exited with code ${code}: ${stderr}`));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
});

app.whenReady().then(() => {
  // Set up custom privileged protocol to serve production dist files cleanly
  protocol.handle('app', (request) => {
    try {
      const parsedUrl = new URL(request.url);
      let pathname = decodeURIComponent(parsedUrl.pathname);
      if (pathname.startsWith('/')) {
        pathname = pathname.substring(1);
      }
      if (!pathname || pathname === '') {
        pathname = 'index.html';
      }
      const distDir = getDistDir();
      let targetFile = path.resolve(distDir, pathname);

      if (!targetFile.startsWith(distDir)) {
        return new Response('Access denied', { status: 403 });
      }

      if (!fs.existsSync(targetFile)) {
        targetFile = path.resolve(distDir, 'index.html');
      }

      return net.fetch(url.pathToFileURL(targetFile).toString());
    } catch (err) {
      console.error('[Protocol Error]:', err);
      return new Response('Internal error', { status: 500 });
    }
  });

  const distDir = getDistDir();
  startLocalServer(distDir).then((serverPort) => {
    createWindow(serverPort);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  if (localServer) {
    try { localServer.close(); } catch (e) {}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

