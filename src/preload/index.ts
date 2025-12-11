
import { contextBridge, ipcRenderer } from 'electron';

type SignupPayload = { email: string; password: string; displayName?: string };

const api = {
  signup: (payload: SignupPayload) => ipcRenderer.invoke('signup', payload),
  users: {
    list: (query?: string) => ipcRenderer.invoke('users:list', query ?? ''),
  }
};

// Expose only your app API. No external imports → no sandbox runtime errors.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error('[preload] exposeInMainWorld failed:', error);
  }
} else {
  // @ts-ignore
  window.api = api;
}
