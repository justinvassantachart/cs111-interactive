export const section3 = {
    id: 's3',
    type: 'section',
    title: "Multiprocessing & Pipes",
    subtitle: "Section 3 — fork, File Descriptor Sharing, Pipes, and Process Control",
    keyTakeaway: "After fork(), parent and child share open file table entries (so reads advance a shared cursor). Pipes provide unidirectional IPC between processes, and dup2 lets you redirect stdin/stdout through them. Combining fork, waitpid, and kill lets you build process control utilities like timeout.",

    sections: [
        {
            id: "overview",
            title: "Section 3 Overview",
            content: `Section 3 covered three multiprocessing programs that demonstrate key OS concepts: how **fork()** causes file descriptors to be shared via the open file table, how **pipes** enable inter-process communication, and how **signals** let one process control another. These are the building blocks for assignment 3 (the Stanford Shell).`,
            keyPoints: [
                "fork() duplicates file descriptor table entries — parent and child share the same OFT entry",
                "Shared OFT entries mean a shared file cursor (read position)",
                "pipe() creates a unidirectional communication channel between two file descriptors",
                "dup2() redirects a file descriptor to point to a different OFT entry",
                "waitpid() blocks until a child terminates, kill() sends a signal to a process"
            ]
        },
        {
            id: "open-file-table",
            title: "Fork & Open File Table",
            content: `The first program demonstrates what happens to file descriptors after a **fork()**. When a process calls fork(), the child gets a *copy* of the parent's file descriptor table. However, both sets of file descriptors point to the **same entries** in the kernel's Open File Table. This means they share the same file cursor — if the child reads 16 bytes, the parent's next read starts 16 bytes later.`,
            keyPoints: [
                "fork() copies the FD table but shares Open File Table entries",
                "Shared OFT entry = shared file position cursor",
                "Parent reads first 16 bytes, child's read continues from byte 16",
                "After child reads bytes 16-31, parent's next read starts at byte 32",
                "This is how the OS ensures coordinated I/O between parent and child"
            ],
            codeExample: {
                title: "open-file-table.cc — Demonstrating shared file cursors after fork",
                language: "cpp",
                code: `/* This file is a demo of file descriptors being
 * copied by a call to fork and what the state
 * of the file descriptor table and open file
 * table look like.
 */

#include <stdio.h>
#include <stdlib.h>
#include <sys/types.h>
#include <unistd.h>
#include <sys/wait.h>
#include <sys/stat.h>
#include <fcntl.h>

static const int FILE_CHUNK_SIZE = 16;

/* This function reads the next \`amount\` bytes of the file
 * specified by the given file descriptor, and prints out
 * what was read in, prefixed with the \`who\` string.
 */
void readPartOfFile(int fd, int amount, const char *who) {
    char buf[amount + 1];
    // assume all requested bytes are read
    size_t bytesRead = read(fd, buf, sizeof(buf) - 1);
    buf[bytesRead] = '\\0';
    printf("%s: [%s]\\n", who, buf);
}

int main() {
    int codeFile = open("open-file-table.cc", O_RDONLY);

    // Read the first part of the file
    readPartOfFile(codeFile, FILE_CHUNK_SIZE, "parent");

    pid_t pidOrZero = fork();
    if (pidOrZero == 0) {
        // The child will read another chunk of the file
        readPartOfFile(codeFile, FILE_CHUNK_SIZE, "child");
        close(codeFile);
        return 0;
    }

    // The parent waits for the child, and then reads again
    waitpid(pidOrZero, NULL, 0);
    readPartOfFile(codeFile, FILE_CHUNK_SIZE, "parent");
    close(codeFile);
    return 0;
}`,
                annotations: [
                    { match: "open(\"open-file-table.cc\", O_RDONLY)", explanation: "Opens this source file itself for reading. The returned file descriptor (e.g., fd 3) points to an Open File Table entry with cursor at position 0." },
                    { match: "readPartOfFile(codeFile, FILE_CHUNK_SIZE, \"parent\")", explanation: "First call: parent reads bytes 0-15. The OFT cursor advances to 16. Both parent and child will see this updated position after fork." },
                    { match: "fork()", explanation: "Creates a child process. The child gets a copy of the parent's FD table, but FD 3 in both processes points to the SAME OFT entry (cursor is at 16)." },
                    { match: "readPartOfFile(codeFile, FILE_CHUNK_SIZE, \"child\")", explanation: "Child reads bytes 16-31 (cursor was at 16 from parent's first read). Cursor advances to 32. Since the OFT entry is shared, this affects the parent too." },
                    { match: "waitpid(pidOrZero, NULL, 0)", explanation: "Parent blocks until child finishes. This ensures the child's read completes before the parent reads again." },
                    { match: "readPartOfFile(codeFile, FILE_CHUNK_SIZE, \"parent\")", explanation: "Second parent read: starts at byte 32 (after child advanced the shared cursor to 32). This proves the cursor is truly shared via the OFT." }
                ]
            },
            diagram: `
After fork() — Shared Open File Table Entry:

Process: PARENT                    Process: CHILD
┌──────────────────┐              ┌──────────────────┐
│ FD Table (copy)  │              │ FD Table (copy)  │
│ fd 3 ──────┐     │              │ fd 3 ──────┐     │
└────────────┼─────┘              └────────────┼─────┘
             │                                 │
             └──────────┐   ┌──────────────────┘
                        ▼   ▼
              ┌─────────────────────┐
              │   Open File Table   │
              │   Entry for file    │
              │                     │
              │  cursor: 16 → 32   │
              │  mode: O_RDONLY     │
              └─────────────────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │   v-node / inode    │
              │   (actual file)     │
              └─────────────────────┘

Timeline:
  1. Parent reads bytes 0-15    → cursor = 16
  2. fork() — child shares OFT entry
  3. Child reads bytes 16-31   → cursor = 32
  4. Parent reads bytes 32-47  → cursor = 48
`
        },
        {
            id: "pipe-program",
            title: "Pipes & dup2",
            content: `The second program demonstrates **pipes** — a unidirectional communication channel between two processes. A pipe has a write end and a read end. Combined with **dup2()**, you can redirect a process's stdout to flow through the pipe, which is exactly how shell pipelines (like \`ls | grep foo\`) work.`,
            keyPoints: [
                "pipe(fds) creates a pipe: fds[0] is the read end, fds[1] is the write end",
                "Data written to fds[1] can be read from fds[0]",
                "dup2(fds[1], STDOUT_FILENO) redirects stdout into the pipe's write end",
                "Close unused pipe ends to avoid deadlocks (reader waiting for closed writer)",
                "The child reads from the pipe; the parent writes via printf (redirected to pipe)"
            ],
            codeExample: {
                title: "pipe.cc — Parent sends a message to child through a pipe via dup2",
                language: "cpp",
                code: `/**
 * File: pipes.cc
 * ---------------
 * This program uses a pipe to send a message from parent
 * to child, but the parent sends the message by having
 * its STDOUT feed into the pipe instead of a write call
 * to the pipe write end.
 */

#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>


static const char * kPipeMessage = "Hello, this message is coming through a pipe.";

int main(int argc, char *argv[]) {
    /* This is a patch fix for an issue where printf doesn't
     * immediately print the output.  It tells printf to
     * print immediately, rather than buffering the output.
     */
    setbuf(stdout, NULL);

    int fds[2];
    pipe(fds);
    size_t bytesSent = strlen(kPipeMessage) + 1;
    pid_t pidOrZero = fork();
    // Child only reads from pipe (assume everything is read)
    if (pidOrZero == 0) {
        close(fds[1]);
        char buffer[bytesSent];
        read(fds[0], buffer, sizeof(buffer));
        close(fds[0]);
        printf("Message from parent: %s\\n", buffer);
        return 0;
    }
    // Parent only writes to pipe, via printf
    close(fds[0]);
    dup2(fds[1], STDOUT_FILENO);
    close(fds[1]);
    printf("%s", kPipeMessage);
    waitpid(pidOrZero, NULL, 0);
    return 0;
}`,
                annotations: [
                    { match: "setbuf(stdout, NULL)", explanation: "Disables output buffering for stdout. Without this, printf might buffer the message and not send it through the pipe immediately, causing the child to hang waiting for data." },
                    { match: "pipe(fds)", explanation: "Creates a pipe: fds[0] is the read end, fds[1] is the write end. Data written to fds[1] appears on fds[0]. Think of it as a one-way tunnel." },
                    { match: "strlen(kPipeMessage) + 1", explanation: "We add 1 for the null terminator. We need to send the null terminator through the pipe so the child can treat the received data as a proper C string." },
                    { match: "close(fds[1])", explanation: "Child closes the write end of the pipe. Critical rule: always close the pipe ends you don't use. If the child kept fds[1] open, it would never see EOF on the read end." },
                    { match: "read(fds[0], buffer, sizeof(buffer))", explanation: "Child reads from the pipe's read end. It blocks until the parent writes data. Once the parent closes its write end (by exiting), EOF is signaled." },
                    { match: "close(fds[0])", explanation: "Parent closes the read end of the pipe. The parent only writes, so keeping the read end open would waste a file descriptor." },
                    { match: "dup2(fds[1], STDOUT_FILENO)", explanation: "The key trick: dup2 makes STDOUT_FILENO (fd 1) point to the same OFT entry as fds[1] (the pipe write end). Now printf() writes to the pipe instead of the terminal!" },
                    { match: "printf(\"%s\", kPipeMessage)", explanation: "Because of dup2, this printf writes to the pipe, not the terminal. The child reads this data from fds[0]. This is exactly how shell pipelines work." }
                ]
            },
            diagram: `
Pipe Communication Flow:

Before dup2:
  Parent: stdout(fd 1) → terminal
          fds[0] → pipe read end
          fds[1] → pipe write end

After setup:
  Parent: stdout(fd 1) → pipe write end  (via dup2)
          fds[0] → CLOSED
          fds[1] → CLOSED (dup2 made fd 1 a copy)

  Child:  fds[0] → pipe read end
          fds[1] → CLOSED

Data flow:
  Parent printf() → fd 1 → pipe → fds[0] → Child read()
`
        },
        {
            id: "timeout-program",
            title: "Process Control: timeout",
            content: `The third program implements a **timeout** utility — it runs a given command but kills it if it takes longer than a specified number of seconds. This uses a clever "race" pattern: fork two children (one runs the command, one sleeps for the timeout), then wait for whichever finishes first. If the timer finishes first, kill the command; if the command finishes first, kill the timer.`,
            keyPoints: [
                "Fork two children: one for the timed process, one for the timer",
                "waitpid(-1, ...) waits for ANY child to finish",
                "Whichever child finishes first determines the outcome",
                "kill(pid, SIGKILL) terminates the slower child",
                "Must waitpid on the killed child to avoid zombie processes",
                "Return 124 if timeout occurred (Unix convention)"
            ],
            codeExample: {
                title: "timeout.cc — Run a command with a time limit",
                language: "cpp",
                code: `/**
 * File: timeout.cc
 * -----------------
 * Allows the supplied executable to execute for up to a specified
 * number of seconds.  If the process finishes before that
 * time is up, then time-out returns immediately, returning the exit
 * status of the process it timed.  If the executable doesn't finish
 * in the allotted time, then the process is terminated, returning an
 * exit status of 124.
 */

#include <iostream>
#include <sys/types.h>
#include <unistd.h>
#include <signal.h>
#include <sys/wait.h>
#include <stdlib.h>

using namespace std;

int main(int argc, char *argv[]) {
  // Your implementation here!
  pid_t timed = fork();
  if (timed == 0) { // child
    execvp(argv[2], argv + 2);
    cerr << argv[2] << "could not run";
    exit(1);
  }
  pid_t timer = fork();
  if (timer == 0) {
    sleep(atoi(argv[1]));
    return 0;
  }

  // wait for child to finish whichever the first child is
  int status;
  pid_t first_to_finish = waitpid(-1, &status, 0);
  pid_t second_to_finish;

  // terminate the runnerup process and clean it up
  if (first_to_finish != timer) {
    second_to_finish = timer;
  } else {
    second_to_finish = timed;
  }

  kill(second_to_finish, SIGKILL);
  waitpid(second_to_finish, NULL, 0); // clean up the second to finish process

  // return the appropriate status
  return first_to_finish == timed ? status : 124;

}`,
                annotations: [
                    { match: "pid_t timed = fork()", explanation: "First fork: creates the child that will run the actual command. We save its PID so we can identify it later when waitpid returns." },
                    { match: "execvp(argv[2], argv + 2)", explanation: "Replaces the child process with the command to run. argv[2] is the command name, argv + 2 is the arguments array. execvp searches PATH for the executable." },
                    { match: "pid_t timer = fork()", explanation: "Second fork: creates a 'timer' child that just sleeps for the timeout duration. When it wakes up, it exits, signaling that time is up." },
                    { match: "sleep(atoi(argv[1]))", explanation: "The timer child sleeps for the specified number of seconds (argv[1]). When sleep returns, the child exits with status 0." },
                    { match: "waitpid(-1, &status, 0)", explanation: "Wait for ANY child to finish (-1 means any child). Returns the PID of whichever child exits first. This is the 'race' — timed process vs. timer." },
                    { match: "kill(second_to_finish, SIGKILL)", explanation: "SIGKILL immediately terminates the losing process. If the command finished first, we kill the timer. If the timer finished first, we kill the command." },
                    { match: "waitpid(second_to_finish, NULL, 0)", explanation: "Must reap the killed process to prevent a zombie. Even killed processes leave an entry in the process table until their parent calls waitpid." },
                    { match: "first_to_finish == timed ? status : 124", explanation: "If the timed process finished first, return its exit status (success). If the timer finished first (timeout), return 124, which is the Unix convention for 'command timed out'." }
                ]
            },
            diagram: `
Timeout Process Architecture:

        ┌─────────────┐
        │   Parent    │
        │  (main)     │
        └──┬──────┬───┘
           │      │
     fork()│      │fork()
           │      │
     ┌─────▼──┐  ┌▼────────┐
     │ TIMED  │  │  TIMER  │
     │ child  │  │  child  │
     │        │  │         │
     │execvp()│  │ sleep(n)│
     │(run    │  │ (wait n │
     │command)│  │ seconds)│
     └────────┘  └─────────┘

Race condition:
  If TIMED finishes first → kill TIMER, return command's exit status
  If TIMER finishes first → kill TIMED, return 124 (timeout)

  Parent: waitpid(-1) → catches whichever finishes first
`
        },
        {
            id: "summary",
            title: "Section 3 Summary",
            content: `Section 3 built the foundational multiprocessing skills needed for assignment 3 (Stanford Shell). We learned how fork shares file descriptors through the Open File Table, how pipes provide one-way communication channels between processes, how dup2 redirects I/O, and how to implement process control with fork/waitpid/kill.`,
            keyPoints: [
                "fork() shares OFT entries → shared file cursors between parent and child",
                "pipe() creates a unidirectional channel: fds[0]=read, fds[1]=write",
                "dup2() redirects file descriptors (key for shell pipelines)",
                "Always close unused pipe ends to avoid deadlocks",
                "waitpid(-1) waits for any child — useful for racing patterns",
                "Always reap killed processes with waitpid to prevent zombies"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Pipe End Management",
            difficulty: "medium",
            description: "In the pipe program, explain what would happen if the child did NOT close fds[1] before reading from fds[0].",
            hint: "Think about when read() returns 0 (EOF) on a pipe.",
            starterCode: `// What happens if the child keeps fds[1] open?

if (pidOrZero == 0) {
    // close(fds[1]);  // OOPS — forgot to close!
    char buffer[bytesSent];
    read(fds[0], buffer, sizeof(buffer));
    // ...
}

// What behavior would you observe? Why?
// Answer: ____`,
            solution: `// What happens if the child keeps fds[1] open?

// The child would HANG FOREVER on the read() call.

// Here's why:
// - read() on a pipe returns 0 (EOF) only when ALL
//   write ends of the pipe are closed.
// - The parent closes its write end, BUT the child
//   still has fds[1] open (pointing to the write end).
// - So read() never sees EOF — there's still a writer
//   (even though it's the child itself, which is the
//   reader — a deadlock!).
// - The child blocks forever waiting for more data
//   that will never come.

// This is why the rule is: ALWAYS close pipe ends
// you don't use. Both parent and child must close
// the ends they don't need.`,
            explanation: "A pipe only signals EOF to readers when ALL write-end file descriptors are closed. If the child keeps one open, it deadlocks itself."
        }
    ]
};

export default section3;
