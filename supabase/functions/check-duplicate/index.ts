// ═══════════════════════════════════════════════════════════════════════════
// Supabase Edge Function: check-duplicate (multilingual embedding + grouping)
//
// Flow (Option B — grouped complaints):
//   1. The original complaint text is embedded in its submitted language.
//   2. pgvector finds a similar ACTIVE complaint in the same category.
//   3a. Match  → the new complaint is STILL saved (each resident keeps their own
//       row) but inherits the matched complaint's group_id. Returns the group +
//       headcount so the app can show the "already reported" screen.
//   3b. No match → saved as a new group (group_id = its own id).
//
// Deploy with the Supabase CLI from the repository root so the shared account
// session module is bundled. Configure GEMINI_API_KEY and run the required SQL
// migrations documented in README.md before accepting submissions.
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  consumeDailyReportSlot,
  findApprovedAccount,
  releaseDailyReportSlot,
} from '../_shared/account-session.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const EMBED_MODEL = 'gemini-embedding-001';
const EMBED_DIMS = 768;
const SIMILARITY_THRESHOLD = 0.75;
const GEMINI_MAX_ATTEMPTS = 3;

class DuplicateReporterError extends Error {}

function normalizeComparableText(value: unknown): string {
  return String(value ?? '').toLocaleLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '');
}

async function fetchGemini(url: string, init: RequestInit, operation: string): Promise<Response> {
  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      if (attempt === GEMINI_MAX_ATTEMPTS) throw error;
      console.warn(`[check-duplicate] ${operation} request failed; retrying (${attempt}/${GEMINI_MAX_ATTEMPTS - 1}).`);
      await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** (attempt - 1)));
      continue;
    }

    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === GEMINI_MAX_ATTEMPTS) {
      return response;
    }

    const retryAfter = Number(response.headers.get('Retry-After'));
    const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 5000)
      : 750 * 2 ** (attempt - 1);
    console.warn(
      `[check-duplicate] ${operation} returned ${response.status}; retrying (${attempt}/${GEMINI_MAX_ATTEMPTS - 1}).`,
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`${operation} request failed after retries.`);
}

const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function corsHeadersFor(origin?: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'http://localhost:8081';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-account-session, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

// ─── Gemini: embed text (768 dims, normalized) ───────────────────────────────
async function getEmbedding(text: string): Promise<number[]> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`;
  const res = await fetchGemini(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] },
      outputDimensionality: EMBED_DIMS,
    }),
  }, 'Gemini embedding');
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
  const cors = corsHeadersFor(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  let reservedAccountId: string | null = null;
  let reservedReportId: string | null = null;
  let insertedReportId: string | null = null;
  try {
    if (!GEMINI_API_KEY?.trim()) {
      console.error('[check-duplicate] GEMINI_API_KEY is not configured.');
      return new Response(JSON.stringify({
        error: 'Report submission is unavailable because the server is missing its Gemini API key. Contact the administrator.',
      }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const complaint = await req.json();
    const { title, description, category, location } = complaint;

    if (complaint.reportType === 'Summon' || complaint.priority === 'Summon') {
      return new Response(JSON.stringify({ error: 'Summons must be submitted through the summons table.' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!complaint.id || !title || !description || !category) {
      return new Response(JSON.stringify({ error: 'id, title, description and category are required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const account = await findApprovedAccount(req);
    if (!account) {
      return new Response(JSON.stringify({ error: 'Sign in with an approved account to submit a report.' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const isAnonymousReport = account.role === 'resident'
      && (complaint.isAnonymous === true || complaint.reportedBy === 'Anonymous');

    if (account.role === 'resident') {
      const { data: identities, error: identitiesError } = await supabase
        .from('complaint_reporter_identities')
        .select('report_id')
        .eq('account_id', account.id);
      if (identitiesError) throw identitiesError;

      const priorReportIds = (identities ?? []).map((identity) => identity.report_id);
      if (priorReportIds.length > 0) {
        const { data: priorReports, error: priorReportsError } = await supabase
          .from('complaints')
          .select('id, title, category, description, location, status')
          .in('id', priorReportIds);
        if (priorReportsError) throw priorReportsError;

        const categoryKey = normalizeComparableText(category);
        const locationKey = normalizeComparableText(location);
        const descriptionKey = normalizeComparableText(description);
        const exactPreviousReport = (priorReports ?? []).find((prior) => (
          !['Resolved', 'Rejected'].includes(prior.status)
          && normalizeComparableText(prior.category) === categoryKey
          && normalizeComparableText(prior.location) === locationKey
          && normalizeComparableText(prior.description) === descriptionKey
        ));

        if (exactPreviousReport) {
          return new Response(JSON.stringify({
            error: 'You have already reported this issue. You can track its status in My Reports.',
            code: 'REPORT_ALREADY_FILED',
            reportId: exactPreviousReport.id,
          }), {
            status: 409,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    let dailyUsage: { used: number; remaining: number; reset_at: string } | undefined;
    if (account.role === 'resident') {
      const slot = await consumeDailyReportSlot(account.id, String(complaint.id ?? ''));
      if (!slot) throw new Error('Daily report counter returned no result.');
      if (!slot.allowed) {
        return new Response(JSON.stringify({
          error: 'You have reached the limit of 3 reports for today.',
          code: 'DAILY_REPORT_LIMIT',
          used: slot.used,
          remaining: slot.remaining,
          resetAt: slot.reset_at,
        }), {
          status: 429,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
      reservedAccountId = account.id;
      reservedReportId = String(complaint.id);
      dailyUsage = { used: slot.used, remaining: slot.remaining, reset_at: slot.reset_at };
    }

    // Embed the submitted text directly so reports stay in their original language.
    const embeddingText = [
      `Category: ${category}`,
      `Location: ${location ?? ''}`,
      `Title: ${title}`,
      `Description: ${description}`,
    ].join('\n');
    const embedding = await getEmbedding(embeddingText);

    // 2. Find a similar active complaint in the same category and purok/location
    const { data: matches, error: matchErr } = await supabase.rpc('match_complaints', {
      query_embedding: embedding,
      match_category: category,
      match_location: location ?? null,
      match_threshold: SIMILARITY_THRESHOLD,
      match_count: 1,
    });
    if (matchErr) throw matchErr;

    const matched = matches && matches.length > 0 ? matches[0] : null;

    // The group this complaint belongs to: the match's group, or its own id.
    // (match_complaints returns group_id when available; fall back to matched id.)
    const groupId = matched ? (matched.group_id ?? matched.id) : complaint.id;

    if (account.role === 'resident' && matched) {
      const { data: existingClaim, error: claimLookupError } = await supabase
        .from('complaint_reporter_group_claims')
        .select('report_id')
        .eq('account_id', account.id)
        .eq('group_id', groupId)
        .maybeSingle();
      if (claimLookupError) throw claimLookupError;
      if (existingClaim) {
        if (reservedAccountId && reservedReportId) {
          await releaseDailyReportSlot(reservedAccountId, reservedReportId);
          reservedAccountId = null;
          reservedReportId = null;
        }
        return new Response(JSON.stringify({
          error: 'You have already reported this issue. You can track its status in My Reports.',
          code: 'REPORT_ALREADY_FILED',
        }), {
          status: 409,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
    }

    // 3. Insert one complaint for each distinct resident report.
    const row = {
      id: complaint.id,
      title: complaint.title,
      category: complaint.category,
      description: complaint.description,
      group_id: groupId,
      location: complaint.location ?? null,
      date: complaint.date ?? null,
      status: complaint.status ?? 'Pending',
      priority: complaint.priority ?? 'Normal',
      reported_by: account.role === 'resident'
        ? (isAnonymousReport ? 'Anonymous' : account.name)
        : complaint.reportedBy ?? null,
      assignee: complaint.assignee ?? 'Unassigned',
      evidence_photo: complaint.evidencePhoto ?? null,
      timeline: complaint.timeline ?? [],
      embedding,
    };
    const { error: insertErr } = await supabase.from('complaints').insert(row);
    if (insertErr) throw insertErr;
    insertedReportId = String(complaint.id);
    if (account.role === 'resident') {
      const { error: identityErr } = await supabase
        .from('complaint_reporter_identities')
        .insert({ report_id: String(complaint.id), account_id: account.id });
      if (identityErr) throw identityErr;

      const { error: claimError } = await supabase
        .from('complaint_reporter_group_claims')
        .insert({ account_id: account.id, group_id: groupId, report_id: String(complaint.id) });
      if (claimError?.code === '23505') {
        throw new DuplicateReporterError('You have already reported this issue. You can track its status in My Reports.');
      }
      if (claimError) throw claimError;
    }

    if (matched) {
      // 4a. Count distinct residents, not complaint rows.
      const { data: totalReporters, error: countErr } = await supabase.rpc(
        'count_unique_complaint_reporters',
        { p_group_id: groupId },
      );
      if (countErr) throw countErr;

      insertedReportId = null;
      reservedAccountId = null;
      reservedReportId = null;
      return new Response(
        JSON.stringify({
          isDuplicate: true,
          groupId,
          existingComplaint: matched,
          totalReporters,
          similarity: matched.similarity,
          dailyUsage,
        }),
        { headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    // 4b. New unique issue
    insertedReportId = null;
    reservedAccountId = null;
    reservedReportId = null;
    return new Response(JSON.stringify({ isDuplicate: false, groupId, dailyUsage }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (insertedReportId) {
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      const { error: cleanupErr } = await supabase
        .from('complaints')
        .delete()
        .eq('id', insertedReportId);
      if (cleanupErr) {
        console.error('[check-duplicate] failed to remove report after submission failure:', cleanupErr);
      }
    }
    if (reservedAccountId && reservedReportId) {
      try {
        await releaseDailyReportSlot(reservedAccountId, reservedReportId);
      } catch (releaseError) {
        console.error('[check-duplicate] failed to release report quota:', releaseError);
      }
    }
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: e instanceof DuplicateReporterError ? 409 : 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
