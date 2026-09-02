# Liability protection for a paid nowcast alert app

Researched 2026-09-02. Not legal advice; a Polish lawyer must review the clauses. Web search was unavailable to the researcher, so sources are primary pages fetched directly; **[unverified]** marks items that could not be confirmed.

## 1. EU Product Liability Directive (EU) 2024/2853

- **Software is a product.** The Commission: "all types of software are covered ... including applications"; damage includes "destruction or corruption of data"; liability runs 10 years (25 for latent injury). In force 8 Dec 2024, transposition by 9 Dec 2026, applies to products placed on the market **from 9 Dec 2026** ([Commission](https://single-market-economy.ec.europa.eu/single-market/goods/free-movement-sectors/liability-defective-products_en), [EP legislative train](https://www.europarl.europa.eu/legislative-train/theme-a-europe-fit-for-the-digital-age/file-new-product-liability-directive)). Recitals make software a product regardless of supply mode, so SaaS delivery counts; push/hosting is a "related service" treated as a component under the manufacturer's control ([text](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=OJ:L_202402853)).
- **Information is not a product.** Recitals exclude "mere information" (files, e-books, source code as such). My reading **[unverified]**: a wrong forecast is information; a crashed pipeline, stale-radar bug or silent permission failure is a software defect.
- **FOSS exclusion ends with monetisation.** Art. 2(2) excludes free/open-source software outside commercial activity; recital 14 treats supply for a price or for personal data (beyond security/compatibility) as commercial. GROM Plus at 50 zł/yr ends the exclusion even if the code stays public.
- **Defect** = below the safety the public is entitled to expect, judged on presentation and instructions, foreseeable use and misuse, updates and learning, cybersecurity, and failure to supply updates under the manufacturer's control (art. 7). Warnings alone do not cure a defect (EP page). Damage: death, injury incl. recognised psychological harm, private property (exclusively professional property excluded, art. 6), data loss. €500 threshold and €70m cap removed; presumptions of defect/causation where proof is excessively difficult (art. 10). Contract clauses cannot exclude it.
- **Development-risk defence** stays (art. 11(1)(e)); states may derogate (art. 18). Poland already has it in art. 449³ §2 KC.
- **Polish transposition:** art. 449¹ §2 KC still defines product as a *rzecz ruchoma*, so software is outside strict liability until the new law. No published draft confirmed (legislacja.gov.pl and gov.pl rejected fetches) **[unverified]**; check the RM legislative list for "2024/2853".
- **Implication:** from 9 Dec 2026 a consumer hurt by a *defective app* (not by an unpredictable storm) has an uncapped strict-liability claim. Answer with product-quality evidence (logs, tests, update discipline) and insurance, not terms.

## 2. Polish law on private warnings

- No statute covers private weather warnings. Official warnings are a statutory task of IMGW-PIB (*państwowa służba hydrologiczno-meteorologiczna*, Prawo wodne art. 370 ff. **[number unverified]**) and RCB. That anchors "GROM supplements, never replaces".
- **Obligation of means.** A nowcast subscription is a services contract (art. 750 KC), classically *zobowiązanie starannego działania*: due diligence at professional standard (art. 355 §2 KC), not a guaranteed result. Art. 471 KC: liability for improper performance unless caused by circumstances the debtor does not answer for; art. 472: by default the debtor answers for lack of due diligence. Never excludable: intentional harm (art. 473 §2), consumer personal injury (art. 385³ pkt 1), *material* limitation for non-performance toward consumers (art. 385³ pkt 2). The word *istotnie* leaves room for a modest, reasoned cap; an exclusion is out. No Polish case on a forecast provider found **[no search possible]**; treat as strong doctrine, not settled law.
- **Contributory negligence** (art. 362 KC): damages fall if the user ignored IMGW/RCB, stayed out after "alerts paused", or disabled notifications. Every UI state that records user knowledge helps.
- **Force majeure:** loss of IMGW radar, FCM/APNs or a cloud region is outside your control if you show reasonable redundancy and prompt status communication. A clause may describe this; it cannot cover your own negligence.
- **Cases (all against public bodies; none against a private app):** L'Aquila 2012, manslaughter convictions for "falsely reassuring" statements, not for failing to predict; six acquitted 2014, confirmed 2015; De Bernardinis' conviction stood ([Wikipedia](https://en.wikipedia.org/wiki/2009_L%27Aquila_earthquake)). Ahrweiler 2021: Landrat Pföhler investigated for negligent homicide over late warnings; no charges, April 2024 ([de.wikipedia](https://de.wikipedia.org/wiki/Hochwasser_in_West-_und_Mitteleuropa_2021)). Xynthia 2010: mayor of La Faute-sur-Mer convicted 2014 for failing to warn, reduced on appeal 2016 **[unverified today]**. US: Brown v. United States, 599 F.2d 1121 (1st Cir. 1979) reversed NWS liability for a failed buoy **[unverified today]**. No successful missed-warning suit against AccuWeather or Dark Sky is known; their litigation concerned location data. Lesson: over-confident "all clear" wording is the real exposure.

## 3. Terms structure that works (B2C)

Write description of the service, not exclusion of liability:

1. **Service defined as an estimate**: radar extrapolation, minutes-scale horizon, "cells can form on the spot".
2. **User duties as conditions**: notifications on, app updated, location granted, official IMGW/RCB warnings prevail. These feed art. 362 and the conformity test (art. 43h ff. u.p.k.).
3. **Delivery caveat**: dispatch with due diligence is promised; receipt depends on OS, network and device settings.
4. **Liability**: no exclusion; general rules apply; cap only *ordinary negligence* claims for *property/financial* loss (e.g. greater of 12 months' fees or 500 zł), expressly excluding injury, intent and gross negligence. Highest UOKiK risk; the register holds many "nie ponosi odpowiedzialności" entries ([register](https://www.rejestr.uokik.gov.pl/), fetch refused today).
5. **Force majeure** naming IMGW radar and push services, with a status-page duty.
6. **Complaints** channel, 14-day answer, withdrawal rights, fixed term with clear renewal.
7. **B2B**: separate contract with SLA (availability, alert-latency target, monthly report), "supplementary tool" clause, mutual cap at 12 months' fees, no consequential loss. Art. 385³ does not apply between businesses; only art. 473 §2 limits you.

## 4. Insurance

- **Leadenhall OC zawodowe, "OC Konsultantów IT" variant**: professional errors, defence costs, GDPR breaches, IP/confidentiality, incident response; limits to 2 mln zł; from 402 zł/yr; sold to B2B contractors, so a JDG qualifies ([Leadenhall](https://leadenhall.com/products/oc-zawodowe)).
- **Colonnade PI IT EXPRESS**: IT Errors & Omissions bought online; limits and premiums only in the product-card PDFs ([form](https://express.colonnade.pl/formularz/)).
- PZU, Warta, Hestia, Allianz general "OC działalności" usually excludes pure financial loss and software errors without an IT E&O clause **[pages not fetched]**.
- Two gaps to ask a broker in writing: bodily injury caused by a software error (falls between E&O and general OC), and "OC za produkt" naming software for the new PLD.
- **Działalność nierejestrowana**: forms ask for NIP/REGON; expect to need a registered business **[unverified]**. Budget 500–2,000 zł/yr for a 0.5–1 mln zł limit **[estimate]**.

## 5. Corporate shield

| Form | Setup | Running cost/yr | Shield |
|---|---|---|---|
| JDG | free | ZUS 2026: 1,926.76 zł/mo social (base 5,652 zł) + health min 432.54 zł/mo ≈ 28 k zł full, less on ulga na start / Mały ZUS Plus ([biznes.gov.pl](https://www.biznes.gov.pl/pl/portal/00274)); books 1.5–3 k zł | none |
| sp. z o.o., 1 person | 5,000 zł capital, S24 without notary ([Wikipedia PL](https://pl.wikipedia.org/wiki/Sp%C3%B3%C5%82ka_z_ograniczon%C4%85_odpowiedzialno%C5%9Bci%C4%85)) | sole shareholder pays ZUS like a sole trader, no preferential rate (same source) ≈ 28–33 k zł; full accounting 5–10 k zł **[market range]**; CIT 9% then 19% on dividends | shareholder shielded; board liable under art. 299 KSH if insolvency filing is late |
| PSA | 1 zł capital, S24 250 + 100 zł ([biznes.gov.pl](https://www.biznes.gov.pl/pl/portal/00168)) | as sp. z o.o.; fewer accountants know it | as sp. z o.o. |

Practitioner rule **[unverified]**: solo devs incorporate when B2B contracts carry real damages exposure or profit passes ~200–300 k zł/yr. For GROM the trigger is the first marina or event licence, not revenue. A one-person sp. z o.o. does not remove ZUS.

## 6. Design measures

- **Delivery ledger**: every alert with timestamp, radar-frame age, ETA, push receipt, device state. This is the art. 471 and PLD-presumption defence file.
- **"Alerts paused" surfaced loudly**: permission revoked, battery saver, radar older than 10 min, quiet hours, no location; persistent banner plus one push "GROM is not watching your pin".
- **Test-alert button, status page with data freshness, monthly verification score** (hit rate, false alarms, lead time). Honest scores set the "reasonably expected" bar.
- **Copy that names limits** ("radar echo extrapolation, cells can form on the spot, no lightning detection"); never an "all clear", only "no echoes within X km now". Separate urgency, severity, certainty and expiry as in [OASIS CAP 1.2](https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2-os.html); ISO 22322 (public warning guidelines) for structure **[not fetched]**.
- **Dated onboarding acknowledgement**, repeated on major changes.
- **B2B**: "supplementary tool, not a safety system; the client keeps its own watch and official-warning procedures".

## 7a. Checklist, cheapest first

1. Limit-naming copy, UI paused states, onboarding acknowledgement (hours).
2. Delivery ledger, status page, test alert, verification score (days).
3. Regulamin with the clauses below, lawyer-reviewed (1–3 k zł).
4. OC zawodowe IT / E&O policy (from ~402 zł/yr).
5. B2B template with SLA and cap (2–4 k zł).
6. sp. z o.o. or PSA (setup under 1 k zł; ~35–45 k zł/yr incl. ZUS and accounting).
7. PLD readiness before 9 Dec 2026: update policy, security patching, documented tests.

## 7b. Draft clauses (a Polish lawyer must review)

1. **Charakter usługi.** "GROM dostarcza szacunkowe prognozy krótkoterminowe oparte na ekstrapolacji obrazów radarowych IMGW-PIB. Prognozy mają charakter orientacyjny; komórki burzowe mogą powstawać, zanikać i zmieniać kierunek w sposób nieprzewidywalny. Usługa nie zastępuje ostrzeżeń IMGW-PIB ani Alertów RCB, które mają pierwszeństwo."
2. **Warunki działania powiadomień.** "Dostarczenie powiadomienia zależy od ustawień urządzenia, systemu operacyjnego, usług push Apple/Google oraz łączności. Użytkownik utrzymuje włączone powiadomienia i lokalizację oraz aktualną wersję aplikacji. W stanie „alerty wstrzymane” GROM nie monitoruje lokalizacji."
3. **Należyta staranność.** "Usługodawca świadczy usługę z należytą starannością wymaganą od profesjonalisty (art. 355 § 2 KC). Nie gwarantuje, że każde zjawisko zostanie wykryte ani że powiadomienie dotrze przed jego wystąpieniem."
4. **Odpowiedzialność.** "Usługodawca odpowiada na zasadach ogólnych. Regulamin nie wyłącza ani nie ogranicza odpowiedzialności za szkody na osobie, za szkody wyrządzone umyślnie lub wskutek rażącego niedbalstwa ani uprawnień konsumenta z ustawy o prawach konsumenta. W pozostałym zakresie odpowiedzialność za szkody majątkowe wynikłe z niedbalstwa zwykłego ogranicza się do opłat za ostatnie 12 miesięcy, nie mniej niż 500 zł." *(highest UOKiK risk; lawyer may drop the cap)*
5. **Siła wyższa i źródła zewnętrzne.** "Usługodawca nie odpowiada za niewykonanie usługi wskutek okoliczności, za które nie ponosi odpowiedzialności, w szczególności przerw w dostępności danych radarowych IMGW-PIB lub usług push. O przerwach informuje na stronie statusu."
6. **Reklamacje.** "Reklamacje: [e-mail]. Odpowiedź w 14 dni. Konsument może korzystać z pozasądowego rozwiązywania sporów."

**B2B.** "Serwis GROM jest narzędziem pomocniczym i nie stanowi systemu bezpieczeństwa ani systemu ostrzegania w rozumieniu przepisów o zarządzaniu kryzysowym. Klient utrzymuje własne procedury obserwacji pogody i stosowania ostrzeżeń IMGW-PIB/RCB. Łączna odpowiedzialność Usługodawcy ogranicza się do wynagrodzenia za 12 miesięcy; wyłącza się utracone korzyści; ograniczenie nie dotyczy winy umyślnej."
