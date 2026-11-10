export function methodHasBody(method) {
  return method === 'POST' || method === 'PUT' || method === 'PATCH';
}

export async function copyText(text) {
  if (text === undefined || text === null) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    // 非安全上下文或权限被拒绝时，继续用 execCommand 兜底
  }
  let area;
  try {
    area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    area.setSelectionRange(0, area.value.length);
    return document.execCommand('copy');
  } catch (err) {
    return false;
  } finally {
    if (area) area.remove();
  }
}

export async function copyWithFeedback(button, text, labels) {
  const ok = await copyText(text);
  button.textContent = ok ? labels[0] : labels[1];
  clearTimeout(button.feedbackTimer);
  button.feedbackTimer = setTimeout(() => {
    button.textContent = labels[2];
  }, 1600);
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
