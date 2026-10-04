import { useEffect, useRef, useState } from 'react';
import '../../styles/PuzzleWorkbench.css';
import { importPackingLayout } from '../../lib/packingImport';

const TITLES = { fence:'Fence laboratory', packing:'Polygon packing studio', sliding:'Cargo bay', machine:'Permutation machine', courier:'Courier controller', fold:'Fold and cut studio', shadow:'Projection table' };
const COLORS = ['#5b19d1','#ff4ac0','#255719','#bd5c00','#06777f','#7b425e'];
export function initialPuzzleSubmission(puzzle) {
  const base = { instance_id:puzzle.instance_id };
  if(puzzle.locked) return base;
  switch (puzzle.type) {
    case 'fence': return { ...base,edges:[] };
    case 'sliding': return { ...base,moves:[] };
    case 'packing': return { ...base,container_side:puzzle.initial_container_side,positions:puzzle.pieces.map((piece,index)=>({id:piece.id,x:Number((2.6*Math.cos(index*2*Math.PI/puzzle.pieces.length)).toFixed(4)),y:Number((2.6*Math.sin(index*2*Math.PI/puzzle.pieces.length)).toFixed(4)),rotation:0})) };
    case 'machine': return { ...base,program:[] };
    case 'courier': return { ...base,program:'' };
    case 'fold': return { ...base,folds:[],cut:{ a:[0,0],b:[0,0] } };
    case 'shadow': return { ...base,layers:puzzle.layers.map(layer => ({ id:layer.id,rotation:0,x:0,y:0 })) };
    default: return base;
  }
}
export function restorePuzzleSubmission(puzzle,raw) {
  const fresh=initialPuzzleSubmission(puzzle);
  if(puzzle.locked) return fresh;
  if (!raw || typeof raw!=='object' || raw.instance_id!==puzzle.instance_id) return fresh;
  const validPoint=value=>Array.isArray(value)&&value.length===2&&value.every(Number.isSafeInteger);
  switch(puzzle.type) {
    case'fence': { const ids=new Set(puzzle.edges.map(edge=>edge.id));if(!Array.isArray(raw.edges)||raw.edges.length>puzzle.fence_budget||!raw.edges.every(id=>typeof id==='string'&&ids.has(id)))return fresh;return {...fresh,edges:[...new Set(raw.edges)]}; }
    case'sliding': {const ids=new Set(puzzle.pieces.map(piece=>piece.id));if(!Array.isArray(raw.moves)||raw.moves.length>puzzle.max_moves||!raw.moves.every(move=>move&&ids.has(move.id)&&Number.isInteger(move.delta)&&Math.abs(move.delta)<=6&&move.delta!==0))return fresh;return{...fresh,moves:raw.moves.map(({id,delta})=>({id,delta}))};}
    case'packing': {if(!Number.isFinite(raw.container_side)||raw.container_side<puzzle.min_container_side||raw.container_side>puzzle.coordinate_limit||!Array.isArray(raw.positions)||raw.positions.length!==puzzle.pieces.length)return fresh;const positions=[];for(const piece of puzzle.pieces){const pose=raw.positions.find(value=>value&&value.id===piece.id);if(!pose||![pose.x,pose.y,pose.rotation].every(Number.isFinite)||Math.abs(pose.x)>puzzle.coordinate_limit||Math.abs(pose.y)>puzzle.coordinate_limit||pose.rotation<0||pose.rotation>=360)return fresh;positions.push({id:piece.id,x:pose.x,y:pose.y,rotation:pose.rotation});}return{...fresh,container_side:raw.container_side,positions};}
    case'machine': {const labels=new Set(puzzle.buttons.map(button=>button.label));if(!Array.isArray(raw.program)||raw.program.length>puzzle.max_steps||!raw.program.every(label=>labels.has(label)))return fresh;return{...fresh,program:[...raw.program]};}
    case'courier': return typeof raw.program==='string'&&raw.program.length<=4000?{...fresh,program:raw.program}:fresh;
    case'fold': {const ids=new Set(puzzle.operations.map(item=>item.id));if(!Array.isArray(raw.folds)||raw.folds.length>puzzle.required_folds||!raw.folds.every(id=>ids.has(id))||!raw.cut||!validPoint(raw.cut.a)||!validPoint(raw.cut.b)||[raw.cut.a,raw.cut.b].some(point=>point[0]<0||point[0]>puzzle.sheet.width||point[1]<0||point[1]>puzzle.sheet.height))return fresh;return{...fresh,folds:[...raw.folds],cut:{a:[...raw.cut.a],b:[...raw.cut.b]}};}
    case'shadow': {if(!Array.isArray(raw.layers)||raw.layers.length!==puzzle.layers.length)return fresh;const values=[];for(const layer of puzzle.layers){const pose=raw.layers.find(item=>item&&item.id===layer.id);if(!pose||![0,90,180,270].includes(pose.rotation)||!Number.isSafeInteger(pose.x)||!Number.isSafeInteger(pose.y)||pose.x<0||pose.y<0||pose.x>puzzle.board.width-layer.size||pose.y>puzzle.board.height-layer.size)return fresh;values.push({id:layer.id,rotation:pose.rotation,x:pose.x,y:pose.y});}return{...fresh,layers:values};}
    default: return fresh;
  }
}
function Button({ children, ...props }) { return <button type="button" className="puzzle-button" {...props}>{children}</button>; }
function Grid({ width,height,cells,label,marks={} }) {
  const filled = new Set(cells.map(([x,y]) => `${x},${y}`));
  return <div className="puzzle-grid" role="img" aria-label={label} style={{ gridTemplateColumns:`repeat(${width},1fr)` }}>
    {Array.from({ length:width*height },(_,i) => { const key=`${i%width},${Math.floor(i/width)}`; return <span key={key} className={`puzzle-grid-cell ${filled.has(key) ? 'filled' : ''}`}>{marks[key] || (filled.has(key) ? '●' : '')}</span>; })}
  </div>;
}
function Research({ puzzle }) {
  const [helperOpen,setHelperOpen] = useState(false);
  const helper = puzzle.helper || puzzle.research_hint;
  return <details className="puzzle-research"><summary>Research desk</summary>
    <p>{puzzle.discovery_clue || 'Study the reference, then test the method on your own instance. During the event, your timer continues while you research.'}</p>
    {helper && <><Button onClick={() => setHelperOpen(value => !value)} aria-expanded={helperOpen}>{helperOpen ? 'Hide research hint' : 'Reveal research hint'}</Button>{helperOpen && <p className="puzzle-helper">{helper}</p>}</>}
  </details>;
}
export default function PuzzleWorkbench({ puzzle,draft,onChange,onDiscover,onDownloadTool,disabled=false }) {
  const history = useRef([]);
  const [,setHistoryVersion] = useState(0);
  useEffect(() => { history.current=[]; setHistoryVersion(0); },[puzzle.instance_id]);
  const current = draft || initialPuzzleSubmission(puzzle);
  function change(next) { if (disabled) return; history.current.push(current); if (history.current.length>250) history.current.shift(); onChange({ ...next,instance_id:puzzle.instance_id }); setHistoryVersion(value => value+1); }
  function undo() { if (disabled || !history.current.length) return; onChange(history.current.pop()); setHistoryVersion(value => value+1); }
  const props = { puzzle,draft:current,onChange:change,onDownloadTool,disabled };
  if(puzzle.locked) return <DiscoveryGate key={puzzle.instance_id} puzzle={puzzle} onDiscover={onDiscover} disabled={disabled} />;
  const panels = { fence:Fence,packing:Packing,sliding:Sliding,machine:Machine,courier:Courier,fold:Fold,shadow:Shadow };
  const Panel = panels[puzzle.type];
  if (!Panel) return <p role="alert">This workbench is unavailable. Reload the room to try again.</p>;
  return <section className="puzzle-workbench" aria-label={TITLES[puzzle.type]}>
    <header className="puzzle-heading"><h2>{puzzle.title || TITLES[puzzle.type]}</h2><span>{TITLES[puzzle.type]}</span></header>
    <div className="puzzle-body">{puzzle.instructions?.map((instruction,i) => <p key={i} className="puzzle-help">{instruction}</p>)}<Panel key={puzzle.instance_id} {...props} /></div>
    <div className="puzzle-footer"><Button onClick={undo} disabled={disabled || !history.current.length}>Undo</Button><Button onClick={() => change(initialPuzzleSubmission(puzzle))} disabled={disabled}>Reset workbench</Button><p className="puzzle-help">Preview only. Submit your result below for official validation.</p></div>
    <Research key={puzzle.instance_id} puzzle={puzzle} />
  </section>;
}

function DiscoveryGate({puzzle,onDiscover,disabled}) {
  const [url,setUrl]=useState(''),[toolUrl,setToolUrl]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const blocked=disabled||busy;
  const toolRequired=!!puzzle.discovery?.tool_required;
  async function discover(event){event.preventDefault();if(blocked||!url.trim()||(toolRequired&&!toolUrl.trim())||!onDiscover)return;setBusy(true);setMessage('');try{await onDiscover({instance_id:puzzle.instance_id,url:url.trim(),...(toolRequired?{tool_url:toolUrl.trim()}:{})});}catch(error){setMessage(error.response?.data?.error||error.message||'The reference could not be checked. Try again.');}finally{setBusy(false);}}
  return <section className="puzzle-workbench puzzle-discovery" aria-label="Discover the reference"><header className="puzzle-heading"><h2>{puzzle.title}</h2><span>Discovery first</span></header><div className="puzzle-body"><p className="puzzle-help">Follow the clue to find a {puzzle.discovery?.platform || 'video'} reference. Check your discovery to open the experiment.</p><blockquote className="puzzle-poem">{(puzzle.discovery?.clue || 'Search for the method described in the room’s clue.').split(/(122)/).map((part,index)=>part==='122'?<strong key={index}>122</strong>:part)}</blockquote>{toolRequired&&<p className="puzzle-help">{puzzle.discovery.second_resource || 'Find the creator’s open-source tool linked from the video.'}</p>}<form className="puzzle-discovery-form" onSubmit={discover}><label htmlFor={`discovery-url-${puzzle.instance_id}`}>Discovered video URL</label><input id={`discovery-url-${puzzle.instance_id}`} type="text" inputMode="url" className="input" autoComplete="off" spellCheck="false" maxLength={1024} value={url} disabled={blocked} placeholder="Paste the full video URL" onChange={event=>{setUrl(event.target.value);setMessage('');}}/>{toolRequired&&<><label htmlFor={`discovery-tool-${puzzle.instance_id}`}>Discovered tool repository URL</label><input id={`discovery-tool-${puzzle.instance_id}`} type="text" inputMode="url" className="input" autoComplete="off" spellCheck="false" maxLength={1024} value={toolUrl} disabled={blocked} placeholder="Paste the tool’s repository URL" onChange={event=>{setToolUrl(event.target.value);setMessage('');}}/></>}<button className="puzzle-button primary" disabled={blocked||!url.trim()||(toolRequired&&!toolUrl.trim())||!onDiscover}>{busy?'Checking discovery…':'Check discovery and open puzzle'}</button></form>{message&&<p className="puzzle-status" data-error="true" role="alert">{message}</p>}<p className="puzzle-help">During the event, your timer continues while you research. Opening the experiment does not award points.</p></div></section>;
}

export function packingPreview(puzzle,draft) {
  const container=puzzle.container.unit_vertices.map(([x,y])=>[x*draft.container_side,y*draft.container_side]);
  const pieces=puzzle.pieces.map(piece=>{const pose=draft.positions.find(value=>value.id===piece.id),angle=pose.rotation*Math.PI/180;return{id:piece.id,vertices:piece.vertices.map(([x,y])=>[x*Math.cos(angle)-y*Math.sin(angle)+pose.x,x*Math.sin(angle)+y*Math.cos(angle)+pose.y])};});
  const tolerance=puzzle.tolerance || 1e-6;
  const area=container.reduce((total,[x,y],index)=>{const next=container[(index+1)%container.length];return total+x*next[1]-next[0]*y;},0),direction=Math.sign(area);
  const outside=pieces.filter(piece=>piece.vertices.some(([x,y])=>container.some(([ax,ay],index)=>{const[bx,by]=container[(index+1)%container.length];return direction*((bx-ax)*(y-ay)-(by-ay)*(x-ax))/Math.hypot(bx-ax,by-ay) < -tolerance;}))).map(piece=>piece.id);
  function overlap(first,second){for(const polygon of[first,second])for(let index=0;index<polygon.length;index++){const point=polygon[index],next=polygon[(index+1)%polygon.length],axis=[-(next[1]-point[1]),next[0]-point[0]];const length=Math.hypot(...axis);if(!length)continue;const project=vertices=>vertices.map(([x,y])=>(x*axis[0]+y*axis[1])/length),a=project(first),b=project(second);if(Math.min(Math.max(...a),Math.max(...b))-Math.max(Math.min(...a),Math.min(...b))<=tolerance)return false;}return true;}
  const overlaps=[];for(let i=0;i<pieces.length;i++)for(let j=i+1;j<pieces.length;j++)if(overlap(pieces[i].vertices,pieces[j].vertices))overlaps.push([pieces[i].id,pieces[j].id]);
  return{container,pieces,outside,overlaps};
}
function Packing({puzzle,draft,onChange,onDownloadTool,disabled}) {
  const [selected,setSelected]=useState(puzzle.pieces[0].id),[json,setJson]=useState(''),[message,setMessage]=useState('');
  const pose=draft.positions.find(value=>value.id===selected),preview=packingPreview(puzzle,draft),extent=Math.max(2,...preview.container.flat().map(Math.abs),...preview.pieces.flatMap(piece=>piece.vertices.flat()).map(Math.abs))+.25,scale=180/extent;
  const pixel=([x,y])=>[200+x*scale,200+y*scale];
  function update(field,value){const number=Number(value);if(!Number.isFinite(number))return;const result=field==='rotation'?((number%360)+360)%360:Math.max(-puzzle.coordinate_limit,Math.min(puzzle.coordinate_limit,number));onChange({...draft,positions:draft.positions.map(item=>item.id===selected?{...item,[field]:Number(result.toFixed(6))}:item)});setMessage('');}
  function importLayout(){try{const values=JSON.parse(json);if(!values||!Array.isArray(values.positions))throw new Error('Include container_side and a positions array.');const candidate=importPackingLayout(puzzle,values);if(!Number.isFinite(candidate.container_side)||candidate.container_side<puzzle.min_container_side||candidate.container_side>puzzle.coordinate_limit||candidate.positions.length!==puzzle.pieces.length||new Set(candidate.positions.map(item=>item?.id)).size!==puzzle.pieces.length||!puzzle.pieces.every(piece=>candidate.positions.some(pose=>pose&&pose.id===piece.id&&[pose.x,pose.y,pose.rotation].every(Number.isFinite)&&Math.abs(pose.x)<=puzzle.coordinate_limit&&Math.abs(pose.y)<=puzzle.coordinate_limit&&pose.rotation>=0&&pose.rotation<360)))throw new Error('Include every piece once, with finite coordinates and rotation from 0 to below 360 degrees.');onChange(restorePuzzleSubmission(puzzle,candidate));setMessage('Layout imported into the preview. Submit below to verify it.');}catch(error){setMessage(error instanceof SyntaxError?'The layout is not valid JSON.':error.message);}}
  return <>{puzzle.tool_available&&<div className="notice"><strong>Run the creator’s packing tool</strong><p>Download the working event copy, install its requirements, and use the room’s shape counts as inputs. Import the result JSON below to check its geometry and refine your fit.</p><Button disabled={disabled||!onDownloadTool} onClick={onDownloadTool}>Download packing tool</Button></div>}<div className="puzzle-statline"><span>Container side <strong>{draft.container_side.toFixed(4)}</strong></span><span>Target <strong>≤ {puzzle.target_container_side}</strong></span><span><strong>{preview.outside.length}</strong> outside pieces</span><span><strong>{preview.overlaps.length}</strong> overlapping pairs</span></div><div className="puzzle-layout"><div className="puzzle-board"><svg viewBox="0 0 400 400" role="img" aria-label="Polygon packing preview. Each numbered piece can move and rotate using the controls."><line x1="10" y1="200" x2="390" y2="200" stroke="#ddd5ca"/><line x1="200" y1="10" x2="200" y2="390" stroke="#ddd5ca"/><polygon points={preview.container.map(vertex=>pixel(vertex).join(',')).join(' ')} fill="#b8ff38" fillOpacity=".35" stroke="#111" strokeWidth="3"/>{preview.pieces.map((piece,index)=>{const position=draft.positions.find(item=>item.id===piece.id),[x,y]=pixel([position.x,position.y]);return<g key={piece.id}><polygon points={piece.vertices.map(vertex=>pixel(vertex).join(',')).join(' ')} fill={COLORS[index%COLORS.length]} fillOpacity=".7" stroke={piece.id===selected?'#111':'#fff'} strokeWidth={piece.id===selected?4:2}/><text x={x} y={y+5} textAnchor="middle" fontSize="15" fontWeight="800" fill="white" stroke="#111" strokeWidth=".3">{index+1}</text></g>;})}<text x="206" y="216" fontSize="12">(0,0)</text></svg><p className="puzzle-help">Green boundary: container. Select a numbered polygon, change its position and angle, then shrink the container. Touching edges are allowed.</p></div><div className="puzzle-controls"><label>Container side<input type="number" min={puzzle.min_container_side} max={puzzle.coordinate_limit} step="0.01" value={draft.container_side} disabled={disabled} onChange={event=>{const value=Number(event.target.value);if(Number.isFinite(value))onChange({...draft,container_side:Math.max(puzzle.min_container_side,Math.min(puzzle.coordinate_limit,value))});}}/></label><label>Polygon<select value={selected} disabled={disabled} onChange={event=>setSelected(event.target.value)}>{puzzle.pieces.map((piece,index)=><option key={piece.id} value={piece.id}>{index+1}. {piece.id}</option>)}</select></label><div className="puzzle-inline-fields">{['x','y'].map(axis=><label key={axis}>Position {axis}<input type="number" min={-puzzle.coordinate_limit} max={puzzle.coordinate_limit} step="0.01" value={pose[axis]} disabled={disabled} onChange={event=>update(axis,event.target.value)}/></label>)}</div><label>Clockwise angle<input type="number" min="0" max="359.999999" step="1" value={pose.rotation} disabled={disabled} onChange={event=>update('rotation',event.target.value)}/></label><div className="puzzle-actions"><Button disabled={disabled} onClick={()=>update('rotation',pose.rotation+30)}>Rotate +30°</Button><Button disabled={disabled} onClick={()=>update('rotation',pose.rotation-30)}>Rotate −30°</Button></div><div className="puzzle-actions" role="group" aria-label="Nudge selected polygon">{[{label:'←',axis:'x',step:-.05},{label:'→',axis:'x',step:.05},{label:'↑',axis:'y',step:-.05},{label:'↓',axis:'y',step:.05}].map(control=><Button key={control.label} disabled={disabled} aria-label={`Move polygon ${control.label} by 0.05`} onClick={()=>update(control.axis,pose[control.axis]+control.step)}>{control.label} .05</Button>)}</div><p className="puzzle-help">Coordinates increase right/down. The preview automatically adjusts its scale to keep your pieces visible.</p></div></div>{!!preview.overlaps.length&&<p className="puzzle-help">Overlapping pairs: {preview.overlaps.map(pair=>pair.join(' / ')).join('; ')}.</p>}<details className="puzzle-packing-json"><summary>Import or copy a layout</summary><p className="puzzle-help">A layout contains container_side and positions: [{'{'}id, x, y, rotation{'}'}]. You can also paste the event tool’s packing-result.json; its units and orientation are converted automatically.</p><label htmlFor={`packing-json-${puzzle.instance_id}`}>Layout JSON</label><textarea id={`packing-json-${puzzle.instance_id}`} value={json} maxLength={6000} rows="8" spellCheck="false" disabled={disabled} onChange={event=>setJson(event.target.value)}/><div className="puzzle-actions"><Button disabled={disabled||!json.trim()} onClick={importLayout}>Import layout</Button><Button disabled={disabled} onClick={()=>{setJson(JSON.stringify({container_side:draft.container_side,positions:draft.positions},null,2));setMessage('Current layout copied to the JSON editor.');}}>Copy current layout to editor</Button></div>{message&&<p className="puzzle-status" role="status">{message}</p>}</details></>;
}

function Fence({ puzzle,draft,onChange,disabled }) {
  const nodes = new Map(puzzle.nodes.map(node => [node.id,node]));
  const selected = new Set(draft.edges || []);
  const xs=puzzle.nodes.map(node=>node.x),ys=puzzle.nodes.map(node=>node.y);
  const minX=Math.min(...xs),minY=Math.min(...ys),width=Math.max(...xs)-minX || 1,height=Math.max(...ys)-minY || 1;
  const scale=Math.min(300/width,260/height);
  const point = node => [175+(node.x-minX-width/2)*scale,155+(height/2-node.y+minY)*scale];
  function toggle(id) { onChange({ ...draft,edges:selected.has(id) ? draft.edges.filter(edge=>edge!==id) : [...draft.edges,id] }); }
  return <><div className="puzzle-statline"><span><strong>{selected.size}</strong> / {puzzle.fence_budget} fence segments</span><span>Target total area: <strong>{Number(puzzle.target_area).toFixed(3)}</strong></span><span>Each field: at most <strong>{puzzle.max_field_area}</strong></span></div>
    <div className="puzzle-board"><svg viewBox="0 0 350 310" aria-label="Triangular lattice. Use the fence buttons below to choose segments." role="img">
      {puzzle.edges.map(edge => { const [x1,y1]=point(nodes.get(edge.a)),[x2,y2]=point(nodes.get(edge.b)); return <line key={edge.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke={selected.has(edge.id) ? '#5b19d1' : '#c4bdb5'} strokeWidth={selected.has(edge.id) ? 6 : 2} />; })}
      {puzzle.nodes.map(node=>{ const [x,y]=point(node); return <g key={node.id}><circle cx={x} cy={y} r="6" fill="#111"/><text x={x>300?x-8:x+8} y={y-7} textAnchor={x>300?'end':'start'} fontSize="14" fontWeight="700">{node.id}</text></g>; })}
    </svg></div>
    <p className="puzzle-help">Select the connections to build your fields. Shared boundaries use one fence segment. Coordinate units are shown in the question.</p>
    <div className="puzzle-edge-controls" role="group" aria-label="Fence connections">{puzzle.edges.map(edge => <Button key={edge.id} disabled={disabled||(!selected.has(edge.id)&&selected.size>=puzzle.fence_budget)} aria-pressed={selected.has(edge.id)} className={`puzzle-button ${selected.has(edge.id)?'is-selected':''}`} onClick={()=>toggle(edge.id)}>{edge.a}–{edge.b}</Button>)}</div>
  </>;
}

function cargoPreview(puzzle,moves) {
  const pieces=puzzle.pieces.map(piece=>({...piece}));
  let error='',escaped=false;
  const occupied=(piece,x=piece.x,y=piece.y)=>Array.from({length:piece.length},(_,i)=>[x+(piece.axis==='x'?i:0),y+(piece.axis==='y'?i:0)]);
  for (const move of moves) {
    if(escaped){error='The cargo has already left the bay. Undo a move to revise your sequence.';break;}
    const piece=pieces.find(item=>item.id===move.id);
    if (!piece || !Number.isInteger(move.delta) || !move.delta || Math.abs(move.delta)>6) { error='That move is invalid.'; break; }
    const step=Math.sign(move.delta),oldX=piece.x,oldY=piece.y;
    for(let n=0;n<Math.abs(move.delta);n++) {
      const x=piece.x+(piece.axis==='x'?step:0),y=piece.y+(piece.axis==='y'?step:0);
      const next=occupied(piece,x,y);
      const allowed=next.every(([cx,cy])=> (cx>=0&&cx<puzzle.board.width&&cy>=0&&cy<puzzle.board.height) || (piece.target&&cy===puzzle.exit.row&&(puzzle.exit.side==='right'?cx>=puzzle.board.width:cx<0)));
      const others=new Set(pieces.filter(item=>item.id!==piece.id).flatMap(item=>occupied(item).map(([cx,cy])=>`${cx},${cy}`)));
      if (!allowed||next.some(([cx,cy])=>others.has(`${cx},${cy}`))) { error=`${piece.id} cannot slide through that boundary or cargo.`; break; }
      piece.x=x; piece.y=y;
      escaped=piece.target&&(puzzle.exit.side==='right'?x>=puzzle.board.width:x+piece.length<=0);
      if(escaped&&n!==Math.abs(move.delta)-1){error='Stop the move as soon as the cargo fully leaves the bay.';break;}
    }
    if(error) { piece.x=oldX; piece.y=oldY; break; }
  }
  return {pieces,error,escaped};
}
function Sliding({ puzzle,draft,onChange,disabled }) {
  const [selected,setSelected]=useState(puzzle.pieces.find(piece=>piece.target)?.id || puzzle.pieces[0].id),[message,setMessage]=useState('');
  useEffect(()=>setMessage(''),[draft.moves]);
  const preview=cargoPreview(puzzle,draft.moves || []),cell=50,pad=18;
  const piece=preview.pieces.find(item=>item.id===selected);
  function move(delta) { if(draft.moves.length>=puzzle.max_moves){setMessage('Move limit reached. Undo or reset to revise your sequence.');return;} const moves=[...draft.moves,{id:selected,delta}],next=cargoPreview(puzzle,moves); if(next.error) setMessage(next.error); else { setMessage('Move added to your submission.'); onChange({...draft,moves}); } }
  return <div className="puzzle-layout"><div className="puzzle-board"><svg viewBox={`0 0 ${puzzle.board.width*cell+2*pad+30} ${puzzle.board.height*cell+2*pad}`} role="img" aria-label="Cargo bay preview. Select cargo using the controls.">
    <defs><pattern id={`cargo-grid-${puzzle.instance_id}`} width={cell} height={cell} patternUnits="userSpaceOnUse"><path d={`M ${cell} 0 L 0 0 0 ${cell}`} fill="none" stroke="#c4bdb5" strokeWidth="1"/></pattern></defs>
    <rect x={pad} y={pad} width={puzzle.board.width*cell} height={puzzle.board.height*cell} fill={`url(#cargo-grid-${puzzle.instance_id})`} stroke="#111" strokeWidth="3"/>
    <text x={puzzle.exit.side==='right'?pad+puzzle.board.width*cell+8:2} y={pad+(puzzle.exit.row+.6)*cell} fontSize="19">{puzzle.exit.side==='right'?'→':'←'}</text>
    {preview.pieces.map((item,i)=><g key={item.id}><rect x={pad+item.x*cell+3} y={pad+item.y*cell+3} width={(item.axis==='x'?item.length:1)*cell-6} height={(item.axis==='y'?item.length:1)*cell-6} rx="5" fill={item.target?'#b8ff38':COLORS[i%COLORS.length]} stroke={selected===item.id?'#111':'#fff'} strokeWidth={selected===item.id?4:2}/><text x={pad+(item.x+.5)*cell} y={pad+(item.y+.6)*cell} textAnchor="middle" fill={item.target?'#111':'#fff'} fontWeight="800" fontSize="17">{item.id}</text></g>)}
  </svg></div><div className="puzzle-controls"><label>Cargo<select value={selected} disabled={disabled} onChange={event=>{setSelected(event.target.value);setMessage('');}}>{puzzle.pieces.map(item=><option key={item.id} value={item.id}>{item.id}{item.target?' (delivery)':''}</option>)}</select></label><p className="puzzle-help">Cargo {selected} slides {piece?.axis==='x'?'horizontally':'vertically'}. Move the delivery completely through the exit.</p>
    <div className="puzzle-actions">{[-1,1,-2,2,-6,6].map(delta=><Button key={delta} disabled={disabled||preview.escaped||draft.moves.length>=puzzle.max_moves} onClick={()=>move(delta)}>{delta<0?(piece?.axis==='x'?'←':'↑'):(piece?.axis==='x'?'→':'↓')} {Math.abs(delta)}</Button>)}</div>
    <p className="puzzle-status" role="status">{preview.escaped?'Cargo has left the bay in this preview. Submit your sequence below.':message || `${draft.moves.length}/${puzzle.max_moves} moves in your submission.`}</p><div className="puzzle-history" aria-label="Cargo move history">{draft.moves.length ? draft.moves.map((item,i)=><span key={i}>{i+1}. {item.id} {item.delta>0?'+':''}{item.delta}<br/></span>) : 'Your move history will appear here.'}</div>
  </div></div>;
}

function machinePreview(puzzle,program) {
  let tiles=[...puzzle.start];
  for (const button of program) { const observation=puzzle.observations.find(item=>item.button===button); if(!observation) continue; const permutation=observation.after.map(value=>observation.before.indexOf(value)); if(permutation.some(index=>index<0)) continue; tiles=permutation.map(index=>tiles[index]); }
  return tiles;
}
function Tiles({ values,label }) { return <div className="puzzle-tile-strip" role="img" aria-label={`${label}: ${values.join(', ')}`}>{values.map((tile,i)=><span className="puzzle-tile" key={i}>{tile}</span>)}</div>; }
function Machine({ puzzle,draft,onChange,disabled }) {
  const [showExperiment,setShowExperiment]=useState(false);
  const current=machinePreview(puzzle,draft.program || []);
  return <><div className="puzzle-layout"><div><h3>Maintenance observations</h3>{puzzle.observations.map((observation,i)=><div className="puzzle-observation" key={i}><strong>{observation.button}</strong><Tiles values={observation.before} label="Before"/><span className="puzzle-help">becomes</span><Tiles values={observation.after} label="After"/></div>)}</div><div className="puzzle-controls"><div><h3>Your target</h3><Tiles values={puzzle.target} label="Target"/></div><div><h3>Starting tiles</h3><Tiles values={puzzle.start} label="Start"/></div><div className="puzzle-actions">{puzzle.buttons.map(button=><Button key={button.label} disabled={disabled||draft.program.length>=puzzle.max_steps} onClick={()=>{onChange({...draft,program:[...draft.program,button.label]});setShowExperiment(false);}}>{button.label}</Button>)}</div><p className="puzzle-help">Build a button sequence, then run it against the visible observations.</p><Button disabled={disabled} onClick={()=>setShowExperiment(true)}>Run sequence preview</Button>{showExperiment&&<div><strong>Preview output</strong><Tiles values={current} label="Preview output"/><p className="puzzle-help">Inferred from the observations; submit for verification.</p></div>}</div></div><div className="puzzle-history"><strong>{draft.program.length}/{puzzle.max_steps} presses</strong><p className="puzzle-sequence">{draft.program.join(' → ') || 'No buttons selected.'}</p></div></>;
}

// This deliberately small language never executes JavaScript or arbitrary code.
export function parseCourierProgram(source,maxLines=60,maxRepeat=160,maxDepth=4) {
  if(source.length>4000)throw new Error('Use at most 4000 characters.');
  const lines=source.split(/\r?\n/).map((line,index)=>({text:line.trim(),line:index+1})).filter(item=>item.text);
  if(!lines.length)throw new Error('Write at least one instruction.');
  if(lines.length>maxLines) throw new Error(`Use at most ${maxLines} instruction lines.`);
  let cursor=0;
  function block(depth=0) {
    if(depth>maxDepth) throw new Error(`Use at most ${maxDepth} nested blocks.`);
    const body=[];
    while(cursor<lines.length) {
      const item=lines[cursor++],text=item.text;
      if(text==='END'||text==='ELSE') return {body,ending:text};
      if(['MOVE','TURN_LEFT','TURN_RIGHT','STOP'].includes(text)) {body.push({op:text});continue;}
      if(/^REPEAT \d+$/.test(text)) {const count=Number(text.split(' ')[1]); if(!Number.isSafeInteger(count)||count<1||count>maxRepeat)throw new Error(`Line ${item.line}: repeat from 1 to ${maxRepeat} times.`); const inner=block(depth+1);if(inner.ending!=='END')throw new Error(`Line ${item.line}: REPEAT needs END.`);body.push({op:'REPEAT',count,body:inner.body});continue;}
      if(['IF_WALL','IF_RIGHT_OPEN','IF_GOAL'].includes(text)) {const yes=block(depth+1);let no=[];if(yes.ending==='ELSE'){const alternate=block(depth+1);if(alternate.ending!=='END')throw new Error(`Line ${item.line}: IF needs END.`);no=alternate.body;}else if(yes.ending!=='END')throw new Error(`Line ${item.line}: IF needs END.`);body.push({op:text,yes:yes.body,no});continue;}
      throw new Error(`Line ${item.line}: unknown instruction “${text}”.`);
    }
    return {body,ending:null};
  }
  const result=block();if(result.ending)throw new Error('ELSE or END has no matching block.');return result.body;
}
export function runCourierPreview(example,ast,maxSteps=1500) {
  const state={...example.start},path=[[state.x,state.y]],directions=[[0,-1],[1,0],[0,1],[-1,0]];
  let steps=0,stopped=false,error='';
  const blocked=direction=>{const [dx,dy]=directions[direction];return !example.grid[state.y+dy] || ['#','T',undefined].includes(example.grid[state.y+dy]?.[state.x+dx]);};
  function execute(body) {for(const node of body) {if(stopped)return;if(++steps>maxSteps)throw new Error('Step limit reached.');switch(node.op){case'MOVE':if(blocked(state.direction))throw new Error('Courier hit a wall or restricted tunnel.');state.x+=directions[state.direction][0];state.y+=directions[state.direction][1];path.push([state.x,state.y]);break;case'TURN_LEFT':state.direction=(state.direction+3)%4;break;case'TURN_RIGHT':state.direction=(state.direction+1)%4;break;case'STOP':if(example.grid[state.y]?.[state.x]!=='G')throw new Error('STOP was used before delivery.');stopped=true;break;case'REPEAT':for(let i=0;i<node.count&&!stopped;i++){if(++steps>maxSteps)throw new Error('Step limit reached.');execute(node.body);}break;default:{const condition=node.op==='IF_WALL'?blocked(state.direction):node.op==='IF_RIGHT_OPEN'?!blocked((state.direction+1)%4):example.grid[state.y]?.[state.x]==='G';execute(condition?node.yes:node.no);}}}}
  try {execute(ast);}catch(failure){error=failure.message;}
  return {state,path,steps,error,atGoal:example.grid[state.y]?.[state.x]==='G'};
}
function Courier({ puzzle,draft,onChange,disabled }) {
  const [exampleIndex,setExampleIndex]=useState(0),[preview,setPreview]=useState(null),[message,setMessage]=useState('');
  const example=puzzle.examples[exampleIndex],width=Math.max(...example.grid.map(row=>row.length)),height=example.grid.length;
  useEffect(()=>{setPreview(null);setMessage('');},[draft.program,exampleIndex]);
  function run() {try {const ast=parseCourierProgram(draft.program,puzzle.max_lines,puzzle.max_repeat,puzzle.max_depth);const result=runCourierPreview(example,ast,puzzle.max_steps);setPreview(result);setMessage(result.error || (result.atGoal?'Preview reached the visible goal. Your program is also checked on unseen maps when submitted.':'Preview stopped away from the goal.'));}catch(error){setMessage(error.message);setPreview(null);}}
  const position=preview?.state || example.start;
  return <><div className="puzzle-layout"><div><label htmlFor={`courier-code-${puzzle.instance_id}`}>Controller instructions</label><div className="puzzle-code-shell"><div className="puzzle-line-numbers" aria-hidden="true">{draft.program.split('\n').map((_,i)=><div key={i}>{i+1}</div>)}</div><textarea id={`courier-code-${puzzle.instance_id}`} spellCheck="false" disabled={disabled} value={draft.program} maxLength={4000} placeholder={'Write uppercase instructions here.'} onChange={event=>{onChange({...draft,program:event.target.value});setPreview(null);setMessage('');}} /></div><p className="puzzle-help">Each block ends with END. Use uppercase instructions; blank lines are allowed. This editor runs only the puzzle’s instruction language.</p></div><div className="puzzle-controls"><label>Test map<select disabled={disabled} value={exampleIndex} onChange={event=>{setExampleIndex(Number(event.target.value));setPreview(null);setMessage('');}}>{puzzle.examples.map((item,i)=><option key={item.id} value={i}>{item.id}</option>)}</select></label><div className="puzzle-board"><svg viewBox={`0 0 ${width*35} ${height*35}`} role="img" aria-label={`Courier test map ${example.id}. Goal marked G; blocked tunnels marked T.`}>{example.grid.flatMap((row,y)=>Array.from(row,(tile,x)=><g key={`${x},${y}`}><rect x={x*35+1} y={y*35+1} width="33" height="33" fill={tile==='#'?'#111':tile==='G'?'#b8ff38':tile==='T'?'#ff4ac0':'#f2efe8'}/>{['G','T'].includes(tile)&&<text x={x*35+17} y={y*35+23} textAnchor="middle" fontWeight="800">{tile}</text>}</g>))}{preview&&<polyline points={preview.path.map(([x,y])=>`${x*35+17},${y*35+17}`).join(' ')} fill="none" stroke="#5b19d1" strokeWidth="3" strokeDasharray="5 3"/>}<circle cx={position.x*35+17} cy={position.y*35+17} r="12" fill="#5b19d1"/><text x={position.x*35+17} y={position.y*35+23} textAnchor="middle" fill="white" fontSize="18">{['↑','→','↓','←'][position.direction]}</text></svg></div><Button disabled={disabled||!draft.program.trim()} onClick={run}>Run test map</Button>{message&&<p className="puzzle-status" role="status">{message}{preview&&` (${preview.steps} steps)`}</p>}</div></div><details><summary>Instruction reference</summary><p className="puzzle-help">MOVE advances one cell. TURN_LEFT and TURN_RIGHT rotate. STOP ends execution at the goal. REPEAT n repeats a block (1–{puzzle.max_repeat}). IF_WALL tests the cell ahead; IF_RIGHT_OPEN tests the cell to your right; IF_GOAL tests your current cell. IF blocks can have ELSE. Every REPEAT or IF requires END. Restricted tunnels T count as blocked. Maximum {puzzle.max_lines} lines, {puzzle.max_depth} nested blocks, and {puzzle.max_steps} execution steps.</p><p className="puzzle-help">Example syntax: REPEAT 2 / TURN_LEFT / END (write each instruction on its own line).</p></details></>;
}

function Fold({ puzzle,draft,onChange,disabled }) {
  const [operation,setOperation]=useState(puzzle.operations[0]?.id || '');
  const folds=(draft.folds || []).map(id=>puzzle.operations.find(item=>item.id===id)).filter(Boolean);
  function transform(point) {let [x,y]=point;for(const fold of folds){const value=fold.axis==='x'?x:y;const moving=fold.side==='low'?value<fold.line:value>fold.line;if(moving){if(fold.axis==='x')x=2*fold.line-x;else y=2*fold.line-y;}}return[x,y];}
  const sampleX=[0,puzzle.sheet.width,...folds.filter(fold=>fold.axis==='x').map(fold=>fold.line)],sampleY=[0,puzzle.sheet.height,...folds.filter(fold=>fold.axis==='y').map(fold=>fold.line)];
  const corners=sampleX.flatMap(x=>sampleY.map(y=>transform([x,y]))),xs=corners.map(point=>point[0]),ys=corners.map(point=>point[1]);
  const scale=30,pad=20,point=([x,y])=>[pad+x*scale,pad+y*scale];
  const [aX,aY]=point(draft.cut.a),[bX,bY]=point(draft.cut.b);
  function endpoint(name,axis,value) {const limit=axis===0?puzzle.sheet.width:puzzle.sheet.height;const numeric=Math.max(0,Math.min(limit,Math.trunc(Number(value)||0)));const next=[...draft.cut[name]];next[axis]=numeric;onChange({...draft,cut:{...draft.cut,[name]:next}});}
  return <div className="puzzle-layout"><div className="puzzle-board"><svg viewBox={`0 0 ${puzzle.sheet.width*scale+2*pad} ${puzzle.sheet.height*scale+2*pad}`} role="img" aria-label="Unfolded target segments, folded sheet bounds, and your proposed cut.">
    <rect x={pad} y={pad} width={puzzle.sheet.width*scale} height={puzzle.sheet.height*scale} fill="#fff" stroke="#111" strokeWidth="2"/>
    {Array.from({length:puzzle.sheet.width+1},(_,x)=><line key={`x${x}`} x1={pad+x*scale} y1={pad} x2={pad+x*scale} y2={pad+puzzle.sheet.height*scale} stroke="#e3dfd8"/>)}{Array.from({length:puzzle.sheet.height+1},(_,y)=><line key={`y${y}`} x1={pad} y1={pad+y*scale} x2={pad+puzzle.sheet.width*scale} y2={pad+y*scale} stroke="#e3dfd8"/>)}
    <rect x={pad+Math.min(...xs)*scale} y={pad+Math.min(...ys)*scale} width={(Math.max(...xs)-Math.min(...xs))*scale} height={(Math.max(...ys)-Math.min(...ys))*scale} fill="#b8ff38" fillOpacity=".35" stroke="#255719" strokeWidth="2"/>
    {puzzle.target_segments.map((segment,i)=>{const[a,b]=segment.map(point);return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#b01676" strokeWidth="4" strokeDasharray="7 4"/>;})}
    <line x1={aX} y1={aY} x2={bX} y2={bY} stroke="#5b19d1" strokeWidth="5"/>
    {(draft.cut.a[0]!==draft.cut.b[0]||draft.cut.a[1]!==draft.cut.b[1])&&[draft.cut.a,draft.cut.b].map((p,i)=>{const[x,y]=point(p);return<g key={i}><circle cx={x} cy={y} r="5" fill="#5b19d1"/><text x={x+7} y={y-7} fontSize="12" fontWeight="800">{i?'B':'A'}</text></g>;})}
    <text x={pad} y={pad-7} fontSize="11">(0,0)</text><text x={pad+puzzle.sheet.width*scale-27} y={pad+puzzle.sheet.height*scale+16} fontSize="11">({puzzle.sheet.width},{puzzle.sheet.height})</text>
  </svg><p className="puzzle-help">Dashed pink: unfolded target. Green: folded sheet bounds. Purple: your cut in sheet coordinates.</p></div><div className="puzzle-controls"><label>Fold operation<select disabled={disabled} value={operation} onChange={event=>setOperation(event.target.value)}>{puzzle.operations.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label><Button disabled={disabled||draft.folds.length>=puzzle.required_folds||draft.folds.includes(operation)} onClick={()=>onChange({...draft,folds:[...draft.folds,operation]})}>Apply fold</Button><p className="puzzle-help">{draft.folds.length}/{puzzle.required_folds} folds selected. Use each fold once.</p><div className="puzzle-history">{draft.folds.map((id,i)=><p key={i}>{i+1}. {puzzle.operations.find(item=>item.id===id)?.label}</p>)}</div>
    {['a','b'].map(name=><fieldset key={name}><legend>Cut endpoint {name.toUpperCase()}</legend><div className="puzzle-inline-fields">{['x','y'].map((axis,index)=><label key={axis}>{axis}<input type="number" min="0" max={index===0?puzzle.sheet.width:puzzle.sheet.height} step="1" disabled={disabled} value={draft.cut[name][index]} onChange={event=>endpoint(name,index,event.target.value)}/></label>)}</div></fieldset>)}
    <p className="puzzle-help">Use two different endpoints inside the folded sheet. The server unfolds your cut to check the resulting segments.</p>
  </div></div>;
}

function rotatedCell(cell,size,rotation) {let[x,y]=cell;for(let i=0;i<rotation/90;i++)[x,y]=[size-1-y,x];return[x,y];}
function Shadow({ puzzle,draft,onChange,disabled }) {
  const [selected,setSelected]=useState(puzzle.layers[0].id);
  const placement=draft.layers.find(layer=>layer.id===selected),size=puzzle.layers.find(layer=>layer.id===selected)?.size || 3;
  const projection=new Set(),marks={};let outside=0;
  for(const layer of puzzle.layers){const pose=draft.layers.find(item=>item.id===layer.id);if(!pose)continue;for(const cell of layer.cells){let[x,y]=rotatedCell(cell,layer.size,pose.rotation);x+=pose.x;y+=pose.y;if(x<0||y<0||x>=puzzle.board.width||y>=puzzle.board.height){outside++;continue;}projection.add(`${x},${y}`);marks[`${x},${y}`]='●';}}
  const target=new Set(puzzle.target_cells.map(cell=>cell.join(','))),difference=[...new Set([...projection,...target])].filter(key=>projection.has(key)!==target.has(key)).length;
  function poseChange(field,value){onChange({...draft,layers:draft.layers.map(layer=>layer.id===selected?{...layer,[field]:value}:layer)});}
  const cells=[...projection].map(key=>key.split(',').map(Number));
  return <><div className="puzzle-grid-pair"><div><h3>Your projection</h3><Grid width={puzzle.board.width} height={puzzle.board.height} cells={cells} label={`Your projection has ${projection.size} dark cells.`}/></div><div><h3>Target projection</h3><Grid width={puzzle.board.width} height={puzzle.board.height} cells={puzzle.target_cells} label={`Target projection has ${target.size} dark cells.`}/></div></div>
    <div className="puzzle-statline"><span><strong>{difference}</strong> different cells</span><span><strong>{outside}</strong> layer cells outside the board</span></div>
    <div className="puzzle-layout"><div className="puzzle-controls"><label>Layer<select disabled={disabled} value={selected} onChange={event=>setSelected(event.target.value)}>{puzzle.layers.map(layer=><option key={layer.id} value={layer.id}>{layer.id}</option>)}</select></label><label>Clockwise rotation<select disabled={disabled} value={placement.rotation} onChange={event=>poseChange('rotation',Number(event.target.value))}>{[0,90,180,270].map(angle=><option key={angle} value={angle}>{angle}°</option>)}</select></label><div className="puzzle-inline-fields">{['x','y'].map(axis=><label key={axis}>Layer {axis}<input type="number" disabled={disabled} min="0" max={(axis==='x'?puzzle.board.width:puzzle.board.height)-size} step="1" value={placement[axis]} onChange={event=>poseChange(axis,Math.max(0,Math.min((axis==='x'?puzzle.board.width:puzzle.board.height)-size,Math.trunc(Number(event.target.value)||0))))}/></label>)}</div><div className="puzzle-actions"><Button disabled={disabled} onClick={()=>poseChange('rotation',(placement.rotation+90)%360)}>Rotate 90°</Button></div><p className="puzzle-help">Coordinates place the top-left of the rotated layer. Opaque marked cells block light; overlaps project as one dark cell.</p></div><div><h3>Layer {selected} pattern</h3><Grid width={size} height={size} cells={puzzle.layers.find(layer=>layer.id===selected).cells.map(cell=>rotatedCell(cell,size,placement.rotation))} label={`Layer ${selected}, rotated ${placement.rotation} degrees.`}/></div></div>
  </>;
}
