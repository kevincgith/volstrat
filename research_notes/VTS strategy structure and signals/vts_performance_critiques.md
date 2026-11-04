# VTS (volatilitytradingstrategies.com): published performance and independent evaluation

Research date: 2026-11-04. Scope: VTS's own claims vs independent and user evidence. Constraint encountered: web.archive.org could not be fetched by the research tool, and Seeking Alpha and Bogleheads returned HTTP 403. The VTS portfolio page shows its performance only as embedded images, which the text extractor could not read. So **no year-by-year VTS figures could be pulled from primary pages in this pass**. Every number below is attributed to the party that made it.

Extra focus requested by the user: does the "total portfolio" return look too good? Is it aggressive in calm regimes while avoiding drawdowns? These points are covered under Q1 to Q4 below, under the headings "Return sources/exposure", "Live vs backtest", "Red flags" and "Total-portfolio computation".

---

## Q1. Per-strategy published returns, drawdowns, live vs backtest, and computation method

### Takeaway
VTS publishes its performance as images (screenshots or charts) on its Portfolio page. It says the figures come from "live trades" sent to members in daily emails, net of trade fees and including dividends. I could not read any yearly figures as text. The only quantified VTS claims found second-hand were these, from an Aug 2023 review quoting a Brent Osachoff video: the iron condor strategy averaged about 18%/yr over 10+ years, its max monthly drawdown was 15%, and its three largest drawdowns averaged 11%. The site gives no stated methodology for fill prices or slippage, and its disclaimer is silent on hypothetical vs actual results.

### Cited Findings
- **Live-trade claim.** The VTS Portfolio page (fetched 2026-11-04) says performance is tracked from live trades sent to paying members in daily emails, and that it includes trade fees and dividends. The actual numbers are in three embedded images that could not be read as text. — [VTS Portfolio](https://www.volatilitytradingstrategies.com/portfolio)
- **What the page names.** The Portfolio page (2026-11-04) describes a "Total Portfolio Solution" that uses all three strategies, yet it says "5 tactical strategies" elsewhere, so the count is internally inconsistent. Instruments named: VXX, UVXY, the Nasdaq index, utilities, gold, cash and "CAOS positions". No allocation weights are given. — [VTS Portfolio](https://www.volatilitytradingstrategies.com/portfolio)
- **Launch date.** The FAQ (2026-11-04) says VTS launched in January 2012. — [VTS FAQ](https://www.volatilitytradingstrategies.com/faq)
- **FAQ on sizing and risk.** The FAQ (2026-11-04) suggests that accounts under $5,000 hold 50% Tactical Volatility and 50% Defensive Rotation or Strategic Tail Risk. Above $10,000 it says to follow all strategies, and it warns that deviating from the recommended allocations makes the correlations less reliable. It also states "we don't short anything or use any undefined risk options." It gives no methodology for computing performance. — [VTS FAQ](https://www.volatilitytradingstrategies.com/faq)
- **Disclaimer.** The Disclaimer page (2026-11-04) offers only boilerplate: "Past performance is not indicative of future results". It says the author is "not licensed and registered under security laws" and does "not hold myself out as a financial advisor". It says nothing about hypothetical or backtested results, fill prices, slippage or fees. — [VTS Disclaimer](https://www.volatilitytradingstrategies.com/disclaimer)
- **Iron condor claims (VTS, via a reviewer).** OptionsTradingIQ (Gavin, 2023-08-22) quotes a Brent video: the iron condor strategy averaged about 18% per year over 10+ years, with a 15% max monthly drawdown and an 11% average of the three largest drawdowns. The review gives no year-by-year figures. — [OptionsTradingIQ VTS Review](https://optionstradingiq.com/vts-review/)
- **Strategy structure as of 2023-08.** The same review lists five strategies at 20% each:
  - **Defensive Rotation:** rotates among VGLT, QLD (2x Nasdaq), XLU and cash; it holds cash when volatility is extreme.
  - **Tactical Volatility:** cash, long volatility or short volatility, depending on the signal.
  - **Strategic Tail Risk:** driven by the VTS Volatility Barometer. It holds SSO when the Barometer reads 0-55%, IYR at 55-80%, and VIXM above 80%.
  - **Volatility Trend:** short volatility through defined-risk structures such as directional butterflies on VXX.
  - **Iron Condor:** 15-delta condors at about 2 months to expiry, no adjustments, 50%-of-credit take-profit and a mental stop. It uses SPY-type ETFs, holds up to 3 layers, and switches to calendars when volatility is low.

  — [OptionsTradingIQ VTS Review](https://optionstradingiq.com/vts-review/)
- **Signal timing.** The daily email goes out before noon ET, and subscribers can trade any time that day (OptionsTradingIQ, 2023-08-22). Any reported performance therefore depends on which price is assumed for the fill, and the site states none. — [OptionsTradingIQ VTS Review](https://optionstradingiq.com/vts-review/)

### Inferences
- The two time anchors (signals emailed before noon, fills at the subscriber's discretion) mean that "live" performance must use some reference price. The site does not say whether that is the email-time price, the open or the close. For vol ETPs such as UVXY, which can move several percent intraday, this choice can materially change results.
- Under the 2023 structure, at the 20% weights, roughly 40% of the portfolio was in strategies that can be short volatility (Tactical Volatility when short, plus Volatility Trend). Another 20% to 40% can be in 2x leveraged equity (QLD in Defensive Rotation, SSO in Strategic Tail Risk) when the Barometer reads calm. This is consistent with the user's sense that the portfolio is "aggressive when calm". The figure is an inference from the published rules, not a disclosed exposure number.

### Gaps
- No per-strategy or total-portfolio returns by year were extracted. They exist only as images on the Portfolio page, and the archive snapshots needed to compare them over time were inaccessible. Recommended next step: view the images manually, then check the web.archive.org snapshots of /portfolio for 2016, 2018, 2019, 2021, 2023 and 2025.
- I found no stated CAGR, total-portfolio max drawdown or Sharpe ratio in text form.
- I found no statement of the fill-price convention (email-time, open or close) or of slippage assumptions.

---

## Q2. Behaviour in stress events (Feb 2018, Q4 2018, Mar 2020, 2022, Aug 5 2024, Apr 2025)

### Takeaway
I found no VTS-published, event-specific figures in text form. The only claims about crash avoidance come from users: a 5-star Trustpilot reviewer (2021-11) says the service avoided the 2018 and 2020 crashes. A 1-star reviewer reports losing about 40% from Sep 2022, against VTS's reported -19%. One commenter claims a Jan 2018 to Oct 2024 CAGR of 8.90% vs SPY's 10.49%. None of these is independently verified.

### Cited Findings
- **Positive user claim.** Trustpilot, Jock Friedly, 5/5, 2021-11-14: says the service beat the S&P consistently and avoided the major crashes of 2018 and 2020. The review cites no trade records and is not marked verified. — [Trustpilot](https://uk.trustpilot.com/review/www.volatilitytradingstrategies.com)
- **Negative user claim on 2022.** Trustpilot, Maxwell Briggs, 1/5, 2023-05-05:
  - subscribed in September 2022 and was down about 40%;
  - over the same period VTS reported about -19%;
  - when he asked for the buy and sell prices behind the gap, he was refused;
  - he says: "I believe that his numbers are made up".

  Unverified. — [Trustpilot](https://uk.trustpilot.com/review/www.volatilitytradingstrategies.com)
- **Commenter return claim.** Comment by "Tim Sheehan" on the OptionsTradingIQ review: Brent's CAGR from Jan 2018 to Oct 2024 was 8.90%, vs SPY 10.49% and VBINX 8.05%. Unverified, and the comment does not show its method. — [OptionsTradingIQ VTS Review (comments)](https://optionstradingiq.com/vts-review/)
- **Feb 2018 context (VTS-linked material, as summarized by search).** On 2018-02-05 the VIX rose more than 110% and XIV lost more than 90% of its value, largely through after-close rebalancing, and XIV was terminated afterwards. I did not verify this against a neutral source in this pass, though the event itself is well documented. — Source: a search summary, so no URL can be cited here.

### Inferences
- Even taken at face value, the 8.90% CAGR claim for 2018-2024 would mean underperformance vs SPY over a window that includes Feb 2018, Q4 2018, Mar 2020 and 2022. If accurate, that undercuts any "too good" impression for the period after 2018. The strong headline numbers, if they exist, would then come mainly from 2012-2017, a calm, contango-rich era.
- The gap of about 21 points in the 2022 account (subscriber -40% vs VTS -19%) points either to execution and fill differences, to timing (the subscriber starting mid-signal), or to reported numbers that do not reflect achievable trades. The evidence cannot tell these apart.

### Gaps
- I found no VTS figures for Aug 5 2024 or Apr 2025. The 2026 blog listing (Aug-Oct 2026) holds no event retrospectives, and the 45 pages of older posts were not reviewed.
- I could not determine whether VTS held short-vol positions entering Feb 5 2018, Aug 2 2024 or Apr 3 2025.

---

## Q3. Strategy changes after losses (curve-fitting and survivorship signals)

### Takeaway
There is circumstantial evidence of a shifting strategy roster and less granular reporting, but nothing documented as a rule change made after a loss. Several accounts give different strategy counts: the 2023-08 review lists five strategies at 20% each, while the current site says "3" and "5" in different places. One forum poster alleges VTS stopped reporting individual strategies. New products appeared in 2026: a Bitcoin "Breakpoint" strategy, gold as the "safety position", and "3 different Volatility Barometers".

### Cited Findings
- **Five strategies in 2023.** OptionsTradingIQ (2023-08-22) lists five strategies at 20% each: Defensive Rotation, Tactical Volatility, Strategic Tail Risk, Volatility Trend and Iron Condor. — [OptionsTradingIQ](https://optionstradingiq.com/vts-review/)
- **Home page in 2026.** The home page (2026-11-04) lists Long/Short Volatility ETFs, Iron Condor Options, VXX/UVXY Butterfly Options and a Stock Replacement Strategy, and mentions "3 Tactical Strategies". — [VTS Home](https://www.volatilitytradingstrategies.com/)
- **Portfolio page in 2026.** The Portfolio page (2026-11-04) says the "Total Portfolio Solution" uses all three strategies, but refers to "5 tactical strategies" elsewhere. — [VTS Portfolio](https://www.volatilitytradingstrategies.com/portfolio)
- **2026 blog titles that suggest new or changed components:**
  - "Ep.137 - My Bitcoin Breakpoint Strategy | Why Gold is our Safety position?" (2026-10-30)
  - "3 Point Diversification with 3 different Volatility Barometers" (2026-10-15)
  - "Ep.134 - Bull / Bear market ready Strategic Tail Risk Strategy" (2026-09-18)
  - "Ep.136 - SVXY vs SVIX: Is 'Short Vol' leverage worth it?" (2026-10-23)

  — [VTS Blog](https://www.volatilitytradingstrategies.com/blog)
- **Change in safe asset.** The 2023 rules used VGLT, XLU and cash as defensive assets. The 2026 Portfolio page names gold and cash (2026-11-04). This suggests a change in the defensive leg, though its timing is unknown. — [OptionsTradingIQ](https://optionstradingiq.com/vts-review/); [VTS Portfolio](https://www.volatilitytradingstrategies.com/portfolio)
- **Bogleheads allegation (via search summary; page returned 403).** A poster says Osachoff stopped reporting performance on individual strategies and reports only the whole portfolio, which in the poster's view hides strategies that are heavily down. The post date was not retrieved. — [Bogleheads thread t=324670](https://www.bogleheads.org/forum/viewtopic.php?t=324670)

### Inferences
- The strategy count has gone 5 → 3 (or 3 + options), the defensive assets have changed (bonds/utilities → gold), and new barometers and Bitcoin have been added. Together these make it hard to know whether a "total portfolio since 2012" curve reflects one consistent rule set. If earlier years are shown under today's rules, those years are effectively backtests.
- Reporting only at the portfolio level is a known way to mask how individual strategies have done. This is a red flag worth checking against archived pages.

### Gaps
- I did not establish the dates of rule changes, renamings or dropped strategies. Archive.org comparison is needed.
- I could not see the full Bogleheads thread (403).

---

## Q4. Independent reviews, forums, subscriber experiences, pricing

### Takeaway
Independent coverage is thin and polarized. There is one fairly favourable educational review (OptionsTradingIQ, 2023), whose commenters allege backtested or unrealistic numbers. Trustpilot has three reviews averaging 2.8: two 1-star reviews alleging simulated or fabricated results, and one 5-star review. A Bogleheads thread is sceptical. I found no Reddit or Elite Trader threads specifically about VTS. Current pricing is $89 a month or $849 a year.

### Cited Findings
- **Pricing.** The Subscribe page (2026-11-04) lists:
  - $89/month with a 2-week free trial;
  - $849/year at a stated 20% discount, with annual plans not refundable;
  - a price lock for as long as the subscription is held.

  — [VTS Subscribe](https://www.volatilitytradingstrategies.com/subscribe)
- **Earlier price.** A commenter on OptionsTradingIQ (circa 2023-2024) cited a $1,000 annual fee, which the review itself did not confirm. — [OptionsTradingIQ](https://optionstradingiq.com/vts-review/)
- **Trustpilot overview.** Three reviews, average 2.8, none labeled verified (fetched 2026-11-04). — [Trustpilot](https://uk.trustpilot.com/review/www.volatilitytradingstrategies.com)
  - **Farah, 1/5, 2025-07-29:** claims the operator "only did simulated accounts" and resisted requests for proof of real trades.
  - **Maxwell Briggs, 1/5, 2023-05-05:** reports -40% for himself vs -19% reported by VTS from Sep 2022, and says trade prices were refused.
  - **Jock Friedly, 5/5, 2021-11-14:** praises a diversified "five-bucket" approach that beat the S&P and avoided the 2018 and 2020 crashes.
- **OptionsTradingIQ's assessment (Gavin, 2023-08-22).**
  - Praise: rules-based and non-discretionary, a good iron condor course, an attractive return-to-drawdown ratio.
  - Caveats: the reviewer disagrees with the no-adjustment stance, and calls shorting volatility dangerous without expertise.
  - The review does not address backtest vs live.

  — [OptionsTradingIQ](https://optionstradingiq.com/vts-review/)
- **OptionsTradingIQ commenters (unverified).**
  - "Tom" says the website portfolio chart is backtested, not what subscribers got, and cites a VTS blog post on "real performance vs backtests".
  - Another commenter alleges that people who dispute the numbers get blocked.
  - Other comments contain personal accusations and counter-defenses.

  — [OptionsTradingIQ](https://optionstradingiq.com/vts-review/)
- **Seeking Alpha.** Brent Osachoff has a Seeking Alpha author profile (contributor since 2018, "Long/Short Equity", 7 analysis articles). The article list could not be loaded. — [Seeking Alpha author page](https://seekingalpha.com/author/brent-osachoff)
- **Methodology critique from a different vendor.** An Elite Trader thread about a different vendor (tradingvolatility.net) notes that backtests using 4:00pm closes for XIV, VXX and ZIV, which settle at 4:15pm, can distort results. This is general methodology context and is not about VTS. — [Elite Trader](https://elitetrader.com/et/threads/tradingvolatility-net-reviews.313864/)

### Inferences
- The two most serious independent critiques are the same in substance: reported results cannot be reproduced from actual fills, and the operator refuses to share trade-level prices. These are user allegations, not audited findings. Still, VTS publishes no auditable trade log (timestamped entries and exits), so these critiques remain unrebutted in public material.
- The sample size is very small (3 Trustpilot reviews, one review article), so neither the praise nor the criticism is statistically meaningful.

### Gaps
- I found no Reddit (r/VIXTrading, r/options) or X/Twitter threads on VTS in the searches run.
- There is no third-party verified track record (Collective2, audited statements or a broker-linked account) of any kind.
- I could not retrieve the VTS blog post referenced on "real performance vs backtests".

---

## Q5. How VTS frames risk, and the user's "too good" concern

### Takeaway
VTS frames risk around diversification and correlation across buckets, a volatility "Barometer" that steps exposure down as volatility rises, and the claim that it uses no shorting and no undefined-risk options. It does not publish position-level exposure caps for short-vol ETPs in the material reviewed. Its returns plausibly come from leveraged long equity and short-vol exposure in calm regimes, with rotation to cash, gold or long-vol in stress. Whether it truly sidestepped Feb 2018, Mar 2020, Aug 2024 and Apr 2025 in real time is unverified.

### Cited Findings
- **Defined-risk framing.** The FAQ (2026-11-04) says the strategies use liquid US ETFs and "we don't short anything or use any undefined risk options". — [VTS FAQ](https://www.volatilitytradingstrategies.com/faq)
- **Short volatility via inverse ETPs.** VTS publishes crush/surge levels for VXX, UVXY, UVIX, SVXY and SVIX (2023-08 review). The 2026 blog discusses SVXY vs SVIX leverage (2026-10-23). This implies that short-vol exposure is taken by buying inverse ETPs, which is technically "not shorting" but still carries overnight gap risk. — [OptionsTradingIQ](https://optionstradingiq.com/vts-review/); [VTS Blog](https://www.volatilitytradingstrategies.com/blog)
- **Calm-regime leverage.** Strategic Tail Risk holds SSO (2x S&P) when the Barometer reads 0-55%, and Defensive Rotation can hold QLD (2x Nasdaq) (2023-08). — [OptionsTradingIQ](https://optionstradingiq.com/vts-review/)
- **Strategy-level warnings.** OptionsTradingIQ says Brent "often reminds people" that short volatility is dangerous if you do not know what you are doing (2023-08). — [OptionsTradingIQ](https://optionstradingiq.com/vts-review/)
- **Marketing framing.** The Subscribe page (2026-11-04) says "the true benefits and outperformance come as we navigate through difficult market environments over time". — [VTS Subscribe](https://www.volatilitytradingstrategies.com/subscribe)

### Inferences (addressing the user's four-part focus)
1. **Where the return comes from.** Based on the 2023 rules, in calm regimes roughly 20-40% of capital may sit in 2x equity ETFs (SSO and QLD) and about 20-40% in short-vol positions: inverse vol ETPs such as SVXY or SVIX through Tactical Volatility, and VXX butterflies through Volatility Trend. A further 20% is in iron condors, which are also short volatility. Net short-vol and leverage exposure in calm regimes could therefore be high, with stress-regime switching to cash, VGLT/XLU/gold, VIXM or long-vol. These are inferences from the rules, not disclosed exposure figures.
2. **Live vs backtested.** VTS asserts that results come from live emailed signals, but there are two problems:
   - a VTS-referenced post (per a commenter) discusses backtests vs real performance;
   - two users allege simulated or unreproducible results.

   I found no evidence either way on whether the big 1-day shocks were avoided in real time. Signals arrive by midday email, so a signal can only react after the shock day's open, or to the prior day's close. A position held into an overnight shock, such as the after-hours XIV collapse of 2018-02-05 or the Asia-session spike on 2024-08-05, could not have been exited by a midday signal.
3. **Red flags.** In order of importance:
   - the reporting appears to be portfolio-level only (alleged);
   - the strategy count and defensive assets have changed (5 → 3; bonds/utilities → gold) with no change log found;
   - no fill-price, slippage or overnight-gap methodology is published;
   - no third-party or audited record exists;
   - a subscriber reports a large gap from his own results (-40% vs -19%, 2022-23);
   - a commenter's 2018-2024 CAGR of 8.90% is below SPY's 10.49%, which would imply the strong long-run figure leans on 2012-2017.

   I found no direct evidence of a cherry-picked start date, but the "since 2012" framing includes an unusually favourable short-vol period for which VTS's live status is unproven.
4. **How the "total portfolio" is computed.** It is a blend: five strategies at 20% each per the 2023 review, and "all three strategies" per the 2026 Portfolio page. The rebalancing frequency and the treatment of cash between signals are not disclosed in the text I could access.

### Gaps
- No disclosed exposure levels, rebalancing rules or blend math.
- No real-time signal archive for 2018-02-05, 2020-03, 2024-08-05 or 2025-04 was found.
- Archive comparison of the claimed numbers was not possible in this pass, because web.archive.org was blocked for the fetch tool.
