# Sequence Diagrams — Admin Workflows

These diagrams show key workflows performed by an approved Barangay Admin.

## 1. Review a Complaint or Complaint Group

```mermaid
sequenceDiagram
  autonumber
  actor Admin as Barangay Admin
  participant UI as Complaint Review Screen
  participant App as App Context
  participant API as Supabase API
  participant DB as Supabase Database
  participant Notify as Notification Service

  Admin->>UI: Open complaint and choose status
  UI->>App: updateGroupStatus(groupId, status, reason)
  App->>App: Update local complaint group and timelines
  App->>API: set_group_status(groupId, status, reason)
  API->>DB: Update all complaints with group_id
  DB-->>API: Updated successfully
  API-->>App: Success
  App->>API: Fetch complaints and summons
  API->>DB: Read current reports
  DB-->>API: Updated reports
  API-->>App: Refreshed reports
  App->>App: Find distinct reporter names in group

  loop For each reporter in group
    App->>Notify: Create personal status notification
    Notify->>API: Insert notification
    API->>DB: Save notification
    DB-->>API: Insert result
    API-->>Notify: Result
  end

  App-->>UI: Complete review action
  UI-->>Admin: Show updated status and timeline

  alt Update fails
    API-->>App: Database error
    App->>App: Log update failure
    Note over App,Admin: The current client keeps its optimistic local status; reload to reconcile with the database.
  end
```

## 2. Approve or Reject an Account

```mermaid
sequenceDiagram
  autonumber
  actor Admin as Barangay Admin
  participant UI as Account Approvals Screen
  participant App as App Context
  participant API as Supabase API
  participant Edge as review-account Edge Function
  participant DB as Supabase Database
  participant Notify as Notification Service
  actor Applicant

  Admin->>UI: Select account and approve or reject
  opt Reject
    UI-->>Admin: Request rejection reason
    Admin->>UI: Enter reason and confirm
  end
  UI->>App: updateAccountStatus(accountId, status, reason)
  App->>API: reviewAccount(accountId, status, reason)
  API->>Edge: POST + x-account-session
  Edge->>DB: Validate active session and approved admin role
  DB-->>Edge: Reviewer role and account status

  alt Reviewer is not an approved admin
    Edge-->>API: 401 or 403 error
    API-->>App: Throw review error
    App-->>UI: Display failure
    UI-->>Admin: Show review error
  else Reviewer is approved admin
    Edge->>DB: Update target account status and reason
    DB-->>Edge: Updated account
    Edge-->>API: Updated account
    API-->>App: Return updated account
    App->>App: Update account state
    App->>Notify: Create private applicant notification
    Notify->>API: Insert notification
    API->>DB: Save notification
    DB-->>API: Insert result
    API-->>Notify: Result
    App-->>UI: Complete review
    UI-->>Admin: Show success
    Notify-->>Applicant: Account decision notification
  end
```

## 3. Publish an Announcement

```mermaid
sequenceDiagram
  autonumber
  actor Admin as Barangay Admin
  participant UI as Announcements Screen
  participant App as App Context
  participant API as Supabase API
  participant Storage as Supabase Storage
  participant DB as Supabase Database
  participant Notify as Notification Service
  actor Residents

  Admin->>UI: Enter bulletin details
  opt Include image
    Admin->>UI: Choose image from gallery
    UI->>API: Upload image with announcement ID
    API->>Storage: Store image in announcement-images bucket
    Storage-->>API: Public image URL
    API-->>UI: Return image URL
  end
  Admin->>UI: Publish bulletin
  UI->>App: addAnnouncement(bulletin)
  App->>API: insertAnnouncement(bulletin)
  API->>DB: Insert announcement and image URL
  DB-->>API: Insert result
  API-->>App: Success
  App->>App: Add bulletin to local app state
  App->>Notify: Create residents audience notification
  Notify->>API: insertNotification(notification)
  API->>DB: Save notification
  DB-->>API: Insert result
  API-->>Notify: Result
  App-->>UI: Publish complete
  UI-->>Admin: Show published confirmation
  Notify-->>Residents: New announcement available

  alt Image upload or announcement insert fails
    API-->>UI: Return error
    UI-->>Admin: Show publishing error
  end
```
