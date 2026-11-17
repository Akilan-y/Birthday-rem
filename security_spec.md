# Firestore Security Specification

## 1. Data Invariants
1. **Strict Ownership**: Every document under `/users/{userId}`, `/users/{userId}/birthdays/{birthdayId}`, and `/users/{userId}/chatMessages/{messageId}` belongs exclusively to the verified Firebase Auth user whose `request.auth.uid == userId`.
2. **Verified Identity**: All read and write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **Master Gate**: Subcollection documents (`/birthdays/{birthdayId}`, `/chatMessages/{messageId}`) require the parent `/users/{userId}` document to exist with `uid == request.auth.uid`.
4. **Immutable Ownership & Creation Timestamps**: `uid`, `ownerId`, `id`, and `createdAt` can never be changed after creation. `createdAt` and `updatedAt` must equal `request.time`.
5. **Strict Schema & Bounds**: Unknown fields (shadow fields) are rejected via `keys().hasAll(...)` and `keys().hasOnly(...)` on create and `affectedKeys().hasOnly(...)` on update. All strings and arrays have strict max sizes.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Reading `/users/alice/birthdays` with `auth == null`.
2. **Unverified Email Spoofing**: Writing `/users/alice` with `auth.uid == 'alice'` and `auth.token.email_verified == false`.
3. **Cross-User Read (PII Leak)**: User `bob` calling `get` on `/users/alice`.
4. **Cross-User List Scraping**: User `bob` calling `list` on `/users/alice/birthdays`.
5. **OwnerId Spoofing on Create**: User `bob` creating `/users/bob/birthdays/b1` with `ownerId: "alice"`.
6. **Shadow Field Injection on Create**: User `alice` creating `/users/alice/birthdays/b1` with extra field `isAdmin: true`.
7. **Shadow Field Injection on Update**: User `alice` updating `/users/alice/birthdays/b1` with `affectedKeys` containing `role: "admin"`.
8. **Path ID Poisoning**: User `alice` writing to `/users/alice/birthdays/bad$id!`.
9. **String Denial-of-Wallet**: User `alice` creating a birthday with `note` of length 2000 (> 280).
10. **Array Bomb**: User `alice` creating a birthday with `celebratedYears` containing 500 elements (> 100) or non-integer values.
11. **Timestamp Forgery**: User `alice` creating a birthday with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
12. **Immutable Field Tampering**: User `alice` updating `createdAt` or `ownerId` on an existing birthday or mutating an existing `chatMessages` document.
