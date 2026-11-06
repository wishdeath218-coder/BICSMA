export interface TimelineItem {
  status: 'Pending' | 'Investigating' | 'Resolved' | 'Unresolved' | 'Rejected';
  date: string;
  note: string;
}

export interface SummonedPerson {
  name: string;
  address?: string;
  accountId?: string;
}

export interface ComplaintReport {
  id: string;
  reportType?: 'Complaint' | 'Summon';
  groupId?: string;      // complaints about the same issue share this
  summary?: string;      // AI-generated one-line summary
  isAnonymous?: boolean;
  title: string;
  category:
    | 'Noise Complaint'
    | 'Waste Management'
    | 'Security Incident'
    | 'Public Infrastructure'
    | 'Other Concerns'
    | 'Theft'
    | 'Property Damage'
    | 'Physical Damage'
    | 'Others';
  description: string;
  location: string;
  date: string;
  status: 'Pending' | 'Investigating' | 'Resolved' | 'Unresolved' | 'Rejected';
  priority: 'Normal' | 'Summon';
  reportedBy: string;
  assignee: string;
  evidencePhoto?: string;
  rejectionReason?: string;
  // Summon-specific
  summonedPersonName?: string;
  summonedPersonAddress?: string;
  summonedPersons?: SummonedPerson[];
  isSummonedParty?: boolean;
  summonReason?: string;
  summonNoticeStage?:
    | '1st Notice'
    | '2nd Notice'
    | '3rd Notice'
    | 'Hearing Scheduled'
    | 'Settled'
    | 'Unsettled';
  hearingDate?: string;
  hearingSlotDate?: string;
  hearingSlotTime?: string;
  hearingVenue?: string;
  luponOfficer?: string;
  summonNotes?: string[];
  timeline: TimelineItem[];
}

export function isSummonReport(report: ComplaintReport): boolean {
  return report.reportType === 'Summon' || report.priority === 'Summon' || !!report.summonedPersonName;
}

export interface Announcement {
  id: string;
  title: string;
  type: 'News' | 'Advisory' | 'Event';
  date: string;
  summary: string;
  content: string;
  image?: string;
  attachment?: string;
  urgent?: boolean;
  timeLeft?: string;
  engagementCount?: number;
}

export interface CivilNotification {
  id: string;
  title: string;
  description: string;
  date: string;
  type: 'report' | 'announcement' | 'system';
  isRead: boolean;
  targetView?: string;
  targetId?: string;
  targetGroupId?: string;   // when set, opens the whole complaint group
  // Who should see this notification:
  //  'admin'          → the barangay admin
  //  'residents'      → all residents
  //  '<resident name>'→ one specific resident
  audience?: string;
}

export type AccountRole = 'resident' | 'admin';

export interface ResidentAccount {
  id: string;
  name: string;
  username: string;
  role: AccountRole;
  barangayPosition?: string;
  password?: string;
  passwordHash?: string;
  cpNumber: string;
  address: string;
  registeredDate: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Blocked';
  blockedUntil?: string;
  rejectionReason?: string;
  verificationDocumentPath?: string;
  verificationDocumentUri?: string;
}
