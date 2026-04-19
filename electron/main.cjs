/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, dialog, utilityProcess } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");

let mainWindow = null;
let serverProcess = null;
let serverUrl = null;
let appIsQuitting = false;

const DEFAULT_WINDOW_STATE = {
  width: 1480,
  height: 980,
  minWidth: 1180,
  minHeight: 760,
};

app.setName("Aesir OSS");

function getWindowStatePath() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function readWindowState() {
  try {
    const raw = fs.readFileSync(getWindowStatePath(), "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_WINDOW_STATE,
      ...parsed,
    };
  } catch {
    return DEFAULT_WINDOW_STATE;
  }
}

function writeWindowState(window) {
  if (!window || window.isDestroyed()) {
    return;
  }

  const bounds = window.getBounds();
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(
    getWindowStatePath(),
    JSON.stringify({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
    }),
  );
}

function getServerEntryPath() {
  return path.join(app.getAppPath(), "dist-electron", "server", "server.js");
}

function getPreloadPath() {
  return path.join(__dirname, "preload.cjs");
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to acquire Aesir port")));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

async function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        headers: {
          "x-aesir-shell": "desktop",
        },
      });

      if (response.ok) {
        return;
      }
    } catch {
      // server still booting
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error("Timed out waiting for embedded Aesir server");
}

async function ensureServer() {
  if (serverProcess && serverUrl) {
    return serverUrl;
  }

  const entryPath = getServerEntryPath();

  if (!fs.existsSync(entryPath)) {
    throw new Error(
      "Missing desktop server bundle. Run `npm run build:desktop` first.",
    );
  }

  const port = await getFreePort();
  const url = `http://127.0.0.1:${port}`;
  const serverEnv = {
    ...process.env,
    AESIR_DATA_DIR: app.getPath("userData"),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    PORT: String(port),
  };

  serverProcess = utilityProcess.fork(entryPath, [], {
    cwd: app.getPath("userData"),
    env: serverEnv,
    serviceName: "Aesir OSS Server",
    stdio: "pipe",
  });

  serverProcess.stdout?.on("data", (chunk) => {
    process.stdout.write(`[aesir-server] ${chunk}`);
  });

  serverProcess.stderr?.on("data", (chunk) => {
    process.stderr.write(`[aesir-server] ${chunk}`);
  });

  serverProcess.once("exit", (code) => {
    serverProcess = null;
    serverUrl = null;

    if (!appIsQuitting) {
      void dialog.showErrorBox(
        "Aesir server stopped",
        `The embedded Aesir server exited unexpectedly${
          typeof code === "number" ? ` (code ${code})` : ""
        }.`,
      );
    }
  });

  await waitForServer(url);
  serverUrl = url;
  return url;
}

async function createWindow() {
  const state = readWindowState();
  const targetUrl = await ensureServer();

  mainWindow = new BrowserWindow({
    ...DEFAULT_WINDOW_STATE,
    ...state,
    autoHideMenuBar: true,
    backgroundColor: "#05070a",
    show: false,
    title: "Aesir OSS",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition:
      process.platform === "darwin" ? { x: 16, y: 10 } : undefined,
    webPreferences: {
      contextIsolation: true,
      preload: getPreloadPath(),
      sandbox: false,
    },
  });

  mainWindow.on("close", () => writeWindowState(mainWindow));
  mainWindow.on("resize", () => writeWindowState(mainWindow));
  mainWindow.on("move", () => writeWindowState(mainWindow));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(targetUrl);
  mainWindow.show();
}

async function shutdownServer() {
  if (!serverProcess) {
    return;
  }

  const processToStop = serverProcess;
  serverProcess = null;
  serverUrl = null;

  processToStop.kill();
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) {
      void createWindow();
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    await createWindow();

    app.on("activate", () => {
      if (!BrowserWindow.getAllWindows().length) {
        void createWindow();
      }
    });
  });
}

app.on("before-quit", () => {
  appIsQuitting = true;
});

app.on("window-all-closed", () => {
  void shutdownServer().finally(() => app.quit());
});

app.on("will-quit", () => {
  void shutdownServer();
});
