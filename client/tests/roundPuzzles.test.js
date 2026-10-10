import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { finalRoundSubmission, installStorageClue, normalizeProbe, probeAllowed, roundDraft, validatePreviewSource } from '../src/lib/roundPuzzles.js';
const require=createRequire(import.meta.url);
const { SaxesParser }=require('../../server/node_modules/saxes');
const { svgPair }=require('../../server/services/earlyRoundPuzzles');

// Use the maintained XML parser as a DOM adapter; browser QA exercises DOMParser.
class Parser {
  parseFromString(source){
    const parser=new SaxesParser({xmlns:true}),stack=[];let root,error;
    parser.on('opentag',tag=>{const node={nodeType:1,tagName:tag.name,localName:tag.local,namespaceURI:tag.uri,attributes:Object.values(tag.attributes).map(attr=>({name:attr.name,value:attr.value,namespaceURI:attr.uri})),childNodes:[]};if(stack.length)stack.at(-1).childNodes.push(node);else root=node;stack.push(node);});
    parser.on('closetag',()=>stack.pop());parser.on('text',text=>stack.at(-1)?.childNodes.push({nodeType:3,textContent:text}));parser.on('comment',()=>stack.at(-1)?.childNodes.push({nodeType:8}));parser.on('error',err=>{error=err;});
    try{parser.write(source).close();}catch(err){error=err;}
    return {documentElement:root,querySelector:()=>error?{textContent:error.message}:null};
  }
}
test('three real source fixtures cannot preview until structural repairs, and restored images pass the safe subset',()=>{
  for(const set of ['L1','L2','L3']){const pair=svgPair(set,'192837');assert.throws(()=>validatePreviewSource(pair.broken,Parser),/syntax/);assert.equal(validatePreviewSource(pair.corrected,Parser),pair.corrected);}
});
test('preview rejects executable, external, entity and excessive geometry payloads',()=>{
  const shell=body=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 210">${body}</svg>`;
  for(const source of [shell('<script>alert(1)</script>'),shell('<foreignObject/>'),shell('<rect onclick="x()"/>'),shell('<image href="https://example.com/a.png"/>'),shell('<rect fill="url(https://example.com)"/>'),shell('<path d="M1e8 0"/>'),shell('<g>'.repeat(17)+'</g>'.repeat(17)),shell('<rect/>'.repeat(1501)), '<!DOCTYPE svg [<!ENTITY x SYSTEM "https://example.com">]>'+shell(''),shell('<rect x="NaN"/>'),shell('<rect xmlns="http://www.w3.org/1999/xhtml"/>'),' '.repeat(65537)])assert.throws(()=>validatePreviewSource(source,Parser));
});
test('SVG draft belongs to its instance and final submissions never carry source or marker',()=>{
  const puzzle={type:'image_repair',instance_id:'team-run-q1',source:'original'};
  const draft=roundDraft(puzzle,{instance_id:puzzle.instance_id,source:'edited',marker:'123456',code:'PASS'});
  assert.equal(draft.source,'edited');assert.deepEqual(finalRoundSubmission(puzzle,draft),{instance_id:puzzle.instance_id,code:'PASS'});
  assert.equal(roundDraft(puzzle,{...draft,instance_id:'other-team'}).source,'original');
  assert.equal(roundDraft(puzzle,{...draft,source:'é'.repeat(32769)}).source,'original');
});
test('target letters and invalid probes are blocked before consuming an experiment',()=>{
  const puzzle={blocked_letters:['E','L','M'],remaining_probes:6};
  assert.equal(normalizeProbe(' q '),'Q');assert.equal(probeAllowed(puzzle,' q '),true);
  for(const letter of ['E','l','M','ELM','1','',null])assert.equal(probeAllowed(puzzle,letter),false);
  assert.equal(probeAllowed({...puzzle,remaining_probes:0},'Q'),false);
});
test('browser storage clears obsolete records and writes only the current instance',async()=>{
  const operations=[];
  const factory={open(name,version){assert.equal(name,'CodeEscape');assert.equal(version,1);const request={result:{objectStoreNames:{contains:()=>true},transaction(store,mode){assert.equal(store,'clues');assert.equal(mode,'readwrite');const transaction={objectStore(){return{clear(){operations.push('clear');},put(value,key){operations.push({value,key});queueMicrotask(()=>transaction.oncomplete());}};}};return transaction;},close(){operations.push('close');}}};queueMicrotask(()=>request.onsuccess());return request;}};
  await installStorageClue({instance_id:'i',storage_key:'opaque',storage_value:42},factory);
  assert.deepEqual(operations,['clear',{value:{instance_id:'i',value:42},key:'opaque'},'close']);
  await assert.rejects(installStorageClue({instance_id:'i'},null),/unavailable/);
});
