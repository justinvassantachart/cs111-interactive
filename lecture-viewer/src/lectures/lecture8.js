export const lecture8 = {
    id: 8,
    title: "Multiprocessing Introduction",
    subtitle: "Creating and Managing Processes with fork()",
    keyTakeaway: "fork() allows a process to fork off a cloned child process. The order of execution between parent and child is up to the OS! We can distinguish between parent and child using fork's return value (child PID in parent, 0 in child).",

    sections: [
        {
            id: "lecture7-recap",
            title: "Lecture 7 Recap: Filesystem System Calls",
            content: `**open**, **close**, **read**, and **write** are 4 system calls for interacting with the filesystem. These functions work with **file descriptors** – unique numbers assigned by the operating system to refer to that instance of that file in this program. **read** and **write** may not read/write all requested bytes – not necessarily an error (e.g., may be interrupted), but we may need to call them multiple times.`,
            keyPoints: [
                "File descriptors are a powerful abstraction for working with files and other resources",
                "A file descriptor can represent more than a file – it's a number representing a currently-open resource",
                "Network connections, terminal input/output all use file descriptors",
                "Special reserved FDs: 0 (stdin), 1 (stdout), 2 (stderr)"
            ],
            codeExample: {
                title: "File descriptors and I/O",
                language: "c",
                code: `// There are 3 special file descriptors provided by default:
// 0: standard input (user input from the terminal) - STDIN_FILENO
// 1: standard output (output to the terminal) - STDOUT_FILENO  
// 2: standard error (error output to the terminal) - STDERR_FILENO

// These aren't really files, but they behave just like they are!
// read(0, buf, nbytes) gets input from the user!
// write(1, buf, nbytes) prints to the terminal!

// Programs always assume that 0,1,2 represent STDIN/STDOUT/STDERR
// cin in C++ is essentially a nicer version of read(0, buf, nbytes)

// Example: copying a file to stdout instead of another file
static const int kDefaultPermissions = 0644;

int main(int argc, char *argv[]) {
    int sourceFD = open(argv[1], O_RDONLY);
    int destinationFD = open(argv[2],
        O_WRONLY | O_CREAT | O_EXCL, kDefaultPermissions);
    
    // Change this line to print to terminal instead of copying:
    // copyContents(sourceFD, destinationFD);
    copyContents(sourceFD, STDOUT_FILENO);  // Now prints to terminal!
    
    close(sourceFD);
    close(destinationFD);
    return 0;
}`,
                annotations: [
                    { match: "STDIN_FILENO", explanation: "Constant for fd 0 (standard input). More readable than magic number." },
                    { match: "STDOUT_FILENO", explanation: "Constant for fd 1 (standard output). Writing here prints to terminal." },
                    { match: "STDERR_FILENO", explanation: "Constant for fd 2 (standard error). Separate from stdout for error messages." },
                    { match: "read(0, buf, nbytes)", explanation: "Reading from fd 0 gets user input from the terminal." },
                    { match: "copyContents(sourceFD, STDOUT_FILENO)", explanation: "Instead of copying to a file, we output to terminal using fd 1!" }
                ]
            }
        },
        {
            id: "multiprocessing-overview",
            title: "Multiprocessing Overview",
            content: `We now move to **Topic 2: Multiprocessing** - How can our program create and interact with other programs? How does the operating system manage user programs? This is important because it helps us understand how programs are spawned and run (e.g., shells, web servers), introduces us to the challenges of **concurrency** – managing concurrent events, and allows us to understand how shells work and implement our own!`,
            keyPoints: [
                "Program: code you write to execute tasks",
                "Process: an instance of your program running (program + execution state)",
                "Key idea: multiple processes can run the same program",
                "Your computer runs many processes simultaneously - even with just 1 processor core",
                "'Simultaneously' = switch between them so fast humans don't notice",
                "Each process thinks it's the only thing running"
            ],
            diagram: `
Multiprocessing Terminology:

  ┌──────────────────────────────────────────────────────────┐
  │                       PROGRAM                             │
  │   (your code: main.c, compiled to executable)            │
  └──────────────────────────────────────────────────────────┘
                           │
            Can spawn multiple instances
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
  │  Process A  │   │  Process B  │   │  Process C  │
  │  PID: 1234  │   │  PID: 1235  │   │  PID: 1236  │
  │  (running)  │   │  (waiting)  │   │  (running)  │
  └─────────────┘   └─────────────┘   └─────────────┘
  
OS Scheduler decides who gets CPU time!
            `,
            codeExample: {
                title: "Getting the current process ID",
                language: "c",
                code: `// getpid.c
#include <stdio.h>
#include <unistd.h>

int main(int argc, char *argv[]) {
    pid_t myPid = getpid();
    printf("My process ID is %d\\n", myPid);
    return 0;
}

// Running this twice gives different PIDs:
// $ ./getpid
// My process ID is 18814
// $ ./getpid  
// My process ID is 18831`,
                annotations: [
                    { match: "getpid()", explanation: "System call that returns the process ID of the calling process." },
                    { match: "pid_t", explanation: "Type for process IDs. Typically an integer, but use pid_t for portability." },
                    { match: "My process ID is 18814", explanation: "Each run gets a different PID - assigned by OS when process starts." }
                ]
            }
        },
        {
            id: "introducing-fork",
            title: "Introducing fork()",
            content: `**fork()** is a system call that creates a second process which is a **clone** of the first. The parent (original) process forks off a child (new) process. The child starts execution on the next program instruction. The parent continues execution with the next program instruction. The order from now on is up to the OS! **fork()** is called once, but returns twice.`,
            keyPoints: [
                "fork() creates a clone of the calling process",
                "Parent process = original, Child process = new clone",
                "Child starts executing at the instruction AFTER the fork() call",
                "Both processes continue running - order determined by OS scheduler",
                "Everything is duplicated in child: file descriptor table, memory regions (stack, heap, etc.)",
                "A child process could also later call fork, becoming a parent itself"
            ],
            diagram: `
fork() Visualization:

Before fork():
┌────────────────────────────────────────┐
│              Process A                  │
│  int main() {                          │
│      printf("Hello!\\n");               │ 
│      fork();  ◄── Currently here       │
│      printf("Goodbye!\\n");             │
│  }                                     │
└────────────────────────────────────────┘

After fork():
┌────────────────────────────────────────┐     ┌────────────────────────────────────────┐
│           Process A (parent)            │     │           Process B (child)             │
│  int main() {                          │     │  int main() {                          │
│      printf("Hello!\\n");               │     │      printf("Hello!\\n");               │
│      fork();  ✓ Done                   │     │      fork();  ◄── Starts here          │
│      printf("Goodbye!\\n"); ◄── Next   │     │      printf("Goodbye!\\n"); ◄── Next   │
│  }                                     │     │  }                                     │
└────────────────────────────────────────┘     └────────────────────────────────────────┘

Output could be:       Or:              Or even interleaved:
Hello!                 Hello!           Hello!
Goodbye!               Goodbye!         GoodGobye!
Goodbye!               Goodbye!         odbye!
            `,
            codeExample: {
                title: "Basic fork() example",
                language: "c",
                code: `#include <stdio.h>
#include <unistd.h>
#include <assert.h>

int main(int argc, char *argv[]) {
    printf("Hello, world!\\n");    // Printed once (before fork)
    fork();
    printf("Goodbye!\\n");         // Printed twice (by parent and child)
    return 0;
}

// Output (order may vary!):
// Hello, world!
// Goodbye!
// Goodbye!

// With a variable:
int main(int argc, char *argv[]) {
    int x = 2;
    printf("Hello, world!\\n");
    fork();
    printf("Goodbye, %d!\\n", x);   // Both processes have x = 2
    return 0;
}

// Output:
// Hello, world!
// Goodbye, 2!
// Goodbye, 2!`,
                annotations: [
                    { match: "fork()", explanation: "Creates a new process that is a clone of the current one. Returns twice!" },
                    { match: "Hello, world!", explanation: "Printed once because it happens before fork() creates the clone." },
                    { match: "Goodbye!", explanation: "Printed twice - once by parent, once by child. Order is non-deterministic!" },
                    { match: "int x = 2", explanation: "Both processes have their own copy of x=2 after fork. Memory is duplicated." }
                ]
            }
        },
        {
            id: "fork-return-value",
            title: "fork() Return Value",
            content: `The key insight is that **fork() returns different values** in the parent and child processes. In the parent, fork() returns the child's PID. In the child, fork() returns 0 (this is NOT the child's PID – just a sentinel value). If fork() returns < 0, that means an error occurred (e.g., out of processes). This allows us to assign different tasks to parent and child!`,
            keyPoints: [
                "fork() returns child's PID in parent process",
                "fork() returns 0 in child process (just a sentinel, not actual PID)",
                "fork() returns negative value on error",
                "getppid() gets the PID of your parent process",
                "getpid() gets your own PID",
                "For the parent, fork's return value is the ONLY way to get the child's PID"
            ],
            diagram: `
fork() Return Values:

      ┌─────────────────────────────────────┐
      │         Before fork()                │
      │         Process 111                  │
      │                                      │
      │   pid_t pidOrZero = fork();         │
      └──────────────────┬──────────────────┘
                         │
          ───────────────┴───────────────
          │                              │
          ▼                              ▼
┌──────────────────────┐      ┌──────────────────────┐
│   Parent (PID 111)   │      │   Child (PID 112)    │
│                      │      │                      │
│  pidOrZero = 112     │      │  pidOrZero = 0       │
│  (child's PID)       │      │  (sentinel value)    │
└──────────────────────┘      └──────────────────────┘

printf("fork returned %d\\n", pidOrZero);
      │                              │
      ▼                              ▼
"fork returned 112"           "fork returned 0"
            `,
            codeExample: {
                title: "Distinguishing parent from child",
                language: "c",
                code: `#include <stdio.h>
#include <unistd.h>

int main(int argc, char *argv[]) {
    printf("Hello from process %d! (parent %d)\\n", getpid(), getppid());
    
    pid_t pidOrZero = fork();
    
    if (pidOrZero < 0) {
        // Error case - fork failed!
        perror("fork");
        return 1;
    }
    
    if (pidOrZero == 0) {
        // This code ONLY runs in the child
        printf("I am the CHILD! My PID is %d\\n", getpid());
    } else {
        // This code ONLY runs in the parent
        printf("I am the PARENT! My child's PID is %d\\n", pidOrZero);
    }
    
    // This code runs in BOTH parent and child
    printf("Bye from process %d! (parent %d)\\n", getpid(), getppid());
    return 0;
}

// Sample output:
// Hello from process 29686! (parent 29351)   <- Original process
// I am the PARENT! My child's PID is 29688
// Bye from process 29686! (parent 29351)     <- Parent finishing
// I am the CHILD! My PID is 29688
// Bye from process 29688! (parent 29686)     <- Child finishing`,
                annotations: [
                    { match: "pid_t pidOrZero", explanation: "Stores fork's return: child's PID in parent, 0 in child, negative on error." },
                    { match: "pidOrZero < 0", explanation: "Always check for errors first! fork() returns negative if it failed." },
                    { match: "pidOrZero == 0", explanation: "If 0, we're in the child process. This is just a sentinel, not the child's PID." },
                    { match: "getpid()", explanation: "In child, use getpid() to get your own PID (not available from fork return)." },
                    { match: "getppid()", explanation: "Returns parent's PID. Child's getppid() equals parent's getpid()." }
                ]
            }
        },
        {
            id: "execution-order",
            title: "Non-Deterministic Execution Order",
            content: `A crucial insight: **we can no longer assume the order in which our program will execute!** The OS decides the order. Parent-child output could print in any order, or even be interleaved. This is our first taste of **concurrency** in systems programming.`,
            keyPoints: [
                "After fork(), parent and child run concurrently",
                "OS scheduler decides who runs when",
                "Output order is non-deterministic (unpredictable)",
                "Different runs may produce different orderings",
                "This is why concurrency is challenging!",
                "Many times, waiting is good (e.g., waiting for key press, waiting for disk)"
            ],
            codeExample: {
                title: "Non-deterministic output",
                language: "c",
                code: `// Assume parent PID 111, child PID 112
pid_t pidOrZero = fork();
printf("hello, world!\\n");
printf("goodbye! (fork returned %d)\\n", pidOrZero);

// All of these outputs are POSSIBLE:

// Output A:                  // Output B:
// hello, world!             // hello, world!  
// hello, world!             // hello, world!
// goodbye! (fork returned 0) // goodbye! (fork returned 112)
// goodbye! (fork returned 112) // goodbye! (fork returned 0)

// Output C:                  // Output D (NOT possible!):
// hello, world!             // hello, world!
// goodbye! (fork returned 112) // goodbye! (fork returned 112)
// hello, world!             // goodbye! (fork returned 0)
// goodbye! (fork returned 0) // hello, world!  <- Can't happen!
//                           // (each process prints hello before goodbye)

// Why is D impossible?
// Within a SINGLE process, instructions execute in order.
// Each process prints "hello" THEN "goodbye".
// But ACROSS processes, any interleaving is possible.`,
                annotations: [
                    { match: "Output A", explanation: "Child runs first, finishes, then parent runs. Common but not guaranteed." },
                    { match: "Output B", explanation: "Parent runs first. Fork return value shows which process printed each line." },
                    { match: "Output C", explanation: "Interleaved - parent prints hello, child prints hello, parent goodbye, child goodbye." },
                    { match: "NOT possible", explanation: "Within each process, code executes in order. A process always prints hello before goodbye." },
                    { match: "fork returned 0", explanation: "This output is from the child (fork returns 0 in child)." },
                    { match: "fork returned 112", explanation: "This output is from the parent (fork returns child's PID)." }
                ]
            }
        },
        {
            id: "processes-all-the-way-down",
            title: "Processes All The Way Down",
            content: `Even a child process can call fork() to spawn its own child process! This creates a tree of processes. Understanding how multiple forks create process hierarchies is essential for implementing shells and understanding how Unix process trees work.`,
            keyPoints: [
                "Child processes can also call fork()",
                "Each fork doubles the number of processes (approximately)",
                "Process trees can get complex quickly",
                "Every process has a parent (except init/PID 1)",
                "When you run a command, its parent is the shell"
            ],
            diagram: `
Two fork() calls:

int main() {
    printf("Hello!\\n");         <- Printed 1x
    fork();
    printf("Howdy!\\n");         <- Printed 2x (parent + child1)
    fork();
    printf("Hey there!\\n");     <- Printed 4x
}

Process Tree:
                     ┌──────────────┐
                     │    Parent    │
                     │ (original)   │
                     └──────┬───────┘
                      fork()│
           ┌────────────────┴────────────────┐
           ▼                                 ▼
    ┌──────────────┐                  ┌──────────────┐
    │    Parent    │                  │   Child 1    │
    │  (continues) │                  │              │
    └──────┬───────┘                  └──────┬───────┘
     fork()│                           fork()│
    ┌──────┴──────┐                   ┌──────┴──────┐
    ▼             ▼                   ▼             ▼
┌────────┐  ┌────────┐           ┌────────┐  ┌────────┐
│ Parent │  │ Child 2│           │ Child1 │  │ GChild │
└────────┘  └────────┘           └────────┘  └────────┘

TOTAL: 4 processes
Hello:     1 time  (before any fork)
Howdy:     2 times (after 1st fork)
Hey there: 4 times (after 2nd fork)
            `,
            codeExample: {
                title: "Multiple forks creating process trees",
                language: "c",
                code: `#include <stdio.h>
#include <unistd.h>

int main(int argc, char *argv[]) {
    printf("Hello!\\n");    // 1 time
    fork();
    printf("Howdy!\\n");    // 2 times
    fork();  
    printf("Hey there!\\n"); // 4 times
    return 0;
}

// How many total processes? 4
// 
// Process tree:
//     Original (prints all 3)
//         │
//         ├── Child1 from 1st fork (prints Howdy + Hey there)
//         │       │
//         │       └── Grandchild from Child1's 2nd fork (prints Hey there)
//         │
//         └── Child2 from Original's 2nd fork (prints Hey there)
//
// Formula: with n fork() calls, you get 2^n processes
// 2 forks = 4 processes
// 3 forks = 8 processes
// etc.

// Common interview question pattern:
int main() {
    fork();
    fork();
    fork();
    printf("*");  // How many stars? 2^3 = 8
    return 0;
}`,
                annotations: [
                    { match: "2^n", explanation: "With n fork() calls, you get 2^n processes. Each fork doubles the process count." },
                    { match: "fork()\\n    fork()", explanation: "First fork: 1→2 processes. Second fork: each of 2 forks → 4 processes." },
                    { match: "2^3 = 8", explanation: "Three forks = 2³ = 8 processes, each printing one star." },
                    { match: "child could call fork", explanation: "A forked child can also fork, becoming a parent itself. Creates process trees." }
                ]
            }
        },
        {
            id: "shell-goal",
            title: "Our Goal: Building a Shell",
            content: `A **shell** is a program that prompts the user for a command to run, runs that command, waits for the command to finish, and then prompts the user again. Understanding fork() is essential because shells fork off child processes to run user commands. The key idea: we can only run one program per process, so to keep the shell running we need to run the user's command in another process.`,
            keyPoints: [
                "Shell is a program that runs other programs",
                "Shell prompts user, runs command, waits, repeats",
                "Shell (parent) forks off child process to run each command",
                "Key insight: can only run one program per process",
                "If shell ran command directly, shell would be replaced!",
                "assign3: implement your own shell program!"
            ],
            diagram: `
Shell Process Model:

┌─────────────────────────────────────────────────────────────┐
│                         SHELL LOOP                          │
│                                                             │
│  while (true) {                                             │
│      prompt user for command                                │
│      fork() ──────────────────┐                             │
│           │                   │                             │
│      PARENT (shell)      CHILD PROCESS                      │
│           │                   │                             │
│      wait for child      run user's command                 │
│           │                   │                             │
│           ◄───────────────────┘ (child terminates)          │
│      prompt again...                                        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘

Example: Running "ls" in a shell

$ ls                  <- User types command
   │
Shell forks ─────────┐
   │                 │
Shell waits      Child runs "ls"
   │                 │
   │             file1.txt
   │             file2.txt
   │                 │
   │             Child exits
   │◄────────────────┘
$                     <- Shell prompts again
            `,
            codeExample: {
                title: "Basic shell structure (preview)",
                language: "c",
                code: `// Simplified shell structure
// (We'll learn execvp and waitpid in Lecture 9)

while (true) {
    char *user_command = ... // get user input
    
    pid_t pidOrZero = fork();
    
    if (pidOrZero == 0) {
        // Child process: run the user's command
        execvp(...);  // Replace child with user's program
        // execvp doesn't return (unless error)
    }
    
    // Parent process: wait for child to finish
    waitpid(pidOrZero, NULL, 0);  // Block until child exits
    
    // Now prompt user again (loop continues)
}

// Why do we need fork?
// - execvp REPLACES the current process with a new program
// - If shell called execvp directly, shell would be gone!
// - By forking first, shell continues while child runs command
// - Shell waits for child, then prompts for next command`,
                annotations: [
                    { match: "while (true)", explanation: "Shell runs forever, repeatedly prompting and executing commands." },
                    { match: "fork()", explanation: "Creates child process to run user's command, keeping shell alive." },
                    { match: "execvp(...)", explanation: "Replaces child's program with user's command. Will learn in Lecture 9." },
                    { match: "waitpid(pidOrZero)", explanation: "Parent waits for child to finish before prompting for next command." },
                    { match: "If shell called execvp directly", explanation: "Key insight: exec replaces the process, so shell would disappear!" }
                ]
            }
        },
        {
            id: "cloning-processes",
            title: "Cloning Processes: Memory and Variables",
            content: `When fork() creates a child, **everything is duplicated**: the file descriptor table, all memory regions (stack, heap, globals). But wait - if addresses are the same, how can parent and child have different data? The answer is **virtual memory**: each program's addresses are "fake" virtual addresses that the OS maps to "real" physical addresses.`,
            keyPoints: [
                "Child gets a copy of parent's memory at time of fork",
                "Same virtual addresses, different physical memory",
                "Changes in child don't affect parent (and vice versa)",
                "OS uses 'copy-on-write' optimization: only copies when modified",
                "File descriptors are copied too (both can access same files)",
                "Virtual memory makes this isolation possible"
            ],
            diagram: `
Memory Isolation After fork():

                    VIRTUAL ADDRESS SPACE
              Parent (PID 111)        Child (PID 112)
              ──────────────          ──────────────
str @ 0x7ffc:  "Hello"                "Hello"
              (later: still "Hello")  (later: "Howdy")

                         │                    │
                         │   OS Translation   │
                         ▼                    ▼
                    PHYSICAL MEMORY
              ┌──────────────┐      ┌──────────────┐
              │   Physical   │      │   Physical   │
              │   Location   │      │   Location   │
              │   0x1A000    │      │   0x2B000    │
              │   "Hello"    │      │   "Howdy"    │
              └──────────────┘      └──────────────┘

Same virtual address (0x7ffc) maps to different physical locations!
            `,
            codeExample: {
                title: "Variables are independent after fork",
                language: "c",
                code: `#include <stdio.h>
#include <unistd.h>
#include <string.h>

int main(int argc, char *argv[]) {
    char str[128];
    strcpy(str, "Hello");
    printf("str's address is %p\\n", str);
    
    pid_t pidOrZero = fork();
    
    if (pidOrZero == 0) {
        // Child modifies str
        printf("I am the child. str's address is %p\\n", str);
        strcpy(str, "Howdy");
        printf("I am the child and I changed str to %s. "
               "str's address is still %p\\n", str, str);
    } else {
        // Parent sleeps, then checks str
        printf("I am the parent. str's address is %p\\n", str);
        printf("I am the parent, and I'm going to sleep for 2sec.\\n");
        sleep(2);
        printf("I am the parent. I just woke up. str's address is %p, "
               "and its value is %s\\n", str, str);
    }
    return 0;
}

// Output:
// str's address is 0x7ffc8cfa9990
// I am the parent. str's address is 0x7ffc8cfa9990
// I am the parent, and I'm going to sleep for 2sec.
// I am the child. str's address is 0x7ffc8cfa9990
// I am the child and I changed str to Howdy. str's address is still 0x7ffc8cfa9990
// I am the parent. I just woke up. str's address is 0x7ffc8cfa9990, and its value is Hello
//
// KEY INSIGHT: Same address, different values!
// Parent still has "Hello" even though child changed to "Howdy"`,
                annotations: [
                    { match: "0x7ffc8cfa9990", explanation: "Same virtual address in both processes, but maps to different physical memory." },
                    { match: "sleep(2)", explanation: "Parent sleeps to let child run first and modify the string." },
                    { match: "strcpy(str, \"Howdy\")", explanation: "Child modifies its copy of str. Parent's copy is unchanged!" },
                    { match: "str's address is still", explanation: "Virtual address is the same - only the physical memory backing differs." },
                    { match: "value is Hello", explanation: "Parent sees original value despite child's modification. Isolation works!" }
                ]
            }
        },
        {
            id: "copy-on-write",
            title: "Copy-On-Write Optimization",
            content: `Isn't it expensive to copy all memory when forking? The OS optimizes this with **copy-on-write** (COW): initially parent and child share the same physical memory. Only when one process modifies memory does the OS make a copy of that page. This makes fork() fast even for processes with lots of memory.`,
            keyPoints: [
                "Initially parent and child share physical memory",
                "OS marks pages as 'copy-on-write'",
                "When either writes to a page, OS makes a copy first",
                "Unmodified pages are never copied",
                "Makes fork() efficient for large processes",
                "Read-only sections (like code) are always shared"
            ],
            codeExample: {
                title: "Copy-on-write in action",
                language: "c",
                code: `// Copy-on-write conceptual example

// Before fork:
// Parent has a large array (e.g., 1GB of data)
int *big_array = malloc(1024 * 1024 * 1024);  // 1GB

pid_t pid = fork();
// At this moment, child "has" 1GB of data
// But NO physical memory was copied yet!
// Both point to the same physical pages

if (pid == 0) {
    // Child reads from big_array[0]
    // Still no copy needed - reading is fine
    int x = big_array[0];
    
    // Child writes to big_array[0]
    big_array[0] = 42;
    // NOW the OS copies just that one page (4KB typically)
    // The other 255,999+ pages stay shared
    
    // Child modifies another location
    big_array[1000000] = 99;
    // Another 4KB page is copied
    // Still sharing most of the 1GB!
}

// Parent's data is completely unchanged
// because child has its own copies of modified pages

// This is why fork() is fast even for huge processes!
// Without COW, fork() would need to copy 1GB instantly`,
                annotations: [
                    { match: "malloc(1024 * 1024 * 1024)", explanation: "1GB of memory allocated. Without COW, forking would need to copy all of this!" },
                    { match: "big_array[0] = 42;", explanation: "Only the modified pages get copied. Most of the 1GB remains shared." },
                    { match: "Still sharing most of the 1GB!", explanation: "COW only copies pages when written, so unmodified pages share physical memory." },
                    { match: "fork() is fast even for huge processes!", explanation: "COW makes fork() O(1) instead of O(memory size). Critical for performance!" }
                ]
            }
        },
        {
            id: "fork-in-helpers",
            title: "fork() In Helper Functions",
            content: `fork() can be called from any function, not just main(). When a helper function calls fork(), BOTH parent and child return from that function call. This is a common source of bugs if not handled carefully. You can use return values or exit() to control which process does what.`,
            keyPoints: [
                "fork() can be called from any function",
                "Both processes return from the helper function",
                "Code after the helper call runs in BOTH processes",
                "Use return values or exit() to differentiate behavior",
                "exit() immediately terminates a process (like returning from main)"
            ],
            codeExample: {
                title: "fork() in helper functions",
                language: "c",
                code: `#include <stdio.h>
#include <unistd.h>
#include <stdbool.h>
#include <stdlib.h>

// APPROACH 1: Return different values
bool spawnChildProcess() {
    pid_t pidOrZero = fork();
    if (pidOrZero == 0) {
        printf("I am the child\\n");
        return false;  // Child returns false
    } else {
        printf("I am the parent\\n");
        return true;   // Parent returns true
    }
}

int main(int argc, char *argv[]) {
    bool amParent = spawnChildProcess();
    
    if (amParent) {
        printf("This is printed once (by parent only)\\n");
    }
    // Without the if, "This is printed once" would print twice!
    return 0;
}

// APPROACH 2: Child exits in helper
void spawnAndDoWork() {
    pid_t pidOrZero = fork();
    if (pidOrZero == 0) {
        printf("I am the child, doing some work...\\n");
        // ... child does its thing ...
        exit(0);  // Child terminates here, never returns!
    } else {
        printf("I am the parent\\n");
        // Parent returns normally
    }
}

int main(int argc, char *argv[]) {
    spawnAndDoWork();
    printf("This is printed once (only parent gets here)\\n");
    return 0;
}`,
                annotations: [
                    { match: "spawnChildProcess()", explanation: "Helper function that calls fork internally. Both processes return from it!" },
                    { match: "exit(0)", explanation: "Child calls exit() to terminate after its work. Otherwise it would continue in main()." },
                    { match: "return true;", explanation: "Helper returns true to parent, false to child (but child exits before returning from the function)." },
                    { match: "printed once", explanation: "Only parent prints this because child called exit() inside the helper." }
                ]
            }
        },
        {
            id: "fork-applications",
            title: "Applications of fork()",
            content: `fork() is used pervasively in applications and systems. It's the fundamental mechanism for creating new processes in Unix-like systems. Understanding fork() is essential for systems programming.`,
            keyPoints: [
                "Shells fork to run every command you type",
                "Web servers fork to handle multiple clients simultaneously",
                "System startup: init/systemd forks all system services",
                "Database servers fork for client connections",
                "Build systems fork to compile in parallel",
                "Processes are the first step in understanding concurrency"
            ],
            codeExample: {
                title: "Real-world fork() patterns",
                language: "c",
                code: `// PATTERN 1: Simple web server (one process per client)
while (true) {
    int client_socket = accept(server_socket, ...);
    
    pid_t pid = fork();
    if (pid == 0) {
        // Child handles this client
        close(server_socket);  // Child doesn't need listen socket
        handle_client(client_socket);
        close(client_socket);
        exit(0);
    } else {
        // Parent continues accepting connections
        close(client_socket);  // Parent doesn't handle this client
    }
}

// PATTERN 2: Parallel task execution
#define NUM_WORKERS 4

for (int i = 0; i < NUM_WORKERS; i++) {
    pid_t pid = fork();
    if (pid == 0) {
        // Child does work on partition i
        do_work(i);
        exit(0);
    }
    // Parent continues forking more workers
}
// Parent waits for all children (covered next lecture)

// PATTERN 3: Pipeline (like shell pipes: cmd1 | cmd2)
// Fork once for each stage of the pipeline
// Connect them with pipes (covered in later lectures)`,
                annotations: [
                    { match: "accept(server_socket", explanation: "Web server pattern: accept blocks waiting for a new client connection." },
                    { match: "close(server_socket)", explanation: "Child closes listen socket - only parent should accept new connections." },
                    { match: "close(client_socket)", explanation: "Parent closes client socket - only child handles this specific client." },
                    { match: "Fork before parallel work", explanation: "Build systems fork to compile multiple files simultaneously." },
                    { match: "Pipeline", explanation: "Shell pipes (cmd1 | cmd2) use multiple forks, connecting processes with pipes." }
                ]
            }
        },
        {
            id: "preview-next",
            title: "Coming Next: waitpid and execvp",
            content: `We've learned how to create child processes with fork(), but two key questions remain: How does the parent wait until the child finishes? And how does the child run a different program than the parent? Next lecture covers **waitpid()** for waiting on children and **execvp()** for running other programs.`,
            keyPoints: [
                "waitpid(): makes parent block until child terminates",
                "execvp(): replaces current process with a new program",
                "Together with fork(), these complete the shell pattern",
                "waitpid also retrieves child's exit status",
                "execvp is how shell runs 'ls', 'cat', 'gcc', etc."
            ],
            diagram: `
Shell Implementation:

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  while (true) {                                                 │
│      char *user_command = ... // get user input                 │
│                                                                 │
│      pid_t pidOrZero = fork();                                  │
│      if (pidOrZero == 0) {                                      │
│          // Child: run user's command                           │
│          execvp(user_command, args);  ◄── Lecture 9             │
│          // If execvp returns, it failed!                       │
│      }                                                          │
│                                                                 │
│      // Parent: wait for child to finish                        │
│      waitpid(pidOrZero, &status, 0);  ◄── Lecture 9             │
│                                                                 │
│      // Child is done, prompt user again                        │
│  }                                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
            `,
            codeExample: {
                title: "Preview of complete shell loop",
                language: "c",
                code: `// Complete shell structure (waitpid and execvp covered next lecture)

#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>
#include <string.h>

int main() {
    while (true) {
        printf("mysh> ");
        
        // Get user input (simplified - real shells parse more carefully)
        char command[256];
        fgets(command, sizeof(command), stdin);
        command[strlen(command) - 1] = '\\0';  // Remove newline
        
        pid_t pid = fork();
        
        if (pid == 0) {
            // CHILD: Replace myself with user's program
            char *args[] = {command, NULL};
            execvp(command, args);
            
            // If we get here, execvp failed
            perror("execvp");
            exit(1);
        }
        
        // PARENT: Wait for child to finish
        int status;
        waitpid(pid, &status, 0);
            printf("Child exited with status: %d\\n", WEXITSTATUS(status));
        // Loop continues, shell prompts again
    }
    return 0;
}`
                ,
                annotations: [
                    { match: "execvp(command, args)", explanation: "Replaces child process with new program. Covered in detail in Lecture 9." },
                    { match: "perror(\"execvp\")", explanation: "Only reached if execvp fails - otherwise child is replaced entirely." },
                    { match: "waitpid(pid, &status, 0)", explanation: "Parent blocks until child terminates. Retrieves child's exit status." },
                    { match: "WEXITSTATUS(status)", explanation: "Macro to extract the child's exit code from the status value." },
                    { match: "Loop continues", explanation: "After child finishes, shell prompts for next command - the shell pattern!" }
                ]
            }
        },
        {
            id: "summary",
            title: "Lecture 8 Summary",
            content: `This lecture introduced multiprocessing and the fork() system call. We learned how processes are created, how they relate to programs, and how fork() clones a process. Understanding fork() is the foundation for building shells, servers, and understanding concurrent systems.`,
            keyPoints: [
                "Program = code; Process = running instance of program + state",
                "fork() creates a child process that is a clone of the parent",
                "Child continues from instruction after fork(); parent does too",
                "fork() returns child PID in parent, 0 in child",
                "Order of execution between parent/child is non-deterministic",
                "Virtual memory keeps parent and child data separate (same addresses, different physical memory)",
                "Copy-on-write makes fork() efficient"
            ],
            codeExample: {
                title: "Key fork() pattern",
                language: "c",
                code: `#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>

int main() {
    printf("Before fork: PID %d\\n", getpid());
    
    pid_t pid = fork();
    
    if (pid < 0) {
        // ERROR: fork failed
        perror("fork");
        exit(1);
    }
    
    if (pid == 0) {
        // CHILD PROCESS
        printf("Child: my PID is %d, parent is %d\\n", 
               getpid(), getppid());
        // Do child-specific work here
        exit(0);  // Child exits
    }
    
    // PARENT PROCESS (pid > 0)
    printf("Parent: my PID is %d, child is %d\\n", 
           getpid(), pid);
    // Do parent-specific work here
    
    return 0;
}

// Remember:
// - fork() returns TWICE (once in each process)
// - Check for errors (pid < 0)
// - pid == 0 means you're the child
// - pid > 0 means you're the parent, and pid is child's PID`
            }
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "fork() Output Prediction",
            difficulty: "easy",
            description: "Predict the number of times 'Hello' is printed in this program. Draw the process tree.",
            hint: "Each fork() doubles the number of processes. Count how many processes exist when the printf is executed.",
            starterCode: `#include <stdio.h>
#include <unistd.h>

int main() {
    fork();
    fork();
    printf("Hello\\n");
    return 0;
}

// How many times is "Hello" printed?
// Answer: ____

// Draw the process tree:
// (hint: label each process and show which fork created it)`,
            solution: `#include <stdio.h>
#include <unistd.h>

int main() {
    fork();   // First fork: 1 process becomes 2
    fork();   // Second fork: 2 processes become 4
    printf("Hello\\n");  // All 4 processes print
    return 0;
}

// Answer: 4 times

// Process tree:
//     P (original)
//     ├── fork() #1
//     │   └── C1 (child of P)
//     │       ├── fork() #2
//     │       │   └── C3 (child of C1)
//     │       └── C1 prints "Hello"
//     │   C3 prints "Hello"
//     └── P continues
//         ├── fork() #2  
//         │   └── C2 (child of P)
//         └── P prints "Hello"
//     C2 prints "Hello"
//
// All 4 processes (P, C1, C2, C3) reach and execute the printf`,
            explanation: "With 2 fork() calls, we get 2^2 = 4 processes. Each process executes the printf, so 'Hello' is printed 4 times."
        },
        {
            id: "ex2",
            title: "Parent vs Child Identification",
            difficulty: "easy",
            description: "Complete the code to have ONLY the parent process print 'I am the parent!' and ONLY the child process print 'I am the child!'",
            hint: "Check the return value of fork(). Parent gets child's PID (> 0), child gets 0.",
            starterCode: `#include <stdio.h>
#include <unistd.h>

int main() {
    pid_t result = fork();
    
    // Fill in the conditions:
    if (____) {
        printf("I am the parent!\\n");
    }
    
    if (____) {
        printf("I am the child!\\n");
    }
    
    return 0;
}`,
            solution: `#include <stdio.h>
#include <unistd.h>

int main() {
    pid_t result = fork();
    
    if (result < 0) {
        perror("fork failed");
        return 1;
    }
    
    if (result > 0) {  // Parent gets child's PID
        printf("I am the parent!\\n");
    }
    
    if (result == 0) {  // Child gets 0
        printf("I am the child!\\n");
    }
    
    return 0;
}

// Alternative using if-else:
if (result == 0) {
    printf("I am the child!\\n");
} else {
    printf("I am the parent!\\n");
}`,
            explanation: "fork() returns the child's PID (a positive number) in the parent, and 0 in the child. By checking result > 0 or result == 0, we can determine which process we're in."
        },
        {
            id: "ex3",
            title: "Counting Processes",
            difficulty: "medium",
            description: "How many processes exist at the end of this program? How many times is each letter printed?",
            hint: "Trace through carefully. The if-statement prevents some processes from reaching certain fork() calls.",
            starterCode: `#include <stdio.h>
#include <unistd.h>

int main() {
    printf("A\\n");
    
    pid_t pid = fork();
    
    printf("B\\n");
    
    if (pid == 0) {
        fork();
        printf("C\\n");
    }
    
    printf("D\\n");
    
    return 0;
}

// Questions:
// 1. How many total processes? ____
// 2. How many times is 'A' printed? ____
// 3. How many times is 'B' printed? ____
// 4. How many times is 'C' printed? ____
// 5. How many times is 'D' printed? ____`,
            solution: `// Trace:
// P: prints A
// P: fork() -> creates C1
// P: prints B, pid > 0 so skips the if-block, prints D, exits
// C1: prints B
// C1: pid == 0, so enters if-block
// C1: fork() -> creates C2
// C1: prints C, prints D, exits
// C2: prints C, prints D, exits

// Answers:
// 1. Total processes: 3 (P, C1, C2)
// 2. 'A' printed: 1 time (only original process, before any fork)
// 3. 'B' printed: 2 times (P and C1)
// 4. 'C' printed: 2 times (C1 and C2)
// 5. 'D' printed: 3 times (all 3 processes)

// Process tree:
//     P (original)
//     ├── prints A
//     ├── fork() creates C1
//     ├── prints B
//     ├── pid > 0, skips if-block
//     ├── prints D
//     │
//     └── C1
//         ├── prints B
//         ├── pid == 0, enters if-block
//         ├── fork() creates C2
//         │       └── C2:
//         │           ├── prints C
//         │           └── prints D
//         ├── prints C
//         └── prints D`,
            explanation: "The key insight is that only the child (where pid == 0) executes the second fork(). The parent skips it. So we have 3 processes, not 4. The conditional fork() is a common pattern."
        },
        {
            id: "ex4",
            title: "Variable Independence",
            difficulty: "medium",
            description: "What values does the parent print? What values does the child print? Explain why.",
            hint: "After fork(), parent and child have independent copies of all variables.",
            starterCode: `#include <stdio.h>
#include <unistd.h>

int main() {
    int x = 5;
    int y = 10;
    
    pid_t pid = fork();
    
    if (pid == 0) {
        // Child
        x = x + 100;
        y = y * 2;
        printf("Child: x = %d, y = %d\\n", x, y);
    } else {
        // Parent
        sleep(1);  // Wait for child to modify its copies
        printf("Parent: x = %d, y = %d\\n", x, y);
    }
    
    return 0;
}

// Predict the output:
// Child:  x = ____, y = ____
// Parent: x = ____, y = ____`,
            solution: `// Output:
// Child: x = 105, y = 20
// Parent: x = 5, y = 10

// Explanation:
// When fork() is called, the child gets COPIES of all variables.
// At the moment of fork:
//   - Both have x = 5, y = 10
// 
// Child modifies its copies:
//   - x becomes 5 + 100 = 105
//   - y becomes 10 * 2 = 20
//
// Parent's copies are UNCHANGED:
//   - x is still 5
//   - y is still 10
//
// This is because:
// 1. Virtual memory gives each process its own address space
// 2. Same virtual addresses map to different physical memory
// 3. Modifications in one process don't affect the other

// Common misconception: "The parent sleeps so child modifies first,
// then parent should see the changes." WRONG! They have separate memory.`,
            explanation: "After fork(), parent and child have completely independent copies of all variables. The child modifying its x and y has no effect on the parent's x and y. Virtual memory ensures this isolation."
        },
        {
            id: "ex5",
            title: "fork() in a loop",
            difficulty: "hard",
            description: "Analyze this code carefully. How many processes exist at the end? How many times is 'Done' printed?",
            hint: "Each iteration of the loop doubles processes, but only for those that haven't exited. Trace carefully.",
            starterCode: `#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>

int main() {
    for (int i = 0; i < 3; i++) {
        pid_t pid = fork();
        
        if (pid == 0) {
            // Child: print message and EXIT
            printf("Child created at i=%d\\n", i);
            exit(0);  // <-- Child exits here!
        }
        // Parent continues looping
    }
    
    printf("Done\\n");
    return 0;
}

// Questions:
// 1. How many times is "Child created at i=..." printed? ____
// 2. How many times is "Done" printed? ____
// 3. Total processes created (including original)? ____`,
            solution: `// Trace:
// P (original): loop i=0
//   P: fork() -> creates C0
//   C0: prints "Child created at i=0", exits
//   P: continues to i=1
//   
// P: loop i=1  
//   P: fork() -> creates C1
//   C1: prints "Child created at i=1", exits
//   P: continues to i=2
//
// P: loop i=2
//   P: fork() -> creates C2
//   C2: prints "Child created at i=2", exits
//   P: loop ends
//
// P: prints "Done", exits

// Answers:
// 1. "Child created..." printed: 3 times (C0, C1, C2)
// 2. "Done" printed: 1 time (only original parent)
// 3. Total processes: 4 (P, C0, C1, C2)

// Key insight: exit() prevents children from continuing the loop!
// Without exit(), each child would also fork on subsequent iterations.

// Compare to WITHOUT exit():
for (int i = 0; i < 3; i++) {
    fork();
}
// This creates 2^3 = 8 processes!

// With exit() after each child fork:
// - Only the original parent loops all 3 times
// - Each child exits immediately
// - Result: 1 + 3 = 4 processes (original + 3 children)`,
            explanation: "The key is that exit() stops children from continuing the loop. Only the original parent executes all 3 iterations. Each iteration creates exactly one child that immediately exits. So: 3 children print, 1 parent prints 'Done', 4 total processes."
        },
        {
            id: "ex6",
            title: "Building a Process Tree",
            difficulty: "hard",
            description: "Write code that creates exactly this process tree: P -> C1 -> C1.1 and P -> C2. That is, the original process P has two children C1 and C2, and C1 has one child C1.1.",
            hint: "You need two fork() calls, but the second one should only be executed by C1, not by P or C2.",
            starterCode: `#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>

// Create this tree:
//     P (original)
//     ├── C1
//     │   └── C1.1
//     └── C2

int main() {
    printf("P: I am the original process (pid %d)\\n", getpid());
    
    // YOUR CODE HERE
    // Hint: You need to track which process you are
    //       and only let C1 fork again
    
    return 0;
}`,
            solution: `#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>

int main() {
    printf("P: I am the original process (pid %d)\\n", getpid());
    
    // First fork: creates C1
    pid_t pid1 = fork();
    
    if (pid1 == 0) {
        // This is C1
        printf("C1: I am child 1 (pid %d, parent %d)\\n", 
               getpid(), getppid());
        
        // C1 forks to create C1.1
        pid_t pid_grandchild = fork();
        
        if (pid_grandchild == 0) {
            // This is C1.1
            printf("C1.1: I am grandchild (pid %d, parent %d)\\n", 
                   getpid(), getppid());
            exit(0);
        }
        // C1 continues here
        exit(0);
    }
    
    // Only P gets here
    // Second fork: creates C2
    pid_t pid2 = fork();
    
    if (pid2 == 0) {
        // This is C2
        printf("C2: I am child 2 (pid %d, parent %d)\\n", 
               getpid(), getppid());
        exit(0);
    }
    
    // Only P gets here
    printf("P: I created children C1 (pid %d) and C2 (pid %d)\\n", 
           pid1, pid2);
    
    return 0;
}

// Process tree created:
//     P (original)  ─── parent of ──┬─── C1 (first child)
//                                   │     │
//                                   │     └── parent of ── C1.1 (grandchild)
//                                   │
//                                   └─── C2 (second child)`,
            explanation: "The key is the placement of the second fork. C1 exits after creating C1.1, preventing it from reaching P's second fork. P's second fork creates C2. This carefully constructs the desired tree."
        },
        {
            id: "ex7",
            title: "Simulating File Descriptor Inheritance",
            difficulty: "medium",
            description: "Write a program where the parent opens a file, forks, and both parent and child write to the same file. What happens?",
            hint: "File descriptors are copied during fork(). Both processes share the underlying file description (including file position).",
            starterCode: `#include <stdio.h>
#include <unistd.h>
#include <fcntl.h>
#include <string.h>

int main() {
    // Open file for writing
    int fd = open("test.txt", O_WRONLY | O_CREAT | O_TRUNC, 0644);
    
    pid_t pid = fork();
    
    if (pid == 0) {
        // Child writes
        const char *child_msg = "Hello from child!\\n";
        write(fd, child_msg, strlen(child_msg));
    } else {
        // Parent writes
        const char *parent_msg = "Hello from parent!\\n";
        write(fd, parent_msg, strlen(parent_msg));
    }
    
    close(fd);
    return 0;
}

// Questions:
// 1. Will both messages appear in the file? ____
// 2. Will they overwrite each other? ____
// 3. What order might they appear? ____`,
            solution: `// Answers:
// 1. Yes, both messages will appear
// 2. No, they won't overwrite each other
// 3. Either order is possible, or even interleaved

// Explanation:
// When fork() copies the file descriptor table:
// - Both parent and child have fd pointing to the same file
// - They share the same "file description" in the kernel
// - This includes the file position (offset)
// - Each write advances the shared position
// - So writes don't overwrite each other

// Possible outputs in test.txt:
// Option A:
//   Hello from parent!
//   Hello from child!
//
// Option B:
//   Hello from child!
//   Hello from parent!
//
// Option C (less likely but possible with small writes):
//   Hello from Hello from parent!
//   child!

// Key insight: This is DIFFERENT from two separate open() calls!
// If parent and child each opened the file independently,
// they would have separate file positions and WOULD overwrite.

// Example of independent opens (would overwrite):
pid_t pid = fork();
int fd = open("test.txt", O_WRONLY | O_CREAT | O_TRUNC, 0644);
// Now each has its own file description, both start at position 0
// Whoever writes second will overwrite!`,
            explanation: "After fork(), parent and child share the same kernel 'file description' (not to be confused with file descriptors). The shared file position means their writes append to each other rather than overwriting."
        },
        {
            id: "ex8",
            title: "Implementing a Simple Worker Pool",
            difficulty: "hard",
            description: "Write a program that creates N worker processes. Each worker should print its worker ID (0 to N-1) and exit. The parent should just create the workers.",
            hint: "Pass information to children via variables set before fork(). Use a loop and track which worker ID to assign.",
            starterCode: `#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>

#define NUM_WORKERS 4

int main() {
    printf("Parent (pid %d) creating %d workers...\\n", 
           getpid(), NUM_WORKERS);
    
    // YOUR CODE HERE
    // Create NUM_WORKERS child processes
    // Each child should:
    //   - Print "Worker X: my pid is Y"
    //   - Exit with status X (the worker ID)
    
    // Parent should:
    //   - Not print "Worker..." messages
    //   - Print "All workers created" at the end
    
    return 0;
}

// Expected output (order may vary for worker lines):
// Parent (pid 12345) creating 4 workers...
// Worker 0: my pid is 12346
// Worker 1: my pid is 12347
// Worker 2: my pid is 12348
// Worker 3: my pid is 12349
// All workers created`,
            solution: `#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>

#define NUM_WORKERS 4

int main() {
    printf("Parent (pid %d) creating %d workers...\\n", 
           getpid(), NUM_WORKERS);
    
    for (int i = 0; i < NUM_WORKERS; i++) {
        pid_t pid = fork();
        
        if (pid < 0) {
            perror("fork failed");
            exit(1);
        }
        
        if (pid == 0) {
            // Child process - this is worker i
            printf("Worker %d: my pid is %d\\n", i, getpid());
            exit(i);  // Exit with worker ID as status
        }
        
        // Parent continues to next iteration
    }
    
    // Only parent reaches here
    printf("All workers created\\n");
    
    // Note: In a real program, parent would waitpid() for all children
    // We'll learn that in the next lecture!
    
    return 0;
}

// Key insight: Each child is created with a different value of 'i'
// The child "inherits" the current value of i when fork() is called
// Child 0 is created when i=0, child 1 when i=1, etc.

// Alternative with explicit worker_id variable:
for (int i = 0; i < NUM_WORKERS; i++) {
    int worker_id = i;  // Set before fork
    pid_t pid = fork();
    
    if (pid == 0) {
        // Child has its own copy of worker_id
        printf("Worker %d: my pid is %d\\n", worker_id, getpid());
        exit(worker_id);
    }
}`,
            explanation: "The loop index i serves as the worker ID. Each child is forked when i has a different value, so each child has a unique ID. The parent continues looping; children exit after printing. This is a common pattern for process pools."
        }
    ],

    practiceProblems: [
        {
            id: "pp1",
            title: "Process Hierarchy Visualization",
            description: "Given a program with multiple fork() calls, draw the process tree and predict output order possibilities.",
            example: `// Draw the process tree for:
int main() {
    printf("A");
    fork();
    printf("B");
    fork();
    printf("C");
    fork();
    printf("D");
    return 0;
}

// Process tree (8 total processes):
//        P
//      / |
//    P   C1
//   /|   /|
//  P C2 C1 C3
// /| |||/| ||
// ... (continues)

// Possible outputs: Any interleaving where each process
// prints A(if applicable), B, C, D in that order.
// 'A' appears 1 time (before first fork)
// 'B' appears 2 times
// 'C' appears 4 times  
// 'D' appears 8 times`
        },
        {
            id: "pp2",
            title: "Debugging fork() Issues",
            description: "Identify and fix common fork() bugs in the given code snippets.",
            example: `// BUG 1: Forgetting that child also continues after if-block
pid_t pid = fork();
if (pid == 0) {
    printf("Child doing work\\n");
    // BUG: Child doesn't exit, falls through!
}
printf("This is the parent\\n");  // WRONG: Child also prints this!

// FIX: Add exit() or return
if (pid == 0) {
    printf("Child doing work\\n");
    exit(0);  // or return 0;
}

// BUG 2: Not checking for fork() failure
pid_t pid = fork();
if (pid == 0) { ... }  // What if fork() returned -1?

// FIX: Always check for errors
pid_t pid = fork();
if (pid < 0) {
    perror("fork");
    exit(1);
}
if (pid == 0) { ... }`
        },
        {
            id: "pp3",
            title: "File Handling with fork()",
            description: "Understand how file descriptors are shared between parent and child after fork().",
            example: `// Scenario: Parent opens file, forks, both read from it
int fd = open("data.txt", O_RDONLY);
// File contains: "ABCDEFGHIJ"

pid_t pid = fork();

char buf[5];
read(fd, buf, 5);  // Each process reads 5 bytes
buf[4] = '\\0';
printf("Process %d read: %s\\n", getpid(), buf);

// What does each process read?
// They share the file position! So:
// - First reader (could be parent or child) gets "ABCDE"
// - Second reader gets "FGHIJ"
// - They don't both get "ABCDE" because position is shared!`
        }
    ]
};

export default lecture8;
