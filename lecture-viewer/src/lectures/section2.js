export const section2 = {
    id: 's2',
    type: 'section',
    title: "File I/O System Calls",
    subtitle: "Section 2 — Reading Files with open, read, and close",
    keyTakeaway: "Unix file I/O revolves around three system calls: open (get a file descriptor), read (transfer bytes into a buffer), and close (release the descriptor). A robust reading loop must handle partial reads and properly null-terminate string buffers.",

    sections: [
        {
            id: "overview",
            title: "Section 2 Overview",
            content: `This section focused on low-level Unix file I/O. Instead of using C's high-level \`stdio\` functions like **fopen** and **fgets**, we worked directly with the system calls that the OS provides: **open**, **read**, and **close**. These are the same primitives that higher-level libraries are built on, and understanding them is essential for systems programming.`,
            keyPoints: [
                "open() returns a file descriptor (small integer) that is a handle to the opened file",
                "read() takes a file descriptor, a buffer, and a byte count — returns bytes actually read",
                "close() releases the file descriptor so the OS can reuse it",
                "A return of 0 from read() means end-of-file (EOF)",
                "read() may return fewer bytes than requested (a 'short read') — you must loop"
            ]
        },
        {
            id: "catn-program",
            title: "The catn Program",
            content: `The main exercise was implementing **catn** — a program that prints the first N bytes of a file. It takes a filename and byte count as command-line arguments, opens the file with \`open()\`, reads up to N bytes using a loop, and prints the result. This exercise reinforces the pattern of reading in a loop to handle short reads.`,
            keyPoints: [
                "Usage: ./catn <filename> <nbytes>",
                "Opens the file read-only with O_RDONLY flag",
                "Uses a read loop because a single read() call may not return all requested bytes",
                "Must null-terminate the buffer before printing with printf",
                "If the file is shorter than nbytes, it just prints the entire file"
            ],
            codeExample: {
                title: "catn.c — Reading the first N bytes of a file",
                language: "c",
                code: `/**
 * File: catn.c
 * --------------
 * This program prints the first nbytes bytes of a specified file,
 * using the open/read/close system calls.
 */

#include <stdio.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdlib.h>


/* This function prints the first nbytes bytes of the given file
 * (assumed to be text).  If nbytes is larger than the file size,
 * it just prints the entire file.
 */
void printFirstNBytes(int sourceFD, int nbytes) {
  // Make space for the chars + null terminator
  char buffer[nbytes + 1];
  size_t bytesRead = 0;
  while (bytesRead < nbytes) {
    // Read the next chunk of bytes from the source
    ssize_t bytesReadThisTime = read(sourceFD, buffer + bytesRead, nbytes - bytesRead);
    if (bytesReadThisTime == 0) break;
    bytesRead += bytesReadThisTime;
  }

  // We must add a null terminator so it prints without memory errors
  buffer[bytesRead] = '\\0';
  printf("%s\\n", buffer);
}


int main(int argc, char *argv[]) {
  if (argc < 3) {
    printf("Usage: ./catn <filename> <nbytes>\\n");
    return 1;
  }

  int sourceFD = open(argv[1], O_RDONLY);
  int nbytes = atoi(argv[2]);
  printFirstNBytes(sourceFD, nbytes);
  return 0;
}`,
                annotations: [
                    { match: "open(argv[1], O_RDONLY)", explanation: "open() is a system call that opens a file and returns a file descriptor (a small non-negative integer). O_RDONLY means we're opening the file for reading only. If the file doesn't exist, open returns -1." },
                    { match: "nbytes + 1", explanation: "We allocate one extra byte beyond what we need to read because C strings require a null terminator ('\\0') at the end. Without this, printf would read past our buffer." },
                    { match: "bytesRead < nbytes", explanation: "The read loop continues until we've read all the bytes we want. This is necessary because read() may return fewer bytes than requested (a 'short read'), especially for large reads or network/pipe sources." },
                    { match: "read(sourceFD, buffer + bytesRead, nbytes - bytesRead)", explanation: "Each call to read() writes into the buffer starting at the current offset (buffer + bytesRead), and requests only the remaining bytes (nbytes - bytesRead). This ensures we don't overflow the buffer or re-read data." },
                    { match: "bytesReadThisTime == 0", explanation: "read() returns 0 when it reaches end-of-file (EOF). This means there's no more data to read. We break out of the loop because the file was shorter than nbytes." },
                    { match: "buffer[bytesRead] = '\\\\0'", explanation: "Null-terminating the buffer is critical. Without it, printf(\"%s\") would keep reading memory past our data until it randomly finds a zero byte, causing undefined behavior." },
                    { match: "atoi(argv[2])", explanation: "atoi converts the string argument to an integer. Note: this doesn't do error checking — in production code you'd want to validate the input." }
                ]
            }
        },
        {
            id: "fd-concepts",
            title: "File Descriptors",
            content: `A **file descriptor** is a small non-negative integer that the OS uses to identify an open file for a process. When you call \`open()\`, the kernel creates an entry in the process's file descriptor table and returns the index. File descriptors 0, 1, and 2 are special — they're pre-opened for **stdin**, **stdout**, and **stderr** respectively.`,
            keyPoints: [
                "File descriptor 0 = stdin (standard input)",
                "File descriptor 1 = stdout (standard output)",
                "File descriptor 2 = stderr (standard error)",
                "New file descriptors are assigned the lowest available number",
                "Each process has its own file descriptor table",
                "Forgetting to close() a file descriptor causes a resource leak"
            ],
            diagram: `
Process File Descriptor Table:
┌─────┬──────────────────────────────────┐
│ FD  │ Points to...                     │
├─────┼──────────────────────────────────┤
│  0  │ stdin  (keyboard/terminal)       │
│  1  │ stdout (terminal output)         │
│  2  │ stderr (terminal error output)   │
│  3  │ open("myfile.txt", O_RDONLY)     │
│  4  │ (next file you open...)          │
└─────┴──────────────────────────────────┘

After close(3):
┌─────┬──────────────────────────────────┐
│  0  │ stdin                            │
│  1  │ stdout                           │
│  2  │ stderr                           │
│  3  │ (available for reuse)            │
└─────┴──────────────────────────────────┘
      `
        },
        {
            id: "read-loop-pattern",
            title: "The Read Loop Pattern",
            content: `One of the most important patterns in systems programming is the **read loop**. A single call to \`read()\` is NOT guaranteed to return all the bytes you requested. It may return fewer bytes for many reasons — the data hasn't arrived yet (network), the OS decided to return early, or you're near the end of the file. You must always loop until you've read everything or hit EOF.`,
            keyPoints: [
                "Never assume read() returns all requested bytes in one call",
                "Always loop: accumulate bytes until you have enough or hit EOF",
                "read() returns: positive number = bytes read, 0 = EOF, -1 = error",
                "Track total bytes read and adjust buffer pointer + remaining count each iteration",
                "This pattern applies to read(), write(), recv(), and other I/O functions"
            ],
            codeExample: {
                title: "The robust read loop pattern",
                language: "c",
                code: `// WRONG — assumes one read() gets everything:
char buf[1024];
read(fd, buf, 1024);  // might only read 100 bytes!

// RIGHT — loop until all bytes are read or EOF:
char buf[1024];
size_t totalRead = 0;
while (totalRead < 1024) {
    ssize_t n = read(fd, buf + totalRead, 1024 - totalRead);
    if (n == 0) break;   // EOF
    if (n < 0) {         // Error
        perror("read");
        break;
    }
    totalRead += n;
}`,
                annotations: [
                    { match: "read(fd, buf, 1024)", explanation: "This single read() call might return anywhere from 1 to 1024 bytes. If the file has 1024 bytes but the OS only gives you 512, the rest of your buffer is uninitialized garbage." },
                    { match: "buf + totalRead", explanation: "Each iteration writes to the next unused position in the buffer. totalRead tracks how many bytes we've accumulated so far." },
                    { match: "1024 - totalRead", explanation: "We only request the remaining bytes we still need. This prevents buffer overflow." },
                    { match: "n == 0", explanation: "A return value of 0 means end-of-file — no more data to read. This is different from an error." },
                    { match: "n < 0", explanation: "A negative return means an error occurred. Use perror() or strerror(errno) to get a human-readable error message." }
                ]
            }
        },
        {
            id: "summary",
            title: "Section 2 Summary",
            content: `Section 2 introduced the fundamental Unix I/O system calls that everything else is built on. The key lesson is that **read() can return short**, so you must always use a read loop. The catn program is a minimal but complete example of opening, reading, and printing a file.`,
            keyPoints: [
                "open() → file descriptor, read() → bytes into buffer, close() → release",
                "Always use a read loop to handle short reads",
                "Always null-terminate string buffers before printing",
                "File descriptors 0/1/2 are stdin/stdout/stderr",
                "These system calls are the foundation for everything in assign1-3"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Short Read Scenarios",
            difficulty: "easy",
            description: "Identify which scenarios could cause read() to return fewer bytes than requested.",
            hint: "Think about what kinds of data sources might not have all their data immediately available.",
            starterCode: `// Which of these could cause a short read?
// Mark each as YES or NO:

// 1. Reading from a regular file on disk
//    Short read possible? ____

// 2. Reading from a pipe connected to another process
//    Short read possible? ____

// 3. Reading from a network socket
//    Short read possible? ____

// 4. Reading the last block of a file
//    Short read possible? ____

// 5. Reading 1 byte at a time
//    Short read possible? ____`,
            solution: `// 1. Reading from a regular file on disk
//    Short read possible? YES (rare but can happen,
//    especially near EOF)

// 2. Reading from a pipe connected to another process
//    Short read possible? YES (very common — the writer
//    may not have written all data yet)

// 3. Reading from a network socket
//    Short read possible? YES (extremely common — data
//    arrives in packets of varying sizes)

// 4. Reading the last block of a file
//    Short read possible? YES (the file may not end on
//    a block boundary, so fewer bytes remain)

// 5. Reading 1 byte at a time
//    Short read possible? NO (you asked for 1 byte, so
//    you either get it or get 0 for EOF)`,
            explanation: "Short reads are possible from almost any data source. The only guarantee is that if you ask for 1 byte and data is available, you'll get exactly 1 byte. For everything else, always loop."
        }
    ]
};

export default section2;
