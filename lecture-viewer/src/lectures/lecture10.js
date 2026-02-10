export const lecture10 = {
    id: 10,
    title: "Pipes",
    subtitle: "Inter-Process Communication with pipe() and dup2()",
    keyTakeaway: "Pipes are sets of file descriptors that let us read/write data between processes. We can share pipes with child processes to send arbitrary data back and forth, and use dup2() to redirect STDIN/STDOUT to achieve shell pipelines.",

    sections: [
        {
            id: "phone-line",
            title: "What is a Pipe?",
            content: `Today we're going to see our first glimpse of how processes can actually communicate with each other. **A pipe is like a phone line between two processes.** One process can talk (write) into one end, and the other process can listen (read) from the other end.`,
            keyPoints: [
                "🎯 KEY ANALOGY: A pipe is like a phone line between two processes",
                "One process writes data into the pipe, another reads it out",
                "This enables powerful shell features like 'ls | grep txt'",
                "Processes don't need to know they're connected – they just use stdin/stdout!"
            ],
            diagram: `
The Phone Line Analogy:

  ┌─────────────────┐                              ┌─────────────────┐
  │   Process A     │                              │   Process B     │
  │                 │                              │                 │
  │  "Hello!" ──────┼──────── PIPE ────────────────┼────▶ "Hello!"  │
  │                 │      (phone line)            │                 │
  └─────────────────┘                              └─────────────────┘
       SPEAKER                                          LISTENER
      (writes)                                          (reads)

  Just like a phone call:
  • One person talks, the other listens
  • The message travels through the "line" (pipe)
  • Neither person needs to know HOW the phone works
            `
        },
        {
            id: "recap-shell",
            title: "Recap: fork, waitpid, execvp and our first shell",
            content: `In Lecture 9, we learned the three key system calls for building a shell: fork() to create child processes, waitpid() to wait for them to finish, and execvp() to run different programs. Now we'll learn how to connect processes together with pipes.`,
            keyPoints: [
                "fork() creates a child process that's a clone of the parent",
                "execvp() replaces the current process with a new program",
                "waitpid() lets parent wait for child to exit and clean up",
                "Shell pattern: fork → execvp (child) → waitpid (parent)",
                "For assign3, you'll implement a full shell with pipes and more!"
            ],
            codeExample: {
                title: "First shell pattern recap",
                language: "cpp",
                code: `void runPipeline(const pipeline& p) {
    command cmd = p.commands[0];  // get tokenized version of command

    // Step 1: fork off a child process to run the command
    pid_t pidOrZero = fork();
    if (pidOrZero == 0) {
        // Step 2: if we are the child, execute the command
        execvp(cmd.argv[0], cmd.argv);
        // If the child gets here, there was an error
        throw STSHException(string(cmd.argv[0]) + ": Command not found.");
    }

    // Step 3: if we are the parent, wait for the child
    waitpid(pidOrZero, NULL, 0);
}`,
                annotations: [
                    { match: "p.commands[0]", explanation: "Pipeline contains parsed commands. For now, just one command." },
                    { match: "fork()", explanation: "Creates child process. Returns 0 in child, child's PID in parent." },
                    { match: "execvp(cmd.argv[0], cmd.argv)", explanation: "Child becomes the requested program. Never returns if successful!" },
                    { match: "throw STSHException", explanation: "If execvp fails, child must terminate. Otherwise it would continue running shell code!" },
                    { match: "waitpid(pidOrZero, NULL, 0)", explanation: "Parent waits for child to finish before prompting again." }
                ]
            }
        },
        {
            id: "imposter-shell-bug",
            title: "⚠️ Warning: The 'Imposter Shell' Bug",
            content: `Before we add more features, there's a critical bug pattern you MUST understand. What happens if execvp fails and we forget to terminate the child process?`,
            keyPoints: [
                "If execvp fails (e.g., command not found), it returns -1",
                "If child doesn't exit/throw, it continues running parent's code!",
                "The child becomes an 'imposter shell' - prompting for input just like the parent",
                "Symptom: You have to type 'quit' multiple times to exit your shell!",
                "Always throw/exit after execvp failure in the child process"
            ],
            codeExample: {
                title: "The bug: forgetting to terminate child after execvp failure",
                language: "cpp",
                code: `// BUGGY CODE - DO NOT DO THIS!
pid_t pid = fork();
if (pid == 0) {
    execvp(cmd.argv[0], cmd.argv);
    // BUG: If we reach here, execvp failed, but we don't exit!
    // The child continues running and goes back to main()...
    // Now TWO shells are prompting for input!
}
waitpid(pid, NULL, 0);

// CORRECT CODE:
pid_t pid = fork();
if (pid == 0) {
    execvp(cmd.argv[0], cmd.argv);
    throw STSHException("Command not found");  // Child terminates!
    // OR: exit(1);
}
waitpid(pid, NULL, 0);`,
                annotations: [
                    { match: "BUG: If we reach here", explanation: "execvp failed, but without exit/throw, the child keeps running parent's code!" },
                    { match: "TWO shells are prompting", explanation: "Each invalid command spawns another 'imposter' shell. Enter 3 bad commands = 3 extra shells!" },
                    { match: "throw STSHException", explanation: "ALWAYS terminate the child if execvp fails. The child should NEVER continue past execvp." }
                ]
            },
            diagram: `
The "Imposter Shell" Bug in Action:

  $ ./stsh                 ← Start shell
  stsh> blah               ← Invalid command (execvp fails)
  stsh> blah               ← Another invalid command
  stsh> blah               ← One more invalid command
  stsh> quit               ← Try to quit...
  stsh> quit               ← Still prompting?!
  stsh> quit               ← Why do I have to quit 3 times?!
  $                        ← Finally back to real shell

  What happened:
  ┌─────────────────────────────────────────────────────────────┐
  │  You now have 3 "imposter" child shells running!            │
  │  Each invalid command created a child that didn't exit.     │
  │  Each "imposter" returned to main() and ran the shell loop! │
  │  You must quit each one individually.                       │
  └─────────────────────────────────────────────────────────────┘
            `
        },
        {
            id: "pipeline-demo",
            title: "🖥️ Demo: Shell Pipelines in Action",
            content: `Before we dive into implementation, let's see what pipelines can do! These demos show why pipes are so powerful.`,
            keyPoints: [
                "grep '(2017)' movies.csv | wc -l → Count movies from 2017",
                "The | symbol connects stdout of left command to stdin of right",
                "Commands run IN PARALLEL (not sequentially!)",
                "sleep 2 | sleep 2 takes 2 seconds, not 4!"
            ],
            diagram: `
Terminal Demo 1: Counting movies from 2017
──────────────────────────────────────────

  $ grep '(2017)' movies.csv | wc -l
  147

  What happens:
  1. grep searches movies.csv for lines containing "(2017)"
  2. grep's output is piped to wc (word count)
  3. wc -l counts the lines it receives
  4. Result: 147 movies from 2017!

Terminal Demo 2: Proving parallel execution
───────────────────────────────────────────

  $ sleep 2 | sleep 2     ← How long does this take?
  (2 seconds later...)    ← Only 2 seconds! NOT 4!
  $

  Both sleep commands run AT THE SAME TIME.
  If they ran sequentially, it would take 4 seconds.

Terminal Demo 3: Interactive pipeline (conduit program)
─────────────────────────────────────────────────────────

  $ conduit --delay 1 | conduit --count 3
  hello                   ← Type "hello"
  hhh                     ← After 1 sec: 'h' repeated 3x
  eee                     ← After 1 sec: 'e' repeated 3x
  lll                     ← After 1 sec: 'l' repeated 3x
  lll                     ← After 1 sec: 'l' repeated 3x
  ooo                     ← After 1 sec: 'o' repeated 3x

  First conduit outputs chars with 1-second delay.
  Second conduit repeats each char 3 times AS IT ARRIVES.
  Both running simultaneously - you can SEE them working in parallel!
            `
        },
        {
            id: "shell-features-intro",
            title: "Additional Shell Features",
            content: `Real shells support many more features beyond running single commands. We'll focus on one of the most powerful: chaining commands together in a pipeline.`,
            keyPoints: [
                "Running commands in the background (put '&' after command)",
                "Ctrl-C to terminate a program",
                "Chaining multiple commands together (a 'pipeline')",
                "Saving a command's output to a file, or reading input from a file",
                "You'll implement pipelines and I/O redirection on assign3!"
            ],
            diagram: `
Shell Pipelines - Key Unix Idea:

  ┌──────────────────────────────────────────────────────────────┐
  │  $ cat file.txt | sort | uniq | head -5                      │
  └──────────────────────────────────────────────────────────────┘
          │              │        │         │
          ▼              ▼        ▼         ▼
     ┌────────┐    ┌────────┐  ┌────────┐  ┌────────┐
     │  cat   │───▶│  sort  │─▶│  uniq  │─▶│  head  │──▶ Terminal
     └────────┘    └────────┘  └────────┘  └────────┘
           STDOUT → STDIN    STDOUT → STDIN    STDOUT → STDIN

Key insight: Each command doesn't need to know it's part of a pipeline!
Commands run in parallel – though some may wait for all input before output.
            `
        },
        {
            id: "pipeline-steps",
            title: "How do we implement shell pipelines?",
            content: `Let's focus on two-command pipelines for now. We need a way for the first process's output to become the second process's input.`,
            keyPoints: [
                "Create a 'magic portal' that allows data to be sent between processes",
                "Spawn 2 child processes (1 per command)",
                "Connect one end of the portal to first child's STDOUT",
                "Connect other end of portal to second child's STDIN",
                "execvp in each child"
            ],
            diagram: `
Two-Process Pipeline Implementation:

First child                              Second child
STDIN STDOUT STDERR                     STDIN STDOUT STDERR
  │      │      │                         │      │      │
  │      ▼      │                         ▼      │      │
  │   ┌──────────────────────────────────────┐   │      │
  │   │           "Magic Portal"              │   │      │
  │   │         (pipe file descriptors)       │   │      │
  │   └──────────────────────────────────────┘   │      │
  │                                              │      │
  ▼                                              │      ▼
Terminal                                         │   Terminal
(keyboard)                                       │   (display)

Three key questions:
1. What is this "magic portal" and how do we create one?  → pipe()
2. How do we share it between processes?  → fork() clones file descriptors!
3. How do we connect STDIN/STDOUT to it?  → dup2()
            `
        },
        {
            id: "pipe-syscall",
            title: "pipe() System Call",
            content: `The pipe() system call creates a unidirectional communication channel. It gives us two file descriptors: one for reading and one for writing. Everything written to the write end can be read from the read end.`,
            keyPoints: [
                "int pipe(int fds[]) - creates a pipe, populates fds array with two FDs",
                "fds[0] is the READ end, fds[1] is the WRITE end",
                "Tip: you learn to Read before you Write → Read = 0, Write = 1",
                "Like opening same file twice, once for reading and once for writing",
                "Returns 0 on success, -1 on error",
                "Why two FDs? Can be at different positions reading vs. writing"
            ],
            codeExample: {
                title: "Basic pipe usage within one process",
                language: "c",
                code: `static const char *kPipeMessage = "this message is coming via a pipe.";

int main(int argc, char *argv[]) {
    int fds[2];
    pipe(fds);

    // Write message to pipe (assuming all bytes written immediately)
    write(fds[1], kPipeMessage, strlen(kPipeMessage) + 1);
    close(fds[1]);

    // Read message from pipe (assume all bytes read immediately)
    char receivedMessage[strlen(kPipeMessage) + 1];
    read(fds[0], receivedMessage, sizeof(receivedMessage));
    close(fds[0]);

    printf("Message read: %s\\n", receivedMessage);
    return 0;
}

// Output:
// Message read: this message is coming via a pipe.`,
                annotations: [
                    { match: "int fds[2]", explanation: "Array to hold two file descriptors that pipe() will populate." },
                    { match: "pipe(fds)", explanation: "Creates the pipe. After this, fds[0]=read end, fds[1]=write end." },
                    { match: "fds[1]", explanation: "Write end of pipe. fds[1] = 1 reminds us: 1 = Write." },
                    { match: "fds[0]", explanation: "Read end of pipe. fds[0] = 0 reminds us: 0 = Read." },
                    { match: "close(fds[1])", explanation: "Always close pipe ends when done to signal EOF and free resources." }
                ]
            }
        },
        {
            id: "pipe-fork",
            title: "pipe() and fork()",
            content: `The real power of pipes comes when combined with fork(). A pipe created before fork() is accessible to both parent and child! This is because file descriptors are duplicated on fork.`,
            keyPoints: [
                "File descriptors are duplicated when fork() is called",
                "Child gets copies of parent's open file descriptors",
                "Both refer to the SAME underlying file/pipe (not copies!)",
                "Key: create pipe BEFORE fork(), then both processes can use it",
                "Usually used unidirectionally (one writes, other reads)",
                "For bidirectional communication, create 2 pipes"
            ],
            diagram: `
Pipe Shared After Fork:

BEFORE fork():
┌─────────────────────┐
│      PARENT         │
│  ┌─────────────┐    │
│  │  fds[0] = 3 │←read │
│  │  fds[1] = 4 │→write│
│  └─────────────┘    │
└─────────────────────┘

AFTER fork():
┌─────────────────────┐     ┌─────────────────────┐
│      PARENT         │     │       CHILD         │
│  ┌─────────────┐    │     │  ┌─────────────┐    │
│  │  fds[0] = 3 │    │     │  │  fds[0] = 3 │    │
│  │  fds[1] = 4 │    │     │  │  fds[1] = 4 │    │
│  └──────┬──────┘    │     │  └──────┬──────┘    │
└─────────│───────────┘     └─────────│───────────┘
          │                           │
          └───────────┬───────────────┘
                      │
          ┌───────────▼───────────┐
          │    SAME PIPE BUFFER   │
          │  (shared between both)│
          └───────────────────────┘

Both processes have access to the SAME pipe!
            `
        },
        {
            id: "parent-child-pipe",
            title: "Example: Parent-Child Pipe Communication",
            content: `Let's write a program where the parent sends a message to the child through a pipe. The child reads the message and prints it.`,
            keyPoints: [
                "Create pipe BEFORE fork (so both processes have access)",
                "Each process closes the pipe end it doesn't use",
                "Parent writes to fds[1], child reads from fds[0]",
                "Both must close their pipe FDs when done",
                "read() blocks if no data available (waits for write or EOF)"
            ],
            codeExample: {
                title: "Parent-child pipe communication",
                language: "cpp",
                code: `#include <stdlib.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>

static const char *kPipeMessage = "Hello, this message is coming through a pipe.";

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
        close(fds[0]);
        printf("Message from parent: %s\\n", buffer);
        return 0;
    }

    // Parent: only writes to pipe
    close(fds[0]);  // Close read end - parent doesn't read
    write(fds[1], kPipeMessage, bytesSent);
    close(fds[1]);  // Close write end when done - signals EOF to child
    waitpid(pidOrZero, NULL, 0);
    return 0;
}

// Output:
// Message from parent: Hello, this message is coming through a pipe.`,
                annotations: [
                    { match: "pipe(fds)", explanation: "Create pipe BEFORE fork. This is critical - both processes need access!" },
                    { match: "close(fds[1])", explanation: "Child closes write end. It only reads, and this helps signal when pipe is done." },
                    { match: "close(fds[0])", explanation: "Parent closes read end. It only writes. Each process closes unused ends!" },
                    { match: "read(fds[0], buffer", explanation: "read() blocks until data is available OR all write ends are closed (EOF)." },
                    { match: "waitpid(pidOrZero, NULL, 0)", explanation: "Parent waits for child to finish before exiting." }
                ]
            }
        },
        {
            id: "pipe-summary-points",
            title: "Parent-Child Pipe Summary",
            content: `There are important rules to follow when using pipes between processes. Failing to close pipe ends properly is a common source of bugs!`,
            keyPoints: [
                "Both parent and child must close pipe FDs when done",
                "If someone reads from pipe with no data, it blocks until data arrives OR write end is closed everywhere",
                "Closing write end signals 'end of file' for pipes",
                "It's fine to write when no-one is reading - pipe stores contents until read",
                "Common bug: forgetting to close write end → reader blocks forever waiting for more data!"
            ],
            diagram: `
Pipe Blocking Behavior:

When read() is called on empty pipe:
┌─────────────────────────────────────────────────────────────┐
│  Scenario 1: Write end still open somewhere                 │
│  → read() BLOCKS waiting for data                           │
│                                                             │
│  Scenario 2: All write ends closed                          │
│  → read() returns 0 (EOF - end of file)                     │
└─────────────────────────────────────────────────────────────┘

Common bug - forgetting to close:
┌─────────────────────────────────────────────────────────────┐
│  Parent forgets to close(fds[0])                            │
│  Child calls read(fds[0], ...)                              │
│  Parent calls close(fds[1]) and waits                       │
│                                                             │
│  DEADLOCK! Child's read blocks because CHILD still has      │
│  fds[1] open (copied from parent). Parent waits for child.  │
│  Neither can proceed!                                       │
└─────────────────────────────────────────────────────────────┘

Solution: Each process must close BOTH unused pipe ends!
            `
        },
        {
            id: "stop-and-think-dup2",
            title: "🤔 Stop and Think: Connecting the Pipe",
            content: `Before we learn dup2(), think about this: we have a pipe with a read end and a write end. We have two child processes in a pipeline. Which ends connect where?`,
            keyPoints: [
                "First child writes its output → pipe",
                "Second child reads its input ← pipe",
                "📊 POLL QUESTION: What should we connect?",
                "A) stdout → pipe read, stdin → pipe write",
                "B) stdout → pipe write, stdin → pipe read ✓",
                "C) Both to pipe read",
                "D) Both to pipe write"
            ],
            diagram: `
Think about it before reading on!

Pipeline:  command1 | command2

  command1              command2
  ┌─────────┐          ┌─────────┐
  │         │          │         │
  │ STDOUT ─┼───???────┼→ STDIN  │
  │         │          │         │
  └─────────┘          └─────────┘

Which pipe end does STDOUT connect to?
Which pipe end does STDIN connect from?

═══════════════════════════════════════════════════════════════

Answer: B) stdout → pipe write, stdin → pipe read

Think about DATA FLOW:
  • command1 WRITES output → so connect to pipe's WRITE end
  • command2 READS input  → so connect to pipe's READ end

  ┌─────────┐  write   ████████   read   ┌─────────┐
  │ STDOUT ─┼─────────▶█ PIPE █──────────┼→ STDIN  │
  └─────────┘          ████████          └─────────┘
         fds[1]                    fds[0]
            `
        },
        {
            id: "dup2-intro",
            title: "dup2(): Redirecting Process I/O",
            content: `We can now create pipes and share them between processes. But the commands in a pipeline don't know about our pipes - they just read from STDIN and write to STDOUT. We need a way to redirect STDIN/STDOUT to point to our pipe instead.`,
            keyPoints: [
                "int dup2(int srcfd, int dstfd) - duplicates srcfd to dstfd",
                "Both FDs now refer to the same underlying file/pipe",
                "If dstfd was already open, it's closed first",
                "Common use: dup2(pipe_fd, STDOUT_FILENO) redirects stdout to pipe",
                "After dup2, we often close the original FD (don't need two)"
            ],
            codeExample: {
                title: "dup2() signature and example",
                language: "c",
                code: `int dup2(int srcfd, int dstfd);

// Example: redirect stdout to write to a pipe
int fds[2];
pipe(fds);

printf("This prints to the terminal\\n");

dup2(fds[1], STDOUT_FILENO);  // FD 1 (stdout) now refers to pipe write end

printf("This is sent to the pipe!\\n");  // Goes to pipe, not terminal!

// Reading from pipe would get "This is sent to the pipe!\\n"`,
                annotations: [
                    { match: "dup2(int srcfd, int dstfd)", explanation: "Copies srcfd to dstfd. Both now refer to the same thing." },
                    { match: "dup2(fds[1], STDOUT_FILENO)", explanation: "STDOUT_FILENO (1) now points to pipe write end. printf writes to pipe!" },
                    { match: "This prints to the terminal", explanation: "Before dup2, stdout still goes to terminal." },
                    { match: "This is sent to the pipe", explanation: "After dup2, stdout is redirected to the pipe. printf no longer shows on terminal!" }
                ]
            }
        },
        {
            id: "dup2-diagram",
            title: "Understanding dup2() with File Descriptor Tables",
            content: `dup2() works by modifying the file descriptor table. Each file descriptor is just an index into a table stored by the OS. dup2() makes one entry point to the same thing as another.`,
            keyPoints: [
                "File descriptors 0, 1, 2 are STDIN, STDOUT, STDERR by convention",
                "Higher numbers (3, 4, ...) are for files/pipes you open",
                "dup2(src, dst) makes dst point to same thing as src",
                "Original dst connection is closed automatically",
                "We can redirect I/O without the program knowing!"
            ],
            diagram: `
File Descriptor Table Before and After dup2:

BEFORE dup2:
┌─────┬────────────────────────┐
│ FD  │ Points To              │
├─────┼────────────────────────┤
│  0  │ Terminal (STDIN)       │
│  1  │ Terminal (STDOUT)      │ ← printf writes here
│  2  │ Terminal (STDERR)      │
│  3  │ Pipe read end          │
│  4  │ Pipe write end         │
└─────┴────────────────────────┘

AFTER dup2(fds[1], STDOUT_FILENO):  // dup2(4, 1)
┌─────┬────────────────────────┐
│ FD  │ Points To              │
├─────┼────────────────────────┤
│  0  │ Terminal (STDIN)       │
│  1  │ Pipe write end         │ ← printf now writes to PIPE!
│  2  │ Terminal (STDERR)      │
│  3  │ Pipe read end          │
│  4  │ Pipe write end         │
└─────┴────────────────────────┘

Key insight: printf() just writes to FD 1.
By changing what FD 1 points to, we redirect output!
            `
        },
        {
            id: "dup2-close-pattern",
            title: "The dup2 + close Pattern",
            content: `After calling dup2(), it's common to close the original file descriptor. We now have two FDs pointing to the same thing, and usually we only need one.`,
            keyPoints: [
                "After dup2(fds[1], STDOUT_FILENO), FD 1 and fds[1] both point to pipe",
                "We typically close the original (fds[1]) since we don't need two",
                "This also reduces confusion about which FD to use",
                "Closing pipe FDs is important for EOF signaling!"
            ],
            codeExample: {
                title: "Complete dup2 + close pattern",
                language: "c",
                code: `int fds[2];
pipe(fds);
// fds[0] = 3 (read), fds[1] = 4 (write)

printf("This prints to the terminal\\n");

dup2(fds[1], STDOUT_FILENO);  // FD 1 now points to pipe
close(fds[1]);  // Close FD 4 - we'll use FD 1 instead

printf("This is sent to the pipe!\\n");  // Uses FD 1 → pipe

// File descriptor table now:
// 0 → Terminal (stdin)
// 1 → Pipe write end   ← stdout redirected
// 2 → Terminal (stderr)
// 3 → Pipe read end
// 4 → [closed]
`,
                annotations: [
                    { match: "close(fds[1])", explanation: "After dup2, close the original pipe FD. Only need FD 1 now." },
                    { match: "FD 1 now points to pipe", explanation: "Anything that writes to FD 1 (like printf) now writes to the pipe." }
                ]
            }
        },
        {
            id: "pipeline-implementation",
            title: "Implementing Shell Pipelines",
            content: `Now we have all the pieces! To implement a two-process pipeline like \"cat file.txt | grep hello\", we need to create a pipe, fork two children, redirect their I/O, and execvp.`,
            keyPoints: [
                "Create pipe BEFORE spawning children",
                "Fork first child: redirect STDOUT to pipe write end, execvp first command",
                "Fork second child: redirect STDIN from pipe read end, execvp second command",
                "Parent must close both pipe ends (children have their own copies)",
                "Parent waits for both children to finish"
            ],
            diagram: `
Two-Process Pipeline:  cat file.txt | grep hello

Parent (Shell):
  1. pipe(fds) → creates read/write ends
  2. fork() → first child
  3. fork() → second child
  4. close(fds[0]), close(fds[1])  ← Parent closes both!
  5. waitpid() for both children

First child (cat):                 Second child (grep):
  ┌─────────────────┐              ┌─────────────────┐
  │ close(fds[0])   │              │ close(fds[1])   │
  │ dup2(fds[1], 1) │              │ dup2(fds[0], 0) │
  │ close(fds[1])   │              │ close(fds[0])   │
  │ execvp("cat"...) │              │ execvp("grep"...)│
  └────────┬────────┘              └────────┬────────┘
           │                                │
           └───────────┐    ┌───────────────┘
                       │    │
                       ▼    ▼
              ┌─────────────────────┐
              │   PIPE              │
              │  cat writes ──────▶ grep reads
              └─────────────────────┘
            `
        },
        {
            id: "execvp-preserves-fds",
            title: "A Secret About execvp",
            content: `You might wonder: if we fork a child and rewire its STDOUT to a pipe, won't everything get wiped when we call execvp? No! execvp consumes the process but leaves the file descriptor table intact.`,
            keyPoints: [
                "execvp() replaces the program code and data",
                "File descriptor table is PRESERVED across execvp!",
                "This is essential for pipelines to work",
                "Child sets up redirections, then execvp - redirections persist",
                "New program uses the redirected FDs without knowing"
            ],
            codeExample: {
                title: "execvp preserves file descriptors",
                language: "c",
                code: `pid_t pid = fork();
if (pid == 0) {
    // Child process
    
    // Step 1: Redirect stdout to pipe
    dup2(pipe_write_fd, STDOUT_FILENO);
    close(pipe_write_fd);
    
    // Step 2: execvp replaces this program with "ls"
    char *args[] = {"ls", "-la", NULL};
    execvp(args[0], args);
    
    // ls runs with OUR file descriptor table!
    // ls's output goes to the pipe, not terminal
}

// Key insight: execvp wipes the CODE, not the FD table!
// So redirections we set up persist into the new program.`,
                annotations: [
                    { match: "dup2(pipe_write_fd, STDOUT_FILENO)", explanation: "Set up redirection before execvp. This will persist!" },
                    { match: "execvp replaces this program", explanation: "execvp changes what code runs, but FD table stays intact." },
                    { match: "ls's output goes to the pipe", explanation: "ls writes to stdout (FD 1) which now points to our pipe." }
                ]
            }
        },
        {
            id: "using-pipe-with-printf",
            title: "Example: Redirecting printf to a Pipe",
            content: `Let's see a complete example where a parent uses dup2() to redirect its own printf output through a pipe that a child reads from.`,
            keyPoints: [
                "Parent redirects its STDOUT to pipe write end using dup2",
                "Child reads from pipe read end",
                "Parent's printf now writes to pipe instead of terminal",
                "setbuf(stdout, NULL) disables buffering for immediate writes"
            ],
            codeExample: {
                title: "Parent printf through pipe to child",
                language: "cpp",
                code: `#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <sys/wait.h>

static const char *kPipeMessage = "Hello, this message is coming through a pipe.";

int main(int argc, char *argv[]) {
    // Disable output buffering so printf writes immediately
    setbuf(stdout, NULL);

    int fds[2]; 
    pipe(fds); 
    size_t bytesSent = strlen(kPipeMessage) + 1; 
    pid_t pidOrZero = fork();

    if (pidOrZero == 0) {
        // Child: only reads from pipe
        close(fds[1]);
        char buffer[bytesSent]; 
        read(fds[0], buffer, sizeof(buffer)); 
        close(fds[0]); 
        printf("Message from parent: %s\\n", buffer); 
        return 0; 
    }

    // Parent: redirect stdout to pipe, then use printf
    close(fds[0]); 
    dup2(fds[1], STDOUT_FILENO);  // stdout now goes to pipe
    close(fds[1]);
    printf("%s", kPipeMessage);   // This goes to the pipe!
    waitpid(pidOrZero, NULL, 0); 
    return 0; 
}`,
                annotations: [
                    { match: "setbuf(stdout, NULL)", explanation: "Disables buffering. Without this, printf might not write immediately to pipe." },
                    { match: "dup2(fds[1], STDOUT_FILENO)", explanation: "Redirects parent's stdout to pipe. printf now writes to pipe!" },
                    { match: "printf(\"%s\", kPipeMessage)", explanation: "This printf goes to the pipe, not the terminal!" },
                    { match: "Message from parent:", explanation: "Child's printf still goes to terminal (child didn't redirect its stdout)." }
                ]
            }
        },
        {
            id: "assign3-overview",
            title: "Assignment 3: Implementing a Shell",
            content: `In assign3, you'll implement a shell called stsh (Stanford shell) that supports pipelines and file redirection. Today's lecture covers enough to get started!`,
            keyPoints: [
                "Milestone 1: Review provided code",
                "Milestone 2: Single commands (like lecture 9)",
                "Milestone 3: Two-process pipelines (today's material!)",
                "Milestone 4: Multi-process pipelines",
                "Milestone 5: I/O redirection to/from files"
            ],
            diagram: `
assign3 Structure:

┌─────────────────────────────────────────────────────────────┐
│  stsh.cc                                                    │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  main() - REPL loop (already provided)                │ │
│  │    ↓                                                   │ │
│  │  runPipeline(pipeline& p) - YOU IMPLEMENT THIS!       │ │
│  │    • Parse pipeline (provided by stsh-parser)         │ │
│  │    • Create pipes as needed                           │ │
│  │    • Fork children for each command                   │ │
│  │    • Redirect I/O with dup2                           │ │
│  │    • execvp each command                              │ │
│  │    • Wait for children                                │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

Key insight: stsh-parser gives you a 'pipeline' object with:
  - p.commands[] array of commands
  - Each command has .argv[] ready for execvp!
            `
        },
        {
            id: "common-bugs",
            title: "🐛 Common Bugs Checklist",
            content: `Before submitting assign3, check for these common mistakes! Each one can cause mysterious hangs or incorrect behavior.`,
            keyPoints: [
                "✅ Create pipe BEFORE fork (child needs access!)",
                "✅ Close unused pipe ends in BOTH parent AND child",
                "✅ After dup2(), close the original pipe FD",
                "✅ ALWAYS exit/throw after execvp failure in child",
                "✅ Parent must wait for ALL children before exiting",
                "✅ For N-command pipeline: create N-1 pipes"
            ],
            diagram: `
Bug Symptom → Likely Cause:

┌────────────────────────────────────────────────────────────────┐
│ "Program hangs forever"                                        │
│   → Forgot to close a write end somewhere                      │
│   → read() is waiting for EOF that will never come             │
├────────────────────────────────────────────────────────────────┤
│ "Have to quit shell multiple times"                            │
│   → Child continued after execvp failed (imposter shell!)      │
│   → Add throw/exit after execvp call in child                  │
├────────────────────────────────────────────────────────────────┤
│ "Output goes to wrong place / doesn't appear"                  │
│   → dup2 arguments in wrong order                              │
│   → Remember: dup2(src, dst) - dst becomes copy of src         │
├────────────────────────────────────────────────────────────────┤
│ "Zombie processes accumulate"                                  │
│   → Forgot to waitpid() on children                            │
│   → Parent must wait for each child to clean up                │
├────────────────────────────────────────────────────────────────┤
│ "Pipeline doesn't produce output"                              │
│   → stdout buffering issue                                     │
│   → Try fflush(stdout) or setbuf(stdout, NULL)                 │
└────────────────────────────────────────────────────────────────┘

🔧 Debugging Tip:
   Add printf("Child %d: about to exec\\n", getpid());
   before execvp to trace execution flow!
            `
        },
        {
            id: "exam-prep",
            title: "🎯 Midterm Prep: What to Know",
            content: `Pipes and dup2 are core midterm topics. You must know the pipe array convention, the full pipeline setup pattern (pipe → fork → dup2 → close → execvp), and what happens when write ends aren't closed. Expect fd-tracing and "what goes wrong" questions.`,
            keyPoints: [
                "📝 pipe(fds): fds[0] = read end, fds[1] = write end. Mnemonic: 'Read before Write' (0 then 1)",
                "📝 Create pipe BEFORE fork(), otherwise parent and child get separate, unconnected pipes",
                "📝 dup2(srcfd, dstfd): makes dstfd a copy of srcfd. Old dstfd is closed first",
                "📝 dup2(fds[1], STDOUT_FILENO) → stdout now writes to pipe",
                "📝 dup2(fds[0], STDIN_FILENO) → stdin now reads from pipe",
                "📝 After dup2, CLOSE the original pipe fd (don't need two references)",
                "📝 EVERY process must close EVERY pipe end it doesn't use — including parent!",
                "📝 execvp() preserves the fd table — redirections persist into the new program"
            ],
            diagram: `
Midterm Cheat Sheet — Pipes & dup2:

┌─────────────────────────────────────────────────────────────┐
│  Pipeline Setup Pattern (cmd1 | cmd2):                       │
│  ─────────────────────────────────────                       │
│  1. pipe(fds)                                                │
│  2. fork() → child1:                                         │
│       close(fds[0])                    // unused end         │
│       dup2(fds[1], STDOUT_FILENO)      // stdout → pipe      │
│       close(fds[1])                    // original fd         │
│       execvp(cmd1, ...)                                      │
│  3. fork() → child2:                                         │
│       close(fds[1])                    // unused end         │
│       dup2(fds[0], STDIN_FILENO)       // stdin ← pipe       │
│       close(fds[0])                    // original fd         │
│       execvp(cmd2, ...)                                      │
│  4. parent: close(fds[0]), close(fds[1])                     │
│  5. parent: waitpid for both children                        │
├─────────────────────────────────────────────────────────────┤
│  "Why does it hang?" checklist:                              │
│  ──────────────────────────────                              │
│  □ Child forgot to close its OWN write end → read blocks     │
│  □ Parent forgot to close write end → child read never EOF   │
│  □ dup2 args backwards → wrong redirection                   │
│  □ N commands need N-1 pipes                                 │
└─────────────────────────────────────────────────────────────┘
`
        },
        {
            id: "summary",
            title: "Lecture 10 Summary",
            content: `Pipes are sets of file descriptors that let us establish communication channels between processes. Combined with dup2(), we can implement shell pipelines where one process's output becomes another's input.`,
            keyPoints: [
                "🎯 A pipe is like a phone line between two processes",
                "pipe(fds) creates a pipe: fds[0]=read, fds[1]=write (0=Read, 1=Write)",
                "Pipes created before fork() are shared between parent and child",
                "read() blocks until data arrives OR all write ends close",
                "dup2(src, dst) makes dst refer to same thing as src",
                "Use dup2 to redirect STDIN/STDOUT to pipe for pipelines",
                "execvp preserves the file descriptor table (essential for pipelines!)"
            ],
            advantages: [
                "Simple, powerful IPC (inter-process communication) mechanism",
                "Works seamlessly with fork() - file descriptors are shared",
                "Programs don't need to know they're in a pipeline",
                "Enables the powerful Unix philosophy: small programs that do one thing well"
            ],
            disadvantages: [
                "Unidirectional - need two pipes for bidirectional communication",
                "Must carefully close all unused pipe ends to avoid deadlock",
                "Only works between related processes (parent-child)",
                "Blocking I/O can cause deadlock if not handled properly"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Pipe Basics",
            difficulty: "easy",
            description: "Fill in the blanks to create a pipe and identify which file descriptor is for reading and which is for writing.",
            hint: "Remember: you learn to Read before you Write! Read = 0, Write = 1.",
            starterCode: `int main() {
    int fds[2];
    pipe(fds);
    
    // Which FD is for reading?
    int read_fd = fds[____];
    
    // Which FD is for writing?
    int write_fd = fds[____];
    
    // Write "hello" to the pipe
    write(____, "hello", 5);
    
    // Read from the pipe
    char buf[5];
    read(____, buf, 5);
    
    return 0;
}`,
            solution: `int main() {
    int fds[2];
    pipe(fds);
    
    // Which FD is for reading?
    int read_fd = fds[0];  // 0 = Read
    
    // Which FD is for writing?
    int write_fd = fds[1];  // 1 = Write
    
    // Write "hello" to the pipe
    write(write_fd, "hello", 5);  // or fds[1]
    
    // Read from the pipe
    char buf[5];
    read(read_fd, buf, 5);  // or fds[0]
    
    return 0;
}

// Memory trick: 0 = Read, 1 = Write
// "You learn to Read before you Write!"`,
            explanation: "pipe() populates the array with fds[0] for reading and fds[1] for writing. The mnemonic '0=Read, 1=Write' or 'Read before Write' helps remember this."
        },
        {
            id: "ex2",
            title: "Parent-Child Communication",
            difficulty: "easy",
            description: "Complete the code to have a parent send a number to its child through a pipe.",
            hint: "Create pipe before fork! Child closes write end, parent closes read end.",
            starterCode: `int main() {
    int fds[2];
    ____(fds);  // Create pipe
    
    pid_t pid = fork();
    
    if (pid == 0) {
        // Child
        close(fds[____]);  // Close unused end
        
        int num;
        read(fds[____], &num, sizeof(int));
        printf("Child received: %d\\n", num);
        
        close(fds[____]);
        return 0;
    }
    
    // Parent
    close(fds[____]);  // Close unused end
    
    int num = 42;
    write(fds[____], &num, sizeof(int));
    
    close(fds[____]);
    waitpid(pid, NULL, 0);
    return 0;
}`,
            solution: `int main() {
    int fds[2];
    pipe(fds);  // Create pipe
    
    pid_t pid = fork();
    
    if (pid == 0) {
        // Child: only reads, so close write end
        close(fds[1]);  // Close write end
        
        int num;
        read(fds[0], &num, sizeof(int));  // Read from read end
        printf("Child received: %d\\n", num);
        
        close(fds[0]);  // Close read end when done
        return 0;
    }
    
    // Parent: only writes, so close read end
    close(fds[0]);  // Close read end
    
    int num = 42;
    write(fds[1], &num, sizeof(int));  // Write to write end
    
    close(fds[1]);  // Close write end when done
    waitpid(pid, NULL, 0);
    return 0;
}

// Output: Child received: 42`,
            explanation: "Each process closes the pipe end it doesn't use. Parent writes to fds[1], child reads from fds[0]. Both close their ends when done."
        },
        {
            id: "ex3",
            title: "dup2 Redirection",
            difficulty: "medium",
            description: "Complete the code to redirect stdout to a pipe so that printf output goes through the pipe instead of to the terminal.",
            hint: "Use dup2(pipe_write, STDOUT_FILENO) to make stdout point to the pipe.",
            starterCode: `int main() {
    int fds[2];
    pipe(fds);
    
    pid_t pid = fork();
    if (pid == 0) {
        // Child reads from pipe
        close(fds[1]);
        
        char buf[100];
        int n = read(fds[0], buf, sizeof(buf) - 1);
        buf[n] = '\\0';
        
        // Print to stderr (not redirected!)
        fprintf(stderr, "Child received: %s\\n", buf);
        close(fds[0]);
        return 0;
    }
    
    // Parent: redirect stdout to pipe
    close(fds[____]);  // Close unused end
    
    dup2(fds[____], ____);  // Redirect stdout
    close(fds[____]);  // Close original pipe FD
    
    printf("Hello through a pipe!");  // This should go to pipe!
    fflush(stdout);  // Ensure it's written
    
    // TODO: Need to close stdout so child sees EOF
    close(STDOUT_FILENO);
    
    waitpid(pid, NULL, 0);
    return 0;
}`,
            solution: `int main() {
    int fds[2];
    pipe(fds);
    
    pid_t pid = fork();
    if (pid == 0) {
        // Child reads from pipe
        close(fds[1]);
        
        char buf[100];
        int n = read(fds[0], buf, sizeof(buf) - 1);
        buf[n] = '\\0';
        
        // Print to stderr (not redirected!)
        fprintf(stderr, "Child received: %s\\n", buf);
        close(fds[0]);
        return 0;
    }
    
    // Parent: redirect stdout to pipe
    close(fds[0]);  // Close read end (unused by parent)
    
    dup2(fds[1], STDOUT_FILENO);  // Redirect stdout (FD 1) to pipe
    close(fds[1]);  // Close original pipe FD (now using FD 1)
    
    printf("Hello through a pipe!");  // Goes to pipe!
    fflush(stdout);
    
    close(STDOUT_FILENO);  // Close to signal EOF to child
    
    waitpid(pid, NULL, 0);
    return 0;
}

// Output:
// Child received: Hello through a pipe!`,
            explanation: "dup2(fds[1], STDOUT_FILENO) makes FD 1 (stdout) point to the pipe write end. Now printf writes to the pipe. We close the original fds[1] since we're using FD 1 now."
        },
        {
            id: "ex4",
            title: "What's Wrong?",
            difficulty: "medium",
            description: "This code has a bug that causes a deadlock. Find and fix it!",
            hint: "Think about what the child's read() is waiting for. What needs to happen for it to return?",
            starterCode: `int main() {
    int fds[2];
    pipe(fds);
    
    pid_t pid = fork();
    if (pid == 0) {
        // Child reads entire pipe contents
        char buf[1000];
        int total = 0;
        int n;
        while ((n = read(fds[0], buf + total, sizeof(buf) - total)) > 0) {
            total += n;
        }
        buf[total] = '\\0';
        printf("Child got: %s\\n", buf);
        return 0;
    }
    
    // Parent writes to pipe
    write(fds[1], "Hello!", 6);
    close(fds[1]);
    
    waitpid(pid, NULL, 0);
    return 0;
}

// This program hangs! Why?`,
            solution: `int main() {
    int fds[2];
    pipe(fds);
    
    pid_t pid = fork();
    if (pid == 0) {
        // Child reads entire pipe contents
        close(fds[1]);  // FIX: Child must close write end!
        
        char buf[1000];
        int total = 0;
        int n;
        while ((n = read(fds[0], buf + total, sizeof(buf) - total)) > 0) {
            total += n;
        }
        buf[total] = '\\0';
        printf("Child got: %s\\n", buf);
        close(fds[0]);  // Good practice
        return 0;
    }
    
    // Parent writes to pipe
    close(fds[0]);  // Good practice: parent closes read end
    write(fds[1], "Hello!", 6);
    close(fds[1]);
    
    waitpid(pid, NULL, 0);
    return 0;
}

// BUG: Child had write end open, so read() never got EOF!
// The child inherited fds[1] from parent. Even after parent
// closed fds[1], the CHILD still had it open. read() waits
// until ALL write ends are closed before returning 0 (EOF).`,
            explanation: "The child inherited BOTH pipe file descriptors. Even though the parent closed fds[1], the child still had it open. read() won't return 0 (EOF) until ALL write ends are closed. The child must close(fds[1]) before reading!"
        },
        {
            id: "ex5",
            title: "Two-Process Pipeline Setup",
            difficulty: "hard",
            description: "Complete the code to set up a two-process pipeline: 'echo hello | cat'. First child runs echo, second child runs cat, connected by a pipe.",
            hint: "Each child needs to: 1) close unused pipe end, 2) dup2 to redirect stdin/stdout, 3) close the pipe FD after dup2, 4) execvp",
            starterCode: `int main() {
    int fds[2];
    pipe(fds);
    
    // First child: runs "echo hello", stdout → pipe
    pid_t pid1 = fork();
    if (pid1 == 0) {
        // TODO: Set up for echo (writes to pipe)
        close(fds[____]);
        dup2(fds[____], ____);
        close(fds[____]);
        
        char *args[] = {"echo", "hello", NULL};
        execvp(args[0], args);
        exit(1);
    }
    
    // Second child: runs "cat", stdin ← pipe
    pid_t pid2 = fork();
    if (pid2 == 0) {
        // TODO: Set up for cat (reads from pipe)
        close(fds[____]);
        dup2(fds[____], ____);
        close(fds[____]);
        
        char *args[] = {"cat", NULL};
        execvp(args[0], args);
        exit(1);
    }
    
    // Parent: close both ends and wait
    close(fds[0]);
    close(fds[1]);
    waitpid(pid1, NULL, 0);
    waitpid(pid2, NULL, 0);
    
    return 0;
}`,
            solution: `int main() {
    int fds[2];
    pipe(fds);
    
    // First child: runs "echo hello", stdout → pipe
    pid_t pid1 = fork();
    if (pid1 == 0) {
        // Echo writes to stdout, which we redirect to pipe
        close(fds[0]);  // Don't need read end
        dup2(fds[1], STDOUT_FILENO);  // stdout → pipe write
        close(fds[1]);  // Don't need original FD anymore
        
        char *args[] = {"echo", "hello", NULL};
        execvp(args[0], args);
        exit(1);
    }
    
    // Second child: runs "cat", stdin ← pipe  
    pid_t pid2 = fork();
    if (pid2 == 0) {
        // Cat reads from stdin, which we redirect from pipe
        close(fds[1]);  // Don't need write end
        dup2(fds[0], STDIN_FILENO);  // stdin ← pipe read
        close(fds[0]);  // Don't need original FD anymore
        
        char *args[] = {"cat", NULL};
        execvp(args[0], args);
        exit(1);
    }
    
    // Parent: close both ends and wait
    close(fds[0]);
    close(fds[1]);
    waitpid(pid1, NULL, 0);
    waitpid(pid2, NULL, 0);
    
    return 0;
}

// Output: hello
// 
// Flow: echo writes "hello\\n" to stdout
//       stdout is redirected to pipe write end
//       cat reads from stdin
//       stdin is redirected from pipe read end
//       cat prints what it reads`,
            explanation: "First child: close read end, redirect stdout to write end. Second child: close write end, redirect stdin from read end. Parent closes both ends. This is the core pattern for implementing shell pipelines in assign3!"
        },
        {
            id: "ex6",
            title: "Trace the File Descriptors",
            difficulty: "medium",
            description: "Trace through the file descriptor table at each step. What does each FD point to?",
            hint: "Start with 0=stdin, 1=stdout, 2=stderr. pipe() adds two new FDs. dup2 changes what an FD points to.",
            starterCode: `int main() {
    // Initial state: 0=stdin, 1=stdout, 2=stderr
    
    // Step 1: Create pipe
    int fds[2];
    pipe(fds);
    // fds[0] = ____, fds[1] = ____
    // FD table: 0=____, 1=____, 2=____, 3=____, 4=____
    
    // Step 2: dup2(fds[1], STDOUT_FILENO)
    dup2(fds[1], STDOUT_FILENO);
    // FD table: 0=____, 1=____, 2=____, 3=____, 4=____
    
    // Step 3: close(fds[1])
    close(fds[1]);
    // FD table: 0=____, 1=____, 2=____, 3=____, 4=____
    
    // Now where does printf() output go?
    // Answer: ____
    
    return 0;
}`,
            solution: `int main() {
    // Initial state: 0=stdin, 1=stdout, 2=stderr
    
    // Step 1: Create pipe
    int fds[2];
    pipe(fds);
    // fds[0] = 3, fds[1] = 4 (first available FDs)
    // FD table: 0=terminal, 1=terminal, 2=terminal, 3=pipe_read, 4=pipe_write
    
    // Step 2: dup2(fds[1], STDOUT_FILENO) → dup2(4, 1)
    dup2(fds[1], STDOUT_FILENO);
    // FD table: 0=terminal, 1=pipe_write, 2=terminal, 3=pipe_read, 4=pipe_write
    //                       ↑ changed!
    
    // Step 3: close(fds[1]) → close(4)
    close(fds[1]);
    // FD table: 0=terminal, 1=pipe_write, 2=terminal, 3=pipe_read, 4=[closed]
    //                                                               ↑ closed!
    
    // Now where does printf() output go?
    // Answer: To the PIPE! (via FD 1, which now points to pipe_write)
    
    return 0;
}

// Key insight: After dup2(4, 1), both FD 1 and FD 4 point to pipe_write.
// We close FD 4 because we don't need two FDs pointing to the same thing.
// printf uses FD 1, which now goes to the pipe!`,
            explanation: "pipe() creates FDs 3 and 4 (next available numbers). dup2(4, 1) makes FD 1 point to pipe_write (same as FD 4). close(4) removes the duplicate. printf uses FD 1, which now goes to the pipe!"
        },
        {
            id: "ex7",
            title: "Conceptual: Pipeline Process Count",
            difficulty: "easy",
            description: "For shell pipelines with different numbers of commands, how many fork() calls are needed and how many processes exist at peak?",
            hint: "Each command needs its own process. The shell (parent) also exists. Count carefully!",
            starterCode: `// How many times is fork() called?
// How many processes exist at peak?

// Case 1: ls
// fork() calls: ____
// Peak processes: ____
// Pipes needed: ____

// Case 2: ls | grep txt
// fork() calls: ____
// Peak processes: ____
// Pipes needed: ____

// Case 3: cat file | sort | uniq | head
// fork() calls: ____
// Peak processes: ____
// Pipes needed: ____

// General formula for N commands:
// fork() calls: ____
// Peak processes: ____
// Pipes needed: ____`,
            solution: `// How many times is fork() called?
// How many processes exist at peak?

// Case 1: ls
// fork() calls: 1 (one child for ls)
// Peak processes: 2 (shell + ls)
// Pipes needed: 0 (single command, no piping)

// Case 2: ls | grep txt
// fork() calls: 2 (one for ls, one for grep)
// Peak processes: 3 (shell + ls + grep)
// Pipes needed: 1 (connects ls to grep)

// Case 3: cat file | sort | uniq | head
// fork() calls: 4 (one per command)
// Peak processes: 5 (shell + cat + sort + uniq + head)
// Pipes needed: 3 (cat→sort, sort→uniq, uniq→head)

// General formula for N commands:
// fork() calls: N
// Peak processes: N + 1 (including shell)
// Pipes needed: N - 1 (one between each pair)`,
            explanation: "For N commands in a pipeline, we need N fork() calls (one per command), N+1 processes at peak (N children + shell parent), and N-1 pipes (one connecting each adjacent pair of commands)."
        }
    ]
};

export default lecture10;
