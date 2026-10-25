# Cosmopedia

A small space encyclopedia that runs in the browser. Type any space topic, such as a planet, mission, astronaut, or agency, and Cosmopedia builds an article from Wikipedia, Wikidata, and NASA's image library.

**Live site:** https://preethambollineni2013.github.io/Cosmopedia/

## Features

- **Search any space topic** and get an article with an overview, a quick facts table, and a photo.
- **Astra**, a small built-in classifier, guesses the topic type (planet, moon, star, galaxy, spacecraft, mission, small body, agency, astronaut, or phenomenon) and uses the guess to improve the search.
- **Quick facts** from Wikidata: launch date, operator, manufacturer, and country.
- **Agencies involved**, detected from the article text (NASA, ESA, ISRO, Roscosmos).
- **NASA image** with a short description from the NASA Image and Video Library.
- **Official agency links** that open a search on each agency's own website.
- **See also** buttons for related search results.

## How it works

1. You type a query and press Search.
2. Astra reads the query and predicts a topic with a confidence score. If the confidence is 20% or higher, a matching hint word is added to the search.
3. The query is sent to the Wikipedia search API, and the top result is opened as the article.
4. The page loads the Wikipedia summary, a NASA image, and Wikidata facts, then renders them together.

### About Astra

Astra is a naive Bayes text classifier written in plain JavaScript, with no libraries. It trains in your browser each time the page loads, using the example phrases in `js/training.js`. It counts how often each word appears under each topic, then scores a new query using log probabilities with additive smoothing. The scores are turned into percentages.

## Run it locally

No build step or dependencies are needed.

1. Download or clone the repository.
2. Open `index.html` in a browser

An internet connection is required because the data comes from live APIs.

## Data sources

- [Wikipedia](https://www.wikipedia.org/) (search and page summaries)
- [Wikidata](https://www.wikidata.org/) (structured facts)
- [NASA Image and Video Library](https://images.nasa.gov/) (images)

Text and images come from these sources and remain under their own licenses.

## Improving Astra

Astra gets better as you add more example phrases to `js/training.js`. If a search is classified wrongly, add a few phrases under the right topic and reload.

## Built with

HTML, CSS, and JavaScript. Parts of this project were written with the help of AI tools.

## Author

Built by Preetham.

© 2026 Cosmopedia. All rights reserved.
