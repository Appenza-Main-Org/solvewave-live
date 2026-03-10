/**
 * Structured console logging for SolveWave.
 * All logs are prefixed with [SolveWave][<module>] for easy grep in DevTools.
 */

const P = "[SolveWave]";

export const log = {
  session: (msg: string, ...args: unknown[]) =>
    console.log(`${P}[session] ${msg}`, ...args),

  ws: (msg: string, ...args: unknown[]) =>
    console.log(`${P}[ws] ${msg}`, ...args),

  image: (msg: string, ...args: unknown[]) =>
    console.log(`${P}[image] ${msg}`, ...args),

  transcript: (msg: string, ...args: unknown[]) =>
    console.log(`${P}[transcript] ${msg}`, ...args),

  mode: (msg: string, ...args: unknown[]) =>
    console.log(`${P}[mode] ${msg}`, ...args),

  voice: (msg: string, ...args: unknown[]) =>
    console.log(`${P}[voice] ${msg}`, ...args),

  state: (msg: string, ...args: unknown[]) =>
    console.log(`${P}[state] ${msg}`, ...args),

  error: (msg: string, ...args: unknown[]) =>
    console.error(`${P}[error] ${msg}`, ...args),
};
