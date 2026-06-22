# 01. 市場調査 — クリッカー / 放置（インクリメンタル）ゲーム

調査日: 2026-06-22

## 1. 市場規模と成長性

- **アイドル（放置）ゲーム市場**は 2025 年時点で **約 132〜142 億ドル**規模。
  2034 年には **248〜348 億ドル**へ拡大予測（CAGR 8.7〜10.5%）。成長ジャンル。
- 内訳: **インクリメンタル系が市場の約 40.1%（約 52.9 億ドル）でトップ**。
  指数関数的な数値成長（multiplier 系）が中核。
  **クリッカー系（タップ主体）は約 22.8%**。
- 主要プレイヤー層は **成人が 54.4%**、年間 ARPU **32〜45 ドル**で LTV が高い。

> 出典は本ファイル末尾に記載。

## 2. なぜこのジャンルか（参入の論拠）

| 観点 | 評価 | 理由 |
|------|------|------|
| 開発コスト | ◎ | コアループが単純（タップ→資源→強化→自動化）。少人数・短期間で MVP 可能 |
| 拡張性 | ◎ | シンプルゆえに RPG / 資源管理 / ストーリー / ビジュアル系へ多方向に派生可能 |
| 中毒性・継続率 | ○ | 「数字が増え続ける」報酬設計と放置報酬で再訪を誘発しやすい |
| 収益化 | ○ | IAP（市場の 60%）＋リワード広告（24%）の二本柱が確立 |
| 市場成熟度 | △ | 競合多数。差別化（テーマ・世界観・UI 快適性）が必須 |

## 3. ヒットしているタイトルに共通するコアメカニクス

国内外のランキング・レビュー記事を横断すると、人気タイトルは以下を必ず備える:

1. **連打（タップ）で即時報酬** — タップの「爽快感」がフック。
2. **強化（育成）で効率化** — クリック単価アップ＋自動生産ユニット。
3. **放置（オフライン）報酬** — 離席中も資源が貯まり、再訪の動機になる。
4. **指数的コスト＆報酬カーブ** — 価格が `baseCost * 倍率^所持数` で伸び、常に「次の目標」が見える。
5. **転生 / プレステージ** — 進行をリセットする代わりに恒久ブースト。長期リテンションの要。
6. **数値の桁表記（K, M, B, T…）** — インフレ感の演出。
7. **快適な UI と低い広告ストレス** — 無課金でも遊べる設計が高評価につながる。

## 4. ユーザーがタイトルを選ぶ基準（レビュー記事より）

- プレイスタイル（放置寄り / 連打寄り）に合うか
- テーマ・世界観の好み
- 無課金でも十分楽しめるか
- 広告頻度
- UI の快適性

## 5. 本プロジェクトへの示唆（MVP 方針）

- **差別化は「テーマ × UI の快適さ」で図る**（コアメカニクスは王道を踏襲）。
- MVP では収益化（IAP/広告）は実装せず、**コアループの面白さ検証**に集中。
- 上記コアメカニクス 1〜6 を最小構成で実装し、7 は UI 品質として担保する。

## 出典 (Sources)

- [Idle Games Market Research Report — growthmarketreports](https://growthmarketreports.com/report/idle-games-market)
- [Idle Games Market Research Report — dataintelo](https://dataintelo.com/report/idle-games-market)
- [Idle Games: Definition, Demographics & Monetization — adjoe](https://adjoe.io/glossary/idle-games-mobile/)
- [Idle Clicker Games: Best Practices for Design and Monetization — TheMindStudios](https://games.themindstudios.com/post/idle-clicker-game-design-and-monetization/)
- [Idle Games: The Mechanics and Monetization — Computools](https://computools.com/idle-games-the-mechanics-and-monetization-of-self-playing-games/)
- [Incremental game — Wikipedia](https://en.wikipedia.org/wiki/Incremental_game)
- [【2026年】クリッカーゲームアプリおすすめ8選 — アプリブ](https://app-liv.jp/games/casual/2532/)
- [クリッカー(放置系)おすすめ無料ゲームアプリまとめ — ゲームウィズ](https://gamewith.jp/gamedb/article/show/254420?from=ios)
- [クリッカーゲームアプリおすすめランキング20選 — MSYゲームズ](https://m-s-y.com/app/ranking/clicker-game-app/)
