export const lecture19 = {
    id: 19,
    title: "Preemption and Implementing Locks",
    subtitle: "Timer Interrupts, the Interrupt Handshake, and Building Mutexes",
    keyTakeaway: "To implement preemption, we use timer interrupts to force context switches after each time slice. The 'interrupt handshake' ensures interrupts are correctly disabled/enabled during switches: Thread A disables, Thread B re-enables. New threads must manually enable interrupts on first run. Locks consist of a locked flag, an owner, and a waiting queue of blocked threads. Lock and unlock use context switching to sleep/wake threads. However, lock implementations themselves have race conditions — we'll solve this next lecture.",

    sections: [
        {
            id: "topic-overview",
            title: "Topic 3: Multithreading, Part 8",
            content: `We've learned **how** the OS switches between threads (dispatching) and **which** thread to run next (scheduling). Now we put it all together: **preemption** — using timer interrupts to force context switches — and **implementing locks** from scratch. These are the core ideas behind **assign5**!`,
            keyPoints: [
                "Lecture 17 (Dispatching): the MECHANISM — HOW to switch threads (context switch)",
                "Lecture 18 (Scheduling): the POLICY — WHICH thread to run next",
                "Lecture 19 (This Lecture): PREEMPTION — using timer interrupts to enforce time slices, and IMPLEMENTING LOCKS",
                "Lecture 20: Finishing lock and condition variable implementations",
                "assign5: implement your own thread, mutex, and condition_variable!"
            ],
            diagram: `
Topic 3: Multithreading — Implementation Roadmap:

┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Lecture 17   │ →  │  Lecture 18   │ →  │  Lecture 19   │ →  │  Lecture 20   │
│               │    │               │    │               │    │               │
│ Dispatching   │    │ Scheduling    │    │ Preemption &  │    │ Implementing  │
│ (context      │    │ (which thread │    │ Implementing  │    │ Locks and CVs │
│  switching)   │    │  runs next?)  │    │ Locks         │    │ (continued)   │
│               │    │               │    │               │    │               │
│ (Done!)       │    │ (Done!)       │    │ (This one!)   │    │  (Next)       │
└───────────────┴────┴───────────────┴────┴───────────────┴────┴───────────────┘

assign5: implement your own version of thread, mutex and condition_variable!
            `
        },
        {
            id: "scheduling-recap",
            title: "🔄 Recap: Scheduling (Lecture 18)",
            content: `Quick recap of the four scheduling algorithms. The key question was: **which thread should the OS run next?** We compared FCFS, Round Robin, SRPT, and Priority-Based scheduling. On **assign5**, you'll implement **Round Robin** with preemption.`,
            keyPoints: [
                "FCFS (First-Come First-Serve): run thread from front of queue until it finishes or blocks. Simple but unfair.",
                "Round Robin: run each thread for one TIME SLICE, then move to back of queue. Fair! This is what you implement on assign5.",
                "SRPT (Shortest Remaining Processing Time): always run the thread that will finish soonest. Optimal for average response time, but requires predicting the future and can starve long threads.",
                "Priority-Based: threads have priorities that change based on behavior. I/O-bound threads stay high-priority, CPU-bound threads sink. Aging prevents starvation.",
                "Key insight from SRPT: I/O-bound threads (short CPU bursts) get preference over CPU-bound threads (long computation), improving overall resource utilization."
            ]
        },
        {
            id: "preemption-overview",
            title: "⏱️ Preemption and Interrupts",
            content: `On assign5, you'll implement a combined scheduler+dispatcher using the **Round Robin** approach. This is **preemptive**: threads can be kicked off the CPU in favor of others after their time slice expires. To implement this, we use a **timer** that fires an interrupt at a specified interval, triggering a context switch.`,
            keyPoints: [
                "Preemptive scheduling: the OS can FORCE a thread to stop running (unlike cooperative scheduling where threads voluntarily yield)",
                "Implementation: a timer fires an interrupt every X microseconds",
                "When the timer fires, we run a 'timer interrupt handler' — a function we provide",
                "Idea: our timer handler can trigger a context switch to the next ready thread!",
                "On assign5: for simplicity, we ALWAYS do a context switch when the timer fires (even if a thread just started)",
                "Critical detail: the timer DISABLES interrupts while running the handler, to avoid the timer interrupting itself",
                "Interrupt disabling is GLOBAL state — not per-thread. Only the OS can do this (not user programs)."
            ],
            diagram: `
Preemptive Round Robin — How It Works:

  Thread A running             Timer fires!              Thread B running
  ┌──────────────┐         ┌──────────────────┐        ┌──────────────┐
  │  executing   │  ──►    │ Timer Handler:   │  ──►   │  executing   │
  │  user code   │         │  1. Interrupts   │        │  user code   │
  │  ...         │         │     OFF (auto)   │        │  ...         │
  │              │         │  2. Save A state │        │              │
  │              │         │  3. Load B state │        │              │
  │              │         │  4. Interrupts   │        │              │
  │              │         │     ON (auto)    │        │              │
  └──────────────┘         └──────────────────┘        └──────────────┘

  ╔════════════════════════════════════════════════════════════════╗
  ║  KEY: Timer handler runs with interrupts DISABLED             ║
  ║  This prevents the timer from interrupting its own handler!   ║
  ║  ("Do Not Disturb" mode)                                      ║
  ╚════════════════════════════════════════════════════════════════╝
            `
        },
        {
            id: "timer-demo",
            title: "💻 Timer Demo: interrupt.cc",
            content: `Here's a simple example of using the timer API. The program registers a handler function that runs every 500,000 microseconds (0.5 seconds). The timer infrastructure (provided in \`timer.hh\` and \`timer.cc\`) handles all the signal setup.`,
            codeExample: {
                title: "interrupt.cc — Basic timer interrupt demo",
                language: "cpp",
                code: `// This program runs timer_interrupt_handler every 0.5 seconds
#include <atomic>
#include <iostream>
#include <unistd.h>
#include "timer.hh"

using namespace std;

void timer_interrupt_handler() {
    cout << "Timer interrupt occurred!" << endl;
}

int main(int argc, char *argv[]) {
    // specify microsecond interval and function to call
    timer_init(500000, timer_interrupt_handler);
    while (true) {
        sleep(1);
    }
}`,
                annotations: [
                    { match: `#include "timer.hh"`, explanation: "The timer.hh header provides the timer API: timer_init() to set up periodic interrupts, intr_enable() to enable/disable interrupts, intr_enabled() to check status, and IntrGuard for RAII-style interrupt disabling. This is the same infrastructure you'll use on assign5!" },
                    { match: "void timer_interrupt_handler() {", explanation: "This is the function that will be called every time the timer fires. IMPORTANT: when this function is running, interrupts are globally DISABLED. This means the timer cannot fire again while we're handling it — preventing infinite recursion of timer handlers." },
                    { match: "timer_init(500000, timer_interrupt_handler);", explanation: "timer_init takes two arguments: (1) the interval in MICROSECONDS (500000 μs = 0.5 seconds), and (2) a function to call when the timer fires. Under the hood, this uses Unix signals (SIGALRM) and setitimer() to set up periodic interrupts." },
                    { match: "while (true) {", explanation: "The main thread runs in an infinite loop. Every 0.5 seconds, the timer interrupt fires, temporarily pauses this loop, runs the handler, and then resumes the loop. The main thread doesn't need to do anything special — the interrupt happens automatically!" }
                ]
            },
            keyPoints: [
                "timer_init(usec, handler): set up a timer that calls handler every usec microseconds",
                "The handler runs with interrupts globally DISABLED — the timer can't interrupt itself",
                "After the handler returns, interrupts are automatically re-enabled",
                "intr_enable(true/false): manually enable or disable interrupts",
                "intr_enabled(): check if interrupts are currently enabled",
                "IntrGuard: RAII object that disables interrupts in its constructor and restores state in destructor"
            ]
        },
        {
            id: "timer-internals",
            title: "🔧 Inside the Timer: How Interrupts Are Deferred",
            content: `How does the timer implementation prevent interrupts from firing while the handler is running? Let's look at the approximate logic inside \`timer.cc\`. Understanding this helps you debug assign5!`,
            codeExample: {
                title: "Approximate timer.cc logic (simplified)",
                language: "cpp",
                code: `// Global state: is the timer currently "enabled"?
atomic<int> enabled_flag = 1;   // 1 = interrupts on
atomic<int> interrupted = 0;    // 1 = timer fired while disabled

void timer_interrupt() {
    if (!enabled_flag) {
        // Timer fired while we were handling a previous interrupt!
        // Don't call the handler — just remember it happened
        interrupted = 1;
        return;
    }

    intr_enable(false);          // disable interrupts
    timer_handler();             // call OUR handler
    intr_enable(true);           // re-enable interrupts
}

void intr_enable(bool on) {
    enabled_flag = on;
    // If we're re-enabling and a timer fired while disabled,
    // handle it now
    while (enabled_flag && interrupted) {
        interrupted = 0;
        timer_handler();         // process deferred interrupt
    }
}`,
                annotations: [
                    { match: "atomic<int> enabled_flag = 1;", explanation: "This global flag tracks whether interrupts are 'enabled' or 'disabled'. When disabled (0), any timer firing is DEFERRED — remembered but not processed until interrupts are re-enabled. The 'atomic' type ensures thread-safe reads/writes." },
                    { match: "interrupted = 1;", explanation: "If the timer fires while interrupts are disabled, we set this flag to remember that an interrupt occurred. When interrupts are later re-enabled, we check this flag and process the deferred interrupt. This prevents us from losing timer events." },
                    { match: "intr_enable(false);", explanation: "Before calling our handler, disable interrupts. This ensures that if another timer fires while we're in the handler, it will be deferred (not recursive). This is the 'Do Not Disturb' mechanism." },
                    { match: "while (enabled_flag && interrupted)", explanation: "When re-enabling interrupts, check if any were deferred. If so, process them immediately. The 'while' loop handles the edge case where processing a deferred interrupt takes so long that ANOTHER interrupt fires and gets deferred." }
                ]
            }
        },
        {
            id: "context-switch-preemption",
            title: "💻 Using the Timer for Context Switching",
            content: `Now let's use the timer to implement preemptive context switching between two threads! The idea: when the timer fires, we context-switch to the other thread. But there's a subtle bug lurking...`,
            codeExample: {
                title: "context-switch-preemption-buggy.cc — Preemptive switching (with a bug!)",
                language: "cpp",
                code: `// A thread is a stack plus the current top of the stack
typedef struct Thread {
    char stack[8192];
    char *saved_rsp;
} Thread;

Thread main_thread;
Thread other_thread;
Thread *current_thread;
Thread *nonrunning_thread;

void other_func() {
    // BUG: no intr_enable(true) here!
    while (true) {
        cout << "Other thread here!  Hello." << endl;
    }
}

void timer_interrupt_handler() {
    // We want to run the waiting thread and pause the current thread
    Thread *temp = current_thread;
    current_thread = nonrunning_thread;
    nonrunning_thread = temp;

    context_switch(*nonrunning_thread, *current_thread);
}

int main(int argc, char *argv[]) {
    // Initialize other_thread to run other_func
    other_thread = create_thread(other_func);

    // Keep track of which thread is running and not
    current_thread = &main_thread;
    nonrunning_thread = &other_thread;

    // Fire the timer every 500,000 microseconds to context switch
    timer_init(500000, timer_interrupt_handler);

    while (true) {
        cout << "I am the main thread" << endl;
    }
}`,
                annotations: [
                    { match: "typedef struct Thread {", explanation: "Each thread has its own stack (8KB of memory for local variables and function calls) and a saved stack pointer (saved_rsp). The saved_rsp is like a bookmark — it tells us where to resume when we switch back to this thread." },
                    { match: "// BUG: no intr_enable(true) here!", explanation: "THIS IS THE BUG! When other_func runs for the FIRST time, interrupts are still disabled (because the timer handler disabled them). Since other_func starts at the beginning of the function (not inside the timer handler), interrupts never get re-enabled, and the timer can never fire again!" },
                    { match: "Thread *temp = current_thread;", explanation: "Classic pointer swap: save the current thread pointer, make the non-running thread the current one, and make the old current thread the non-running one. After this, we context_switch to the new 'current_thread'." },
                    { match: "context_switch(*nonrunning_thread, *current_thread);", explanation: "This is the actual context switch: save the registers of nonrunning_thread (the thread that WAS running), and load the registers of current_thread (the thread we WANT to run). After this call, the CPU is executing the other thread!" },
                    { match: "other_thread = create_thread(other_func);", explanation: "create_thread sets up a fake stack frame so that when we context_switch to other_thread for the first time, it 'returns' to the start of other_func. The stack is set up to look like 6 registers were pushed and other_func's address is the return address." },
                    { match: "timer_init(500000, timer_interrupt_handler);", explanation: "Start the timer: every 500,000 μs (0.5 seconds), call timer_interrupt_handler. This handler will perform a context switch between the two threads, creating the illusion of concurrency." }
                ]
            }
        },
        {
            id: "interrupt-handshake",
            title: "🤝 The Interrupt Handshake",
            content: `When switching between two **already-running** threads, interrupts are always properly enabled and disabled. This is the **Interrupt Handshake**: Thread A disables interrupts (via the timer handler), and Thread B re-enables them (when the timer handler returns). Let's trace through this step by step.`,
            keyPoints: [
                "Assumption: single-core system, switching between already-running threads",
                "Step 1: Thread A is running, interrupts are ON",
                "Step 2: Timer fires! → Interrupts automatically turn OFF",
                "Step 3: Timer handler runs, calls context_switch(A, B)",
                "Step 4: Thread B resumes IN its timer handler (where it was paused last time)",
                "Step 5: Thread B's timer handler returns → Interrupts automatically turn back ON",
                "Step 6: Thread B continues executing its user code with interrupts ON",
                "This is the 'handshake': A disables, B re-enables. Symmetric and safe!"
            ],
            diagram: `
The Interrupt Handshake — Step by Step:

  Thread A (running)                          Thread B (paused)
  ══════════════════                          ═════════════════

  ┌──────────────────┐
  │ Interrupts: ON   │
  │ executing code...│
  └────────┬─────────┘
           │ TIMER FIRES!
           ▼
  ┌──────────────────┐
  │ Interrupts: OFF  │ ◄── timer auto-disables interrupts
  │ timer_handler()  │
  │   context_switch │─────────────────────────►┌──────────────────┐
  │   (A → B)        │                          │ Interrupts: OFF  │
  └──────────────────┘                          │ resumes in ITS   │
  A is now paused                               │ timer_handler()  │
  (saved in middle of                           │ handler returns  │
   timer handler)                               └────────┬─────────┘
                                                         │ handler returns
                                                         ▼
                                                ┌──────────────────┐
                                                │ Interrupts: ON   │ ◄── auto re-enabled!
                                                │ executing code...│
                                                └──────────────────┘

  ╔══════════════════════════════════════════════════════════════════╗
  ║  KEY INSIGHT: Both threads' "freeze frames" are inside the      ║
  ║  timer handler. So when either thread resumes, it resumes       ║
  ║  inside the handler, and interrupts are re-enabled on exit.     ║
  ╚══════════════════════════════════════════════════════════════════╝
            `
        },
        {
            id: "new-thread-bug",
            title: "🐛 The New Thread Problem",
            content: `The interrupt handshake works perfectly for threads that have been paused inside the timer handler. But what about a thread running for the **first time**? A new thread starts at the beginning of its function — NOT inside the timer handler. So when we switch to it, **interrupts stay disabled** and the timer never fires again!`,
            keyPoints: [
                "Existing thread: its 'freeze frame' is inside the timer handler → when it resumes, the handler finishes and re-enables interrupts ✓",
                "NEW thread: its 'freeze frame' is at the START of its function → when it resumes, it starts executing user code with interrupts OFF ✗",
                "Result: the timer never fires again, so no more context switches happen — the new thread runs forever!",
                "This is exactly the bug in context-switch-preemption-buggy.cc"
            ],
            diagram: `
Why New Threads Break the Interrupt Handshake:

  ═══ EXISTING THREAD (previously ran and was paused) ═══

  Paused State:                    Resumes:
  ┌──────────────────┐            ┌──────────────────┐
  │ Frozen INSIDE     │    ──►    │ Finishes handler  │
  │ timer_handler()   │           │ Interrupts → ON ✓ │
  │ (after ctx_switch)│           │ Continues user    │
  └──────────────────┘            │ code normally     │
                                  └──────────────────┘

  ═══ NEW THREAD (never ran before) ═══

  Initial State:                   Starts:
  ┌──────────────────┐            ┌──────────────────┐
  │ Frozen at START   │    ──►    │ Starts other_func │
  │ of other_func()   │           │ Interrupts: OFF ✗ │
  │ (via create_thread)│          │ Timer never fires │
  └──────────────────┘            │ again! STUCK! 😱  │
                                  └──────────────────┘
            `
        },
        {
            id: "new-thread-fix",
            title: "✅ The Fix: Enable Interrupts on First Run",
            content: `The solution is simple: when a thread runs for the **first time**, it must manually enable interrupts. This completes the interrupt handshake for new threads.`,
            codeExample: {
                title: "context-switch-preemption.cc — Fixed version",
                language: "cpp",
                code: `void other_func() {
    intr_enable(true);  // FIX: enable interrupts on first run!
    while (true) {
        cout << "Other thread here!  Hello." << endl;
    }
}

// On assign5, you'll do this in thread_start():
void Thread::thread_start(Thread *t) {
    intr_enable(true);   // complete the interrupt handshake
    t->main();           // run the thread's main function
    Thread::exit();      // clean up if main() returns
}`,
                annotations: [
                    { match: "intr_enable(true);  // FIX: enable interrupts on first run!", explanation: "This single line fixes the bug! When a new thread starts running, interrupts are disabled (because the timer handler that triggered the context switch disabled them). By calling intr_enable(true), we complete the interrupt handshake: the old thread disabled interrupts, and we (the new thread) re-enable them." },
                    { match: "void Thread::thread_start(Thread *t) {", explanation: "On assign5, this is where you'll enable interrupts. thread_start is the first function a new thread runs. It enables interrupts, calls the thread's main function, and cleans up with Thread::exit() if main returns. This is the 'trampoline' that sets up the thread properly." },
                    { match: "intr_enable(true);   // complete the interrupt handshake", explanation: "This ONLY needs to happen for NEW threads on their first run. Already-running threads that were paused will resume inside the timer handler, where interrupts are automatically re-enabled when the handler returns." },
                    { match: "Thread::exit();      // clean up if main() returns", explanation: "If the thread's main function returns (instead of running forever), we need to clean up: remove the thread from the system and switch to the next ready thread. Thread::exit() handles this — it never returns because the thread no longer exists." }
                ]
            },
            keyPoints: [
                "Only needed for NEW threads — threads running for the first time",
                "Already-running threads resume inside the timer handler, which auto-re-enables interrupts",
                "On assign5: put intr_enable(true) at the start of Thread::thread_start()",
                "This is a VERY common assign5 bug: forgetting this line causes the system to freeze after the first context switch to a new thread"
            ]
        },
        {
            id: "interrupts-summary",
            title: "📋 Interrupts: Key Rules Summary",
            content: `Before we move on to implementing locks, let's consolidate everything we know about interrupts. These rules are critical for assign5 and the exam.`,
            keyPoints: [
                "Rule 1: Interrupts can be turned on and off GLOBALLY (not per-thread)",
                "Rule 2: When the timer fires, it DISABLES interrupts, runs the handler, then RE-ENABLES them",
                "Rule 3: New threads must MANUALLY enable interrupts (intr_enable(true)) on first run",
                "Rule 4: The 'Interrupt Handshake' — when switching A → B, A disables and B re-enables",
                "Rule 5: If interrupts fire while disabled, they are DEFERRED (not lost!) and processed when re-enabled",
                "Rule 6: Only OS/kernel code can disable interrupts — user programs cannot"
            ],
            diagram: `
Interrupt Rules Cheat Sheet:

┌────────────────────────────────────────────────────────────┐
│  INTERRUPT HANDSHAKE (the most important concept!)         │
│                                                            │
│  Thread A ──[timer fires]──► interrupts OFF                │
│           ──[context switch]──►                             │
│                              Thread B resumes              │
│                              ──[handler returns]──►         │
│                              interrupts ON                  │
│                                                            │
│  Exception: NEW threads don't resume in handler,           │
│  so they must manually call intr_enable(true)!             │
├────────────────────────────────────────────────────────────┤
│  DEFERRED INTERRUPTS                                       │
│                                                            │
│  If timer fires while interrupts are OFF:                  │
│    → set interrupted = 1 (remember it happened)            │
│    → when intr_enable(true) is called later, process it    │
│    → interrupts are NEVER LOST, just delayed               │
├────────────────────────────────────────────────────────────┤
│  ASSIGN5 CHECKLIST                                         │
│    ☐ Call intr_enable(true) in thread_start()              │
│    ☐ Use timer_init() in preempt_init()                    │
│    ☐ Context switch in your timer handler                  │
│    ☐ Disable interrupts before modifying shared state      │
└────────────────────────────────────────────────────────────┘
            `
        },
        {
            id: "implementing-locks-intro",
            title: "🔒 Implementing Locks: Design",
            content: `Now that we understand thread dispatching, scheduling, and preemption, we can write our own **mutex implementation**! Mutexes need to **block threads** — functionality that the dispatcher/scheduler provides. Let's design the lock's internal state.`,
            keyPoints: [
                "A lock needs to track three things:",
                "  1. Whether it is LOCKED or UNLOCKED (a boolean/int flag)",
                "  2. The lock OWNER — which thread currently holds the lock (or null if unlocked)",
                "  3. A WAITING QUEUE — threads blocked waiting to acquire this lock",
                "We use a QUEUE (not a set) for fairness — threads get the lock in FIFO order",
                "Key operations: lock() and unlock()",
                "lock() either acquires immediately (if unlocked) or blocks the calling thread",
                "unlock() either marks as unlocked (if no waiters) or hands off to next waiter"
            ],
            diagram: `
Lock Internal State:

  ┌─────────────────────────────────────────────────┐
  │  Mutex Object                                   │
  │                                                 │
  │  ┌─────────────────┐                            │
  │  │ int locked = 0   │  0 = unlocked, 1 = locked │
  │  └─────────────────┘                            │
  │                                                 │
  │  ┌─────────────────┐                            │
  │  │ Thread* owner    │  who holds the lock?      │
  │  └─────────────────┘  (nullptr if unlocked)     │
  │                                                 │
  │  ┌─────────────────────────────────┐            │
  │  │ Queue<Thread*> waiting_threads  │            │
  │  │  ┌────┬────┬────┐              │            │
  │  │  │ T2 │ T3 │ T4 │  (FIFO)     │            │
  │  │  └────┴────┴────┘              │            │
  │  └─────────────────────────────────┘            │
  └─────────────────────────────────────────────────┘
            `
        },
        {
            id: "implementing-lock",
            title: "🔒 Implementing Lock::lock()",
            content: `The \`lock()\` method has two cases: if the lock is unlocked, grab it immediately. If it's already locked, add the current thread to the waiting queue and **block** (sleep) the thread — switching to the next ready thread.`,
            codeExample: {
                title: "Lock::lock() implementation",
                language: "cpp",
                code: `// Instance variables
int locked = 0;
ThreadQueue q;    // queue of BLOCKED threads, not ready threads

void Lock::lock() {
    if (!locked) {
        // Case 1: lock is available — grab it!
        locked = 1;
    } else {
        // Case 2: lock is held by someone else — we must wait
        q.add(currentThread);
        blockThread();     // block current thread, switch to next ready
    }
}`,
                annotations: [
                    { match: "int locked = 0;", explanation: "Simple integer flag: 0 means unlocked, 1 means locked. We could combine this with an 'owner' pointer (owner == nullptr means unlocked), but keeping them separate makes the logic clearer." },
                    { match: "ThreadQueue q;", explanation: "This queue holds threads that are BLOCKED waiting for this lock. These are NOT in the ready queue — they cannot run until the lock is released. Using a queue (FIFO) ensures fairness: the thread that's been waiting the longest gets the lock first." },
                    { match: "locked = 1;", explanation: "If the lock is available, mark it as locked. The calling thread now 'owns' the lock and can proceed into the critical section. No blocking needed!" },
                    { match: "q.add(currentThread);", explanation: "If the lock is already held, add the current thread to the BACK of the waiting queue. This thread will be woken up (unblocked) when the lock holder calls unlock()." },
                    { match: "blockThread();", explanation: "This is the key operation! blockThread() does NOT add the thread to the ready queue. Instead, it switches to the next READY thread. The current thread is now BLOCKED — it won't run again until someone calls unblockThread() on it (which unlock() does). This is similar to Thread::redispatch() on assign5." }
                ]
            }
        },
        {
            id: "implementing-unlock",
            title: "🔓 Implementing Lock::unlock()",
            content: `The \`unlock()\` method also has two cases: if no threads are waiting, simply mark the lock as unlocked. If threads are waiting, **keep the lock locked** but hand ownership to the next waiting thread by unblocking it.`,
            codeExample: {
                title: "Lock::unlock() implementation",
                language: "cpp",
                code: `// Instance variables
int locked = 0;
ThreadQueue q;

void Lock::unlock() {
    if (q.empty()) {
        // Case 1: no one waiting — just unlock
        locked = 0;
    } else {
        // Case 2: someone is waiting — hand off the lock
        unblockThread(q.remove());  // move first waiter to ready queue
    }
}`,
                annotations: [
                    { match: "locked = 0;", explanation: "If no threads are waiting, simply mark the lock as unlocked. The next thread that calls lock() will find it available and grab it immediately (Case 1 of lock())." },
                    { match: "unblockThread(q.remove());", explanation: "If threads are waiting, remove the FIRST one from the queue (FIFO fairness!) and move it to the READY queue. This thread will eventually be scheduled to run, and when it does, it will resume after its blockThread() call inside lock(), believing it now holds the lock." },
                    { match: "// Case 2: someone is waiting — hand off the lock", explanation: "CRITICAL DETAIL: we do NOT set locked = 0! The lock stays locked. We're transferring ownership directly from the current thread to the next waiter. The waiter may not run immediately — other threads could run first — but it's guaranteed to own the lock when it does run." }
                ]
            },
            keyPoints: [
                "When handing off: the mutex STAYS LOCKED — we're transferring ownership, not unlocking",
                "The new owner may not run immediately! It's just moved to the ready queue",
                "But no other thread can grab the lock because it's still marked as locked",
                "This prevents a race where a third thread could sneak in between unlock and the waiter waking up",
                "On assign5: unblockThread corresponds to calling schedule() on the waiting thread"
            ],
            diagram: `
Lock Handoff — Why the Lock Stays Locked:

  Thread A (owner)           Lock State           Thread B (waiting)
  ═══════════════           ══════════           ═════════════════

  A calls unlock()
  ┌──────────────┐     ┌─────────────────┐
  │ q not empty! │     │ locked = 1      │     ┌──────────────┐
  │ unblock(B)   │────►│ Queue: [B] → [] │────►│ B moved to   │
  │              │     │ locked = 1 ←──  │     │ READY queue  │
  └──────────────┘     │ (stays locked!) │     └──────────────┘
                       └─────────────────┘

  Why not set locked=0?

  ┌──────────────────────────────────────────────────────────┐
  │ If we set locked=0 before B runs:                        │
  │                                                          │
  │   Thread C comes along, calls lock()                     │
  │   Sees locked == 0, grabs the lock!                      │
  │   Now BOTH B and C think they own the lock! 😱            │
  │                                                          │
  │ By keeping locked=1, C will be blocked if it tries to    │
  │ acquire, and B is guaranteed exclusive ownership.        │
  └──────────────────────────────────────────────────────────┘
            `
        },
        {
            id: "lock-race-conditions",
            title: "⚠️ Race Conditions in Lock Implementations",
            content: `Here's the ironic twist: our lock implementation itself has **race conditions**! Since we can be interrupted at any point to switch to another thread, the lock's internal state (the \`locked\` flag and the queue) could be corrupted. We can have race conditions within the thing that helps us prevent race conditions!`,
            keyPoints: [
                "Problem: what if the timer fires in the MIDDLE of lock() or unlock()?",
                "Example race in lock(): thread checks 'locked == 0', gets interrupted, another thread also checks 'locked == 0' → both think they got the lock!",
                "We can't use a mutex to protect the mutex — that's circular!",
                "Solution preview (Lecture 20): disable interrupts inside lock() and unlock()",
                "By disabling interrupts, we prevent context switches during critical sections of the lock code",
                "This is safe because only OS code (not user code) can disable interrupts",
                "On assign5: you'll use IntrGuard or intr_enable(false) inside your mutex implementation"
            ],
            diagram: `
Race Condition in lock() — The Problem:

  Thread A                         Thread B
  ════════                         ════════

  lock() called
  checks: locked == 0? YES
  ─── TIMER INTERRUPT! ───────►
                                   lock() called
                                   checks: locked == 0? YES
                                   sets locked = 1
                                   enters critical section
  ◄──── TIMER INTERRUPT ──────
  sets locked = 1
  enters critical section

  BOTH threads think they have the lock! 💥

  ╔════════════════════════════════════════════════════════════╗
  ║  SOLUTION (Lecture 20): disable interrupts inside lock()  ║
  ║                                                           ║
  ║  void Lock::lock() {                                      ║
  ║      intr_enable(false);  // no interrupts!               ║
  ║      if (!locked) {                                       ║
  ║          locked = 1;                                      ║
  ║      } else {                                             ║
  ║          q.add(currentThread);                             ║
  ║          blockThread();                                    ║
  ║      }                                                    ║
  ║      intr_enable(true);   // safe to re-enable            ║
  ║  }                                                        ║
  ╚════════════════════════════════════════════════════════════╝
            `
        },
        {
            id: "assign5-connection",
            title: "🎯 assign5 Connection",
            content: `Everything in this lecture maps directly to assign5. Here's how the concepts translate to the code you'll write.`,
            codeExample: {
                title: "assign5 API overview — what you implement",
                language: "cpp",
                code: `// thread.hh — Thread class (you implement these methods)
class Thread {
    static queue<Thread*> ready_;        // the ready queue

    Thread(function<void()> main);       // create a new thread
    void schedule();                     // add to ready queue
    static void yield();                 // voluntarily give up CPU
    static Thread* current();            // get running thread
    static void redispatch();            // switch to next ready thread
    static void exit();                  // terminate current thread
    static void preempt_init(uint64_t usec = 100000);  // enable preemption
    static void thread_start(Thread *t); // first function a new thread runs
};

// sync.hh — Mutex and Condition (you implement these)
class Mutex {
    void lock();       // acquire (block if needed)
    void unlock();     // release (wake waiter if any)
    bool mine();       // does current thread own this?
};

class Condition {
    void wait(Mutex &m);    // release mutex, block, reacquire
    void notify_one();      // wake one waiting thread
    void notify_all();      // wake all waiting threads
};`,
                annotations: [
                    { match: "static queue<Thread*> ready_;", explanation: "The ready queue — shared across all Thread objects (static). This holds threads that are ready to run but waiting for the CPU. On a yield() or preemption, the current thread goes to the back of this queue." },
                    { match: "Thread(function<void()> main);", explanation: "Constructor: create a new thread that will run 'main'. You need to allocate a stack, set up the stack so that context_switch will 'return' to thread_start(), and add the thread to the ready queue." },
                    { match: "static void redispatch();", explanation: "Switch to the next ready thread. This is called with interrupts DISABLED (the assert checks this!). It removes the front thread from ready_ and context-switches to it. Critical for both preemption and blocking." },
                    { match: "static void preempt_init(uint64_t usec = 100000);", explanation: "Enable preemptive scheduling! Call timer_init() with the given interval and a handler that performs a context switch. Default time slice is 100,000 μs (0.1 seconds)." },
                    { match: "static void thread_start(Thread *t);", explanation: "The 'trampoline' function — first thing a new thread runs. MUST call intr_enable(true) to complete the interrupt handshake! Then calls t->main(), then Thread::exit() if main returns." },
                    { match: "void lock();       // acquire (block if needed)", explanation: "Your Mutex::lock() must: disable interrupts, check if locked, either acquire or block (add to waiting queue + redispatch), then re-enable interrupts. The waiting queue is per-Mutex (not the global ready queue)." },
                    { match: "void wait(Mutex &m);    // release mutex, block, reacquire", explanation: "Condition::wait() atomically releases the mutex and blocks the thread. When woken by notify, it reacquires the mutex before returning. This is the trickiest part of assign5!" }
                ]
            },
            diagram: `
assign5 Architecture Map:

  ┌─────────────────────────────────────────────────────────┐
  │                    YOUR CODE                            │
  │                                                         │
  │  thread.cc                        sync.cc               │
  │  ┌───────────────────┐           ┌──────────────────┐  │
  │  │ Thread()           │           │ Mutex::lock()    │  │
  │  │ schedule()         │           │ Mutex::unlock()  │  │
  │  │ yield()            │           │ Mutex::mine()    │  │
  │  │ redispatch()       │           │                  │  │
  │  │ exit()             │           │ Condition::wait()│  │
  │  │ preempt_init()     │           │ Condition::      │  │
  │  │ thread_start()     │           │   notify_one/all │  │
  │  └─────────┬─────────┘           └────────┬─────────┘  │
  │            │                               │            │
  │            │   Uses context_switch()       │            │
  │            │   and timer API               │   Uses     │
  │            ▼                               │  Thread    │
  │  ┌───────────────────┐                     │   API      │
  │  │ PROVIDED CODE:    │◄────────────────────┘            │
  │  │ stack.hh/cc       │                                  │
  │  │ timer.hh/cc       │                                  │
  │  │ context_switch()  │                                  │
  │  └───────────────────┘                                  │
  └─────────────────────────────────────────────────────────┘
            `
        },
        {
            id: "exam-prep",
            title: "📝 Exam Prep: Preemption & Locks",
            content: `This lecture covers several key exam topics. Make sure you understand these concepts deeply.`,
            keyPoints: [
                "📝 Explain how timer interrupts enable preemptive scheduling",
                "📝 Trace through the Interrupt Handshake step by step (draw the diagram!)",
                "📝 Explain WHY new threads need intr_enable(true) but existing threads don't",
                "📝 Explain the difference between the READY queue and a lock's WAITING queue",
                "📝 Implement Lock::lock() and Lock::unlock() from scratch (given blockThread/unblockThread)",
                "📝 Explain why the lock STAYS LOCKED during a handoff in unlock()",
                "📝 Identify the race condition in a naive lock implementation",
                "📝 Explain why we can't use a mutex to protect the mutex implementation",
                "📝 Describe how disabling interrupts solves race conditions in lock code"
            ],
            diagram: `
Lecture 19 Exam Cheat Sheet:

┌──────────────────────────────────────────────────────────────────┐
│  PREEMPTION: timer fires → interrupt handler → context switch   │
│                                                                  │
│  INTERRUPT HANDSHAKE: A disables, B re-enables                   │
│    • Already-running thread: resumes in handler → auto re-enable │
│    • NEW thread: starts at func start → MUST call intr_enable!   │
│                                                                  │
│  LOCK STATE: locked flag + owner + waiting queue (FIFO)          │
│                                                                  │
│  lock(): if unlocked → grab it. if locked → block (sleep).      │
│  unlock(): if no waiters → unlock. if waiters → hand off        │
│            (keep locked! transfer ownership)                     │
│                                                                  │
│  RACE IN LOCK CODE: check-then-act on 'locked' is not atomic    │
│  FIX: disable interrupts in lock()/unlock() (Lecture 20)        │
│                                                                  │
│  KEY TAKEAWAY: To implement preemption and locks, we must        │
│  correctly enable and disable interrupts. Locks = waiting queue  │
│  + context switching to make threads sleep.                      │
└──────────────────────────────────────────────────────────────────┘
            `
        },
        {
            id: "next-time",
            title: "Coming Up Next",
            content: `Next lecture: **Implementing Locks and Condition Variables (continued)** — we'll solve the race condition problem in our lock implementation by disabling interrupts, and then tackle the even trickier **condition variable** implementation.`,
            keyPoints: [
                "Solving race conditions in lock/unlock using interrupt disabling",
                "Complete, correct mutex implementation with IntrGuard",
                "Implementing condition variables: wait(), notify_one(), notify_all()",
                "The tricky atomicity requirement: wait() must release the lock AND block atomically",
                "More assign5 implementation details and tips"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Interrupt Handshake Trace",
            difficulty: "medium",
            description: "Thread A and Thread B are both already running (have been context-switched before). Thread A is currently executing user code with interrupts ON. Trace what happens when the timer fires, including the state of interrupts at each step.",
            starterCode: `// Trace the interrupt state at each step:

// Step 1: Thread A is running, interrupts are ___
// Step 2: Timer fires → interrupts become ___
// Step 3: timer_handler() runs, calls context_switch(A, B)
//         After switch, which thread is running? ___
//         Interrupts are: ___
// Step 4: What happens next to re-enable interrupts?
// Step 5: Thread B continues executing, interrupts are ___

// BONUS: When the timer fires again and switches back to A,
// where does A resume? What are interrupts at that point?`,
            solution: `// Step 1: Thread A is running, interrupts are ON
//   (Normal execution state — timer can fire)

// Step 2: Timer fires → interrupts become OFF
//   (Timer handler automatically disables interrupts)

// Step 3: timer_handler() runs, calls context_switch(A, B)
//   After switch: Thread B is running
//   Interrupts are: OFF
//   (We're now on B's stack, but still inside B's timer_handler)

// Step 4: B's timer_handler() returns
//   The timer infrastructure automatically re-enables interrupts
//   This completes the "interrupt handshake"

// Step 5: Thread B continues executing, interrupts are ON
//   (B is back in its user code, timer can fire again)

// BONUS: When timer fires again:
//   A resumes INSIDE its timer_handler (right after its
//   context_switch call). The handler returns, interrupts
//   are re-enabled, and A continues its user code.
//   This is symmetric — same thing happens every time!`,
            explanation: "The interrupt handshake is symmetric: the thread being switched AWAY from always has interrupts disabled (by the timer), and the thread being switched TO always re-enables interrupts (when its timer handler returns). This ensures interrupts are always properly managed."
        },
        {
            id: "ex2",
            title: "New Thread Interrupt Bug",
            difficulty: "medium",
            description: "Thread A is running. Thread B has never run before (just created). The timer fires and we context-switch to B. Trace what happens and explain the bug. Then show the fix.",
            starterCode: `// Thread A: currently running (has run before)
// Thread B: just created, never run

// Trace what happens:
// 1. Timer fires, interrupts → ___
// 2. timer_handler context_switches to B
// 3. B starts running at the start of ___
// 4. Interrupts are: ___
// 5. What goes wrong?

// Fix:
// What line of code fixes this?
// Where should it go?`,
            solution: `// 1. Timer fires, interrupts → OFF
//    (Timer handler always disables interrupts)

// 2. timer_handler calls context_switch(A, B)
//    A is saved in the middle of timer_handler
//    B's stack was set up by create_thread to "return" to its function

// 3. B starts running at the start of other_func()
//    (NOT inside a timer handler — B has never been in one!)

// 4. Interrupts are: OFF ← THIS IS THE PROBLEM!
//    No one re-enables them! The timer handler for A disabled them,
//    and B doesn't have a timer handler to return from.

// 5. What goes wrong:
//    The timer can never fire again (interrupts are off)
//    Thread B runs FOREVER without being preempted
//    Thread A never gets to run again
//    The system is effectively frozen on Thread B

// Fix: add intr_enable(true) at the start of the thread function:
//
// void other_func() {
//     intr_enable(true);  // ← THE FIX!
//     while (true) {
//         cout << "Other thread here!" << endl;
//     }
// }
//
// On assign5, put it in Thread::thread_start():
// void Thread::thread_start(Thread *t) {
//     intr_enable(true);  // complete interrupt handshake
//     t->main();
//     Thread::exit();
// }`,
            explanation: "New threads start at the beginning of their function, not inside a timer handler. So there's no 'handler return' to re-enable interrupts. The fix is to manually enable interrupts as the very first thing a new thread does. This is one of the most common bugs on assign5!"
        },
        {
            id: "ex3",
            title: "Lock Implementation: Trace Through Scenarios",
            difficulty: "medium",
            description: "Given our Lock::lock() and Lock::unlock() implementations, trace through the following scenario. Threads call lock/unlock in this order: T1.lock(), T2.lock(), T3.lock(), T1.unlock(), T2.unlock(), T3.unlock(). Show the state of the lock after each operation.",
            starterCode: `// Lock state: locked (0 or 1), queue contents

// After T1.lock():
//   locked = ???, queue = ???, T1 state = ???

// After T2.lock():
//   locked = ???, queue = ???, T2 state = ???

// After T3.lock():
//   locked = ???, queue = ???, T3 state = ???

// After T1.unlock():
//   locked = ???, queue = ???, which thread is unblocked? ___

// After T2.unlock() (T2 now runs and eventually calls unlock):
//   locked = ???, queue = ???, which thread is unblocked? ___

// After T3.unlock() (T3 now runs and eventually calls unlock):
//   locked = ???, queue = ???`,
            solution: `// After T1.lock():
//   locked = 1, queue = [], T1 state = RUNNING (owns lock)
//   (Lock was unlocked, so T1 grabs it immediately)

// After T2.lock():
//   locked = 1, queue = [T2], T2 state = BLOCKED
//   (Lock is held by T1, so T2 is added to queue and blocked)

// After T3.lock():
//   locked = 1, queue = [T2, T3], T3 state = BLOCKED
//   (Lock is held by T1, so T3 is added to queue and blocked)

// After T1.unlock():
//   locked = 1, queue = [T3], T2 is UNBLOCKED (moved to ready queue)
//   (Queue not empty → hand off to T2. Lock STAYS LOCKED!)
//   (T2 is now the owner, but may not run immediately)

// After T2.unlock() (once T2 runs):
//   locked = 1, queue = [], T3 is UNBLOCKED (moved to ready queue)
//   (Queue not empty → hand off to T3. Lock STAYS LOCKED!)

// After T3.unlock() (once T3 runs):
//   locked = 0, queue = []
//   (Queue IS empty → set locked = 0. Lock is now free!)`,
            explanation: "Key observations: (1) The lock only actually becomes unlocked (locked=0) when there are NO waiters. Otherwise, ownership is transferred directly. (2) The FIFO queue ensures T2 gets the lock before T3 (fairness). (3) When a thread is unblocked, it moves to the READY queue — it doesn't run immediately. It will resume inside lock() after the blockThread() call."
        },
        {
            id: "ex4",
            title: "Lock Race Condition",
            difficulty: "hard",
            description: "Show a specific interleaving where our naive lock() implementation (without interrupt disabling) causes BOTH Thread A and Thread B to enter the critical section simultaneously.",
            starterCode: `// Naive lock() — NO interrupt protection:
// void Lock::lock() {
//     if (!locked) {         // line 1: check
//         locked = 1;        // line 2: set
//     } else {
//         q.add(currentThread);
//         blockThread();
//     }
// }

// Thread A calls lock()
// Thread B calls lock()
// The lock starts UNLOCKED (locked = 0)

// Show an interleaving (which lines execute in what order)
// that results in both threads entering the critical section:

// Step 1: Thread ___ executes line ___
// Step 2: TIMER INTERRUPT → switch to Thread ___
// Step 3: Thread ___ executes line ___
// ...
// Result: ???`,
            solution: `// The lock starts UNLOCKED (locked = 0)

// Step 1: Thread A executes line 1: if (!locked)
//   locked is 0, so the condition is TRUE
//   A is about to set locked = 1, but...

// Step 2: TIMER INTERRUPT → switch to Thread B
//   A hasn't set locked = 1 yet!

// Step 3: Thread B executes line 1: if (!locked)
//   locked is STILL 0 (A didn't get to set it!)
//   so the condition is TRUE for B too!

// Step 4: Thread B executes line 2: locked = 1
//   B thinks it has the lock. Enters critical section.

// Step 5: TIMER INTERRUPT → switch back to Thread A
//   A resumes where it left off (after the if check)

// Step 6: Thread A executes line 2: locked = 1
//   A also thinks it has the lock. Enters critical section.

// Result: BOTH Thread A and Thread B are in the critical section!
//   This is a race condition — the check-then-set is not atomic.
//   The "window of vulnerability" is between checking locked
//   and setting locked.

// FIX: disable interrupts around the entire lock() body:
// void Lock::lock() {
//     intr_enable(false);    // prevent timer interrupts
//     if (!locked) {
//         locked = 1;
//     } else {
//         q.add(currentThread);
//         blockThread();
//     }
//     intr_enable(true);     // safe to re-enable
// }`,
            explanation: "The 'check-then-act' pattern is the classic source of race conditions. Between the check (is the lock free?) and the act (grab the lock), another thread can sneak in and also see the lock as free. The solution is to make the check-and-act ATOMIC by disabling interrupts — preventing any context switch during the critical operation. This is the fundamental insight: we use hardware-level atomicity (interrupt disabling) to build software-level atomicity (mutexes)."
        },
        {
            id: "ex5",
            title: "assign5 Design: preempt_init and thread_start",
            difficulty: "medium",
            description: "Write pseudocode for Thread::preempt_init() and Thread::thread_start() for assign5. Use the timer API and interrupt functions discussed in lecture.",
            starterCode: `// Write pseudocode for these two functions:

void Thread::preempt_init(uint64_t usec) {
    // How do you set up preemptive scheduling?
    // What timer function do you call?
    // What does your timer handler do?
}

void Thread::thread_start(Thread *t) {
    // What must happen when a new thread first runs?
    // What about interrupts?
    // What if the thread's main function returns?
}`,
            solution: `void Thread::preempt_init(uint64_t usec) {
    // Set up a timer that fires every 'usec' microseconds.
    // The handler should perform a context switch.
    timer_init(usec, []() {
        // Timer handler — called with interrupts disabled
        Thread *old = current_thread;
        old->schedule();          // put current thread back in ready queue
        Thread::redispatch();     // switch to next ready thread
    });
}

// Note: the exact implementation depends on your design.
// The key idea: every time the timer fires, move the current
// thread to the back of the ready queue and switch to the next.

void Thread::thread_start(Thread *t) {
    // Step 1: Enable interrupts!
    // We were switched to from a timer handler, which disabled
    // interrupts. Since this is a NEW thread (not resuming from
    // a handler), we must manually re-enable them.
    intr_enable(true);

    // Step 2: Run the thread's main function
    t->main();

    // Step 3: If main() returns, the thread is done.
    // Clean up and switch to another thread.
    Thread::exit();

    // exit() never returns — the thread ceases to exist.
}`,
            explanation: "preempt_init() sets up Round Robin scheduling by using the timer to periodically move the current thread to the back of the ready queue and dispatch the next thread. thread_start() is the 'trampoline' for new threads: enable interrupts (interrupt handshake!), run main, and clean up. Forgetting intr_enable(true) in thread_start is one of the most common assign5 bugs."
        }
    ]
};

export default lecture19;
