export const lecture2 = {
    id: 2,
    title: "Introduction to Filesystems",
    subtitle: "Storing Files on Disk: From Contiguous Allocation to Inodes",
    keyTakeaway: "There is no single perfect way to store files on disk — each approach (contiguous, linked, FAT, indexed) trades off between simplicity, random access, growth flexibility, and memory overhead. The Unix V6 filesystem uses an elegant indexed approach with inodes that balances these trade-offs, and understanding it is essential for assign1.",

    sections: [
        {
            id: "why-filesystems",
            title: "Why Do We Need Filesystems?",
            content: `A **filesystem** is the layer of software that organizes data on a storage device (hard drive, SSD) so that users and programs can store, find, and retrieve files by name. Without a filesystem, a disk is just a giant array of bytes with no structure — you'd have to remember the exact byte positions of every piece of data. Filesystems solve this by managing two fundamental types of information: **payload data** (the actual file contents) and **metadata** (information *about* files, like names, sizes, and locations on disk).`,
            keyPoints: [
                "A filesystem organizes raw storage into a structured system of named files and directories",
                "Hard drives (HDDs) store data magnetically on spinning platters — sequential access is fast, random access requires physical seeking",
                "Solid-state drives (SSDs) use flash memory — faster random access, no moving parts, but more expensive per byte",
                "The fundamental unit of disk I/O is the sector (HDD) or page (SSD), typically 512 bytes or 4KB",
                "Two types of data must be stored: file payload data AND file metadata (names, sizes, permissions)",
                "Key insight: BOTH payload and metadata must be stored on disk, or they're lost on power-off",
                "This means some disk blocks must store data OTHER than file contents"
            ],
            diagram: `
Storage Hardware Overview:

Hard Disk Drive (HDD):               Solid-State Drive (SSD):
┌─────────────────────┐              ┌─────────────────────┐
│   Spinning Platters  │              │   Flash Memory      │
│   ┌───────────────┐  │              │   ┌───┬───┬───┬───┐ │
│   │ Track 0       │  │              │   │ P │ P │ P │ P │ │
│   │  ┌─────────┐  │  │              │   │ a │ a │ a │ a │ │
│   │  │ Track 1 │  │  │  Read/Write  │   │ g │ g │ g │ g │ │
│   │  │  ...    │  │  │  Head ──►    │   │ e │ e │ e │ e │ │
│   │  └─────────┘  │  │              │   │ 0 │ 1 │ 2 │ 3 │ │
│   └───────────────┘  │              │   └───┴───┴───┴───┘ │
│   Seek time: ~10ms   │              │   Access: ~0.1ms    │
└─────────────────────┘              └─────────────────────┘

Key difference: HDDs need physical movement to read different
locations (seek time). SSDs can access any location equally fast.
Both organize data in fixed-size units (sectors/pages).
      `
        },
        {
            id: "sectors-and-blocks",
            title: "Sectors and Blocks",
            content: `A filesystem divides the disk into fixed-size units. At the hardware level, the unit is a **sector** (typically 512 bytes for HDDs). The filesystem defines its own unit called a **block**, which is one or more sectors. In Unix V6, a block is exactly one sector: **512 bytes**. Every piece of data on disk — file contents, metadata, directory listings — occupies one or more of these 512-byte blocks. The key design question is: how do we decide WHICH blocks belong to WHICH files?`,
            keyPoints: [
                "A 'sector' is a hard disk storage unit (hardware concept) — typically 512 bytes",
                "A 'block' is a filesystem storage unit (software abstraction) — one or more sectors",
                "In Unix V6: 1 block = 1 sector = 512 bytes (DISKIMG_SECTOR_SIZE)",
                "Larger block sizes are more efficient (less overhead) but waste more space on small files",
                "Internal fragmentation: if a file doesn't fill its last block, the remaining space is wasted",
                "The central design question: how do we track which blocks belong to which file?",
                "Different answers to this question give us different filesystem designs"
            ],
            diagram: `
A disk as an array of blocks:

┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬─────┐
│  0   │  1   │  2   │  3   │  4   │  5   │  6   │  7   │ ... │
│512 B │512 B │512 B │512 B │512 B │512 B │512 B │512 B │     │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴─────┘

Each block is 512 bytes. The filesystem must decide:
  • Which blocks hold file data?
  • Which blocks hold metadata?
  • How do we find all blocks belonging to one file?

Internal Fragmentation Example:
  File size: 700 bytes → needs 2 blocks (1024 bytes total)
  Wasted: 1024 - 700 = 324 bytes in the last block
      `
        },
        {
            id: "contiguous-allocation",
            title: "Contiguous Allocation",
            content: `The simplest approach: store each file in a **contiguous group of blocks**. For each file, just record the starting block number and the file's length. This is like reserving a row of adjacent seats at a movie theater — the entire file is stored in one unbroken sequence on disk.`,
            keyPoints: [
                "Each file occupies a contiguous (adjacent) sequence of blocks on disk",
                "Metadata needed per file: just the start block number and length",
                "Advantage: simple to implement — just one addition to find any byte",
                "Advantage: excellent sequential AND random access (data is all in one place)",
                "Advantage: minimal seek time on HDDs since blocks are adjacent",
                "Disadvantage: hard to grow files — no room if adjacent blocks are taken",
                "Disadvantage: external fragmentation — free space gets broken into small unusable gaps"
            ],
            codeExample: {
                title: "Contiguous allocation metadata",
                language: "c",
                code: `// Contiguous allocation: each file needs just 2 numbers
struct contiguous_file {
    int start_block;   // first block of the file
    int num_blocks;    // number of blocks allocated
};

// Finding block N of a contiguously-allocated file:
int get_block(struct contiguous_file *f, int block_index) {
    if (block_index >= f->num_blocks) return -1; // bounds
    return f->start_block + block_index;  // simple addition!
}

// Example: File starts at block 10, num_blocks = 3
//   Block 0 of file → disk block 10
//   Block 1 of file → disk block 11
//   Block 2 of file → disk block 12
//   Block 3 → ERROR: out of bounds`,
                annotations: [
                    { match: "start_block", explanation: "The disk block number where this file begins. Combined with num_blocks, this completely describes where the file lives on disk." },
                    { match: "num_blocks", explanation: "The number of contiguous blocks allocated to this file. The file occupies blocks start_block through start_block + num_blocks - 1." },
                    { match: "start_block + block_index", explanation: "The key advantage of contiguous allocation: finding any block is just one addition. No need to follow chains or read tables. O(1) random access!" },
                    { match: "return -1", explanation: "Error handling: if the requested block index is beyond the file's allocated blocks, return -1. Always check bounds in systems code." }
                ]
            },
            diagram: `
Contiguous Allocation Example:

  File A: start=2, length=3     File B: start=6, length=2
  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
  │ (sys)│ (sys)│File A│File A│File A│ FREE │File B│File B│ FREE │
  │  0   │  1   │  2   │  3   │  4   │  5   │  6   │  7   │  8   │
  └──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘

  Problem: File A wants to grow — but block 5 is the only free
  block next to it, so it can only grow by 1 block!

  External fragmentation: free space is scattered in small gaps.
      `
        },
        {
            id: "linked-files",
            title: "Linked Files",
            content: `What if file blocks don't need to be contiguous? With **linked files**, each block contains the file data AND a pointer to the next block — like a linked list. For each file, we just store the first block number. To read the whole file, follow the chain of pointers from block to block.`,
            keyPoints: [
                "Each block contains file data PLUS a pointer (block number) to the next block",
                "The last block's pointer is set to a special END marker",
                "Metadata needed per file: just the start block number",
                "Advantage: easy to grow files — just append a new block and update the last pointer",
                "Advantage: no external fragmentation — any free block can be used",
                "Disadvantage: random access is slow — must traverse the chain from the beginning",
                "Disadvantage: data blocks are scattered across disk (more seeks on HDDs)",
                "Historical examples: TOPS-10, Xerox Alto"
            ],
            codeExample: {
                title: "Linked file traversal",
                language: "c",
                code: `// Each disk block in a linked file system:
struct linked_block {
    char data[BLOCK_SIZE - sizeof(int)]; // payload (smaller!)
    int  next_block;  // pointer to next block (-1 = END)
};

// To read block N of a file, must traverse the chain:
int get_nth_block(int start_block, int n) {
    int current = start_block;
    for (int i = 0; i < n; i++) {
        // Must read current block just to find next pointer
        struct linked_block blk;
        read_block(current, &blk);
        if (blk.next_block == -1) return -1; // past end
        current = blk.next_block;
    }
    return current;  // found the nth block
}

// Problem: to get block 1000, must read blocks 0-999 first!
// Random access is O(n) instead of O(1).`,
                annotations: [
                    { match: "BLOCK_SIZE - sizeof(int)", explanation: "Each block must sacrifice some bytes for the 'next' pointer. With 512-byte blocks and a 4-byte pointer, only 508 bytes per block are available for actual file data." },
                    { match: "next_block", explanation: "Points to the disk block number of the next block in this file. A value of -1 means this is the last block. This is the 'link' in 'linked files'." },
                    { match: "for (int i = 0; i < n; i++)", explanation: "To reach block N, we must sequentially read blocks 0 through N-1. Each step requires a disk read just to find the next pointer. This is O(n) — very slow for large files." },
                    { match: "read_block(current, &blk)", explanation: "Every step in the chain requires a disk I/O operation. If blocks are scattered across the disk, each read may require an expensive disk seek." }
                ]
            },
            diagram: `
Linked Files Example:

File 0 Start: block 10    File 1 Start: block 12

Disk:
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│  File 0  │  File 2  │  File 1  │  File 2  │  File 0  │  File 2  │
│ Next: 14 │ Next:END │ Next:END │ Next: 15 │ Next:END │ Next: 11 │
│ block 10 │ block 11 │ block 12 │ block 13 │ block 14 │ block 15 │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

File 0 chain: 10 → 14 → END  (2 blocks)
File 1 chain: 12 → END       (1 block)
File 2 chain: 13 → 15 → 11 → END  (3 blocks)
      `
        },
        {
            id: "fat",
            title: "Windows FAT (File Allocation Table)",
            content: `The **File Allocation Table** (FAT) improves on linked files by moving all the "next block" pointers out of the data blocks and into a single table stored in memory. Each entry in the table corresponds to one disk block and says "the next block in this file is block X" (or END). This means data blocks can use their full 512 bytes for data, and traversing the chain is fast because the table is in memory — not on disk.`,
            keyPoints: [
                "FAT = a big array where entry[i] = 'the next block after block i in this file'",
                "The table is stored on disk but cached in memory for fast lookup",
                "Data blocks are now full-sized — no space wasted on pointers inside blocks",
                "Random access is faster than linked files: traverse the table in memory, not on disk",
                "Disadvantage: the table can be large — 1GB disk with 1KB blocks needs ~2.5MB for the table",
                "Disadvantage: file data blocks can still be scattered across disk (fragmentation)",
                "Used in Windows (FAT12, FAT16, FAT32) and still used on USB drives and SD cards"
            ],
            codeExample: {
                title: "FAT table lookup",
                language: "c",
                code: `// The FAT: an array indexed by block number
// fat[i] = next block after block i, or -1 for END
int fat[NUM_BLOCKS];

// To find block N of a file:
int fat_get_block(int start_block, int n) {
    int current = start_block;
    for (int i = 0; i < n; i++) {
        current = fat[current];  // follow chain IN MEMORY
        if (current == -1) return -1;  // past end
    }
    return current;
}

// Example FAT:             File 0: start=10
//   fat[10] = 14           10 → 14 → END (2 blocks)
//   fat[11] = -1 (END)     File 1: start=12
//   fat[12] = -1 (END)     12 → END (1 block)
//   fat[13] = 15           File 2: start=13
//   fat[14] = -1 (END)     13 → 15 → 11 → END (3 blocks)
//   fat[15] = 11
//
// Key: fat[current] is a MEMORY access, not disk I/O!`,
                annotations: [
                    { match: "int fat[NUM_BLOCKS]", explanation: "The FAT is an array with one entry per disk block. For a 1GB disk with 1KB blocks, this is ~1 million entries. Originally 16-bit entries (FAT16), later 32-bit (FAT32)." },
                    { match: "fat[current]", explanation: "The key advantage over linked files: instead of reading a disk block to find the next pointer, we just index into an in-memory array. Memory access is ~100,000x faster than disk." },
                    { match: "current == -1", explanation: "The END marker indicates the last block in a file's chain. In real FAT systems, special values like 0xFFFF (FAT16) or 0x0FFFFFFF (FAT32) are used." }
                ]
            },
            diagram: `
FAT (File Allocation Table) Design:

        In-Memory FAT:        Disk:
        ┌───┬───────┐         ┌──────────┬──────────┬──────────┐
        │ # │ Next  │    ...  │  File 0  │  File 2  │  File 1  │
        ├───┼───────┤         │ (full    │ (full    │ (full    │
        │10 │  14   │ ←──────→│  512B    │  512B    │  512B    │
        │11 │  END  │         │  of data)│  of data)│  of data)│
        │12 │  END  │         │ block 10 │ block 11 │ block 12 │
        │13 │  15   │         ├──────────┼──────────┼──────────┤
        │14 │  END  │         │  File 2  │  File 0  │  File 2  │
        │15 │  11   │         │ block 13 │ block 14 │ block 15 │
        └───┴───────┘         └──────────┴──────────┴──────────┘

  Links are in MEMORY (fast), not in disk blocks.
  Data blocks use full 512 bytes — no space wasted.
      `
        },
        {
            id: "multi-level-indexes",
            title: "Multi-Level Indexes",
            content: `Instead of linking blocks together (whether in-block or in a table), what if we stored an **ordered list of all block numbers** for each file? This is the **indexed** approach. Each file has an index structure that maps logical block numbers (0, 1, 2, ...) directly to physical disk block numbers. This gives us O(1) random access (just look up the block number in the index) while still allowing non-contiguous storage. This is the approach used by Unix V6 and modern Linux filesystems.`,
            keyPoints: [
                "Store an ordered list of block numbers for each file — an 'index'",
                "Block N of the file → look up entry N in the index → get the disk block number",
                "Advantage: O(1) random access — just index into the list, no chain traversal",
                "Advantage: non-contiguous storage — blocks can be anywhere on disk",
                "Challenge: where do we store the index? It needs to be on disk too!",
                "Solution: store the index in a special fixed-size structure called an inode",
                "Used in Unix V6 (1970s), modern Linux (ext4), and tree-based structures in NTFS"
            ],
            diagram: `
Index-Based Approach:

  File's Index (list of block numbers):
  ┌─────┬─────┬─────┬─────┬─────┐
  │  10 │  14 │  22 │   7 │  31 │   ← "Block 0 is at disk block 10"
  │  [0]│  [1]│  [2]│  [3]│  [4]│   ← "Block 1 is at disk block 14"
  └─────┴─────┴─────┴─────┴─────┘      etc.

  To read block 3 of the file:
    1. Look up index[3] → disk block 7
    2. Read disk block 7
    Done! No chain traversal needed.

  vs. Linked approach for block 3:
    1. Read block 10, get next pointer → 14
    2. Read block 14, get next pointer → 22
    3. Read block 22, get next pointer → 7
    4. Read block 7
    Required 4 disk reads instead of 1!
      `
        },
        {
            id: "unix-v6-inodes",
            title: "Unix V6 Inodes",
            content: `The Unix V6 filesystem stores each file's index in a fixed-size structure called an **inode** (short for "index node"). Each inode is exactly **32 bytes** and contains the file's metadata (size, type, permissions) plus an array of **8 block numbers** (\`i_addr[8]\`). For **small files** (up to 8 blocks = 4KB), these 8 entries point directly to the data blocks. For **large files**, the system uses indirect blocks (covered in Lecture 3/4). The inode is the central data structure of the Unix V6 filesystem and the core of assign1.`,
            keyPoints: [
                "An inode ('index node') is a 32-byte structure containing a file's metadata and block list",
                "Each inode has i_addr[8] — room for 8 block numbers",
                "Small files (≤ 8 blocks = 4KB): i_addr entries point directly to data blocks",
                "Large files (> 4KB): i_addr entries point to indirect blocks (covered in Lecture 3)",
                "The i_mode field encodes file type (regular/directory) and whether it's a large file",
                "File size is stored split across two fields: (i_size0 << 16) | i_size1",
                "Inodes do NOT contain filenames — names are stored in directory entries",
                "The mapping is: filename → inode number (inumber) → inode → data blocks"
            ],
            codeExample: {
                title: "The Unix V6 inode structure",
                language: "c",
                code: `/* struct inode — 32 bytes of file metadata (from ino.h) */
struct inode {
    uint16_t  i_mode;     // file type + permissions
    uint8_t   i_nlink;    // number of hard links
    uint8_t   i_uid;      // owner user ID
    uint8_t   i_gid;      // owner group ID
    uint8_t   i_size0;    // high byte of file size
    uint16_t  i_size1;    // low 2 bytes of file size
    uint16_t  i_addr[8];  // 8 block numbers (the index!)
    uint16_t  i_atime[2]; // last access time
    uint16_t  i_mtime[2]; // last modification time
};

// File size = (i_size0 << 16) | i_size1  (24-bit value)
int inode_getsize(struct inode *inp) {
    return (inp->i_size0 << 16) | inp->i_size1;
}

// Mode flags for checking file type:
#define IALLOC  0x8000  // bit 15: inode is allocated (in use)
#define IFDIR   0x4000  // bit 14: this is a directory
#define ILARG   0x1000  // bit 12: large file (indirect blocks)

// Small file: reading block N (where N < 8)
//   disk_block = inode.i_addr[N]
//   Then read that disk block to get file data!`,
                annotations: [
                    { match: "i_mode", explanation: "A 16-bit field combining file type and permissions. Check (i_mode & IALLOC) to see if the inode is in use, (i_mode & IFDIR) for directory, (i_mode & ILARG) for large file." },
                    { match: "i_nlink", explanation: "Link count — how many directory entries point to this inode (hard links). When this reaches 0, the file's blocks can be freed." },
                    { match: "i_size0", explanation: "Most significant 8 bits of file size. Combined with i_size1: (i_size0 << 16) | i_size1. This gives a 24-bit size, max ~16MB." },
                    { match: "i_size1", explanation: "Lower 16 bits of file size. The full size is (i_size0 << 16) | i_size1. The helper inode_getsize() combines them for you." },
                    { match: "i_addr[8]", explanation: "The heart of the inode — 8 block numbers. For SMALL files, these 8 entries point directly to data blocks (up to 8 × 512 = 4KB). For LARGE files, they point to indirect blocks (Lecture 3)." },
                    { match: "IALLOC", explanation: "Bit 15 of i_mode. If set, this inode slot is in use. If not set, the slot is free. Always check this before using an inode!" },
                    { match: "IFDIR", explanation: "Bit 14 of i_mode. If set, this inode represents a directory — its data blocks contain directory entries (struct direntv6), not regular file data." },
                    { match: "ILARG", explanation: "Bit 12 of i_mode. If set, the file uses 'large' addressing: i_addr entries point to indirect blocks instead of data blocks directly. Covered in Lecture 3." },
                    { match: "inode.i_addr[N]", explanation: "For small files, block N of the file is stored at disk block i_addr[N]. This is O(1) random access — just one array lookup!" }
                ]
            },
            diagram: `
Inode Structure (32 bytes):

┌────────────────────────────────────────────┐
│  i_mode  (2B)  │  i_nlink (1B)            │
│  i_uid   (1B)  │  i_gid   (1B)            │
│  i_size0 (1B)  │  i_size1 (2B)            │
│────────────────────────────────────────────│
│  i_addr[0]  → disk block 47               │
│  i_addr[1]  → disk block 51               │
│  i_addr[2]  → disk block 23               │
│  i_addr[3]  → disk block 89               │
│  i_addr[4]  → 0 (unused)                  │
│  i_addr[5]  → 0 (unused)                  │
│  i_addr[6]  → 0 (unused)                  │
│  i_addr[7]  → 0 (unused)                  │
│────────────────────────────────────────────│
│  i_atime (4B)  │  i_mtime (4B)            │
└────────────────────────────────────────────┘

This inode describes a 4-block file (2048 bytes):
  Block 0 → disk block 47
  Block 1 → disk block 51
  Block 2 → disk block 23
  Block 3 → disk block 89
      `
        },
        {
            id: "unix-v6-disk-layout",
            title: "Unix V6 Disk Layout",
            content: `The Unix V6 disk is organized into regions with specific purposes. The first block is the **boot block** (contains the bootloader). The second block is the **superblock** (contains filesystem metadata like total size). Starting at block 2, the **inode table** stores all inodes — each 32 bytes, packed 16 per 512-byte block. After the inode table come the **data blocks**, which store actual file contents and indirect blocks. To find a file, the filesystem translates a filename to an **inode number** (inumber), then uses that to locate the inode in the inode table.`,
            keyPoints: [
                "Block 0: Boot block — contains bootloader code (we ignore this in assign1)",
                "Block 1: Superblock — filesystem parameters (total size, free block info)",
                "Blocks 2+: Inode table — all inodes packed contiguously, 16 per block",
                "Remaining blocks: Data blocks — file contents and indirect blocks",
                "Each inode is 32 bytes → 512 / 32 = 16 inodes per block",
                "Inodes are 1-indexed: inode #1 is the root directory (inode #0 is NULL/invalid)",
                "Formula: inode N is in sector (2 + (N-1)/16), at index ((N-1) % 16)",
                "The superblock's s_isize field tells how many blocks the inode table occupies"
            ],
            codeExample: {
                title: "Locating an inode on disk (inode_iget)",
                language: "c",
                code: `#define INODE_START_SECTOR 2    // inodes start at sector 2
#define INODES_PER_SECTOR 16   // 512 / 32 = 16

// Fetch inode #inumber from disk
int inode_iget(const struct unixfilesystem *fs, int inumber,
        struct inode *inp) {
    // Which sector contains this inode?
    int sector = INODE_START_SECTOR 
               + (inumber - 1) / INODES_PER_SECTOR;
    
    // Read that entire sector (16 inodes)
    struct inode inodes[INODES_PER_SECTOR];
    if (diskimg_readsector(fs->dfd, sector, inodes) 
            != DISKIMG_SECTOR_SIZE) {
        fprintf(stderr, "inode_iget: error reading sector %d\\n",
                sector);
        return -1;
    }
    
    // Extract the specific inode from the sector
    *inp = inodes[(inumber - 1) % INODES_PER_SECTOR];
    return 0;  // success
}

// Examples:
//   inode #1  → sector 2, index 0  (first inode)
//   inode #16 → sector 2, index 15 (last in sector 2)
//   inode #17 → sector 3, index 0  (first in sector 3)
//   inode #50 → sector 5, index 1`,
                annotations: [
                    { match: "INODE_START_SECTOR", explanation: "Inodes begin at sector 2 on disk. Sector 0 is the boot block, sector 1 is the superblock. This constant is defined in unixfilesystem.h." },
                    { match: "INODES_PER_SECTOR", explanation: "Each inode is 32 bytes. A 512-byte sector holds exactly 512/32 = 16 inodes." },
                    { match: "inumber - 1", explanation: "Inodes are 1-indexed (first valid inode = 1, inode 0 = NULL). Subtract 1 to convert to 0-based indexing for the math." },
                    { match: "(inumber - 1) / INODES_PER_SECTOR", explanation: "Integer division gives which sector (relative to the start) contains this inode. E.g., inode 17: (17-1)/16 = 1, so it's in sector 2+1 = 3." },
                    { match: "(inumber - 1) % INODES_PER_SECTOR", explanation: "Modulo gives the index within the sector. E.g., inode 17: (17-1)%16 = 0, so it's the first inode in its sector." },
                    { match: "diskimg_readsector", explanation: "Block layer function that reads a single 512-byte sector from disk. This is the lowest layer — inode_iget builds on it (layering in action!)." },
                    { match: "fprintf(stderr", explanation: "Always print errors to stderr, not stdout. Include context: which function failed, what arguments were used, what went wrong." },
                    { match: "return -1", explanation: "Unix convention: return -1 on error, 0 on success. The caller must check this return value and propagate the error upward." }
                ]
            },
            diagram: `
Unix V6 Disk Layout:

Sector:  0         1          2  3  4  ...        N  N+1  ...
       ┌─────┐  ┌─────────┐  ┌──────────────┐  ┌──────────────┐
       │Boot │  │ Super-  │  │   Inode      │  │    Data      │
       │Block│  │  block  │  │   Table      │  │   Blocks     │
       │     │  │         │  │  (packed     │  │  (file data  │
       │     │  │ s_isize │  │   16 inodes  │  │   + indirect │
       │     │  │ s_fsize │  │   per block) │  │   blocks)    │
       └─────┘  └─────────┘  └──────────────┘  └──────────────┘
       512 B     512 B        s_isize blocks    Rest of disk

Inode numbering (1-indexed!):
  Sector 2: inodes  1-16
  Sector 3: inodes 17-32
  Sector 4: inodes 33-48  ...

    filename → inumber → inode → data blocks
      `
        },
        {
            id: "exam-prep",
            title: "🎯 Midterm Prep: What to Know from Lecture 2",
            content: `Lecture 2 introduces the design space of file storage — the midterm will test your ability to compare allocation methods, perform inode math, and understand the Unix V6 disk layout. Focus on understanding the **trade-offs** between approaches, not just memorizing facts.`,
            keyPoints: [
                "📝 Know the 4 allocation methods: contiguous, linked, FAT, indexed (inodes)",
                "📝 For each method, know: advantages, disadvantages, and how random access works",
                "📝 Contiguous: O(1) access, simple, but external fragmentation + hard to grow",
                "📝 Linked: easy to grow, but O(n) random access + data scattered on disk",
                "📝 FAT: linked but faster (table in memory), still O(n) chain traversal for random access",
                "📝 Indexed (inodes): O(1) random access, non-contiguous, but fixed index size limits file size",
                "📝 Unix V6 inode: 32 bytes, i_addr[8], small files ≤ 4KB direct, large files use indirection",
                "📝 Disk layout: boot(0), super(1), inodes(2+), data blocks",
                "📝 Key formula: sector = 2 + (inumber - 1) / 16, index = (inumber - 1) % 16",
                "📝 File size = (i_size0 << 16) | i_size1 — this is a 24-bit value"
            ],
            diagram: `
Allocation Method Comparison (KNOW THIS FOR THE MIDTERM!):

┌─────────────┬──────────────┬──────────────┬─────────────────┐
│  Method     │ Random Access│ Grow File    │ Key Weakness    │
├─────────────┼──────────────┼──────────────┼─────────────────┤
│ Contiguous  │ O(1) ✓✓✓    │ Hard ✗       │ Ext. fragment.  │
│ Linked      │ O(n) ✗      │ Easy ✓✓✓    │ Slow random     │
│ FAT         │ O(n)* ✓     │ Easy ✓✓✓    │ Table size      │
│ Indexed     │ O(1) ✓✓✓   │ Easy ✓✓     │ Index size      │
│ (inodes)    │              │              │ limits file     │
└─────────────┴──────────────┴──────────────┴─────────────────┘
* FAT traversal is in memory, so O(n) but fast in practice

Key numbers for Unix V6:
  • Block/sector size: 512 bytes
  • Inode size: 32 bytes → 16 inodes/sector
  • i_addr: 8 entries → small file max = 8 × 512 = 4KB
  • Dir entry: 16 bytes (2B inumber + 14B name) → 32/sector
  • Root directory: inode #1 (inode #0 = NULL)
      `
        },
        {
            id: "summary",
            title: "Lecture 2 Summary",
            content: `We explored the fundamental question of how to store files on disk, examining four different approaches. **Contiguous allocation** is simple but fragmentation-prone. **Linked files** solve fragmentation but sacrifice random access. **FAT** moves the links into memory but still has a chain structure. **Indexed allocation** (inodes) gives us the best of both worlds — O(1) random access with non-contiguous storage. The Unix V6 filesystem uses this indexed approach, storing file metadata in 32-byte inodes with an 8-entry block index. Next lecture, we'll see how Unix V6 handles large files (with indirect blocks) and how directories and pathname lookup work.`,
            keyPoints: [
                "Every filesystem must solve: how to track which blocks belong to which file",
                "Contiguous: simple, fast, but fragmentation makes it impractical",
                "Linked: flexible, but random access requires traversing the chain",
                "FAT: moves links to memory table, better performance but table can be large",
                "Indexed (inodes): ordered block list gives O(1) access + non-contiguous storage",
                "Unix V6 uses 32-byte inodes with i_addr[8] for up to 8 direct block pointers",
                "Coming in Lecture 3: indirect blocks for large files, directories, and path lookup"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Allocation Method Comparison",
            difficulty: "easy",
            description: "For each scenario below, identify which file allocation method would be the BEST fit and explain why.",
            hint: "Think about what operations each scenario requires (random access? growing? simplicity?) and which method handles that best.",
            starterCode: `// Scenario 1: A database file that is frequently accessed
// at random positions (reading record #5000, then #12, etc.)
// Best method: ____
// Why: ____

// Scenario 2: A log file that only grows by appending new
// entries to the end (never read randomly, only sequentially)
// Best method: ____
// Why: ____

// Scenario 3: A read-only file on a CD-ROM that will never
// change size after being written
// Best method: ____
// Why: ____

// Scenario 4: An embedded system with very little RAM
// available for filesystem data structures
// Best method: ____
// Why: ____`,
            solution: `// Scenario 1: Database with random access
// Best method: INDEXED (inodes) or CONTIGUOUS
// Why: Both provide O(1) random access. Indexed is better
// if the file might grow; contiguous if size is fixed.

// Scenario 2: Log file (append-only, sequential reads)
// Best method: LINKED
// Why: Easy to grow (just add a new block at the end).
// Random access isn't needed, so linked's O(n) weakness
// doesn't matter. Sequential reading just follows the chain.

// Scenario 3: Read-only file on CD-ROM
// Best method: CONTIGUOUS
// Why: File never changes size, so fragmentation and growth
// aren't issues. Contiguous gives fastest access and
// simplest metadata (just start + length).

// Scenario 4: Embedded system with limited RAM
// Best method: LINKED (avoid FAT — it needs RAM for table)
// Why: FAT requires the entire allocation table in memory.
// Linked files store pointers in the blocks themselves,
// needing no extra memory. Contiguous or indexed also work.`,
            explanation: "Each allocation method has strengths that match different use cases. The key trade-offs are: random access speed (contiguous/indexed win), growth flexibility (linked/FAT win), memory usage (linked wins — no table needed), and simplicity (contiguous wins). Real filesystems often combine approaches."
        },
        {
            id: "ex2",
            title: "Fragmentation Scenarios",
            difficulty: "easy",
            description: "Determine what type of fragmentation occurs in each scenario and whether it could be avoided with a different allocation strategy.",
            hint: "Internal fragmentation = wasted space within allocated blocks. External fragmentation = free space scattered in unusable small chunks.",
            starterCode: `// Scenario A: A 300-byte file stored in a 512-byte block.
// Type of fragmentation: ____
// Wasted space: ____ bytes
// Can this be avoided? ____

// Scenario B: Three files deleted from a contiguous disk,
// leaving three separate 1-block gaps between other files.
// A new 3-block file cannot be allocated contiguously.
// Type of fragmentation: ____
// Can this be avoided? ____

// Scenario C: A disk using 4KB blocks stores many files
// that average 1KB each.
// Type of fragmentation: ____
// Average waste per file: ____ bytes`,
            solution: `// Scenario A: 300-byte file in 512-byte block
// Type: INTERNAL fragmentation
// Wasted space: 512 - 300 = 212 bytes
// Can this be avoided? Only by using smaller blocks,
// but smaller blocks increase metadata overhead.

// Scenario B: Three gaps after deletion
// Type: EXTERNAL fragmentation
// Can this be avoided? YES — use non-contiguous allocation
// (linked, FAT, or indexed). With linked or indexed storage,
// the new file can use the 3 scattered free blocks.

// Scenario C: 4KB blocks for 1KB files
// Type: INTERNAL fragmentation
// Average waste per file: 4096 - 1024 = 3072 bytes (75%!)
// This is why block size is a trade-off: larger blocks are
// more efficient for I/O but waste more space on small files.`,
            explanation: "Internal fragmentation wastes space within allocated blocks (unavoidable with fixed-size blocks). External fragmentation makes free space unusable because it's split into small non-adjacent pieces — this is the main problem with contiguous allocation and is solved by non-contiguous approaches like linked or indexed allocation."
        },
        {
            id: "ex3",
            title: "FAT Table Traversal",
            difficulty: "medium",
            description: "Given the FAT table below, trace the block chains for each file and answer the questions.",
            hint: "Start at the file's start block, then follow fat[current] repeatedly until you hit END (-1).",
            starterCode: `// FAT Table:
//   fat[20] = 24      fat[25] = -1 (END)
//   fat[21] = 23      fat[26] = 28
//   fat[22] = -1       fat[27] = 22
//   fat[23] = 25      fat[28] = -1 (END)
//   fat[24] = -1 (END)

// File A starts at block 20
// File B starts at block 21
// File C starts at block 26

// Q1: What is File A's block chain?
//     20 → ____ → ____ (how many blocks?)

// Q2: What is File B's block chain?
//     21 → ____ → ____ → ____ (how many blocks?)

// Q3: What is File C's block chain?
//     26 → ____ → ____ → ____ (how many blocks?)

// Q4: What disk block holds byte 600 of File B?
//     (hint: 512 bytes per block)
//     Block index = 600 / 512 = ____
//     Disk block = ____`,
            solution: `// FAT Table:
//   fat[20] = 24      fat[25] = -1 (END)
//   fat[21] = 23      fat[26] = 28
//   fat[22] = -1       fat[27] = 22
//   fat[23] = 25      fat[28] = -1 (END)
//   fat[24] = -1 (END)

// Q1: File A's block chain:
//     20 → 24 → END  (2 blocks)
//     fat[20]=24, fat[24]=END

// Q2: File B's block chain:
//     21 → 23 → 25 → END  (3 blocks)
//     fat[21]=23, fat[23]=25, fat[25]=END

// Q3: File C's block chain:
//     26 → 28 → END  (2 blocks)
//     fat[26]=28, fat[28]=END
//     Note: blocks 27 and 22 are NOT part of File C!

// Q4: Byte 600 of File B:
//     Block index = 600 / 512 = 1 (integer division)
//     Start at 21, follow 1 link: fat[21] = 23
//     Disk block = 23
//     Byte offset within block = 600 % 512 = 88`,
            explanation: "FAT traversal is like following a linked list, but the 'pointers' are in a table instead of in the data blocks. To find block N, start at the file's start block and follow N links. Each fat[x] = y means 'after block x comes block y'. Note that stray entries in the FAT (like fat[27]=22) might belong to other files — always start from the file's known start block."
        },
        {
            id: "ex4",
            title: "Inode Sector Calculation",
            difficulty: "easy",
            description: "Practice the fundamental inode location formula that you'll use throughout assign1.",
            hint: "Formula: sector = 2 + (inumber - 1) / 16, index = (inumber - 1) % 16. Remember that inodes are 1-indexed!",
            starterCode: `#define INODE_START_SECTOR 2
#define INODES_PER_SECTOR 16  // 512 / 32 = 16

// For each inode number, calculate:
//   (a) which disk sector contains it
//   (b) which index within that sector

// Inode #1 (root directory):
//   sector = 2 + (1-1)/16 = 2 + 0 = ____
//   index  = (1-1) % 16 = ____

// Inode #16:
//   sector = 2 + (16-1)/16 = 2 + ____ = ____
//   index  = (16-1) % 16 = ____

// Inode #17:
//   sector = 2 + (17-1)/16 = 2 + ____ = ____
//   index  = (17-1) % 16 = ____

// Inode #33:
//   sector = ____
//   index  = ____

// BONUS: If the inode table has 10 sectors, what is the
// maximum number of inodes the filesystem can have?
// Answer: ____`,
            solution: `#define INODE_START_SECTOR 2
#define INODES_PER_SECTOR 16

// Inode #1 (root directory):
//   sector = 2 + 0/16 = 2 + 0 = 2
//   index  = 0 % 16 = 0
//   (first inode in the first inode sector)

// Inode #16:
//   sector = 2 + 15/16 = 2 + 0 = 2
//   index  = 15 % 16 = 15
//   (LAST inode in sector 2 — still fits!)

// Inode #17:
//   sector = 2 + 16/16 = 2 + 1 = 3
//   index  = 16 % 16 = 0
//   (FIRST inode in sector 3)

// Inode #33:
//   sector = 2 + 32/16 = 2 + 2 = 4
//   index  = 32 % 16 = 0
//   (first inode in sector 4)

// BONUS: 10 sectors × 16 inodes/sector = 160 inodes max
// (inumbers 1 through 160)`,
            explanation: "This formula is used in inode_iget() and is fundamental to assign1. The key insight is that inodes are 1-indexed (inode #1 is the root directory, inode #0 is invalid/NULL), so we always subtract 1 before doing the division and modulo."
        },
        {
            id: "ex5",
            title: "Reading Inode Mode Flags",
            difficulty: "medium",
            description: "Given i_mode values, determine the type and properties of each file using bitwise AND.",
            hint: "IALLOC (0x8000) = allocated, IFDIR (0x4000) = directory, ILARG (0x1000) = large file. Use (i_mode & FLAG) != 0 to check.",
            starterCode: `#define IALLOC  0x8000  // bit 15
#define IFDIR   0x4000  // bit 14
#define ILARG   0x1000  // bit 12

// For each i_mode value, determine:
//   Allocated? Directory? Large file?

// i_mode = 0xC1FF
//   IALLOC: (0xC1FF & 0x8000) = ____ → ____
//   IFDIR:  (0xC1FF & 0x4000) = ____ → ____
//   ILARG:  (0xC1FF & 0x1000) = ____ → ____
//   This is a: ____

// i_mode = 0x81FF
//   Allocated? ____
//   Directory? ____
//   Large?     ____
//   This is a: ____

// i_mode = 0x0000
//   Allocated? ____
//   This means: ____`,
            solution: `#define IALLOC  0x8000
#define IFDIR   0x4000
#define ILARG   0x1000

// i_mode = 0xC1FF
//   IALLOC: (0xC1FF & 0x8000) = 0x8000 → YES
//   IFDIR:  (0xC1FF & 0x4000) = 0x4000 → YES
//   ILARG:  (0xC1FF & 0x1000) = 0x1000 → YES
//   This is: an allocated DIRECTORY using large addressing

// i_mode = 0x81FF
//   IALLOC: YES (0x81FF & 0x8000 = 0x8000)
//   IFDIR:  NO  (0x81FF & 0x4000 = 0x0000)
//   ILARG:  NO  (0x81FF & 0x1000 = 0x0000)
//   This is: an allocated SMALL REGULAR FILE
//   (i_addr points directly to data blocks)

// i_mode = 0x0000
//   IALLOC: NO (0x0000 & 0x8000 = 0x0000)
//   This is: a FREE inode slot (not in use)
//   (should be skipped when traversing inodes)`,
            explanation: "Bitwise AND (&) with a flag constant extracts just that bit. If non-zero, the flag is set. These checks are essential in assign1: you need to check IALLOC before using an inode, IFDIR to know if it's a directory, and ILARG to know whether i_addr contains direct block numbers or indirect block numbers."
        },
        {
            id: "ex6",
            title: "Small File Block Lookup",
            difficulty: "medium",
            description: "Walk through the process of reading a specific byte from a small file, starting from the inode.",
            hint: "Steps: (1) get the inode, (2) calculate which block index the byte is in, (3) look up i_addr[block_index] to get the disk block, (4) calculate the offset within that block.",
            starterCode: `// Given this inode for a small file:
//   i_mode  = 0x81FF (allocated, regular, small)
//   i_size0 = 0x00
//   i_size1 = 0x0500  (file size = ____ bytes)
//   i_addr  = [47, 51, 23, 0, 0, 0, 0, 0]

// Q1: What is the file size in bytes?
//     (i_size0 << 16) | i_size1 = ____

// Q2: How many blocks does this file occupy?
//     numBlocks = (size + 511) / 512 = ____

// Q3: To read byte 600 of this file:
//     block_index = 600 / 512 = ____
//     disk_block  = i_addr[____] = ____
//     offset_in_block = 600 % 512 = ____
//     → Read disk block ____, byte ____

// Q4: To read byte 1500:
//     block_index = ____
//     Is this valid? (compare to file size) ____`,
            solution: `// Q1: File size:
//     (0x00 << 16) | 0x0500 = 0x0500 = 1280 bytes

// Q2: Number of blocks:
//     numBlocks = (1280 + 511) / 512 = 1791 / 512 = 3
//     (3 blocks × 512 = 1536 bytes allocated, last block
//      is only partially filled: 1280 - 1024 = 256 bytes)

// Q3: Reading byte 600:
//     block_index = 600 / 512 = 1  (second block)
//     disk_block  = i_addr[1] = 51
//     offset_in_block = 600 % 512 = 88
//     → Read disk block 51, byte 88

// Q4: Reading byte 1500:
//     block_index = 1500 / 512 = 2
//     Is this valid? YES (1500 < 1280? NO — INVALID!)
//     Byte 1500 is past the end of the file (size 1280).
//     file_getblock should return -1 (error).
//     Even though i_addr[2]=23 exists, the byte is invalid!`,
            explanation: "This exercise traces the full path from inode to data, which is exactly what file_getblock does in assign1. Key points: (1) always check if the byte offset is within the file size, (2) use integer division for block index and modulo for offset within block, (3) the disk block number comes from i_addr[block_index] for small files."
        }
    ]
};

export default lecture2;
