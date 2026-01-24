export const lecture4 = {
  id: 4,
  title: "Unix V6 Filesystem, Continued",
  subtitle: "Directories, Lookup, and Doubly-Indirect Addressing",
  keyTakeaway: "The Unix V6 Filesystem represents directories as files, with payloads containing directory entries. Lookup begins at the root directory for absolute paths.",
  
  sections: [
    {
      id: "recap",
      title: "Recap: Unix V6 Filesystem",
      content: `Every file has an associated **inode**. An inode has space for up to 8 block numbers for file payload data, and this block number space is used differently depending on whether the file is "small mode" or "large mode".`,
      keyPoints: [
        "Every file has an inode storing metadata and block numbers",
        "Small files: i_addr stores direct block numbers (up to 8)",
        "Large files: 7 singly-indirect + 1 doubly-indirect block numbers",
        "Check bit flag: (inode.i_mode & ILARG) != 0 means large mode"
      ],
      codeExample: {
        title: "The inode structure (from ino.h)",
        language: "c",
        code: `struct inode {
    uint16_t    i_mode;       // bit vector of file type and permissions
    uint8_t     i_nlink;      // number of references to file
    uint8_t     i_uid;        // owner
    uint8_t     i_gid;        // group of owner
    uint8_t     i_size0;      // most significant byte of size
    uint16_t    i_size1;      // lower two bytes of size (3-byte number)
    uint16_t    i_addr[8];    // block numbers for file's data
    uint16_t    i_atime[2];   // access time
    uint16_t    i_mtime[2];   // modify time
};

/* Important mode flags */
#define IALLOC  0x8000    // file is used
#define IFDIR   0x4000    // directory
#define ILARG   0x1000    // large addressing algorithm`
      }
    },
    {
      id: "small-file",
      title: "Small File Scheme",
      content: `If the file is **small**, i_addr stores **direct block numbers**: numbers of blocks that contain payload data directly. To know how many of the 8 numbers are used, we look at the size stored in the inode.`,
      keyPoints: [
        "Each i_addr entry points directly to a data block",
        "Maximum 8 blocks × 512 bytes = 4KB for small files",
        "Block number 0 means 'no block' (NULL)"
      ],
      diagram: `
┌───────────────────────────────────────────────────┐
│ i_addr:  [341, 33, 124, -, -, -, -, -]            │
└───────────────────────────────────────────────────┘
              │     │      │
              ▼     ▼      ▼
         ┌───────┐ ┌───────┐ ┌───────┐
         │Block  │ │Block  │ │Block  │
         │ 341   │ │  33   │ │ 124   │
         │File   │ │File   │ │File   │
         │Part 0 │ │Part 1 │ │Part 2 │
         └───────┘ └───────┘ └───────┘
      `,
      codeExample: {
        title: "Fetching an inode from disk",
        language: "c",
        code: `#define AMOUNT_INODES_PER_BLOCK (DISKIMG_SECTOR_SIZE / sizeof(struct inode))

int inode_iget(const struct unixfilesystem *fs, int inumber,
        struct inode *inp) {
    struct inode inodesBlock[AMOUNT_INODES_PER_BLOCK];
    
    // Calculate which block contains this inode
    int blockNumber = INODE_START_SECTOR + (inumber - 1) / AMOUNT_INODES_PER_BLOCK;
    
    // Read the entire block of inodes from disk
    int diskResult = diskimg_readsector(fs->dfd, blockNumber, inodesBlock);
    if (diskResult < 0) {
        fprintf(stderr, "inode_iget: disk error at block %d\\n", blockNumber);
        return -1;
    }
    
    // Extract the specific inode we want
    struct inode foundInode = inodesBlock[(inumber - 1) % AMOUNT_INODES_PER_BLOCK];
    *inp = foundInode;
    return 0;
}`
      }
    },
    {
      id: "large-file",
      title: "Large File Scheme",
      content: `If the file is **large**, the first 7 entries in i_addr are **singly-indirect block numbers** (block numbers of blocks that contain direct block numbers). The 8th entry (if needed) is a **doubly-indirect block number**.`,
      keyPoints: [
        "Each singly-indirect block holds 256 block numbers (512 bytes / 2 bytes per uint16_t)",
        "First 7 i_addr entries → singly-indirect blocks → 7 × 256 = 1,792 data blocks",
        "8th i_addr entry → doubly-indirect → up to 256 more singly-indirect blocks",
        "Maximum file size: (7 + 256) × 256 × 512 ≈ 34MB"
      ],
      diagram: `
┌─────────────────────────────────────────────────────────────┐
│ i_addr:  [444, 22, 34, 792, 168, 976, 2467, 555]            │
│           ↓                                    ↓            │
│     Singly-indirect                    Doubly-indirect      │
└─────────────────────────────────────────────────────────────┘
           │                                     │
           ▼                                     ▼
    ┌──────────────┐                    ┌──────────────┐
    │   Block 444  │                    │   Block 555  │
    │ [126,98,70,  │                    │ [1352,567,   │
    │  127,1252,...]│                    │  897,...]    │
    └──────────────┘                    └──────────────┘
           │                                     │
           ▼                                     ▼
    ┌──────────────┐                    ┌──────────────┐
    │  Block 126   │                    │  Block 1352  │
    │ (File Part 0)│                    │ [897,4356,..]│
    └──────────────┘                    └──────────────┘
      `,
      codeExample: {
        title: "Looking up a block number for a file (handling both small and large modes)",
        language: "c",
        code: `int inode_indexlookup(const struct unixfilesystem *fs, struct inode *inp,
        int fileBlockIndex) { 
    
    int size = inode_getsize(inp);
    int totalNumBlocks = (size + DISKIMG_SECTOR_SIZE - 1) / DISKIMG_SECTOR_SIZE;
    
    // Validate the block index
    if (fileBlockIndex >= totalNumBlocks || fileBlockIndex < 0) {
        return -1;
    }
    
    int numSinglyIndirectBlocks = 7;  // First 7 entries in i_addr
    
    // SMALL FILE: direct lookup
    if (!(inp->i_mode & ILARG)) {
        return inp->i_addr[fileBlockIndex];
    }
    
    // LARGE FILE: need to follow indirect pointers
    int inodeBlockIndex = fileBlockIndex / AMOUNT_BLOCK_NUMBERS_PER_BLOCK;
    
    if (inodeBlockIndex < numSinglyIndirectBlocks) {
        // Singly-indirect: one level of indirection
        uint16_t blockNumbers[AMOUNT_BLOCK_NUMBERS_PER_BLOCK];
        diskimg_readsector(fs->dfd, inp->i_addr[inodeBlockIndex], blockNumbers);
        return blockNumbers[fileBlockIndex % AMOUNT_BLOCK_NUMBERS_PER_BLOCK];
        
    } else {
        // Doubly-indirect: two levels of indirection
        uint16_t overflowBlock[AMOUNT_BLOCK_NUMBERS_PER_BLOCK];
        diskimg_readsector(fs->dfd, inp->i_addr[7], overflowBlock);
        
        uint16_t finalBlock[AMOUNT_BLOCK_NUMBERS_PER_BLOCK];
        diskimg_readsector(fs->dfd, 
            overflowBlock[inodeBlockIndex - numSinglyIndirectBlocks], 
            finalBlock);
            
        return finalBlock[fileBlockIndex % AMOUNT_BLOCK_NUMBERS_PER_BLOCK];
    }
}`
      }
    },
    {
      id: "directories",
      title: "Directories",
      content: `A Unix V6 directory's payload data is an unsorted list of 16-byte **directory entries**. Each entry contains the name and inode number of one thing in that directory. The key idea: directories are just files whose contents are directory entries!`,
      keyPoints: [
        "Directory entry = 2 bytes (inumber) + 14 bytes (name)",
        "Names are NOT always null-terminated (if exactly 14 chars)",
        "Directories have inodes too, just like regular files",
        "Inode stores a flag (IFDIR) to distinguish files from directories"
      ],
      codeExample: {
        title: "The directory entry structure",
        language: "c",
        code: `#define MAX_COMPONENT_LENGTH 14

struct direntv6 {
    uint16_t d_inumber;                   // inode number (2 bytes)
    char     d_name[MAX_COMPONENT_LENGTH]; // filename (14 bytes)
};

// Example directory contents (as an array of direntv6):
// d_inumber | d_name
// ----------|---------------
//    1      | "."           <- current directory
//    1      | ".."          <- parent directory  
//   23      | "myfile.txt"
//   54      | "song.mp3"
// 1245      | "prez.pptx"`
      }
    },
    {
      id: "lookup",
      title: "Path Lookup",
      content: `To find a file by path, we traverse directories starting from the root. The root directory "/" always has **inumber 1**. We split the path into components and search each directory for the next component.`,
      keyPoints: [
        "Root directory is always inode #1 (0 means NULL)",
        "For /classes/cs111/index.html: start at root, find 'classes', find 'cs111', find 'index.html'",
        "Each lookup requires reading directory blocks and scanning entries",
        "Use strncmp for name comparison (14 char max, may not be null-terminated)"
      ],
      diagram: `
Path: /classes/cs111/index.html

Step 1: Start at root (inumber 1)
        ┌─────────────────┐
        │    Root "/"     │
        │   inumber = 1   │
        └────────┬────────┘
                 │ find "classes"
                 ▼
Step 2: ┌─────────────────┐
        │   "classes"     │
        │  inumber = 12   │
        └────────┬────────┘
                 │ find "cs111"
                 ▼
Step 3: ┌─────────────────┐
        │    "cs111"      │
        │  inumber = 45   │
        └────────┬────────┘
                 │ find "index.html"
                 ▼
Step 4: ┌─────────────────┐
        │  "index.html"   │
        │  inumber = 78   │◄── Return this!
        └─────────────────┘
      `,
      codeExample: {
        title: "Full pathname lookup implementation",
        language: "c",
        code: `#define ROOT_INUMBER 1

int pathname_lookup(const struct unixfilesystem *fs, const char *pathname) {
    char pathCopy[strlen(pathname) + 1];
    strcpy(pathCopy, pathname);

    char *currentLocation = pathCopy;
    char *token;
    int currentDirInumber = ROOT_INUMBER;  // Start at root
    
    // Split path by "/" and traverse each component
    while ((token = strsep(&currentLocation, "/")) != NULL) {
        // Skip empty tokens (handles leading "/" and "//")
        if (*token == '\\0') {
            continue;
        }

        if (strlen(token) > MAX_COMPONENT_LENGTH) {
            fprintf(stderr, "Component too long: %s\\n", token);
            return -1;
        }
        
        // Find this name in the current directory
        struct direntv6 dirEnt;
        if (directory_findname(fs, token, currentDirInumber, &dirEnt) < 0) {
            fprintf(stderr, "Not found: %s\\n", token);
            return -1;
        }
        
        // Move to the found directory/file
        currentDirInumber = dirEnt.d_inumber;
    }
    
    return currentDirInumber;  // Return the final inode number
}`
      }
    },
    {
      id: "directory-search",
      title: "Searching a Directory",
      content: `To find a name within a directory, we need to read all of the directory's data blocks and scan through the directory entries looking for a match.`,
      keyPoints: [
        "Calculate number of blocks from directory size",
        "Read each block and iterate through entries",
        "Use strncmp with MAX_COMPONENT_LENGTH for comparison",
        "Remember: directories can be large (use file_getblock)"
      ],
      codeExample: {
        title: "Finding a name in a directory",
        language: "c",
        code: `int directory_findname(const struct unixfilesystem *fs, const char *name,
                       int dirinumber, struct direntv6 *dirEnt) {
    if (strlen(name) > MAX_COMPONENT_LENGTH) {
        return -1;  // Name too long
    }

    // Get the directory's inode
    struct inode dirInode;
    if (inode_iget(fs, dirinumber, &dirInode) < 0) {
        return -1;
    }

    int size = inode_getsize(&dirInode);
    int numBlocks = (size + DISKIMG_SECTOR_SIZE - 1) / DISKIMG_SECTOR_SIZE;
    int numEntries = size / sizeof(struct direntv6);
    int entriesPerBlock = DISKIMG_SECTOR_SIZE / sizeof(struct direntv6);

    int currentEntry = 0;
    for (int blockIdx = 0; blockIdx < numBlocks; blockIdx++) { 
        struct direntv6 entries[entriesPerBlock];
        
        // Read this block of directory entries
        if (file_getblock(fs, dirinumber, blockIdx, entries) < 0) {
            return -1;
        }
        
        // Search through entries in this block
        for (int j = 0; j < entriesPerBlock && currentEntry < numEntries; j++) {
            // Compare names (use strncmp - names may not be null-terminated!)
            if (strncmp(name, entries[j].d_name, MAX_COMPONENT_LENGTH) == 0) {
                *dirEnt = entries[j];  // Found it!
                return 0;
            }
            currentEntry++;
        }
    }
    return -1;  // Not found
}`
      }
    },
    {
      id: "file-getblock",
      title: "Reading File Blocks",
      content: `The file_getblock function combines inode lookup with block reading. It handles translating a logical file block index to a physical disk block.`,
      keyPoints: [
        "Logical block index: 0 = first 512 bytes, 1 = next 512 bytes, etc.",
        "Returns number of valid bytes in the block (may be < 512 for last block)",
        "Chains together inode_iget → inode_indexlookup → diskimg_readsector"
      ],
      codeExample: {
        title: "Getting a specific block of a file's data",
        language: "c",
        code: `int file_getblock(const struct unixfilesystem *fs, int inumber,
        int fileBlockIndex, void *buf) {
    
    // Step 1: Get the inode
    struct inode cur_inode;
    if (inode_iget(fs, inumber, &cur_inode) < 0) {
        return -1;
    }
    
    // Step 2: Translate logical block index to physical block number
    int blockNumber = inode_indexlookup(fs, &cur_inode, fileBlockIndex);
    if (blockNumber < 0) {
        return -1;
    }
    
    // Step 3: Read the physical block from disk
    if (diskimg_readsector(fs->dfd, blockNumber, buf) < 0) {
        return -1;
    }
    
    // Calculate how many valid bytes are in this block
    int fileSize = inode_getsize(&cur_inode);
    int bytesBeforeThisBlock = fileBlockIndex * DISKIMG_SECTOR_SIZE;
    int remaining = fileSize - bytesBeforeThisBlock;
    
    if (remaining > DISKIMG_SECTOR_SIZE) {
        return DISKIMG_SECTOR_SIZE;  // Full block
    } else {
        return remaining;  // Partial block (last block of file)
    }
}`
      }
    },
    {
      id: "summary",
      title: "Unix V6 Filesystem Summary",
      content: `The Unix V6 Filesystem demonstrates key OS design principles: modularity, layering, name resolution, and virtualization.`,
      keyPoints: [
        "Modularity: subdivide into inode layer, directory layer, pathname layer",
        "Layering: each layer uses the one below (pathname → directory → file → inode → disk)",
        "Name resolution: paths (human-friendly) → inumbers (machine-friendly)",
        "Virtualization: disk appears as simple array of sectors"
      ],
      advantages: [
        "Can access all block numbers for a file",
        "Supports easy sequential access",
        "Easy to grow files"
      ],
      disadvantages: [
        "More steps/disk reads to access large file data",
        "More disk space for metadata",
        "Upper limit on file size (~34MB)",
        "Size change may require restructuring inode"
      ]
    }
  ],
  
  exercises: [
    {
      id: "ex1",
      title: "Doubly-Indirect Minimum Size",
      difficulty: "medium",
      description: "What is the smallest file size (in bytes) that would require using the doubly-indirect block to store its data?",
      hint: "Think about how many bytes can be addressed using just the 7 singly-indirect blocks. Each singly-indirect block can hold 256 block numbers, and each block is 512 bytes.",
      starterCode: `// Calculate the minimum file size that needs doubly-indirect addressing

// Given:
// - Block size = 512 bytes
// - Each block number = 2 bytes (uint16_t)
// - Block numbers per indirect block = 512 / 2 = 256
// - Number of singly-indirect blocks = 7

int block_size = 512;
int block_nums_per_indirect = 256;
int singly_indirect_blocks = 7;

// Maximum bytes addressable with just singly-indirect:
int max_singly = ____;

// Minimum size requiring doubly-indirect:
int answer = ____;`,
      solution: `// Calculate the minimum file size that needs doubly-indirect addressing

// Given:
// - Block size = 512 bytes
// - Each block number = 2 bytes (uint16_t)
// - Block numbers per indirect block = 512 / 2 = 256
// - Number of singly-indirect blocks = 7

int block_size = 512;
int block_nums_per_indirect = 256;
int singly_indirect_blocks = 7;

// Maximum bytes addressable with just singly-indirect:
int max_singly = singly_indirect_blocks * block_nums_per_indirect * block_size;
// max_singly = 7 * 256 * 512 = 917,504 bytes

// Minimum size requiring doubly-indirect:
int answer = max_singly + 1;
// answer = 917,505 bytes`,
      explanation: "Files up to 7 × 256 × 512 = 917,504 bytes can be represented using just the 7 singly-indirect blocks. Any file of 917,505 bytes or more needs the doubly-indirect block."
    },
    {
      id: "ex2",
      title: "Inode Block Calculation",
      difficulty: "easy",
      description: "Given an inumber, calculate which disk block contains that inode. Assume the inode table starts at sector 2 and each inode is 32 bytes (so 16 inodes per 512-byte block).",
      hint: "Inumbers start at 1 (not 0). Use integer division.",
      starterCode: `int iNumberToBlock(int inumber) {
    #define INODE_START_SECTOR 2
    #define INODES_PER_BLOCK 16
    
    // Your code here:
    return ____;
}

// Test: What block contains inode #17?
// What block contains inode #1?`,
      solution: `int iNumberToBlock(int inumber) {
    #define INODE_START_SECTOR 2
    #define INODES_PER_BLOCK 16
    
    // Subtract 1 because inumbers are 1-indexed
    // Divide to find which block (0-indexed from inode table start)
    // Add start sector to get absolute block number
    return INODE_START_SECTOR + (inumber - 1) / INODES_PER_BLOCK;
}

// Test: inode #17 → 2 + (17-1)/16 = 2 + 1 = block 3
// Test: inode #1  → 2 + (1-1)/16  = 2 + 0 = block 2`,
      explanation: "Inumbers are 1-indexed, so we subtract 1 before dividing. The result tells us how many full blocks of inodes come before this one, which we add to the start sector."
    },
    {
      id: "ex3",
      title: "File Size Calculation",
      difficulty: "easy",
      description: "The file size in Unix V6 is stored across two fields: i_size0 (1 byte, most significant) and i_size1 (2 bytes, lower). Write a function to combine them into a single size value.",
      hint: "You need to shift i_size0 left by the number of bits in i_size1 (16 bits), then OR with i_size1.",
      starterCode: `int inode_getsize(struct inode *inp) {
    // i_size0 is uint8_t (1 byte, most significant)
    // i_size1 is uint16_t (2 bytes, lower)
    
    // Combine into a 24-bit size value
    return ____;
}

// Example: if i_size0 = 0x01 and i_size1 = 0x2345
// The size should be 0x012345 = 74,565 bytes`,
      solution: `int inode_getsize(struct inode *inp) {
    // i_size0 is uint8_t (1 byte, most significant)
    // i_size1 is uint16_t (2 bytes, lower)
    
    // Shift i_size0 left by 16 bits, then OR with i_size1
    return ((inp->i_size0 << 16) | inp->i_size1);
}

// Example: if i_size0 = 0x01 and i_size1 = 0x2345
// Result = (0x01 << 16) | 0x2345
//        = 0x010000 | 0x2345
//        = 0x012345 = 74,565 bytes`,
      explanation: "We shift the most significant byte (i_size0) left by 16 bits to put it in the correct position, then OR it with the lower 16 bits (i_size1). This gives us a 24-bit size value."
    },
    {
      id: "ex4",
      title: "Path Lookup - /local/files/story.txt",
      difficulty: "medium",
      description: `Given the following filesystem state, what is the inode number for /local/files/story.txt?

Inode #1 (root, directory): i_addr points to block 24
Block 24: { ".", 1 }, { "..", 1 }, { "local", 12 }, { "other", 10 }

Inode #12 (directory): i_addr points to blocks 32 and 41
Block 32: { ".", 12 }, { "..", 1 }, { "file1.txt", 4 }, { "docs", 15 }
Block 41: { "apps", 21 }, { "files", 14 }

Inode #14 (directory): i_addr points to block 62
Block 62: { ".", 14 }, { "..", 12 }, { "story.txt", 3 }, { "todo.txt", 16 }`,
      hint: "Start at root (inode 1), then traverse: root → local → files → story.txt",
      starterCode: `// Trace the lookup for /local/files/story.txt

// Step 1: Start at root (inumber = 1)
// Read block 24, find "local" → inumber = ____

// Step 2: Go to that inode, read its blocks
// Block 32 doesn't have "files"
// Block 41 has "files" → inumber = ____

// Step 3: Go to that inode, read its blocks  
// Block 62 has "story.txt" → inumber = ____

int answer = ____;`,
      solution: `// Trace the lookup for /local/files/story.txt

// Step 1: Start at root (inumber = 1)
// Read block 24, find "local" → inumber = 12

// Step 2: Go to inode 12, read its blocks
// Block 32 doesn't have "files"
// Block 41 has "files" → inumber = 14

// Step 3: Go to inode 14, read its blocks  
// Block 62 has "story.txt" → inumber = 3

int answer = 3;`,
      explanation: "We follow the path component by component: root→local (inode 12), local→files (inode 14), files→story.txt (inode 3). Note that block 32 didn't contain 'files', so we had to check block 41."
    },
    {
      id: "ex5",
      title: "Large File Block Lookup",
      difficulty: "hard",
      description: `For a large-mode file, write code to find the physical block number for logical block index 300.

Given: i_addr = [26, 35, 32, 50, 58, 22, 59, 30] (all singly-indirect except index 7)`,
      hint: "Block index 300 > 7 × 256 = 1792? If yes, use doubly-indirect. Calculate which singly-indirect block within the doubly-indirect, then which entry within that block.",
      starterCode: `int find_block_300(const struct unixfilesystem *fs, struct inode *inp) {
    int fileBlockIndex = 300;
    int numSinglyIndirect = 7;
    int entriesPerBlock = 256;
    
    // Which singly-indirect block does block 300 fall into?
    int singlyIndirectIndex = fileBlockIndex / entriesPerBlock;
    // singlyIndirectIndex = ____
    
    // Is this within the first 7 singly-indirect blocks?
    if (singlyIndirectIndex < numSinglyIndirect) {
        // Yes! Read from i_addr[singlyIndirectIndex]
        uint16_t blockNumbers[entriesPerBlock];
        diskimg_readsector(fs->dfd, inp->i_addr[____], blockNumbers);
        return blockNumbers[fileBlockIndex % entriesPerBlock];
    } else {
        // Need doubly-indirect (this case doesn't apply for block 300)
    }
}`,
      solution: `int find_block_300(const struct unixfilesystem *fs, struct inode *inp) {
    int fileBlockIndex = 300;
    int numSinglyIndirect = 7;
    int entriesPerBlock = 256;
    
    // Which singly-indirect block does block 300 fall into?
    int singlyIndirectIndex = fileBlockIndex / entriesPerBlock;
    // singlyIndirectIndex = 300 / 256 = 1
    
    // Is this within the first 7 singly-indirect blocks?
    if (singlyIndirectIndex < numSinglyIndirect) {  // 1 < 7, yes!
        // Read from i_addr[1] which is block 35
        uint16_t blockNumbers[entriesPerBlock];
        diskimg_readsector(fs->dfd, inp->i_addr[singlyIndirectIndex], blockNumbers);
        
        // Get entry at position 300 % 256 = 44
        return blockNumbers[fileBlockIndex % entriesPerBlock];
    } else {
        // Need doubly-indirect (this case doesn't apply for block 300)
    }
}

// So for block 300:
// 1. Go to i_addr[1] = block 35 (singly-indirect)
// 2. Read entry at index 44 within that block`,
      explanation: "Block index 300 falls in singly-indirect block #1 (300/256=1), at position 44 within that block (300%256=44). We read block 35 (i_addr[1]) and return the 44th block number from it."
    },
    {
      id: "ex6",
      title: "Directory Entry Scanning",
      difficulty: "medium",
      description: "Write the inner loop that scans directory entries in a block looking for a specific filename. Handle the case where names might be exactly 14 characters (not null-terminated).",
      hint: "Use strncmp with MAX_COMPONENT_LENGTH. Also track how many entries you've checked against the total.",
      starterCode: `#define MAX_COMPONENT_LENGTH 14
#define ENTRIES_PER_BLOCK 32  // 512 / 16

int scan_block_for_name(struct direntv6 *entries, const char *name,
                        int *currentEntry, int totalEntries,
                        struct direntv6 *result) {
    for (int j = 0; j < ENTRIES_PER_BLOCK; j++) {
        // Stop if we've checked all entries
        if (*currentEntry >= totalEntries) {
            break;
        }
        
        // Compare the name (careful: might not be null-terminated!)
        if (____) {
            *result = entries[j];
            return 0;  // Found!
        }
        
        (*currentEntry)++;
    }
    return -1;  // Not found in this block
}`,
      solution: `#define MAX_COMPONENT_LENGTH 14
#define ENTRIES_PER_BLOCK 32  // 512 / 16

int scan_block_for_name(struct direntv6 *entries, const char *name,
                        int *currentEntry, int totalEntries,
                        struct direntv6 *result) {
    for (int j = 0; j < ENTRIES_PER_BLOCK; j++) {
        // Stop if we've checked all entries
        if (*currentEntry >= totalEntries) {
            break;
        }
        
        // Compare the name (careful: might not be null-terminated!)
        // strncmp compares at most MAX_COMPONENT_LENGTH characters
        if (strncmp(name, entries[j].d_name, MAX_COMPONENT_LENGTH) == 0) {
            *result = entries[j];
            return 0;  // Found!
        }
        
        (*currentEntry)++;
    }
    return -1;  // Not found in this block
}`,
      explanation: "We use strncmp instead of strcmp because directory names in Unix V6 might be exactly 14 characters with no null terminator. strncmp will only compare up to MAX_COMPONENT_LENGTH characters, avoiding reading past the end of the name."
    }
  ]
};

export default lecture4;
