export default function RoundTwoBooklet({ round }) {
  return <div className="booklet-round-two">
    <p className="notice"><strong>Two different images, two different tasks.</strong> The corrected SVG below repairs Image 1. Photograph 2 is a separate JPEG that unlocks after the repair; its metadata contains the final answer.</p>
    <p className="muted small">These values belong to this booklet instance. For testing, open Round 2 in Puzzle rehearsal and use its Answer booklet link so the source, marker and passphrase match that rehearsal. A live team has its own instance.</p>
    <section aria-label="Image 1 repair guide">
      <h3>1. Repair Image 1 · SVG source</h3>
      <p>Edit the broken SVG in the round’s source editor. Make the three repairs below, keeping the original drawing unchanged, then select <strong>Preview repaired image</strong>.</p>
      <ol className="booklet-repair-list">{round.repairs.map((repair, index) => <li key={index}>{repair}</li>)}</ol>
      <details className="booklet-source"><summary>Image 1 · original broken SVG</summary><pre>{round.broken_source}</pre></details>
      <details className="booklet-source"><summary>Image 1 · corrected SVG to paste into the editor</summary><p>This is the fixed code for the first image. It is not Photograph 2.</p><pre>{round.corrected_source}</pre></details>
      <figure className="booklet-restored-image"><img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(round.corrected_source)}`} alt="Restored first image showing VAULT and this instance’s six-digit marker"/><figcaption>Expected Image 1 preview after all three repairs.</figcaption></figure>
    </section>
    <section aria-label="Marker validation guide">
      <h3>2. Read and validate Image 1’s marker</h3>
      <p>Read the six digits in the restored drawing. Enter them in <strong>Marker read from the restored drawing</strong>, then select <strong>Validate source and marker</strong>. Both the repaired source and marker must be correct.</p>
      <dl><div className="booklet-field"><dt>Image 1 marker for this instance</dt><dd><code>{round.marker}</code></dd></div></dl>
      <p>Accepted validation unlocks Photograph 2. This stage is entirely digital; no physical QR or lab visit is needed.</p>
    </section>
    <section aria-label="Photograph 2 answer guide">
      <h3>3. Download Photograph 2 · read JPEG metadata</h3>
      <p>Select <strong>Download Photograph 2</strong> in the rehearsal or participant round. Inspect the downloaded original JPEG’s <strong>EXIF Artist</strong> field using a metadata tool. Do not edit its image code; screenshots and re-encoding can remove the metadata.</p>
      <dl><div className="booklet-field"><dt>Final answer · Photograph 2 EXIF Artist</dt><dd><code>{round.answer}</code></dd></div></dl>
      <p>Enter that value in <strong>Passphrase from Photograph 2</strong> and submit the round. The marker is an intermediate clue; this passphrase is the final answer.</p>
    </section>
    <details className="booklet-source"><summary>Instance details and reference submission</summary><dl>{['set_id','instance_id','rehearsal_id','context'].map(key => <div className="booklet-field" key={key}><dt>{key.replace(/_/g, ' ')}</dt><dd>{round[key]}</dd></div>)}</dl><pre>{JSON.stringify(round.reference_submission, null, 2)}</pre></details>
  </div>;
}
