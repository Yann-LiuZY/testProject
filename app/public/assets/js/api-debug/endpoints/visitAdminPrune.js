export const presets = [
  {
    id: 'visit-admin-prune',
    group: '访问维护',
    name: '淘汰访问记录',
    method: 'POST',
    path: '/api/visit-admin/prune',
    body: '{\n  "maxTabs": 10\n}',
    hint: 'maxTabs 必须是 0 到 1000 的整数；成功 200 { data: { removed, remaining } }，按最久未打开淘汰到不超过 maxTabs；缺失、null、字符串、小数、负数、大于 1000 返回 400 { message }，store 不变；不读写服务端配置里的 pageVisit.maxTabs。',
  },
];
