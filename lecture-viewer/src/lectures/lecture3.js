export const lecture3 = {
    id: 3,
    title: "Unix V6 Filesystem",
    subtitle: "Inodes, Block Addressing, and the Small/Large File Scheme",
    keyTakeaway: "Unix V6 uses inodes with an 8-entry address array to map files to disk blocks. The ILARG flag in i_mode determines whether addresses point directly to data (small files, up to 4KB) or to indirect blocks containing more addresses (large files, up to 1MB+). This is the foundation of Assign1.",

    sections: [
        {
            id: "recap",
            title: "Recap: Why Multi-Level Indexes?",
            content: `Last lecture we compared four allocation strategies. Unix V6 uses **multi-level indexes** because they provide O(1) random access and handle files of any size. The key data structure is the **inode** — a 32-byte record storing all metadata about a file, including an array of 8 block numbers.`,
            keyPoints: [
                "Multi-level indexes: best random access + flexible file sizes",
                "Each file has exactly one inode (stored on disk)",
                "Inode number (inumber) uniquely identifies each file",
                "16 inodes fit per 512-byte block (512/32 = 16)",
                "Inodes are stored contiguously starting at block 2"
            ]
        },
        {
            id: "inode-structure",
            title: "The Inode Structure",
            content: `Every file and directory in Unix V6 has an **inode** — a 32-byte structure containing the file's metadata. The most important field is \`i_addr[8]\`, which stores 8 block numbers. How these are interpreted depends on the **ILARG** flag in \`i_mode\`.`,
            keyPoints: [
                "i_mode: file type (regular, directory) + permissions + ILARG flag",
                "i_nlink: number of hard links (directory entries pointing to this inode)",
                "i_uid, i_gid: owner and group",
                "i_size0 + i_size1: 24-bit file size (max ~16MB)",
                "i_addr[8]: THE key field — 8 block numbers",
                "i_atime, i_mtime: access and modification timestamps",
                "📝 EXAM: You MUST know this structure cold"
            ],
            codeExample: {
                title: "The Unix V6 inode (32 bytes)",
                language: "c",
                code: `struct inode {
    uint16_t i_mode;       // Type + permissions + ILARG flag
    uint8_t  i_nlink;      // Number of hard links
    uint8_t  i_uid;        // Owner user ID
    uint8_t  i_gid;        // Owner group ID
    uint8_t  i_size0;      // High byte of file size
    uint16_t i_size1;      // Low 2 bytes of file size
    uint16_t i_addr[8];    // 8 block numbers
    uint16_t i_atime[2];   // Last access time
    uint16_t i_mtime[2];   // Last modification time
};
// Total: 2+1+1+1+1+2+16+4+4 = 32 bytes
// 16 inodes per 512-byte block

// Computing file size from split fields:
int filesize = (inp->i_size0 << 16) | inp->i_size1;

// Checking ILARG flag:
#define ILARG 0x1000
bool is_large = (inp->i_mode & ILARG) != 0;`,
                annotations: [
                    { match: "i_mode", explanation: "Bit field: bits 15-14 = file type (10=regular, 01=directory), bits 11-0 include permissions AND the ILARG flag at bit 12." },
                    { match: "i_addr[8]", explanation: "The heart of the filesystem. 8 two-byte block numbers. If ILARG is clear, these point directly to data blocks. If ILARG is set, they point to indirect blocks." },
                    { match: "i_size0", explanation: "Upper 8 bits of the 24-bit file size. Must combine with i_size1: size = (i_size0 << 16) | i_size1." },
                    { match: "i_size1", explanation: "Lower 16 bits of the file size. Split across two fields because 1975 PDP-11 had 16-bit registers." },
                    { match: "ILARG", explanation: "The ILARG flag (bit 12 of i_mode). This single bit completely changes how i_addr[] is interpreted. CLEAR = small file (direct), SET = large file (indirect)." }
                ]
            }
        },
        {
            id: "finding-inodes",
            title: "Finding an Inode on Disk",
            content: `Given an inode number (inumber), you need to compute which disk block contains it and where within that block it sits. Since inodes are 32 bytes each and 16 fit per block, this is straightforward arithmetic. This is exactly what \`inode_iget()\` does in Assign1.`,
            keyPoints: [
                "Inodes start at block 2 (INODE_START_SECTOR)",
                "16 inodes per block (BLOCK_SIZE / INODE_SIZE = 512/32)",
                "Block number = INODE_START_SECTOR + (inumber - 1) / 16",
                "Offset within block = ((inumber - 1) % 16) * 32",
                "Inumber 1 is the root directory (inumber 0 is unused)",
                "📝 EXAM: Be ready to compute block/offset for any inumber"
            ],
            codeExample: {
                title: "inode_iget — fetch an inode from disk (Assign1 Layer 2)",
                language: "c",
                code: `#define INODE_START_SECTOR 2
#define INODES_PER_BLOCK 16  // 512 / 32
#define INODE_SIZE 32

int inode_iget(const struct unixfilesystem *fs, int inumber,
               struct inode *inp) {
    // Which block contains this inode?
    int block = INODE_START_SECTOR + (inumber - 1) / INODES_PER_BLOCK;
    
    // Where within the block?
    int offset = ((inumber - 1) % INODES_PER_BLOCK) * INODE_SIZE;
    
    // Read the block from disk
    char buf[DISKIMG_SECTOR_SIZE];
    diskimg_readsector(fs->dfd, block, buf);
    
    // Copy the inode out
    memcpy(inp, buf + offset, sizeof(struct inode));
    return 0;
}

// Example: inumber = 35
// block = 2 + (35-1)/16 = 2 + 2 = 4
// offset = ((35-1) % 16) * 32 = (2) * 32 = 64`,
                annotations: [
                    { match: "(inumber - 1)", explanation: "Inumbers are 1-indexed (inumber 0 is unused, inumber 1 is root). We subtract 1 to convert to 0-indexed for the division." },
                    { match: "INODES_PER_BLOCK", explanation: "512 bytes per block / 32 bytes per inode = 16 inodes per block." },
                    { match: "offset", explanation: "Byte offset within the block. The modulo gives us which inode within the block (0-15), then multiply by 32 to get the byte offset." },
                    { match: "memcpy", explanation: "Copy the 32-byte inode from the raw block buffer into the output struct. This is the standard way to extract a struct from a byte buffer in C." }
                ]
            }
        },
        {
            id: "small-files",
            title: "Small File Mode (ILARG = 0)",
            content: `When the ILARG flag is **not set**, the file is in **small file mode**. Each entry in \`i_addr[]\` is a **direct pointer** — it directly contains the block number of a data block. With 8 entries pointing to 512-byte blocks, small files can be at most **4,096 bytes (4KB)**.`,
            keyPoints: [
                "ILARG bit is CLEAR (0) in i_mode",
                "i_addr[0] through i_addr[7] point directly to data blocks",
                "Block index N → disk block i_addr[N]",
                "Maximum file size: 8 × 512 = 4,096 bytes (4KB)",
                "Very efficient for small files — single lookup, no indirection",
                "Most files on a typical system are small → this is the common case"
            ],
            diagram: `
Small File Mode (ILARG = 0):

  Inode (i_addr[])              Data Blocks
┌──────────────┐
│ i_addr[0]: 20│──────────────► Block 20: [file data bytes 0-511]
│ i_addr[1]: 45│──────────────► Block 45: [file data bytes 512-1023]
│ i_addr[2]: 12│──────────────► Block 12: [file data bytes 1024-1535]
│ i_addr[3]:  0│  (unused - file is only 1500 bytes)
│ i_addr[4]:  0│
│ i_addr[5]:  0│
│ i_addr[6]:  0│
│ i_addr[7]:  0│
└──────────────┘

To find block for byte offset B:
  blockIndex = B / 512
  diskBlock  = i_addr[blockIndex]

Example: byte 600 → blockIndex = 600/512 = 1 → disk block 45
      `,
            codeExample: {
                title: "Looking up a block in a small file",
                language: "c",
                code: `// For a SMALL file (ILARG not set):
int lookup_small(const struct unixfilesystem *fs,
                 const struct inode *inp, int blockIndex) {
    // Direct lookup — i_addr[blockIndex] IS the disk block number
    if (blockIndex < 0 || blockIndex >= 8) {
        return -1;  // Out of range for small file
    }
    return inp->i_addr[blockIndex];
}

// Example: file is 1500 bytes, reading byte 700
// blockIndex = 700 / 512 = 1
// diskBlock = inp->i_addr[1]   ← direct!`,
                annotations: [
                    { match: "blockIndex", explanation: "The logical block number within the file (0=first 512 bytes, 1=next 512, etc.). For small files, this maps directly to i_addr[blockIndex]." },
                    { match: "blockIndex >= 8", explanation: "Small files can have at most 8 blocks (0-7). If the block index is 8+, the file can't be this large in small mode." },
                    { match: "i_addr[blockIndex]", explanation: "The beauty of small file mode: ONE array lookup gives the disk block number. O(1) with a tiny constant factor." }
                ]
            }
        },
        {
            id: "large-files",
            title: "Large File Mode (ILARG = 1)",
            content: `When the ILARG flag IS set, the file is in **large file mode**. Now \`i_addr[]\` entries point to **indirect blocks** — blocks that themselves contain an array of 256 block numbers (512 bytes / 2 bytes per number = 256). The first 7 entries (\`i_addr[0]\` through \`i_addr[6]\`) use **singly-indirect** addressing. The 8th entry (\`i_addr[7]\`) uses **doubly-indirect** addressing.`,
            keyPoints: [
                "ILARG bit is SET (1) in i_mode",
                "i_addr[0..6]: singly-indirect (point to blocks of 256 block numbers)",
                "Each indirect block holds 256 block numbers → 256 × 512 = 128KB per entry",
                "i_addr[7]: doubly-indirect (points to a block of 256 indirect block numbers)",
                "Singly-indirect max: 7 × 256 × 512 = 917,504 bytes",
                "Doubly-indirect adds: 256 × 256 × 512 = 33,554,432 bytes",
                "Two levels of lookup for singly-indirect, three for doubly-indirect"
            ],
            diagram: `
Large File Mode (ILARG = 1):

Singly-Indirect (i_addr[0] through i_addr[6]):

  Inode                  Indirect Block              Data Blocks
┌──────────┐           ┌──────────────┐
│i_addr[0]│──────────►│ [blk#, blk#, │───────────► Data blocks
│          │           │  blk#, ...   │             (up to 256)
│          │           │  256 entries]│
│          │           └──────────────┘
│i_addr[1]│──────────► another indirect block ───► 256 more data blocks
│  ...     │
│i_addr[6]│──────────► another indirect block ───► 256 more data blocks

Doubly-Indirect (i_addr[7]):

  Inode          2nd-Level Indirect    1st-Level Indirects     Data
┌──────────┐   ┌──────────────┐     ┌──────────────┐
│i_addr[7]│──►│ [ptr, ptr,   │──►  │ [blk#, blk#, │───► Data
│          │   │  ptr, ...   │     │  256 entries] │
│          │   │  256 ptrs]  │     └──────────────┘
│          │   └──────────────┘──►  another 1st-level ───► Data
│          │                   ──►  ... (up to 256)  ───► Data
      `,
            codeExample: {
                title: "inode_indexlookup — mapping block index to disk block (Assign1)",
                language: "c",
                code: `#define BLOCK_SIZE 512
#define ADDRS_PER_BLOCK 256  // 512 / sizeof(uint16_t)
#define ILARG 0x1000

int inode_indexlookup(const struct unixfilesystem *fs,
                      const struct inode *inp, int blockIndex) {
    if (!(inp->i_mode & ILARG)) {
        // SMALL file: direct lookup
        return inp->i_addr[blockIndex];
    }
    
    // LARGE file: indirect lookup
    if (blockIndex < 7 * ADDRS_PER_BLOCK) {
        // Singly-indirect: i_addr[0] through i_addr[6]
        int addrIndex = blockIndex / ADDRS_PER_BLOCK;
        int offset = blockIndex % ADDRS_PER_BLOCK;
        
        // Read the indirect block
        uint16_t indirectBlock[ADDRS_PER_BLOCK];
        diskimg_readsector(fs->dfd, inp->i_addr[addrIndex],
                          indirectBlock);
        return indirectBlock[offset];
    } else {
        // Doubly-indirect: i_addr[7]
        int remaining = blockIndex - 7 * ADDRS_PER_BLOCK;
        int l1_index = remaining / ADDRS_PER_BLOCK;
        int l2_index = remaining % ADDRS_PER_BLOCK;
        
        // Read doubly-indirect block
        uint16_t doublyBlock[ADDRS_PER_BLOCK];
        diskimg_readsector(fs->dfd, inp->i_addr[7], doublyBlock);
        
        // Read singly-indirect block
        uint16_t singlyBlock[ADDRS_PER_BLOCK];
        diskimg_readsector(fs->dfd, doublyBlock[l1_index],
                          singlyBlock);
        return singlyBlock[l2_index];
    }
}`,
                annotations: [
                    { match: "ADDRS_PER_BLOCK", explanation: "512 bytes / 2 bytes per uint16_t = 256 block numbers fit in one indirect block." },
                    { match: "!(inp->i_mode & ILARG)", explanation: "Check the ILARG flag. If clear, this is a small file — use direct addressing. If set, use indirect addressing." },
                    { match: "7 * ADDRS_PER_BLOCK", explanation: "The first 7 i_addr entries each cover 256 blocks. So block indices 0 to 7×256-1 = 1791 use singly-indirect addressing." },
                    { match: "addrIndex = blockIndex / ADDRS_PER_BLOCK", explanation: "Which of the 7 singly-indirect entries (i_addr[0..6]) covers this block index." },
                    { match: "offset = blockIndex % ADDRS_PER_BLOCK", explanation: "Which entry within that indirect block. We read the indirect block and index into it." },
                    { match: "remaining = blockIndex - 7 * ADDRS_PER_BLOCK", explanation: "For the doubly-indirect portion, subtract out the blocks covered by singly-indirect entries." },
                    { match: "doublyBlock[l1_index]", explanation: "Two-level lookup: first read the doubly-indirect block to find which singly-indirect block to read, then read that to find the data block." }
                ]
            }
        },
        {
            id: "size-calculations",
            title: "File Size Calculations",
            content: `A critical skill for the midterm: computing maximum file sizes for each addressing mode. These calculations follow directly from the number of block numbers at each level of indirection.`,
            keyPoints: [
                "Small file max: 8 × 512 = 4,096 bytes (4KB)",
                "Singly-indirect (one entry): 256 × 512 = 131,072 bytes (128KB)",
                "All 7 singly-indirect entries: 7 × 128KB = 896KB",
                "Doubly-indirect: 256 × 256 × 512 = 33,554,432 bytes (32MB)",
                "Total large file max: 896KB + 32MB ≈ 33MB",
                "📝 EXAM: Be able to compute max file size given block size and addr array size"
            ],
            diagram: `
Maximum File Size Calculations:

SMALL MODE (ILARG = 0):
  8 direct entries × 512 bytes/block = 4,096 bytes = 4KB

LARGE MODE (ILARG = 1):
  Singly-indirect (i_addr[0..6]):
    7 entries × 256 blocks/entry × 512 bytes/block
    = 7 × 131,072 = 917,504 bytes ≈ 896KB

  Doubly-indirect (i_addr[7]):
    1 × 256 indirect × 256 blocks × 512 bytes
    = 1 × 256 × 131,072 = 33,554,432 bytes = 32MB

  TOTAL LARGE MODE MAX = 896KB + 32MB ≈ 33.9MB

Key formula: blocks_at_level_N = (ADDRS_PER_BLOCK)^N
  Direct:           1 block per entry
  Singly-indirect:  256 blocks per entry  
  Doubly-indirect:  256² = 65,536 blocks per entry
      `
        },
        {
            id: "directories",
            title: "Directories in Unix V6",
            content: `A **directory** is just a special file whose data blocks contain an array of **directory entries** (\`direntv6\`). Each entry is 16 bytes: a 2-byte inode number followed by a 14-byte filename. To find a file, read the directory's blocks and search for a matching name. This is what \`directory_findname()\` does in Assign1.`,
            keyPoints: [
                "Directory = regular file with special contents",
                "Each entry: 2-byte inumber + 14-byte name = 16 bytes",
                "32 entries per 512-byte block (512/16 = 32)",
                "Entry with inumber = 0 means unused/deleted",
                "'.' points to self, '..' points to parent",
                "Filenames are NOT null-terminated if exactly 14 chars"
            ],
            codeExample: {
                title: "Directory entries and directory_findname (Assign1 Layer 4)",
                language: "c",
                code: `struct direntv6 {
    uint16_t d_inumber;     // Inode number (0 = unused)
    char     d_name[14];    // Filename (NOT always null-terminated!)
};
// sizeof(direntv6) = 16 bytes
// 32 entries per block (512 / 16)

int directory_findname(const struct unixfilesystem *fs,
                       const char *name, int dirinumber,
                       struct direntv6 *dirEnt) {
    struct inode dirInode;
    inode_iget(fs, dirinumber, &dirInode);
    
    int numBlocks = (filesize(&dirInode) + BLOCK_SIZE - 1) / BLOCK_SIZE;
    
    for (int b = 0; b < numBlocks; b++) {
        struct direntv6 entries[32];
        file_getblock(fs, dirinumber, b, entries);
        
        for (int i = 0; i < 32; i++) {
            if (entries[i].d_inumber != 0 &&
                strncmp(entries[i].d_name, name, 14) == 0) {
                *dirEnt = entries[i];
                return 0;  // Found!
            }
        }
    }
    return -1;  // Not found
}`,
                annotations: [
                    { match: "d_inumber", explanation: "The inode number this entry refers to. If 0, the entry is unused (file was deleted)." },
                    { match: "d_name[14]", explanation: "The filename, up to 14 characters. WARNING: if the name is exactly 14 chars, there is NO null terminator! Always use strncmp, not strcmp." },
                    { match: "strncmp", explanation: "MUST use strncmp (not strcmp) because d_name may not be null-terminated. Compare at most 14 characters." },
                    { match: "file_getblock", explanation: "Uses the file layer to read block b of the directory. The file layer handles small vs. large mode transparently." }
                ]
            }
        },
        {
            id: "pathname-lookup",
            title: "Path Resolution: pathname_lookup",
            content: `The top layer resolves a full path like \`/home/user/file.txt\` to an inode number. It splits the path into components and calls \`directory_findname()\` repeatedly, starting from the root directory (inode 1).`,
            keyPoints: [
                "Start at root directory (inumber = 1, always)",
                "Split path by '/' and process each component",
                "For each component, call directory_findname on current directory",
                "The result's inumber becomes the next directory to search",
                "Final component's inumber is the answer",
                "📝 EXAM: Trace through pathname_lookup step by step"
            ],
            codeExample: {
                title: "pathname_lookup — resolving a full path (Assign1 Layer 5)",
                language: "c",
                code: `int pathname_lookup(const struct unixfilesystem *fs,
                    const char *pathname) {
    // Always start at root directory (inode 1)
    int current_inumber = ROOT_INUMBER;  // = 1
    
    // Skip leading '/'
    // Then for each component between '/' separators:
    //   e.g., "/home/user/file.txt" → "home", "user", "file.txt"
    
    char *token = first_component(pathname);
    while (token != NULL) {
        struct direntv6 dirEnt;
        int err = directory_findname(fs, token,
                                     current_inumber, &dirEnt);
        if (err < 0) return -1;
        
        current_inumber = dirEnt.d_inumber;
        token = next_component(token);
    }
    
    return current_inumber;
}

// Example: pathname_lookup(fs, "/home/user/file.txt")
// 1. Start: current = 1 (root)
// 2. Find "home" in inode 1  → inumber 5
// 3. Find "user" in inode 5  → inumber 23
// 4. Find "file.txt" in inode 23 → inumber 42
// Result: 42`,
                annotations: [
                    { match: "ROOT_INUMBER", explanation: "Always 1 in Unix V6. The root directory '/' is always inode number 1." },
                    { match: "directory_findname", explanation: "Searches one directory for a name. Returns the matching entry including its inumber." },
                    { match: "current_inumber = dirEnt.d_inumber", explanation: "Each component lookup gives us the inumber of the next directory (or the final file)." }
                ]
            }
        },
        {
            id: "exam-prep",
            title: "🎯 Midterm Prep: Unix V6 Filesystem",
            content: `The Unix V6 filesystem is heavily tested on the midterm. You need to be able to trace through inode lookups, compute maximum file sizes, understand directory entries, and explain the difference between small and large file modes.`,
            keyPoints: [
                "📝 Given an inumber, compute which disk block contains the inode",
                "📝 Given a block index, trace through small vs. large file addressing",
                "📝 Compute max file size for small mode, singly-indirect, doubly-indirect",
                "📝 Explain what ILARG flag does and how it changes i_addr interpretation",
                "📝 Trace a pathname lookup through multiple directories",
                "📝 Know directory entry format: d_inumber (2 bytes) + d_name (14 bytes)",
                "📝 Understand strncmp vs strcmp for directory name comparison",
                "📝 All of Assign1 implements these layers — review your code!"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Inode Location Calculation",
            difficulty: "easy",
            description: "Calculate the disk block and byte offset for inode number 50. Inodes start at block 2, each is 32 bytes, and blocks are 512 bytes.",
            hint: "block = 2 + (inumber-1)/16, offset = ((inumber-1)%16) * 32",
            starterCode: `// Given: inumber = 50
int block = ____;
int offset = ____;`,
            solution: `// Given: inumber = 50
int block = 2 + (50 - 1) / 16;
// = 2 + 49/16 = 2 + 3 = 5

int offset = ((50 - 1) % 16) * 32;
// = (49 % 16) * 32 = 1 * 32 = 32`,
            explanation: "Inode 50 is 0-indexed as the 49th inode. 49/16 = 3 full blocks, so it's in block 2+3=5. 49%16 = 1, so it's the 2nd inode in that block, at byte offset 32."
        },
        {
            id: "ex2",
            title: "Small vs. Large File Mode",
            difficulty: "medium",
            description: "A file is 3,000 bytes. Should it use small or large file mode? How many blocks does it need? Which i_addr entries would be used?",
            hint: "Small mode supports up to 8 × 512 = 4096 bytes.",
            starterCode: `int file_size = 3000;
// Mode (small or large): ____
// Number of blocks: ____
// i_addr entries used: ____`,
            solution: `int file_size = 3000;
// Mode: SMALL (3000 < 4096 = 8 * 512)
// Number of blocks: ceil(3000/512) = 6 blocks
// i_addr entries used: i_addr[0] through i_addr[5]
// i_addr[6] and i_addr[7] would be 0 (unused)`,
            explanation: "3,000 bytes fits in small file mode (max 4KB). It needs 6 blocks. Each i_addr entry directly points to a data block."
        },
        {
            id: "ex3",
            title: "Singly-Indirect Block Lookup",
            difficulty: "medium",
            description: "A large file needs block index 300. Which i_addr entry is used? What's the offset within that indirect block? (Each indirect block holds 256 entries)",
            hint: "i_addr index = blockIndex / 256, offset = blockIndex % 256",
            starterCode: `int blockIndex = 300;
int addrIndex = ____;   // Which i_addr entry?
int offset = ____;      // Offset within indirect block?`,
            solution: `int blockIndex = 300;
int addrIndex = 300 / 256;  // = 1 → i_addr[1]
int offset = 300 % 256;     // = 44 → entry 44 in the indirect block

// Steps:
// 1. Read i_addr[1] to get indirect block number
// 2. Read that indirect block from disk
// 3. Entry 44 in that block gives the data block number`,
            explanation: "Block 300 falls in the range of i_addr[1] (covers blocks 256-511). Within that indirect block, it's at position 44. Two disk reads: one for the indirect block, one for the data."
        },
        {
            id: "ex4",
            title: "Doubly-Indirect Block Lookup",
            difficulty: "hard",
            description: "A large file needs block index 2000. Show this requires doubly-indirect addressing (i_addr[7]) and trace the full lookup path.",
            hint: "Singly-indirect covers blocks 0 to 7*256-1 = 1791. Anything >= 1792 uses i_addr[7].",
            starterCode: `int blockIndex = 2000;
// Is this singly or doubly indirect?
// _____

int remaining = ____;   // Subtract singly-indirect range
int l1_index = ____;    // Index into doubly-indirect block
int l2_index = ____;    // Index into singly-indirect block`,
            solution: `int blockIndex = 2000;
// 2000 >= 7 * 256 (1792), so DOUBLY-INDIRECT (i_addr[7])

int remaining = 2000 - 7 * 256;  // = 2000 - 1792 = 208
int l1_index = 208 / 256;        // = 0 (first indirect block)
int l2_index = 208 % 256;        // = 208

// Full lookup:
// 1. Read i_addr[7] → get doubly-indirect block number
// 2. Read doubly-indirect block, entry [0] → singly-indirect block
// 3. Read singly-indirect block, entry [208] → data block number
// Total: 3 disk reads before reading the actual data!`,
            explanation: "Block 2000 exceeds the singly-indirect range (0-1791), so it uses the doubly-indirect entry i_addr[7]. Three levels of indirection means three disk reads to find the data block."
        },
        {
            id: "ex5",
            title: "Directory Entry Search",
            difficulty: "medium",
            description: "A directory has 100 entries. How many blocks does the directory file occupy? If we're searching for a file called 'notes.txt', what's the worst case number of entries we must check?",
            hint: "Each entry is 16 bytes, 32 per block. Worst case = linear scan.",
            starterCode: `int num_entries = 100;
int bytes = ____;
int blocks = ____;
int worst_case_checks = ____;`,
            solution: `int num_entries = 100;
int bytes = 100 * 16;  // = 1600 bytes
int blocks = (1600 + 511) / 512;  // = 4 blocks (ceil division)
int worst_case_checks = 100;  // Must check all entries!

// Note: blocks have 32 entries each, so:
// Block 0: entries 0-31
// Block 1: entries 32-63
// Block 2: entries 64-95
// Block 3: entries 96-99 (+ 28 unused slots)
// Last block has internal fragmentation (28 unused entries)`,
            explanation: "100 entries × 16 bytes = 1600 bytes = 4 blocks. In the worst case (file not found, or is the last entry), we check all 100 entries. Directory search is O(n) — a design limitation of Unix V6."
        },
        {
            id: "ex6",
            title: "Full Pathname Lookup Trace",
            difficulty: "hard",
            description: "Trace pathname_lookup for '/usr/bin/sh'. The root directory (inode 1) contains an entry 'usr' → inode 4. Directory inode 4 contains 'bin' → inode 12. Directory inode 12 contains 'sh' → inode 37. How many directory reads are needed?",
            hint: "Each directory_findname reads all blocks of one directory.",
            starterCode: `// Trace pathname_lookup(fs, "/usr/bin/sh")
// Step 1: current_inumber = ____
// Step 2: Find "__" in inode ____ → inumber ____
// Step 3: Find "__" in inode ____ → inumber ____
// Step 4: Find "__" in inode ____ → inumber ____
// Result: ____`,
            solution: `// Trace pathname_lookup(fs, "/usr/bin/sh")
// Step 1: current_inumber = 1 (root directory)
// Step 2: Find "usr" in inode 1  → inumber 4
// Step 3: Find "bin" in inode 4  → inumber 12
// Step 4: Find "sh"  in inode 12 → inumber 37
// Result: 37

// Disk reads needed:
// - 3 inode reads (for inodes 1, 4, 12)
// - 3+ directory data block reads (at least 1 per directory)
// - Plus any indirect block reads if directories are large
// Minimum total: 6 disk reads`,
            explanation: "Pathname lookup processes each path component left-to-right, starting from root (inode 1). Three components means three calls to directory_findname, each requiring reading an inode and then the directory's data blocks."
        }
    ]
};

export default lecture3;
