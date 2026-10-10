export const EARLY_TYPES = new Set(['devtools', 'image_repair', 'black_box']);
export const SVG_LIMIT = 65536;
const SVG_TAGS = new Set(['svg','g','path','rect','circle','line','polyline','polygon']);
const SVG_ATTRS = new Set(['xmlns','viewBox','width','height','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','d','points','fill','stroke','stroke-width','opacity','fill-opacity','stroke-opacity','transform','id']);

export function roundDraft(puzzle, raw) {
  const base = { instance_id: puzzle.instance_id, code: '' };
  if (raw?.instance_id !== puzzle.instance_id) return { ...base, ...(puzzle.type === 'image_repair' ? { source:puzzle.source || '',marker:'' } : {}) };
  const code = typeof raw.code === 'string' ? raw.code.slice(0,200) : '';
  return { ...base, code, ...(puzzle.type === 'image_repair' ? {
    source:typeof raw.source === 'string' && new TextEncoder().encode(raw.source).length <= SVG_LIMIT ? raw.source : puzzle.source || '',
    marker:typeof raw.marker === 'string' ? raw.marker.slice(0,80) : ''
  } : {}) };
}
export function finalRoundSubmission(puzzle,draft) {
  return EARLY_TYPES.has(puzzle.type) ? { instance_id:puzzle.instance_id,code:draft?.code || '' } : draft;
}
export function normalizeProbe(input) { return String(input || '').trim().toUpperCase(); }
export function probeAllowed(puzzle,input) {
  const letter=normalizeProbe(input);
  return /^[A-Z]$/.test(letter) && !puzzle.blocked_letters?.includes(letter) && puzzle.remaining_probes > 0;
}

// An image preview is a restricted SVG image, never an HTML document or iframe.
// Server proof validation independently checks the restored geometry and source.
export function validatePreviewSource(source,Parser=globalThis.DOMParser) {
  if (typeof source !== 'string' || !source.trim()) throw new Error('Paste or upload the SVG source first.');
  if (new TextEncoder().encode(source).length > SVG_LIMIT) throw new Error('The source must be at most 64 KiB.');
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[|<\?|&/i.test(source)) throw new Error('Document declarations, entities and processing instructions are not supported.');
  if (!Parser) throw new Error('This browser cannot parse SVG. Use a current desktop browser.');
  const doc=new Parser().parseFromString(source,'image/svg+xml');
  const syntax=doc.querySelector('parsererror');
  if (syntax) throw new Error(`SVG syntax error: ${syntax.textContent.replace(/\s+/g,' ').slice(0,220)}`);
  if (doc.documentElement.localName !== 'svg') throw new Error('The source needs one SVG root.');
  let count=0;
  function visit(node,depth) {
    if (++count > 1500 || depth > 16) throw new Error('The drawing exceeds the preview complexity limit.');
    if (!SVG_TAGS.has(node.tagName) || (node.namespaceURI && node.namespaceURI !== 'http://www.w3.org/2000/svg')) throw new Error('Only the drawing’s SVG shapes and groups are allowed.');
    for (const attr of node.attributes) {
      if (!SVG_ATTRS.has(attr.name) || (attr.namespaceURI && attr.name !== 'xmlns')) throw new Error(`Unsupported SVG attribute: ${attr.name}.`);
      const value=attr.value;
      if (/url\s*\(|javascript:|data:|https?:|[<>]/i.test(value) && attr.name !== 'xmlns') throw new Error('External resources and executable content are not allowed.');
      if (value.length > 12000) throw new Error('A drawing attribute is too long.');
      if (['fill','stroke'].includes(attr.name) && !/^(none|transparent|currentColor|#[0-9a-f]{3,8}|[a-z]+)$/i.test(value)) throw new Error('Use a simple solid SVG colour.');
      if (['viewBox','width','height','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','stroke-width','opacity','fill-opacity','stroke-opacity','d','points','transform'].includes(attr.name)) {
        const values=value.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi) || [];
        if (/Infinity|NaN/i.test(value) || values.some(number=>!Number.isFinite(Number(number)) || Math.abs(Number(number)) > 10000)) throw new Error('Drawing coordinates must be finite and within the preview bounds.');
      }
    }
    for (const child of node.childNodes) {
      if (child.nodeType === 1) visit(child,depth+1);
      else if (child.nodeType === 3 && child.textContent.trim()) throw new Error('Text content is not part of this drawing.');
      else if (![3,8].includes(child.nodeType)) throw new Error('Unsupported SVG content.');
    }
  }
  visit(doc.documentElement,1);
  return source;
}

export function installStorageClue(puzzle,dbFactory=globalThis.indexedDB) {
  return new Promise((resolve,reject)=>{
    if (!dbFactory) { reject(new Error('IndexedDB is unavailable. Enable browser storage or ask an organizer for the equivalent storage clue. Your timer continues.')); return; }
    const open=dbFactory.open('CodeEscape',1);
    open.onupgradeneeded=()=>{ if(!open.result.objectStoreNames.contains('clues'))open.result.createObjectStore('clues'); };
    open.onerror=()=>reject(new Error('The browser could not open clue storage. Enable storage or ask an organizer for assistance.'));
    open.onblocked=()=>reject(new Error('Close other Code Escape tabs so clue storage can open.'));
    open.onsuccess=()=>{
      const db=open.result;
      let transaction;
      try {
        transaction=db.transaction('clues','readwrite');
        const store=transaction.objectStore('clues');
        // A shared device retains only this active team/run’s record.
        store.clear(); store.put({ instance_id:puzzle.instance_id,value:puzzle.storage_value },puzzle.storage_key);
        transaction.oncomplete=()=>{db.close();resolve();};
        transaction.onerror=transaction.onabort=()=>{db.close();reject(new Error('Clue storage could not be written. Ask an organizer for assistance.'));};
      } catch { db.close();reject(new Error('Clue storage is unavailable. Ask an organizer for assistance.')); }
    };
  });
}

export function clearStorageClues(dbFactory=globalThis.indexedDB) {
  if(!dbFactory)return;
  try {
    const request=dbFactory.open('CodeEscape',1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('clues'))request.result.createObjectStore('clues');};
    request.onsuccess=()=>{const db=request.result;try{const transaction=db.transaction('clues','readwrite');transaction.objectStore('clues').clear();transaction.oncomplete=transaction.onerror=transaction.onabort=()=>db.close();}catch{db.close();}};
  }catch{/* Storage cleanup must not stop sign-out. */}
}
