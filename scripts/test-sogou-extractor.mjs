async function testSogou(query) {
    const url = `https://www.sogou.com/web?query=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      }
    });
    const html = await response.text();
    const results = [];
    
    // Splitting by vrwrap or rb
    const blocks = html.split(/<div class="vrwrap[^>]*>|<div class="rb[^>]*>/).slice(1);
    for (const block of blocks) {
        const titleMatch = block.match(/<h3 class="(?:vr-title|pt|v-title)"[^>]*>.*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
        const snippetMatch = block.match(/<div class="(?:fz-mid|ft|str_info)[^>]*>([\s\S]*?)<\/div>/);
        
        if (titleMatch) {
            results.push({
                url: titleMatch[1].startsWith('/') ? 'https://www.sogou.com' + titleMatch[1] : titleMatch[1],
                title: titleMatch[2].replace(/<[^>]+>/g, '').trim(),
                snippet: snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : ""
            });
        }
    }
    console.log(results);
}
testSogou("nanoGPT").catch(console.error);
