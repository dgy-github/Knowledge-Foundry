async function testSogou(query) {
    const url = `https://www.sogou.com/web?query=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      }
    });
    const text = await response.text();
    console.log("Sogou length:", text.length, "includes result?", text.includes("vrwrap"));
}

async function testBing(query) {
    const url = `https://cn.bing.com/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
       headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      }
    });
    const text = await response.text();
    console.log("Bing length:", text.length, "includes result?", text.includes("b_algo"));
}

testSogou("nanoGPT").then(() => testBing("nanoGPT")).catch(console.error);
