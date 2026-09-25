export function showToast(message, tone = 'info') {
  window.dispatchEvent(
    new CustomEvent('jobtracker:toast', {
      detail: { message, tone },
    })
  );
}
