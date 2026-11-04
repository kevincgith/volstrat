# Sleeves vs composite score: signal-blend vs portfolio-blend, timing-rule ensembles, and volatility/VIX timing robustness

Scope note: research done 2026-11-04 by web search and fetch. Several primary PDFs (Fassas & Hourvouliades 2019, Ghayur et al. 2018, Hurst/Ooi/Pedersen) could not be fully read (paywall, 403, or no PDF text tool), so some numbers come from abstracts and from secondary summaries (Alpha Architect, CXO Advisory, Robeco, Newfound blog). Each is flagged where it applies.

## Q1. Integrated (composite-score) vs mixed (sleeve) multi-signal portfolios: what does the evidence say, and what transfers to time-series timing?

### Takeaway
The cross-sectional literature is split. AQR (Fitzgibbons et al.), Clarke/de Silva/Thorley (2016) and Bender & Wang (2016) favour integration, but Ghayur/Heaney/Platt (FAJ 2018) find that the winner depends on the level of active risk (portfolio blending wins at low-to-moderate tracking error, signal blending at high), and Leippold & Rüegg (EFM 2018) find no statistically robust advantage for integration once performance tests are done properly. The one benefit that holds up across studies is lower turnover through netting of opposing signals. The mechanism behind integration's edge is "signal disagreement" (a mix holds assets that one signal likes and another dislikes). In a time-series regime allocator that maps one composite score to five step portfolios, that mechanism plays out differently, because averaging sleeves there produces intermediate allocations rather than holding disliked assets.

### Cited Findings
- **AQR, Fitzgibbons, Friedman, Pomorski & Serban, "Long-Only Style Investing: Don't Just Mix, Integrate."** A mix builds separate single-style portfolios and combines them. An integrated portfolio first aggregates style rankings into one overall score per asset and builds from that score. The authors recommend that long-only factor investors integrate. — [AQR](https://www.aqr.com/insights/research/white-papers/long-only-style-investing)
  - Venue and date are reported inconsistently: AQR lists the *Journal of Portfolio Management*, a Swedroe Substack post says *Journal of Investing* (Winter 2017), CXO dates a version to June 2016, and AQR's page is dated 30 Nov 2017. — [AQR](https://www.aqr.com/insights/research/white-papers/long-only-style-investing); [Swedroe Substack](https://larryswedroe.substack.com/p/the-integration-of-factors-advantage); [CXO Advisory](https://www.cxoadvisory.com/value-premium/integrating-momentum-and-value-stock-exposures)
  - Mechanism: a mixed portfolio can hold stocks with low or even negative expected returns because the styles disagree. — [CXO Advisory](https://www.cxoadvisory.com/value-premium/integrating-momentum-and-value-stock-exposures)
  - The integrated portfolio has roughly 5–10% lower annual turnover. Its advantage grows with (1) the number of styles combined, especially uncorrelated ones, and (2) the level of active risk. — [CXO Advisory](https://www.cxoadvisory.com/value-premium/integrating-momentum-and-value-stock-exposures)
  - Claim that integration added about 1% p.a. of excess return over cap-weight: secondary only and **unverified** against the paper. — [Swedroe Substack](https://larryswedroe.substack.com/p/the-integration-of-factors-advantage)
- **Ghayur, Heaney & Platt (GSAM), "Constructing Long-Only Multifactor Strategies: Portfolio Blending vs. Signal Blending," *FAJ* 74(3), 2018, pp. 70–85.** In global equity tests, portfolio blending gave higher information ratios at low-to-moderate tracking error, and signal blending won only at high tracking error. — [CFA Institute FAJ abstract](https://rpc.cfainstitute.org/research/financial-analysts-journal/2018/faj-v74-n3-5); [Alpha Architect summary](https://alphaarchitect.com/constructing-long-only-multifactor-strategies-portfolio-blending-vs-signal-blending/)
  - The CFA In Practice summary says the signal-blending advantage appears only at high factor exposure, which investors rarely use. — [CFA In Practice](https://rpc.cfainstitute.org/research/financial-analysts-journal/2018/ip-v3-n1-11-comparing-portfolio-blending)
- **Leippold & Rüegg, "The mixed vs the integrated approach to style investing: Much ado about nothing?" *European Financial Management* 24(5), 2018, pp. 829–855.** Using robust performance tests, they find no evidence favouring integration and call the earlier pro-integration results (Clarke et al. 2016; Bender & Wang 2016) a statistical fluke. Integration loads more on the low-risk anomaly. That lowers risk but does not improve performance. — [IDEAS/RePEc](https://ideas.repec.org/a/bla/eufman/v24y2018i5p829-855.html); [vLex](https://eu.vlex.com/vid/the-mixed-vs-the-855646895)
- **Robeco (Oct 2017) commentary.** Empirically there is little difference between integrated and mixed. In a frictionless world with unlimited leverage, construction would not matter. Transaction costs and leverage limits are what make it matter. Integration's claimed practical benefits are netting of transaction costs and a "moderate decrease in turnover." Sleeves are more transparent, easier to attribute, and suit tactical allocation between factors. — [Robeco](https://www.robeco.com/en-au/insights/2017/10/mixed-versus-integrated-multi-factor-portfolios)
- **Bender & Wang (2016), "Can the Whole Be More than the Sum of the Parts? Bottom-Up versus Top-Down Multifactor Portfolio Construction," *JPM* 42(5), pp. 39–50.** Pro-integration (bottom-up). I did not retrieve the abstract or numbers. — [bibliographic mention](https://sawyerinvestment.blogspot.com/2018/09/can-whole-be-more-than-sum-of-parts.html); characterised as pro-integration by [Leippold & Rüegg](https://ideas.repec.org/a/bla/eufman/v24y2018i5p829-855.html)
- **Research Affiliates** also published a piece on integrating vs mixing ("Food for Thought"). It was found but not read. — [RA PDF](https://www.researchaffiliates.com/content/dam/ra/publications/pdf/673-food-for-thought.pdf); [ETF.com](https://www.etf.com/sections/news/research-affiliates-food-thought-integrating-vs-mixing)

### Inferences
- **What transfers to time-series timing.** In the cross-section, integration's edge comes from avoiding assets that one signal likes and another dislikes, and from netting trades. In a time-series allocator, "signal disagreement" means one signal says risk-on while another says risk-off. A sleeve blend then holds, for example, 50% of the risk-on portfolio plus 50% of the risk-off portfolio. That is a de facto intermediate regime, not a portfolio full of bad assets. So the cross-sectional argument against mixing is much weaker here. In the time-series case, the main difference between the two approaches is the shape of the mapping from signals to exposure, not stock selection.
- **When the two approaches are identical.** If every sleeve maps its signal to weights *linearly* and the composite is a linear average of the signals, signal-blending and portfolio-blending give the same allocation. They differ only when the mapping is nonlinear, such as the step-function regimes in this system. The real question is therefore "step function of an average" versus "average of step functions." The second is smoother and has more effective states. The first concentrates bets near thresholds.
- **Turnover.** The netting benefit carries over. With a composite score, opposite moves in two signals can cancel before any trade happens. With sleeves, each sleeve trades and the trades net only if they execute together. In a single-account implementation where the sleeves are aggregated before trading, netting is the same under both approaches.
- **Active-risk analogue.** Ghayur et al.'s result (integration wins only at high tracking error) suggests a parallel. The more aggressive the regime portfolios are (wide spread between the most risk-on and most risk-off allocations), the more a sharp composite signal is worth. At moderate aggressiveness, blending sleeves may give a better risk-adjusted outcome. This is an analogy, not tested evidence.

### Gaps
- Could not access the full texts of Fitzgibbons et al., Ghayur et al. or Bender & Wang, so exact Sharpe, IR and drawdown numbers for each approach are missing.
- Clarke, de Silva & Thorley (2016) "Fundamentals of Efficient Factor Investing" (*FAJ*) is known to favour integration (cited as such by Leippold & Rüegg), but no source was retrieved for its specific numbers.
- Found no peer-reviewed study that directly compares a time-series composite-score regime allocator against blended timing sleeves on the same signals.

## Q2. Ensembles of trend/timing rules, rebalance timing luck, and tranching

### Takeaway
Newfound Research shows that the choice of rebalance date and parameters alone can create large performance dispersion between otherwise identical strategies (more than 400bp a year on average between the best and worst rebalance day in a monthly multi-asset momentum test, and calendar-year gaps above 40% in a factor-index replication). Ensembles across lookbacks, signal types and rebalance days, plus tranching, cut this dispersion roughly by 1/N. The practitioner evidence frames the benefit as removing luck (risk reduction), not adding expected return. Goulding, Harvey & Mazzoleni (JFE 2023) is the main peer-reviewed result where blending slow and fast signals produces *positive unconditional alpha*, which is evidence that blending can sometimes add return.

### Cited Findings
- **Hoffstein, Sibears & Faber, "Rebalance Timing Luck: The Difference Between Hired and Fired," *Journal of Index Investing*** (SSRN circa Oct 2018; library record lists 2019). Timing luck is defined as the standard deviation of returns across identically managed portfolios that rebalance on different dates. Spreading capital equally across N staggered sub-indexes cuts timing luck by a factor of about 1/N. In a factor-index replication, one strategy showed calendar-year return differences above 40% purely from the rebalance schedule. For a 60/40 portfolio, timing luck is more of a tail effect than a constant risk. Timing luck rises with concentration and falls with more frequent rebalancing. — [Newfound paper page](https://www.thinknewfound.com/rebalance-timing-luck); [CXO Advisory](https://www.cxoadvisory.com/calendar-effects/rebalance-timing-noise/); [EconBiz record](https://econbiz.de/Record/rebalance-timing-luck-the-difference-between-hired-and-fired-hoffstein-corey/10012894515)
  - Newfound's paper reports factor-index timing-luck impacts that often exceed 100bp annualised. — [Newfound blog tag/summary](https://blog.thinknewfound.com/tag/timing-luck/)
- **Newfound, "Ensemble Multi-Asset Momentum" (22 Jul 2019).** One monthly momentum model run on 21 different rebalance days produced:
  - annualised returns of 4.7%–5.5%
  - Sharpe ratios of 0.6–0.9
  - maximum drawdowns of 9.9%–20.8%
  - an average yearly spread of more than 400bp between the worst and best rebalance day

  The ensemble covers more than 500 specifications: three momentum signal types (total return, price vs moving average, MA crossover), lookbacks of 3–15 months, and rebalance day. Its Sharpe ranked in the top quartile of specifications and its maximum drawdown in the best quartile. The article frames this as giving up the chance of good luck in order to avoid bad luck, not as added return. — [Newfound blog](https://blog.thinknewfound.com/2019/07/ensemble-multi-asset-momentum/)
- **Newfound U.S. Trend Equity Index.** It averages the allocations of three trend models. Each model runs across 120 formation periods (120–240 trading days), and all 360 resulting allocations are averaged. The index rebalances on a staggered daily schedule, and a one-month tranching process dollar-cost-averages signal changes over a month. Newfound describes the result as cutting risk "a little but frequently" rather than all at once. — [Newfound index page](https://www.thinknewfound.com/newfound-research-us-trend-equity-index); [Advisor Analyst repost](https://advisoranalyst.com/?p=128230)
- **Newfound on binary signals and specification risk.**
  - Binary positioning can make a small price change trigger a large portfolio change, implying a certainty the signal does not have.
  - The lookback choice is somewhat arbitrary: a 200-day signal can switch off while a 195-day one does not.
  - Fast systems showed convexity over 1-month horizons and slow systems over 1-year horizons.
  - Fast models captured shallow (~20%) but quick (<6 month) drawdowns. 10% drawdowns were hard for any trend model to capture.

  — [Newfound "Speed Limit of Trend" (Apr 2019)](https://blog.thinknewfound.com/2019/04/the-speed-limit-of-trend/); [Advisor Analyst "What the Trend"](https://advisoranalyst.com/?p=127880)
- **Hoffstein's original 2013 post** argued that staggering rebalance timing removes the "luck of the timing". Newfound's models rebalanced weekly across four monthly tranches. — [Newfound 2013](https://blog.thinknewfound.com/2013/08/the-luck-of-the-rebalance-timing/)
- **Goulding, Harvey & Mazzoleni, "Momentum Turning Points," *JFE* 149(3), 2023, pp. 378–406.**
  - Slow signals risk Type II errors (missing a turning point) and fast signals risk Type I errors (reacting to noise).
  - Slow and fast signals together classify four market states: Bull, Correction, Bear and Rebound.
  - "Intermediate-speed" portfolios, formed by blending slow and fast strategies, turn the predictive information in those states into *positive unconditional alpha*, and the paper offers a decomposition of it.
  - A secondary claim that intermediate-speed strategies have a higher Sharpe than either slow or fast alone is **not verified** against the paper.

  — [EconPapers record](https://econpapers.repec.org/RePEc:eee:jfinec:v:149:y:2023:i:3:p:378-406); [blog summary](https://mrzepczynski.blogspot.com/2020/06/momentum-and-turning-points-working.html)
- **Hurst, Ooi & Pedersen, "A Century of Evidence on Trend-Following Investing" (AQR).** They use an equal-weighted combination of 1-, 3- and 12-month time-series momentum signals across 67 markets since 1880. The strategy was positive in every decade, with an average Sharpe of about 0.4 after 2/20 fees (secondary summary). A 20% allocation to TSMOM raised a 60/40 portfolio's Sharpe from 0.39 to 0.55 and cut the maximum drawdown from −62.3% to −50.2% (secondary summary). The paper does not appear to isolate the gain from the combination versus a single lookback. — [AQR paper copy](https://www.TrendFollowing.com/whitepaper/Century_Evidence_Trend_Following.pdf); [CXO Advisory](https://www.cxoadvisory.com/momentum-investing/trend-following-with-intrinsic-momentum-over-the-very-long-run); [Alpha Architect](https://alphaarchitect.com/trend-following-is-everywhere/)
- **Blending tactical strategies (Allocate Smartly-style meta-strategy).**
  - Found no published quantitative Allocate Smartly backtest of a combined meta-strategy.
  - The closest academic example is Gupta & Skallsjo (2013), which diversifies across five types of TAA strategy. CXO says this may improve risk-adjusted returns, but the sample (Sep 2000–Sep 2012) is too short for reliable inference. — [CXO Advisory](https://www.cxoadvisory.com/strategic-allocation/diversifying-across-tactical-asset-allocation-strategies/)
  - Allocate Smartly's Feb 2026 post (over 100 published TAA strategies) argues that monitoring where timing gains come from matters more than diversification alone. Only a teaser was seen. — [pulse.bot repost](https://www.pulse.bot/stock-trading/news/why-taa-is-performing-well-now-outperformance-attribution-e6a9a396-10e3-4333-a41c-9ee43923f9cb/)
  - AQR's "Tactical Tilts and Foregone Diversification" notes that tactical tilts give up some diversification, and the cost is larger when assets have low correlation. — [AQR](https://www.aqr.com/Insights/Research/White-Papers/Tactical-Tilts-and-Foregone-Diversification)

### Inferences
- **When does averaging step-function allocations add return rather than only reduce risk?** This is my own reasoning; I found no formal paper on it.
  - Let w(s) be the regime weight as a function of the score s, and let s_hat be a noisy estimate of the true state s.
  - Expected return is E[w(s_hat)·r]. Averaging K step functions with jittered thresholds or lookbacks approximates a *smoothed* w, roughly the step convolved with the threshold distribution.
  - By Jensen's inequality, smoothing does not raise expected return when the true conditional premium is itself a step in s and the thresholds are correctly placed. In that case averaging only cuts variance and path dependence.
  - Averaging *does* add expected return in three cases. (a) Threshold estimates are noisy or overfit: the true optimal breakpoint is unknown, and the average is more robust to misplacement. (b) The true premium is smooth or monotone in the score, not a step, so a smoothed w(s) is closer to the optimal linear or "Kelly-like" exposure. (c) Different speeds or signals carry partly independent information, as in Goulding et al., where the blend creates new states (Correction, Rebound) that neither signal identifies alone.
  - Averaging also reduces turnover and whipsaw cost near thresholds, which is a net-return gain even when the gross gain is zero.
- **Rebalance-luck multiplier.** Five discrete regimes give a highly concentrated payoff: a small score move near a cutoff shifts the whole allocation. So timing and threshold luck should be *larger* than in a diversified factor index. That is the case where Newfound reports the biggest dispersion: concentrated portfolios and infrequent rebalancing.
- **Tranching** (for example, splitting capital into 4 weekly tranches or using a 5–20 day moving average of the score) is the cheapest fix. It approximates averaging over rebalance dates without changing the signal.

### Gaps
- Found no formal academic paper that proves an expected-return gain from averaging step-function allocations. The Jensen's-inequality argument above is my own reasoning.
- No primary numbers on how much the 1/3/12 combination improves on a single lookback in Hurst/Ooi/Pedersen.
- Clare et al. (trend-following work on multi-asset portfolios, Cass/City) was not retrieved.
- No quantitative Allocate Smartly meta-strategy results were found.

## Q3. Robustness of volatility-managed and VIX term-structure/VRP timing signals for equity allocation

### Takeaway
Volatility management looks strong in-sample (Moreira & Muir 2017: 4.9% alpha on the market and a 25% Sharpe uplift). Implemented in real time, it beats buy-and-hold on Sharpe in only about half of 103 strategies (Cederburg et al. 2020, JFE), because the spanning regressions are unstable. VIX-futures-basis evidence (Simon & Campasano) shows that the basis predicts *VIX futures returns* (a risk premium), not spot-VIX changes. Fassas & Hourvouliades (2019) find that the term-structure slope has contrarian equity-timing value mainly when the curve is *inverted* (backwardation is a buying signal), with no useful signal in normal contango. That cuts against using backwardation simply as a "risk-off" input.

### Cited Findings
- **Moreira & Muir, "Volatility-Managed Portfolios," *Journal of Finance* 72(4), 2017, pp. 1611–1644.** Scaling exposure by the inverse of lagged variance gives the market portfolio a 4.9% annual alpha, an appraisal ratio of 0.33, and a 25% higher Sharpe than buy-and-hold. The mechanism is that changes in volatility are not matched by proportional changes in expected returns. — [Published PDF (author site)](https://amoreira2.github.io/alan-moreira.github.io/VolPortfolios_published.pdf); [NBER w22208](https://www.nber.org/papers/w22208)
  - A secondary source cites Sharpe gains of 50–100%. These appear to refer to the factor set, not the market alone, and are not verified. — [AI-CIO](https://www.ai-cio.com/?p=5570)
- **Cederburg, O'Doherty, Wang & Yan, "On the Performance of Volatility-Managed Portfolios," *JFE* 138(1), 2020, pp. 95–117.**
  - Across 103 equity strategies they confirm the in-sample spanning alphas.
  - Real-time implementations generally earn lower certainty-equivalent returns and Sharpe ratios than the unmanaged portfolios.
  - Volatility-managed versions have a higher gross Sharpe for only 53 of 103 strategies.
  - Out-of-sample mean-variance combinations that include the managed version give *lower* Sharpe and CER for 72 of 103.
  - The cause is structural instability in the spanning regressions.
  - Exceptions where volatility management held up: momentum (MOM), ROE and BAB (secondary summary).
  - Results are gross of costs, so frictions would hurt further.

  — [Lehigh PDF](https://www.lehigh.edu/~xuy219/research/COWY.pdf); [EconPapers](https://econpapers.repec.org/RePEc:eee:jfinec:v:138:y:2020:i:1:p:95-117); [Alpha Architect](https://alphaarchitect.com/does-portfolio-timing-based-on-volatility-signals-outperform-buy-and-hold/); [CXO Advisory](https://www.cxoadvisory.com/volatility-effects/does-volatility-management-work-for-equity-factor-portfolios/)
- **Simon & Campasano, "The VIX Futures Basis: Evidence and Trading Strategies"** (2012/2014, *Journal of Derivatives*; EFMA 2013 version).
  - The basis has no significant power to forecast changes in spot VIX (2006–2011) but does forecast VIX futures returns. The authors read it as a harvestable risk premium, not information about mean reversion.
  - Strategy: short the nearest VIX future with at least 10 trading days to expiry when in contango with a daily roll above 0.10 points (go long in backwardation with a roll below −0.10), hold 5 days, and hedge with mini S&P futures.
  - The strategy is reported as profitable and robust to transaction costs and to out-of-sample hedge ratios.
  - Stop-loss and take-gain rules *hurt* performance. A dynamic exit (close when the entry rationale lapses) helps long but not short trades.

  — [EFMA 2013 paper](https://www.efmaefm.org/0EFMAMEETINGS/EFMA%20ANNUAL%20MEETINGS/2013-Reading/papers/EFMA2013_0164_fullpaper.pdf); [CXO Advisory](https://www.cxoadvisory.com/volatility-effects/timing-and-hedging-the-roll-return-for-vix-futures/); [Quantpedia](https://quantpedia.com/strategies/exploiting-term-structure-of-vix-futures)
- **Fassas & Hourvouliades, "VIX Futures as a Market Timing Indicator," *JRFM* 12(3), 2019, article 113.** The VIX futures term structure carries more information about equity dynamics than spot VIX. A negative slope (backwardation) works as a *contrarian* market-timing indicator, meaning an inverted curve signals a possible buying opportunity. In contango (the normal state) there is no meaningful timing signal. The full text was not read, so the sample period and coefficients are not confirmed. — [MDPI](https://mdpi.com/1911-8074/12/3/113); [IDEAS](https://ideas.repec.org/a/gam/jjrfmx/v12y2019i3p113-d244838.html); [Macrosynergy summary](https://macrosynergy.com/?p=41000)

### Inferences
- **Direction conflict.** A risk-appetite composite that treats VIX backwardation as risk-off (cut equity) will, according to Fassas & Hourvouliades, often be selling at contrarian-bullish moments. Volatility targeting supports cutting exposure while volatility is high (Moreira & Muir), but its real-time edge is fragile (Cederburg et al.). Together these suggest the backwardation input should be (a) tested for sign and timing (is the benefit drawdown avoidance in the first days of a shock, or missed rebounds?) and (b) given a short holding window or a fast exit, in line with Simon & Campasano's finding that dynamic exits beat fixed stops.
- **The robust part of volatility timing is risk reduction, not alpha.** Out of sample, it reliably lowers volatility and tail exposure, but alpha and Sharpe gains are roughly a coin flip across strategies. A regime allocator should expect its VIX/vol inputs to mainly cut drawdowns, and should be judged on that.
- **Instability argues for ensembles here too.** Cederburg et al. blame unstable parameters. The fix that matches Q2 is to average several vol and term-structure definitions (VIX/VIX3M, VX1/VX2, realised-vol ratios, several lookbacks) instead of picking one threshold.

### Gaps
- Simon & Campasano's sample ends around 2012. No out-of-sample update covering 2018 (Volmageddon), 2020 or 2022 was found.
- Fassas & Hourvouliades' sample period and effect sizes were not retrieved (MDPI returned 403, and the PDF could not be parsed).
- Found no study of VRP-based (implied minus realised) equity *allocation* timing with out-of-sample tests in this session.

## Q4. Implications for a five-regime step-function allocator driven by a composite risk-appetite score, and practical tests worth running

### Takeaway
The evidence does not show that composite scores beat sleeves for time-series timing. It does show that discrete, single-parameter, single-rebalance-date rules carry large luck and specification risk. The practical prescription is to keep the composite (for transparency and netting) but break the step function: either jitter and average the thresholds, inputs and rebalance dates (an ensemble of regime maps), or blend the five regime portfolios in proportion to how close the score is to each cutoff. Then test which elements add return and which only reduce risk.

### Cited Findings
- Dispersion from rebalance date alone can exceed 400bp a year for a monthly concentrated timing model, and ensembles land in the top quartile of Sharpe and the best quartile of drawdown among their own components. — [Newfound 2019](https://blog.thinknewfound.com/2019/07/ensemble-multi-asset-momentum/)
- N staggered tranches cut timing luck by about 1/N, and concentration and low rebalance frequency increase it. — [Newfound/Hoffstein, Sibears & Faber](https://www.thinknewfound.com/rebalance-timing-luck)
- Blending slow and fast signals can create positive unconditional alpha by identifying intermediate states. — [Goulding, Harvey & Mazzoleni 2023](https://econpapers.repec.org/RePEc:eee:jfinec:v:149:y:2023:i:3:p:378-406)
- Proper statistical testing erased the claimed integrated-vs-mixed advantage in the cross-section, so robust comparison methods matter. — [Leippold & Rüegg 2018](https://ideas.repec.org/a/bla/eufman/v24y2018i5p829-855.html)
- Volatility-timing gains often vanish in real time because of parameter instability. — [Cederburg et al. 2020](https://www.lehigh.edu/~xuy219/research/COWY.pdf)

### Inferences (practical tests worth running)
1. **Threshold-jitter distribution.** Shift each regime cutoff by ±k score units (and each input's lookback by ±20–50%) over a grid. Plot the distribution of CAGR, Sharpe, MaxDD and turnover. If the live parameters sit in the top tail, that is evidence of overfit. Report the median, not the chosen spec.
2. **Rebalance-date luck.** Run the system on every possible offset (each weekday for weekly, each trading day of the month for monthly). Report the best-to-worst spread per year, following Newfound's method. Then test 2-, 4- and 5-tranche versions and confirm the dispersion falls roughly as 1/N.
3. **Composite vs sleeves, head-to-head.**
   - (A) Composite score → step map.
   - (B) Each signal → its own 5-regime step map → average the weights.
   - (C) Composite score → *linear or piecewise-linear interpolation* between regime portfolios.

   Compare CAGR, Sharpe, Sortino, MaxDD, turnover and cost-adjusted return. If C or B beats A on *return* (not only volatility), the threshold placement is noisy or the true premium is smooth (see the Jensen's-inequality argument in Q2).
4. **Return-vs-risk decomposition of the ensemble benefit.** Compare the ensemble's mean return with the average of its component means. If they are equal, the gain is pure diversification. If the ensemble beats the component average, net of turnover, the nonlinearity or information effect is real.
5. **Turnover and whipsaw near cutoffs.** Count regime flips that reverse within N days. Measure the cost per flip. Test a hysteresis band or score smoothing against the ensemble as alternative fixes.
6. **Leave-one-signal-out and sign stability.** Drop each input in turn, and run the system with each input's sign flipped. That is especially important for VIX term structure, given Fassas & Hourvouliades's contrarian finding.
7. **Real-time, expanding-window recalibration** (the Cederburg et al. design). Re-estimate any z-score normalisation, weights or cutoffs using only past data. Compare with the full-sample-calibrated version. The gap estimates look-ahead and overfit.
8. **Sub-period and event tests.** 2008, 2011, Feb 2018, Mar 2020, 2022, plus the 2024–2026 period. Check whether the regime map cut risk before or after the trough, and how much rebound was missed.
9. **Statistical comparison.** Use a Ledoit–Wolf/Jobson–Korkie Sharpe-difference test, or a block-bootstrap of the return differences, for A vs B vs C, as Leippold & Rüegg did. Do not conclude on point estimates alone.

### Gaps
- No direct empirical precedent was found for a 5-regime discrete allocator on a composite risk-appetite score. All transfers above come by analogy from cross-sectional factor work and trend-following studies.
- Effect sizes for "average of step functions" vs "step of average" in time-series allocation need to be estimated in the user's own backtest. No published numbers were found.
