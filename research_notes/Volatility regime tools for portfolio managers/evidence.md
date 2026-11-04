# Out-of-sample evidence on volatility- and risk-regime-based asset allocation

Scope note: compiled 2026-11-04. Several primary PDFs (Harvey et al. 2018; Cederburg et al. 2020) were downloaded but could not be text-extracted in this environment, and Alpha Architect pages returned HTTP 403. Many numbers below therefore come from abstracts, publisher pages and secondary summaries (Quantpedia, CFA Institute, RePEc). Each item says where it came from. IS = in-sample, OOS = out-of-sample (real-time parameters).

## 1. Volatility-managed portfolios (Moreira & Muir and critiques) and volatility targeting

### Takeaway
On a realistic real-time basis, volatility management is a weak and unreliable alpha source for equity factors. After costs it mostly fails outside the market factor. What does hold up is risk control: volatility targeting the market portfolio and other "risk assets" (equities, credit) reliably thins the left tail, lowers vol-of-vol, and modestly raises Sharpe ratios. For bonds, FX and commodities the Sharpe effect is about zero. Naive full-sample constructions overstate the benefit through look-ahead in the scaling constant.

### Cited Findings
- **Moreira & Muir (2017, J. Finance 72(4):1611–1644), IS.** Monthly returns are scaled by the inverse of the previous month's realized variance. For the market: annualized alpha 4.9%, appraisal ratio 0.33, about a 25% increase in the buy-and-hold Sharpe ratio. Tested on market, value, momentum, profitability, ROE, investment, BAB and FX carry. — [NBER w22208](https://www.nber.org/papers/w22208); [published PDF](https://amoreira2.github.io/alan-moreira.github.io/VolPortfolios_published.pdf)
  - A secondary summary gives a 1926–2015 sample and factor Sharpe gains of "50% to 100%". Not verified against the paper's tables; the abstract's 25% figure is for the market. — [vLex summary](https://law-journals-books.vlex.com/vid/volatilitymanaged-portfolios-855591267)
- **Cederburg, O'Doherty, Wang & Yan (2020, JFE 138(1):95–117): 103 equity strategies, OOS vs IS.**
  - In direct comparisons, volatility-managed versions had a higher gross Sharpe ratio for only 53 of 103 strategies. Only 8 of those 53 margins were statistically significant.
  - IS spanning regressions do give positive alphas for most strategies, replicating Moreira & Muir. But those alphas require scaling to equal full-sample volatility, which needs full-sample foresight.
  - OOS mean-variance combinations that add the volatility-managed version give *lower* gross Sharpe ratios and certainty-equivalent returns for 72 of 103 strategies.
  - The authors blame structural instability in the spanning-regression parameters. Results are gross of costs.
  — [Lehigh PDF](https://www.lehigh.edu/~xuy219/research/COWY.pdf); [RePEc](https://econpapers.repec.org/RePEc:eee:jfinec:v:138:y:2020:i:1:p:95-117)
  - An Erasmus thesis replicates the OOS failure and points to estimation risk in the volatility-weight calculation. — [Visser thesis](https://thesis.eur.nl/pub/49941/Visser_443480.pdf)
- **Liu, Tang & Zhou (2019), "Volatility-managed portfolio: Does it really work?"**
  - Moreira & Muir's market strategy has look-ahead bias: the scaling constant is calibrated on full-sample unconditional volatility.
  - Re-estimating the constant in real time (fixed or rolling 5–20-year windows) gives maximum drawdowns of 68%–93% in almost all cases. The biased version's maximum drawdown is 56%, against about 50% for the market.
  - The strategy beats the market only around the financial-crisis period.
  — [WUSTL profile](https://profiles.wustl.edu/en/publications/volatility-managed-portfolio-does-it-really-work/); [ProQuest](https://www.proquest.com/docview/2310945816)
  - A later paper confirms that the scaling factors in Moreira & Muir (2017) and Harvey et al. (2018) are built ex post. — [core.ac.uk](https://core.ac.uk/download/328853217.pdf)
- **Barroso & Detzel (2021, JFE 140(3):744–767), net of costs.**
  - For factors other than the market, volatility management after costs generally earns no abnormal return and *lowers* Sharpe ratios, even with six cost-mitigation methods.
  - The volatility-managed market is the exception. Its alpha survives costs, is concentrated in the easiest-to-arbitrage stocks, and appears only when investor sentiment is high.
  — [RePEc](https://econpapers.repec.org/RePEc:eee:jfinec:v:140:y:2021:i:3:p:744-767); [Stuttgart bib](https://puma.ub.uni-stuttgart.de/bibtex/24b91172aa5ad7441a6ea0881214041e7/georglender)
  - Martin-Utrera (2022) likewise finds costs erode the gains for every factor except the market. — [FoFI 2022 paper](https://wp.lancs.ac.uk/fofi2022/files/2022/08/FoFI-2022-076-Alberto-Martin-Utrera.pdf)
- **Harvey, Hoyle, Korgaonkar, Rattray, Sargaison & Van Hemert (2018, JPM), "The Impact of Volatility Targeting".**
  - Universe: 60+ assets, with daily data starting as early as 1926. Volatility is estimated with a 20-day half-life.
  - Sharpe ratios rise for "risk assets" (equities, credit). The effect is "negligible" for bonds, currencies and commodities.
  - Volatility targeting consistently lowers the probability of extreme returns and vol-of-vol across all assets. For equities, the standard deviation of rolling 1-year realized volatility falls from 4.6% unscaled to 1.8% scaled.
  - For 60/40 and risk-parity portfolios it improves Sharpe ratios and reduces maximum drawdowns. The summaries give no exact figures.
  - Mechanism: the leverage effect (negative return/volatility correlation) means volatility scaling injects time-series-momentum-like behaviour.
  — [Duke PDF](https://people.duke.edu/~charvey/Research/Published_Papers/P135_The_impact_of.pdf); [Quantpedia summary](https://quantpedia.com/the-impact-of-volatility-targeting-on-equities-bonds-commodities-and-currencies); [SSRN 3175538](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3175538)
- **Bongaerts, Kang & van Dijk (2020, FAJ 76(4):54–71), "Conditional Volatility Targeting".**
  - Conventional volatility targeting "fails to consistently improve performance in global equity markets and can lead to markedly greater drawdowns." Per the CFA Institute summary, it raised Sharpe ratios in only 8 of 10 markets.
  - The conditional version de-risks or levers only in the extreme high- and low-volatility states. It improved Sharpe ratios in all markets tested, cut drawdowns and tail risk, and used less turnover and leverage. Results hold in major equity markets and in momentum factors across regions.
  - Moving into Treasury futures during high equity volatility added further return (secondary summary).
  — [CFA Institute](https://rpc.cfainstitute.org/research/financial-analysts-journal/2020/conditional-volatility-targeting); [RePEc](https://econpapers.repec.org/RePEc:taf:ufajxx:v:76:y:2020:i:4:p:54-71); [Alpha Architect summary](https://alphaarchitect.com/conditional-volatility-targeting/)

### Inferences
- These papers agree on one division. Volatility targeting is a **risk-shaping tool** (thinner left tail, steadier risk, somewhat better Sharpe for equities and credit). It is **not a robust alpha generator** across factors.
- The strongest net-of-cost case is the equity market portfolio itself (Barroso & Detzel; Harvey et al.). Even there, real-time implementation with leverage can produce deeper drawdowns than buy-and-hold (Liu, Tang & Zhou; Bongaerts et al.).
- **Leverage caps matter.** The benefit of de-risking in high-volatility states is fairly robust. The cost of levering up in low-volatility states (e.g. before Feb 2018 or Feb 2020) is where real-time versions get hurt. This is consistent with the "conditional / extremes-only" result.
- Comparisons must hold risk equal: much of the apparent IS alpha comes from ex-post volatility matching (Cederburg et al.; Liu, Tang & Zhou).

### Gaps
- Exact Sharpe ratios, drawdowns and sample periods from Harvey et al. (2018) exhibits (e.g. S&P 500 scaled vs unscaled Sharpe; 60/40 max drawdown) could not be extracted because the PDF was not readable here.
- The exact OOS Sharpe/CER loss magnitudes for the market factor in Cederburg et al. are not confirmed.
- Liu, Tang & Zhou's journal of publication is not confirmed in the sources found. Background knowledge says it appeared in Critical Finance Review c. 2019 (unverified).

## 2. Regime-switching and regime detection (turbulence, HMMs)

### Takeaway
Markov-switching and HMM regime models give OOS backtests that beat static allocations mainly by **avoiding large losses**. Real-time regime identification lags turning points, and robustness depends heavily on adaptive estimation, trading penalties and a realistic implementation delay. Peer-reviewed OOS numbers are sparse in what could be verified here.

### Cited Findings
- **Kritzman, Page & Turkington (2012, FAJ 68(3):22–39), "Regime Shifts: Implications for Dynamic Strategies".**
  - Two-state Markov-switching models fitted to financial turbulence, inflation and economic growth identify "normal" and "event" regimes in each series.
  - Dynamic strategies driven by these regimes beat static ones in out-of-sample backtests. The advantage is strongest for investors averse to large losses.
  - The FAJ page lists a "corrected" version.
  — [CFA Institute (corrected)](https://rpc.cfainstitute.org/research/financial-analysts-journal/2012/regime-shifts-implications-for-dynamic-strategies-corrected); [RePEc](https://econpapers.repec.org/RePEc:taf:ufajxx:v:68:y:2012:i:3:p:22-39)
- **Turbulence index (Kritzman & Li 2010).** It measures multivariate "unusualness" of asset returns via Mahalanobis distance and is separate from the 2012 HMM paper. — [Alpha Architect](https://alphaarchitect.com/?p=86675)
- **Nystrup, Madsen & Lindström (2018, Quantitative Finance 18(1):83–95), "Dynamic portfolio optimization across hidden market regimes".**
  - Model predictive control uses mean and variance forecasts from a two-state HMM with time-varying parameters.
  - The authors argue that a static decision rule is suboptimal when the regime model itself is time-varying. Trading penalties are used to improve robustness.
  — [RePEc](https://econpapers.repec.org/RePEc:taf:quantf:v:18:y:2018:i:1:p:83-95); [Lund record](https://lup.lub.lu.se/record/aee3840b-06ee-4e2d-8b50-65f2c0d66b92)
- **Nystrup (2014, DTU thesis), "Regime-Based Asset Allocation: Do Profitable Strategies Exist?"** A two-state Gaussian HMM with adaptive estimation beats a rebalancing strategy OOS after transaction costs, with no future knowledge and a realistic delay. — [DTU](https://www2.imm.dtu.dk/pubdb/pubs/6808-full.html)
- **Shu, Yu & Mulvey (2024), statistical jump models vs HMMs, OOS.** They cite the accuracy-versus-latency trade-off in regime-switching strategies; jump models are proposed to reduce whipsaw from regime persistence. — [arXiv 2402.05272](https://www.arxiv.org/pdf/2402.05272)

### Inferences
- The recurring OOS benefit is drawdown and loss avoidance, not higher average return. This matches Kritzman et al.'s framing ("investors averse to large losses").
- The **latency problem** is central. Smoothed (after-the-fact) regime probabilities look far cleaner than filtered (real-time) ones. Practical work adds persistence or trading penalties (Nystrup) or jump penalties (Shu et al.) to trade detection speed against whipsaw.

### Gaps
- Specific OOS performance numbers for Kritzman/Page/Turkington and Nystrup et al. (Sharpe, drawdown, turnover) were not retrieved.
- Ang & Bekaert (2002 RFS / 2004 FAJ "How Regimes Affect Asset Allocation") and Guidolin & Timmermann (2007 JEDC, "Asset allocation under multivariate regime switching") were not fetched. From background knowledge (unverified here): Ang & Bekaert find regime-switching allocations add value mainly through moving into cash/bonds in high-volatility, high-correlation bear regimes, with modest OOS gains. Guidolin & Timmermann find four regimes (crash, slow growth, bull, recovery) and large IS economic value. Neither number set is confirmed.
- No quantitative source found comparing filtered vs smoothed regime classification accuracy.

## 3. Trend / time-series momentum as a regime signal, and trend + volatility combinations

### Takeaway
Long-sample trend evidence is strong in simulation (1880–2016, positive in every decade, good in about 8 of 10 major crises). Trend filters on equities (Faber 10-month SMA, Clare et al.) mainly cut drawdowns rather than raise returns. Two qualifications: the statistical case for TSM predictability is contested (Huang et al. 2020), and trend is weakest at turning points, which blending fast and slow signals partly fixes (Goulding, Harvey & Mazzoleni 2023). Macro-conditioned trend (growth-trend timing) cuts whipsaw in backtests but relies on the recession-unemployment link holding.

### Cited Findings
- **Hurst, Ooi & Pedersen (2017, JPM), "A Century of Evidence on Trend-Following Investing".**
  - Universe: monthly returns for 67 markets in 4 asset classes, January 1880–December 2016 (an earlier AQR draft ends in 2013).
  - Results are simulated. TSM was positive in every decade since 1880, with low correlation to traditional assets.
  - It performed well in 8 of the 10 largest crisis periods. The authors warn of significant losses at trend reversals.
  — [AQR](https://www.aqr.com/Insights/Research/Journal-Article/A-Century-of-Evidence-on-Trend-Following-Investing); [PDF](https://fairmodel.econ.yale.edu/ec439/hurst.pdf)
- **Huang, Li, Wang & Zhou (2020, JFE 135(3):774–794), "Time series momentum: Is it there?"**
  - Asset-by-asset regressions show little TSM evidence, IS or OOS.
  - The large pooled-regression t-statistics fail bootstrap critical values. The upward bias comes from cross-asset differences in mean returns and from volatility scaling when fixed effects are omitted.
  - A TSM strategy performs about the same as one based on historical sample means, which requires no predictability.
  — [RePEc](https://econpapers.repec.org/RePEc:eee:jfinec:v:135:y:2020:i:3:p:774-794); [core.ac.uk](https://core.ac.uk/download/287750773.pdf)
  - Counterpoint: practitioner replications find the pooled results fairly robust. — [Alpha Architect](https://alphaarchitect.com/are-trend-following-and-time-series-momentum-research-results-robust/)
- **Goulding, Harvey & Mazzoleni (2023, JFE 149(3):378–406), "Momentum Turning Points".**
  - Slow and fast TSM define four states: Bull (both ≥0), Correction (slow ≥0, fast <0), Bear (both <0) and Rebound (slow <0, fast ≥0).
  - Intermediate-speed blends turn the predictive information in these cycles into positive unconditional alpha. Per secondary summaries, they have higher Sharpe ratios than the average of slow and fast. A dynamic blend gives only modest gains over the best static blend.
  — [RePEc](https://econpapers.repec.org/RePEc:eee:jfinec:v:149:y:2023:i:3:p:378-406); [arXiv](https://arxiv.org/pdf/2105.13727v2.pdf)
- **Faber, "A Quantitative Approach to Tactical Asset Allocation" (2007; later revisions), 10-month SMA.**
  - The abstract claims "equity-like returns with bond-like volatility and drawdown". The rule was also tested OOS on four extra markets.
  - A secondary summary puts the S&P-only timing rule's maximum drawdown near −50% (−49.98%), with a worst year of −26.69%.
  - A secondary source cites about a 12% loss limit for GTAA5; not verified.
  — [SSRN 962461 (Scribd copy)](https://www.scribd.com/doc/116881446/SSRN-id962461); [TradingView GTAA5 description](https://www.tradingview.com/script/pFE8Udyy-Mebane-Faber-GTAA-5)
- **Clare, Seaton, Smith & Thomas (2016, J. Behavioral & Experimental Finance 9:63–80), "The Trend is Our Friend".**
  - Universe: global equities, bonds, commodities and REITs.
  - Trend following substantially improves risk-adjusted returns over buy-and-hold and beats risk parity, which "adds little to performance within asset classes".
  - Combining relative momentum with trend keeps momentum-level returns with much lower volatility and drawdowns. Ranking 95 markets by volatility-weighted momentum gives consistent risk-adjusted returns.
  — [City Research Online](https://openaccess.city.ac.uk/id/eprint/17841/); [RePEc](https://econpapers.repec.org/RePEc:eee:beexfi:v:9:y:2016:i:c:p:63-80)
- **Philosophical Economics, "growth-trend timing" (c. 2016).**
  - The rule exits equities only when the price trend is negative (total return below its 10-month MA) *and* the unemployment trend is negative (unemployment above its 12-month MA).
  - Reported 1930–2016 backtest: beat buy-and-hold in absolute and relative terms.
  - Later commentators note it is not meant to avoid ordinary 10–20% corrections. Its usefulness depends on rising unemployment continuing to precede recessions, which has been questioned recently.
  — [Philosophical Economics](https://www.philosophicaleconomics.com/?p=7644); [CXO Advisory](https://www.cxoadvisory.com/economic-indicators/combine-market-trend-and-economic-trend-signals/); [Schwoerer Substack](https://martinschwoerer.substack.com/p/is-the-perfect-indicator-useful-once)
- **Trend and volatility interact.** Harvey et al. (2018) show volatility scaling of risk assets embeds momentum via the leverage effect. — [Quantpedia](https://quantpedia.com/the-impact-of-volatility-targeting-on-equities-bonds-commodities-and-currencies)
- Huang et al. also show volatility scaling inflates pooled TSM t-stats, so "vol-scaled trend" results partly mix the two effects. — [core.ac.uk](https://core.ac.uk/download/287750773.pdf)

### Inferences
- For a stocks/bonds/cash allocator, trend filters behave like insurance: lower maximum drawdown and left tail, with frequent small whipsaw costs. The single-asset S&P version still shows about a 50% drawdown in some tests, so "bond-like drawdowns" applies to the diversified multi-asset GTAA versions, not to every implementation.
- Blending speeds (fast + slow) and macro conditioning (growth-trend) are both responses to the same weakness: false signals at V-shaped reversals (e.g. 2020).

### Gaps
- Post-2016 live or OOS performance of Hurst-Ooi-Pedersen-style trend was not retrieved. Background knowledge (unverified here): managed-futures and trend indices had a weak 2010s, then strong 2022.
- No verified updated Faber GTAA results after publication.
- Clare et al.'s exact Sharpe and drawdown figures were not retrieved.

## 4. Implied volatility, the VIX term structure and the variance risk premium as equity-timing signals

### Takeaway
The most robust implied-volatility predictor of equity returns is the **variance risk premium** (implied minus realized variance; Bollerslev, Tauchen & Zhou 2009), which predicts positively at about quarterly horizons post-1990. The VIX level or volatility itself predicts returns much less reliably. VIX term-structure signals are one-sided (inversion has some contrarian or stress content; contango has none), and OOS replications of term-structure trading strategies show decay.

### Cited Findings
- **Bollerslev, Tauchen & Zhou (2009, RFS 22(11):4463–4492).**
  - The variance risk premium (model-free implied variance minus high-frequency realized variance) explains a non-trivial share of post-1990 aggregate return variation.
  - High VRP predicts high returns; predictability peaks at quarterly horizons and dominates other popular predictors.
  — [RePEc](https://econpapers.repec.org/RePEc:oup:rfinst:v:22:y:2009:i:11:p:4463-4492); [SSRN](https://papers.ssrn.com/abstract=948309)
  - Bollerslev, Marrone, Xu & Zhou find the predictability is not a finite-sample artefact of overlapping regressions, and a global VRP predicts returns across countries. — [Fed FEDS 2011-52](https://www.federalreserve.gov/Pubs/feds/2011/201152/201152pap.pdf)
- **Fassas & Hourvouliades (2018), VIX futures term structure.** A negatively sloped (backwardated) structure works as a *contrarian* equity timing indicator (an oversold signal). The positive-slope (contango) coefficient was not significant. — [Macrosynergy summary](https://macrosynergy.com/?p=41000)
- **Simon & Campasano, VIX futures basis (sample 2007–2011).**
  - The strategy sells VIX futures in contango and buys in backwardation. The authors report robustness to costs, OOS hedge ratios and split samples.
  - Quantpedia's later replication shows slightly negative OOS performance and "deteriorating" alpha.
  — [Quantpedia](https://quantpedia.com/strategies/exploiting-term-structure-of-vix-futures)
- **Practitioner VIX/VIX3M > 1 signal.** It flags concentrated near-term stress but does not mark market lows. Not peer-reviewed; limited sample. — [CMT Association](https://content.cmtassociation.org/a/deriving-market-signals-from-term-structure-of-vix)

### Inferences
- VIX futures data begins in 2004 and VIX3M (VXV) in about 2007, so term-structure signals have only one or two full cycles of history. That makes OOS claims fragile.
- High-VIX states have been followed by *higher* subsequent returns (the VRP mechanism). A rule that de-risks purely on a high VIX level can therefore sell into the highest expected-return states.
- The 1990s are a key era test: volatility rose through 1997–2000 while equities kept rallying. Volatility-based de-risking would have given up a large part of the late-1990s bull market. No quantitative source on this was retrieved here, so it is an inference only.

### Gaps
- No verified OOS R² for VRP prediction. Background knowledge (unverified): later papers find VRP predictability weaker or concentrated in particular sub-periods.
- No peer-reviewed study found that quantifies VIX-based equity timing across the 1990s high-vol bull market vs 2004+.
- Fassas & Hourvouliades' journal and sample period were not confirmed (secondary summary only).

## 5. Size of the benefit: drawdown vs return/Sharpe, equal-risk comparisons, post-publication decay

### Takeaway
The evidence consistently supports **drawdown and left-tail reduction** and only **modest, unreliable Sharpe improvement** once comparisons are made in real time, at equal risk and net of costs. Headline IS gains (e.g. Moreira & Muir's +25% market Sharpe, 4.9% alpha) shrink sharply or vanish OOS. Factor-level gains do not survive costs. Volatility targeting adds little Sharpe for bonds, FX or commodities.

### Cited Findings
- **Sharpe/alpha gains are mostly IS.**
  - Moreira & Muir: 4.9% alpha and +25% Sharpe for the market (IS). — [NBER](https://www.nber.org/papers/w22208)
  - Cederburg et al.: only 8 of 103 strategies have significantly higher Sharpe; OOS combinations are worse for 72 of 103. — [RePEc](https://econpapers.repec.org/RePEc:eee:jfinec:v:138:y:2020:i:1:p:95-117)
  - Barroso & Detzel: lower Sharpe after costs for non-market factors. — [RePEc](https://econpapers.repec.org/RePEc:eee:jfinec:v:140:y:2021:i:3:p:744-767)
- **Equal-risk comparisons matter.**
  - Matching full-sample volatility embeds look-ahead (Cederburg et al.).
  - Real-time calibration raises the volatility-managed market's maximum drawdown to 68–93%, vs 56% for the biased version and about 50% for the market. — [WUSTL](https://profiles.wustl.edu/en/publications/volatility-managed-portfolio-does-it-really-work/)
- **Tail and drawdown benefit is robust for risk assets.**
  - Harvey et al.: fewer extreme returns across 60+ assets; lower maximum drawdowns for 60/40 and risk parity; equity vol-of-vol 4.6% → 1.8%. — [Quantpedia](https://quantpedia.com/the-impact-of-volatility-targeting-on-equities-bonds-commodities-and-currencies)
  - Bongaerts et al.: conditional targeting cuts drawdowns and tail risk with lower turnover; conventional targeting can raise drawdowns. — [CFA Institute](https://rpc.cfainstitute.org/research/financial-analysts-journal/2020/conditional-volatility-targeting)
- **Regime and trend dynamic strategies help mainly the loss-averse.** Kritzman et al. (2012): the OOS advantage is "especially pronounced" for investors averse to large losses. — [CFA Institute](https://rpc.cfainstitute.org/research/financial-analysts-journal/2012/regime-shifts-implications-for-dynamic-strategies-corrected)
- **Signs of decay or weakening.**
  - VIX term-structure basis strategy alpha is deteriorating OOS. — [Quantpedia](https://quantpedia.com/strategies/exploiting-term-structure-of-vix-futures)
  - The growth-trend unemployment signal is questioned in the recent cycle. — [Schwoerer Substack](https://martinschwoerer.substack.com/p/is-the-perfect-indicator-useful-once)
  - The volatility-managed market's outperformance is concentrated in the financial crisis (Liu, Tang & Zhou) and in high-sentiment periods (Barroso & Detzel).

### Inferences
- A defensible design hierarchy from this evidence:
  1. Volatility-target or de-risk the equity sleeve in *high*-volatility states, with leverage capped near 1x, for tail control.
  2. Use trend (ideally blended speeds) as a separate regime filter.
  3. Do not count on Sharpe gains above roughly 0.1 at equal risk.
  4. Always evaluate with real-time parameters and costs.
- Benefits are episodic: they concentrate in a few crises (2008, 2020, 2022). Short evaluation windows without such an episode will show underperformance, mainly from cash drag and whipsaw.

### Gaps
- No general post-publication decay study (e.g. McLean & Pontiff 2016, about a 58% post-publication decline in anomaly returns) was retrieved for these specific strategies. Background knowledge only.
- No verified meta-analysis giving an average OOS Sharpe gain from volatility targeting at equal risk.
