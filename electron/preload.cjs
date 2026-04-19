/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("aesirDesktop", {
  platform: process.platform,
});

window.addEventListener("DOMContentLoaded", () => {
  document.documentElement.dataset.shell = "desktop";
});
