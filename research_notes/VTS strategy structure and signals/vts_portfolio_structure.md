# VTS (Volatility Trading Strategies) portfolio structure and signals

Research date: 2026-11-04. Almost all detail comes from VTS's own site (volatilitytradingstrategies.com, run by Brent Osachoff), so it is self-reported. The only third-party source I could read was one 2023 review (optionstradingiq.com) and its comments. The Bogleheads thread returned HTTP 403, so only a search snippet is available. Reddit, Elite Trader and X searches gave nothing usable. Many VTS pages put the key numbers (performance, holdings tables, the correlation matrix) in images, which my fetch tool could not read.

## 1. Which strategies VTS publishes: names, count, launch dates

### Takeaway
As of late 2026 VTS's core product is the "VTS Total Portfolio Solution." It is built from **3 tactical ETF strategies**: Tactical Volatility, Defensive Rotation and Strategic Tail Risk. On top of those sit an optional **Bitcoin Breakpoint** strategy and options education/strategies (Iron Condor, VXX/UVXY butterflies). The number of strategies in the bundle has changed over time: 4 at 25% each in 2022, 5 at 20% each in a 2023 review, and "3" now. VTS's own pages give different counts (3, 4 and 5) on different pages.

### Cited Findings
- The portfolio page says the "VTS Total Portfolio Solution" "utilizes all 3 of our strategies": (1) Tactical Volatility Strategy, (2) Defensive Rotation Strategy, (3) Strategic Tail Risk Strategy. Separately it lists (4) "Bitcoin Breakpoint Strategy (Optional)". The free-trial section of the same page says "all 5 tactical strategies", and the page does not reconcile the two counts. — [VTS Portfolio](https://www.volatilitytradingstrategies.com/portfolio)
- The subscribe page ($89/month or $849/year, 2-week free trial) advertises "All 4 tactical strategy trades" without naming them, plus courses (30-part Iron Condor, Volatility ETF Trading, UVXY Butterfly), a Volatility Data Spreadsheet, the VTS Volatility Dashboard and daily volatility ETF decay factors. — [VTS Subscribe](https://www.volatilitytradingstrategies.com/subscribe)
- The home page advertises a "Diversified Total Portfolio Solution" with "3 Tactical Strategies". Its course library lists Long/Short Volatility ETFs, Iron Condor Options, VXX/UVXY Butterfly Options and a Stock Replacement Strategy. — [VTS home](https://www.volatilitytradingstrategies.com/)
- The FAQ names Tactical Volatility, Defensive Rotation and Strategic Tail Risk as the "Tactical Rotation" strategies, which "all use highly liquid US based ETFs and we don't short anything or use any undefined risk options." — [VTS FAQ](https://www.volatilitytradingstrategies.com/faq)
- **Feb 16, 2022:** the Total Portfolio Solution (excluding VTS Options) "is made up of 4 strategies with equal 25% weighting." Each one is "an independent tactical strategy on its own." The four are not named in the readable text. Its asset universe included VXX/UVXY butterfly options. — [VTS blog, 5 Volatility Ranges (Feb 2022)](https://www.volatilitytradingstrategies.com/blog/article-635-5-volatility-ranges-and-our-expected-portfolio-allocations-during-each)
- **Aug 22, 2023 (third party, "Gavin"):** the review lists five strategies at 20% each: Strategic Tail Risk, Defensive Rotation, Tactical Volatility, a **Volatility Trend Strategy** (short vol through defined-risk structures "such as directional butterflies on VXX"), and an **Iron Condor Strategy** (15-delta, about 2 months to expiry, take profit at 50% of the credit, a mental stop of the same dollar amount, SPY, up to 3 condors layered). — [OptionsTradingIQ VTS Review](https://optionstradingiq.com/vts-review/)
- **Jan 22, 2024:** the correlation post names Defensive Rotation, Strategic Tail Risk, Iron Condor, Tactical Volatility, and the "Tactical ETF strategies (Defensive, Volatility, Strategic)" as making up the Total Portfolio Solution. — [VTS Correlation Matrix (Jan 2024)](https://www.volatilitytradingstrategies.com/blog/correlation-matrix-of-all-our-vts-strategies)
- **Aug 5, 2024:** VTS describes exactly three tactical strategies (tactical volatility, defensive rotation, strategic tail risk), each with an aggressive, a safety and a crisis position. — [VTS, Tactical Investing through Volatility Targeting](https://www.volatilitytradingstrategies.com/blog/tactical-investing-through-volatility-targeting)
- **Oct 30, 2026:** livestream "Ep.137 - My Bitcoin Breakpoint Strategy | Why Gold is our Safety position?" The portfolio page says the Bitcoin strategy uses volatility metrics to exit to a gold safety position before a crash. — [VTS blog index](https://www.volatilitytradingstrategies.com/blog); [VTS Portfolio](https://www.volatilitytradingstrategies.com/portfolio)

### Inferences
- The Volatility Trend (VXX butterfly) strategy that was in the bundle in 2023 has apparently been dropped from, or moved out of, the core Total Portfolio by 2024–2026. Iron Condor appears to be offered now mainly as a course or options add-on rather than a core sleeve. The "4 tactical strategies" on the subscribe page most likely means the 3 core strategies plus Bitcoin Breakpoint, but this is not confirmed.
- **The user's belief that there are "3 portfolios" is broadly correct for the current core product.** The detail is that the three are strategies inside one Total Portfolio, not three separate portfolios, and the bundle has held 4 or 5 sleeves in the past.

### Gaps
- I found no launch dates for any individual strategy. The Barometer's official inception is January 2011 (see section 4), but that is a backtest or data start, not a strategy launch date.
- I could not confirm exactly when the switch from 4 or 5 sleeves to 3 happened. It is somewhere between Aug 2023 and Aug 2024 based on the sources above.
- I found no public detail on how the Bitcoin Breakpoint strategy works: which BTC instrument, its thresholds, or its launch date.

## 2. What drives each strategy, what it trades, sizing, entry/exit and execution timing

### Takeaway
Each of the 3 core strategies rotates its whole sleeve through three states: an aggressive position, a safety position and a crisis position. Each runs off its own version of the VTS Volatility Barometer. Signals go out once a day by email before noon ET, and subscribers trade intraday at their own discretion. There is no stated rule to trade at the close or at the next open. Rules inside each strategy (exact thresholds and sizes) are mostly behind the paywall. The one public exception is the Defensive Rotation thresholds, published in Oct 2026.

### Cited Findings
**Defensive Rotation Strategy**
- Oct 15, 2026: it "uses the Volatility Barometer value **exactly**" (the main, composite Barometer). The published thresholds are: below 20% = Cash; 20% to below 66% = **QLD** (2x Nasdaq-100); 66% to below 85% = **XLU** (utilities); above 85% = Cash. — [VTS, 3 Point Diversification with 3 different Volatility Barometers (Oct 15, 2026)](https://www.volatilitytradingstrategies.com/blog/3-point-diversification-with-3-different-volatility-barometers)
- The portfolio page says it allocates to a single asset class at a time: the Nasdaq when markets are stable, Utilities during "elevated risk", and full Cash when markets are "melting down". — [VTS Portfolio](https://www.volatilitytradingstrategies.com/portfolio)
- Aug 2024: QLD is "the 2x NASDAQ index", XLU is the safety position and cash is the crisis position. — [VTS, Volatility Targeting (Aug 2024)](https://www.volatilitytradingstrategies.com/blog/tactical-investing-through-volatility-targeting)
- Third-party view from 2023: it rotated among VGLT (long Treasuries), QLD, XLU and cash, and did "not use the Barometer directly". **This contradicts** VTS's Oct 2026 statement that it uses the Barometer "exactly". The rules may have changed, or the reviewer may have been wrong. — [OptionsTradingIQ (Aug 2023)](https://optionstradingiq.com/vts-review/)

**Tactical Volatility Strategy**
- It runs off the "Tactical Volatility Barometer", a variant that is "about 75% the same" as the main Barometer and overweights VIX futures roll yield and "a few other metrics" from the volatility complex. Its thresholds were not published. — [VTS Oct 15, 2026](https://www.volatilitytradingstrategies.com/blog/3-point-diversification-with-3-different-volatility-barometers)
- Its positions are: short vol via **SVXY** when metrics are "mid to low" (stable), gold (**GLD**) as the safety position when risk is elevated, and long volatility in the most extreme crashes. — [VTS Aug 2024](https://www.volatilitytradingstrategies.com/blog/tactical-investing-through-volatility-targeting); [VTS Portfolio](https://www.volatilitytradingstrategies.com/portfolio)
- Oct 23, 2024: SVXY is "our aggressive position of choice within the Tactical Volatility Strategy", and the strategy "leans Short Volatility the majority of the time." The post refers to "tail risk VXZ positions" (mid-term VIX futures). From Jul 12 to Oct 23, 2024 the strategy returned +0.85% with an 8.70% max drawdown, versus SVXY at −23.07% with a 38.48% max drawdown. — [VTS, Tactical Volatility Strategy vs SVXY in 2024](https://www.volatilitytradingstrategies.com/blog/tactical-volatility-strategy-vs-svxy-in-2024)
- The FAQ cites IAU as an example holding, so gold may be held as IAU rather than GLD at times. — [VTS FAQ](https://www.volatilitytradingstrategies.com/faq)
- Oct 23, 2026: a livestream titled "SVXY vs SVIX: Is 'Short Vol' leverage worth it?" The page text does not say whether the strategy switched to SVIX (−1x) or stayed with SVXY (−0.5x). — [VTS blog index](https://www.volatilitytradingstrategies.com/blog)

**Strategic Tail Risk Strategy**
- It runs off the "Strategic Tail Risk Barometer", which "focuses more on the mainstream stock market metrics, reduces roll yield and overweights Adjusted VIX futures." Its thresholds were not published. On Oct 14, 2026 the strategy moved from **SPY to KO**. — [VTS Oct 15, 2026](https://www.volatilitytradingstrategies.com/blog/3-point-diversification-with-3-different-volatility-barometers)
- Aug 2024: the stable position is the S&P 500, the safety position is **IYR** (real estate), and the crisis position is long volatility. "There's no leverage involved here." — [VTS Aug 2024](https://www.volatilitytradingstrategies.com/blog/tactical-investing-through-volatility-targeting)
- Third-party view from 2023: Barometer 0–55% = **SSO** (2x S&P 500); 55–80% = IYR; above 80% = **VIXM** (long mid-term VIX futures). — [OptionsTradingIQ (Aug 2023)](https://optionstradingiq.com/vts-review/)
- The portfolio page describes it as "protective (CAOS) positions", built to survive and profit from crashes. — [VTS Portfolio](https://www.volatilitytradingstrategies.com/portfolio)

**Signal delivery and execution timing (all strategies)**
- One email goes out every trading day, including days with no trades. The official deadline is before 12:00 pm ET, and it typically arrives around 11:15 am ET. Execution timing is left to the subscriber, and the FAQ treats intraday fills as effectively random. A signal remains actionable on any day the email still shows it. — [VTS FAQ](https://www.volatilitytradingstrategies.com/faq)
- Each email lists every strategy's trade signals, "allocation sizes" and instructions. — [VTS FAQ](https://www.volatilitytradingstrategies.com/faq)
- Performance is "all live trades" sent to members in the daily emails and "includes all trade fees and dividends". — [VTS Portfolio](https://www.volatilitytradingstrategies.com/portfolio)

### Inferences
- The leverage history suggests Strategic Tail Risk was cut from 2x equity (SSO, per the 2023 review) to unlevered SPY by Aug 2024. On Oct 14, 2026 it moved from SPY to KO, a low-beta single stock. KO looks like a new defensive or intermediate position, possibly replacing or sitting alongside IYR, but no source says what KO represents.
- Signals reach subscribers around 11:15 ET and are presumably based on data through the prior close or the morning. So de-risking happens at most once per day, with a lag of roughly half a day to one day. VTS does not publish an intraday stop.
- Execution timing is not specified, and I don't know which fill price VTS uses for its own performance record. So subscriber returns could differ from published returns, especially for SVXY on fast-moving days.

### Gaps
- The Tactical Volatility and Strategic Tail Risk thresholds are not public.
- It is unknown which instrument Tactical Volatility uses for long volatility: VXZ, VIXM, VXX or UVXY. VXZ was mentioned in 2024 and VIXM in 2023 (the latter for Strategic Tail Risk).
- The FAQ mentions "allocation sizes" in the emails, so I don't know whether each sleeve is always 100% in one position or partially allocated.
- It is unknown whether Tactical Volatility currently uses SVXY or SVIX.

## 3. How the strategies relate: combined sleeves vs alternatives, and the Total Portfolio construction

### Takeaway
The strategies are meant to be held together as independent sleeves of one "Total Portfolio Solution". The only explicit public weighting is equal weight: 25% each across 4 strategies in 2022, and 20% each across 5 per the 2023 review. For small accounts, VTS suggests running 2 strategies at 50/50. No rebalancing rule is published.

### Cited Findings
- 2022: "made up of 4 strategies with equal 25% weighting." Each sleeve runs independently and holds different assets depending on volatility readings. — [VTS Feb 2022](https://www.volatilitytradingstrategies.com/blog/article-635-5-volatility-ranges-and-our-expected-portfolio-allocations-during-each)
- 2023, third party: five strategies at 20% each. — [OptionsTradingIQ](https://optionstradingiq.com/vts-review/)
- FAQ: accounts under $5,000 should put about half in Tactical Volatility and half in either Defensive Rotation or Strategic Tail Risk. Accounts over $10,000 can follow all strategies. Subscribers may change allocations, but "the more you deviate from what I do, the less reliable the correlations may be." — [VTS FAQ](https://www.volatilitytradingstrategies.com/faq)
- The Oct 2026 post frames the 3 strategies and their 3 barometers as "3 Point Diversification", so that the sleeves do not all de-risk at the same moment. — [VTS Oct 15, 2026](https://www.volatilitytradingstrategies.com/blog/3-point-diversification-with-3-different-volatility-barometers)
- Correlations as of Jan 2024: Defensive Rotation vs Strategic Tail Risk 26%; Total Portfolio vs S&P 500 50%; Tactical Volatility vs S&P 500 35%; Strategic Tail Risk vs S&P 500 36%; Iron Condor "single digits or negative across the board". The target range is "around -10% to +60%". The Total Portfolio was "still returning over 20% in a bull market", and Iron Condor returned "around 17% Annualized since January 2012". — [VTS Correlation Matrix](https://www.volatilitytradingstrategies.com/blog/correlation-matrix-of-all-our-vts-strategies)

### Inferences
- If today's 3-strategy Total Portfolio follows the earlier equal-weight practice, each sleeve would be about 33%. This is an extrapolation and is not confirmed by any 2024–2026 source I could read.

### Gaps
- The current (2026) sleeve weights for the 3-strategy Total Portfolio are not stated in readable text.
- No rebalancing frequency is stated: not whether sleeves are re-equalized, how often, or whether each sleeve's capital simply compounds on its own.
- It is unknown whether Bitcoin Breakpoint takes a share of Total Portfolio capital.

## 4. How Barometer level maps to allocation; the composite vs variant barometers

### Takeaway
The main VTS Volatility Barometer is a percentile-ranked composite of 13 volatility metrics (0–100%). Defensive Rotation trades it directly, using published bands of 20, 66 and 85%. The other two strategies use **modified versions** of it, not subsets: the Tactical Volatility version is "about 75% the same" with extra weight on roll yield, and the Strategic Tail Risk version leans on stock-market metrics and Adjusted VIX futures. The portfolio-wide view is a 5-range (2022) or thirds-based (2024–25) scheme, with above 80% marked as "extreme".

### Cited Findings
- 13 metrics are combined into one value. It uses data since 2006 and needs 5 years of data to rank percentiles, so its official inception is January 2011. The range in practice runs from about 13% to just over 90% ("never going to hit 100% or 0%"). The long-term average is 46.62%: 39.94% in the 7 years before Volpocalypse and 53.31% in the 7 years since (as of Feb 2025). — [VTS, Volatility Regime Change and our Volatility Barometer Pt.1 (Feb 26, 2025)](https://www.volatilitytradingstrategies.com/blog/volatility-regime-change-and-our-volatility-barometer)
- Aug 24, 2024: the average since Jan 2011 was 46.34%. The Barometer spent 18.20% of trading days in the upper third and 30.40% in the lower third. "Lower values represent stable markets where our strategies will be allocated to aggressive net long equities". "Higher values represent periods of elevated Volatility where our strategies will be in safety positions". Above 80%, strategies "may in fact be taking net short equity" / net long volatility. "Each strategy is geared with different thresholds". — [VTS, Barometer levels per year since 2011](https://www.volatilitytradingstrategies.com/blog/vts-volatility-barometer-levels-per-year-since-2011)
- The Feb 2022 portfolio-level map of 5 ranges, from the readable text:
  - (1) Very Low: stocks, short vol and bonds, net long SPX, with VXX butterflies skewed more delta-positive.
  - (2) Mid-Low: stocks and short vol, strongly net long SPX.
  - (3) Mid (40–60%): stocks and short vol, strongly net long SPX, ready to exit.
  - (4) Mid-High (60–80%): utilities, bonds, real estate and cash, roughly neutral SPX. "isn't a full on red flag".
  - (5) Very High: gold, cash and long vol, net short SPX, with long vol "when volatility is extremely elevated and the VIX futures are in backwardation".
  - Percentages for each range were in an image. — [VTS Feb 2022](https://www.volatilitytradingstrategies.com/blog/article-635-5-volatility-ranges-and-our-expected-portfolio-allocations-during-each)
- Defensive Rotation's published bands (Oct 2026): <20% Cash, 20–<66% QLD, 66–<85% XLU, >85% Cash. — [VTS Oct 15, 2026](https://www.volatilitytradingstrategies.com/blog/3-point-diversification-with-3-different-volatility-barometers)
- Third party (2023): Strategic Tail Risk bands of 0–55% SSO, 55–80% IYR, >80% VIXM. The 2023 bands may refer to an earlier main Barometer, because at that time the reviewer said Strategic Tail Risk used it "most directly". — [OptionsTradingIQ](https://optionstradingiq.com/vts-review/)
- A TradingView script called "Volatility Barometer (VB)" is unrelated to VTS; it is a generic VIX/VVIX indicator. — [search result: TradingView VB script](https://kr.tradingview.com/script/FwCjRfHP-Volatility-Barometer-VB)

### Inferences
- **On the user's hypothesis that one strategy follows the composite and the others follow subsets:** one strategy (Defensive Rotation) does follow the composite. The other two follow **re-weighted variants** that share about 75% of their makeup with it (stated for Tactical Volatility, implied for Strategic Tail Risk) and add or overweight certain metrics. "Subsets" is not the right word.
- Defensive Rotation's bands as stated put it in **cash below 20%** (extremely calm readings). That is unusual: it would de-risk at the very calm extreme as well as the stressed one. I could only confirm this through the fetch summary and recommend checking it against the original post before relying on it.

### Gaps
- The 13 metrics are not named publicly. Examples the posts give include the VIX index, VIX futures, the volatility risk premium, VIX futures roll yield and "Adjusted VIX futures".
- Weights, the percentile method and the lookback (5-year rolling or expanding) are not public.
- Historical daily Barometer values are subscription-only, per the FAQ. — [VTS FAQ](https://www.volatilitytradingstrategies.com/faq)

## 5. Coordinator focus: how exposure scales up in calm regimes and how fast it de-risks

### Takeaway
In calm regimes the three sleeves hold, respectively, **QLD (2x Nasdaq)**, **SVXY (−0.5x short VIX futures)** and **unlevered SPY**; earlier, Strategic Tail Risk held **SSO (2x S&P)**. Each appears to be an all-in, single-position sleeve. When a sleeve's Barometer crosses its threshold it switches whole positions (QLD to XLU, SVXY to GLD, SPY to IYR or KO), signalled once a day by an email around 11:15 ET. There is no published intraday stop and no gradual scaling ladder. The performance record shows the strategies' drawdowns are much smaller than buy-and-hold (an 8.7% max drawdown vs SVXY's 38.5% in mid-2024). But the record is self-reported, and one third-party commenter disputes the long-run returns.

### Cited Findings
- Calm-regime holdings are QLD (2x) in Defensive Rotation, SVXY in Tactical Volatility, and the S&P 500 in Strategic Tail Risk ("no leverage"). — [VTS Aug 2024](https://www.volatilitytradingstrategies.com/blog/tactical-investing-through-volatility-targeting)
- "I'll gladly hold equities (and even take leveraged positions) when volatility is in mid to low ranges". — [VTS Feb 2022](https://www.volatilitytradingstrategies.com/blog/article-635-5-volatility-ranges-and-our-expected-portfolio-allocations-during-each)
- Defensive Rotation "allocates to a single asset class at a time". — [VTS Portfolio](https://www.volatilitytradingstrategies.com/portfolio)
- An example of how fast it de-risks: "we got our trade signal on July 24th to move into that safety position of gold". That was about 9 days before the Aug 2, 2024 VXX spike, and Defensive Rotation moved to XLU "way ahead of time". — [VTS Aug 2024](https://www.volatilitytradingstrategies.com/blog/tactical-investing-through-volatility-targeting)
- The strategy needs "a little bit of weakness to get the signals to move to safety", and signals are followed rather than overridden with judgment. — [VTS Oct 23, 2024](https://www.volatilitytradingstrategies.com/blog/tactical-volatility-strategy-vs-svxy-in-2024)
- Signals go out once daily before noon ET (about 11:15 typical), and execution is intraday at the subscriber's discretion. — [VTS FAQ](https://www.volatilitytradingstrategies.com/faq)
- Third-party scepticism:
  - A commenter on the 2023 review (Tim Sheehan, Dec 2024) claimed his own CAGR following VTS was 8.90% from Jan 2018 to Oct 2024, versus 10.49% for SPY and 8.05% for VBINX. Other commenters alleged deleted critical comments and gaps between marketed returns and backtests. — [OptionsTradingIQ comments](https://optionstradingiq.com/vts-review/)
  - A Bogleheads commenter (search snippet only; the page returned 403) said the "24% CAGR is highly dependent on gains that he claims from 2012-2016", which predates live trading. — [Bogleheads thread](https://www.bogleheads.org/forum/viewtopic.php?t=324670)

### Inferences
- Assuming equal thirds and fully invested sleeves (both unconfirmed), the calm-regime Total Portfolio would hold about 33% QLD (≈67% Nasdaq-100 notional), 33% SVXY (≈−0.17 VIX-futures notional at the portfolio level) and 33% SPY or KO. That is roughly 1.0x equity-like beta plus a short-vol carry sleeve. It is aggressive but not extremely levered, and less so than in 2023 when Strategic Tail Risk used SSO.
- Most of the drawdown protection seems to come from (a) the three sleeves switching at different thresholds with different barometers, so they don't all exit at once, and (b) Barometer inputs such as roll yield and term structure that can move before spot VIX spikes. The evidence for (b) is a single anecdote, July 24 vs Aug 2, 2024. A gap-down overnight or a same-day spike (as in Feb 2018) would still be absorbed for at least part of a day, because signals come out only once a day.
- "Strong" published total returns should be weighed against: the Barometer's 2011 start date being a backtest, the 2012–2016 short-vol tailwind, unknown fill assumptions, and the commenter's much lower live CAGR.

### Gaps
- No published intraday exit or emergency-alert mechanism. I found no evidence of one.
- No published sizing ladder within a strategy, for example SVXY at 50% vs 100% by Barometer level.
- No readable time series of Total Portfolio returns or drawdowns. They are only in images.

## 6. What is public vs paywalled

### Takeaway
Public: strategy names; asset roles for each regime (aggressive, safety, crisis instruments); the Barometer's design at a high level (13 metrics, percentile, 2011 inception, averages); Defensive Rotation's thresholds (Oct 2026); and anecdotal trade dates and performance snippets. Paywalled or unpublished: current Barometer values and history, the Tactical Volatility and Strategic Tail Risk thresholds, the metric list and weights, position sizes, current Total Portfolio weights and rebalancing, and the long-vol instrument choices.

### Cited Findings
- "Everything you need to follow VTS is in the daily email". Barometer history is available only through subscription, though Osachoff may release values or time-delayed values later. — [VTS FAQ](https://www.volatilitytradingstrategies.com/faq)
- The subscribe page gives no performance figures, weights or launch dates. — [VTS Subscribe](https://www.volatilitytradingstrategies.com/subscribe)
- Livestream pages (Ep.134 on Strategic Tail Risk, Ep.136 on SVXY vs SVIX) have no text detail; the content is in the video. — [Ep.134](https://www.volatilitytradingstrategies.com/blog/ep-134-bull-bear-market-ready-strategic-tail-risk-strategy); [Ep.136](https://www.volatilitytradingstrategies.com/blog/ep-136-svxy-vs-svix-is-short-vol-leverage-worth-it)

### Inferences
- The FAQ says "we don't short anything" while listing short volatility as an asset class. The two are consistent if short volatility is held only through long positions in inverse ETPs (SVXY), not by shorting VXX.

### Gaps
- Video transcripts for Ep.131–137 (Aug–Oct 2026) were not available as text. They probably contain current details on SVXY vs SVIX, Strategic Tail Risk's bull/bear setup and the Bitcoin strategy.
- I could not read the Bogleheads thread (403), and found no relevant Reddit, Elite Trader or Seeking Alpha strategy write-ups.
