# Entity-Relationship Diagram

```mermaid
erDiagram
  ACCOUNTS {
    text id PK
    text username UK
    text name
    text role
    text status
    timestamptz created_at
  }

  ACCOUNT_SESSIONS {
    uuid id PK
    text account_id FK
    text token_hash UK
    timestamptz expires_at
    timestamptz created_at
  }

  ACCOUNT_LOGIN_ATTEMPTS {
    bigint id PK
    text username
    text ip_hash
    timestamptz attempted_at
  }

  COMPLAINTS {
    text id PK
    text group_id
    text title
    text category
    text status
    text reported_by
    vector embedding
    timestamptz created_at
  }

  COMPLAINT_REPORTER_IDENTITIES {
    text report_id PK, FK
    text account_id
  }

  COMPLAINT_REPORTER_GROUP_CLAIMS {
    text account_id PK
    text group_id PK
    text report_id FK, UK
  }

  REPORT_DAILY_SUBMISSIONS {
    bigint id PK
    text account_id FK
    text report_id
    timestamptz submitted_at
  }

  SUMMONS {
    text id PK
    text title
    text status
    text summoned_person_name
    jsonb summoned_persons
    text hearing_date
    timestamptz created_at
  }

  ANNOUNCEMENTS {
    text id PK
    text title
    text type
    text image
    text attachment
    boolean urgent
    timestamptz created_at
  }

  NOTIFICATIONS {
    text id PK
    text title
    text type
    boolean is_read
    text target_id
    text target_group_id
    text audience
    timestamptz created_at
  }

  ACCOUNTS ||--o{ ACCOUNT_SESSIONS : owns
  ACCOUNTS ||--o{ COMPLAINT_REPORTER_GROUP_CLAIMS : makes
  ACCOUNTS ||--o{ REPORT_DAILY_SUBMISSIONS : consumes
  COMPLAINTS ||--o| COMPLAINT_REPORTER_IDENTITIES : identifies
  COMPLAINTS ||--o{ COMPLAINT_REPORTER_GROUP_CLAIMS : claimed_report
```

**Relationship notes:** Solid relationships above are enforced by foreign keys. `complaint_reporter_identities.account_id` is associated with `accounts.id` by application logic but has no database foreign key. `group_id` values group complaints and claims logically; they are not foreign keys. `report_daily_submissions.report_id` is unique per account but intentionally has no complaint foreign key. Notification targets and announcement image URLs are also references stored as text, not foreign keys. `account_login_attempts.username` is used for rate limiting and is not linked to `accounts`.

The diagram covers the application's public data tables. Supabase Storage holds announcement images separately; `announcements.image` stores the resulting public URL.
