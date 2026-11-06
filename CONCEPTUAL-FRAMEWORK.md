# Conceptual Framework

## Barangay Bangbang Civic Portal

The framework describes how residents' and barangay administrators' inputs are processed by the portal to produce coordinated public services and community outcomes. It uses an **Input–Process–Output–Outcome (IPOO)** model.

```mermaid
flowchart LR
  subgraph input["INPUT"]
    residentInput["Resident inputs<br/>Account details and verification<br/>Complaints and evidence<br/>Summon requests<br/>Announcement and information requests"]
    adminInput["Admin inputs<br/>Account decisions<br/>Case reviews and assignments<br/>Summon stages and hearing details<br/>Announcements and notifications"]
    systemInput["Supporting services<br/>Supabase records and storage<br/>Gemini AI summaries and embeddings<br/>Device dialer for emergency calls"]
  end

  subgraph process["PROCESS"]
    access["Account registration,<br/>approval, and session validation"]
    report["Complaint intake<br/>Daily quota validation<br/>AI duplicate detection<br/>Reporter identity and grouping"]
    caseMgmt["Case and summon processing<br/>Status updates, assignments,<br/>hearing schedules, and notes"]
    communication["Publish announcements<br/>Manage notifications<br/>Display reports and analytics"]
    emergency["Emergency assistance<br/>Confirm SOS action<br/>Open device dialer for 911"]
  end

  subgraph output["OUTPUT"]
    residentOutput["Resident-facing outputs<br/>Account status and report references<br/>Complaint status and timelines<br/>Summon submission results<br/>Announcements and notifications"]
    adminOutput["Admin-facing outputs<br/>Cases and grouped complaints<br/>Reporter counts and daily usage<br/>Summon docket and analytics"]
    emergencyOutput["Emergency output<br/>Device phone dialer opened<br/>911 call initiated by resident"]
  end

  outcome["OUTCOMES<br/>More accessible complaint and summon intake<br/>Improved case tracking and administrative coordination<br/>Better community access to official information<br/>Faster connection to emergency services"]

  residentInput --> access
  residentInput --> report
  residentInput --> caseMgmt
  adminInput --> access
  adminInput --> caseMgmt
  adminInput --> communication
  systemInput --> access
  systemInput --> report
  systemInput --> caseMgmt
  systemInput --> communication
  systemInput --> emergency

  access --> residentOutput
  report --> residentOutput
  report --> adminOutput
  caseMgmt --> residentOutput
  caseMgmt --> adminOutput
  communication --> residentOutput
  communication --> adminOutput
  emergency --> emergencyOutput

  residentOutput --> outcome
  adminOutput --> outcome
  emergencyOutput --> outcome
```

## Framework Components

| Component | Description | Examples in the portal |
|---|---|---|
| **Input** | Information and requests supplied by users and supporting services. | Registration details, verification documents, complaint descriptions, evidence photos, summon respondents, admin decisions, and Gemini matching results. |
| **Process** | Portal operations that validate, organize, and act on inputs. | Account approval and session checks; daily submission limits; AI-assisted duplicate detection; reporter grouping; case review; summon scheduling; announcement publishing; notification delivery. |
| **Output** | Results returned to residents and administrators. | Account status, report references, case timelines, duplicate-group results, summon schedules, bulletins, notifications, and analytics. |
| **Outcome** | Intended service improvements enabled by these outputs. | More accessible barangay services, better visibility into case progress, more coordinated case handling, informed residents, and a direct path to call emergency services. |

The framework is supported by **Supabase**, which provides database, storage, and backend functions, and **Gemini AI**, which supports complaint summarization and duplicate detection. The SOS feature is a device-level handoff to the 911 dialer; it does not currently send GPS location or an SOS alert to the portal backend.
