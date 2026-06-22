# hycert 列表篩選修整清單

> 處理兩類問題:
> (A) **client-side 篩選 bug** — 篩選/搜尋只對「當前 server 頁」做,total/分頁卻是後端「全部」的 → 筆數錯、分頁錯、結果不完整。
> (B) **status filter 缺漏** — 篩選選項沒涵蓋後端實際所有狀態值,或根本沒有狀態篩。
>
> **正確範本**:`cert-list` / `csr-list` / `deploy-list` 都是 server-side(把 `search`/`status` 丟給 API,後端篩+分頁),照抄即可。
> 撰寫:2026-06-22。逐項改、逐項測。

## ✅ 完成狀態(2026-06-22,全 5 項已部署 + 測試 OK)

| 項目 | commit | 狀態 |
|------|--------|------|
| 1 部署目標 補 `deploying` | ui `02f8cd6` | ✅ 測試 OK |
| 2 Agent server-side + active/disabled 兩軸 | api `574bcf6` / ui `33d4401` | ✅ 測試 OK |
| 3 ACME 訂單 search + 狀態篩 | api `91a0109` / ui `43f440d` | ✅ 測試 OK |
| 4 ACME 帳戶 search + 狀態篩 | api `91a0109` / ui `43f440d` | ✅ 測試 OK |
| 5 Token search + 狀態篩 | api `91a0109` / ui `43f440d` | ✅ 測試 OK |

全部七個列表現在篩選/搜尋皆 server-side、筆數/分頁正確、狀態篩涵蓋完整。

## 現況總表

| 列表 | client-side bug (A) | status filter 缺漏 (B) |
|------|:---:|---|
| 憑證列表 cert-list | ✅ 無(server-side) | ✅ 完整 |
| CSR 管理 csr-list | ✅ 無(server-side) | ✅ 完整 |
| 部署目標 deploy-list | ✅ 無(server-side) | ❌ deploy_status 缺 `deploying`;另無 active/disabled 篩 |
| Agent 管理 agent-list | ❌ search + status 都 client-side | ❌ 只有 online/offline,缺 active/disabled(停用) |
| Token 管理 token-list | ❌ search client-side | ❌ 完全無狀態篩(active/revoked) |
| ACME 帳戶 acme-account-list | ❌ search client-side | ❌ 無狀態篩(active/inactive),後端已支援 status |
| ACME 訂單 acme-order-list | ❌ search client-side | ❌ 無狀態篩(pending/processing/valid/failed/cancelled),後端已支援 status |

---

## 修整項目(建議順序:小→大、低風險→高影響)

### ☐ 項目 1 — 部署目標 deploy-list:補 `deploying` 篩選選項
- **問題**:filter 選項 `['', 'deployed', 'pending', 'failed']`(`deploy-list.tsx:462`)缺 `deploying`;但 model `deploy_status` 有 `pending/deploying/deployed/failed`(`deployment/model.go:25`),`deploy-list.tsx:81` 也有渲染 deploying。卡在 deploying 的部署篩不到。
- **前端**:`deploy-list.tsx:462` 選項陣列加 `'deploying'` + 對應 label(i18n)。
- **後端**:確認 `deploy_status` 篩受理 `deploying`(`deployment/model.go:64-65` 註解只列 pending|deployed|failed,需確認 repository 是否照單接受任意值或要加白名單)。
- **(選配)**:deploy-list 另加 `status`(active/disabled)篩——後端 `model.go:64` 已支援 `status` 參數,前端沒接。
- **工**:小(前端近乎一行 + i18n;後端確認)。**風險**:低。
- **測試**:有 deploying 狀態的部署能被篩出;原本 deployed/pending/failed 不受影響。

### ☐ 項目 2 — Agent 管理 agent-list:server-side 化 + 補 active/disabled 篩(最高影響)
- **問題 A**:`agentRegistrationApi.list({page,page_size})` 沒帶 `search`/`status`,前端 `.filter()` 單頁(`agent-list.tsx:71-92`)→ 「共 N 台」「分頁」與篩選對不上、離線清單漏列(你截圖那個)。
- **問題 B**:狀態篩只有 online/offline(算出來的);stored `status`(active/disabled,`agent/model.go:166`)沒有篩。
- **後端**(`internal/agent` registration list:handler/service/repository):
  - 加 `search`(name/hostname/agent_id/IP，`LIKE`)。
  - 加 `status`:`online`/`offline`(用 `last_seen_at` + `poll_interval×2` 門檻算,參考 `agent-list.tsx:29` isOnline)、`active`/`disabled`(stored 欄位)。
  - 篩完再分頁、回正確 total/total_pages。
- **前端**:`agent-list.tsx` 把 `search`/`status` 丟進 `list()`,移除 client-side `.filter()`(比照 `cert-list`);狀態篩列加上 active/disabled(與 online/offline 如何並存需設計,見備註)。
- **工**:中大(後端門檻計算 + 兩種狀態軸)。**風險**:中。
- **測試**:離線 filter 顯示所有離線且筆數/分頁正確;搜尋跨頁有效;能篩出 disabled。
- **備註**:online/offline 與 active/disabled 是兩個軸,UI 要想清楚(兩排篩鈕?還是下拉?)。

### ☐ 項目 3 — ACME 訂單 acme-order-list:server-side 搜尋 + 新增狀態篩
- **問題 A**:`acmeOrderApi.list({page,page_size})` + 前端 `.filter()` 搜尋(`acme-order-list.tsx:97-105`)。
- **問題 B**:無狀態篩;orders 有 5 種狀態 `pending/processing/valid/failed/cancelled`(`acme/model.go:73`);**後端 list 已有 `status` form 參數**(`acme/model.go:179`)。
- **後端**:確認/補 `search`(domains/dns_provider);確認 `status` 參數有實際套用到查詢。
- **前端**:`list()` 帶 `search`/`status`、移除 client-side filter;新增狀態篩 UI(5 個 + 全部)。
- **工**:中。**風險**:低中。
- **測試**:搜尋跨頁有效、筆數正確;5 種狀態都篩得到。

### ☐ 項目 4 — ACME 帳戶 acme-account-list:server-side 搜尋 + 新增狀態篩
- **問題 A**:`acmeAccountApi.list({page,page_size})` + 前端 `.filter()` 搜尋(`acme-account-list.tsx:82-90`)。
- **問題 B**:無狀態篩;accounts 有 `active/inactive`(`acme/model.go:23`);**後端 list 已有 `status` form 參數**(`acme/model.go:153`)。
- **後端**:確認/補 `search`(name/email);確認 `status` 套用。
- **前端**:`list()` 帶參數、移除 client filter;新增狀態篩 UI(active/inactive/全部)。
- **工**:中。**風險**:低中。
- **測試**:搜尋跨頁、筆數正確;active/inactive 篩得到。

### ☐ 項目 5 — Token 管理 token-list:server-side 搜尋 + 新增狀態篩
- **問題 A**:`agentTokenApi.list({page,page_size})` + 前端 `.filter()` 搜尋(`token-list.tsx:80-91`)。
- **問題 B**:無狀態篩;tokens 有 `active/revoked`(`agent/model.go:24`)。
- **後端**(`internal/agent` token list):加 `search`(name/prefix/label/created_by)+ `status`(active/revoked)。
- **前端**:`list()` 帶參數、移除 client filter;新增狀態篩 UI(active/revoked/全部)。
- **工**:中。**風險**:低中。
- **測試**:搜尋跨頁、筆數正確;active/revoked 篩得到。

---

## 部署提醒
- 前端改動 → hycert-ui(Wujie 子應用,依現有 hycert-ui 部署流程)。
- 後端改動 → hycert-api **容器/Quadlet 部署**:commit/push main → 等 CI「Build & Push」green → 主機 `sudo bash /hysp/hycert-api/deployment/deploy.sh`(podman pull + restart)。詳見 memory `hycert-api-container-deployment`。
- 凡動到後端 list 端點的項目(2/3/4/5),前後端要一起上;項目 1 主要是前端(後端只確認)。
