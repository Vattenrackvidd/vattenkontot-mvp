const { createClient } = require('@supabase/supabase-js');

const DEFAULT_SAVE_INTERVAL_MINUTES = Number(process.env.SYDVATTEN_SAVE_INTERVAL_MINUTES || 15);
const FULL_DAY_MIN_COVERAGE_HOURS = Number(process.env.SYDVATTEN_FULL_DAY_MIN_HOURS || 20);
const FULL_DAY_MIN_READINGS = Number(process.env.SYDVATTEN_FULL_DAY_MIN_READINGS || 6);

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  return { url, key, configured: Boolean(url && key) };
}

function getSupabaseClient() {
  const { url, key, configured } = getSupabaseConfig();
  if (!configured) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function hoursBetween(start, end) {
  if (!start || !end) return 0;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, (endMs - startMs) / (1000 * 60 * 60));
}

function average(values) {
  const valid = values.map(Number).filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

async function maybeSaveSydvattenReading(client, sydvatten, { saveIntervalMinutes = DEFAULT_SAVE_INTERVAL_MINUTES } = {}) {
  if (!client || !sydvatten || sydvatten.vomb === null || sydvatten.vomb === undefined) {
    return { saved: false, reason: 'Supabase saknas eller Sydvatten-värde saknas.' };
  }

  const { data: latestRows, error: latestError } = await client
    .from('sydvatten_readings')
    .select('id, created_at, vomb_lps')
    .order('created_at', { ascending: false })
    .limit(1);

  if (latestError) {
    throw new Error(`Kunde inte läsa senaste Supabase-avläsning: ${latestError.message}`);
  }

  const latest = Array.isArray(latestRows) && latestRows.length ? latestRows[0] : null;
  if (latest) {
    const minutesSinceLatest = (Date.now() - new Date(latest.created_at).getTime()) / (1000 * 60);
    const sameValue = Number(latest.vomb_lps) === Number(sydvatten.vomb);

    // Avoid filling the database with identical readings every time someone loads the app.
    if (minutesSinceLatest < saveIntervalMinutes && sameValue) {
      return {
        saved: false,
        reason: `Senaste likadana avläsning är yngre än ${saveIntervalMinutes} minuter.`,
        latestSavedAt: latest.created_at
      };
    }
  }

  const row = {
    source: 'sydvatten',
    vomb_lps: sydvatten.vomb,
    ring_lps: sydvatten.ring,
    raw: {
      sourceUrl: sydvatten.sourceUrl,
      fetchedAt: sydvatten.fetchedAt,
      raw: sydvatten.raw || null
    }
  };

  const { data, error } = await client
    .from('sydvatten_readings')
    .insert(row)
    .select('id, created_at, vomb_lps, ring_lps')
    .single();

  if (error) {
    throw new Error(`Kunde inte spara Sydvatten-avläsning i Supabase: ${error.message}`);
  }

  return { saved: true, row: data };
}

async function getSydvatten24hStats(client) {
  if (!client) {
    return {
      enabled: false,
      status: 'not_configured',
      message: 'Supabase är inte konfigurerat. Appen använder senaste avlästa leverans.'
    };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from('sydvatten_readings')
    .select('created_at, vomb_lps, ring_lps')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Kunde inte läsa 24h-statistik från Supabase: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  const vombValues = rows.map((row) => row.vomb_lps);
  const avgLps = average(vombValues);
  const firstAt = rows.length ? rows[0].created_at : null;
  const lastAt = rows.length ? rows[rows.length - 1].created_at : null;
  const coverageHours = firstAt && lastAt ? hoursBetween(firstAt, lastAt) : 0;
  const hasFullDay = rows.length >= FULL_DAY_MIN_READINGS && coverageHours >= FULL_DAY_MIN_COVERAGE_HOURS;

  return {
    enabled: true,
    status: hasFullDay ? 'ready' : 'collecting',
    readingCount: rows.length,
    average24hLps: avgLps === null ? null : Math.round(avgLps),
    firstReadingAt: firstAt,
    lastReadingAt: lastAt,
    coverageHours: Math.round(coverageHours * 10) / 10,
    hasFullDay,
    minCoverageHours: FULL_DAY_MIN_COVERAGE_HOURS,
    minReadings: FULL_DAY_MIN_READINGS,
    message: hasFullDay
      ? '24-timmarsmedel används som förbrukningstakt.'
      : '24-timmarsmedel samlas in. Appen använder senaste avlästa leverans tills tillräcklig historik finns.'
  };
}

async function recordAndSummarizeSydvatten(sydvatten, options = {}) {
  const client = getSupabaseClient();
  if (!client) {
    return {
      storage: {
        enabled: false,
        status: 'not_configured',
        save: { saved: false, reason: 'Supabase-miljövariabler saknas.' }
      },
      stats24h: await getSydvatten24hStats(null)
    };
  }

  const shouldSave = Boolean(options.shouldSave);
  const save = shouldSave
    ? await maybeSaveSydvattenReading(client, sydvatten)
    : { saved: false, reason: 'Läsläge: avläsningen sparas bara av schemalagd insamling.' };
  const stats24h = await getSydvatten24hStats(client);

  return {
    storage: {
      enabled: true,
      status: 'configured',
      save
    },
    stats24h
  };
}

module.exports = {
  getSupabaseConfig,
  recordAndSummarizeSydvatten,
  getSydvatten24hStats,
  maybeSaveSydvattenReading
};
