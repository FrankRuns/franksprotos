"""
Sales-visit optimizer  —  final model (rise-then-fall revenue).

Only customer locations are fixed. Solves for: rep count, rep home-base (continuous
x,y), per-store visit cadence, assignment, and day-of-week — maximizing monthly PROFIT.

KEY MODELING CHOICE
-------------------
Revenue per store RISES THEN FALLS with visit frequency:

    R_i(v) = peak_i * (1 - exp(-k_i * v))  -  c_i * max(0, v - ideal_i)**2

The first term saturates (diminishing returns); the second penalizes OVER-service
past the store's ideal cadence. Consequence: the marginal value of a visit can go
NEGATIVE — visiting a monthly account weekly annoys the buyer and destroys value.
This is what makes cadence a real optimization: each store has a profit-maximizing
*interior* cadence, and the marginal rule (visit until the next visit's marginal
revenue < its drive cost, which for low-touch stores happens at v=1) lands on it
automatically. No capacity cap needed — the economics ration visits.

Without the fall-off term, "more is never wrong, only wasteful," a naive
visit-everyone-weekly plan ties or beats the optimizer, and you must bolt on an
artificial capacity constraint to manufacture scarcity. With it, the optimizer beats
naive decisively (here: +$5,089/mo on 10 stores, same single rep).

Structure: OUTER loop over rep_count; for each, multistart Nelder-Mead on depot
coordinates with a deterministic inner solve (assign -> cadence). Then DOW layer.
"""
import numpy as np
from scipy.optimize import minimize
import math, json

# name, lat, lon, peak_revenue, k(rise speed), ideal_visits, overservice_penalty
STOPS = [
 ("Hartford City Hall",41.7648,-72.6737, 650,1.6,1,120),
 ("XL Center",         41.7676,-72.6790, 380,1.6,1, 90),
 ("CT Science Center", 41.7662,-72.6694, 300,1.8,1, 90),
 ("Union Station",     41.7683,-72.6829, 600,1.1,2, 70),
 ("Mark Twain House",  41.7671,-72.7015, 340,1.6,1, 80),
 ("Blue Back Square",  41.7622,-72.7423, 820,0.7,4, 30),   # high-touch: ideal weekly
 ("Trinity College",   41.7476,-72.6906, 400,1.5,1, 90),
 ("Rentschler Field",  41.7580,-72.6108, 620,1.0,2, 60),
 ("UConn Storrs",      41.8077,-72.2540, 950,0.6,4, 25),   # high-touch
 ("Litchfield Green",  41.7476,-73.1890, 260,1.9,1, 80),
]
N   = len(STOPS)
LAT = np.array([s[1] for s in STOPS]); LON = np.array([s[2] for s in STOPS])
PK  = np.array([s[3] for s in STOPS], float)
KK  = np.array([s[4] for s in STOPS], float)
IDEAL = np.array([s[5] for s in STOPS])
CC  = np.array([s[6] for s in STOPS], float)
REP_COST = 2000.0; MILE = 1.0; MAX_CAD = 4

def revenue(v,i):
    if v <= 0: return 0.0
    return PK[i]*(1-math.exp(-KK[i]*v)) - CC[i]*max(0, v-IDEAL[i])**2
def marg(v,i): return revenue(v,i) - revenue(v-1,i)
def hav(a,b):
    R=3958.8; la1,lo1,la2,lo2=map(math.radians,[a[0],a[1],b[0],b[1]])
    h=math.sin((la2-la1)/2)**2+math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2
    return 2*R*math.asin(math.sqrt(h))

def evaluate(depots):
    """Deterministic inner solve: assign to nearest depot, then marginal-rule cadence."""
    depots=np.array(depots).reshape(-1,2); R=len(depots)
    assign=[min(range(R), key=lambda j:hav(depots[j],(LAT[i],LON[i]))) for i in range(N)]
    cadence=[0]*N
    for i in range(N):
        drive = MILE*2*hav(depots[assign[i]],(LAT[i],LON[i]))
        v=0
        while v<MAX_CAD and marg(v+1,i) > drive:  # stop when next visit < drive cost (or negative)
            v+=1
        cadence[i]=v
    rev=sum(revenue(cadence[i],i) for i in range(N))
    mi =sum(cadence[i]*2*hav(depots[assign[i]],(LAT[i],LON[i])) for i in range(N))
    return rev, mi, sum(cadence), assign, cadence

def profit(rev,mi,nreps): return rev - MILE*mi - nreps*REP_COST
def _neg(flat,nreps):
    rev,mi,_,_,_=evaluate(flat); return -profit(rev,mi,nreps)

def solve(nreps, restarts=30, seed=11):
    rng=np.random.default_rng(seed); best=None
    for t in range(restarts):
        if t==0:
            idx=np.linspace(0,N-1,nreps).astype(int); x0=np.column_stack([LAT[idx],LON[idx]]).flatten()
        else:
            idx=rng.choice(N,nreps,replace=False); x0=np.column_stack([LAT[idx],LON[idx]]).flatten()+rng.normal(0,0.04,nreps*2)
        r=minimize(_neg,x0,args=(nreps,),method='Nelder-Mead',options={'maxiter':10000,'xatol':1e-5,'fatol':1e-3})
        if best is None or r.fun<best.fun: best=r
    rev,mi,vis,assign,cad=evaluate(best.x)
    return dict(nreps=nreps, profit=round(profit(rev,mi,nreps)), rev=round(rev),
                miles=round(mi,1), rep_cost=int(nreps*REP_COST), visits=int(vis),
                depots=best.x.reshape(-1,2).tolist(), assign=assign, cadence=cad)

# ---- Schedule layer: PAIR nearby stops onto shared days (consolidate for the rep) ----
# Objective here is NOT to spread load or minimize miles -- it is to let the rep do two
# nearby accounts in one trip, freeing whole days for new-account generation. Reps value
# a consolidated day + a free day over two half-used days. We pair two stops on a day ONLY
# when they are within CLOSE_MI of each other; isolated outliers stay solo (pairing a
# 48-mile-apart pair would cost a long drive to save one calendar slot -- not worth it).
DOW=["Mon","Tue","Wed","Thu","Fri"]
CLOSE_MI=12
def weeks_for(c): return {4:[1,2,3,4],3:[1,2,4],2:[1,3],1:[1],0:[]}[c]

def pair_week(stores, depots_assign, depots):
    """Greedily match stores <= CLOSE_MI apart into 2-stop days; rest are solo."""
    remaining=set(stores); cand=[]
    sl=list(remaining)
    for a in range(len(sl)):
        for b in range(a+1,len(sl)):
            dmi=hav((LAT[sl[a]],LON[sl[a]]),(LAT[sl[b]],LON[sl[b]]))
            if dmi<=CLOSE_MI: cand.append((dmi,sl[a],sl[b]))
    cand.sort(); groups=[]
    for dmi,a,b in cand:
        if a in remaining and b in remaining:
            groups.append((a,b)); remaining.discard(a); remaining.discard(b)
    groups += [(i,) for i in remaining]
    return groups

def optimize_schedule(served, cadence, assign=None, depots=None):
    """Return {(week,dow): [stores]} pairing nearby stops; report active days & pairs."""
    from collections import defaultdict
    byweek=defaultdict(list)
    for i in served:
        for w in weeks_for(cadence[i]): byweek[w].append(i)
    schedule={}
    for w in (1,2,3,4):
        groups=pair_week(byweek[w], assign, depots)
        for gi,g in enumerate(groups):
            schedule[(w, DOW[gi % 5])]=list(g)
    active_days=sum(1 for v in schedule.values() if v)
    paired=sum(1 for v in schedule.values() if len(v)==2)
    return schedule, active_days, paired

def naive_everyone_weekly():
    """Baseline: one rep, everyone 4x/mo, depot at centroid. Over-serves -> value destroyed."""
    coord=[(LAT[i],LON[i]) for i in range(N)]
    dep=(LAT.mean(), LON.mean())
    rev=sum(revenue(4,i) for i in range(N))
    mi =sum(4*2*hav(dep,coord[i]) for i in range(N))
    return dict(profit=round(profit(rev,mi,1)), rev=round(rev), miles=round(mi,1), visits=40)

if __name__=="__main__":
    names=[s[0] for s in STOPS]
    out={}
    for n in (1,2,3):
        s=solve(n); out[n]=s
        print(f"reps={n}  profit=${s['profit']:,}  rev=${s['rev']:,}  miles={s['miles']:.0f}  "
              f"visits={s['visits']}  cadence={s['cadence']}")
    nv=naive_everyone_weekly()
    print(f"\nNaive (everyone weekly): profit=${nv['profit']:,}  rev=${nv['rev']:,}  (over-service destroys value)")
    print(f"Optimized 1-rep:         profit=${out[1]['profit']:,}")
    print(f"Optimizer wins by:       ${out[1]['profit']-nv['profit']:,}")
    # DOW for the 1-rep plan
    served=[i for i in range(N) if out[1]['cadence'][i]>0]
    dow, peak = optimize_dow(served, out[1]['cadence'])
    print(f"\n1-rep day-of-week (peak {peak}/day):")
    for i in served: print(f"  {names[i]:18s} {out[1]['cadence'][i]}x -> {dow[i]}")
    json.dump(out, open("opt_results.json","w"), indent=2)
