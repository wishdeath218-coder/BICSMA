# Sequence Diagrams — Resident Workflows

The complaint workflow's full quota, Gemini duplicate-matching, and persistence sequence is documented in the [critical complaint-submission sequence diagram](./SEQUENCE-DIAGRAM-COMPLAINT-SUBMISSION.md). This document covers other resident-facing workflows.

## 1. Register and Sign In

```mermaid
sequenceDiagram
  autonumber
  actor Resident
  participant UI as Registration / Login Screen
  participant App as App Context
  participant API as Supabase Client
  participant Edge as username-auth Edge Function
  participant Storage as Supabase Storage
  participant DB as Supabase Database
  actor Admin as Barangay Admin

  Resident->>UI: Enter registration details and choose verification image
  UI->>UI: Validate required fields and image
  UI->>App: register(account, verification document)
  App->>API: usernameAuth(signup)
  API->>Edge: Signup details and verification image
  Edge->>Edge: Validate fields, role, password, and image
  Edge->>DB: Check username and hash password
  DB-->>Edge: Username available and password hash
  Edge->>Storage: Upload private verification document
  Storage-->>Edge: Verification object stored
  Edge->>DB: Insert account with Pending status and document path
  DB-->>Edge: Pending account saved
  Edge-->>API: Registration result
  API-->>App: Success
  App-->>UI: Registration accepted
  UI-->>Resident: Show pending approval confirmation

  Admin->>DB: Review application and verification document
  Admin->>DB: Approve or reject account

  Resident->>UI: Enter username and password
  UI->>App: tryLogin(username, password)
  App->>API: usernameAuth(login)
  API->>Edge: Login request
  Edge->>DB: Check login rate limit and verify password
  DB-->>Edge: Rate-limit and password result
  alt Invalid credentials or rate limit exceeded
    Edge-->>API: Login error
    API-->>App: Error result
    App-->>UI: Sign-in failed
    UI-->>Resident: Show error message
  else Credentials valid
    Edge->>DB: Load account and check approval status
    DB-->>Edge: Account status
    alt Account pending, rejected, or temporarily blocked
      Edge-->>API: Access denied with reason
      API-->>App: Error result
      App-->>UI: Sign-in denied
      UI-->>Resident: Show account status message
    else Account approved
      Edge->>DB: Create opaque account session
      DB-->>Edge: Session saved
      Edge-->>API: Session token and account
      API-->>App: Login success
      App->>App: Store session token in device storage
      App-->>UI: Authenticated account
      UI-->>Resident: Open resident portal
    end
  end
```

## 2. Submit a Summon Request

```mermaid
sequenceDiagram
  autonumber
  actor Resident
  participant UI as Report Wizard
  participant App as App Context
  participant API as Supabase Client
  participant Edge as submit-summon Edge Function
  participant Auth as Account Session Service
  participant DB as Supabase Database

  Resident->>UI: Enter case details and respondent information
  UI->>UI: Validate case details and at least one respondent
  Resident->>UI: Submit summon request
  UI->>App: submitReport(summon)
  App->>API: submitSummon(summon)
  API->>Edge: POST summon + x-account-session
  Edge->>Edge: Validate request and respondent names
  Edge->>Auth: Validate active approved account session
  Auth->>DB: Read session and account status
  DB-->>Auth: Account and role
  Auth-->>Edge: Approved account

  alt No valid approved account
    Edge-->>API: 401 sign-in required
    API-->>App: Submission error
    App-->>UI: Show error
    UI-->>Resident: Prompt to sign in
  else Approved resident
    Edge->>DB: Reserve daily report slot (limit 3)
    DB-->>Edge: Quota decision and usage
    alt Daily limit reached
      Edge-->>API: 429 daily limit + reset time
      API-->>App: Daily limit error
      App-->>UI: Update quota display
      UI-->>Resident: Show daily limit message
    else Slot reserved
      Edge->>DB: Insert summon and respondent details
      alt Summon insert succeeds
        DB-->>Edge: Summon saved
        Edge-->>API: Success and updated daily usage
        API-->>App: Submission result
        App->>App: Add summon to resident report state
        App->>DB: Create admin notification for new summon
        DB-->>App: Notification saved
        App-->>UI: Submission complete
        UI-->>Resident: Show reference and updated quota
      else Summon insert fails
        DB-->>Edge: Insert error
        Edge->>DB: Release reserved daily report slot
        DB-->>Edge: Slot released
        Edge-->>API: Submission error
        API-->>App: Error result
        App-->>UI: Show failure
        UI-->>Resident: Ask resident to try again
      end
    end
  end
```

## 3. View Reports and Notifications

```mermaid
sequenceDiagram
  autonumber
  actor Resident
  participant UI as Resident Portal
  participant App as App Context
  participant API as Supabase Client
  participant DB as Supabase Database

  Resident->>UI: Open the portal
  UI->>App: Request resident data
  App->>API: Fetch reports, announcements, and notifications
  par Load reports
    API->>DB: Read complaints and summons
    DB-->>API: Complaint and summon records
  and Load announcements
    API->>DB: Read announcements
    DB-->>API: Announcement records
  and Load notifications
    API->>DB: Read notifications
    DB-->>API: Notification records
  end
  API-->>App: Loaded resident data
  App->>App: Filter notifications for this resident
  App-->>UI: Provide report, bulletin, and notification state

  Resident->>UI: Open My Reports
  UI->>App: Read current report state
  App-->>UI: Return resident-visible reports and statuses
  UI-->>Resident: Display report timeline and current status

  Resident->>UI: Open a notification
  UI->>App: markNotificationRead(notificationId)
  App->>App: Update local notification state
  App->>API: Update notification is_read
  API->>DB: Save read status
  DB-->>API: Update result
  API-->>App: Success
  App-->>UI: Display notification as read
```
