const stopWords = new Set([
  "a", "an", "the", "is", "are", "of", "in", "on", "to", "what", "how",
  "who", "which", "where", "tell", "me", "about", "and", "or", "for", "with"
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(word => word && !stopWords.has(word))
    .map(word => (word.length > 4 ? word.replace(/(ing|ed|es|s)$/, "") : word));
}

class Astra {
  constructor() {
    this.wordCounts = {};
    this.totalWords = {};
    this.phraseCounts = {};
    this.vocabulary = new Set();
    this.totalPhrases = 0;
  }

  train(data) {
    for (const topic in data) {
      this.wordCounts[topic] = {};
      this.totalWords[topic] = 0;
      this.phraseCounts[topic] = data[topic].length;

      for (const phrase of data[topic]) {
        this.totalPhrases++;
        for (const word of tokenize(phrase)) {
          this.wordCounts[topic][word] = (this.wordCounts[topic][word] || 0) + 1;
          this.totalWords[topic]++;
          this.vocabulary.add(word);
        }
      }
    }
  }

  predict(text) {
    const words = tokenize(text).filter(word => this.vocabulary.has(word));

    const scores = Object.keys(this.wordCounts).map(topic => {
      let score = Math.log(this.phraseCounts[topic] / this.totalPhrases);
      for (const word of words) {
        const count = this.wordCounts[topic][word] || 0;
        score += Math.log((count + 0.5) / (this.totalWords[topic] + 0.5 * this.vocabulary.size));
      }
      return { topic, score };
    });

    const best = Math.max(...scores.map(item => item.score));
    const weights = scores.map(item => Math.exp(item.score - best));
    const total = weights.reduce((sum, value) => sum + value, 0);

    return scores
      .map((item, index) => ({ topic: item.topic, confidence: weights[index] / total }))
      .sort((a, b) => b.confidence - a.confidence);
  }
}

const astra = new Astra();
astra.train(trainingData);

