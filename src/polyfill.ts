if (typeof window !== 'undefined') {
  const w = window as any;
  if (!w.process) {
    w.process = { env: {} };
  } else if (!w.process.env) {
    w.process.env = {};
  }
}

export {};