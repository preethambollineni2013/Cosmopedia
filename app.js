const form = document.getElementById("search-form");
const input = document.getElementById("query");
const result = document.getElementById("result");

let currentTitles = [];
let currentPrediction = null;

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML.replace(/"/g, "&quot;");
}

function sourceTag(name) {
  return `<span class="source">${name}</span>`;
}

function factRow(label, values) {
  const list = Array.isArray(values) ? values.join(", ") : values;
  return list ? `<tr><th>${label}</th><td>${escapeHtml(list)}</td></tr>` : "";
}

function agencySearchUrl(agency, title) {
  return "https://duckduckgo.com/?q=" + encodeURIComponent("site:" + agency.site + " " + title);
}

function renderArticle(summary, nasa, facts, related) {
  const confident = currentPrediction.confidence >= 0.2;
  const topicText = confident
    ? currentPrediction.topic + " " + Math.round(currentPrediction.confidence * 100) + "%"
    : "general";
  const title = summary.title;

  const involved = findAgencies(
    [summary.description, summary.extract, facts && facts.operators.join(" "), facts && facts.manufacturers.join(" ")]
      .filter(Boolean)
      .join(" ")
  );

  const picture = summary.thumbnail
    ? `<tr><td colspan="2"><img src="${escapeHtml(summary.thumbnail.source)}" alt=""></td></tr>`
    : "";

  const factRows = [
    factRow("Type", summary.description || "Space topic"),
    facts ? factRow("Launched", facts.launched) : "",
    facts ? factRow("Operator", facts.operators) : "",
    facts ? factRow("Built by", facts.manufacturers) : "",
    facts ? factRow("Country", facts.countries) : ""
  ].join("");

  const involvedSection = involved.length
    ? `<h3>Agencies involved ${sourceTag("Wikidata + Wikipedia")}</h3>
       <div class="chips">${involved.map(name => `<span class="chip">${name}</span>`).join("")}</div>`
    : "";

  const nasaSection = nasa
    ? `<h3>From NASA ${sourceTag("NASA Image Library")}</h3>
       <img class="wide" src="${escapeHtml(nasa.image)}" alt="">
       <p><b>${escapeHtml(nasa.title)}</b>. ${escapeHtml(nasa.description)}</p>`
    : "";

  const officialLinks = agencies
    .map(agency => `<a class="chip link" href="${agencySearchUrl(agency, title)}" target="_blank" rel="noopener">${agency.name}</a>`)
    .join("");

  const relatedSection = related.length
    ? `<h3>See also</h3>
       <div class="chips">
         ${related.map(item => `<button data-title="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("")}
       </div>`
    : "";

  const wikidataLink = summary.wikibase_item
    ? `<li><a href="https://www.wikidata.org/wiki/${escapeHtml(summary.wikibase_item)}" target="_blank" rel="noopener">Wikidata</a></li>`
    : "";

  return `
    <article class="article">
      <h2>${escapeHtml(title)}</h2>
      <p class="meta">Astra topic: ${escapeHtml(topicText)}</p>
      <table class="facts">
        <caption>Quick facts</caption>
        ${picture}
        ${factRows}
      </table>
      <h3>Overview ${sourceTag("Wikipedia")}</h3>
      <p>${escapeHtml(summary.extract || "")}</p>
      ${involvedSection}
      ${nasaSection}
      <h3>Official agency sources</h3>
      <p class="meta">Opens a search on each agency's own website.</p>
      <div class="chips">${officialLinks}</div>
      ${relatedSection}
      <h3>References</h3>
      <ol>
        <li><a href="https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}" target="_blank" rel="noopener">Wikipedia</a></li>
        ${wikidataLink}
        <li><a href="https://images.nasa.gov" target="_blank" rel="noopener">NASA Image and Video Library</a></li>
      </ol>
    </article>`;
}

async function showArticle(title) {
  result.innerHTML = '<p class="status">Searching…</p>';

  try {
    const [summary, nasa] = await Promise.all([getSummary(title), getNasaMedia(title)]);
    const facts = await getWikidata(summary.wikibase_item);
    const related = currentTitles.filter(item => item !== title).slice(0, 5);
    result.innerHTML = renderArticle(summary, nasa, facts, related);
  } catch (error) {
    result.innerHTML = '<p class="status">Could not load that article. Check your connection and try again.</p>';
  }
}

async function handleSearch(query) {
  result.innerHTML = '<p class="status">Searching…</p>';
  currentPrediction = astra.predict(query)[0];

  const hint = currentPrediction.confidence >= 0.2 ? topicHints[currentPrediction.topic] : "";

  try {
    currentTitles = await searchWikipedia((query + " " + hint).trim());
  } catch (error) {
    result.innerHTML = '<p class="status">Could not reach Wikipedia. Check your connection and try again.</p>';
    return;
  }

  if (currentTitles.length === 0) {
    result.innerHTML = '<p class="status">No results found.</p>';
    return;
  }

  showArticle(currentTitles[0]);
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const query = input.value.trim();
  if (query) {
    handleSearch(query);
  }
});

result.addEventListener("click", event => {
  const button = event.target.closest("[data-title]");
  if (button) {
    showArticle(button.dataset.title);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

