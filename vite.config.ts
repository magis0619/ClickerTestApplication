import { defineConfig } from "vite";

// GitHub Pages（プロジェクトサイト）では /ClickerTestApplication/ 配下で配信される。
// 開発サーバ(dev)ではルート配信にしておく。
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/ClickerTestApplication/" : "/",
}));
