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

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error("Request failed");
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function searchWikipedia(query) {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=6&srsearch=" +
    encodeURIComponent(query);
  const data = await getJson(url);
  return data.query.search.map(item => item.title);
}

function getSummary(title) {
  return getJson(
    "https://en.wikipedia.org/api/rest_v1/page/summary/" +
      encodeURIComponent(title.replace(/ /g, "_"))
  );
}

async function getNasaMedia(title) {
  try {
    const data = await getJson(
      "https://images-api.nasa.gov/search?media_type=image&q=" + encodeURIComponent(title)
    );
    const item = data.collection.items.find(
      entry => entry.links && entry.links.length && entry.data && entry.data.length
    );
    if (!item) {
      return null;
    }
    return {
      image: item.links[0].href,
      title: item.data[0].title,
      description: (item.data[0].description || "").slice(0, 300)
    };
  } catch (error) {
    return null;
  }
}

const agencies = [
  { name: "NASA", pattern: /\bnasa\b|national aeronautics/i, site: "nasa.gov" },
  { name: "ESA", pattern: /\besa\b|european space agency/i, site: "esa.int" },
  { name: "ISRO", pattern: /\bisro\b|indian space research/i, site: "isro.gov.in" },
  { name: "Roscosmos", pattern: /roscosmos|russian federal space/i, site: "roscosmos.ru" }
];

function findAgencies(text) {
  return agencies.filter(agency => agency.pattern.test(text)).map(agency => agency.name);
}

async function getWikidata(id) {
  if (!id) {
    return null;
  }

  try {
    const base = "https://www.wikidata.org/w/api.php?format=json&origin=*&action=wbgetentities&";
    const entity = await getJson(base + "props=claims&ids=" + id);
    const claims = entity.entities[id].claims;

    const readValues = property =>
      (claims[property] || [])
        .map(claim => claim.mainsnak.datavalue && claim.mainsnak.datavalue.value)
        .filter(Boolean);

    const linkedIds = ["P137", "P176", "P495", "P17"]
      .flatMap(property => readValues(property).map(value => value.id))
      .filter(Boolean);

    const labels = {};
    if (linkedIds.length) {
      const unique = [...new Set(linkedIds)].slice(0, 50).join("|");
      const labelData = await getJson(base + "props=labels&languages=en&ids=" + unique);
      for (const key in labelData.entities) {
        const label = labelData.entities[key].labels.en;
        labels[key] = label ? label.value : key;
      }
    }

    const readNames = property =>
      readValues(property).map(value => labels[value.id]).filter(Boolean);

    const launch = readValues("P619")[0];

    return {
      operators: readNames("P137"),
      manufacturers: readNames("P176"),
      countries: readNames("P495").concat(readNames("P17")),
      launched: launch ? launch.time.slice(1, 11) : null
    };
  } catch (error) {
    return null;
  }
}

