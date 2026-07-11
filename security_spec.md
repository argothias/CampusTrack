# Security Specification & Threat Model (TDD Spec)

## 1. Data Invariants
1. **Profile Identity**: A student profile can only be created or modified if its document ID exactly matches the authenticated user's `uid`. No user can modify or hijack another user's profile.
2. **Classroom Group Boundaries**: Only the creator of a Study Group can update its metadata or delete the group.
3. **Membership Integrity**: Enrolling in a classroom group must associate the authenticated user's `uid` with the membership document's `userId`. Students cannot enroll other users or claim elevated roles (e.g. leader) unless permitted.
4. **Task Assignment Constraints**: Students can create tasks, but any synced class task must belong to a group of which the user is an active member.
5. **Real-time Discussions (TaskComments)**: Comments can only be posted by authenticated users. A user cannot update or delete comments authored by other students.
6. **Immutable Fields**: Timestamps (`createdAt`) and identity reference IDs (`createdById`, `userId`) must be immutable once written.
7. **Size Limits & Type Safety**: Text inputs (such as task titles, tagline, announcement content) must have strict character limits enforced via rules to prevent "Denial of Wallet" size attacks.

---

## 2. The "Dirty Dozen" Malicious Payloads
The following 12 specific payloads are designed to challenge and bypass the security boundary. A successful rule configuration must return `PERMISSION_DENIED` for all:

### Payload 1: Profile Hijack (Identity Spoofing)
*   **Path**: `/profiles/target_user_123`
*   **Actor**: Authenticated user with `uid: malicious_attacker`
*   **Payload**: `{ "id": "target_user_123", "name": "Hijacked Name", "avatar": "scammer.png", "tagline": "owned" }`
*   **Violation**: Writing to another user's profile doc.

### Payload 2: Ghost Field Injection (Resource Poisoning)
*   **Path**: `/profiles/malicious_attacker`
*   **Actor**: Authenticated user with `uid: malicious_attacker`
*   **Payload**: `{ "id": "malicious_attacker", "name": "Attacker", "avatar": "avatar.png", "tagline": "Safe", "isAdmin": true, "super_privileges": "all" }`
*   **Violation**: Injecting unmapped "Ghost Fields" to bypass schema validation.

### Payload 3: Group Ownership Stealing (Privilege Escalation)
*   **Path**: `/groups/math_class_555`
*   **Actor**: Authenticated user with `uid: malicious_attacker` (not the creator)
*   **Payload**: `{ "id": "math_class_555", "name": "Hacked Math Class", "creatorId": "malicious_attacker" }`
*   **Violation**: Non-owner attempts to modify or reclaim group ownership.

### Payload 4: Membership Self-Promotion
*   **Path**: `/groupMemberships/membership_789`
*   **Actor**: Authenticated user with `uid: malicious_attacker`
*   **Payload**: `{ "id": "membership_789", "groupId": "math_class_555", "userId": "malicious_attacker", "role": "leader", "canSyncTasks": true, "canAnnounce": true }`
*   **Violation**: Escalating roles or privileges (e.g. self-promoting to leader) without authorization.

### Payload 5: Spoofed Announcement Creator
*   **Path**: `/announcements/announce_abc`
*   **Actor**: Authenticated user with `uid: malicious_attacker`
*   **Payload**: `{ "id": "announce_abc", "groupId": "math_class_555", "userId": "innocent_victim_uid", "userName": "Victim", "userAvatar": "victim.png", "content": "Fake Broadcast" }`
*   **Violation**: Spoofing the creator UID field to post on behalf of another user.

### Payload 6: Size-Attack Denial of Wallet
*   **Path**: `/announcements/announce_huge`
*   **Actor**: Authenticated user with `uid: malicious_attacker`
*   **Payload**: `{ "id": "announce_huge", "groupId": "math_class_555", "userId": "malicious_attacker", "userName": "Attacker", "userAvatar": "avatar.png", "content": "Lorem ipsum... [100,000 characters of junk to consume Firestore storage space]" }`
*   **Violation**: Injecting excessively large string content.

### Payload 7: Orphaned Task Creation
*   **Path**: `/tasks/task_xyz`
*   **Actor**: Authenticated user with `uid: malicious_attacker`
*   **Payload**: `{ "id": "task_xyz", "title": "Orphaned Task", "description": "No group", "dueDate": "2026-12-31", "priority": "high", "category": "Math", "isSynced": true, "createdBy": "Attacker", "createdById": "malicious_attacker", "groupId": "non_existent_group_id_999" }`
*   **Violation**: Creating tasks referencing non-existent parent groups.

### Payload 8: Mutating Immutable Task Timestamp
*   **Path**: `/tasks/task_xyz`
*   **Actor**: Authenticated user with `uid: malicious_attacker` (original creator)
*   **Payload**: `{ "id": "task_xyz", "title": "Updated Title", "createdById": "hacked_creator_id" }`
*   **Violation**: Attempting to alter immutable metadata such as `createdById`.

### Payload 9: Unauthorized Task Completion Hijacking
*   **Path**: `/completions/completion_abc`
*   **Actor**: Authenticated user with `uid: malicious_attacker`
*   **Payload**: `{ "classmateId": "innocent_victim_uid", "taskId": "task_123", "completed": true }`
*   **Violation**: Modifying completion states belonging to other classmates.

### Payload 10: Deleting Sibling Comment
*   **Path**: `/taskComments/comment_victim_456`
*   **Actor**: Authenticated user with `uid: malicious_attacker`
*   **Violation**: Attempting to delete a discussion comment posted by another classmate.

### Payload 11: Direct Attendance Tampering
*   **Path**: `/attendance_logs/log_999`
*   **Actor**: Authenticated user with `uid: malicious_attacker`
*   **Payload**: `{ "id": "log_999", "classmateId": "innocent_victim_uid", "date": "2026-06-24", "status": "Present", "subject": "Math" }`
*   **Violation**: Writing directly to attendance logs from the client SDK (by-passing the secure backend).

### Payload 12: Blank-Query Leak (Client-side Query Scraping)
*   **Path**: `/profiles`
*   **Actor**: Authenticated user with `uid: malicious_attacker`
*   **Operation**: Performing an unconstrained `list` query to scrap every user's security questions and answers.
*   **Violation**: Relying on the client to filter private fields, allowing data leakage.

---

## 3. The Test Runner Configuration
The security tests verify that each of the "Dirty Dozen" payloads yields a strict `PERMISSION_DENIED` response, validating that database security is authoritative at the rules level rather than the client application.
