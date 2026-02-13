export const assign1 = {
    id: 'a1',
    type: 'assignment',
    title: "Unix v6 Filesystem",
    subtitle: "Assignment 1 — Implementing Filesystem Layers: Inodes, Files, Directories, Pathnames",
    keyTakeaway: "A filesystem is built in layers of abstraction: blocks → inodes → files → directories → pathnames. Each layer uses only the layer below it, making the system modular and maintainable. The inode's addressing scheme (direct vs. indirect blocks) is the most complex piece.",

    sections: [
        {
            id: "overview",
            title: "Assignment 1 Overview",
            content: `Assignment 1 implemented a read-only **Unix v6 filesystem** — one of the earliest Unix filesystems. The code is organized into layers, each building on the one below. This layered design is a core CS111 theme: managing complexity through abstraction. The final result is a program that can verify file checksums in a v6 disk image.`,
            keyPoints: [
                "Layer 1: Disk blocks — raw 512-byte sectors read from the disk image",
                "Layer 2: Inodes — metadata structures that describe files (size, block pointers)",
                "Layer 3: Files — read file data block-by-block using inode information",
                "Layer 4: Directories — special files containing (name, inode#) pairs",
                "Layer 5: Pathnames — resolve '/usr/bin/ls' to an inode number by traversing directories"
            ],
            diagram: `
Unix v6 Filesystem Layers:

  ┌─────────────────────────┐
  │     pathname.c          │  pathname_lookup("/usr/bin/ls")
  │  Resolves full paths    │  → splits path, walks directories
  ├─────────────────────────┤
  │     directory.c         │  directory_findname(dir_inum, "bin")
  │  Searches directories   │  → scans dir entries for a name
  ├─────────────────────────┤
  │       file.c            │  file_getblock(inum, blockIdx)
  │  Reads file data blocks │  → uses inode to find disk block
  ├─────────────────────────┤
  │      inode.c            │  inode_iget / inode_indexlookup
  │  Reads inode metadata   │  → finds disk block for file offset
  ├─────────────────────────┤
  │  diskimg (provided)     │  diskimg_readsector(sector)
  │  Raw disk sector I/O    │  → reads 512 bytes from image
  └─────────────────────────┘

Each layer ONLY calls the layer directly below it.
`
        },
        {
            id: "inode-layer",
            title: "Layer 2: Inodes (inode.c)",
            content: `An **inode** stores all metadata about a file: its size, type, permissions, and — most importantly — pointers to the disk blocks that hold its data. Unix v6 inodes have a compact addressing scheme: small files use direct block pointers, while large files use **indirect blocks** (a block full of pointers to other blocks).`,
            keyPoints: [
                "Each inode is 32 bytes; 16 inodes per 512-byte sector",
                "inode_iget reads an inode from disk given its inode number",
                "inode_indexlookup translates a file block index to a disk sector number",
                "Small files: addr[] contains direct block pointers (up to 8)",
                "Large files: addr[] contains pointers to indirect blocks (each holds 256 block numbers)",
                "The flags field (bit 12, i_mode & ILARG) determines small vs. large file"
            ],
            codeExample: {
                title: "inode.c — Reading inodes and translating block indices",
                language: "c",
                code: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "inode.h"
#include "diskimg.h"

#define INODES_PER_SECTOR (DISKIMG_SECTOR_SIZE / sizeof(struct inode))

/**
 * Fetches the specified inode from the filesystem.
 * Returns 0 on success, -1 on error.
 */
int inode_iget(struct unixfilesystem *fs, int inumber, struct inode *inp) {
    if (inumber < 1) return -1;

    // Calculate which sector this inode is in
    int sector = (inumber - 1) / INODES_PER_SECTOR + INODE_START_SECTOR;
    int offset = (inumber - 1) % INODES_PER_SECTOR;

    struct inode inodes[INODES_PER_SECTOR];
    if (diskimg_readsector(fs->dfd, sector, inodes) != DISKIMG_SECTOR_SIZE)
        return -1;

    *inp = inodes[offset];
    return 0;
}

/**
 * Given an inode and a block index within that file,
 * returns the disk sector number where that block lives.
 * Returns -1 on error.
 */
int inode_indexlookup(struct unixfilesystem *fs, struct inode *inp, int blockNum) {
    // Check if the inode uses large file (indirect) addressing
    int isLargeFile = ((inp->i_mode & ILARG) != 0);

    if (!isLargeFile) {
        // Small file: addr[] contains direct block numbers
        if (blockNum >= 8) return -1;
        return inp->i_addr[blockNum];
    }

    // Large file: addr[] contains indirect block pointers
    int indirectIndex = blockNum / 256;
    int directIndex = blockNum % 256;

    if (indirectIndex >= 7) return -1;

    // Read the indirect block
    uint16_t indirectBlock[256];
    int indirectSector = inp->i_addr[indirectIndex];
    if (indirectSector == 0) return -1;

    if (diskimg_readsector(fs->dfd, indirectSector, indirectBlock) != DISKIMG_SECTOR_SIZE)
        return -1;

    return indirectBlock[directIndex];
}`,
                annotations: [
                    { match: "(inumber - 1) / INODES_PER_SECTOR + INODE_START_SECTOR", explanation: "Inodes are numbered starting from 1 (not 0), so we subtract 1. We divide by 16 (inodes per sector) to find the sector, then add the starting sector offset." },
                    { match: "(inumber - 1) % INODES_PER_SECTOR", explanation: "The offset within the sector tells us which of the 16 inodes in this sector is ours." },
                    { match: "*inp = inodes[offset]", explanation: "Copies the found inode into the caller's struct through the output pointer. This is a common C pattern for returning complex data." },
                    { match: "inp->i_mode & ILARG", explanation: "ILARG is a bit flag that indicates the file uses indirect addressing. If this bit is set, addr[] contains pointers to indirect blocks rather than direct data blocks." },
                    { match: "blockNum / 256", explanation: "For large files: determines which indirect block to look in. Each indirect block holds 256 block numbers (256 × 2 bytes = 512 bytes = 1 sector)." },
                    { match: "blockNum % 256", explanation: "The index within the indirect block. After reading the indirect block from disk, we use this index to get the actual data block number." },
                    { match: "indirectSector == 0", explanation: "A zero block pointer means 'no data here' — the file has a hole at this position. Return -1 to signal there's no data." }
                ]
            },
            diagram: `
Inode Addressing Scheme:

SMALL FILE (< 8 blocks, ~4KB):
┌─────────────────────────┐
│ inode                   │
│ addr[0] → Block 100     │  ← direct pointers
│ addr[1] → Block 205     │
│ addr[2] → Block 103     │
│ ...                     │
│ addr[7] → Block 410     │
└─────────────────────────┘

LARGE FILE (up to 7×256 = 1792 blocks, ~900KB):
┌─────────────────────────┐
│ inode (ILARG flag set)  │
│ addr[0] → Indirect Blk  │─→ ┌──────────────────┐
│ addr[1] → Indirect Blk  │   │ 256 block numbers │
│ ...                     │   │ [0] → Block 500   │
│ addr[6] → Indirect Blk  │   │ [1] → Block 501   │
└─────────────────────────┘   │ ...                │
                               │ [255] → Block 755 │
                               └──────────────────┘

blockNum=300 → indirect[1], direct[44]
  (300/256=1, 300%256=44)
`
        },
        {
            id: "file-layer",
            title: "Layer 3: Files (file.c)",
            content: `The **file layer** provides a clean abstraction: "give me block N of file X." It uses the inode layer to translate the block index to a disk sector, then reads that sector. This hides all the complexity of small/large file addressing from higher layers.`,
            codeExample: {
                title: "file.c — Reading a block of file data",
                language: "c",
                code: `#include "file.h"
#include "inode.h"
#include "diskimg.h"

/**
 * Fetches the specified file block from the filesystem.
 * The file is identified by its inode number.
 * Returns the number of valid bytes in the block, or -1 on error.
 */
int file_getblock(struct unixfilesystem *fs, int inumber, int blockNum, void *buf) {
    struct inode in;
    if (inode_iget(fs, inumber, &in) < 0) return -1;

    int sectorNum = inode_indexlookup(fs, &in, blockNum);
    if (sectorNum <= 0) return -1;

    if (diskimg_readsector(fs->dfd, sectorNum, buf) != DISKIMG_SECTOR_SIZE)
        return -1;

    // Calculate how many valid bytes are in this block
    int fileSize = inode_getsize(&in);
    int bytesInBlock = fileSize - blockNum * DISKIMG_SECTOR_SIZE;
    if (bytesInBlock > DISKIMG_SECTOR_SIZE) bytesInBlock = DISKIMG_SECTOR_SIZE;

    return bytesInBlock;
}`,
                annotations: [
                    { match: "inode_iget(fs, inumber, &in)", explanation: "First, read the inode for this file. The inode contains the block pointers we need. Note the &in — we pass a pointer so inode_iget can fill in our local struct." },
                    { match: "inode_indexlookup(fs, &in, blockNum)", explanation: "Uses the inode to translate 'block N of this file' into 'sector M on disk'. This handles all the small/large file addressing complexity." },
                    { match: "diskimg_readsector(fs->dfd, sectorNum, buf)", explanation: "Reads the raw 512-byte sector into the caller's buffer. This is the lowest layer — actual disk I/O." },
                    { match: "fileSize - blockNum * DISKIMG_SECTOR_SIZE", explanation: "The last block of a file may not be full. If a file is 1000 bytes, block 0 has 512 bytes, block 1 has 488 bytes. We calculate how many valid bytes are in this particular block." }
                ]
            }
        },
        {
            id: "directory-layer",
            title: "Layer 4: Directories (directory.c)",
            content: `A **directory** in Unix v6 is just a special type of file whose contents are 16-byte entries: 2 bytes for an inode number + 14 bytes for a filename. To find a file in a directory, we read the directory block by block and compare each entry's name to the one we're looking for.`,
            codeExample: {
                title: "directory.c — Searching a directory for a filename",
                language: "c",
                code: `#include <stdio.h>
#include <string.h>
#include "directory.h"
#include "inode.h"
#include "file.h"
#include "diskimg.h"

#define DIRENTRY_SIZE 16
#define ENTRIES_PER_BLOCK (DISKIMG_SECTOR_SIZE / DIRENTRY_SIZE)

/**
 * Looks up the specified name in the directory identified by dirInumber.
 * If found, fills in *dirEnt with the directory entry and returns 0.
 * Returns -1 if not found.
 */
int directory_findname(struct unixfilesystem *fs, const char *name,
                       int dirInumber, struct direntv6 *dirEnt) {
    struct inode dirInode;
    if (inode_iget(fs, dirInumber, &dirInode) < 0) return -1;

    int fileSize = inode_getsize(&dirInode);
    int numBlocks = (fileSize + DISKIMG_SECTOR_SIZE - 1) / DISKIMG_SECTOR_SIZE;

    for (int blockIdx = 0; blockIdx < numBlocks; blockIdx++) {
        struct direntv6 entries[ENTRIES_PER_BLOCK];
        int validBytes = file_getblock(fs, dirInumber, blockIdx, entries);
        if (validBytes < 0) return -1;

        int numEntries = validBytes / DIRENTRY_SIZE;

        for (int i = 0; i < numEntries; i++) {
            if (entries[i].d_inumber == 0) continue; // deleted entry
            if (strncmp(entries[i].d_name, name, 14) == 0) {
                *dirEnt = entries[i];
                return 0;
            }
        }
    }
    return -1; // not found
}`,
                annotations: [
                    { match: "(fileSize + DISKIMG_SECTOR_SIZE - 1) / DISKIMG_SECTOR_SIZE", explanation: "Ceiling division: rounds up to get the total number of blocks. A 1000-byte directory file spans 2 blocks (bytes 0-511 and 512-999)." },
                    { match: "file_getblock(fs, dirInumber, blockIdx, entries)", explanation: "Uses the file layer to read directory data. We treat the directory as an ordinary file — reading it block by block. This is the key insight: directories are just files with structured contents." },
                    { match: "entries[i].d_inumber == 0", explanation: "An inode number of 0 means this directory entry has been deleted. Skip it." },
                    { match: "strncmp(entries[i].d_name, name, 14)", explanation: "Compare up to 14 characters. v6 filenames are at most 14 chars and may NOT be null-terminated if exactly 14 chars long. strncmp handles this correctly." },
                    { match: "*dirEnt = entries[i]", explanation: "When found, copy the directory entry to the caller's struct. This gives them both the filename and the inode number of the found file." }
                ]
            },
            diagram: `
Directory File Structure:

A directory file contains 16-byte entries:
┌─────────────────────────────────────┐
│ 2 bytes: inode#  │ 14 bytes: name   │  Entry 0
├──────────────────┼──────────────────┤
│ 2 bytes: inode#  │ 14 bytes: name   │  Entry 1
├──────────────────┼──────────────────┤
│ 2 bytes: inode#  │ 14 bytes: name   │  Entry 2
├──────────────────┼──────────────────┤
│     ...          │    ...           │
└─────────────────────────────────────┘

Example (root directory):
┌──────┬──────────────────┐
│  1   │ .              │  (current dir)
│  1   │ ..             │  (parent dir)
│  5   │ etc            │
│  12  │ usr            │
│  0   │ (deleted)      │  ← skip these
│  18  │ bin            │
└──────┴──────────────────┘
`
        },
        {
            id: "pathname-layer",
            title: "Layer 5: Pathnames (pathname.c)",
            content: `The **pathname layer** is the top of the filesystem stack. Given a full path like \`/usr/bin/ls\`, it resolves it to an inode number by splitting the path into components ("usr", "bin", "ls") and looking each one up in its parent directory.`,
            codeExample: {
                title: "pathname.c — Resolving a full path to an inode number",
                language: "c",
                code: `#include <stdio.h>
#include <string.h>
#include "pathname.h"
#include "directory.h"
#include "inode.h"
#include "diskimg.h"

#define ROOT_INUMBER 1

/**
 * Returns the inode number for the element at the specified path.
 * Returns -1 on error (not found, etc.)
 */
int pathname_lookup(struct unixfilesystem *fs, const char *pathname) {
    if (pathname[0] != '/') return -1; // must be absolute path

    int currentInum = ROOT_INUMBER;

    char pathcopy[strlen(pathname) + 1];
    strcpy(pathcopy, pathname);

    char *token = strtok(pathcopy, "/");
    while (token != NULL) {
        struct direntv6 entry;
        if (directory_findname(fs, token, currentInum, &entry) < 0)
            return -1;
        currentInum = entry.d_inumber;
        token = strtok(NULL, "/");
    }

    return currentInum;
}`,
                annotations: [
                    { match: "ROOT_INUMBER 1", explanation: "The root directory always has inode number 1 in Unix v6. This is where pathname resolution starts." },
                    { match: "pathname[0] != '/'", explanation: "Reject relative paths. Our filesystem only supports absolute paths (starting from root)." },
                    { match: "strtok(pathcopy, \"/\")", explanation: "Splits the path by '/' separators. For '/usr/bin/ls', the tokens are 'usr', 'bin', 'ls'. strtok modifies the string, so we work on a copy." },
                    { match: "directory_findname(fs, token, currentInum, &entry)", explanation: "Look up the current path component in the current directory. For '/usr/bin/ls': first lookup 'usr' in root dir, then 'bin' in usr's dir, then 'ls' in bin's dir." },
                    { match: "currentInum = entry.d_inumber", explanation: "Move into the found directory by updating the current inode number. Each successful lookup moves us one level deeper in the path." },
                    { match: "strtok(NULL, \"/\")", explanation: "Get the next path component. Passing NULL tells strtok to continue tokenizing the same string. Returns NULL when no more tokens." }
                ]
            }
        },
        {
            id: "checksum",
            title: "Checksum Verification (chksumfile.c)",
            content: `The **checksum layer** uses all the layers below to read every block of a file and compute its SHA1 hash. This is used by the testing infrastructure to verify your filesystem implementation gives correct results for known files.`,
            keyPoints: [
                "Reads a file block-by-block using file_getblock",
                "Hashes each block with SHA1 to produce a fingerprint",
                "Can look up files by inode number or by full pathname",
                "The checksum lets us verify the entire pipeline: pathname → directory → file → inode → disk"
            ],
            codeExample: {
                title: "chksumfile.c — Computing file checksums",
                language: "c",
                code: `/**
 * Computes the checksum of the specified file by reading
 * it block by block and hashing each block.
 */
int chksumfile_byinumber(struct unixfilesystem *fs, int inumber, void *chksum) {
    struct inode in;
    if (inode_iget(fs, inumber, &in) < 0) return -1;

    int fileSize = inode_getsize(&in);
    if (fileSize == 0) {
        // Empty file has a known checksum
        chksumfile_emptychecksum(chksum);
        return 0;
    }

    int numBlocks = (fileSize + DISKIMG_SECTOR_SIZE - 1) / DISKIMG_SECTOR_SIZE;

    SHA1_CTX ctx;
    SHA1Init(&ctx);

    for (int blockIdx = 0; blockIdx < numBlocks; blockIdx++) {
        char buf[DISKIMG_SECTOR_SIZE];
        int validBytes = file_getblock(fs, inumber, blockIdx, buf);
        if (validBytes < 0) return -1;
        SHA1Update(&ctx, (unsigned char *)buf, validBytes);
    }

    unsigned char digest[SHA1_DIGEST_LENGTH];
    SHA1Final(digest, &ctx);
    memcpy(chksum, digest, SHA1_DIGEST_LENGTH);
    return 0;
}

/**
 * Computes the checksum of a file by pathname.
 */
int chksumfile_bypathname(struct unixfilesystem *fs, const char *pathname, void *chksum) {
    int inumber = pathname_lookup(fs, pathname);
    if (inumber < 0) return -1;
    return chksumfile_byinumber(fs, inumber, chksum);
}`,
                annotations: [
                    { match: "inode_getsize(&in)", explanation: "Extracts the file size from the inode. In v6, the size is stored across two fields and needs bit manipulation to reconstruct." },
                    { match: "SHA1Init(&ctx)", explanation: "Initializes the SHA1 hashing context. SHA1 is a cryptographic hash function that produces a 20-byte digest." },
                    { match: "SHA1Update(&ctx, (unsigned char *)buf, validBytes)", explanation: "Feeds each block's valid bytes into the hash. We only hash validBytes (not the full 512-byte sector) because the last block may be partial." },
                    { match: "SHA1Final(digest, &ctx)", explanation: "Finalizes the hash and puts the 20-byte result into digest. This is the file's fingerprint." },
                    { match: "pathname_lookup(fs, pathname)", explanation: "Uses the pathname layer to convert a path like '/usr/bin/ls' to an inode number, then calls the by-inode-number version. This demonstrates the full layer stack in action." }
                ]
            }
        },
        {
            id: "summary",
            title: "Assignment 1 Summary",
            content: `Assignment 1 is the purest example of **layered abstraction** in CS111. Each file implements exactly one layer, calls only the layer below, and provides a clean interface to the layer above. The result: a complex system (reading files from a real filesystem image) built from simple, understandable pieces.`,
            keyPoints: [
                "5 layers: disk → inode → file → directory → pathname",
                "Each layer has a clean interface and uses only the layer below",
                "Small files: direct block pointers. Large files: indirect blocks",
                "Directories are just files with structured 16-byte entries",
                "Pathname lookup walks the directory tree from root to target",
                "Error handling at every layer: return -1 and propagate upward"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Trace a Pathname Lookup",
            difficulty: "medium",
            description: "Trace through the layer calls for pathname_lookup(\"/etc/passwd\"). List every function call in order.",
            hint: "Start at pathname_lookup, which calls directory_findname for each component, which calls file_getblock, which calls inode functions.",
            starterCode: `// Trace: pathname_lookup(fs, "/etc/passwd")
// List every function call in order:

// 1. pathname_lookup: token = "etc"
// 2. ____
// 3. ____
// ...

// How many disk reads happen in total? ____`,
            solution: `// Trace: pathname_lookup(fs, "/etc/passwd")

// 1. pathname_lookup: token = "etc", currentInum = 1 (root)
// 2.   directory_findname(fs, "etc", 1, &entry)
// 3.     inode_iget(fs, 1, &dirInode)         ← read root's inode
// 4.       diskimg_readsector(sector)          ← DISK READ
// 5.     file_getblock(fs, 1, 0, entries)     ← read root's data
// 6.       inode_iget(fs, 1, &in)             ← read inode again
// 7.         diskimg_readsector(sector)        ← DISK READ
// 8.       inode_indexlookup(fs, &in, 0)      ← find block 0
// 9.       diskimg_readsector(sector)          ← DISK READ
// 10.    Found "etc" → inode 5
// 11. pathname_lookup: token = "passwd", currentInum = 5
// 12.   directory_findname(fs, "passwd", 5, &entry)
// 13.    ... (same pattern: iget + getblock + scan)
// 14.    Found "passwd" → inode 42
// 15. Return 42

// Minimum disk reads: ~6 (2 lookups × 3 reads each)
// (could be more if directories span multiple blocks)`,
            explanation: "Each path component requires at least: 1 disk read for the inode, and 1+ disk reads for the directory data blocks. Deeper paths require more total reads."
        }
    ]
};

export default assign1;
