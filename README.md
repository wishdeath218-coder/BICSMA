# Barangay Bangbang — React Native App

A full-featured mobile civic portal for **Barangay Bangbang** built with **React Native + Expo**. Residents can file complaints and summons; barangay admins can manage cases, schedule hearings, publish bulletins, and approve resident accounts. Admins can link summoned respondents to approved resident accounts so they receive an in-app notice and can view the case details.

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React Native 0.74 + Expo ~51 |
| Navigation | expo-router v3 (file-based) |
| State / Persistence | React Context API + AsyncStorage |
| UI Icons | @expo/vector-icons (Ionicons) |
| Gradients | expo-linear-gradient |
| Image Picker | expo-image-picker |
| Toast Notifications | react-native-toast-message |
| TypeScript | ~5.3 |

---

## Project Structure

```
barangay-bangbang-rn/
├── app/                        # expo-router file-based routes
│   ├── _layout.tsx             # Root layout — AppProvider + Toast
│   ├── index.tsx               # Auth redirect gateway
│   ├── auth/
│   │   ├── _layout.tsx         # Auth stack (no header)
│   │   ├── login.tsx           # Login screen
│   │   └── register.tsx        # Resident registration
│   ├── (resident)/
│   │   ├── _layout.tsx         # Resident tab bar (5 tabs)
│   │   ├── civic-hub.tsx       # Home dashboard
│   │   ├── community-feed.tsx  # Announcements feed
│   │   ├── report-wizard.tsx   # 3-step report/summon wizard
│   │   ├── my-reports.tsx      # Filed reports list + detail
│   │   └── notifications.tsx   # In-app notifications
│   └── (admin)/
│       ├── _layout.tsx         # Admin tab bar (6 tabs + hidden review)
│       ├── dashboard.tsx       # Complaint table + assignee management
│       ├── complaint-review.tsx# Full case review + summon workspace
│       ├── summons.tsx         # Summon docket (Lupon hub)
│       ├── walk-in.tsx         # Walk-in desk intake form
│       ├── announcements.tsx   # Compose + publish bulletins
│       ├── analytics.tsx       # Live stats & charts
│       └── approvals.tsx       # Resident account approvals
│
├── src/
│   ├── context/
│   │   └── AppContext.tsx      # Global state (auth, reports, announcements, etc.)
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   ├── data/
│   │   └── index.ts            # Seed data (reports, announcements, accounts)
│   ├── constants/
│   │   └── colors.ts           # Design token palette
│   └── components/
│       ├── Card.tsx
│       ├── EmptyState.tsx
│       ├── InputField.tsx
│       ├── PrimaryButton.tsx
│       ├── ReportCard.tsx
│       ├── ScreenHeader.tsx
│       ├── SectionTitle.tsx
│       ├── StatusBadge.tsx
│       └── TimelineView.tsx
│
├── app.json
├── babel.config.js
├── metro.config.js
├── package.json
└── tsconfig.json
```

---

## Getting Started

### 1. Install dependencies

```bash
cd barangay-bangbang-rn
npm install
```

### 2. Start the development server

```bash
npx expo start
```

Then press **`a`** for Android emulator, **`i`** for iOS simulator, or scan the QR code with the **Expo Go** app.

### Configure Supabase for the app

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from the Supabase project's API settings. These public client values are embedded in the app bundle at build time; rebuild and reinstall the APK after changing them. Use only the publishable/anon key in the app—never put the service-role key in an `EXPO_PUBLIC_` variable.

### Deploy the web app to GitHub Pages

1. In the GitHub repository, open **Settings → Pages** and set the publishing source to **GitHub Actions**.
2. Open **Settings → Secrets and variables → Actions**. Add the Supabase project URL as the `EXPO_PUBLIC_SUPABASE_URL` repository variable, and add its publishable/anon key as the `EXPO_PUBLIC_SUPABASE_ANON_KEY` repository secret. Never add a service-role key or `GEMINI_API_KEY` here.
3. Run the **Deploy web app to GitHub Pages** workflow from the **Actions** tab, or push a commit to `main`.
4. Once the workflow succeeds, the site is available at <https://wishdeath218-coder.github.io/BICSMA/>.

The web build embeds the publishable/anon key in client-side code; this key is not a server-side secret. Keep private data protected by the configured database policies and Edge Functions. The Supabase database migrations and Edge Functions must be deployed separately before the app can use them.

---

## Account Setup

Users sign in with a username and password. Passwords are stored as server-generated bcrypt hashes in `accounts`; raw passwords are never returned to app clients. Opaque sessions are verified by Supabase Edge Functions. Public registration requests remain pending until an approved admin reviews them; admins can create separate approved resident accounts.

For an existing Supabase project:

1. Run [`supabase/migrate_username_auth.sql`](./supabase/migrate_username_auth.sql) in SQL Editor. It migrates account emails to usernames, retains existing Auth email identifiers only in a table inaccessible to app clients, removes email and password from `accounts`, and restricts account writes to server functions.
2. Run [`supabase/migrate_summons_table.sql`](./supabase/migrate_summons_table.sql) in SQL Editor. This creates a separate `summons` table, moves existing summon cases from `complaints`, and enables direct storage of all summoned people. Complaint submissions use multilingual embeddings for duplicate detection without translating report text; summon submissions are inserted directly into `summons`.
3. Run [`supabase/migrate_grouping.sql`](./supabase/migrate_grouping.sql) in SQL Editor to add the complaint grouping columns required by complaint submissions.
4. Run [`supabase/migrate_duplicate_location.sql`](./supabase/migrate_duplicate_location.sql) in SQL Editor so AI duplicate matching only groups complaints from the same location.
5. Run [`supabase/migrate_reporter_identity.sql`](./supabase/migrate_reporter_identity.sql) in SQL Editor. This creates the private reporter identity table used to count distinct residents in duplicate groups.
6. Run [`supabase/migrate_reporter_group_claims.sql`](./supabase/migrate_reporter_group_claims.sql) in SQL Editor. This privately records one report per resident per duplicate group and blocks repeated submissions without exposing account IDs in complaint rows.
7. Run [`supabase/migrate_remove_legacy_reporter_columns.sql`](./supabase/migrate_remove_legacy_reporter_columns.sql) in SQL Editor. This removes the superseded aggregate reporter counter columns and RPC.
8. Run [`supabase/migrate_notif_audience.sql`](./supabase/migrate_notif_audience.sql) in SQL Editor. This adds the audience column used to scope notifications to admins and residents.
9. Run [`supabase/migrate_announcement_images.sql`](./supabase/migrate_announcement_images.sql) in SQL Editor to enable gallery uploads and public display of announcement images.
10. Run [`supabase/migrate_daily_report_limit.sql`](./supabase/migrate_daily_report_limit.sql) in SQL Editor. Resident complaint and summon submissions share a three-per-day limit (Asia/Manila calendar day); admin walk-ins are exempt.
11. Run [`supabase/migrate_admin_audit_log.sql`](./supabase/migrate_admin_audit_log.sql) in SQL Editor. This creates the private admin audit log before deploying functions that write to it.
12. Add a Gemini API key in Supabase Edge Function secrets under the name `GEMINI_API_KEY` for multilingual report embeddings (get a key from [Google AI Studio](https://aistudio.google.com/app/apikey)). Complaint text is embedded in its original language; no Gemini text-generation/translation request is made. For example, using the Supabase CLI:
   ```bash
   supabase secrets set GEMINI_API_KEY=your-gemini-api-key
   ```
13. Deploy the Edge Functions from the repository root using the Supabase CLI:
   ```bash
   supabase functions deploy username-auth --no-verify-jwt
   supabase functions deploy review-account --no-verify-jwt
   supabase functions deploy app-data --no-verify-jwt
   supabase functions deploy check-duplicate --no-verify-jwt
   supabase functions deploy submit-summon --no-verify-jwt
   supabase functions deploy daily-report-usage --no-verify-jwt
   ```
   In particular, deploy `check-duplicate` with the CLI rather than pasting only its `index.ts` into the dashboard; it imports a shared module from `supabase/functions/_shared`.
14. Release the app version that routes private reads and writes through the session-verified `app-data` function. Confirm the updated app can sign in, submit and review cases, publish bulletins, and receive notifications.
15. After clients are updated, run [`supabase/migrate_secure_app_data.sql`](./supabase/migrate_secure_app_data.sql) in SQL Editor. It removes anonymous access to complaint, summons, notification, account, and audit data while keeping bulletin reads public. Older app versions that directly accessed private tables will stop working after this step.
16. To seed the first admin, create an account through the app, then update the username, name, and position in [`supabase/seed_first_admin.sql`](./supabase/seed_first_admin.sql) and run it in SQL Editor.
17. Run [`supabase/migrate_report_evidence.sql`](./supabase/migrate_report_evidence.sql) in SQL Editor before deploying the updated `app-data` function and app. It creates a private bucket for evidence photos; approved admins can view photos through short-lived signed URLs, and residents can view only photos under their own account path. Photos submitted by older app versions were saved as device-local URIs and must be resubmitted to be available across devices.
18. Run [`supabase/migrate_linked_summon_lookup.sql`](./supabase/migrate_linked_summon_lookup.sql) in SQL Editor before deploying the updated `app-data` function. It adds a service-role-only lookup for account-linked summons, used to load resident summon details and authorize evidence access.
19. Run [`supabase/migrate_summon_notifications.sql`](./supabase/migrate_summon_notifications.sql) in SQL Editor. It creates an in-app notification for each approved resident account linked to a newly filed summon. In the summon form, select the resident from the approved-account search; manually entered names cannot be matched to an account and will not receive a notification.
20. Run [`supabase/migrate_hearing_slots.sql`](./supabase/migrate_hearing_slots.sql) in SQL Editor before deploying the updated `app-data` function and app. It adds date/time fields and a unique database constraint so a hearing slot cannot be booked by two summons, even if admins try to save the same slot at the same time.

Keep `.env` files and server-only keys out of source control. Supabase backups depend on your project plan: enable the available scheduled backups and periodically test restoring one before using the system for official records.

---

## Features

[View the system conceptual framework](./CONCEPTUAL-FRAMEWORK.md).

[View the SOS trigger sequence diagram](./SEQUENCE-DIAGRAM-SOS.md).

[View the resident sequence diagrams](./SEQUENCE-DIAGRAM-RESIDENT.md).

[View the admin sequence diagrams](./SEQUENCE-DIAGRAM-ADMIN.md).

[View the system architecture diagram](./SYSTEM-ARCHITECTURE-DIAGRAM.md).

[View the complaint-submission sequence diagram](./SEQUENCE-DIAGRAM-COMPLAINT-SUBMISSION.md).

[View the activity diagrams for major processes](./ACTIVITY-DIAGRAMS.md).

[View the entity-relationship diagram](./ER-DIAGRAM.md).

[View the Level 0 data flow diagram](./DFD-LEVEL-0.md).

[View the system context diagram](./CONTEXT-DIAGRAM.md).

[View the system use case diagram](./USE-CASE-DIAGRAM.md).

### Resident Portal
| Screen | Features |
|---|---|
| **Civic Hub** | Emergency hotlines (call modal), monthly bar chart, recent bulletins preview, stats strip, logout |
| **Community Feed** | Announcements with type filter (All / News / Advisory / Event), full detail modal, urgent flags |
| **File a Report** | 3-step wizard — General Report or Summon a Resident; incident type selector, daily three-report counter, evidence photo via camera roll, location zone picker, review step |
| **My Reports** | Search + status filter, report detail sheet with full timeline, evidence photo, summon info, rejection reason |
| **Notifications** | Unread/read list, mark-all-read, tap-to-read |

### Admin Portal
| Screen | Features |
|---|---|
| **Dashboard** | Complaint table (Normal reports), stats, search + filter, inline assignee picker, navigate to review |
| **Complaint Review** | Full report details, resolve/investigate/reject actions; **Summon workspace**: notice stage pipeline, hearing scheduler, conciliation minutes logbook, Patawag (KP Form No. 9) preview modal |
| **Summons Hub** | Filtered view of all summon cases by notice stage, party info, hearing date |
| **Walk-In Filing** | Dual-mode intake (Complaint / Summon), complainant + respondent fields, success intake slip modal |
| **Announcements** | Compose form (type, urgency toggle, title, summary, full content), published bulletins list |
| **Analytics** | Live KPI cards, resolution rate bar, monthly trend chart, category breakdown, quick stats |
| **Account Approvals** | Approve / Reject resident and admin applications, rejection reason modal, account detail modal |

Residents and prospective barangay admins can request access from the registration screen. New accounts remain pending until the current admin approves them. Accounts identify users by username; internal Supabase Auth email identifiers are stored separately and are not exposed to app clients.

Admin applicants provide a barangay position; resident accounts leave this value empty.

---

## Data Persistence

Session data is persisted to **AsyncStorage** on device. When Supabase environment variables are configured, shared accounts, complaints, bulletins, and notifications use Supabase; without them, the app falls back to AsyncStorage.

| Key | Contents |
|---|---|
| `bb_logged_in` | Session flag |
| `bb_user_name` | Display name |
| `bb_user_role` | `resident` or `admin` |
| `bb_username` | Account username |
| `bb_reports` | All complaint reports |
| `bb_announcements` | All bulletins |
| `bb_notifications` | In-app notifications |
| `bb_accounts` | Resident accounts |
| `bb_daily_report_usage:<username>` | Per-account daily counter when running without Supabase |

Clearing app data / storage resets everything to seed data on next launch.

---

## Key Design Decisions

- **expo-router** for file-based routing — no manual navigator setup required
- **Single `AppContext`** owns all shared state; each screen subscribes only to what it needs
- **`ComplaintReport` serves both** general complaints and summon cases via optional fields + `priority` discriminator
- **Complaint Review** is a **hidden tab** (tabBarButton: null) navigated to via `router.push` with a `reportId` param from both Dashboard and Summons Hub
- **Analytics screen** reads live data from context rather than hardcoded values (unlike the web version)
- **Optional Supabase backend** — shared application data uses Supabase when configured, with AsyncStorage as the offline fallback

---

## Extending to a Real Backend

When ready to connect a backend (e.g. Supabase, Firebase, or a custom REST API):

1. Replace AsyncStorage read/write helpers in `AppContext.tsx` with API calls
2. Add a real auth token flow (JWT / session cookie) in `login()` / `logout()`
3. Add file upload for evidence photos (currently stored as local URIs)
4. Replace hardcoded admin credentials with a server-side role check

---

## Notes

- **iOS** requires `NSPhotoLibraryUsageDescription` in `app.json` plugins config for the image picker
- **Android** permissions for camera roll are requested at runtime via `expo-image-picker`
- The Patawag print feature is a **read-only modal** on mobile (no `window.print()`). For real printing, integrate `expo-print` + `expo-sharing`
