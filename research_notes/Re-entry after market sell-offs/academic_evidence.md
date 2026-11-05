# Academic evidence on re-entering equities after volatility-driven sell-offs

Scope note: compiled 2026-11-05 under a ~17-tool-call budget. Several primary PDFs (MDPI, MIT DSpace, IBKR/Alpha Architect reposts) returned HTTP 403/429, so a number of findings rest on abstracts, bibliographic records or secondary summaries; this is flagged per item. "IS" = in-sample, "OOS" = out-of-sample. Nothing below has been checked against the user's own data.

## 1. Implied-volatility signals for bottoms (VIX term structure, VIX off its peak, variance risk premium)

### Takeaway
The peer-reviewed evidence that implied-volatility signals mark bottoms is thin and mostly in-sample. Fassas & Hourvouliades (2019) find that a backwardated VIX futures curve predicts positive subsequent S&P 500 returns, while contango carries no signal. Bollerslev-Tauchen-Zhou (2009) find that a high variance risk premium predicts higher returns up to about 6 months, with low R². I found no peer-reviewed out-of-sample test of a re-entry rule of the form "VIX/VIX3M crosses back below 1" or "VIX X% off its 20-day high". The signal most likely to fire before 21-day realised vol normalises is backwardation itself (a contrarian buy), not the return to contango.

### Cited Findings
- Fassas & Hourvouliades, "VIX Futures as a Market Timing Indicator", *Journal of Risk and Financial Management* 12(3):113 (2019). They test the slope of the VIX futures term structure as a contrarian timing indicator for the S&P 500. The coefficient on negative slope (backwardation) is negative and statistically significant in all specifications: an inverted curve is followed by positive S&P 500 returns. The contango coefficient is not significant. The authors read a downward-sloping curve as an indication of an oversold market. I could not retrieve the full text (HTTP 403), so the sample period, R² and any OOS test are unverified. — [MDPI](https://mdpi.com/1911-8074/12/3/113); [EconPapers record](https://econpapers.repec.org/RePEc:gam:jjrfmx:v:12:y:2019:i:3:p:113-:d:244838)
- **Implication for the user's design (supported by the same paper):** the significant signal is the inverted state, not the cross back into contango. A rule that waits for contango is waiting for a state the paper finds uninformative. — [MDPI](https://mdpi.com/1911-8074/12/3/113)
- **Non-peer-reviewed counter-evidence:** a FlashAlpha study of weekly data from 2018 to 2026 finds that inversion has almost no directional edge, with median forward returns nearly identical across states. Forward-return dispersion, however, rises about 60%. FlashAlpha recommends cutting position size during backwardation rather than trading its direction. — [FlashAlpha](https://flashalpha.com/articles/vix-term-structure-inversions-since-2018-data-study)
- **Non-peer-reviewed:** Eco3min reports that backwardation preceded 21 of 22 S&P 500 drawdowns of more than 5% over 2004–2025. This means backwardation coincides with sell-offs, which is not the same as marking their end. — [Eco3min](https://eco3min.fr/en/vix-backwardation-contango-volatility-term-structure/)
- **Low quality:** an unreviewed personal write-up tested a VIX vs VIX3M proxy over 2016–2025 (2,514 trading days). It found that inverted days were followed by *higher* SPY forward returns at every horizon, which it describes as a "mean-reversion / bounce effect". This is the direction of the contrarian buy thesis. — [personal write-up (low reliability)](https://agent-jay-ser5.tail14ee01.ts.net/docs/vix-monitors/vx3-vx1-mcmillan.html)
- **Qualitative only:** a TradingView note says the VIX/VIX3M ratio exceeds 1.0 typically when an SPX sell-off spikes VIX relative to VIX3M. It also observes that ratio highs at market lows have been lower than earlier highs, i.e. the peak ratio did not coincide with the price low. — [TradingView](https://my.tradingview.com/chart/SPX/dk0xiJMy-VIX-VIX3M-Tricks-for-Reading-the-VIX-Part-II)
- **Capitulation is not required for bottoms:** SentimenTrader argues that many bottoms were not accompanied by capitulation, so it is not a necessary condition. — [SentimenTrader](https://sentimentrader.com/blog/no-capitulation-no-breadth-thrust)
- Bollerslev, Tauchen & Zhou, "Expected Stock Returns and Variance Risk Premia", *Review of Financial Studies* 22(11):4463–4492 (2009). The variance risk premium (model-free implied variance minus realised variance) explains a nontrivial fraction of post-1990 aggregate stock return variation, and high premia predict high future returns (IS, sample starting 1990). — [EconPapers](https://econpapers.repec.org/RePEc:oup:rfinst:v:22:y:2009:i:11:p:4463-4492)
- A later paper (Pyun) summarises BTZ as showing predictability up to 6 months ahead. A related Pyun poster notes that R² in such predictive regressions is extremely low. — [Pyun poster](https://sjpyun.github.io/Poster.pdf); [AEA paper](https://swlb1.aeaweb.org/conference/2017/preliminary/paper/GDde2yiy)
- Cheng, "The VIX Premium", *RFS* 32(1):180–227 (2019). The ex-ante VIX futures premium tends to fall or stay flat when ex-ante risk measures rise, and rises only later (the "low premium-bias"). — [EconPapers](https://econpapers.repec.org/RePEc:oup:rfinst:v:32:y:2019:i:1:p:180-227.); [OUP](https://academic.oup.com/rfs/article/32/1/180/5017289)
- A secondary source (Iscte dissertation) says the premium falls, may turn negative, and only then increases. — [Iscte repository](https://www.repositorio-iul.iscte.pt/handle/10071/24158?locale=en)
- **Implication of Cheng:** the "premium turns positive again" moment comes late in the sequence, so it is a lagging normalisation signal rather than an early one. This is an inference, not a tested re-entry rule. — [OUP](https://academic.oup.com/rfs/article/32/1/180/5017289)

### Inferences
- **What the evidence favours:** a contrarian rule keyed to backwardation itself (VIX > VIX3M, or VX1 > VX2), or to the VRP being extreme, has peer-reviewed in-sample support. Waiting for contango or VRP normalisation is closer to the user's current lagging realised-vol rule.
- **Why implied vol leads realised vol:** implied vol (VIX, about 30 calendar days forward) prices expected volatility. After a peak, VIX and the term structure normalise before 21-day realised vol does, because the realised window still holds the crash days for 21 trading days. Any implied-vol re-entry trigger will therefore mechanically lead the user's current trigger. This is a mechanical inference, not from a paper.
- **Effective sample size is small:** VIX futures exist only since 2004 and VIX3M (formerly VXV) since about 2007. US equity episodes with prolonged backwardation number roughly 4–8 (2008, 2010, 2011, 2015, Feb 2018, Q4 2018, 2020, 2022). These are my inference, not from a source; they should be counted in the user's own data.
- **Bigger structural problem:** the user's backtests start in 1927, so no implied-vol signal can be tested over that history. Any VIX-based re-entry rule is testable only on about 1990–2026 (VIX) or about 2004–2026 (futures), meaning it cannot satisfy a pre-1990 out-of-sample protocol.

### Gaps
- Fassas & Hourvouliades full text (sample period, R², horizons, any OOS test): blocked (403).
- Simon & Campasano (VIX futures basis, *Journal of Derivatives* 2014): not retrieved. My recollection is that it concerns predicting VIX futures returns from the basis, not equity returns. Unverified.
- Johnson (2017), "Risk premia and the VIX term structure" (*JFQA*): not retrieved, so no numbers.
- BTZ exact R² by horizon: not retrieved.
- No peer-reviewed OOS test was found for "VIX X% off 20-day high" or "VIX spike-and-fade" re-entry rules. Such rules appear only in practitioner blogs without methodology.

## 2. Time-series momentum turning points (fast/slow blend, Rebound state)

### Takeaway
Goulding, Harvey & Mazzoleni classify each month into Bull, Correction, Bear or Rebound by comparing slow (12-month) and fast (2–3-month) momentum, and blend the two speeds conditionally. This is the best-documented academic answer to "trend re-enters too late after V-shaped recoveries". The fast signal flips to long in the Rebound state well before slow trend does. Reported gains are moderate: 7.5% vs 9.4% annualised at 10% volatility over 30 years, gross of costs, on 55 markets from 1971 to 2019. The weights are estimated on expanding history (at least 48 months), but published versions do not clearly separate IS from OOS.

### Cited Findings
- **State definitions** (Garg, Goulding, Harvey & Mazzoleni, "Breaking Bad Trends" working paper). The slow signal is the average monthly excess return over a 12-month or longer lookback; the fast signal uses a 3-month or shorter lookback (the dynamic strategy uses 2 months).
  - Bull: both non-negative.
  - Correction: slow ≥ 0, fast < 0.
  - Bear: both < 0.
  - Rebound: slow < 0, fast ≥ 0.
  - A turning point is a month in which the two signals disagree (Correction or Rebound).

  — [CXO Advisory summary](https://www.cxoadvisory.com/?p=34159)
- **Breaking Bad Trends sample:** January 1971 to December 2019 on 55 futures, forwards and swaps markets: 12 equity indexes, 10 bond indexes, 24 commodities and 9 currency pairs. — [CXO Advisory](https://www.cxoadvisory.com/?p=34159)
- **Returns** (annualised gross average, volatility scaled to 10%):

  | Strategy | Last 30 years | Last 10 years |
  |---|---|---|
  | Conventional 12-month TSMOM | 7.5% | 1.8% |
  | Dynamic speed | 9.4% | 4.3% |

  — [CXO Advisory](https://www.cxoadvisory.com/?p=34159)
- **Turning points and momentum returns:** when an asset has six or more turning points per year, median 12-month momentum return is negative. Turning points have been more frequent in the most recent decade. — [CXO Advisory](https://www.cxoadvisory.com/?p=34159)
- **How the dynamic weights work:** if returns after Corrections have historically been positive, the strategy tilts away from FAST in Corrections. If returns after Rebounds have historically been positive, it tilts toward FAST in Rebounds. Weights are estimated from at least 48 months of history. — [Interactive Brokers / Alpha Architect repost (search snippet)](https://www.interactivebrokers.com/campus/?p=203508); [CXO Advisory](https://www.cxoadvisory.com/?p=34159)
- **Caveats** flagged by CXO: results are gross of costs and the dynamic version has higher turnover; Correction and Rebound subsamples are small; data-snooping risk; IS/OOS status is not explicitly labelled. — [CXO Advisory](https://www.cxoadvisory.com/?p=34159)
- **Published FAJ version:** Goulding, Harvey & Mazzoleni, "Breaking Bad Trends", *Financial Analysts Journal* 80(1):84–98 (2024), DOI 10.1080/0015198X.2023.2270084. It covers 43 futures markets across three asset classes. — [EconPapers](https://econpapers.repec.org/RePEc:taf:ufajxx:v:80:y:2024:i:1:p:84-98); [IBKR repost](https://www.interactivebrokers.com/campus/?p=203508)
- **US equity only:** a 2021 AEA conference deck (US data 1969–2018) shows Sharpe ratios of roughly 0.41–0.52 across static and dynamic speeds, with the dynamic about 0.52 against the best static about 0.51. The table was garbled in extraction, so this reading is uncertain. — [AEA 2021 slides](https://benny.aeaweb.org/conference/2021/preliminary/powerpoint/ihbRDkeH)
- **US equity blends:** the same research reports that, for US stocks, blended intermediate-speed strategies had higher Sharpe ratios, shallower drawdowns, more positive skewness and more significant alphas than pure slow or pure fast. — [IBKR / Alpha Architect](https://www.interactivebrokers.com/campus/?p=203508)
- Goulding, Harvey & Mazzoleni, "Momentum turning points", *Journal of Financial Economics* 149(3):378–406 (2023). Intermediate-speed portfolios that blend slow and fast momentum turn the predictive information in market cycles into positive unconditional alpha. — [EconPapers](https://econpapers.repec.org/RePEc:eee:jfinec:v:149:y:2023:i:3:p:378-406)
- A search summary of the JFE abstract says Bear-state steep declines "concentrate in high-risk states, yet predict negative expected returns". The exact wording is unverified. — [Duke Scholars record](https://scholars.duke.edu/publication/1586630)
- **Correction and Rebound states:** Alpha Architect's summary says both show deteriorating average returns and higher volatility, so trend inference is less reliable there; the strategy can shorten its lookback in those states. — [Alpha Architect](https://alphaarchitect.com/trendfollowing/)
- **Related ML evidence:** Wood, Roberts & Zohren, "Slow Momentum with Fast Reversion" (arXiv 2105.13727) add online changepoint detection to a deep momentum network over 1995–2020. Sharpe improves by about one-third overall and by about two-thirds over 2015–2020. This is a backtest of a complex model and is not directly transferable. — [arXiv](https://arxiv.org/abs/2105.13727)
- **Newfound Research recovery simulations:** Brownian-bridge simulations of V, U, W and L recoveries. In a shallow, fast V, both very fast and very slow trend signals cope: fast signals have already turned off and turn back on quickly, while very slow signals never turned off. Intermediate speeds suffer most. — [Newfound via AdvisorAnalyst, "A L-U-V-Wy Recovery"](https://advisoranalyst.com/?p=128173)
- **Newfound on 2020 and earlier V-bottoms:** in 2020, most trend models did not react significantly until early March, and results "varied significantly given your specific trend model implementation". Newfound calls 2009 and 2019 rapid V-bottom years. — [Newfound 2020 update](https://advisoranalyst.com/?p=128230); [Newfound 2019 letter](https://advisoranalyst.com/?p=126859)
- **Turnover cost:** trading costs hit fast trend systems harder than slow ones because of their higher turnover. — [Man Group summary via the7circles](https://the7circles.uk/?p=40438)

### Inferences
- **Mapping to the user's strategy:** the user halves exposure below the 200-day average, which is a slow signal. The GHM framework implies adding a fast price signal (for example, the 2-month return turning non-negative while price is still below the 200-day) to define a Rebound state and restore some exposure there. In March–May 2020 the 2-month S&P return turned positive well before 21-day vol fell below 25%; the user should verify exact dates in their own data.
- **Sign check before using it:** GHM's dynamic weights use the historically estimated sign of post-Rebound returns, so the Rebound tilt is data-driven rather than assumed. Because the evidence on Rebound-state equity returns is mixed (higher volatility, less reliable trend), the user should check the sign in their 1927–1989 sample before adopting a FAST tilt.
- **Size of the edge:** reported gains are modest (+1.9 pp per year at 10% vol over 30 years, gross) and the US equity Sharpe difference is small (about 0.52 vs 0.51). The benefit is mostly smaller drawdowns and better skew, not large return gains.

### Gaps
- Exact Sharpe ratios, t-stats and net-of-cost results from the FAJ 2024 and JFE 2023 papers: full texts not retrieved.
- Number of Rebound-state months in US equities: not found.
- Whether GHM run a true holdout OOS test (rather than expanding-window estimation): not confirmed.

## 3. Volatility-managed portfolios and the momentum "rebound" effect after bear markets

### Takeaway
Daniel & Moskowitz (2016) document that momentum crashes cluster in "panic" states: after market declines, while volatility is high, and at the same time as sharp market rebounds. In other words, the market's largest up-moves arrive while volatility is still elevated, which is exactly when a realised-vol de-risking rule is out of the market. Volatility scaling (Moreira & Muir 2017) has positive in-sample alphas, but Cederburg et al. (2020) show that real-time out-of-sample versions across 103 strategies generally do not beat the unmanaged portfolio. Volatility-managed equity exposure does not re-enter faster than trend; it is mechanically tied to the same lagging realised-vol window.

### Cited Findings
- Daniel & Moskowitz, "Momentum Crashes", *Journal of Financial Economics* (2016), US data 1927–2013. Momentum crashes occur in panic states, following market declines and when market volatility is high, and are contemporaneous with market rebounds. — [NBER w20439](https://www.nber.org/papers/w20439); [NBER PDF](https://www.nber.org/system/files/working_papers/w20439/w20439.pdf)
- **Option-like behaviour:** in bear markets, momentum behaves like a written call on the market; it gains a little when the market falls and loses a lot when it rebounds. — [Chicago Booth Review](https://www.chicagobooth.edu/review/understanding-momentum-crashes)
- **Loser betas:** after major declines, past-loser decile betas can exceed 3. — [ETF.com / Swedroe](https://www.etf.com/sections/index-investor-corner/swedroe-downside-momentum)
- **Crashes are partly forecastable:** a dynamic strategy that cuts momentum exposure when volatility is high significantly outperforms static momentum. — [NBER](https://www.nber.org/papers/w20439)
- **Variance hedging is not a full fix:** buying variance swaps in bear markets does not restore momentum profitability. — [NBER PDF](https://www.nber.org/system/files/working_papers/w20439/w20439.pdf)
- **Moreira & Muir alphas confirmed in-sample:** volatility-managed portfolios show significantly positive alphas in spanning regressions, consistent with Moreira & Muir (2017). — [Cederburg et al. PDF](https://www.lehigh.edu/~xuy219/research/COWY.pdf)
- Cederburg, O'Doherty, Wang & Yan (*JFE* 2020), 103 equity strategies:
  - Volatility-managed portfolios do not systematically beat their unmanaged counterparts in direct comparisons.
  - Real-time OOS implementations generally earn lower certainty-equivalent returns and Sharpe ratios than the unmanaged portfolios.
  - The cause is structural instability in the spanning regressions.

  — [Cederburg et al. PDF](https://www.lehigh.edu/~xuy219/research/COWY.pdf); [Alpha Architect summary](https://alphaarchitect.com/?p=59058)
- **Conditional multifactor version:** DeMiguel, Martin-Utrera & Uppal (*Journal of Finance* 79(6), 2024) report that a conditional multifactor volatility-managed portfolio beats its unconditional counterpart OOS and net of costs. — [EconPapers](https://econpapers.repec.org/RePEc:bla:jfinan:v:79:y:2024:i:6:p:3859-3891)

### Inferences
- **Why this matters for the user's rule:** the user's realised-vol cut is a form of volatility management of the market itself. Daniel & Moskowitz show that the biggest market rebounds arrive in high-volatility post-decline states, so any rule keyed to realised vol falling below a fixed threshold structurally misses the first leg of V-recoveries. This is the 2020 and 2009 pattern the user observed.
- **Re-entry speed of variance scaling:** Moreira-Muir-style continuous scaling (weight ∝ 1/σ²) re-enters gradually rather than via a binary threshold, so it adds some exposure earlier than a hard 25% cut-off. It still uses a backward-looking window. Shortening the window (for example to 5–10 days, or EWMA) or using implied vol speeds re-entry. This is an inference; I found no paper that measures re-entry lag directly.
- **Panic states as a buy signal:** Daniel & Moskowitz's panic-state indicator (prior 24-month market return negative and high recent market variance) predicts low momentum returns because the market tends to rebound. That suggests a "bear + high vol" state is one where expected market returns are high, not low. This is consistent with Moreira-Muir critics who note that the risk-return trade-off is weak precisely in crises.

### Gaps
- Moreira & Muir (2017) exact numbers: market alpha, Sharpe improvement and sample period (I believe 1926–2015, but this is unverified).
- Barroso & Santa-Clara (2015) numbers: not retrieved.
- No source directly measures how many days after a bottom vol-scaling re-enters versus trend.
- The Daniel & Moskowitz claim that the dynamic strategy "doubles the Sharpe ratio" is from my memory of the abstract and is not verified here.

## 4. Drawdown-control and stop-loss re-entry research (Kaminski & Lo; whipsaw)

### Takeaway
Kaminski & Lo (2014) show analytically that, under a random walk, 0/1 stop-loss rules always reduce expected return. When returns have momentum they can add value, and in US equities they appear to exploit conditional momentum after periods of losses. Re-entry rules have to be evaluated jointly with stop rules. A follow-up study finds that stop-loss plus re-entry rules improved risk-adjusted returns in secular bear markets but not in bull markets. I found no rigorous OOS evidence that capitulation-triggered re-entry rules improve Sharpe across many independent events.

### Cited Findings
- Kaminski & Lo, "When do stop-loss rules stop losses?", *Journal of Financial Markets* 18:234–254 (2014). Under the random walk hypothesis, simple 0/1 stop-loss rules always decrease a strategy's expected return. With momentum, they can add value. Empirically, the rules may exploit conditional momentum after periods of loss in equities. — [EconPapers](https://econpapers.repec.org/RePEc:eee:finmar:v:18:y:2014:i:c:p:234-254); [IDEAS](https://ideas.repec.org/p/hhs/sifrwp/0063.html); [MIT DSpace](https://dspace.mit.edu/handle/1721.1/114876)
- **Joint evaluation:** a later study notes that stop-losses can only be judged together with their re-entry rules. It found that stop-loss plus re-entry rules gave higher risk-adjusted returns during secular bear markets but not during bull markets. — [EU-OpenSci (EJBMR)](https://eu-opensci.org/index.php/ejbmr/article/view/51426)
- **Example re-entry rule:** a European study re-entered once the market rose at least 3% after a stop-out. — [EU-OpenSci (EJBMR)](https://eu-opensci.org/index.php/ejbmr/article/view/51426)
- **Dissent:** Vanstone (2008) argues that, despite Kaminski & Lo, there is no practical evidence such gains are achievable. — [Quant Investing blog](https://www.quant-investing.com/blog/truths-about-stop-losses-that-nobody-wants-to-believe)
- **Further discussion of re-entry after stop-outs:** — [The Idea Farm, "Stopped, then what?"](https://theideafarm.beehiiv.com/p/stopped-then-what); [BSIC](https://bsic.it/?p=11815)

### Inferences
- **Two levers:** Kaminski-Lo's framework has a stop threshold and a separate re-entry threshold (re-enter when the trailing return exceeds δ). Value comes from conditional momentum after losses. If post-crash returns show reversal (V-recoveries), a quick price-based re-entry threshold limits the damage of being out. So the user can shorten re-entry independently of exit, for example exit on high realised vol but re-enter on a price-based condition such as an X% rise off the low or a positive fast return.
- **Bear-only payoff:** the "works in secular bear markets, not bull markets" result implies that the cost of a faster re-entry is whipsaw in grinding bears (2000–2002, 2008 before October, 1929–1932, 1973–1974). These are the episodes the user's 1927–1989 holdout contains.

### Gaps
- Kaminski & Lo's exact numbers (stopping premium in bps per month, stop and re-entry parameters, 1950–2004 sample): PDF rate-limited (HTTP 429).
- Han, Zhou & Zhu (stop-loss momentum) and CPPI re-entry literature: not retrieved.
- **No study found** that tests "extreme oversold + volatility reversal" capitulation re-entry OOS with an explicit count of independent events. Practitioner claims (TradingView, SentimenTrader) lack methodology. Independent US equity capitulation events since 1927 number only about 10–20 (e.g. 1932, 1938, 1962, 1970, 1974, 1982, 1987, 1990, 1998, 2002, 2009, 2011, 2020, 2022). This list is my inference and must be counted in the user's data. Any rule fitted to them has very low statistical power.
