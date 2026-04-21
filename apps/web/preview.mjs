import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "4173", 10);
const root = path.join(process.cwd(), "apps", "web");
const apiOrigin = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:3210";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function resolvePath(urlPath) {
  const pathname = urlPath === "/" ? "/index.html" : urlPath;
  return path.normalize(path.join(root, pathname));
}

function proxyApi(request, response) {
  const target = new URL(request.url?.replace(/^\/api/, "") || "/", apiOrigin);
  const proxyRequest = fetch(target, {
    method: request.method,
    headers: {
      accept: request.headers.accept ?? "application/json",
      "content-type": request.headers["content-type"] ?? undefined,
    },
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request,
    duplex: request.method === "GET" || request.method === "HEAD" ? undefined : "half",
  });

  void proxyRequest
    .then(async (proxyResponse) => {
      response.writeHead(proxyResponse.status, {
        "content-type": proxyResponse.headers.get("content-type") ?? "application/json; charset=utf-8",
        "cache-control": "no-store",
      });

      if (!proxyResponse.body) {
        response.end();
        return;
      }

      for await (const chunk of proxyResponse.body) {
        response.write(chunk);
      }
      response.end();
    })
    .catch((error) => {
      if (!response.headersSent) {
        response.writeHead(502, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      } else {
        response.end();
      }
    });
}

const server = createServer(async (request, response) => {
  try {
    if ((request.url ?? "").startsWith("/api/") || request.url === "/api") {
      proxyApi(request, response);
      return;
    }

    const filePath = resolvePath(request.url ?? "/");
    if (!filePath.startsWith(root)) {
      response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      throw new Error("Not a file");
    }

    const ext = path.extname(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[ext] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not Found");
  }
});

server.listen(port, host, () => {
  console.log(`web preview listening on http://${host}:${port}`);
  console.log(`proxying api requests to ${apiOrigin}`);
});
