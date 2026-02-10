export const lecture5 = {
    id: 5,
    title: "Crash Recovery",
    subtitle: "Free Space Management, Block Cache, and Recovery Strategies",
    keyTakeaway: "The free list tracks free blocks on disk (commonly using a bitmap). The block cache stores recently-accessed disk blocks in memory. Crash recovery challenges include both data loss and inconsistency. fsck and ordered writes are approaches to handling crashes.",

    sections: [
        {
            id: "overview",
            title: "Why Crash Recovery Matters",
            content: `Computers crash unexpectedly—power failures, kernel panics, hardware issues. When this happens, we want to avoid **data loss** and **filesystem corruption**. Understanding crash recovery requires knowing where filesystem data lives: the disk layout, the **free block map**, and the **block cache** in memory.`,
            keyPoints: [
                "Crashes can happen at ANY time, including mid-operation",
                "Not all data may have been written to disk yet",
                "Multi-block operations can leave disk in inconsistent state",
                "Ideally operations would be atomic (all-or-nothing), but this isn't fully possible"
            ],
            codeExample: {
                title: "The challenge: operations affect multiple blocks",
                language: "cpp",
                code: `// Creating a file requires multiple disk writes:
// 1. Initialize a new inode
// 2. Add directory entry pointing to that inode
// 3. Update free list to mark blocks as used
// 4. Write actual data to payload blocks

// What happens if we crash between steps 2 and 3?
// -> Directory entry points to inode, but blocks might 
//    also be marked as "free" in the free list!

// Example from assign2: checking for inconsistencies
bool Fsck::scan_blocks(BlockPtrArray ba, BlockPath end) {
    for (unsigned i = 0; i < ba.size(); ++i) {
        uint16_t bn = ba.at(i);
        if (bn) {
            if (fs_.badblock(bn))
                out() << "block " << bn << ": bad block number\\n";
            else if (!freemap_.at(bn))
                out() << "block " << bn << ": cross-allocated\\n";  // Two files claim same block!
            else
                freemap_.at(bn) = false;  // Mark as used
        }
    }
}`,
                annotations: [
                    { match: "inode", explanation: "An inode (index node) is a data structure that stores metadata about a file: its size, permissions, timestamps, and pointers to data blocks. Each file has exactly one inode." },
                    { match: "directory entry", explanation: "A directory entry (dirent) is a mapping from a filename to an inode number. Directories are just files containing lists of these entries." },
                    { match: "free list", explanation: "A data structure (often a bitmap) that tracks which disk blocks are available for allocation. 1 = free, 0 = in use." },
                    { match: "Fsck", explanation: "File System Check - a utility program that scans the filesystem for inconsistencies and repairs them. Runs automatically after crashes." },
                    { match: "scan_blocks", explanation: "A function that iterates through all block pointers in a file, checking each one for problems like bad block numbers or cross-allocation." },
                    { match: "BlockPtrArray", explanation: "An array of block pointers - the list of disk block numbers that belong to a file. Stored in the inode's i_addr field." },
                    { match: "uint16_t", explanation: "An unsigned 16-bit integer (0 to 65535). Used here because V6 Unix block numbers are 16 bits, limiting disk size to 32MB." },
                    { match: "badblock", explanation: "Checks if a block number is outside the valid range for this filesystem. Returns true if the block number is invalid." },
                    { match: "freemap_", explanation: "A bitmap maintained by fsck that tracks which blocks are actually in use by files. Used to compare against the on-disk free list." },
                    { match: "cross-allocated", explanation: "A corruption where two different files claim to own the same disk block. This can cause data from one file to appear in another!" }
                ]
            }
        },
        {
            id: "free-space",
            title: "Free Space Management",
            content: `The filesystem must track which disk blocks are free (available for new files) vs. in use. Early Unix used a **linked list** of free blocks, but modern systems use a **bitmap** where each bit represents one block: 1 = free, 0 = in use.`,
            keyPoints: [
                "Linked list: initially sorted for contiguous allocation, but becomes scrambled over time",
                "Bitmap: array of bits, one per block (1 = free, 0 = used)",
                "Bitmap size example: 1TB disk with 4KB blocks → 2²⁸ blocks → 32MB bitmap",
                "During allocation, search bitmap for a block close to previous block (locality)",
                "Linux reserves ~10% of disk space to ensure good allocation performance"
            ],
            diagram: `
Bitmap Example (1 = free, 0 = used):
          Block:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
          Bit:    0  0  0  0  0  1  1  1  0  0  0  0  1  1  0  0
                  ▲─────────────▲
                  │             └── Blocks 5-7 are FREE
                  └── Blocks 0-4 are IN USE (data/metadata)
                  
Finding a free block:
  → Scan bitmap for '1' bit
  → Prefer blocks near current file's other blocks (locality)
  → Mark bit as '0' when allocating
      `,
            codeExample: {
                title: "Bitmap implementation from assign2",
                language: "cpp",
                code: `// From bitmap.hh - A bitmap tracks free blocks
struct Bitmap {
    using chunk_type = std::uint32_t;
    
    // Valid index range is [min_index, max_index)
    explicit Bitmap(std::size_t max_index = 0, std::size_t min_index = 0)
        : nbits_(max_index - min_index),
          nchunks_(chunkno(nbits_ + bits_per_chunk - 1)),
          mem_(new chunk_type[nchunks_]), 
          zero_(min_index) {
        std::memset(mem_.get(), 0, datasize());  // Initialize all to 0 (used)
    }
    
    // Access one bit: freemap.at(blocknum) returns true if free
    bool at(std::size_t n) const {
        check(n -= zero_);
        return mem_[chunkno(n)] & chunkbit(n);
    }
    
    // Set a bit: freemap.at(blocknum) = false marks as used
    bitref at(std::size_t n) {
        check(n -= zero_);
        return { mem_[chunkno(n)], chunkbit(n) };
    }
    
    // Find the next free block (1 bit) starting at 'start'
    int find1(std::size_t start = 0) const;
    
    // Count free blocks
    int num1() const;
    
private:
    static constexpr std::size_t bits_per_chunk = 8 * sizeof(chunk_type);
    static constexpr std::size_t chunkno(std::size_t bitno) {
        return bitno / bits_per_chunk;
    }
    static constexpr chunk_type chunkbit(std::size_t bitno) {
        return chunk_type(1) << bitno % bits_per_chunk;
    }
};`,
                annotations: [
                    { match: "chunk_type", explanation: "The bitmap is stored as an array of 32-bit integers (chunks). Each chunk holds 32 block status bits, making operations more efficient than checking individual bits." },
                    { match: "std::uint32_t", explanation: "An unsigned 32-bit integer. Each bit in this integer represents whether one disk block is free (1) or used (0)." },
                    { match: "std::size_t", explanation: "An unsigned integer type guaranteed to be large enough to hold any array index. Platform-dependent: 32 bits on 32-bit systems, 64 bits on 64-bit systems." },
                    { match: "explicit", explanation: "Prevents implicit type conversions when constructing a Bitmap. You must write Bitmap(100) explicitly, not just pass 100 where a Bitmap is expected." },
                    { match: "memset", explanation: "A C library function that fills a block of memory with a specific byte value. Here it sets all bytes to 0, marking all blocks as 'used' initially." },
                    { match: "bitref", explanation: "A reference type that allows assignment to a single bit. When you write freemap.at(5) = true, bitref handles setting that specific bit in the chunk." },
                    { match: "constexpr", explanation: "Tells the compiler this value/function can be computed at compile time. This enables optimizations since the compiler knows the value won't change." },
                    { match: "chunkno", explanation: "Calculates which 32-bit chunk contains a given bit. For bit 45: 45 / 32 = 1, so it's in chunk[1]." },
                    { match: "chunkbit", explanation: "Creates a bitmask with only the relevant bit set. For bit 45: 45 % 32 = 13, so returns (1 << 13) = 0x2000." },
                    { match: "find1", explanation: "Searches the bitmap for the next free block (a '1' bit) starting from a given position. Used during block allocation." }
                ]
            }
        },
        {
            id: "block-cache",
            title: "Block Cache",
            content: `Disk access is slow, so operating systems use a **block cache** to keep recently-accessed disk blocks in memory. All reads/writes go through the cache. The key question: when we modify a cached block, do we write it to disk immediately (**synchronous writes**) or later (**delayed writes**)?`,
            keyPoints: [
                "Cache stores frequently-used blocks (especially indirect blocks for large files)",
                "LRU (Least Recently Used) replacement: evict oldest unused entry when cache is full",
                "Synchronous writes: slow but safer (less data loss risk)",
                "Delayed writes: fast but riskier (may lose data if crash before flush)",
                "Typical delay: Unix used ~30 seconds before flushing dirty blocks",
                "Programs can force a write to disk using fsync() system call"
            ],
            diagram: `
Block Cache Operation:
                                    
  Program          Block Cache (RAM)              Disk
  ───────          ─────────────────              ────
     │                                              
     │ read block 42                               
     ├────────────────►│                           
     │                 │ cache miss!               
     │                 ├──────────────────────────►│
     │                 │◄──────────────────────────│
     │◄────────────────│ (block now in cache)      
     │                                              
     │ read block 42 (again)                       
     ├────────────────►│                           
     │◄────────────────│ cache HIT! (fast)         
     │                                              
     │ write block 42                              
     ├────────────────►│                           
     │                 │ mark DIRTY                
     │◄────────────────│ (return immediately)      
     │                 │                           
     │                 │ ... 30 seconds later ...  
     │                 ├──────────────────────────►│
     │                 │ (flush dirty blocks)      
      `,
            codeExample: {
                title: "LRU cache implementation from assign2",
                language: "cpp",
                code: `// From cache.cc - LRU block cache
// Move entry to back of LRU list when accessed ("touch")
CacheEntryBase* CacheBase::touch(CacheEntryBase *e) {
    lrulist_.remove(e);      // Remove from current position
    lrulist_.push_back(e);   // Add to end (most recently used)
    return e;
}

// Find a cache slot to reuse (evict least recently used)
CacheEntryBase* CacheBase::alloc() {
    // Walk from front (oldest) to find evictable entry
    for (CacheEntryBase *e = lrulist_.front(); e; e = lrulist_.next(e)) {
        if (!e->idxlink_.is_linked()) {
            return e;  // Unused slot
        }
        else if (e->can_evict()) {
            if (e->dirty_) {
                e->writeback();  // Must write dirty data to disk first!
                e->dirty_ = e->logged_ = false;
            }
            e->idxlink_.unlink();
            e->initialized_ = false;
            return e;
        }
    }
    return nullptr;  // No evictable entries!
}

// Lookup: get block from cache, loading from disk if needed
CacheEntryBase* CacheBase::lookup(V6FS *dev, uint16_t id) {
    CacheEntryBase *e = index_[{dev, id}];
    if (e) 
        return touch(e);  // Already cached - just touch and return
    
    e = alloc();          // Need new slot
    if (!e) {
        flush_all_logs(); // Try flushing logs to free space
        e = alloc();
    }
    if (!e)
        throw resource_exhausted("cache full", -ENOMEM);
    
    e->dev_ = dev;
    e->id_ = id;
    index_.insert(e);
    return touch(e);
}`,
                annotations: [
                    { match: "LRU", explanation: "Least Recently Used - a cache eviction policy that removes the entry that hasn't been accessed for the longest time. Based on the assumption that recently used data is likely to be used again soon." },
                    { match: "lrulist_", explanation: "A doubly-linked list of cache entries ordered by access time. Front = oldest (least recently used), Back = newest (most recently used)." },
                    { match: "touch", explanation: "Moves an entry to the back of the LRU list, marking it as 'most recently used'. Called whenever a cache entry is accessed." },
                    { match: "CacheEntryBase", explanation: "A single entry in the cache, representing one cached disk block. Contains the block data, dirty flag, and pointers for the LRU list." },
                    { match: "alloc", explanation: "Allocates a cache slot by finding an entry that can be evicted. Walks from the front (oldest) to find the first evictable entry." },
                    { match: "can_evict", explanation: "Returns true if this cache entry can be safely removed. An entry cannot be evicted if it's currently locked or in use by another operation." },
                    { match: "dirty_", explanation: "A flag indicating this cache entry has been modified but not yet written to disk. Dirty entries must be written back before eviction." },
                    { match: "writeback", explanation: "Writes the cached block's data to the physical disk. Called before evicting a dirty entry or during periodic flushes." },
                    { match: "index_", explanation: "A hash table for O(1) lookup of cache entries by (device, block number) pair. Avoids scanning the entire cache on every access." },
                    { match: "nullptr", explanation: "C++11 keyword for a null pointer. Safer than using 0 or NULL because it has a distinct type and prevents accidental integer conversions." },
                    { match: "ENOMEM", explanation: "Error code meaning 'out of memory'. Standard Unix error code indicating resource exhaustion." }
                ]
            }
        },
        {
            id: "buffer-api",
            title: "The Buffer API: Using the Block Cache",
            content: `In assign2, we interact with the block cache through the **Buffer** class. A Buffer wraps a cached disk block, providing access to its data and methods to control when it's written to disk. The key functions are **bread()** to read a block, **bget()** to get a buffer without reading, and **bdwrite()** to mark it for delayed write.`,
            keyPoints: [
                "Ref<Buffer> bp = fs_.bread(blockno) — read block from disk (or cache)",
                "Ref<Buffer> bp = fs_.bget(blockno) — get buffer without reading (for overwrites)",
                "bp->mem_ — raw bytes of the block (char[512])",
                "bp->at<T>(i) — typed access to block contents",
                "bp->bdwrite() — mark dirty for delayed write",
                "bp->bwrite() — force immediate write to disk"
            ],
            codeExample: {
                title: "Buffer API usage in assign2",
                language: "cpp",
                code: `// From v6fs.hh - Buffer wraps a cached disk block
struct Buffer : CacheEntryBase {
    alignas(uint32_t) char mem_[SECTOR_SIZE]; // Actual 512 bytes

    uint16_t blockno() const { return id_; }
    void bwrite();              // Write the buffer immediately
    void bdwrite() {            // Write buffer later (delayed write)
        initialized_ = dirty_ = true;
    }
    template<typename T> T &at(size_t i) {
        return reinterpret_cast<T *>(mem_)[i];
    }
};

// In V6FS class:
Ref<Buffer> bread(uint16_t blockno); // Read block from disk
Ref<Buffer> bget(uint16_t blockno);  // Get buffer without reading

// Example: Reading and modifying a block
void example_modify_block(V6FS &fs, uint16_t blockno) {
    // Read block into cache (or get from cache if already there)
    Ref<Buffer> bp = fs.bread(blockno);
    
    // Access the raw bytes
    char *data = bp->mem_;
    
    // Or use typed access (e.g., for indirect blocks)
    uint16_t first_ptr = bp->at<uint16_t>(0);
    
    // Modify the block
    bp->mem_[10] = 'X';
    
    // Mark dirty - will be written later during cache flush
    bp->bdwrite();
    
    // When Ref<Buffer> goes out of scope, the buffer stays in cache
}

// Example: Allocating a new block (no need to read old contents)
void example_alloc_block(V6FS &fs, uint16_t blockno) {
    // Use bget() when we'll overwrite the entire block anyway
    Ref<Buffer> bp = fs.bget(blockno);  // Faster - no disk read!
    
    memset(bp->mem_, 0, SECTOR_SIZE);   // Zero out the block
    bp->bdwrite();                       // Mark for writeback
}`,
                annotations: [
                    { match: "Ref<Buffer>", explanation: "A reference-counted smart pointer to a Buffer. When all Refs go out of scope, the Buffer can be evicted from cache (but dirty buffers are written first)." },
                    { match: "mem_[SECTOR_SIZE]", explanation: "The actual 512 bytes of the disk block. You can read/write this directly or use at<T>() for typed access." },
                    { match: "bread(blockno)", explanation: "Reads block from disk into cache (or returns cached copy if already present). Use this when you need to see the current contents." },
                    { match: "bget(blockno)", explanation: "Gets a buffer for the block WITHOUT reading from disk. Use when you'll completely overwrite the block anyway - faster than bread()." },
                    { match: "bdwrite()", explanation: "Marks the buffer as dirty for DELAYED write. The actual disk write happens later during sync() or cache eviction. Fast but data at risk until flushed." },
                    { match: "bwrite()", explanation: "Forces IMMEDIATE write to disk. Slower but guarantees data is on disk when function returns. Use for critical data." },
                    { match: "at<uint16_t>(0)", explanation: "Typed access: treats mem_ as array of uint16_t and returns element 0. Useful for indirect blocks which store arrays of block numbers." },
                    { match: "alignas(uint32_t)", explanation: "Ensures mem_ is aligned to 4-byte boundary. Required for typed access with at<T>() to work correctly without alignment faults." }
                ]
            }
        },
        {
            id: "delayed-writes-problem",
            title: "The Delayed Writes Problem",
            content: `Delayed writes make the system faster, but they also mean the block cache can **reorder operations**. If we perform operations A, B, C and they're all cached, when the cache flushes (after ~30 seconds), it might write them in order B, C, A. If we crash during the flush, we get an inconsistent state.`,
            keyPoints: [
                "Delayed writes return immediately (program doesn't wait for disk)",
                "Cache might flush blocks in different order than operations occurred",
                "Crash during flush leaves partial operations on disk",
                "Trade-off: 2-10x faster but risk losing ~30 seconds of work",
                "Question: \"Are you willing to lose your last 30 seconds of work for a performance boost?\""
            ],
            codeExample: {
                title: "Synchronous vs delayed writes",
                language: "cpp",
                code: `// SYNCHRONOUS WRITE: program waits for disk I/O
void sync_write(Block *b) {
    write_to_disk(b);        // Actually writes to physical disk
    wait_for_completion();   // Block until disk confirms write
    // Safe, but SLOW - disk I/O takes milliseconds
}

// DELAYED WRITE: just mark dirty, return immediately  
void delayed_write(Block *b) {
    b->dirty = true;         // Mark as needing writeback
    cache.touch(b);          // Keep in cache
    // Fast! Returns in microseconds
    // But data only in RAM, not yet on disk
}

// Periodic flush (e.g., every 30 seconds)
void cache_flush() {
    for (Block *b : cache.all_dirty_blocks()) {
        b->writeback();      // Now actually write to disk
        b->dirty = false;
    }
}

// Force immediate write for critical data
void program_force_sync() {
    fsync(fd);  // System call to flush file data to disk
}`,
                annotations: [
                    { match: "sync_write", explanation: "A synchronous write waits for the disk to confirm the data was written before returning. Slow but safe - if the function returns, data is on disk." },
                    { match: "write_to_disk", explanation: "Initiates the actual physical write operation to the disk platters or SSD cells. This is the slow part - disk I/O takes milliseconds." },
                    { match: "wait_for_completion", explanation: "Blocks the calling thread until the disk controller confirms the write is complete. The program cannot continue until this returns." },
                    { match: "delayed_write", explanation: "A delayed (asynchronous) write just marks the block as dirty and returns immediately. The actual disk write happens later during a cache flush." },
                    { match: "dirty", explanation: "A flag indicating this block has been modified in memory but not yet written to disk. If power fails, dirty blocks are lost!" },
                    { match: "cache_flush", explanation: "Writes all dirty blocks to disk. Called periodically (every ~30 seconds) or when the cache is full. Also called on shutdown." },
                    { match: "all_dirty_blocks", explanation: "Returns an iterator over all cache entries marked as dirty. These are the blocks that need to be written to disk." },
                    { match: "fsync", explanation: "A POSIX system call that forces all modified data for a file to be written to disk. Used by databases and other programs that need durability guarantees." },
                    { match: "fd", explanation: "File descriptor - an integer handle that identifies an open file. Returned by open() and used in read(), write(), close(), etc." }
                ]
            }
        },
        {
            id: "crash-scenarios",
            title: "Crash Scenarios & Inconsistencies",
            content: `Let's examine specific scenarios where crashes cause problems. The key insight is that filesystem operations affect multiple blocks, and partial completion creates **inconsistent state**.`,
            keyPoints: [
                "Creating a file: inode init + dirent + freelist + data = 4 related updates",
                "Appending to file: freelist update + inode update + data write",
                "Deleting a file: remove dirent + free blocks + free inode",
                "Any crash mid-operation can corrupt the filesystem"
            ],
            diagram: `
Example: Adding a block to a file (3 operations)

Correct order:
  1. Update free list (mark block as used)
  2. Update inode (add block number to i_addr)  
  3. Write data to new block

Crash Scenario A: Crash after step 2, before step 1
  ┌─────────────────────────────────────────────────────────────┐
  │ Result: Block is in inode BUT also marked "free"!          │
  │         Free list could give block to another file later   │
  │         → Two files share same block (DATA CORRUPTION)     │
  └─────────────────────────────────────────────────────────────┘

Crash Scenario B: Crash after step 1, before step 2
  ┌─────────────────────────────────────────────────────────────┐
  │ Result: Block marked "used" but not in any inode           │
  │         Block is "leaked" - unusable but not freed         │
  │         → Wasted space (LESS SEVERE - can reclaim later)   │
  └─────────────────────────────────────────────────────────────┘
      `,
            codeExample: {
                title: "Detecting inconsistencies in fsck",
                language: "cpp",
                code: `// From fsckv6.cc - Check for cross-allocated blocks
bool Fsck::scan_blocks(BlockPtrArray ba, BlockPath end) {
    bool res = true;
    for (unsigned i = 0; i < ba.size(); ++i) {
        uint16_t bn = ba.at(i);
        if (bn) {
            if (fs_.badblock(bn)) {
                out() << "block " << bn << ": bad block number\\n";
            }
            else if (i > end) {
                out() << "block " << bn << ": allocated beyond end of file\\n";
            }
            else if (!freemap_.at(bn)) {  // Already claimed by another file!
                out() << "block " << bn << ": CROSS-ALLOCATED\\n";
                // This block is in two different inodes - corruption!
            }
            else {
                freemap_.at(bn) = false;  // Mark as used in our bitmap
                continue;
            }
            // Fix: zero out the bad block pointer
            patch16(ba.pointer_offset(i), 0);
            res = false;
        }
    }
    return res;
}`,
                annotations: [
                    { match: "scan_blocks", explanation: "Scans all block pointers in an inode or indirect block to detect inconsistencies." },
                    { match: "BlockPtrArray", explanation: "Array of 16-bit block numbers - could be direct pointers in inode or entries in indirect block." },
                    { match: "BlockPath end", explanation: "The last valid block position based on file size. Blocks beyond this are suspicious." },
                    { match: "fs_.badblock(bn)", explanation: "Checks if block number is out of valid range for the filesystem." },
                    { match: "beyond end of file", explanation: "Block pointer exists past the file size boundary - likely garbage from previous use." },
                    { match: "CROSS-ALLOCATED", explanation: "Block claimed by multiple inodes - serious corruption that must be fixed!" },
                    { match: "freemap_.at(bn)", explanation: "Tracks which blocks we've seen during scan. If already false, another inode claimed it." },
                    { match: "patch16", explanation: "Writes a 16-bit value to repair the corruption - here zeroing bad block pointers." }
                ]
            }
        },
        {
            id: "fsck",
            title: "Approach #1: fsck (File System Check)",
            content: `The **fsck** program runs on bootup to check filesystem consistency and repair problems. It scans all metadata (inodes, indirect blocks, free list, directories) looking for inconsistencies, then fixes them.`,
            keyPoints: [
                "Runs at boot time if unclean shutdown detected (flag on disk)",
                "Scans entire filesystem metadata looking for problems",
                "Builds bitmap of which blocks are actually used by files",
                "Compares against stored free list to find inconsistencies",
                "Repairs: fix link counts, remove bad entries, rebuild free list",
                "Creates lost+found directory for orphaned files"
            ],
            codeExample: {
                title: "fsck main flow from assign2",
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
    // (bad inumbers, duplicate entries, missing . and ..)
    if (!fsck.scan_directory(fs.iget(ROOT_INUMBER))) {
        std::cout << "scan directories required fixes\\n";
        res = false;
        if (write) fsck.apply();
    }
    
    // Step 4: Fix link counts
    // nlinks_[ino] = actual count from directories
    if (!fsck.fix_nlink()) {
        std::cout << "fix link count required fixes\\n";
        res = false;
    }
    
    // Step 5: Rebuild the free list from our computed bitmap
    if (write) {
        fsck.apply();
        fsck.rebuild_freelist();
    }
    
    return res ? 0 : 1;
}`,
                annotations: [
                    { match: "V6FS", explanation: "The V6 File System object - represents the entire filesystem including superblock, inodes, and data blocks. V6 refers to Unix Version 6 (1975)." },
                    { match: "scan_inodes", explanation: "Iterates through all inodes on disk, checking each one for problems and building a bitmap of which blocks are actually in use." },
                    { match: "apply", explanation: "Writes all pending fixes to disk. The fsck object accumulates fixes in memory, then applies them all at once for efficiency." },
                    { match: "fs_freemap", explanation: "Reads the free list from disk and converts it to a bitmap format for comparison with our computed bitmap." },
                    { match: "scan_directory", explanation: "Recursively walks the directory tree starting from root, checking for bad inode numbers, duplicate entries, and missing . and .. entries." },
                    { match: "ROOT_INUMBER", explanation: "The inode number of the root directory, always 1 in Unix filesystems. This is the starting point for traversing the directory tree." },
                    { match: "iget", explanation: "Gets an inode by number, loading it from disk if not already cached. Returns a reference-counted pointer to the inode." },
                    { match: "fix_nlink", explanation: "Compares the i_nlink field in each inode against the actual number of directory entries pointing to it, and fixes any mismatches." },
                    { match: "rebuild_freelist", explanation: "Constructs a new free list from scratch based on our computed bitmap. This overwrites the potentially corrupted on-disk free list." }
                ]
            }
        },
        {
            id: "fsck-details",
            title: "fsck: Detailed Checks",
            content: `Let's examine the specific checks fsck performs and how it fixes each type of inconsistency.`,
            keyPoints: [
                "Block in file AND in free list → Remove from free list",
                "Block in two files (cross-allocated) → Copy for one, or remove from both",
                "Inode has wrong link count → Fix i_nlink to match actual references",
                "Allocated inode not in any directory → Add to lost+found",
                "Directory entry points to unallocated inode → Remove entry",
                "Missing '.' or '..' in directory → Add them"
            ],
            codeExample: {
                title: "Directory scanning and link count tracking",
                language: "cpp",
                code: `// From fsckv6.cc - Scan a directory for problems
bool Fsck::scan_directory(Ref<Inode> ip, uint16_t parent) {
    bool res = true, dot_ok = false, dotdot_ok = false;
    std::set<std::string> names;
    
    for (Cursor c{ip}; direntv6 *p = c.next<direntv6>();) {
        if (!p->d_inumber) continue;  // Empty slot
        
        std::string name(p->name());
        
        // Check 1: Is inumber valid?
        if (!valid_inum(p->d_inumber)) {
            out() << "invalid inumber " << p->d_inumber << " for " << name << "\\n";
            res = false;
            patch(&p->d_inumber, 0);  // Fix: zero out bad entry
            continue;
        }
        
        // Check 2: Duplicate names?
        if (names.count(name)) {
            out() << "duplicate directory entry for \\"" << name << "\\"\\n";
            res = false;
            patch(&p->d_inumber, 0);  // Fix: remove duplicate
            continue;
        }
        names.emplace(name);
        
        // Handle "." - must point to self
        if (name == ".") {
            if (p->d_inumber != ip->inum()) {
                out() << "incorrect \\".\\"]inumber\\n";
                patch(&p->d_inumber, ip->inum());
            }
            dot_ok = true;
            ++nlinks_.at(ip->inum());  // Count this reference
            continue;
        }
        
        // Handle ".." - must point to parent
        if (name == "..") {
            if (p->d_inumber != parent) {
                out() << "incorrect \\"..\\" inumber\\n";
                patch(&p->d_inumber, parent);
            }
            dotdot_ok = true;
            ++nlinks_.at(parent);
            continue;
        }
        
        // Regular entry - count the link
        ++nlinks_.at(p->d_inumber);
        
        // Check: Does this point to an allocated inode?
        Ref<Inode> eip = fs_.iget(p->d_inumber);
        if (!(eip->i_mode & IALLOC)) {
            out() << "entry " << name << " for unallocated inode\\n";
            --nlinks_.at(p->d_inumber);
            patch(&p->d_inumber, 0);  // Fix: remove entry
            continue;
        }
        
        // Recurse into subdirectories
        if ((eip->i_mode & IFMT) == IFDIR) {
            scan_directory(eip, ip->inum());
        }
    }
    
    // Fix missing . and ..
    if (!dot_ok) {
        out() << "missing \\".\\"]\\n";
        newlinks_.emplace_back(ip->inum(), ip->inum(), ".");
    }
    if (!dotdot_ok) {
        out() << "missing \\"..\\"\\n";
        newlinks_.emplace_back(ip->inum(), parent, "..");
    }
    
    return res;
}`,
                annotations: [
                    { match: "Ref<Inode>", explanation: "A reference-counted smart pointer to an inode. Automatically frees the inode when the last reference goes out of scope." },
                    { match: "Cursor", explanation: "An iterator for reading a file's contents sequentially. Handles block boundaries and indirect blocks transparently." },
                    { match: "direntv6", explanation: "A V6 directory entry structure containing a 2-byte inode number and a 14-character filename." },
                    { match: "d_inumber", explanation: "The inode number field in a directory entry. If 0, the entry is empty/deleted." },
                    { match: "valid_inum", explanation: "Checks if an inode number is within the valid range for this filesystem (1 to s_isize * 16)." },
                    { match: "patch", explanation: "Records a fix to be applied later. Stores the address and new value without immediately writing to disk." },
                    { match: "nlinks_", explanation: "An array tracking how many directory entries point to each inode. Used to verify and fix the i_nlink field." },
                    { match: "IALLOC", explanation: "A flag in i_mode indicating the inode is allocated (in use). If not set, the inode is free." },
                    { match: "IFMT", explanation: "A bitmask to extract the file type from i_mode. Common types: IFREG (regular file), IFDIR (directory), IFCHR (character device)." },
                    { match: "IFDIR", explanation: "Flag indicating this inode is a directory. Directories contain a list of (name, inode number) pairs." },
                    { match: "emplace_back", explanation: "Adds a new element to the end of a vector, constructing it in place. More efficient than push_back for complex objects." }
                ]
            }
        },
        {
            id: "fsck-limitations",
            title: "Limitations of fsck",
            content: `While fsck can restore filesystem consistency, it has significant drawbacks that make it unsuitable as the only recovery mechanism for modern systems.`,
            keyPoints: [
                "Time: Must scan ENTIRE disk - 5TB disk at ~170MB/s = 8+ hours!",
                "System unusable during fsck (can't boot until complete)",
                "Restores consistency but doesn't prevent data loss",
                "Filesystem might work but be unusable (critical files in lost+found)",
                "Security: blocks could migrate between files (password leak risk)",
                "Doesn't help with in-progress operations that were interrupted"
            ],
            codeExample: {
                title: "Fixing unreachable inodes (lost+found)",
                language: "cpp",
                code: `// From fsckv6.cc - Handle inodes with wrong link count
bool Fsck::fix_nlink() {
    bool res = true;
    const uint32_t stop = nlinks_.size();
    const inode zero{};  // Empty inode for freeing
    
    for (uint32_t i = ROOT_INUMBER; i < stop; ++i) {
        Ref<Inode> ip = fs_.iget(i);
        int actual_links = nlinks_.at(i);  // What we counted from directories
        
        if (actual_links == 0) {
            // This inode is allocated but no directory references it!
            if (ip->i_mode & IALLOC) {
                out() << "freeing unreachable inode " << i << "\\n";
                res = false;
                // Option 1: Free the inode entirely
                patch<inode>(ip.get(), zero);
                // Option 2: Could add to lost+found instead
            }
        }
        else if (actual_links != ip->i_nlink) {
            // Link count is wrong - fix it
            out() << "inode " << i << ": link count " << int(ip->i_nlink)
                  << " should be " << actual_links << "\\n";
            res = false;
            patch(&ip->i_nlink, actual_links);
        }
    }
    return res;
}

// Rebuild the entire free list from our computed bitmap
void Fsck::rebuild_freelist() {
    fs_.superblock().s_nfree = 0;
    const uint16_t start = INODE_START_SECTOR + fs_.superblock().s_isize;
    
    // Going backwards may give better contiguous allocation later
    for (uint16_t bn = fs_.superblock().s_fsize; bn-- > start;) {
        if (freemap_.at(bn))  // Block is actually free
            fs_.bfree(bn);     // Add to free list
    }
}`,
                annotations: [
                    { match: "i_nlink", explanation: "The link count field in an inode. Tracks how many directory entries point to this inode. When it reaches 0 and no processes have the file open, the inode is freed." },
                    { match: "unreachable inode", explanation: "An inode that is allocated (IALLOC set) but has no directory entries pointing to it. This is a 'leaked' inode that wastes space." },
                    { match: "lost+found", explanation: "A special directory where fsck places orphaned files (files with no parent directory). Users can examine these files and move them to proper locations." },
                    { match: "superblock", explanation: "The first block of the filesystem containing critical metadata: filesystem size, number of inodes, free list head, etc." },
                    { match: "s_nfree", explanation: "Field in superblock tracking how many block numbers are in the in-superblock free list cache (0-100 entries)." },
                    { match: "s_isize", explanation: "Field in superblock specifying how many blocks are used for inodes. Determines where the data blocks begin." },
                    { match: "s_fsize", explanation: "Field in superblock specifying the total size of the filesystem in blocks." },
                    { match: "bfree", explanation: "Adds a block to the free list. The opposite of balloc() which allocates a free block." },
                    { match: "INODE_START_SECTOR", explanation: "The block number where inodes begin (usually block 2, after the boot block and superblock)." }
                ]
            }
        },
        {
            id: "ordered-writes",
            title: "Approach #2: Ordered Writes",
            content: `Instead of fixing problems after the fact, we can **prevent certain inconsistencies** by carefully ordering our writes. The key insight: some orderings are safer than others.`,
            keyPoints: [
                "Core idea: write updates in a specific order that limits damage from crashes",
                "Rule 1: Initialize target before creating reference to it",
                "Rule 2: Remove references before reusing a resource",
                "Result: May leak resources, but never corrupt data",
                "Leaked resources can be reclaimed later (much faster than full fsck)"
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
  Freeing a block:
    ✓ SAFE:   1. Remove from inode  →  2. Add to free list
              (crash after 1: leaked block, recoverable)
    
    ✗ UNSAFE: 1. Add to free list  →  2. Remove from inode
              (crash after 1: block in file AND free list!)
      `,
            codeExample: {
                title: "Why order matters - Adding a block to a file",
                language: "cpp",
                code: `// WRONG ORDER - can cause cross-allocation
void add_block_wrong(Inode *ip, int new_block) {
    // Step 1: Add block number to inode first
    ip->i_addr[next_slot] = new_block;
    ip->writeback();
    
    // CRASH HERE = block in inode AND in free list!
    // Another file might claim it too!
    
    // Step 2: Mark block as used
    freelist.mark_used(new_block);
    freelist.writeback();
}

// RIGHT ORDER - worst case is leaked block
void add_block_correct(Inode *ip, int new_block) {
    // Step 1: Mark block as used FIRST
    freelist.mark_used(new_block);
    freelist.writeback();
    
    // CRASH HERE = block marked used but not in any inode
    // Block is "leaked" but no corruption - can reclaim later
    
    // Step 2: Now safe to add to inode
    ip->i_addr[next_slot] = new_block;
    ip->writeback();
}

// DELETING a block - must do opposite order
void remove_block_correct(Inode *ip, int slot) {
    int block = ip->i_addr[slot];
    
    // Step 1: Remove reference from inode FIRST
    ip->i_addr[slot] = 0;
    ip->writeback();
    
    // CRASH HERE = block not in inode, not in free list
    // Leaked block - recoverable
    
    // Step 2: Now safe to add to free list
    freelist.mark_free(block);
    freelist.writeback();
}`,
                annotations: [
                    { match: "add_block_wrong", explanation: "Demonstrates the INCORRECT order: adding block to inode before marking it used. A crash between these steps causes cross-allocation." },
                    { match: "add_block_correct", explanation: "Demonstrates the CORRECT order: mark block as used BEFORE adding to inode. A crash just leaks the block, which is recoverable." },
                    { match: "remove_block_correct", explanation: "The correct order for deletion is the OPPOSITE of allocation: remove from inode first, then add to free list." },
                    { match: "mark_used", explanation: "Sets the block's bit to 0 in the free bitmap, indicating it's no longer available for allocation." },
                    { match: "mark_free", explanation: "Sets the block's bit to 1 in the free bitmap, making it available for future allocation." },
                    { match: "next_slot", explanation: "The next available slot in i_addr array to store a block number. Tracks how many blocks the file currently uses." },
                    { match: "leaked", explanation: "A block that's marked as 'used' but not referenced by any file. Wastes space but doesn't corrupt data. Recoverable by fsck." }
                ]
            }
        },
        {
            id: "ordered-writes-rules",
            title: "Ordered Writes: Complete Rules",
            content: `Here are the complete rules for ordered writes that prevent the worst inconsistencies. The philosophy: accept minor "leaks" that are easily recoverable, to prevent severe corruption that loses data.`,
            keyPoints: [
                "Creating file: init inode → add dirent → mark blocks used → write data",
                "Deleting file: remove dirent → write inode (mark unallocated) → mark blocks free",
                "Growing file: mark block used → update inode → write data",
                "Shrinking file: update inode → mark blocks free",
                "Result: eliminates need for full disk scan on reboot!"
            ],
            codeExample: {
                title: "Ordered writes for file creation",
                language: "cpp",
                code: `// Creating a new file with ordered writes
int create_file_ordered(const char *path, const void *data, size_t len) {
    // Parse path to get parent directory and filename
    Inode *parent_dir = lookup_parent(path);
    const char *filename = basename(path);
    
    // Step 1: Allocate and initialize the new inode FIRST
    int new_inum = alloc_inode();
    Inode *new_inode = iget(new_inum);
    new_inode->i_mode = IALLOC | IFREG | 0644;
    new_inode->i_nlink = 1;
    new_inode->i_size = 0;
    new_inode->writeback();  // Write inode to disk
    // CRASH HERE: Orphan inode, will be reclaimed
    
    // Step 2: Allocate data blocks and mark used in freelist
    int blocks_needed = (len + BLOCK_SIZE - 1) / BLOCK_SIZE;
    for (int i = 0; i < blocks_needed; i++) {
        int block = freelist.alloc_block();
        freelist.writeback();  // Mark used BEFORE adding to inode
        // CRASH HERE: Leaked block, will be reclaimed
        
        new_inode->i_addr[i] = block;
    }
    new_inode->i_size = len;
    new_inode->writeback();
    // CRASH HERE: Orphan inode with blocks, will be reclaimed
    
    // Step 3: Write the actual data
    write_data(new_inode, data, len);
    // CRASH HERE: Still orphan, will be reclaimed
    
    // Step 4: Add directory entry LAST (makes file visible)
    add_dirent(parent_dir, filename, new_inum);
    parent_dir->writeback();
    // After this point, file is fully created
    
    return 0;
}`,
                annotations: [
                    { match: "lookup_parent", explanation: "Traverses the path to find the parent directory. For '/home/user/file.txt', returns the inode for '/home/user/'." },
                    { match: "basename", explanation: "Returns just the filename portion of a path. For '/home/user/file.txt', returns 'file.txt'." },
                    { match: "alloc_inode", explanation: "Finds a free inode in the inode table and marks it as allocated. Returns the inode number." },
                    { match: "IFREG", explanation: "Flag indicating a regular file (as opposed to directory, device, symlink, etc.). Part of the file type stored in i_mode." },
                    { match: "0644", explanation: "Octal permission bits: owner can read/write (6), group and others can only read (4). Standard permission for files." },
                    { match: "i_size", explanation: "The size of the file in bytes. For directories, this is the size of the directory entries list." },
                    { match: "i_addr", explanation: "Array of block numbers in the inode pointing to the file's data blocks. In V6: 8 entries (6 direct, 1 indirect, 1 double-indirect)." },
                    { match: "BLOCK_SIZE", explanation: "The size of a disk block, typically 512 bytes in V6 or 4096 bytes in modern filesystems." },
                    { match: "alloc_block", explanation: "Removes a block from the free list and returns its block number. The caller is responsible for using this block." },
                    { match: "add_dirent", explanation: "Adds a new directory entry to a directory. This is what makes the file 'visible' - creates the name→inode mapping." },
                    { match: "Orphan inode", explanation: "An inode that exists and is allocated, but has no directory entry pointing to it. Can be safely reclaimed since no path leads to it." }
                ]
            }
        },
        {
            id: "exam-prep",
            title: "🎯 Midterm Prep: What to Know",
            content: `Crash recovery is a core midterm topic — expect questions on why crashes cause inconsistencies, what fsck does, and how ordered writes prevent cross-allocation. This material connects directly to assign2.`,
            keyPoints: [
                "📝 Free bitmap: 1 = free, 0 = used. Know how to look up / set bits",
                "📝 Block cache: LRU eviction, dirty blocks must be written back before eviction",
                "📝 Delayed writes improve performance but risk data loss on crash",
                "📝 Multi-block operations are the root cause — crash between writes = inconsistency",
                "📝 Possible inconsistencies: cross-allocation, orphan inodes, wrong link count, leaked blocks",
                "📝 Cross-allocation (block in 2 files) is WORSE than leaked block (wasted space)",
                "📝 fsck: scans entire disk, checks bitmap vs. inodes, fixes link counts, rescues orphans to lost+found",
                "📝 fsck limitation: must scan ALL blocks — hours for large disks!"
            ],
            diagram: `
Midterm Cheat Sheet — Crash Recovery (Part 1):

┌─────────────────────────────────────────────────────────────┐
│  CONCEPT              │  KEY FACT                            │
├─────────────────────────────────────────────────────────────┤
│  Free bitmap          │  1 = free, 0 = used                  │
│                       │  One bit per block                   │
├─────────────────────────────────────────────────────────────┤
│  Block cache          │  LRU eviction policy                 │
│                       │  Dirty bit tracks modifications      │
│                       │  Delayed writes = faster but risky   │
├─────────────────────────────────────────────────────────────┤
│  Cross-allocation     │  Block claimed by 2+ inodes          │
│  (VERY BAD)           │  Write to one file corrupts other    │
├─────────────────────────────────────────────────────────────┤
│  Leaked block         │  Block marked used but no inode      │
│  (recoverable)        │  has it — just wastes space          │
├─────────────────────────────────────────────────────────────┤
│  Orphan inode         │  Inode allocated (IALLOC) but no     │
│                       │  directory entry → add to lost+found │
├─────────────────────────────────────────────────────────────┤
│  fsck link count fix  │  Count directory refs to each inode  │
│                       │  Compare with i_nlink, fix if wrong  │
└─────────────────────────────────────────────────────────────┘

Exam question pattern:
  "A crash occurs between step X and step Y. 
   What inconsistency results? How does fsck fix it?"
`
        },
        {
            id: "summary",
            title: "Crash Recovery Summary",
            content: `We've covered two approaches to crash recovery. Both have tradeoffs, leading to the need for more sophisticated approaches like journaling (covered next lecture).`,
            keyPoints: [
                "Free list: bitmap tracks free blocks (1 = free, 0 = used)",
                "Block cache: LRU cache of disk blocks, with delayed writes",
                "Delayed writes = faster but riskier (crash may lose recent work)",
                "fsck: scan entire disk on boot, fix inconsistencies (slow!)",
                "Ordered writes: prevent worst inconsistencies, accept minor leaks",
                "Coming next: Write-ahead logging (journaling) - best of both worlds"
            ],
            advantages: [
                "fsck: Can repair any inconsistency by scanning all metadata",
                "fsck: Works even after arbitrary crashes",
                "Ordered writes: Fast boot (no full disk scan)",
                "Ordered writes: Prevents data corruption (only leaks)"
            ],
            disadvantages: [
                "fsck: Extremely slow for large disks (hours!)",
                "fsck: System unusable during check",
                "fsck: Security risk (block migration)",
                "Ordered writes: Requires careful implementation",
                "Ordered writes: Still may need periodic leak recovery"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Bitmap Free Block Lookup",
            difficulty: "easy",
            description: "Implement a function to find the next free block starting from a given position. Use bit manipulation to efficiently check chunks of 32 bits at a time.",
            hint: "Check if the starting chunk has any 1 bits after the starting position. If not, search subsequent chunks. Use bitwise AND with a mask to isolate relevant bits.",
            starterCode: `// Find next free block (1 bit) starting at 'start'
// Returns block number, or -1 if no free blocks
int find_free_block(uint32_t *bitmap, size_t num_blocks, size_t start) {
    const size_t bits_per_chunk = 32;
    size_t start_chunk = start / bits_per_chunk;
    size_t start_bit = start % bits_per_chunk;
    
    // Check the first chunk (mask off bits before start position)
    uint32_t mask = ~((1U << start_bit) - 1);  // Bits from start_bit onwards
    uint32_t chunk = bitmap[start_chunk] & mask;
    
    if (chunk != 0) {
        // Found a 1 bit in this chunk!
        int bit_pos = ____; // Find position of lowest 1 bit
        return start_chunk * bits_per_chunk + bit_pos;
    }
    
    // Search remaining chunks
    for (size_t c = start_chunk + 1; c * bits_per_chunk < num_blocks; c++) {
        if (bitmap[c] != 0) {
            int bit_pos = ____;
            return c * bits_per_chunk + bit_pos;
        }
    }
    
    return -1; // No free blocks
}`,
            solution: `// Find next free block (1 bit) starting at 'start'
// Returns block number, or -1 if no free blocks
int find_free_block(uint32_t *bitmap, size_t num_blocks, size_t start) {
    const size_t bits_per_chunk = 32;
    size_t start_chunk = start / bits_per_chunk;
    size_t start_bit = start % bits_per_chunk;
    
    // Check the first chunk (mask off bits before start position)
    uint32_t mask = ~((1U << start_bit) - 1);  // Bits from start_bit onwards
    uint32_t chunk = bitmap[start_chunk] & mask;
    
    if (chunk != 0) {
        // Found a 1 bit in this chunk!
        // __builtin_ctz = count trailing zeros = position of lowest 1 bit
        int bit_pos = __builtin_ctz(chunk);
        return start_chunk * bits_per_chunk + bit_pos;
    }
    
    // Search remaining chunks
    for (size_t c = start_chunk + 1; c * bits_per_chunk < num_blocks; c++) {
        if (bitmap[c] != 0) {
            int bit_pos = __builtin_ctz(bitmap[c]);
            return c * bits_per_chunk + bit_pos;
        }
    }
    
    return -1; // No free blocks
}`,
            explanation: "__builtin_ctz (count trailing zeros) is a GCC/Clang built-in that efficiently finds the position of the lowest set bit. For example, __builtin_ctz(0b01010100) = 2 because the lowest 1 is at position 2."
        },
        {
            id: "ex2",
            title: "LRU Cache Eviction",
            difficulty: "medium",
            description: "Implement the eviction logic for an LRU cache. When the cache is full, find the least recently used entry that can be evicted. If it's dirty, write it back first.",
            hint: "Walk the list from front (oldest) to back (newest). Check if each entry can be evicted (no active references). Handle dirty entries by writing them back before eviction.",
            starterCode: `struct CacheEntry {
    int block_num;
    bool dirty;
    bool in_use;  // Has active references
    char data[512];
    CacheEntry *prev, *next;
};

class LRUCache {
    CacheEntry *head;  // Least recently used
    CacheEntry *tail;  // Most recently used
    
public:
    // Find entry to evict, write back if dirty
    // Returns nullptr if nothing can be evicted
    CacheEntry* find_victim() {
        for (CacheEntry *e = head; e != nullptr; e = ____) {
            if (____) {  // Can't evict if in use
                continue;
            }
            if (e->dirty) {
                ____  // Write to disk first
            }
            return e;
        }
        return nullptr;
    }
    
    // Move entry to back of list (most recently used)
    void touch(CacheEntry *e) {
        // Remove from current position
        if (e->prev) e->prev->next = e->next;
        if (e->next) e->next->prev = e->prev;
        if (head == e) head = e->next;
        
        // Add to tail
        ____
    }
};`,
            solution: `struct CacheEntry {
    int block_num;
    bool dirty;
    bool in_use;  // Has active references
    char data[512];
    CacheEntry *prev, *next;
};

class LRUCache {
    CacheEntry *head;  // Least recently used
    CacheEntry *tail;  // Most recently used
    
public:
    // Find entry to evict, write back if dirty
    // Returns nullptr if nothing can be evicted
    CacheEntry* find_victim() {
        for (CacheEntry *e = head; e != nullptr; e = e->next) {
            if (e->in_use) {  // Can't evict if in use
                continue;
            }
            if (e->dirty) {
                write_to_disk(e->block_num, e->data);  // Write to disk first
                e->dirty = false;
            }
            return e;
        }
        return nullptr;
    }
    
    // Move entry to back of list (most recently used)
    void touch(CacheEntry *e) {
        // Remove from current position
        if (e->prev) e->prev->next = e->next;
        if (e->next) e->next->prev = e->prev;
        if (head == e) head = e->next;
        
        // Add to tail
        e->prev = tail;
        e->next = nullptr;
        if (tail) tail->next = e;
        tail = e;
        if (!head) head = e;
    }
};`,
            explanation: "LRU eviction walks from head (oldest) to find an entry without active references. Dirty entries must be written back before eviction to avoid data loss. The touch() operation moves accessed entries to the tail to mark them as most-recently-used."
        },
        {
            id: "ex3",
            title: "Cross-Allocation Detection",
            difficulty: "medium",
            description: "Implement a function that detects cross-allocated blocks (blocks claimed by multiple inodes). This is a key part of fsck.",
            hint: "Build a bitmap as you scan inodes. If you encounter a block that's already marked as used, that's a cross-allocation.",
            starterCode: `struct CrossAllocation {
    uint16_t block_num;
    uint16_t inode1;
    uint16_t inode2;
};

// Scan all inodes and detect cross-allocated blocks
std::vector<CrossAllocation> detect_cross_allocations(V6FS &fs) {
    std::vector<CrossAllocation> problems;
    
    // block_owner[bn] = inode that owns block bn, or 0 if free
    std::vector<uint16_t> block_owner(fs.num_blocks(), 0);
    
    // Scan all allocated inodes
    for (uint16_t ino = ROOT_INUMBER; ino < fs.num_inodes(); ino++) {
        Inode *ip = fs.iget(ino);
        if (!(ip->i_mode & IALLOC)) continue;  // Skip unallocated
        
        // Check each block in this inode
        int num_blocks = (inode_size(ip) + BLOCK_SIZE - 1) / BLOCK_SIZE;
        for (int i = 0; i < num_blocks; i++) {
            uint16_t bn = get_block_number(ip, i);
            if (bn == 0) continue;
            
            if (____) {
                // This block is already owned!
                problems.push_back({bn, ____, ____});
            } else {
                ____  // Mark block as owned by this inode
            }
        }
    }
    
    return problems;
}`,
            solution: `struct CrossAllocation {
    uint16_t block_num;
    uint16_t inode1;
    uint16_t inode2;
};

// Scan all inodes and detect cross-allocated blocks
std::vector<CrossAllocation> detect_cross_allocations(V6FS &fs) {
    std::vector<CrossAllocation> problems;
    
    // block_owner[bn] = inode that owns block bn, or 0 if free
    std::vector<uint16_t> block_owner(fs.num_blocks(), 0);
    
    // Scan all allocated inodes
    for (uint16_t ino = ROOT_INUMBER; ino < fs.num_inodes(); ino++) {
        Inode *ip = fs.iget(ino);
        if (!(ip->i_mode & IALLOC)) continue;  // Skip unallocated
        
        // Check each block in this inode
        int num_blocks = (inode_size(ip) + BLOCK_SIZE - 1) / BLOCK_SIZE;
        for (int i = 0; i < num_blocks; i++) {
            uint16_t bn = get_block_number(ip, i);
            if (bn == 0) continue;
            
            if (block_owner[bn] != 0) {
                // This block is already owned by another inode!
                problems.push_back({bn, block_owner[bn], ino});
            } else {
                block_owner[bn] = ino;  // Mark block as owned by this inode
            }
        }
    }
    
    return problems;
}`,
            explanation: "Cross-allocation occurs when two inodes both contain the same block number. We detect this by building a map from block numbers to their owning inode. If we see the same block twice, we record both inodes involved."
        },
        {
            id: "ex4",
            title: "Ordered Write Sequence",
            difficulty: "hard",
            description: "Given the operations needed to append a block to a file, determine the correct order to prevent the worst inconsistencies. Consider what happens if a crash occurs after each step.",
            hint: "Apply Rule 2: before reusing a resource, nullify references. Here, claiming a block from the free list is 'reusing' it, so the free list must be updated before the inode references the block.",
            starterCode: `// Operations needed to append a block to a file:
// A: Write data to new block
// B: Update inode: add block number to i_addr, increase size
// C: Update free list: mark block as used

// What order prevents cross-allocation if crash occurs?
// (Assume delayed writes - order of writeback matters)

void append_block_safe(Inode *ip, int new_block, const void *data) {
    // STEP 1: ____ (A, B, or C?)
    
    // If crash here, what's the state? ____
    
    // STEP 2: ____ (A, B, or C?)
    
    // If crash here, what's the state? ____
    
    // STEP 3: ____ (A, B, or C?)
    
    // What invariant does this order maintain?
    // ____
}`,
            solution: `// Operations needed to append a block to a file:
// A: Write data to new block
// B: Update inode: add block number to i_addr, increase size
// C: Update free list: mark block as used

// CORRECT ORDER: C -> B -> A (or C -> A -> B)

void append_block_safe(Inode *ip, int new_block, const void *data) {
    // STEP 1: C - Mark block as used in free list
    freelist.mark_used(new_block);
    freelist.writeback();
    
    // If crash here: Block is marked used but not in any inode
    // Result: LEAKED BLOCK (harmless, can reclaim later)
    
    // STEP 2: B - Update inode to reference the block
    int slot = find_free_slot(ip);
    ip->i_addr[slot] = new_block;
    ip->size += BLOCK_SIZE;
    ip->writeback();
    
    // If crash here: Inode references block, but data not written
    // Result: File has garbage data in last block (user's problem)
    
    // STEP 3: A - Write actual data
    write_block(new_block, data);
    
    // Invariant maintained: A block is NEVER both "free" and
    // "referenced by an inode" at the same time.
    // This prevents cross-allocation (two files sharing a block).
}`,
            explanation: "The key insight is that cross-allocation (block in two files) is MUCH worse than a leaked block. By updating the free list FIRST, we ensure the block can never be given to another file. The worst case is a leaked block, which wastes space but doesn't corrupt data."
        },
        {
            id: "ex5",
            title: "Link Count Verification",
            difficulty: "medium",
            description: "Implement a function to verify that each inode's link count (i_nlink) matches the actual number of directory entries pointing to it.",
            hint: "First, traverse all directories and count references to each inode. Then compare with the stored i_nlink values.",
            starterCode: `struct LinkCountError {
    uint16_t ino;
    int stored_count;
    int actual_count;
};

std::vector<LinkCountError> verify_link_counts(V6FS &fs) {
    std::vector<LinkCountError> errors;
    
    // Count actual links for each inode
    std::vector<int> actual_links(fs.num_inodes(), 0);
    
    // Recursive function to scan a directory
    std::function<void(uint16_t, uint16_t)> scan_dir;
    scan_dir = [&](uint16_t dir_ino, uint16_t parent_ino) {
        Inode *dir = fs.iget(dir_ino);
        
        for (each dirent in dir's blocks) {
            if (dirent.d_inumber == 0) continue;  // Empty slot
            
            std::string name = dirent.name();
            
            if (name == ".") {
                ____  // Count link to self
            } else if (name == "..") {
                ____  // Count link to parent
            } else {
                ____  // Count link to child
                
                // If child is a directory, recurse
                Inode *child = fs.iget(dirent.d_inumber);
                if (is_directory(child)) {
                    scan_dir(dirent.d_inumber, dir_ino);
                }
            }
        }
    };
    
    // Start from root directory
    scan_dir(ROOT_INUMBER, ROOT_INUMBER);
    
    // Compare with stored values
    ____
    
    return errors;
}`,
            solution: `struct LinkCountError {
    uint16_t ino;
    int stored_count;
    int actual_count;
};

std::vector<LinkCountError> verify_link_counts(V6FS &fs) {
    std::vector<LinkCountError> errors;
    
    // Count actual links for each inode
    std::vector<int> actual_links(fs.num_inodes(), 0);
    
    // Recursive function to scan a directory
    std::function<void(uint16_t, uint16_t)> scan_dir;
    scan_dir = [&](uint16_t dir_ino, uint16_t parent_ino) {
        Inode *dir = fs.iget(dir_ino);
        
        for (each dirent in dir's blocks) {
            if (dirent.d_inumber == 0) continue;  // Empty slot
            
            std::string name = dirent.name();
            
            if (name == ".") {
                actual_links[dir_ino]++;  // "." points to self
            } else if (name == "..") {
                actual_links[parent_ino]++;  // ".." points to parent
            } else {
                actual_links[dirent.d_inumber]++;  // Regular entry
                
                // If child is a directory, recurse
                Inode *child = fs.iget(dirent.d_inumber);
                if (is_directory(child)) {
                    scan_dir(dirent.d_inumber, dir_ino);
                }
            }
        }
    };
    
    // Start from root directory (root's parent is itself)
    scan_dir(ROOT_INUMBER, ROOT_INUMBER);
    
    // Compare with stored values
    for (uint16_t ino = ROOT_INUMBER; ino < fs.num_inodes(); ino++) {
        Inode *ip = fs.iget(ino);
        if (!(ip->i_mode & IALLOC)) continue;
        
        if (actual_links[ino] != ip->i_nlink) {
            errors.push_back({ino, ip->i_nlink, actual_links[ino]});
        }
    }
    
    return errors;
}`,
            explanation: "Link count verification traverses all directories, counting how many times each inode is referenced. The '.' entry counts as a link to itself, '..' counts as a link to the parent. After counting, we compare with each inode's stored i_nlink field. Mismatches indicate either a crash during file creation/deletion, or filesystem corruption."
        },
        {
            id: "ex6",
            title: "Fsck Decision Making",
            difficulty: "hard",
            description: "Given a specific crash scenario, determine what fsck should do to repair the filesystem.",
            hint: "Think about what state the disk is in after the crash. What invariants are violated? What's the safest fix that preserves the most data?",
            starterCode: `/*
SCENARIO: We were creating a new file when the system crashed.
The following operations were supposed to happen:
  1. Allocate inode #42, set i_mode = IALLOC | IFREG
  2. Allocate block #100, mark used in free list
  3. Write data to block #100  
  4. Set inode #42's i_addr[0] = 100
  5. Add dirent {"newfile.txt", 42} to parent directory

The crash occurred after step 4 but before step 5.

Current state after crash:
- Inode #42: i_mode = IALLOC | IFREG, i_addr[0] = 100, i_nlink = 0
- Block #100: Contains our data, marked USED in free list
- Parent directory: NO entry for "newfile.txt"

Questions:
1. What inconsistency does fsck detect?
2. What should fsck do to fix it?
3. Is any data lost?
*/

enum FsckAction {
    DO_NOTHING,
    FREE_INODE,
    ADD_TO_LOST_FOUND,
    FREE_BLOCKS,
    UPDATE_LINK_COUNT
};

FsckAction decide_repair() {
    // Inode 42 is allocated but has 0 links (no directory references it)
    // This is an "orphan inode" with data
    
    // Options:
    // A) Free the inode and its blocks (loses user data!)
    // B) Add entry in /lost+found (preserves data)
    // C) Do nothing (leaves inconsistency)
    
    return ____;  // Which action preserves the most data?
}`,
            solution: `/*
SCENARIO: We were creating a new file when the system crashed.
...

Questions and Answers:

1. What inconsistency does fsck detect?
   - Inode #42 is allocated (IALLOC set) and has data
   - But i_nlink = 0 (no directory entries reference it)
   - This is an "orphan inode" - allocated but unreachable

2. What should fsck do to fix it?
   - Add the inode to /lost+found directory!
   - Create entry: /lost+found/42 -> inode 42
   - Set i_nlink = 1

3. Is any data lost?
   - NO! The data in block #100 is preserved
   - User just needs to look in /lost+found for their file
*/

FsckAction decide_repair() {
    // Inode 42 is allocated but has 0 links (no directory references it)
    // This is an "orphan inode" with data
    
    // Options:
    // A) Free the inode and its blocks (loses user data!)  <- BAD
    // B) Add entry in /lost+found (preserves data)         <- GOOD
    // C) Do nothing (leaves inconsistency)                 <- BAD
    
    return ADD_TO_LOST_FOUND;  // Preserves user data!
}

// Implementation:
void handle_orphan_inode(V6FS &fs, uint16_t ino) {
    Inode *ip = fs.iget(ino);
    
    // Create entry in lost+found with inode number as name
    char name[16];
    snprintf(name, sizeof(name), "%d", ino);
    
    Inode *lost_found = fs.iget(LOST_FOUND_INUMBER);
    add_dirent(lost_found, name, ino);
    
    // Fix link count
    ip->i_nlink = 1;
    ip->writeback();
}`,
            explanation: "The crash left an orphan inode: allocated with data, but no directory entry points to it. The best recovery is to add it to /lost+found, which is a special directory for orphaned files. This preserves the user's data - they just need to look in /lost+found and rename/move the file. Deleting the inode would lose data unnecessarily."
        }
    ]
};

export default lecture5;
