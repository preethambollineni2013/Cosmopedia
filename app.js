const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("query");
const resultContainer = document.getElementById("result");

let searchResults = [];
let activePrediction = null;

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML.replace(/"/g, "&quot;");
}

function createSourceBadge(name) {
  return `<span class="source">${name}</span>`;
}

function buildFactRow(label, values) {
  const text = Array.isArray(values) ? values.join(", ") : values;
  if (!text) return "";
  return `<tr><th>${label}</th><td>${escapeHtml(text)}</td></tr>`;
}

function getAgencySearchUrl(agency, title) {
  return `https://duckduckgo.com/?q=${encodeURIComponent(`site:${agency.site} ${title}`)}`;
}

function renderArticle(summary, nasaData, facts, relatedTitles) {
  const title = summary.title;

  let topicDisplay = "general";
  if (activePrediction && activePrediction.confidence >= 0.2) {
    topicDisplay = `${activePrediction.topic} ${Math.round(activePrediction.confidence * 100)}%`;
  }

  let agencyText = `${summary.description || ""} ${summary.extract || ""}`;
  if (facts) {
    agencyText += ` ${facts.operators.join(" ")} ${facts.manufacturers.join(" ")}`;
  }
  const matchedAgencies = findAgencies(agencyText);

  let thumbnailHtml = "";
  if (summary.thumbnail) {
    thumbnailHtml = `<tr><td colspan="2"><img src="${escapeHtml(summary.thumbnail.source)}" alt=""></td></tr>`;
  }

  let factRows = buildFactRow("Type", summary.description || "Space topic");
  if (facts) {
    factRows += buildFactRow("Launched", facts.launched);
    factRows += buildFactRow("Operator", facts.operators);
    factRows += buildFactRow("Built by", facts.manufacturers);
    factRows += buildFactRow("Country", facts.countries);
  }

  let agencySection = "";
  if (matchedAgencies.length > 0) {
    const chipsHtml = matchedAgencies.map(name => `<span class="chip">${name}</span>`).join("");
    agencySection = `<h3>Agencies involved ${createSourceBadge("Wikidata + Wikipedia")}</h3><div class="chips">${chipsHtml}</div>`;
  }

  let nasaSection = "";
  if (nasaData) {
    nasaSection = `
      <h3>From NASA ${createSourceBadge("NASA Image Library")}</h3>
      <img class="wide" src="${escapeHtml(nasaData.image)}" alt="">
      <p><b>${escapeHtml(nasaData.title)}</b>. ${escapeHtml(nasaData.description)}</p>
    `;
  }

  const officialLinks = agencies.map(agency => 
    `<a class="chip link" href="${getAgencySearchUrl(agency, title)}" target="_blank" rel="noopener">${agency.name}</a>`
  ).join("");

  let relatedSection = "";
  if (relatedTitles.length > 0) {
    const relatedButtons = relatedTitles.map(item => 
      `<button data-title="${escapeHtml(item)}">${escapeHtml(item)}</button>`
    ).join("");
    relatedSection = `<h3>See also</h3><div class="chips">${relatedButtons}</div>`;
  }

  const wikidataLink = summary.wikibase_item ? 
    `<li><a href="https://www.wikidata.org/wiki/${escapeHtml(summary.wikibase_item)}" target="_blank" rel="noopener">Wikidata</a></li>` : "";

  const wikipediaUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

  return `
    <article class="article">
      <h2>${escapeHtml(title)}</h2>
      <p class="meta">Astra topic: ${escapeHtml(topicDisplay)}</p>
      <table class="facts"><caption>Quick facts</caption>${thumbnailHtml}${factRows}</table>
      <h3>Overview ${createSourceBadge("Wikipedia")}</h3>
      <p>${escapeHtml(summary.extract || "")}</p>
      ${agencySection}
      ${nasaSection}
      <h3>Official agency sources</h3>
      <p class="meta">Opens a search on each agency's own website.</p>
      <div class="chips">${officialLinks}</div>
      ${relatedSection}
      <h3>References</h3>
      <ol>
        <li><a href="${wikipediaUrl}" target="_blank" rel="noopener">Wikipedia</a></li>
        ${wikidataLink}
        <li><a href="https://images.nasa.gov" target="_blank" rel="noopener">NASA Image and Video Library</a></li>
      </ol>
    </article>
  `;
}

async function showArticle(title) {
  resultContainer.innerHTML = '<p class="status">Searching…</p>';

  try {
    const summary = await getSummary(title);
    const nasaData = await getNasaMedia(title);
    const facts = await getWikidata(summary.wikibase_item);

    const related = searchResults
      .filter(item => item !== title)
      .slice(0, 5);

    resultContainer.innerHTML = renderArticle(summary, nasaData, facts, related);
  } catch (error) {
    resultContainer.innerHTML = '<p class="status">Could not load that article. Check your connection and try again.</p>';
  }
}

async function handleSearch(query) {
  resultContainer.innerHTML = '<p class="status">Searching…</p>';

  const predictions = astra.predict(query);
  activePrediction = predictions.length > 0 ? predictions[0] : null;

  let hint = "";
  if (activePrediction && activePrediction.confidence >= 0.2) {
    hint = topicHints[activePrediction.topic] || "";
  }

  try {
    searchResults = await searchWikipedia(`${query} ${hint}`.trim());
  } catch (error) {
    resultContainer.innerHTML = '<p class="status">Could not reach Wikipedia. Check your connection and try again.</p>';
    return;
  }

  if (searchResults.length === 0) {
    resultContainer.innerHTML = '<p class="status">No results found.</p>';
    return;
  }

  showArticle(searchResults[0]);
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (query) {
    handleSearch(query);
  }
});

resultContainer.addEventListener("click", (event) => {
  const button = event.target.closest("[data-title]");
  if (button) {
    showArticle(button.dataset.title);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});
      
