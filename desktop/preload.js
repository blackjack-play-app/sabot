// Expose quelques informations à la page (sans accès Node).
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('sabotDesktop', { platform: process.platform, version: process.env.npm_package_version || '1.0.0' });
