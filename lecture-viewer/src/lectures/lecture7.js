export const lecture7 = {
    id: 7,
    title: "File Descriptors and System Calls",
    subtitle: "open(), close(), read(), write() - Interacting with Files",
    keyTakeaway: "System calls are functions provided by the operating system to do tasks we cannot do ourselves. open, close, read, and write are 4 system calls that work via file descriptors to interact with files.",

    sections: [
        {
            id: "overview",
            title: "System Calls and Kernel vs. User Mode",
            content: `System calls are public functions implemented by the operating system that you can use in your program. They perform **privileged tasks** that regular programs cannot do on their own (like reading disk sectors directly).`,
            keyPoints: [
                "OS runs in privileged 'kernel mode' - can do things regular programs cannot",
                "User programs run in regular 'user mode'",
                "System switches to 'kernel mode' when system call runs, switches back after",
                "The kernel completely isolates system-level interaction from (potentially harmful) user programs",
                "Higher-level methods (C++ streams, FILE *) are built on these system calls"
            ],
            diagram: `
User Mode vs Kernel Mode:

┌─────────────────────────────────────────────────────────────┐
│                      USER MODE                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Program A   │  │  Program B   │  │  Program C   │      │
│  │              │  │              │  │              │      │
│  │ open("f.txt")│  │ read(fd,...)│  │ write(fd,...)│      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
└─────────┼─────────────────┼─────────────────┼───────────────┘
          │ SYSTEM CALL     │ SYSTEM CALL     │ SYSTEM CALL
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                     KERNEL MODE                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Operating System Kernel                 │   │
│  │  • Full hardware access                              │   │
│  │  • Can read/write any memory                         │   │
│  │  • Can access disk sectors directly                  │   │
│  │  • Manages file descriptors for each process         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
            `,
            codeExample: {
                title: "System calls vs library functions",
                language: "c",
                code: `// System calls - directly interact with kernel
#include <fcntl.h>    // open, O_RDONLY, etc.
#include <unistd.h>   // read, write, close

int fd = open("file.txt", O_RDONLY);    // System call
char buf[100];
read(fd, buf, 100);                      // System call
close(fd);                               // System call

// Higher-level library functions (built on system calls)
#include <stdio.h>

FILE *f = fopen("file.txt", "r");        // Calls open() internally
fread(buf, 1, 100, f);                   // Calls read() internally
fclose(f);                               // Calls close() internally

// The library functions add buffering and convenience,
// but ultimately use system calls underneath!`,
                annotations: [
                    { match: "#include <fcntl.h>", explanation: "Header for file control operations: open(), O_RDONLY, O_WRONLY, O_CREAT, etc." },
                    { match: "#include <unistd.h>", explanation: "Header for POSIX system calls: read(), write(), close(), lseek(), etc." },
                    { match: "open(", explanation: "System call that opens a file and returns a file descriptor (small integer)." },
                    { match: "O_RDONLY", explanation: "Flag indicating the file should be opened for reading only." },
                    { match: "read(fd, buf, 100)", explanation: "System call that reads up to 100 bytes from file descriptor into buffer." },
                    { match: "close(fd)", explanation: "System call that releases the file descriptor and associated resources." },
                    { match: "FILE *f", explanation: "Higher-level C library abstraction. Includes buffering, easier API, but slower." },
                    { match: "fopen", explanation: "Library function that internally calls open() then wraps the fd in a FILE struct." }
                ]
            }
        },
        {
            id: "open",
            title: "open() - Opening Files",
            content: `The **open()** system call opens a file and returns a file descriptor. You must specify flags that indicate how you intend to use the file.`,
            keyPoints: [
                "pathname: path to the file to open",
                "flags: bitwise OR of options (O_RDONLY, O_WRONLY, O_RDWR)",
                "Returns a file descriptor (>= 0) on success, -1 on error",
                "Must have exactly ONE of: O_RDONLY, O_WRONLY, O_RDWR",
                "Optional: O_CREAT (create if doesn't exist), O_TRUNC (clear existing), O_EXCL (fail if exists)"
            ],
            codeExample: {
                title: "open() function signatures and examples",
                language: "c",
                code: `#include <fcntl.h>
#include <sys/stat.h>

// Two signatures for open():
int open(const char *pathname, int flags);
int open(const char *pathname, int flags, mode_t mode);  // When O_CREAT

// READING: Open file for reading only
int fd = open("input.txt", O_RDONLY);

// WRITING: Open file for writing only
int fd = open("output.txt", O_WRONLY);

// WRITING + TRUNCATE: Open and clear any existing contents
int fd = open("output.txt", O_WRONLY | O_TRUNC);

// CREATE: Create file if it doesn't exist (need mode parameter!)
// 0644 = owner can read/write, others can only read
int fd = open("newfile.txt", O_WRONLY | O_CREAT, 0644);

// CREATE EXCLUSIVE: Must create new file, fail if exists
int fd = open("newfile.txt", O_WRONLY | O_CREAT | O_EXCL, 0644);

// Common flags:
// O_RDONLY  - Read only
// O_WRONLY  - Write only  
// O_RDWR    - Read and write
// O_CREAT   - Create file if doesn't exist (requires mode)
// O_TRUNC   - Truncate (clear) file if it exists
// O_EXCL    - With O_CREAT, fail if file already exists
// O_APPEND  - Writes always go to end of file`,
                annotations: [
                    { match: "int open(const char *pathname, int flags)", explanation: "Basic signature - opens existing file with given flags." },
                    { match: "mode_t mode", explanation: "Permission bits for new file. Required when using O_CREAT flag." },
                    { match: "O_WRONLY | O_TRUNC", explanation: "Bitwise OR combines flags. This opens for writing and clears existing contents." },
                    { match: "O_CREAT, 0644", explanation: "Create file with permissions rw-r--r-- (owner read/write, others read-only)." },
                    { match: "O_EXCL", explanation: "Exclusive create - fails if file exists. Prevents accidental overwrite." },
                    { match: "O_APPEND", explanation: "All writes go to end of file, regardless of file position. Good for logs." }
                ]
            }
        },
        {
            id: "file-descriptors",
            title: "File Descriptors",
            content: `A file descriptor is like a **"ticket number"** representing your currently-open file. It's a unique integer assigned by the OS to refer to that instance of that file in your program.`,
            keyPoints: [
                "File descriptor is a small non-negative integer",
                "Each program has its own set of file descriptors",
                "You can have MULTIPLE file descriptors for the same file",
                "Each open() call returns a NEW file descriptor",
                "The OS tracks the current position in the file for each FD",
                "File descriptors are assigned in ascending order (next FD = lowest unused)",
                "FDs 0, 1, 2 are reserved: stdin, stdout, stderr"
            ],
            diagram: `
File Descriptor Table (per process):

Process A                          Process B
┌─────────────────────────┐       ┌─────────────────────────┐
│ FD  │ File     │ Pos    │       │ FD  │ File     │ Pos    │
├─────┼──────────┼────────┤       ├─────┼──────────┼────────┤
│  0  │ stdin    │   -    │       │  0  │ stdin    │   -    │
│  1  │ stdout   │   -    │       │  1  │ stdout   │   -    │
│  2  │ stderr   │   -    │       │  2  │ stderr   │   -    │
│  3  │ data.txt │  100   │       │  3  │ log.txt  │   50   │
│  4  │ data.txt │  500   │◄──┐   │  4  │ (unused) │   -    │
│  5  │ (unused) │   -    │   │   └─────────────────────────┘
└─────────────────────────┘   │
                              │
    Same file, different FDs! ┘
    Each has its own position!

Key insight: Multiple FDs can point to the same file,
but each tracks its own position independently.
            `,
            codeExample: {
                title: "Multiple file descriptors for same file",
                language: "c",
                code: `#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>

int main() {
    // Open the same file twice - get TWO different FDs
    int fd1 = open("data.txt", O_RDONLY);  // Maybe returns 3
    int fd2 = open("data.txt", O_RDONLY);  // Maybe returns 4
    
    printf("fd1 = %d, fd2 = %d\\n", fd1, fd2);  // Different numbers!
    
    char buf1[10], buf2[10];
    
    // Read 10 bytes from fd1 - fd1 advances to position 10
    read(fd1, buf1, 10);
    
    // Read 10 bytes from fd2 - fd2 advances to position 10
    // (fd2 started at 0, independent of fd1!)
    read(fd2, buf2, 10);
    
    // Both buffers contain the SAME data (first 10 bytes)
    // because each FD has its own position tracker
    
    // Read 10 more from fd1 - now at position 20
    read(fd1, buf1, 10);  // Gets bytes 10-19
    
    // fd2 is still at position 10!
    read(fd2, buf2, 10);  // Gets bytes 10-19 again
    
    close(fd1);
    close(fd2);
    return 0;
}`,
                annotations: [
                    { match: "fd1 = open", explanation: "First open() call returns a file descriptor, likely 3 (assuming 0,1,2 are stdin/stdout/stderr)." },
                    { match: "fd2 = open", explanation: "Second open() of same file returns a DIFFERENT fd (e.g., 4). Each has independent position." },
                    { match: "read(fd1, buf1, 10)", explanation: "Reads 10 bytes and advances fd1's position to 10. fd2's position unchanged." },
                    { match: "read(fd2, buf2, 10)", explanation: "Reads same first 10 bytes! fd2 started at 0 independently of fd1." },
                    { match: "close(fd1)", explanation: "Releases fd1. fd2 remains valid and usable until also closed." }
                ]
            }
        },
        {
            id: "close",
            title: "close() - Closing Files",
            content: `Call **close()** when you're done with a file to release system resources.`,
            keyPoints: [
                "fd: the file descriptor you want to close",
                "Returns 0 on success, -1 on error",
                "Important to close files to preserve system resources",
                "Use valgrind --track-fds=yes to check for unclosed files",
                "Closing stdin/stdout/stderr (0, 1, 2) is usually a bad idea"
            ],
            codeExample: {
                title: "close() usage",
                language: "c",
                code: `#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>

int close(int fd);  // Returns 0 on success, -1 on error

int main() {
    int fd = open("file.txt", O_RDONLY);
    if (fd == -1) {
        perror("open failed");
        return 1;
    }
    
    // ... use the file ...
    
    // Close when done (usually don't error-check close)
    close(fd);
    
    // After close, fd is no longer valid!
    // Using it would be undefined behavior
    
    return 0;
}

// Check for file descriptor leaks with valgrind:
// $ valgrind --track-fds=yes ./myprogram
//
// If you forgot to close files, valgrind will report:
// "FILE DESCRIPTORS: 4 open at exit."
// and list which files weren't closed.`,
                annotations: [
                    { match: "int close(int fd)", explanation: "System call that releases a file descriptor. Returns 0 on success, -1 on error." },
                    { match: "perror(", explanation: "Prints a descriptive error message based on current errno value." },
                    { match: "return 1", explanation: "Convention: non-zero exit code indicates error to shell/parent process." },
                    { match: "After close, fd is no longer valid", explanation: "Using a closed fd is undefined behavior - may crash or affect wrong file!" },
                    { match: "valgrind --track-fds=yes", explanation: "Valgrind option that reports file descriptor leaks - very useful for debugging." }
                ]
            }
        },
        {
            id: "touch-example",
            title: "Practice: Creating Files (touch)",
            content: `Let's implement a simple version of the **touch** command that creates a new empty file.`,
            keyPoints: [
                "O_WRONLY | O_CREAT | O_EXCL creates a new file, failing if it exists",
                "0644 permissions: owner read/write, others read-only",
                "Always check return value of open() for errors",
                "Close file immediately if we just needed to create it"
            ],
            codeExample: {
                title: "touch.c - Create a new empty file",
                language: "c",
                code: `// touch.c - Create a new empty file
// Usage: ./touch newfile.txt

#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>

int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "Usage: %s <filename>\\n", argv[0]);
        return 1;
    }
    
    // Open file for writing, create if doesn't exist, fail if exists
    // 0644 = rw-r--r-- (owner read/write, others read-only)
    int fd = open(argv[1], O_WRONLY | O_CREAT | O_EXCL, 0644);
    
    // Check for errors
    if (fd == -1) {
        printf("There was a problem creating \\"%s\\"!\\n", argv[1]);
        return 1;
    }
    
    // Close the file - we're done with it
    close(fd);
    
    printf("Created file: %s\\n", argv[1]);
    return 0;
}

// Breaking down the flags:
// O_WRONLY - We'll write to it (even though we won't)
// O_CREAT  - Create the file if it doesn't exist
// O_EXCL   - Fail if the file already exists

// The permissions 0644 in binary:
// 110 100 100
//  ▲   ▲   ▲
//  │   │   └── Others: read only (4)
//  │   └────── Group: read only (4)  
//  └────────── Owner: read + write (6)`,
                annotations: [
                    { match: "argc != 2", explanation: "Check command line args: program name + exactly 1 filename argument required." },
                    { match: "O_WRONLY | O_CREAT | O_EXCL", explanation: "Create new file (O_CREAT), fail if exists (O_EXCL). O_WRONLY needed but we don't write." },
                    { match: "0644", explanation: "Octal permissions: 6=rw for owner, 4=r for group, 4=r for others." },
                    { match: "if (fd == -1)", explanation: "Always check for -1 on system call errors before using the file descriptor." },
                    { match: "close(fd)", explanation: "Important to close even though we didn't write anything - releases system resources." }
                ]
            }
        },
        {
            id: "read",
            title: "read() - Reading from Files",
            content: `The **read()** system call reads bytes from an open file into a buffer.`,
            keyPoints: [
                "fd: file descriptor to read from",
                "buf: memory location where bytes should be stored",
                "count: maximum number of bytes to read",
                "Returns: number of bytes actually read, 0 at EOF, -1 on error",
                "KEY: read may not read all bytes you ask for! Check return value!",
                "The OS tracks position - next read continues where you left off"
            ],
            codeExample: {
                title: "read() function and usage patterns",
                language: "c",
                code: `#include <unistd.h>
#include <fcntl.h>

ssize_t read(int fd, void *buf, size_t count);
// Returns: bytes read (could be less than count!)
//          0 if at end of file
//          -1 on error

// Example: Reading from a file
int fd = open("data.txt", O_RDONLY);
char buffer[1024];

ssize_t bytesRead = read(fd, buffer, sizeof(buffer));

if (bytesRead == -1) {
    perror("read failed");
} else if (bytesRead == 0) {
    printf("Reached end of file\\n");
} else {
    printf("Read %zd bytes\\n", bytesRead);
    // Note: bytesRead might be less than 1024!
}

// Read entire file pattern:
while (true) {
    ssize_t n = read(fd, buffer, sizeof(buffer));
    if (n == 0) break;  // EOF
    if (n == -1) {
        perror("read");
        break;
    }
    // Process n bytes in buffer...
    // Next read() automatically continues from current position!
}\`,
                annotations: [
                    { match: "ssize_t read(int fd, void *buf, size_t count)", explanation: "Signature: returns signed size (can be -1), accepts fd, buffer pointer, and max bytes." },
                    { match: "bytesRead == -1", explanation: "Error occurred. Check errno for specific error (permission denied, invalid fd, etc.)." },
                    { match: "bytesRead == 0", explanation: "End of file reached. No more data available to read." },
                    { match: "while (true)", explanation: "Common pattern: loop reading chunks until EOF (return 0) or error (return -1)." }
                ]
            }
        },
        {
            id: "write",
            title: "write() - Writing to Files",
            content: \`The **write()** system call writes bytes from a buffer to an open file.\`,
            keyPoints: [
                "fd: file descriptor to write to",
                "buf: memory location of bytes to write",
                "count: number of bytes to write from buf",
                "Returns: number of bytes actually written, -1 on error",
                "KEY: write may not write all bytes you ask! Must loop to ensure all written!",
                "The OS tracks position - next write continues where you left off"
            ],
            codeExample: {
                title: "write() function and the write-all pattern",
                language: "c",
                code: \`#include <unistd.h>

ssize_t write(int fd, const void *buf, size_t count);
// Returns: bytes written (could be less than count!)
//          -1 on error

// WRONG: Assumes write() writes everything
void write_wrong(int fd, const char * data, size_t len) {
            write(fd, data, len);  // Might not write all bytes!
        }

// CORRECT: Loop until all bytes written
void writeAllBytes(int fd, const char * buf, size_t nbytes) {
        size_t bytesWritten = 0;
while (bytesWritten < nbytes) {
        ssize_t count = write(fd,
    buf + bytesWritten,      // Start where we left off
    nbytes - bytesWritten);  // Remaining bytes
    if (count == -1) {
        perror("write failed");
        return;
    }
    bytesWritten += count;
}
}

// Why might write() not write everything?
// - Disk full
// - Signal interrupted the call
// - Writing to a pipe/socket with limited buffer
// - Resource limits

// The OS remembers where we are, but WE must track what to write next!`,
                annotations: [
                    { match: "ssize_t write(int fd, const void *buf, size_t count)", explanation: "Signature: returns bytes written (may be less than count!), -1 on error." },
                    { match: "write_wrong", explanation: "WRONG approach - ignoring return value. write() may write fewer bytes than requested!" },
                    { match: "writeAllBytes", explanation: "CORRECT pattern - loops until all bytes are written, handling partial writes." },
                    { match: "buf + bytesWritten", explanation: "Pointer arithmetic: start writing from where we left off in the buffer." },
                    { match: "nbytes - bytesWritten", explanation: "Only try to write the remaining bytes, not the whole buffer." },
                    { match: "Disk full", explanation: "Common reason for partial writes - physical storage exhausted." },
                    { match: "Signal interrupted", explanation: "Signals can interrupt system calls, causing partial writes." }
                ]
            }
        },
        {
            id: "copy-example",
            title: "Practice: Copying Files (cp)",
            content: `Let's implement a file copy program that demonstrates read() and write() together. This emulates the **cp** command.`,
            keyPoints: [
                "Open source file for reading, destination for writing",
                "Read chunks from source, write them to destination",
                "Handle partial reads and writes correctly",
                "read() return of 0 means we've reached end of file"
            ],
            codeExample: {
                title: "copy.c - Copy a file",
                language: "c",
                code: `// copy.c - Copy contents of one file to another
// Usage: ./copy source.txt dest.txt

#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <stdbool.h>

static const int kCopyIncrement = 1024;  // Read/write 1KB at a time
static const int kDefaultPermissions = 0644;

// Write ALL bytes, looping if necessary
void writeAllBytes(int destFD, const char *buf, size_t nbytes) {
    size_t bytesWritten = 0;
    while (bytesWritten < nbytes) {
        ssize_t count = write(destFD, 
                              buf + bytesWritten,
                              nbytes - bytesWritten);
        if (count == -1) {
            perror("write failed");
            return;
        }
        bytesWritten += count;
    }
}

// Copy all contents from source to destination
void copyContents(int sourceFD, int destFD) {
    while (true) {
        char buffer[kCopyIncrement];
        
        // Read a chunk (might get less than kCopyIncrement)
        ssize_t bytesRead = read(sourceFD, buffer, sizeof(buffer));
        
        if (bytesRead == 0) break;  // End of file
        if (bytesRead == -1) {
            perror("read failed");
            return;
        }
        
        // Write exactly what we read
        writeAllBytes(destFD, buffer, bytesRead);
    }
}

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "Usage: %s <source> <dest>\\n", argv[0]);
        return 1;
    }
    
    int sourceFD = open(argv[1], O_RDONLY);
    if (sourceFD == -1) {
        printf("Could not open source file: %s\\n", argv[1]);
        return 1;
    }
    
    int destFD = open(argv[2], O_WRONLY | O_CREAT | O_EXCL, 
                      kDefaultPermissions);
    if (destFD == -1) {
        printf("Could not create destination: %s\\n", argv[2]);
        close(sourceFD);
        return 1;
    }
    
    copyContents(sourceFD, destFD);
    
    close(sourceFD);
    close(destFD);
    
    return 0;
}`,
                annotations: [
                    { match: "copyContents", explanation: "Main copy loop: reads from source, writes to destination until EOF." },
                    { match: "open(argv[1], O_RDONLY)", explanation: "Open source file for reading only. Returns -1 if file doesn't exist." },
                    { match: "O_WRONLY | O_CREAT | O_EXCL", explanation: "Write to new file only - create it, but fail if it already exists." },
                    { match: "close(sourceFD)", explanation: "Don't forget to close on error paths! Here we close source if dest fails to open." },
                    { match: "kCopyIncrement", explanation: "Buffer size (1024 bytes). Trade-off: larger = fewer syscalls, more memory." }
                ]
            }
        },
        {
            id: "copy-details",
            title: "Copy Program: Key Details",
            content: `Let's examine the important details of the copy program and understand why we handle reads and writes differently.`,
            keyPoints: [
                "read() partial result: OK - we'll get remaining bytes next iteration",
                "write() partial result: NOT OK - we must loop to write remaining bytes",
                "Chunk size is arbitrary - doesn't affect correctness, only performance",
                "Pointer arithmetic: buf + bytesWritten gives address of unwritten data"
            ],
            diagram: `
Why writeAllBytes needs a loop but read doesn't:

READ: Chunk size doesn't matter
────────────────────────────────
File: [████████████████████]  (20 bytes)
       
read(fd, buf, 10):  [██████████]    → returns 10, position = 10
read(fd, buf, 10):  [██████████]    → returns 10, position = 20  
read(fd, buf, 10):  []              → returns 0 (EOF)

If read returns fewer bytes than requested, no problem!
We'll get the rest next time through our loop.


WRITE: Must write ALL bytes
────────────────────────────────
We have: [HELLO WORLD] in buffer (11 bytes)

write(fd, buf, 11): might only write 5!
                    
Buffer: [HELLO WORLD]
         ▲▲▲▲▲───────── Written (5 bytes)
              ▲▲▲▲▲▲── NOT written! (6 bytes remaining)

We MUST call write again with buf+5 and count=6
to ensure all data reaches the file!
            `,
            codeExample: {
                title: "Understanding the write loop",
                language: "c",
                code: `// Why we need pointer arithmetic in writeAllBytes

void writeAllBytes(int fd, const char *buf, size_t nbytes) {
    size_t bytesWritten = 0;
    
    while (bytesWritten < nbytes) {
        // Key line - uses pointer arithmetic:
        ssize_t count = write(fd, 
                              buf + bytesWritten,      // ← Start point
                              nbytes - bytesWritten);  // ← Remaining count
        bytesWritten += count;
    }
}

// Visual example with "HELLO" (5 bytes):
// 
// Initial: buf = ['H','E','L','L','O'], nbytes = 5, bytesWritten = 0
//
// First write: write(fd, buf + 0, 5 - 0) → maybe returns 3
//   Writes: "HEL"
//   bytesWritten = 3
//
// Second write: write(fd, buf + 3, 5 - 3) → returns 2
//               buf + 3 points here: ──┐
//                      ['H','E','L','L','O']
//                                    ▲
//   Writes: "LO"
//   bytesWritten = 5
//
// Loop exits: bytesWritten (5) == nbytes (5)

// Common mistake - using sizeof(buf) instead of bytesRead:
void copyWRONG(int srcFD, int destFD) {
    char buffer[1024];
    ssize_t bytesRead = read(srcFD, buffer, sizeof(buffer));
    
    // WRONG: might write garbage beyond what we read!
    write(destFD, buffer, sizeof(buffer));
    
    // CORRECT: only write what we actually read
    writeAllBytes(destFD, buffer, bytesRead);
}`,
                annotations: [
                    { match: "buf + bytesWritten", explanation: "Pointer arithmetic: after writing 3 bytes, buf+3 points to the 4th character." },
                    { match: "nbytes - bytesWritten", explanation: "Calculates remaining bytes: if 5 total and 3 written, try to write 2 more." },
                    { match: "copyWRONG", explanation: "Common bug: writing sizeof(buffer) instead of bytes actually read!" },
                    { match: "sizeof(buffer)", explanation: "BAD - might write uninitialized garbage beyond actual file content." },
                    { match: "writeAllBytes(destFD, buffer, bytesRead)", explanation: "GOOD - only write exactly what was read, using the return value." }
                ]
            }
        },
        {
            id: "assign2-connection",
            title: "Connection to assign2: File Operations",
            content: `The file operations we're learning connect directly to **assign2's filesystem implementation**. When your filesystem code reads or writes files, it uses similar patterns - reading blocks from disk and writing them back.`,
            keyPoints: [
                "Filesystem operations like read/write are built on these primitives",
                "Block cache uses similar read/write patterns for disk blocks",
                "File descriptors in the kernel track file position just like our examples",
                "Understanding these helps you implement filesystem operations in assign2"
            ],
            codeExample: {
                title: "How assign2 filesystem reads/writes data",
                language: "cpp",
                code: `// From assign2: Reading file data through the filesystem

// Cursor class helps iterate through file blocks
// Similar to how read() advances through a file
class Cursor {
    Ref<Inode> ip_;      // The file's inode
    uint32_t offset_;    // Current position (like kernel's file position)
    
public:
    Cursor(Ref<Inode> ip) : ip_(ip), offset_(0) {}
    
    // Read data from current position
    // Similar to read(fd, buf, count)
    ssize_t read(void *buf, size_t count) {
        if (offset_ >= ip_->size()) 
            return 0;  // EOF - just like read() returns 0
        
        size_t toread = std::min(count, ip_->size() - offset_);
        // ... read 'toread' bytes from file's blocks ...
        offset_ += toread;  // Advance position
        return toread;
    }
};

// BlockDevice read - lowest level, reads raw disk sectors
// This is what open/read/write eventually call!
ssize_t BlockDevice::read_block(uint16_t blocknum, void *buf) {
    off_t offset = blocknum * BLOCK_SIZE;
    lseek(fd_, offset, SEEK_SET);      // Position in device file
    return ::read(fd_, buf, BLOCK_SIZE); // System call!
}

// The hierarchy:
// Your program: read(fd, buf, n)
//      ↓
// Kernel: look up file, find blocks
//      ↓
// Filesystem: translate to block numbers
//      ↓
// Block device: read physical sectors`,
                annotations: [
                    { match: "class Cursor", explanation: "Helper class in assign2 that tracks position within a file, similar to kernel fd tracking." },
                    { match: "offset_", explanation: "Current position in file - just like the kernel tracks offset for each fd." },
                    { match: "ip_->size()", explanation: "Gets file size from inode to check for EOF condition." },
                    { match: "BlockDevice::read_block", explanation: "Lowest-level read - directly reads a sector from the disk device." },
                    { match: "lseek(fd_, offset, SEEK_SET)", explanation: "Positions the device file to the right sector before reading." },
                    { match: "::read(fd_, buf, BLOCK_SIZE)", explanation: "System call to read one block. :: means global scope (the real read, not a method)." }
                ]
            }
        },
        {
            id: "error-handling",
            title: "Error Handling Best Practices",
            content: `Proper error handling is crucial when working with system calls. Let's look at common patterns for handling errors with open, read, write, and close.`,
            keyPoints: [
                "Always check return values of open, read, write",
                "Use perror() or strerror(errno) for descriptive error messages",
                "errno is set by system calls on error",
                "close() errors are usually ignored but can be checked",
                "Use valgrind --track-fds=yes to find unclosed file descriptors"
            ],
            codeExample: {
                title: "Full error handling example",
                language: "c",
                code: `#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <errno.h>
#include <string.h>

int copy_file_safe(const char *src, const char *dst) {
    // Open source file
    int srcFD = open(src, O_RDONLY);
    if (srcFD == -1) {
        fprintf(stderr, "Cannot open %s: %s\\n", src, strerror(errno));
        return -1;
    }
    
    // Open destination file
    int dstFD = open(dst, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (dstFD == -1) {
        fprintf(stderr, "Cannot create %s: %s\\n", dst, strerror(errno));
        close(srcFD);  // Don't forget to close srcFD!
        return -1;
    }
    
    // Copy loop with full error handling
    char buffer[4096];
    ssize_t bytesRead;
    
    while ((bytesRead = read(srcFD, buffer, sizeof(buffer))) > 0) {
        char *writePtr = buffer;
        ssize_t bytesLeft = bytesRead;
        
        while (bytesLeft > 0) {
            ssize_t written = write(dstFD, writePtr, bytesLeft);
            if (written == -1) {
                fprintf(stderr, "Write error: %s\\n", strerror(errno));
                close(srcFD);
                close(dstFD);
                return -1;
            }
            writePtr += written;
            bytesLeft -= written;
        }
    }
    
    if (bytesRead == -1) {
        fprintf(stderr, "Read error: %s\\n", strerror(errno));
        close(srcFD);
        close(dstFD);
        return -1;
    }
    
    // Close files
    close(srcFD);
    if (close(dstFD) == -1) {
        // Rare but possible - e.g., NFS write errors deferred to close
        fprintf(stderr, "Close error: %s\\n", strerror(errno));
        return -1;
    }
    
    return 0;
}

// Common errno values:
// ENOENT  - File doesn't exist
// EACCES  - Permission denied
// EEXIST  - File exists (with O_EXCL)
// EINTR   - Interrupted by signal (often retry)
// ENOSPC  - No space left on device`,
                annotations: [
                    { match: "strerror(errno)", explanation: "Converts errno integer to human-readable error message string." },
                    { match: "if (srcFD == -1)", explanation: "Always check system call returns! -1 means failure, check errno for cause." },
                    { match: "close(srcFD)", explanation: "Critical on error path - must close already-opened file before returning." },
                    { match: "close(dstFD) == -1", explanation: "Rare but possible - NFS may defer write errors to close(). Worth checking!" },
                    { match: "ENOENT", explanation: "No such file or directory - common when source file doesn't exist." },
                    { match: "EACCES", explanation: "Permission denied - user lacks read/write access to file." },
                    { match: "ENOSPC", explanation: "No space left on device - disk is full, can't write more." }
                ]
            }
        },
        {
            id: "summary",
            title: "Summary: File Descriptor System Calls",
            content: `We've covered the four fundamental system calls for file I/O. These form the foundation for all file operations in Unix/Linux systems.`,
            keyPoints: [
                "open(): Opens a file, returns a file descriptor",
                "close(): Closes a file descriptor when done",
                "read(): Reads bytes from file, may return fewer than requested",
                "write(): Writes bytes to file, may write fewer than requested",
                "File descriptors are per-process 'tickets' for open files",
                "The kernel tracks file position for each file descriptor",
                "Always check return values and handle partial reads/writes"
            ],
            diagram: `
Summary of System Calls:

┌─────────────────────────────────────────────────────────────┐
│  open(pathname, flags, mode)                                │
│  ───────────────────────────                                │
│  Opens file at pathname with given flags                    │
│  Returns: file descriptor (>= 0) or -1 on error             │
│  Flags: O_RDONLY, O_WRONLY, O_RDWR, O_CREAT, O_TRUNC, etc. │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  read(fd, buffer, count)                                    │
│  ───────────────────────                                    │
│  Reads up to count bytes into buffer                        │
│  Returns: bytes read, 0 at EOF, -1 on error                 │
│  NOTE: May return fewer bytes than requested!               │
└─────────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────────┐
│  write(fd, buffer, count)                                   │
│  ────────────────────────                                   │
│  Writes up to count bytes from buffer                       │
│  Returns: bytes written, -1 on error                        │
│  NOTE: May write fewer bytes - need loop for reliability!   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  close(fd)                                                  │
│  ─────────                                                  │
│  Releases the file descriptor                               │
│  Returns: 0 on success, -1 on error                         │
│  Always close files when done!                              │
└─────────────────────────────────────────────────────────────┘

Coming up next: Multiprocessing - creating and managing processes!
            `
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Implement cat",
            difficulty: "easy",
            description: "Implement a simple version of the cat command that reads a file and prints its contents to stdout (file descriptor 1).",
            hint: "Read from the file in chunks and write to file descriptor 1 (stdout). Remember that write to stdout might also be partial!",
            starterCode: `// cat.c - Print file contents to stdout
// Usage: ./cat filename.txt

#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>

int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "Usage: %s <filename>\\n", argv[0]);
        return 1;
    }
    
    int fd = open(argv[1], ____);  // What flags?
    if (fd == -1) {
        perror("open");
        return 1;
    }
    
    char buffer[1024];
    ssize_t bytesRead;
    
    while (____) {  // Read loop condition
        // Write to stdout (fd = 1)
        // Don't forget: write might be partial!
        ____
    }
    
    close(fd);
    return 0;
}`,
            solution: `// cat.c - Print file contents to stdout
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>

int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "Usage: %s <filename>\\n", argv[0]);
        return 1;
    }
    
    int fd = open(argv[1], O_RDONLY);
    if (fd == -1) {
        perror("open");
        return 1;
    }
    
    char buffer[1024];
    ssize_t bytesRead;
    
    while ((bytesRead = read(fd, buffer, sizeof(buffer))) > 0) {
        // Write to stdout, handling partial writes
        ssize_t bytesWritten = 0;
        while (bytesWritten < bytesRead) {
            ssize_t n = write(1, buffer + bytesWritten, 
                             bytesRead - bytesWritten);
            if (n == -1) {
                perror("write");
                close(fd);
                return 1;
            }
            bytesWritten += n;
        }
    }
    
    if (bytesRead == -1) {
        perror("read");
        close(fd);
        return 1;
    }
    
    close(fd);
    return 0;
}`,
            explanation: "We open the file read-only, then loop reading chunks. For each chunk, we write to stdout (fd 1), handling partial writes with an inner loop. File descriptor 1 always refers to stdout in a Unix process."
        },
        {
            id: "ex2",
            title: "Count Characters",
            difficulty: "easy",
            description: "Write a program that counts the number of characters (bytes) in a file, similar to 'wc -c'.",
            hint: "Read the file in chunks, adding up bytesRead each time. At the end, you have the total count.",
            starterCode: `// charcount.c - Count bytes in a file
// Usage: ./charcount filename.txt

#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>

int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "Usage: %s <filename>\\n", argv[0]);
        return 1;
    }
    
    int fd = open(argv[1], O_RDONLY);
    if (fd == -1) {
        perror("open");
        return 1;
    }
    
    size_t totalBytes = 0;
    char buffer[4096];
    ssize_t bytesRead;
    
    while (____) {
        ____  // Update totalBytes
    }
    
    printf("%zu %s\\n", totalBytes, argv[1]);
    
    close(fd);
    return 0;
}`,
            solution: `// charcount.c - Count bytes in a file
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>

int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "Usage: %s <filename>\\n", argv[0]);
        return 1;
    }
    
    int fd = open(argv[1], O_RDONLY);
    if (fd == -1) {
        perror("open");
        return 1;
    }
    
    size_t totalBytes = 0;
    char buffer[4096];
    ssize_t bytesRead;
    
    while ((bytesRead = read(fd, buffer, sizeof(buffer))) > 0) {
        totalBytes += bytesRead;
    }
    
    if (bytesRead == -1) {
        perror("read");
        close(fd);
        return 1;
    }
    
    printf("%zu %s\\n", totalBytes, argv[1]);
    
    close(fd);
    return 0;
}`,
            explanation: "Each call to read() returns the number of bytes read. We accumulate this in totalBytes. When read() returns 0, we've reached EOF and have the total count. Note we don't need to process the buffer contents - just count the bytes."
        },
        {
            id: "ex3",
            title: "Append to File",
            difficulty: "medium",
            description: "Write a program that appends a line of text to an existing file, or creates it if it doesn't exist.",
            hint: "Use O_WRONLY | O_CREAT | O_APPEND. The O_APPEND flag ensures writes go to end. Don't forget to add a newline!",
            starterCode: `// append.c - Append a line to a file
// Usage: ./append filename.txt "text to append"

#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "Usage: %s <file> <text>\\n", argv[0]);
        return 1;
    }
    
    // Open for appending (create if needed)
    int fd = open(argv[1], ____);
    if (fd == -1) {
        perror("open");
        return 1;
    }
    
    // Write the text
    const char *text = argv[2];
    size_t len = strlen(text);
    
    // Write text (handle partial writes)
    ____
    
    // Write newline
    ____
    
    close(fd);
    return 0;
}`,
            solution: `// append.c - Append a line to a file
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>

void write_all(int fd, const char *buf, size_t len) {
    size_t written = 0;
    while (written < len) {
        ssize_t n = write(fd, buf + written, len - written);
        if (n == -1) {
            perror("write");
            return;
        }
        written += n;
    }
}

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "Usage: %s <file> <text>\\n", argv[0]);
        return 1;
    }
    
    // O_APPEND causes all writes to go to end of file
    // O_CREAT creates if doesn't exist
    int fd = open(argv[1], O_WRONLY | O_CREAT | O_APPEND, 0644);
    if (fd == -1) {
        perror("open");
        return 1;
    }
    
    // Write the text
    write_all(fd, argv[2], strlen(argv[2]));
    
    // Write newline
    write_all(fd, "\\n", 1);
    
    close(fd);
    return 0;
}`,
            explanation: "O_APPEND is key here - it makes every write atomically seek to the end first. This is important for log files where multiple processes might append simultaneously. We still need write_all for reliability."
        },
        {
            id: "ex4",
            title: "File Descriptor Behavior",
            difficulty: "medium",
            description: "Predict what this program outputs, then verify by tracing through the file descriptor operations.",
            hint: "Each open() returns the lowest unused FD. After close(), that FD can be reused.",
            starterCode: `// What does this program print?
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>

int main() {
    int fd1 = open("a.txt", O_RDONLY);  // Assume success
    int fd2 = open("b.txt", O_RDONLY);
    int fd3 = open("c.txt", O_RDONLY);
    
    printf("fd1=%d fd2=%d fd3=%d\\n", fd1, fd2, fd3);
    
    close(fd2);
    
    int fd4 = open("d.txt", O_RDONLY);
    int fd5 = open("e.txt", O_RDONLY);
    
    printf("fd4=%d fd5=%d\\n", fd4, fd5);
    
    close(fd1);
    close(fd3);
    close(fd4);
    close(fd5);
    return 0;
}

// Your prediction:
// Line 1 prints: fd1=___ fd2=___ fd3=___
// Line 2 prints: fd4=___ fd5=___`,
            solution: `// Answer:
// Line 1: fd1=3 fd2=4 fd3=5
// Line 2: fd4=4 fd5=6

// Explanation:
// 
// Initially: FDs 0,1,2 are stdin/stdout/stderr
//
// open("a.txt") → fd1 = 3 (lowest available)
// open("b.txt") → fd2 = 4 (next available)
// open("c.txt") → fd3 = 5 (next available)
// 
// After close(fd2): FD 4 is now available
// Available FDs: 4, 6, 7, 8, ...
// 
// open("d.txt") → fd4 = 4 (reuses closed FD!)
// open("e.txt") → fd5 = 6 (5 is still in use by fd3)
//
// Key insight: File descriptors are reused!
// The kernel always returns the lowest available FD.
// This is important for I/O redirection (dup2).`,
            explanation: "File descriptors are always assigned as the lowest unused non-negative integer. FDs 0, 1, 2 are stdin, stdout, stderr. When we close fd2 (4), that number becomes available again, so the next open() reuses it."
        },
        {
            id: "ex5",
            title: "Reading Block by Block (assign2 Connection)",
            difficulty: "hard",
            description: "Implement a function that reads a file in fixed-size blocks, similar to how the filesystem reads disk blocks. Track how many blocks were read.",
            hint: "A 'block' read might get fewer bytes if near EOF. Count it as a block anyway. Handle the case where file size isn't a multiple of block size.",
            starterCode: `// blockread.c - Read file as fixed-size blocks
// Similar to how filesystems read disk blocks

#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <stdbool.h>

#define BLOCK_SIZE 512  // Like V6 filesystem block size

typedef struct {
    int total_blocks;
    int full_blocks;      // Blocks that were completely full
    int partial_block;    // 1 if last block was partial, 0 otherwise
    size_t total_bytes;
} BlockStats;

BlockStats read_file_blocks(const char *filename) {
    BlockStats stats = {0, 0, 0, 0};
    
    int fd = open(filename, O_RDONLY);
    if (fd == -1) {
        perror("open");
        return stats;
    }
    
    char block[BLOCK_SIZE];
    ssize_t bytesRead;
    
    while (____) {
        stats.total_blocks++;
        stats.total_bytes += bytesRead;
        
        if (bytesRead == BLOCK_SIZE) {
            ____  // Full block
        } else {
            ____  // Partial block (last block)
        }
    }
    
    close(fd);
    return stats;
}

int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "Usage: %s <file>\\n", argv[0]);
        return 1;
    }
    
    BlockStats stats = read_file_blocks(argv[1]);
    
    printf("Total bytes: %zu\\n", stats.total_bytes);
    printf("Total blocks: %d\\n", stats.total_blocks);
    printf("Full blocks: %d\\n", stats.full_blocks);
    printf("Partial block: %s\\n", 
           stats.partial_block ? "yes" : "no");
    
    return 0;
}`,
            solution: `// blockread.c - Read file as fixed-size blocks
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <stdbool.h>

#define BLOCK_SIZE 512

typedef struct {
    int total_blocks;
    int full_blocks;
    int partial_block;
    size_t total_bytes;
} BlockStats;

BlockStats read_file_blocks(const char *filename) {
    BlockStats stats = {0, 0, 0, 0};
    
    int fd = open(filename, O_RDONLY);
    if (fd == -1) {
        perror("open");
        return stats;
    }
    
    char block[BLOCK_SIZE];
    ssize_t bytesRead;
    
    while ((bytesRead = read(fd, block, BLOCK_SIZE)) > 0) {
        stats.total_blocks++;
        stats.total_bytes += bytesRead;
        
        if (bytesRead == BLOCK_SIZE) {
            stats.full_blocks++;
        } else {
            stats.partial_block = 1;  // Last block was partial
        }
    }
    
    close(fd);
    return stats;
}

// Example: 1500 byte file with 512-byte blocks
// Block 0: bytes 0-511    (full, 512 bytes)
// Block 1: bytes 512-1023 (full, 512 bytes)
// Block 2: bytes 1024-1499 (partial, 476 bytes)
// 
// total_blocks = 3
// full_blocks = 2
// partial_block = 1
// total_bytes = 1500

// This mimics how filesystems work:
// - Files are stored in fixed-size blocks
// - The last block is often partially filled
// - The inode stores the actual file size
// - Extra bytes in last block are ignored`,
            explanation: "This exercise demonstrates how filesystems think about file storage. Files occupy whole blocks on disk, even if they don't fill the last block completely. The inode's size field tells us how many bytes are actually valid. In assign2, you'll work with 512-byte blocks just like this."
        },
        {
            id: "ex6",
            title: "Safe Copy with Verification",
            difficulty: "hard",
            description: "Write a copy program that verifies the copy was successful by reading back both files and comparing them.",
            hint: "After copying, reopen both files, read them in parallel, and compare each chunk. Use lseek() or close/reopen to get back to the start.",
            starterCode: `// verified_copy.c - Copy and verify
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>
#include <stdbool.h>

#define CHUNK_SIZE 4096

void write_all(int fd, const char *buf, size_t len);  // Implement this

bool copy_file(const char *src, const char *dst);     // Implement this

bool verify_copy(const char *src, const char *dst) {
    int srcFD = open(src, O_RDONLY);
    int dstFD = open(dst, O_RDONLY);
    
    if (srcFD == -1 || dstFD == -1) {
        if (srcFD != -1) close(srcFD);
        if (dstFD != -1) close(dstFD);
        return false;
    }
    
    char srcBuf[CHUNK_SIZE], dstBuf[CHUNK_SIZE];
    bool match = true;
    
    while (true) {
        ssize_t srcBytes = read(srcFD, srcBuf, CHUNK_SIZE);
        ssize_t dstBytes = read(dstFD, dstBuf, CHUNK_SIZE);
        
        // Check conditions:
        // 1. Both reads succeeded (or both EOF)
        // 2. Same number of bytes
        // 3. Same content
        ____
    }
    
    close(srcFD);
    close(dstFD);
    return match;
}

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "Usage: %s <src> <dst>\\n", argv[0]);
        return 1;
    }
    
    if (!copy_file(argv[1], argv[2])) {
        fprintf(stderr, "Copy failed\\n");
        return 1;
    }
    
    if (!verify_copy(argv[1], argv[2])) {
        fprintf(stderr, "Verification failed!\\n");
        return 1;
    }
    
    printf("Copy verified successfully\\n");
    return 0;
}`,
            solution: `// verified_copy.c - Copy and verify
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>
#include <stdbool.h>

#define CHUNK_SIZE 4096

void write_all(int fd, const char *buf, size_t len) {
    size_t written = 0;
    while (written < len) {
        ssize_t n = write(fd, buf + written, len - written);
        if (n == -1) return;
        written += n;
    }
}

bool copy_file(const char *src, const char *dst) {
    int srcFD = open(src, O_RDONLY);
    if (srcFD == -1) return false;
    
    int dstFD = open(dst, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (dstFD == -1) {
        close(srcFD);
        return false;
    }
    
    char buf[CHUNK_SIZE];
    ssize_t n;
    while ((n = read(srcFD, buf, CHUNK_SIZE)) > 0) {
        write_all(dstFD, buf, n);
    }
    
    close(srcFD);
    close(dstFD);
    return n == 0;  // True if we hit EOF (not error)
}

bool verify_copy(const char *src, const char *dst) {
    int srcFD = open(src, O_RDONLY);
    int dstFD = open(dst, O_RDONLY);
    
    if (srcFD == -1 || dstFD == -1) {
        if (srcFD != -1) close(srcFD);
        if (dstFD != -1) close(dstFD);
        return false;
    }
    
    char srcBuf[CHUNK_SIZE], dstBuf[CHUNK_SIZE];
    bool match = true;
    
    while (true) {
        ssize_t srcBytes = read(srcFD, srcBuf, CHUNK_SIZE);
        ssize_t dstBytes = read(dstFD, dstBuf, CHUNK_SIZE);
        
        // Error check
        if (srcBytes == -1 || dstBytes == -1) {
            match = false;
            break;
        }
        
        // Both at EOF = success
        if (srcBytes == 0 && dstBytes == 0) {
            break;
        }
        
        // Different sizes = mismatch
        if (srcBytes != dstBytes) {
            match = false;
            break;
        }
        
        // Compare content
        if (memcmp(srcBuf, dstBuf, srcBytes) != 0) {
            match = false;
            break;
        }
    }
    
    close(srcFD);
    close(dstFD);
    return match;
}`,
            explanation: "This exercise combines copy and verification. The verification phase reopens both files and reads them in parallel, comparing each chunk. We use memcmp() to compare the buffers. This pattern is useful in systems programming where data integrity is critical - similar to how fsck verifies filesystem consistency in assign2."
        }
    ]
};

export default lecture7;
