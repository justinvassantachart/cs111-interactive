export const lecture12 = {
    id: 12,
    title: "Multithreading Introduction",
    subtitle: "Threads, Concurrency, and Race Conditions",
    keyTakeaway: "A process can have multiple threads executing tasks simultaneously. Threads share the same virtual address space, which makes data sharing easy but introduces race conditions that can cause unintended problems.",

    sections: [
        {
            id: "topic-overview",
            title: "Topic 3: Multithreading",
            content: `Welcome to week five! We're starting our next major topic: **multithreading**. This is how we achieve concurrency within a single process.`,
            keyPoints: [
                "How can a single process do multiple things at the same time?",
                "Understanding race conditions and how to fix them (next few lectures)",
                "How the OS schedules and switches between tasks",
                "assign4: implement multithreaded programs while eliminating race conditions"
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
            id: "what-is-a-thread",
            title: "🧠 Building Intuition: What IS a Thread?",
            content: `Before diving into code, let's build a mental model. Think of **threads** as workers in an office, and a **process** as the office building itself.`,
            keyPoints: [
                "🏢 PROCESS = An office building with shared resources (desks, printers, coffee machine)",
                "👷 THREAD = A worker in that office who can use all the shared resources",
                "📋 Each worker (thread) has their own task list (stack) but shares the office supplies (heap)",
                "🔑 KEY INSIGHT: Multiple workers can work simultaneously, but they might bump into each other!"
            ],
            diagram: `
The Office Analogy:

MULTIPROCESSING (Separate Buildings):        MULTITHREADING (Same Building):
┌─────────────────┐  ┌─────────────────┐    ┌─────────────────────────────────┐
│  Building A     │  │  Building B     │    │         Shared Office           │
│  ┌───────────┐  │  │  ┌───────────┐  │    │  ┌─────┐ ┌─────┐ ┌─────┐       │
│  │ Worker 1  │  │  │  │ Worker 2  │  │    │  │ W1  │ │ W2  │ │ W3  │       │
│  │           │  │  │  │           │  │    │  └──┬──┘ └──┬──┘ └──┬──┘       │
│  │ Own desk  │  │  │  │ Own desk  │  │    │     │      │      │           │
│  │ Own printer│ │  │  │ Own printer│ │    │     └──────┼──────┘           │
│  │ Own supplies│ │  │ │ Own supplies│ │    │            ▼                  │
│  └───────────┘  │  │  └───────────┘  │    │  ┌─────────────────────────┐   │
└─────────────────┘  └─────────────────┘    │  │ SHARED: Desks, Printer, │   │
                                            │  │ Coffee, Files, Supplies │   │
 ✓ Completely isolated                      │  └─────────────────────────┘   │
 ✗ Can't easily share                       └─────────────────────────────────┘
                                             ✓ Easy to share resources
                                             ✗ Workers might collide!
            `
        },
        {
            id: "from-processes-to-threads",
            title: "From Processes to Threads",
            content: `Multiprocessing allows us to spawn processes to do tasks or run programs. It's powerful but has limitations. Is there another way to have concurrency with different tradeoffs?`,
            keyPoints: [
                "Processes: can execute/wait on other programs, secure (separate memory), communicate with pipes/signals",
                "But: interprocess communication is cumbersome, hard to share data and coordinate",
                "Threads: independent execution sequences within a SINGLE process",
                "Threads let us run multiple functions in our program concurrently",
                "Common use: parallelize tasks across multiple CPU cores"
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
            title: "Threads vs. Processes: The Tradeoffs",
            content: `Understanding these tradeoffs is key to choosing the right concurrency model. Let's compare them directly.`,
            keyPoints: [
                "Processes: isolated virtual address spaces (good for security, bad for sharing)",
                "Processes: can run external programs (fork-exec pattern)",
                "Threads: share virtual address space (bad for security, GREAT for sharing)",
                "Threads: can't run external programs (exec would wipe ALL threads!)",
                "If one thread calls execvp, ALL threads get obliterated!"
            ],
            diagram: `
Direct Comparison:

┌─────────────────────┬────────────────────────┬────────────────────────┐
│      Feature        │      PROCESSES         │       THREADS          │
├─────────────────────┼────────────────────────┼────────────────────────┤
│ Memory              │ Separate (isolated)    │ Shared (same space)    │
│ Security            │ ✓ High (can't affect   │ ✗ Low (one bad thread  │
│                     │   each other)          │   affects all)         │
│ Data Sharing        │ ✗ Hard (need pipes)    │ ✓ Easy (just refs)     │
│ Run Other Programs  │ ✓ Yes (fork-exec)      │ ✗ No (exec wipes all)  │
│ Creation Overhead   │ Heavy                  │ Lightweight            │
│ Coordination        │ Hard                   │ Easy                   │
└─────────────────────┴────────────────────────┴────────────────────────┘

🎯 KEY INSIGHT: Threads are much more common for parallelizing 
   tasks within a program because of easier data sharing.
            `
        },
        {
            id: "threads-unit-of-concurrency",
            title: "🔑 Key Insight: Threads Are the Unit of Concurrency",
            content: `Here's something many students miss: **threads are actually the unit of concurrency in the OS, not processes!** Every process has at least one thread.`,
            keyPoints: [
                "Every process comes with ONE thread by default: the 'main thread'",
                "The main thread is what runs main() and all your code so far",
                "When the OS chooses what to run next, it chooses THREADS, not processes",
                "A process is essentially a CONTAINER for threads",
                "Now we'll learn to spawn ADDITIONAL threads beyond the main thread"
            ],
            diagram: `
The Main Thread (You've Been Using It All Along!):

BEFORE YOU KNEW ABOUT THREADS:          NOW YOU KNOW:
┌──────────────────────────┐            ┌──────────────────────────┐
│     Your Process         │            │     Your Process         │
│  ┌────────────────────┐  │            │  ┌──────────────────┐    │
│  │   int main() {     │  │            │  │   Main Thread    │    │
│  │     // code        │  │     =      │  │   runs main()    │    │
│  │   }                │  │            │  └──────────────────┘    │
│  └────────────────────┘  │            │                          │
└──────────────────────────┘            └──────────────────────────┘

What the OS actually sees:
┌─────────────────────────────────────────────────────────────────┐
│  Process 1      Process 2      Process 3                        │
│  ┌─────────┐    ┌─────────┐    ┌─────────────────────────────┐  │
│  │ Thread  │    │ Thread  │    │ Thread │ Thread │ Thread   │  │
│  └─────────┘    └─────────┘    └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
       ↑               ↑                        ↑
  Single-threaded  Single-threaded         Multi-threaded
  (just main())    (just main())           (main + spawned)
            `
        },
        {
            id: "threads-real-world",
            title: "Threads in the Real World",
            content: `Many modern applications use multithreading. Check your task manager - you'll see programs using dozens or hundreds of threads!`,
            keyPoints: [
                "📱 Mobile apps: one thread handles UI (taps/swipes), another downloads in background",
                "🌐 Web servers: spawn thread per incoming request for parallel handling",
                "🎮 Games: separate threads for graphics, physics, AI, networking",
                "💻 Your computer: check Task Manager/Activity Monitor to see thread counts!",
                "🔧 Development tools: IDEs use threads for syntax checking while you type"
            ]
        },
        {
            id: "cpp-thread-basics",
            title: "C++ Thread Basics",
            content: `In C++, spawn a thread using the thread type. Specify the function to execute and optionally pass parameters.`,
            keyPoints: [
                "thread myThread(myFunc, arg1, arg2, ...);",
                "myFunc: the function the thread should execute",
                "args: arguments to pass to that function (any number)",
                "Return values are ignored (use pass-by-reference instead)",
                "⚠️ Once initialized, the thread may execute at ANY time!"
            ],
            codeExample: {
                title: "Creating and joining a thread",
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
    
    // Wait for thread to finish (blocks until done)
    myThread.join();
    
    return 0;
}`,
                annotations: [
                    { match: "thread myThread(myFunc, 42, \"hello\")", explanation: "Creates and IMMEDIATELY starts a thread running myFunc. It could run at any moment from this point!" },
                    { match: "myThread.join()", explanation: "Blocks until the thread finishes. Like waitpid() for processes. MUST call before thread goes out of scope!" }
                ]
            }
        },
        {
            id: "thread-arrays",
            title: "Arrays of Threads",
            content: `To manage multiple threads, create an array and join them all. Unlike waitpid(-1), you must join each thread explicitly.`,
            keyPoints: [
                "Declare an array: thread friends[5];",
                "Spawn in a loop, joining each to an array element",
                "Wait by looping and calling join() on each",
                "⚠️ No equivalent to waitpid(-1) - must join each thread specifically",
                "Use range-based for with REFERENCE: for (thread& t : friends)"
            ],
            codeExample: {
                title: "Creating an array of threads",
                language: "cpp",
                code: `// Declare array of empty thread handles
thread friends[5];

// Spawn threads
for (size_t i = 0; i < 5; i++) {
    friends[i] = thread(myFunc, arg1, arg2);
}

// Wait for ALL threads to complete
for (size_t i = 0; i < 5; i++) {
    friends[i].join();
}

// Alternative: Range-based for loop (note the &!)
thread workers[5];
for (thread& currWorker : workers) {
    currWorker = thread(myFunc, arg1, arg2);
}
for (thread& currWorker : workers) {
    currWorker.join();
}`,
                annotations: [
                    { match: "thread friends[5]", explanation: "Creates 5 empty thread handles - no threads running yet." },
                    { match: "friends[i] = thread(myFunc", explanation: "Assigns a running thread to slot i. Thread starts immediately!" },
                    { match: "thread& currWorker", explanation: "MUST use reference! Threads can't be copied, only moved/referenced." }
                ]
            }
        },
        {
            id: "first-program",
            title: "Example: Greeting Friends",
            content: `Let's write our first multithreaded program. Each thread prints a greeting message.`,
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
    
    thread friends[kNumFriends];
    
    // Spawn all threads
    for (size_t i = 0; i < kNumFriends; i++) {
        friends[i] = thread(greeting, i);
    }
    
    // Wait for all threads
    for (size_t i = 0; i < kNumFriends; i++) {
        friends[i].join();
    }
    
    cout << "Everyone's said hello!" << endl;
    return 0;
}`,
                annotations: [
                    { match: "thread(greeting, i)", explanation: "Each thread runs greeting() with its own value of i. Threads start immediately!" },
                    { match: "oslock", explanation: "CS111 custom lock for cout - prevents output interleaving (explained soon)." },
                    { match: "Everyone's said hello!", explanation: "This ALWAYS prints last because we join() all threads first." }
                ]
            }
        },
        {
            id: "output-ordering",
            title: "🎲 The Unpredictable Output",
            content: `Run the friends program multiple times. What do you notice about the order?`,
            keyPoints: [
                "First line always prints first (before any threads spawn)",
                "Last line always prints last (after all threads join)",
                "But the middle lines (thread greetings) can appear in ANY order!",
                "Run it 10 times - you'll likely see different orderings"
            ],
            diagram: `
Sample runs of friends program:

Run 1:              Run 2:              Run 3:
─────────────────   ─────────────────   ─────────────────
Let's hear from 6   Let's hear from 6   Let's hear from 6
thread 0            thread 2            thread 4
thread 1            thread 0            thread 1
thread 2            thread 4            thread 3
thread 3            thread 1            thread 5
thread 4            thread 3            thread 2
thread 5            thread 5            thread 0
Everyone's hello!   Everyone's hello!   Everyone's hello!
─────────────────   ─────────────────   ─────────────────
     ↑                   ↑                   ↑
     └─────────── Order varies! ────────────┘

WHY? The OS scheduler decides when each thread runs.
Threads can run in ANY order once spawned!
            `
        },
        {
            id: "threads-vs-functions",
            title: "Threads vs. Sequential Function Calls",
            content: `What's the difference between spawning threads vs. just calling a function in a loop?`,
            keyPoints: [
                "Sequential calls: one finishes before the next starts",
                "Threaded calls: ALL can run at the same time (parallel)",
                "Threads leverage multiple CPU cores for TRUE parallelism",
                "For quick tasks: difference is small",
                "For slow tasks (downloads, computation): HUGE speedup with threads!"
            ],
            codeExample: {
                title: "Sequential vs Parallel execution",
                language: "cpp",
                code: `// SEQUENTIAL: Each call finishes before the next starts
for (size_t i = 0; i < kNumFriends; i++) {
    greeting(i);  // Runs greeting(0), waits, greeting(1), waits...
}
// Total time: sum of all greeting() times

// PARALLEL: All threads can run at the same time!
for (size_t i = 0; i < kNumFriends; i++) {
    friends[i] = thread(greeting, i);  // All start immediately!
}
// Total time: time of SLOWEST greeting() (they run simultaneously)

// ANALOGY:
// Sequential: One barista making 6 coffees = 6 × coffee_time
// Parallel:   Six baristas making 6 coffees = 1 × coffee_time`,
                annotations: [
                    { match: "greeting(i)", explanation: "Direct call - BLOCKS until greeting() returns, then continues to next iteration." },
                    { match: "thread(greeting, i)", explanation: "Spawns thread and CONTINUES IMMEDIATELY. Doesn't wait for greeting()." }
                ]
            }
        },
        {
            id: "check-understanding-1",
            title: "✅ Check Your Understanding: Thread Basics",
            content: `Before we continue, let's make sure the fundamentals are clear.`,
            keyPoints: [
                "❓ Q1: What happens if you forget to call join() on a thread?",
                "💡 A1: Runtime error! The program will crash when the thread object goes out of scope.",
                "❓ Q2: Can you predict which thread will print first?",
                "💡 A2: NO! The OS scheduler decides. Any thread could run first.",
                "❓ Q3: If you spawn 10 threads, how many threads total does your process have?",
                "💡 A3: 11 threads - the 10 you spawned PLUS the main thread running main()!"
            ]
        },
        {
            id: "race-conditions-intro",
            title: "⚠️ Race Conditions: When Threads Collide",
            content: `Threads are powerful, but they have a dark side. When threads share data, unpredictable orderings can cause bugs called **race conditions**.`,
            keyPoints: [
                "Race condition: an ordering of events that causes undesired behavior",
                "Not every ordering causes problems - just certain 'unlucky' ones",
                "Thread-safe function: works correctly even when called by multiple threads simultaneously",
                "operator<< (cout) is NOT thread safe! Output can get interleaved!"
            ],
            diagram: `
The Race Condition Problem:

Two threads printing "Hello World" without protection:

Thread A's output: H e l l o   W o r l d
Thread B's output: H e l l o   W o r l d

What might actually appear:
H H e e l l l l o o   W W o o r r l l d d
          ↑
    INTERLEAVED! 😱

Thread A prints 'H', then B prints 'H', then A prints 'e'...
This is why cout is NOT thread-safe!
            `
        },
        {
            id: "oslock-osunlock",
            title: "Protecting Output: oslock and osunlock",
            content: `To prevent cout interleaving, we provide oslock and osunlock. These ensure only one thread prints at a time.`,
            keyPoints: [
                "oslock: 'acquires the lock' - only one thread can hold it",
                "osunlock: 'releases the lock' - another thread can now print",
                "Wrap your ENTIRE print statement between oslock and osunlock",
                "Later you'll implement this yourself with mutexes!"
            ],
            codeExample: {
                title: "Thread-safe output with oslock/osunlock",
                language: "cpp",
                code: `#include "ostreamlock.h"

// BAD: Output can be interleaved!
void badGreeting(size_t i) {
    cout << "Hello, world! I am thread " << i << endl;
}
// Possible output: "Hello, Hello, world! world! I am thread I am 0thread 1"

// GOOD: oslock ensures atomic output
void goodGreeting(size_t i) {
    cout << oslock << "Hello, world! I am thread " << i << endl << osunlock;
}
// Output lines might be reordered, but each line is complete:
// "Hello, world! I am thread 1"
// "Hello, world! I am thread 0"`,
                annotations: [
                    { match: "oslock", explanation: "Locks the output stream. No other thread can print until osunlock." },
                    { match: "osunlock", explanation: "Releases the lock. Another thread can now print." },
                    { match: "interleaved", explanation: "Without locking, two threads print simultaneously, mixing their characters!" }
                ]
            }
        },
        {
            id: "threads-share-memory",
            title: "Threads Share Memory",
            content: `Unlike parent/child processes, threads execute in the SAME virtual address space. This is powerful but dangerous!`,
            keyPoints: [
                "Threads share: globals, heap, pass-by-reference parameters",
                "Each thread has its own 'ministack' for local variables",
                "Changes by one thread are IMMEDIATELY visible to others",
                "To pass by reference with thread(), wrap in ref()",
                "This shared memory is both the power AND the danger of threads"
            ],
            diagram: `
Thread Memory Model:

┌─────────────────────────────────────────────────────────────┐
│                    PROCESS MEMORY                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Thread 1 │  │ Thread 2 │  │ Thread 3 │  ← Each thread   │
│  │  Stack   │  │  Stack   │  │  Stack   │    has own stack │
│  │ (private)│  │ (private)│  │ (private)│    (local vars)  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                  │
│       │             │             │                         │
│       └─────────────┼─────────────┘                         │
│                     ▼                                       │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                  SHARED HEAP                          │ │
│  │  • Global variables                                   │ │
│  │  • Dynamically allocated memory (new/malloc)          │ │
│  │  • Anything passed by reference                       │ │
│  │                                                       │ │
│  │  ⚠️ ALL THREADS CAN READ AND WRITE THIS! ⚠️          │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
            `
        },
        {
            id: "pass-by-reference-danger",
            title: "🚨 The ref() Trap: Pass-by-Reference Danger",
            content: `Want to see chaos? Try passing a loop variable by reference to threads. The results are... unexpected.`,
            codeExample: {
                title: "friends-ref.cc - What could go wrong?",
                language: "cpp",
                code: `static void greeting(size_t& i) {  // Note: reference parameter!
    cout << oslock << "Hello, world! I am thread " << i << endl << osunlock;
}

int main() {
    thread friends[kNumFriends];
    
    for (size_t i = 0; i < kNumFriends; i++) {
        friends[i] = thread(greeting, ref(i));  // Pass i BY REFERENCE
    }
    
    for (size_t i = 0; i < kNumFriends; i++) {
        friends[i].join();
    }
    return 0;
}

// Expected output: threads 0, 1, 2, 3, 4, 5 (some order)
// ACTUAL output might be:
//   "I am thread 3"
//   "I am thread 3"
//   "I am thread 5"
//   "I am thread 6"   ← WAIT, 6?! Loop only goes to 5!
//   "I am thread 6"
//   "I am thread 6"`,
                annotations: [
                    { match: "size_t& i", explanation: "Reference parameter - all threads access the SAME variable!" },
                    { match: "ref(i)", explanation: "Explicitly tells thread() to pass by reference. Without this, it would copy." },
                    { match: "I am thread 6", explanation: "i became 6 after the loop ended! The thread accessed dead memory!" }
                ]
            }
        },
        {
            id: "ref-trap-explained",
            title: "Why ref() Causes Chaos",
            content: `Let's understand exactly what went wrong with the pass-by-reference example.`,
            keyPoints: [
                "All threads share a REFERENCE to the same variable i",
                "The for loop increments i faster than threads start running",
                "By the time a thread prints, i might already be 3, 4, 5, or even 6!",
                "The '6' appears because the loop exits when i == 6, and threads still have a reference to it",
                "This is called 'identity theft' - threads steal each other's IDs!"
            ],
            diagram: `
Timeline of the ref() disaster:

TIME    MAIN THREAD                 SPAWNED THREADS
────    ───────────                 ───────────────
 1      i = 0, spawn thread 0       (not running yet)
 2      i = 1, spawn thread 1       (not running yet)
 3      i = 2, spawn thread 2       (not running yet)
 4      i = 3, spawn thread 3       Thread 0 starts... reads i... it's 3!
 5      i = 4, spawn thread 4       Thread 1 starts... reads i... it's 4!
 6      i = 5, spawn thread 5       Thread 2 starts... reads i... it's 5!
 7      i = 6, loop exits           Thread 3 starts... reads i... it's 6!
 8      waiting...                  Thread 4 starts... reads i... it's 6!
 9      waiting...                  Thread 5 starts... reads i... it's 6!

All threads printed values 3-6, none printed 0-2!
And 6 shouldn't even be possible (loop was i < 6)!
            `
        },
        {
            id: "check-understanding-2",
            title: "✅ Check Your Understanding: Shared Memory",
            content: `Test your understanding of thread memory sharing.`,
            keyPoints: [
                "❓ Q1: If Thread A modifies a global variable, when does Thread B see the change?",
                "💡 A1: Immediately! They share the same memory. (This is the source of race conditions)",
                "❓ Q2: How do you pass a variable by reference to a thread?",
                "💡 A2: Use ref() wrapper: thread(myFunc, ref(myVar))",
                "❓ Q3: Why did the pass-by-reference example print '6' when the loop was i < 6?",
                "💡 A3: The loop variable became 6 to exit the loop. Threads still had a reference to it!"
            ]
        },
        {
            id: "ticket-selling-example",
            title: "Example: Selling Tickets",
            content: `Let's see a more realistic race condition. Imagine 10 ticket agents trying to sell from a shared pool of 250 tickets.`,
            codeExample: {
                title: "confused-ticket-agents.cc",
                language: "cpp",
                code: `const size_t kNumTicketAgents = 10;

static void sellTickets(size_t id, size_t& remainingTickets) {
    while (remainingTickets > 0) {
        sleep_for(500);  // Simulate "selling a ticket"
        remainingTickets--;
        cout << oslock << "Thread #" << id << " sold a ticket ("
             << remainingTickets << " remain)." << endl << osunlock;
    }
    cout << oslock << "Thread #" << id
         << " sees no remaining tickets to sell and exits." << endl << osunlock;
}

int main() {
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
                    { match: "size_t& remainingTickets", explanation: "All 10 threads share this SAME counter via reference." },
                    { match: "while (remainingTickets > 0)", explanation: "Check if tickets remain..." },
                    { match: "remainingTickets--", explanation: "...then decrement. But what if ANOTHER thread decremented in between?!" },
                    { match: "sleep_for(500)", explanation: "Simulates work. Makes the race condition happen more reliably." }
                ]
            }
        },
        {
            id: "ticket-disaster",
            title: "🔥 The Ticket Selling Disaster",
            content: `Run the ticket program. Watch the output. Something goes VERY wrong.`,
            diagram: `
What you'll see when you run confused-ticket-agents:

$ ./confused-ticket-agents
Thread #3 sold a ticket (249 remain).
Thread #7 sold a ticket (248 remain).
... (seems normal for a while) ...
Thread #2 sold a ticket (1 remain).
Thread #5 sees no remaining tickets and exits.
Thread #8 sold a ticket (18446744073709551615 remain).  ← WHAT?!
Thread #1 sold a ticket (18446744073709551614 remain).
Thread #3 sold a ticket (18446744073709551613 remain).
... (keeps going forever!) ...

^C (you have to Ctrl-C to stop it!)

That huge number is SIZE_T_MAX - the result of 0 - 1 for unsigned!
The program will now run FOREVER trying to sell trillions of tickets!
            `
        },
        {
            id: "race-condition-analysis",
            title: "Anatomy of the Race Condition",
            content: `How did two threads both sell the LAST ticket? Let's trace through exactly what happened.`,
            diagram: `
Race Condition Scenario (remainingTickets = 1):

Thread #1                              Thread #2
─────────────────────────────────────────────────────────────────
while (remainingTickets > 0)  ✓
    "Is there a ticket? Yes!"
                                       while (remainingTickets > 0)  ✓
                                           "Is there a ticket? Yes!"
    
sleep_for(500)...                      sleep_for(500)...
    zzz (both sleeping)                    zzz

remainingTickets--;                    
    remainingTickets = 0               
    "I sold the last ticket!"          
                                       remainingTickets--;
                                           0 - 1 = 18446744073709551615
                                           "Wait, what?!"
                                           
BOTH threads "sold" the same ticket!
And now remainingTickets has OVERFLOWED to a huge number!
            `
        },
        {
            id: "sleep-for-misconception",
            title: "🤔 'If I Remove sleep_for, It's Fixed!' - Wrong!",
            content: `You might think: "The sleep_for causes the problem. Remove it and we're fine!" This is a dangerous misconception.`,
            keyPoints: [
                "The sleep_for makes the bug RELIABLE and VISIBLE",
                "Without it, the bug still exists but happens RARELY",
                "A bug that happens rarely is WORSE than one that happens always!",
                "You might run it 100 times successfully, then crash in production",
                "Rule: The only thing worse than a bug that happens all the time is a bug that doesn't happen all the time"
            ],
            diagram: `
The False Sense of Security:

WITH sleep_for(500):                 WITHOUT sleep_for(500):
┌───────────────────────┐           ┌───────────────────────────┐
│ Bug happens EVERY run │           │ Bug happens 1 in 10000    │
│                       │           │   runs... maybe           │
│ Easy to debug!        │           │                           │
│ You KNOW there's a    │           │ "Works on my machine!" 🙄 │
│ problem               │           │                           │
│                       │           │ Then crashes in production │
│                       │           │ at 3 AM on a Saturday     │
└───────────────────────┘           └───────────────────────────┘
         ↑                                      ↑
   BETTER (visible)                     WORSE (hidden!)

The motto: "The only thing worse than a bug that happens all
           the time is a bug that doesn't happen all the time."
            `
        },
        {
            id: "atomicity",
            title: "The Problem: Lack of Atomicity",
            content: `The core issue is that our check-and-sell operation is NOT atomic. It can be interrupted in the middle.`,
            keyPoints: [
                "Atomic = happens in its entirety without interruption",
                "We need: check + decrement to happen as ONE uninterruptible unit",
                "C++ statements are NOT inherently atomic",
                "Even remainingTickets-- is actually THREE operations!",
                "Combining into one line doesn't help!"
            ],
            codeExample: {
                title: "Why combining statements doesn't help",
                language: "cpp",
                code: `// This looks like one operation but ISN'T!
while (remainingTickets-- > 0) {
    // sell ticket...
}

// What remainingTickets-- ACTUALLY does:
//   Step 1: Read remainingTickets from memory
//   Step 2: Decrement the value  
//   Step 3: Write the new value back to memory
//
// Between steps 1 and 3, another thread could:
//   - Read the same "old" value
//   - Do its own decrement
//   - Write back, overwriting OUR change
//
// Result: Two "decrements" but value only went down by 1!`,
                annotations: [
                    { match: "remainingTickets-- > 0", explanation: "Looks like one operation, but it's actually THREE separate CPU instructions!" },
                    { match: "Step 1: Read", explanation: "Thread loads value from memory into a CPU register." },
                    { match: "Step 2: Decrement", explanation: "Thread decrements the value in its register." },
                    { match: "Step 3: Write", explanation: "Thread writes back to memory. But what if memory changed?!" }
                ]
            }
        },
        {
            id: "critical-section-intro",
            title: "The Solution: Critical Sections",
            content: `A **critical section** is code that should only be executed by ONE thread at a time. It's like a single-file bridge.`,
            keyPoints: [
                "Critical section = code where only one thread can be at a time",
                "While one thread is in the critical section, others must WAIT",
                "Once the thread exits, the next waiting thread can enter",
                "This guarantees atomicity of the protected code",
                "Key: Keep critical sections as SMALL as possible!"
            ],
            diagram: `
Critical Section = Single File Bridge

                   ┌───────────────────────────────────────┐
Thread 1  ────────►│         CRITICAL SECTION              │────────►
                   │                                       │
Thread 2  ─ WAIT ──│  if (remainingTickets == 0) break;   │
                   │  remainingTickets--;                  │
Thread 3  ─ WAIT ──│                                       │
                   └───────────────────────────────────────┘
                              
       🚦 Only ONE thread                    ✓ Thread 1 exits,
          can cross at a time                  Thread 2 can enter

Think of it like a STOPLIGHT:
  🔴 RED: Another thread is in the critical section → WAIT
  🟢 GREEN: Critical section is empty → You can enter
            `
        },
        {
            id: "critical-section-design",
            title: "Designing the Critical Section",
            content: `We want the critical section to be as SMALL as possible. Bigger = more waiting = worse performance.`,
            codeExample: {
                title: "Minimal critical section",
                language: "cpp",
                code: `static void sellTickets(size_t id, size_t& remainingTickets) {
    while (true) {
        // ─────────── CRITICAL SECTION START ───────────
        if (remainingTickets == 0) break;
        size_t myTicketNum = remainingTickets;  // Save MY ticket number
        remainingTickets--;
        // ─────────── CRITICAL SECTION END ─────────────
        
        // Everything below is OUTSIDE the critical section
        // Multiple threads can do this in PARALLEL!
        sleep_for(500);  // Simulate selling work
        cout << oslock << "Thread #" << id << " sold ticket #" 
             << myTicketNum << endl << osunlock;
    }
}`,
                annotations: [
                    { match: "CRITICAL SECTION START", explanation: "Only one thread can be between START and END at a time." },
                    { match: "size_t myTicketNum = remainingTickets", explanation: "Copy to LOCAL variable! Local vars are private to each thread." },
                    { match: "CRITICAL SECTION END", explanation: "As soon as we decrement, we exit. Next thread can enter." },
                    { match: "sleep_for(500)", explanation: "OUTSIDE critical section! Multiple threads sleep in parallel." }
                ]
            }
        },
        {
            id: "critical-section-tradeoff",
            title: "The Critical Section Tradeoff",
            content: `Wait - isn't the point of threads to run in PARALLEL? Doesn't a critical section defeat the purpose?`,
            keyPoints: [
                "Yes, critical sections can bottleneck performance",
                "That's why we keep them as SMALL as possible",
                "Put ONLY the shared-data access in the critical section",
                "Move independent work (sleeping, printing) OUTSIDE",
                "Some critical sections are unavoidable for correctness"
            ],
            diagram: `
Performance vs Correctness:

BAD: Large critical section (too slow!)
┌──────────────────────────────────────────────────────┐
│              CRITICAL SECTION                        │
│  if (remainingTickets == 0) break;                  │
│  remainingTickets--;                                │
│  sleep_for(500);  ← WHY IS THIS HERE?! 😱           │
│  cout << ...;     ← AND THIS?! 😱                   │
└──────────────────────────────────────────────────────┘
Other threads: 😴 zzz... waiting 500ms PER TICKET!


GOOD: Minimal critical section (fast!)
┌────────────────────────────────────┐
│        CRITICAL SECTION            │
│  if (remainingTickets == 0) break; │  ← Tiny!
│  myTicket = remainingTickets;      │
│  remainingTickets--;               │
└────────────────────────────────────┘
sleep_for(500);  ← All threads do this in PARALLEL! 🚀
cout << ...;     ← And this too! 🚀
            `
        },
        {
            id: "check-understanding-3",
            title: "✅ Check Your Understanding: Race Conditions",
            content: `Test your understanding of race conditions and critical sections.`,
            keyPoints: [
                "❓ Q1: Why does the ticket program print a huge number like 18446744073709551615?",
                "💡 A1: It's SIZE_T_MAX! When you do 0 - 1 on an unsigned int, it wraps around to the maximum value.",
                "❓ Q2: Would putting the while loop condition and -- on the same line fix the race?",
                "💡 A2: NO! Even 'remainingTickets-- > 0' is multiple CPU operations that can be interrupted.",
                "❓ Q3: Why should we keep critical sections small?",
                "💡 A3: Because while one thread is in the critical section, ALL other threads must wait. Big sections = big waits = slow program."
            ]
        },
        {
            id: "debug-guide",
            title: "🔧 Debug Guide: Common Multithreading Bugs",
            content: `When your multithreaded program misbehaves, check these common issues:`,
            diagram: `
┌────────────────────────────────────────────────────────────────────────┐
│     SYMPTOM                        │     LIKELY CAUSE                  │
├────────────────────────────────────┼───────────────────────────────────┤
│ Output is jumbled/interleaved     │ Missing oslock/osunlock around    │
│                                    │ cout statements                   │
├────────────────────────────────────┼───────────────────────────────────┤
│ Program crashes when thread        │ Forgot to join() threads before   │
│ objects go out of scope           │ they're destroyed                 │
├────────────────────────────────────┼───────────────────────────────────┤
│ All threads print same value      │ Using ref() when you should       │
│ (like all print "6")              │ pass by value (copy)              │
├────────────────────────────────────┼───────────────────────────────────┤
│ Counter goes negative or to       │ Race condition! Multiple threads  │
│ huge positive numbers             │ modifying shared variable         │
├────────────────────────────────────┼───────────────────────────────────┤
│ Bug appears only sometimes        │ Race condition! The fact that it  │
│ (works most of the time)          │ works sometimes makes it WORSE    │
├────────────────────────────────────┼───────────────────────────────────┤
│ Program hangs forever             │ Deadlock (we'll cover this later) │
└────────────────────────────────────┴───────────────────────────────────┘

🔍 Debugging tip: Add sleep_for() calls to EXPOSE race conditions.
   If a bug only happens sometimes, adding delays makes it happen
   reliably so you can actually debug it!
            `
        },
        {
            id: "exam-prep",
            title: "🎯 Midterm Prep: What to Know",
            content: `Threads, race conditions, and critical sections are heavily tested on the midterm. Know the differences between threads and processes, what is shared vs. private, how race conditions arise, and how to design minimal critical sections.`,
            keyPoints: [
                "📝 thread(func, args...) spawns a thread; join() waits for it to finish (MUST join or detach!)",
                "📝 Threads share: heap, globals, pass-by-ref params. Each thread has its OWN stack (local vars)",
                "📝 N spawned threads + main thread = N+1 total threads",
                "📝 Thread execution order is NON-DETERMINISTIC — OS scheduler decides",
                "📝 Race condition: bug caused by unpredictable thread ordering when accessing shared data",
                "📝 Even x++ is NOT atomic — it's 3 operations: read, increment, write",
                "📝 Critical section: code that only ONE thread should execute at a time",
                "📝 Keep critical sections SMALL — only protect shared-data access, not unrelated work"
            ],
            diagram: `
Midterm Cheat Sheet — Threads & Race Conditions:

┌─────────────────────────────────────────────────────────────┐
│  Threads vs Processes:                                       │
│  ─────────────────────                                       │
│  Processes: separate address spaces (fork = copy)            │
│  Threads:   SHARED address space (same globals/heap)         │
│  Processes need pipes/IPC. Threads just share memory.        │
├─────────────────────────────────────────────────────────────┤
│  Race Condition Pattern:                                     │
│  ───────────────────────                                     │
│  Thread A: read x (x=1)     Thread B: read x (x=1)          │
│  Thread A: x = x+1 (=2)    Thread B: x = x+1 (=2)          │
│  Thread A: write x (x=2)   Thread B: write x (x=2)          │
│  Expected: x=3. Actual: x=2. Lost an increment!             │
├─────────────────────────────────────────────────────────────┤
│  Critical Section Design:                                    │
│  ────────────────────────                                    │
│  ✅ IN:  shared variable check + modify                      │
│  ❌ OUT: sleep, printf, independent computation              │
│  Rule: minimize time in critical section for performance     │
├─────────────────────────────────────────────────────────────┤
│  Common Exam Questions:                                      │
│  ──────────────────────                                      │
│  • "Is this code thread-safe?" → check for shared writes     │
│  • "What can go wrong?" → identify race condition scenario   │
│  • "Design the critical section" → minimal protection        │
│  • "How many threads?" → count spawned + main                │
└─────────────────────────────────────────────────────────────┘
`
        },
        {
            id: "summary",
            title: "Lecture 12 Summary",
            content: `We learned about threads as a way to have concurrency within a single process.`,
            keyPoints: [
                "Threads: independent execution sequences within a single process",
                "Threads share: virtual address space, globals, heap, reference params",
                "Each thread has its own ministack for local variables",
                "thread(func, args...) creates a thread, join() waits for completion",
                "Race condition: unpredictable thread ordering causes bugs",
                "Critical section: code that only one thread should execute at a time",
                "Keep critical sections SMALL!"
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
                "Bugs that happen 'sometimes' are hard to debug"
            ]
        },
        {
            id: "next-time",
            title: "Coming Up Next",
            content: `Next lecture we'll learn about **mutexes** - the tool we use to actually enforce critical sections!`,
            keyPoints: [
                "Mutex: mutual exclusion lock",
                "lock() and unlock() to protect critical sections",
                "Guarantees only one thread in critical section at a time",
                "We'll fix the ticket-selling program for real!",
                "assign4: You'll use mutexes to fix race conditions!"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Thread Output Prediction",
            difficulty: "easy",
            description: "Given the following program, what are the possible outputs?",
            starterCode: `static void greet(size_t i) {
    cout << oslock << "Thread " << i << endl << osunlock;
}

int main() {
    cout << "Start" << endl;
    thread t[3];
    for (size_t i = 0; i < 3; i++) {
        t[i] = thread(greet, i);
    }
    for (size_t i = 0; i < 3; i++) {
        t[i].join();
    }
    cout << "Done" << endl;
}`,
            solution: `// "Start" is ALWAYS first
// "Done" is ALWAYS last
// The middle three can be in ANY order:
//   0,1,2  0,2,1  1,0,2  1,2,0  2,0,1  2,1,0
// That's 3! = 6 possible orderings!`,
            explanation: "Threads run in unpredictable order. The only guarantees are: 'Start' before spawning, and 'Done' after joining all threads."
        },
        {
            id: "ex2",
            title: "Pass by Reference Bug",
            difficulty: "medium",
            description: "This program should print numbers 0-4, but it doesn't. What's wrong?",
            starterCode: `void print(size_t& n) {
    cout << oslock << n << endl << osunlock;
}

int main() {
    thread t[5];
    for (size_t i = 0; i < 5; i++) {
        t[i] = thread(print, ref(i));
    }
    for (size_t i = 0; i < 5; i++) {
        t[i].join();
    }
}`,
            solution: `// Problem: All threads share the SAME variable i!
// Fix: Pass by VALUE (remove & and ref):
void print(size_t n) {  // No reference
    cout << oslock << n << endl << osunlock;
}

// In main:
t[i] = thread(print, i);  // No ref() wrapper`,
            explanation: "ref(i) makes all threads share one variable. The loop changes i faster than threads run, so they see later values."
        },
        {
            id: "ex3",
            title: "Identifying Race Conditions",
            difficulty: "medium",
            description: "Is there a race condition in this code?",
            starterCode: `int counter = 0;

void increment() {
    for (int i = 0; i < 1000; i++) {
        counter++;
    }
}

int main() {
    thread t1(increment);
    thread t2(increment);
    t1.join();
    t2.join();
    cout << counter << endl;  // Expected: 2000
}`,
            solution: `// YES, there's a race condition!
// counter++ is NOT atomic (3 operations)
// Expected: 2000
// Actual: Could be 1000 to 2000 (usually ~1800-1900)

// To fix: Need a mutex (next lecture!)
mutex m;
void increment() {
    for (int i = 0; i < 1000; i++) {
        m.lock();
        counter++;
        m.unlock();
    }
}`,
            explanation: "counter++ is three operations: read, increment, write. Two threads can read the same value, both increment, both write - losing one increment!"
        },
        {
            id: "ex4",
            title: "Critical Section Design",
            difficulty: "hard",
            description: "Design the MINIMAL critical section for this bank transfer function.",
            starterCode: `void transfer(Account& from, Account& to, int amount) {
    cout << "Attempting $" << amount << " transfer..." << endl;
    
    if (from.balance >= amount) {
        sleep_for(100);  // Processing time
        from.balance -= amount;
        to.balance += amount;
        cout << "Transfer complete!" << endl;
    } else {
        cout << "Insufficient funds!" << endl;
    }
}

// Which lines should be in the critical section?`,
            solution: `void transfer(Account& from, Account& to, int amount) {
    // NOT in critical section (doesn't access shared data)
    cout << oslock << "Attempting $" << amount << "..." << endl << osunlock;
    
    // ──── CRITICAL SECTION ────
    bool success = false;
    if (from.balance >= amount) {
        from.balance -= amount;
        to.balance += amount;
        success = true;
    }
    // ──── END CRITICAL SECTION ────
    
    // NOT in critical section (only uses local variable)
    if (success) {
        sleep_for(100);  // Processing OUTSIDE critical section!
        cout << oslock << "Complete!" << endl << osunlock;
    } else {
        cout << oslock << "Insufficient funds!" << endl << osunlock;
    }
}`,
            explanation: "Only the balance check and modifications need protection. Sleeping and printing can happen outside, allowing other transfers to proceed in parallel!"
        },
        {
            id: "ex5",
            title: "Thread Count",
            difficulty: "easy",
            description: "How many threads are running in this program?",
            starterCode: `void work() { /* ... */ }

int main() {
    thread workers[4];
    for (int i = 0; i < 4; i++) {
        workers[i] = thread(work);
    }
    // Point A: How many threads exist RIGHT NOW?
    
    for (int i = 0; i < 4; i++) {
        workers[i].join();
    }
    return 0;
}`,
            solution: `// At Point A: 5 threads exist!
// - 1 main thread (running main())
// - 4 worker threads (running work())

// Common mistake: Forgetting to count the main thread!
// Every process starts with 1 thread (main).
// We spawned 4 more. Total = 5.`,
            explanation: "Don't forget the main thread! It's always there. 4 spawned + 1 main = 5 total."
        },
        {
            id: "ex6",
            title: "Why Does This Crash?",
            difficulty: "medium",
            description: "This program crashes unexpectedly. Why?",
            starterCode: `void greet(size_t i) {
    cout << oslock << "Hello from " << i << endl << osunlock;
}

int main() {
    thread t(greet, 42);
    return 0;  // CRASH!
}`,
            solution: `// The thread object 't' goes out of scope without join()!
// You MUST call join() (or detach()) before destruction.

// Fix 1: Add join
int main() {
    thread t(greet, 42);
    t.join();  // Wait for thread to finish
    return 0;
}

// Fix 2: detach (rarely used)
int main() {
    thread t(greet, 42);
    t.detach();  // Thread continues, but we don't wait
    return 0;
}`,
            explanation: "C++ requires that every thread is joined or detached before its object is destroyed. Forgetting causes std::terminate to be called."
        }
    ]
};

export default lecture12;
