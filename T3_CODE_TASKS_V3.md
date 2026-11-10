# T3 Code 多模型协同测试任务集 v3 · testProject（Egg.js）

> 3 个基于当前仓库的任务。每个任务都要求拆成 **至少 3 个可并行的实现子任务 + 1 个收口子任务**，并通过文件所有权约束保证：所有 Agent 在同一个工作区里并行编码，也不会出现文件冲突。
>
> 本文件只包含需求、接口契约、协同规则和验收清单。**不包含参考实现、判定测试、预期输出、坑位说明或实测结果**；验收由评测者在任务结束后执行。

---

## 一、这组任务在测什么

不是测“模型能不能写出一个接口”，而是测多模型协同里的几个关键动作：

1. **拆解**：总控能否把一个需求拆成 3 个以上互不依赖、可并行的实现单元。
2. **所有权**：每个子任务是否只碰自己的文件；既有文件是否只由收口子任务修改。
3. **契约遵循**：子任务拿不到其他子任务的上下文，能否只凭 brief 里的接口契约完成实现。
4. **自测**：子任务是否在没有路由、没有其他人的代码时也能验证自己。
5. **收口**：是否有人统一注册路由、接前端入口、补 HTTP 集成测试、跑全量。
6. **独立评审**：是否有一个不同模型的评审者，按 `文件:行号` 给出可定位的问题，而不是泛泛而谈。

因此，三个任务分别覆盖三种协同形状：

| 任务 | 主题 | 协同形状 | 并行子任务 | 收口子任务 | 难度 |
| --- | --- | --- | --- | --- | --- |
| T1 | 页面访问分析 API | 3 个独立只读端点，每个子任务一条纵切 | 3 | 1 | ★★★ |
| T2 | 访问记录维护 API | 3 个独立写端点 + 新前缀配置 | 3 | 1 | ★★★ |
| T3 | 健康巡检报告 | 3 个独立纯函数模块 + 1 个聚合端点 | 3 | 1 | ★★☆ |

三个任务互相独立，**一次只跑一个任务**；每个任务都假设自己从基线开始。

---

## 二、基线

| 项 | 值 |
| --- | --- |
| 运行时 | Node v24.22.2，npm 11.19.1 |
| 框架 | Egg 3.34.0（`package.json` 声明 `^3.17.5`） |
| 现有单测 | `npx egg-bin test` → **17 passing** |
| Lint | `npx eslint .` → **0 error** |
| 现有接口 | `GET /`、`GET /test`、`/api/debug-config`（GET/POST/DELETE/consume）、`/api/page-visit`（GET/POST） |
| 网络 | 视为离线：不要安装新依赖 |
| 生成物 | `logs/`、`run/`、`typings/` 为生成/日志目录，不要手改 |

三个操作约定：

1. **验收用只读命令**：`npx egg-bin test` 和 `npx eslint .`。不要用 `npm test`，它会执行 `eslint --fix`，把格式问题自动修掉，看不出 Agent 是否真的遵守了风格。
2. **开跑前打标签**：在当前 HEAD 打一个 `baseline`，每个任务结束后复位。详见第九节。
3. **一次一个任务、一个工作区**：同一时间不要并行跑两个任务。任务内的并行只发生在子任务之间。

---

## 三、通用协同规则（所有任务都适用）

### 3.1 角色

| 角色 | 职责 | 是否写业务代码 |
| --- | --- | --- |
| 总控（父线程） | 读仓库、拆解、写所有权表、派活、收口、汇总、发起评审 | 并行阶段不写；收口阶段可以接线 |
| 3 个并行子任务 | 各自实现一个独立单元 + 自测 + 前端入口（如适用） | 只写自己的新文件 |
| 1 个收口子任务 | 注册路由、改配置、合并前端入口、补 HTTP 集成测试、跑全量 | 只改既有文件和新增接线文件 |
| 1 个评审子任务 | 独立评审 diff，按 `文件:行号` 列问题 | 不改代码 |

### 3.2 文件所有权：并行子任务“只新建”，收口“改既有”

这是保证同工作区无冲突的核心规则：

- **任务开始时已经存在的文件，一律视为共享文件。** 3 个并行子任务**不得修改任何既有文件**，只能新建文件。
- **只有收口子任务可以修改既有文件。** 它负责 `app/router.js`、`config/config.default.js`（如需要）、`app/public/assets/js/api-debug/endpoints.js` 等接线文件，以及新增集成测试。
- 并行子任务新建的文件路径必须由总控在派活前分配，**所有权表里不能出现重复路径**。
- 所有权表里还要写清每个新 controller 的导出名、方法名，以及每个 preset 文件的导出名；收口子任务按这张表注册路由和合并入口，避免“文件对上了、名字对不上”。
- 收口阶段是串行的，**不与其他子任务同时进行**。收口可以修复并行子任务文件里的契约偏差，但必须在报告里列出；不能借机重写实现。
- 同一时间，一个文件只能有一个写入者。即使是“只改一行”，也由收口子任务统一改。

### 3.3 派发方式

- 使用 `delegate_task`，`isolation` 用 `shared`，**不要用 `worktree`**。本任务集就是要验证同一工作区下的文件级隔离。
- 3 个并行子任务尽量派给**不同 provider / 不同模型**；收口和评审也尽量换模型。
- 子线程**不继承父线程历史**。每个 brief 必须自包含：背景、接口契约、文件白名单、验收、禁止改动、测试命令。建议至少包含这几段：
  - 角色与目标；
  - 与本子任务相关的那部分契约（不要把整份任务文档丢过去）；
  - 允许新建的文件路径（白名单）；
  - 禁止修改的文件（尤其是既有文件）；
  - 验收标准；
  - 测试命令；
  - 依赖与假设（例如“路由由收口子任务注册，你只需提供 controller”）。
- 默认 `mode: 'async'`，等 3 个并行子任务都完成后再派收口。不要在子任务运行期间轮询。
- 父线程在派活前先输出一张「子任务 → 模型 → 新建文件 → 测试命令」表；没有这张表，不要开始派活。

### 3.4 每个并行子任务的交付物

每个并行子任务至少要交付：

1. 一个**可独立 `require` 的纯业务模块**（放在 `app/lib/...`，不依赖 Egg 的 `ctx`，入参和返回值都是普通数据）；
2. 一个**薄 controller**（只做参数提取和响应封装；如果该子任务对应 HTTP 端点）；
3. 一个**测试文件**（测纯业务模块，不启动 app）；
4. 如果该子任务对应一个新增 HTTP 端点，还要一个**新的前端 preset 文件**（见 3.5）。

不能只写测试、不能只写前端、不能把业务实现留给收口子任务。把逻辑放在纯模块里不是为了“多写文件”，而是为了让并行子任务能在不启动整个 Egg app 的情况下自测——Egg 启动时会加载所有 controller，别人的半成品会干扰你。

这里的“纯模块”指**不依赖 Egg `ctx`、不读全局请求状态**；T2 的 clear / prune / touch 会修改传入的 store，这是预期行为，不算违反“纯模块”约定。

### 3.5 前端入口约定

- 每个新增端点对应一个**新的 preset 文件**，由实现该端点的并行子任务创建。
- preset 文件放在 `app/public/assets/js/api-debug/endpoints/` 下，导出 `export const presets = [ ... ]`。
- 收口子任务只负责在 `app/public/assets/js/api-debug/endpoints.js` 里 `import` 并合并这些 preset，**不得代写 path / hint / id**。
- 既有 `endpoints.js` 里的条目和顺序保持不变；新条目追加在末尾。
- 所有 preset 的 `id` 必须唯一。
- 例外：T3 只有一个端点，按 6.3.3 由收口子任务直接添加，不单独拆前端子任务。

### 3.6 测试约定

- 并行子任务不要为了测试去改 `app/router.js`。路由由收口子任务统一注册。
- 并行子任务的测试**只测自己的纯模块**，不要调用 `mm.app()` 启动整个应用；否则 Egg 会加载其他子任务正在写的 controller，半成品会让你的测试无辜失败。
- 纯模块不直接读 `Date.now()`、`ctx` 或全局请求状态；需要时间、`requestId`、容量上限时，由 controller 作为参数传入。这样测试可以用固定输入，结果稳定。
- 收口子任务必须写 HTTP 集成测试：真正起 app、走 `app.httpRequest()`，覆盖成功、400、`x-request-id` 和“既有接口没被破坏”。
- 不要修改、删除或弱化既有 17 条测试。既有测试是回归基线，不是可以调整的“旧断言”。
- 常用命令：
  - 单个测试文件：`npx egg-bin test test/app/lib/<name>.test.js`（并行阶段只跑自己的）
  - 全量：`npx egg-bin test`（留给收口阶段）
  - 只读 lint：`npx eslint .`（不要用会 `--fix` 的 `npm test`）

### 3.7 禁止事项

- 不新增依赖，不改 `package.json`。
- 不改 `.eslintrc`、`.eslintignore`、`package.json` 里的脚本。
- 不改 `logs/`、`run/`、`typings/`。
- 不把多个子任务的业务逻辑塞进一个文件来“省事”。
- 不为了让测试通过而放宽断言、删测试、改测试超时。
- 不使用 `git worktree`、不切换分支、不合并分支；所有改动留在当前工作区。

### 3.8 收口子任务的验收动作

1. 注册路由，确认路径和 HTTP 方法正确。
2. 如需要，更新 `config/config.default.js`。
3. 在 `endpoints.js` 中合并前端 preset。
4. 新增 HTTP 集成测试。
5. 跑 `npx egg-bin test` 和 `npx eslint .`。
6. 输出：改了哪些既有文件、新增了哪些文件、全量测试结果、lint 结果、遗留问题。

### 3.9 评审子任务的输出格式

- 结论：`通过` 或 `不通过`。
- 问题列表：`文件:行号` + 严重级别（阻断/建议）+ 一句可执行的修复建议。
- 不要直接改代码；不要自动合并。
- 如果评审发现问题，总控把问题发回原实现子任务修复；复审要新开一轮评审，不要复用上一轮结论。

---

## 四、任务 T1 · 页面访问分析 API

### 4.1 目标

在现有 `app.pageVisitStore` 之上，新增 3 个只读分析接口，并在调试页增加对应入口。三个接口彼此独立，适合拆成 3 个并行子任务。

业务逻辑放在纯模块里（统计、日期窗口、排序），controller 只解析查询参数并调用纯模块；`trend` 需要的“当前时间”由 controller 传入，纯模块不直接读系统时间。

### 4.2 给总控的 prompt（直接粘贴）

> 你是总控，只做规划、派活、收口和评审，不要直接写业务代码。
>
> 任务：实现本文件 **T1「页面访问分析 API」**，只做 T1，不要动 T2/T3。
>
> 硬约束：
> 1. 先读仓库和既有测试，确认基线：`npx egg-bin test` 17 passing，`npx eslint .` 0 error。
> 2. 在派活前，先输出「子任务 → 模型 → 新建文件 → 测试命令」所有权表。至少 3 个并行子任务；每个子任务只能新建自己的文件，路径两两不重复。
> 3. 任务开始时已存在的文件都算共享文件，并行子任务一律不得修改；只有收口子任务可以改既有文件。
> 4. 3 个并行子任务用 `delegate_task` 派给不同模型/供应商，`isolation` 用 `shared`，不要用 worktree；每个 brief 必须自包含（背景、契约、文件白名单、验收、禁止改动、测试命令）。
> 5. 3 个并行子任务全部完成后，再派收口子任务：注册路由、合并前端入口、写 HTTP 集成测试、跑全量。
> 6. 最后派一个不同模型的评审子任务，按 `文件:行号` 列问题；不要自动合并。
> 7. 不新增依赖；不改既有测试；不为了让测试通过而放宽断言。
>
> 输出：所有权表、每个子任务的结果、全量测试/lint 结果、评审结论、待办。

### 4.3 功能契约

通用约定：

- 成功统一 `200`，响应体 `{ data: ... }`。
- 参数非法统一 `400`，响应体 `{ message: string }`，`message` 非空。
- 所有响应都带 `x-request-id`（现有中间件已提供）。
- 数据源是 `app.pageVisitStore`（`Map`），记录形如 `{ tabId, requestId, openedAt, lastOpenedAt, openCount }`。
- 三个接口都**只读**：不得修改 store 的内容或顺序，不得为了读数据而创建 store。
- store 不存在时按空处理。
- `generatedAt` 使用 ISO 8601 字符串。
- 纯模块不得依赖 Egg `ctx`，也不直接读系统时间；需要“当前时间”时由 controller 作为参数传入。

#### 4.3.1 `GET /api/page-visit/summary`

- 成功：`{ data: { totalTabs, totalOpenCount, maxOpenCount, generatedAt } }`。
- `totalTabs`：记录条数。
- `totalOpenCount`：所有记录 `openCount` 之和；只累加有限数字。
- `maxOpenCount`：`openCount` 最大值；空 store 为 `0`。
- 空 store：三个计数都是 `0`，仍返回 `generatedAt`。
- 不解析业务查询参数；未知参数忽略。

#### 4.3.2 `GET /api/page-visit/trend?days=7`

- `days` 可选，默认 `7`；必须是十进制整数，范围 `1..30`（含）。
- 非法值返回 `400`：`0`、`31`、`-1`、`abc`、`1.5`、空串、重复参数（`?days=1&days=2`）都算非法。
- 成功：`{ data: [ { date, tabs } ], days }`，`days` 回显为数字。
- `date` 为 `YYYY-MM-DD`，UTC 日历日。
- 窗口：以请求到达时的 UTC 日期为最后一天，向前共 `days` 天（含当天），按日期升序。
- `tabs`：`lastOpenedAt` 落在该 UTC 日的记录条数；窗口内没有记录的日期也要返回，`tabs: 0`。
- 返回数组长度必须等于 `days`。
- 不修改 store。

#### 4.3.3 `GET /api/page-visit/ranking?limit=5`

- `limit` 可选，默认 `5`；必须是十进制整数，范围 `1..50`（含）。
- 非法值返回 `400`：`0`、`51`、`-1`、`abc`、`1.5`、空串、重复参数都算非法。
- 成功：`{ data: [ { tabId, openCount, lastOpenedAt } ], total }`。
- 排序：`openCount` 降序；`openCount` 相同时 `tabId` 按字符串升序（直接用 `<` / `>` 比较，不做本地化排序）。
- `data` 最多 `limit` 条。
- `total` 是 store 里的记录总数，不是返回条数。
- 空 store：`{ data: [], total: 0 }`。
- 不修改 store。

#### 4.3.4 前端入口

- 三个接口各由对应实现子任务新建一个 preset 文件，导出 `presets`。
- `group` 统一为 `页面访问`；`id` 互不重复；`method` 为 `GET`。
- `path` 带一个可读的示例查询参数（如 `?days=7`、`?limit=5`）。
- `hint` 用中文说明用途、参数、成功响应和 400 场景；不要写实现细节。
- 收口子任务在 `endpoints.js` 中合并，既有条目不动。

### 4.4 验收清单

- [ ] `summary` 在空 store 下返回 `0/0/0` 和合法 ISO `generatedAt`。
- [ ] `summary` 在非空 store 下 `totalTabs`、`totalOpenCount`、`maxOpenCount` 正确。
- [ ] `trend` 默认返回 7 条，升序，包含当天，空缺日期 `tabs: 0`。
- [ ] `trend` 对 `1..30` 边界值可用，`days` 回显为数字。
- [ ] `trend` 对 `0`、`31`、`-1`、`abc`、`1.5`、空串、重复参数返回 400，`message` 非空。
- [ ] `trend` 的计数按 `lastOpenedAt` 的 UTC 日期归属。
- [ ] `ranking` 默认最多 5 条，`total` 是 store 总数。
- [ ] `ranking` 降序正确，同值按 `tabId` 升序。
- [ ] `ranking` 对非法 `limit` 返回 400。
- [ ] `ranking` 空 store 返回 `{ data: [], total: 0 }`。
- [ ] 调用三个接口前后，store 内容完全一致（深比较）。
- [ ] 三个响应都带 `x-request-id`。
- [ ] 业务逻辑在纯模块中，纯模块测试不启动 app；controller 只做参数解析和响应封装。
- [ ] 调试页出现三个新入口，既有入口数量和顺序不变，`id` 无重复。
- [ ] 既有 17 条测试不改也能过；`npx eslint .` 无错误。
- [ ] 没有新增依赖，没有修改既有测试。

### 4.5 收口要求

- 在 `app/router.js` 注册 3 个 GET 路由。
- 在 `endpoints.js` 合并 3 个 preset。
- 新增 `test/app/controller/...integration.test.js`（文件名自定），用 `app.httpRequest()` 覆盖：
  - 空 store 和种子 store；
  - 三个接口的成功响应；
  - 非法参数 400；
  - store 不被修改；
  - `x-request-id`；
  - 既有 `/api/page-visit` 仍正常。
- 跑全量测试和 lint。

---

## 五、任务 T2 · 访问记录维护 API

### 5.1 目标

新增一组维护 `app.pageVisitStore` 的写接口，统一挂在新前缀 `/api/visit-admin` 下。三个操作彼此独立，各自一个 controller，适合 3 个并行子任务；收口子任务负责路由、配置和前端入口。

业务逻辑放在纯模块里（clear / prune / touch），controller 只解析请求体并调用纯模块；`requestId`、当前时间、`maxTabs` 都由 controller 传入，纯模块不读 `ctx` 或系统时间。

### 5.2 给总控的 prompt（直接粘贴）

> 你是总控，只做规划、派活、收口和评审，不要直接写业务代码。
>
> 任务：实现本文件 **T2「访问记录维护 API」**，只做 T2，不要动 T1/T3。
>
> 硬约束：
> 1. 先读仓库和既有测试，确认基线：`npx egg-bin test` 17 passing，`npx eslint .` 0 error。
> 2. 在派活前，先输出「子任务 → 模型 → 新建文件 → 测试命令」所有权表。至少 3 个并行子任务；每个子任务只能新建自己的文件，路径两两不重复。
> 3. 任务开始时已存在的文件都算共享文件，并行子任务一律不得修改；只有收口子任务可以改既有文件。
> 4. 3 个并行子任务用 `delegate_task` 派给不同模型/供应商，`isolation` 用 `shared`，不要用 worktree；每个 brief 必须自包含。
> 5. 3 个并行子任务全部完成后，再派收口子任务：注册路由、处理新前缀的配置、合并前端入口、写 HTTP 集成测试、跑全量。
> 6. 最后派一个不同模型的评审子任务，按 `文件:行号` 列问题；不要自动合并。
> 7. 不新增依赖；不改既有测试；不为了让测试通过而放宽断言。
>
> 输出：所有权表、每个子任务的结果、全量测试/lint 结果、评审结论、待办。

### 5.3 功能契约

通用约定：

- 前缀 `/api/visit-admin`，三个端点都是 `POST`，请求体为 JSON。
- 成功统一 `200`，响应体 `{ data: ... }`。
- 参数非法统一 `400`，响应体 `{ message: string }`，`message` 非空；**非法请求不得修改 store**。
- 所有响应都带 `x-request-id`。
- 数据源是 `app.pageVisitStore`（`Map`）；不存在时按空 store 处理，需要写入时再创建。
- 不修改 `app.debugConfigStore`，不修改 `app.config.pageVisit.maxTabs`。
- 既有 `GET/POST /api/page-visit` 的行为不变。
- 纯模块不得依赖 Egg `ctx`，也不直接读系统时间；`ctx.requestId`、当前时间、`maxTabs` 由 controller 作为参数传入。

#### 5.3.1 `POST /api/visit-admin/clear`

- 请求体可省略或为空对象。
- 清空 `app.pageVisitStore`。
- 成功：`{ data: { removed, remaining: 0 } }`；`removed` 是清空前记录数。
- 空 store 调用返回 `removed: 0`，幂等。
- 只清页面访问记录，不动调试配置。

#### 5.3.2 `POST /api/visit-admin/prune`

- 请求体：`{ maxTabs: number }`。
- `maxTabs` 必须是 JSON number，且为整数，范围 `0..1000`（含）。
- 缺失、`null`、字符串、小数、负数、大于 `1000` 都返回 `400`，store 不变。
- 按“最久没有打开”的顺序淘汰，直到 `store.size <= maxTabs`；淘汰选择规则与现有 `POST /api/page-visit` 的超限淘汰保持一致。
- 成功：`{ data: { removed, remaining } }`；已经是 `<= maxTabs` 时 `removed: 0`。
- 不读取、不修改 `app.config.pageVisit.maxTabs`。

#### 5.3.3 `POST /api/visit-admin/touch`

- 请求体：`{ tabIds: string[] }`。
- `tabIds` 必须是数组，长度 `1..50`（含）；每个元素必须是字符串，`trim()` 后非空。
- 任一项非法：整体 `400`，store 不变（先完整校验，再写入）。
- 允许重复项，按数组顺序依次处理；重复项会累加 `openCount`。
- 写入规则与现有 `POST /api/page-visit` 一致：
  - 新记录：`openCount: 1`，`openedAt` 与 `lastOpenedAt` 都是本次时间；
  - 已有记录：保留原 `openedAt`，`openCount + 1`，更新 `lastOpenedAt`；
  - `requestId` 使用当前请求的 `ctx.requestId`；
  - 同一批次使用同一个时间戳。
- 每处理一个 tab 后按 `app.config.pageVisit.maxTabs` 的上限淘汰；最终 store 不能超过上限。配置值非法时的回退规则与现有实现一致。
- 成功：`{ data: { accepted, total } }`；`accepted` 是输入数组长度，`total` 是处理后的 store 条数。

#### 5.3.4 前端入口

- 三个端点各由对应实现子任务新建一个 preset 文件，导出 `presets`。
- `group` 统一为 `访问维护`；`id` 互不重复；`method` 为 `POST`。
- 每个 preset 给一个可读的示例请求体；`hint` 用中文说明参数、成功响应和 400 场景。
- 收口子任务在 `endpoints.js` 中合并；既有条目不动。

### 5.4 验收清单

- [ ] `clear` 在非空 store 下返回正确的 `removed`，store 变空。
- [ ] `clear` 在空 store 下返回 `removed: 0`，可重复调用。
- [ ] `prune` 对 `0..1000` 的合法整数生效，`remaining` 正确。
- [ ] `prune` 对缺失、`null`、字符串、小数、负数、`>1000` 返回 400，store 不变。
- [ ] `prune` 不修改 `app.config.pageVisit.maxTabs`。
- [ ] `touch` 对合法数组写入正确，`accepted` 等于输入长度，`total` 等于最终条数。
- [ ] `touch` 对重复项累加 `openCount`。
- [ ] `touch` 保留已有记录的 `openedAt`，更新 `lastOpenedAt` 和 `requestId`。
- [ ] `touch` 在批次超过容量时按上限淘汰，最终不超过 `maxTabs`。
- [ ] `touch` 对非数组、空数组、超过 50 项、非字符串项、空白字符串返回 400，且 store 不变。
- [ ] 三个端点的验收请求都按现有测试的调用方式发送：`app.httpRequest().post(path).send(body)`，不额外附加 token 或请求头。
- [ ] 三个响应都带 `x-request-id`。
- [ ] 业务逻辑在纯模块中，纯模块测试不启动 app；controller 只做参数解析和响应封装。
- [ ] 调试页出现三个新入口，既有入口不变，`id` 无重复。
- [ ] 既有 17 条测试不改也能过；`npx eslint .` 无错误。
- [ ] 没有新增依赖，没有修改既有测试。

### 5.5 收口要求

- 在 `app/router.js` 注册 3 个 POST 路由。
- 处理新前缀 `/api/visit-admin` 的配置，使 5.4 里“按现有测试方式发送”的 POST 能成功。
- 在 `endpoints.js` 合并 3 个 preset。
- 新增 HTTP 集成测试，覆盖：
  - 三个端点成功路径；
  - 非法参数 400 且 store 不变；
  - 新前缀的 POST 不带 token 能成功；
  - `x-request-id`；
  - 既有 `/api/page-visit` 仍正常。
- 跑全量测试和 lint。

---

## 六、任务 T3 · 健康巡检报告

### 6.1 目标

新增一个只读聚合接口 `GET /api/health/report`，把三块独立的巡检结果组合起来：页面访问 store、调试配置 store、运行时信息。

三块巡检各自是一个**纯函数模块**，互不依赖，适合 3 个并行子任务；收口子任务只做聚合 controller、路由和 HTTP 集成测试。

### 6.2 给总控的 prompt（直接粘贴）

> 你是总控，只做规划、派活、收口和评审，不要直接写业务代码。
>
> 任务：实现本文件 **T3「健康巡检报告」**，只做 T3，不要动 T1/T2。
>
> 硬约束：
> 1. 先读仓库和既有测试，确认基线：`npx egg-bin test` 17 passing，`npx eslint .` 0 error。
> 2. 在派活前，先输出「子任务 → 模型 → 新建文件 → 测试命令」所有权表。至少 3 个并行子任务；每个子任务只能新建自己的文件，路径两两不重复。
> 3. 任务开始时已存在的文件都算共享文件，并行子任务一律不得修改；只有收口子任务可以改既有文件。
> 4. 3 个并行子任务用 `delegate_task` 派给不同模型/供应商，`isolation` 用 `shared`，不要用 worktree；每个 brief 必须自包含。
> 5. 3 个并行子任务全部完成后，再派收口子任务：写聚合 controller、注册路由、加前端入口、写 HTTP 集成测试、跑全量。
> 6. 最后派一个不同模型的评审子任务，按 `文件:行号` 列问题；不要自动合并。
> 7. 不新增依赖；不改既有测试；不为了让测试通过而放宽断言。
>
> 输出：所有权表、每个子任务的结果、全量测试/lint 结果、评审结论、待办。

### 6.3 功能契约

#### 6.3.1 三个纯函数模块

三个模块都是 CommonJS，各自 `module.exports` 一个函数；**三个模块之间不得互相 `require`**，只由收口 controller 组合。

**模块 A：store 巡检**

```js
inspectStore(store) => {
  tabs,                 // number，记录条数
  totalOpenCount,       // number，有限 openCount 之和（其他值按 0）
  oldestLastOpenedAt,   // string | null，最小 lastOpenedAt
  newestLastOpenedAt,   // string | null，最大 lastOpenedAt
}
```

- `store` 可能是 `undefined` / `null`，按空 `Map` 处理。
- 只考虑字符串类型的 `lastOpenedAt`。
- 不得修改传入的 store。

**模块 B：配置巡检**

```js
inspectConfig(store) => {
  hasData,   // boolean；仅当 store.hasData === true 时为 true
  version,   // number；非负整数，否则 0
  dataType,  // string | null
}
```

- `store` 可能是 `undefined` / `null`。
- `hasData === false` 时 `dataType` 为 `null`。
- `hasData === true` 时：`data` 为 `null` → `'null'`；数组 → `'array'`；其他 → `typeof data`（`'object'`、`'string'`、`'number'`、`'boolean'`、`'undefined'`）。
- 不得修改传入的 store。

**模块 C：运行时巡检**

```js
inspectRuntime() => {
  nodeVersion,     // string，process.version
  uptimeSeconds,   // number，非负整数
  memory: {        // number
    rss,
    heapUsed,
    heapTotal,
  },
}
```

- `memory` 来自 `process.memoryUsage()`。
- 不得修改全局状态。

#### 6.3.2 `GET /api/health/report`

- 成功：`200`，响应体：

  ```json
  {
    "data": {
      "store": { "tabs": 0, "totalOpenCount": 0, "oldestLastOpenedAt": null, "newestLastOpenedAt": null },
      "config": { "hasData": false, "version": 0, "dataType": null },
      "runtime": { "nodeVersion": "v...", "uptimeSeconds": 0, "memory": { "rss": 0, "heapUsed": 0, "heapTotal": 0 } },
      "generatedAt": "ISO-8601"
    }
  }
  ```

  上面的数字只是形状示例，不是断言值。
- 读取 `app.pageVisitStore` 和 `app.debugConfigStore`；不存在时按空处理，**不得为了读报告而创建 store**。
- 不修改任何 store。
- 不解析业务查询参数；未知参数忽略。
- 所有响应带 `x-request-id`。

#### 6.3.3 前端入口

- 本任务只有 1 个端点，由收口子任务在 `endpoints.js` 中直接追加一个 preset。
- `id` 为 `health-report`，`group` 为 `运维`，`method` 为 `GET`，`path` 为 `/api/health/report`。
- `hint` 用中文说明返回的三块信息和空态；不要写实现细节。
- 既有条目和顺序不变。

### 6.4 验收清单

- [ ] `inspectStore` 对空 / `undefined` / `null` 返回 `0/0/null/null`。
- [ ] `inspectStore` 对多条记录返回正确的条数、`openCount` 之和、最小/最大 `lastOpenedAt`。
- [ ] `inspectStore` 不修改传入的 store。
- [ ] `inspectConfig` 对空 / `undefined` / `null` 返回 `false/0/null`。
- [ ] `inspectConfig` 对对象、数组、字符串、数字、布尔、`null`、`undefined` 返回正确的 `dataType`。
- [ ] `inspectConfig` 不修改传入的 store。
- [ ] `inspectRuntime` 返回 `process.version`、非负整数 uptime、三个 number 内存字段。
- [ ] `GET /api/health/report` 在空 store 下返回 6.3.2 的完整形状，`generatedAt` 可解析。
- [ ] 种子 store 下，`store` 和 `config` 字段值正确。
- [ ] 调用接口前后，两个 store 内容完全一致；接口不会创建不存在的 store。
- [ ] 响应带 `x-request-id`。
- [ ] 调试页出现 `health-report` 入口，既有入口不变。
- [ ] 既有 17 条测试不改也能过；`npx eslint .` 无错误。
- [ ] 没有新增依赖，没有修改既有测试。

### 6.5 收口要求

- 写聚合 controller，组合三个模块。
- 在 `app/router.js` 注册 `GET /api/health/report`。
- 在 `endpoints.js` 追加 `health-report` 入口。
- 新增 HTTP 集成测试，覆盖：
  - 空 store；
  - 种子 store；
  - `generatedAt` 和 `x-request-id`；
  - store 不被修改；
  - 既有 `/test` 或 `/api/page-visit` 仍正常。
- 跑全量测试和 lint。

---

## 七、评测记录模板（不含答案）

每个任务跑完后，记录下面这些事实即可；不要在本文件里填“参考答案”。

### 7.1 拆解与所有权

| 子任务 | 模型/供应商 | 新建文件 | 修改的既有文件 | 自测命令 | 是否越界 |
| --- | --- | --- | --- | --- | --- |
| S1 |  |  |  |  |  |
| S2 |  |  |  |  |  |
| S3 |  |  |  |  |  |
| 收口 |  |  |  |  |  |

检查点：

- 是否在派活前给出了所有权表？
- 新建文件路径是否有重复？
- 并行子任务是否修改了任何既有文件？
- 收口子任务是否独占既有文件？

### 7.2 执行

- 每个子任务是否先读了相关代码/测试？
- 是否自己跑了测试，而不是“看起来应该能过”？
- 是否只改了 brief 允许的文件？
- 是否有删测试、改断言、放宽超时、跳过用例？
- 是否新增了依赖？

### 7.3 收口

- 路由是否全部注册？
- 新前缀的 POST 是否能按现有测试方式直接调用？
- 前端入口是否全部出现，`id` 是否唯一？
- 全量测试和 lint 是否通过？
- 既有行为是否保持不变？

### 7.4 评审

- 评审模型是否与实现模型不同？
- 是否按 `文件:行号` 给出问题？
- 是否给出明确的“通过/不通过”？
- 是否只评审、不改代码、不自动合并？

---

## 八、建议的观察指标

- **首次计划质量**：所有权表是否在写代码前出现；子任务是否真正可并行。
- **上下文自足**：子任务是否因为 brief 缺少契约而反复回问或改错文件。
- **越界率**：并行子任务修改非自己文件的次数。
- **返工率**：收口阶段修复契约偏差的次数。
- **测试可信度**：是否出现“测试通过但行为不符”或“改了测试才通过”。
- **评审有效性**：评审 finding 是否可定位、可复现、可修复。
- **协作成本**：总耗时、总 token、子任务数量与返工次数的关系。

---

## 九、复位

开跑前在当前 HEAD 打标签：

```bash
git tag baseline
```

每个任务结束后：

```bash
git reset --hard baseline
git clean -fd -e docs
```

说明：

- `-e docs` 用于保留可能存在的未跟踪调研文档；如果 `docs/` 下没有要保留的内容，可以按需调整。
- 执行 `git clean` 前先确认没有需要保留的未跟踪文件。
- 不要直接 `git clean -fd` 而不检查；它会删除所有未跟踪文件。
- 任务文档本身如果在基线 commit 里，不会被 `reset` 或 `clean` 删除。

---

## 十、给评测者的最后提醒

- 本文件**故意不包含**参考实现、判定测试、预期条数、坑位表和反向验证结果。
- 验收测试请等 Agent 交付后再放进仓库；不要提前放，否则等于泄题。
- 三个任务可以任意顺序跑，但**一次只跑一个**；每个任务都从 `baseline` 开始。
- 如果要对比模型，保持同一份 brief、同一个基线、同一组验收命令；不要中途换契约。
- 多模型协同真正有价值的观察点不是“谁写得快”，而是：拆得开、接得上、不越界、能自测、评审能落地。
