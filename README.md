# 課堂搶答系統（Classroom Response System）

軟體工程期末專題（SpecKit 組）。把課堂上以填空式學習單（Guided Notes，Google Sheets）進行的搶答活動搬到線上：
老師匯入 Guided Notes、開啟與結束搶答、即時檢視各組作答，最後把搶答成功的答案寫回原本的 Google Sheets。
系統只在本機執行，同一台電腦以多個瀏覽器分頁同時扮演老師與不同組別的學生。

## 啟動（單一指令）

```bash
npm start
```

開啟 <http://localhost:3000/teacher> 進入老師端（密碼見 `.env` 的 `TEACHER_PASSWORD`）；
學生用另外的分頁開啟 <http://localhost:3000/student>，先確認暱稱（預填一個隨機的英文短名字，可換一個或自行修改，
可以和別人重複），再選擇組別加入（不需密碼，每個分頁的身分與暱稱各自獨立）。選組時看得到各組已加入人數；
加入後畫面顯示本組成員與和老師端同步的搶答計時，搶答開始後每一題都顯示題目敘述，同組同學送出的題目會標示送出者。
第一次使用前請先完成下方「環境需求」與「設定」。

## 環境需求

- Git（本文假設已安裝）
- Node.js 26（`package.json` 要求 `>=26 <27`，版本固定於 `.nvmrc`），npm 隨 Node 附帶
- 專案相依套件：`npm ci`
- 連線真實 Google Sheets 時需要 Google 服務帳號金鑰（自動化測試不需要）

## 從零準備環境

以下假設電腦上已安裝 Git，其餘都還沒裝。已經有 Node 26 的人可直接跳到「取得專案」的步驟。
每一步執行完請用該步驟的「確認」指令檢查結果，再往下走。

### Windows 10／11

以下指令都在 **PowerShell** 執行（不是 cmd）。

**1. 安裝 nvm-windows**（Windows 10 1709 以上內建 `winget`）

```powershell
winget install --id CoreyButler.NVMforWindows -e
```

安裝完成後**關閉並重新開啟 PowerShell**，讓 PATH 生效。

確認：

```powershell
nvm version
```

**2. 用 nvm 安裝並啟用 Node 26**

nvm-windows 不會讀取 `.nvmrc`，所以要明確指定版本號 26：

```powershell
nvm install 26
nvm use 26
```

若 `nvm use` 出現權限錯誤，請改用「以系統管理員身分執行」的 PowerShell 執行一次。

確認（`node` 應顯示 `v26.x.x`）：

```powershell
node -v
npm -v
```

**3. 取得專案並安裝相依套件**

```powershell
git clone https://github.com/kevin20694569/classroom_response_system.git
cd classroom_response_system
npm ci
```

**4. 設定 `.env` 與 Google 金鑰**

依下方「[設定](#設定)」章節完成：建立服務帳號與金鑰、放置 `service-account.json`、複製 `.env.example` 為 `.env`
並確認 `TEACHER_PASSWORD`（範本有預設值）與 `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`。`SESSION_SECRET` 不用填，伺服器會自動產生。
`GOOGLE_SERVICE_ACCOUNT_KEY_FILE` 要填 Windows 的完整路徑，例如 `C:\Users\<你的帳號>\.config\classroom-response-system\service-account.json`。

**5. 驗證並啟動**

```powershell
npm test
npm start
```

若 PowerShell 顯示「因為這個系統上已停用指令碼執行，所以無法載入 npm.ps1」，
執行一次 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` 後重開 PowerShell 即可。

### macOS

以下指令都在「終端機」（預設 zsh）執行。

**1. 安裝 Homebrew**

已經有 Homebrew 的人可跳過。沒有的話，依 <https://brew.sh> 首頁的指令安裝，完成後依畫面最後的 **Next steps** 把 `brew` 加入 PATH
（通常是在 `~/.zprofile` 加入 `eval "$(/opt/homebrew/bin/brew shellenv)"`），再開新的終端機視窗。

確認：

```bash
brew --version
```

**2. 安裝 nvm**

```bash
brew install nvm
mkdir -p ~/.nvm
```

在 `~/.zshrc` 加入以下三行（`brew install nvm` 結束時也會印出同樣的設定）：

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"
[ -s "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm"
```

存檔後**開新的終端機視窗**（或執行 `source ~/.zshrc`）。

確認：

```bash
nvm --version
```

**3. 取得專案並安裝 Node 26**

nvm 會讀取專案根目錄的 `.nvmrc`，所以不用另外指定版本：

```bash
git clone https://github.com/kevin20694569/classroom_response_system.git
cd classroom_response_system
nvm install
nvm use
```

確認（`node` 應顯示 `v26.x.x`）：

```bash
node -v
npm -v
```

**4. 安裝相依套件**

```bash
npm ci
```

**5. 設定 `.env` 與 Google 金鑰**

依下方「[設定](#設定)」章節完成：建立服務帳號與金鑰、放置 `service-account.json`、複製 `.env.example` 為 `.env`
並確認 `TEACHER_PASSWORD`（範本有預設值）與 `GOOGLE_SERVICE_ACCOUNT_KEY_FILE`。`SESSION_SECRET` 不用填，伺服器會自動產生。
`GOOGLE_SERVICE_ACCOUNT_KEY_FILE` 要填完整路徑，例如 `/Users/<你的帳號>/.config/classroom-response-system/service-account.json`。

**6. 驗證並啟動**

```bash
npm test
npm start
```

### SESSION_SECRET 不用設定

`SESSION_SECRET` 是簽章分頁身分 token 用的密鑰。**不需要自己產生**：`.env` 沒填時，伺服器第一次啟動會自動產生一把隨機密鑰，
存在 `data/session-secret`（`data/` 已被 `.gitignore` 排除，不會進 Git），之後重啟都讀同一把，所以重啟伺服器後各分頁的登入身分仍然有效。

- 想換一把新的（讓所有分頁的身分失效）：關閉伺服器，刪除 `data/session-secret` 再啟動。
- 想自己指定（例如多台機器共用同一把）：在 `.env` 填 `SESSION_SECRET=`（至少 32 字元），填了就一律以 `.env` 為準。
  產生方式（Windows 與 macOS 通用，不需要 openssl）：

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

### 之後新開終端機時

- Windows：`nvm use 26` 會設為全域預設，不必每次重做。
- macOS：在專案根目錄執行 `nvm use` 即可切回專案指定的版本；想讓新終端機自動使用，可執行 `nvm alias default 26`。

## 設定

只跑自動化測試（`npm test`）時**不需要**這一節；要啟動伺服器（`npm start`、`npm run dev`）或連線真實 Google Sheets 才需要。
`.env`、金鑰檔與 `data/`（活動保存檔）都不納入版控，也不要貼到聊天或文件裡。

### 1. 建立 Google 服務帳號與金鑰

系統以「服務帳號」（專屬於本系統的 Google 機器人帳號）的身分讀寫 Guided Notes，不會用你自己的 Google 帳號登入。
完整的圖文步驟見 [quickstart.md §1.2～1.3](specs/001-teacher-quiz-session/quickstart.md)，摘要如下：

1. 到 [Google Cloud Console](https://console.cloud.google.com/) 建立專案，並啟用 **Google Sheets API**。
   建議用個人 Gmail 操作，學校帳號可能被組織政策禁止建立金鑰。
2. 建立服務帳號：「您要存取哪種資料？」選**應用程式資料**，不需要授予任何角色。
3. 在該服務帳號的「金鑰」分頁新增 **JSON** 金鑰並下載（只能下載這一次，遺失要重建）。
4. 記下服務帳號的 email（金鑰 JSON 裡的 `client_email`，格式像 `crs-sheets@<專案ID>.iam.gserviceaccount.com`）。
5. 把要匯入的 Guided Notes 分享給這個 email，權限選**編輯者**，並取消勾選「通知使用者」。
   課程範例請先「建立副本」到自己的雲端硬碟再分享副本。沒有分享時，匯入會顯示「無法存取文件」。

### 2. 放置金鑰檔

把下載的 JSON 金鑰改名為 `service-account.json`，放在以下**其中一個**位置：

| 位置 | 說明 |
|------|------|
| 專案根目錄（`classroom_response_system/service-account.json`） | 簡單，`.gitignore` 已排除 `service-account*.json`，不會被 commit。若專案資料夾被 OneDrive、iCloud、Dropbox 等雲端同步，金鑰也會被同步到雲端，請留意 |
| 專案以外的資料夾（建議） | macOS：`~/.config/classroom-response-system/service-account.json`；Windows：`%USERPROFILE%\.config\classroom-response-system\service-account.json`，不受專案資料夾同步影響 |

Windows（以放在專案外為例）：

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.config\classroom-response-system"
Move-Item "$env:USERPROFILE\Downloads\<下載的金鑰檔名>.json" "$env:USERPROFILE\.config\classroom-response-system\service-account.json"
```

macOS（以放在專案外為例）：

```bash
mkdir -p ~/.config/classroom-response-system
mv ~/Downloads/<下載的金鑰檔名>.json ~/.config/classroom-response-system/service-account.json
chmod 600 ~/.config/classroom-response-system/service-account.json
```

### 3. 建立 `.env`

在專案根目錄複製範本：

```powershell
Copy-Item .env.example .env
```

```bash
cp .env.example .env
```

用編輯器開啟 `.env`，依下表填寫。每行格式是 `變數名=值`，等號後面**不要加引號、不要留空格**：

| 變數 | 必填 | 說明 | 規則 |
|------|------|------|------|
| `TEACHER_PASSWORD` | 是 | 老師端登入密碼 | 至少 8 個字；`.env.example` 的預設值是 `TEACHER_PASSWORD`，複製後可直接使用，想換成自己的密碼也可以 |
| `SESSION_SECRET` | 否 | 簽章分頁身分 token 用的隨機字串 | **建議不填**，伺服器會自動產生並保存在 `data/session-secret`；要自己指定時至少 32 個字，見上方「SESSION_SECRET 不用設定」 |
| `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` | 是 | 金鑰 JSON 的位置 | 必須是**完整的絕對路徑**：不能用 `~`，也不能用 `./` 之類的相對路徑；檔案必須存在 |
| `PORT` | 否 | 伺服器埠號 | 1～65535，預設 `3000`；埠號被其他程式占用時改這裡 |
| `DATA_DIR` | 否 | 活動狀態保存目錄 | 預設 `./data`（已被 `.gitignore` 排除）；留空等同使用預設值 |

填寫範例（括號內請換成自己的值）：

```dotenv
# Windows：金鑰放在專案根目錄
TEACHER_PASSWORD=TEACHER_PASSWORD
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=C:\Users\<你的帳號>\<專案所在位置>\classroom_response_system\service-account.json
PORT=3000
DATA_DIR=./data
```

```dotenv
# Windows：金鑰放在專案以外
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=C:\Users\<你的帳號>\.config\classroom-response-system\service-account.json
```

```dotenv
# macOS：金鑰放在專案以外
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=/Users/<你的帳號>/.config/classroom-response-system/service-account.json
```

如果金鑰放在專案根目錄，可以用下列指令印出要填入的完整路徑（Windows 與 macOS 各一行）：

```powershell
Join-Path (Get-Location).Path 'service-account.json'
```

```bash
echo "$PWD/service-account.json"
```

> `.env` 裡的路徑不能跨電腦或跨系統共用：從別人的電腦（例如 macOS 的 `/Users/...`）複製來的 `.env`，
> 在你的電腦上一定要把這個路徑改成自己電腦上的實際位置。

### 4. 驗證設定

```bash
npm start
```

伺服器啟動時會驗證 `.env`，缺少或格式錯誤就拒絕啟動，並列出是哪一個變數與原因（不會印出變數的值）：

| 看到的訊息 | 原因與處理 |
|-----------|-----------|
| `GOOGLE_SERVICE_ACCOUNT_KEY_FILE：找不到這個金鑰檔` | 路徑下沒有檔案。確認金鑰已放好、檔名正確，且路徑是**這台電腦**上的位置 |
| `GOOGLE_SERVICE_ACCOUNT_KEY_FILE：必須是完整的絕對路徑` | 用了 `~` 或相對路徑，改成完整路徑 |
| `TEACHER_PASSWORD：至少需要 8 個字` | 密碼太短 |
| `SESSION_SECRET：至少需要 32 個字` | 你在 `.env` 自己填的密鑰太短。直接刪掉這一行讓系統自動產生，或換成 32 字元以上的字串 |
| `xxx：缺少此變數` | `.env` 裡沒有這個必填變數，或 `.env` 不在專案根目錄 |
| 老師端匯入時顯示「無法存取文件」 | Guided Notes 還沒分享給服務帳號 email（編輯者） |

## Guided Notes 準備規則

系統依文件內容動態辨識題目，不使用固定的儲存格位置，規則見
[contracts/guided-notes-format.md](specs/001-teacher-quiz-session/contracts/guided-notes-format.md)：

- 需要一列同時有「題號」與「作答」的表頭（「題目」欄可有可無）
- 題號可寫成 `1`、`1.`、`1、`、`Q1`、`第1題`，或全形數字
- 同一題號涵蓋多個作答格即為題組；作答格的「（1）」「（2）」標記可有可無，有寫就必須從（1）連號
- 「題目」欄的敘述會用於老師端的題目預覽，搶答開始後也會顯示在學生端（沒有「題目」欄也能匯入，畫面會顯示
  「文件未提供題目敘述」）
- 匯出時答案寫入原本的作答格，題組保留子題標記（例如「（1）CPU」）。匯出可選三種模式，寫入位置見
  [002 contracts/guided-notes-format.md](specs/002-teacher-dashboard-enhancements/contracts/guided-notes-format.md)：
  - 只有答案：只寫作答格，其他儲存格不會被改動
  - 答案＋組別時間欄：另在表頭列最右側新增「搶答組別」「提交時間」「搶答送出者」三欄（已有的欄沿用）
  - 答案＋格內附註行：答案下方另起一行，以灰色小字記錄組別、送出者暱稱與提交時間（例如「〔第 1 組｜Milo｜時間〕」）

### 匯出結果 CSV（子功能 005）

搶答結束後，老師端「匯出 CSV」區塊的按鈕可以下載所有組別的送出紀錄，存成 `搶答結果_YYYYMMDD-HHmm.csv`
（時間為開啟搶答的時間；同一場活動重複匯出的檔名與內容完全相同）。這個匯出與上面的「寫回 Guided Notes」互相獨立，
不會改動 Guided Notes 文件。

- 每一列是一筆送出紀錄，欄位依序為：題號、子題、組別、送出者暱稱、答案、搶答順位、送出時間、是否搶答成功
- 題組的每個子題各一列（「子題」欄為文件上的標記，如「（1）」）；沒有任何組別作答的題目有一列，答案為「無人作答」
- 依題號排序，同一題再依搶答順位排序；不只列出搶答成功的組別
- 檔案使用 UTF-8（含 BOM），用 Excel 直接開啟中文不會亂碼；答案含逗號、換行、雙引號時依 CSV 規則加上引號，
  以 `=` `+` `-` `@` 開頭的內容會在前面加上 `'`，避免被 Excel 當成公式執行
- 搶答尚未結束時按鈕停用並顯示「搶答結束後才能匯出 CSV。」；伺服器也只允許老師在搶答結束後下載

## 開發與測試

| 指令 | 說明 |
|------|------|
| `npm run dev` | 開發模式（後端 + Vite 熱重載，網頁在 <http://localhost:5173/teacher>） |
| `npm test` | 執行所有自動化測試（不連線 Google、不需真實憑證） |
| `npm run typecheck` | TypeScript 型別檢查（strict） |
| `npm run lint` | ESLint 檢查 |
| `npm run format` | Prettier 格式化 |
| `npm run simulate -- --group 1 --question 1 --answers "CPU"` | 模擬學生送出（自動化與壓力測試用；學生畫面見 `/student`） |

人工驗證步驟見 [001 quickstart.md §4](specs/001-teacher-quiz-session/quickstart.md)、
[002 quickstart.md §4](specs/002-teacher-dashboard-enhancements/quickstart.md)、
[003 quickstart.md §4](specs/003-student-quiz-participation/quickstart.md) 與
[004 quickstart.md §4](specs/004-student-side-refinements/quickstart.md) 與
[005 quickstart.md §5](specs/005-results-csv-export/quickstart.md)。

## 專案結構

```text
packages/shared/   前後端共用契約（Zod schema 與型別）
apps/server/       後端：Fastify HTTP API、Socket.IO 即時推播、Google Sheets 存取
apps/web/          前端：React + Vite + Tailwind CSS（老師端 /teacher、學生端 /student）
scripts/           模擬學生腳本
specs/             SpecKit 文件（spec、plan、tasks、contracts…）
diagrams/          PlantUML 圖表（.puml 與 .png）
```

## 子功能

| 編號 | 內容 | 狀態 |
|------|------|------|
| 001 | 使用者角色與老師端搶答活動管理（匯入、開啟／結束、檢視、匯出） | 已實作 |
| 002 | 老師端介面優化（題目預覽、搶答計時、提交時間提示、匯出模式） | 已實作 |
| 003 | 學生端畫面（`/student`：加入組別、作答與送出、檢視結果） | 已實作 |
| 004 | 學生端細修（暱稱、各組人數與本組成員、學生端題目敘述、送出者暱稱與匯出、學生端計時） | 已實作 |
| 005 | 搶答結果匯出 CSV（所有送出紀錄、題組逐子題、無人作答、Excel 相容） | 已實作 |
