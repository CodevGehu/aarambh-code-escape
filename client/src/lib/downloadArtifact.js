import api from './api';
export async function downloadArtifact(path,instanceId,name='photograph-2.jpg') {
  const response=await api.get(path,{responseType:'blob',params:{instance_id:instanceId}});
  const url=URL.createObjectURL(response.data);
  const link=document.createElement('a');link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
