# System Context Diagram

```mermaid
flowchart LR
  resident[Resident]
  admin[Barangay Admin]
  portal((Barangay Bangbang<br/>Civic Portal))
  gemini[Gemini AI]
  supabase[(Supabase)]

  resident -->|"Registration, sign-in, complaints, summons,<br/>evidence photos, and information requests"| portal
  portal -->|"Account results, report status,<br/>announcements, and notifications"| resident

  admin -->|"Sign-in, case decisions, assignments,<br/>summon details, and announcements"| portal
  portal -->|"Cases, resident submissions,<br/>summon docket, and analytics"| admin

  portal -->|"Complaint summary and embedding request"| gemini
  gemini -->|"Generated summary, embedding,<br/>and duplicate-match results"| portal

  portal -->|"Account, report, summon, bulletin,<br/>notification, and image operations"| supabase
  supabase -->|"Stored records, image URLs,<br/>and query results"| portal
```

The Barangay Bangbang Civic Portal is the system of interest. Residents and Barangay Admins interact with it directly. Gemini AI supports complaint summarization and duplicate detection, while Supabase provides persistent data storage, image storage, and backend services.
