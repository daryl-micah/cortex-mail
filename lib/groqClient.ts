import Groq from 'groq-sdk';

// The Groq constructor throws when GROQ_API_KEY is missing. Called at module
// scope that takes down whichever route imported it, with a 500 that says
// nothing about the cause — so every caller shares this lazy accessor instead.
let client: Groq | null = null;

export function getGroq(): Groq {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set');
  }
  client ??= new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client;
}

/** Whether any Groq-backed feature can run. False means the key is missing. */
export function isGroqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}
