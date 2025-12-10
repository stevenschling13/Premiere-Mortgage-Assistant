
if (typeof window !== 'undefined') {
  const win = window as any;
  
  // Ensure process object exists
  if (!win.process) {
    win.process = {
      env: {},
      version: '',
      nextTick: (cb: Function) => setTimeout(cb, 0)
    };
  }
  
  // Ensure env object exists
  if (!win.process.env) {
    win.process.env = {};
  }

  // CRITICAL INTEGRATION BRIDGE:
  // Map Vite's import.meta.env to process.env for Google GenAI SDK compatibility.
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const env = import.meta.env as any;

      // Map API_KEY
      if (env.API_KEY) {
        win.process.env.API_KEY = env.API_KEY;
      } else if (env.VITE_API_KEY) {
        win.process.env.API_KEY = env.VITE_API_KEY;
      }
      
      // Pass through other env vars
      Object.keys(env).forEach(key => {
        if (typeof key === 'string' && (key.startsWith('VITE_') || key === 'MODE' || key === 'DEV' || key === 'PROD')) {
           win.process.env[key] = env[key];
        }
      });
    }
  } catch (e) {
    console.warn("Polyfill: import.meta.env bridge failed", e);
  }
}

export {};
