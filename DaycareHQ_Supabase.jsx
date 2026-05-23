import { useState, useEffect, useCallback } from "react";

const SUPABASE_URL = "https://zpslbyvmwcvwwixvbycf.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc2xieXZtd2N2d3dpeHZieWNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MzUzNzMsImV4cCI6MjA5NDIxMTM3M30.W6egjKYPnbqur5t9iP5J_KoA51CXGkn2QUdTgpUVMUc";

// ── Supabase helpers ──────────────────────────────────────────────────────────
const sb = {
  async req(method, path, body, token) {
    const headers = { "Content-Type": "application/json", "apikey": SUPABASE_ANON, "Prefer": "return=representation" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Request failed"); }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  },
  async auth(action, email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/${action}`, {
      method: "POST", headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || "Auth failed");
    return data;
  },
  get: (path, token) => sb.req("GET", path, null, token),
  post: (path, body, token) => sb.req("POST", path, body, token),
  patch: (path, body, token) => sb.req("PATCH", path, body, token),
  delete: (path, token) => sb.req("DELETE", path, null, token),
};

// ── Constants ─────────────────────────────────────────────────────────────────
const ZONES = ["Play Area A", "Play Area B", "Calm Room", "Grooming Suite", "Reception", "Break Room"];
const SHIFTS = ["Morning", "Afternoon", "Full Day", "Day Off"];
const ROLE_COLORS = { owner: "#f97316", manager: "#8b5cf6", staff: "#06b6d4" };
const TAG_COLORS = {
  "Puller":"#f97316","High Energy":"#ef4444","Friendly":"#22c55e","Sensitive":"#8b5cf6",
  "Calm":"#06b6d4","Cuddly":"#ec4899","Well-Trained":"#14b8a6","Protective":"#f59e0b",
  "Active":"#84cc16","Back Issues":"#ef4444","No Jumping":"#ef4444","Small Dog":"#6366f1",
};

// ── Tiny UI atoms ─────────────────────────────────────────────────────────────
const Chip = ({ label, color = "#94a3b8" }) => (
  <span style={{ background: color+"22", color, border:`1px solid ${color}44`, borderRadius:20, padding:"2px 9px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>{label}</span>
);

const Btn = ({ onClick, children, variant="primary", small, disabled, style={} }) => {
  const base = { border:"none", borderRadius:10, cursor: disabled?"not-allowed":"pointer", fontWeight:800, fontSize: small?12:14, padding: small?"6px 12px":"10px 18px", opacity: disabled?0.5:1, transition:"opacity .15s", ...style };
  const v = { primary:{background:"#f97316",color:"#fff"}, ghost:{background:"#2a3040",color:"#94a3b8"}, danger:{background:"#ef444422",color:"#f87171",border:"1px solid #ef444440"} };
  return <button onClick={onClick} disabled={disabled} style={{...base,...v[variant]}}>{children}</button>;
};

const Input = ({ value, onChange, placeholder, type="text", style={} }) => (
  <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{ width:"100%", background:"#1a1f2e", border:"1px solid #2a3040", color:"#e2e8f0", borderRadius:8, padding:"8px 12px", fontSize:13, outline:"none", boxSizing:"border-box", ...style }} />
);

const Label = ({ children }) => <div style={{ color:"#64748b", fontSize:11, fontWeight:700, marginBottom:4 }}>{children}</div>;

const Card = ({ children, style={}, onClick, warn }) => (
  <div onClick={onClick} style={{ background:"#1a1f2e", border:`1px solid ${warn?"#ef444455":"#2a3040"}`, borderRadius:13, padding:"13px 15px", marginBottom:8, cursor:onClick?"pointer":"default", ...style }}
    onMouseEnter={onClick?e=>e.currentTarget.style.borderColor=warn?"#ef4444":"#f97316":undefined}
    onMouseLeave={onClick?e=>e.currentTarget.style.borderColor=warn?"#ef444455":"#2a3040":undefined}
  >{children}</div>
);

const Modal = ({ children, onClose, title }) => (
  <div style={{ position:"fixed", inset:0, background:"#000000cc", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{ background:"#141824", border:"1px solid #2a3040", borderRadius:18, padding:24, maxWidth:480, width:"100%", maxHeight:"90vh", overflowY:"auto" }}>
      {title && <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
        <div style={{ color:"#f1f5f9", fontWeight:900, fontSize:17 }}>{title}</div>
        <button onClick={onClose} style={{ background:"#2a3040", border:"none", color:"#94a3b8", width:30, height:30, borderRadius:"50%", cursor:"pointer", fontSize:14 }}>✕</button>
      </div>}
      {children}
    </div>
  </div>
);

const Spinner = () => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
    <div style={{ width:32, height:32, border:"3px solid #2a3040", borderTopColor:"#f97316", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setErr(""); setLoading(true);
    try {
      const data = await sb.auth("token?grant_type=password", email, pass);
      const token = data.access_token;
      const uid = data.user.id;
      const profiles = await sb.get(`profiles?id=eq.${uid}&select=*`, token);
      if (!profiles.length) throw new Error("No profile found. Contact your admin.");
      onLogin({ token, user: { ...data.user, ...profiles[0] } });
    } catch(e) { setErr(e.message); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0d1117", display:"flex", alignItems:"center", justifyContent:"center", padding:20, fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;900&display=swap'); *{box-sizing:border-box}`}</style>
      <div style={{ maxWidth:380, width:"100%" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:52, marginBottom:8 }}>🐕</div>
          <div style={{ color:"#f1f5f9", fontWeight:900, fontSize:26, letterSpacing:"-0.5px" }}>Daycare HQ</div>
          <div style={{ color:"#64748b", fontSize:13, marginTop:4 }}>Staff Portal — Sign in to continue</div>
        </div>
        <div style={{ background:"#141824", border:"1px solid #2a3040", borderRadius:18, padding:28 }}>
          <div style={{ marginBottom:14 }}>
            <Label>Email</Label>
            <Input value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
          </div>
          <div style={{ marginBottom:20 }}>
            <Label>Password</Label>
            <Input value={pass} onChange={setPass} placeholder="••••••••" type="password" />
          </div>
          {err && <div style={{ background:"#ef444420", border:"1px solid #ef444440", borderRadius:8, padding:"8px 12px", color:"#f87171", fontSize:13, marginBottom:14 }}>⚠ {err}</div>}
          <Btn onClick={login} disabled={loading} style={{ width:"100%" }}>{loading ? "Signing in…" : "Sign In"}</Btn>
        </div>
        <div style={{ textAlign:"center", color:"#475569", fontSize:12, marginTop:16 }}>Contact your manager to get your login credentials.</div>
      </div>
    </div>
  );
}

// ── SOPs Tab ──────────────────────────────────────────────────────────────────
function SopsTab({ token, role }) {
  const [sops, setSops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const canEdit = role === "owner" || role === "manager";

  const load = useCallback(async () => {
    setLoading(true);
    try { setSops(await sb.get("sops?order=sort_order", token)); } catch(e) {}
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const saveSop = async (sop) => {
    try {
      if (sop.id && !sop.isNew) {
        await sb.patch(`sops?id=eq.${sop.id}`, { category:sop.category, time_slot:sop.time_slot, assigned_role:sop.assigned_role, steps:sop.steps }, token);
      } else {
        await sb.post("sops", { category:sop.category, time_slot:sop.time_slot, assigned_role:sop.assigned_role, steps:sop.steps, sort_order: sops.length + 1 }, token);
      }
      await load();
    } catch(e) { alert("Error saving: " + e.message); }
    setEditing(null); setAdding(false);
  };

  const deleteSop = async (id) => {
    if (!confirm("Delete this SOP?")) return;
    await sb.delete(`sops?id=eq.${id}`, token);
    await load();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      {canEdit && <div style={{ marginBottom:16 }}><Btn onClick={() => setAdding(true)} small>+ Add SOP Section</Btn></div>}
      {sops.map(s => (
        <div key={s.id} style={{ background:"#1a1f2e", border:"1px solid #2a3040", borderRadius:12, marginBottom:8, overflow:"hidden" }}>
          <button onClick={() => setOpen(open===s.id?null:s.id)} style={{ width:"100%", background:"none", border:"none", cursor:"pointer", padding:"13px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", textAlign:"left" }}>
              <span style={{ background:"#f97316", color:"#fff", borderRadius:7, padding:"3px 9px", fontSize:11, fontWeight:800, whiteSpace:"nowrap" }}>{s.time_slot}</span>
              <span style={{ color:"#f1f5f9", fontWeight:700, fontSize:14 }}>{s.category}</span>
            </div>
            <span style={{ color:"#f97316", fontSize:16, flexShrink:0 }}>{open===s.id?"▲":"▼"}</span>
          </button>
          {open===s.id && (
            <div style={{ padding:"0 16px 14px" }}>
              <div style={{ borderTop:"1px solid #2a3040", paddingTop:10, marginBottom:10, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ background:"#2a3040", color:"#94a3b8", borderRadius:6, padding:"2px 8px", fontSize:11 }}>👤 {s.assigned_role}</span>
                {canEdit && (
                  <div style={{ display:"flex", gap:6 }}>
                    <Btn onClick={() => setEditing(s)} variant="ghost" small>✏ Edit</Btn>
                    <Btn onClick={() => deleteSop(s.id)} variant="danger" small>🗑</Btn>
                  </div>
                )}
              </div>
              {(s.steps||[]).map((step, i) => (
                <div key={i} style={{ display:"flex", gap:10, marginBottom:7, alignItems:"flex-start" }}>
                  <span style={{ background:"#f97316", color:"#fff", borderRadius:"50%", width:20, height:20, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:900, flexShrink:0, marginTop:2 }}>{i+1}</span>
                  <span style={{ color:"#94a3b8", fontSize:13, lineHeight:1.6 }}>{step}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {(editing || adding) && (
        <SopEditor
          sop={editing || { category:"", time_slot:"", assigned_role:"", steps:[""], isNew:true }}
          onSave={saveSop}
          onClose={() => { setEditing(null); setAdding(false); }}
        />
      )}
    </div>
  );
}

function SopEditor({ sop, onSave, onClose }) {
  const [form, setForm] = useState({ ...sop, steps: sop.steps?.length ? [...sop.steps] : [""] });
  const setF = (k,v) => setForm(f=>({...f,[k]:v}));
  const setStep = (i,v) => setForm(f=>({ ...f, steps: f.steps.map((s,j)=>j===i?v:s) }));
  const addStep = () => setForm(f=>({ ...f, steps:[...f.steps,""] }));
  const removeStep = (i) => setForm(f=>({ ...f, steps:f.steps.filter((_,j)=>j!==i) }));

  return (
    <Modal onClose={onClose} title={form.isNew ? "➕ New SOP Section" : "✏ Edit SOP"}>
      <div style={{ marginBottom:12 }}>
        <Label>Section Title</Label>
        <Input value={form.category} onChange={v=>setF("category",v)} placeholder="e.g. Morning Opening" />
      </div>
      <div style={{ marginBottom:12 }}>
        <Label>Time Slot</Label>
        <Input value={form.time_slot} onChange={v=>setF("time_slot",v)} placeholder="e.g. 7:00–8:00 AM" />
      </div>
      <div style={{ marginBottom:16 }}>
        <Label>Assigned Role</Label>
        <Input value={form.assigned_role} onChange={v=>setF("assigned_role",v)} placeholder="e.g. Senior Handler" />
      </div>
      <div style={{ marginBottom:8 }}>
        <Label>Steps</Label>
        {form.steps.map((step,i) => (
          <div key={i} style={{ display:"flex", gap:8, marginBottom:8, alignItems:"center" }}>
            <span style={{ background:"#f97316", color:"#fff", borderRadius:"50%", width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900, flexShrink:0 }}>{i+1}</span>
            <input value={step} onChange={e=>setStep(i,e.target.value)} style={{ flex:1, background:"#12161f", border:"1px solid #2a3040", color:"#e2e8f0", borderRadius:8, padding:"7px 10px", fontSize:13, outline:"none" }} />
            <button onClick={()=>removeStep(i)} style={{ background:"none", border:"none", color:"#ef4444", cursor:"pointer", fontSize:18, padding:"0 4px" }}>×</button>
          </div>
        ))}
        <button onClick={addStep} style={{ background:"none", border:"1px dashed #2a3040", color:"#64748b", borderRadius:8, padding:"6px 14px", fontSize:12, cursor:"pointer", marginTop:4 }}>+ Add Step</button>
      </div>
      <div style={{ display:"flex", gap:10, marginTop:20 }}>
        <Btn onClick={()=>onSave(form)} style={{ flex:1 }}>Save</Btn>
        <Btn onClick={onClose} variant="ghost" style={{ flex:1 }}>Cancel</Btn>
      </div>
    </Modal>
  );
}

// ── Assignments Tab ───────────────────────────────────────────────────────────
function AssignmentsTab({ token }) {
  const [staff, setStaff] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    (async () => {
      try {
        const [p, a] = await Promise.all([
          sb.get("profiles?order=full_name", token),
          sb.get(`assignments?assigned_date=eq.${today}`, token)
        ]);
        setStaff(p); setAssignments(a);
      } catch(e) {}
      setLoading(false);
    })();
  }, [token, today]);

  const update = async (staffId, field, value) => {
    const existing = assignments.find(a => a.staff_id === staffId);
    const updated = existing ? { ...existing, [field]:value } : { staff_id:staffId, assigned_date:today, [field]:value };
    setAssignments(prev => existing ? prev.map(a => a.staff_id===staffId?updated:a) : [...prev, updated]);
    try {
      await sb.post("assignments", updated, token);
    } catch {
      try { await sb.patch(`assignments?staff_id=eq.${staffId}&assigned_date=eq.${today}`, { [field]:value }, token); } catch(e) {}
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <p style={{ color:"#64748b", fontSize:13, marginBottom:16 }}>Today's zone and shift assignments. Changes save instantly.</p>
      {staff.map(s => {
        const a = assignments.find(x => x.staff_id === s.id) || {};
        const color = ROLE_COLORS[s.role] || "#94a3b8";
        return (
          <div key={s.id} style={{ background:"#1a1f2e", border:"1px solid #2a3040", borderRadius:12, padding:"11px 14px", marginBottom:8, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <div style={{ width:38, height:38, borderRadius:"50%", background:color+"22", border:`2px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", color, fontWeight:900, fontSize:13, flexShrink:0 }}>
              {s.full_name.split(" ").map(n=>n[0]).join("").slice(0,2)}
            </div>
            <div style={{ flex:1, minWidth:100 }}>
              <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:13 }}>{s.full_name}</div>
              <div style={{ color:"#64748b", fontSize:11, textTransform:"capitalize" }}>{s.role}</div>
            </div>
            <select value={a.zone||""} onChange={e=>update(s.id,"zone",e.target.value)} style={{ background:"#12161f", border:"1px solid #2a3040", color:"#e2e8f0", borderRadius:8, padding:"5px 8px", fontSize:12, cursor:"pointer" }}>
              <option value="">— Zone —</option>
              {ZONES.map(z=><option key={z} value={z}>{z}</option>)}
            </select>
            <select value={a.shift||""} onChange={e=>update(s.id,"shift",e.target.value)} style={{ background:"#12161f", border:"1px solid #2a3040", color:"#e2e8f0", borderRadius:8, padding:"5px 8px", fontSize:12, cursor:"pointer" }}>
              <option value="">— Shift —</option>
              {SHIFTS.map(sh=><option key={sh} value={sh}>{sh}</option>)}
            </select>
            {a.zone && a.shift && <span style={{ background:"#22c55e", color:"#fff", borderRadius:6, padding:"3px 8px", fontSize:11, fontWeight:800 }}>✓</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Pups Tab ──────────────────────────────────────────────────────────────────
function PupsTab({ token }) {
  const [pups, setPups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setPups(await sb.get("pups?order=name", token)); } catch(e) {}
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const savePup = async (pup) => {
    const payload = { name:pup.name, breed:pup.breed, owner_name:pup.owner_name, owner_phone:pup.owner_phone, harness:pup.harness, allergies:pup.allergies||"None", treats:pup.treats, vet_contact:pup.vet_contact, notes:pup.notes, tags:pup.tags||[], emoji:pup.emoji||"🐾" };
    try {
      if (pup.id) { await sb.patch(`pups?id=eq.${pup.id}`, payload, token); }
      else { await sb.post("pups", payload, token); }
      await load();
    } catch(e) { alert("Error: " + e.message); }
    setEditing(null); setAdding(false);
  };

  const deletePup = async (id) => {
    if (!confirm("Remove this pup from the database?")) return;
    await sb.delete(`pups?id=eq.${id}`, token);
    setSelected(null); await load();
  };

  const filtered = pups.filter(p =>
    [p.name, p.breed, p.owner_name].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner />;

  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        <Input value={search} onChange={setSearch} placeholder="Search pup, breed, or owner…" style={{ flex:1 }} />
        <Btn onClick={() => setAdding(true)} small>+ Add Pup</Btn>
      </div>
      {filtered.map(p => (
        <Card key={p.id} onClick={() => setSelected(p)} warn={p.allergies && p.allergies!=="None"}>
          <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
            <div style={{ fontSize:30, width:48, height:48, background:"#12161f", borderRadius:11, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{p.emoji||"🐾"}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                <span style={{ color:"#f1f5f9", fontWeight:800, fontSize:15 }}>{p.name}</span>
                <span style={{ color:"#64748b", fontSize:12 }}>{p.breed}</span>
              </div>
              <div style={{ color:"#94a3b8", fontSize:12, margin:"2px 0 6px" }}>{p.owner_name} · {p.owner_phone}</div>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {(p.tags||[]).map(t=><Chip key={t} label={t} color={TAG_COLORS[t]||"#94a3b8"} />)}
              </div>
              {p.allergies && p.allergies!=="None" && (
                <div style={{ marginTop:6, background:"#ef444420", border:"1px solid #ef444440", borderRadius:7, padding:"3px 9px", fontSize:11, color:"#f87171", display:"inline-block" }}>⚠ Allergy: {p.allergies}</div>
              )}
            </div>
          </div>
        </Card>
      ))}

      {selected && !editing && (
        <Modal onClose={() => setSelected(null)} title="">
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:18 }}>
            <div style={{ fontSize:42, width:62, height:62, background:"#1a1f2e", borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{selected.emoji||"🐾"}</div>
            <div style={{ flex:1 }}>
              <div style={{ color:"#f1f5f9", fontWeight:900, fontSize:20 }}>{selected.name}</div>
              <div style={{ color:"#64748b", fontSize:12, marginBottom:5 }}>{selected.breed}</div>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {(selected.tags||[]).map(t=><Chip key={t} label={t} color={TAG_COLORS[t]||"#94a3b8"} />)}
              </div>
            </div>
            <button onClick={()=>setSelected(null)} style={{ background:"#2a3040", border:"none", color:"#94a3b8", width:30, height:30, borderRadius:"50%", cursor:"pointer", fontSize:14 }}>✕</button>
          </div>
          {[["🦺 Harness",selected.harness,false],["🚫 Allergies",selected.allergies,selected.allergies!=="None"],["🍖 Approved Treats",selected.treats,false],["🏥 Vet Contact",selected.vet_contact,false],["👤 Owner",`${selected.owner_name} · ${selected.owner_phone}`,false],["📝 Special Notes",selected.notes,false]].map(([lbl,val,warn])=>val?(
            <div key={lbl} style={{ background:"#1a1f2e", border:`1px solid ${warn?"#ef444455":"#2a3040"}`, borderRadius:10, padding:"9px 13px", marginBottom:8 }}>
              <div style={{ color:"#64748b", fontSize:11, fontWeight:700, marginBottom:3 }}>{lbl}</div>
              <div style={{ color:warn?"#f87171":"#e2e8f0", fontSize:13, lineHeight:1.5 }}>{val}</div>
            </div>
          ):null)}
          <div style={{ display:"flex", gap:8, marginTop:16 }}>
            <Btn onClick={()=>{setEditing(selected);setSelected(null);}} style={{ flex:1 }}>✏ Edit Profile</Btn>
            <Btn onClick={()=>deletePup(selected.id)} variant="danger" style={{ flex:1 }}>🗑 Remove</Btn>
          </div>
        </Modal>
      )}

      {(editing || adding) && (
        <PupEditor
          pup={editing || { name:"", breed:"", owner_name:"", owner_phone:"", harness:"", allergies:"None", treats:"", vet_contact:"", notes:"", tags:[], emoji:"🐾" }}
          onSave={savePup}
          onClose={() => { setEditing(null); setAdding(false); }}
        />
      )}
    </div>
  );
}

function PupEditor({ pup, onSave, onClose }) {
  const [f, setF] = useState({ ...pup, tagsStr:(pup.tags||[]).join(", ") });
  const set = (k,v) => setF(x=>({...x,[k]:v}));
  const save = () => {
    if (!f.name.trim()) return;
    onSave({ ...f, tags: f.tagsStr ? f.tagsStr.split(",").map(t=>t.trim()).filter(Boolean) : [] });
  };
  const emojis = ["🐕","🐩","🦮","🐾","🌭","🦺","🐶"];
  const fields = [["name","Pup Name *"],["breed","Breed"],["owner_name","Owner Name"],["owner_phone","Owner Phone"],["harness","Harness (brand, colour, size)"],["allergies","Allergies (or 'None')"],["treats","Approved Treats"],["vet_contact","Vet Clinic & Number"],["tagsStr","Tags (comma-separated)"]];

  return (
    <Modal onClose={onClose} title={f.id ? "✏ Edit Pup Profile" : "🐾 Add New Pup"}>
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        {emojis.map(e=>(
          <button key={e} onClick={()=>set("emoji",e)} style={{ fontSize:24, width:42, height:42, borderRadius:10, border:`2px solid ${f.emoji===e?"#f97316":"#2a3040"}`, background:f.emoji===e?"#f9731622":"#1a1f2e", cursor:"pointer" }}>{e}</button>
        ))}
      </div>
      {fields.map(([k,lbl])=>(
        <div key={k} style={{ marginBottom:10 }}>
          <Label>{lbl}</Label>
          <Input value={f[k]||""} onChange={v=>set(k,v)} />
        </div>
      ))}
      <div style={{ marginBottom:16 }}>
        <Label>Special Notes</Label>
        <textarea value={f.notes||""} onChange={e=>set("notes",e.target.value)} rows={3} style={{ width:"100%", background:"#1a1f2e", border:"1px solid #2a3040", color:"#e2e8f0", borderRadius:8, padding:"8px 12px", fontSize:13, outline:"none", resize:"vertical", boxSizing:"border-box" }} />
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <Btn onClick={save} style={{ flex:1 }}>Save Pup</Btn>
        <Btn onClick={onClose} variant="ghost" style={{ flex:1 }}>Cancel</Btn>
      </div>
    </Modal>
  );
}

// ── Staff Management (Owner only) ─────────────────────────────────────────────
function StaffTab({ token }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newStaff, setNewStaff] = useState({ email:"", password:"", full_name:"", role:"staff" });
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setStaff(await sb.get("profiles?order=full_name", token)); } catch(e) {}
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const createStaff = async () => {
    setMsg("");
    try {
      const data = await sb.auth("admin/users", newStaff.email, newStaff.password);
      const uid = data.user?.id;
      if (uid) {
        await sb.post("profiles", { id:uid, full_name:newStaff.full_name, role:newStaff.role, color:"#06b6d4" }, token);
        await load();
        setAdding(false);
        setNewStaff({ email:"", password:"", full_name:"", role:"staff" });
        setMsg("✓ Staff member added!");
      }
    } catch(e) { setMsg("⚠ " + e.message + " — Note: Use Supabase Dashboard > Auth > Users to create accounts, then the profile will auto-link."); }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div style={{ background:"#1a1f2e", border:"1px solid #2a3040", borderRadius:12, padding:"12px 16px", marginBottom:16 }}>
        <div style={{ color:"#f97316", fontWeight:800, fontSize:13, marginBottom:4 }}>📌 How to add staff</div>
        <div style={{ color:"#94a3b8", fontSize:12, lineHeight:1.6 }}>
          1. Go to <strong style={{color:"#e2e8f0"}}>supabase.com → Your Project → Authentication → Users</strong><br/>
          2. Click <strong style={{color:"#e2e8f0"}}>"Invite user"</strong> and enter their email<br/>
          3. They get a link to set their password<br/>
          4. Come back here and assign their role below
        </div>
      </div>
      {msg && <div style={{ background:"#22c55e22", border:"1px solid #22c55e44", borderRadius:8, padding:"8px 12px", color:"#86efac", fontSize:13, marginBottom:12 }}>{msg}</div>}
      {staff.map(s => {
        const color = ROLE_COLORS[s.role] || "#94a3b8";
        return (
          <div key={s.id} style={{ background:"#1a1f2e", border:"1px solid #2a3040", borderRadius:12, padding:"11px 14px", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:"50%", background:color+"22", border:`2px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", color, fontWeight:900, fontSize:13, flexShrink:0 }}>
              {s.full_name.split(" ").map(n=>n[0]).join("").slice(0,2)}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:13 }}>{s.full_name}</div>
              <div style={{ color:"#64748b", fontSize:11 }}>{s.role}</div>
            </div>
            <select value={s.role} onChange={async e => {
              await sb.patch(`profiles?id=eq.${s.id}`, { role:e.target.value }, token);
              await load();
            }} style={{ background:"#12161f", border:"1px solid #2a3040", color:"#e2e8f0", borderRadius:8, padding:"5px 8px", fontSize:12, cursor:"pointer" }}>
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
              <option value="owner">Owner</option>
            </select>
          </div>
        );
      })}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("sop");

  if (!session) return <LoginScreen onLogin={setSession} />;

  const { user, token } = session;
  const role = user.role;
  const isAdmin = role === "owner" || role === "manager";
  const today = new Date().toLocaleDateString("en-SG", { weekday:"long", year:"numeric", month:"long", day:"numeric" });

  const tabs = [
    { id:"sop", label:"📋 SOPs" },
    { id:"assign", label:"📍 Assignments" },
    { id:"pups", label:"🐾 Pup Profiles" },
    ...(role === "owner" ? [{ id:"staff", label:"👥 Staff" }] : []),
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#0d1117", fontFamily:"'DM Sans','Segoe UI',sans-serif", color:"#e2e8f0" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;900&display=swap'); *{box-sizing:border-box} select option{background:#1a1f2e} ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-thumb{background:#2a3040;border-radius:3px}`}</style>

      {/* Header */}
      <div style={{ background:"#141824", borderBottom:"1px solid #2a3040", padding:"14px 18px" }}>
        <div style={{ maxWidth:680, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:24 }}>🐕</span>
            <div>
              <div style={{ fontWeight:900, fontSize:18, color:"#f1f5f9", letterSpacing:"-0.4px" }}>Daycare HQ</div>
              <div style={{ color:"#64748b", fontSize:11 }}>{today}</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ background:"#1a1f2e", borderRadius:8, padding:"5px 11px", display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:ROLE_COLORS[role]||"#94a3b8" }} />
              <span style={{ color:"#e2e8f0", fontSize:12, fontWeight:700 }}>{user.full_name}</span>
              <span style={{ color:"#64748b", fontSize:11, textTransform:"capitalize" }}>· {role}</span>
            </div>
            <button onClick={()=>setSession(null)} style={{ background:"#2a3040", border:"none", color:"#94a3b8", borderRadius:8, padding:"5px 10px", fontSize:12, cursor:"pointer" }}>Sign out</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background:"#141824", borderBottom:"1px solid #2a3040" }}>
        <div style={{ maxWidth:680, margin:"0 auto", display:"flex", overflowX:"auto" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ background:"none", border:"none", cursor:"pointer", padding:"12px 16px", fontWeight:700, fontSize:13, color:tab===t.id?"#f97316":"#64748b", borderBottom:tab===t.id?"2px solid #f97316":"2px solid transparent", transition:"color .15s", whiteSpace:"nowrap" }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth:680, margin:"0 auto", padding:"20px 14px 48px" }}>
        {tab==="sop" && <SopsTab token={token} role={role} />}
        {tab==="assign" && <AssignmentsTab token={token} />}
        {tab==="pups" && <PupsTab token={token} />}
        {tab==="staff" && role==="owner" && <StaffTab token={token} />}
      </div>
    </div>
  );
}
