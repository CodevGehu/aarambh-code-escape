import api from './api';
export async function downloadPackingTool(url, discovery) {
  const response = discovery
    ? await api.post(url, { discovery_submission: discovery }, { responseType: 'blob' })
    : await api.get(url, { responseType: 'blob' });
  const file = URL.createObjectURL(response.data), link = document.createElement('a');
  link.href = file; link.download = 'aarambh-polygon-packer.zip'; link.click();
  setTimeout(() => URL.revokeObjectURL(file), 1000);
}
