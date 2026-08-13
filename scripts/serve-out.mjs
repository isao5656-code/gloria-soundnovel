/**
 * 書き出した out/ をローカルで配信する。
 *
 *   npm run build && npm run preview
 *
 * 静的書き出しなので `next start` は使えない。外部パッケージに頼らず、
 * 本番と同じ静的ファイルをそのまま返すだけの小さなサーバーを置く。
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "out");
const port = Number(process.env.PORT ?? 3000);

if (!existsSync(root)) {
  console.error("out/ がありません。先に `npm run build` を実行してください。");
  process.exit(1);
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
};

// basePath 付きで書き出した場合、本番と同じURLで確かめられるように前置分を剥がす。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const server = createServer((req, res) => {
  // クエリと、パス遡上（..）を落とす。
  const rawPath = decodeURIComponent((req.url ?? "/").split("?")[0]);

  if (basePath && rawPath !== basePath && !rawPath.startsWith(`${basePath}/`)) {
    // 本番では basePath の外は別のサイトなので、ここでも配信しない。
    res.writeHead(404, { "content-type": types[".html"] });
    res.end(`このビルドは ${basePath}/ の下で配信されます。`);
    return;
  }
  const stripped = basePath ? rawPath.slice(basePath.length) || "/" : rawPath;

  const safePath = normalize(stripped).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(root, safePath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  // ディレクトリなら index.html を返す（trailingSlash: true の書き出しに合わせる）。
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }
  if (!existsSync(filePath)) {
    const withHtml = `${filePath}.html`;
    if (existsSync(withHtml)) filePath = withHtml;
    else {
      const notFound = join(root, "404.html");
      if (existsSync(notFound)) {
        res.writeHead(404, { "content-type": types[".html"] });
        createReadStream(notFound).pipe(res);
        return;
      }
      res.writeHead(404).end("Not Found");
      return;
    }
  }

  res.writeHead(200, {
    "content-type": types[extname(filePath)] ?? "application/octet-stream",
    "cache-control": "no-cache",
  });
  createReadStream(filePath).pipe(res);
});

server.listen(port, () => {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  console.log(`http://localhost:${port}${base}/ で配信中（Ctrl+C で終了）`);
});
