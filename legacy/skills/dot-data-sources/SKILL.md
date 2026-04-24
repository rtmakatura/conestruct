# DOT Data Sources

## TxDOT Plans Online

### Access

Public FTP server with Apache directory listings. No authentication
required (there is a click-through license agreement page at
`https://www.dot.state.tx.us/business/plansonline/agreement.htm` but
the FTP server itself is unauthenticated).

- **Base URL:** `https://ftp.dot.state.tx.us/pub/txdot-info/Pre-Letting%20Responses/`
- **robots.txt:** None (404)
- **TLS:** Server has certificate issues; requires `verify=False`
- **License:** Free for download. Redistribution/resale requires
  written consent from TxDOT (`plansol@txdot.gov`)

### Directory structure

The FTP site is organized by district. **Structure varies by district:**

**Pattern A** — Most districts (Houston, Dallas, Beaumont, San Antonio, etc.):
```
{District}/
  Construction Projects/
    {Year}/                         # e.g., 2025/, 2026/
      {MM Month YYYY}/              # e.g., "06 June 2025", "04 April 2026"
        {Project Folder}/           # e.g., "0426 SH 99 3510-05-047ETC"
          *.pdf
  Maintenance Projects/
    ...
  Early Plan Review/
    ...
```

**Pattern B** — Some districts (Austin):
```
{District}/
  {Month YYYY}/                     # e.g., "April 2026", "February 2026"
    *.pdf                           # PDFs directly in letting month folder
  Preliminary Plans (NOT FOR BID)/
    ...
```

### Districts on the FTP server

Last checked: 2026-04-18. Recently active districts (2025–2026 content):

| District | Last Modified | Structure |
|---|---|---|
| Austin | 2026-03 | Pattern B |
| Beaumont | 2026-01 | Pattern A |
| Bryan | 2024-10 | — |
| Dallas | 2024-04 | Pattern A |
| El Paso | 2025-08 | Custom (Consultants/, Contractor Plan Review/) |
| Fort Worth | 2024-02 | Pattern A |
| Houston | 2025-10 | Pattern A |
| Lufkin | 2025-11 | — |
| Maritime Division | 2026-02 | — |
| San Antonio | 2025-07 | Pattern A |
| Tyler | 2025-08 | — |

Older/inactive districts (pre-2024): Abilene, Amarillo, Atlanta,
Brownwood, Childress, Corpus Christi, Laredo, Lubbock, Odessa, Paris,
Pharr, San Angelo, Waco, Wichita Falls, Yoakum.

### Naming conventions

**Project folders:** `{MMYY} {Route} {CSJ}ETC`
- MMYY = letting month/year
- Route = highway designation (SH 99, FM 487, IH 35, etc.)
- CSJ = Control-Section-Job number (`\d{4}-\d{2}-\d{3}`), TxDOT's
  unique project identifier

**PDF filenames:** Inconsistent across districts and projects. Examples:
```
047,Etc._CS_FINAL_3-13-26.pdf
047,Etc._CS_FINAL_3-13-26_UNLOCKED.pdf
0683-05-017 CTSCHEDULE.pdf
0683-05-017 FM 487 FINAL CROSS SECTIONS.pdf
CSJ 0367-06-065 Galveston 100% Plans.pdf
CTD.pdf
```

Some projects include both locked and `_UNLOCKED` versions. File sizes
range from ~500 KB (schedules) to 150+ MB (full plan sets with cross
sections).

### TCP sheet naming in TxDOT plans

TxDOT uses these conventions for traffic control plan sheets within a
plan set:

- **Sheet labels:** `TC-1`, `TC-2`, ... or `TCP-1`, `TCP-2`, ...
- **Title block text:** "TRAFFIC CONTROL PLAN", "TRAFFIC CONTROL",
  or abbreviated as "TCP"
- **Work zone sheets:** `WZ-01`, `WZ-02`, ... (used alongside or
  instead of TC/TCP in some districts)
- **Barricade configuration:** `BC-1`, `BC(1)`, etc.
- **MOT:** "MAINTENANCE OF TRAFFIC" — alternate name used in some
  projects

Regex for detection (used in `src/scraping/txdot.py` and
`skills/civil-pdf-parsing/SKILL.md`):

```python
TCP_PATTERNS = [
    r"\bTCP?\b",                   # TC or TCP
    r"TRAFFIC\s+CONTROL",
    r"\bMOT\b",
    r"WZ-\d+",
    r"BC(\(\d+\))?",
]
```

### Scraper notes

- 2-second delay between requests
- Resumable via SQLite tracking DB at `data/raw/txdot/scraper.db`
- Downloads saved to `data/raw/txdot/{letting_date}/{project_id}/`
- CSV manifest at `data/raw/txdot/manifest.csv`
- Use `--max-projects` and `--max-gb` to cap downloads

---

## WSDOT (Washington State DOT)

> TODO: Research and fill in.

Stub fields to investigate:

- [ ] Public plan access URL
- [ ] Directory/API structure
- [ ] Project ID format
- [ ] TCP sheet naming conventions
- [ ] Robots.txt / rate limit policy
- [ ] License/terms for data use

---

## Ohio DOT (ODOT)

> TODO: Research and fill in.

Stub fields to investigate:

- [ ] Public plan access URL
- [ ] Directory/API structure
- [ ] Project ID format (PID?)
- [ ] TCP sheet naming conventions
- [ ] Robots.txt / rate limit policy
- [ ] License/terms for data use
