export const assign2 = {
    id: 'a2',
    type: 'assignment',
    title: "Crash Recovery",
    subtitle: "Assignment 2 — Filesystem Recovery with Journaling and Log Replay",
    keyTakeaway: "Filesystems can become inconsistent after crashes. Journaling (write-ahead logging) provides crash recovery by recording changes to a log before applying them. On recovery, we replay the log to restore the filesystem to a consistent state.",

    sections: [
        {
            id: "overview",
            title: "Assignment 2 Overview",
            content: `Assignment 2 explored what happens when a computer crashes while the filesystem is being modified. Without protection, crashes can leave the filesystem in an inconsistent state — files half-written, directory entries pointing to freed inodes, or blocks claimed by multiple files. This assignment implemented a **log replay** recovery mechanism.`,
            keyPoints: [
                "Crashes during filesystem writes can corrupt data structures",
                "Write-ahead logging: write changes to a log BEFORE modifying the filesystem",
                "Recovery: replay the log to re-apply changes that may have been lost",
                "fsckv6 checks for filesystem inconsistencies (like Unix's fsck utility)",
                "The log provides atomicity — changes either fully apply or don't apply at all"
            ]
        },
        {
            id: "recover-program",
            title: "The Recovery Program",
            content: `The main deliverable was **recover.cc** — a program that takes a crashed filesystem image and its log, then replays the log to restore consistency. It uses the \`V6Replay\` class to read log entries and the \`FScache\` for efficient disk access.`,
            codeExample: {
                title: "recover.cc — Replaying a log to recover a crashed filesystem",
                language: "cpp",
                code: `/* This program applies a log to a v6fs image. If
 * the image is corrupted due to a crash, but the
 * log has not been corrupted, applying the log will
 * bring the image back to its pre-crash state.
 */

#include <iostream>
#include <cstring>
#include "v6fs.hh"
#include "v6replay.hh"
#include "fscache.hh"

using namespace std;

int main(int argc, char* argv[]) {
    if (argc != 2) {
        cerr << "Usage: " << argv[0] << " <v6fs image file>" << endl;
        return 1;
    }

    string imageFile = argv[1];

    // Create a cache to read disk sectors efficiently
    FScache fscache(imageFile);

    // Log file is always <imagename>.log
    V6Replay replayer(imageFile + ".log");

    // Get each log entry and apply it to the filesystem
    V6LogEntry logEntry;
    while (replayer.getNextLogEntry(&logEntry)) {
        // Each log entry says "write these bytes to this sector"
        fscache.writeSector(logEntry.sectorNum, logEntry.sectorData);
    }

    // Flush all changes to disk
    fscache.sync();

    cout << "Recovery complete." << endl;
    return 0;
}`,
                annotations: [
                    { match: "FScache fscache(imageFile)", explanation: "Creates a cache for disk access. Instead of reading/writing the disk image directly, the cache buffers sectors in memory for efficiency and writes them all at once on sync()." },
                    { match: "V6Replay replayer(imageFile + \".log\")", explanation: "Opens the log file. The log contains a sequence of entries that record every filesystem modification made before the crash." },
                    { match: "replayer.getNextLogEntry(&logEntry)", explanation: "Reads the next log entry. Returns false when all entries have been read. Each entry contains a sector number and the data that should be at that sector." },
                    { match: "fscache.writeSector(logEntry.sectorNum, logEntry.sectorData)", explanation: "Re-applies the logged change by writing the sector data to the filesystem image. This is the core of recovery — replaying each change." },
                    { match: "fscache.sync()", explanation: "Flushes all buffered writes to the actual disk image file. Without this, changes would only be in memory." }
                ]
            }
        },
        {
            id: "crash-scenarios",
            title: "Crash Scenarios & Inconsistencies",
            content: `When a filesystem operation requires multiple disk writes (e.g., creating a file needs updating the inode table, writing the directory entry, and marking blocks as used), a crash between any of these writes leaves the filesystem inconsistent. Different crash points cause different types of corruption.`,
            keyPoints: [
                "Creating a file requires: allocate inode → write inode data → add directory entry → update free block bitmap",
                "Crash after inode allocation but before directory entry → orphaned inode (leaked space)",
                "Crash after directory entry but before inode init → directory points to garbage",
                "Crash during block bitmap update → blocks claimed by multiple files or lost",
                "fsckv6 detects these by cross-checking inodes, directories, and bitmaps"
            ],
            diagram: `
Creating a file requires multiple disk writes:

Step 1: Allocate inode in inode table
Step 2: Initialize inode with file metadata
Step 3: Add (name, inode#) to parent directory
Step 4: Update free block bitmap

What if we crash...

After Step 1 only:
  ✗ Inode allocated but not initialized → garbage data
  ✗ No directory entry → inode is an orphan (unreachable)
  ✗ Bitmap says inode is used → leaked space

After Step 3 only:
  ✗ Directory entry exists but inode may be garbage
  ✗ ls shows the file, but reading it gives corrupt data

With Journaling (write-ahead log):
  ✓ Log records ALL changes before they happen
  ✓ On crash → replay log → all changes applied atomically
  ✓ Either all steps complete or none do
`
        },
        {
            id: "questions-analysis",
            title: "Key Questions & Concepts",
            content: `The assignment included important conceptual questions about crash recovery, security, and filesystem consistency checking. These questions tested understanding of WHY journaling works and its limitations.`,
            keyPoints: [
                "fsckv6 output shows discrepancies between expected and actual block counts",
                "A block claimed by no files = lost block (wasted space but not data corruption)",
                "A block claimed by two files = critical error (data could be overwritten)",
                "Journaling prevents inconsistency; fsck repairs it after the fact",
                "Journaling has overhead (writes happen twice: once to log, once to filesystem)",
                "Security consideration: deleted file data may still be on disk until overwritten"
            ]
        },
        {
            id: "summary",
            title: "Assignment 2 Summary",
            content: `Assignment 2 demonstrated that filesystem reliability requires careful engineering. The write-ahead log pattern (journal) provides crash atomicity — operations either fully complete or can be fully replayed. This same pattern is used by modern filesystems (ext4, NTFS, APFS) and databases.`,
            keyPoints: [
                "Crashes during multi-step filesystem ops → inconsistent state",
                "Write-ahead logging: record changes BEFORE applying them",
                "Recovery: replay the log to restore consistency",
                "fsck is a fallback: detects and repairs inconsistencies after the fact",
                "Same pattern used in databases (transaction logs) and modern filesystems"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Crash Recovery Order",
            difficulty: "medium",
            description: "Explain why the log must be written BEFORE the filesystem changes, not after.",
            hint: "Think about what information is available after a crash depending on the order.",
            starterCode: `// Why not write changes first, THEN log them?

// Approach A (write-ahead): Log → Filesystem change
// Approach B (write-behind): Filesystem change → Log

// What happens if we crash during Approach B?
// Answer: ____

// Why is Approach A safe?
// Answer: ____`,
            solution: `// Why not write changes first, THEN log them?

// Approach B (write-behind): Filesystem change → Log
// If crash occurs AFTER filesystem change but BEFORE log:
//   → Filesystem has partial changes (inconsistent)
//   → Log is incomplete, so recovery can't tell what happened
//   → We can't undo the partial change or complete it
//   → DATA CORRUPTION with no recovery path!

// Approach A (write-ahead): Log → Filesystem change
// If crash occurs AFTER log but BEFORE filesystem change:
//   → Log has the complete intended change
//   → Filesystem may be stale but is still consistent
//   → Recovery replays the log → change is applied correctly
//   → SAFE! Either it was applied before crash, or we redo it now

// If crash occurs BEFORE log is written:
//   → Log is empty, filesystem unchanged → consistent (change lost but safe)

// Key insight: the LOG is the source of truth, the filesystem
// can always be reconstructed from the log.`,
            explanation: "Write-ahead logging works because the log is written atomically (a single sector write). If the log write succeeds, we know the full change and can replay it. If it fails, nothing happened."
        }
    ]
};

export default assign2;
