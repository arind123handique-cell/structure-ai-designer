const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__STRUCTURE_AI_DESKTOP__', {
  isDesktop: true,
  platform: process.platform,
  openFileDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  solveNative: (payload) => ipcRenderer.invoke('solver:nativeSolve', payload),
  saveProjectNative: (project) => ipcRenderer.invoke('storage:saveProject', project),
  getProjectNative: (id) => ipcRenderer.invoke('storage:getProject', id),
  getAllProjectsNative: () => ipcRenderer.invoke('storage:getAllProjects'),
  deleteProjectNative: (id) => ipcRenderer.invoke('storage:deleteProject', id),
});

