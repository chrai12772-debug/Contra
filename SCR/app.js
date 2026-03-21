import { useState, useEffect, useRef, useCallback } from "react";

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const SYSTEM_PROMPT = `You are the world's most formidable counter-argument machine. Your SOLE purpose is to construct the strongest, most devastating opposing argument to whatever claim the user makes — regardless of how correct, popular, or obvious the original argument seems.

You operate across ALL domains: philosophy, mathematics, science, law, ethics, politics, economics, history, religion, culture, everyday life, art, psychology, physics, biology, medicine, engineering, logic — everything.

RULES:
- ALWAYS argue the OPPOSITE position, no matter what
- Back every counter-point with real facts, data, studies, statistics, historical examples, or logical proofs
- Be intellectually ruthless but academically rigorous
- Never say "I agree" or validate the original argument
- Use the strongest version of the opposing argument (Steelman the counter-position)
- Cite real researchers, papers, experiments, court cases, theorems, philosophers where relevant
- Be bold and confident — not wishy-washy

RESPONSE FORMAT — use EXACTLY these markers:

[FIELD]
The academic/intellectual domain (e.g., Philosophy, Quantum Physics, Constitutional Law, Behavioral Economics)

[THESIS_DETECTED]
One sentence restating the user's argument clearly.

[COUNTER_THESIS]
One powerful sentence — the direct opposite claim you will defend.

[ARGUMENT_1]
Title: [bold claim]
Body: First major counter-argument with facts, data, or citations.

[ARGUMENT_2]
Title: [bold claim]
Body: Second major counter-argument.

[ARGUMENT_3]
Title: [bold claim]
Body: Third major counter-argument.

[ARGUMENT_4]
Title: [bold claim]
Body: Fourth major counter-argument.

[ARGUMENT_5]
Title: [bold claim]
Body: Fifth major counter-argument.

[EVIDENCE]
Key data points, statistics, studies, experiments, cases, or proofs. Format as a list of 4-6 items, each starting with "•".

[LOGICAL_STRUCTURE]
The formal logical form of the counter-argument and why it holds.

[WEAKEST_LINK]
Honestly identify the weakest point in the original argument.

[VERDICT]
A single devastating closing paragraph that summarizes why the counter-position wins.`;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Mono:wght@400;500&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#0d0d0d;--paper:#f5f0e8;--red:#c0392b;--red-dark:#922b21;--border:#ddd5c4;--grey:#888;--mid:#444}
body{background:var(--paper)}
@keyframes slideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes strikeThrough{from{width:0}to{width:100%}}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes marquee{from{transform:translateX(100%)}to{transform:translateX(-100%)}}
textarea:focus{outline:none}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:var(--paper)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
.arg-block{animation:slideIn 0.5s ease both}
.arg-block:nth-child(1){animation-delay:.05s}
.arg-block:nth-child(2){animation-delay:.15s}
.arg-block:nth-child(3){animation-delay:.25s}
.arg-block:nth-child(4){animation-delay:.35s}
.arg-block:nth-child(5){animation-delay:.45s}
.example-btn:hover{background:var(--ink)!important;color:var(--paper)!important;border-color:var(--ink)!important}
.submit-btn:hover:not(:disabled){background:var(--red-dark)!important}
.key-input:focus{outline:none;border-color:var(--red)!important}
`;

function extractSection(text, tag) {
  if (!text) return "";
  const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[[A-Z_0-9]+\\]|$)`, "i");
  const m = text.match(re);
  return m ? m[1].trim() : "";
}
function extractArgBlock(text, tag) {
  const raw = extractSection(text, tag);
  if (!raw) return null;
  const t = raw.match(/Title:\s*(.+)/i);
  const b = raw.match(/Body:\s*([\s\S]+)/i);
  return { title: t ? t[1].trim() : "", body: b ? b[1].trim() : raw };
}
function extractBullets(text) {
  if (!text) return [];
  return text.split("\n").map(l => l.trim())
    .filter(l => /^[•\-*]/.test(l))
    .map(l => l.replace(/^[•\-*]\s*/, "").trim())
    .filter(Boolean);
}
function parseResponse(raw) {
  return {
    field:    extractSection(raw, "FIELD") || null,
    thesis:   extractSection(raw, "THESIS_DETECTED") || null,
    counter:  extractSection(raw, "COUNTER_THESIS") || null,
    arg1:     extractArgBlock(raw, "ARGUMENT_1"),
    arg2:     extractArgBlock(raw, "ARGUMENT_2"),
    arg3:     extractArgBlock(raw, "ARGUMENT_3"),
    arg4:     extractArgBlock(raw, "ARGUMENT_4"),
    arg5:     extractArgBlock(raw, "ARGUMENT_5"),
    evidence: extractBullets(extractSection(raw, "EVIDENCE")),
    logic:    extractSection(raw, "LOGICAL_STRUCTURE") || null,
    weakest:  extractSection(raw, "WEAKEST_LINK") || null,
    verdict:  extractSection(raw, "VERDICT") || null,
    raw,
  };
}

async function callGemini(apiKey, argument) {
  const res = await fetch(`${GEMINI_API}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: `Counter-argue this:\n\n"${argument.trim()}"` }] }],
      generationConfig: { maxOutputTokens: 3000, temperature: 0.9 }
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `API error ${res.status}`;
    throw new Error(msg);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini. Please try again.");
  return text;
}

const EXAMPLES = [
  { label: "Philosophy", text: "Free will exists and humans are responsible for their choices" },
  { label: "Science",    text: "Vaccines are safe and everyone should get vaccinated" },
  { label: "Math",       text: "0.999... is not equal to 1" },
  { label: "Law",        text: "All criminals deserve harsh punishment" },
  { label: "Economics",  text: "Capitalism is the best economic system" },
  { label: "Physics",    text: "Time travel is impossible" },
  { label: "Ethics",     text: "Lying is always morally wrong" },
  { label: "History",    text: "Democracy is the most stable form of government" },
];

const TICKERS = ["ANALYZING THESIS…","SEARCHING COUNTER-EVIDENCE…","STRESS-TESTING LOGIC…","IDENTIFYING FALLACIES…","BUILDING REBUTTAL…","SHARPENING ARGUMENT…"];

function LoadingView() {
  const [t, setT] = useState(0);
  useEffect(() => { const i = setInterval(() => setT(p => (p+1)%TICKERS.length), 850); return () => clearInterval(i); }, []);
  return (
    <div style={{padding:"60px 0",textAlign:"center"}}>
      <div style={{width:56,height:56,borderRadius:"50%",border:"3px solid var(--border)",borderTop:"3px solid var(--red)",animation:"spin 0.9s linear infinite",margin:"0 auto 24px"}}/>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,letterSpacing:"3px",color:"var(--red)"}}>{TICKERS[t]}</div>
    </div>
  );
}

function ArgCard({ num, title, body }) {
  if (!title && !body) return null;
  const ROMAN = ["","I","II","III","IV","V"];
  return (
    <div className="arg-block" style={{borderLeft:"3px solid var(--red)",paddingLeft:20,marginBottom:28}}>
      <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"3px",color:"var(--red)",marginBottom:6}}>ARGUMENT {ROMAN[num]}</div>
      {title && <div style={{fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:18,color:"var(--ink)",lineHeight:1.3,marginBottom:10}}>{title}</div>}
      <p style={{fontFamily:"'Libre Baskerville',serif",fontSize:14,lineHeight:1.85,color:"var(--mid)"}}>{body}</p>
    </div>
  );
}

export default function ContraApp() {
  const [apiKey,  setApiKey]  = useState(() => localStorage.getItem("gemini_key") || "");
  const [showKey, setShowKey] = useState(false);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const resultsRef = useRef(null);

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => { try { document.head.removeChild(el); } catch {} };
  }, []);

  const saveKey = (k) => { setApiKey(k); localStorage.setItem("gemini_key", k); };

  const handleSubmit = useCallback(async () => {
    if (!apiKey.trim()) { setError("Please enter your Gemini API key first."); return; }
    if (!input.trim() || loading) return;
    setLoading(true); setResult(null); setError(null); setShowRaw(false);
    try {
      const raw = await callGemini(apiKey.trim(), input);
      const parsed = parseResponse(raw);
      if (!parsed.verdict && !parsed.counter) { setError("Incomplete response. Please try again."); }
      else {
        setResult(parsed);
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 100);
      }
    } catch(e) { setError(e.message || "Unexpected error."); }
    finally { setLoading(false); }
  }, [apiKey, input, loading]);

  const handleReset = () => { setResult(null); setError(null); setInput(""); setShowRaw(false); };

  return (
    <div style={{minHeight:"100vh",background:"var(--paper)",fontFamily:"'Libre Baskerville',serif"}}>

      {/* Ticker */}
      <div style={{background:"var(--red)",color:"white",height:32,overflow:"hidden",display:"flex",alignItems:"center"}}>
        <div style={{whiteSpace:"nowrap",animation:"marquee 18s linear infinite",fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"2px"}}>
          {Array(4).fill("  ✦  CONTRA COUNTER-ARGUMENT ENGINE  ✦  PHILOSOPHY  ✦  SCIENCE  ✦  LAW  ✦  MATHEMATICS  ✦  ETHICS  ✦  HISTORY  ✦  ECONOMICS  ✦  PHYSICS  ").join("")}
        </div>
      </div>

      {/* Masthead */}
      <header style={{borderBottom:"4px solid var(--ink)",padding:"32px 0 24px",textAlign:"center"}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"5px",color:"var(--grey)",marginBottom:10}}>THE OPPOSITION · EST. MMXXVI</div>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontWeight:900,fontSize:"clamp(40px,8vw,82px)",color:"var(--ink)",letterSpacing:-2,lineHeight:1,marginBottom:8}}>CONTRA</h1>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"var(--red)",letterSpacing:"4px"}}>COUNTER-ARGUMENT SYSTEM · POWERED BY GEMINI</div>
        <div style={{margin:"16px auto 0",maxWidth:500,fontStyle:"italic",fontSize:13,color:"var(--grey)",lineHeight:1.6}}>
          "The test of a first-rate intelligence is the ability to hold two opposed ideas in the mind at the same time." — F. Scott Fitzgerald
        </div>
      </header>

      <div style={{maxWidth:860,margin:"0 auto",padding:"0 20px 80px"}}>

        {/* API Key Banner */}
        <div style={{background:"var(--ink)",padding:"16px 20px",marginTop:24,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"2px",color:"var(--red)",flexShrink:0}}>🔑 GEMINI API KEY</div>
          <input
            className="key-input"
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={e => saveKey(e.target.value)}
            placeholder="Paste your free Gemini API key here…"
            style={{flex:1,minWidth:220,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"white",padding:"8px 12px",fontFamily:"'DM Mono',monospace",fontSize:12}}
          />
          <button onClick={() => setShowKey(p=>!p)} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.2)",color:"var(--grey)",fontSize:10,padding:"8px 12px",fontFamily:"'DM Mono',monospace",cursor:"pointer",letterSpacing:"1px"}}>
            {showKey ? "HIDE" : "SHOW"}
          </button>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
            style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--red)",letterSpacing:"1px",textDecoration:"none",flexShrink:0}}>
            GET FREE KEY →
          </a>
        </div>
        <div style={{background:"rgba(192,57,43,0.08)",border:"1px solid rgba(192,57,43,0.2)",borderTop:"none",padding:"8px 20px",marginBottom:24}}>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--grey)"}}>
            ✓ Free · 1,500 requests/day · Key saved in your browser only · Never sent to any server except Google
          </span>
        </div>

        {/* Input */}
        <section style={{borderBottom:"2px solid var(--border)",padding:"12px 0 32px"}}>
          <div style={{display:"flex",gap:"32px",flexWrap:"wrap"}}>
            <div style={{flex:"1 1 440px"}}>
              <label style={{display:"block",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"3px",color:"var(--red)",marginBottom:12}}>▸ STATE YOUR ARGUMENT</label>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.ctrlKey && e.key==="Enter") handleSubmit(); }}
                placeholder={"State any claim, thesis, or position…\n\nCtrl+Enter to submit"}
                style={{width:"100%",minHeight:160,background:"white",border:"2px solid var(--border)",color:"var(--ink)",fontSize:15,padding:16,resize:"vertical",fontFamily:"'Libre Baskerville',serif",lineHeight:1.7,transition:"border-color .2s"}}
                onFocus={e => e.target.style.borderColor="var(--red)"}
                onBlur={e  => e.target.style.borderColor="var(--border)"}
              />
              <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}>
                <button className="submit-btn" onClick={handleSubmit} disabled={!input.trim()||loading||!apiKey.trim()}
                  style={{background:input.trim()&&!loading&&apiKey.trim()?"var(--red)":"var(--border)",color:input.trim()&&!loading&&apiKey.trim()?"white":"var(--grey)",border:"none",padding:"12px 32px",fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"3px",cursor:input.trim()&&!loading&&apiKey.trim()?"pointer":"not-allowed",transition:"background .2s"}}>
                  {loading ? "PROCESSING…" : "COUNTER ARGUE →"}
                </button>
              </div>
            </div>
            <div style={{flex:"0 1 240px"}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"3px",color:"var(--grey)",marginBottom:10}}>Try These</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {EXAMPLES.map((ex,i) => (
                  <button key={i} className="example-btn" onClick={() => setInput(ex.text)}
                    style={{background:"white",border:"1px solid var(--border)",color:"var(--ink)",padding:"8px 12px",textAlign:"left",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10,transition:"all .18s",lineHeight:1.4,display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{background:"var(--red)",color:"white",fontSize:8,padding:"2px 5px",letterSpacing:"1px",flexShrink:0}}>{ex.label.toUpperCase()}</span>
                    <span>{ex.text.length>36?ex.text.slice(0,36)+"…":ex.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div style={{margin:"24px 0",background:"white",border:"2px solid var(--red)",padding:"16px 20px",animation:"fadeIn .3s ease both"}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--red)",letterSpacing:"2px",marginBottom:6}}>✕ ERROR</div>
            <div style={{fontSize:13,color:"var(--mid)",fontFamily:"'DM Mono',monospace"}}>{error}</div>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={handleSubmit} style={{background:"white",border:"1px solid var(--red)",color:"var(--red)",padding:"6px 16px",fontSize:10,fontFamily:"'DM Mono',monospace",cursor:"pointer"}}>↺ RETRY</button>
              <button onClick={() => setError(null)} style={{background:"transparent",border:"1px solid var(--border)",color:"var(--grey)",padding:"6px 16px",fontSize:10,fontFamily:"'DM Mono',monospace",cursor:"pointer"}}>DISMISS</button>
            </div>
          </div>
        )}

        {loading && <LoadingView />}

        {/* Results */}
        {result && !loading && (
          <div ref={resultsRef} style={{paddingTop:40}}>
            <div className="arg-block" style={{marginBottom:40}}>
              {result.field && (
                <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:20}}>
                  <div style={{background:"var(--ink)",color:"white",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"3px",padding:"5px 14px"}}>DOMAIN</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:"var(--red)",letterSpacing:"1px",fontWeight:500}}>{result.field}</div>
                </div>
              )}
              <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:"0 20px",alignItems:"start"}}>
                <div style={{background:"white",border:"2px solid var(--border)",padding:"20px"}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"3px",color:"var(--grey)",marginBottom:10}}>YOUR ARGUMENT</div>
                  <p style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:16,lineHeight:1.5,color:"var(--mid)",position:"relative"}}>
                    "{result.thesis}"
                    <span style={{position:"absolute",top:"50%",left:0,right:0,height:"2px",background:"var(--red)",transform:"translateY(-50%)",animation:"strikeThrough 1s 0.6s ease both",transformOrigin:"left"}}/>
                  </p>
                </div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",width:48,height:48,background:"var(--red)",color:"white",marginTop:20,fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:900,flexShrink:0}}>VS</div>
                <div style={{background:"var(--ink)",border:"2px solid var(--ink)",padding:"20px"}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"3px",color:"var(--red)",marginBottom:10}}>COUNTER-THESIS</div>
                  <p style={{fontFamily:"'Playfair Display',serif",fontWeight:700,fontStyle:"italic",fontSize:16,lineHeight:1.5,color:"var(--paper)"}}>{result.counter}</p>
                </div>
              </div>
            </div>

            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:36}}>
              <div style={{flex:1,height:1,background:"var(--ink)"}}/>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"3px",color:"var(--ink)"}}>THE CASE AGAINST</div>
              <div style={{flex:1,height:1,background:"var(--ink)"}}/>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1px 1fr",gap:"0 32px",marginBottom:40}}>
              <div>
                <ArgCard num={1} title={result.arg1?.title} body={result.arg1?.body}/>
                <ArgCard num={3} title={result.arg3?.title} body={result.arg3?.body}/>
                <ArgCard num={5} title={result.arg5?.title} body={result.arg5?.body}/>
              </div>
              <div style={{background:"var(--border)"}}/>
              <div style={{paddingTop:40}}>
                <ArgCard num={2} title={result.arg2?.title} body={result.arg2?.body}/>
                <ArgCard num={4} title={result.arg4?.title} body={result.arg4?.body}/>
              </div>
            </div>

            {result.evidence.length > 0 && (
              <div className="arg-block" style={{background:"var(--ink)",padding:"28px 32px",marginBottom:28}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"4px",color:"var(--red)",marginBottom:18}}>◈ EVIDENCE & DATA</div>
                <div style={{columns:"2 240px",gap:24}}>
                  {result.evidence.map((e,i) => (
                    <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:14,breakInside:"avoid"}}>
                      <span style={{color:"var(--red)",flexShrink:0,marginTop:2}}>◆</span>
                      <p style={{color:"#ccc",fontSize:13,fontFamily:"'Libre Baskerville',serif",lineHeight:1.7,margin:0}}>{e}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:28}}>
              {result.logic && (
                <div className="arg-block" style={{border:"1px solid var(--border)",padding:"20px 22px"}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"3px",color:"var(--red)",marginBottom:12}}>LOGICAL STRUCTURE</div>
                  <p style={{fontSize:13,lineHeight:1.75,color:"var(--mid)",fontFamily:"'Libre Baskerville',serif"}}>{result.logic}</p>
                </div>
              )}
              {result.weakest && (
                <div className="arg-block" style={{border:"2px dashed var(--red)",padding:"20px 22px",background:"rgba(192,57,43,0.04)"}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"3px",color:"var(--red)",marginBottom:12}}>⚠ WEAKEST LINK IN YOUR ARGUMENT</div>
                  <p style={{fontSize:13,lineHeight:1.75,color:"var(--mid)",fontFamily:"'Libre Baskerville',serif"}}>{result.weakest}</p>
                </div>
              )}
            </div>

            {result.verdict && (
              <div className="arg-block" style={{borderTop:"4px solid var(--ink)",borderBottom:"4px solid var(--ink)",padding:"32px 0",marginBottom:28,position:"relative"}}>
                <div style={{position:"absolute",top:-1,left:"50%",transform:"translateX(-50%) translateY(-50%)",background:"var(--red)",color:"white",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"4px",padding:"4px 20px"}}>VERDICT</div>
                <p style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(15px,2.5vw,18px)",lineHeight:1.8,color:"var(--ink)",textAlign:"center",maxWidth:680,margin:"0 auto"}}>{result.verdict}</p>
              </div>
            )}

            <div style={{display:"flex",gap:10,marginBottom:24}}>
              <button onClick={() => setShowRaw(p=>!p)} style={{background:"transparent",border:"1px solid var(--border)",color:"var(--grey)",fontSize:10,padding:"5px 14px",fontFamily:"'DM Mono',monospace",cursor:"pointer"}}>
                {showRaw ? "▲ HIDE RAW" : "▼ RAW OUTPUT"}
              </button>
              <button onClick={handleReset} style={{background:"var(--ink)",border:"none",color:"var(--paper)",fontSize:10,padding:"5px 20px",fontFamily:"'DM Mono',monospace",cursor:"pointer",letterSpacing:"2px"}}>
                ↺ NEW ARGUMENT
              </button>
            </div>
            {showRaw && <pre style={{background:"white",border:"1px solid var(--border)",padding:16,fontSize:11,lineHeight:1.7,color:"var(--grey)",fontFamily:"'DM Mono',monospace",whiteSpace:"pre-wrap",maxHeight:320,overflowY:"auto",marginBottom:16}}>{result.raw}</pre>}
          </div>
        )}
      </div>

      <footer style={{borderTop:"2px solid var(--ink)",padding:"20px",textAlign:"center",background:"var(--ink)"}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"3px",color:"var(--grey)"}}>CONTRA · COUNTER-ARGUMENT ENGINE · POWERED BY GEMINI 2.0 FLASH · FREE</div>
      </footer>
    </div>
  );
}
