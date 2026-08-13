/**
 * 静的ファイルのURLを組み立てる。
 *
 * GitHub Pages のプロジェクトページでは、サイトが `/<repo>/` の下に置かれる。
 * Next.js の `basePath` は <Link> や next/image には自動で効くが、
 * 素の <img src="..."> や CSS の url() には効かない。
 * 背景と人物シルエットは素の <img> と style で読むので、ここで前置する。
 *
 * `NEXT_PUBLIC_` 接頭辞の環境変数はビルド時に埋め込まれるため、
 * クライアント側から参照できる。
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`asset() には / で始まる絶対パスを渡す: ${path}`);
  }
  return `${BASE_PATH}${path}`;
}

export const sceneImage = (scene: string) => asset(`/scenes/${scene}.svg`);
export const characterImage = (character: string) =>
  asset(`/characters/${character}.svg`);
