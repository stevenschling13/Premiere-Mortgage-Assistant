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
  
  // CRITICAL INTEGRATION BRIDGE:
  // Map Vite's import.meta.env to process.env dynamically using a Proxy.
  // This ensures that if the API key is injected or updated at runtime (e.g. via AISTUDIO),
  // process.env.API_KEY reflects the latest value immediately.
  try {
    const existingEnv = win.process.env || {};
    
    win.process.env = new Proxy(existingEnv, {
      get: (target, prop) => {
        // Priority 1: Existing value in target
        if (prop in target) return target[prop];
        
        // Priority 2: import.meta.env (Vite)
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            const metaEnv = import.meta.env as any;
            if (prop === 'API_KEY') {
                return metaEnv.API_KEY || metaEnv.VITE_API_KEY;
            }
            return metaEnv[prop as string];
        }
        
        return undefined;
      }
    });

  } catch (e) {
    console.warn("Polyfill: import.meta.env bridge failed", e);
  }
}

export {};