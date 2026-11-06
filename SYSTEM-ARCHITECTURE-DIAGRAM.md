# System Architecture Diagram

```mermaid
flowchart TB
  subgraph client["Client Applications"]
    residentUI["Resident UI<br/>React Native / Expo Router"]
    adminUI["Admin UI<br/>React Native / Expo Router"]
    context["App Context<br/>State and workflow coordination"]
    api["Data access layer<br/>Supabase client and API helpers"]
    local["AsyncStorage<br/>Session and local fallback data"]

    residentUI --> context
    adminUI --> context
    context --> api
    context <--> local
  end

  subgraph supabase["Supabase Project"]
    gateway["Supabase API Gateway"]
    edge["Edge Functions<br/>username-auth<br/>review-account<br/>check-duplicate<br/>submit-summon<br/>daily-report-usage"]
    db[("PostgreSQL<br/>accounts, sessions, complaints,<br/>summons, announcements, notifications")]
    storage[("Supabase Storage<br/>verification documents<br/>announcement images")]

    gateway --> db
    gateway --> storage
    edge --> db
    edge --> storage
  end

  gemini["Google Gemini API<br/>Complaint summary and embeddings"]

  api -->|"Direct data queries and image upload"| gateway
  api -->|"Authenticated workflow requests<br/>x-account-session"| edge
  edge -->|"Summarize and create embeddings"| gemini
  gemini -->|"Summary and embedding vectors"| edge

  db -->|"Rows and RPC results"| gateway
  gateway -->|"Query responses and public image URLs"| api
  edge -->|"Workflow results and errors"| api
```

## Component Responsibilities

- **React Native / Expo Router UI:** Resident and admin screens, forms, and navigation.
- **App Context:** Shared app state and orchestration of account, report, announcement, and notification operations.
- **Data access layer:** Calls Supabase tables and Storage directly where appropriate, and invokes Edge Functions for privileged workflows.
- **Supabase Edge Functions:** Validate sessions, enforce report limits, manage account review and summons, and coordinate complaint matching.
- **PostgreSQL:** Persistent relational data, reporter identities and claims, and database RPC functions.
- **Supabase Storage:** Private account verification documents and public announcement images.
- **Google Gemini API:** Generates complaint summaries and embeddings used in duplicate detection.
- **AsyncStorage:** Device-local session state and fallback data when Supabase is not configured.
