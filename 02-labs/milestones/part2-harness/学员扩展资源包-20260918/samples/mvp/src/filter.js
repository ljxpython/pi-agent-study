// 标题关键词与状态联合筛选：query trim 后忽略大小写匹配标题；status 为 'all' 表示不限；两条件同时满足。
export function filterTasks(tasks, { query = '', status = 'all' } = {}) {
  const keyword = String(query ?? '').trim().toLowerCase();
  return tasks.filter(task => {
    const matchKeyword = keyword === '' || String(task.title).toLowerCase().includes(keyword);
    const matchStatus = status === 'all' || task.status === status;
    return matchKeyword && matchStatus;
  });
}
