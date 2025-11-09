// helpers
const mean = a => a.reduce((s,x)=>s+x,0)/a.length;
const std = a => {
  const m = mean(a);
  return Math.sqrt(mean(a.map(x => (x-m)*(x-m))));
};
const quantile = (arr, q) => {
  const s = [...arr].sort((a,b)=>a-b);
  const pos = (s.length-1)*q;
  const base = Math.floor(pos), rest = pos-base;
  return s[base+1] !== undefined ? s[base]*(1-rest) + s[base+1]*rest : s[base];
};

// fetch prices from Yahoo CSV
async function fetchYahooCSV(ticker, years){
  const now = Math.floor(Date.now()/1000);
  const start = now - Math.floor(365.25*24*3600*years);
  const url = `https://query1.finance.yahoo.com/v7/finance/download/${encodeURIComponent(ticker)}?period1=${start}&period2=${now}&interval=1d&events=history&includeAdjustedClose=true`;
  const res = await fetch(url);
  if(!res.ok) throw new Error("Failed to fetch Yahoo CSV (try a different ticker).");
  const txt = await res.text();
  const lines = txt.trim().split("\n");
  const head = lines[0].split(",");
  const adjIdx = head.indexOf("Adj Close");
  const closeIdx = adjIdx >= 0 ? adjIdx : head.indexOf("Close");
  const prices = [];
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(",");
    const p = parseFloat(cols[closeIdx]);
    if(Number.isFinite(p)) prices.push(p);
  }
  if(prices.length < 260) throw new Error("Not enough data. Increase years.");
  return prices;
}

function logReturns(prices){
  const ret=[];
  for(let i=1;i<prices.length;i++){
    ret.push(Math.log(prices[i]/prices[i-1]));
  }
  return ret;
}

// simple normality heuristic using skew + kurtosis
function normalLike(ret){
  const m = mean(ret), s = std(ret) || 1e-9;
  const z = ret.map(x => (x-m)/s);
  const skew = mean(z.map(x => x**3));
  const kurt = mean(z.map(x => x**4)) - 3;
  const score = Math.abs(skew) + Math.abs(kurt);
  return score <= 0.8; // smaller => closer to normal
}

function gaussian(){
  let u=0,v=0;
  while(u===0) u=Math.random();
  while(v===0) v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}

function simulate({rets, method, sims, days, startPrice}){
  const mu = mean(rets), sigma = std(rets);
  const useNormal = method==="normal" ? true : (method==="bootstrap" ? false : normalLike(rets));
  const endPrices = new Array(sims);
  for(let i=0;i<sims;i++){
    let price = startPrice;
    for(let d=0; d<days; d++){
      const r = useNormal ? (mu + sigma * gaussian()) : rets[Math.floor(Math.random()*rets.length)];
      price *= Math.exp(r);
    }
    endPrices[i]=price;
  }
  return {endPrices, useNormal, mu, sigma};
}

function render(metrics, returns){
  document.getElementById("metrics").innerHTML = `
    <h3>Summary</h3>
    <p><b>Mean:</b> ${(metrics.mean*100).toFixed(2)}% &nbsp; <b>Median:</b> ${(metrics.median*100).toFixed(2)}% &nbsp; <b>Std:</b> ${(metrics.std*100).toFixed(2)}%</p>
    <p><b>CI50:</b> ${(metrics.ci50[0]*100).toFixed(2)}% – ${(metrics.ci50[1]*100).toFixed(2)}% &nbsp; 
       <b>CI90:</b> ${(metrics.ci90[0]*100).toFixed(2)}% – ${(metrics.ci90[1]*100).toFixed(2)}%</p>
    <p><b>P(hit target):</b> ${(metrics.pHit*100).toFixed(1)}% &nbsp; 
       <b>${metrics.varPct}% VaR:</b> ${(metrics.varRet*100).toFixed(2)}% (≈ $${metrics.varUsd.toFixed(0)})</p>
    <p><b>Sampling:</b> ${metrics.sampling}</p>
  `;

  Plotly.newPlot("hist", [{x: returns, type:"histogram", nbinsx:60}],
    {title:"Distribution of Ending Returns", xaxis:{title:"Return"}, yaxis:{title:"Count"}}, {responsive:true});

  Plotly.newPlot("box", [{y: returns, type:"box", boxpoints:false}],
    {title:"Ending Returns (Box Plot)", yaxis:{title:"Return"}}, {responsive:true});

  const sorted=[...returns].sort((a,b)=>a-b);
  const cp=sorted.map((_,i)=>i/(sorted.length-1));
  Plotly.newPlot("cdf", [{x:sorted, y:cp, mode:"lines"}],
    {title:"Cumulative Probability Curve", xaxis:{title:"Return"}, yaxis:{title:"Cumulative Prob"}}, {responsive:true});
}

document.getElementById("run").addEventListener("click", async ()=>{
  const ticker = document.getElementById("ticker").value.trim();
  const years = +document.getElementById("years").value;
  const days = +document.getElementById("days").value;
  const sims = +document.getElementById("sims").value;
  const capital = +document.getElementById("capital").value;
  const target = +document.getElementById("target").value/100;
  const varLevel = +document.getElementById("varlevel").value;
  const method = document.getElementById("method").value;

  try{
    const prices = await fetchYahooCSV(ticker, years);
    const startPrice = prices[prices.length-1];
    const rets = logReturns(prices);

    const sim = simulate({rets, method, sims, days, startPrice});
    const endingReturns = sim.endPrices.map(p => (p/startPrice)-1);

    const m = mean(endingReturns), med = quantile(endingReturns, 0.5), s = std(endingReturns);
    const ci50=[quantile(endingReturns,0.25), quantile(endingReturns,0.75)];
    const ci90=[quantile(endingReturns,0.05), quantile(endingReturns,0.95)];
    const pHit = endingReturns.filter(r=>r>=target).length/endingReturns.length;
    const varRet = quantile(endingReturns, 1 - varLevel);
    const varUsd = capital * varRet;

    render({
      mean:m, median:med, std:s, ci50, ci90, pHit,
      varRet, varUsd, varPct:Math.round(varLevel*100),
      sampling: sim.useNormal ? "Normal(μ,σ)" : "Bootstrap"
    }, endingReturns);
  }catch(e){
    alert(e.message);
  }
});

// auto-run once
document.getElementById("run").click();
