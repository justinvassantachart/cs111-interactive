export const lecture1 = {
    id: 1,
    title: "Welcome to CS111!",
    subtitle: "Introduction to Operating Systems Principles",
    keyTakeaway: "An operating system manages complexity through key design principles — layering, modularity, and naming — that let us build reliable systems from simple building blocks. CS111 explores these principles through filesystems, multiprocessing, and concurrency.",

    sections: [
        {
            id: "what-is-cs111",
            title: "What is CS111?",
            content: `CS111 is a course about **operating systems principles**. An operating system (OS) is the software layer that manages your computer's hardware resources and provides services to applications. Every time you open a file, run a program, or browse the web, the OS is working behind the scenes to make it happen. CS111 focuses on *how* and *why* operating systems are designed the way they are — and these principles apply far beyond just OS design.`,
            keyPoints: [
                "An OS manages hardware resources (CPU, memory, disk, network) on behalf of applications",
                "CS111 studies the design principles behind operating systems, not just the implementation",
                "These principles — like layering and modularity — are fundamental to all of systems engineering",
                "The course covers filesystems, multiprocessing, concurrency, and more"
            ]
        },
        {
            id: "why-os",
            title: "Why Study Operating Systems?",
            content: `Operating systems are one of the most complex pieces of software ever built. The Linux kernel alone has over **30 million lines of code**. How can anyone build — or understand — something that complex? The answer lies in **managing complexity**: breaking a huge problem into smaller, more manageable pieces using well-defined design principles. These same principles apply to any large-scale system you'll ever build.`,
            keyPoints: [
                "OS complexity requires principled engineering approaches",
                "The key challenge: managing complexity in large software systems",
                "Design principles from OS engineering apply broadly to all systems",
                "CS111 teaches you to think about system design, not just coding"
            ],
            diagram: `
┌─────────────────────────────────────────────────────┐
│                  Applications                        │
│         (web browser, text editor, games)             │
├─────────────────────────────────────────────────────┤
│              Operating System                        │
│  ┌─────────────┬───────────┬────────────────────┐   │
│  │ Filesystem  │ Processes │    Memory Mgmt     │   │
│  │  Management │ & Threads │                    │   │
│  └─────────────┴───────────┴────────────────────┘   │
├─────────────────────────────────────────────────────┤
│                   Hardware                           │
│         (CPU, RAM, disk, network card)                │
└─────────────────────────────────────────────────────┘
      `
        },
        {
            id: "complexity",
            title: "Managing Complexity",
            content: `The central theme of CS111 is **managing complexity**. Complex systems must be designed so that individual components can be understood, implemented, and debugged independently. Without deliberate structure, the interactions between parts of a system grow out of control. The key weapons against complexity are **modularity**, **layering**, and **naming/abstraction**.`,
            keyPoints: [
                "Complexity is the #1 enemy of reliable software systems",
                "Modularity: divide a system into independent components with well-defined interfaces",
                "Layering: organize modules in a hierarchy where each layer builds on the one below",
                "Naming/abstraction: use human-readable names to hide internal implementation details",
                "These three principles recur throughout the entire course"
            ],
            codeExample: {
                title: "Complexity without modularity vs. with modularity",
                language: "c",
                code: `// WITHOUT modularity — everything tangled together:
void do_everything(char *path) {
    // Read raw disk bytes, parse inode, follow pointers,
    // scan directory entries, lookup name, read file data...
    // This is hundreds of lines of intertwined code!
}

// WITH modularity — clean separation of concerns:

// Layer 1: Block layer — reads raw disk sectors
int diskimg_readsector(int fd, int sectorNum, void *buf);

// Layer 2: Inode layer — finds and reads inodes
int inode_iget(struct unixfilesystem *fs, int inumber, struct inode *inp);
int inode_indexlookup(struct unixfilesystem *fs, struct inode *inp, int blockIndex);

// Layer 3: File layer — reads file data
int file_getblock(struct unixfilesystem *fs, int inumber, int blockIndex, void *buf);

// Layer 4: Directory layer — finds names in directories
int directory_findname(struct unixfilesystem *fs, const char *name,
                       int dirinumber, struct direntv6 *dirEnt);

// Layer 5: Pathname layer — resolves full paths
int pathname_lookup(struct unixfilesystem *fs, const char *pathname);`,
                annotations: [
                    { match: "do_everything", explanation: "A monolithic function that tries to do everything at once. This is fragile, hard to test, and impossible to reuse. Any bug could be anywhere." },
                    { match: "diskimg_readsector", explanation: "Block layer: the lowest level. Reads a single 512-byte sector from disk. Above this layer, we don't worry about hardware communication." },
                    { match: "inode_iget", explanation: "Inode layer: fetches an inode from disk by its inode number. Builds on the block layer to read the right disk sector." },
                    { match: "inode_indexlookup", explanation: "Inode layer: translates a logical file block index (0, 1, 2...) to a physical disk block number. Handles direct and indirect addressing." },
                    { match: "file_getblock", explanation: "File layer: reads actual file data by combining inode_iget, inode_indexlookup, and diskimg_readsector. Returns meaningful bytes from a file block." },
                    { match: "directory_findname", explanation: "Directory layer: searches a directory for a named entry. Uses file_getblock to read directory contents and scan for matching names." },
                    { match: "pathname_lookup", explanation: "Pathname layer: resolves a full path like '/usr/class/cs111/hello.txt' by splitting it into components and using directory_findname repeatedly." }
                ]
            }
        },
        {
            id: "modularity",
            title: "Modularity",
            content: `**Modularity** means dividing a system into self-contained components (modules) that interact through well-defined **interfaces**. Each module hides its internal implementation details — this is called **information hiding**. The benefit: you can change how a module works internally without affecting anything else, as long as the interface stays the same.`,
            keyPoints: [
                "A module has an interface (what it does) and an implementation (how it does it)",
                "Information hiding: internal details are invisible to other modules",
                "Benefit: modules can be developed, tested, and debugged independently",
                "In C: the .h file defines the interface; the .c file provides the implementation",
                "Example: diskimg.h defines what the block layer does; diskimg.c implements it"
            ],
            codeExample: {
                title: "Interface (.h) vs. Implementation (.c)",
                language: "c",
                code: `/* ===== diskimg.h (INTERFACE) ===== */
/* Clients only see WHAT the module does, not HOW */

#define DISKIMG_SECTOR_SIZE 512

// Read a sector from the disk image into buf
// Returns number of bytes read, or -1 on error
int diskimg_readsector(int dfd, int sectorNum, void *buf);


/* ===== diskimg.c (IMPLEMENTATION) ===== */
/* The HOW is hidden here — clients never see this */

#include "diskimg.h"
#include <unistd.h>

int diskimg_readsector(int dfd, int sectorNum, void *buf) {
    // Seek to the right position on disk
    off_t offset = sectorNum * DISKIMG_SECTOR_SIZE;
    if (lseek(dfd, offset, SEEK_SET) < 0) {
        return -1;  // Error seeking
    }
    // Read 512 bytes into the buffer
    int bytesRead = read(dfd, buf, DISKIMG_SECTOR_SIZE);
    return bytesRead;
}`,
                annotations: [
                    { match: "diskimg.h", explanation: "The header file IS the interface. It declares function prototypes and constants that other modules can use. It never reveals implementation details." },
                    { match: "diskimg.c", explanation: "The source file IS the implementation. It #includes its own header to ensure the declarations match, then provides the actual code." },
                    { match: "DISKIMG_SECTOR_SIZE", explanation: "A constant defining the disk block/sector size: 512 bytes. This is part of the interface because all layers need to know this value." },
                    { match: "dfd", explanation: "Disk file descriptor — a handle to the open disk image file. The block layer manages this so upper layers don't need to worry about file I/O." },
                    { match: "sectorNum", explanation: "The disk sector number to read (0-indexed). Each sector is 512 bytes, so sector N starts at byte offset N × 512." },
                    { match: "lseek", explanation: "A system call that moves the read/write position in a file. Used here to jump to the correct disk sector before reading." },
                    { match: "read", explanation: "A system call that reads bytes from a file descriptor into a buffer. Returns the number of bytes actually read." }
                ]
            }
        },
        {
            id: "layering",
            title: "Layering",
            content: `**Layering** organizes modules in a stack where each layer only depends on the layer directly below it. This creates a clear hierarchy: higher layers are more abstract and user-friendly; lower layers deal with raw hardware details. Each layer provides a cleaner, simpler interface to the layer above.`,
            keyPoints: [
                "Each layer builds on the layer below it, providing a higher-level abstraction",
                "Lower layers handle raw details (disk blocks); higher layers handle human concepts (file paths)",
                "A layer should only call functions from the layer directly below it",
                "Layering makes it possible to swap out implementations (e.g., different disk hardware)",
                "The Unix V6 filesystem (assign1) is a perfect example of layered design"
            ],
            diagram: `
Unix V6 Filesystem Layers (from assign1):

┌─────────────────────────────────────────────┐
│  Layer 5: Pathname Layer                     │
│  pathname_lookup("/usr/class/cs111/hello")   │
│  "Give me the inode for this full path"      │
├─────────────────────────────────────────────┤
│  Layer 4: Directory Layer                    │
│  directory_findname(fs, "hello", dirInum)    │
│  "Find this name in a specific directory"    │
├─────────────────────────────────────────────┤
│  Layer 3: File Layer                         │
│  file_getblock(fs, inumber, blockIdx, buf)   │
│  "Read block N of this file's data"          │
├─────────────────────────────────────────────┤
│  Layer 2: Inode Layer                        │
│  inode_iget(fs, inumber, &inode)             │
│  inode_indexlookup(fs, &inode, blockIdx)     │
│  "Get metadata / translate block index"      │
├─────────────────────────────────────────────┤
│  Layer 1: Block Layer (provided)             │
│  diskimg_readsector(dfd, sectorNum, buf)     │
│  "Read raw 512-byte sector from disk"        │
└─────────────────────────────────────────────┘
      `,
            codeExample: {
                title: "How layers build on each other",
                language: "c",
                code: `// Each layer uses ONLY the layer below it.
// This is the layering principle in action.

// BLOCK LAYER: reads raw sectors from disk
int diskimg_readsector(int dfd, int sectorNum, void *buf);

// INODE LAYER: uses block layer to read inodes
int inode_iget(const struct unixfilesystem *fs, int inumber,
        struct inode *inp) {
    // Calculate which disk sector contains this inode
    int sector = INODE_START_SECTOR + 
                 (inumber - 1) / INODES_PER_SECTOR;
    
    // Use the BLOCK LAYER to read that sector
    struct inode inodes[INODES_PER_SECTOR];
    if (diskimg_readsector(fs->dfd, sector, inodes) 
            != DISKIMG_SECTOR_SIZE) {
        return -1;
    }
    
    // Extract the specific inode
    *inp = inodes[(inumber - 1) % INODES_PER_SECTOR];
    return 0;
}

// FILE LAYER: uses inode layer to read file data
int file_getblock(const struct unixfilesystem *fs, int inumber,
        int fileBlockIndex, void *buf) {
    // Use the INODE LAYER to get the inode
    struct inode inp;
    if (inode_iget(fs, inumber, &inp) < 0) return -1;
    
    // Use the INODE LAYER to find the disk block
    int blockNum = inode_indexlookup(fs, &inp, fileBlockIndex);
    if (blockNum < 0) return -1;
    
    // Use the BLOCK LAYER to read the actual data
    if (diskimg_readsector(fs->dfd, blockNum, buf) 
            != DISKIMG_SECTOR_SIZE) {
        return -1;
    }
    
    // Return number of valid bytes in this block
    int size = inode_getsize(&inp);
    int offset = fileBlockIndex * DISKIMG_SECTOR_SIZE;
    int remaining = size - offset;
    return (remaining > DISKIMG_SECTOR_SIZE) 
           ? DISKIMG_SECTOR_SIZE : remaining;
}`,
                annotations: [
                    { match: "INODE_START_SECTOR", explanation: "Constant from unixfilesystem.h — the first disk sector containing inodes (sector 2, after the boot block and superblock)." },
                    { match: "INODES_PER_SECTOR", explanation: "How many inodes fit in one 512-byte sector. Each inode is 32 bytes, so 512/32 = 16 inodes per sector." },
                    { match: "inumber - 1", explanation: "Inumbers start at 1 (not 0), so we subtract 1 to convert to a 0-based index for array math." },
                    { match: "inode_iget", explanation: "This function demonstrates layering: it uses only the block layer (diskimg_readsector) to do its job. Higher layers call inode_iget instead of reading disk sectors directly." },
                    { match: "file_getblock", explanation: "Notice how this function uses inode_iget and inode_indexlookup (inode layer) and diskimg_readsector (block layer). It builds on the layers below." },
                    { match: "inode_indexlookup", explanation: "Translates a logical file block index to a physical disk sector number. Handles both small (direct) and large (indirect) files." },
                    { match: "inode_getsize", explanation: "Helper that combines i_size0 (8 bits) and i_size1 (16 bits) into a full 24-bit file size: (i_size0 << 16) | i_size1." },
                    { match: "remaining", explanation: "The last block of a file may not be fully used. We return the actual number of valid bytes (which may be less than 512)." }
                ]
            }
        },
        {
            id: "naming",
            title: "Naming and Abstraction",
            content: `**Naming** provides human-readable identifiers for resources that are actually identified by numbers internally. A filepath like \"/home/user/essay.txt\" is a name that maps to an **inode number**, which is how the filesystem actually identifies files. This separation of names from internal identifiers is a powerful abstraction.`,
            keyPoints: [
                "Names map human-readable strings to machine-friendly identifiers",
                "File paths → inode numbers (e.g., '/home/user/file.txt' → inode #42)",
                "The mapping from name → number is called 'name resolution' or 'lookup'",
                "Names can be changed without affecting the underlying data",
                "Multiple names can refer to the same resource (hard links)",
                "This concept appears everywhere: DNS names → IP addresses, variable names → memory addresses"
            ],
            diagram: `
Naming in the Unix V6 Filesystem:

  Human-Friendly Names              Machine-Friendly Numbers
  ─────────────────────             ─────────────────────────
  /                          →      inode #1 (root directory)
  /usr                       →      inode #6
  /usr/class                 →      inode #12
  /usr/class/cs111           →      inode #45
  /usr/class/cs111/hello.txt →      inode #78

  Name Resolution Process:
  ┌──────┐    ┌──────┐    ┌───────┐    ┌───────┐    ┌───────┐
  │  /   │ →  │ usr  │ →  │ class │ →  │ cs111 │ →  │hello  │
  │ in:1 │    │ in:6 │    │ in:12 │    │ in:45 │    │ in:78 │
  └──────┘    └──────┘    └───────┘    └───────┘    └───────┘
  Each step: scan directory entries for a matching name,
             then follow the inode number for the next step.
      `
        },
        {
            id: "course-topics",
            title: "CS111 Course Topics",
            content: `CS111 covers three major topic areas, each applying the complexity management principles above to a different part of the OS. The topics build on each other throughout the quarter.`,
            keyPoints: [
                "📂 Filesystems (Lectures 1-7, Assign 1-2): How the OS stores and retrieves files on disk",
                "⚙️ Multiprocessing (Lectures 8-11, Assign 3): How the OS runs multiple programs simultaneously",
                "🔒 Concurrency (Lectures 12-15, Assign 4): How threads coordinate shared resources safely",
                "Each topic applies modularity, layering, and naming in a different context",
                "The midterm covers all material through the first part of concurrency (through week 5)"
            ],
            diagram: `
CS111 Course Roadmap:

Week 1-2:  Filesystems             → Assign 1: Reading Unix V6 FS
           ┌─────────────────────────────────────────────┐
           │ Disk layout, inodes, directories, paths     │
           │ Layered design: block → inode → file → dir  │
           └─────────────────────────────────────────────┘

Week 2-3:  Crash Recovery           → Assign 2: Journaling + OS Trust
           ┌─────────────────────────────────────────────┐
           │ What happens when power fails mid-write?    │
           │ Journaling, transactions, consistency       │
           └─────────────────────────────────────────────┘

Week 3-4:  Multiprocessing          → Assign 3: Stanford Shell
           ┌─────────────────────────────────────────────┐
           │ fork, execvp, waitpid, pipes, file desc.    │
           │ How the shell runs programs                 │
           └─────────────────────────────────────────────┘

Week 5-6:  Concurrency              → Assign 4: Multithreading
           ┌─────────────────────────────────────────────┐
           │ Threads, race conditions, mutexes, CVs      │
           │ Safe coordination of shared resources       │
           └─────────────────────────────────────────────┘

           ──── Midterm covers through Week 5 ────
      `
        },
        {
            id: "assign1-preview",
            title: "Preview: Assignment 1",
            content: `Your first assignment is **Reading Unix V6 Filesystems**. Unix V6 was released in 1975 and was the first widely-used version of Unix. Despite being tiny (under 64KB of code!), it had many of the features found in modern Linux. You will implement the four upper layers of the V6 filesystem to read files from a 1975-style disk image. This assignment is the perfect case study for layering and modularity.`,
            keyPoints: [
                "You implement 4 layers: inode, file, directory, and pathname (block layer is provided)",
                "Work in C — the same language used for the original Unix V6",
                "Each layer builds on the one below it (layering in action!)",
                "By the end, your program can list and read files from a Unix V6 disk image",
                "Key data structures: struct inode (file metadata), struct direntv6 (directory entry)",
                "Important: test incrementally — verify each layer works before moving to the next"
            ],
            codeExample: {
                title: "The key data structures you'll work with in assign1",
                language: "c",
                code: `/* struct inode — metadata for a single file (from ino.h) */
struct inode {
    uint16_t  i_mode;     // file type + permissions (bit vector)
    uint8_t   i_nlink;    // # of directory entries pointing here
    uint8_t   i_uid;      // owner user ID
    uint8_t   i_gid;      // owner group ID  
    uint8_t   i_size0;    // most significant byte of file size
    uint16_t  i_size1;    // lower 2 bytes of file size
    uint16_t  i_addr[8];  // block numbers for file data
    uint16_t  i_atime[2]; // last access time
    uint16_t  i_mtime[2]; // last modification time
};

// Important mode flags:
#define IALLOC  0x8000  // inode is allocated (in use)
#define IFDIR   0x4000  // this is a directory, not a regular file
#define ILARG   0x1000  // large file (uses indirect blocks)

/* struct direntv6 — one entry in a directory (from direntv6.h) */
#define MAX_COMPONENT_LENGTH 14

struct direntv6 {
    uint16_t d_inumber;                   // inode number (2 bytes)
    char     d_name[MAX_COMPONENT_LENGTH]; // filename (14 bytes)
};
// Total: 16 bytes per directory entry
// 512 / 16 = 32 entries fit in one disk block`,
                annotations: [
                    { match: "i_mode", explanation: "A 16-bit field combining file type and permissions. Check (i_mode & IALLOC) to see if inode is in use, (i_mode & IFDIR) for directory, (i_mode & ILARG) for large file." },
                    { match: "i_nlink", explanation: "Link count — the number of directory entries (hard links) pointing to this inode. When it reaches 0 and no process has the file open, the inode is freed." },
                    { match: "i_size0", explanation: "Most significant 8 bits of the file size. Combined with i_size1 to form a 24-bit size value: (i_size0 << 16) | i_size1. Max file size ≈ 16MB." },
                    { match: "i_size1", explanation: "Lower 16 bits of the file size. The full size formula is (i_size0 << 16) | i_size1. A helper function inode_getsize() does this for you." },
                    { match: "i_addr[8]", explanation: "Array of 8 block numbers. For SMALL files, these point directly to data blocks (up to 8 × 512 = 4KB). For LARGE files, they point to indirect blocks." },
                    { match: "IALLOC", explanation: "Bit 15 of i_mode. If set (i_mode & IALLOC != 0), this inode slot is in use. If not set, the slot is free/available." },
                    { match: "IFDIR", explanation: "Bit 14 of i_mode. If set, this inode represents a directory (its data blocks contain directory entries, not regular file data)." },
                    { match: "ILARG", explanation: "Bit 12 of i_mode. If set, the file uses the 'large' addressing scheme: i_addr entries point to indirect blocks instead of data blocks directly." },
                    { match: "d_inumber", explanation: "The inode number of the file/directory this entry refers to. A value of 0 means the entry is empty/deleted." },
                    { match: "d_name", explanation: "The filename, up to 14 characters. CAUTION: if the name is exactly 14 characters, it is NOT null-terminated! Always use strncmp, never strcmp." },
                    { match: "MAX_COMPONENT_LENGTH", explanation: "Maximum filename length in Unix V6: 14 characters. This is why strncmp is essential — names can fill all 14 bytes with no '\\0'." }
                ]
            }
        },
        {
            id: "disk-layout",
            title: "Unix V6 Disk Layout",
            content: `Before diving into the filesystem layers, it helps to understand how a Unix V6 disk is organized. The disk is divided into fixed-size **sectors** (also called blocks) of **512 bytes** each. The first few sectors have special purposes, and the rest store file data.`,
            keyPoints: [
                "Disk is an array of 512-byte sectors, numbered 0, 1, 2, ...",
                "Sector 0: Boot block (contains bootloader code — we ignore this)",
                "Sector 1: Superblock (filesystem metadata — total size, free block info)",
                "Sectors 2 through 2+s_isize-1: Inode table (all file/directory metadata)",
                "Remaining sectors: Data blocks (actual file contents and indirect blocks)",
                "Each inode is 32 bytes → 16 inodes per 512-byte sector"
            ],
            diagram: `
Unix V6 Disk Layout:

Sector:  0         1          2  3  4  ...        N  N+1  ...
       ┌─────┐  ┌─────────┐  ┌──────────────┐  ┌──────────────┐
       │Boot │  │ Super-  │  │   Inode      │  │    Data      │
       │Block│  │  block  │  │   Table      │  │   Blocks     │
       │     │  │         │  │  (metadata   │  │  (file data  │
       │     │  │ s_isize │  │   for all    │  │   + indirect │
       │     │  │ s_fsize │  │   files)     │  │   blocks)    │
       └─────┘  └─────────┘  └──────────────┘  └──────────────┘
       512 B     512 B        Variable size      Rest of disk

Key constants (from unixfilesystem.h):
  INODE_START_SECTOR = 2     (first inode sector)
  ROOT_INUMBER = 1           (root directory's inode number)
  DISKIMG_SECTOR_SIZE = 512  (bytes per sector)

Inode numbering:
  Sector 2: inodes 1-16    (inodes are 1-indexed!)
  Sector 3: inodes 17-32
  Sector 4: inodes 33-48
  ...
  Formula: sector = 2 + (inumber - 1) / 16
      `,
            codeExample: {
                title: "Key filesystem constants you'll use in assign1",
                language: "c",
                code: `/* From unixfilesystem.h */
#define ROOT_INUMBER 1          // root directory is always inode #1
#define INODE_START_SECTOR 2    // inodes start at disk sector 2

/* From diskimg.h */
#define DISKIMG_SECTOR_SIZE 512 // each disk sector is 512 bytes

/* From ino.h — each inode is 32 bytes */
// 512 bytes/sector ÷ 32 bytes/inode = 16 inodes/sector

/* From direntv6.h — each directory entry is 16 bytes */
// 512 bytes/sector ÷ 16 bytes/entry = 32 entries/sector

/* Useful calculations: */
// Which sector contains inode N?
//   sector = INODE_START_SECTOR + (N - 1) / 16

// Which index within that sector?
//   index = (N - 1) % 16

// How many data blocks does a file of size S need?
//   numBlocks = (S + DISKIMG_SECTOR_SIZE - 1) / DISKIMG_SECTOR_SIZE

// File size from inode fields:
//   size = (i_size0 << 16) | i_size1`,
                annotations: [
                    { match: "ROOT_INUMBER", explanation: "The root directory '/' always has inode number 1 in Unix V6. Inode 0 is reserved as NULL/invalid, similar to how NULL pointers work." },
                    { match: "INODE_START_SECTOR", explanation: "Inodes begin at sector 2 on disk. Sector 0 is the boot block, sector 1 is the superblock, and the inode table starts at sector 2." },
                    { match: "DISKIMG_SECTOR_SIZE", explanation: "Every disk operation reads or writes exactly 512 bytes. This is the fundamental unit of disk I/O." },
                    { match: "N - 1", explanation: "Inodes are 1-indexed (first valid inode = 1), but arithmetic is 0-indexed. Always subtract 1 before dividing or taking modulo." },
                    { match: "numBlocks", explanation: "Ceiling division trick: adding (SECTOR_SIZE - 1) before dividing rounds up, ensuring partial blocks are counted. e.g., 513 bytes → 2 blocks." },
                    { match: "i_size0 << 16", explanation: "The file size is stored as a 24-bit number split across two fields. Shifting i_size0 left by 16 bits puts it in the correct position, then OR with i_size1." }
                ]
            }
        },
        {
            id: "error-handling",
            title: "Error Handling in Systems Code",
            content: `A crucial aspect of systems programming is **error handling**. Real systems must gracefully handle errors at every level — disk read failures, invalid inputs, missing files, etc. In CS111, every function that can fail returns **-1 on error**, and you must print a descriptive message to **stderr**. Error handling isn't optional; it's a core requirement.`,
            keyPoints: [
                "Every function that can fail should return -1 on error",
                "Always check return values of functions you call (especially lower-layer functions)",
                "Print descriptive error messages to stderr using fprintf(stderr, ...)",
                "Error messages should include context: which function, what argument, what went wrong",
                "If a lower-layer function fails, the calling function should also return -1",
                "One exception: directory_findname should NOT print an error if a name simply isn't found"
            ],
            codeExample: {
                title: "Proper error handling pattern in systems code",
                language: "c",
                code: `// GOOD: Check every return value, print descriptive errors
int inode_iget(const struct unixfilesystem *fs, int inumber,
        struct inode *inp) {
    struct inode inodes[16];  // buffer for one sector of inodes
    
    int sector = INODE_START_SECTOR + (inumber - 1) / 16;
    
    // Check for errors from the layer below!
    if (diskimg_readsector(fs->dfd, sector, inodes) 
            != DISKIMG_SECTOR_SIZE) {
        fprintf(stderr, 
            "inode_iget: error reading sector %d for inumber %d\\n",
            sector, inumber);
        return -1;
    }
    
    *inp = inodes[(inumber - 1) % 16];
    return 0;  // success
}

// BAD: Ignoring errors — DON'T DO THIS!
int inode_iget_bad(const struct unixfilesystem *fs, int inumber,
        struct inode *inp) {
    struct inode inodes[16];
    int sector = INODE_START_SECTOR + (inumber - 1) / 16;
    
    diskimg_readsector(fs->dfd, sector, inodes);  // ← no error check!
    // If the read failed, inodes contains garbage!
    
    *inp = inodes[(inumber - 1) % 16];
    return 0;  // ← claims success even on failure!
}`,
                annotations: [
                    { match: "DISKIMG_SECTOR_SIZE", explanation: "diskimg_readsector returns the number of bytes read (512 on success) or -1 on error. Comparing against DISKIMG_SECTOR_SIZE catches both error cases." },
                    { match: "fprintf(stderr", explanation: "Always print errors to stderr (not stdout). This separates error output from normal output, making debugging and testing much easier." },
                    { match: "return -1", explanation: "The universal error return value in Unix systems programming. Callers check for -1 to know if something went wrong." },
                    { match: "return 0", explanation: "Return 0 to indicate success. This is the standard Unix convention: 0 = success, -1 = error." },
                    { match: "inode_iget_bad", explanation: "This version silently ignores disk read errors. If the read fails, inodes contains garbage data, leading to mysterious bugs that are extremely hard to track down." },
                    { match: "no error check", explanation: "NEVER ignore return values in systems code. A disk read can fail for many reasons (bad disk, invalid sector, etc.). Without checking, you'll use garbage data." }
                ]
            }
        },
        {
            id: "exam-prep",
            title: "🎯 Midterm Prep: What to Know from Lecture 1",
            content: `Lecture 1 introduces the fundamental design principles that underpin the entire course. The midterm will test your understanding of these principles — not just memorizing definitions, but applying them. You should be comfortable explaining WHY layering and modularity matter and HOW they are applied in the Unix V6 filesystem.`,
            keyPoints: [
                "📝 Know the three complexity management tools: modularity, layering, naming",
                "📝 Modularity = independent components + well-defined interfaces + information hiding",
                "📝 Layering = hierarchical organization where each layer uses only the layer below",
                "📝 Naming = mapping human-readable names to machine identifiers (paths → inumbers)",
                "📝 Know the 5 Unix V6 filesystem layers: block → inode → file → directory → pathname",
                "📝 Understand the disk layout: boot block (0), superblock (1), inodes (2+), data blocks",
                "📝 Key formula: inode sector = INODE_START_SECTOR + (inumber - 1) / 16",
                "📝 Key formula: file size = (i_size0 << 16) | i_size1",
                "📝 Always use strncmp (not strcmp) for directory name comparison — names may not be null-terminated"
            ],
            diagram: `
Midterm Cheat Sheet — Lecture 1 Key Concepts:

┌──────────────────────────────────────────────────────────┐
│  CONCEPT              │  KEY FACT                         │
├──────────────────────────────────────────────────────────┤
│  Modularity           │  Interface (.h) hides             │
│                       │  implementation (.c)               │
├──────────────────────────────────────────────────────────┤
│  Layering             │  Each layer calls only             │
│                       │  the layer directly below          │
├──────────────────────────────────────────────────────────┤
│  Naming               │  Paths → inode numbers             │
│                       │  via directory traversal            │
├──────────────────────────────────────────────────────────┤
│  Disk layout          │  Boot(0), Super(1),                │
│                       │  Inodes(2+), Data blocks           │
├──────────────────────────────────────────────────────────┤
│  Sector size          │  512 bytes                         │
├──────────────────────────────────────────────────────────┤
│  Inodes per sector    │  16 (32 bytes each)                │
├──────────────────────────────────────────────────────────┤
│  Dir entries per      │  32 (16 bytes each:                │
│  sector               │  2B inumber + 14B name)            │
├──────────────────────────────────────────────────────────┤
│  Root inode           │  Inode #1 (0 = NULL)               │
├──────────────────────────────────────────────────────────┤
│  Error handling       │  Return -1 and print to stderr     │
└──────────────────────────────────────────────────────────┘
      `
        },
        {
            id: "summary",
            title: "Lecture 1 Summary",
            content: `CS111 is about managing complexity in operating systems through principled design. The three key tools are **modularity** (independent components with interfaces), **layering** (hierarchical organization), and **naming** (human-readable abstractions). These principles will guide everything we build this quarter.`,
            keyPoints: [
                "An OS manages hardware resources and provides services to applications",
                "The central challenge: managing complexity in large systems",
                "Modularity: divide into independent modules with clear interfaces",
                "Layering: stack modules so each builds on the layer below",
                "Naming: map human-readable names to machine identifiers",
                "The Unix V6 filesystem (assign1) perfectly demonstrates all three principles",
                "Next up: Lecture 2 dives into the details of filesystem design"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Filesystem Layer Identification",
            difficulty: "easy",
            description: "For each function call below, identify which filesystem layer it belongs to: block, inode, file, directory, or pathname.",
            hint: "Think about what each function does and what level of abstraction it operates at.",
            starterCode: `// Identify the layer for each function:

// 1. diskimg_readsector(fs->dfd, 5, buf)
//    Layer: ____

// 2. inode_iget(fs, 42, &inode)
//    Layer: ____

// 3. directory_findname(fs, "hello.txt", 1, &dirEnt)
//    Layer: ____

// 4. pathname_lookup(fs, "/usr/class/cs111/hello.txt")
//    Layer: ____

// 5. file_getblock(fs, 42, 0, buf)
//    Layer: ____`,
            solution: `// Identify the layer for each function:

// 1. diskimg_readsector(fs->dfd, 5, buf)
//    Layer: BLOCK (reads raw 512-byte sectors from disk)

// 2. inode_iget(fs, 42, &inode)
//    Layer: INODE (fetches metadata for a file by inode number)

// 3. directory_findname(fs, "hello.txt", 1, &dirEnt)
//    Layer: DIRECTORY (searches a directory for a named entry)

// 4. pathname_lookup(fs, "/usr/class/cs111/hello.txt")
//    Layer: PATHNAME (resolves a full absolute path)

// 5. file_getblock(fs, 42, 0, buf)
//    Layer: FILE (reads actual file data blocks)`,
            explanation: "The layers from bottom to top: block → inode → file → directory → pathname. Each layer provides a higher level of abstraction. The block layer deals with raw disk sectors, while the pathname layer deals with human-readable file paths."
        },
        {
            id: "ex2",
            title: "Inode Sector Calculation",
            difficulty: "easy",
            description: "Given that inodes start at sector 2 and there are 16 inodes per sector, calculate which disk sector contains each of the following inodes.",
            hint: "Remember: inodes are 1-indexed (first inode = 1, not 0). Use the formula: sector = 2 + (inumber - 1) / 16",
            starterCode: `#define INODE_START_SECTOR 2
#define INODES_PER_SECTOR 16

// Which sector contains inode #1?
// sector = 2 + (1 - 1) / 16 = 2 + 0 = ____

// Which sector contains inode #16?
// sector = 2 + (16 - 1) / 16 = 2 + ____ = ____

// Which sector contains inode #17?
// sector = 2 + (17 - 1) / 16 = 2 + ____ = ____

// Which sector contains inode #50?
// sector = 2 + (50 - 1) / 16 = 2 + ____ = ____

// At what INDEX within its sector is inode #50?
// index = (50 - 1) % 16 = ____`,
            solution: `#define INODE_START_SECTOR 2
#define INODES_PER_SECTOR 16

// Which sector contains inode #1?
// sector = 2 + (1 - 1) / 16 = 2 + 0 = 2

// Which sector contains inode #16?
// sector = 2 + (16 - 1) / 16 = 2 + 0 = 2
// (inode 16 is the LAST inode in sector 2)

// Which sector contains inode #17?
// sector = 2 + (17 - 1) / 16 = 2 + 1 = 3
// (inode 17 is the FIRST inode in sector 3)

// Which sector contains inode #50?
// sector = 2 + (50 - 1) / 16 = 2 + 3 = 5

// At what INDEX within its sector is inode #50?
// index = (50 - 1) % 16 = 49 % 16 = 1
// (it's the SECOND inode in sector 5, at index 1)`,
            explanation: "The formula sector = INODE_START_SECTOR + (inumber - 1) / 16 works because we subtract 1 to convert from 1-indexed to 0-indexed, then divide by 16 to find which sector, and add the start sector offset. The modulo gives the position within the sector."
        },
        {
            id: "ex3",
            title: "File Size Calculation",
            difficulty: "easy",
            description: "The file size in Unix V6 is split across two inode fields. Write a function to combine them into a single integer.",
            hint: "i_size0 is the most significant byte (8 bits), i_size1 is the lower 16 bits. Shift and OR to combine them.",
            starterCode: `int inode_getsize(struct inode *inp) {
    // i_size0: uint8_t  (most significant 8 bits)
    // i_size1: uint16_t (lower 16 bits)
    
    // Combine into a 24-bit size value:
    return ____;
}

// Test cases:
// i_size0 = 0x00, i_size1 = 0x0200 → size = ____
// i_size0 = 0x01, i_size1 = 0x0000 → size = ____
// i_size0 = 0x01, i_size1 = 0x2345 → size = ____`,
            solution: `int inode_getsize(struct inode *inp) {
    // i_size0: uint8_t  (most significant 8 bits)
    // i_size1: uint16_t (lower 16 bits)
    
    // Shift i_size0 left by 16, then OR with i_size1
    return (inp->i_size0 << 16) | inp->i_size1;
}

// Test cases:
// i_size0 = 0x00, i_size1 = 0x0200 → size = 512 bytes (one block)
// i_size0 = 0x01, i_size1 = 0x0000 → size = 65,536 bytes (64KB)
// i_size0 = 0x01, i_size1 = 0x2345 → size = 74,565 bytes`,
            explanation: "The file size is a 24-bit number stored in two pieces. We shift the upper 8 bits (i_size0) left by 16 positions, then OR it with the lower 16 bits (i_size1). This bit manipulation is a common pattern in systems code where values are stored compactly to save space."
        },
        {
            id: "ex4",
            title: "Layering Violation Detection",
            difficulty: "medium",
            description: "Identify which of the following code snippets violates the layering principle, and explain why.",
            hint: "Each layer should only call functions from the layer directly below it. If a higher layer reaches down two levels, it's 'breaking the layering'.",
            starterCode: `// Snippet A:
int pathname_lookup(const struct unixfilesystem *fs, 
                    const char *pathname) {
    int currentDirInumber = ROOT_INUMBER;
    // ... split path, for each component:
    struct direntv6 dirEnt;
    directory_findname(fs, component, currentDirInumber, &dirEnt);
    currentDirInumber = dirEnt.d_inumber;
    // ...
    return currentDirInumber;
}

// Snippet B:
int pathname_lookup_v2(const struct unixfilesystem *fs, 
                        const char *pathname) {
    int currentDirInumber = ROOT_INUMBER;
    // ... split path, for each component:
    struct inode dirInode;
    inode_iget(fs, currentDirInumber, &dirInode);
    // manually scan blocks for directory entry...
    // ...
    return currentDirInumber;
}

// Which snippet violates layering? ____
// Why? ____`,
            solution: `// Snippet A: ✅ GOOD — follows layering
// pathname layer calls directory layer (one level below)
int pathname_lookup(const struct unixfilesystem *fs, 
                    const char *pathname) {
    int currentDirInumber = ROOT_INUMBER;
    // ... split path, for each component:
    struct direntv6 dirEnt;
    directory_findname(fs, component, currentDirInumber, &dirEnt);
    currentDirInumber = dirEnt.d_inumber;
    // ...
    return currentDirInumber;
}

// Snippet B: ❌ BAD — violates layering!
// pathname layer reaches down to inode layer (skipping 
// directory and file layers), then manually does what
// the directory layer should do.
int pathname_lookup_v2(const struct unixfilesystem *fs, 
                        const char *pathname) {
    int currentDirInumber = ROOT_INUMBER;
    // ... split path, for each component:
    struct inode dirInode;
    inode_iget(fs, currentDirInumber, &dirInode);
    // manually scan blocks for directory entry...
    // ...
    return currentDirInumber;
}

// Snippet B violates layering because the pathname layer 
// should NOT directly call inode_iget or manually scan 
// directory blocks. That work belongs to the directory layer.
// The pathname layer should only call directory_findname.`,
            explanation: "Layering means each layer should only use the layer directly below it. In Snippet B, the pathname layer bypasses the directory layer and reaches down to the inode layer. This defeats the purpose of having separate layers — if the directory format ever changes, you'd have to fix code in both the directory and pathname layers."
        },
        {
            id: "ex5",
            title: "Ceiling Division Practice",
            difficulty: "easy",
            description: "A common operation in filesystems is calculating how many blocks a file of a given size needs. This requires 'ceiling division' (rounding up). Practice computing the number of blocks needed.",
            hint: "The formula for ceiling division is: (size + blockSize - 1) / blockSize. This works because adding blockSize-1 before integer division rounds up.",
            starterCode: `#define BLOCK_SIZE 512

// How many 512-byte blocks does each file need?

// File A: 512 bytes
// numBlocks = (512 + 511) / 512 = ____

// File B: 513 bytes
// numBlocks = (513 + 511) / 512 = ____

// File C: 0 bytes (empty file)
// numBlocks = (0 + 511) / 512 = ____

// File D: 1536 bytes (exactly 3 blocks)
// numBlocks = (1536 + 511) / 512 = ____

// File E: 2000 bytes
// numBlocks = (2000 + 511) / 512 = ____`,
            solution: `#define BLOCK_SIZE 512

// How many 512-byte blocks does each file need?

// File A: 512 bytes
// numBlocks = (512 + 511) / 512 = 1023 / 512 = 1 ✓

// File B: 513 bytes
// numBlocks = (513 + 511) / 512 = 1024 / 512 = 2 ✓
// (513 bytes doesn't fit in 1 block, needs 2!)

// File C: 0 bytes (empty file)
// numBlocks = (0 + 511) / 512 = 511 / 512 = 0 ✓

// File D: 1536 bytes (exactly 3 blocks)
// numBlocks = (1536 + 511) / 512 = 2047 / 512 = 3 ✓

// File E: 2000 bytes
// numBlocks = (2000 + 511) / 512 = 2511 / 512 = 4 ✓
// (2000 bytes: 3 full blocks + 1 partial block)`,
            explanation: "Ceiling division using (n + d - 1) / d is a standard trick in systems code. It avoids floating-point math while correctly rounding up. This formula works because: if n is exactly divisible by d, adding d-1 doesn't push it to the next multiple; if n has any remainder, adding d-1 does push it up."
        },
        {
            id: "ex6",
            title: "Inode Mode Flags",
            difficulty: "medium",
            description: "Given different values of i_mode, determine the properties of each inode using bitwise AND.",
            hint: "Use the flag constants: IALLOC (0x8000), IFDIR (0x4000), ILARG (0x1000). Check each flag with (i_mode & FLAG) != 0.",
            starterCode: `#define IALLOC  0x8000  // bit 15: allocated?
#define IFDIR   0x4000  // bit 14: directory?
#define ILARG   0x1000  // bit 12: large file?

// For each i_mode value, determine:
//   - Is the inode allocated?
//   - Is it a directory?
//   - Does it use large file addressing?

// i_mode = 0xC1FF
//   IALLOC: (0xC1FF & 0x8000) = ____ → ____
//   IFDIR:  (0xC1FF & 0x4000) = ____ → ____
//   ILARG:  (0xC1FF & 0x1000) = ____ → ____

// i_mode = 0x91FF
//   IALLOC: (0x91FF & 0x8000) = ____ → ____
//   IFDIR:  (0x91FF & 0x4000) = ____ → ____
//   ILARG:  (0x91FF & 0x1000) = ____ → ____

// i_mode = 0x81FF
//   Is this a large or small regular file? ____`,
            solution: `#define IALLOC  0x8000  // bit 15: allocated?
#define IFDIR   0x4000  // bit 14: directory?
#define ILARG   0x1000  // bit 12: large file?

// i_mode = 0xC1FF
//   IALLOC: (0xC1FF & 0x8000) = 0x8000 → YES (allocated)
//   IFDIR:  (0xC1FF & 0x4000) = 0x4000 → YES (directory)
//   ILARG:  (0xC1FF & 0x1000) = 0x1000 → YES (large addressing)
//   = An allocated directory using large addressing

// i_mode = 0x91FF
//   IALLOC: (0x91FF & 0x8000) = 0x8000 → YES (allocated)
//   IFDIR:  (0x91FF & 0x4000) = 0x0000 → NO (regular file)
//   ILARG:  (0x91FF & 0x1000) = 0x1000 → YES (large)
//   = An allocated large regular file

// i_mode = 0x81FF
//   IALLOC = yes, IFDIR = no, ILARG = no
//   This is a SMALL regular file (allocated, 
//   i_addr points directly to data blocks)`,
            explanation: "Bitwise AND (&) with a flag constant extracts just that bit. If the result is non-zero, the flag is set. In the Unix V6 filesystem, these flags determine how to interpret the inode: whether it's in use, whether it's a directory, and whether i_addr contains direct or indirect block numbers."
        }
    ]
};

export default lecture1;
