/**
 * RipForge Community Disc Database API
 * Cloudflare Worker
 *
 * Endpoints:
 * - GET /db - Returns full database
 * - GET /lookup?label=X&duration=Y - Look up a specific disc
 * - POST /contribute - Submit a new disc mapping
 */

const GITHUB_REPO = 'paul-tastic/ripforge-disc-db';
const DB_FILE = 'disc_database.jsonl';
const RAW_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${DB_FILE}`;

// CORS headers for browser access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // GET /db - Return full database
      if (path === '/db' && request.method === 'GET') {
        return await getDatabase();
      }

      // GET /lookup - Look up a specific disc
      if (path === '/lookup' && request.method === 'GET') {
        const label = url.searchParams.get('label');
        const duration = parseInt(url.searchParams.get('duration') || '0');
        return await lookupDisc(label, duration);
      }

      // POST /contribute - Submit a new mapping
      if (path === '/contribute' && request.method === 'POST') {
        const data = await request.json();
        return await contributeDisc(data, env);
      }

      // GET / - API info
      if (path === '/' || path === '') {
        return jsonResponse({
          name: 'RipForge Community Disc Database API',
          endpoints: {
            'GET /db': 'Get full database',
            'GET /lookup?label=X&duration=Y': 'Look up a disc',
            'POST /contribute': 'Submit a new disc mapping'
          },
          repo: `https://github.com/${GITHUB_REPO}`
        });
      }

      return jsonResponse({ error: 'Not found' }, 404);

    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  }
};

async function getDatabase() {
  const response = await fetch(RAW_URL, {
    headers: { 'User-Agent': 'RipForge-DiscDB-Worker' }
  });

  if (!response.ok) {
    return jsonResponse({ error: 'Failed to fetch database' }, 500);
  }

  const text = await response.text();
  const entries = text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));

  return jsonResponse({
    count: entries.length,
    entries: entries
  });
}

async function lookupDisc(label, duration) {
  if (!label) {
    return jsonResponse({ error: 'Missing label parameter' }, 400);
  }

  const response = await fetch(RAW_URL, {
    headers: { 'User-Agent': 'RipForge-DiscDB-Worker' }
  });

  if (!response.ok) {
    return jsonResponse({ error: 'Failed to fetch database' }, 500);
  }

  const text = await response.text();
  const entries = text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));

  // Exact label match
  let match = entries.find(e => e.disc_label === label);

  // If no exact match and duration provided, try fuzzy match (within 5%)
  if (!match && duration > 0) {
    const tolerance = duration * 0.05;
    match = entries.find(e =>
      Math.abs(e.duration_secs - duration) <= tolerance &&
      e.disc_type === 'dvd' // Only fuzzy match same type
    );
  }

  if (match) {
    return jsonResponse({ found: true, entry: match });
  }

  return jsonResponse({ found: false, label, duration });
}

async function contributeDisc(data, env) {
  // Validate required fields
  const required = ['disc_label', 'disc_type', 'duration_secs', 'title'];
  for (const field of required) {
    if (!data[field]) {
      return jsonResponse({ error: `Missing required field: ${field}` }, 400);
    }
  }

  // Check for GitHub token
  if (!env.GITHUB_TOKEN) {
    return jsonResponse({ error: 'Server not configured for contributions' }, 500);
  }

  // Prepare the entry
  const entry = {
    disc_label: data.disc_label,
    disc_type: data.disc_type,
    duration_secs: data.duration_secs,
    track_count: data.track_count || 0,
    title: data.title,
    year: data.year || null,
    tmdb_id: data.tmdb_id || null,
    contributed_at: new Date().toISOString()
  };

  // Get current file content
  const fileResponse = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${DB_FILE}`,
    {
      headers: {
        'Authorization': `token ${env.GITHUB_TOKEN}`,
        'User-Agent': 'RipForge-DiscDB-Worker',
        'Accept': 'application/vnd.github.v3+json'
      }
    }
  );

  if (!fileResponse.ok) {
    return jsonResponse({ error: 'Failed to fetch current database' }, 500);
  }

  const fileData = await fileResponse.json();
  const currentContent = atob(fileData.content.replace(/\n/g, ''));

  // Check for duplicates
  const existingEntries = currentContent.trim().split('\n').filter(Boolean);
  const isDuplicate = existingEntries.some(line => {
    try {
      const existing = JSON.parse(line);
      return existing.disc_label === entry.disc_label;
    } catch {
      return false;
    }
  });

  if (isDuplicate) {
    return jsonResponse({ success: true, message: 'Entry already exists', duplicate: true });
  }

  // Append new entry
  const newContent = currentContent.trim() + '\n' + JSON.stringify(entry) + '\n';

  // Commit to GitHub
  const updateResponse = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${DB_FILE}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `token ${env.GITHUB_TOKEN}`,
        'User-Agent': 'RipForge-DiscDB-Worker',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Add disc: ${entry.disc_label} -> ${entry.title}`,
        content: btoa(newContent),
        sha: fileData.sha
      })
    }
  );

  if (!updateResponse.ok) {
    const err = await updateResponse.text();
    return jsonResponse({ error: 'Failed to commit contribution', details: err }, 500);
  }

  return jsonResponse({
    success: true,
    message: 'Contribution added',
    entry: entry
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}
