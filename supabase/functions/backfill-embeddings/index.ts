// ═══════════════════════════════════════════════════════════════════════════
// Supabase Edge Function: backfill-embeddings (embeddings + grouping)
//
// One-time (re-runnable) job that, for every complaint missing an embedding:
//   1. Embeds the original report text (768 dims, normalized).
//   2. Clusters it: if it's similar to an already-processed complaint in the
//      same category, it inherits that complaint's group_id; otherwise it
//      starts a new group (group_id = its own id).
//
// Deploy (dashboard): Edge Functions → backfill-embeddings → paste → Deploy.
// Then invoke it once. Safe to re-run — only touches rows without an embedding.
//
// Secret needed: GEMINI_API_KEY  (https://aistudio.google.com/app/apikey)
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const EMBED_MODEL = 'gemini-embedding-001';
const EMBED_DIMS = 768;
const SIMILARITY_THRESHOLD = 0.75;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function getEmbedding(text: string): Promise<number[]> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: EMBED_DIMS,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini embeddings error: ${res.status} ${err}`);
  }
  const json = await res.json();
  return normalize(json.embedding.values as number[]);
}

function normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const mag = Math.sqrt(sum) || 1;
  return v.map((x) => x / mag);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: rows, error } = await supabase
      .from('complaints')
      .select('id, title, category, description, location, status')
      .is('embedding', null);
    if (error) throw error;

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ done: true, updated: 0, message: 'All complaints already have embeddings.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let updated = 0;
    let grouped = 0;

    for (const r of rows) {
      // 1. Embed the original report text without translating it.
      const embeddingText = [
        `Category: ${r.category || ''}`,
        `Location: ${r.location || ''}`,
        `Title: ${r.title || ''}`,
        `Description: ${r.description || ''}`,
      ].join('\n');
      const embedding = await getEmbedding(embeddingText);

      // 2. Try to cluster against embedded complaints in the same category and location.
      //    (Only complaints processed earlier in this run, or previously, will match.)
      let groupId = r.id; // default: its own new group
      const { data: matches } = await supabase.rpc('match_complaints', {
        query_embedding: embedding,
        match_category: r.category,
        match_location: r.location ?? null,
        match_threshold: SIMILARITY_THRESHOLD,
        match_count: 1,
      });
      if (matches && matches.length > 0) {
        const m = matches[0];
        // Don't match itself (shouldn't happen since it's still null, but be safe)
        if (m.id !== r.id) {
          groupId = m.group_id ?? m.id;
          grouped += 1;
        }
      }

      // 3. Write the embedding and group id.
      await supabase
        .from('complaints')
        .update({ embedding, group_id: groupId })
        .eq('id', r.id);
      updated += 1;
    }

    return new Response(
      JSON.stringify({
        done: true,
        updated,
        grouped,
        message: `Processed ${updated} complaint(s); ${grouped} merged into existing groups.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
