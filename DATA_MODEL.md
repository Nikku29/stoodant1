# Data model, roles and rules

How the school records hang together in Firestore, who may read and write what, and how the rules
keep the data clean. The rules themselves are in `firestore.rules` and `storage.rules`; the emulator
tests in `functions/test/emulator/` prove each line of the role matrix below.

## Records and how they point at each other

Every record has an automatic id (like `Xk3f9...`). Everything else points at that id, never at a
name, so two children called "Aarav Sharma" are simply two ids.

| Collection | Points at | Kept by |
|---|---|---|
| `teachers/{teacherId}` | – | the team on /admin |
| `students/{studentId}` | `batchIds[]` → batches | the team on /admin |
| `batches/{batchId}` | `teacherId` → teachers | the team; `teacherPhone`, `teacherName`, `roster`, `studentIds` by functions |
| `sessions/{batchId}_{date}` | `batchId`; `attendance` keys → students | the batch's teacher |
| `assessments/{id}` | `batchId`; `scores` keys → students | the batch's teacher |
| `notes/{id}` | `batchId`, `studentId` | the batch's teacher |
| `materials/{id}` | `batchId`; file in Storage `materials/{batchId}/…` | the batch's teacher |
| `progress/{studentId}` | same id as the student | functions only |
| `batchAccess/{batchId}` | same id as the batch | functions only |
| `uniqueKeys/{hash}` | `{kind, id}` → a teacher or student | /admin, in the same write as the record |
| `leads`, `consentLog`, `leadDedupe`, `leadRequests`, `rateLimits` | – | the `submitLead` function only |

### Foreign keys (references)

Firestore has no foreign keys, so each reference is kept one of three ways:

- **Checked on write by the rules:** a batch's `teacherId` must be `''` (no teacher yet) or a teacher
  that exists. Sessions, tests, notes and materials must name a batch that exists, and their student
  ids must be on that batch's roster.
- **Cascade on delete (Cloud Functions):** deleting a batch removes it from every child's `batchIds`;
  deleting a teacher sets their batches' `teacherId` to `''` and their access ends at once; deleting a
  child removes them from rosters and deletes their progress page.
- **Offered only from real records:** /admin lists only batches that exist when a child is added to one.
  (Rules can look up at most 10 documents per write, so they can't check a whole list.)

### No duplicates (unique keys)

Firestore has no UNIQUE constraint either. A value that must not repeat gets its own document in
`uniqueKeys`, whose id is a SHA-256 hash of the value, written in the **same batch** as the record:

- **Teachers:** one per mobile number (`teacher|+91…`), because the number is how they log in.
- **Students:** one per parent's number + child's name (`student|+91…|aarav sharma`). Twins or
  siblings with different names are fine; the same child entered twice is refused. Case and extra
  spaces don't matter.

If the key already belongs to another record, its create fails and so does the whole write; /admin then
says "another teacher already has this mobile number" or "this child is already on the list with the
same parent's number". A key can't be deleted while its record still holds it. Records made before
keys existed get theirs from the triggers on their next change (or on deploy, see below).

### Names: sorting and search

Teachers and students carry `nameKey`: the name in lower case with single spaces. The rules check it
matches `name`. Lists sort by name with the id as a tie-break, so two children with the same name always
appear in the same order. `firestore.indexes.json` has indexes for name search when the lists outgrow
loading everything at once (today /admin loads all records, which is fine for a few hundred):

- students by `active` + `nameKey`, by `classLevel` + `nameKey`, by `batchIds` (contains) + `nameKey`
- teachers by `active` + `nameKey`

A prefix search is then `where("active","==",true), orderBy("nameKey"), startAt("aar"), endAt("aar")`.

## Who can do what

"Team" = signed in with Google and on the team list (`admin` claim). "Teacher" = signed in with the
phone number on a teacher record. "Parent" = signed in with the phone number on a child's record.
Visitors and other signed-in accounts get nothing at all. ✓ = allowed, – = refused.

| Data | Team | Teacher | Parent | Visitor |
|---|---|---|---|---|
| Demo requests (`leads`) | read, change status, add notes, delete | – | – | submit the form only (through the function) |
| Consent log | read | – | – | – |
| Team list | read, add, remove others (never themselves) | – | – | – |
| Teachers | read, add, edit, delete | read their own record | – | – |
| Students (parents' names and numbers) | read, add, edit, delete | – (sees children's names on the roster only) | – | – |
| Batches | read, add, edit (not roster/teacher phone) | read their own active batches | – | – |
| Attendance (`sessions`) | read, write, delete | write for own batch; fix within 48 h | – | – |
| Tests, notes | read, write, delete | write for own batch; fix or delete within 48 h | – | – |
| Study material | read, add, delete | add and delete for own batch | read for their child's batches | – |
| Progress pages | read | – | read their own child's | – |
| Unique keys | read one by id, add/remove with a record | – | – | – |
| Storage: teacher photos | upload originals | – | – | read the public versions |
| Storage: study files (≤ 20 MB; PDF, photos, Office, text; no SVG) | upload, read, delete | upload, read, delete for own batch | read for their child's batches | – |

Everything not listed is refused (`allow read, write: if false` at the top of both rule files).

## Deploying these rules

Deploy order matters because the new rules expect `nameKey` and unique keys from /admin:

1. Merge the PR (Vercel ships the new /admin).
2. Deploy functions, then Firestore rules and indexes, then Storage rules.
3. Run `node functions/scripts/backfill-keys.mjs` once, so records made before this change get their
   `nameKey` and unique key at once, and see any duplicates already in the data.
