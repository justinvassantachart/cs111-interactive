export const lecture12 = {
    id: 12,
    title: "Multithreading Introduction",
    subtitle: "Threads, Concurrency, and Race Conditions",
    keyTakeaway: "A process can have multiple threads executing tasks simultaneously. Threads share the same virtual address space, which makes data sharing easy but introduces race conditions that can cause unintended problems.",

    sections: [
        {
            id: "topic-overview",
            title: "Topic 3: Multithreading",
            content: `Multithreading allows us to have concurrency within a single process. How does the operating system support this?`,
            keyPoints: [
                "Helps us understand how a single process can do multiple things at the same time",
                "Provides insight into race conditions and how to fix them (next few lectures)",
                "Allows us to see how the OS schedules and switches between tasks",
                "assign4: implement several multithreaded programs while eliminating race conditions"
            ],
            diagram: `
Topic 3: Multithreading Roadmap:

┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Lecture 12   │ →  │  Lecture 13   │ →  │  Lecture 14   │ →  │  Lecture 15   │
│               │    │               │    │               │    │               │
│ Multithreading│    │ Race Conditions│   │ Locks and     │    │ Multithreading│
│ Introduction  │    │ and Locks     │    │ Condition Vars│    │ Patterns      │
│               │    │               │    │               │    │               │
│  (This one!)  │    │  (Next)       │    │               │    │               │
└───────────────┴────┴───────────────┴────┴───────────────┴────┴───────────────┘
            `
        },
        {
            id: "from-processes-to-threads",
            title: "From Processes to Threads",
            content: `Multiprocessing has allowed us to spawn other processes to do tasks or run programs. It's powerful but has limitations. Is there another way we can have concurrency beyond multiprocessing that handles tradeoffs differently?`,
            keyPoints: [
                "Processes are powerful: can execute/wait on other programs, secure (separate memory space), communicate with pipes and signals",
                "But processes are limited: interprocess communication is cumbersome, hard to share data/coordinate",
                "Threads provide an alternative: independent execution sequences within a single process",
                "Threads let us run multiple functions in our program concurrently",
                "Multithreading is common to parallelize tasks, especially on multiple cores"
            ],
            diagram: `
Processes vs Threads:

MULTIPROCESSING:                          MULTITHREADING:
┌──────────────────┐                     ┌──────────────────────────────┐
│    Process A     │                     │         Single Process       │
│   ┌──────────┐   │                     │  ┌────────┐ ┌────────┐      │
│   │ Code     │   │                     │  │Thread 1│ │Thread 2│ ...  │
│   │ Stack    │   │                     │  └───┬────┘ └───┬────┘      │
│   │ Heap     │   │                     │      │          │           │
│   └──────────┘   │                     │      └────┬─────┘           │
└────────┬─────────┘                     │           ▼                 │
         │                               │  ┌─────────────────────┐    │
         X (separate memory!)            │  │  SHARED Memory!     │    │
         │                               │  │  (globals, heap,    │    │
┌────────┴─────────┐                     │  │   pass by reference)│    │
│    Process B     │                     │  └─────────────────────┘    │
│   ┌──────────┐   │                     └──────────────────────────────┘
│   │ Code     │   │
│   │ Stack    │   │
│   │ Heap     │   │
│   └──────────┘   │
└──────────────────┘
            `
        },
        {
            id: "threads-vs-processes",
            title: "Threads vs. Processes",
            content: `Understanding the tradeoffs between threads and processes is key to choosing the right concurrency model for your program.`,
            keyPoints: [
                "Processes isolate virtual address spaces (good: security and stability, bad: harder to share info)",
                "Processes can run external programs easily (fork-exec)",
                "Processes make it harder to coordinate multiple tasks within the same program",
                "Threads share virtual address space (bad: security and stability, good: easier to share info)",
                "Threads can't run external programs easily",
                "Threads make it easier to coordinate multiple tasks within the same program"
            ],
            advantages: [
                "Lighter weight creation than processes",
                "Easier data sharing between concurrent tasks",
                "No need for pipes or IPC mechanisms",
                "Better performance for in-process parallelism"
            ],
            disadvantages: [
                "Shared memory can lead to race conditions",
                "One thread crashing can crash the entire process",
                "Can't isolate or sandbox different tasks",
                "More complex synchronization required"
            ]
        },
        {
            id: "threads-real-world",
            title: "Threads in the Real World",
            content: `Threads are a much more common approach to doing tasks in parallel on a system because of easier data sharing and lighter weight creation. Many modern software programs use multithreading.`,
            keyPoints: [
                "Mobile apps spawn background threads to download web resources while another thread handles user input (taps, swipes)",
                "Web servers spawn threads to handle incoming requests in parallel",
                "Your computer's task manager can show you how many threads a process is using",
                "In the OS, threads are actually the unit of concurrency, not processes",
                "Every process has at least 1 thread"
            ]
        },
        {
            id: "cpp-thread-basics",
            title: "C++ Thread Basics",
            content: `In C++, spawn a thread using thread() and the thread variable type. Specify what function you want the thread to execute, optionally passing parameters.`,
            keyPoints: [
                "thread myThread(myFunc, arg1, arg2, ...);",
                "myFunc: the function the thread should execute asynchronously",
                "args: a list of arguments (any length, or none) to pass to the function",
                "myFunc's return value is ignored (use pass by reference instead)",
                "Once initialized with this constructor, the thread may execute at any time!"
            ],
            codeExample: {
                title: "Creating and waiting on a thread",
                language: "cpp",
                code: `#include <thread>
using namespace std;

void myFunc(int arg1, string arg2) {
    // Do some work...
    cout << "Thread got: " << arg1 << ", " << arg2 << endl;
}

int main() {
    // Create a thread that runs myFunc with arguments
    thread myThread(myFunc, 42, "hello");
    
    // Wait for thread to finish (blocks)
    myThread.join();
    
    return 0;
}`,
                annotations: [
                    { match: "thread myThread(myFunc, 42, \"hello\")", explanation: "Creates and starts a thread running myFunc with the given arguments." },
                    { match: "myThread.join()", explanation: "Blocks until the thread finishes. MUST call join() before thread goes out of scope!" }
                ]
            }
        },
        {
            id: "thread-arrays",
            title: "Arrays of Threads",
            content: `To wait on a thread to finish, use the .join() method. For multiple threads, we must wait on each thread one at a time.`,
            keyPoints: [
                "Declare an array of empty thread handles: thread friends[5];",
                "Spawn threads in a loop, assigning to each array element",
                "Wait for all threads by looping and calling join() on each",
                "Can also use range-based for loop with reference: for (thread& t : friends)"
            ],
            codeExample: {
                title: "Creating an array of threads",
                language: "cpp",
                code: `// Method 1: Index-based loop
thread friends[5];

// Spawn threads
for (size_t i = 0; i < 5; i++) {
    friends[i] = thread(myFunc, arg1, arg2);
}

// Wait for all threads
for (size_t i = 0; i < 5; i++) {
    friends[i].join();
}

// Method 2: Range-based for loop (note the reference!)
thread workers[5];
for (thread& currWorker : workers) {
    currWorker = thread(myFunc, arg1, arg2);
}
for (thread& currWorker : workers) {
    currWorker.join();
}`,
                annotations: [
                    { match: "thread friends[5]", explanation: "Declares array of empty thread handles (not yet running)." },
                    { match: "friends[i] = thread(myFunc, arg1, arg2)", explanation: "Creates and assigns a running thread to the array slot." },
                    { match: "thread& currWorker", explanation: "MUST use reference! Otherwise you'd try to copy the thread object." }
                ]
            }
        },
        {
            id: "first-program",
            title: "Our First Threads Program: Greeting Friends",
            content: `Let's write a simple program that spawns multiple threads, each printing a greeting message. This demonstrates the basic thread lifecycle.`,
            codeExample: {
                title: "friends.cc - Multiple threads greeting",
                language: "cpp",
                code: `#include <iostream>
#include <thread>
#include "ostreamlock.h"  // CS111 custom stream locking
using namespace std;

static const size_t kNumFriends = 6;

static void greeting(size_t i) {
    cout << oslock << "Hello, world! I am thread " << i << endl << osunlock;
}

int main(int argc, char *argv[]) {
    cout << "Let's hear from " << kNumFriends << " threads." << endl;
    
    // Declare array of empty thread handles
    thread friends[kNumFriends];
    
    // Spawn threads
    for (size_t i = 0; i < kNumFriends; i++) {
        friends[i] = thread(greeting, i);
    }
    
    // Wait for threads
    for (size_t i = 0; i < kNumFriends; i++) {
        friends[i].join();
    }
    
    cout << "Everyone's said hello!" << endl;
    return 0;
}`,
                annotations: [
                    { match: "thread friends[kNumFriends]", explanation: "Array of 6 thread handles, initially empty." },
                    { match: "thread(greeting, i)", explanation: "Creates a thread that calls greeting(i). Thread starts immediately!" },
                    { match: "friends[i].join()", explanation: "Wait for thread i to complete before moving on." },
                    { match: "oslock", explanation: "CS111 custom stream lock - prevents output interleaving (explained later)." }
                ]
            }
        },
        {
            id: "threads-vs-functions",
            title: "Threads vs. Helper Functions",
            content: `What's the difference between spawning threads to run a function vs. just calling the function in a loop without threads?`,
            keyPoints: [
                "Without threads: calls are sequential - one finishes before next starts",
                "With threads: calls are parallel - all can run at the same time",
                "Threads leverage multiple CPU cores for true parallelism",
                "Order of execution is unpredictable with threads"
            ],
            codeExample: {
                title: "Sequential vs Parallel execution",
                language: "cpp",
                code: `// SEQUENTIAL: Each call finishes before the next starts
for (size_t i = 0; i < kNumFriends; i++) {
    greeting(i);  // Runs greeting(0), then greeting(1), then greeting(2)...
}

// PARALLEL: All threads can run at the same time
for (size_t i = 0; i < kNumFriends; i++) {
    friends[i] = thread(greeting, i);  // All start immediately!
}
// Threads 0-5 are ALL running now, potentially simultaneously

// Output with sequential: Always 0, 1, 2, 3, 4, 5
// Output with threads: Could be 0, 2, 1, 4, 3, 5 (any order!)`,
                annotations: [
                    { match: "greeting(i)", explanation: "Direct function call - blocks until greeting() returns." },
                    { match: "thread(greeting, i)", explanation: "Spawns thread and continues immediately - doesn't wait for greeting() to finish." }
                ]
            }
        },
        {
            id: "race-conditions-intro",
            title: "Race Conditions",
            content: `Threads can execute in unpredictable orderings. A race condition is an ordering of events that causes undesired behavior.`,
            keyPoints: [
                "Threads run in unpredictable order",
                "A race condition is when thread ordering causes bugs",
                "A thread-safe function executes correctly even when called concurrently",
                "operator<< is NOT thread safe - cout statements can get interleaved!",
                "Use oslock/osunlock (custom CS111 functions) to protect stream output"
            ],
            codeExample: {
                title: "Thread-safe output with oslock/osunlock",
                language: "cpp",
                code: `#include "ostreamlock.h"  // #include needed for oslock/osunlock

// BAD: Output can be interleaved between threads!
void badGreeting(size_t i) {
    cout << "Hello, world! I am thread " << i << endl;
}
// Possible output: "Hello, Hello, world! I am thread world! I am thread 01"

// GOOD: oslock ensures atomic output
void goodGreeting(size_t i) {
    cout << oslock << "Hello, world! I am thread " << i << endl << osunlock;
}
// Output: "Hello, world! I am thread 0"
//         "Hello, world! I am thread 1"
// (Order may vary, but each line is complete)`,
                annotations: [
                    { match: "oslock", explanation: "Locks the stream so no other thread can write until osunlock." },
                    { match: "osunlock", explanation: "Releases the stream lock so other threads can write." },
                    { match: "interleaved", explanation: "Without locking, two threads can print at same time, mixing their output!" }
                ]
            }
        },
        {
            id: "threads-share-memory",
            title: "Threads Share Memory",
            content: `Unlike parent/child processes, threads execute in the same virtual address space. This means we can pass parameters by reference and have all threads access/modify them!`,
            keyPoints: [
                "Threads share: globals, heap, pass-by-reference parameters",
                "Each thread has its own 'ministack' for local variables",
                "To pass by reference with thread(), use ref() around reference parameters",
                "Shared memory is powerful but dangerous - can cause race conditions",
                "Changes by one thread are visible to all other threads"
            ],
            codeExample: {
                title: "friends-ref.cc - Danger of shared memory",
                language: "cpp",
                code: `#include <iostream>
#include <thread>
#include "ostreamlock.h"
using namespace std;

static const size_t kNumFriends = 6;

// Note: parameter is a REFERENCE
static void greeting(size_t& i) {
    cout << oslock << "Hello, world! I am thread " << i << endl << osunlock;
}

int main(int argc, char *argv[]) {
    cout << "Let's hear from " << kNumFriends << " threads." << endl;
    thread friends[kNumFriends];
    
    // Spawn threads with ref(i)
    for (size_t i = 0; i < kNumFriends; i++) {
        friends[i] = thread(greeting, ref(i));  // Pass i by reference
    }
    
    // Wait for threads
    for (size_t i = 0; i < kNumFriends; i++) {
        friends[i].join();
    }
    
    cout << "Everyone's said hello!" << endl;
    return 0;
}

// PROBLEM: All threads reference the SAME i variable!
// By the time threads run, i may already be 6!
// Possible output: "thread 6", "thread 6", "thread 6"... (all 6!)`,
                annotations: [
                    { match: "size_t& i", explanation: "Reference parameter - all threads access the SAME variable!" },
                    { match: "ref(i)", explanation: "Required to pass reference to thread. Without ref(), it would copy." },
                    { match: "i may already be 6", explanation: "The for loop increments i faster than threads start. Race condition!" }
                ]
            }
        },
        {
            id: "ticket-selling-example",
            title: "Example: Selling Tickets",
            content: `Threads allow a process to parallelize a program across multiple cores. Consider a scenario where we want to sell 250 tickets using 10 threads.`,
            keyPoints: [
                "Simulation: let each thread help sell tickets until none are left",
                "All threads share the remainingTickets counter",
                "Threads check if tickets remain, then 'sell' one",
                "This seems straightforward but has a serious bug!"
            ],
            codeExample: {
                title: "confused-ticket-agents.cc",
                language: "cpp",
                code: `#include <thread>
#include <iostream>
#include "ostreamlock.h"
#include "thread-utils.h"  // for sleep_for
using namespace std;

const size_t kNumTicketAgents = 10;

static void sellTickets(size_t id, size_t& remainingTickets) {
    while (remainingTickets > 0) {
        sleep_for(500);  // simulate "selling a ticket"
        remainingTickets--;
        cout << oslock << "Thread #" << id << " sold a ticket ("
             << remainingTickets << " remain)." << endl << osunlock;
    }
    cout << oslock << "Thread #" << id
         << " sees no remaining tickets to sell and exits." << endl << osunlock;
}

int main(int argc, const char *argv[]) {
    thread ticketAgents[kNumTicketAgents];
    size_t remainingTickets = 250;
    
    for (size_t i = 0; i < kNumTicketAgents; i++) {
        ticketAgents[i] = thread(sellTickets, i, ref(remainingTickets));
    }
    
    for (size_t i = 0; i < kNumTicketAgents; i++) {
        ticketAgents[i].join();
    }
    
    cout << "Ticket selling done!" << endl;
    return 0;
}`,
                annotations: [
                    { match: "size_t& remainingTickets", explanation: "All 10 threads share this SAME variable via reference." },
                    { match: "while (remainingTickets > 0)", explanation: "Check if tickets remain..." },
                    { match: "remainingTickets--", explanation: "...then decrement. PROBLEM: What if another thread decremented in between?" },
                    { match: "sleep_for(500)", explanation: "Simulates selling work. Real apps have real work here." }
                ]
            }
        },
        {
            id: "race-condition-analysis",
            title: "Race Condition: Overselling Tickets",
            content: `There is a race condition in the ticket selling program! Threads could interrupt each other in between checking for remaining tickets and selling them.`,
            keyPoints: [
                "If thread A sees tickets remaining and commits to selling a ticket...",
                "...another thread B could come in and sell that same ticket before thread A does",
                "This can happen because the check-and-decrement isn't atomic",
                "With 1 ticket left, both threads might see 1, then both decrement → overflow!"
            ],
            diagram: `
Race Condition Scenario (remainingTickets = 1):

Thread #1                              Thread #2
─────────────────────────────────────────────────────────────────
while (remainingTickets > 0)  ✓
    "Are there tickets? Yep!"
                                       while (remainingTickets > 0)  ✓
                                           "Are there tickets? Yep!"
    
sleep_for(500)...                      sleep_for(500)...
    zzz                                    zzz

remainingTickets--;                    
    remainingTickets = 0               
                                       remainingTickets--;
                                           remainingTickets = 0 - 1
                                           = 18446744073709551615 (OVERFLOW!)
                                           
BOTH threads sold the SAME ticket!
And now we have a VERY large number of tickets remaining!
            `
        },
        {
            id: "atomicity",
            title: "Atomicity",
            content: `Atomic means an operation happens in its entirety without interruption. We want a thread to do the entire check-and-sell operation uninterrupted by other threads.`,
            keyPoints: [
                "C++ statements aren't inherently atomic",
                "Even remainingTickets-- takes multiple operations (get, decrement, save)",
                "These operations can be interrupted in the middle by other threads",
                "Combining the check and decrement doesn't fix it either!"
            ],
            codeExample: {
                title: "Why combining statements doesn't help",
                language: "cpp",
                code: `// This is NOT a fix!
static void sellTickets(size_t id, size_t& remainingTickets) {
    while (remainingTickets-- > 0) {
        sleep_for(500);  // simulate "selling a ticket"
        // ... 
    }
}

// Why it doesn't work:
// remainingTickets-- is actually THREE operations:
//   1. Read remainingTickets value
//   2. Decrement the value
//   3. Write the new value back
//
// Thread A could do step 1, then Thread B does 1-2-3,
// then Thread A continues with 2-3 using stale data!`,
                annotations: [
                    { match: "remainingTickets-- > 0", explanation: "Looks like one operation, but it's actually three separate steps." },
                    { match: "Read remainingTickets value", explanation: "Step 1: Get current value from memory." },
                    { match: "Decrement the value", explanation: "Step 2: Subtract 1 from the value." },
                    { match: "Write the new value back", explanation: "Step 3: Store updated value to memory. Another thread could interrupt between any of these!" }
                ]
            }
        },
        {
            id: "critical-section",
            title: "Critical Sections",
            content: `A critical section is a section of code that should be executed by only one thread at a time. We need to identify what should be protected.`,
            keyPoints: [
                "Critical section = code only one thread can execute at a time",
                "Want to protect: the check (remaining > 0) AND the modification (remaining--)",
                "Key: keep critical sections as small as possible to protect performance",
                "Move non-critical work (like printing, sleeping) outside the critical section"
            ],
            codeExample: {
                title: "Identifying the critical section",
                language: "cpp",
                code: `static void sellTickets(size_t id, size_t& remainingTickets) {
    while (true) {
        // ─────────── CRITICAL SECTION START ───────────
        // Only 1 thread can proceed at a time here
        if (remainingTickets == 0) break;
        size_t myTicket = remainingTickets;
        remainingTickets--;
        // ─────────── CRITICAL SECTION END ─────────────
        // Once thread passes here, another can go
        
        // This work happens OUTSIDE the critical section
        // Multiple threads can do this in parallel!
        sleep_for(500);  // simulate "selling a ticket"
        cout << oslock << "Thread #" << id << " sold a ticket ("
             << myTicket - 1 << " remain)." << endl << osunlock;
    }
    cout << oslock << "Thread #" << id
         << " sees no remaining tickets to sell and exits." << endl << osunlock;
}`,
                annotations: [
                    { match: "CRITICAL SECTION START", explanation: "Only one thread can be in this region at a time." },
                    { match: "size_t myTicket = remainingTickets", explanation: "Save the ticket number BEFORE decrementing, inside protected region." },
                    { match: "CRITICAL SECTION END", explanation: "After this point, multiple threads can run in parallel again." },
                    { match: "sleep_for(500)", explanation: "This is OUTSIDE the critical section - multiple threads can 'sell' in parallel." }
                ]
            }
        },
        {
            id: "critical-section-tradeoff",
            title: "Critical Section Performance Tradeoff",
            content: `Wait a minute - one benefit of threads is running concurrently. Doesn't a critical section defeat the point if only one thread can execute at a time?`,
            keyPoints: [
                "Critical sections can absolutely bottleneck performance",
                "For this reason, we want them to be as SMALL as possible",
                "Some critical sections are unavoidable to ensure correctness",
                "It's not always possible for multiple threads to simultaneously run every section",
                "Next lecture: we'll learn about MUTEXES to implement critical sections"
            ],
            diagram: `
Performance vs Correctness:

BAD: Large critical section (too slow!)
┌──────────────────────────────────────────────────────┐
│              CRITICAL SECTION                        │
│  if (remainingTickets == 0) break;                  │
│  remainingTickets--;                                │
│  sleep_for(500);  ← WHY IS THIS HERE?!              │
│  cout << ...;     ← AND THIS?!                      │
└──────────────────────────────────────────────────────┘
Other threads: 😴 zzz... waiting... for 500ms per ticket!


GOOD: Minimal critical section (fast!)
┌────────────────────────────────────┐
│        CRITICAL SECTION            │
│  if (remainingTickets == 0) break; │
│  myTicket = remainingTickets;      │
│  remainingTickets--;               │
└────────────────────────────────────┘
sleep_for(500);  ← Multiple threads do this in parallel!
cout << ...;     ← And this too!
            `
        },
        {
            id: "summary",
            title: "Lecture 12 Summary",
            content: `We learned about threads as a way to have concurrency within a single process. Threads share the same virtual address space, which makes data sharing easy but introduces race conditions.`,
            keyPoints: [
                "Threads: independent execution sequences within a single process",
                "Threads share: virtual address space, globals, heap, reference parameters",
                "Each thread has its own ministack for local variables",
                "thread(func, args...) creates a thread, join() waits for completion",
                "Race condition: unpredictable thread ordering causes bugs",
                "Critical section: code that only one thread should execute at a time"
            ],
            advantages: [
                "Lighter weight than processes",
                "Easy data sharing between concurrent tasks",
                "Can parallelize work across multiple CPU cores",
                "No need for pipes or complex IPC"
            ],
            disadvantages: [
                "Shared memory leads to race conditions",
                "Must carefully protect shared data",
                "Output can be interleaved (use oslock/osunlock)",
                "More complex to reason about correctness"
            ]
        },
        {
            id: "next-time",
            title: "Coming Up Next",
            content: `Next lecture we'll learn about mutexes - the tool we use to actually implement critical sections and protect shared data from race conditions.`,
            keyPoints: [
                "Mutex: mutual exclusion lock",
                "lock() and unlock() to protect critical sections",
                "Guarantees only one thread in critical section at a time",
                "assign4: You'll use mutexes to fix race conditions!"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Thread Output Prediction",
            difficulty: "easy",
            description: "Given the following program, what are the possible outputs? Can the order of greetings be predicted?",
            hint: "Threads can run in any order. The only guarantee is that 'Let's hear from...' prints before any greetings, and 'Everyone's said hello!' prints after all greetings.",
            starterCode: `static void greeting(size_t i) {
    cout << oslock << "Hello from " << i << endl << osunlock;
}

int main() {
    cout << "Let's hear from 3 threads." << endl;
    thread friends[3];
    
    for (size_t i = 0; i < 3; i++) {
        friends[i] = thread(greeting, i);
    }
    for (size_t i = 0; i < 3; i++) {
        friends[i].join();
    }
    
    cout << "Everyone's said hello!" << endl;
    return 0;
}

// Possible outputs?
// A) 0, 1, 2
// B) 2, 0, 1
// C) 1, 0, 2
// D) All of the above`,
            solution: `// Answer: D) All of the above!

// The greetings can appear in ANY order:
// - "Let's hear from 3 threads." is always FIRST
// - "Everyone's said hello!" is always LAST
// - The three "Hello from X" can appear in any of 6 possible orderings:
//   0,1,2  0,2,1  1,0,2  1,2,0  2,0,1  2,1,0

// Why?
// 1. All threads are spawned before any join() is called
// 2. Threads run independently and concurrently
// 3. The OS scheduler decides which runs when
// 4. No synchronization between the greeting calls`,
            explanation: "Threads execute independently once spawned. The join() loop just waits for all to finish - it doesn't control their execution order."
        },
        {
            id: "ex2",
            title: "Pass by Reference Bug",
            difficulty: "medium",
            description: "This program is supposed to print 'Thread 0', 'Thread 1', 'Thread 2'. What's wrong with it and why?",
            hint: "Think about when the threads actually start executing versus when the loop variable changes.",
            starterCode: `void printId(size_t& id) {
    cout << oslock << "Thread " << id << endl << osunlock;
}

int main() {
    thread threads[3];
    
    for (size_t i = 0; i < 3; i++) {
        threads[i] = thread(printId, ref(i));
    }
    
    for (size_t i = 0; i < 3; i++) {
        threads[i].join();
    }
    
    return 0;
}

// What might this print?`,
            solution: `// Problem: All threads share the SAME variable i!
// By the time threads run, i may have already been incremented.

// Possible outputs include:
// "Thread 3", "Thread 3", "Thread 3"  (all see final value)
// "Thread 1", "Thread 2", "Thread 3"  (threads start at different times)
// Or any other combination!

// Fix: Pass by VALUE instead of reference
void printId(size_t id) {  // NO & - pass by value!
    cout << oslock << "Thread " << id << endl << osunlock;
}

for (size_t i = 0; i < 3; i++) {
    threads[i] = thread(printId, i);  // NO ref() - copies i
}`,
            explanation: "With ref(i), all threads reference the same variable. The loop may complete before threads start, so they all see i=3. Pass by value copies the current value of i when the thread is created."
        },
        {
            id: "ex3",
            title: "Identifying Race Conditions",
            difficulty: "medium",
            description: "Is there a race condition in this code? If so, what could go wrong?",
            hint: "Think about what happens if two threads execute the increment at the same time.",
            starterCode: `size_t counter = 0;

void incrementCounter() {
    for (int i = 0; i < 1000; i++) {
        counter++;  // Is this atomic?
    }
}

int main() {
    thread t1(incrementCounter);
    thread t2(incrementCounter);
    
    t1.join();
    t2.join();
    
    cout << "Counter: " << counter << endl;
    // Expected: 2000 (1000 + 1000)
    // Actual: ???
    
    return 0;
}`,
            solution: `// YES, there is a race condition!
// counter++ is NOT atomic - it's three operations:
//   1. Read counter value
//   2. Add 1
//   3. Write back

// If both threads read counter = 500 at the same time,
// both add 1 to get 501, both write 501.
// We "lost" an increment!

// Expected: 2000
// Actual: Could be anything from 1000 to 2000
// (typically around 1800-1900 due to some overlaps)

// To fix: Use a mutex to protect the increment
// (We'll learn this in the next lecture!)

#include <mutex>
mutex m;

void incrementCounter() {
    for (int i = 0; i < 1000; i++) {
        m.lock();
        counter++;
        m.unlock();
    }
}`,
            explanation: "counter++ looks like one operation but is actually three. Two threads can read the same value, increment it, and write back - losing one increment. This is a classic race condition."
        },
        {
            id: "ex4",
            title: "Critical Section Design",
            difficulty: "hard",
            description: "Design the minimal critical section for this bank transfer function. What's the smallest region that needs protection?",
            hint: "Only the reads and writes of shared data need protection. Independent operations can happen outside the critical section.",
            starterCode: `void transfer(Account& from, Account& to, int amount) {
    // Log the transfer attempt
    cout << "Attempting transfer of $" << amount << endl;
    
    // Check if sufficient funds
    if (from.balance >= amount) {
        // Simulate processing delay
        sleep_for(100);
        
        // Perform the transfer
        from.balance -= amount;
        to.balance += amount;
        
        // Log success
        cout << "Transfer complete!" << endl;
    } else {
        cout << "Insufficient funds!" << endl;
    }
}

// Which lines need to be in the critical section?`,
            solution: `void transfer(Account& from, Account& to, int amount) {
    // Log the transfer attempt - NOT in critical section
    // (doesn't access shared account data)
    cout << oslock << "Attempting transfer of $" << amount << endl << osunlock;
    
    // ────── CRITICAL SECTION START ──────
    // Must protect: check AND modification of balances
    bool success = false;
    if (from.balance >= amount) {
        from.balance -= amount;
        to.balance += amount;
        success = true;
    }
    // ────── CRITICAL SECTION END ──────
    
    // Simulate processing delay - NOT in critical section!
    // (This doesn't need to block other threads)
    if (success) {
        sleep_for(100);
        cout << oslock << "Transfer complete!" << endl << osunlock;
    } else {
        cout << oslock << "Insufficient funds!" << endl << osunlock;
    }
}

// Key insight: Keep sleep_for() OUTSIDE the critical section!
// Otherwise, every transfer blocks all other transfers for 100ms.`,
            explanation: "The critical section must include the balance check AND modifications to ensure atomicity. But sleep_for() and logging don't access shared data, so keeping them outside maximizes parallelism."
        }
    ]
};

export default lecture12;
