// index.html / styles.css / game.js を1枚に束ねた play.html を生成する。
// 使い方: リポジトリ root で  node docs/screenshots/build-standalone.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('styles.css', 'utf8');
const js = readFileSync('game.js', 'utf8');

let out = html
  .replace('<link rel="stylesheet" href="styles.css" />', `<style>\n${css}\n</style>`)
  .replace('<link rel="manifest" href="manifest.webmanifest" />\n  ', '')
  .replace('<script src="game.js"></script>', `<script>\n${js}\n</script>`);

// 注記コメントを先頭に付与
out = out.replace('<!DOCTYPE html>',
  '<!DOCTYPE html>\n<!-- Stardust Clicker (standalone build). ' +
  'ダブルクリックで開くだけで遊べます。進行はこのファイルを開いたブラウザに自動保存されます。 -->');

writeFileSync('play.html', out);
console.log('play.html generated:', out.length, 'bytes');
