# Data Flow Diagram — Level 0

```mermaid
flowchart LR
  resident[Resident]
  admin[Barangay Admin]
  gemini[Gemini AI]

  p1([1.0 Manage Accounts and Sessions])
  p2([2.0 Submit and Match Complaints])
  p3([3.0 Manage Cases and Summons])
  p4([4.0 Publish Announcements])
  p5([5.0 Manage Notifications and Analytics])

  d1[(D1 Accounts and Sessions)]
  d2[(D2 Complaints, Reporter Claims,<br/>and Daily Submission Records)]
  d3[(D3 Summons)]
  d4[(D4 Announcements and Images)]
  d5[(D5 Notifications)]

  resident -->|"Registration and sign-in details"| p1
  p1 -->|"Account/session result"| resident
  p1 <-->|"Account and session records"| d1
  admin -->|"Admin sign-in details"| p1
  p1 -->|"Account/session result"| admin

  resident -->|"Complaint details and evidence"| p2
  p2 -->|"Submission result and duplicate status"| resident
  p2 <-->|"Report, identity, claim, and quota data"| d2
  p2 -->|"Complaint summary for matching"| gemini
  gemini -->|"Summary, embedding, and match result"| p2
  p2 -->|"New complaint notifications"| p5

  admin -->|"Review decisions, assignments,<br/>summon notices and hearing updates"| p3
  p3 -->|"Case status and docket information"| admin
  p3 <-->|"Complaint and status records"| d2
  p3 <-->|"Summon and hearing records"| d3
  p3 -->|"Resident case updates"| p5

  admin -->|"Bulletin content and selected image"| p4
  p4 -->|"Published bulletin confirmation"| admin
  p4 <-->|"Announcement and image records"| d4
  p4 -->|"New bulletin notice"| p5
  resident -->|"Announcement request"| p4
  p4 -->|"Bulletins and images"| resident

  p5 -->|"Notification records"| d5
  d5 -->|"Notifications"| p5
  p5 -->|"Resident notifications"| resident
  p5 -->|"Operational summaries and statistics"| admin
  p5 -.->|"Reads report and bulletin data"| d2
  p5 -.->|"Reads summons data"| d3
  p5 -.->|"Reads announcement data"| d4
```

**External entities:** Resident, Barangay Admin, Gemini AI.  
**Processes:** Account/session management, complaint submission and matching, case/summon management, announcement publishing, and notifications/analytics.  
**Data stores:** Accounts and sessions; complaints, reporter claims, and daily submission records; summons; announcements and images; notifications.
