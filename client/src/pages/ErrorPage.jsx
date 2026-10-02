import { ArrowLeft, Code2, RotateCcw } from 'lucide-react';

export default function ErrorPage({ code = '404', title = 'This room doesn’t exist.', message = 'The link may be incomplete or the page may have moved. Return to your escape route to continue.', onRetry }) {
  return <main className="recovery-page"><section className="recovery-card" aria-labelledby="recovery-title">
    <a className="recovery-brand" href="/"><Code2 size={24} /> Aarambh 4.0 · Code Escape</a>
    <p className="recovery-code" aria-hidden="true">{code}</p>
    <h1 id="recovery-title">{title}</h1>
    <p className="recovery-description">{message}</p>
    <div className="row">{onRetry && <button className="btn btn-primary" onClick={onRetry}><RotateCcw size={17} /> Try again</button>}
      <a className={`btn ${onRetry ? 'btn-ghost' : 'btn-primary'}`} href="/dashboard"><ArrowLeft size={17} /> Back to rooms</a>
      <a className="btn btn-ghost" href="/">Team login</a>
    </div>
    <p className="muted small">If the event is live, your timer continues while you reconnect.</p>
  </section></main>;
}
