export const lecture18 = {
    id: 18,
    title: "Scheduling",
    subtitle: "How the OS Decides Which Thread Runs Next",
    keyTakeaway: "For scheduling, we want to minimize response time, use resources efficiently, and be fair. SRPT is the best algorithm to minimize average response time, but we can only approximate it because it requires predicting the future. Priority-based scheduling uses past behavior to approximate SRPT, adjusting thread priorities based on CPU usage so that I/O-bound threads get preference while long-running threads aren't neglected.",

    sections: [
        {
            id: "topic-overview",
            title: "Topic 3: Multithreading, Part 7",
            content: `Last lecture we learned **how** the OS switches between threads (dispatching / context switching). Now we ask: **which** thread should the OS run next, and **for how long**? This is the **scheduling** problem. These ideas will be critical for **assign5**, where you implement your own thread library with round-robin scheduling!`,
            keyPoints: [
                "Lecture 17 (Dispatching): the MECHANISM — HOW to switch threads (context switch)",
                "Lecture 18 (Scheduling): the POLICY — WHICH thread to run next, and for how long",
                "Lecture 19: Scheduling + Preemption (timer interrupts force switches)",
                "Lecture 20: Implementing locks and condition variables",
                "assign5: implement your own thread, mutex, and condition_variable_any!"
            ],
            diagram: `
Topic 3: Multithreading — Implementation Roadmap:

┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Lecture 17   │ →  │  Lecture 18   │ →  │  Lecture 19   │ →  │  Lecture 20   │
│               │    │               │    │               │    │               │
│ Dispatching   │    │ Scheduling    │    │ Scheduling &  │    │ Implementing  │
│ (context      │    │ (which thread │    │ Preemption    │    │ Locks and CVs │
│  switching)   │    │  runs next?)  │    │ (timer ints)  │    │               │
│               │    │               │    │               │    │               │
│ (Done!)       │    │ (This one!)   │    │  (Next)       │    │               │
└───────────────┴────┴───────────────┴────┴───────────────┴────┴───────────────┘

assign5: implement your own version of thread, mutex and condition_variable_any!
            `
        },
        {
            id: "dispatching-recap",
            title: "🔄 Recap: Dispatching (Lecture 17)",
            content: `Quick recap of the key ideas from last lecture. When we want to run a new thread, we perform a **context switch**: save the current thread's register values ("freeze frame"), and load in the saved registers of the thread we want to run.`,
            keyPoints: [
                "Context switch: save current registers → load new thread's registers",
                "Thread state stored in Process Control Block (PCB) — specifically the saved %rsp",
                "The context_switch function pushes registers on current stack, saves %rsp, loads new %rsp, pops registers",
                "Super funky: you call context_switch from one thread and 'return' from it in another thread!",
                "Traps (syscalls, errors) and Interrupts (keyboard, disk, TIMER) give the OS control back",
                "Timer interrupt is crucial — ensures OS ALWAYS eventually regains control",
                "New threads get a fake 'saved state' so context_switch 'returns' to their start function"
            ]
        },
        {
            id: "thread-states",
            title: "📊 Thread States: Running, Ready, Blocked",
            content: `How does the OS track all the threads on the system? At any given time, every thread is in exactly one of **three states**. Understanding these states and the valid transitions between them is fundamental to understanding scheduling.`,
            keyPoints: [
                "RUNNING: the thread is currently executing on a CPU core",
                "READY: the thread CAN run (has work to do) but is waiting for a CPU core",
                "BLOCKED: the thread CANNOT run — it's waiting for an external event (disk I/O, network, lock, etc.)",
                "A newly created thread starts in the READY state",
                "When the OS assigns a thread to a core: READY → RUNNING",
                "When the OS preempts a thread (needs the core for someone else): RUNNING → READY",
                "When a running thread must wait for something: RUNNING → BLOCKED",
                "When the event a blocked thread was waiting for completes: BLOCKED → READY (or BLOCKED → RUNNING if core available)",
                "IMPORTANT: You CANNOT go from READY → BLOCKED! A thread must actually RUN to discover it needs to wait",
                "KEY QUESTION: if we have many READY threads, how do we decide who to run next?"
            ],
            diagram: `
Thread State Diagram:

                         ┌──────────────────────────────────────────┐
                         │            Thread is created             │
                         └──────────────────┬───────────────────────┘
                                            │
                                            ▼
                    ┌─────────────────── READY ◄──────────────────────┐
                    │                    ▲   ▲                        │
                    │  OS assigns        │   │                        │
                    │  core to thread    │   │  Event completes       │
                    │                    │   │  (but no core free)    │
                    ▼                    │   │                        │
                 RUNNING ────────────────┘   └──────── BLOCKED        │
                    │   OS needs core                    ▲            │
                    │   for another thread               │            │
                    │                                    │            │
                    └────────────────────────────────────┘            │
                       Thread must wait for                          │
                       something (I/O, lock, etc.)                   │
                                                                     │
                    ┌────────────────────────────────────────────────┘
                    │  Event completes AND core is available:
                    │  BLOCKED → RUNNING (shortcut)
                    └──────────────────────────────────────

  ╔═══════════════════════════════════════════════════════════════╗
  ║  INVALID: READY → BLOCKED                                    ║
  ║  Why? A thread must actually EXECUTE (run) to discover        ║
  ║  that it needs to wait for something!                         ║
  ╚═══════════════════════════════════════════════════════════════╝
            `
        },
        {
            id: "fcfs",
            title: "📋 Approach #1: First-Come First-Serve (FCFS)",
            content: `Our first scheduling algorithm is the simplest: maintain a **ready queue** of all threads that want to run. Add new threads to the back. Run whatever thread is at the front until it either **exits** or **blocks** (no timer — the thread runs as long as it wants!). Assume just 1 core.`,
            keyPoints: [
                "Also called FIFO (First-In, First-Out)",
                "Ready queue: threads are added to the back when they become ready",
                "The scheduler picks the thread at the FRONT of the queue",
                "The thread runs until it either FINISHES or BLOCKS (waits for I/O, etc.)",
                "There is NO timer — no forced preemption!",
                "Simple to implement — just a queue",
                "BIG PROBLEM: a thread could run forever and never give up the CPU!",
                "No fairness guarantee — one thread can monopolize the core",
                "Other ready threads starve while waiting"
            ],
            diagram: `
First-Come First-Serve (FCFS / FIFO):

  Ready Queue:
  ┌───────┬───────┬───────┬───────┐
  │ T1    │ T2    │ T3    │ T4    │ ──► new threads added to back
  └───┬───┴───────┴───────┴───────┘
      │
      ▼ Front of queue runs on CPU
  ┌─────────────────────────┐
  │  CPU Core               │
  │  Running: T1            │
  │  (runs until T1 exits   │
  │   or blocks — could be  │
  │   FOREVER!)             │
  └─────────────────────────┘

  Problem: What if T1 is an infinite loop?
  ┌───────────────────────────────────────────┐
  │ T1: while(true) { compute(); }            │
  │                                           │
  │ T2, T3, T4: NEVER get to run! 😱          │
  └───────────────────────────────────────────┘
            `
        },
        {
            id: "round-robin",
            title: "🔁 Approach #2: Round Robin",
            content: `The problem with FCFS is that a thread can run forever. The fix: define a **time slice** (also called a **quantum**) — the maximum amount of time a thread can run before being forced to give up the CPU. After a time slice, the thread goes to the back of the ready queue and the next thread gets to run. **You'll use this algorithm on assign5!**`,
            keyPoints: [
                "Time slice (quantum): max run time before a forced context switch (e.g., 10ms)",
                "After the time slice expires, the current thread moves to the BACK of the ready queue",
                "The next thread at the FRONT of the queue gets to run",
                "If a thread blocks or exits BEFORE its time slice is up, the next thread runs immediately",
                "This is the algorithm you'll implement in assign5!",
                "Key tradeoff: what's a good time slice?"
            ],
            codeExample: {
                title: "Round Robin pseudo-code (similar to assign5 logic)",
                language: "cpp",
                code: `// Round Robin scheduling (conceptual — similar to assign5)
void scheduler() {
    queue<Thread*> ready_queue;
    
    while (!ready_queue.empty()) {
        Thread* next = ready_queue.front();
        ready_queue.pop();
        
        // Run this thread for at most one time slice
        set_timer(TIME_SLICE);  // e.g. 10ms
        context_switch(current, next);
        
        // When we get back here, either:
        // 1. The timer fired (thread used full time slice)
        //    → put thread back at end of ready queue
        // 2. The thread blocked (e.g., waiting for I/O)
        //    → put thread in blocked list
        // 3. The thread exited
        //    → don't put it anywhere, it's done!
        
        if (next->state == READY) {
            ready_queue.push(next);  // Back of the line!
        }
    }
}`,
                annotations: [
                    { match: "queue<Thread*> ready_queue;", explanation: "The ready queue holds all threads that want to run but are waiting for CPU time. This is a FIFO queue — threads are added to the back and removed from the front." },
                    { match: "Thread* next = ready_queue.front();", explanation: "Pick the thread at the front of the queue — it's been waiting the longest. This ensures fairness: every thread eventually gets a turn." },
                    { match: "set_timer(TIME_SLICE);", explanation: "Set a hardware timer for the time slice duration (e.g., 10ms). When this timer fires, it triggers an interrupt that transfers control back to the OS, preventing the thread from running forever." },
                    { match: "context_switch(current, next);", explanation: "Perform the context switch: save current thread's registers, load next thread's registers. The CPU starts executing the next thread. This line 'returns' when the OS context-switches BACK to this scheduler thread." },
                    { match: "ready_queue.push(next);", explanation: "If the thread still wants to run (used up its full time slice), put it at the BACK of the queue. It will get another turn after all other ready threads have had their turns." }
                ]
            },
            diagram: `
Round Robin — Time Slice Tradeoffs:

  Time Slice Too SMALL (e.g., 1 microsecond):
  ┌──────────────────────────────────────────┐
  │ T1│T2│T3│T1│T2│T3│T1│T2│T3│...          │
  │   ↑  ↑  ↑  ↑  ↑  ↑  ↑  ↑  ↑            │
  │   CS CS CS CS CS CS CS CS CS             │  CS = context switch
  │                                          │
  │ Problem: spending most of the time doing │
  │ context switches instead of useful work! │
  └──────────────────────────────────────────┘

  Time Slice Too LARGE (e.g., 100 seconds):
  ┌──────────────────────────────────────────┐
  │ T1...........................│T2│T3       │
  │                                          │
  │ Problem: basically FCFS again!           │
  │ Slow response time, threads hog the CPU  │
  └──────────────────────────────────────────┘

  ╔═══════════════════════════════════════════╗
  ║  Good time slice: 5–10ms range           ║
  ║  Linux default: ~4ms                     ║
  ║                                          ║
  ║  Goal: fast enough that user interactions║
  ║  (keystrokes, mouse clicks) feel instant ║
  ║  but not so fast that context switch     ║
  ║  overhead dominates                      ║
  ╚═══════════════════════════════════════════╝
            `
        },
        {
            id: "good-scheduling",
            title: "🎯 What Makes a Scheduling Algorithm \"Good\"?",
            content: `Before comparing more algorithms, let's define what we're optimizing for. There are three main criteria, and they often **conflict** with each other — there's no perfect algorithm for all scenarios!`,
            keyPoints: [
                "GOAL 1 — Minimize response time: time from request to useful result",
                "  Example: time from keystroke to character appearing on screen",
                "  Example: time from 'make' command to program compiled",
                "  We define 'useful result' as when the thread blocks or completes",
                "GOAL 2 — Use resources efficiently:",
                "  Keep CPU cores and disks busy (high utilization)",
                "  Minimize overhead (fewer context switches = less wasted time)",
                "GOAL 3 — Fairness:",
                "  Every thread should get a reasonable share of CPU time",
                "  No thread should starve (wait forever without running)",
                "  Important for multi-user systems and multi-job workloads",
                "These goals often CONFLICT — optimizing one may hurt another!"
            ],
            diagram: `
The Scheduling Trilemma:

        Minimize Response Time
              /         \\
             /           \\
            /    Can we    \\
           /   optimize     \\
          /    ALL THREE?    \\
         /     (Not always!) \\
        /                     \\
  Use Resources          Fairness
  Efficiently

  ┌────────────────────────────────────────────────┐
  │ Response Time vs Efficiency:                   │
  │   Short time slices → fast response            │
  │   But more context switches → lower efficiency │
  ├────────────────────────────────────────────────┤
  │ Response Time vs Fairness:                     │
  │   Running short jobs first → better avg time   │
  │   But long jobs may starve!                    │
  ├────────────────────────────────────────────────┤
  │ Efficiency vs Fairness:                        │
  │   Fewer switches → better efficiency           │
  │   But threads wait longer → less fair          │
  └────────────────────────────────────────────────┘
            `
        },
        {
            id: "comparing-fcfs-rr",
            title: "📊 Comparing FCFS vs Round Robin",
            content: `Is Round Robin always better than FCFS? Let's compare with two scenarios. We'll measure **average completion time** (lower is better). Assume a time slice of 1ms for Round Robin. These numeric scenarios are **very common on exams**!`,
            keyPoints: [
                "We measure 'completion time' = when the thread finishes (or blocks)",
                "Average completion time = sum of all completion timestamps / number of threads"
            ],
            codeExample: {
                title: "Scenario 1: Threads with DIFFERENT run times (A=100ms, B=1ms, C=2ms)",
                language: "text",
                code: `Ready Queue:  A (100ms)    B (1ms)    C (2ms)
              [front]                         [back]

═══ FCFS (First-Come First-Serve) ═══

Timeline:
|---- A runs (100ms) ----|B|--C--|
0                       100 101  103

  A completes at t=100
  B completes at t=101
  C completes at t=103
  Average = (100 + 101 + 103) / 3 = 101.3 ms  ← BAD!

═══ Round Robin (time slice = 1ms) ═══

Timeline:
|A|B|A|C|A|C|A|A|A|A|...|A|
0 1 2 3 4 5 6            103

  B completes at t=2   (ran during slice at t=1-2)
  C completes at t=5   (ran at t=3-4 and t=4-5)
  A completes at t=103 (ran all remaining slices)
  Average = (2 + 5 + 103) / 3 = 36.7 ms  ← MUCH BETTER!

RR wins here! Short threads B and C finish quickly
instead of waiting behind the long thread A.`,
                annotations: [
                    { match: "Average = (100 + 101 + 103) / 3 = 101.3 ms", explanation: "With FCFS, B and C must wait for A to finish all 100ms before they can start. This is terrible for B and C — they only needed 1ms and 2ms respectively!" },
                    { match: "Average = (2 + 5 + 103) / 3 = 36.7 ms", explanation: "With Round Robin, B and C get interspersed with A's execution. B finishes in just 2ms and C in 5ms. A still takes the same total time (103ms including context switches), but the AVERAGE is much better." }
                ]
            },
            diagram: `
Scenario 2: Threads with EQUAL run times (A=10ms, B=10ms, C=10ms)

═══ FCFS ═══

Timeline:
|--- A (10ms) ---|--- B (10ms) ---|--- C (10ms) ---|
0               10               20               30

  A: 10,  B: 20,  C: 30
  Average = (10 + 20 + 30) / 3 = 20 ms  ← GOOD!

═══ Round Robin (time slice = 1ms) ═══

Timeline:
|A|B|C|A|B|C|A|B|C|A|B|C|...|A|B|C|
0                                  30

  A: 28,  B: 29,  C: 30
  Average = (28 + 29 + 30) / 3 = 29 ms  ← WORSE!

FCFS wins here! When all threads are the same length,
Round Robin just delays everyone's completion time
without any benefit.

╔═══════════════════════════════════════════════════════╗
║  Takeaway: RR helps when threads have DIFFERENT       ║
║  run times. It lets short threads finish quickly       ║
║  instead of waiting behind long ones.                 ║
║  When threads are EQUAL, FCFS is better (less overhead)║
╚═══════════════════════════════════════════════════════╝
            `
        },
        {
            id: "srpt",
            title: "⚡ Approach #3: Shortest Remaining Processing Time (SRPT)",
            content: `What if we optimized purely for the best average completion time? The answer is **SRPT**: always run the thread that will **finish (or block) the soonest**. This is provably **optimal** for minimizing average response time!`,
            keyPoints: [
                "SRPT: always pick the thread with the LEAST remaining time until it completes or blocks",
                "Run it to completion (no time slicing needed — it's the shortest!)",
                "This is PROVABLY OPTIMAL for minimizing average response time",
                "Intuition: by finishing short jobs first, fewer threads are 'waiting' at any given moment",
                "Think of it like the express checkout lane at a grocery store"
            ],
            diagram: `
SRPT — Optimal for Average Response Time:

Ready Queue: A (100ms)   B (1ms)   C (2ms)

═══ SRPT ═══
Pick shortest first: B (1ms), then C (2ms), then A (100ms)

Timeline:
|B|-C--|----------- A (100ms) ------------|
0 1   3                                  103

  B: 1,  C: 3,  A: 103
  Average = (1 + 3 + 103) / 3 = 35.7 ms  ← BEST!

Comparison:
  ┌──────────┬───────────────┐
  │ Algorithm│ Avg Completion│
  ├──────────┼───────────────┤
  │ FCFS     │ 101.3 ms      │
  │ RR       │  36.7 ms      │
  │ SRPT     │  35.7 ms ★    │  ← optimal!
  └──────────┴───────────────┘

For equal threads (A=B=C=10ms):
  ┌──────────┬───────────────┐
  │ Algorithm│ Avg Completion│
  ├──────────┼───────────────┤
  │ FCFS     │ 20 ms ★       │
  │ RR       │ 29 ms         │
  │ SRPT     │ 20 ms ★       │  ← ties with FCFS
  └──────────┴───────────────┘
  (When all threads are equal, SRPT = FCFS)
            `
        },
        {
            id: "srpt-problems",
            title: "⚠️ Problems with SRPT",
            content: `SRPT is mathematically optimal, but it has two major practical problems that make it impossible to use directly in a real OS.`,
            keyPoints: [
                "PROBLEM #1: We need to PREDICT THE FUTURE!",
                "  How do we know which thread will finish soonest?",
                "  Threads don't announce how long they will run",
                "  The OS would need to predict execution time — impossible in general!",
                "PROBLEM #2: STARVATION of long-running threads!",
                "  If short threads keep arriving, the long thread NEVER gets to run",
                "  Example: A needs 100ms, but new 1ms threads keep arriving — A waits forever!",
                "  This violates our 'fairness' goal",
                "These problems motivate priority-based scheduling — an approximation of SRPT"
            ],
            diagram: `
SRPT Starvation Problem:

Time 0:   A (100ms) starts...
Time 5:   B (1ms) arrives → B runs, A waits
Time 7:   C (2ms) arrives → C runs, A waits
Time 10:  D (1ms) arrives → D runs, A waits
Time 12:  E (3ms) arrives → E runs, A waits
  ...
Time ???: Will A EVER get to run? 😰

If short threads keep arriving, A STARVES!

╔═══════════════════════════════════════════════════╗
║  We want the BENEFITS of SRPT (short jobs first)  ║
║  WITHOUT the PROBLEMS (predicting future,         ║
║  starving long jobs).                             ║
║                                                   ║
║  Solution: Priority-Based Scheduling!             ║
╚═══════════════════════════════════════════════════╝
            `
        },
        {
            id: "io-bound-cpu-bound",
            title: "💡 SRPT Advantage: I/O-Bound vs CPU-Bound",
            content: `One more advantage of SRPT worth understanding: it naturally gives preference to **I/O-bound** threads over **CPU-bound** threads, which improves overall system resource utilization.`,
            keyPoints: [
                "I/O-Bound threads: spend most time waiting for external events (disk, network)",
                "  They run briefly (e.g., 1ms) then block waiting for I/O",
                "  Their 'remaining processing time' is SHORT — SRPT picks them first!",
                "CPU-Bound threads: spend most time computing on the CPU",
                "  They run for a long time without blocking (e.g., 100ms+)",
                "  Their 'remaining processing time' is LONG — SRPT deprioritizes them",
                "This is GOOD for resource utilization:",
                "  While the I/O-bound thread waits for disk, the CPU-bound thread runs",
                "  Both the CPU AND the disk stay busy simultaneously!",
                "  'Gives preference to those who need the least'"
            ],
            diagram: `
I/O-Bound vs CPU-Bound Threads:

  I/O-Bound Thread (e.g., file reader):
  ┌──┐      ┌──┐      ┌──┐      ┌──┐
  │RUN│ WAIT │RUN│ WAIT │RUN│ WAIT │RUN│ ...
  └──┘ disk  └──┘ disk  └──┘ disk  └──┘
   1ms  10ms  1ms  10ms  1ms  10ms  1ms

  CPU-Bound Thread (e.g., number cruncher):
  ┌──────────────────────────────────────────┐
  │          RUN (continuous computation)     │
  └──────────────────────────────────────────┘
                    100ms+

  With SRPT, I/O-bound thread runs first (needs only 1ms):
  ┌──────────────────────────────────────────────┐
  │ Timeline:                                    │
  │ |IO|---CPU----|IO|---CPU----|IO|---CPU---|    │
  │  ↑             ↑             ↑               │
  │  I/O thread    I/O thread    I/O thread      │
  │  runs 1ms      wakes up,     wakes up,       │
  │  then blocks   runs 1ms,     runs 1ms,       │
  │  (disk I/O)    blocks again  blocks again     │
  │                                              │
  │  CPU and disk are BOTH busy! 🎉              │
  └──────────────────────────────────────────────┘
            `
        },
        {
            id: "priority-scheduling",
            title: "🏆 Approach #4: Priority-Based Scheduling",
            content: `We want to approximate SRPT without predicting the future and without starving long-running threads. The key insight: **past behavior predicts future behavior**. If a thread has been running for a long time without blocking, it's likely to continue running. If a thread frequently blocks, it will probably block again soon.`,
            keyPoints: [
                "KEY IDEA: use past performance to predict future performance",
                "If a thread uses very little CPU before blocking → it's probably I/O-bound → treat like 'short'",
                "If a thread uses its entire time slice → it's probably CPU-bound → treat like 'long'",
                "Implementation: threads have PRIORITIES that change over time",
                "Multiple ready queues — one per priority level",
                "Always run the highest-priority thread first",
                "After blocking, thread returns to the HIGHEST priority queue (fresh start)",
                "If a thread uses its full time slice without blocking, move it DOWN one priority level",
                "Approximates SRPT: I/O-bound threads stay high-priority, CPU-bound threads sink"
            ],
            codeExample: {
                title: "Priority queue scheduling (conceptual)",
                language: "cpp",
                code: `// Priority-Based Scheduling with multiple queues
const int NUM_PRIORITIES = 4;  // 0 = highest, 3 = lowest
queue<Thread*> ready_queues[NUM_PRIORITIES];

void on_thread_unblocked(Thread* t) {
    // After blocking, start at highest priority
    t->priority = 0;
    ready_queues[0].push(t);
}

void on_time_slice_expired(Thread* t) {
    // Used full time slice without blocking → lower priority
    if (t->priority < NUM_PRIORITIES - 1) {
        t->priority++;
    }
    ready_queues[t->priority].push(t);
}

Thread* pick_next_thread() {
    // Always run highest-priority thread available
    for (int p = 0; p < NUM_PRIORITIES; p++) {
        if (!ready_queues[p].empty()) {
            Thread* next = ready_queues[p].front();
            ready_queues[p].pop();
            return next;
        }
    }
    return nullptr;  // no threads ready
}`,
                annotations: [
                    { match: "const int NUM_PRIORITIES = 4;", explanation: "We have multiple priority levels. Priority 0 is the highest (runs first), priority 3 is the lowest. Each level has its own ready queue. This is sometimes called a 'multi-level feedback queue' (MLFQ)." },
                    { match: "t->priority = 0;", explanation: "When a thread unblocks (finishes waiting for I/O, lock, etc.), it gets the HIGHEST priority. This is because threads that block frequently are likely I/O-bound and need only brief CPU time — similar to how SRPT prioritizes short jobs." },
                    { match: "t->priority++;", explanation: "If a thread uses its ENTIRE time slice without blocking, it's probably CPU-bound and will need lots of CPU time. Lower its priority so I/O-bound threads get preference. This approximates SRPT without knowing the future!" },
                    { match: "for (int p = 0; p < NUM_PRIORITIES; p++)", explanation: "Always pick from the highest-priority non-empty queue. This ensures I/O-bound threads (high priority) always run before CPU-bound threads (low priority), maximizing overall system throughput." }
                ]
            },
            diagram: `
Priority-Based Scheduling — Multiple Queues:

  Priority 0 (highest): ┌─ T_io1 ─┬─ T_io2 ─┐   ← I/O-bound threads
                         └─────────┴─────────┘     (blocked frequently,
                                                     got reset to P0)

  Priority 1:           ┌─ T_mix ─┐               ← threads that used
                         └─────────┘                 1 full time slice

  Priority 2:           ┌─ T_cpu1 ─┐              ← threads that used
                         └──────────┘                2 full time slices

  Priority 3 (lowest):  ┌─ T_cpu2 ─┬─ T_cpu3 ─┐  ← long-running
                         └──────────┴──────────┘    CPU-bound threads

  ╔═══════════════════════════════════════════════════════════╗
  ║  PROBLEM: CPU-bound threads can STILL starve!            ║
  ║  If I/O-bound threads keep arriving, low-priority        ║
  ║  queues never get to run.                                ║
  ╚═══════════════════════════════════════════════════════════╝
            `
        },
        {
            id: "priority-aging",
            title: "🔄 Priority Aging (4.4 BSD Unix)",
            content: `The basic priority approach can still starve long-running threads. The solution used by 4.4 BSD Unix (and ideas carried forward in modern systems): **track recent CPU usage per thread** and adjust priorities based on that. If a thread hasn't run in a long time, boost its priority. If it's been running a lot, lower it.`,
            keyPoints: [
                "Idea: keep track of each thread's RECENT CPU usage",
                "If a thread hasn't run in a long time → its priority goes UP (it 'deserves' CPU time)",
                "If a thread has been running a lot recently → its priority goes DOWN",
                "This solves the starvation problem! A neglected thread will eventually get boosted",
                "If many equally-long threads want to run, priorities even out over time — like an 'equilibrium'",
                "This is the approach used by 4.4 BSD Unix (and similar ideas in Linux)",
                "Achieves a good approximation of SRPT while maintaining fairness"
            ],
            diagram: `
Priority Aging — Preventing Starvation:

  Without aging:
  ┌──────────────────────────────────────────────┐
  │ Time: 0    10    20    30    40    50    ... │
  │ Prio 0: IO  IO   IO   IO   IO   IO         │
  │ Prio 3: CPU  ←── never runs! starving! 😰   │
  └──────────────────────────────────────────────┘

  With aging (4.4 BSD approach):
  ┌──────────────────────────────────────────────┐
  │ Time: 0    10    20    30    40    50    ... │
  │                                              │
  │ IO thread: runs often → priority slowly      │
  │   decreases (using lots of CPU recently)     │
  │                                              │
  │ CPU thread: hasn't run → priority slowly     │
  │   INCREASES! Eventually runs! 🎉             │
  │                                              │
  │ Over time, priorities reach EQUILIBRIUM:     │
  │ both threads alternate fairly                │
  └──────────────────────────────────────────────┘

  ╔═══════════════════════════════════════════════╗
  ║  Key: No thread is permanently neglected.     ║
  ║  The longer you wait, the higher your         ║
  ║  priority becomes. Eventually you WILL run.   ║
  ╚═══════════════════════════════════════════════╝
            `
        },
        {
            id: "summary-comparison",
            title: "📊 Summary: Four Scheduling Algorithms",
            content: `Here's a comprehensive comparison of all four scheduling algorithms we covered. Understanding their tradeoffs is critical for both assign5 and the exam.`,
            keyPoints: [
                "FCFS: simple, good for equal-length threads, bad fairness (starvation possible)",
                "Round Robin: adds time slicing to FCFS, prevents monopolization, good fairness",
                "SRPT: optimal avg response time, but requires predicting the future, starves long threads",
                "Priority-Based: approximates SRPT using past behavior, aging prevents starvation"
            ],
            diagram: `
Scheduling Algorithm Comparison:

┌──────────────────┬────────────┬──────────────┬──────────────┬───────────────┐
│                  │    FCFS    │ Round Robin  │    SRPT      │  Priority     │
├──────────────────┼────────────┼──────────────┼──────────────┼───────────────┤
│ Response Time    │  Poor      │  Good        │  Optimal ★   │  Near-optimal │
│                  │ (short jobs│ (short jobs  │ (shortest    │ (approximates │
│                  │  wait for  │  interleaved)│  first)      │  SRPT)        │
│                  │  long ones)│              │              │               │
├──────────────────┼────────────┼──────────────┼──────────────┼───────────────┤
│ Fairness         │  Poor      │  Good ★      │  Poor        │  Good ★       │
│                  │ (can hog   │ (everyone    │ (long jobs   │ (aging stops  │
│                  │  CPU)      │  gets turns) │  STARVE)     │  starvation)  │
├──────────────────┼────────────┼──────────────┼──────────────┼───────────────┤
│ Overhead         │  Low ★     │  Medium      │  Low         │  Medium       │
│                  │ (no timer) │ (context     │ (no slice)   │ (priority     │
│                  │            │  switches)   │              │  bookkeeping) │
├──────────────────┼────────────┼──────────────┼──────────────┼───────────────┤
│ Predictability   │  Yes       │  Yes         │  No!         │  No           │
│ (needs future?)  │            │              │ (must know   │ (uses past as │
│                  │            │              │  run times)  │  predictor)   │
├──────────────────┼────────────┼──────────────┼──────────────┼───────────────┤
│ Starvation?      │  Yes       │  No ★        │  Yes         │  No ★         │
│                  │ (monopoly) │              │ (long jobs)  │ (w/ aging)    │
└──────────────────┴────────────┴──────────────┴──────────────┴───────────────┘
            `
        },
        {
            id: "exam-prep",
            title: "🎯 Exam Prep: Scheduling",
            content: `Scheduling is a major exam topic. Here's what you need to be able to do.`,
            keyPoints: [
                "📝 Draw and explain the 3 thread states (Running, Ready, Blocked) and ALL valid transitions",
                "📝 Explain why READY → BLOCKED is NOT a valid transition",
                "📝 Describe FCFS, RR, SRPT, and Priority-Based scheduling — how each works",
                "📝 CALCULATE average completion times for FCFS, RR, and SRPT given a set of threads and run times",
                "📝 Explain the time slice tradeoff: too small = high overhead, too large = poor response",
                "📝 Explain why SRPT is optimal for average response time",
                "📝 Explain the two problems with SRPT (predicting future, starvation)",
                "📝 Explain I/O-bound vs CPU-bound threads and why SRPT helps utilization",
                "📝 Explain how priority-based scheduling approximates SRPT",
                "📝 Explain how priority aging prevents starvation (4.4 BSD Unix approach)"
            ],
            diagram: `
Scheduling Exam Cheat Sheet:

┌──────────────────────────────────────────────────────────────────┐
│  THREE GOALS: minimize response time, use resources              │
│  efficiently, fairness                                           │
│                                                                   │
│  THREAD STATES: Running ↔ Ready, Running → Blocked,              │
│                 Blocked → Ready. NOT Ready → Blocked!            │
│                                                                   │
│  FCFS: run front of queue until done/block. Simple but unfair.   │
│  RR: time slices! After slice → back of queue. Fair!             │
│  SRPT: run shortest job first. Optimal avg time. Can't predict!  │
│  Priority: past behavior → priority. Aging prevents starvation.  │
│                                                                   │
│  KEY EXAM SKILL: compute avg completion times for scenarios!     │
│                                                                   │
│  TIME SLICE: too small = overhead waste, too large = monopoly    │
│  Sweet spot: ~5-10ms (Linux: 4ms)                                │
│                                                                   │
│  ASSIGN5 CONNECTION: you'll implement Round Robin scheduling!    │
│                                                                   │
│  LECTURE 18 TAKEAWAY:                                             │
│  SRPT is the best for minimizing average response time,          │
│  but we can only APPROXIMATE it due to needing to predict        │
│  the future. Priority-based scheduling does this well.           │
└──────────────────────────────────────────────────────────────────┘
            `
        },
        {
            id: "next-time",
            title: "Coming Up Next",
            content: `Next lecture: **Scheduling and Preemption** — how does the OS force a thread to stop running? We'll look at timer interrupts and how they enable preemptive scheduling (where the OS can take the CPU away from a thread even if it doesn't want to stop).`,
            keyPoints: [
                "Preemption: the OS can FORCE a thread to stop (even if it doesn't block or exit)",
                "Timer interrupts: hardware interrupts that fire periodically (e.g., every 4ms)",
                "This is what makes Round Robin actually WORK — the timer enforces time slices",
                "Without preemption, we rely on threads to voluntarily give up the CPU (cooperative scheduling)",
                "With preemption, the OS has full control and can enforce fairness"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Thread State Transitions",
            difficulty: "easy",
            description: "For each of the following transitions, state whether it is VALID or INVALID. If valid, give an example of when it happens. If invalid, explain why.",
            starterCode: `// Determine if each transition is valid or invalid:

// 1. Running → Ready
// 2. Running → Blocked
// 3. Ready → Running
// 4. Ready → Blocked
// 5. Blocked → Ready
// 6. Blocked → Running`,
            solution: `// 1. Running → Ready: VALID
//    Example: The OS preempts a thread because its time slice expired.
//    The thread CAN still run, but the OS needs the core for another thread.

// 2. Running → Blocked: VALID
//    Example: A thread calls read() to read from disk. It must wait
//    for the disk I/O to complete, so it becomes blocked.

// 3. Ready → Running: VALID
//    Example: The scheduler picks this thread from the ready queue
//    and assigns it to a CPU core.

// 4. Ready → Blocked: INVALID ✗
//    A thread must actually EXECUTE (be running) to discover that it
//    needs to wait for something. You can't know you need to wait
//    for disk if you haven't tried to read from disk!

// 5. Blocked → Ready: VALID
//    Example: The disk I/O completes, but all CPU cores are busy.
//    The thread is now ready to run but must wait for a free core.

// 6. Blocked → Running: VALID
//    Example: The disk I/O completes AND a CPU core is immediately
//    available. The thread goes directly back to running.`,
            explanation: "The key insight is that READY → BLOCKED is the only invalid transition. A thread must execute code to discover it needs to wait for something. All other transitions are valid and represent normal thread lifecycle events."
        },
        {
            id: "ex2",
            title: "FCFS vs Round Robin: Calculate Averages",
            difficulty: "medium",
            description: "Three threads arrive at time 0 with the following CPU times: A=50ms, B=5ms, C=15ms. They are in the ready queue in order A, B, C. Calculate the average completion time for FCFS and Round Robin (time slice = 5ms). Which is better?",
            starterCode: `// Ready Queue (time 0): A(50ms)  B(5ms)  C(15ms)
// All arrive at time 0, in order A, B, C.

// Part 1: Calculate for FCFS
// A completes at: ???
// B completes at: ???
// C completes at: ???
// Average: ???

// Part 2: Calculate for Round Robin (time slice = 5ms)
// Draw the timeline and calculate:
// A completes at: ???
// B completes at: ???
// C completes at: ???
// Average: ???

// Part 3: Which is better and why?`,
            solution: `// Part 1: FCFS
// A runs first (50ms), then B (5ms), then C (15ms)
// Timeline: |------A (50ms)------|--B (5ms)--|---C (15ms)---|
//           0                   50          55             70
//
// A completes at: 50
// B completes at: 55
// C completes at: 70
// Average: (50 + 55 + 70) / 3 = 58.3 ms

// Part 2: Round Robin (time slice = 5ms)
// Timeline: |A|B|C|A|C|A|C|A|A|A|A|A|A|A|
//           0 5 10 15 20 25 30 35 40 45 50 55 60 65 70
//
// t=0-5:   A runs (45ms left)
// t=5-10:  B runs (0ms left) → B COMPLETES at t=10
// t=10-15: C runs (10ms left)
// t=15-20: A runs (40ms left)
// t=20-25: C runs (5ms left)
// t=25-30: A runs (35ms left)
// t=30-35: C runs (0ms left) → C COMPLETES at t=35
// t=35-70: A runs remaining 35ms → A COMPLETES at t=70
//
// B completes at: 10
// C completes at: 35
// A completes at: 70
// Average: (10 + 35 + 70) / 3 = 38.3 ms

// Part 3: Round Robin is better! (38.3ms vs 58.3ms)
// Because B and C are short threads that finish quickly
// with RR instead of waiting behind the long thread A.`,
            explanation: "Round Robin wins when threads have different run times because short threads finish quickly instead of waiting behind long ones. The average completion time dropped from 58.3ms to 38.3ms. This is the same principle that makes SRPT optimal."
        },
        {
            id: "ex3",
            title: "SRPT Scheduling",
            difficulty: "medium",
            description: "Given threads A(50ms), B(5ms), C(15ms) all arriving at time 0, calculate the average completion time using SRPT. Compare with FCFS and RR from the previous exercise.",
            starterCode: `// Ready Queue (time 0): A(50ms)  B(5ms)  C(15ms)
// SRPT: always run thread with shortest remaining time

// Which thread runs first? ???
// Which thread runs second? ???
// Which thread runs third? ???

// Calculate completion times:
// Thread 1: completes at ???
// Thread 2: completes at ???
// Thread 3: completes at ???
// Average: ???

// Compare:
// FCFS average: ??? (from previous exercise)
// RR average:   ??? (from previous exercise)
// SRPT average: ???`,
            solution: `// SRPT: run shortest remaining time first
//
// B has shortest time (5ms) → run B first
// C has next shortest (15ms) → run C second
// A has longest (50ms) → run A last
//
// Timeline: |B (5ms)|---C (15ms)---|-------A (50ms)-------|
//           0      5              20                      70
//
// B completes at: 5
// C completes at: 20
// A completes at: 70
// Average: (5 + 20 + 70) / 3 = 31.7 ms  ← OPTIMAL!
//
// Comparison:
// FCFS average: 58.3 ms
// RR average:   38.3 ms
// SRPT average: 31.7 ms  ★ BEST
//
// SRPT achieves the best average because it minimizes
// the number of threads "waiting" at any point in time.
// By finishing B first, only 2 threads wait after t=5.
// By finishing C next, only 1 thread waits after t=20.`,
            explanation: "SRPT is provably optimal for minimizing average response time. By running the shortest job first, we minimize the total 'waiting time' across all threads. However, remember this requires knowing the run times in advance (predicting the future), which is impossible in practice."
        },
        {
            id: "ex4",
            title: "Priority Scheduling Trace",
            difficulty: "medium",
            description: "Trace through priority-based scheduling with 3 priority levels (0=highest). Time slice = 10ms. Threads: A (CPU-bound, needs 40ms total), B (I/O-bound, runs 5ms then blocks for 20ms disk I/O, repeats). Both start at priority 0.",
            starterCode: `// Priority levels: 0 (highest), 1, 2 (lowest)
// Time slice: 10ms
// A: CPU-bound, needs 40ms total of CPU time
// B: I/O-bound, runs 5ms then blocks 20ms, repeats
// Both start at priority 0

// Trace the first 60ms of execution:
// t=0-??:   Which thread runs? What priority?
// ...
// What are A and B's priorities at each point?`,
            solution: `// t=0: Both A and B at priority 0. Let's say A is first in queue.
//
// t=0-10: A runs (priority 0). Uses FULL time slice → demote to P1
//   A: 30ms remaining, priority → 1
//
// t=10-15: B runs (priority 0, higher than A's P1). Runs 5ms, BLOCKS (disk I/O)
//   B: blocked for 20ms disk I/O. Still priority 0 (hasn't used full slice)
//
// t=15-25: A runs (only ready thread, priority 1). Uses full time slice → demote to P2
//   A: 20ms remaining, priority → 2
//
// t=25-35: A runs (still only ready thread, priority 2). Uses full slice → stays at P2
//   A: 10ms remaining, priority → 2 (already at lowest)
//
// t=35: B unblocks! Goes to priority 0 (reset after unblocking)
//   B at P0 vs A at P2 → B runs!
//
// t=35-40: B runs (priority 0). Runs 5ms, BLOCKS again.
//   B: blocked for another 20ms
//
// t=40-50: A runs (priority 2). Uses full slice.
//   A: 0ms remaining → A COMPLETES at t=50!
//
// Key observation: B (I/O-bound) always runs at priority 0
// because it blocks before using its full time slice.
// A (CPU-bound) sinks to priority 2.
// This naturally approximates SRPT!`,
            explanation: "Priority scheduling automatically learns which threads are I/O-bound vs CPU-bound. B blocks frequently so it stays at high priority. A uses full time slices so it sinks. This approximates SRPT by giving preference to threads that need less CPU time."
        },
        {
            id: "ex5",
            title: "Design: Scheduling Policy for a Web Server",
            difficulty: "hard",
            description: "You're designing a scheduler for a web server that handles two types of requests: (1) simple page loads (5ms CPU each) and (2) complex database queries (200ms CPU each). The server gets 100 simple requests/sec and 5 complex requests/sec. Which scheduling algorithm would you choose and why?",
            starterCode: `// Web server workload:
// - Simple requests: 5ms CPU each, 100/sec
// - Complex requests: 200ms CPU each, 5/sec
//
// Goals:
// - Simple requests should feel fast to users (< 50ms response)
// - Complex requests should eventually complete
// - Server should handle load efficiently
//
// Which scheduling algorithm? Why?
// What parameters would you choose (e.g., time slice)?
// What problems might arise?`,
            solution: `// ANALYSIS:
// Total CPU needed: 100 * 5ms + 5 * 200ms = 500ms + 1000ms = 1500ms/sec
// With 2 cores: 2000ms/sec capacity → feasible but tight
//
// CHOICE: Priority-Based Scheduling with Aging
//
// WHY NOT FCFS?
// A complex request (200ms) would block simple requests behind it.
// Users waiting for simple page loads would see 200ms+ delays. Bad!
//
// WHY NOT pure Round Robin?
// Better than FCFS, but with a 5ms time slice, a complex request
// would cycle through the ready queue ~40 times. Simple requests
// would get interleaved but completion time for BOTH types increases.
//
// WHY NOT SRPT?
// Would be ideal (simple requests first!) but we can't predict
// whether a request is simple or complex when it arrives.
// Also, during traffic spikes, complex requests might STARVE.
//
// WHY Priority-Based?
// - Simple requests (I/O-like behavior: short CPU bursts) naturally
//   stay at high priority because they finish before the time slice
// - Complex requests (CPU-bound) naturally sink to lower priority
// - Aging ensures complex requests eventually complete
// - No need to predict request type — the scheduler learns it!
//
// PARAMETERS:
// - Time slice: 10ms (simple requests finish in one slice)
// - 3-4 priority levels
// - Aging: boost priority every 100ms of waiting
//
// POTENTIAL PROBLEMS:
// - During traffic spikes, complex requests may be slow
// - Need to tune aging rate to balance responsiveness vs. fairness`,
            explanation: "Priority-based scheduling naturally handles mixed workloads by learning thread behavior. Short requests (I/O-bound pattern) stay high-priority, while long requests (CPU-bound pattern) sink but are protected by aging. This is why real web servers use priority-based schedulers."
        }
    ]
};

export default lecture18;
