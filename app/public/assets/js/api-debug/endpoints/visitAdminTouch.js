export const presets = [
  {
    id: 'visit-admin-touch',
    group: '访问维护',
    name: '批量记录打开',
    method: 'POST',
    path: '/api/visit-admin/touch',
    body: '{\n  "tabIds": [\n    "tab-1",\n    "tab-2"\n  ]\n}',
    hint: 'tabIds 是 1 到 50 个 trim 后非空的字符串，允许重复并会累加 openCount；成功 200 { data: { accepted, total } }，accepted 为输入长度，total 为处理后条数；新记录 openCount 为 1，已有记录保留 openedAt 并更新 lastOpenedAt 与 requestId；整批同一时间戳；每次写入后按 pageVisit.maxTabs 淘汰最久未打开的记录；非数组、空数组、超过 50、非字符串、空白字符串返回 400 { message }，store 不变。',
  },
];
