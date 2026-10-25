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


async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("request failed");
  }
  return response.json();
}

async function searchWikipedia(query) {
  const url = "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=6&srsearch=" + encodeURIComponent(query);
  const data = await getJson(url);

  const titles = [];
  for (const item of data.query.search) {
    titles.push(item.title);
  }
  return titles;
}

function getSummary(title) {
  const name = encodeURIComponent(title.replace(/ /g, "_"));
  return getJson("https://en.wikipedia.org/api/rest_v1/page/summary/" + name);
}


async function getNasaMedia(title) {
  try {
    const data = await getJson("https://images-api.nasa.gov/search?media_type=image&q=" + encodeURIComponent(title));

    for (const item of data.collection.items) {
      if (item.links && item.links.length > 0 && item.data && item.data.length > 0) {
        return {
          image: item.links[0].href,
          title: item.data[0].title,
          description: (item.data[0].description || "").slice(0, 300)
        };
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}


function findAgencies(text) {
  const found = [];
  for (const agency of agencies) {
    if (agency.pattern.test(text)) {
      found.push(agency.name);
    }
  }
  return found;
}

function getValues(claims, property) {
  const values = [];
  const list = claims[property] || [];
  for (const claim of list) {
    if (claim.mainsnak.datavalue) {
      values.push(claim.mainsnak.datavalue.value);
    }
  }
  return values;
}

async function getWikidata(id) {
  if (!id) {
    return null;
  }

  try {
    const base = "https://www.wikidata.org/w/api.php?format=json&origin=*&action=wbgetentities&";
    const entity = await getJson(base + "props=claims&ids=" + id);
    const claims = entity.entities[id].claims;

  
   const properties = ["P137", "P176", "P495", "P17"];

  
    const ids = [];
    for (const property of properties) {
      for (const value of getValues(claims, property)) {
        if (value.id && !ids.includes(value.id)) {
          ids.push(value.id);
        }
      }
    }
    const labels = {};
    if (ids.length > 0) {
      const labelData = await getJson(base + "props=labels&languages=en&ids=" + ids.slice(0, 50).join("|"));
      for (const key in labelData.entities) {
        const label = labelData.entities[key].labels.en;
        labels[key] = label ? label.value : key;
      }
    }

    function getNames(property) {
      const names = [];
      for (const value of getValues(claims, property)) {
        if (labels[value.id]) {
          names.push(labels[value.id]);
        }
      }
      return names;
    }


    const launch = getValues(claims, "P619")[0];

    return {
      operators: getNames("P137"),
      manufacturers: getNames("P176"),
      countries: getNames("P495").concat(getNames("P17")),
      launched: launch ? launch.time.slice(1, 11) : null
    };
  } catch (error) {
    return null;
  }
}