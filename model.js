
const skipWords = ["a", "an", "the", "is", "are", "of", "in", "on", "to", "what",
  "how", "who", "which", "where", "tell", "me", "about", "and", "or", "for", "with"];

function tokenize(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(" ");
  const clean = [];

  for (const word of words) {
    if (word === "" || skipWords.includes(word)) continue;


    if (word.length > 4) {
      clean.push(word.replace(/(ing|ed|es|s)$/, ""));
    } else {
      clean.push(word);
    }
  }
  return clean;
}

const astra = {
  wordCounts: {},
  wordTotals: {},
  phraseTotals: {},
  vocab: {},
  allPhrases: 0,


  train(data) {
    for (const topic in data) {
      this.wordCounts[topic] = {};
      this.wordTotals[topic] = 0;
      this.phraseTotals[topic] = data[topic].length;

      for (const phrase of data[topic]) {
        this.allPhrases++;
        for (const word of tokenize(phrase)) {
          this.wordCounts[topic][word] = (this.wordCounts[topic][word] || 0) + 1;
          this.wordTotals[topic]++;
          this.vocab[word] = true;
        }
      }
    }
  },

 
  predict(text) {
    const words = tokenize(text).filter(w => this.vocab[w]);
    const vocabSize = Object.keys(this.vocab).length;
    const results = [];

    for (const topic in this.wordCounts) {
    
      let score = Math.log(this.phraseTotals[topic] / this.allPhrases);

      for (const word of words) {
        const seen = this.wordCounts[topic][word] || 0;
        
        score += Math.log((seen + 0.5) / (this.wordTotals[topic] + 0.5 * vocabSize));
      }
      results.push({ topic: topic, score: score });
    }

    
    const best = Math.max(...results.map(r => r.score));
    let total = 0;
    for (const r of results) {
      r.weight = Math.exp(r.score - best);
      total += r.weight;
    }

    return results
      .map(r => ({ topic: r.topic, confidence: r.weight / total }))
      .sort((a, b) => b.confidence - a.confidence);
  }
};

astra.train(trainingData);