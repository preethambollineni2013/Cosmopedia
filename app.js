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
  return '<span class="source">' + name + "</span>";
}


function factRow(label, values) {
  let text = values;
  if (Array.isArray(values)) {
    text = values.join(", ");
  }
  if (!text) {
    return "";
  }
  return "<tr><th>" + label + "</th><td>" + escapeHtml(text) + "</td></tr>";
}

function agencySearchUrl(agency, title) {
  return "https://duckduckgo.com/?q=" + encodeURIComponent("site:" + agency.site + " " + title);
}

function renderArticle(summary, nasa, facts, related) {
  const title = summary.title;


  let topicText = "general";
  if (currentPrediction.confidence >= 0.2) {
    topicText = currentPrediction.topic + " " + Math.round(currentPrediction.confidence * 100) + "%";
  }


  let agencyText = (summary.description || "") + " " + (summary.extract || "");
  if (facts) {
    agencyText += " " + facts.operators.join(" ") + " " + facts.manufacturers.join(" ");
  }
  const involved = findAgencies(agencyText);

  let picture = "";
  if (summary.thumbnail) {
    picture = '<tr><td colspan="2"><img src="' + escapeHtml(summary.thumbnail.source) + '" alt=""></td></tr>';
  }

  let rows = factRow("Type", summary.description || "Space topic");
  if (facts) {
    rows += factRow("Launched", facts.launched);
    rows += factRow("Operator", facts.operators);
    rows += factRow("Built by", facts.manufacturers);
    rows += factRow("Country", facts.countries);
  }

  let involvedSection = "";
  if (involved.length > 0) {
    let chips = "";
    for (const name of involved) {
      chips += '<span class="chip">' + name + "</span>";
    }
    involvedSection = "<h3>Agencies involved " + sourceTag("Wikidata + Wikipedia") + "</h3>" +
      '<div class="chips">' + chips + "</div>";
  }


  let nasaSection = "";
  if (nasa) {
    nasaSection = "<h3>From NASA " + sourceTag("NASA Image Library") + "</h3>" +
      '<img class="wide" src="' + escapeHtml(nasa.image) + '" alt="">' +
      "<p><b>" + escapeHtml(nasa.title) + "</b>. " + escapeHtml(nasa.description) + "</p>";
  }

  let officialLinks = "";
  for (const agency of agencies) {
    officialLinks += '<a class="chip link" href="' + agencySearchUrl(agency, title) +
      '" target="_blank" rel="noopener">' + agency.name + "</a>";
  }

  let relatedSection = "";
  if (related.length > 0) {
    let buttons = "";
    for (const item of related) {
      buttons += '<button data-title="' + escapeHtml(item) + '">' + escapeHtml(item) + "</button>";
    }
    relatedSection = '<h3>See also</h3><div class="chips">' + buttons + "</div>";
  }

  let wikidataLink = "";
  if (summary.wikibase_item) {
    wikidataLink = '<li><a href="https://www.wikidata.org/wiki/' + escapeHtml(summary.wikibase_item) +
      '" target="_blank" rel="noopener">Wikidata</a></li>';
  }
  const wikipediaUrl = "https://en.wikipedia.org/wiki/" + encodeURIComponent(title.replace(/ /g, "_"));

  return '<article class="article">' +
    "<h2>" + escapeHtml(title) + "</h2>" +
    '<p class="meta">Astra topic: ' + escapeHtml(topicText) + "</p>" +
    '<table class="facts"><caption>Quick facts</caption>' + picture + rows + "</table>" +
    "<h3>Overview " + sourceTag("Wikipedia") + "</h3>" +
    "<p>" + escapeHtml(summary.extract || "") + "</p>" +
    involvedSection +
    nasaSection +
    "<h3>Official agency sources</h3>" +
    '<p class="meta">Opens a search on each agency\'s own website.</p>' +
    '<div class="chips">' + officialLinks + "</div>" +
    relatedSection +
    "<h3>References</h3>" +
    '<ol><li><a href="' + wikipediaUrl + '" target="_blank" rel="noopener">Wikipedia</a></li>' +
    wikidataLink +
    '<li><a href="https://images.nasa.gov" target="_blank" rel="noopener">NASA Image and Video Library</a></li></ol>' +
    "</article>";
}

async function showArticle(title) {
  result.innerHTML = '<p class="status">Searching…</p>';

  try {
    const summary = await getSummary(title);
    const nasa = await getNasaMedia(title);
    const facts = await getWikidata(summary.wikibase_item);


    const related = [];
    for (const item of currentTitles) {
      if (item !== title && related.length < 5) {
        related.push(item);
      }
    }

    result.innerHTML = renderArticle(summary, nasa, facts, related);
  } catch (error) {
    result.innerHTML = '<p class="status">Could not load that article. Check your connection and try again.</p>';
  }
}

async function handleSearch(query) {
  result.innerHTML = '<p class="status">Searching…</p>';


  currentPrediction = astra.predict(query)[0];

  let hint = "";
  if (currentPrediction.confidence >= 0.2) {
    hint = topicHints[currentPrediction.topic];
  }

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

form.addEventListener("submit", function (event) {
  event.preventDefault();
  const query = input.value.trim();
  if (query) {
    handleSearch(query);
  }
});

result.addEventListener("click", function (event) {
  const button = event.target.closest("[data-title]");
  if (button) {
    showArticle(button.dataset.title);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});