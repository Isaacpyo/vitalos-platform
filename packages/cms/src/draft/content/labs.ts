/**
 * Labs assets (Stage 19; Stage 8 §15; Stage 10 §19; Stage 13 §9-10). Only concept maturity: each
 * asset is a problem and solution thesis drawn from methods the strategy documents define, with no
 * claim of software, testing, results or client use (Stage 19 §4: "Do not imply functionality").
 * No repository or demo links (nothing is maintained). Names are descriptive, not branded
 * (Stage 13 §10 naming rule). The Labs type is `research`, not `accelerators`: Stage 19 §3 places
 * analysis and theses under Research/Concept, while accelerators are components "used internally
 * or in controlled delivery" (Stage 19 §4), which these are not.
 */
import type { LabAssetView } from "../../content/types";
import { h2, p, richText, seo, ul } from "../build";
import { cite, drafted } from "../provenance";
import type { DraftProvenance } from "../provenance";
import { DRAFTED_ON, draftId } from "../slugs";

export interface LabDraft {
  view: LabAssetView;
  provenance: DraftProvenance;
}

const conceptNote =
  "This page describes a concept drafted from Vitalos's own delivery methods. It makes no claim about any implementation, results or client use; none are published here.";

const labsSources = [
  cite(19, "3. Portfolio taxonomy"),
  cite(19, "4. Maturity labels"),
  cite(19, "13. Accelerator architecture"),
  cite(19, "37. Labs website and proof architecture"),
  cite(8, "15. Vitalos Labs digital architecture"),
  cite(10, "19. Vitalos Labs migration"),
];

export const labDrafts: readonly LabDraft[] = [
  {
    view: {
      id: draftId("labAsset", "ai-opportunity-readiness-framework"),
      slug: "ai-opportunity-readiness-framework",
      title: "AI opportunity and readiness assessment framework",
      summary:
        "A concept for a reusable framework that ranks AI use cases by value, feasibility, data readiness and risk.",
      seo: seo(
        "AI opportunity and readiness framework (concept)",
        "A concept for a reusable framework that ranks AI use cases by value, feasibility, data readiness and risk. Concept maturity: no implementation is claimed.",
      ),
      updatedAt: DRAFTED_ON,
      labType: "research",
      maturity: "concept",
      is: "A defined concept for an assessment framework: the questions, criteria and outputs an AI Opportunity Assessment works through, written down so that each assessment is consistent and comparable.",
      isNot:
        "Not software, not a scoring product and not a substitute for the judgement of the engagement team.",
      limitations: `${conceptNote} The criteria have not been independently reviewed, weightings and thresholds are not defined, and the framework would need evidence from real assessments before it could be treated as an accelerator.`,
      body: richText(
        "lab-ai-framework",
        h2("The question"),
        p(
          "How can an organisation choose between AI ideas on evidence, rather than on enthusiasm or the latest demonstration?",
        ),
        h2("What the framework would assess"),
        ul(
          "Value: the business or user outcome, and what happens if nothing changes.",
          "Feasibility: whether the workflow, systems and integration make the use case buildable.",
          "Data readiness: whether the data the use case needs exists, is accessible and is of known quality.",
          "Risk: security, privacy, human oversight and the consequences of the model being wrong.",
          "Organisational readiness: governance gaps, ownership and the capacity to adopt the change.",
        ),
        h2("What it would produce"),
        ul(
          "An opportunity map and ranked use cases.",
          "A feasibility and risk view for each.",
          "A recommendation on which use case, if any, is worth a prototype.",
        ),
        h2("Principles it would encode"),
        p(
          "No AI for its own sake; bounded, measurable workflows before broad autonomous systems; evaluation criteria defined before production; operational cost, reliability and vendor dependence understood early.",
        ),
      ),
    },
    provenance: drafted([
      ...labsSources,
      cite(13, "10. Flagship intellectual property"),
      cite(3, "6.2 Initial AI & Data offers"),
      cite(3, "4.2 Initial consulting offers"),
      cite(3, "11.2 AI engagement principles"),
    ]),
  },
  {
    view: {
      id: draftId("labAsset", "production-ai-evaluation-harness"),
      slug: "production-ai-evaluation-harness",
      title: "Production AI evaluation harness",
      summary:
        "A concept for repeatable testing of AI models and agents against agreed quality and risk criteria, before release and after changes.",
      seo: seo(
        "Production AI evaluation harness (concept)",
        "A concept for testing AI models and agents against agreed quality and risk criteria, before release and after changes. No implementation is claimed.",
      ),
      updatedAt: DRAFTED_ON,
      labType: "research",
      maturity: "concept",
      is: "A concept for a reusable evaluation approach: representative test cases and agreed criteria that an AI capability is measured against before release and re-measured when anything material changes.",
      isNot:
        "Not a product, not a benchmark and not evidence that any particular AI system is safe or effective.",
      limitations: `${conceptNote} No test suites, datasets or results exist on this page, and how it would integrate with specific model providers has not been designed.`,
      body: richText(
        "lab-ai-evaluation",
        h2("The question"),
        p(
          "How do you know an AI capability is good enough for live use, and that it is still good enough after the model, prompt or data changes?",
        ),
        h2("What the harness would check"),
        ul(
          "Task success against a clearly defined metric.",
          "Behaviour on representative test cases, including difficult and harmful inputs.",
          "Grounding and retrieval quality where the system uses retrieval.",
          "Failure and fallback behaviour, and when a person is brought in.",
          "Cost and latency against agreed budgets.",
          "Regression when the model, provider, prompt or data source changes.",
        ),
        h2("Why it matters"),
        p(
          "Prototype evidence does not automatically mean production readiness. Repeatable evaluation turns that judgement into evidence, and keeps it current as models and context change.",
        ),
      ),
    },
    provenance: drafted([
      ...labsSources,
      cite(13, "9. Vitalos Labs as an authority engine"),
      cite(5, "13.1 AI lifecycle"),
      cite(19, "24. AI product architecture"),
      cite(6, "9. AI trust & Responsible AI"),
    ]),
  },
  {
    view: {
      id: draftId("labAsset", "inherited-system-takeover-assessment"),
      slug: "inherited-system-takeover-assessment",
      title: "Inherited-system takeover assessment",
      summary:
        "A concept for a standard assessment used before taking operational responsibility for a system someone else built.",
      seo: seo(
        "Inherited-system takeover assessment (concept)",
        "A concept for an assessment before taking operational responsibility for a system someone else built. Concept maturity: no implementation is claimed.",
      ),
      updatedAt: DRAFTED_ON,
      labType: "research",
      maturity: "concept",
      is: "A concept for a structured assessment, with fixed domains and outcomes, that establishes a supportable baseline before any service commitment for an inherited system.",
      isNot: "Not a tool, not an audit and not a security certification of the assessed system.",
      limitations: `${conceptNote} The checklist depth, evidence standards and how findings convert into a transition backlog are not yet defined.`,
      body: richText(
        "lab-takeover-assessment",
        h2("The question"),
        p("When is it responsible to accept a service commitment for a system you did not build?"),
        h2("Assessment domains"),
        ul(
          "Ownership and access: code, infrastructure, accounts, domains, data, licences and administrative control.",
          "Architecture: services, dependencies, integrations, hosting and critical failure points.",
          "Code and quality: maintainability, tests, build process, known defects and technical debt.",
          "Security: authentication, access control, secrets, vulnerabilities, patching and incident history.",
          "Data: stores, backups, retention, privacy responsibilities and recovery expectations.",
          "Operations: deployments, monitoring, logs, alerts, incidents and release ownership.",
          "Documentation: runbooks, architecture records and business-critical knowledge.",
          "Service expectations: hours, criticality, planned changes and escalation routes.",
        ),
        h2("Possible outcomes"),
        ul(
          "Accepted as it is.",
          "Accepted with conditions and a transition or remediation backlog.",
          "Assessment or engineering rescue required before service begins.",
          "Declined, where risk, access, legality, a capability gap or the commercial model make responsible support impossible.",
        ),
      ),
    },
    provenance: drafted([
      ...labsSources,
      cite(3, "12. Managed Services Acceptance Model"),
      cite(3, "12.2 Assessment domains"),
      cite(3, "12.3 Possible outcomes"),
      cite(5, "17.1 Third-party systems"),
    ]),
  },
];
