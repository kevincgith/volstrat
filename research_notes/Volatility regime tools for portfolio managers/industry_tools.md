# Institutional market-regime / risk-appetite indicators: construction, PM use, outputs, failure modes (as of Nov 2026)

Scope note: Bank sell-side indicators (Goldman RAI, Citi, Credit Suisse/UBS, JPM, BofA) are proprietary, and their methodology documents were not publicly retrievable. Public-sector indices (OFR FSI, Chicago Fed NFCI, KC Fed RORO) and peer-reviewed academic tools (Kritzman turbulence, Kritzman-Page-Turkington Markov regimes, Two Sigma GMM, Man/Duke similarity regimes) are fully or substantially documented. The notes below keep **documented methodology** and **marketing/press description** separate. Several SSGA pages are JavaScript-rendered and returned empty shells, so SSGA MRI details come from search-surfaced excerpts of its quarterly notes and TAA paper.

## Q1. Which institutional regime / risk-appetite indicators exist, and how are they constructed?

### Takeaway
Nearly every institutional tool is built the same way. It takes a small-to-large basket of market-implied stress variables (implied vol in equity, FX and rates, credit spreads, funding spreads, safe-haven flows), standardizes each against its own history (z-scores or percentiles), and aggregates them. The aggregation is equal-weighted, PCA/dynamic-factor, Mahalanobis distance, or a latent-state model (Markov switching, GMM). The output is a bounded score or a discrete regime label. Public-sector indices are fully documented. Sell-side indices are mostly black boxes known through press coverage and third-party replicas.

### Cited Findings

**State Street Global Advisors (SSGA) Market Regime Indicator (MRI)**: partially documented, proprietary
- SSGA's Investment Solutions Group describes the MRI as a proprietary macro indicator that gauges market risk aversion or appetite from forward-looking information. It has three factors: equity implied volatility, currency implied volatility, and risky-debt spreads. — [SSGA MRI Q1 2024](https://ssga.com/us/en/intermediary/insights/market-regime-indicator-q1-2024); [SSGA MRI Q4 2023 PDF](https://www.ssga.com/library-content/assets/pdf/north-america/mas/2023/inst-pdf-market-regime-indicator-q4-2023.pdf) (search-surfaced excerpts; both URLs failed or rendered empty on direct fetch)
- Each factor gets its own regime label (e.g., "Low", "Normal", "Euphoria"). The composite runs from 0% to 100%. Near 0% means extreme risk appetite ("Greed/Complacency"). High readings mean stress (rising vol, falling risky-asset prices). — [SSGA MRI quarterly notes, via search excerpt](https://ssga.com/us/en/individual/insights/mri-q4-2023)
- Example: the VIX fell to a post-pandemic low of 12.07 in late 2023 and the equity-vol factor moved into "Euphoria". In October 2023 the notes record a divergence, with credit spreads tightening while equity vol rose. — [SSGA MRI Q4 2023](https://www.ssga.com/library-content/assets/pdf/north-america/mas/2023/inst-pdf-market-regime-indicator-q4-2023.pdf) (search excerpt)
- Exact regime cut-offs and factor weights are not published. — same sources (absence)

**State Street Investor Confidence Index (ICI)**: behavioural, flow-based
- Ken Froot (Harvard) and Paul O'Connell (State Street Associates) developed the ICI. It uses holdings and flow data from State Street's custody database. A rising equity allocation is read as rising risk appetite, and the index measures actual trades rather than opinions. — [IPE](https://ipe.com/state-streets-confidence-in-new-investor-index/16533.article); [Plansponsor](https://www.plansponsor.com/state-street-associates-unveils-institutional-confidence-measure/)
- It is rebased so 100 is neutral: above 100 means institutions are adding risky assets, below 100 means they are cutting. It is published monthly, with North American, European and Asian sub-indices. — [State Street press release (2007)](https://investors.statestreet.com/investor-news-events/press-releases/news-details/2007/Investor-Confidence-Index-Falls-to-91.7-in-April-04-17-2007/default.aspx); [Global Custodian](https://www.globalcustodian.com/state-street-global-markets-investor-confidence-index-declines-from-in-october/)
- Most coverage found dates from 2005–2018. Current methodology and publication status were not verified. — same sources

**Kritzman & Li Turbulence Index**: fully documented (peer-reviewed)
- Source: "Skulls, Financial Turbulence, and Risk Management," *Financial Analysts Journal* 66(5), 2010, pp. 30–41. The index is essentially the Mahalanobis distance of today's cross-asset return vector from its historical mean, using the historical covariance. It captures extreme moves, decoupling of correlated assets, and convergence of uncorrelated assets. — [CFA Institute / FAJ](https://rpc.cfainstitute.org/research/financial-analysts-journal/2010/skulls-financial-turbulence-and-risk-management); [IDEAS/RePEc](https://ideas.repec.org/a/taf/ufajxx/v66y2010i5p30-41.html)
- Key empirical claims: returns to risk are substantially lower in turbulent periods, and turbulence is persistent. Spikes line up with 1987, the Gulf War, the tech bubble, 9/11 and the GFC. — [Alpha Architect summary](https://alphaarchitect.com/skulls-financial-turbulence-and-risk-management/); [top1000funds](https://www.top1000funds.com/research/skulls-financial-turbulence-and-risk-management/)
- Practitioner primer with the formula and examples. — [Portfolio Optimizer blog](https://portfoliooptimizer.io/blog/the-turbulence-index-measuring-financial-risk/)

**Kritzman, Page & Turkington Markov-switching regimes**: fully documented
- Source: "Regime Shifts: Implications for Dynamic Strategies," *FAJ* 68(3), 2012, pp. 22–39, later corrected in *FAJ* 68(5). A two-state ("normal" vs "event") Markov-switching model is fitted separately to market turbulence, inflation and economic growth. Both states are persistent. — [IDEAS/RePEc](https://ideas.repec.org/a/taf/ufajxx/v68y2012i3p22-39.html); [CFA Institute (corrected)](https://rpc.cfainstitute.org/research/financial-analysts-journal/2012/regime-shifts-implications-for-dynamic-strategies-corrected)

**Two Sigma / Venn factor regimes (Gaussian Mixture Model)**: documented research note, not a live product spec
- The model is a GMM fitted to the 17 factors of the US Two Sigma Factor Lens (Crowding factor excluded for data reasons). It produces 4 regimes, chosen by cross-validated log-likelihood, with AIC and a goodness-of-fit test agreeing. The regimes are named **Crisis, Steady State, Inflation, Walking on Ice (WOI)**. Data run from the early 1970s to late 2020. Article dated 6 Oct 2021. — [Two Sigma](https://www.twosigma.com/articles/a-machine-learning-approach-to-regime-modeling); [Venn mirror](https://www.venn.twosigma.com/resources/streetview-a-machine-learning-approach-to-regime-modeling); [PDF](https://www.twosigma.com/wp-content/uploads/2021/10/Machine-Learning-Approach-to-Regime-Modeling_.pdf)
- Each period is scored independently, with no temporal (Markov) linkage. — [Two Sigma](https://www.twosigma.com/articles/a-machine-learning-approach-to-regime-modeling)

**Man Group / Duke "Regimes" (similarity / analog approach)**: documented
- Authors: Mulliner, Harvey, Xia and Fang (March 2025). The model uses seven economic state variables, each a 12-month change z-scored over a rolling 10 years and capped at ±3. It computes a distance from the current month to every historical month (a "Global Score"). The most similar 20% of months are the "regime" and the least similar 20% the "anti-regime". The last 36 months are excluded to avoid loading up on momentum. — [Man Group](https://www.man.com/insights/regimes-systematic-models-power-of-prediction); [AIMA](https://www.aima.org/article/regimes-systematic-models-and-the-power-of-prediction.html); [Duke Scholars](https://scholars.duke.edu/publication/1704567)

**OFR Financial Stress Index**: fully documented (public)
- It uses 33 market variables grouped into 5 categories (credit, equity valuation, funding, safe assets, volatility) and 3 regions (US, other advanced, EM). Weights come from a dynamic single-factor model that is close to the first principal component but handles series with different histories. Zero means average stress. It is published daily with a two-business-day lag. — [OFR FSI page](https://www.financialresearch.gov/financial-stress-index); [OFR WP 17-04](https://www.financialresearch.gov/working-papers/files/OFRwp-17-04_The-OFR-Financial-Stress-Index.pdf)
- Each new date re-standardizes the indicators and re-estimates the model, but "a value for a given day depends only on information available that day and, once estimated, its value does not change". In other words, it is real-time and non-revising. — [OFR WP 17-04 (via search excerpt)](https://www.financialresearch.gov/working-papers/2017/10/25/the-ofr-financial-stability-index/)

**Chicago Fed NFCI / ANFCI**: fully documented (public)
- The NFCI is a weighted average of 105 indicators (46 weekly, 33 monthly, 26 quarterly) of risk, credit and leverage. Each is standardized, and the index is expressed in standard deviations from a 1971+ mean. Weights come from a dynamic factor model (Stock-Watson, Doz-Giannone-Reichlin and similar) that up-weights "systemically" and "dynamically" important series. — [Chicago Fed NFCI FAQ (PDF)](https://www.chicagofed.org/-/media/publications/nfci/nfci-faqs-pdf.pdf); [Chicago Fed About](https://www.chicagofed.org/research/data/nfci/about)
- The top NFCI weights are mostly credit and spread series: CMBS AAA OAS 3.47, ABS/5y UST 3.39, HY/Baa 3.22, jumbo/conforming mortgage 3.17, Senior Loan Officer Survey (SLOOS) small C&I 3.16, **VIX 3.10**. Risk indicators supply slightly more than half of the absolute contributions. — [NFCI FAQ](https://www.chicagofed.org/-/media/publications/nfci/nfci-faqs-pdf.pdf)
- The ANFCI strips out variation explained by economic activity (CFNAI and the unemployment gap) and inflation (PCE and commodity prices). — [NFCI FAQ](https://www.chicagofed.org/-/media/publications/nfci/nfci-faqs-pdf.pdf)
- The risk subindex is a coincident indicator of stress, credit is a lagging indicator, and leverage is a leading indicator (Brave & Butters 2012b). — [NFCI FAQ](https://www.chicagofed.org/-/media/publications/nfci/nfci-faqs-pdf.pdf)

**St. Louis Fed STLFSI**: public, details not verified from primary source
- A secondary source says it combines 18 weekly series from 1993 with a methodology similar to the NFCI's. I did not verify this against St. Louis Fed documentation. — [eco3min (secondary)](https://eco3min.fr/en/nfci-financial-conditions-stress-signal-chicago-fed-meta-indicator/)

**Kansas City Fed Risk-On/Risk-Off (RORO) index**: public
- It is the z-score of the first principal component of daily changes in standardized series covering credit risk, equity vol and returns, funding liquidity, and currency/gold. FRED publishes sub-indices for Spreads, Equities, Liquidity, and Gold & USD. — [KC Fed RORO](https://www.kansascityfed.org/data-and-trends/risk-on-risk-off-index/); [FRED KCRORO](https://fred.stlouisfed.org/series/KCRORO); [FRED KCROROS](https://fred.stlouisfed.org/series/KCROROS); [KC Fed working paper (Chari, Stedman, Lundblad)](https://www.kansascityfed.org/documents/10594/rwp24-12charistedmanlundblad.pdf)

**BofA Global Fund Manager Survey (FMS) and Bull & Bear Indicator**: survey/positioning-based, contrarian; methodology known only from press
- The indicator is derived in part from the monthly FMS of 200+ managers and is read contrarian-style: a reading above 8 is a "sell" signal. The paired "buy" trigger is Hartnett's Global Breadth Rule, which fires when 88% of global equity indices are below both their 50-day and 200-day moving averages. — [Investing.com](https://www.investing.com/news/stock-market-news/bofas-hartnett-sees-markets-at-extreme-optimism-issues-sell-signal-4475325); [BNN Bloomberg (Feb 2024)](https://www.bnnbloomberg.ca/bofa-s-hartnett-says-stock-rally-close-to-triggering-sell-signal-1.2033076); [Fortune (Dec 2025)](https://fortune.com/2025/12/19/stocks-bank-of-america-warns-contrarian-sell-signal)
- Recent readings reported in the press: 7.9→8.5 in Dec 2025 (sell); 9.4 in Jan 2026; 7.4 in Mar 2026 (sell ended); 9.7 in Aug 2026 (highest since 2021). — [Fortune](https://fortune.com/2025/12/19/stocks-bank-of-america-warns-contrarian-sell-signal); [LongPort (Aug 2026)](https://longportapp.cn/news/295227962); [LongPort](https://longportapp.cn/news/280904504)
- Full input list and weights (fund flows, breadth, credit technicals, FMS cash, and so on) were not found in a primary source. — gap

**Goldman Sachs Risk Appetite Indicator (RAI/GSRAI)**: proprietary, no primary methodology found
- Only third-party TradingView "proxies" turned up. They use HY spreads, VIX, SPY/IEF and oil/gold, each z-scored, equal-weighted and rescaled to 0–100. Their authors say the original "incorporates additional proprietary elements not publicly disclosed". — [TradingView GS RAI proxy](https://de.tradingview.com/script/KEPvkE6t-Goldman-Sachs-Risk-Appetite-Proxy)
- **Treat as unverified.** These proxies are not Goldman's methodology.

**Credit Suisse Global Risk Appetite Index (GRAI)**: legacy (CS now part of UBS), partially described
- A secondary account describes it as the slope of a daily rolling cross-sectional weighted regression of 6-month excess returns on 12-month price variability, across 64 country assets. It descends from the Kumar & Persaud (2002) rank-correlation idea. Readings were labelled on a scale running from "panic" to "euphoria", and in 2006 it hit a euphoria reading unseen since 1987. — [Bundesbank DP (Uhlenbrock) / core.ac.uk](https://core.ac.uk/works/2552104); [Bundesbank DP data](https://www.bundesbank.de/resource/blob/704312/6db4f62628e35702ccce4b8cf63b4665/mL/2009-07-07-dkp-08-data.pdf); [FN Arena (2006)](https://fnarena.com/index.php/2006/06/22/risk-appetite-and-the-bull-trend-consensus)

**Citi Macro Risk Index / Global Risk Aversion Macro Index**: proprietary, press-only
- Built from credit spreads, FX vol and equity vol; zero means very low risk aversion. — [Interactive Advisors blog](https://investing.interactiveadvisors.com/2012/09/its-officially-a-risk-on-market)
- A Citi signal turns bearish when the 20-day moving average of the Global Risk Aversion Macro Index crosses above its 100-day moving average. — [Bloomberg (Aug 2017)](https://www.bloomberg.com/news/articles/2017-08-25/citi-risk-aversion-signal-turns-bearish-for-first-time-in-a-year)

**MSCI Barra Volatility Regime Adjustment (VRA)**: a regime element embedded inside a risk model, not a standalone indicator
- Introduced with USE4 (2011) and carried into CNE5 and other models. VRA recalibrates factor and specific volatility forecasts to current market levels. It reduces under-prediction of risk when vol is rising and over-prediction when exiting high vol. — [MSCI USE4 press release](https://ir.msci.com/news-releases/news-release-details/msci-launches-new-barra-equity-models); [top1000funds](https://www.top1000funds.com/asset-classes/msci-improves-factor-risk-modelling-for-equities/); [MSCI factsheet](https://www.msci.com/documents/1296102/1636401/MSCI_Barra_Market+Equity+Models_Factsheet+.pdf)

### Inferences
- Implied vol (VIX and its FX and rates equivalents) plus credit spreads is the common core of SSGA MRI, Citi, the GS proxies, OFR, NFCI and KC RORO. A new tool that combines those components is not differentiated by its inputs. Any edge has to come from transparency, the regime-conditional analytics, and decision rules.
- The design space splits three ways. **Level/stress scores** (OFR, NFCI, MRI composite) are continuous and easy to explain. **Latent-state models** (Markov, GMM) give probabilities and conditional distributions. **Analog/similarity models** (Man) give "periods like now" and their forward returns. Each answers a different PM question.
- Sentiment and positioning gauges (BofA Bull & Bear, BofA FMS, State Street ICI) are a separate family. They are contrarian and read as signals at extremes, whereas stress gauges are read as coincident state.

### Gaps
- No primary methodology was found for Goldman RAI, JPMorgan's risk-appetite or regime tools, UBS's post-CS risk-appetite index, Citi Macro Risk Index weights, or the full BofA Bull & Bear inputs. These sit behind research paywalls or terminals.
- The CBOE indices and Bloomberg/Refinitiv terminal functions (e.g., Bloomberg's financial conditions indices) were not researched within the call budget.
- STLFSI details are unverified.
- The SSGA MRI regime thresholds and weights are not public.
- SSGA's 2025/2026 "Decoding market regimes with machine learning" PDFs exist ([2025](https://ssga.com/library-content/assets/pdf/global/pc/2025/decoding-market-regimes-with-machine-learning.pdf), [2026](https://www.ssga.com/library-content/assets/pdf/global/pc/2026/decoding-market-regimes-machine-learning-insights.pdf)), but their text could not be extracted, so their content is unknown.

## Q2. How do PMs and institutions actually use them in decisions, and is there evidence they help?

### Takeaway
Documented uses fall into five buckets:
1. A **TAA risk-on/risk-off overlay** that sets equity under- or overweights (SSGA).
2. **Exposure scaling / risk budgeting** keyed to turbulence or regime probability (Kritzman et al.).
3. **Stress testing with regime-conditional covariances** (Kritzman & Li; Two Sigma).
4. **Contrarian entry/exit triggers** at sentiment extremes (BofA).
5. **Risk-model recalibration** (MSCI VRA).

The published evidence of value is mostly backtests by the tool's own authors. The strongest claims concern loss avoidance, not return enhancement.

### Cited Findings
- **TAA overlay:** SSGA calls its MRI "a key driver of the active positioning for those broad-based, directional opportunities". In elevated risk-aversion regimes it typically underweights equities and favours other assets. The MRI is combined with bottom-up signals such as valuations, credit spreads and momentum. — [SSGA "Why institutions should consider TAA" (2025)](https://www.ssga.com/library-content/assets/pdf/global/pc/2025/why-institutions-should-consider-taa-gbl.pdf) (search excerpt); SSGA describes it as one input to its global TAA process — [SSGA MRI Q1 2023](https://www.ssga.com/hk/en/institutional/ic/insights/state-street-global-advisors-market-regime-indicator-q1_2023)
- **Exposure scaling:** Kritzman & Li propose three uses: (1) stress-test portfolios with covariances estimated from turbulent periods, (2) build turbulence-resistant portfolios, and (3) use turbulence as a filter to scale risk exposure. — [Alpha Architect](https://alphaarchitect.com/skulls-financial-turbulence-and-risk-management/); [FAJ](https://rpc.cfainstitute.org/research/financial-analysts-journal/2010/skulls-financial-turbulence-and-risk-management)
- **Out-of-sample dynamic allocation:** Kritzman, Page & Turkington used Markov regime forecasts to scale exposure to risk premia, and also for stock/bond/cash allocation. The dynamic process beat static allocation out of sample, "especially for investors who seek to avoid large losses". The authors stress that most prior Markov work was in-sample fitting only. — [IDEAS/RePEc abstract](https://ideas.repec.org/a/taf/ufajxx/v68y2012i3p22-39.html)
- **Independent replication:** Flint & Maré (South African Actuarial Journal, 2019) tested 4 regime-identification methods. A regime-switching turbulence model used for TAA beat its benchmarks out of sample. — [AJOL](https://ajol.info/index.php/saaj/article/view/191873/181084)
- **Factor timing via analogs:** Man/Duke went long factors whose forward returns after the most-similar months were positive, and short otherwise. The result was alpha about 3 standard errors from zero, and a long-similar/short-dissimilar Sharpe ratio of 0.82 with 0.37 correlation to long-only. The long-only version did slightly better over time but had "significantly worse drawdowns in crises". The test covers 1985–2024 and 6 long-short factors. — [Man Group](https://www.man.com/insights/regimes-systematic-models-power-of-prediction)
- **Scenario generation / stress tests:** Two Sigma suggests sampling from regime-conditional distributions to enrich scenario analysis and stress tests. It also suggests using regimes for long-run portfolio robustness plus short-horizon tactical shifts. — [Two Sigma](https://www.twosigma.com/articles/a-machine-learning-approach-to-regime-modeling)
- **Contrarian sell/buy triggers:** BofA's Hartnett pairs the Bull & Bear "sell" (>8) with the Global Breadth Rule "buy". In practice the signals are presented as rotation advice (e.g., into defensives) rather than outright de-risking, as in "sell signal for risk assets but no rush to cut exposure". — [Investing.com (defensives)](https://www.investing.com/news/stock-market-news/bofas-hartnett-says-rotate-into-defensives-as-sell-signal-returns-4845556); [Investing.com (no rush to cut)](https://www.investing.com/news/stock-market-news/bofas-hartnett-sees-sell-signal-for-risk-assets-but-no-rush-to-cut-exposure-4706152)
- **Claimed BofA track record:** one report says the indicator was right 63% of the time across 32 sell signals since 2002. Another outlet counts 16 by Dec 2025. The tallies are inconsistent and come from secondary press, not BofA. — [Ground News aggregation](https://ground.news/article/a-sell-signal-has-been-triggered-at-bank-of-america-heres-what-happens-next); [Fortune](https://fortune.com/2025/12/19/stocks-bank-of-america-warns-contrarian-sell-signal)
- **Mechanical crossover rule:** Citi's risk-aversion signal is a 20-day vs 100-day moving-average crossover. — [Bloomberg](https://www.bloomberg.com/news/articles/2017-08-25/citi-risk-aversion-signal-turns-bearish-for-first-time-in-a-year)
- **Macro forecasting / policy conditioning:** the Chicago Fed reports that the NFCI and ANFCI help forecast GDP and business investment 2–4 quarters ahead. Brave & Butters develop threshold rules that classify current conditions against levels seen in past crises. — [NFCI FAQ](https://www.chicagofed.org/-/media/publications/nfci/nfci-faqs-pdf.pdf)
- **Risk-model regime conditioning:** MSCI VRA makes risk forecasts, and hence risk budgets and tracking-error limits, respond faster when vol regimes change. — [MSCI USE4](https://ir.msci.com/news-releases/news-release-details/msci-launches-new-barra-equity-models)
- **Monitoring role:** the OFR positions its FSI as a measure of *current* systemic stress and points users to a separate Vulnerabilities Monitor for build-up risk. It says explicitly that the FSI is not investment advice. — [OFR FSI](https://www.financialresearch.gov/financial-stress-index)

### Inferences
- In the documented uses, the regime tool sets **how much risk** to take (scaling, under- or overweighting equities, risk-model calibration) more often than **which asset** to buy. A PM tool should map regime state directly to an exposure or risk-budget recommendation rather than only displaying a label.
- The evidence base favours **drawdown reduction** (Kritzman-Page-Turkington, Man's crisis behaviour) over return improvement. Hedging and protection-timing use cases are therefore the most defensible pitch.
- PMs blend regime signals with other inputs (SSGA adds valuation and momentum; Hartnett pairs a sell with a separate buy rule). A useful tool should show how its signal interacts with or conflicts with other signals, not claim to be a standalone decision rule.
- Client and IC communication is an implicit use: SSGA publishes quarterly MRI notes, and BofA's sell/buy signals are heavily press-cycled. Simple, explainable labels with component attribution suit this role.

### Gaps
- No primary source was found quantifying **hedge-trigger** use (e.g., "buy puts when indicator X crosses Y") by institutions. This is likely common practice but undocumented publicly.
- No independent (non-author) evaluation of sell-side indicators such as the GS RAI, Citi index or BofA B&B was found. Track-record claims are self-reported or come via the press.
- No survey of PM adoption rates or usage patterns was found. Illing & Aaron (2005, Bank of Canada) surveyed indicators but could not be retrieved.

## Q3. What outputs do these tools expose?

### Takeaway
Outputs range from a single bounded score with a coarse label (SSGA MRI, BofA B&B, GS proxies) to richer analytical displays: component/category/region attribution (OFR, NFCI subindexes, KC RORO sub-indices, MRI per-factor regimes); regime probabilities and regime-conditional factor means, vols and correlations (Two Sigma); and lists of historical analog dates with forward returns (Man). Explicit transition matrices are rarely shown publicly, even when the model implies one.

### Cited Findings
- **SSGA MRI:** a 0–100% composite plus a separate regime label for each of its three factors (e.g., "Euphoria" for equity vol). The quarterly notes discuss component divergences. — [SSGA MRI Q4 2023](https://www.ssga.com/library-content/assets/pdf/north-america/mas/2023/inst-pdf-market-regime-indicator-q4-2023.pdf) (search excerpt)
- **OFR FSI:** a daily level, contributions by 5 categories and 3 regions, a full data download, an indicator table, and a published revision-history file. — [OFR FSI](https://www.financialresearch.gov/financial-stress-index)
- **NFCI:** the headline index, the ANFCI, risk/credit/leverage subindexes, a nonfinancial-leverage subindex flagged as an early-warning signal, and a published weight for each of the 105 indicators. — [NFCI FAQ](https://www.chicagofed.org/-/media/publications/nfci/nfci-faqs-pdf.pdf)
- **KC RORO:** a headline score plus four sub-indices (Spreads, Equities, Liquidity, Gold & USD) on FRED. — [FRED KCRORO](https://fred.stlouisfed.org/series/KCRORO); [FRED KCROROL](https://fred.stlouisfed.org/series/KCROROL); [FRED KCROROE](https://fred.stlouisfed.org/series/KCROROE); [FRED KCROROG](https://fred.stlouisfed.org/series/KCROROG)
- **Two Sigma GMM:**
  - Daily probabilities across the 4 regimes, summing to 100%.
  - Historical regime frequencies: Steady State most common; each of the other three occurs about 15–20% of the time.
  - A regime-conditional factor table. Crisis: negative equity and credit means, strongly positive trend-following, highest average absolute correlation. Inflation: double-digit mean for the Local Inflation factor. WOI: equity positive but factor vol 1.6pp above average (Value 18.2% vs 8.9% long-run; Momentum 19.1% vs 10.5%; Low Risk 20% vs 10.4%).
  - Current readout: Crisis during COVID, then WOI/Steady State, with maximum Inflation probability at 0.01% in 2020–21.
  - No numerical transition matrix is published.
  — [Two Sigma](https://www.twosigma.com/articles/a-machine-learning-approach-to-regime-modeling)
- **Man similarity model:** a similarity score over every historical month, with quintile buckets of most- and least-similar dates and the factor returns that followed. — [Man Group](https://www.man.com/insights/regimes-systematic-models-power-of-prediction)
- **Kritzman-Page-Turkington:** Markov models give regime probabilities and imply persistence (transition) estimates. The abstract confirms meaningful persistence in both states. — [IDEAS/RePEc](https://ideas.repec.org/a/taf/ufajxx/v68y2012i3p22-39.html)
- **BofA B&B:** a 0–10 scale with buy/sell zones. The press notes that a reading approaching 10 means risk-reward is deteriorating. — [LongPort (Aug 2026)](https://longportapp.cn/news/295227962)
- **Citi:** a level plus a 20d/100d moving-average crossover signal (an alert-style output). — [Bloomberg](https://www.bloomberg.com/news/articles/2017-08-25/citi-risk-aversion-signal-turns-bearish-for-first-time-in-a-year)
- **ICI:** a level relative to 100 with regional sub-indices, published monthly on a fixed schedule. — [Global Custodian](https://www.globalcustodian.com/state-street-global-markets-investor-confidence-index-declines-from-in-october/)

### Inferences
- The most valuable output elements, judged by what the most rigorous providers choose to publish, are:
  1. A **continuous score plus a discrete label**.
  2. **Component attribution** (which inputs are driving the reading, and divergences between them).
  3. **Regime-conditional return, vol and correlation tables** for the assets the PM holds.
  4. **Probabilities rather than hard labels**, so uncertainty is visible.
  5. **History with labelled episodes** for credibility.
  6. **Explicit thresholds/alerts** with a stated rule.
- Transition probabilities and expected regime duration are an under-served output. Models imply them, but public tools rarely surface them, so this is a potential differentiator.
- Full weight transparency (NFCI publishes all 105 weights) is the gold standard for trust. Sell-side tools trade it away for proprietary appeal.

### Gaps
- No source showed Bloomberg or Refinitiv terminal output formats for regime or financial-conditions functions.
- No public example of a published regime transition matrix from a commercial vendor was found.

## Q4. What are the common failure modes?

### Takeaway
Documented failure modes are:
- **Conflicting signals across indicators** that supposedly measure the same thing.
- **Weak theoretical grounding** for "risk appetite".
- **Revisions** in factor-model indices that use revised macro data (NFCI, ANFCI), as opposed to real-time, non-revising designs (OFR).
- **Abrupt regime switching and labels that react to transient moves** (Two Sigma).
- **Look-ahead bias** in variable selection (Man).
- **No historical analogue for novel shocks** (COVID).
- **Small samples and inconsistent track-record counts** (BofA).
- **Sensitivity to proprietary data feeds** in replicas.

### Cited Findings
- **Conflicting signals and weak theory:** popular risk-appetite indicators "typically have scant foundation in theory, and give contradictory signals in practice". Illing & Aaron (2005) found the indexes contradict each other although they presumably capture the same phenomenon, partly because "risk appetite" is vaguely defined. — [Misina, Bank of Canada WP 06-16](https://oar-rao.bank-banque-canada.ca/record/1366/files/wp06-16.pdf)
- **Component divergence inside one tool:** the SSGA MRI notes record credit spreads tightening while equity vol rose (Oct 2023), so the per-factor regimes disagreed. — [SSGA MRI Q4 2023](https://www.ssga.com/library-content/assets/pdf/north-america/mas/2023/inst-pdf-market-regime-indicator-q4-2023.pdf) (search excerpt)
- **Revisions:**
  - NFCI history "can change from week to week depending on incoming data and data revisions". Revisions are larger near the start of each month because of revised monthly and quarterly series. The ANFCI shows larger revisions because its adjustment series are also revised. — [NFCI FAQ](https://www.chicagofed.org/-/media/publications/nfci/nfci-faqs-pdf.pdf)
  - In contrast, OFR FSI values do not change once estimated. — [OFR WP 17-04](https://www.financialresearch.gov/working-papers/2017/10/25/the-ofr-financial-stability-index/)
  - The OFR did still correct data-feed errors (CEMBI strip spread, May 15–22, 2026) and keeps a revision-history file. — [OFR FSI](https://www.financialresearch.gov/financial-stress-index)
- **Uneven data coverage over time:** fewer than half of the NFCI indicators were available before 1987, so early history rests on a thinner base. — [NFCI FAQ](https://www.chicagofed.org/-/media/publications/nfci/nfci-faqs-pdf.pdf)
- **Lag differs by component:** NFCI risk measures are coincident, credit measures lagging, and leverage measures leading. A stress composite dominated by risk measures will not lead. — [NFCI FAQ](https://www.chicagofed.org/-/media/publications/nfci/nfci-faqs-pdf.pdf)
- **Label instability and non-predictiveness:** Two Sigma says its model is "not predictive". Regimes sometimes switch abruptly and react to transient changes, labels are inferred after the fact rather than intuitively defined, and the conditional means carry estimation error. — [Two Sigma](https://www.twosigma.com/articles/a-machine-learning-approach-to-regime-modeling)
- **Look-ahead and design subjectivity:** Man/Duke concede that choosing the state variables "itself induces look-ahead bias". Other choices are subjective too: thresholds, windows, equal weights. COVID showed "no obvious visual patterns" because it had no historical analogue. — [Man Group](https://www.man.com/insights/regimes-systematic-models-power-of-prediction)
- **In-sample overfitting of regime models:** Kritzman, Page & Turkington note that most Markov-switching studies only fit regimes in sample, with few out-of-sample tests. — [IDEAS/RePEc](https://ideas.repec.org/a/taf/ufajxx/v68y2012i3p22-39.html)
- **Signal persistence vs action:** BofA's sell signals often persist for months (Dec 2025 to Mar 2026) and are paired with "no rush to cut exposure". In practice the signal is a caution flag, not a trade. — [Investing.com](https://www.investing.com/news/stock-market-news/bofas-hartnett-sees-sell-signal-for-risk-assets-but-no-rush-to-cut-exposure-4706152); [LongPort](https://longportapp.cn/news/280904504)
- **Track-record opacity:** sell-signal counts for the BofA B&B differ across outlets (32 since 2002 vs 16 by Dec 2025). — [Ground News](https://ground.news/article/a-sell-signal-has-been-triggered-at-bank-of-america-heres-what-happens-next); [Fortune](https://fortune.com/2025/12/19/stocks-bank-of-america-warns-contrarian-sell-signal)
- **Replica fidelity:** public GS RAI proxies say they may differ from Goldman's institutional data feeds and omit proprietary elements. — [TradingView](https://de.tradingview.com/script/KEPvkE6t-Goldman-Sachs-Risk-Appetite-Proxy)
- **Risk-model lag around regime turns:** MSCI built VRA because standard models under-predict risk entering high vol and over-predict it exiting. That is the lag problem acknowledged by a major vendor. — [MSCI USE4](https://ir.msci.com/news-releases/news-release-details/msci-launches-new-barra-equity-models)
- **Content staleness:** the Venn version of Two Sigma's note warns that its content will become outdated and less accurate over time. — [Venn](https://www.venn.twosigma.com/resources/streetview-a-machine-learning-approach-to-regime-modeling)

### Inferences
- Revision behaviour is a design choice, and it should be disclosed. The OFR's "point-in-time, never restated" approach suits backtesting and trust. The NFCI's revising history is more accurate after the fact but can show signals that were not available in real time. A tool should either freeze history or show vintages and revisions explicitly. (This matches the project's existing practice of surfacing every data revision.)
- The commonest practical complaints are disagreement (between indicators or between components), lag at turning points, and label flicker. A useful tool would address them with hysteresis or persistence filters, probability bands instead of hard flips, and component-divergence flags.
- "Not predictive" honesty (Two Sigma) and conceded look-ahead (Man) are signs of documented rigour. Unqualified hit-rate claims from press coverage of sell-side signals should be treated as marketing.

### Gaps
- No systematic study of false-alarm rates for the SSGA MRI, GS RAI or Citi indices was found.
- No primary PM testimony (surveys or interviews) on failure modes was found. The failure modes above come from provider documentation and academic papers, not from users.
- The magnitude of NFCI revisions (typical size in standard-deviation units) was not quantified in the sources retrieved. The Chicago Fed's "Revisions to the NFCI and ANFCI" section at chicagofed.org/research/data/nfci/current-data would be the next place to check.
