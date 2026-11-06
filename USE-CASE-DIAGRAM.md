# Use Case Diagram

```mermaid
flowchart LR
  resident([Resident])
  admin([Barangay Admin])
  gemini([Gemini AI])
  supabase[(Supabase)]

  subgraph portal["Barangay Bangbang Portal"]
    direction LR
    account(["Register and sign in"])
    fileReport(["File a complaint"])
    fileSummon(["Submit a summon"])
    evidence(["Attach evidence photo"])
    checkDuplicate(["Check for duplicate complaints"])
    dailyLimit(["Check daily report limit"])
    track(["Track reports and case status"])
    browse(["Browse announcements"])
    notifications(["Receive notifications"])
    review(["Review complaints"])
    manage(["Update status and assign cases"])
    summonCase(["Manage summon notices and hearings"])
    publish(["Publish announcements"])
    bulletinImage(["Choose announcement image"])
    analytics(["View analytics"])
  end

  resident --- account
  resident --- fileReport
  resident --- fileSummon
  resident --- track
  resident --- browse
  resident --- notifications
  fileReport -. "«include»" .-> evidence
  fileReport -. "«include»" .-> checkDuplicate
  fileReport -. "«include»" .-> dailyLimit
  fileSummon -. "«include»" .-> dailyLimit
  gemini --- checkDuplicate
  supabase --- account
  supabase --- fileReport
  supabase --- fileSummon
  supabase --- track
  supabase --- browse
  supabase --- notifications

  admin --- account
  admin --- review
  admin --- manage
  admin --- summonCase
  admin --- publish
  admin --- analytics
  publish -. "«include»" .-> bulletinImage
  supabase --- review
  supabase --- manage
  supabase --- summonCase
  supabase --- publish
  supabase --- analytics

  classDef actor fill:#fff,stroke:#334155,stroke-width:2px,color:#0f172a
  classDef usecase fill:#eff6ff,stroke:#2563eb,color:#0f172a
  classDef service fill:#fef3c7,stroke:#d97706,color:#0f172a
  class resident,admin actor
  class gemini,supabase service
  class account,fileReport,fileSummon,evidence,checkDuplicate,dailyLimit,track,browse,notifications,review,manage,summonCase,publish,bulletinImage,analytics usecase
```

**Actors:** Residents use the portal to manage their accounts, submit and track reports, and read announcements. Barangay admins review cases, manage summons, publish announcements, and view analytics. Gemini AI supports duplicate complaint detection; Supabase stores portal data and uploaded images.
