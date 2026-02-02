export const lecture11 = {
    id: 11,
    title: "Pipes, Continued",
    subtitle: "Subprocess, I/O Redirection, and File Descriptor Internals",
    keyTakeaway: "We can share pipes with child processes and change FDs 0-2 to connect processes and redirect their I/O. File descriptors are shared on fork because the file descriptor table, which is copied, contains pointers to a shared open file table, which is not copied.",

    sections: [
        {
            id: "recap-pipes-dup2",
            title: "Recap: Pipes and dup2",
            content: "In the previous lecture, we learned about **pipe()** and **dup2()** – the two key system calls for implementing shell pipelines. Let's recap these concepts before diving deeper into implementing inter-process communication.",
            keyPoints: [
                "pipe() creates a 'magic portal' for data between processes",
                "pipe(fds) populates fds[0] (read end) and fds[1] (write end)",
                "\"You learn to read before you write\" - read = fds[0], write = fds[1]",
                "dup2(srcfd, dstfd) copies FD info from src to dst",
                "After dup2, both FDs refer to the same resource",
                "Key insight: a pipe created before fork() is accessible in the child!"
            ],
            diagram: `How do we implement shell pipelines?

First child                     Second child
┌─────────────────────┐        ┌─────────────────────┐
│ STDIN STDOUT STDERR │        │ STDIN STDOUT STDERR │
│   0     1      2    │        │   0     1      2    │
└──────┬──────────────┘        └────────────┬────────┘
       │                                    ↑
       │        ┌───────────────┐          │
       └───────►│     Pipe      │──────────┘
                │ Read    Write │
                │ fds[0]  fds[1]│
                └───────────────┘

To implement two-process pipelines:
1. Create a pipe prior to spawning child processes
2. Spawn 2 child processes (1 per command)
3. Use dup2 to connect first child's STDOUT to pipe write end
   Use dup2 to connect second child's STDIN to pipe read end
4. execvp in each child`,
            codeExample: {
                title: "pipe() system call",
                language: "c",
                code: `int pipe(int fds[]);

// Populates fds with two file descriptors:
// - fds[0]: read end of the pipe
// - fds[1]: write end of the pipe
// Everything written to fds[1] can be read from fds[0]

// Returns 0 on success, -1 on error

int fds[2];
pipe(fds);  // fds[0] = read end, fds[1] = write end

// Think of it like opening the same file twice:
// once for reading and once for writing`,
                annotations: [
                    { match: "int fds[]", explanation: "Must pass a 2-element array. pipe() fills it with two file descriptors." },
                    { match: "fds[0]", explanation: "Read end of the pipe. Use this to read bytes written to the pipe." },
                    { match: "fds[1]", explanation: "Write end of the pipe. Bytes written here can be read from fds[0]." }
                ]
            }
        },
        {
            id: "dup2-recap",
            title: "Recap: dup2 for I/O Redirection",
            content: "**dup2()** is the key to redirecting process I/O. It copies file descriptor information from one FD number to another. After dup2, both FDs refer to the same thing – reading from one advances the position of the other.",
            keyPoints: [
                "dup2(srcfd, dstfd) copies from src → dst",
                "After dup2, dstfd now refers to what srcfd refers to",
                "If we change FDs 0-2, we redirect STDIN/STDOUT/STDERR",
                "The process using the FD doesn't know it's been redirected!",
                "Always close the original pipe FD after dup2"
            ],
            diagram: `dup2 Example: Redirecting STDOUT to a pipe

BEFORE dup2:
┌───────────────────────────────────────────────────────┐
│  FD 0    FD 1    FD 2    FD 3      FD 4              │
│  STDIN   STDOUT  STDERR  Pipe-Read Pipe-Write        │
│    ↓       ↓       ↓        ↓         ↓              │
│ terminal terminal terminal  read     write           │
└───────────────────────────────────────────────────────┘

dup2(fds[1], STDOUT_FILENO);  // dup2(4, 1)

AFTER dup2:
┌───────────────────────────────────────────────────────┐
│  FD 0    FD 1    FD 2    FD 3      FD 4              │
│  STDIN   STDOUT  STDERR  Pipe-Read Pipe-Write        │
│    ↓       ↓       ↓        ↓         ↓              │
│ terminal  write  terminal  read     write            │
│           (pipe!)                                     │
└───────────────────────────────────────────────────────┘

Now printf() goes to the pipe, not the terminal!`,
            codeExample: {
                title: "Redirecting STDOUT to a pipe",
                language: "c",
                code: `int dup2(int srcfd, int dstfd);
// Copies FD info from srcfd to dstfd
// Returns dstfd on success, -1 on error

int fds[2];
pipe(fds);

printf("This prints to the terminal\\n");

dup2(fds[1], STDOUT_FILENO);  // FD 1 now writes to pipe
close(fds[1]);  // Close original pipe FD (we have it in FD 1 now)

printf("This is sent to the pipe!\\n");  // Goes to pipe, not terminal!

// Key insight: if we change file descriptors 0-2, we can redirect
// STDIN/STDOUT/STDERR to be something else without the program knowing!`,
                annotations: [
                    { match: "dup2(fds[1], STDOUT_FILENO)", explanation: "After this, FD 1 (STDOUT) now points to the pipe write end." },
                    { match: "close(fds[1])", explanation: "Close the original FD 4 since FD 1 now refers to the same pipe." },
                    { match: "This is sent to the pipe!", explanation: "printf writes to STDOUT (FD 1), which now goes to the pipe!" }
                ]
            }
        },
        {
            id: "parent-child-pipe",
            title: "Parent-Child Pipe Communication",
            content: "A pipe can facilitate parent-child communication because file descriptors are duplicated on fork(). A pipe created prior to fork() will be accessible in the child! Both parent and child must close the pipe FDs when they are done with them.",
            keyPoints: [
                "Create pipe BEFORE fork() to share it with child",
                "After fork, both processes have the same FD numbers",
                "Child gets access to the same pipe sessions (not a copy!)",
                "Each process should close the end it's not using",
                "Both must close their ends when done"
            ],
            codeExample: {
                title: "Parent-child communication via pipe",
                language: "c",
                code: `static const char *kPipeMessage = "Hello, this message is coming through a pipe.";

int main(int argc, char *argv[]) {
    int fds[2];
    pipe(fds);
    
    size_t bytesSent = strlen(kPipeMessage) + 1;
    
    pid_t pidOrZero = fork();
    if (pidOrZero == 0) {
        // Child: only reads from pipe
        close(fds[1]);  // Close write end - child doesn't write
        
        char buffer[bytesSent];
        read(fds[0], buffer, sizeof(buffer));
        close(fds[0]);  // Done reading
        
        printf("Message from parent: %s\\n", buffer);
        return 0;
    }
    
    // Parent: only writes to pipe
    close(fds[0]);  // Close read end - parent doesn't read
    write(fds[1], kPipeMessage, bytesSent);
    close(fds[1]);  // Done writing
    
    waitpid(pidOrZero, NULL, 0);
    return 0;
}`,
                annotations: [
                    { match: "pipe(fds)", explanation: "Create pipe BEFORE fork so child shares it with parent." },
                    { match: "close(fds[1])", explanation: "Child closes write end since it only reads. Critical for proper pipe behavior!" },
                    { match: "close(fds[0])", explanation: "Parent closes read end since it only writes." },
                    { match: "waitpid(pidOrZero, NULL, 0)", explanation: "Parent waits for child to finish before exiting." }
                ]
            }
        },
        {
            id: "execvp-preserves-fds",
            title: "A Secret About execvp",
            content: "If we spawn a child and rewire its STDOUT to point to a pipe, won't everything get wiped when we call execvp()? No! **execvp consumes the process but leaves the file descriptor table intact!** This is the key insight that makes pipes work with external programs.",
            keyPoints: [
                "execvp replaces the program, NOT the file descriptor table",
                "FDs 0, 1, 2 remain connected to whatever they pointed to",
                "If STDOUT was connected to a pipe, the new program writes to the pipe",
                "The new program has no idea its output is redirected!",
                "This is how shell pipelines work"
            ],
            diagram: `execvp() and File Descriptors:

BEFORE execvp():
┌─────────────────────────────────────────┐
│           Child Process                  │
│  ┌─────────────────────────────────────┐│
│  │ File Descriptor Table:              ││
│  │   FD 0 → terminal (stdin)           ││
│  │   FD 1 → pipe write end ← (dup2'd)  ││
│  │   FD 2 → terminal (stderr)          ││
│  └─────────────────────────────────────┘│
│  Code: your shell child process         │
└─────────────────────────────────────────┘

execvp("ls", args);

AFTER execvp():
┌─────────────────────────────────────────┐
│           Child Process (now ls)         │
│  ┌─────────────────────────────────────┐│
│  │ File Descriptor Table: (PRESERVED!) ││
│  │   FD 0 → terminal (stdin)           ││
│  │   FD 1 → pipe write end ← STILL!    ││
│  │   FD 2 → terminal (stderr)          ││
│  └─────────────────────────────────────┘│
│  Code: ls program (replaced)            │
└─────────────────────────────────────────┘

ls writes to STDOUT (FD 1) → goes to pipe!`,
            codeExample: {
                title: "File descriptors survive execvp",
                language: "c",
                code: `pid_t pid = fork();
if (pid == 0) {
    // Child: set up redirection BEFORE execvp
    
    // Make STDOUT point to pipe write end
    dup2(fds[1], STDOUT_FILENO);
    close(fds[0]);  // Close unused read end
    close(fds[1]);  // Close original write end (now in FD 1)
    
    // Replace this process with "ls"
    char *args[] = {"ls", "-l", NULL};
    execvp(args[0], args);
    
    // execvp replaces the CODE, but FD table is preserved!
    // "ls" will write to FD 1, which goes to the pipe
    
    perror("execvp failed");
    exit(1);
}

// Parent can now read ls's output from the pipe!`,
                annotations: [
                    { match: "dup2(fds[1], STDOUT_FILENO)", explanation: "Set up redirection BEFORE calling execvp. FD 1 now points to pipe." },
                    { match: "execvp(args[0], args)", explanation: "Replaces the code but NOT the file descriptor table. ls inherits our redirected FDs." },
                    { match: "write to FD 1", explanation: "ls program writes to STDOUT normally, but output goes to our pipe!" }
                ]
            }
        },
        {
            id: "subprocess-implementation",
            title: "Practice: Implementing subprocess",
            content: "Let's implement the **subprocess** function, which spawns a child and connects a pipe such that the parent can write to the child's STDIN. This is useful because we can spawn and run any other program (even without source code) and feed it input.",
            keyPoints: [
                "subprocess spawns a child running a specified command",
                "Returns the child's PID and a FD to write to its STDIN",
                "1. Create a pipe",
                "2. Fork a child process",
                "3. Child changes its STDIN to be the pipe read end",
                "4. Child calls execvp to run the command",
                "5. Return the pipe write end to the caller with child's PID"
            ],
            diagram: `subprocess() Flow:

Parent (caller)                    Child
      │                              
      ├── pipe(fds) ────────────────────────────┐
      │                                         │
      ├── fork() ───────────────────────────────┤
      │                                         │
      │                          close(fds[1])  │
      │                          dup2(fds[0], STDIN)
      │                          close(fds[0])  │
      │                          execvp(command)│
      │                                ↓        │
      │                          (running grep) │
      │                                         │
close(fds[0])                                   │
      │                                         │
write(fds[1], data) ────────────────────────────┤
      │                          reads from STDIN
      │                          (gets our data!)
      │                                         │
close(fds[1]) ──────────────────────────────────┤
      │                          read returns 0 │
      │                          (EOF, exits)   │
      │                                         │
waitpid(pid) ◄──────────────────────────────────┘`,
            codeExample: {
                title: "subprocess implementation",
                language: "c",
                code: `// A struct that stores a PID and FD we can write to
typedef struct subprocess_t {
    pid_t pid;
    int supplyfd;  // FD to write to child's STDIN
} subprocess_t;

/* subprocess runs the given shell command in background
 * and returns PID + FD to write to child's STDIN
 */
subprocess_t subprocess(const char *command) {
    // This line parses the command (like assign3 does for you)
    pipeline p(command);
    
    // Step 1: Create a pipe
    int fds[2];
    pipe(fds);
    
    // Step 2: Fork
    pid_t pidOrZero = fork();
    if (pidOrZero == 0) {
        // Step 3: Child - set up STDIN to read from pipe
        close(fds[1]);  // Not writing to pipe
        
        dup2(fds[0], STDIN_FILENO);  // STDIN now reads from pipe
        close(fds[0]);  // Close original (now in FD 0)
        
        // Step 4: Run the command
        execvp(p.commands[0].argv[0], p.commands[0].argv);
        fprintf(stderr, "execvp failed: %s\\n", command);
        exit(1);
    }
    
    // Step 5: Parent - return write end
    close(fds[0]);  // Not reading from pipe
    
    subprocess_t returnStruct;
    returnStruct.pid = pidOrZero;
    returnStruct.supplyfd = fds[1];  // Caller writes here
    return returnStruct;
}`,
                annotations: [
                    { match: "typedef struct subprocess_t", explanation: "Returns both the child's PID and a file descriptor to write to its STDIN." },
                    { match: "dup2(fds[0], STDIN_FILENO)", explanation: "Key step: child's STDIN now reads from the pipe instead of terminal." },
                    { match: "execvp(p.commands[0].argv[0]", explanation: "The execvp'd program reads from STDIN, which is now our pipe!" },
                    { match: "returnStruct.supplyfd = fds[1]", explanation: "Caller writes to this FD to send data to the child's STDIN." }
                ]
            }
        },
        {
            id: "subprocess-usage",
            title: "Using subprocess",
            content: "Now let's see how to use subprocess in practice. We spawn a child running grep, feed it data through the pipe, then close the pipe and wait for the child to finish.",
            keyPoints: [
                "Spawn child with subprocess()",
                "Write data to sp.supplyfd (goes to child's STDIN)",
                "Close sp.supplyfd to signal EOF to the child",
                "Call waitpid to wait for child to finish",
                "No read() call needed - execvp'd program reads from its STDIN!"
            ],
            codeExample: {
                title: "Using subprocess with grep",
                language: "c",
                code: `int main(int argc, char *argv[]) {
    // Spawn a child running grep command
    subprocess_t sp = subprocess("/usr/bin/grep Sunny");
    
    // Weather data we want to filter
    const char *recent_weather[] = {
        "Sunny 72", "Rainy 55", "Cloudy 62",
        "Sunny 80", "Sunny 75", "Cloudy 61",
        "Sunny 68", "Rainy 60", "Sunny 85"
    };
    size_t nelems = sizeof(recent_weather) / sizeof(recent_weather[0]);
    
    // Write each entry on its own line to child's STDIN
    for (size_t i = 0; i < nelems; i++) {
        dprintf(sp.supplyfd, "%s\\n", recent_weather[i]);
    }
    
    // Close write FD to signal EOF (input is done)
    close(sp.supplyfd);
    
    // Wait for child to finish
    waitpid(sp.pid, NULL, 0);
    return 0;
}

// Output (grep filters for "Sunny"):
// Sunny 72
// Sunny 80
// Sunny 75
// Sunny 68
// Sunny 85`,
                annotations: [
                    { match: 'subprocess("/usr/bin/grep Sunny")', explanation: "Spawns grep as a child, returns FD to write to its STDIN." },
                    { match: "dprintf(sp.supplyfd", explanation: "dprintf writes formatted output to a file descriptor (like fprintf for FDs)." },
                    { match: "close(sp.supplyfd)", explanation: "CRITICAL: closing signals EOF. Without this, grep waits forever for more input!" },
                    { match: "waitpid(sp.pid, NULL, 0)", explanation: "Wait for grep to finish. Caller is responsible for this, not subprocess()." }
                ]
            }
        },
        {
            id: "io-redirection-files",
            title: "I/O Redirection with Files",
            content: "There is one final shell feature we can implement with our understanding of file descriptors: **I/O redirection with files**. This is how `sort file.txt > output.txt` and `sort < input.txt` work in shells. You'll implement this in **assign3 Milestone 5**!",
            keyPoints: [
                "'>' redirects STDOUT to a file",
                "'<' redirects STDIN from a file",
                "Open the file, then use dup2 to connect FD 0 or 1",
                "For output: open with O_WRONLY | O_CREAT | O_TRUNC",
                "For input: open with O_RDONLY",
                "Consider how this applies to your assign3 implementation!"
            ],
            diagram: `I/O Redirection with Files:

COMMAND: sort < input.txt

Child Process (running sort):
┌───────────────────────────────────────────┐
│  FD 0 (STDIN)  → input.txt (not terminal!)│
│  FD 1 (STDOUT) → terminal                 │
│  FD 2 (STDERR) → terminal                 │
│                                           │
│  sort reads from FD 0, which is now the   │
│  file input.txt instead of the terminal   │
└───────────────────────────────────────────┘

COMMAND: sort file.txt > output.txt

Child Process (running sort):
┌───────────────────────────────────────────┐
│  FD 0 (STDIN)  → terminal                 │
│  FD 1 (STDOUT) → output.txt (not terminal)│
│  FD 2 (STDERR) → terminal                 │
│                                           │
│  sort writes to FD 1, which is now the    │
│  file output.txt instead of the terminal  │
└───────────────────────────────────────────┘`,
            codeExample: {
                title: "Implementing I/O redirection",
                language: "c",
                code: `// For assign3: how to redirect STDIN from a file

pid_t pid = fork();
if (pid == 0) {
    // Child: redirect STDIN to read from input.txt
    int fd = open("input.txt", O_RDONLY);
    if (fd == -1) {
        perror("open");
        exit(1);
    }
    
    dup2(fd, STDIN_FILENO);  // STDIN now reads from file
    close(fd);  // Close original FD
    
    // Now execvp - the program reads from the file!
    char *args[] = {"sort", NULL};
    execvp(args[0], args);
    exit(1);
}

// For output redirection: sort file.txt > output.txt
pid_t pid = fork();
if (pid == 0) {
    // Child: redirect STDOUT to write to output.txt
    int fd = open("output.txt", O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (fd == -1) {
        perror("open");
        exit(1);
    }
    
    dup2(fd, STDOUT_FILENO);  // STDOUT now writes to file
    close(fd);  // Close original FD
    
    char *args[] = {"sort", "file.txt", NULL};
    execvp(args[0], args);
    exit(1);
}`,
                annotations: [
                    { match: 'open("input.txt", O_RDONLY)', explanation: "Open the input file for reading." },
                    { match: "dup2(fd, STDIN_FILENO)", explanation: "STDIN (FD 0) now reads from the file instead of terminal." },
                    { match: "O_WRONLY | O_CREAT | O_TRUNC", explanation: "Write-only, create if doesn't exist, truncate if exists. Standard for '>'." },
                    { match: "dup2(fd, STDOUT_FILENO)", explanation: "STDOUT (FD 1) now writes to the file instead of terminal." }
                ]
            }
        },
        {
            id: "pipe-stalling",
            title: "Pipe Stalling: Why Closing Matters",
            content: "Not closing write ends of pipes can cause serious functionality issues. If a process calls read() and there's nothing more to read, but the write end is still open somewhere, **it will block forever waiting for more input!** This is a common source of bugs in shell implementations.",
            keyPoints: [
                "read() on a pipe blocks if write end is open and no data available",
                "read() returns 0 (EOF) only when ALL write ends are closed",
                "If child reads and parent doesn't close write end → child stalls",
                "If child reads continuously but parent doesn't close → child stalls",
                "If child forgets to close its copy of write end → child stalls itself!",
                "This is critically important for assign3!"
            ],
            codeExample: {
                title: "Pipe stalling scenarios",
                language: "c",
                code: `// SCENARIO 1: Parent doesn't close write end → child stalls!
int main() {
    int fds[2];
    pipe(fds);
    
    pid_t pid = fork();
    if (pid == 0) {
        close(fds[1]);  // Child closes its write end
        char buf[100];
        read(fds[0], buf, sizeof(buf));  // CHILD STALLS HERE!
        // Why? Parent still has write end open
        // read() waits for more data that never comes
        close(fds[0]);
        return 0;
    }
    
    close(fds[0]);
    // Parent forgot to write AND close fds[1]!
    // close(fds[1]);  ← Missing this line!
    waitpid(pid, NULL, 0);  // Waits forever - child is stalled
    return 0;
}

// SCENARIO 2: Child forgets to close write end → stalls itself!
int main() {
    int fds[2];
    pipe(fds);
    
    pid_t pid = fork();
    if (pid == 0) {
        // close(fds[1]);  ← MISSING! Child still has write end
        char buf[100];
        while (true) {
            ssize_t ret = read(fds[0], buf, sizeof(buf));
            if (ret == 0) break;  // Never happens - child has write end!
            printf("%s\\n", buf);
        }
        // CHILD STALLS HERE - it's waiting for EOF
        // but it itself holds the write end open!
        close(fds[0]);
        return 0;
    }
    
    close(fds[0]);
    write(fds[1], "hello", 6);
    close(fds[1]);  // Parent closes, but child still has it!
    waitpid(pid, NULL, 0);
    return 0;
}`,
                annotations: [
                    { match: "CHILD STALLS HERE!", explanation: "read() blocks because parent's write end is still open - more data might come." },
                    { match: "Missing this line!", explanation: "Parent must close write end to signal EOF to child's read()." },
                    { match: "MISSING!", explanation: "Child must close write end too! On fork, child got a copy of BOTH ends." },
                    { match: "it itself holds the write end", explanation: "Even if parent closes, child's copy keeps the pipe 'open' for writing." }
                ]
            }
        },
        {
            id: "stalling-examples",
            title: "More Stalling Examples",
            content: "Let's look at more scenarios where improper pipe handling causes stalls. Understanding these patterns will help you debug your assign3 shell.",
            keyPoints: [
                "Parent waits before writing → child blocks on read",
                "Parent writes after waitpid → deadlock",
                "Child reads loop without write end closed → hangs",
                "Rule: close pipe ends you're not using IMMEDIATELY after fork"
            ],
            codeExample: {
                title: "Parent writes too late - deadlock!",
                language: "c",
                code: `// DEADLOCK: Parent waits for child, child waits for data
int main() {
    int fds[2];
    pipe(fds);
    size_t bytesSent = strlen(kPipeMessage) + 1;
    
    pid_t pid = fork();
    if (pid == 0) {
        close(fds[1]);
        char buffer[bytesSent];
        read(fds[0], buffer, sizeof(buffer));  // Waits for data...
        close(fds[0]);
        printf("Message: %s\\n", buffer);
        return 0;
    }
    
    close(fds[0]);
    
    // BUG: Parent waits BEFORE writing!
    waitpid(pid, NULL, 0);  // Parent waits for child
    
    // Child is waiting for data, parent is waiting for child
    // DEADLOCK! Neither can proceed.
    
    write(fds[1], kPipeMessage, bytesSent);  // Never reached
    close(fds[1]);
    return 0;
}

// CORRECT: Write before waitpid!
int main() {
    int fds[2];
    pipe(fds);
    size_t bytesSent = strlen(kPipeMessage) + 1;
    
    pid_t pid = fork();
    if (pid == 0) {
        close(fds[1]);
        char buffer[bytesSent];
        read(fds[0], buffer, sizeof(buffer));
        close(fds[0]);
        printf("Message: %s\\n", buffer);
        return 0;
    }
    
    close(fds[0]);
    write(fds[1], kPipeMessage, bytesSent);  // Write FIRST
    close(fds[1]);  // Signal EOF
    waitpid(pid, NULL, 0);  // THEN wait
    return 0;
}`,
                annotations: [
                    { match: "// Parent waits for child", explanation: "BUG: Parent waits for child, but child is waiting for data from parent!" },
                    { match: "DEADLOCK! Neither can proceed", explanation: "Classic deadlock: A waits for B, B waits for A. Program hangs forever." },
                    { match: "Write FIRST", explanation: "Correct order: send data, close pipe, THEN wait for child." }
                ]
            }
        },
        {
            id: "fd-table-intro",
            title: "File Descriptor Table",
            content: "Why are pipes shared when we call fork()? To understand this, we need to look at how the OS manages file descriptors. The OS maintains a **Process Control Block** for each process, which includes a **file descriptor table** – an array of info about open files/resources.",
            keyPoints: [
                "Each process has a Process Control Block (PCB)",
                "PCB contains the file descriptor table",
                "A file descriptor is an index into the FD table",
                "FD table entries point to the Open File Table",
                "The Open File Table is GLOBAL (shared across processes)",
                "This is why fork() shares pipes!"
            ],
            diagram: `File Descriptor Table Structure:

Process Control Block (per process)
┌────────────────────────────────────────────────────────┐
│  File Descriptor Table:                                │
│  ┌─────────────────────────────────────────────────┐  │
│  │  0    1    2    3    4    ...                   │  │
│  │  ↓    ↓    ↓    ↓    ↓                          │  │
│  │  │    │    │    │    │                          │  │
│  └──┼────┼────┼────┼────┼──────────────────────────┘  │
└─────┼────┼────┼────┼────┼─────────────────────────────┘
      │    │    │    │    │
      ▼    ▼    ▼    ▼    ▼
┌─────────────────────────────────────────────────────────┐
│              Open File Table (GLOBAL)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ terminal │ │ terminal │ │ terminal │ │ file.txt │   │
│  │ (stdin)  │ │ (stdout) │ │ (stderr) │ │ mode: r  │   │
│  │ refcnt:1 │ │ refcnt:1 │ │ refcnt:1 │ │ cursor:0 │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└─────────────────────────────────────────────────────────┘

Key insight: FD table entries are POINTERS to Open File Table entries!`,
            codeExample: {
                title: "File descriptors are indexes",
                language: "c",
                code: `// Opening a file creates a new Open File Table entry
// and a new FD table entry pointing to it

int fd = open("file.txt", O_RDONLY);
// fd is now 3 (next available FD number)

// What happened internally:
// 1. OS creates entry in Open File Table:
//    - mode: read-only
//    - cursor: 0 (start of file)
//    - refcount: 1
// 2. OS finds first empty FD slot (3)
// 3. FD 3 now points to the Open File Table entry

// pipe() creates TWO Open File Table entries
int fds[2];
pipe(fds);  // fds[0] = 3, fds[1] = 4

// Now:
// - FD 3 points to "pipe read end" entry
// - FD 4 points to "pipe write end" entry
// - These entries are linked internally`,
                annotations: [
                    { match: "int fd = open", explanation: "open() creates an Open File Table entry and returns a new FD pointing to it." },
                    { match: "next available FD number", explanation: "OS assigns the lowest available FD number (0,1,2 are usually taken)." },
                    { match: "refcount: 1", explanation: "Open File Table tracks how many FDs point to it. Important for cleanup!" },
                    { match: "These entries are linked", explanation: "Pipe read and write ends are connected internally - writes to one appear at the other." }
                ]
            }
        },
        {
            id: "open-file-table",
            title: "Open File Table and fork()",
            content: "The key insight: when fork() creates a new process, the OS creates a **copy of the file descriptor table**, but both tables point to the **same Open File Table entries**. This is why pipes are shared between parent and child!",
            keyPoints: [
                "fork() copies the FD table, NOT the Open File Table",
                "Both processes' FDs point to same Open File Table entries",
                "Open File Table entries have a reference count",
                "When FD is closed, refcount decrements",
                "Entry is freed only when refcount reaches 0",
                "This is why BOTH parent and child must close pipe ends!"
            ],
            diagram: `After fork(): Shared Open File Table

PARENT Process Control Block
┌──────────────────────────────────────────────┐
│  File Descriptor Table:                       │
│  0    1    2    3         4                   │
│  │    │    │    │         │                   │
└──┼────┼────┼────┼─────────┼───────────────────┘
   │    │    │    │         │
   │    │    │    │         └──────────────────┐
   │    │    │    └─────────────────────────┐  │
   │    │    │                              │  │
   │    │    └───────────────────────────┐  │  │
   │    │                                │  │  │
CHILD Process Control Block              │  │  │
┌──────────────────────────────────────────────┐
│  File Descriptor Table (COPIED):              │
│  0    1    2    3         4              │    │
│  │    │    │    │         │              │    │
└──┼────┼────┼────┼─────────┼──────────────│────┘
   │    │    │    │         │              │
   ▼    ▼    ▼    ▼         ▼              ▼
┌─────────────────────────────────────────────────────┐
│             Open File Table (SHARED!)               │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐         │
│  │  terminal │ │ pipe read │ │ pipe write│         │
│  │ refcnt: 2 │ │ refcnt: 2 │ │ refcnt: 2 │         │
│  └───────────┘ └───────────┘ └───────────┘         │
└─────────────────────────────────────────────────────┘

Both parent and child FD 3 → same pipe read end (refcnt=2)
Both parent and child FD 4 → same pipe write end (refcnt=2)`,
            codeExample: {
                title: "Fork creates shallow copies of FDs",
                language: "c",
                code: `int fds[2];
pipe(fds);  // fds[0] = 3, fds[1] = 4

// Open File Table now has:
// - Pipe read end (refcnt=1)
// - Pipe write end (refcnt=1)

pid_t pid = fork();

// After fork, Open File Table has:
// - Pipe read end (refcnt=2)  ← both processes have it!
// - Pipe write end (refcnt=2) ← both processes have it!

if (pid == 0) {
    // Child closes its copy of write end
    close(fds[1]);  // refcnt: 2 → 1
    
    // Child reads
    read(fds[0], buf, sizeof(buf));
    
    close(fds[0]);  // refcnt: 2 → 1
    return 0;
}

// Parent closes its copy of read end
close(fds[0]);  // refcnt: 2 → 1 (child still has it)

write(fds[1], "hello", 6);

close(fds[1]);  // refcnt: 1 → 0 (entry freed!)
// NOW read() in child returns EOF

waitpid(pid, NULL, 0);`,
                annotations: [
                    { match: "refcnt=1", explanation: "After pipe(), only one process has these FDs open." },
                    { match: "refcnt=2", explanation: "After fork(), both parent and child point to same entries. Refcount increased!" },
                    { match: "2 → 1", explanation: "Closing decrements refcount. Entry still exists because other process has it." },
                    { match: "1 → 0", explanation: "When refcount hits 0, entry is freed. This signals EOF to readers!" }
                ]
            }
        },
        {
            id: "refcount-practice",
            title: "Practice: Reference Counting",
            content: "Understanding reference counts helps explain why we need to close FDs in both parent and child. Let's examine two scenarios to see the difference.",
            keyPoints: [
                "Open before fork → refcount = 2 (both have same entry)",
                "Open after fork → refcount = 1 each (separate entries)",
                "This is why pipes must be created BEFORE fork",
                "And why both processes must close their ends"
            ],
            codeExample: {
                title: "Open before fork vs after fork",
                language: "c",
                code: `// SCENARIO A: Open BEFORE fork
int fd = open("file.txt", O_RDONLY);  // refcount = 1
pid_t pid = fork();  // Now refcount = 2!

// Both parent and child share the SAME file session
// - Same cursor position!
// - If child reads 10 bytes, parent's cursor advances too!
// - Must close in BOTH processes

if (pid == 0) {
    read(fd, buf, 10);  // Reads bytes 0-9
    close(fd);  // refcount: 2 → 1
    exit(0);
}
waitpid(pid, NULL, 0);
read(fd, buf, 10);  // Reads bytes 10-19 (cursor advanced!)
close(fd);  // refcount: 1 → 0


// SCENARIO B: Open AFTER fork
pid_t pid = fork();
int fd = open("file.txt", O_RDONLY);  // Each gets refcount = 1

// Parent and child have SEPARATE file sessions
// - Independent cursor positions!
// - Reading doesn't affect the other's cursor

if (pid == 0) {
    read(fd, buf, 10);  // Child reads bytes 0-9
    close(fd);  // Child's entry freed
    exit(0);
}
waitpid(pid, NULL, 0);
read(fd, buf, 10);  // Parent reads bytes 0-9 (own cursor)
close(fd);  // Parent's entry freed


// KEY INSIGHT: To share a pipe, create it BEFORE fork!
pid_t pid = fork();
int fds[2];
pipe(fds);  // UH OH - parent and child have SEPARATE pipes!
// They can't communicate!`,
                annotations: [
                    { match: "refcount = 2!", explanation: "After fork, both processes point to the same Open File Table entry." },
                    { match: "cursor advanced!", explanation: "Shared entry = shared cursor. Child's read affects parent's position." },
                    { match: "Each gets refcount = 1", explanation: "Opening after fork creates separate entries. Each starts at position 0." },
                    { match: "SEPARATE pipes!", explanation: "Critical: pipe after fork means two unconnected pipes. Can't communicate!" }
                ]
            }
        },
        {
            id: "dup2-open-file-table",
            title: "How dup2 Affects File Descriptor Table",
            content: "dup2() modifies the file descriptor table by making the destination FD point to the same Open File Table entry as the source FD. The destination's old entry (if any) gets its refcount decremented.",
            keyPoints: [
                "dup2(src, dst) makes dst point where src points",
                "The Open File Table entry's refcount increases",
                "If dst was already open, its old entry's refcount decreases",
                "After dup2, we usually close the original FD"
            ],
            diagram: `dup2(fds[0], STDIN_FILENO)  // dup2(3, 0)

BEFORE dup2:
┌─────────────────────────────────────────┐
│  FD 0    FD 1    FD 2    FD 3    FD 4   │
│    │       │       │       │       │    │
│    ▼       ▼       ▼       ▼       ▼    │
│ terminal terminal terminal pipe-R pipe-W│
│  ref:1    ref:1    ref:1   ref:1  ref:1 │
└─────────────────────────────────────────┘

AFTER dup2(3, 0):
┌───────────────────────────────────────────────────┐
│  FD 0    FD 1    FD 2    FD 3    FD 4             │
│    │       │       │       │       │              │
│    │       ▼       ▼       │       ▼              │
│    │    terminal terminal  │    pipe-W            │
│    │     ref:1    ref:1    │    ref:1             │
│    │                       │                      │
│    └───────────────────────┼──► pipe-R            │
│                            └──► ref:2  ← increased│
│                                                   │
│  (terminal stdin ref:1 → ref:0, freed)            │
└───────────────────────────────────────────────────┘

Now both FD 0 and FD 3 point to pipe read end!
close(fds[0]) reduces refcount back to 1.`,
            codeExample: {
                title: "dup2 and reference counts",
                language: "c",
                code: `int fds[2];
pipe(fds);  // fds[0] = 3, fds[1] = 4
// pipe-read: refcnt=1, pipe-write: refcnt=1

// We want STDIN to read from the pipe
dup2(fds[0], STDIN_FILENO);  // dup2(3, 0)
// Now: FD 0 and FD 3 both point to pipe-read
// pipe-read: refcnt=2

close(fds[0]);  // Don't need FD 3 anymore
// pipe-read: refcnt=1 (FD 0 still has it)

// Now reading from STDIN reads from the pipe!
char buf[100];
read(STDIN_FILENO, buf, sizeof(buf));  // Reads from pipe!

// When we're done:
close(STDIN_FILENO);  // or just exit, which closes all FDs
// pipe-read: refcnt=0, entry freed`,
                annotations: [
                    { match: "dup2(fds[0], STDIN_FILENO)", explanation: "FD 0 now points to same pipe entry as FD 3. Refcount goes from 1 to 2." },
                    { match: "close(fds[0])", explanation: "Close original FD 3. Refcount goes from 2 to 1. Entry still exists via FD 0." },
                    { match: "read(STDIN_FILENO", explanation: "Reading from FD 0 now reads from the pipe instead of terminal!" }
                ]
            }
        },
        {
            id: "assign3-preview",
            title: "Assign3: Implement Your Own Shell!",
            content: "In assign3, you'll implement **stsh (Stanford Shell)** - your own shell that supports pipelines and I/O redirection. All the concepts from this lecture are directly applicable!",
            keyPoints: [
                "Milestone 1: Reviewing provided code (pipeline parsing)",
                "Milestone 2: Single commands",
                "Milestone 3: Two-process pipelines",
                "Milestone 4: Multi-process pipelines",
                "Milestone 5: I/O redirection (< and >)",
                "Unify code across milestones where possible!"
            ],
            codeExample: {
                title: "stsh skeleton code",
                language: "c",
                code: `// stsh.cc - entry point for your shell
int main(int argc, char *argv[]) {
    pid_t stshpid = getpid();
    rlinit(argc, argv);
    
    while (true) {
        string line;
        if (!readline(line) || line == "quit" || line == "exit") break;
        if (line.empty()) continue;
        
        try {
            pipeline p(line);  // Parses "cmd1 | cmd2 > file"
            runPipeline(p);    // YOUR CODE HERE!
        } catch (const STSHException& e) {
            cerr << e.what() << endl;
            if (getpid() != stshpid) exit(0);
        }
    }
    return 0;
}

void runPipeline(const pipeline& p) {
    // TODO: Implement this!
    // For each command in the pipeline:
    // 1. Create pipes as needed
    // 2. Fork child processes
    // 3. Set up I/O redirection (dup2)
    // 4. execvp the commands
    // 5. Wait for all children
}`,
                annotations: [
                    { match: "pipeline p(line)", explanation: "Provided parser converts user input into a structured pipeline object." },
                    { match: "runPipeline(p)", explanation: "You implement this! Apply everything from this lecture." },
                    { match: "if (getpid() != stshpid)", explanation: "Safety check: if a child throws an exception, exit the child, not the shell!" }
                ]
            }
        },
        {
            id: "summary",
            title: "Lecture 11 Summary",
            content: "We learned how to share pipes with child processes and redirect I/O using dup2. We explored why pipes work across fork() by understanding the file descriptor table and open file table, and why proper closing is critical to avoid stalls.",
            keyPoints: [
                "Pipe created before fork() is shared with child",
                "dup2() redirects FDs 0-2 without the program knowing",
                "execvp() preserves the file descriptor table",
                "subprocess pattern: fork + dup2 + execvp",
                "I/O redirection with files uses open() + dup2()",
                "Close pipe ends you don't use immediately after fork!",
                "Open File Table is shared; refcounts track usage"
            ],
            advantages: [
                "Pipes enable powerful inter-process communication",
                "Programs can be connected without modification",
                "I/O redirection works for any program",
                "File descriptor sharing makes fork() efficient"
            ],
            disadvantages: [
                "Must be careful to close all pipe ends correctly",
                "Easy to create deadlocks with improper ordering",
                "Debugging stalled programs can be tricky",
                "Reference counting requires understanding to get right"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Pipe Close Order",
            difficulty: "easy",
            description: "What happens if the child forgets to close the write end of the pipe before reading?",
            hint: "Think about what read() does when the write end is still open.",
            starterCode: `int main() {
    int fds[2];
    pipe(fds);
    
    pid_t pid = fork();
    if (pid == 0) {
        // Child reads from pipe
        // BUG: forgot to close(fds[1])!
        char buf[100];
        while (read(fds[0], buf, sizeof(buf)) > 0) {
            printf("%s\\n", buf);
        }
        return 0;
    }
    
    close(fds[0]);
    write(fds[1], "hello", 6);
    close(fds[1]);
    waitpid(pid, NULL, 0);
    return 0;
}

// What happens? _______________`,
            solution: `// The child will STALL forever!
// 
// Even though the parent closes fds[1], the child still
// has its own copy of fds[1] open (from fork).
// 
// read() blocks waiting for more data because the write
// end is still open (in the child's own FD table!).
// 
// Fix: add close(fds[1]) in the child before reading.

int main() {
    int fds[2];
    pipe(fds);
    
    pid_t pid = fork();
    if (pid == 0) {
        close(fds[1]);  // FIX: close write end first!
        char buf[100];
        while (read(fds[0], buf, sizeof(buf)) > 0) {
            printf("%s\\n", buf);
        }
        close(fds[0]);
        return 0;
    }
    
    close(fds[0]);
    write(fds[1], "hello", 6);
    close(fds[1]);
    waitpid(pid, NULL, 0);
    return 0;
}`,
            explanation: "After fork(), both parent and child have copies of both pipe ends. The child must close its write end so that when the parent closes the write end, the refcount goes to 0 and read() sees EOF."
        },
        {
            id: "ex2",
            title: "Reference Count After Fork",
            difficulty: "medium",
            description: "What is the reference count for the pipe read end after this code executes?",
            hint: "Track how pipe() sets refcount, and how fork() changes it.",
            starterCode: `int fds[2];
pipe(fds);  // What is refcount of pipe read end here? ___

pid_t pid1 = fork();  // What is refcount now? ___

if (pid1 != 0) {
    pid_t pid2 = fork();  // What is refcount now? ___
}

// Final refcount of pipe read end: ___`,
            solution: `int fds[2];
pipe(fds);  // refcount = 1 (only parent has it)

pid_t pid1 = fork();  // refcount = 2 (parent + child1)

if (pid1 != 0) {
    // Only parent reaches here
    pid_t pid2 = fork();  // refcount = 3 (parent + child1 + child2)
}

// Final refcount of pipe read end: 3
// 
// Process tree:
//     Parent (has fds[0])
//        ├── Child1 (has fds[0])
//        └── Child2 (has fds[0])
//
// All three processes have the same FD pointing to the
// same Open File Table entry, so refcount = 3.`,
            explanation: "fork() duplicates the FD table, making each FD in the child point to the same Open File Table entries as the parent. Each fork increments the refcount for all open FDs."
        },
        {
            id: "ex3",
            title: "Implementing a Two-Process Pipeline",
            difficulty: "hard",
            description: "Implement 'cat file.txt | grep hello' by creating a pipe, forking two children, and connecting them.",
            hint: "First child writes to pipe (STDOUT→pipe), second child reads from pipe (pipe→STDIN).",
            starterCode: `int main() {
    int fds[2];
    pipe(fds);
    
    // TODO: Fork two children
    // Child 1: run "cat file.txt", redirect STDOUT to pipe
    // Child 2: run "grep hello", redirect STDIN from pipe
    // Parent: close both pipe ends, wait for both children
    
    return 0;
}`,
            solution: `int main() {
    int fds[2];
    pipe(fds);
    
    // Child 1: cat file.txt
    pid_t pid1 = fork();
    if (pid1 == 0) {
        close(fds[0]);  // Not reading
        dup2(fds[1], STDOUT_FILENO);  // STDOUT → pipe
        close(fds[1]);  // Close original
        
        char *args[] = {"cat", "file.txt", NULL};
        execvp(args[0], args);
        exit(1);
    }
    
    // Child 2: grep hello
    pid_t pid2 = fork();
    if (pid2 == 0) {
        close(fds[1]);  // Not writing
        dup2(fds[0], STDIN_FILENO);  // STDIN ← pipe
        close(fds[0]);  // Close original
        
        char *args[] = {"grep", "hello", NULL};
        execvp(args[0], args);
        exit(1);
    }
    
    // Parent: close pipe ends and wait
    close(fds[0]);
    close(fds[1]);
    waitpid(pid1, NULL, 0);
    waitpid(pid2, NULL, 0);
    
    return 0;
}`,
            explanation: "Each child must close the pipe end it doesn't use, then dup2 the end it does use into the appropriate standard FD. The parent must close BOTH ends so that when cat finishes, grep sees EOF."
        }
    ]
};

export default lecture11;
