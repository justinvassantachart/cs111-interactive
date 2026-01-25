export const lecture9 = {
    id: 9,
    title: "Multiprocessing System Calls",
    subtitle: "waitpid(), execvp(), and Building a Shell",
    keyTakeaway: "waitpid() lets a parent process wait for a child process to finish. execvp() takes over the calling process to run the specified program. Shells work by spawning child processes with fork that call execvp, and then waiting for them to finish with waitpid.",

    sections: [
        {
            id: "recap-fork",
            title: "Recap: fork()",
            content: `fork() is a system call that creates a new child process. The child is a clone of the parent, but has a new PID. fork() is called once but returns twice: it returns the child's PID to the parent, and 0 to the child.`,
            keyPoints: [
                "The 'parent' creates the 'child' process",
                "Both processes run the code after fork()",
                "Child is identical to parent except: new PID, different return value from fork()",
                "fork() returns child's PID to parent, 0 to child",
                "Child runs until end of program unless it calls exit()"
            ],
            codeExample: {
                title: "Basic fork() pattern",
                language: "c",
                code: `void helperFn() {
    pid_t pidOrZero = fork();
    if (pidOrZero == 0) {
        printf("I am the child\\n");
        exit(0);  // Important: child should exit!
    } else {
        printf("I am the parent\\n");
    }
}

int main(int argc, char *argv[]) {
    helperFn();
    printf("This is printed once (by parent only)\\n");
    return 0;
}`,
                annotations: [
                    { match: "pid_t pidOrZero", explanation: "Stores fork's return: child's PID in parent, 0 in child." },
                    { match: "exit(0)", explanation: "Child calls exit() to terminate. Without this, child would continue executing main()!" },
                    { match: "printed once", explanation: "Only parent prints this because child called exit() inside helperFn()." }
                ]
            }
        },
        {
            id: "process-clones",
            title: "Process Clones and Virtual Memory",
            content: `When fork() creates a child, both processes appear to have the same memory addresses. This works because each process has its own **virtual address space** that the OS maps to different physical memory.`,
            keyPoints: [
                "Each program's addresses are 'fake' virtual addresses",
                "The OS maps virtual addresses to real physical addresses",
                "When a process forks, its virtual address space stays the same",
                "Copy-on-write: OS only copies memory pages when they're modified",
                "Parent and child can modify 'same' address with different results"
            ],
            diagram: `
Virtual vs Physical Memory After Fork:

PARENT PROCESS                     CHILD PROCESS
┌─────────────────┐               ┌─────────────────┐
│ Virtual Addr    │               │ Virtual Addr    │
│ 0x7ffc...990    │               │ 0x7ffc...990    │
│ str = "Hello"   │               │ str = "Hello"   │
└────────┬────────┘               └────────┬────────┘
         │                                 │
         │ OS Page Table                   │ OS Page Table
         ▼                                 ▼
┌─────────────────┐               ┌─────────────────┐
│ Physical Addr   │               │ Physical Addr   │
│ 0x1234...       │               │ 0x5678...       │
│ "Hello"         │               │ "Howdy" (modified)
└─────────────────┘               └─────────────────┘

Same virtual address → Different physical memory!
            `,
            codeExample: {
                title: "Demonstrating copy-on-write",
                language: "c",
                code: `int main() {
    char str[] = "Hello";
    printf("str's address is %p\\n", str);
    
    pid_t pid = fork();
    if (pid == 0) {
        // Child modifies str
        strcpy(str, "Howdy");
        printf("Child: str = %s at %p\\n", str, str);
        exit(0);
    } else {
        sleep(1);  // Let child run first
        // Parent's str is unchanged!
        printf("Parent: str = %s at %p\\n", str, str);
    }
    return 0;
}

// Output:
// str's address is 0x7ffc8cfa9990
// Child: str = Howdy at 0x7ffc8cfa9990
// Parent: str = Hello at 0x7ffc8cfa9990`,
                annotations: [
                    { match: "char str[] = \"Hello\"", explanation: "Array on stack. Both processes get a copy due to virtual memory." },
                    { match: "strcpy(str, \"Howdy\")", explanation: "Child modifies its copy. Copy-on-write triggers here." },
                    { match: "0x7ffc8cfa9990", explanation: "Same virtual address in both processes, different physical memory!" },
                    { match: "Parent: str = Hello", explanation: "Parent's copy unchanged despite child's modification. Isolation works!" }
                ]
            }
        },
        {
            id: "shell-goal",
            title: "Our Goal: Building a Shell",
            content: `A shell is a program that prompts the user for a command, runs that command, waits for it to finish, and then prompts again. We need three key system calls: fork(), execvp(), and waitpid().`,
            keyPoints: [
                "Shell runs in an infinite loop: prompt → run → wait → repeat",
                "We can only run ONE program per process",
                "Must fork a child to run user's command (otherwise shell disappears!)",
                "Child calls execvp() to run the command",
                "Parent calls waitpid() to wait for child to finish"
            ],
            diagram: `
Shell Execution Flow:

┌─────────────────────────────────────────────────────────────┐
│                      SHELL (Parent)                          │
│                                                              │
│   while (true) {                                            │
│       1. Print prompt: "$ "                                 │
│       2. Read user command: "ls -la"                        │
│       3. fork() ─────────────────────┐                      │
│       4. waitpid() ← waits here      │                      │
│       5. Back to step 1              │                      │
│   }                                  │                      │
└──────────────────────────────────────│──────────────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────┐
                        │     CHILD PROCESS        │
                        │                          │
                        │  execvp("ls", args)      │
                        │         ↓                │
                        │  (becomes ls program)    │
                        │         ↓                │
                        │  ls runs and exits       │
                        └──────────────────────────┘
            `,
            codeExample: {
                title: "Shell structure overview",
                language: "c",
                code: `while (true) {
    char *user_command = get_user_input();  // e.g., "ls -la"
    
    pid_t pidOrZero = fork();
    if (pidOrZero == 0) {
        // Child: run user's command, then terminate
        execvp(command, args);  // This replaces the child process
        // If execvp returns, there was an error
        perror("execvp failed");
        exit(1);
    }
    
    // Parent: wait for child to finish before prompting again
    waitpid(pidOrZero, NULL, 0);
}`,
                annotations: [
                    { match: "while (true)", explanation: "Shell runs forever in a read-eval-print loop (REPL)." },
                    { match: "fork()", explanation: "Creates child process to run user's command. Shell (parent) stays alive." },
                    { match: "execvp(command, args)", explanation: "Replaces child with the user's program. If successful, never returns!" },
                    { match: "perror(\"execvp failed\")", explanation: "Only reached if execvp fails (e.g., command not found)." },
                    { match: "waitpid(pidOrZero, NULL, 0)", explanation: "Parent blocks until child finishes, then loops to prompt again." }
                ]
            }
        },
        {
            id: "waitpid",
            title: "waitpid(): Waiting for Child Processes",
            content: `waitpid() is a system call that allows a parent process to wait for a child to exit. It blocks until the specified child terminates, then returns information about how the child exited.`,
            keyPoints: [
                "pid: PID of child to wait on (-1 = any child)",
                "status: where to store exit information (or NULL)",
                "options: flags to customize behavior (0 for now)",
                "Returns: PID of child that exited, or -1 on error",
                "If child already exited, returns immediately",
                "If child still running, blocks until it exits"
            ],
            codeExample: {
                title: "Basic waitpid() usage",
                language: "c",
                code: `pid_t waitpid(pid_t pid, int *status, int options);

// Example: Wait for specific child
int main(int argc, char *argv[]) {
    printf("Before.\\n");
    
    pid_t pidOrZero = fork();
    if (pidOrZero == 0) {
        sleep(2);
        printf("Child: I slept and parent waited for me.\\n");
        return 0;
    }
    
    // Parent waits here until child exits
    pid_t result = waitpid(pidOrZero, NULL, 0);
    printf("Parent: Finished waiting. This always prints last.\\n");
    
    return 0;
}

// Output (always in this order):
// Before.
// Child: I slept and parent waited for me.
// Parent: Finished waiting. This always prints last.`,
                annotations: [
                    { match: "pid_t waitpid(pid_t pid, int *status, int options)", explanation: "Signature: wait for pid, store exit info in status, options control behavior." },
                    { match: "sleep(2)", explanation: "Child sleeps for 2 seconds while parent waits." },
                    { match: "waitpid(pidOrZero, NULL, 0)", explanation: "Parent blocks here until child exits. NULL means we don't need status." },
                    { match: "always in this order", explanation: "waitpid ensures parent prints last, making output deterministic." }
                ]
            }
        },
        {
            id: "waitpid-status",
            title: "Getting Child Exit Status",
            content: `The status parameter lets us find out HOW the child exited. We use macros like WIFEXITED() and WEXITSTATUS() to extract information from the status value.`,
            keyPoints: [
                "WIFEXITED(status): true if child terminated normally",
                "WEXITSTATUS(status): get the exit code (0-255)",
                "WIFSIGNALED(status): true if child was killed by signal",
                "WTERMSIG(status): get the signal that killed the child",
                "Exit status is the value returned from main() or passed to exit()"
            ],
            codeExample: {
                title: "Checking child exit status",
                language: "c",
                code: `int main(int argc, char *argv[]) {
    pid_t pid = fork();
    
    if (pid == 0) {
        printf("Child: I'm going to exit with status 111.\\n");
        return 111;  // Exit with specific status
    }
    
    int status;
    pid_t result = waitpid(pid, &status, 0);
    
    if (WIFEXITED(status)) {
        printf("Child exited normally with status %d.\\n", 
               WEXITSTATUS(status));
    } else if (WIFSIGNALED(status)) {
        printf("Child was killed by signal %d.\\n",
               WTERMSIG(status));
    } else {
        printf("Child terminated abnormally.\\n");
    }
    
    return 0;
}

// Output:
// Child: I'm going to exit with status 111.
// Child exited normally with status 111.`,
                annotations: [
                    { match: "return 111;", explanation: "Child exits with status 111. This value is retrievable by parent." },
                    { match: "WIFEXITED(status)", explanation: "Macro that returns true if child exited normally (not killed by signal)." },
                    { match: "WEXITSTATUS(status)", explanation: "Macro that extracts the exit code (0-255) from status. Here: 111." }
                ]
            }
        },
        {
            id: "zombies",
            title: "Zombie Processes",
            content: `A zombie is a process that has finished executing but hasn't been waited on by its parent yet. Zombies take up system resources, so parents should ALWAYS wait on their children.`,
            keyPoints: [
                "Zombie: finished process not yet waited on",
                "Zombies consume system resources (process table entries)",
                "waitpid() cleans up zombie children",
                "If child is still running, waitpid() blocks until it finishes",
                "If child is zombie, waitpid() returns immediately and cleans up",
                "Orphan processes: children whose parent exits are adopted by init (PID 1)"
            ],
            diagram: `
Process Lifecycle:

  ┌─────────┐     fork()     ┌─────────┐
  │ PARENT  │ ─────────────► │  CHILD  │
  └────┬────┘                └────┬────┘
       │                          │
       │                          │ child does work...
       │                          │
       │                          ▼
       │                    ┌───────────┐
       │                    │  ZOMBIE   │ ◄── Child exited but
       │                    │ (defunct) │     not yet waited on
       │                    └─────┬─────┘
       │                          │
       │ waitpid()                │
       ├──────────────────────────┘
       │
       ▼
  ZOMBIE CLEANED UP
  (resources freed)
            `,
            codeExample: {
                title: "Proper cleanup of child processes",
                language: "c",
                code: `// BAD: Creates zombie!
int main() {
    pid_t pid = fork();
    if (pid == 0) {
        printf("Child exiting...\\n");
        exit(0);
    }
    // Parent exits without waiting - child becomes zombie briefly,
    // then orphan adopted by init
    sleep(5);
    return 0;  // No waitpid - bad practice!
}

// GOOD: Always wait on children
int main() {
    pid_t pid = fork();
    if (pid == 0) {
        printf("Child exiting...\\n");
        exit(0);
    }
    
    // Parent waits and cleans up child
    int status;
    waitpid(pid, &status, 0);
    printf("Child cleaned up.\\n");
    return 0;
}`,
                annotations: [
                    { match: "sleep(5)", explanation: "Parent sleeps, leaving child as zombie for demonstration purposes." },
                    { match: "return 0;  // No waitpid - bad practice!", explanation: "Child finished but parent hasn't waited. Uses system resources until cleaned up (zombie)." },
                    { match: "waitpid(pid, &status, 0)", explanation: "Cleans up zombie by collecting its exit status. Essential to avoid resource leaks." }
                ]
            }
        },
        {
            id: "waitpid-ordering",
            title: "Waiting for Multiple Children",
            content: `When you have multiple child processes, you can wait on them in a specific order or wait for ANY child to finish. Using -1 as the PID waits for any child.`,
            keyPoints: [
                "waitpid(pid, ...) - wait for specific child",
                "waitpid(-1, ...) - wait for ANY child",
                "Children may finish in any order",
                "Loop with waitpid(-1, ...) until all children done",
                "When no children left, waitpid returns -1 with errno = ECHILD"
            ],
            codeExample: {
                title: "Waiting for multiple children",
                language: "c",
                code: `#define NUM_CHILDREN 3

int main() {
    // Fork multiple children
    for (int i = 0; i < NUM_CHILDREN; i++) {
        pid_t pid = fork();
        if (pid == 0) {
            sleep(rand() % 5);  // Random delay
            printf("Child %d (PID %d) done\\n", i, getpid());
            exit(i);
        }
    }
    
    // Wait for all children in order they finish
    while (true) {
        int status;
        pid_t pid = waitpid(-1, &status, 0);  // Wait for ANY child
        
        if (pid == -1) {
            if (errno == ECHILD) {
                printf("All children finished!\\n");
                break;  // No more children
            }
            perror("waitpid");
            break;
        }
        
        printf("Child PID %d exited with status %d\\n", 
               pid, WEXITSTATUS(status));
    }
    
    return 0;
}

// Possible output (order varies):
// Child 2 (PID 12347) done
// Child PID 12347 exited with status 2
// Child 0 (PID 12345) done
// Child PID 12345 exited with status 0
// Child 1 (PID 12346) done
// Child PID 12346 exited with status 1
// All children finished!`,
                annotations: [
                    { match: "waitpid(-1", explanation: "Using -1 as PID waits for ANY child to terminate. Useful when order doesn't matter." },
                    { match: "while (true)", explanation: "Loop until all children are reaped. waitpid returns -1 when no children left." },
                    { match: "break", explanation: "Exit loop when waitpid returns -1 (errno = ECHILD means no more children)." }
                ]
            }
        },
        {
            id: "poll-question",
            title: "Practice: Predicting Output Order",
            content: `Understanding the ordering constraints of fork() and waitpid() is crucial. Let's analyze what outputs are possible for a given program.`,
            keyPoints: [
                "Child processes run independently (may run in any order)",
                "waitpid() creates ordering constraints",
                "Output after waitpid() MUST come after child exits",
                "Sibling processes have no ordering constraints between them"
            ],
            codeExample: {
                title: "Which output is NOT possible?",
                language: "c",
                code: `int main() {
    pid_t pid1 = fork();
    if (pid1 == 0) {
        printf("Hello 1!\\n");
        return 0;
    }
    
    pid_t pid2 = fork();
    if (pid2 == 0) {
        printf("Hi 2!\\n");
        return 0;
    }
    
    waitpid(pid1, NULL, 0);
    printf("Goodbye 1\\n");
    waitpid(pid2, NULL, 0);
    printf("Goodbye 2\\n");
    return 0;
}

// A) Hello 1! → Hi 2! → Goodbye 1 → Goodbye 2  ✓ Possible
// B) Hi 2! → Hello 1! → Goodbye 1 → Goodbye 2  ✓ Possible
// C) Hello 1! → Goodbye 1 → Hi 2! → Goodbye 2  ✓ Possible
// D) Hi 2! → Goodbye 1 → Hello 1! → Goodbye 2  ✗ NOT Possible!

// Why D is impossible:
// "Goodbye 1" requires waitpid(pid1) to return
// waitpid(pid1) only returns AFTER "Hello 1!" prints
// So "Hello 1!" must come BEFORE "Goodbye 1"`,
                annotations: [
                    { match: "NOT Possible", explanation: "D is impossible because waitpid(pid1) can only return AFTER child1 prints Hello 1!" },
                    { match: "Goodbye 1", explanation: "This requires waitpid(pid1) to return, which requires Hello 1! to have been printed." },
                    { match: "waitpid(pid1) only returns", explanation: "Key insight: waitpid creates ordering constraints between parent and child output." }
                ]
            }
        },
        {
            id: "execvp",
            title: "execvp(): Running Another Program",
            content: `execvp() is a function that replaces the current process with a completely new program. If successful, the calling process is wiped clean and becomes the new program.`,
            keyPoints: [
                "int execvp(const char *path, char *argv[])",
                "path: the program to run (searched in PATH)",
                "argv: NULL-terminated array of arguments",
                "argv[0] should be the program name",
                "If successful, execvp NEVER returns (process is replaced)",
                "If unsuccessful, returns -1 (only happens on error)"
            ],
            codeExample: {
                title: "Basic execvp() usage",
                language: "c",
                code: `int main(int argc, char *argv[]) {
    printf("Hello, world!\\n");
    
    // Set up arguments for ls -l /usr/bin
    char *args[] = {
        "/bin/ls",           // argv[0]: program name
        "-l",                // argv[1]: first argument
        "/usr/bin",          // argv[2]: second argument
        NULL                 // Must be NULL-terminated!
    };
    
    execvp(args[0], args);
    
    // This line only runs if execvp FAILED
    perror("execvp failed");
    return 1;
}

// Output:
// Hello, world!
// total 12345
// -rwxr-xr-x  1 root root  12345 Jan  1 00:00 program1
// -rwxr-xr-x  1 root root  67890 Jan  1 00:00 program2
// ...`,
                annotations: [
                    { match: "char *args[]", explanation: "Array of strings for arguments. First element is program name (argv[0])." },
                    { match: "NULL", explanation: "CRITICAL: args array MUST end with NULL. Forgetting causes segfault!" },
                    { match: "execvp(args[0], args)", explanation: "Replaces current process with ls. If successful, never returns!" },
                    { match: "perror(\"execvp failed\")", explanation: "Only reached if execvp fails (e.g., program not found)." },
                    { match: "printf(\"Hello, world!\\n\")", explanation: "This prints before execvp. Any code after execvp will NOT run if execvp is successful." }
                ]
            }
        },
        {
            id: "execvp-fork",
            title: "Combining fork() and execvp()",
            content: `The most common use of fork() is NOT to split work, but to run a completely different program. We fork a child, have the child call execvp, and the parent waits.`,
            keyPoints: [
                "Fork creates a child process",
                "Child calls execvp to become the new program",
                "execvp wipes the child clean - it's still a child process, just running different code",
                "Parent can still wait on child with waitpid",
                "Child exits when the new program finishes"
            ],
            diagram: `
fork() + execvp() Pattern:

      PARENT (shell)                    CHILD
           │                              
           │ fork()                       
           ├─────────────────────────────►│
           │                              │
           │                              │ execvp("ls", args)
           │                              │      │
           │                              │      ▼
           │                         ┌────────────────┐
           │                         │  Process is    │
           │                         │  now running   │
           │ waitpid()               │  "ls" program  │
           │◄────────────────────────│                │
           │                         │  ls finishes   │
           │                         └────────────────┘
           │                              │
           ▼                              ▼
      Parent continues              Child process ends
            `,
            codeExample: {
                title: "Running a program in a child process",
                language: "c",
                code: `int main() {
    printf("Parent: About to run ls\\n");
    
    pid_t pid = fork();
    
    if (pid == 0) {
        // Child: execute ls
        char *args[] = {"ls", "-la", NULL};
        execvp(args[0], args);
        
        // Only reaches here if execvp failed
        perror("execvp");
        exit(1);
    }
    
    // Parent: wait for child to finish
    int status;
    waitpid(pid, &status, 0);
    
    if (WIFEXITED(status)) {
        printf("Parent: ls exited with status %d\\n", 
               WEXITSTATUS(status));
    }
    
    return 0;
}`
            }
        },
        {
            id: "why-execvp",
            title: "Why We Need execvp()",
            content: `Why can't we just implement every command directly in the shell? Because that would be impractical and limiting.`,
            keyPoints: [
                "Would need to implement every possible command (ls, cat, grep, etc.)",
                "Couldn't run programs the shell doesn't know about",
                "User's own programs wouldn't work",
                "Shell would be massive and unmaintainable",
                "execvp lets shell run ANY executable program"
            ],
            codeExample: {
                title: "Why not implement commands directly?",
                language: "c",
                code: `// BAD IDEA: Implementing commands in shell
while (true) {
    char *cmd = get_user_input();
    
    if (strcmp(cmd, "ls") == 0) {
        // 500 lines of code to implement ls...
    } 
    else if (strcmp(cmd, "cat") == 0) {
        // 200 lines of code...
    }
    else if (strcmp(cmd, "grep") == 0) {
        // 1000 lines of code...
    }
    // Hundreds more commands...
    else {
        printf("Unknown command!\\n");  // Can't run user programs!
    }
}

// GOOD: Use execvp
while (true) {
    char *cmd = get_user_input();
    char **args = parse_args(cmd);
    
    pid_t pid = fork();
    if (pid == 0) {
        execvp(args[0], args);  // Run ANY program!
        exit(1);
    }
    waitpid(pid, NULL, 0);
}`,
                annotations: [
                    { match: "parse_args(cmd)", explanation: "Tokenize user input into array of strings (e.g., 'ls -la' → ['ls', '-la', NULL])." },
                    { match: "execvp(args[0], args)", explanation: "Run ANY program - the shell doesn't need to know the command in advance!" },
                    { match: "exit(1)", explanation: "If execvp fails (command not found), child exits with error status." }
                ]
            }
        },
        {
            id: "first-shell",
            title: "Building Our First Shell",
            content: `Let's put it all together and build a simple shell. The shell prompts for input, forks a child, runs the command with execvp, and waits for it to finish.`,
            keyPoints: [
                "Main loop: prompt → read → fork → execvp (child) → waitpid (parent)",
                "Child process runs the user's command",
                "Parent process waits for child, then prompts again",
                "Handle execvp failure (print error, exit child)",
                "assign3: You'll build a full shell with many more features!"
            ],
            codeExample: {
                title: "Simple shell implementation",
                language: "c",
                code: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/wait.h>

#define MAX_LINE 256
#define MAX_ARGS 32

int main() {
    char line[MAX_LINE];
    
    while (true) {
        // 1. Print prompt
        printf("mysh> ");
        fflush(stdout);
        
        // 2. Read command
        if (fgets(line, MAX_LINE, stdin) == NULL) {
            break;  // EOF (Ctrl-D)
        }
        
        // Remove newline
        line[strcspn(line, "\\n")] = '\\0';
        if (strlen(line) == 0) continue;
        
        // 3. Parse into arguments (simplified)
        char *args[MAX_ARGS];
        int argc = 0;
        char *token = strtok(line, " ");
        while (token != NULL && argc < MAX_ARGS - 1) {
            args[argc++] = token;
            token = strtok(NULL, " ");
        }
        args[argc] = NULL;
        
        // 4. Fork and execute
        pid_t pid = fork();
        
        if (pid == 0) {
            // Child: run the command
            execvp(args[0], args);
            fprintf(stderr, "Command not found: %s\\n", args[0]);
            exit(1);
        }
        
        // 5. Parent: wait for child
        int status;
        waitpid(pid, &status, 0);
    }
    
    printf("\\nGoodbye!\\n");
    return 0;
}`,
                annotations: [
                    { match: "fgets(line, MAX_LINE, stdin)", explanation: "Reads user input. Returns NULL on EOF (Ctrl-D on Unix)." },
                    { match: "strtok(line, \" \")", explanation: "Tokenizes input into arguments separated by spaces." },
                    { match: "execvp(args[0], args)", explanation: "Child runs the command. args[0] is both the program name and first argv element." },
                    { match: "Command not found", explanation: "Only printed if execvp fails - e.g., typo in command name." },
                    { match: "waitpid(pid, &status, 0)", explanation: "Parent waits for child to finish before prompting again." }
                ]
            }
        },
        {
            id: "shell-demo",
            title: "Shell in Action",
            content: `Here's what our simple shell looks like when running. It can execute any program installed on the system.`,
            keyPoints: [
                "Shell runs in a loop until EOF (Ctrl-D)",
                "Can run any system command (ls, pwd, echo, etc.)",
                "Can run user programs",
                "Handles unknown commands gracefully",
                "assign3 adds: pipes, redirection, background jobs, signals"
            ],
            codeExample: {
                title: "Example shell session",
                language: "text",
                code: `$ ./mysh
mysh> pwd
/home/student/cs111
mysh> ls -la
total 24
drwxr-xr-x  2 student student 4096 Jan 15 10:00 .
drwxr-xr-x 10 student student 4096 Jan 15 09:00 ..
-rwxr-xr-x  1 student student 8192 Jan 15 10:00 mysh
-rw-r--r--  1 student student 1234 Jan 15 10:00 mysh.c
mysh> echo "Hello from my shell!"
Hello from my shell!
mysh> nonexistent_command
Command not found: nonexistent_command
mysh> ^D
Goodbye!
$`
            }
        },
        {
            id: "summary",
            title: "Lecture 9 Summary",
            content: `We learned three essential system calls for multiprocessing: fork() to create processes, waitpid() to wait for children, and execvp() to run different programs. Together, these form the foundation of how shells work.`,
            keyPoints: [
                "fork(): creates child process (clone of parent)",
                "waitpid(): parent waits for child to exit, gets exit status",
                "execvp(): replaces process with new program",
                "Zombies: finished children not yet waited on - always clean up!",
                "Shell pattern: loop of fork → execvp (child) → waitpid (parent)"
            ],
            advantages: [
                "fork() gives cheap process creation (copy-on-write)",
                "waitpid() provides synchronization between parent and child",
                "execvp() allows running any program from any program",
                "Combined, they enable building shells and process managers"
            ],
            disadvantages: [
                "fork() copies entire address space (can be expensive for large processes)",
                "Must remember to wait on all children (avoid zombies)",
                "execvp() completely replaces process (can't return to previous code)",
                "Error handling requires careful attention (check return values)"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Fork Output Prediction",
            difficulty: "easy",
            description: "Predict all possible outputs of the following program. How many lines are printed total?",
            hint: "Count how many processes exist at each printf statement. Remember fork() creates a new process that also continues executing.",
            starterCode: `int main() {
    printf("A\\n");
    fork();
    printf("B\\n");
    fork();
    printf("C\\n");
    return 0;
}

// How many times is each letter printed?
// A: ____
// B: ____
// C: ____`,
            solution: `int main() {
    printf("A\\n");     // 1 process prints A
    fork();            // Now 2 processes
    printf("B\\n");     // 2 processes print B
    fork();            // Now 4 processes
    printf("C\\n");     // 4 processes print C
    return 0;
}

// Answer:
// A: 1 time  (only original process)
// B: 2 times (original + first child)
// C: 4 times (original + first child + their children)
// Total: 7 lines printed`,
            explanation: "After the first fork(), we have 2 processes. After the second fork(), each of those 2 processes creates a child, giving us 4 total. Each process prints C."
        },
        {
            id: "ex2",
            title: "Waitpid Return Value",
            difficulty: "easy",
            description: "What does waitpid() return in different scenarios? Fill in the expected return values.",
            hint: "waitpid() returns the PID of the child that exited, or -1 on error.",
            starterCode: `// Scenario 1: Child with PID 1234 exits successfully
int status;
pid_t result = waitpid(1234, &status, 0);
// result = ____

// Scenario 2: No children exist
pid_t result2 = waitpid(-1, NULL, 0);
// result2 = ____
// errno = ____

// Scenario 3: Waiting with -1, child PID 5678 exits first
pid_t result3 = waitpid(-1, NULL, 0);
// result3 = ____`,
            solution: `// Scenario 1: Child with PID 1234 exits successfully
int status;
pid_t result = waitpid(1234, &status, 0);
// result = 1234 (PID of the child that exited)

// Scenario 2: No children exist
pid_t result2 = waitpid(-1, NULL, 0);
// result2 = -1 (error)
// errno = ECHILD (no child processes)

// Scenario 3: Waiting with -1, child PID 5678 exits first
pid_t result3 = waitpid(-1, NULL, 0);
// result3 = 5678 (PID of whichever child exited)`,
            explanation: "waitpid() returns the PID of the waited-for child on success, or -1 on error. When pid is -1, it waits for any child and returns that child's PID."
        },
        {
            id: "ex3",
            title: "Exit Status Extraction",
            difficulty: "medium",
            description: "Write code to extract and print the exit status of a child process. Handle both normal exit and signal termination.",
            hint: "Use WIFEXITED() to check for normal exit, WIFSIGNALED() for signal. Use WEXITSTATUS() and WTERMSIG() to get the values.",
            starterCode: `void print_exit_info(int status) {
    // Check if child exited normally
    if (____) {
        int exit_code = ____;
        printf("Exited normally with code %d\\n", exit_code);
    }
    // Check if child was killed by signal
    else if (____) {
        int signal = ____;
        printf("Killed by signal %d\\n", signal);
    }
    else {
        printf("Unknown termination\\n");
    }
}`,
            solution: `void print_exit_info(int status) {
    // Check if child exited normally
    if (WIFEXITED(status)) {
        int exit_code = WEXITSTATUS(status);
        printf("Exited normally with code %d\\n", exit_code);
    }
    // Check if child was killed by signal
    else if (WIFSIGNALED(status)) {
        int signal = WTERMSIG(status);
        printf("Killed by signal %d\\n", signal);
    }
    else {
        printf("Unknown termination\\n");
    }
}

// Example usage:
int main() {
    pid_t pid = fork();
    if (pid == 0) {
        exit(42);  // or: raise(SIGKILL);
    }
    int status;
    waitpid(pid, &status, 0);
    print_exit_info(status);
    return 0;
}`,
            explanation: "The status value from waitpid() encodes how the child exited. We use macros to extract the information: WIFEXITED/WEXITSTATUS for normal exit, WIFSIGNALED/WTERMSIG for signal termination."
        },
        {
            id: "ex4",
            title: "execvp Argument Setup",
            difficulty: "medium",
            description: "Set up the argv array correctly to run 'grep -r \"TODO\" src/' using execvp.",
            hint: "Remember: argv[0] is the program name, array must be NULL-terminated, and strings with spaces need quotes in shell but not in argv.",
            starterCode: `int main() {
    // We want to run: grep -r "TODO" src/
    char *args[] = {
        ____,  // argv[0]: program name
        ____,  // argv[1]: -r flag
        ____,  // argv[2]: pattern to search
        ____,  // argv[3]: directory
        ____   // Must end with...
    };
    
    execvp(args[0], args);
    perror("execvp failed");
    return 1;
}`,
            solution: `int main() {
    // We want to run: grep -r "TODO" src/
    char *args[] = {
        "grep",    // argv[0]: program name
        "-r",      // argv[1]: -r flag
        "TODO",    // argv[2]: pattern (no quotes needed in C!)
        "src/",    // argv[3]: directory
        NULL       // Must end with NULL
    };
    
    execvp(args[0], args);
    perror("execvp failed");
    return 1;
}

// Note: In the shell, you'd type: grep -r "TODO" src/
// But in C, we don't include the quotes - they're just 
// for the shell to know "TODO" is one argument.`,
            explanation: "The quotes around \"TODO\" in shell commands are for the shell's parser. In C, each array element is already a separate string, so no quotes needed. Always end with NULL!"
        },
        {
            id: "ex5",
            title: "Waiting for All Children",
            difficulty: "medium",
            description: "Write a loop that forks N children, then waits for ALL of them to finish before the parent continues. Track how many children completed successfully vs. with errors.",
            hint: "Use waitpid(-1, ...) in a loop. When it returns -1 with errno == ECHILD, all children are done.",
            starterCode: `#define N 5

int main() {
    int success_count = 0;
    int error_count = 0;
    
    // Fork N children
    for (int i = 0; i < N; i++) {
        pid_t pid = fork();
        if (pid == 0) {
            // Child: exit with random status
            exit(rand() % 2);  // 0 = success, 1 = error
        }
    }
    
    // Wait for all children
    while (____) {
        int status;
        pid_t pid = waitpid(____, &status, 0);
        
        if (pid == -1) {
            if (____) {
                break;  // No more children
            }
            perror("waitpid");
            break;
        }
        
        if (WIFEXITED(status) && WEXITSTATUS(status) == 0) {
            ____;
        } else {
            ____;
        }
    }
    
    printf("Success: %d, Errors: %d\\n", success_count, error_count);
    return 0;
}`,
            solution: `#define N 5

int main() {
    int success_count = 0;
    int error_count = 0;
    
    // Fork N children
    for (int i = 0; i < N; i++) {
        pid_t pid = fork();
        if (pid == 0) {
            // Child: exit with random status
            srand(getpid());  // Seed with PID for variety
            exit(rand() % 2);  // 0 = success, 1 = error
        }
    }
    
    // Wait for all children
    while (true) {
        int status;
        pid_t pid = waitpid(-1, &status, 0);
        
        if (pid == -1) {
            if (errno == ECHILD) {
                break;  // No more children
            }
            perror("waitpid");
            break;
        }
        
        if (WIFEXITED(status) && WEXITSTATUS(status) == 0) {
            success_count++;
        } else {
            error_count++;
        }
    }
    
    printf("Success: %d, Errors: %d\\n", success_count, error_count);
    return 0;
}`,
            explanation: "Using waitpid(-1, ...) waits for any child. We loop until waitpid returns -1 with errno == ECHILD, meaning no children remain. This ensures we clean up all zombies."
        },
        {
            id: "ex6",
            title: "Simple Command Executor",
            difficulty: "hard",
            description: "Write a function that takes a command string, parses it into arguments, forks a child, runs the command with execvp, and returns the exit status. Handle errors appropriately.",
            hint: "Use strtok() to parse, fork/execvp/waitpid pattern. Return -1 on fork failure, child's exit status on success.",
            starterCode: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/wait.h>

#define MAX_ARGS 64

// Returns: exit status of command, or -1 on error
int run_command(const char *command) {
    // Make a copy (strtok modifies string)
    char cmd_copy[256];
    strncpy(cmd_copy, command, sizeof(cmd_copy) - 1);
    
    // Parse into arguments
    char *args[MAX_ARGS];
    int argc = 0;
    ____  // Parse cmd_copy into args array
    
    // Fork and execute
    pid_t pid = fork();
    
    if (pid == ____) {  // Error case
        ____
    }
    
    if (pid == ____) {  // Child case
        ____
    }
    
    // Parent: wait and return status
    ____
}`,
            solution: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/wait.h>

#define MAX_ARGS 64

// Returns: exit status of command, or -1 on error
int run_command(const char *command) {
    // Make a copy (strtok modifies string)
    char cmd_copy[256];
    strncpy(cmd_copy, command, sizeof(cmd_copy) - 1);
    cmd_copy[sizeof(cmd_copy) - 1] = '\\0';
    
    // Parse into arguments
    char *args[MAX_ARGS];
    int argc = 0;
    char *token = strtok(cmd_copy, " \\t\\n");
    while (token != NULL && argc < MAX_ARGS - 1) {
        args[argc++] = token;
        token = strtok(NULL, " \\t\\n");
    }
    args[argc] = NULL;
    
    if (argc == 0) {
        return 0;  // Empty command
    }
    
    // Fork and execute
    pid_t pid = fork();
    
    if (pid == -1) {
        perror("fork");
        return -1;
    }
    
    if (pid == 0) {
        // Child: execute command
        execvp(args[0], args);
        perror(args[0]);
        exit(127);  // Standard "command not found" exit code
    }
    
    // Parent: wait and return status
    int status;
    if (waitpid(pid, &status, 0) == -1) {
        perror("waitpid");
        return -1;
    }
    
    if (WIFEXITED(status)) {
        return WEXITSTATUS(status);
    }
    return -1;  // Abnormal termination
}

// Example usage:
int main() {
    int status = run_command("ls -la /tmp");
    printf("Command exited with status %d\\n", status);
    
    status = run_command("false");  // /bin/false always returns 1
    printf("Command exited with status %d\\n", status);
    
    return 0;
}`,
            explanation: "This function encapsulates the full fork/exec/wait pattern that shells use. Note the exit(127) in the child after execvp fails - this is the standard exit code for 'command not found'."
        },
        {
            id: "ex7",
            title: "Pipeline Simulation (Conceptual)",
            difficulty: "hard",
            description: "Trace through what happens when a shell runs 'ls | grep txt'. How many fork() calls? How many processes total? What does each process do?",
            hint: "Think about how the shell needs to connect two programs. Each program runs in its own process. The shell coordinates them.",
            starterCode: `// When user types: ls | grep txt
// 
// How many fork() calls? ____
// How many processes at peak? ____
//
// Process 1 (____):
//   Does: ____
//
// Process 2 (____):  
//   Does: ____
//
// Process 3 (____):
//   Does: ____
//
// How does output flow from ls to grep?
// ____`,
            solution: `// When user types: ls | grep txt
// 
// How many fork() calls? 2
// How many processes at peak? 3 (shell + ls + grep)
//
// Process 1 (Shell/Parent):
//   Does: 
//   - Creates a pipe for communication
//   - Forks child 1 for 'ls'
//   - Forks child 2 for 'grep'
//   - Waits for both children to finish
//
// Process 2 (Child 1 - ls):  
//   Does:
//   - Redirects stdout to pipe write end
//   - Closes pipe read end
//   - execvp("ls", ["ls", NULL])
//
// Process 3 (Child 2 - grep):
//   Does:
//   - Redirects stdin from pipe read end
//   - Closes pipe write end
//   - execvp("grep", ["grep", "txt", NULL])
//
// How does output flow from ls to grep?
// ls writes to stdout → pipe write end → pipe read end → grep reads from stdin
//
// Diagram:
// ┌────────┐    pipe    ┌────────┐
// │   ls   │ ─────────► │  grep  │ ──► terminal
// └────────┘  (stdout)  └────────┘ (stdout)`,
            explanation: "Pipes (covered in Lectures 10-11) connect processes. The key insight is that the shell forks twice - once per command - and sets up a pipe between them. This is the foundation of assign3!"
        }
    ]
};

export default lecture9;
