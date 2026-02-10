export const lecture13 = {
    id: 13,
    title: "Race Conditions and Locks",
    subtitle: "Mutexes, Deadlock, and the Dining Philosophers Problem",
    keyTakeaway: "A mutex ('lock') can help us limit critical sections to 1 thread at a time. A thread can lock a mutex to take ownership of it, and unlock it to give it back. Locking a locked mutex will block the thread until the mutex is available. We must watch out for deadlock — when threads are all blocked waiting on resources held by each other.",

    sections: [
        {
            id: "topic-overview",
            title: "Topic 3: Multithreading, Part 2",
            content: `Welcome back! Last time we introduced threads and discovered the terrifying world of **race conditions**. Today we'll learn how to actually FIX them using **mutexes**, and encounter a new kind of bug: **deadlock**.`,
            keyPoints: [
                "Last lecture: threads share memory → race conditions are possible",
                "This lecture: how to PREVENT race conditions using mutexes (locks)",
                "New danger: deadlock — threads stuck waiting on each other forever",
                "Classic example: the Dining Philosophers problem",
                "This material is KEY for assign4 and the midterm!"
            ],
            diagram: `
Topic 3: Multithreading Roadmap:

┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Lecture 12   │ →  │  Lecture 13   │ →  │  Lecture 14   │ →  │  Lecture 15   │ →  │  Lecture 16   │
│               │    │               │    │               │    │               │    │               │
│ Multithreading│    │ Race Conds    │    │ Condition     │    │ The Monitor   │    │ Trust & Race  │
│ Introduction  │    │ and Locks     │    │ Variables     │    │ Pattern       │    │ Conditions    │
│               │    │               │    │               │    │               │    │               │
│  (Previous)   │    │ (This one!)   │    │  (Next)       │    │               │    │               │
└───────────────┴────┴───────────────┴────┴───────────────┴────┴───────────────┴────┴───────────────┘
            `
        },
        {
            id: "recap-threads",
            title: "📋 Recap: Threads and the Ticket Problem",
            content: `Quick recap from last time. We learned that **threads** are independent execution sequences within a single process that share the same virtual address space. This is powerful but dangerous!`,
            keyPoints: [
                "Threads share: globals, heap, and pass-by-reference parameters",
                "Each thread has its own ministack for local variables",
                "Race condition: unpredictable thread ordering causes bugs",
                "Critical section: code that only one thread should execute at a time",
                "The ticket-selling program demonstrated overselling tickets due to a race condition"
            ],
            diagram: `
The Ticket Problem From Last Lecture:

10 threads, 250 shared tickets → overselling!

Thread A                              Thread B
─────────────────────────────────────────────────────────
while (remainingTickets > 0)  ✓
    "Is there a ticket? Yes!"
                                      while (remainingTickets > 0)  ✓
                                          "Is there a ticket? Yes!"
remainingTickets--;
    remainingTickets = 0
    "I sold the last ticket!"
                                      remainingTickets--;
                                          0 - 1 = 18446744073709551615 💥
                                          SIZE_T_MAX! (unsigned overflow)

Both sold the "same" ticket, and now the counter is broken!
We need a way to make the check-and-sell ATOMIC.
            `
        },
        {
            id: "critical-section-recap",
            title: "🔑 Critical Sections: Where's the Problem?",
            content: `Before we learn the tool to fix race conditions, let's make sure we can correctly **identify** the critical section. This is a crucial exam skill — you'll need to pinpoint exactly which lines need protection.`,
            keyPoints: [
                "Critical section = code that only ONE thread should execute at a time",
                "KEY RULE: Keep critical sections as SMALL as possible!",
                "Only protect code that accesses shared data",
                "Move independent work (sleeping, printing) OUTSIDE the critical section",
                "Larger critical section = more waiting = worse performance"
            ],
            codeExample: {
                title: "Identifying the critical section in ticket selling",
                language: "cpp",
                code: `static void sellTickets(size_t id, size_t& remainingTickets) {
    while (true) {
        // ─────────── CRITICAL SECTION START ───────────
        if (remainingTickets == 0) break;
        size_t myTicket = remainingTickets;
        remainingTickets--;
        // ─────────── CRITICAL SECTION END ─────────────

        // OUTSIDE critical section: can run in PARALLEL!
        sleep_for(500);  // simulate "selling a ticket"
        cout << oslock << "Thread #" << id << " sold ticket #"
             << myTicket << endl << osunlock;
    }
}`,
                annotations: [
                    { match: "CRITICAL SECTION START", explanation: "Only one thread should be between START and END at a time. We need to check AND decrement atomically." },
                    { match: "if (remainingTickets == 0) break", explanation: "This CHECK must be in the critical section — otherwise another thread could sell the last ticket between our check and our decrement." },
                    { match: "size_t myTicket = remainingTickets", explanation: "Copy to a LOCAL variable! Local vars live on the thread's own stack, so they're private to this thread." },
                    { match: "remainingTickets--", explanation: "This WRITE must be in the critical section. After this, we've claimed our ticket." },
                    { match: "CRITICAL SECTION END", explanation: "End the critical section as EARLY as possible. Everything after this can safely run in parallel across threads." },
                    { match: "sleep_for(500)", explanation: "This is OUTSIDE the critical section — all threads can sleep in parallel. If this were INSIDE, threads would sell tickets one at a time (defeating the purpose of multithreading!)." }
                ]
            }
        },
        {
            id: "mutex-intro",
            title: "🔒 Mutexes: The Tool for Critical Sections",
            content: `Now we have the actual C++ tool to enforce critical sections: the **mutex** (short for "mutual exclusion"). A mutex is like a bathroom door lock — only one person can hold it at a time.`,
            keyPoints: [
                "mutex = a variable shared across threads, owned by at most 1 thread at a time",
                "lock(): take ownership of the mutex (blocks if someone else owns it!)",
                "unlock(): give up ownership so another thread can take it",
                "Both lock() and unlock() are ATOMIC operations",
                "A mutex starts in the UNLOCKED state when created",
                "#include <mutex> to use mutexes in C++"
            ],
            diagram: `
Mutex = A Bathroom Lock 🚪

                    ┌────────────────────────────────────────────┐
                    │            CRITICAL SECTION                │
Thread A ──lock()──►│  if (remaining == 0) break;               │──unlock()──►
                    │  remaining--;                              │
Thread B ──lock()─► │                                            │
              │     └────────────────────────────────────────────┘
              │
         BLOCKED! 🔴
         Waiting for Thread A
         to call unlock()...

When Thread A calls unlock():
  Thread B unblocks, acquires the lock, and enters the critical section.

RULES:
┌───────────────────────────────────────────────────────┐
│  Calling lock() when mutex is UNLOCKED:               │
│    → Thread takes ownership, continues immediately ✓  │
│                                                       │
│  Calling lock() when mutex is LOCKED:                 │
│    → Thread BLOCKS until mutex is unlocked 🔴         │
│                                                       │
│  Calling unlock():                                    │
│    → Releases ownership, one waiting thread unblocks  │
│                                                       │
│  Multiple threads waiting for same lock:              │
│    → ONE gets it (not necessarily the longest waiter) │
└───────────────────────────────────────────────────────┘
            `
        },
        {
            id: "mutex-ticket-agents",
            title: "Fixing Ticket Agents with a Mutex",
            content: `Let's fix our broken ticket-selling program using a mutex. We create ONE mutex to protect access to the shared \`remainingTickets\` variable.`,
            codeExample: {
                title: "ticket-agents.cc — Fixed with a mutex",
                language: "cpp",
                code: `#include <thread>
#include <iostream>
#include <mutex>
#include "ostreamlock.h"
#include "thread-utils.h"
using namespace std;

const size_t kNumTicketAgents = 10;

static void sellTickets(size_t id, size_t& remainingTickets,
                        mutex& counterLock) {
    while (true) {
        counterLock.lock();
        if (remainingTickets == 0) {
            counterLock.unlock();
            break;
        }
        size_t myTicket = remainingTickets;
        remainingTickets--;
        counterLock.unlock();

        sleep_for(500);  // simulate "selling a ticket"
        cout << oslock << "Thread #" << id << " sold a ticket ("
             << myTicket - 1 << " remain)." << endl << osunlock;
    }
    cout << oslock << "Thread #" << id
         << " sees no remaining tickets to sell and exits."
         << endl << osunlock;
}

int main(int argc, const char *argv[]) {
    thread ticketAgents[kNumTicketAgents];
    size_t remainingTickets = 250;
    mutex counterLock;

    for (size_t i = 0; i < kNumTicketAgents; i++) {
        ticketAgents[i] = thread(sellTickets, i,
            ref(remainingTickets), ref(counterLock));
    }
    for (thread& ticketAgent: ticketAgents) {
        ticketAgent.join();
    }

    cout << "Ticket selling done!" << endl;
    return 0;
}`,
                annotations: [
                    { match: "mutex counterLock", explanation: "Create ONE mutex to protect the shared remainingTickets variable. It starts unlocked." },
                    { match: "mutex& counterLock", explanation: "Pass the mutex by REFERENCE — all threads must share the SAME mutex object. Passing by value would give each thread its own copy (useless!)." },
                    { match: "counterLock.lock()", explanation: "Acquire the lock. If another thread owns it, THIS thread blocks here until the lock is available. This is how we enforce 'only 1 thread at a time'." },
                    { match: "counterLock.unlock();\n            break;", explanation: "CRITICAL: We MUST unlock before breaking out of the loop! Otherwise the mutex stays locked forever and other threads deadlock." },
                    { match: "counterLock.unlock();\n\n        sleep_for", explanation: "Unlock BEFORE the sleep. This lets other threads enter the critical section while we're selling. If we forgot this unlock, all threads would sell one at a time (slow!)." },
                    { match: "ref(counterLock)", explanation: "Must use ref() to pass the mutex by reference to the thread. Mutexes cannot be copied!" }
                ]
            }
        },
        {
            id: "mutex-unlock-paths",
            title: "⚠️ The Deadly Mistake: Forgetting to Unlock",
            content: `What happens if we forget to unlock the mutex on one of the code paths? Let's trace through the stalled version to see why this is catastrophic.`,
            keyPoints: [
                "Every path through the critical section MUST call unlock()",
                "If ANY code path forgets to unlock → the mutex stays locked FOREVER",
                "All other threads waiting on that mutex will block FOREVER",
                "The program HANGS (appears frozen, never terminates)",
                "This is one of the most common multithreading bugs!"
            ],
            codeExample: {
                title: "stalled-ticket-agents.cc — Spot the bug!",
                language: "cpp",
                code: `static void sellTickets(size_t id, size_t& remainingTickets,
                        mutex& counterLock) {
    while (true) {
        counterLock.lock();
        if (remainingTickets == 0) break;  // 💀 BUG: no unlock!

        size_t myTicket = remainingTickets;
        remainingTickets--;
        counterLock.unlock();

        sleep_for(500);
        cout << oslock << "Thread #" << id << " sold a ticket ("
             << myTicket - 1 << " remain)." << endl << osunlock;
    }
    cout << oslock << "Thread #" << id
         << " sees no remaining tickets to sell and exits."
         << endl << osunlock;
}`,
                annotations: [
                    { match: "if (remainingTickets == 0) break;  // 💀 BUG: no unlock!", explanation: "THIS IS THE BUG! When a thread sees 0 tickets, it breaks out of the loop WHILE STILL HOLDING THE LOCK. Now no other thread can ever acquire the lock. The first thread to see 0 tickets poisons the mutex for ALL other threads." },
                    { match: "counterLock.lock()", explanation: "Other threads will call lock() and block forever, because the thread that exited never called unlock(). The program hangs!" }
                ]
            },
            diagram: `
What Happens When We Forget to Unlock:

Thread 0                    Thread 1                    Thread 2
──────────                  ──────────                  ──────────
lock() ✓
  remaining == 0? YES!
  break;                    lock()                      lock()
  (exits loop)                │                           │
  ...exits function           │ BLOCKED 🔴                │ BLOCKED 🔴
                              │ (waiting for lock...)     │ (waiting for lock...)
                              │                           │
                              │     FOREVER! 💀            │     FOREVER! 💀
                              ▼                           ▼

Thread 0 NEVER called unlock(), so Threads 1 and 2
will wait FOREVER. The program HANGS.

$ ./stalled-ticket-agents
Thread #3 sold a ticket (249 remain).
... (sells all 250 tickets normally) ...
Thread #7 sees no remaining tickets to sell and exits.
█   ← cursor blinks here forever, program is stuck!
^C  ← you have to Ctrl-C to kill it
            `
        },
        {
            id: "mutex-when-needed",
            title: "When Do You Need a Mutex?",
            content: `Not every shared variable needs a mutex. Understanding WHEN you need one is critical for writing correct AND performant code. This is a common exam question!`,
            keyPoints: [
                "✅ NEED a mutex: multiple threads WRITING to the same variable",
                "✅ NEED a mutex: one thread WRITING while others READ the same variable",
                "❌ NO mutex needed: multiple threads only READING (no writers at all)",
                "⚠️ Data structures are generally NOT thread-safe unless explicitly stated",
                "Rule of thumb: create one mutex per shared variable or critical section you need to protect"
            ],
            diagram: `
When Do You Need a Mutex?

┌────────────────────────────────────────────────────────────────┐
│  SCENARIO                           │  MUTEX NEEDED?          │
├────────────────────────────────────────────────────────────────┤
│  Thread A reads, Thread B reads     │  NO  ✓  (safe!)        │
│  Thread A reads, Thread B writes    │  YES ⚠️  (race cond!)  │
│  Thread A writes, Thread B writes   │  YES ⚠️  (race cond!)  │
│  Thread A writes, nobody else       │  NO  ✓  (only 1 user)  │
└────────────────────────────────────────────────────────────────┘

WHY is read-only safe?
  → Reading doesn't change the data, so no matter what order
    threads read in, they all see the same consistent value.

WHY is write+read dangerous?
  → Thread B could read while Thread A is in the MIDDLE of
    writing, getting a half-updated value!
            `
        },
        {
            id: "multiple-mutexes",
            title: "Multiple Mutexes",
            content: `Programs often have multiple independent shared resources. You can (and should) use **separate mutexes** for separate resources. This is important for performance!`,
            keyPoints: [
                "Use one mutex per independent shared resource",
                "Don't use one giant mutex for everything (too much blocking!)",
                "Separate mutexes let threads access different resources concurrently",
                "Example: counter1 and counter2 each get their own mutex"
            ],
            codeExample: {
                title: "Multiple mutexes for independent resources",
                language: "cpp",
                code: `void func1(int& counter1, mutex& counter1Lock) {
    counter1Lock.lock();
    counter1++;
    counter1Lock.unlock();
}

void func2(int& counter2, mutex& counter2Lock) {
    counter2Lock.lock();
    counter2--;
    counter2Lock.unlock();
}

int main() {
    int counter1 = 0, counter2 = 0;
    mutex counter1Lock, counter2Lock;  // separate mutexes!

    thread t1(func1, ref(counter1), ref(counter1Lock));
    thread t2(func2, ref(counter2), ref(counter2Lock));
    // It's OK for t1 to modify counter1 and t2 to modify counter2
    // at the same time — they're protected by DIFFERENT locks.
    // But NOT ok for two threads to both modify counter1!
    t1.join();
    t2.join();
}`,
                annotations: [
                    { match: "mutex counter1Lock, counter2Lock", explanation: "Two separate mutexes for two separate shared variables. This lets threads access counter1 and counter2 concurrently — they don't need to wait on each other!" },
                    { match: "counter1Lock.lock()", explanation: "Only blocks threads that also try to lock counter1Lock. Threads using counter2Lock are not affected." },
                    { match: "counter2Lock.lock()", explanation: "Independent from counter1Lock. A thread can hold counter2Lock while another holds counter1Lock — no conflict." }
                ]
            }
        },
        {
            id: "mutex-summary",
            title: "✅ Mutexes Summary",
            content: `Before we move on, let's consolidate everything we know about mutexes. You WILL see this on the midterm!`,
            keyPoints: [
                "mutex (mutual exclusion) = variable owned by at most 1 thread at a time",
                "lock(): take ownership (BLOCKS if someone else has it)",
                "unlock(): give up ownership (one waiting thread gets it)",
                "Also known as a 'lock' — the terms are interchangeable",
                "Add constraint: 'only one thread may access this at a time'",
                "Create one mutex per distinct thing you need to limit access to",
                "ALWAYS unlock on EVERY possible code path — forgetting causes permanent hangs!"
            ],
            diagram: `
Mutex Cheat Sheet (Save This for Exam Prep!):

┌──────────────────────────────────────────────────────────┐
│  MUTEX OPERATIONS                                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  mutex m;            // Create (starts UNLOCKED)         │
│  m.lock();           // Acquire (BLOCKS if owned)        │
│  m.unlock();         // Release (wakes one waiter)       │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  RULES TO REMEMBER                                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. Always unlock on EVERY code path                     │
│  2. Keep critical sections SMALL                         │
│  3. Pass mutexes by REFERENCE (can't be copied)          │
│  4. One mutex per shared resource                        │
│  5. lock() is ATOMIC (can't be interrupted)              │
│  6. Multiple waiters → ONE gets it (no ordering          │
│     guarantee)                                           │
│                                                          │
└──────────────────────────────────────────────────────────┘
            `
        },
        {
            id: "check-understanding-1",
            title: "✅ Check Your Understanding: Mutexes",
            content: `Test your understanding before we move on to deadlock. These are the types of questions you'll see on the midterm!`,
            keyPoints: [
                "❓ Q1: What happens if Thread A calls lock() and no one else has the mutex?",
                "💡 A1: Thread A acquires the lock immediately and continues executing.",
                "❓ Q2: What happens if Thread A calls lock() and Thread B is holding the mutex?",
                "💡 A2: Thread A BLOCKS (freezes) until Thread B calls unlock().",
                "❓ Q3: If 5 threads are waiting on a locked mutex and it gets unlocked, what happens?",
                "💡 A3: Exactly ONE of the 5 gets the lock. Which one is NOT guaranteed (not necessarily FIFO).",
                "❓ Q4: Why do we pass mutexes with ref() when creating threads?",
                "💡 A4: Because mutexes cannot be copied! All threads must share the SAME mutex object."
            ]
        },
        {
            id: "deadlock-intro",
            title: "💀 Deadlock: When Everyone Gets Stuck",
            content: `Mutexes solve race conditions, but they introduce a NEW danger: **deadlock**. Deadlock occurs when multiple threads are all blocked, each waiting for a resource owned by another blocked thread.`,
            keyPoints: [
                "Deadlock = all threads blocked, waiting on resources held by other blocked threads",
                "NO thread can make progress → program hangs FOREVER",
                "Classic cause: threads lock multiple mutexes in DIFFERENT orders",
                "Think: 'I have the fork, you have the knife. I need the knife, you need the fork. Neither of us will eat!'"
            ],
            codeExample: {
                title: "Deadlock in action — two threads, two mutexes",
                language: "cpp",
                code: `mutex mutex1, mutex2;

// Thread A executes:          // Thread B executes:
void threadA() {               void threadB() {
    mutex1.lock();                 mutex2.lock();
    // ... does work ...           // ... does work ...
    mutex2.lock();                 mutex1.lock();
    // ... needs both ...          // ... needs both ...
    mutex2.unlock();               mutex1.unlock();
    mutex1.unlock();               mutex2.unlock();
}                              }`,
                annotations: [
                    { match: "mutex1.lock();                 mutex2.lock();", explanation: "Thread A locks mutex1, Thread B locks mutex2. So far so good — they have different locks." },
                    { match: "mutex2.lock();                 mutex1.lock();", explanation: "NOW THE DISASTER: Thread A wants mutex2 (held by B), Thread B wants mutex1 (held by A). Both block forever waiting for each other! This is DEADLOCK." }
                ]
            },
            diagram: `
Deadlock Visualized:

Thread A                           Thread B
──────────                         ──────────
mutex1.lock() ✓ (owns mutex1)
                                   mutex2.lock() ✓ (owns mutex2)

mutex2.lock() 🔴 BLOCKED!
  "I need mutex2, but B has it"
                                   mutex1.lock() 🔴 BLOCKED!
                                     "I need mutex1, but A has it"

         ┌───────────────────────────────┐
         │           DEADLOCK!           │
         │                               │
         │   A ──waits for──► mutex2     │
         │   ↑                    │      │
         │   │                    ▼      │
         │   mutex1 ◄──waits for── B    │
         │                               │
         │   Circular dependency!        │
         │   Neither can proceed! 💀     │
         └───────────────────────────────┘
            `
        },
        {
            id: "deadlock-prevention",
            title: "Preventing Deadlock",
            content: `How do we prevent deadlock? The key insight is to break the **circular dependency**. There are two main techniques.`,
            keyPoints: [
                "Technique 1: LOCK ORDERING — all threads must request locks in the SAME order",
                "Example: always lock mutex1 before mutex2 (never the reverse)",
                "This prevents circular wait because no thread holds a later lock while waiting for an earlier one",
                "Technique 2: LIMIT CONCURRENCY — limit the number of threads competing for shared resources",
                "Example: use a 'permission slip' system to limit how many threads try to eat at once"
            ],
            diagram: `
Deadlock Prevention: Lock Ordering

BAD (can deadlock):                  GOOD (deadlock-free):
┌─────────────────────────┐         ┌─────────────────────────┐
│ Thread A:               │         │ Thread A:               │
│   mutex1.lock();        │         │   mutex1.lock();        │
│   mutex2.lock();        │         │   mutex2.lock();        │
│                         │         │                         │
│ Thread B:               │         │ Thread B:               │
│   mutex2.lock();  ← ⚠️  │         │   mutex1.lock();  ← ✓  │
│   mutex1.lock();  ← ⚠️  │         │   mutex2.lock();  ← ✓  │
└─────────────────────────┘         └─────────────────────────┘
  Different order = deadlock!         Same order = safe!

WHY does same order work?
  → Thread B tries to lock mutex1 first.
  → If Thread A holds mutex1, Thread B waits.
  → Thread A is free to lock mutex2 (no one holds it!)
  → Thread A finishes, unlocks both.
  → Thread B gets mutex1, then mutex2. Done!
  → No circular dependency possible!
            `
        },
        {
            id: "dining-philosophers-intro",
            title: "🍝 The Dining Philosophers Problem",
            content: `Let's look at one of the most famous problems in computer science: the **Dining Philosophers**. This is a classic concurrency problem that beautifully illustrates deadlock.`,
            keyPoints: [
                "🧑‍🍳 Five philosophers sit around a circular table eating spaghetti",
                "🍴 There is one fork between each pair (5 forks total)",
                "🤔 Each philosopher alternates: think → eat → think → eat (3 meals)",
                "✋ To eat: must grab BOTH the left fork AND the right fork",
                "🔄 When done eating: put down both forks in the order they were picked up",
                "🧠 Key insight: each fork can be used by at most ONE philosopher → use a mutex!"
            ],
            diagram: `
The Dining Philosophers:

              Philosopher 0
                  🧑
               🍴     🍴
          P4 🧑    🍝    🧑 P1
               🍴     🍴
                  🧑
              Philosopher 3
               🍴     🍴
                  🧑
              Philosopher 2

5 philosophers, 5 forks (between each pair)
Each fork is shared by 2 adjacent philosophers.
A philosopher needs BOTH adjacent forks to eat.

Encoding this as code:
  • Each fork = mutex (only 1 person can hold it)
  • Each philosopher = thread
  • Philosopher i's left fork = forks[i]
  • Philosopher i's right fork = forks[(i+1) % 5]
            `
        },
        {
            id: "dining-philosophers-code",
            title: "Dining Philosophers: The Code",
            content: `Here's how we encode the Dining Philosophers in C++. Each philosopher is a thread, and each fork is a mutex.`,
            codeExample: {
                title: "dining-philosophers-with-deadlock.cc",
                language: "cpp",
                code: `static const size_t kNumPhilosophers = 5;
static const size_t kNumForks = kNumPhilosophers;
static const size_t kNumMeals = 3;

static void think(size_t id) {
    cout << oslock << id << " starts thinking."
         << endl << osunlock;
    sleep_for(getThinkTime());
    cout << oslock << id << " all done thinking. "
         << endl << osunlock;
}

static void eat(size_t id, mutex& left, mutex& right) {
    left.lock();
    right.lock();
    cout << oslock << id << " starts eating om nom nom nom."
         << endl << osunlock;
    sleep_for(getEatTime());
    cout << oslock << id << " all done eating."
         << endl << osunlock;
    left.unlock();
    right.unlock();
}

static void philosopher(size_t id, mutex& left, mutex& right) {
    for (size_t i = 0; i < kNumMeals; i++) {
        think(id);
        eat(id, left, right);
    }
}

int main(int argc, const char *argv[]) {
    mutex forks[kNumForks];
    thread philosophers[kNumPhilosophers];
    for (size_t i = 0; i < kNumPhilosophers; i++) {
        philosophers[i] = thread(philosopher, i,
            ref(forks[i]),
            ref(forks[(i + 1) % kNumPhilosophers]));
    }
    for (thread& p: philosophers) p.join();
    return 0;
}`,
                annotations: [
                    { match: "mutex forks[kNumForks]", explanation: "5 mutexes, one per fork. Each fork can only be 'held' by one philosopher at a time." },
                    { match: "ref(forks[i])", explanation: "Philosopher i's LEFT fork is forks[i]." },
                    { match: "ref(forks[(i + 1) % kNumPhilosophers])", explanation: "Philosopher i's RIGHT fork is forks[(i+1)%5]. The modulo wraps around so philosopher 4's right fork is fork 0." },
                    { match: "left.lock();\n    right.lock()", explanation: "⚠️ DANGER: Grab left fork, then right fork. What happens if ALL philosophers grab their left fork at the same time?" },
                    { match: "left.unlock();\n    right.unlock()", explanation: "Put down forks in the same order picked up." },
                    { match: "think(id);\n        eat(id, left, right)", explanation: "Each philosopher does 3 meals: think, eat, think, eat, think, eat. Then they're done." }
                ]
            }
        },
        {
            id: "dining-deadlock",
            title: "🔥 The Dining Philosophers Deadlock",
            content: `This code has a deadlock! Can you see when it happens? What if ALL philosophers grab their left fork at the same time?`,
            keyPoints: [
                "Deadlock scenario: all 5 philosophers grab their LEFT fork simultaneously",
                "Now each waits for their RIGHT fork — but it's held by their neighbor!",
                "Circular wait: P0→fork1→P1→fork2→P2→fork3→P3→fork4→P4→fork0→P0",
                "NOBODY can eat, program hangs forever!",
                "Testing: add sleep_for() between left.lock() and right.lock() to force the deadlock"
            ],
            diagram: `
Deadlock: All philosophers grab left fork at the same time!

              P0 holds fork0
              wants fork1 🔴
                  🧑
           fork4/    \\fork1
      P4 🧑              🧑 P1
 holds fork4         holds fork1
 wants fork0 🔴      wants fork2 🔴
           fork3\\    /fork2
                  🧑
      P3 holds fork3    P2 holds fork2
      wants fork4 🔴    wants fork3 🔴

Everyone is waiting for someone else → CIRCULAR WAIT → DEADLOCK!

P0 waits for fork1 (held by P1)
P1 waits for fork2 (held by P2)
P2 waits for fork3 (held by P3)
P3 waits for fork4 (held by P4)
P4 waits for fork0 (held by P0) ← CIRCULAR!

We can force this to happen by adding:
    left.lock();
    sleep_for(1500);  // ← all philosophers pause here
    right.lock();     // ← then all try to grab right fork
            `,
        },
        {
            id: "dining-hypothesis",
            title: "Testing the Deadlock Hypothesis",
            content: `We said that the program can deadlock if all philosophers grab their left fork, then try for their right. Let's verify this by inserting a sleep between the two lock() calls.`,
            keyPoints: [
                "Adding sleep_for(1500) between left.lock() and right.lock() forces the deadlock",
                "This makes ALL philosophers grab their left fork, sleep, then try for right",
                "Key principle: you should be able to add sleep_for() ANYWHERE in a thread and have no concurrency issues",
                "If sleep_for() causes a new bug, you had a race condition or deadlock all along!",
                "The sleep just makes the bug RELIABLE — the bug was always there"
            ],
            codeExample: {
                title: "Forcing the deadlock to reveal the bug",
                language: "cpp",
                code: `static void eat(size_t id, mutex& left, mutex& right) {
    left.lock();
    sleep_for(1500);  // Force all philosophers to pause here
    right.lock();     // Now they all try for right fork → deadlock!

    cout << oslock << id << " starts eating om nom nom nom."
         << endl << osunlock;
    sleep_for(getEatTime());
    cout << oslock << id << " all done eating."
         << endl << osunlock;
    left.unlock();
    right.unlock();
}

// Running this program:
// $ ./dining-philosophers-with-deadlock
// 0 starts thinking.
// 1 starts thinking.
// ...
// 0 all done thinking.
// 1 all done thinking.
// ...
// █   ← hangs here forever! All waiting for right fork.`,
                annotations: [
                    { match: "sleep_for(1500)", explanation: "This sleep gives ALL philosophers time to grab their left fork before any try for their right. This makes the deadlock happen every time instead of rarely." },
                    { match: "right.lock()", explanation: "When all 5 philosophers reach this line, they ALL block. Each one's right fork is held by their neighbor as their left fork. Circular dependency → deadlock!" }
                ]
            }
        },
        {
            id: "dining-solution-preview",
            title: "How to Fix Dining Philosophers?",
            content: `We need to break the circular dependency. But how? We'll explore the full solution next lecture using **condition variables**. For now, here are the key ideas:`,
            keyPoints: [
                "Technique 1: Lock ordering — make one philosopher grab forks in reverse order",
                "Technique 2: Limit concurrency — allow at most 4 philosophers to try to eat at once",
                "With at most 4 competing for 5 forks, at least 1 gets both forks!",
                "Implementing the concurrency limit requires a new tool: condition variables (next lecture!)",
                "Key insight: we need to encode resource constraints into our program"
            ],
            diagram: `
Preview: Fixing Dining Philosophers

APPROACH 1: Lock Ordering
  Make philosopher 4 grab RIGHT fork first, then LEFT.
  This breaks the circular dependency:
    P0→P1→P2→P3→P4 all try left first EXCEPT P4
    P4 tries fork0 first, but P0 already has it → P4 waits
    P3 gets fork4 freely → P3 can eat!
    No circular wait.

APPROACH 2: Limit Concurrency (explored next lecture)
  Only let 4 philosophers try to eat at a time.
  5 forks, 4 competing → at least 1 always gets both forks!
  This requires condition variables...

  ┌──────────────────────────────────────────────┐
  │  Coming up: condition variables and the      │
  │  complete solution to Dining Philosophers!    │
  │                                              │
  │  Condition variables let threads WAIT for    │
  │  a condition to become true before           │
  │  proceeding. Stay tuned!                     │
  └──────────────────────────────────────────────┘
            `
        },
        {
            id: "exam-prep",
            title: "🎯 Midterm Prep: What to Know",
            content: `Multithreading will appear on the midterm! While it's slightly less emphasized since assign4 isn't due yet, you should be confident with these concepts.`,
            keyPoints: [
                "📝 Be able to identify race conditions in code",
                "📝 Know when a mutex is needed (readers vs. writers)",
                "📝 Be able to add lock()/unlock() calls to fix race conditions",
                "📝 Be able to trace through multithreaded code and predict behavior",
                "📝 Identify deadlock scenarios (circular wait on locks)",
                "📝 Know deadlock prevention techniques (lock ordering, limit concurrency)",
                "📝 Understand critical sections — what to include and what to keep OUT"
            ],
            diagram: `
Midterm Cheat Sheet — Multithreading:

┌─────────────────────────────────────────────────────────────┐
│  CONCEPT          │  KEY QUESTION TO ASK                    │
├─────────────────────────────────────────────────────────────┤
│  Race condition   │  Can two threads access the same data   │
│                   │  where at least one is writing?         │
├─────────────────────────────────────────────────────────────┤
│  Critical section │  Which lines access shared data?        │
│                   │  (Make it as small as possible!)        │
├─────────────────────────────────────────────────────────────┤
│  Mutex            │  Do I need to limit access to 1 thread? │
│                   │  Did I unlock on EVERY path?            │
├─────────────────────────────────────────────────────────────┤
│  Deadlock         │  Could threads wait for each other in   │
│                   │  a circle? Do they lock in same order?  │
├─────────────────────────────────────────────────────────────┤
│  Thread safety    │  Can I add sleep_for() anywhere without │
│                   │  breaking the program?                  │
└─────────────────────────────────────────────────────────────┘
            `
        },
        {
            id: "debug-guide",
            title: "🔧 Debug Guide: Multithreading Bugs",
            content: `When your multithreaded program misbehaves, use this diagnostic table to narrow down the problem:`,
            diagram: `
┌────────────────────────────────────────────────────────────────────────┐
│     SYMPTOM                        │     LIKELY CAUSE                  │
├────────────────────────────────────┼───────────────────────────────────┤
│ Program hangs forever              │ DEADLOCK: forgot to unlock, or   │
│ (never terminates)                 │ circular lock dependency          │
├────────────────────────────────────┼───────────────────────────────────┤
│ Counter goes to huge number        │ RACE CONDITION: unsigned overflow │
│ (like 18446744073709551615)        │ from concurrent decrement         │
├────────────────────────────────────┼───────────────────────────────────┤
│ Counter is wrong but close         │ RACE CONDITION: concurrent        │
│ (e.g., 1850 instead of 2000)      │ read-modify-write (lost updates) │
├────────────────────────────────────┼───────────────────────────────────┤
│ Adding sleep_for() breaks          │ LATENT RACE CONDITION: the sleep │
│ the program                        │ exposes a bug that was always    │
│                                    │ there but rarely triggered        │
├────────────────────────────────────┼───────────────────────────────────┤
│ Program runs but wrong results     │ CRITICAL SECTION too small:      │
│                                    │ not all shared accesses protected │
├────────────────────────────────────┼───────────────────────────────────┤
│ Program correct but SLOW           │ CRITICAL SECTION too big:        │
│                                    │ too much code inside lock/unlock │
└────────────────────────────────────┴───────────────────────────────────┘

🔑 Golden Rule: If your program works "most of the time" but
   occasionally fails, you almost certainly have a race condition.
   These are WORSE than bugs that happen every time!
            `
        },
        {
            id: "summary",
            title: "Lecture 13 Summary",
            content: `We learned how to fix race conditions with mutexes, and encountered the new danger of deadlock.`,
            keyPoints: [
                "Mutex: mutual exclusion lock, owned by at most 1 thread at a time",
                "lock(): acquire (blocks if locked), unlock(): release",
                "Critical sections should be as SMALL as possible for performance",
                "ALWAYS unlock on every code path — forgetting causes permanent hangs",
                "Deadlock: threads all blocked waiting on each other's resources",
                "Prevent deadlock: lock ordering or limiting concurrency",
                "Dining Philosophers: classic problem showing deadlock with circular resource dependencies"
            ],
            advantages: [
                "Mutexes guarantee mutual exclusion — only 1 thread in critical section",
                "Simple API: just lock() and unlock()",
                "Multiple mutexes allow fine-grained concurrency",
                "Prevents race conditions when used correctly"
            ],
            disadvantages: [
                "Forgetting to unlock causes permanent hangs",
                "Large critical sections hurt performance",
                "Multiple mutexes introduce deadlock risk",
                "No built-in mechanism to wait for a condition (need condition variables — next lecture)"
            ]
        },
        {
            id: "next-time",
            title: "Coming Up Next",
            content: `Next lecture we'll learn about **condition variables** — a way for threads to WAIT for a specific condition before proceeding. This will let us fully solve the Dining Philosophers!`,
            keyPoints: [
                "Condition variables: wait_for() and notify_one()/notify_all()",
                "Let threads sleep until a condition becomes true",
                "Complete solution to Dining Philosophers using concurrency limiting",
                "The Monitor Pattern: combining mutexes + condition variables",
                "Essential tool for assign4!"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Mutex Placement",
            difficulty: "easy",
            description: "Where should lock()/unlock() go to fix this race condition?",
            starterCode: `int total = 0;
mutex m;

void addToTotal(int amount) {
    int temp = total;
    temp += amount;
    total = temp;
}

// Called by multiple threads simultaneously`,
            solution: `int total = 0;
mutex m;

void addToTotal(int amount) {
    m.lock();
    int temp = total;
    temp += amount;
    total = temp;
    m.unlock();
}

// The entire read-modify-write sequence must be protected.
// Without the mutex, two threads could both read the same
// "old" value of total, add their amounts, and write back,
// causing one addition to be lost!`,
            explanation: "All three lines (read total, modify, write total) form one critical section. If we only protected 'total = temp', two threads could still read the same old value of total."
        },
        {
            id: "ex2",
            title: "Spot the Bug: Missing Unlock",
            difficulty: "medium",
            description: "This program sometimes hangs. Find and fix the bug.",
            starterCode: `void withdraw(int& balance, int amount, mutex& bankLock) {
    bankLock.lock();
    if (balance < amount) {
        cout << "Insufficient funds!" << endl;
        return;  // Bug is here!
    }
    balance -= amount;
    bankLock.unlock();
}`,
            solution: `void withdraw(int& balance, int amount, mutex& bankLock) {
    bankLock.lock();
    if (balance < amount) {
        cout << "Insufficient funds!" << endl;
        bankLock.unlock();  // MUST unlock before returning!
        return;
    }
    balance -= amount;
    bankLock.unlock();
}

// The original code returns without unlocking when
// balance < amount. This leaves the mutex locked forever,
// and all other threads waiting on bankLock will hang!`,
            explanation: "The 'return' statement inside the if block exits the function while still holding the lock. Every code path that acquires the lock MUST release it."
        },
        {
            id: "ex3",
            title: "Deadlock Detection",
            difficulty: "medium",
            description: "Can this program deadlock? If so, give a scenario. If not, explain why.",
            starterCode: `mutex m1, m2;

void funcA() {
    m1.lock();
    // do some work...
    m2.lock();
    // do more work...
    m2.unlock();
    m1.unlock();
}

void funcB() {
    m2.lock();
    // do some work...
    m1.lock();
    // do more work...
    m1.unlock();
    m2.unlock();
}

// Thread 1 runs funcA, Thread 2 runs funcB`,
            solution: `// YES, this can deadlock!
// Scenario:
//   Thread 1: m1.lock()   (gets m1)
//   Thread 2: m2.lock()   (gets m2)
//   Thread 1: m2.lock()   BLOCKED (Thread 2 has m2)
//   Thread 2: m1.lock()   BLOCKED (Thread 1 has m1)
//   → DEADLOCK! Neither can proceed.

// Fix: Both functions should lock in the SAME order:
void funcB_fixed() {
    m1.lock();   // Same order as funcA!
    m2.lock();
    // do work...
    m2.unlock();
    m1.unlock();
}`,
            explanation: "funcA locks m1 then m2, but funcB locks m2 then m1. This opposite ordering creates a circular dependency. Fix: always lock m1 before m2 in both functions."
        },
        {
            id: "ex4",
            title: "Critical Section Design",
            difficulty: "hard",
            description: "Design the MINIMAL critical section for this thread function. Which lines need mutex protection?",
            starterCode: `// shared across threads
int sharedCounter = 0;
mutex counterLock;

void processItem(int item) {
    cout << "Processing item " << item << endl;     // Line A
    int result = expensiveComputation(item);          // Line B
    sharedCounter += result;                          // Line C
    cout << "Counter is now " << sharedCounter << endl; // Line D
    logToFile("Processed item " + to_string(item));  // Line E
}`,
            solution: `void processItem(int item) {
    cout << "Processing item " << item << endl;     // NO lock (no shared data)
    int result = expensiveComputation(item);          // NO lock (local variable only)

    counterLock.lock();
    sharedCounter += result;                          // LOCK: writing shared data
    int counterSnapshot = sharedCounter;              // copy for printing
    counterLock.unlock();

    cout << "Counter is now " << counterSnapshot << endl; // NO lock (local copy)
    logToFile("Processed item " + to_string(item));  // NO lock (no shared data)
}

// Only Line C needs protection! Lines A, B, E don't touch shared data.
// For Line D, we copy sharedCounter to a local variable inside the lock,
// then print the local copy outside the lock.
// This keeps the critical section TINY (2 lines instead of 5).`,
            explanation: "Only the line that modifies sharedCounter needs mutex protection. The expensive computation, printing, and logging can all happen in parallel. Copy shared data to a local variable inside the lock, then use the local copy outside."
        },
        {
            id: "ex5",
            title: "Dining Philosophers Analysis",
            difficulty: "hard",
            description: "If we have 3 philosophers and 3 forks, what is the minimum number of philosophers that must grab their left fork for deadlock to occur?",
            starterCode: `// 3 philosophers, 3 forks (circular)
// P0: left=fork0, right=fork1
// P1: left=fork1, right=fork2
// P2: left=fork2, right=fork0

// Each philosopher:
//   1. Grab left fork
//   2. Grab right fork
//   3. Eat
//   4. Put down both forks

// How many must grab their left fork for deadlock?`,
            solution: `// ALL 3 must grab their left fork for deadlock!
//
// If P0 grabs fork0 and P1 grabs fork1:
//   P2 can grab fork2, then fork0 might be free
//   (depends on timing — not guaranteed deadlock)
//
// But if ALL 3 grab left forks:
//   P0 has fork0, wants fork1
//   P1 has fork1, wants fork2
//   P2 has fork2, wants fork0
//   → Circular wait → DEADLOCK!
//
// General rule: with N philosophers and N forks,
// ALL N must hold their left fork for guaranteed deadlock.
// That's why limiting to N-1 concurrent eaters prevents it!`,
            explanation: "Deadlock requires a complete circular dependency. With 3 philosophers and 3 forks, all 3 must hold their left fork to create the circular wait. If even one doesn't have their left fork, the chain is broken and someone can proceed."
        },
        {
            id: "ex6",
            title: "Does This Need a Mutex?",
            difficulty: "easy",
            description: "For each scenario, determine if a mutex is needed.",
            starterCode: `// Scenario A: 5 threads all read from a shared array (no writes)
// Scenario B: 1 thread writes to a variable, 4 threads read it
// Scenario C: 3 threads each write to their OWN separate variable
// Scenario D: 2 threads both call push_back on the same vector

// For each: does it need a mutex? Why or why not?`,
            solution: `// A: NO mutex needed!
//    Multiple readers with no writers is safe.
//    The data never changes, so all threads see the same values.

// B: YES, mutex needed!
//    One writer + readers = race condition.
//    A reader could see a half-updated value.

// C: NO mutex needed!
//    Each thread writes to its OWN variable.
//    No shared data = no race condition.

// D: YES, mutex needed!
//    push_back modifies the vector's internal state.
//    Two concurrent push_backs could corrupt the data structure.
//    STL containers are NOT thread-safe!`,
            explanation: "The key question is: are multiple threads accessing the SAME data where at least one is WRITING? If yes, you need a mutex. Read-only access and separate variables are safe."
        }
    ]
};

export default lecture13;
