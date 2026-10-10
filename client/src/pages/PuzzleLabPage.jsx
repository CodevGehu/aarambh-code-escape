import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { downloadPackingTool } from '../lib/downloadPackingTool';
import { downloadArtifact } from '../lib/downloadArtifact';
import { EARLY_TYPES, finalRoundSubmission } from '../lib/roundPuzzles';
import PuzzleWorkbench, { initialPuzzleSubmission } from '../components/puzzles/PuzzleWorkbench';
import '../styles/EarlyRounds.css';

export default function PuzzleLabPage() {
  const navigate=useNavigate();
  const [setId,setSetId]=useState('L1'),[questions,setQuestions]=useState([]),[selected,setSelected]=useState('');
  const [puzzle,setPuzzle]=useState(null),[rehearsalId,setRehearsalId]=useState(''),[draft,setDraft]=useState(null);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[feedback,setFeedback]=useState(null),[retry,setRetry]=useState(0);
  const generation=useRef(0);
  const question=questions.find(item=>item._id===selected);
  function chooseSet(id){generation.current++;setQuestions([]);setSelected('');setPuzzle(null);setDraft(null);setRehearsalId('');setFeedback(null);setSetId(id);}
  async function signout(){if(busy)return;setBusy(true);try{await api.post('/admin/logout');setPuzzle(null);setDraft(null);setQuestions([]);sessionStorage.removeItem('adminToken');window.dispatchEvent(new Event('admin-session-ended'));navigate('/admin',{replace:true});}catch(error){fail(error,'Unable to revoke the organizer session. Retry sign-out.');}finally{setBusy(false);}}
  function fail(error,fallback){if(error.response?.status===401){sessionStorage.removeItem('adminToken');navigate('/admin',{replace:true});}else setFeedback({valid:false,message:error.response?.data?.error||error.response?.data?.message||fallback});}
  useEffect(()=>{
    let active=true;const request=++generation.current;
    setQuestions([]);setSelected('');setPuzzle(null);setDraft(null);setRehearsalId('');setFeedback(null);setLoading(true);
    api.get('/admin/puzzles',{params:{set_id:setId}}).then(response=>{if(active&&request===generation.current)setQuestions(response.data.questions.filter(item=>item.set_id===setId).sort((a,b)=>a.level-b.level));}).catch(error=>{if(active)fail(error,'Unable to load this set. Retry when connected.');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[setId,retry]);
  async function select(item){
    if(busy)return;setSelected(item._id);setPuzzle(null);setDraft(null);setRehearsalId('');setFeedback(null);setBusy(true);
    const request=generation.current;
    try{
      if(item.rehearsal_required||EARLY_TYPES.has(item.puzzle?.type)){
        const response=await api.post('/admin/rehearsals',{question_id:item._id});
        if(request!==generation.current)return;
        setRehearsalId(response.data.rehearsal_id);setPuzzle(response.data.puzzle);setDraft(initialPuzzleSubmission(response.data.puzzle));
      }else{setPuzzle(item.puzzle);setDraft(initialPuzzleSubmission(item.puzzle));}
    }catch(error){fail(error,'Unable to create this rehearsal. Retry the round.');}finally{setBusy(false);}
  }
  const actionPath=kind=>rehearsalId?`/admin/rehearsals/${rehearsalId}/${kind}`:`/admin/puzzles/${question._id}/${kind}`;
  async function roundAction(kind,body){
    if(busy||!rehearsalId)throw new Error('Select a rehearsal first.');setBusy(true);setFeedback(null);
    try{const response=await api.post(actionPath(kind),{instance_id:puzzle.instance_id,...body});if(response.data.puzzle)setPuzzle(response.data.puzzle);return response.data;}
    finally{setBusy(false);}
  }
  async function artifact(id){if(busy||!rehearsalId)return;setBusy(true);try{await downloadArtifact(`/admin/rehearsals/${rehearsalId}/artifacts/${id}`,puzzle.instance_id);}finally{setBusy(false);}}
  async function discover(discovery_submission){
    if(busy||!question)return;setBusy(true);setFeedback(null);
    try{const response=await api.post(actionPath('discover'),{discovery_submission});setPuzzle(response.data.puzzle);setDraft({...initialPuzzleSubmission(response.data.puzzle),discovery_submission});setFeedback({valid:true,message:response.data.message});}
    catch(error){fail(error,'Unable to check the resource. Retry when connected.');}finally{setBusy(false);}
  }
  async function check(){
    if(busy||!draft||!question||puzzle.locked)return;setBusy(true);setFeedback(null);
    try{const response=await api.post(actionPath('check'),{puzzle_submission:finalRoundSubmission(puzzle,draft)});setFeedback(response.data);}
    catch(error){fail(error,'Unable to check the solution. Your work is still on this page.');}finally{setBusy(false);}
  }
  async function reference(){
    if(busy||!question)return;setBusy(true);setFeedback(null);
    try{const response=await api.post(actionPath('reference-check'),{});setFeedback(response.data);if(response.data.puzzle)setPuzzle(response.data.puzzle);}
    catch(error){fail(error,'Unable to run the reference check. Retry when connected.');}finally{setBusy(false);}
  }
  async function downloadTool(){if(busy||!question||puzzle.locked)return;setBusy(true);try{await downloadPackingTool(actionPath('tool'),draft?.discovery_submission);}catch(error){fail(error,'Unable to download the tool. Check your source discovery and retry.');}finally{setBusy(false);}}
  const bookletParams=new URLSearchParams({set_id:setId,...(question?{level:String(question.level)}:{}),...(rehearsalId?{rehearsal_id:rehearsalId}:{})});
  return <div className="page"><main className="container page-content"><div className="row between"><Link className="btn btn-ghost" to="/admin">Back to control room</Link><button className="btn" disabled={busy} onClick={signout}>Sign out</button></div><div className="page-heading" style={{marginTop:24}}><h1>Puzzle rehearsal</h1><p>Choose a set, then test any of its five rounds. Rehearsals leave live team progress, scores and logs untouched.</p></div><nav className="puzzle-set-nav" aria-label="Question set">{['L1','L2','L3'].map(id=><button key={id} className={`btn ${id===setId?'btn-primary':''}`} aria-pressed={id===setId} disabled={busy} onClick={()=>chooseSet(id)}>Set {id.slice(1)}</button>)}</nav><p className="rehearsal-selected">Set {setId.slice(1)} · {question?`Round ${question.level}`:'Select a round below'}</p>{loading?<p role="status">Loading this set…</p>:<><nav className="puzzle-lab-nav round-nav" aria-label={`Set ${setId.slice(1)} rounds`}>{questions.map(item=><button key={item._id} className={`btn ${item._id===selected?'btn-primary':''}`} aria-pressed={item._id===selected} disabled={busy} onClick={()=>select(item)}>Round {item.level}<br/>{item.puzzle?.title||item.title||item.question_text?.split('\n')[0]}</button>)}</nav>{!questions.length&&<button className="btn" onClick={()=>setRetry(value=>value+1)}>Retry loading set</button>}<div className="rehearsal-toolbar"><Link className="btn" to={`/admin/answer-booklet?${bookletParams}`}>Answer booklet</Link>{question&&<><button className="btn" disabled={busy} onClick={()=>select(question)}>Reset this rehearsal</button><button className="btn" disabled={busy||!puzzle} onClick={reference}>Run reference check</button></>}</div>{busy&&!puzzle&&<p role="status">Preparing isolated rehearsal…</p>}{question&&puzzle&&draft&&<section className="question-paper"><div className="question-body">{!puzzle.locked&&question.question_text!==puzzle.title&&<p className="question-text">{question.question_text}</p>}<PuzzleWorkbench key={puzzle.instance_id} puzzle={puzzle} draft={draft} onDiscover={discover} onDownloadTool={downloadTool} onAction={roundAction} onArtifact={artifact} onChange={next=>{setDraft({...next,...(draft.discovery_submission?{discovery_submission:draft.discovery_submission}:{})});setFeedback(null);}} disabled={busy}/><div className="answer-form"><button className="btn btn-primary" onClick={check} disabled={busy||puzzle.locked}>{busy?'Working…':'Check rehearsal solution'}</button></div></div></section>}</>}{feedback&&<p role="status" className={`notice ${feedback.valid?'notice-success':'notice-error'}`} style={{marginTop:20}}>{feedback.message}</p>}</main></div>;
}
