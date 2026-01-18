import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables (set these in your Next.js environment)
// NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if environment variables are set
const hasEnvVars = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasEnvVars) {
  console.error(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Missing Supabase Environment Variables!

Please create a .env.local file with:

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_LIFF_ID=your-liff-id-here

📝 See .env.local.example for template
📚 See SETUP.md for detailed instructions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
}

// Create a mock client for development without credentials
// This prevents build errors but will show warnings at runtime
const createMockClient = (): SupabaseClient => {
  const mockClient = {
    from: () => ({
      select: () => Promise.resolve({ data: [], error: new Error('Supabase not configured') }),
      insert: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      update: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      delete: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
    }),
    rpc: () => Promise.resolve({ data: [], error: new Error('Supabase not configured. Please set environment variables.') }),
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      subscribe: () => {},
      unsubscribe: () => {},
    }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
  } as any;
  
  return mockClient;
};

export const supabase = hasEnvVars
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : createMockClient();

export default supabase;
