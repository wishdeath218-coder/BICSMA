# Sequence Diagram — Complaint Submission

Complaint submission is a critical flow because it authenticates the resident, enforces the daily limit, checks for duplicate reports, stores private reporter identity, and may use Gemini AI before the complaint is saved.

```mermaid
sequenceDiagram
  autonumber
  actor Resident
  participant Form as Report Wizard
  participant App as App Context
  participant API as Supabase Client
  participant Edge as check-duplicate Edge Function
  participant Auth as Account Session Service
  participant DB as Supabase Database
  participant Gemini as Gemini AI

  Resident->>Form: Enter complaint and submit
  Form->>App: submitReport(complaint)
  App->>API: checkDuplicate(complaint)
  API->>Edge: POST complaint + x-account-session
  Edge->>Edge: Validate payload and complaint type
  Edge->>Auth: findApprovedAccount(session token)
  Auth->>DB: Find valid session and approved account
  DB-->>Auth: Account and role
  Auth-->>Edge: Approved account

  alt No valid approved account
    Edge-->>API: 401 sign-in required
    API-->>App: Throw submission error
    App-->>Form: Show error
    Form-->>Resident: Prompt to sign in
  else Account is approved
    opt Resident role
      Edge->>DB: Find this account's prior reporter identities
      DB-->>Edge: Prior report IDs and complaint details
      alt Same active complaint already filed
        Edge-->>API: 409 REPORT_ALREADY_FILED + existing report ID
        API-->>App: Throw already-reported error
        App-->>Form: Show existing report message
        Form-->>Resident: Explain they can track the existing report
      else No exact active duplicate from this resident
        Edge->>DB: Reserve daily report slot (limit 3)
        DB-->>Edge: Allowed, usage, and reset time
      end
    end

    alt Daily limit reached
      Edge-->>API: 429 DAILY_REPORT_LIMIT + usage and reset time
      API-->>App: DailyReportLimitError
      App-->>Form: Update quota display
      Form-->>Resident: Show daily limit reached
    else Quota available or account is admin
      Edge->>Gemini: Generate English complaint summary
      Gemini-->>Edge: Summary text
      Edge->>Gemini: Create 768-dimension summary embedding
      Gemini-->>Edge: Embedding vector
      Edge->>DB: match_complaints(embedding, category, location)
      DB-->>Edge: Best active match or no match

      alt Similar group found and resident already claimed it
        Edge->>DB: Release reserved daily slot
        DB-->>Edge: Slot released
        Edge-->>API: 409 already reported in this group
        API-->>App: Throw already-reported error
        App-->>Form: Show already-reported message
        Form-->>Resident: Explain they can track the existing report
      else New group or resident may report matched group
        Edge->>DB: Insert complaint with summary, embedding, and group ID
        DB-->>Edge: Complaint saved
        opt Resident role
          Edge->>DB: Insert private reporter identity
          DB-->>Edge: Identity saved
          Edge->>DB: Insert one-per-group reporter claim
          DB-->>Edge: Claim saved
        end

        alt Similar group found
          Edge->>DB: Count distinct reporters in group
          DB-->>Edge: Reporter count
          Edge-->>API: Duplicate result, matched complaint, count, and quota
          API-->>App: Return duplicate result
          App->>API: Fetch current reports
          API->>DB: Read reports
          DB-->>API: Current report list
          API-->>App: Refreshed reports
          App-->>Form: Show duplicate result
          Form-->>Resident: Show group and number of reporters
        else No similar group
          Edge-->>API: New complaint result and quota
          API-->>App: Return successful result
          App-->>Form: Confirm submission
          Form-->>Resident: Show reference number
        end
      end
    end
  end

  opt Error after quota reservation or partial persistence
    Edge->>DB: Delete partially inserted complaint, if present
    Edge->>DB: Release reserved daily slot
    Edge-->>API: Error response
    API-->>App: Throw submission error
    App-->>Form: Show failure
    Form-->>Resident: Ask them to try again
  end
```

**Notes:** Residents must have an approved account. Admin walk-ins use the same duplicate-matching and complaint insertion flow but are exempt from the resident daily quota and reporter identity/claim inserts. The quota reservation is released if a repeated group claim is detected or submission fails.
