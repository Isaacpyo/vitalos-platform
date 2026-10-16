---
title: "The NHS single patient record: what trusts and suppliers should build toward now"
slug: nhs-single-patient-record-interoperability
format: Executive briefing
authors: [Vitalos]
publish_date: 2025-10-14
topics: [Digital transformation, Data]
sectors: [Health & Care]
practice: Consulting
featured: false
excerpt: "The 10 Year Health Plan promises a single patient record in the NHS App from 2028. The national detail is still to come, but the interoperability choices made today will decide who is ready."
seo_title: "NHS single patient record: how to prepare now"
seo_description: "The NHS single patient record reaches the NHS App from 2028. What trusts, ICBs and health tech suppliers should build toward today."
focus_keyword: NHS single patient record
secondary_keywords: [10 Year Health Plan, NHS App, NHS interoperability, FHIR UK Core, health data integration]
cta_label: Talk to Vitalos
cta_href: /contact
reading_minutes: 5
---

Ask anyone who has worked a shift in the NHS about records and you will hear the same story. The patient knows their history. The GP knows part of it. The hospital knows another part. The community team, the pharmacy and the social worker each hold a fragment. Everyone spends time re-asking questions that have already been answered somewhere else.

The government's 10 Year Health Plan, published on 3 July, wants to end that. Its digital centrepiece is the **NHS single patient record**: one place that brings together a patient's medical records and relevant context, described as a "patient passport" that follows people wherever they are treated. From 2028, subject to parliamentary time, patients will be able to view it in the NHS App ([Pulse, 4 July 2025](https://www.pulsetoday.co.uk/news/clinical-areas/cardiovascular/single-patient-record-to-become-available-via-nhs-app-by-2028/)).

It is an ambitious promise. It is also, at this stage, light on technical detail. That is exactly why the next two years matter.

## What the plan actually commits to

According to the plan, the single patient record will be visible to clinicians across care settings and will include contextual information such as housing status and caring responsibilities. Patients will be able to add data from clinically validated wearables. Community pharmacies will be linked over time, and the record will eventually support a personalised health risk assessment drawing on lifestyle, demographic and genomic data.

The delivery lever is legislation. New law will require providers, including GP practices, to make the information they record available through the single patient record ([Pulse](https://www.pulsetoday.co.uk/news/clinical-areas/cardiovascular/single-patient-record-to-become-available-via-nhs-app-by-2028/)).

That last point is the one leaders should underline. When sharing becomes a legal duty, interoperability stops being a nice-to-have on the roadmap. It becomes a compliance question, with deadlines.

## The choices that will age well

Nobody yet knows the exact national architecture. But you do not need to wait for it to make sensible decisions. Some choices are good under almost any version of the final design.

**Standards first.** Build integrations on HL7 FHIR and the UK Core profiles rather than bespoke formats. Every new point-to-point interface built in a proprietary shape is a future migration project.

**Identity done properly.** A single record is only as good as its matching. Making sure the NHS number is captured, verified and carried consistently through every system is unglamorous work, and it will pay off more than almost anything else.

**Data quality you can measure.** Coding, completeness and timeliness will suddenly be visible to every other organisation reading your data. Start measuring them now, and fix the worst offenders while it is still an internal conversation.

**Access and consent designed in.** A record that includes housing and caring context needs role-based access, clear audit trails and a transparent approach to patient choice. Retrofitting these is far harder than designing for them.

**Events, not batches.** Clinicians need to see what happened this morning, not last week. Where you can, move from nightly extracts to event-driven updates.

## What this means for suppliers

For health tech suppliers, the message is blunt. If your product holds clinical or care data, buyers will soon ask how it feeds the single patient record. "We have an API" will not be enough. They will want standards-based interfaces, clear data ownership and evidence that you can meet a legal duty to share.

Suppliers who can answer those questions in procurement will win. Those who cannot will find themselves designed out of integrated care pathways.

## Where to start this quarter

A useful first step for any trust or integrated care board is an honest map of where patient data lives today: which systems, which formats, which interfaces, and which of them are held together by spreadsheets and goodwill. That map turns a vague national ambition into a concrete local backlog.

It also shows you where the risk sits. In most organisations it is not the flagship electronic patient record. It is the dozens of smaller departmental systems that nobody has integrated, because until now nobody had to.

At Vitalos we help Health & Care organisations run exactly this kind of discovery, then engineer the integrations that come out of it. The plan sets the destination. The work starts with knowing where you are.

## Frequently asked questions

### What is the NHS single patient record?

It is a planned single record that brings together a patient's medical records and relevant context so clinicians across settings can see one view. The 10 Year Health Plan describes it as a "patient passport".

### When will patients see the single patient record in the NHS App?

The plan says patients will be able to view it in the NHS App from 2028, subject to parliamentary time.

### Will GP practices have to share data with the single patient record?

The plan says new legislation will require providers, including GP practices, to make the information they record available through the single patient record.

## Sources

1. ['Single patient record' to become available via NHS App by 2028 — Pulse, 4 July 2025](https://www.pulsetoday.co.uk/news/clinical-areas/cardiovascular/single-patient-record-to-become-available-via-nhs-app-by-2028/)
