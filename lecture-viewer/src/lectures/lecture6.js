export const lecture6 = {
    id: 6,
    title: "Crash Recovery, Continued",
    subtitle: "Ordered Writes and Write-Ahead Logging (Journaling)",
    keyTakeaway: "There are various ways to implement crash recovery, such as ordered writes and journaling, each with tradeoffs between durability, consistency, and performance. Write-ahead logging (journaling) is a powerful approach that logs operations before performing them, enabling quick recovery from crashes.",

    sections: [
        {
            id: "overview",
            title: "Recap: Crash Recovery Approaches",
            content: `We've discussed that crashes during filesystem operations can lead to **data loss** and **inconsistency**. Last lecture, we introduced the free list, block cache, and began discussing crash recovery approaches. Today we dive deeper into ordered writes and introduce **write-ahead logging (journaling)**.`,
            keyPoints: [
                "Challenge #1 - Data loss: crashes can happen at any time, not all data might have been saved to disk",
                "Challenge #2 - Inconsistency: crashes could happen mid-operation, leaving disk in inconsistent state",
                "Example inconsistency: inode updated to store block number, but block wasn't marked as used",
                "We need strategies to minimize both data loss AND inconsistency"
            ],
            codeExample: {
                title: "Crash scenario: Adding a block to a file",
                language: "cpp",
                code: `// Adding a block to a file requires multiple operations:
// 1. Update free list (mark block as used)
// 2. Update inode (add block number to i_addr)
// 3. Write actual data to the block

// What if we crash between step 2 and step 1?
void add_block_crash_scenario(Inode *ip, uint16_t new_block) {
    // WRONG ORDER:
    ip->i_addr[next_slot] = new_block;  // Step 2 first
    ip->writeback();
    
    // CRASH HERE! Block is in inode BUT also in free list!
    // Result: Two files could claim the same block later!
    //         This is CROSS-ALLOCATION - severe corruption!
    
    freelist.mark_used(new_block);      // Step 1 never happens
    freelist.writeback();
}

// What if we crash between step 1 and step 2?
void add_block_leak_scenario(Inode *ip, uint16_t new_block) {
    freelist.mark_used(new_block);      // Step 1 first
    freelist.writeback();
    
    // CRASH HERE! Block marked used but not in any inode
    // Result: Block is "leaked" - unusable but not freed
    //         Less severe - can reclaim later!
    
    ip->i_addr[next_slot] = new_block;  // Step 2 never happens
    ip->writeback();
}`,
                annotations: [
                    { match: "Inode", explanation: "A data structure storing file metadata: size, permissions, timestamps, and block pointers. Each file has one inode." },
                    { match: "i_addr", explanation: "Array of block pointers in the inode. Points to the disk blocks that store the file's data." },
                    { match: "uint16_t", explanation: "Unsigned 16-bit integer (0-65535). Used for block numbers in V6 Unix, limiting disk size to ~32MB." },
                    { match: "writeback", explanation: "Writes the in-memory data structure back to disk. Essential for persistence but creates crash vulnerability." },
                    { match: "mark_used", explanation: "Sets the block's bit to 0 in the free bitmap, indicating it's no longer available for allocation." },
                    { match: "CROSS-ALLOCATION", explanation: "A severe corruption where two files claim the same disk block. Data from one file can overwrite the other!" },
                    { match: "next_slot", explanation: "Index of the next available slot in i_addr to store a new block pointer." },
                    { match: "leaked", explanation: "A block marked as used but not referenced by any file. Wastes space but doesn't corrupt data." }
                ]
            }
        },
        {
            id: "fsck-recap",
            title: "Approach #1: fsck (Recap)",
            content: `The **fsck** (file system check) program runs at boot time to scan the filesystem for inconsistencies and repair them. This is a reactive approach - we let inconsistencies happen and fix them afterward.`,
            keyPoints: [
                "Runs when we reboot after a crash",
                "Scans all metadata (inodes, directories, free list) to identify inconsistencies",
                "Repairs problems: fix link counts, rebuild free list, move orphans to lost+found",
                "Goal: restore consistency and minimize information loss"
            ],
            diagram: `
fsck Workflow:
                                                           
  System crashes    ──►  Reboot   ──►   fsck runs   ──►  System ready
                                           │
                                           ▼
                               ┌─────────────────────────┐
                               │  1. Scan all inodes     │
                               │  2. Build actual bitmap │
                               │  3. Compare with stored │
                               │  4. Scan directories    │
                               │  5. Fix link counts     │
                               │  6. Rebuild free list   │
                               └─────────────────────────┘

Downsides:
  • TIME: Must scan ENTIRE disk - 5TB disk = 8+ hours!
  • BLOCKING: Can't use system until fsck completes
  • DATA LOSS: Restores consistency, but can't prevent data loss
  • SECURITY: Blocks could migrate between files
            `,
            codeExample: {
                title: "fsck detection from assign2",
                language: "cpp",
                code: `// From fsckv6.cc - Main fsck logic
int fsck(V6FS &fs, bool write = true) {
    Fsck fsck(fs);
    bool res = true;
    
    // Step 1: Scan all inodes and their blocks
    // Build a bitmap of actually-used blocks
    if (!fsck.scan_inodes()) {
        std::cout << "scan inodes required fixes\\n";
        res = false;
        if (write) fsck.apply();
    }
    
    // Step 2: Compare our computed freemap vs stored free list
    bool ok = false;
    try {
        ok = fsck.freemap_ == fs_freemap(fs);
    } catch(std::exception&) {}
    if (!ok) {
        std::cout << "free list was incorrect\\n";
        res = false;
    }
    
    // Step 3: Scan directory tree for problems
    if (!fsck.scan_directory(fs.iget(ROOT_INUMBER))) {
        std::cout << "scan directories required fixes\\n";
        res = false;
        if (write) fsck.apply();
    }
    
    // Step 4-6: Fix link counts and rebuild free list
    if (!fsck.fix_nlink()) {
        res = false;
    }
    if (write) {
        fsck.apply();
        fsck.rebuild_freelist();
    }
    
    return res ? 0 : 1;
}`,
                annotations: [
                    { match: "V6FS", explanation: "The V6 File System object representing the entire filesystem including superblock, inodes, and data blocks." },
                    { match: "Fsck", explanation: "File System Check class - scans the filesystem for inconsistencies and can repair them." },
                    { match: "scan_inodes", explanation: "Iterates through all inodes, checking each one for problems and building a bitmap of which blocks are actually in use." },
                    { match: "freemap_", explanation: "A bitmap computed by scanning all files, showing which blocks are actually referenced by inodes." },
                    { match: "fs_freemap", explanation: "Reads the free list from disk and converts it to a bitmap format for comparison." },
                    { match: "scan_directory", explanation: "Recursively walks the directory tree checking for bad inode numbers, duplicates, and missing . and .. entries." },
                    { match: "ROOT_INUMBER", explanation: "The inode number of the root directory, always 1 in Unix filesystems." },
                    { match: "iget", explanation: "Gets an inode by number, loading it from disk if not already cached." },
                    { match: "fix_nlink", explanation: "Compares i_nlink in each inode against actual directory references and fixes mismatches." },
                    { match: "rebuild_freelist", explanation: "Constructs a new free list from scratch based on the computed bitmap." }
                ]
            }
        },
        {
            id: "ordered-writes-detail",
            title: "Approach #2: Ordered Writes (Continued)",
            content: `We can **prevent certain kinds of inconsistencies** by carefully ordering our write operations. The key insight is that some orderings are safer than others - we prefer "leaking" resources over corrupting data.`,
            keyPoints: [
                "Rule 1: Always initialize target BEFORE creating reference to it",
                "Rule 2: Before reusing a resource, NULLIFY all existing references first",
                "Philosophy: Leaked resources are recoverable; data corruption is NOT",
                "Result: eliminates the need to wait for fsck on reboot!"
            ],
            diagram: `
Ordered Writes Rules:

RULE 1: Initialize BEFORE referencing
─────────────────────────────────────
  Creating a file:
    ✓ SAFE:   1. Initialize inode  →  2. Add directory entry
              (crash after 1: orphan inode, recoverable)
    
    ✗ UNSAFE: 1. Add directory entry  →  2. Initialize inode
              (crash after 1: dirent points to garbage!)


RULE 2: Remove references BEFORE reusing
────────────────────────────────────────
              
  What if file no longer needs        What if file no longer needs
  its last block (WRONG ORDER):       its last block (RIGHT ORDER):
  
  1. Mark block as free in            1. Update inode to no longer
     free list                           refer to this block number
     |                                   |
     | CRASH!                            | CRASH!
     |                                   |
  2. Update inode to remove block     2. Mark block as free in free list
  
  Problem: block in file AND          Less-severe issue: leaked block
  marked free! (DATA CORRUPTION)      (can reclaim later)
            `,
            codeExample: {
                title: "Ordered writes for freeing a block",
                language: "cpp",
                code: `// WRONG ORDER - can cause block to be in two places at once
void remove_block_wrong(Inode *ip, int slot) {
    int block = ip->i_addr[slot];
    
    // Step 1: Add to free list FIRST
    freelist.mark_free(block);
    freelist.writeback();
    
    // CRASH HERE = block in file AND in free list!
    // Another file might claim this "free" block!
    // Result: TWO FILES SHARING SAME BLOCK (corruption!)
    
    // Step 2: Remove from inode
    ip->i_addr[slot] = 0;
    ip->writeback();
}

// RIGHT ORDER - worst case is leaked block
void remove_block_correct(Inode *ip, int slot) {
    int block = ip->i_addr[slot];
    
    // Step 1: Remove reference from inode FIRST
    ip->i_addr[slot] = 0;
    ip->writeback();
    
    // CRASH HERE = block not in inode, not in free list
    // Block is "leaked" but NO corruption - can reclaim later
    
    // Step 2: Now safe to add to free list
    freelist.mark_free(block);
    freelist.writeback();
}`,
                annotations: [
                    { match: "remove_block_wrong", explanation: "Demonstrates INCORRECT order: marking block free before removing from inode. A crash can cause cross-allocation." },
                    { match: "remove_block_correct", explanation: "Demonstrates CORRECT order: remove reference first, then add to free list. Worst case is a leaked block." },
                    { match: "mark_free", explanation: "Sets the block's bit to 1 in the free bitmap, making it available for future allocation." },
                    { match: "i_addr[slot]", explanation: "The slot in the inode's block pointer array that stores this block number." },
                    { match: "TWO FILES SHARING", explanation: "Cross-allocation: if a block is in free list AND an inode, another file can claim it causing data corruption." },
                    { match: "leaked", explanation: "A block not reachable by any file but marked as used. Wastes space but doesn't corrupt data." }
                ]
            }
        },
        {
            id: "ordered-writes-downsides",
            title: "Ordered Writes: Downsides",
            content: `While ordered writes prevent the worst inconsistencies, they have significant drawbacks related to **performance** and **resource leaks**.`,
            keyPoints: [
                "Downside #1 - Performance: Forces synchronous writes in the middle of operations",
                "This partially defeats the point of the block cache (delayed writes for speed)",
                "Improvement: Block cache tracks dependencies between blocks for later",
                "Can do writes asynchronously since we remember the required order"
            ],
            diagram: `
Block Cache with Dependencies:

Example: Adding a block to file A
  - Requires updating inode and free list
  - Must write free list (block 99) before inode (block 12)

Block cache:
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Block 99 │◄───│ Block 54 │    │ Block 23 │    │ Block 12 │
│ (chunk   │    │          │    │          │    │ (contains│
│ of free  │    │          │    │          │    │ file A   │
│ list)    │    │          │    │          │    │ inode)   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
      ▲                                               │
      │                                               │
      └───────────── Must write first ────────────────┘

Circular Dependency Problem:
  First, operation to delete file A: update inode 12, then free list 99
  Later, operation to create file B: update free list 99, then inode 12
  
  Block 12 ──must write before──► Block 99
      ▲                              │
      └──────must write before───────┘  CIRCULAR!
      
Solution: If new operation creates circular dependency, 
          STOP and write existing ops to disk first
            `,
            codeExample: {
                title: "Tracking dependencies in block cache",
                language: "cpp",
                code: `// Dependencies between cached blocks
struct BlockDependency {
    uint16_t must_write_first;
    uint16_t then_write;
};

class DependencyTracker {
    std::vector<BlockDependency> deps_;
    
public:
    // Add a dependency: block A must be written before block B
    bool add_dependency(uint16_t first, uint16_t second) {
        // Check for circular dependency
        if (would_create_cycle(second, first)) {
            // Must flush existing operations to disk first!
            flush_all_dirty_blocks();
            deps_.clear();
        }
        
        deps_.push_back({first, second});
        return true;
    }
    
    // Check if adding second->first would create a cycle
    bool would_create_cycle(uint16_t from, uint16_t to) {
        // BFS/DFS to check if 'to' is reachable from 'from'
        std::queue<uint16_t> worklist;
        std::set<uint16_t> visited;
        worklist.push(from);
        
        while (!worklist.empty()) {
            uint16_t curr = worklist.front();
            worklist.pop();
            
            if (curr == to) return true;  // Cycle detected!
            if (visited.count(curr)) continue;
            visited.insert(curr);
            
            for (auto& dep : deps_) {
                if (dep.must_write_first == curr) {
                    worklist.push(dep.then_write);
                }
            }
        }
        return false;
    }
};`,
                annotations: [
                    { match: "BlockDependency", explanation: "A struct representing a write ordering constraint: one block must be written to disk before another." },
                    { match: "DependencyTracker", explanation: "A class that tracks all write ordering dependencies and detects circular dependencies." },
                    { match: "add_dependency", explanation: "Registers that block 'first' must be written to disk before block 'second'." },
                    { match: "would_create_cycle", explanation: "Uses BFS/DFS to check if adding a new dependency would create a circular dependency." },
                    { match: "flush_all_dirty_blocks", explanation: "Writes all modified blocks to disk, clearing all dependencies and allowing new operations." },
                    { match: "std::queue", explanation: "A FIFO data structure used here for BFS traversal of the dependency graph." },
                    { match: "std::set", explanation: "A sorted container that stores unique elements. Used here to track visited nodes." },
                    { match: "worklist", explanation: "A queue of blocks to visit during the graph traversal for cycle detection." }
                ]
            }
        },
        {
            id: "ordered-writes-leaks",
            title: "Ordered Writes: Resource Leaks",
            content: `The ordered writes approach can **leak resources** - for example, a block could be removed from the free list but never actually used. We need a way to reclaim these.`,
            keyPoints: [
                "Downside #2: Can leak resources (e.g., free block marked used but never added to file)",
                "Improvement: Run fsck in the BACKGROUND to reclaim leaked resources",
                "fsck can run in background because filesystem is consistent, just resources leaked",
                "Much faster than full fsck scan since we know the filesystem is structurally sound",
                "Question: Can we do better? Can we avoid leaking data entirely?"
            ],
            codeExample: {
                title: "Background resource recovery",
                language: "cpp",
                code: `// Background fsck to reclaim leaked resources
// Much simpler than full fsck since filesystem is consistent!

void background_reclaim(V6FS &fs) {
    Bitmap computed_freemap(fs.num_blocks());
    
    // Mark all blocks as free initially
    computed_freemap.set_all(true);
    
    // Scan all inodes and mark their blocks as used
    for (uint16_t ino = ROOT_INUMBER; ino < fs.num_inodes(); ino++) {
        Inode *ip = fs.iget(ino);
        if (!(ip->i_mode & IALLOC)) continue;
        
        for (int i = 0; i < num_blocks(ip); i++) {
            uint16_t bn = get_block_number(ip, i);
            if (bn != 0) {
                computed_freemap.at(bn) = false;  // Mark as used
            }
        }
    }
    
    // Compare with stored free list
    Bitmap stored_freemap = fs_freemap(fs);
    
    int reclaimed = 0;
    for (uint16_t bn = fs.datastart(); bn < fs.num_blocks(); bn++) {
        // Block marked used in stored, but actually free?
        if (!stored_freemap.at(bn) && computed_freemap.at(bn)) {
            // LEAKED BLOCK! Reclaim it.
            fs.bfree(bn);
            reclaimed++;
        }
    }
    
    std::cout << "Reclaimed " << reclaimed << " leaked blocks\\n";
}`,
                annotations: [
                    { match: "background_reclaim", explanation: "A function that scans the filesystem to find and reclaim leaked blocks. Can run in background since filesystem is consistent." },
                    { match: "computed_freemap", explanation: "A bitmap we build by scanning all inodes, representing which blocks are actually in use." },
                    { match: "set_all", explanation: "Sets all bits in the bitmap to the given value. Here, we start by assuming all blocks are free." },
                    { match: "IALLOC", explanation: "A flag in i_mode indicating the inode is allocated (in use). If not set, the inode is free." },
                    { match: "get_block_number", explanation: "Gets the physical block number for a given logical block index, handling indirection for large files." },
                    { match: "stored_freemap", explanation: "The free list as stored on disk, converted to bitmap format for comparison." },
                    { match: "datastart", explanation: "The first block number available for data storage (after boot, superblock, and inode blocks)." },
                    { match: "bfree", explanation: "Adds a block back to the free list, making it available for future allocation." },
                    { match: "LEAKED BLOCK", explanation: "A block marked as used in the free list but not referenced by any file. Can be safely reclaimed." }
                ]
            }
        },
        {
            id: "journaling-intro",
            title: "Approach #3: Write-Ahead Logging (Journaling)",
            content: `**Write-ahead logging** (also called **journaling**) keeps a "paper trail" of disk operations that we can revisit if a crash occurs. Before performing an operation, we record its info in an append-only log file on disk.`,
            keyPoints: [
                "Core idea: append-only log file on disk stores info about disk operations",
                "Before performing an operation, record its info in the log (\"write-ahead\")",
                "Write the log entry to disk BEFORE doing the actual operation",
                "Example: \"I am adding block 4267 to inode 27, index 5\"",
                "If crash occurs, replay the log to make sure all updates are completed",
                "Log is the \"source of truth\" - can detect/fix inconsistencies without full disk scan"
            ],
            diagram: `
Write-Ahead Logging Flow:

Normal Operation:
  ┌─────────────────────────────────────────────────────────────┐
  │  1. Write log entry: "set inode 5's i_addr[1] = block 24"   │
  │  2. Flush log to disk (synchronous)                         │
  │  3. Perform actual operation (can be delayed)               │
  │  4. Mark log entry as complete                              │
  └─────────────────────────────────────────────────────────────┘

After a crash:
  ┌─────────────────────────────────────────────────────────────┐
  │  1. Read log from last checkpoint                           │
  │  2. Replay all complete transactions                        │
  │  3. Discard incomplete transactions                         │
  │  4. Resume normal operation - FAST!                         │
  └─────────────────────────────────────────────────────────────┘

Log Structure:
  ┌────────┬────────────┬────────────┬────────────┬────────────┐
  │LogBegin│ LogPatch   │ LogPatch   │LogBlockFree│ LogCommit  │
  │ (tx 1) │(inode mod) │(dirent add)│  (block)   │  (tx 1)    │
  └────────┴────────────┴────────────┴────────────┴────────────┘
       ▲                                               ▲
       │                                               │
    Transaction                               Transaction complete!
     starts                                   Safe to apply all
            `,
            codeExample: {
                title: "Log entry types from assign2",
                language: "cpp",
                code: `// From logentry.hh - Log entry types

// LogPatch: A change to metadata on disk
// Contains specific bytes to write at a specific position
struct LogPatch {
    uint16_t blockno;           // Block number to patch
    uint16_t offset_in_block;   // Offset within block of patch
    std::vector<uint8_t> bytes; // Bytes to place at offset_in_block
    
    // Example: "set inode 5's i_addr[1] = 24"
    // blockno = block containing inode 5
    // offset_in_block = offset of i_addr[1] within that block
    // bytes = {24, 0} (little-endian block number)
};

// LogBlockFree: A block that was freed
struct LogBlockFree {
    uint16_t blockno;           // Block number that is now free
};

// LogBlockAlloc: A block that was allocated
struct LogBlockAlloc {
    uint16_t blockno;       // Block number that was allocated
    uint8_t zero_on_replay; // Should zero out block on replay?
    // zero_on_replay = 1 for metadata blocks (always zeroed)
    // zero_on_replay = 0 for data blocks (may have unlogged writes)
};

// Transaction boundaries
struct LogBegin {};     // Marks start of transaction
struct LogCommit {
    lsn_t sequence;     // Serial number of matching LogBegin
};
struct LogRewind {};    // Log wrapped around, continue at start`,
                annotations: [
                    { match: "LogPatch", explanation: "A log entry that records a specific change to metadata: which block, what offset, and what bytes to write." },
                    { match: "blockno", explanation: "The disk block number where the change will be applied." },
                    { match: "offset_in_block", explanation: "The byte offset within the block where the patch should be applied." },
                    { match: "std::vector<uint8_t>", explanation: "A dynamic array of bytes representing the exact data to write at the specified location." },
                    { match: "LogBlockFree", explanation: "A log entry indicating a block was freed and should be added to the free list on replay." },
                    { match: "LogBlockAlloc", explanation: "A log entry indicating a block was allocated and should be marked as used on replay." },
                    { match: "zero_on_replay", explanation: "Flag indicating if block should be zeroed during replay. True for metadata, false for data blocks." },
                    { match: "LogBegin", explanation: "Marks the start of an atomic transaction. All entries until LogCommit are part of this transaction." },
                    { match: "LogCommit", explanation: "Marks the end of a transaction. Only transactions with both LogBegin and LogCommit are replayed." },
                    { match: "lsn_t", explanation: "Log Sequence Number type - a unique, monotonically increasing number for each log entry." },
                    { match: "LogRewind", explanation: "Special entry indicating the log has wrapped around to the beginning (circular buffer)." }
                ]
            }
        },
        {
            id: "journaling-log-example",
            title: "Journaling: Log Entry Example",
            content: `Let's look at what actual log entries look like. Each entry has a **log sequence number (LSN)** for ordering and verification.`,
            keyPoints: [
                "Each log entry has a unique sequence number (LSN)",
                "LogBegin and LogCommit wrap atomic transactions",
                "LogPatch specifies exact bytes to write at a specific disk location",
                "LogBlockAlloc and LogBlockFree track block allocation changes",
                "Entries can be replayed to reconstruct filesystem state"
            ],
            codeExample: {
                title: "Example log output from assign2",
                language: "cpp",
                code: `/*
Example log from assign2 (viewed with dumplog tool):

[offset 33562846]
* LSN 1838326418
  LogBlockAlloc
    blockno: 1027
    zero_on_replay: 0        ← Data block, don't zero on replay

[offset 33562862]
* LSN 1838326419
  LogPatch
    blockno: 8               ← Block containing inode #52
    offset_in_block: 136     ← Offset of i_addr[0] field  
    bytes: 0x0403            ← Block pointer 1027 (little-endian)
    inode #52 (i_addr[0] = block pointer 1027)

Transaction example:

[offset 33562400]
* LSN 1838326410
  LogBegin                   ← Start of atomic transaction

* LSN 1838326411  
  LogBlockAlloc
    blockno: 1028
    zero_on_replay: 1        ← Metadata (directory), zero on replay

* LSN 1838326412
  LogPatch                   ← Update directory entry
    blockno: 1028
    offset_in_block: 0
    bytes: 0x350074657374... ← dirent (53, "test")

* LSN 1838326413
  LogCommit
    sequence: 1838326410     ← Matches LogBegin - transaction complete!
*/`,
                annotations: [
                    { match: "LSN", explanation: "Log Sequence Number - a unique, monotonically increasing identifier for each log entry." },
                    { match: "offset", explanation: "The byte position in the log file where this entry is stored." },
                    { match: "zero_on_replay: 0", explanation: "This is a data block - don't zero it on replay because it may contain file data we want to keep." },
                    { match: "zero_on_replay: 1", explanation: "This is a metadata block - zero it on replay to ensure clean state before applying patches." },
                    { match: "little-endian", explanation: "Byte order where least significant byte comes first. 0x0403 = 1027 in decimal." },
                    { match: "dirent", explanation: "Directory entry - a (name, inode number) pair that maps a filename to its inode." },
                    { match: "atomic transaction", explanation: "A group of operations that must all succeed or all fail together - no partial completion." },
                    { match: "sequence: 1838326410", explanation: "The LogCommit's sequence matches the LogBegin's LSN, confirming the transaction is complete." }
                ]
            }
        },
        {
            id: "journaling-metadata",
            title: "Journaling: What Gets Logged?",
            content: `Typically we only log **metadata operations**, not actual file data. Logging all file data would be much more expensive since files can be very large.`,
            keyPoints: [
                "Typically only log METADATA operations (inode changes, directory updates)",
                "Not actual file data - data is much more expensive (bigger writes)",
                "Tradeoff: metadata-only journaling is faster but file data could be lost",
                "Some filesystems offer choice: journal metadata only vs. full data journaling",
                "Most modern filesystems use some form of logging (Windows NTFS, Linux ext4)"
            ],
            codeExample: {
                title: "Deciding what to log from assign2",
                language: "cpp",
                code: `// From log.cc - Block allocation with logging

uint16_t V6Log::balloc_near(uint16_t near, bool metadata) {
    // Find a free block in the bitmap
    if (fs_.badblock(near))
        near = fs_.superblock().datastart();
    int bn = freemap_.find1(near);
    if (bn < 0)
        return 0;  // No free blocks!
    
    // Mark block as used in our in-memory freemap
    freemap_.at(bn) = false;
    
    // Log the allocation if we're in a transaction
    if (in_tx_) {
        // Log entry records: block number and whether to zero on replay
        log(LogBlockAlloc{ uint16_t(bn), metadata });
        // metadata=true: zero on replay (directory blocks, indirect blocks)
        // metadata=false: don't zero (might have file data we want to keep)
    }
    
    return bn;
}

void V6Log::bfree(uint16_t blockno) {
    assert(in_tx_);  // Must be in a transaction!
    
    // Don't actually free yet - wait until transaction commits
    // This prevents issues if we crash mid-transaction
    freed_.push_back(blockno);
    
    // Log the free operation
    log(LogBlockFree{blockno});
}

void V6Log::commit() {
    // Write commit entry to log
    log(LogCommit{begin_sequence_});
    
    // NOW actually mark freed blocks as free
    // (we delayed this until commit to maintain consistency)
    for (uint16_t bn : freed_)
        freemap_.at(bn) = true;
    freed_.clear();
    
    in_tx_ = false;
    
    // Checkpoint if log is getting full or it's been a while
    if (space() < hdr_.logbytes() / 2)
        checkpoint();
    else if (time(nullptr) > checkpoint_time_ + 30)
        checkpoint();
}`,
                annotations: [
                    { match: "V6Log", explanation: "The logging layer for the V6 filesystem. Wraps all operations that modify the filesystem." },
                    { match: "balloc_near", explanation: "Allocates a free block near the specified block number for better locality. Returns 0 if no free blocks." },
                    { match: "badblock", explanation: "Returns true if the block number is outside the valid range for this filesystem." },
                    { match: "find1", explanation: "Searches the bitmap for the next free block (a '1' bit) starting from the given position." },
                    { match: "in_tx_", explanation: "Boolean flag indicating whether we're currently in a transaction. Operations must be in transactions." },
                    { match: "bfree", explanation: "Frees a block - but delays the actual free until transaction commits to maintain consistency." },
                    { match: "freed_", explanation: "A vector of block numbers freed during the current transaction. Actually freed on commit." },
                    { match: "commit", explanation: "Completes the current transaction. Writes LogCommit and actually frees delayed blocks." },
                    { match: "begin_sequence_", explanation: "The LSN of the LogBegin for the current transaction. Used to match with LogCommit." },
                    { match: "checkpoint", explanation: "Writes all pending data to disk and updates log header, allowing old log entries to be discarded." },
                    { match: "space()", explanation: "Returns the amount of free space remaining in the log. Triggers checkpoint when low." }
                ]
            }
        },
        {
            id: "journaling-checkpoint",
            title: "Journaling: Log Truncation and Checkpoints",
            content: `The log can get very long over time! We periodically create **checkpoints** to truncate the log once we confirm that portion is no longer needed.`,
            keyPoints: [
                "Problem: Log keeps growing as we record more operations",
                "Solution: Periodic \"checkpoints\" - truncate log when confirmed no longer needed",
                "Checkpoint: write all pending operations to disk, then update log header",
                "After checkpoint, we only need to replay operations AFTER the checkpoint",
                "Balance: checkpoint too often = overhead, too rarely = long replay on crash"
            ],
            codeExample: {
                title: "Checkpoint implementation from assign2",
                language: "cpp",
                code: `// From log.cc - Checkpoint to truncate log

void V6Log::checkpoint() {
    assert(!in_tx_);  // Can't checkpoint mid-transaction!
    
    if (suppress_commit_) {
        w_.flush();
        fs_.sync();
        return;
    }
    
    // Update checkpoint location to current position
    hdr_.l_checkpoint = w_.tell();
    hdr_.l_sequence = sequence_ + 1;
    
    // Stick null transaction after checkpoint
    // (ensures valid log state if we crash right after checkpoint)
    log(LogBegin{});
    log(LogCommit{sequence_});
    
    // Flush log to disk
    flush();
    fs_.sync();
    applied_ = committed_;
    
    // Actually mark freed blocks as free in the bitmap
    std::vector<uint16_t> freed(std::move(freed_));
    freed_.clear();
    for (uint16_t bn : freed)
        freemap_.at(bn) = true;
    
    // Write updated freemap to disk
    if (pwrite(fs_.fd_, freemap_.data(), freemap_.datasize(),
               hdr_.mapstart() * SECTOR_SIZE) == -1)
        threrror("pwrite");
    
    // Write updated log header
    fs_.writeblock(&hdr_, hdr_.l_hdrblock);
    checkpoint_time_ = time(nullptr);
}

// Log structure on disk with checkpoint:
//
//   +-----+-----+--------+------------------+---+------+---------+
//   |boot |super| inodes |      data        |log| free | journal |
//   |block|block|        |      blocks      |hdr| map  |  (log)  |
//   +-----+-----+--------+------------------+---+------+---------+
//                                            ▲
//                                      l_checkpoint points here
//                                      (start replaying from here)`,
                annotations: [
                    { match: "checkpoint", explanation: "Creates a recovery point. All transactions before this point are guaranteed to be on disk." },
                    { match: "assert(!in_tx_)", explanation: "Safety check: cannot checkpoint in the middle of a transaction - would leave incomplete work." },
                    { match: "suppress_commit_", explanation: "Flag to disable normal commit behavior, used in special cases like replay." },
                    { match: "l_checkpoint", explanation: "Field in log header storing the byte offset where replay should start after a crash." },
                    { match: "l_sequence", explanation: "Field in log header storing the next LSN to use. Ensures unique sequence numbers." },
                    { match: "null transaction", explanation: "An empty LogBegin/LogCommit pair ensuring the log is in a valid state after checkpoint." },
                    { match: "fs_.sync()", explanation: "Flushes all filesystem buffers to disk, ensuring data durability." },
                    { match: "pwrite", explanation: "POSIX function that writes to a file at a specific offset without changing the file position." },
                    { match: "SECTOR_SIZE", explanation: "The size of a disk sector (typically 512 bytes). The smallest unit of disk I/O." },
                    { match: "l_hdrblock", explanation: "The block number where the log header is stored on disk." }
                ]
            }
        },
        {
            id: "journaling-transactions",
            title: "Journaling: Atomic Transactions",
            content: `Multiple log entries might form a single "operation" that should happen ** atomically ** (all - or - nothing).We wrap these with ** LogBegin ** and ** LogCommit ** to track transactions.`,
            keyPoints: [
                "Problem: Multiple log entries for a single \"operation\" that should be atomic",
                "Solution: Wrap with LogBegin and LogCommit to define transaction boundaries",
                "Only replay transactions that have a matching LogCommit",
                "If LogBegin without LogCommit: transaction was incomplete, DISCARD it",
                "This ensures we never apply partial operations"
            ],
            codeExample: {
                title: "Transaction handling from assign2",
                language: "cpp",
                code: `// From log.cc - Transaction management

class Tx {
            V6Log *log_;
public:
                Tx(V6Log * log) : log_(log) { }
    ~Tx() { if(log_) log_-> commit();
}  // Auto-commit on destruction
};

Tx V6Log:: begin() {
    if (in_tx_)
        return {};  // Already in a transaction

    log(LogBegin{});           // Mark start of transaction
    begin_sequence_ = sequence_;
    begin_offset = w_.tell();
    in_tx_ = true;
    return Tx(this);
}

void V6Log:: commit() {
    // Write commit entry with matching sequence number
    log(LogCommit{ begin_sequence_ });

    // Now safe to mark freed blocks as free
    for (uint16_t bn : freed_)
    freemap_.at(bn) = true;
    freed_.clear();

    in_tx_ = false;

    // Maybe checkpoint
    if (space() < hdr_.logbytes() / 2)
        checkpoint();
}

// From replay.cc - Check if transaction is complete
bool V6Replay:: check_tx() {
    // Save current position so we can restore if incomplete
    cleanup _c([this, start = r_.tell()]() { r_.seek(start); });
    lsn_t startseq = sequence_;

    try {
        LogEntry le;
        read_next(& le);
        if (!le.get < LogBegin > ())
            throw log_corrupt("no LogBegin");
        lsn_t beginseq = le.sequence_;

        // Read until we find matching LogCommit
        for (; ;) {
            read_next(& le);
            if (LogCommit * c = le.get < LogCommit > ()) {
                if (c -> sequence != beginseq)
                    throw log_corrupt("begin/commit mismatch");
                sequence_ = startseq;
                return true;  // Complete transaction!
            }
        }
    }
    catch (const log_corrupt & e) {
        // Incomplete transaction - don't replay it
        std:: cout << "Reached log end: " << e.what() << std:: endl;
        return false;
    }
} `,
                annotations: [
                    { match: "class Tx", explanation: "RAII wrapper class that automatically commits a transaction when destroyed, ensuring transactions are always closed." },
                    { match: "~Tx()", explanation: "Destructor that auto-commits the transaction. Uses RAII pattern to guarantee commit even if exceptions occur." },
                    { match: "begin()", explanation: "Starts a new transaction by logging LogBegin and saving the starting sequence number and offset." },
                    { match: "in_tx_", explanation: "Flag indicating whether we're currently inside a transaction. Returns early if already in a transaction." },
                    { match: "begin_sequence_", explanation: "Saves the LSN at transaction start so LogCommit can reference which transaction is being committed." },
                    { match: "commit()", explanation: "Closes a transaction by writing LogCommit with the matching begin sequence number." },
                    { match: "freed_", explanation: "Vector of blocks freed during this transaction. Only marked free in freemap after commit succeeds." },
                    { match: "check_tx()", explanation: "Verifies a transaction is complete by finding matching LogBegin/LogCommit pair before replaying." },
                    { match: "cleanup _c", explanation: "RAII helper that restores file position if we return early or throw an exception." },
                    { match: "log_corrupt", explanation: "Exception thrown when log format is invalid. Used to detect incomplete transactions at end of log." }
                ]
            }
        },
        {
            id: "journaling-idempotent",
            title: "Journaling: Idempotent Log Entries",
            content: `What if we crash while replaying the log, then replay again on the next boot ? We might replay the same entry twice! To handle this, log entries must be ** idempotent ** - doing them multiple times has the same effect as doing once.`,
            keyPoints: [
                "Problem: Could replay a log operation that already happened",
                "Example: crash during replay, or crash after operation but before log truncation",
                "Solution: Make all log entries IDEMPOTENT",
                "Bad: \"append block X to file\" (appending twice = 2 blocks!)",
                "Good: \"set block number at position Y to X\" (setting twice = same result)"
            ],
            diagram: `
Idempotent vs Non - Idempotent:

NON - IDEMPOTENT(BAD):
log: "append block 24 to inode 5"
  
  First replay:  inode 5 has blocks[10, 24]
  Crash during replay, reboot, replay again...
  Second replay: inode 5 has blocks[10, 24, 24]  ← WRONG!

IDEMPOTENT(GOOD):
log: "set inode 5's i_addr[1] = 24"
  
  First replay:  inode 5.i_addr[1] = 24
  Crash during replay, reboot, replay again...
  Second replay: inode 5.i_addr[1] = 24  ← SAME! Correct!
  

The LogPatch format is idempotent:
  ┌───────────────────────────────────────────────────────────┐
  │ LogPatch:                                                 │
  │   blockno: 8                                              │
  │   offset_in_block: 136                                    │
  │   bytes: 0x0403                                           │
  │                                                           │
  │ Effect: "write bytes 0x0403 at block 8 offset 136"        │
  │ Running this 1 time or 100 times → same result!           │
  └───────────────────────────────────────────────────────────┘
`,
            codeExample: {
                title: "Idempotent replay from assign2",
                language: "cpp",
                code: `// From replay.cc - Replaying log entries idempotently

void V6Replay::apply(const LogPatch &e) {
    // LogPatch is idempotent: "write these bytes at this location"
    // Running multiple times = same result!

    // Read the block using the Buffer API
    Ref<Buffer> bp = fs_.bread(e.blockno);

    // Apply the patch: write bytes at specified offset
    memcpy(bp->mem_ + e.offset_in_block, e.bytes.data(), e.bytes.size());

    // Mark dirty for delayed write
    bp->bdwrite();
}

void V6Replay::apply(const LogBlockFree &e) {
    // Mark block as free in bitmap
    // Idempotent: marking free twice = still free
    freemap_.at(e.blockno) = true;
}

void V6Replay::apply(const LogBlockAlloc &e) {
    // Mark block as used in bitmap
    freemap_.at(e.blockno) = false;

    // Zero the block if it's metadata
    if (e.zero_on_replay) {
        // Use bget since we're overwriting entire block (no need to read)
        Ref<Buffer> bp = fs_.bget(e.blockno);
        memset(bp->mem_, 0, SECTOR_SIZE);
        bp->bdwrite();
    }
    // Idempotent: marking used twice = still used
    //             zeroing twice = still zeroed
}

// Main replay loop
void V6Replay:: replay() {
    LogEntry le;

    // Only replay COMPLETE transactions
    while (check_tx()) {
        do {
            read_next(& le);
            // Dispatch to appropriate apply() method
            le.visit([this](const auto & e) { apply(e); });
        } while (!le.get < LogCommit > ());
    }

    std:: cout << "played log entries " << hdr_.l_sequence
        << " to " << sequence_ << std:: endl;

    // Update log header to reflect new checkpoint
    hdr_.l_sequence = sequence_;
    hdr_.l_checkpoint = r_.tell();

    // Write updated freemap
    pwrite(fs_.fd_, freemap_.data(), freemap_.datasize(),
        hdr_.mapstart() * SECTOR_SIZE);

    // Sync and save
    fs_.sync();
    fs_.writeblock(& hdr_, fs_.superblock().s_fsize);
} `,
                annotations: [
                    { match: "apply(const LogPatch", explanation: "Applies a patch to a block. Idempotent because writing same bytes to same location always gives same result." },
                    { match: "memcpy(block + e.offset_in_block", explanation: "Copies patch bytes to the exact offset within the block. Repeatable without side effects." },
                    { match: "apply(const LogBlockFree", explanation: "Marks a block as free. Idempotent: marking already-free block as free has no effect." },
                    { match: "apply(const LogBlockAlloc", explanation: "Marks a block as allocated and optionally zeros it. Both operations are idempotent." },
                    { match: "zero_on_replay", explanation: "Flag indicating whether to zero the block during replay. Used for metadata blocks that must be clean." },
                    { match: "replay()", explanation: "Main replay loop that processes all complete transactions from the log." },
                    { match: "check_tx()", explanation: "Returns true only if a complete transaction (LogBegin + LogCommit pair) is available." },
                    { match: "le.visit", explanation: "Visitor pattern that dispatches to the correct apply() overload based on log entry type." },
                    { match: "hdr_.l_checkpoint", explanation: "Updates log header to point to new checkpoint position after successful replay." },
                    { match: "fs_.sync()", explanation: "Syncs all filesystem data before updating the log header to ensure replay can't be undone." }
                ]
            }
        },
        {
            id: "journaling-delayed",
            title: "Journaling: Delayed Log Writes",
            content: `Writing the log synchronously before every operation would be slow.We can delay log writes too, building up the log in memory and writing it when a cached block needs to be flushed.`,
            keyPoints: [
                "Problem: Log entries must be written synchronously before the operations",
                "Solution: Delay writes for log too - build log in memory, write on block flush",
                "When a dirty block needs writeback, write all its log entries first",
                "Risk: May lose some log entries if we crash before flushing",
                "Tradeoff: Logging doesn't guarantee durability, but DOES guarantee consistency"
            ],
            diagram: `
Delayed Log Writes:

                    Log Buffer(RAM)               Log(Disk)
                    ────────────────               ──────────
Operation 1: [LogBegin, LogPatch](empty)
Operation 2: [LogBegin, LogPatch, LogPatch](empty)
Operation 3: [LogBegin, LogPatch, LogCommit](empty)
                          ▼
                   Block cache full!
                   Need to evict dirty block
                          ▼
First, flush log to disk
                          ▼
                    Log Buffer(RAM)               Log(Disk)
                    ────────────────               ──────────
(empty)[LogBegin, LogPatch,
    LogPatch, LogCommit]
                          ▼
                   Now safe to write block to disk


Key Insight:
  ┌─────────────────────────────────────────────────────────────┐
  │ Logging separates DURABILITY from CONSISTENCY:              │
  │                                                             │
  │ Durability: "Data will be preserved across crashes"         │
  │   → NOT guaranteed(recent operations may be lost)          │
  │                                                             │
  │ Consistency: "Filesystem state is always valid"             │
  │   → IS guaranteed(no half - complete operations)             │
  └─────────────────────────────────────────────────────────────┘
`,
            codeExample: {
                title: "Log flushing from assign2",
                language: "cpp",
                code: `// From log.cc - Flushing the log

void V6Log:: flush() {
    // Write buffered log entries to disk
    w_.flush();

    if (!suppress_commit_) {
        // Update committed sequence number
        // If in transaction, only commit up to begin
        // If not in transaction, commit everything
        committed_ = in_tx_ ? begin_sequence_ : sequence_;
    }
}

// From cache.cc - Evicting a dirty block

CacheEntryBase * CacheBase:: alloc() {
    // Walk from front (oldest) to find evictable entry
    for (CacheEntryBase * e = lrulist_.front(); e; e = lrulist_.next(e)) {
        if (!e -> idxlink_.is_linked()) {
            return e;  // Unused slot
        }
        else if (e -> can_evict()) {
            if (e -> dirty_) {
                // MUST write back dirty data to disk
                // But first, ensure log entries are flushed!
                e -> writeback();
                e -> dirty_ = e -> logged_ = false;
            }
            e -> idxlink_.unlink();
            e -> initialized_ = false;
            return e;
        }
    }

    // No evictable entries - try flushing logs
    flush_all_logs();

    // Try again...
    for (CacheEntryBase * e = lrulist_.front(); e; e = lrulist_.next(e)) {
        if (e -> can_evict()) {
            if (e -> dirty_)
                e -> writeback();
            e -> idxlink_.unlink();
            e -> initialized_ = false;
            return e;
        }
    }

    return nullptr;  // Cache completely full!
} `,
                annotations: [
                    { match: "flush()", explanation: "Writes buffered log entries from memory to disk. Called before dirty blocks can be evicted." },
                    { match: "w_.flush()", explanation: "Flushes the write buffer containing pending log entries to the log file on disk." },
                    { match: "committed_", explanation: "Tracks which log sequence number has been safely committed to disk. Used for determining what can be recovered." },
                    { match: "suppress_commit_", explanation: "Flag to disable commit sequence updates, used during special operations like replay." },
                    { match: "alloc()", explanation: "Finds a cache slot to allocate by walking LRU list to find an evictable (non-dirty or flushable) entry." },
                    { match: "lrulist_.front()", explanation: "Returns the oldest (least recently used) cache entry, which is the best candidate for eviction." },
                    { match: "can_evict()", explanation: "Returns true if this cache entry can be evicted. May be false if pinned or in active use." },
                    { match: "dirty_", explanation: "Flag indicating the cached block has been modified and must be written to disk before eviction." },
                    { match: "writeback()", explanation: "Writes the dirty block data back to its permanent location on disk. Log must be flushed first!" },
                    { match: "flush_all_logs()", explanation: "Last resort when no entries are evictable - flush all pending logs to potentially free blocked entries." }
                ]
            }
        },
        {
            id: "crash-recovery-comparison",
            title: "Crash Recovery: Comparing Approaches",
            content: `We've covered three main approaches to crash recovery. Each has different tradeoffs between performance, durability, and complexity.`,
            keyPoints: [
                "fsck: Add-on program that repairs on boot - no changes to normal operation",
                "Ordered Writes: Modify write operations to happen in safe orders",
                "Write-Ahead Logging: Log operations before doing them for quick recovery"
            ],
            diagram: `
Comparison of Crash Recovery Approaches:

┌────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ Aspect         │ fsck             │ Ordered Writes   │ Journaling       │
├────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Boot time      │ SLOW (full scan) │ FAST             │ FAST             │
│                │ Hours for big    │ No special work  │ Just replay log  │
│                │ disks!           │ needed           │                  │
├────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Performance    │ No impact on     │ May force sync   │ Extra writes     │
│ (normal ops)   │ normal operation │ writes (slower)  │ for log entries  │
├────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Can leak       │ No (repairs all) │ YES (accepted)   │ No               │
│ resources?     │                  │                  │                  │
├────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Data loss      │ Possible         │ Possible (leaks) │ Possible but     │
│                │                  │                  │ well-defined     │
├────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Complexity     │ Separate program │ Careful ordering │ Log + replay     │
│                │                  │ + dep tracking   │ infrastructure   │
├────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Used by        │ Legacy, backup   │ BSD soft updates │ ext4, NTFS, HFS+ │
└────────────────┴──────────────────┴──────────────────┴──────────────────┘

Ultimate Tradeoff:
  ┌─────────────────────────────────────────────────────────────────────┐
  │ Durability ←───────────────────────────────→ Performance            │
  │     ▲                                              ▲                │
  │     │                                              │                │
  │ Sync writes,                                 Delayed writes,        │
  │ full data                                    metadata-only          │
  │ journaling                                   journaling             │
  └─────────────────────────────────────────────────────────────────────┘
            `,
            codeExample: {
                title: "Choosing a recovery strategy",
                language: "cpp",
                code: `// Different recovery strategies for different use cases

enum RecoveryStrategy {
    FSCK_ONLY,           // Legacy, simple implementation
    ORDERED_WRITES,      // BSD soft updates style  
    JOURNAL_METADATA,    // ext4 default - fast, good consistency
    JOURNAL_FULL         // Full data journaling - slow, highest safety
};

void configure_filesystem(RecoveryStrategy strategy) {
    switch (strategy) {
        case FSCK_ONLY:
            // Simplest implementation
            // Don't worry about order of writes
            // Just run fsck on boot
            // Good for: development, non-critical data
            break;
            
        case ORDERED_WRITES:
            // Track dependencies between blocks
            // Force safe ordering on writeback
            // Accept resource leaks (reclaim later)
            // Good for: BSD systems, when you want simplicity
            break;
            
        case JOURNAL_METADATA:
            // Log inode and directory changes
            // Don't log file data (too expensive)
            // Fast recovery, consistent metadata
            // Risk: file data may be lost/stale after crash
            // Good for: most general use cases (ext4 default)
            break;
            
        case JOURNAL_FULL:
            // Log ALL writes, including file data
            // Everything written twice (log + actual location)
            // Slowest, but strongest guarantees
            // Good for: databases, critical applications
            break;
    }
}

// ext4 mount options:
// mount -o data=journal   → JOURNAL_FULL
// mount -o data=ordered   → JOURNAL_METADATA with ordered data (default)
// mount -o data=writeback → JOURNAL_METADATA, data can be inconsistent`,
                annotations: [
                    { match: "RecoveryStrategy", explanation: "Enum defining the four main approaches to crash recovery, each with different tradeoffs." },
                    { match: "FSCK_ONLY", explanation: "Simplest strategy - no special write ordering, just run filesystem checker on reboot. Slow recovery." },
                    { match: "ORDERED_WRITES", explanation: "BSD soft updates style - track dependencies between blocks and force safe write order. May leak resources." },
                    { match: "JOURNAL_METADATA", explanation: "ext4 default - logs inode/directory changes but not file data. Fast and consistent but data may be stale." },
                    { match: "JOURNAL_FULL", explanation: "Logs everything including file data. Strongest guarantees but slowest (writes everything twice)." },
                    { match: "configure_filesystem", explanation: "Function that would configure the filesystem's recovery behavior based on chosen strategy." },
                    { match: "data=journal", explanation: "ext4 mount option for full data journaling. Everything written to log first, then to final location." },
                    { match: "data=ordered", explanation: "ext4 default: metadata journaled, data written before its metadata is committed. Good balance." },
                    { match: "data=writeback", explanation: "Only metadata journaled, data can be written in any order. Fastest but file contents may be stale after crash." }
                ]
            }
        },
        {
            id: "exam-prep",
            title: "🎯 Midterm Prep: What to Know",
            content: `This lecture completes crash recovery — a guaranteed midterm topic. Be able to compare all three approaches, apply ordered write rules, and trace journaling scenarios. Connect everything to assign2!`,
            keyPoints: [
                "📝 Ordered Writes Rule 1: Initialize target BEFORE creating a reference to it",
                "📝 Ordered Writes Rule 2: Remove references BEFORE reusing a resource",
                "📝 Ordered writes trade leaked resources (acceptable) for no cross-allocation (unacceptable)",
                "📝 Write-ahead logging (journaling): log WHAT you plan to do, THEN do it",
                "📝 Transactions: LogBegin → LogPatch/Alloc/Free → LogCommit = atomic unit",
                "📝 Only COMPLETE transactions (with LogCommit) are replayed on recovery",
                "📝 Log entries must be IDEMPOTENT: replaying 1× or 100× gives same result",
                "📝 LogPatch is idempotent ('set X to Y'), appending is NOT ('add Y to X')",
                "📝 Journaling separates durability (not guaranteed) from consistency (guaranteed)"
            ],
            diagram: `
Midterm Cheat Sheet — Crash Recovery (Part 2):

┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ Aspect           │ fsck             │ Ordered Writes   │ Journaling       │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Recovery speed   │ SLOW (scan all)  │ FAST             │ FAST (replay)    │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Normal perf      │ No impact        │ May force syncs  │ Extra log writes │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Can leak blocks? │ No (repairs)     │ YES (by design)  │ No               │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Consistency      │ Restored after   │ Always maintained│ Always maintained│
│                  │ scan completes   │ (no cross-alloc) │ (transactions)   │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Used by          │ Legacy / backup  │ BSD soft updates │ ext4, NTFS, HFS+ │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘

Ordered Writes — Quick Reference:
  Creating file:  init inode → mark blocks used → add dirent (LAST!)
  Deleting file:  remove dirent → clear inode → mark blocks free (LAST!)
  Key insight:    making something VISIBLE (dirent) is always the LAST step

Journaling — Crash Scenario Analysis:
  Crash before LogCommit?  → Discard. As if op never happened.
  Crash after LogCommit but before blocks written?  → Replay log!
  Crash after blocks written but before checkpoint?  → Replay (idempotent, harmless)
`
        },
        {
            id: "summary",
            title: "Crash Recovery Summary",
            content: `Crash recovery is about managing the tradeoff between durability, consistency, and performance. Modern systems primarily use journaling for fast recovery with strong consistency guarantees.`,
            keyPoints: [
                "Ordered Writes: prevent worst inconsistencies by careful write ordering",
                "Write-Ahead Logging: log operations before doing them",
                "Checkpoints: truncate log periodically to limit replay work",
                "Transactions: wrap related operations with LogBegin/LogCommit",
                "Idempotent entries: safe to replay multiple times",
                "Coming next: using the filesystem in our own programs (system calls)"
            ],
            advantages: [
                "Journaling: Fast boot time (just replay log, not full scan)",
                "Journaling: Strong consistency guarantees",
                "Journaling: Well-defined data loss semantics",
                "Ordered writes: No extra disk space for log"
            ],
            disadvantages: [
                "Journaling: Extra disk I/O for log writes",
                "Journaling: Log space management complexity",
                "Ordered writes: Can leak resources",
                "Ordered writes: Dependency tracking is tricky"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Log Entry Ordering",
            difficulty: "easy",
            description: "Given a sequence of operations, determine what log entries would be written and in what order.",
            hint: "Remember that LogBegin starts a transaction, operations are logged as LogPatch/LogBlockAlloc/LogBlockFree, and LogCommit ends the transaction.",
            starterCode: `/*
Operation: Create a new file "test.txt" in the root directory

Steps needed:
1. Allocate an inode for the new file
2. Initialize inode (set mode, size, etc.)
3. Add directory entry in root directory

What log entries are written, in order?
Fill in the blanks below:
*/

struct LogSequence {
    std::vector<std::string> entries;
};

LogSequence create_file_log() {
    return {
        "____",           // Start transaction
        "____",           // Allocate inode? Or LogPatch?
        "____",           // Initialize inode
        "____",           // Add directory entry  
        "____"            // End transaction
    };
}`,
            solution: `/*
Operation: Create a new file "test.txt" in the root directory

Log entries in order:
*/

struct LogSequence {
    std::vector<std::string> entries;
};

LogSequence create_file_log() {
    return {
        "LogBegin",                    // Start transaction
        "LogBlockAlloc (inode block)", // May need new block for inode
        "LogPatch (initialize inode)", // Set i_mode, i_nlink, etc.
        "LogPatch (directory entry)",  // Add dirent {ino, "test.txt"}
        "LogCommit"                    // End transaction - now atomic!
    };
}

/*
Note: The actual log might include more entries depending on:
- Whether we need to allocate data blocks for the directory
- Whether the inode block needs additional patches
- Updates to timestamps, etc.

Key insight: All entries between LogBegin and LogCommit are replayed
together (or not at all) on crash recovery.
*/`,
            explanation: "Transactions wrap related operations to ensure atomicity. The log captures all changes to metadata, and replay only happens for complete transactions."
        },
        {
            id: "ex2",
            title: "Implementing LogPatch Replay",
            difficulty: "medium",
            description: "Implement the apply() method for LogPatch entries. This is the core of log replay in assign2!",
            hint: "LogPatch contains a block number, offset within that block, and bytes to write. You need to read the block, apply the patch, and write it back.",
            starterCode: `// From replay.cc - You need to implement this method!

void V6Replay::apply(const LogPatch &e) {
    // e.blockno: block number to modify
    // e.offset_in_block: offset within the block
    // e.bytes: the bytes to write at that offset
    
    // Step 1: Read the block from disk
    char block[SECTOR_SIZE];
    ____
    
    // Step 2: Apply the patch (copy bytes to correct offset)
    ____
    
    // Step 3: Write the block back to disk
    ____
}`,
            solution: `// From replay.cc - LogPatch replay implementation

void V6Replay::apply(const LogPatch &e) {
    // e.blockno: block number to modify
    // e.offset_in_block: offset within the block
    // e.bytes: the bytes to write at that offset
    
    // Step 1: Read the block from disk using Buffer API
    Ref<Buffer> bp = fs_.bread(e.blockno);
    
    // Step 2: Apply the patch (copy bytes to correct offset)
    memcpy(bp->mem_ + e.offset_in_block, e.bytes.data(), e.bytes.size());
    
    // Step 3: Mark dirty for delayed write
    bp->bdwrite();
}

/*
Why is this idempotent?
- We're setting bytes at a specific location to specific values
- Doing this 1 time or 100 times → same final state
- "Set position X to Y" is idempotent
- "Append Y to X" is NOT idempotent

This is the core insight of journaling: log ABSOLUTE changes,
not RELATIVE changes!
*/`,
            explanation: "LogPatch replay is simple but powerful. The key is that it's idempotent - applying the same patch multiple times produces the same result, so we can safely re-replay the log if we crash during replay."
        },
        {
            id: "ex3",
            title: "Implementing LogBlockAlloc Replay",
            difficulty: "medium",
            description: "Implement the apply() method for LogBlockAlloc entries. Remember to handle the zero_on_replay flag!",
            hint: "LogBlockAlloc marks a block as used in the freemap. If zero_on_replay is set, you should also zero out the block contents.",
            starterCode: `// From replay.cc - Implement LogBlockAlloc replay

void V6Replay::apply(const LogBlockAlloc &e) {
    // e.blockno: block number that was allocated
    // e.zero_on_replay: whether to zero the block (1 for metadata)
    
    // Step 1: Mark block as used in freemap
    ____
    
    // Step 2: If zero_on_replay, zero out the block
    if (____) {
        ____
    }
}`,
            solution: `// From replay.cc - LogBlockAlloc replay implementation

void V6Replay::apply(const LogBlockAlloc &e) {
    // e.blockno: block number that was allocated
    // e.zero_on_replay: whether to zero the block (1 for metadata)
    
    // Step 1: Mark block as used in freemap
    freemap_.at(e.blockno) = false;  // false = used
    
    // Step 2: If zero_on_replay, zero out the block
    if (e.zero_on_replay) {
        // Use bget() since we're overwriting entire block (no need to read)
        Ref<Buffer> bp = fs_.bget(e.blockno);
        memset(bp->mem_, 0, SECTOR_SIZE);
        bp->bdwrite();
    }
}

/*
Why do we have zero_on_replay?

Metadata blocks (directories, indirect blocks):
- All changes are logged via LogPatch
- Fresh allocation should start with zeros
- So zero_on_replay = 1

Data blocks (file contents):
- Data writes are NOT logged (too expensive)
- Block might have valid data written after allocation
- If we crash and replay, don't want to lose that data!
- So zero_on_replay = 0

This is the key tradeoff of metadata-only journaling.
*/`,
            explanation: "The zero_on_replay flag distinguishes between metadata (always zero on replay because all changes are logged) and data blocks (don't zero because data writes aren't logged and we want to preserve any data that made it to disk)."
        },
        {
            id: "ex4",
            title: "Implementing LogBlockFree Replay",
            difficulty: "easy",
            description: "Implement the apply() method for LogBlockFree entries. This is the simplest of the three!",
            hint: "LogBlockFree just marks a block as free in the freemap.",
            starterCode: `// From replay.cc - Implement LogBlockFree replay

void V6Replay::apply(const LogBlockFree &e) {
    // e.blockno: block number that was freed
    
    // Mark block as free in freemap
    ____
}`,
            solution: `// From replay.cc - LogBlockFree replay implementation

void V6Replay::apply(const LogBlockFree &e) {
    // e.blockno: block number that was freed
    
    // Mark block as free in freemap
    freemap_.at(e.blockno) = true;  // true = free
}

/*
This is idempotent: marking a block as free twice
still results in it being free.

Note: In the actual implementation, blocks aren't
actually freed until the transaction commits.
This ensures that if we crash mid-transaction,
the blocks are still marked as used (safe).
*/`,
            explanation: "LogBlockFree is the simplest to implement - just mark the block as free. The idempotent property means we can safely replay this even if it was already applied before the crash."
        },
        {
            id: "ex5",
            title: "Transaction Integrity Check",
            difficulty: "hard",
            description: "Implement a function to check whether a transaction in the log is complete (has matching LogBegin and LogCommit).",
            hint: "Read entries starting from the current position. Look for LogBegin, then keep reading until you find the matching LogCommit. If you hit end of log or error, the transaction is incomplete.",
            starterCode: `// Check if the next transaction is complete
// Returns true if complete, false if incomplete

bool check_transaction_complete(Reader &r, lsn_t &seq) {
    // Save starting position to restore if incomplete
    uint32_t start_pos = r.tell();
    
    try {
        // Step 1: Read first entry, should be LogBegin
        LogEntry first;
        first.load(r);
        
        if (!first.get<LogBegin>()) {
            throw log_corrupt("expected LogBegin");
        }
        lsn_t begin_seq = first.sequence_;
        
        // Step 2: Keep reading until we find LogCommit
        for (;;) {
            LogEntry le;
            ____  // Load next entry
            
            // Check for LogRewind (log wrapped around)
            if (____) {
                // Seek to start of log and continue
                ____
                continue;
            }
            
            // Check for LogCommit
            if (LogCommit *c = ____) {
                // Verify sequence matches
                if (____) {
                    throw log_corrupt("sequence mismatch");
                }
                return true;  // Complete transaction!
            }
        }
    }
    catch (const log_corrupt &e) {
        // Incomplete transaction - restore position
        r.seek(start_pos);
        return false;
    }
}`,
            solution: `// Check if the next transaction is complete
// Returns true if complete, false if incomplete

bool check_transaction_complete(Reader &r, lsn_t &seq) {
    // Save starting position to restore if incomplete
    uint32_t start_pos = r.tell();
    
    try {
        // Step 1: Read first entry, should be LogBegin
        LogEntry first;
        first.load(r);
        
        if (!first.get<LogBegin>()) {
            throw log_corrupt("expected LogBegin");
        }
        lsn_t begin_seq = first.sequence_;
        
        // Step 2: Keep reading until we find LogCommit
        for (;;) {
            LogEntry le;
            le.load(r);  // Load next entry
            
            // Check for LogRewind (log wrapped around)
            if (le.get<LogRewind>()) {
                // Seek to start of log and continue
                r.seek(log_start_offset);
                continue;
            }
            
            // Check for LogCommit
            if (LogCommit *c = le.get<LogCommit>()) {
                // Verify sequence matches
                if (c->sequence != begin_seq) {
                    throw log_corrupt("sequence mismatch");
                }
                return true;  // Complete transaction!
            }
        }
    }
    catch (const log_corrupt &e) {
        // Incomplete transaction - restore position
        r.seek(start_pos);
        return false;
    }
}

/*
This is the core of replay safety:
- We ONLY replay complete transactions
- LogBegin without matching LogCommit = crash during transaction
- In that case, we discard the partial transaction
- The actual changes weren't written to disk yet (journaling!)
- So discarding is safe and maintains consistency
*/`,
            explanation: "This function is crucial for journaling safety. We only replay complete transactions to ensure atomicity. If we crash mid-transaction, the log will have LogBegin but no LogCommit, so we discard it and the filesystem remains consistent."
        },
        {
            id: "ex6",
            title: "Crash Scenario Analysis",
            difficulty: "hard",
            description: "Analyze what happens in various crash scenarios with journaling.",
            hint: "Think about what's in the log vs. what's on disk at each crash point. Remember: log is written first, then actual blocks.",
            starterCode: `/*
Scenario: Creating file "test.txt" with journaling

Timeline:
1. LogBegin written to log
2. LogBlockAlloc (inode) written to log  
3. LogPatch (inode init) written to log
4. LogPatch (dirent) written to log
5. LogCommit written to log
6. Log flushed to disk
7. Actual inode block written to disk
8. Actual directory block written to disk
9. Checkpoint

For each crash point below, describe:
A) What's in the log on disk?
B) What's the actual filesystem state?
C) What happens on recovery?
*/

struct CrashAnalysis {
    std::string log_state;
    std::string fs_state;
    std::string recovery_action;
};

CrashAnalysis analyze_crash(int crash_point) {
    switch (crash_point) {
        case 4:  // Crash after step 4 (before LogCommit)
            return {
                "____",  // Log state
                "____",  // Filesystem state
                "____"   // Recovery action
            };
            
        case 6:  // Crash after step 6 (log flushed, before blocks)
            return {
                "____",
                "____", 
                "____"
            };
            
        case 8:  // Crash after step 8 (before checkpoint)
            return {
                "____",
                "____",
                "____"
            };
    }
}`,
            solution: `/*
Scenario: Creating file "test.txt" with journaling
*/

struct CrashAnalysis {
    std::string log_state;
    std::string fs_state;
    std::string recovery_action;
};

CrashAnalysis analyze_crash(int crash_point) {
    switch (crash_point) {
        case 4:  // Crash after step 4 (before LogCommit)
            return {
                // Log state:
                "LogBegin, LogBlockAlloc, LogPatch, LogPatch - but NO LogCommit",
                
                // Filesystem state:
                "Unchanged - no actual blocks written yet",
                
                // Recovery action:
                "Discard incomplete transaction. File not created. "
                "Filesystem is consistent (as if operation never started)."
            };
            
        case 6:  // Crash after step 6 (log flushed, before blocks)
            return {
                // Log state:
                "Complete transaction: LogBegin through LogCommit",
                
                // Filesystem state:
                "Unchanged - actual blocks not written yet",
                
                // Recovery action:
                "Replay complete transaction! Apply LogPatch entries to "
                "create inode and directory entry. File IS created on recovery."
            };
            
        case 8:  // Crash after step 8 (before checkpoint)
            return {
                // Log state:
                "Complete transaction (same as case 6)",
                
                // Filesystem state:
                "File fully created on disk",
                
                // Recovery action:
                "Replay transaction (even though already applied). "
                "Idempotent entries mean replaying has no effect. "
                "File remains correctly created."
            };
    }
}

/*
Key insights:

1. Before LogCommit (case 4):
   - Transaction is incomplete
   - Will be discarded on recovery
   - No data loss (operation hadn't completed anyway)

2. After log flush, before block writes (case 6):
   - Transaction is complete in log
   - Will be replayed, writing the actual blocks
   - File appears after recovery as if crash didn't happen!

3. After block writes, before checkpoint (case 8):
   - Transaction already applied to disk
   - Log will be replayed (idempotent, no harm)
   - File correctly exists

This is why journaling is powerful: the log is the "source of truth"
and we can always recover a consistent state from it.
*/`,
            explanation: "This exercise demonstrates the power of journaling. No matter when the crash occurs, we either get a complete operation (replay the log) or no operation (discard incomplete transaction). The filesystem is always consistent."
        }
    ]
};

export default lecture6;
