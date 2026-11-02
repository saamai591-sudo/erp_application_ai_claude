const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pos", {
  getConfig: () => ipcRenderer.invoke("setup:get"),
  probe: (appUrl) => ipcRenderer.invoke("setup:probe", appUrl),
  save: (cfg) => ipcRenderer.invoke("setup:save", cfg),
  done: () => ipcRenderer.invoke("setup:done"),
});
