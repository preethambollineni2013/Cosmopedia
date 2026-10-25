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
    throw new Error("Request failed");
  }
  return response.json();
}

async function searchWikipedia(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=6&srsearch=${encodeURIComponent(query)}`;
  const data = await getJson(url);
  return data.query.search.map(item => item.title);
}

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
    
    // Collect unique entity IDs
    const entityIds = [];
    targetProperties.forEach(prop => {
      getValues(claims, prop).forEach(value => {
        if (value.id && !entityIds.includes(value.id)) {
          entityIds.push(value.id);
        }
      });
    });

    // Fetch labels for the extracted IDs
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
                                                                  
