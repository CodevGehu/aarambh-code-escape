import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import RoundTwoBooklet from '../components/puzzles/RoundTwoBooklet';
import '../styles/EarlyRounds.css';

const title=key=>key.replace(/_/g,' ').replace(/^./,character=>character.toUpperCase());
function Value({value}){
  if(value==null)return <span>—</span>;
  if(typeof value==='string')return value.includes('\n')||value.includes('<svg')?<pre>{value}</pre>:<span>{value}</span>;
  if(typeof value==='number'||typeof value==='boolean')return <span>{String(value)}</span>;
  if(Array.isArray(value))return <ol>{value.map((item,index)=><li key={index}><Value value={item}/></li>)}</ol>;
  return <dl>{Object.entries(value).map(([key,item])=><div className="booklet-field" key={key}><dt>{title(key)}</dt><dd><Value value={item}/></dd></div>)}</dl>;
}
export default function AnswerBookletPage({practice=false}){
  const [params,setParams]=useSearchParams(),navigate=useNavigate();
  const setId=['L1','L2','L3'].includes(params.get('set_id'))?params.get('set_id'):'L1';
  const level=/^[1-5]$/.test(params.get('level')||'')?params.get('level'):'';
  const rehearsalId=params.get('rehearsal_id')||'';
  const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0),[busy,setBusy]=useState(false);
  const epoch=useRef(0);
  useEffect(()=>{
    let active=true;const request=++epoch.current;setData(null);setError('');setLoading(true);
    api.get(practice?'/practice/answer-booklet':'/admin/answer-booklet',{params:{set_id:setId,...(level?{level}:{}),...(rehearsalId?{rehearsal_id:rehearsalId}:{})}}).then(response=>{if(active&&request===epoch.current)setData(response.data);}).catch(err=>{if(!active)return;if(err.response?.status===401){if(!practice)sessionStorage.removeItem('adminToken');navigate(practice?'/':'/admin',{replace:true});}else setError(err.response?.data?.error||'Unable to load the protected booklet. Retry when connected.');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;epoch.current++;};
  },[setId,level,rehearsalId,retry,navigate]);
  useEffect(()=>{const clear=()=>{epoch.current++;setData(null);};window.addEventListener('admin-session-ended',clear);return()=>window.removeEventListener('admin-session-ended',clear);},[]);
  async function signout(){if(busy)return;setBusy(true);try{await api.post('/admin/logout');setData(null);sessionStorage.removeItem('adminToken');window.dispatchEvent(new Event('admin-session-ended'));navigate('/admin',{replace:true});}catch(err){setError(err.response?.data?.error||'Unable to revoke the organizer session. Retry sign-out.');}finally{setBusy(false);}}
  function chooseSet(id){epoch.current++;setData(null);setParams({set_id:id});}
  const rounds=data?.set_id===setId?data.rounds||[]:[];
  return <div className="page booklet-page"><main className="container page-content"><div className="row between">{practice?<Link className="btn btn-ghost" to="/practice">Back to practice</Link>:<><Link className="btn btn-ghost" to="/admin/puzzles">Back to rehearsal</Link><button className="btn" disabled={busy} onClick={signout}>{busy?'Signing out…':'Sign out'}</button></>}</div><div className="page-heading"><h1>{practice?'Answer booklet':'Organizer answer booklet'}</h1><p>{practice?'Solving paths and answers for every set and round. Values match your own practice rounds, so open a round in practice first to compare.':'Private solving paths and reference answers for the selected set. Rehearsal values belong to that rehearsal, and can differ from a live team’s values.'}</p></div>{!practice&&<div className="booklet-warning"><strong>Organizer access only.</strong><p>Keep this page and downloaded material away from participant devices. Contents are kept in memory and cleared when you leave or sign out.</p></div>}<nav className="puzzle-set-nav" aria-label="Booklet set">{['L1','L2','L3'].map(id=><button key={id} className={`btn ${id===setId?'btn-primary':''}`} aria-pressed={id===setId} onClick={()=>chooseSet(id)}>Set {id.slice(1)}</button>)}</nav><div className="booklet-set-controls"><label>Round <select className="input" value={level} onChange={event=>{setData(null);const next={set_id:setId};if(event.target.value)next.level=event.target.value;setParams(next);}}><option value="">All five rounds</option>{[1,2,3,4,5].map(value=><option key={value} value={value}>Round {value}</option>)}</select></label>{rehearsalId&&<p className="muted small">{practice?'Showing the answers for your open practice round.':'Showing the selected rehearsal’s reference values.'}</p>}</div>{loading?<p role="status">Loading protected answers…</p>:error?<div className="notice notice-error" role="alert"><p>{error}</p><button className="btn" onClick={()=>setRetry(value=>value+1)}>Retry booklet</button></div>:<div className="booklet-content">{rounds.map((round,index)=><section className="booklet-record" key={round.question_id||round.level||index}><h2>Round {round.level||index+1} · {round.title||'Reference guide'}</h2>{round.level===2&&round.broken_source&&round.corrected_source?<RoundTwoBooklet round={round}/>:<Value value={Object.fromEntries(Object.entries(round).filter(([key])=>!['level','title'].includes(key)))}/>}</section>)}{!rounds.length&&<p className="notice">No reference is available for this selection. Open a round in {practice?'practice':'rehearsal'} first.</p>}</div>}</main></div>;
}
