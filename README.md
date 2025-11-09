# Monte Carlo Return Simulator

**Problem (Business Value):** Given historical daily returns for a ticker (e.g., AAPL), estimate the next 90-day return distribution, probability of hitting a target, and downside risk (VaR). Helps an investor decide position size and risk limits.

**How to use the web app:** Open the deployed site, choose ticker, years of history, days, #sims, capital, target, and VaR level, then click **Run Simulation**. You’ll see metrics + interactive charts.

**Tech:** Static web (HTML/CSS/JS + Plotly) deployed on Netlify. Analysis done in Colab using `yfinance`, `numpy`, `matplotlib`.

**Colab notebook:** [link to your Colab, anyone-can-view]

**Live app:** [your Netlify URL]

**Notes:** Educational only; not financial advice.
