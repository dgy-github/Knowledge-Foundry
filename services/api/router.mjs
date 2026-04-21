class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

export { HttpError };

export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, path, handler) {
    // Convert path patterns like /sources/:id or deep /wiki/pages/:id to regex
    const paramNames = [];
    const regexPath = path.replace(/:([^\/]+)/g, (_, paramName) => {
      paramNames.push(paramName);
      // For ID param, we allow deeper paths like topics/something.md
      return "(.*)";
    });
    this.routes.push({
      method: method.toUpperCase(),
      pattern: new RegExp(`^${regexPath}$`),
      paramNames,
      handler
    });
  }

  get(path, handler) { this.add("GET", path, handler); }
  post(path, handler) { this.add("POST", path, handler); }
  delete(path, handler) { this.add("DELETE", path, handler); }

  async handle(request, response) {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const reqMethod = request.method || "GET";

    for (const route of this.routes) {
      if (route.method !== reqMethod) continue;
      const match = url.pathname.match(route.pattern);
      if (match) {
        request.params = {};
        route.paramNames.forEach((name, i) => {
          request.params[name] = decodeURIComponent(match[i + 1]);
        });
        request.query = url.searchParams;
        request.urlObj = url;
        
        await route.handler(request, response);
        return true; // handled
      }
    }
    return false; // not matched
  }
}

export async function parseJsonBody(request) {
  return new Promise((resolve, reject) => {
    const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024; // 5MB limit
    if (request.headers['content-length'] && parseInt(request.headers['content-length']) > MAX_PAYLOAD_SIZE) {
      return reject(new HttpError(413, "Payload Too Large: Exceeds 5MB limit."));
    }

    let body = "";
    let totalBytes = 0;

    request.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_PAYLOAD_SIZE) {
        request.destroy();
        return reject(new HttpError(413, "Payload Too Large: Stream exceeded 5MB limit."));
      }
      body += chunk.toString('utf-8');
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new HttpError(400, "Request body must be valid JSON."));
      }
    });

    request.on("error", reject);
  });
}

export function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

export function toHttpError(error) {
  if (error instanceof HttpError) return error;
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    return new HttpError(404, "Resource not found.");
  }
  return new HttpError(500, error instanceof Error ? error.message : String(error));
}
