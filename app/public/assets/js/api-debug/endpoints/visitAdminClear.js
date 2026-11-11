export const presets = [
  {
    id: 'visit-admin-clear',
    group: '访问维护',
    name: '清空访问记录',
    method: 'POST',
    path: '/api/visit-admin/clear',
    body: '{}',
    hint: '请求体可省略或 {}；成功返回 200 和 { data: { removed, remaining: 0 } }，removed 为清空前条数；空 store 时 removed 为 0 且可重复调用；只清页面访问记录，不动调试配置。',
  },
];
