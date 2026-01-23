# RipForge Community Disc Database

A shared database of disc fingerprints for automatic identification of cryptic disc labels.

## How It Works

Many DVDs and Blu-rays have meaningless labels like `SC30NNW1` instead of `SANTA_CLAUSE_3`. This database maps those cryptic labels to actual movie titles, so RipForge can auto-identify them.

## Opt-In Model

**If you use it, you contribute. No freeloading.**

- Enable community DB in RipForge settings
- Your manual identifications are automatically shared
- You get access to everyone else's identifications

## Data Format

```json
{
  "disc_label": "SC30NNW1",
  "disc_type": "dvd",
  "duration_secs": 5501,
  "track_count": 12,
  "title": "The Santa Clause 3: The Escape Clause",
  "year": 2006,
  "tmdb_id": 10431,
  "contributed_at": "2026-01-23T14:23:13Z"
}
```

## Privacy

Only shares:
- Disc label, type, duration, track count
- Resolved title, year, TMDB ID
- Contribution timestamp

Does NOT share:
- File paths
- Usernames or IP addresses
- Any personal data

## API

The database is accessed via a simple API:

- `GET /db` - Full database
- `GET /lookup?label=X&duration=Y` - Look up a disc
- `POST /contribute` - Submit a new mapping

## Files

- `disc_database.jsonl` - The community database (JSONL format)
- `worker/` - Cloudflare Worker API source

## Contributing

Contributions happen automatically when you use RipForge with community DB enabled. Manual PRs are also welcome for bulk imports or corrections.

## License

Public domain (CC0) - this data is meant to be freely shared.
