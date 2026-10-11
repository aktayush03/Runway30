import { useState, useMemo, useEffect } from 'react'

const D = 30
const KEY = 'runway30.v1'
const R = n => (n < 0 ? '-' : '') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN')
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))

const fresh = () => ({
  day: 1, bal: 10000, habit: 180,
  flows: [
    { n: '📶 Phone recharge', amt: -299, day: 5, sub: 1 },
    { n: '🎧 Spotify', amt: -119, day: 8, sub: 1 },
    { n: '🏋️ Gym pass', amt: -500, day: 12, sub: 1 },
    { n: '💼 Freelance payout', amt: 800, day: 15 }
  ],
  goals: [
    { n: '🎧 Headphones', target: 2500, saved: 0 },
    { n: '🛟 Emergency fund', target: 1500, saved: 0 }
  ],
  log: [{ t: 'Day 1 · Wallet loaded', a: 10000 }]
})

const load = () => {
  try {
    const x = JSON.parse(localStorage.getItem(KEY))
    if (x && x.goals && x.flows) return x
  } catch (e) {}
  return fresh()
}

const PRESETS = [
  { n: '🎤 Concert ticket', amt: 2500, mode: 'once' },
  { n: '🛵 Swiggy habit', amt: 250, mode: 'daily' },
  { n: '☕ Café hangouts', amt: 400, mode: 'weekly' },
  { n: '👟 Sneakers', amt: 3500, mode: 'once' }
]

const CHAOS = [
  ['📱 Screen cracked', -1200], ['🎂 Friend’s birthday', -600], ['🛵 Puncture + fuel', -250],
  ['💸 Cashback landed', 300], ['🍕 Surprise team treat', -400], ['🎁 Cousin gave shagun', 500]
]

// one balance path from today to day 30 (rnd = noisy Monte Carlo run)
const run = (s, sim, rnd) => {
  let b = s.bal - (sim?.mode === 'once' ? sim.amt : 0)
  const a = [b]
  for (let d = s.day + 1; d <= D; d++) {
    let sp = s.habit + (sim?.mode === 'daily' ? sim.amt : 0)
    if (rnd) { sp *= 0.5 + Math.random(); if (Math.random() < 0.08) sp += 300 + Math.random() * 900 }
    b -= sp
    if (sim?.mode === 'weekly' && (d - s.day) % 7 === 0) b -= sim.amt
    s.flows.forEach(f => { if (f.day === d) b += f.amt })
    a.push(b)
  }
  return a
}

const stats = (s, sim) => {
  const p = run(s, sim), end = p.at(-1), min = Math.min(...p), left = D - s.day
  const N = 300, sims = []
  let ok = 0
  for (let i = 0; i < N; i++) {
    const q = run(s, sim, true)
    sims.push(q)
    if (Math.min(...q) >= 0) ok++
  }
  const lo = [], hi = []
  for (let i = 0; i < p.length; i++) {
    const col = sims.map(q => q[i]).sort((a, b) => a - b)
    lo.push(col[Math.floor(N * 0.1)]); hi.push(col[Math.floor(N * 0.9)])
  }
  const surv = ok / N
  const spend = s.habit + (sim?.mode === 'daily' ? sim.amt : 0)
  const goals = s.goals.reduce((x, g) => x + g.saved / g.target, 0) / s.goals.length
  const buffer = cl(end / 2500), cushion = cl(min / 1500)
  const score = Math.round(100 * (0.4 * surv + 0.25 * buffer + 0.2 * goals + 0.15 * cushion))
  const brokeIdx = p.findIndex(v => v < 0)
  return {
    p, lo, hi, end, min, surv, score, brokeDay: brokeIdx >= 0 ? s.day + brokeIdx : null,
    allow: left ? spend + end / left : 0, surplus: Math.max(0, end),
    parts: [['Survival', surv], ['Buffer', buffer], ['Goals', goals], ['Cushion', cushion]]
  }
}

export default function App() {
  const [s, setS] = useState(load)
  const [f, setF] = useState({ n: '', amt: 0, mode: 'once' })

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch (e) {} }, [s])

  const amt = Number(f.amt)
  const sim = amt > 0 ? { amt, mode: f.mode } : null
  const base = useMemo(() => stats(s, null), [s])
  const ghost = useMemo(() => (sim ? stats(s, sim) : null), [s, f.amt, f.mode])
  const cur = ghost || base
  const dl = ghost ? {
    end: ghost.end - base.end, surv: ghost.surv - base.surv,
    sc: ghost.score - base.score, al: ghost.allow - base.allow
  } : null
  const sgn = v => (v >= 0 ? '+' : '')

  const stamp = (t, a) => ({ t: `Day ${s.day} · ${t}`, a })

  const commit = () => {
    if (!sim) return
    const n = f.n || 'Planned spend'
    setS(x => {
      const y = { ...x, log: [stamp(`${n} (${f.mode})`, -sim.amt), ...x.log] }
      if (f.mode === 'once') y.bal = x.bal - sim.amt
      if (f.mode === 'daily') y.habit = x.habit + sim.amt
      if (f.mode === 'weekly') {
        y.flows = [...x.flows, ...[7, 14, 21, 28].map(k => x.day + k).filter(d => d <= D)
          .map(d => ({ n: '🔁 ' + n, amt: -sim.amt, day: d }))]
      }
      return y
    })
    setF({ n: '', amt: 0, mode: f.mode })
  }

  const next = () => setS(x => {
    if (x.day >= D) return x
    const d = x.day + 1, sp = x.habit * (0.6 + Math.random() * 0.8)
    let b = x.bal - sp
    const lg = [{ t: `Day ${d} · Daily life`, a: -sp }]
    x.flows.filter(q => q.day === d).forEach(q => { b += q.amt; lg.push({ t: `Day ${d} · ${q.n}`, a: q.amt }) })
    return { ...x, day: d, bal: b, log: [...lg.reverse(), ...x.log] }
  })

  const chaos = () => {
    const [n, a] = CHAOS[Math.floor(Math.random() * CHAOS.length)]
    setS(x => ({ ...x, bal: x.bal + a, log: [stamp(n, a), ...x.log] }))
  }

  const stash = i => setS(x => {
    const g = x.goals[i], a = Math.min(250, g.target - g.saved, Math.max(0, x.bal))
    if (a <= 0) return x
    return {
      ...x, bal: x.bal - a,
      goals: x.goals.map((q, j) => (j === i ? { ...q, saved: q.saved + a } : q)),
      log: [stamp('Stashed → ' + g.n, -a), ...x.log]
    }
  })

  const cancel = i => setS(x => ({
    ...x, flows: x.flows.filter((_, j) => j !== i),
    log: [stamp('Cancelled ' + x.flows[i].n, 0), ...x.log]
  }))

  const reset = () => { setS(fresh()); setF({ n: '', amt: 0, mode: 'once' }) }

  // chart geometry
  const W = 640, H = 200
  const all = [...base.p, ...base.lo, ...base.hi, ...(ghost ? [...ghost.p, ...ghost.lo, ...ghost.hi] : []), 0]
  const mx = Math.max(...all), mn = Math.min(...all)
  const X = i => ((i + s.day - 1) / (D - 1)) * W
  const Y = v => H - 12 - ((v - mn) / (mx - mn || 1)) * (H - 28)
  const line = a => a.map((v, i) => `${i ? 'L' : 'M'}${X(i)},${Y(v)}`).join('')
  const bandSrc = ghost || base
  const band = bandSrc.hi.map((v, i) => `${i ? 'L' : 'M'}${X(i)},${Y(v)}`).join('')
    + [...bandSrc.lo].map((v, i) => [v, i]).reverse().map(([v, i]) => `L${X(i)},${Y(v)}`).join('') + 'Z'

  const mood = cur.score > 75 ? ['Thriving', '#b6ff3b'] : cur.score > 50 ? ['Steady', '#ffd23b']
    : cur.score > 30 ? ['Shaky', '#ff9f3b'] : ['Danger', '#ff4d6d']
  const goalsLeft = Math.max(1, s.goals.reduce((x, g) => x + g.target - g.saved, 0))
  const subTotal = s.flows.filter(q => q.sub && q.day > s.day).reduce((x, q) => x + q.amt, 0)
  const grade = base.score > 75 ? 'S' : base.score > 60 ? 'A' : base.score > 40 ? 'B' : 'C'

  return (
    <main>
      <header>
        <div>
          <h1>runway<span>30</span></h1>
          <p>Rehearse your money before you live it.</p>
        </div>
        <div className="day">
          <div><small>DAY</small><strong>{s.day}/{D}</strong></div>
          <button className="go" onClick={next} disabled={s.day >= D}>Next day →</button>
          <button onClick={reset} aria-label="Restart the month">↺</button>
        </div>
      </header>

      <section className="hero">
        <div className="ring" style={{ '--c': mood[1], '--p': cur.score }} role="img" aria-label={`Financial health ${cur.score} out of 100, ${mood[0]}`}>
          <div><strong>{cur.score}</strong><small>{mood[0]}</small></div>
        </div>
        <div className="grid">
          <Stat l="Balance" v={R(s.bal)} />
          <Stat l="Safe daily spend" v={R(cur.allow)} d={dl && `${sgn(dl.al)}${R(dl.al)}`} bad={dl?.al < 0} />
          <Stat l="Day-30 forecast" v={R(cur.end)} d={dl && `${sgn(dl.end)}${R(dl.end)}`} bad={dl?.end < 0} />
          <Stat l="Survival odds" v={Math.round(cur.surv * 100) + '%'} d={dl && `${sgn(dl.surv)}${Math.round(dl.surv * 100)} pts`} bad={dl?.surv < 0} />
          <Stat l={cur.brokeDay ? 'Hits ₹0 on' : 'Lowest point'} v={cur.brokeDay ? `Day ${cur.brokeDay}` : R(cur.min)} bad={!!cur.brokeDay} />
          <Stat l="Subscriptions left" v={R(-subTotal)} />
        </div>
      </section>

      <section className="card">
        <h3>Your timeline <em>— grey line = real you · neon dashed = ghost you · purple haze = 80% of possible futures</em></h3>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Projected balance over the 30 days">
          <path d={band} fill="#8b5cff" opacity=".22" />
          <line x1="0" x2={W} y1={Y(0)} y2={Y(0)} stroke="#ff4d6d" strokeDasharray="4" opacity=".6" />
          <path d={line(base.p)} fill="none" stroke="#aab" strokeWidth="2.5" />
          {ghost && <path d={line(ghost.p)} fill="none" stroke="#b6ff3b" strokeWidth="3" strokeDasharray="7 4" />}
          <circle cx={X(0)} cy={Y(base.p[0])} r="5" fill="#fff" />
        </svg>
        <div className="parts">
          {cur.parts.map(([n, v]) => (
            <div key={n}><small>{n} {Math.round(v * 100)}%</small><i><u style={{ width: v * 100 + '%', background: mood[1] }} /></i></div>
          ))}
        </div>
      </section>

      <div className="two">
        <section className="card sim">
          <h3>🔮 What-if simulator</h3>
          <div className="chips">
            {PRESETS.map(p => <button key={p.n} onClick={() => setF({ n: p.n, amt: p.amt, mode: p.mode })}>{p.n}</button>)}
          </div>
          <input aria-label="What is it?" placeholder="What are you thinking of buying?" value={f.n} onChange={e => setF({ ...f, n: e.target.value })} />
          <div className="row">
            <input aria-label="Amount in rupees" type="number" min="0" value={f.amt} onChange={e => setF({ ...f, amt: e.target.value })} />
            {['once', 'weekly', 'daily'].map(m => (
              <button key={m} className={f.mode === m ? 'on' : ''} onClick={() => setF({ ...f, mode: m })}>{m}</button>
            ))}
          </div>
          <input aria-label="Amount slider" type="range" min="0" max="5000" step="50" value={f.amt} onChange={e => setF({ ...f, amt: e.target.value })} />
          {dl ? (
            <p className={'verdict ' + (ghost.brokeDay || dl.surv < -0.1 ? 'bad' : 'good')}>
              {ghost.brokeDay ? `⚠️ You’d hit ₹0 on day ${ghost.brokeDay}.`
                : dl.surv < -0.1 ? `Risky: survival odds drop ${Math.abs(Math.round(dl.surv * 100))} pts.`
                : `Affordable. You’d still end with ${R(ghost.end)}.`}
              {' '}Health {sgn(dl.sc)}{dl.sc}. Leftover covers {Math.round(cl(ghost.surplus / goalsLeft) * 100)}% of your remaining goals.
            </p>
          ) : <p className="verdict">Pick a preset or drag the slider. The ghost line will show your future before you spend.</p>}
          <button className="go" onClick={commit} disabled={!sim}>Commit this decision</button>
          <button className="ghostbtn" onClick={chaos}>🎲 Trigger life chaos</button>
        </section>

        <section className="card">
          <h3>🎯 Goals</h3>
          {s.goals.map((g, i) => (
            <div key={i} className="goal">
              <div><span>{g.n}</span><small>{R(g.saved)} / {R(g.target)}</small></div>
              <button onClick={() => stash(i)} disabled={g.saved >= g.target}>Stash ₹250</button>
              <i><u style={{ width: (g.saved / g.target) * 100 + '%' }} /></i>
            </div>
          ))}
          <h3>🔁 Coming up</h3>
          {s.flows.map((q, i) => ({ q, i })).filter(({ q }) => q.day > s.day).sort((a, b) => a.q.day - b.q.day).map(({ q, i }) => (
            <div key={i} className="fl">
              <span>D{q.day} {q.n}</span>
              <b className={q.amt > 0 ? 'up' : ''}>{R(q.amt)}</b>
              {q.sub && <button onClick={() => cancel(i)}>cancel</button>}
            </div>
          ))}
          <label className="habit">Usual daily spend: {R(s.habit)}
            <input type="range" min="50" max="1500" step="10" value={s.habit} onChange={e => setS({ ...s, habit: +e.target.value })} />
          </label>
        </section>
      </div>

      <section className="card">
        <h3>🧾 Ledger</h3>
        {s.log.slice(0, 8).map((l, i) => (
          <div key={i} className="fl"><span>{l.t}</span><b className={l.a > 0 ? 'up' : ''}>{R(l.a)}</b></div>
        ))}
        {s.day >= D && (
          <p className={'verdict ' + (s.bal >= 0 ? 'good' : 'bad')}>
            🏁 Month complete. Final balance {R(s.bal)} · health {base.score}/100 · grade <b>{grade}</b>. Hit ↺ to run it again.
          </p>
        )}
      </section>
    </main>
  )
}

const Stat = ({ l, v, d, bad }) => (
  <div className="stat">
    <small>{l}</small>
    <strong>{v}</strong>
    {d && <em className={bad ? 'dn' : 'up'}>{d}</em>}
  </div>
)