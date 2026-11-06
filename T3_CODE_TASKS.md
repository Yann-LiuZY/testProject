# T3 Code 编码任务集 v2 · testProject（Egg.js）

> 5 个基于当前仓库的新任务，难度在「中等」区间，用来观察编码 Agent 的探索、实现、测试与自律能力。
> 仓库里已有的 page-visit LRU 容量上限、debug-config 版本号、request-id 中间件，正是上一轮任务的产物；这一组题目建立在它们之上，但需求都是新的，和上一轮任务集不重复。

每个任务包含四部分：**给 Agent 的 prompt（整段粘贴）**、**可勾选的验收标准**、**预埋的坑（判分时看，不要贴给 Agent）**、**客观判定测试（交付后再放进仓库）**。

---

## 一、基线（已实测）

| 项 | 值 |
| --- | --- |
| 运行时 | Node v24.22.2，npm 11.19.1 |
| 框架 | Egg 3.34.0（package.json 声明 `^3.17.5`） |
| 现有单测 | `npx egg-bin test` → **17 passing**（约 0.6s） |
| Lint | `npx eslint .` → **0 error** |
| 现有接口 | `GET /`（调试页）、`GET /test`、`/api/debug-config`（GET/POST/DELETE/consume）、`/api/page-visit`（GET/POST） |
| HEAD | `e282951`（本文件提交前的 HEAD，10 个 commit） |
| 网络 | 视为离线：不要安装新依赖，装不上 |
| 生成物 | `logs/`、`run/`、`typings/` 为生成/日志目录，不要手改 |

三个容易影响评测的细节：

1. **`npm test` 会改文件**：它是 `eslint --fix && egg-bin test`。验收请用 `npx eslint .`（只读）和 `npx egg-bin test`，否则 Agent 的格式问题会被自动「修好」，看不出它是否真的遵守了代码风格。
2. **怎么复位**：仓库现在有 commit，不需要再造基线。开跑前在当前 HEAD 打一个标签，每个任务结束后：

   ```bash
   git tag baseline            # 开跑前执行一次
   git reset --hard baseline
   git clean -fd -e docs       # -e docs 防止删掉未跟踪的调研报告
   ```

   `docs/T3Code调研报告.md` 目前是未跟踪文件，用 `-e docs` 排除；不要直接 `git clean -fd`。

3. **CSRF 白名单是「前缀匹配」**：`config.security.csrf.ignore` 现在放行了 `/api/debug-config` 和 `/api/page-visit`，所以 `/api/page-visit/xxx` 这类子路径也会被放行。但**新前缀**（例如 T4 的 `POST /api/visits/batch`）在测试里会直接 **403**，必须把它加进白名单——这是 T4 最核心的坑，实测未加白名单时 5 条 judge 全挂 403。

---

## 二、怎么用

- 一次只跑一个任务，同一个工作区不要并行；每个任务都假设自己从基线开始。
- 任务之间互相独立，可以任意顺序。建议顺序：**T1 → T5 → T2 → T3 → T4**，把唯一需要发现 CSRF 白名单的 T4 放在最后。
- 验收测试（judge 片段）**不要提前放进仓库**，等 Agent 交付后再复制到 `test/judge/` 下执行，否则等于泄题。
- 判分时记录这几项就够：是否先读代码/测试、是否自己跑命令、diff 行数与文件数、有没有越界改动、有没有删/弱化既有测试。
- 每个 judge 文件都用 `mm.app()` 起独立 app，可以单独跑：

  ```bash
  npx egg-bin test test/judge/t1.test.js
  ```

  T3 的 judge 里有等待时间窗口的 `sleep`，单独跑约 1s，属正常。

### 任务总览

| 任务 | 类型 | 难度 | 预计耗时 | 参考实现改动 |
| --- | --- | --- | --- | --- |
| T1 page-visit 列表排序与过滤 | 参数校验 + 兼容 | ★★☆ | 8–12 min | 1–2 文件 / 40–60 行 |
| T2 debug-config 多 key | 契约演进 + 路由顺序 | ★★★ | 10–15 min | 2–3 文件 / 60–90 行 |
| T3 page-visit 按 IP 限流 | 中间件 + 配置 | ★★★ | 10–15 min | 3 文件 / 50–80 行 |
| T4 批量上报 `/api/visits/batch` | 新路由 + CSRF + 部分成功 | ★★★ | 12–18 min | 3–4 文件 / 60–90 行 |
| T5 `/status` 运维页 | HTML 转义 + 空态 | ★★☆ | 8–12 min | 2–3 文件 / 50–80 行 |

### 判定测试（实测结果）

5 个参考实现（T1–T5 同时落地）跑过全量验证：

| 任务 | judge 条数 | 参考实现 | 反向验证（故意改坏一处） |
| --- | --- | --- | --- |
| T1 | 7 | 全绿 | 忽略 `order`（始终倒序）→ 1 条挂（asc 用例） |
| T2 | 6 | 全绿 | 把 `/:name` 路由注册到 `/consume` 之前 → 1 条挂（根路径 consume） |
| T3 | 5 | 全绿 | 把 `rateLimit` 排到 `requestId` 前面 → 1 条挂（429 缺 `x-request-id`） |
| T4 | 5 | 全绿 | 去掉 `/api/visits` 的 CSRF 白名单 → 5 条全挂（403） |
| T5 | 5 | 全绿 | 去掉 `escapeHtml` → 2 条挂（两个 XSS 用例） |

- 参考实现 + 全部 judge 片段一起跑：**45 passing**（17 既有 + 28 judge），`npx eslint .` 0 error。
- 每个 judge 文件单独跑也都是全绿；上面的「反向验证」说明用例不是纸面示例。
- 参考实现里 T3 的默认限流是 **30 次/分钟**，不是 10：既有 `pageVisit.test.js` 一个文件就会连续发 14 次 `POST /api/page-visit`，默认值太小会把既有 17 条打挂。prompt 里已写明 30，这一点不用藏。

写 judge 时的两个本地约定（片段里已处理）：

- `describe` 顶层**不能**读 `app.config`，egg-mock 会抛 `can't get config before ready`；要在 `before` / `beforeEach` 里取。
- 记录时间只有毫秒精度，涉及顺序的用例要留间隔（片段里用 `tick()`）。

---

## T1 · page-visit 列表排序与过滤

**现状**：`app/controller/pageVisit.js` 的 `show()` 直接 `Array.from(store.values()).sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))`，不解析任何查询参数；`total` 就是当前列表长度。`Map` 里每条形如 `{ tabId, requestId, openedAt, lastOpenedAt, openCount }`。

### 给 Agent 的 prompt（直接粘贴）

> `GET /api/page-visit` 现在只会按最近打开时间倒序返回全部记录，前端想按打开次数排序、只看打开过多次的 tab。帮我加查询参数：
>
> 1. `sort`：可选 `lastOpenedAt`（默认）或 `openCount`；传其他值返回 400。
> 2. `order`：`desc`（默认）或 `asc`；传其他值返回 400。
> 3. `minCount`：可选非负整数，只返回 `openCount >= minCount` 的记录；`-1`、`abc`、`1.5`、空串都算非法，返回 400。
> 4. 同值时按 `tabId` 升序，保证顺序稳定。
> 5. 响应结构保持 `{ data, total }`，`total` 是**过滤后**的条数。
> 6. 不传参数时行为与现在完全一致；查询不能修改 store 的内容或顺序；沿用现在的 `app.pageVisitStore`。
> 7. 补测试覆盖排序、过滤、非法参数；`npx egg-bin test` 和 `npx eslint .` 都要过，不要改既有用例。

### 验收标准

- [ ] `/api/page-visit` 不带参数时仍按 `lastOpenedAt` 倒序，`total` 不变。
- [ ] `?sort=openCount&order=asc` 按 `openCount` 升序；`order=desc` 时降序。
- [ ] `openCount` 相同时按 `tabId` 升序（与插入顺序无关）。
- [ ] `?minCount=2` 只返回 `openCount >= 2` 的记录，`total` 等于过滤后的条数。
- [ ] `?minCount=0` 等价于不过滤。
- [ ] `sort`、`order` 非法，或 `minCount` 为 `-1` / `abc` / `1.5` / 空串时返回 400，body 里 `message` 是非空字符串。
- [ ] 先发带排序/过滤的请求，再发默认请求，两次默认响应完全一致（store 没被改）。
- [ ] 既有 17 条用例不改也能过；`npx eslint .` 无错误。

### 预埋的坑（判分看这里）

| 坑 | 失败表现 |
| --- | --- |
| `sort` / `order` 只校验、没真正生效 | 排序用例挂 |
| 非法参数静默回落成默认值 | 非法参数用例挂（期望 400） |
| `minCount` 用 `>` 而不是 `>=` | 过滤后条数少一条，用例挂 |
| 用字符串比较 `openCount` | `10 < 2`，排序或过滤错 |
| 同值按插入顺序 / 没有稳定排序 | 同值用例挂 |
| 过滤后 `total` 仍用 `store.size` | `total` 断言挂 |
| 为了排序重建 Map / 改变 store 顺序 | 后续默认响应、甚至 LRU 淘汰行为变化 |
| 顺手给成功响应加字段 | 既有 17 条精确断言挂 |

### 客观判定测试（可选，Agent 交付后再放入）

```js
// test/judge/t1.test.js
'use strict';

const assert = require('node:assert');
const mm = require('egg-mock');

describe('judge T1: page-visit list sort/filter', () => {
  let app;

  before(async () => {
    app = mm.app();
    await app.ready();
  });

  after(() => app.close());

  beforeEach(() => {
    app.pageVisitStore = new Map();
    app.config.pageVisit.maxTabs = 100;
  });

  const open = tabId => app.httpRequest()
    .post('/api/page-visit')
    .send({ tabId })
    .expect(200);
  const rawList = query => app.httpRequest()
    .get('/api/page-visit' + (query || ''));
  const list = query => rawList(query).expect(200);
  const ids = res => res.body.data.map(item => item.tabId);
  const tick = () => new Promise(resolve => setTimeout(resolve, 5));

  it('默认仍按 lastOpenedAt 倒序', async () => {
    await open('a');
    await tick();
    await open('b');

    const res = await list();
    assert.deepStrictEqual(ids(res), [ 'b', 'a' ]);
  });

  it('sort=openCount&order=asc，同值按 tabId 升序', async () => {
    await open('b');
    await open('a');
    await open('c');
    await open('c');

    const res = await list('?sort=openCount&order=asc');
    assert.deepStrictEqual(ids(res), [ 'a', 'b', 'c' ]);
  });

  it('sort=openCount&order=desc，同值仍按 tabId 升序', async () => {
    await open('b');
    await open('a');
    await open('c');
    await open('c');

    const res = await list('?sort=openCount&order=desc');
    assert.deepStrictEqual(ids(res), [ 'c', 'a', 'b' ]);
  });

  it('minCount 过滤并按过滤后的数量返回 total', async () => {
    await open('a');
    await open('a');
    await open('b');
    await open('c');
    await open('c');
    await open('c');

    const res = await list('?minCount=2');
    assert.deepStrictEqual(ids(res).sort(), [ 'a', 'c' ]);
    assert.strictEqual(res.body.total, 2);
  });

  it('minCount=0 等价于不过滤', async () => {
    await open('a');
    await open('b');

    const res = await list('?minCount=0');
    assert.strictEqual(res.body.total, 2);
  });

  it('非法参数返回 400', async () => {
    const queries = [ '?sort=bogus', '?order=sideways', '?minCount=-1', '?minCount=abc', '?minCount=1.5', '?minCount=' ];
    for (const query of queries) {
      const res = await rawList(query);
      assert.strictEqual(res.status, 400, query);
      assert.strictEqual(typeof res.body.message, 'string', query);
    }
  });

  it('过滤/排序不改变 store，也不影响默认响应', async () => {
    await open('a');
    await tick();
    await open('b');

    const before = await list();
    await list('?sort=openCount&order=asc&minCount=1');
    const after = await list();
    assert.deepStrictEqual(after.body, before.body);
  });
});
```

---

## T2 · debug-config 多 key

**现状**：`app/controller/debugConfig.js` 是单槽存储，`app.debugConfigStore` 里直接放 `{ hasData, data, version }`；四条路由都是固定路径（`/api/debug-config` 和 `/api/debug-config/consume`）。`GET` 空时 404，`POST` 带 `version` 时做乐观锁，`DELETE` 204 并归零，`consume` 返回 `{ data }` 后清空。

### 给 Agent 的 prompt（直接粘贴）

> `debug-config` 现在只有一个全局槽位，调试时多个模块会互相覆盖。帮我改成按 key 存：
>
> 1. 新增 `GET/POST/DELETE /api/debug-config/:name`，语义与现有根路径完全一致：GET 空 404、POST 支持 `version` 乐观锁且冲突 409、DELETE 204 并清空该 key。
> 2. 新增 `GET /api/debug-config/:name/consume`：返回 `{ data }` 并清空该 key，响应结构保持只有 `data` 一个键。
> 3. 根路径 `/api/debug-config` 等价于 `name = default`：现有 8 条 debug-config 用例必须原样通过；`/api/debug-config/default` 与根路径读写同一个槽位。
> 4. 不同 key 的数据和 `version` 完全隔离，冲突只在同一个 key 内发生。
> 5. key 只允许 `[A-Za-z0-9_-]{1,32}`，不合法返回 400，body 里 `message` 是非空字符串；`consume` 是保留字，不能作为 key（`GET /api/debug-config/consume` 仍然消费 default）。
> 6. 补测试覆盖 key 隔离、default 兼容、命名 key 的冲突、非法 key；`npx egg-bin test` 和 `npx eslint .` 都要过，不要改既有用例。

### 验收标准

- [ ] `POST /api/debug-config/a` 后，`GET /api/debug-config/a` 返回 `{ data, version }`，`b` 仍是 404。
- [ ] `a` 和 `b` 各自从 `version = 1` 开始，互不影响；`a` 的 409 不会影响 `b`。
- [ ] `POST /api/debug-config` 与 `POST /api/debug-config/default` 写入同一个槽位，双向可读。
- [ ] `GET /api/debug-config/consume` 仍然消费 default，而不是消费名为 `consume` 的 key。
- [ ] `GET /api/debug-config/a/consume` 只清空 `a`，`b` 保持不变，响应只有 `data`。
- [ ] key 含空格、超过 32 位、或为 `consume` 时返回 400。
- [ ] 既有 8 条 debug-config 用例不改也能过；`npx eslint .` 无错误。

### 预埋的坑（判分看这里）

| 坑 | 失败表现 |
| --- | --- |
| 只加了 `/:name`，根路径被 `/:name` 捕获或没有映射到 default | 既有 8 条 debug-config 用例挂 |
| `/:name` 路由注册在 `/consume` 之前 | `GET /api/debug-config/consume` 变成 400/404，根 consume 用例挂 |
| 所有 key 共用一个 version | key 隔离用例挂 |
| 命名 key 的 consume 清空全部 key | 只清空自己的用例挂 |
| 没有 key 校验 | 非法 key 用例挂 |
| `default` 与根路径不互通 | default 兼容用例挂 |
| 改坏了 409 不脏写 | 既有冲突用例挂 |
| 给 consume 响应加了 version | 既有 consume 兼容用例挂 |

### 客观判定测试（可选）

```js
// test/judge/t2.test.js
'use strict';

const assert = require('node:assert');
const mm = require('egg-mock');

describe('judge T2: debug-config multi key', () => {
  let app;

  before(async () => {
    app = mm.app();
    await app.ready();
  });

  after(() => app.close());

  const get = path => app.httpRequest().get(path);
  const del = path => app.httpRequest().delete(path).expect(204);
  const post = (path, body) => app.httpRequest().post(path).send(body);

  beforeEach(async () => {
    const paths = [
      '/api/debug-config',
      '/api/debug-config/default',
      '/api/debug-config/a',
      '/api/debug-config/b',
    ];
    for (const path of paths) {
      await del(path);
    }
  });

  it('不同 key 的数据与版本互相隔离', async () => {
    const a = await post('/api/debug-config/a', { data: 'A' }).expect(200);
    assert.deepStrictEqual(a.body, { data: 'A', version: 1 });

    const b = await post('/api/debug-config/b', { data: 'B' }).expect(200);
    assert.deepStrictEqual(b.body, { data: 'B', version: 1 });

    const ga = await get('/api/debug-config/a').expect(200);
    assert.deepStrictEqual(ga.body, { data: 'A', version: 1 });
    const gb = await get('/api/debug-config/b').expect(200);
    assert.deepStrictEqual(gb.body, { data: 'B', version: 1 });

    await del('/api/debug-config/a');
    await get('/api/debug-config/a').expect(404);
    const stillB = await get('/api/debug-config/b').expect(200);
    assert.deepStrictEqual(stillB.body, { data: 'B', version: 1 });
  });

  it('根路径与 default 指向同一个槽位', async () => {
    await post('/api/debug-config', { data: 'D' }).expect(200);

    const viaName = await get('/api/debug-config/default').expect(200);
    assert.deepStrictEqual(viaName.body, { data: 'D', version: 1 });

    await post('/api/debug-config/default', { data: 'D2', version: 1 }).expect(200);
    const viaRoot = await get('/api/debug-config').expect(200);
    assert.deepStrictEqual(viaRoot.body, { data: 'D2', version: 2 });

    await del('/api/debug-config/default');
    await get('/api/debug-config').expect(404);
  });

  it('版本冲突只在同一个 key 内生效', async () => {
    await post('/api/debug-config/a', { data: 'one' }).expect(200);
    await post('/api/debug-config/a', { data: 'two', version: 1 }).expect(200);
    await post('/api/debug-config/b', { data: 'keep' }).expect(200);

    const conflict = await post('/api/debug-config/b', { data: 'bad', version: 0 }).expect(409);
    assert.strictEqual(conflict.body.currentVersion, 1);

    const ga = await get('/api/debug-config/a').expect(200);
    assert.deepStrictEqual(ga.body, { data: 'two', version: 2 });
    const gb = await get('/api/debug-config/b').expect(200);
    assert.deepStrictEqual(gb.body, { data: 'keep', version: 1 });
  });

  it('命名 key 的 consume 只清空自己，响应仍是 { data }', async () => {
    await post('/api/debug-config/a', { data: 'A' }).expect(200);
    await post('/api/debug-config/b', { data: 'B' }).expect(200);

    const consumed = await get('/api/debug-config/a/consume').expect(200);
    assert.deepStrictEqual(consumed.body, { data: 'A' });
    assert.deepStrictEqual(Object.keys(consumed.body), [ 'data' ]);

    await get('/api/debug-config/a').expect(404);
    const gb = await get('/api/debug-config/b').expect(200);
    assert.deepStrictEqual(gb.body, { data: 'B', version: 1 });
  });

  it('根路径 consume 仍然消费 default，而不是名为 consume 的 key', async () => {
    await post('/api/debug-config', { data: 'D' }).expect(200);

    const consumed = await get('/api/debug-config/consume').expect(200);
    assert.deepStrictEqual(consumed.body, { data: 'D' });
    await get('/api/debug-config').expect(404);
  });

  it('非法或保留的 key 返回 400', async () => {
    const withSpace = await get('/api/debug-config/a%20b').expect(400);
    assert.strictEqual(typeof withSpace.body.message, 'string');

    await get('/api/debug-config/' + 'x'.repeat(33)).expect(400);
    await post('/api/debug-config/consume', { data: 'nope' }).expect(400);
  });
});
```

---

## T3 · page-visit 按 IP 限流

**现状**：`config.middleware = [ 'requestId' ]`，只有一个 requestId 中间件；`POST /api/page-visit` 没有任何频控。`pageVisit.test.js` 一个文件会连续发 14 次 POST，默认上限如果定得太小，会直接把既有用例打挂。

### 给 Agent 的 prompt（直接粘贴）

> 想防止调试时把 `/api/page-visit` 刷爆，加一个按 IP 的限流中间件：
>
> 1. 新增 Egg 中间件，并通过 `config.middleware` 注册；只限制 `POST /api/page-visit`，其他接口（包括 `GET /api/page-visit`）不受影响。
> 2. 配置放在 `config/config.default.js` 的 `rateLimit`：`windowMs` 默认 60000，`max` 默认 30；**每次请求**从 `app.config` 读取（测试里会临时改小）。
> 3. 固定窗口：同一 IP 在窗口内超过 `max` 次后返回 429，body 为 `{ message: string }`，并带 `Retry-After`（秒，整数，至少 1）。
> 4. 被限流的请求不能进入 controller：不能写记录，也不能累加 `openCount`。
> 5. 429 响应也要带 `x-request-id`，和现有接口保持一致。
> 6. 窗口过期后重新放行。
> 7. 补测试覆盖超限、窗口恢复、其他接口不受影响；`npx egg-bin test` 和 `npx eslint .` 都要过，不要改既有用例。

### 验收标准

- [ ] `config.middleware` 里注册了新增中间件，`config.rateLimit` 有默认 `windowMs = 60000`、`max = 30`。
- [ ] 把 `app.config.rateLimit` 改成 `{ windowMs: 120, max: 2 }` 后：第 3 次 POST 返回 429，`message` 是非空字符串。
- [ ] 429 带 `Retry-After`，值是 ≥ 1 的整数秒。
- [ ] 被限流的请求没有写进 store：3 次请求后 `GET /api/page-visit` 的 `total = 2`，且没有第 3 个 tabId。
- [ ] 429 响应头里有 `x-request-id`（例如传合法 `x-request-id` 时原样返回）。
- [ ] 窗口过期（等待 > `windowMs`）后，同一 IP 再 POST 返回 200。
- [ ] 超限后 `GET /test`、`GET /api/page-visit`、`GET /api/debug-config` 仍正常。
- [ ] 每次请求都会重新读 `max`：运行中改成 `max = 1` 后，第 2 次 POST 就 429。
- [ ] 既有 17 条用例不改也能过；`npx eslint .` 无错误。

### 预埋的坑（判分看这里）

| 坑 | 失败表现 |
| --- | --- |
| 默认 `max` 定成 10 或更小 | 既有 `pageVisit.test.js` 的 14 次 POST 被打挂，17 条不再全绿 |
| 启动时缓存 config，不逐请求读 | 「重新读 max」用例挂 |
| `rateLimit` 排在 `requestId` 前面 | 429 没有 `x-request-id`，用例挂 |
| 超限后仍然 `await next()` | 记录条数断言挂（第 3 条被写进去了） |
| 把 GET 也限流 | 「其他接口不受影响」用例挂 |
| `Retry-After` 用毫秒、小数或字符串 | 整数/≥1 断言挂 |
| 计数跨窗口不清零 | 「窗口过期后恢复」用例挂 |
| 只按 tabId 计数而不是 IP | 与需求不符，人工看代码扣分 |

### 客观判定测试（可选）

```js
// test/judge/t3.test.js
'use strict';

const assert = require('node:assert');
const mm = require('egg-mock');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

describe('judge T3: page-visit rate limit', () => {
  let app;

  before(async () => {
    app = mm.app();
    await app.ready();
  });

  after(() => app.close());

  beforeEach(async () => {
    app.pageVisitStore = new Map();
    app.config.rateLimit = { windowMs: 120, max: 2 };
    // 等上一个用例的窗口过期，避免用例之间互相影响
    await sleep(150);
  });

  const open = (tabId, requestId) => {
    const req = app.httpRequest()
      .post('/api/page-visit')
      .send({ tabId });
    if (requestId) {
      req.set('x-request-id', requestId);
    }
    return req;
  };

  it('超过 max 返回 429，且请求没有进入 controller', async () => {
    await open('a').expect(200);
    await open('b').expect(200);
    const blocked = await open('c').expect(429);

    assert.strictEqual(typeof blocked.body.message, 'string');
    const retryAfter = Number(blocked.headers['retry-after']);
    assert.ok(Number.isInteger(retryAfter) && retryAfter >= 1, 'Retry-After should be an integer >= 1');

    const res = await app.httpRequest().get('/api/page-visit').expect(200);
    assert.strictEqual(res.body.total, 2);
    assert.deepStrictEqual(res.body.data.map(item => item.tabId).sort(), [ 'a', 'b' ]);
  });

  it('429 响应也带 x-request-id，说明中间件顺序正确', async () => {
    const requestId = 'rate-Limit_123';
    await open('a', requestId).expect(200).expect('x-request-id', requestId);
    await open('b').expect(200);
    await open('c', requestId).expect(429).expect('x-request-id', requestId);
  });

  it('窗口过期后恢复放行', async () => {
    await open('a').expect(200);
    await open('b').expect(200);
    await open('c').expect(429);

    await sleep(150);
    await open('d').expect(200);
  });

  it('只限制 POST /api/page-visit，其他接口不受影响', async () => {
    await open('a').expect(200);
    await open('b').expect(200);
    await open('c').expect(429);

    await app.httpRequest().get('/test').expect(200);
    await app.httpRequest().get('/api/page-visit').expect(200);
    await app.httpRequest().get('/api/debug-config').expect(404);
  });

  it('每次请求都会重新读取 max 配置', async () => {
    app.config.rateLimit = { windowMs: 120, max: 1 };

    await open('a').expect(200);
    await open('b').expect(429);
  });
});
```

---

## T4 · 批量上报 `/api/visits/batch`

**现状**：`POST /api/page-visit` 一次只能写一个 tabId；`/api/visits` 这个前缀不存在，也不在 CSRF 白名单里。路由在 `app/router.js`，写入逻辑（`openCount` 累加、`openedAt` 保留、LRU 淘汰、日志）都在 `app/controller/pageVisit.js`。

### 给 Agent 的 prompt（直接粘贴）

> 页面访问现在一次只能上报一个 tab。加一个批量接口 `POST /api/visits/batch`：
>
> 1. 请求体 `{ tabIds: string[] }`，长度 1–50；不是数组、空数组、超过 50 条都返回 400，body 为 `{ message }`。
> 2. 逐条处理，允许部分成功：合法的 tabId 按现有 `/api/page-visit` 的规则写入（累加 `openCount`、保留第一次的 `openedAt`、受 `maxTabs` 容量上限和 LRU 淘汰约束），非法项不写入、也不能让整批失败。
> 3. 响应 200：`{ data: [...], accepted, rejected }`；每项 `{ tabId, ok, message? }`，成功项额外带 `openCount`。
> 4. 同一批次里重复的 tabId 按出现顺序依次累加，不要先去重。
> 5. 新接口要在 `npx egg-bin test` 里能直接 POST 成功（现有接口的测试就是这么调用的）。
> 6. 补测试覆盖整批成功、部分失败、容量上限、重复 tabId、非法请求体；`npx egg-bin test` 和 `npx eslint .` 都要过，不要改既有用例。

### 验收标准

- [ ] `POST /api/visits/batch { tabIds: ['a','b','c'] }` → 200，`accepted = 3`、`rejected = 0`，三项 `ok = true`、`openCount = 1`。
- [ ] 随后 `GET /api/page-visit` 的 `total = 3`，三个 tab 都在。
- [ ] `['a', '', 42, 'b']` → 200，`accepted = 2`、`rejected = 2`，`ok` 依次为 `[true,false,false,true]`，store 里只有 a、b。
- [ ] `maxTabs = 2` 时批量写 a、b、c → store 只剩 b、c（LRU 生效）。
- [ ] 同一批次写两次 `dup`，再单独写一次 → `openCount = 3`。
- [ ] `{}`、`{ tabIds: [] }`、`{ tabIds: 'abc' }`、51 条 → 400，body 有 `message`。
- [ ] 新前缀没有被 CSRF 挡住（测试里直接 POST 就是 200，不是 403）。
- [ ] 既有 17 条用例不改也能过；`npx eslint .` 无错误。

### 预埋的坑（判分看这里）

| 坑 | 失败表现 |
| --- | --- |
| 忘记把 `/api/visits` 加进 `csrf.ignore` | 全部 5 条 judge 返回 403（实测） |
| 一条非法就整批 400 | 部分成功用例挂 |
| 批量写入不逐条走 `maxTabs`/淘汰 | 容量用例挂 |
| 先 `Set` 去重再写 | 重复 tabId 的 `openCount` 只有 2，用例挂 |
| 响应缺 `accepted` / `rejected` / `ok` | 断言挂 |
| 写日志时丢了 `requestId` | judge 不查，但人工看日志会发现字段缺失 |
| 非法项也写入 store（比如空字符串被 trim 成合法） | 部分成功用例的 `total` 挂 |

### 客观判定测试（可选）

```js
// test/judge/t4.test.js
'use strict';

const assert = require('node:assert');
const mm = require('egg-mock');

describe('judge T4: /api/visits/batch', () => {
  let app;

  before(async () => {
    app = mm.app();
    await app.ready();
  });

  after(() => app.close());

  beforeEach(() => {
    app.pageVisitStore = new Map();
    app.config.pageVisit.maxTabs = 100;
  });

  const batch = tabIds => app.httpRequest()
    .post('/api/visits/batch')
    .send({ tabIds });
  const list = () => app.httpRequest().get('/api/page-visit').expect(200);

  it('整批成功时返回逐项结果和汇总，新前缀没有被 CSRF 挡住', async () => {
    const res = await batch([ 'a', 'b', 'c' ]).expect(200);

    assert.strictEqual(res.body.accepted, 3);
    assert.strictEqual(res.body.rejected, 0);
    assert.strictEqual(res.body.data.length, 3);
    for (const item of res.body.data) {
      assert.strictEqual(item.ok, true);
      assert.strictEqual(item.openCount, 1);
    }

    const resList = await list();
    assert.strictEqual(resList.body.total, 3);
    assert.deepStrictEqual(resList.body.data.map(item => item.tabId).sort(), [ 'a', 'b', 'c' ]);
  });

  it('部分失败：非法项被拒绝，合法项照常写入', async () => {
    const res = await batch([ 'a', '', 42, 'b' ]).expect(200);

    assert.strictEqual(res.body.accepted, 2);
    assert.strictEqual(res.body.rejected, 2);
    assert.deepStrictEqual(res.body.data.map(item => item.ok), [ true, false, false, true ]);

    const resList = await list();
    assert.strictEqual(resList.body.total, 2);
    assert.deepStrictEqual(resList.body.data.map(item => item.tabId).sort(), [ 'a', 'b' ]);
  });

  it('批量写入也受 maxTabs 容量上限约束', async () => {
    app.config.pageVisit.maxTabs = 2;
    await batch([ 'a', 'b', 'c' ]).expect(200);

    const res = await list();
    assert.strictEqual(res.body.total, 2);
    assert.deepStrictEqual(res.body.data.map(item => item.tabId).sort(), [ 'b', 'c' ]);
  });

  it('同一批次里的重复 tabId 按顺序累加 openCount', async () => {
    await batch([ 'dup', 'dup' ]).expect(200);
    const res = await batch([ 'dup' ]).expect(200);

    assert.strictEqual(res.body.data[0].openCount, 3);
    const resList = await list();
    assert.strictEqual(resList.body.data[0].openCount, 3);
  });

  it('tabIds 不是非空数组或超过 50 条时返回 400', async () => {
    const invalids = [
      {},
      { tabIds: [] },
      { tabIds: 'abc' },
      { tabIds: Array.from({ length: 51 }, (_, index) => 'tab-' + index) },
    ];
    for (const body of invalids) {
      const res = await app.httpRequest()
        .post('/api/visits/batch')
        .send(body);
      assert.strictEqual(res.status, 400, JSON.stringify(body).slice(0, 40));
      assert.strictEqual(typeof res.body.message, 'string');
    }
  });
});
```

---

## T5 · `/status` 运维状态页

**现状**：没有任何 HTML 运维页；`GET /` 返回 `app/public/api-debug.html` 调试页；page-visit 记录在 `app.pageVisitStore`（`Map`）里，每条含 `tabId`、`requestId`、`openedAt`、`lastOpenedAt`、`openCount`。仓库没有模板引擎，也没有 `egg-view-*` 依赖。

### 给 Agent 的 prompt（直接粘贴）

> 想给运维一个能直接在浏览器打开的页面 `GET /status`，把 page-visit 的记录列成表格：
>
> 1. 返回 200，`Content-Type` 为 `text/html; charset=utf-8`；页面有 `lang="zh-CN"` 和 `<meta charset>`。
> 2. 顶部显示「共 N 条记录」；表格列固定为 `tabId`、`openCount`、`lastOpenedAt`、`requestId`，按最近打开时间倒序。
> 3. 没有记录时显示「暂无记录」，仍然是 200。
> 4. `tabId` 和 `requestId` 都来自外部输入，必须做 HTML 转义：`& < > " '` 分别转成 `&amp; &lt; &gt; &quot; &#39;`。
> 5. 不引入模板引擎或新依赖（离线装不上），直接拼 HTML；直接读现有的 `app.pageVisitStore`，不要另建缓存；`/` 仍然返回现在的调试页。
> 6. 补测试覆盖正常渲染、空态、XSS；`npx egg-bin test` 和 `npx eslint .` 都要过，不要改既有用例。

### 验收标准

- [ ] `GET /status` → 200，`Content-Type` 含 `text/html` 和 `charset=utf-8`。
- [ ] 有 2 条记录时页面包含「共 2 条」，且出现 `tabId`、`openCount`、`lastOpenedAt`、`requestId` 四个列名。
- [ ] 空 store 时页面包含「暂无记录」，仍是 200。
- [ ] `tabId = <img src=x onerror=alert(1)>` 时，源码里不出现 `<img src=x`，出现 `&lt;img src=x onerror=alert(1)&gt;`。
- [ ] `tabId = a&b<c>"d"'e'` 时，五个特殊字符都按指定实体转义。
- [ ] 渲染 `/status` 不修改 store，`GET /api/page-visit` 的数据不变；`/` 仍是 HTML 调试页。
- [ ] 没有新增依赖（`package.json` 不变）；既有 17 条用例不改也能过；`npx eslint .` 无错误。

### 预埋的坑（判分看这里）

| 坑 | 失败表现 |
| --- | --- |
| 直接把 `tabId` 拼进 HTML | 两个 XSS 用例挂（最典型） |
| 只转义 `<`、`>`，漏 `&`、`"`、`'` | 五字符用例挂 |
| 忘记设置 Content-Type / charset | 断言挂 |
| 空态返回 404 或空表格 | 空态用例挂 |
| 用模板字符串里的 `${tabId}` 但不转义 | XSS |
| 覆盖 `/` 或改坏调试页 | 既有用例/人工检查挂 |
| 引入 `egg-view-nunjucks` 等新依赖 | 离线装不上，或违背约束 |
| 转义两次（`&amp;lt;`） | 五字符断言挂 |

### 客观判定测试（可选）

```js
// test/judge/t5.test.js
'use strict';

const assert = require('node:assert');
const mm = require('egg-mock');

describe('judge T5: /status HTML page', () => {
  let app;

  before(async () => {
    app = mm.app();
    await app.ready();
  });

  after(() => app.close());

  beforeEach(() => {
    app.pageVisitStore = new Map();
  });

  const open = tabId => app.httpRequest()
    .post('/api/page-visit')
    .send({ tabId })
    .expect(200);
  const status = () => app.httpRequest().get('/status');

  it('渲染记录表格和总条数', async () => {
    await open('tab-1');
    await open('tab-2');

    const res = await status().expect(200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.match(res.headers['content-type'], /charset=utf-8/i);
    assert.ok(res.text.includes('tab-1'));
    assert.ok(res.text.includes('tab-2'));
    assert.ok(res.text.includes('共 2 条'));

    for (const column of [ 'tabId', 'openCount', 'lastOpenedAt', 'requestId' ]) {
      assert.ok(res.text.includes(column), `missing column ${column}`);
    }
  });

  it('空状态显示「暂无记录」但仍是 200', async () => {
    const res = await status().expect(200);
    assert.ok(res.text.includes('暂无记录'));
    assert.match(res.headers['content-type'], /text\/html/);
  });

  it('转义 tabId，杜绝 XSS', async () => {
    await open('<img src=x onerror=alert(1)>');

    const res = await status().expect(200);
    assert.ok(!res.text.includes('<img src=x'));
    assert.ok(res.text.includes('&lt;img src=x onerror=alert(1)&gt;'));
  });

  it('五个 HTML 特殊字符都被转义', async () => {
    await open('a&b<c>"d"\'e\'');

    const res = await status().expect(200);
    assert.ok(!res.text.includes('<c>'));
    assert.ok(res.text.includes('a&amp;b&lt;c&gt;&quot;d&quot;&#39;e&#39;'));
  });

  it('渲染页面不会修改 store，也不影响根路由', async () => {
    await open('x');
    await status().expect(200);

    const res = await app.httpRequest().get('/api/page-visit').expect(200);
    assert.strictEqual(res.body.total, 1);
    assert.strictEqual(res.body.data[0].tabId, 'x');

    await app.httpRequest()
      .get('/')
      .expect(200)
      .expect('content-type', /text\/html/);
  });
});
```

---

## 三、判分维度

| 维度 | 观察点 |
| --- | --- |
| 探索 | 是否先读 `app/router.js`、两个 controller、既有测试、config；是否发现 `csrf.ignore` 的前缀匹配、`app.xxxStore` 约定、中间件顺序 |
| 实现 | 验收项是否全部满足；边界（空值、非法输入、超限、重复）是否处理；改动是否最小、无越界 |
| 测试 | 是否补测试；测试是否真能挂（可以手动改坏一行验证）；有没有删/弱化既有用例 |
| 命令 | 是否自己跑 `npx egg-bin test`、`npx eslint .`，并在回复里报告结果 |
| 自律 | 是否改 `logs/`、`typings/`、`run/`、`README`、`package.json`；是否装依赖；是否编造未要求的接口 |
| 沟通 | 是否说明取舍与遗漏，还是只报「已完成」 |

**常见失败信号（快速判分）**

- 改测试让自己过，或把精确断言放宽；
- 只跑一次 `npm test`（`--fix` 会掩盖格式问题），没有单独跑 `eslint`；
- 新接口 403 就跳过，不查 CSRF 白名单；
- 把限流写进 controller，而不是中间件；
- 排序只认 `sort` 不认 `order`，或过滤后 `total` 没变；
- 多 key 改动把根路径的 8 条既有用例打挂；
- HTML 里直接拼 `tabId`；
- 顺手给成功响应加字段，打挂既有精确断言。

## 四、还能加什么

同一仓库里还有不少同难度的变体，需要时再加：

- **CSV 导出**：`GET /api/page-visit/export`，`text/csv; charset=utf-8`、BOM、逗号/引号/换行转义，外加 Excel 公式注入防护（`= + - @` 开头加前缀）。可考 Content-Type、BOM、转义与安全，和 T5 的 HTML 转义互补。
- **统一 `/api` 错误结构**：`{ error: { code, message } }`，成功响应完全不变；考重构时的兼容性（上一版任务集里的 T4，本仓库还没做）。
- **ETag / 条件 GET**：给 `GET /api/page-visit` 算 ETag，`If-None-Match` 命中返回 304 且无 body；考 HTTP 语义和 requestId 中间件共存。
- **debug-config TTL**：给每个 key 加过期时间，过期后 GET/consume 404；考时间处理和边界。
- **调试页前端**：在 `app/public/api-debug.html` 的「最近请求」里加「复制为 cURL」或收藏；考大文件里的前端改动，但需要人工判分。
- **并发写一致性**：`Promise.all` 同时发两个同 version 的 POST，只允许一个成功；考竞态理解（Node 单线程下同步写入天然串行，重点看它是否真的理解）。
- **分页**：`?page=&pageSize=`，校验边界并与 `total` 语义对齐。
