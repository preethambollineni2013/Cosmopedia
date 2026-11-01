const topicHints = {
  planet: "planet",
  moon: "moon",
  star: "star",
  galaxy: "astronomy",
  spacecraft: "spacecraft",
  mission: "space mission",
  small: "astronomy",
  agency: "space agency",
  astronaut: "astronaut",
  phenomenon: "astronomy"
};

const agencies = [
  { name: "NASA", pattern: /\bnasa\b|national aeronautics/i, site: "nasa.gov" },
  { name: "ESA", pattern: /\besa\b|european space agency/i, site: "esa.int" },
  { name: "ISRO", pattern: /\bisro\b|indian space research/i, site: "isro.gov.in" },
  { name: "Roscosmos", pattern: /roscosmos|russian federal space/i, site: "roscosmos.ru" }
];

// Maximum number of results we ever collect for one query.
const MAX_RESULTS = 1000;

const WIKI_API =
  "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*" +
  "&prop=pageprops&ppprop=disambiguation%7Cwikibase-shortdesc";

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Request failed");
  }
  return response.json();
}

/* ---------- Search ---------- */

// "Kepler-22 b", "kepler 22b", "KEPLER22B" all become "kepler22b"
function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function parsePages(data, offset) {
  const pages = data.query && data.query.pages ? Object.values(data.query.pages) : [];
  return pages.map(page => {
    const props = page.pageprops || {};
    return {
      title: page.title,
      description: props["wikibase-shortdesc"] || "",
      isDisambiguation: "disambiguation" in props,
      order: offset + (page.index || 0)
    };
  });
}

// Fetches many results by requesting several pages in parallel.
// kind "prefix"  = titles that START with the query (finds every "Kepler-...")
// kind "search"  = full-text relevance search (finds related topics)
async function fetchPages(kind, query, total) {
  const q = encodeURIComponent(query);
  const step = kind === "prefix" ? 100 : 50;
  const requests = [];

  for (let offset = 0; offset < total; offset += step) {
    const params = kind === "prefix"
      ? `&generator=prefixsearch&gpssearch=${q}&gpslimit=${step}&gpsoffset=${offset}`
      : `&generator=search&gsrsearch=${q}&gsrlimit=${step}&gsroffset=${offset}`;

    const request = getJson(WIKI_API + params).then(data => parsePages(data, offset));
    // The first request may throw (so the app can show a connection error);
    // later pages that run past the end of the results are just ignored.
    requests.push(offset === 0 ? request : request.catch(() => []));
  }

  return (await Promise.all(requests)).flat();
}

function matchTier(title, query) {
  const nq = normalize(query);
  const nt = normalize(title);
  const nBase = normalize(title.replace(/\s*\(.*\)\s*$/, ""));
  if (nt === nq || nBase === nq) return 0;           // exact name
  if (nt.startsWith(nq)) return 1;                   // name starts with query
  const lowerQuery = query.toLowerCase().trim();
  const words = title.toLowerCase().split(/[\s\-_(),]+/);
  if (words.some(word => word.startsWith(lowerQuery))) return 2; // a word starts with query
  if (nt.includes(nq)) return 3;                     // name contains query
  return 4;                                          // loosely related
}

// Returns an array of { title, description, isDisambiguation } sorted best-first.
async function searchTopics(query, hint) {
  const [prefix, plain, space] = await Promise.all([
    fetchPages("prefix", query, MAX_RESULTS),
    fetchPages("search", query, 200),
    hint ? fetchPages("search", `${query} ${hint}`, 100).catch(() => []) : Promise.resolve([])
  ]);

  // Titles that the "space-flavoured" search also found get a small boost.
  // This is how the model's topic guess is used: as a tiebreaker, not as a filter.
  const spaceTitles = new Set(space.map(item => item.title));

  const merged = new Map();
  [...prefix, ...plain, ...space].forEach((item, index) => {
    if (!merged.has(item.title)) {
      merged.set(item.title, { ...item, rank: index });
    }
  });

  const scored = [...merged.values()].map(item => {
    let score = matchTier(item.title, query);
    if (spaceTitles.has(item.title)) score -= 0.5;
    if (item.isDisambiguation) score += 1;
    return { ...item, score };
  });

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    // Name-like matches: alphabetical with numbers in order (Kepler-22b before Kepler-186f)
    if (a.score < 3) {
      return a.title.localeCompare(b.title, undefined, { numeric: true });
    }
    return a.rank - b.rank; // loose matches keep Wikipedia's relevance order
  });

  return scored.slice(0, MAX_RESULTS);
}

/* ---------- Article details (unchanged) ---------- */

function getSummary(title) {
  const formattedTitle = encodeURIComponent(title.replace(/ /g, "_"));
  return getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${formattedTitle}`);
}

async function getNasaMedia(title) {
  try {
    const url = `https://images-api.nasa.gov/search?media_type=image&q=${encodeURIComponent(title)}`;
    const data = await getJson(url);

    const match = data.collection.items.find(item => item.links?.length > 0 && item.data?.length > 0);
    if (!match) return null;

    return {
      image: match.links[0].href,
      title: match.data[0].title,
      description: (match.data[0].description || "").slice(0, 300)
    };
  } catch (error) {
    return null;
  }
}

function findAgencies(text) {
  return agencies
    .filter(agency => agency.pattern.test(text))
    .map(agency => agency.name);
}

function getValues(claims, property) {
  const list = claims[property] || [];
  return list
    .map(claim => claim.mainsnak?.datavalue?.value)
    .filter(value => value !== undefined);
}

async function getWikidata(id) {
  if (!id) return null;

  try {
    const baseUrl = "https://www.wikidata.org/w/api.php?format=json&origin=*&action=wbgetentities&";
    const entityData = await getJson(`${baseUrl}props=claims&ids=${id}`);
    const claims = entityData.entities[id].claims;

    const targetProperties = ["P137", "P176", "P495", "P17"];

    const entityIds = [];
    targetProperties.forEach(prop => {
      getValues(claims, prop).forEach(value => {
        if (value.id && !entityIds.includes(value.id)) {
          entityIds.push(value.id);
        }
      });
    });

    const labels = {};
    if (entityIds.length > 0) {
      const labelUrl = `${baseUrl}props=labels&languages=en&ids=${entityIds.slice(0, 50).join("|")}`;
      const labelData = await getJson(labelUrl);

      for (const [key, entity] of Object.entries(labelData.entities)) {
        const label = entity.labels?.en;
        labels[key] = label ? label.value : key;
      }
    }

    const getNames = (prop) => {
      return getValues(claims, prop)
        .map(value => labels[value.id])
        .filter(Boolean);
    };

    const launch = getValues(claims, "P619")[0];

    return {
      operators: getNames("P137"),
      manufacturers: getNames("P176"),
      countries: [...getNames("P495"), ...getNames("P17")],
      launched: launch?.time ? launch.time.slice(1, 11) : null
    };
  } catch (error) {
    return null;
  }
}