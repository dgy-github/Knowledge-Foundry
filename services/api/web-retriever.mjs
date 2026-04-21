export async function duckDuckGoSearch(query, limit = 5) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept": "text/html"
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) return [];
    
    const html = await response.text();
    const results = [];
    const resultBlocks = html.split('class="result ').slice(1);
    
    for (const block of resultBlocks) {
      if (results.length >= limit) break;
      const titleMatch = block.match(/<h2 class="result__title">[^<]*<a[^>]*>(.*?)<\/a>/);
      const snippetMatch = block.match(/<a class="result__snippet[^>]*>(.*?)<\/a>/);
      const urlMatch = block.match(/<a class="result__url" href="([^"]+)">/);
      
      if (titleMatch && snippetMatch) {
        let urlText = urlMatch ? urlMatch[1] : "";
        if (urlText.startsWith('//')) {
          urlText = 'https:' + urlText;
          try {
            // Attempt to unwrap duckduckgo url formatting if possible
            const testUrl = new URL(urlText);
            const uddg = testUrl.searchParams.get('uddg');
            if (uddg) urlText = decodeURIComponent(uddg);
          } catch(e) {}
        }
        results.push({
          title: titleMatch[1].replace(/<[^>]+>/g, '').trim(),
          snippet: snippetMatch[1].replace(/<[^>]+>/g, '').trim(),
          url: urlText
        });
      }
    }
    return results;
  } catch (error) {
    console.error("[WebSearch] DDG Scraper Failed:", error.message);
    return [];
  }
}
