export const assign3 = {
    id: 'a3',
    type: 'assignment',
    title: "Stanford Shell (stsh)",
    subtitle: "Assignment 3 — Process Management, Pipelines, and Signal Handling",
    keyTakeaway: "A shell is a process manager: it forks child processes, connects them with pipes for pipelines, and uses signals (SIGINT, SIGTSTP) to control them. Understanding how fork, execvp, waitpid, pipe, and dup2 work together is essential for building a Unix shell.",

    sections: [
        {
            id: "overview",
            title: "Assignment 3 Overview",
            content: `Assignment 3 implemented **stsh** — the Stanford Shell. A shell is a command-line interface that reads user commands, creates child processes to execute them, and manages their lifecycle. It supports **pipelines** (connecting multiple commands with \`|\`), **background jobs**, and **signal handling** (Ctrl-C, Ctrl-Z). The assignment also included two test utilities: conduit and split.`,
            keyPoints: [
                "A shell reads commands, forks processes, and manages their execution",
                "Pipelines connect stdout of one process to stdin of the next via pipes",
                "fork() creates child processes, execvp() replaces them with the command",
                "waitpid() reaps child processes and gets their exit status",
                "Signals: SIGINT (Ctrl-C) interrupts, SIGTSTP (Ctrl-Z) suspends",
                "Test utilities: conduit (character repeater) and split (timed fork)"
            ]
        },
        {
            id: "stsh-main",
            title: "Shell Main Loop (stsh.cc)",
            content: `The shell's main loop uses the **readline** library to read commands, parses them into a **pipeline** structure, and executes them via \`runPipeline()\`. The main loop handles the REPL (Read-Eval-Print Loop) pattern — the same pattern used by bash, zsh, and Python's interactive mode.`,
            codeExample: {
                title: "stsh.cc — The Stanford Shell main loop",
                language: "cpp",
                code: `/**
 * Provides the main read-eval-print loop, reading commands from
 * the user's input and handing them to a pipeline to be executed.
 */

#include "stsh-parse.h"
#include "stsh-readline.h"
#include "stsh-process.h"
#include "stsh-job.h"
#include "stsh-job-list.h"
#include "stsh-signal.h"
#include <signal.h>
#include <iostream>

using namespace std;

/**
 * Main function for the Stanford shell.
 */
int main(int argc, char *argv[]) {
    // Install signal handlers (for Ctrl-C, Ctrl-Z, etc.)
    installSignalHandlers();

    // Read commands until the user quits
    char *line;
    while ((line = readline("stsh> ")) != nullptr) {
        if (*line != '\\0') {
            addToHistory(line);
        }

        try {
            pipeline p(line);
            runPipeline(p);
        } catch (const STSHException& e) {
            cerr << e.what() << endl;
        }

        free(line);
    }

    return 0;
}`,
                annotations: [
                    { match: "installSignalHandlers()", explanation: "Sets up custom signal handlers for SIGINT (Ctrl-C), SIGTSTP (Ctrl-Z), and SIGCHLD (child process state change). Without these, the shell itself would be killed by Ctrl-C." },
                    { match: "readline(\"stsh> \")", explanation: "Reads a line of input with the 'stsh> ' prompt. Uses the GNU readline library which provides line editing (arrow keys, backspace) and history (up/down). Returns nullptr on EOF (Ctrl-D)." },
                    { match: "addToHistory(line)", explanation: "Adds non-empty commands to readline's history so users can press up/down to recall previous commands." },
                    { match: "pipeline p(line)", explanation: "Parses the command line into a pipeline structure. For 'cat file.txt | grep hello | wc -l', this creates a pipeline with 3 commands." },
                    { match: "runPipeline(p)", explanation: "The core function: forks child processes for each command in the pipeline, connects them with pipes, and waits for them to finish. This is where most of the assignment's code lives." },
                    { match: "STSHException", explanation: "Custom exception type for shell errors (e.g., command not found, invalid syntax). Catching it here prevents a single bad command from crashing the entire shell." },
                    { match: "free(line)", explanation: "readline allocates memory with malloc, so we must free it when done. Forgetting this would leak memory on every command." }
                ]
            }
        },
        {
            id: "pipeline-execution",
            title: "Pipeline Execution",
            content: `A pipeline like \`cat file | grep "hello" | wc -l\` requires creating **N processes** connected by **N-1 pipes**. Each process's stdout is connected to the next process's stdin via dup2. The shell creates all the pipes first, then forks each child, which sets up its pipe connections and calls execvp.`,
            keyPoints: [
                "N commands need N-1 pipes connecting them",
                "Each pipe connects one command's stdout to the next command's stdin",
                "After fork: child calls dup2() to redirect stdin/stdout to pipe ends",
                "After dup2: close all pipe file descriptors (avoid leaks and deadlocks)",
                "Parent must close ALL pipe FDs and wait for ALL children"
            ],
            diagram: `
Pipeline: cat file | grep hello | wc -l

Parent shell creates 2 pipes, then forks 3 children:

  ┌─────────┐   pipe[0]   ┌─────────┐   pipe[1]   ┌─────────┐
  │  cat     │            │  grep   │            │   wc    │
  │  file    │──write──→read──hello──│──write──→read──-l────│
  │          │            │         │            │         │
  │ stdout→  │  fd[1]→fd[0]  │→stdout  │  fd[1]→fd[0]  │→stdout │
  │  pipe[0] │            │  pipe[1]│            │ terminal│
  └─────────┘            └─────────┘            └─────────┘

Setup for child 1 (cat):
  dup2(pipe[0].write, STDOUT)  // stdout → pipe[0] write end
  close all pipe fds
  execvp("cat", ["cat", "file"])

Setup for child 2 (grep):
  dup2(pipe[0].read, STDIN)    // stdin ← pipe[0] read end
  dup2(pipe[1].write, STDOUT)  // stdout → pipe[1] write end
  close all pipe fds
  execvp("grep", ["grep", "hello"])

Setup for child 3 (wc):
  dup2(pipe[1].read, STDIN)    // stdin ← pipe[1] read end
  close all pipe fds
  execvp("wc", ["wc", "-l"])
`
        },
        {
            id: "conduit-program",
            title: "Test Utility: conduit",
            content: `**conduit** is a test program that reads characters from stdin, optionally delays, and outputs each character **count** times. It's used to test the shell's pipeline and I/O redirection. For example, \`echo "ab" | ./conduit --count 3\` outputs "aaabbb".`,
            codeExample: {
                title: "conduit.cc — Character repeater utility",
                language: "cpp",
                code: `/**
 * Reads characters from stdin, delays, and re-prints each character
 * a specified number of times.  Used for testing shell pipelines.
 */

#include <iostream>
#include <getopt.h>
#include <stdlib.h>
#include <unistd.h>

using namespace std;

static const int kDefaultCount = 1;
static const int kDefaultDelay = 0;

int main(int argc, char *argv[]) {
    int count = kDefaultCount;
    int delay = kDefaultDelay;

    // Parse command-line options
    struct option options[] = {
        {"delay", required_argument, NULL, 'd'},
        {"count", required_argument, NULL, 'c'},
        {NULL, 0, NULL, 0}
    };

    while (true) {
        int ch = getopt_long(argc, argv, "d:c:", options, NULL);
        if (ch == -1) break;
        switch (ch) {
            case 'd':
                delay = atoi(optarg);
                break;
            case 'c':
                count = atoi(optarg);
                break;
            default:
                cerr << "Usage: " << argv[0] << " [--delay n] [--count n]" << endl;
                return 1;
        }
    }

    // Read characters and repeat each one
    char ch;
    while (cin.get(ch)) {
        for (int i = 0; i < count; i++) {
            if (delay > 0) usleep(delay * 1000);
            cout << ch;
            cout.flush();
        }
    }

    return 0;
}`,
                annotations: [
                    { match: "getopt_long", explanation: "GNU function for parsing long options (--delay, --count) and short options (-d, -c). Returns -1 when all options have been parsed." },
                    { match: "required_argument", explanation: "Specifies that this option must have a value after it. E.g., '--count 3' not just '--count'." },
                    { match: "optarg", explanation: "Global variable set by getopt_long to the string value following the option. We convert it to int with atoi()." },
                    { match: "cin.get(ch)", explanation: "Reads one character at a time from stdin. Returns false on EOF. Using get() instead of >> avoids skipping whitespace." },
                    { match: "usleep(delay * 1000)", explanation: "Sleeps for 'delay' milliseconds (usleep takes microseconds, so multiply by 1000). This is useful for testing that the shell handles slow-producing pipelines correctly." },
                    { match: "cout.flush()", explanation: "Forces output immediately rather than buffering. Important for pipeline testing — without flush, characters might not appear at the pipe's read end until the buffer fills." }
                ]
            }
        },
        {
            id: "split-program",
            title: "Test Utility: split",
            content: `**split** is a simpler test program that forks a child which sleeps for N seconds in 1-second increments. It's used to test the shell's ability to handle long-running processes, job control (Ctrl-Z to suspend, fg to resume), and background execution.`,
            codeExample: {
                title: "split.cc — Timed child process for shell testing",
                language: "cpp",
                code: `/**
 * File: split.cc
 * ---------------
 * This program forks a child process that sleeps for
 * a given number of seconds, and then exits.  Used for
 * testing our shell.
 */
#include <iostream>
#include <stdlib.h>
#include <unistd.h>
#include <sys/wait.h>

using namespace std;

int main(int argc, char *argv[]) {
    if (argc != 2) {
        cerr << "Usage: " << argv[0] << " <num-seconds>" << endl;
        return 1;
    }

    int numSeconds = atoi(argv[1]);
    pid_t pid = fork();

    if (pid == 0) {
        // Child: sleep in 1-second increments, printing progress
        for (int i = 0; i < numSeconds; i++) {
            cout << "(" << getpid() << ") " << i << " of " << numSeconds << " seconds" << endl;
            sleep(1);
        }
        cout << "(" << getpid() << ") done sleeping!" << endl;
        return 0;
    }

    // Parent: wait for child and report its exit status
    int status;
    waitpid(pid, &status, 0);
    if (WIFEXITED(status)) {
        cout << "Child exited with status " << WEXITSTATUS(status) << endl;
    }
    return 0;
}`,
                annotations: [
                    { match: "fork()", explanation: "Creates a child process. The child does the sleeping; the parent waits. This tests whether the shell correctly manages child processes that take a long time." },
                    { match: "getpid()", explanation: "Returns the current process's PID. Printing it helps verify that the shell's job control (fg, bg, jobs) correctly tracks process IDs." },
                    { match: "sleep(1)", explanation: "Sleeping in 1-second increments (instead of one big sleep) means the process can be interrupted by signals at each interval. This tests the shell's signal forwarding." },
                    { match: "WIFEXITED(status)", explanation: "Macro that returns true if the child exited normally (via exit() or return from main). False if it was killed by a signal." },
                    { match: "WEXITSTATUS(status)", explanation: "Extracts the actual exit code from the status. Only valid if WIFEXITED is true." }
                ]
            }
        },
        {
            id: "signal-handling",
            title: "Signal Handling in the Shell",
            content: `Signals are how the OS notifies a process of events. The shell must handle signals carefully: **SIGINT** (Ctrl-C) should kill the foreground command but NOT the shell, **SIGTSTP** (Ctrl-Z) should suspend the foreground command, and **SIGCHLD** notifies the shell when a child changes state.`,
            keyPoints: [
                "SIGINT (Ctrl-C): interrupt/kill the foreground process group",
                "SIGTSTP (Ctrl-Z): stop/suspend the foreground process group",
                "SIGCHLD: sent to parent when child exits, stops, or resumes",
                "The shell uses sigaction() to install custom handlers for these signals",
                "Shell must NOT die when it receives SIGINT — only forward it to children",
                "Process groups: all processes in a pipeline share a group, so one Ctrl-C kills all of them"
            ],
            diagram: `
Signal Flow in a Shell:

User presses Ctrl-C
        │
        ▼
  ┌──────────┐     SIGINT is sent to
  │ Terminal  │──→  the foreground
  │ Driver    │     process group
  └──────────┘
        │
        ├──→ Shell (stsh)     → Custom handler: forward to children
        │                        (shell itself survives)
        │
        ├──→ Child 1 (cat)   → Default: terminate
        │
        └──→ Child 2 (grep)  → Default: terminate

Key signals:
  SIGINT  (2)  — Ctrl-C — interrupt
  SIGTSTP (20) — Ctrl-Z — suspend
  SIGCHLD (17) — child state changed
  SIGCONT (18) — resume stopped process
  SIGKILL (9)  — force kill (cannot be caught)
`
        },
        {
            id: "summary",
            title: "Assignment 3 Summary",
            content: `Assignment 3 tied together all the multiprocessing concepts from the course: fork for process creation, execvp for program execution, pipe+dup2 for I/O redirection, waitpid for process reaping, and signals for process control. The shell is the quintessential Unix program — it demonstrates every major OS concept in one unified system.`,
            keyPoints: [
                "A shell is a REPL: read command → parse → fork/exec → wait → repeat",
                "Pipelines: N commands, N-1 pipes, all stdout→stdin connections via dup2",
                "Signal handlers let the shell survive Ctrl-C while killing children",
                "Process groups ensure a pipeline is treated as a single unit for signals",
                "Test utilities (conduit, split) exercise specific shell features",
                "Always close pipe FDs and reap children to avoid leaks and zombies"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Pipeline Pipe Count",
            difficulty: "easy",
            description: "How many pipes are needed for a pipeline with N commands? How many total file descriptors does that create?",
            hint: "Each pipe() call creates 2 file descriptors (read end and write end).",
            starterCode: `// Pipeline: cmd1 | cmd2 | cmd3 | cmd4

// How many commands? ____
// How many pipes needed? ____
// How many total FDs from pipe() calls? ____

// For each child, which pipe FDs does it use?
// Child 1 (cmd1): ____
// Child 2 (cmd2): ____
// Child 3 (cmd3): ____
// Child 4 (cmd4): ____`,
            solution: `// Pipeline: cmd1 | cmd2 | cmd3 | cmd4

// How many commands? 4
// How many pipes needed? 3 (N-1 = 4-1 = 3)
// How many total FDs from pipe() calls? 6 (3 pipes × 2 FDs each)

// For each child, which pipe FDs does it use?
// Child 1 (cmd1): stdout → pipe[0].write
// Child 2 (cmd2): stdin ← pipe[0].read, stdout → pipe[1].write
// Child 3 (cmd3): stdin ← pipe[1].read, stdout → pipe[2].write
// Child 4 (cmd4): stdin ← pipe[2].read

// CRITICAL: Every child must close ALL 6 pipe FDs after
// setting up its dup2 connections (to avoid deadlocks).
// The parent must also close ALL 6 pipe FDs.`,
            explanation: "N commands require N-1 pipes. Each pipe creates 2 FDs. Every process that can see a pipe FD must close the ones it doesn't use — otherwise readers never see EOF."
        }
    ]
};

export default assign3;
