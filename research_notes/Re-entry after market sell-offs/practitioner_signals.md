# Practitioner market-bottom and re-entry signals for US equities, and the independent evidence

Scope note: written 2026-11-05. About 18 search/fetch calls. Many practitioner pages put their signal tables in images, so per-signal dates and returns were often not machine-readable. Anything not tied to a source below is marked as a gap or as an inference. Source type is tagged: **[originator/vendor]** = the indicator's author or a commercial promoter; **[independent]** = a third-party test.

## Breadth thrusts (Zweig, Whaley, Deemer, Lowry 90% days / Desmond)

### Takeaway
Breadth thrusts are the closest thing to a "fires near the bottom" signal, and their published 6- and 12-month records are strong. The records are almost entirely vendor-compiled, though, with small samples (roughly 15 to 25 events since the 1940s) and signal counts that disagree across sources. Thrusts tend to fire after the low, often weeks after it, and signals have become more frequent recently. The one independent-style check found (SentimenTrader on a looser ZBT variant) shows that the Nasdaq 100 lost about 35% after loose ZBT-type readings in 2002 and 2008. Bear-market rallies are therefore the main known failure mode.

### Cited Findings
**Zweig Breadth Thrust (ZBT)**
- Definition: the 10-day EMA of NYSE advancers / (advancers + decliners) must rise from below 0.40 to above 0.615 within 10 trading days. Martin Zweig described it in *Winning on Wall Street* (1986). — [Yahoo/Motley Fool summary of Detrick data](https://finance.yahoo.com/news/market-just-did-something-only-073000463.html); [LuxAlgo](https://www.luxalgo.com/library/concept/breadth-thrusts/)
- Signal counts disagree. One source says 16 triggers since 1950 before April 2025 [RIA, 2025-04-29](https://realinvestmentadvice.com/resources/blog/a-rare-zweig-breadth-thrust-provides-optimism/). Another says 18 since 1945 as of the November 2023 signal [CNBC, 2023-11-06](https://www.cnbc.com/2023/11/06/zweig-breadth-thrust-rare-market-buy-signal.html). The April 24, 2025 trigger is described as the 20th since WWII, after 19 prior ones back to 1943 [Yahoo](https://finance.yahoo.com/news/market-just-did-something-only-073000463.html). **[vendor]**
- Recent signal dates reported: early November 2023 [CNBC](https://www.cnbc.com/2023/11/06/zweig-breadth-thrust-rare-market-buy-signal.html); around 2024-08-19 per Ryan Detrick ("Another Zweig Breadth Thrust triggered yesterday", posted 2024-08-20) [Detrick on X](https://x.com/RyanDetrick/status/1825955327348715864); 2025-04-24 [Yahoo](https://finance.yahoo.com/news/market-just-did-something-only-073000463.html); [FXStreet](https://www.fxstreet.com/analysis/zweig-indicator-202504250410). SentimenTrader's page shows "most recent signal 2024-11-3", which conflicts with its own 2024-05-09 article date and is probably a date-format artefact for 2023-11-03 [SentimenTrader](https://sentimentrader.com/blog/about-that-near-miss-zweig-breadth-thrust).
- Forward returns (S&P 500) **[vendor: Detrick/Carson]**: over 18 signals, averages of +15.3% at 6 months and +24.0% at 12 months [Yahoo](https://finance.yahoo.com/news/theres-ultra-rare-bullish-signal-225535692.html). After the 19 signals before April 2025, the medians were +13.2% at 6 months and +24.8% at 12 months, and the index was higher at both horizons every time [Yahoo](https://finance.yahoo.com/news/market-just-did-something-only-073000463.html). Detrick in August 2024: "stocks have never been lower a year after a signal and up 23% on average", and signals are "more in recent years than in the past" [X](https://x.com/RyanDetrick/status/1825955327348715864).
- SentimenTrader (Jay Kaeppel, 2024-05-09) **[vendor, but tests a looser variant]**: the official ZBT's previous 17 signals were followed by a 12-month S&P 500 gain 100% of the time, with a median of +22.9%. A looser rule ("ZBT crosses above 0.60") had a 91% 12-month win rate on the S&P 500. On the Nasdaq 100 it had 130 wins in 132 signals since 1985. The two losses were −35.08% after 2002-03-06 and −35.55% after 2008-02-01, both bear-market rallies. The article also covers a near miss: the reading went from 36% to 63% but took more than 10 days, so it did not qualify. — [SentimenTrader](https://sentimentrader.com/blog/about-that-near-miss-zweig-breadth-thrust)
- Drawdowns of 20–30% inside the first year after a signal are reported in some historical charts (secondary source, unverified) [OptionsTradingIQ via search summary](https://optionstradingiq.com/zweig-breadth-thrust-signal/).
- RIA says the signal "doesn't guarantee the downward trend is over" and that short-horizon returns were positive only "in almost all cases" [RIA](https://realinvestmentadvice.com/resources/blog/a-rare-zweig-breadth-thrust-provides-optimism/).

**Deemer Breakaway Momentum (BAM)**
- Definition (Walter Deemer, 1970s): 10-day total NYSE advances > 1.97 × 10-day total declines. An alternative 20-day version uses advances > 1.72 × declines. — [LuxAlgo](https://www.luxalgo.com/library/indicator/lliEtewf-deemer-breakaway-momentum-thrust/); [Carson/Detrick 2023-01-18](https://www.carsongroup.com/insights/blog/staying-classy-market-breadth-buying-thrusts-and-brian-fantana)
- Record **[originator via Carson]**: 24 signals since 1949. The S&P 500 was higher a year later in 23 of them, averaging +20.7%. The single failure was the January 1987 signal, which was negative a year later because of the October 1987 crash. With a stricter 2.10 threshold (Ned Davis Research data) there were 15 signals, 13 higher a year later averaging more than 20%, and all higher at 6 months, averaging nearly 16%. — [Carson](https://www.carsongroup.com/insights/blog/staying-classy-market-breadth-buying-thrusts-and-brian-fantana); [Livewire](https://www.livewiremarkets.com/wires/a-breakaway-momentum-signal-has-averaged-20-7)
- Signal dates: early January 2023 (around 2023-01-12) [Carson](https://www.carsongroup.com/insights/blog/staying-classy-market-breadth-buying-thrusts-and-brian-fantana), and 2025-04-24 per LuxAlgo [LuxAlgo](https://www.luxalgo.com/library/indicator/lliEtewf-deemer-breakaway-momentum-thrust/). Other sources count 25 occurrences [search summary](https://www.livewiremarkets.com/wires/a-breakaway-momentum-signal-has-averaged-20-7). Deemer's own list (walterdeemer.com/bam.htm) blocked automated fetch.

**Whaley breadth thrust**
- LuxAlgo describes Whaley's Advance-Decline Thrust (Adv/(Adv+Dec)) and Up/Down Volume Thrust (UpVol/(UpVol+DownVol)), which trigger at extreme readings. Exact thresholds were not given in what I retrieved. — [LuxAlgo](https://www.luxalgo.com/library/concept/breadth-thrusts/)

**Lowry 90% days / Desmond**
- Paul Desmond (Lowry's), "Identifying Bear Market Bottoms and New Bull Markets", 2002 Charles H. Dow Award. A 90% Downside Day means downside volume ≥ 90% of up + down volume **and** points lost ≥ 90% of points gained + lost. The pattern at a major bottom is one or more 90% Downside Days (panic selling) followed by a 90% Upside Day, or rarely two back-to-back 80% Upside Days. In about half of the cases over the 69 years studied, the 90% Upside Day (or 80/80 pair) came within 5 trading days of the low. Desmond also said an isolated 90% Downside Day has no long-term implications on its own. — [Scribd copy of the 2002 Dow Award paper](https://www.scribd.com/doc/240402654/2002-Dow-Award); [Ritholtz Q&A with Desmond](https://ritholtz.com/2011/02/qa-paul-desmond-of-lowrys-reports-2/) **[originator]**
- Ritholtz noted that 90/90 down days followed by a rally do not always mark the end ("90/90 Down Days Followed by Rally, Then…") [Ritholtz 2011](https://ritholtz.com/2011/02/9090-down-days-followed-by-rally-then). The page was not fetched, so details are unknown.

### Inferences
- Every thrust record found is vendor-compiled, at 6- and 12-month horizons, with a few dozen overlapping events. A 100% win rate on about 18–24 events with 12-month horizons in a market that rises roughly 70% of years is weaker evidence than it looks. With base rate p ≈ 0.7, the chance of 18 for 18 by luck is about 0.002, but the events cluster in bull-market starts and are not independent.
- A thrust can only fire after a broad rally is already under way, so by construction it comes after the low. The 2002 and 2008 loose-ZBT losses show the main risk for this allocator: thrusts inside secular bears (2000–02, 2008) can fire on bear-market rallies. Official ZBT signals apparently avoided 2008 (none listed), but signal dates for 2000–2009 could not be verified.
- Signals have become more frequent recently (2023, 2024, 2025). Detrick flags this himself, which may reflect a changed NYSE composition (more ETFs, preferreds, closed-end funds), so a test on a modern NYSE count may not match the pre-2000 record.

### Gaps
- No complete, text-readable table of ZBT dates and per-signal forward returns was retrieved; the tables were images. Commonly cited dates (e.g. March 2009, October 2015, January 2019, March 2020 or not) **could not be verified**. I recall a frequently reported view that no official ZBT fired at the March 2009 low or in 2020, but I could not confirm it, so it should not be relied on.
- Whaley's exact thresholds were not retrieved. From memory (unverified): Whaley's 2010 Dow Award paper "Planes, Trains and Automobiles" uses a 5-day Adv/(Adv+Dec) above ~73.66% and a 5-day up-volume ratio above ~77.88%. Check against the CMT Association copy before using.
- No academic or peer-reviewed replication of any breadth thrust was found.
- I found no independent test of thrust-based re-entry as a timing overlay (equity curve vs. buy-and-hold). Only fixed-horizon event studies were found.

## Price-based rules (O'Neil follow-through day, rebound %, momentum thrusts, Faber 10-month SMA)

### Takeaway
The follow-through day (FTD) is the best-tested price rule. Rob Hanna's independent test (Quantifiable Edges, S&P 500 1971–2008) found only about 55% of FTDs succeeded under a generous definition and 45% under a strict one, against IBD's claimed 70–80%. Every rally had an FTD under the original 1% rule, though, so the FTD works as a necessary condition with many false positives, not a reliable trigger. The Faber 10-month SMA is a slow re-entry rule by design; it is updated monthly and has known whipsaw. No independent study of fixed "up X% in N days from a low" rules was found.

### Cited Findings
- FTD definition (original 1% thrust; IBD later raised the minimum to about 1.7%). Hanna's sample covered S&P 500 rally attempts from December 1971 to January 2008. **[independent]** — [Quantifiable Edges pt.1](https://quantifiableedges.com/ibd-follow-through-days-pt-1-are-they-predictive/); [summary](https://quantifiableedges.com/follow-through-days-quantified/)
- Success rates **[independent]**: with a 1% thrust, 35 of 64 FTDs succeeded (54.7%); with 1.7%, 29 of 52 succeeded (55.7%). "Failure" meant closing below the pre-FTD low. Using an intraday low below the bottom instead drops success to about 45%. — [QE summary](https://quantifiableedges.com/follow-through-days-quantified/); [QE pt.1 via search](https://quantifiableedges.com/ibd-follow-through-days-pt-1-are-they-predictive/)
- Under the 1% rule, "every rally since 1971 would have been accompanied by a FTD". Under IBD's later stricter thresholds, about 20% of rallies would have been missed. — [QE pt.2](https://quantifiableedges.com/follow-through-days-pt-2-does-every-rally-have-one/); [QE summary](https://quantifiableedges.com/follow-through-days-quantified/)
- Further findings: FTDs after day 10 of a rally attempt succeeded *more* often than those on days 4–10, against standard teaching. FTDs were more reliable after small declines than after large ones. Price action in the days after an FTD helped predict success. Strong breadth on the FTD day did not help: 44% success in one test vs. 63% in another. — [QE summary](https://quantifiableedges.com/follow-through-days-quantified/); [QE breadth](https://quantifiableedges.com/the-impact-of-breadth-on-follow-through-day-effectiveness/)
- IBD's claimed 70–80% success rate could not be duplicated "even though I made the definitions … as liberal as I could" (Hanna). An IBD presentation says about 25–30% of FTDs "fail fairly quickly" **[originator]**. — [QE pt.1](https://quantifiableedges.com/ibd-follow-through-days-pt-1-are-they-predictive/); [Slideshare IBD deck](https://www.slideshare.net/isarut/how-to-spot-market-bottoms)
- Faber 10-month SMA: hold when the month-end close is above the 10-month SMA, otherwise cash. It is evaluated only at month-end, and intramonth moves are ignored [systematicinvestor](https://systematicinvestor.github.io/strategy/Strategy-TAA-BANDS). Whipsaw is material, and ±5% bands are a common fix that also delays re-entry [systematicinvestor](https://systematicinvestor.github.io/strategy/Strategy-TAA-BANDS). Results depend on which day of the month you rebalance ("luck of the rebalance timing") [Newfound](https://blog.thinknewfound.com/2013/08/the-luck-of-the-rebalance-timing/). CXO flags possible data-snooping in choosing 10 months for US stocks [CXO](https://www.cxoadvisory.com/technical-trading/long-term-outperformance-from-trends-defined-by-moving-averages).

### Inferences
- The FTD's high recall and ~55% precision make it a reasonable first stage: it is necessary, not sufficient. On its own it would have produced repeated false entries in 2000–02 and 2008, since Hanna's data cover 1971–2008. Hanna's finding that FTDs after big declines are less reliable is exactly the regime this allocator cares about.
- The 10-month SMA has a lag similar to the allocator's existing 200-day trend filter, so it would not fix the late re-entry problem.

### Gaps
- Hanna's per-episode outcomes for 2000–02 and 2008 were not retrieved, and his study ends January 2008, so 2009 and 2020 are not covered.
- No independent study found for "S&P up X% in N days from a low" momentum-thrust rules, or for re-entry after an N% rebound from the low.
- Exact Faber re-entry dates in 2009 and 2020 were not retrieved. From memory (unverified), the S&P 500 crossed back above its 10-month SMA at end-June 2009 and end-May or June 2020; compute this directly from the user's own data.

## Volatility-based bottom rules (VIX spike-reversal, VIX/VIX3M back to contango, Connors VIX stretch)

### Takeaway
The independent evidence is weak. A CXO Advisory test of the "VIX 5% above its 10-day MA" rule (1990–2007) found the conditional edge real but small, and the strategy underperformed buy-and-hold (196% vs 322%). Data-vendor studies of VIX term-structure inversion find almost no directional edge, only about 60% higher dispersion of forward returns. Backwardation episodes are short (median 2 days since 2010), so "back to contango" fires often, including inside 2008-style bears. No rigorous test of "VIX/VIX3M < 1 again" as a re-entry trigger was found.

### Cited Findings
- Connors and Alvarez "VIX Stretch" (*Short Term Trading Strategies That Work*): SPY above its 200-day SMA, VIX ≥ 5% above its 10-day MA for 3+ days, buy on the close, exit when RSI(2) > 65 **[originator; hypothetical backtests, no costs]**. — [CXO notes on the book](https://www.cxoadvisory.com/technical-trading/a-few-notes-on-short-term-trading-strategies-that-work/); [TradingMarkets "5% Solution"](https://tradingmarkets.com/?p=639644)
- CXO Advisory independent test of the TradingMarkets 5% VIX rule, 1990–2007, 5-day holds, 492 non-overlapping signals: 196% total return vs 322% for buy-and-hold. The returns after signals beat unconditional weeks, but the gap was small, and the market still rose on average during the 391 weeks the strategy sat out. CXO concluded it is of limited standalone use. **[independent]** — [CXO](https://cxoadvisory.com/sentiment-indicators/short-term-relative-vix-level-as-a-trading-signal)
- Note that the Connors rule *requires* SPY above its 200-day SMA, so as published it cannot fire at a bear-market bottom. It is a pullback-in-uptrend rule, not a bottom rule. — [CXO notes](https://www.cxoadvisory.com/technical-trading/a-few-notes-on-short-term-trading-strategies-that-work/)
- VIX term structure, 2018–2026 weekly **[data vendor]**: backwardation in about 14.5% of weeks. Median 4-week forward SPY returns were nearly identical to contango weeks, but forward-return dispersion was about 60% higher. The authors suggest it is a sizing input, not a direction signal. — [FlashAlpha](https://flashalpha.com/articles/vix-term-structure-inversions-since-2018-data-study)
- VIX/VIX3M tracker **[data vendor; unverified method]**: 104 backwardation episodes since 2010, average 3.1 days, median 2 days, average SPY return from episode start to end −0.66%. — [thetrading.tools](https://www.thetrading.tools/vix-term-structure)
- Cboe: contango on more than 80% of days since 2010, and backwardation episodes are shorter. — [Cboe Inside Volatility Trading](https://cboe.com/insights/categories/ivt_newsletter)

### Inferences
- With median backwardation episodes of 2 days, "return to contango" is a high-frequency event. In 2008 the VIX curve flipped in and out repeatedly before the March 2009 low, so a bare contango-return trigger would likely have re-entered too early in late 2008. This is inferred, not tested; it needs a backtest on VIX/VIX3M (VIX3M history starts around December 2007, unverified here).
- Combining signals (term structure back in contango *and* VIX X% off its peak *and* a breadth or price confirmation) is the obvious design, but it multiplies the specification-search risk. Pre-registration, as the user already does with PREREG files, is the right control.

### Gaps
- No independent study found of "VIX X% off its peak" or "VIX closes > 20% above its 10-day average then reverts" as re-entry rules at bear-market bottoms.
- No retrieved study tests VIX rules over 2000–02 specifically. VIX3M history does not cover it, while VIX does from 1990.
- Exact Cboe VIX3M history start date not confirmed from a source in this pass.

## Credit-based confirmation (HY OAS peaking / tightening)

### Takeaway
High-yield spreads have a practitioner record of leading equity *peaks*, a median of about 7 months in one 1997–2026 dataset. At bottoms the evidence is anecdotal: spreads reportedly began recovering about 2.5 months before equities in early 2009, and moved roughly in step in 2020. No rigorous test of "HY OAS down X bp from peak" as an equity re-entry rule was found. The main FRED series, BAMLH0A0HYM2, was cut to a rolling 3-year window in April 2026, so full history (from December 1996) needs ALFRED vintages or another source.

### Cited Findings
- HY OAS began widening before the S&P 500 peak in all 8 episodes in a 1997–2026 dataset, with a median lead of about 7 months (range about 1 month in COVID to about 13 months in 2015). **[secondary dataset page]** — [eco3min](https://eco3min.fr/en/us-hy-credit-spread-leading-indicator-dataset/)
- 2009: "the high yield market was in recovery for probably two and a half months" before equities turned in early March 2009 **[asset-manager commentary]**. — [Hedge Fund Alpha](https://hedgefundalpha.com/strategies/the-high-yield-credit-cycle-what-you-need-to-know/); see also [New York Life / ETF Trends](https://www.etftrends.com/core-equity-channel/window-of-opportunity-in-high-yield/)
- 2020: spreads spiked and then compressed rapidly from about March, roughly coincident with the equity low (search summary of T. Rowe Price and others, not precisely dated) — [T. Rowe Price 2020](https://www.troweprice.com/institutional/nl/en/insights/articles/2020/q2/high-yield-investing-during-volatile-times.html)
- FRED/ICE data: ICE BofA series on FRED note "Starting in April 2026, this series will only include 3 years of observations. For more data, go to the source." That note was seen on sibling ICE series [FRED](https://fred.stlouisfed.org/data/BAMLEMHGHGLCRPIUSTRIV); [ALFRED](https://alfred.stlouisfed.org/series?seid=BAMLC1A0C13Y). Secondary sources say BAMLH0A0HYM2 (from December 1996) is now a rolling 3-year window and that ALFRED vintages may keep full history [eco3min](https://eco3min.fr/credit-spreads-recession-risk-dataset/); [Reddit snapshot](https://reddit.sentinel-team.org/posts/1tdrrqn/snapshots/2026-05-15T19%3A02%3A50.96329Z). ICE terms prohibit reproduction without permission [ALFRED](https://alfred.stlouisfed.org/series?seid=BAMLC1A0C13Y).

### Inferences
- In 2002 HY spreads peaked around October 2002, close to the equity low. In 2008 they peaked in December 2008, before the March 2009 equity low, so "X bp off peak" would have fired about 3 months early in 2008–09 (from memory, unverified; check against ALFRED data). A credit confirmation probably helps more as a veto, blocking re-entry while spreads are still making new highs, than as a trigger.
- Moody's Baa–Treasury spread (FRED BAA10Y, from 1986; BAA from 1919) is a longer-history, non-ICE substitute for testing on 1927–1989-style out-of-sample periods. That is an inference about suitability; its correlation with HY OAS was not checked here.

### Gaps
- No rigorous study of HY-spread-based equity re-entry found.
- The BAMLH0A0HYM2 page itself was not fetched to confirm the truncation, and the availability of pre-April-2026 ALFRED vintages was not verified.

## Data availability for a public-data tool, and failure modes

### Takeaway
VIX (from 1990) and VIX3M (from about 2007) are free from Cboe. HY OAS is now a problem on FRED, which keeps only 3 years since April 2026. NYSE advance/decline counts are the hardest: no free, no-login daily history back to the 1960s was found, which is the main obstacle to testing breadth thrusts independently. The common failure modes are bear-market rallies (2002, 2008), small and overlapping samples, inconsistent signal counts between vendors, and definitional freedom (thresholds, success criteria, universes).

### Cited Findings
- NYSE advancing/declining issues back to March 1965 (^ADVN/^DECN) are available via the QuantShare downloader, which needs a login [QuantShare](https://www.quantshare.com/item-151-advancing-declining-unchanged-volume-for-nyse-amex-and-nasdaq). Unicorn Research data via Wealth-Lab was historically free but is being decommissioned or moved to Wealth-Data [Wealth-Lab](https://wealth-lab.com/Forum/Posts/30921); [Wealth-Lab](https://wealth-lab.com/Forum/Posts/Market-Sentiment-Breadth-data-in-Wealth-Data-40029). CRSP (daily from 1962) is institutional and paid [HBS](https://www.library.hbs.edu/Find/Databases/Center-for-Research-in-Security-Prices-CRSP).
- Breadth results depend on the universe; some signals appear in one dataset and not another, and Deemer's rule was built for NYSE data [LuxAlgo](https://www.luxalgo.com/library/concept/breadth-thrusts/).
- Vendor counts disagree: ZBT is counted as 16, 18, 19 or 20 events; BAM as 24 or 25. [RIA](https://realinvestmentadvice.com/resources/blog/a-rare-zweig-breadth-thrust-provides-optimism/); [Yahoo](https://finance.yahoo.com/news/market-just-did-something-only-073000463.html); [Carson](https://www.carsongroup.com/insights/blog/staying-classy-market-breadth-buying-thrusts-and-brian-fantana)
- Definition sensitivity: FTD success ranges from 45% to 55% depending only on the failure definition; IBD claims 70–80% [QE](https://quantifiableedges.com/follow-through-days-quantified/).
- Bear-market-rally failures documented: losses of −35% on the Nasdaq 100 after loose ZBT readings on 2002-03-06 and 2008-02-01 [SentimenTrader](https://sentimentrader.com/blog/about-that-near-miss-zweig-breadth-thrust); BAM January 1987 [Carson](https://www.carsongroup.com/insights/blog/staying-classy-market-breadth-buying-thrusts-and-brian-fantana).

### Inferences
- A practical alternative to NYSE A/D counts is to build breadth from a constituent price panel (e.g. % of S&P 500 or Russell members up on the day). This avoids the ETF and preferred contamination of modern NYSE counts, but it has survivorship issues and will not reproduce the vendor histories exactly.
- To match the user's 1927–1989 out-of-sample practice, breadth is the only family with pre-1990 history (NYSE A/D back to the 1920s–40s in vendor sets). VIX and HY OAS cannot be tested before 1990 and 1997 respectively.

### Gaps
- No free source of daily NYSE A/D history before about 2000 was verified. WSJ market-data pages and Stooq were not checked in this pass.
- Exact Cboe VIX/VIX3M download URLs and start dates were not verified from a source.
