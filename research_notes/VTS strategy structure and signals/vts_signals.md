# VTS (Volatility Trading Strategies) signals, dashboard metrics and how they are combined

Research date: 2026-11-04. Sources are mostly VTS's own blog (volatilitytradingstrategies.com, author Brent Osachoff), plus one third-party review. Many VTS posts put the numbers in chart images and videos, which could not be read; anything below that isn't in the article text is marked as a gap or an inference. Note that VTS strategy rules have **changed over time**, so check post dates.

## 1. Dashboard metric definitions and thresholds

### Takeaway
VTS publishes exact formulas for only a few metrics (VX30, VX30:VIX roll yield). Most other metrics are described in words only, with no numeric thresholds. Each dashboard metric is reported as a raw value plus a **percentile rank against all history since Jan 2011**. That percentile normalisation is the common building block for the Barometer.

### Cited Findings
- **Dashboard structure:** VX30:VIX roll yield is "#6 of 20" metrics in the VTS Volatility Dashboard, which appears in the daily subscriber blog/email. — [VTS Dashboard Pt 6](https://volatilitytradingstrategies.com/blog/vts-volatility-dashboard-part-6-vx30-vix-adjusted-roll-yield)
- **VX30 (constant 1-month maturity VIX future), formula as published:**
  - Daily roll weight = 100% ÷ number of trading days in the current cycle
  - VX30 = (M1 × (days × roll)) + (M2 × (100% − (days × roll)))
  - VX30 equals M1 at the start of the cycle, is a 50/50 blend mid-cycle, and approaches 100% M2 just before expiry. VTS calls it "a constant maturity weighting of the real VIX futures contract". — [VTS Dashboard Pt 6](https://volatilitytradingstrategies.com/blog/vts-volatility-dashboard-part-6-vx30-vix-adjusted-roll-yield)
- **VX30:VIX roll yield = (VX30 − VIX) ÷ VIX.**
  - Contango (futures above VIX) is a tailwind for short vol; backwardation is a headwind.
  - Shown as an absolute value plus a percentile rank since inception. No numeric cutoffs are published.
  - It refines an earlier "M1:VIX roll yield" metric. VTS says the metric is meant to mirror the roll dynamics of VXX/SVXY/UVXY/VIXY, which use a 1-month constant-maturity blend. — [VTS Dashboard Pt 6](https://volatilitytradingstrategies.com/blog/vts-volatility-dashboard-part-6-vx30-vix-adjusted-roll-yield)
- **Cash VIX crossovers** are dashboard metrics #7–#10: VIX9D:VIX, VIX:VIX3M, VIX:VIX6M and VIX:VIX1Y. — [VTS CVO post, 18 Feb 2020](https://www.volatilitytradingstrategies.com/blog/vts-cash-vix-oscillator-volatility-dashboard-metric)
- **Cash VIX Oscillator (CVO), metric #11:**
  - What it is: "combines all the various time frames from 9 days to 1 year, into a single reading", built from VIX9D, VIX, VIX3M, VIX6M and VIX1Y. It is a "red light green light" indicator.
  - Formula: **not published.**
  - Scale: the raw value is "not normalized so there's no cap". Since Jan 2011 the high was 15.28 (16 Mar 2012) and the low was −43.98 (5 Feb 2018). It is also shown as a 0–100% percentile rank since Jan 2011.
  - Direction: higher values favour short vol. In the examples, a percentile above 70% means calm/stable and below 30% means elevated fear, with the 30th percentile used as a warning level.
  - Timing: updated "right before I send out my daily email". — [VTS CVO post](https://www.volatilitytradingstrategies.com/blog/vts-cash-vix-oscillator-volatility-dashboard-metric)
- **Other daily email contents** (third-party review): Cash VIX oscillator, M1:M2 VIX futures, VX30:VIX roll yield, M4–M7 VIX futures, VIX:VIX3M crossover, VRP "and more". It also lists "crush and surge levels" for VXX, UVXY, UVIX, SVXY and SVIX. — [OptionsTradingIQ VTS review](https://optionstradingiq.com/vts-review/)
- **Barometer inputs named by VTS:** "Traders VRP" is named as one of the 13 Barometer inputs, alongside VIX futures, cash VIX values and the CVO. — [VTS methodology change, 6 May 2025](https://www.volatilitytradingstrategies.com/blog/small-change-in-our-vts-volatility-barometer-methodology)

### Inferences
- Because every metric comes with a since-2011 percentile, the Barometer most likely combines percentile-ranked inputs. That fits VTS saying signals are based on "rolling percentiles" (section 2).
- The dashboard has about 20 metrics, while the Barometer uses 13. So roughly 7 dashboard items (for example the ETP crush/surge levels) are display-only or feed only the strategy-specific variants.

### Gaps
- No exact published formula was found for Traders VRP, Adjusted M1:M2, M4:M7, the VIX vs VOLI comparison, or the CVO. I did not find the individual "Volatility Metric:" posts for VRP, Adjusted M1:M2 or M4–M7 in search. A /volatility-dashboard index page returned 404.
- No SPY/VIX momentum or trend filter is described in any post I read.

## 2. Volatility Barometer: inputs, scale, zones, position mapping, crisis readings

### Takeaway
- **What it is:** a proprietary composite of **13 volatility metrics**, built on rolling percentiles going back to Jan 2011 (5 years of data are needed before percentiles can be ranked). It runs on a 0–100% scale.
- **Inputs and weights:** only four inputs are named (VIX futures, cash VIX values, Traders VRP, CVO). No weights are published.
- **Zones:** the lower third is risk-on (long equity / short vol), the upper third is safety, and above 80% may mean net long vol. The 60% level is VTS's informal "settled again" line after a spike.
- **Exact thresholds** have been published for some strategies and differ by strategy and by date.

### Cited Findings
- **Composition and history:** "currently takes information from 13 different Volatility metrics and combines it into a single value". The data needs a five-year history before percentiles can be ranked, which is why the official inception date is Jan 2011. — [Regime change Pt 1](https://www.volatilitytradingstrategies.com/blog/volatility-regime-change-and-our-volatility-barometer)
- **Percentile basis:** "it's never going to hit 100% or 0%". Historical low is about 13%; highs are "just barely over 90%" (before 2025).
- **Long-term average:** 46.62%. The average was 39.94% in the 7 years before Volpocalypse and 53.31% in the 7 years after. — [Regime change Pt 1](https://www.volatilitytradingstrategies.com/blog/volatility-regime-change-and-our-volatility-barometer)
  - Another VTS post gives the since-2011 average as 46.34% (a different snapshot date). — [Levels per year since 2011](https://www.volatilitytradingstrategies.com/blog/vts-volatility-barometer-levels-per-year-since-2011)
- **Time spent in each zone (since 2011):** upper 1/3 on 18.20% of days, lower 1/3 on 30.40% of days.
  - Lower 1/3 means strategies are "net long equities and net short Volatility".
  - Upper 1/3 means safety positions.
  - "Extreme values over 80% would be times that our strategies may in fact be taking net short equity" / net long vol. — [Levels per year since 2011](https://www.volatilitytradingstrategies.com/blog/vts-volatility-barometer-levels-per-year-since-2011)
- **Rescaling, 6 May 2025:** the old calculation was capped at about 91%. The new one reaches 100% (Covid 2020). "Remember this is purely visual": strategy signals are based on rolling percentiles and are unaffected.
  - The four named inputs are VIX futures, cash VIX values, Traders VRP and CVO.
  - Some metrics act as contrarian signals in very low vol, so the composite may not reach 0%. — [Methodology change](https://www.volatilitytradingstrategies.com/blog/small-change-in-our-vts-volatility-barometer-methodology)
- **Floor behaviour (13 Apr 2021):** five dips just below 33% in a year reversed. "the true floor where things start to run out of steam is closer to the 18-20% range". The post warns against using 33% as a go-to-safety trigger. Averages were about 40% in 2011–17 and about 60% from 2018. — [Barometer can go way lower](https://www.volatilitytradingstrategies.com/blog/article-612-the-vts-volatility-barometer-can-go-way-lower)
- **Decile distribution (10 Aug 2020):** the 30–40% decile held 19.1% of days and 20–30% held 22.4%; together 20–40% (41.5% of days) is "the sweet spot". A "VB Threshold" strategy used quintiles, and the 20–40% quintile held SVXY (previously ZIV). — [Deciles post](https://www.volatilitytradingstrategies.com/blog/vts-volatility-barometer-showing-of-days-in-each-decile-range)
- **Readings in crises (the text gives few exact numbers):**
  - **2011:** "almost 2 months after the market bottomed that the Volatility Barometer dripped below 60% and stayed there".
  - **2015:** took "a couple months to really settle down".
  - **Feb 2018:** "it took a long time for Volatility to settle back down".
  - **Q4 2018:** recovered shortly after the bottom.
  - **Mar 2020:** "several months for the Volatility metrics to normalize".
  - **2022:** "Mostly in the 60's and 70's"; "only breached 80% once". Similar-sized crashes went into the 80s–90s.
  - **2023:** quickly back below 60%.
  - **Aug 2024:** five days after the bottom it was "already getting close to dipping below 60% again". — [Barometer through all market crashes](https://www.volatilitytradingstrategies.com/blog/vts-volatility-barometer-through-all-market-crashes)
  - **Peak readings:** Covid was the record high (100% after rescaling). Apr 2025 tariffs, Volpocalypse, 2015 and 2011 were in the "high 90's percentiles". — [Methodology change](https://www.volatilitytradingstrategies.com/blog/small-change-in-our-vts-volatility-barometer-methodology)
- **Example snapshot:** a 2019 reading was 40.01% with VIX at 14.09 (from the search snippet, not verified on the page). — [VTS blog via search](https://www.volatilitytradingstrategies.com/blog/vts-options-new-trade-example)

### Inferences
- **Percentile construction (reconstruction):** "rolling percentiles", combined with a 5-year warm-up before 2011, suggests each input is percentile-ranked over an expanding or rolling window, and the composite is then a weighted average of those percentiles. This is a reconstruction; VTS has not confirmed it.
- **Why it never hits 0/100:** averaging 13 imperfectly correlated percentiles pulls the composite toward the middle. That explains the old ~13–91% range and the need for a visual rescale.
- **Possible inverted inputs:** "contrarian signals in very low vol" suggests some inputs are deliberately inverted or non-monotonic at extremes, for example a very low VIX counted as risk. This is an inference.

### Gaps
- Names of 9 of the 13 inputs, the weights, and the exact percentile window are all unpublished. They probably sit behind the paywall or in videos (e.g. [YouTube "My VTS Volatility Barometer"](https://www.youtube.com/watch?v=vVLv1fFVOqs), not transcribed).
- No exact numeric Barometer values for Feb 2018, Mar 2020, 2022 or Aug 2024 appear in the text; they are only in chart images.

## 3. Which metrics feed which strategy (different subsets / variants)

### Takeaway
- VTS deliberately runs **three different "barometers"** so that strategies flip at different times ("3 point diversification").
- Assignments changed between 2023 and 2026:
  - **Defensive Rotation** now uses the main Barometer with published thresholds of 20/66/85%.
  - **Tactical Volatility** uses a variant that is about 75% the same and overweights VIX-futures roll yield.
  - **Strategic Tail Risk** uses a variant tilted to mainstream stock-market metrics and Adjusted VIX futures, with less roll yield.

### Cited Findings
- **Current mapping (Oct 2026):**
  - **Defensive Rotation** uses the main Barometer "exactly in order to get its trade signals". Thresholds on the daily reading: below 20% Cash; 20% to below 66% QLD; 66% to below 85% XLU; above 85% Cash.
  - **Tactical Volatility** uses a variant that is "about 75% the same", overweighting "the VIX Futures Roll Yield and a few other metrics". It trades pure vol ETPs.
  - **Strategic Tail Risk** uses an adjusted Barometer that "focuses more on the mainstream stock market metrics, reduces roll yield and overweights Adjusted VIX futures". Its most recent switch was from SPY to KO. — [3 Point Diversification with 3 different Volatility Barometers, 15 Oct 2026](https://www.volatilitytradingstrategies.com/blog/3-point-diversification-with-3-different-volatility-barometers)
- **Earlier mapping (6 Feb 2023), which differs from the current one:**
  - **Strategic Tail Risk** used the full 13-source Barometer directly. "If it says 54% we will be in the S&P 500"; a 56% reading meant cash.
  - **Defensive Rotation** used 5–6 metrics, weighting "VX30:VIX roll yield and Adjusted M1:M2 VIX futures more heavily".
  - **Tactical Balanced** used 5–6 metrics, "with the main weighting going to the VTS Cash VIX Oscillator". — [3 VTS Strategies with 3 Different Volatility Influences](https://www.volatilitytradingstrategies.com/blog/3-vts-strategies-with-3-different-volatility-influences)
- **Third-party description (undated review):**
  - **Strategic Tail Risk:** Barometer 0–55% holds SSO, 55–80% holds IYR, above 80% holds VIXM.
  - **Defensive Rotation:** rotates among VGLT/QLD/XLU/cash and "does not use the Barometer directly".
  - **Tactical Volatility:** cash, long vol or short vol based on metric signals.
  - Also lists a Volatility Trend strategy (VXX butterflies) and an Iron Condor strategy. — [OptionsTradingIQ review](https://optionstradingiq.com/vts-review/)
  - This matches the 2023 VTS post and contradicts the Oct 2026 one, so it reflects the older rules.
- **2020 "VB Threshold" strategy:** quintile ranges, with 20–40% holding SVXY. — [Deciles post](https://www.volatilitytradingstrategies.com/blog/vts-volatility-barometer-showing-of-days-in-each-decile-range)

### Inferences
- **Fast vs slow:** the "fast" equity signals (Strategic Tail Risk, and Defensive Rotation before 2026) lean on cash-VIX and stock-market measures plus Adjusted M1:M2. The "slow" vol-ETP signal (Tactical Volatility) leans on futures roll yield. That fits re-entry speed (section 5): roll yield and contango recover last.
- **Mid-band risk-on:** the 20/66/85 thresholds show risk-on only in a middle band. Readings below 20% (complacency) are treated as risk, which is consistent with the "contrarian inputs" remark.
- **Strategy names:** "Tactical Balanced" (2023) and "Tactical Volatility" may be different strategies; the 2026 post does not mention Tactical Balanced.

### Gaps
- No thresholds are published for the Tactical Volatility or Strategic Tail Risk variants after 2023, and their exact weights are unknown.

## 4. Signal timing, smoothing, confirmation

### Takeaway
Signals come from a once-daily reading. The email goes out before noon ET and the trade can be placed any time that day. No explicit smoothing or N-day confirmation rule is published.

### Cited Findings
- Daily email is sent "before noon Eastern time every trading day". "You can put in the trade any time that trading day." Emails say "zero trades today" when nothing changes. — [OptionsTradingIQ review](https://optionstradingiq.com/vts-review/)
- The CVO is updated "right before I send out my daily email". — [CVO post](https://www.volatilitytradingstrategies.com/blog/vts-cash-vix-oscillator-volatility-dashboard-metric)
- Strategies use the "daily Volatility Barometer"; changes are announced in daily emails. — [3 Point Diversification](https://www.volatilitytradingstrategies.com/blog/3-point-diversification-with-3-different-volatility-barometers)
- Barometer values are daily and shown on 1-year and 3-year charts. — [Regime change Pt 1](https://www.volatilitytradingstrategies.com/blog/volatility-regime-change-and-our-volatility-barometer)

### Inferences
- **Data timing:** an email before noon most likely uses the prior close for futures and cash VIX inputs, possibly with morning data. This is not confirmed.
- **Built-in smoothing:** the composite (13 inputs) and the percentile ranking smooth the signal anyway. Defensive Rotation's thresholds are bare levels with no stated hysteresis.

### Gaps
- Whether the signal uses end-of-day or intraday data, and whether any hysteresis or buffer bands exist, is not stated publicly.

## 5. Re-entry after volatility spikes (follow-up question)

### Takeaway
- **Re-entry is per strategy and staggered on purpose.** VTS does not wait for "all signals risk-on".
- **Defensive Rotation** re-enters on a single composite crossing: the Barometer falling back below 66% moves it from XLU to QLD.
- **Strategic Tail Risk** re-enters fastest and does not need contango.
- **Tactical Volatility** is slowest and waits for "a healthy level of Contango" in VIX futures.
- **The 60% level** is VTS's informal "volatility has settled" line. In 2022 and Aug 2024 the Barometer came back near or below it within days of the bottom. In 2011, 2018 and 2020 it took months.

### Cited Findings
- **Staggered re-entry (21 May 2025, after the Apr 2025 spike):**
  - **Tactical Volatility (SVXY, −0.5x)** waits "until the VIX futures term structure is back into a healthy level of Contango". That is why it is the slowest.
  - **Defensive Rotation (QLD)** waits "slightly longer to get back in, just in case there are follow up dips".
  - **Strategic Tail Risk** (SPY, recently BRK/B): "We don't have to wait until the VIX futures are well into Contango."
  - Rationale: vol ETPs have deeper drawdowns, so a more conservative re-entry is affordable.
  - Status at the time: SPY was "only 5% away from all time highs", QLD "about 20% away", and SVXY still "55% away from breaking even". VIX "got back into the teens" after "the fastest Volatility decline in history". — [Short Volatility SVXY can crash a lot more than Stocks](https://www.volatilitytradingstrategies.com/blog/short-volatility-svxy-can-crash-a-lot-more-than-stocks)
- **Current mechanical re-entry for Defensive Rotation:** the Barometer moves from the 66–85% band (XLU) or above 85% (Cash) back to 20–66% (QLD). — [3 Point Diversification](https://www.volatilitytradingstrategies.com/blog/3-point-diversification-with-3-different-volatility-barometers)
- **2023 rule for Strategic Tail Risk:** a single Barometer level, with 54% meaning in and 56% meaning cash, i.e. a one-point flip with no buffer. — [3 VTS Strategies](https://www.volatilitytradingstrategies.com/blog/3-vts-strategies-with-3-different-volatility-influences)
- **Re-entry speed by episode (Barometer recovery):**
  - **2022:** "it also didn't take long after the market bottomed for us to get back into trades".
  - **Aug 2024:** five days after the bottom, close to dipping below 60%.
  - **2011:** about 2 months after the bottom before it settled below 60%.
  - **Feb 2018:** "a long time".
  - **Mar 2020:** "several months".
  - VTS says it optimises "for what happens 9 out of 10 times". — [Barometer through all market crashes](https://www.volatilitytradingstrategies.com/blog/vts-volatility-barometer-through-all-market-crashes)
- **Exit before Volpocalypse:** VTS says its vol strategies had moved to cash before the 2018 Volpocalypse. — [CVO post](https://www.volatilitytradingstrategies.com/blog/vts-cash-vix-oscillator-volatility-dashboard-metric)
- **Feb 2023 example of staggering:** Tactical Balanced exited DDM for two days (its first exit in over two months) while Defensive Rotation's QLD position stayed. — [3 VTS Strategies](https://www.volatilitytradingstrategies.com/blog/3-vts-strategies-with-3-different-volatility-influences)

### Inferences
- **Answer to the user's concern:** VTS avoids the "wait for everything" lag in two ways:
  1. Each strategy acts on one composite crossing a level, not on unanimity among signals.
  2. The composites differ: Strategic Tail Risk underweights roll yield so it re-enters early, and Tactical Volatility overweights roll yield so it re-enters late.
- **The trade-off is accepted on purpose.** The vol-ETP strategy is intentionally late (contango required). Fast equity re-entry carries follow-up-dip risk, which Defensive Rotation's "slightly longer" wait partly addresses.
- **The wait is level-based, not a timer.** "Waiting longer" probably comes from where the threshold sits and from roll-yield weighting, not from an explicit N-day rule. This is inferred; no confirmation period is published.

### Gaps
- No exact re-entry dates or holdings are documented for Feb 2018, Mar 2020, Aug 2024 or Apr 2025. The "healthy level of contango" threshold is not quantified. No explicit confirmation or waiting-period rule appears in public posts; it may be in subscriber emails or videos.
