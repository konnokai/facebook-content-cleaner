# Feed Sieve

## 驗證

- 這是無依賴、無建置步驟的 Manifest V3 Chrome 擴充功能；Chrome 直接載入 `src/`，不要自行加入 bundler 或產生檔案。
- `npm test` 執行 Node 內建測試；可用 `node --test tests/rules.test.mjs` 只跑規則測試，其他 suite 也直接指定對應檔案。
- `npm run check` 檢查 manifest、locale JSON、JavaScript 語法、HTML inline script、權限與 CSP；沒有 lint、typecheck 或 codegen 指令。
- 變更後依序執行 `npm test`、`npm run check`，再從 `chrome://extensions` 以專案根目錄載入 unpacked extension，重新載入 Facebook 分頁並測試受影響頁面。

## 執行邊界

- `manifest.json` 刻意使用兩個 content-script world：`src/content/facebook-data.js` 在 MAIN world、`document_start` 執行並讀取 Facebook React 內部資料；其餘 content script 在 isolated world、`document_idle` 執行。兩個 world 不共享 JavaScript 全域變數，靠 `fcc:scan-facebook-data` DOM event 和 `data-fcc-facebook-kind` 屬性溝通。
- `src/background.js` 是 Service Worker，負責 runtime message 與 `chrome.storage.local` 寫入。設定更新、統計增加與重設都必須經過現有 `writeQueue`，否則並行 read-modify-write 會遺失資料。
- `src/content/rules.js` 集中所有偵測規則；`src/content/observer.js` 負責動態 DOM 掃描、隱藏、恢復與計數；`src/content/index.js` 負責啟動和即時設定更新。`sponsored`、`suggested` 的 Facebook marker 優先於一般區塊規則，已標記卡片內的子候選不可重新恢復父卡片。
- Reel 規則必須保留 navigation 排除，不能因 `/reel` 連結隱藏 Facebook 頂部導覽。
- Reels、限時動態、推薦社團、生日提醒、你可能認識的人這些規則不比對 `dialog`、`menu` 和它們裡面的元素；通知項目常帶「生日」「連續短片」等字樣或 `/reel` 連結，彈出層只交給 `removeNotifications` 處理。

## 修改規則

- 優先使用 `role`、`aria-*`、穩定 link target 和相對結構；不要依賴 Facebook 產生的 CSS class。文字比對只放在已確認的 heading、header、navigation 或 dialog 範圍。
- 每個變更的規則都要在 `tests/fixtures/` 補一個正例和一個反例；fixture 必須去除姓名、帳號 ID、貼文內容、圖片 URL 與 tracking parameter。
- 不要加入遠端規則、telemetry、廣泛 host permission、CSP 放寬或動態執行程式碼。手動測試紀錄只保留日期、Facebook 語言、頁面類型與結果，不要包含私人帳號或貼文資料。
