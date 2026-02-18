export const lecture15 = {
    id: 15,
    title: "The Monitor Pattern",
    subtitle: "Encapsulating Synchronization in a Class",
    keyTakeaway: "The monitor pattern combines shared state, a single mutex, condition variables, and thread-safe methods into a class. This makes multithreaded code cleaner, safer, and easier to reason about. Threads simply call the class's methods without worrying about synchronization details. unique_lock further simplifies locking by automatically unlocking when it goes out of scope.",

    sections: [
        {
            id: "topic-overview",
            title: "Topic 3: Multithreading, Part 4",
            content: `We're continuing our multithreading journey! In the last two lectures we learned about **mutexes** (Lecture 13) and **condition variables** (Lecture 14). Today we'll learn the **Monitor Pattern** — a clean design pattern that packages all synchronization logic into a single class. This is the pattern you'll use in **assign4**.`,
            keyPoints: [
                "Lecture 13: mutexes prevent race conditions (but risk deadlock)",
                "Lecture 14: condition variables let threads wait/notify efficiently",
                "This lecture: the Monitor Pattern — encapsulate mutex + CVs + state in a class",
                "Makes multithreaded code MUCH cleaner and less error-prone",
                "Essential for assign4: you'll implement 2 monitor pattern classes!",
                "Also covers unique_lock — a convenience wrapper for mutex lock/unlock"
            ],
            diagram: `
Topic 3: Multithreading Roadmap:

┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Lecture 12   │ →  │  Lecture 13   │ →  │  Lecture 14   │ →  │  Lecture 15   │ →  │  Lecture 16   │
│               │    │               │    │               │    │               │    │               │
│ Multithreading│    │ Race Conds    │    │ Condition     │    │ The Monitor   │    │ Trust & Race  │
│ Introduction  │    │ and Locks     │    │ Variables     │    │ Pattern       │    │ Conditions    │
│               │    │               │    │               │    │               │    │               │
│  (Previous)   │    │  (Previous)   │    │  (Previous)   │    │ (This one!)   │    │  (Next)       │
└───────────────┴────┴───────────────┴────┴───────────────┴────┴───────────────┴────┴───────────────┘

assign4: ethics exploration + implementing 2 monitor pattern classes for 2 multithreaded programs.
            `
        },
        {
            id: "recap-cv",
            title: "📋 Recap: Condition Variables & Dining Philosophers",
            content: `Quick recap of the key tools we've learned. We need these to understand why the monitor pattern is so helpful.`,
            codeExample: {
                title: "waitForPermission — The final correct CV pattern from Lecture 14",
                language: "cpp",
                code: `static void waitForPermission(size_t& permits,
    condition_variable_any& permitsCV, mutex& permitsLock) {
    permitsLock.lock();
    while (permits == 0) {
        permitsCV.wait(permitsLock);
    }
    permits--;
    permitsLock.unlock();
}`,
                annotations: [
                    { match: "permitsLock.lock()", explanation: "Always lock the mutex BEFORE checking shared state. This prevents race conditions on the permits counter." },
                    { match: "while (permits == 0)", explanation: "WHILE, not IF! We must re-check after waking up because: (1) another thread may have grabbed the permit first, (2) spurious wakeups can occur." },
                    { match: "permitsCV.wait(permitsLock)", explanation: "Atomically: unlock the mutex + sleep. When notified, re-acquire the mutex before returning. This eliminates the 'air gap' race condition." },
                    { match: "permits--", explanation: "Safe to decrement — we hold the lock AND the while loop guarantees permits > 0." }
                ]
            },
            keyPoints: [
                "Condition variable: wait(lock) sleeps until notified; notify_all() wakes all waiters",
                "ALWAYS use wait(lock) inside a WHILE loop (never 'if'!)",
                "wait(lock) atomically unlocks + sleeps — no 'air gap' for missed notifications",
                "Dining Philosophers: N-1 permits for N forks prevents deadlock",
                "These tools work, but the code gets MESSY when you have lots of shared state..."
            ]
        },
        {
            id: "sync-hard",
            title: "🤯 Writing Synchronization Code is Hard",
            content: `We now have all the tools we need (mutexes, condition variables), but writing correct multithreaded code is still **really hard**. Let's think about the design challenges.`,
            keyPoints: [
                "How many locks should we use for a given program?",
                "Just one mutex? Doesn't allow for much concurrency (everything serialized)",
                "One mutex per shared variable? Very complex, hard to manage, risk of deadlock",
                "We must consider many thread interleavings — bugs are hard to reproduce!",
                "With Dining Philosophers, we needed: permits counter, permit mutex, permit CV, fork mutexes...",
                "Key design idea: associate a SINGLE lock with a COLLECTION of related variables"
            ],
            diagram: `
The Lock Granularity Tradeoff:

Too Few Locks (1 global lock):          Too Many Locks (1 per variable):
┌──────────────────────────┐            ┌──────────────────────────┐
│ ✓ Simple to reason about │            │ ✓ Maximum concurrency    │
│ ✗ Low concurrency        │            │ ✗ Very complex to manage │
│ ✗ Threads wait a lot     │            │ ✗ High deadlock risk     │
│                          │            │ ✗ Hard to get lock order │
│ All threads queue up     │            │   right everywhere       │
│ for one lock             │            │                          │
└──────────────────────────┘            └──────────────────────────┘

          ┌──────────────────────────────────────────┐
          │ SWEET SPOT: One lock per RELATED GROUP   │
          │  of variables (e.g., one lock per class) │
          │  → The MONITOR PATTERN!                  │
          └──────────────────────────────────────────┘
            `
        },
        {
            id: "monitor-definition",
            title: "🏗️ The Monitor Design Pattern",
            content: `The **monitor pattern** is a design pattern for writing multithreaded code. The core idea: bundle all related shared state, one mutex, and any needed condition variables into a **class**. All synchronization logic lives inside the class's methods.`,
            keyPoints: [
                "A 'monitor' is a class that encapsulates multithreading logic",
                "Contains: 1 mutex (private), shared state (private), CVs as needed (private)",
                "All methods that touch shared state lock/unlock the mutex internally",
                "Callers (threads) just call the methods — they don't manage locks at all!",
                "This is the go-to pattern for assign4 and real-world multithreaded code",
                "Think of it as: make the class 'thread-safe' so the caller doesn't have to worry"
            ],
            diagram: `
The Monitor Pattern:

┌─────────────────────────────────────────────────────────────┐
│  class MyMonitor {                                          │
│  public:                                                     │
│    // Thread-safe methods — callers don't manage locks!      │
│    void doAction1();     ← locks/unlocks internally         │
│    void doAction2();     ← locks/unlocks internally         │
│                                                              │
│  private:                                                    │
│    mutex lock;           ← ONE mutex for ALL shared state   │
│    condition_variable_any cv1;   ← CVs for events           │
│    condition_variable_any cv2;                               │
│    int sharedState1;     ← protected by 'lock'              │
│    int sharedState2;     ← protected by 'lock'              │
│  };                                                          │
└─────────────────────────────────────────────────────────────┘

Thread A          Thread B          Thread C
   │                 │                 │
   ├──► doAction1()  │                 │   Each thread just calls
   │                 ├──► doAction2()  │   the public methods!
   │                 │                 ├──► doAction1()
   │                 │                 │
   └── No lock management needed by callers! ──┘
            `
        },
        {
            id: "bridge-problem",
            title: "🌉 Bridge Crossing Problem",
            content: `Let's apply the monitor pattern to a concrete example: a **one-lane bridge** simulation. This is the main example from today's lecture, and it illustrates exactly why the monitor pattern helps.`,
            keyPoints: [
                "Each car is represented by a thread",
                "Cars can go either EAST or WEST",
                "All cars on the bridge must travel in the SAME direction",
                "Any number of cars can be on the bridge at once (if same direction)",
                "A car from the other direction can only go once the coast is clear (0 cars crossing)",
                "Cars arrive at the bridge at various points in time"
            ],
            diagram: `
One-Lane Bridge Rules:

                    ┌──── One Lane Bridge ────┐
  WESTBOUND ←←←←   │                          │   →→→→ EASTBOUND
                    └──────────────────────────┘

  ✅ OK: Multiple cars going the SAME direction
     🚗🚗🚗 →→→    [bridge]    →→→

  ✅ OK: No cars on bridge → car from either direction can go
                    [empty bridge]

  ❌ NOT OK: Cars going DIFFERENT directions at the same time!
     ←← 🚙         [bridge]        🚗 →→     CRASH!

  Rules:
  1. If cars are crossing eastbound → more eastbound cars CAN join
  2. If cars are crossing westbound → more westbound cars CAN join
  3. If cars are crossing in one direction → other direction MUST WAIT
  4. When all cars in one direction finish → waiting cars can go
            `
        },
        {
            id: "no-monitor-approach",
            title: "❌ Approach 1: No Monitor (Messy!)",
            content: `Let's first see what the code looks like WITHOUT the monitor pattern. All the shared state is passed around as individual parameters to each function. It works, but it's **messy and error-prone**.`,
            codeExample: {
                title: "car-simulation-no-monitor-soln.cc — All state scattered across parameters",
                language: "cpp",
                code: `// Shared state: all passed as individual parameters!
size_t n_crossing_eastbound = 0;
size_t n_crossing_westbound = 0;
mutex bridge_lock;
condition_variable_any none_crossing_eastbound;
condition_variable_any none_crossing_westbound;

// Arrive at, cross, and depart from the bridge going east.
static void cross_bridge_east(size_t id,
    size_t& n_crossing_eastbound, size_t& n_crossing_westbound,
    mutex& bridge_lock,
    condition_variable_any& none_crossing_eastbound,
    condition_variable_any& none_crossing_westbound) {

    approach_bridge();   // sleep

    // Arrive eastbound
    bridge_lock.lock();
    while (n_crossing_westbound > 0) {
        none_crossing_westbound.wait(bridge_lock);
    }
    n_crossing_eastbound++;
    bridge_lock.unlock();

    drive_across();      // sleep

    // Leave eastbound
    bridge_lock.lock();
    n_crossing_eastbound--;
    if (n_crossing_eastbound == 0) {
        none_crossing_eastbound.notify_all();
    }
    bridge_lock.unlock();
}`,
                annotations: [
                    { match: "size_t& n_crossing_eastbound, size_t& n_crossing_westbound,\n    mutex& bridge_lock,\n    condition_variable_any& none_crossing_eastbound,\n    condition_variable_any& none_crossing_westbound", explanation: "😱 LOOK at this parameter list! 5 shared variables passed by reference. Every thread function needs ALL of them. This is tedious, error-prone, and ugly. What if we had 10 pieces of shared state?" },
                    { match: "bridge_lock.lock()", explanation: "We must remember to lock BEFORE touching any shared state. Easy to forget when the lock isn't naturally grouped with the data it protects." },
                    { match: "while (n_crossing_westbound > 0)", explanation: "Standard CV waiting pattern: wait in a while loop until no westbound cars. This is correct — but the logic is spread across this function rather than encapsulated." },
                    { match: "if (n_crossing_eastbound == 0)", explanation: "When the last eastbound car leaves, notify westbound cars that the coast is clear. Correct, but again the logic is mixed in with the thread function." }
                ]
            },
            keyPoints: [
                "FIVE parameters passed to every thread function — messy!",
                "Synchronization logic is scattered across thread functions",
                "Easy to forget a lock/unlock or use the wrong CV",
                "If you add more state, every function signature must change",
                "The relationship between the mutex and the data it protects is implicit",
                "This approach does NOT scale — imagine a more complex program!"
            ]
        },
        {
            id: "partial-monitor",
            title: "🔄 Approach 2: Partial Monitor (Bundle State)",
            content: `An intermediate step: put all the shared state into a **struct** (or class with public fields). This reduces parameter passing, but the synchronization logic is still outside the class.`,
            codeExample: {
                title: "bridge.hh — State bundled, but all public and no methods",
                language: "cpp",
                code: `class Bridge {
public:
    // All state is public — anyone can access directly!
    std::mutex bridge_lock;

    size_t n_crossing_eastbound = 0;
    size_t n_crossing_westbound = 0;

    std::condition_variable_any none_crossing_eastbound;
    std::condition_variable_any none_crossing_westbound;
};

// Usage in thread function — cleaner parameters, but logic still outside:
static void cross_bridge_east(size_t id, Bridge& bridge) {
    approach_bridge();
    bridge.bridge_lock.lock();
    while (bridge.n_crossing_westbound > 0) {
        bridge.none_crossing_westbound.wait(bridge.bridge_lock);
    }
    bridge.n_crossing_eastbound++;
    bridge.bridge_lock.unlock();
    // ...
}`,
                annotations: [
                    { match: "public:", explanation: "All state is public — any code anywhere can directly access and modify the mutex, counters, and CVs. This defeats encapsulation and makes bugs more likely." },
                    { match: "static void cross_bridge_east(size_t id, Bridge& bridge)", explanation: "Better! Only 2 params instead of 6. But we still manage the lock/unlock logic outside the Bridge class. The caller must know the locking protocol." },
                    { match: "bridge.bridge_lock.lock()", explanation: "The caller is responsible for locking/unlocking correctly. If they forget, or lock the wrong thing, we have a bug. This responsibility should be INSIDE the class." },
                    { match: "bridge.none_crossing_westbound.wait(bridge.bridge_lock)", explanation: "The caller must know which CV to wait on and which lock to pass. This is all internal implementation detail that should be hidden!" }
                ]
            },
            keyPoints: [
                "Better: fewer parameters (just pass the Bridge object)",
                "But: state is all public — no encapsulation, anyone can mess with internals",
                "But: synchronization logic is still in the thread functions, not the class",
                "The caller must 'know' the locking protocol — error-prone",
                "Next step: move the logic INTO the class and make state private!"
            ]
        },
        {
            id: "full-monitor-header",
            title: "✅ Approach 3: Full Monitor — Bridge Header",
            content: `Now let's see the **full monitor pattern**. The Bridge class has **private** state, and **public thread-safe methods**. All locking logic is hidden inside the class. Callers don't need to know anything about mutexes or CVs!`,
            codeExample: {
                title: "bridge-soln.hh — The complete monitor class declaration",
                language: "cpp",
                code: `class Bridge {
public:
    /* Thread-safe; indicate that the car with the given ID has arrived at
     * the bridge going eastbound.  Blocks until the car is able to start
     * crossing the bridge, and then returns. */
    void arrive_eastbound(size_t id);

    /* Thread-safe; indicate that the car has finished crossing eastbound. */
    void leave_eastbound(size_t id);

    /* Thread-safe; indicate that the car has arrived going westbound.
     * Blocks until the car is able to start crossing. */
    void arrive_westbound(size_t id);

    /* Thread-safe; indicate that the car has finished crossing westbound. */
    void leave_westbound(size_t id);

private:
    void print(size_t id, const std::string& message, bool isEastbound);

    std::mutex bridge_lock;                                // ONE mutex

    size_t n_crossing_eastbound = 0;                       // shared state
    size_t n_crossing_westbound = 0;

    std::condition_variable_any none_crossing_eastbound;   // CVs
    std::condition_variable_any none_crossing_westbound;
};`,
                annotations: [
                    { match: "void arrive_eastbound(size_t id)", explanation: "Thread-safe method! The caller just says 'I arrived eastbound' and the method handles ALL locking, checking, and waiting internally. The caller doesn't touch any mutexes." },
                    { match: "void leave_eastbound(size_t id)", explanation: "Thread-safe method for leaving. It handles decrementing the counter and notifying waiting cars. Again, the caller does nothing with locks." },
                    { match: "private:", explanation: "THIS IS KEY! All state is private. Nobody outside the class can directly access the mutex, counters, or CVs. The only way to interact is through the public methods." },
                    { match: "std::mutex bridge_lock;", explanation: "ONE mutex protects ALL the shared state in this class. This is the monitor pattern: one lock per class, not one lock per variable." },
                    { match: "std::condition_variable_any none_crossing_eastbound;", explanation: "CV for the event 'no more eastbound cars crossing.' Westbound cars wait on this. When the last eastbound car leaves, it notifies." },
                    { match: "std::condition_variable_any none_crossing_westbound;", explanation: "CV for the event 'no more westbound cars crossing.' Eastbound cars wait on this. When the last westbound car leaves, it notifies." }
                ]
            },
            keyPoints: [
                "Public interface: arrive_X() and leave_X() — clean, simple, thread-safe",
                "Private: mutex, counters, CVs — completely hidden from callers",
                "ONE mutex protects ALL shared state (the monitor pattern rule)",
                "Two CVs — one per distinct event (no eastbound / no westbound)",
                "Callers don't need ANY knowledge of locking — just call the methods!",
                "This is the template for assign4: your classes will look just like this"
            ]
        },
        {
            id: "full-monitor-impl",
            title: "✅ Full Monitor — Bridge Implementation",
            content: `Now let's look at how the methods are implemented. Each method locks the mutex at the start, does its work, and unlocks at the end. The condition variable patterns (while loop + wait) are all encapsulated here.`,
            codeExample: {
                title: "bridge-soln.cc — The monitor methods (arrive and leave)",
                language: "cpp",
                code: `void Bridge::arrive_eastbound(size_t id) {
    bridge_lock.lock();
    print(id, "arrived", true);
    while (n_crossing_westbound > 0) {
        none_crossing_westbound.wait(bridge_lock);
    }
    n_crossing_eastbound++;
    print(id, "crossing", true);
    bridge_lock.unlock();
}

void Bridge::leave_eastbound(size_t id) {
    bridge_lock.lock();
    n_crossing_eastbound--;
    if (n_crossing_eastbound == 0) {
        none_crossing_eastbound.notify_all();
    }
    print(id, "crossed", true);
    bridge_lock.unlock();
}

void Bridge::arrive_westbound(size_t id) {
    bridge_lock.lock();
    print(id, "arrived", false);
    while (n_crossing_eastbound > 0) {
        none_crossing_eastbound.wait(bridge_lock);
    }
    n_crossing_westbound++;
    print(id, "crossing", false);
    bridge_lock.unlock();
}

void Bridge::leave_westbound(size_t id) {
    bridge_lock.lock();
    n_crossing_westbound--;
    if (n_crossing_westbound == 0) {
        none_crossing_westbound.notify_all();
    }
    print(id, "crossed", false);
    bridge_lock.unlock();
}`,
                annotations: [
                    { match: "bridge_lock.lock()", explanation: "Every method starts by locking the single mutex. This ensures exclusive access to ALL shared state (both counters and printing). All methods use the SAME lock." },
                    { match: "while (n_crossing_westbound > 0)", explanation: "Standard CV pattern: wait in a WHILE loop until no westbound cars. If woken up and westbound cars still crossing, go back to sleep. Handles spurious wakeups too." },
                    { match: "none_crossing_westbound.wait(bridge_lock)", explanation: "Sleep until notified that westbound cars are done. Atomically unlocks bridge_lock and sleeps. Upon waking, re-acquires bridge_lock before returning." },
                    { match: "n_crossing_eastbound++", explanation: "We only reach here when n_crossing_westbound == 0 (the while loop guarantees it). Safe to start crossing eastbound." },
                    { match: "if (n_crossing_eastbound == 0)", explanation: "When the last eastbound car leaves, notify ALL waiting westbound cars. We only notify when the count hits 0 — that's the event westbound cars are waiting for." },
                    { match: "none_crossing_eastbound.notify_all()", explanation: "Wake up all westbound cars waiting to cross. They'll each re-acquire the lock, check their while condition, and proceed if safe." },
                    { match: "bridge_lock.unlock()", explanation: "Every method ends by unlocking. Critical: if you forget this, other threads will block forever. (Later we'll see unique_lock to prevent this mistake!)" }
                ]
            },
            keyPoints: [
                "Every method: lock() at start, unlock() at end — simple pattern",
                "arrive methods: wait in a while loop until opposite direction is clear",
                "leave methods: decrement counter, notify if last car in that direction",
                "The calling code never sees ANY of this — complete encapsulation!",
                "Notice the symmetry: east and west are mirror images of each other"
            ]
        },
        {
            id: "monitor-main",
            title: "✨ The Clean Main Program",
            content: `Now look at how clean the main program becomes with the monitor pattern! Compare this to the no-monitor version — the difference is dramatic.`,
            codeExample: {
                title: "car-simulation-monitor-soln.cc — The caller code is beautifully clean!",
                language: "cpp",
                code: `// Arrive at, cross, and depart from the bridge going east.
static void cross_bridge_east(size_t id, Bridge& bridge) {
    approach_bridge();              // sleep
    bridge.arrive_eastbound(id);    // blocks until safe to cross
    drive_across();                 // sleep
    bridge.leave_eastbound(id);     // notify if last car
}

// Arrive at, cross, and depart from the bridge going west.
static void cross_bridge_west(size_t id, Bridge& bridge) {
    approach_bridge();              // sleep
    bridge.arrive_westbound(id);    // blocks until safe to cross
    drive_across();                 // sleep
    bridge.leave_westbound(id);     // notify if last car
}

int main(int argc, const char *argv[]) {
    Bridge bridge;                  // just make one Bridge object!
    thread cars[NUM_CARS];

    for (size_t i = 0; i < NUM_CARS; i++) {
        if (flip_coin()) {
            cars[i] = thread(cross_bridge_east, i, ref(bridge));
        } else {
            cars[i] = thread(cross_bridge_west, i, ref(bridge));
        }
    }

    for (thread& car : cars) car.join();
    return 0;
}`,
                annotations: [
                    { match: "bridge.arrive_eastbound(id)", explanation: "Just ONE line! The method blocks until it's safe to cross. All the mutex locking, CV waiting, counter checking — all hidden inside Bridge. Beautiful!" },
                    { match: "bridge.leave_eastbound(id)", explanation: "One line to signal we're done. Handles decrementing, checking if we're the last car, and notifying waiters — all internally." },
                    { match: "Bridge bridge;", explanation: "Just create ONE Bridge object. It contains all the state (mutex, CVs, counters) internally. No scattered variables to manage!" },
                    { match: "ref(bridge)", explanation: "Pass the Bridge by reference to each thread. Each thread shares the SAME Bridge object — that's the whole point of a monitor!" },
                    { match: "thread(cross_bridge_east, i, ref(bridge))", explanation: "Only 2 arguments needed: the car ID and the Bridge reference. Compare to the no-monitor version which needed 6 arguments!" }
                ]
            },
            keyPoints: [
                "Thread functions are 4 lines each — incredibly clean!",
                "No mutex/CV management by the caller AT ALL",
                "Just create a Bridge object and call its methods",
                "Compare: 6 parameters before → 2 parameters now (id + bridge)",
                "The monitor encapsulates ALL complexity — this is the power of the pattern",
                "For assign4: your main programs will call YOUR monitor class methods like this"
            ]
        },
        {
            id: "unique-lock-intro",
            title: "🔐 Unique Locks",
            content: `There's one more improvement we can make. Notice that in every Bridge method, we lock at the start and unlock at the end. What if we could do this **automatically**? Enter \`unique_lock\`.`,
            keyPoints: [
                "unique_lock<mutex> lock(myMutex) — automatically locks on creation",
                "When the unique_lock goes out of scope (e.g., function returns), it automatically unlocks",
                "This is called RAII: Resource Acquisition Is Initialization",
                "Particularly useful when a function has multiple return paths — all paths auto-unlock",
                "Also works with condition variables: pass the unique_lock instead of the raw mutex",
                "Eliminates the risk of forgetting to unlock!"
            ],
            diagram: `
Manual lock/unlock vs. unique_lock:

MANUAL (error-prone):                    UNIQUE_LOCK (automatic):
┌──────────────────────────┐            ┌──────────────────────────┐
│ void foo() {             │            │ void foo() {             │
│   myLock.lock();         │ ← manual   │   unique_lock<mutex>     │
│                          │            │     ul(myLock);           │ ← auto-locks!
│   // do work...          │            │                          │
│                          │            │   // do work...          │
│   myLock.unlock();       │ ← manual   │                          │
│ }                        │            │ }  ← auto-unlocks here! │
└──────────────────────────┘            └──────────────────────────┘

What if you forget unlock()?            Can't forget — it's automatic!
What if an exception is thrown           If an exception is thrown,
before unlock()? DEADLOCK! 💀           unique_lock destructor still
                                         unlocks. SAFE! ✅
            `
        },
        {
            id: "bridge-unique-lock",
            title: "🔐 Bridge with unique_lock",
            content: `Here's the Bridge implementation rewritten with \`unique_lock\`. Notice how we remove all manual unlock() calls — the lock is automatically released when the function returns.`,
            codeExample: {
                title: "bridge-soln-ul.cc — Same logic, but with unique_lock for cleaner code",
                language: "cpp",
                code: `void Bridge::arrive_eastbound(size_t id) {
    unique_lock<mutex> lock(bridge_lock);
    print(id, "arrived", true);
    while (n_crossing_westbound > 0) {
        none_crossing_westbound.wait(lock);
    }
    n_crossing_eastbound++;
    print(id, "crossing", true);
}

void Bridge::leave_eastbound(size_t id) {
    unique_lock<mutex> lock(bridge_lock);
    n_crossing_eastbound--;
    if (n_crossing_eastbound == 0) {
        none_crossing_eastbound.notify_all();
    }
    print(id, "crossed", true);
}

void Bridge::arrive_westbound(size_t id) {
    unique_lock<mutex> lock(bridge_lock);
    print(id, "arrived", false);
    while (n_crossing_eastbound > 0) {
        none_crossing_eastbound.wait(lock);
    }
    n_crossing_westbound++;
    print(id, "crossing", false);
}

void Bridge::leave_westbound(size_t id) {
    unique_lock<mutex> lock(bridge_lock);
    n_crossing_westbound--;
    if (n_crossing_westbound == 0) {
        none_crossing_westbound.notify_all();
    }
    print(id, "crossed", false);
}`,
                annotations: [
                    { match: "unique_lock<mutex> lock(bridge_lock)", explanation: "Creates a unique_lock that automatically locks bridge_lock RIGHT HERE. When this 'lock' variable goes out of scope (end of function), it automatically unlocks bridge_lock. No manual unlock() needed!" },
                    { match: "none_crossing_westbound.wait(lock)", explanation: "Pass the unique_lock (not the raw mutex!) to wait(). unique_lock has wrapper methods that CV can use to unlock/relock. It works the same as passing the raw mutex." },
                    { match: "none_crossing_eastbound.notify_all()", explanation: "notify_all() works the same way regardless of whether we use unique_lock or raw mutex. It wakes all waiting threads." },
                    { match: "print(id, \"crossed\", true);\n}", explanation: "No unlock() call needed! The unique_lock 'lock' goes out of scope here at the closing brace, and its destructor automatically calls bridge_lock.unlock(). Clean!" }
                ]
            },
            keyPoints: [
                "Replace 'bridge_lock.lock()' with 'unique_lock<mutex> lock(bridge_lock)'",
                "Remove ALL manual unlock() calls — they happen automatically at end of scope",
                "Pass the unique_lock (not the raw mutex) to cv.wait()",
                "The behavior is IDENTICAL — unique_lock is just a convenience wrapper",
                "particularly useful with functions that have multiple return paths or exceptions",
                "Use unique_lock in assign4 to simplify your monitor class implementations!"
            ]
        },
        {
            id: "assign4-tips",
            title: "📝 assign4 Tips",
            content: `Assign4 asks you to implement **2 monitor pattern classes** for 2 multithreaded programs, plus an ethics exploration. Here are key tips for the implementation.`,
            keyPoints: [
                "Your classes will follow the Bridge pattern: private state + public thread-safe methods",
                "Data structures (vector, queue, set, map) can store condition variables or state",
                "Structs are helpful to bundle related state and make multiple instances",
                "⚠️ Condition variables CANNOT be copied (push_back onto a vector doesn't work!)",
                "Solution: use POINTERS to condition variables, or store them in a map/array indexed differently",
                "Avoid unnecessary notifications — don't wake up threads that don't care about an event",
                "Use condition_variable_any (not condition_variable), and only use notify_all (not notify_one)"
            ],
            codeExample: {
                title: "C++ Struct Syntax — Preferred for assign4",
                language: "cpp",
                code: `// C struct syntax (from CS107):
typedef struct {
    int num;
    char ch;
} StructName;

// C++ struct syntax (preferred for assign4):
struct StructName {
    int num;
    char ch = 'H';     // supports default values!
    string name = "";   // works with C++ types too
};

// Condition variables CANNOT be copied:
vector<condition_variable_any> cvs;
condition_variable_any cv;
cvs.push_back(cv);       // ❌ ERROR: can't copy a CV!

// Solution: use pointers!
vector<condition_variable_any*> cvPtrs;
condition_variable_any* cvPtr = new condition_variable_any();
cvPtrs.push_back(cvPtr);  // ✅ OK: copying a pointer is fine!`,
                annotations: [
                    { match: "char ch = 'H';", explanation: "C++ structs support default member values — very convenient! C structs (typedef struct) do not. Use C++ syntax for assign4." },
                    { match: "cvs.push_back(cv);       // ❌ ERROR: can't copy a CV!", explanation: "When you push_back(), the vector makes a COPY of the object. But condition_variable_any has its copy constructor deleted — the OS won't let you duplicate a synchronization primitive. You must use pointers!" },
                    { match: "cvPtrs.push_back(cvPtr);  // ✅ OK: copying a pointer is fine!", explanation: "Copying a pointer is always fine — you're just copying the address, not the CV itself. All threads that need this CV just use the same pointer." }
                ]
            }
        },
        {
            id: "exam-prep",
            title: "🎯 Midterm Prep: The Monitor Pattern",
            content: `The monitor pattern is a key topic for the midterm. Here's what you should be able to do.`,
            keyPoints: [
                "📝 Define what the monitor pattern is and why it's useful",
                "📝 Identify the components: 1 mutex, private state, CVs, public thread-safe methods",
                "📝 Given a non-monitor solution, refactor it into a monitor class",
                "📝 Given a monitor class, trace through method calls with multiple threads",
                "📝 Explain why state should be private (encapsulation, prevents misuse)",
                "📝 Know what unique_lock does and why it's useful (auto unlock, RAII)",
                "📝 Design a monitor class for a new scenario (apply the pattern to new problems)"
            ],
            diagram: `
Monitor Pattern Exam Cheat Sheet:

┌──────────────────────────────────────────────────────────────────┐
│  WHAT IS IT?                                                      │
│    A class that encapsulates shared state + one mutex + CVs       │
│    with thread-safe public methods. Callers don't manage locks.  │
├──────────────────────────────────────────────────────────────────┤
│  COMPONENTS:                                                      │
│    1. Private mutex (exactly ONE per class)                       │
│    2. Private shared state (counters, flags, etc.)               │
│    3. Private condition variables (one per event type)           │
│    4. Public methods that lock/unlock internally                  │
├──────────────────────────────────────────────────────────────────┤
│  UNIQUE_LOCK:                                                     │
│    unique_lock<mutex> ul(myMutex);                               │
│    → Locks on creation, unlocks when going out of scope          │
│    → Pass to cv.wait(ul) instead of raw mutex                    │
│    → Prevents forgetting to unlock (exception-safe!)             │
├──────────────────────────────────────────────────────────────────┤
│  BENEFITS:                                                        │
│    ✓ Encapsulation — callers don't know about locks/CVs          │
│    ✓ Fewer bugs — locking logic in one place                     │
│    ✓ Easier to reason about — state and synchronization together │
│    ✓ Cleaner code — simple public API                            │
└──────────────────────────────────────────────────────────────────┘
            `
        },
        {
            id: "summary",
            title: "Lecture 15 Summary",
            content: `The monitor pattern is the go-to design pattern for writing multithreaded code. It combines shared state, a single mutex, condition variables, and thread-safe methods into a class — making synchronization cleaner, safer, and easier to reason about.`,
            keyPoints: [
                "The monitor pattern: encapsulate mutex + CVs + shared state in a class",
                "One mutex protects ALL shared state; all methods lock/unlock it",
                "Callers just call thread-safe methods — no lock management needed",
                "Bridge crossing example: no-monitor (messy) → partial (better) → full monitor (clean!)",
                "unique_lock auto-locks on creation and auto-unlocks when going out of scope",
                "Pass unique_lock to cv.wait() instead of raw mutex",
                "assign4: implement 2 monitor classes — follow the Bridge pattern!"
            ],
            advantages: [
                "Encapsulation — all synchronization logic in one place",
                "Thread-safe public API — callers don't manage locks",
                "Single mutex per class — simple to reason about",
                "Cleaner code — dramatically reduces parameter passing",
                "unique_lock prevents forgetting to unlock (exception-safe)"
            ],
            disadvantages: [
                "Single mutex limits concurrency (all methods serialize on one lock)",
                "Must carefully design which state belongs in which monitor",
                "Condition variables still require careful reasoning about events",
                "unique_lock adds a small overhead (destructor call) — negligible in practice"
            ]
        },
        {
            id: "next-time",
            title: "Coming Up Next",
            content: `Next lecture we'll explore **Trust and Race Conditions** — how the operating system itself handles trust boundaries and how race conditions can be exploited as security vulnerabilities.`,
            keyPoints: [
                "Trust and Race Conditions (Lecture 16)",
                "How the OS enforces trust boundaries between processes",
                "Race conditions as security vulnerabilities (TOCTOU attacks)",
                "How to think about trust in system design"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Identify the Monitor Pattern",
            difficulty: "easy",
            description: "Which of these classes follows the monitor pattern? For each, explain why or why not.",
            starterCode: `// Class A:
class Counter {
public:
    int count = 0;
    mutex m;
    void increment() {
        m.lock();
        count++;
        m.unlock();
    }
};

// Class B:
class SafeCounter {
private:
    int count = 0;
    mutex m;
public:
    void increment() {
        m.lock();
        count++;
        m.unlock();
    }
    int getCount() {
        m.lock();
        int val = count;
        m.unlock();
        return val;
    }
};

// Class C:
class BrokenCounter {
private:
    int count = 0;
    mutex m;
public:
    void increment() { count++; }  // no locking!
    mutex& getLock() { return m; }  // exposes lock!
};`,
            solution: `// Class A: NOT a monitor.
//   count and mutex are public — anyone can access them directly.
//   A caller could modify 'count' without locking, causing a race.
//   Monitor pattern requires PRIVATE state.

// Class B: YES, this IS a monitor! ✅
//   - Private state (count)
//   - Private mutex (m)
//   - Public thread-safe methods (increment, getCount)
//   - Both methods lock/unlock internally
//   - Callers can't bypass the locking

// Class C: NOT a monitor.
//   - increment() doesn't lock — race condition!
//   - getLock() exposes the mutex — defeats encapsulation
//   - Callers could lock/unlock in inconsistent ways

// KEY: A monitor has PRIVATE state + PRIVATE mutex +
// PUBLIC methods that ALL lock/unlock internally.`,
            explanation: "A monitor requires: (1) private shared state, (2) a private mutex, (3) public methods that always lock/unlock internally. Class B satisfies all three. Class A leaks state publicly. Class C doesn't lock in its methods and exposes the mutex."
        },
        {
            id: "ex2",
            title: "Refactor to Monitor Pattern",
            difficulty: "medium",
            description: "Refactor this non-monitor code into a monitor class. The shared state is a ticket counter that multiple threads decrement.",
            starterCode: `// Current non-monitor code:
size_t tickets = 100;
mutex ticketsLock;
condition_variable_any ticketsAvailable;

void buyTicket(size_t& tickets, mutex& lock,
    condition_variable_any& cv) {
    lock.lock();
    while (tickets == 0) {
        cv.wait(lock);
    }
    tickets--;
    lock.unlock();
}

void addTickets(size_t count, size_t& tickets, mutex& lock,
    condition_variable_any& cv) {
    lock.lock();
    tickets += count;
    cv.notify_all();
    lock.unlock();
}

// TODO: Create a TicketBooth monitor class`,
            solution: `class TicketBooth {
public:
    TicketBooth(size_t initialTickets) : tickets(initialTickets) {}

    void buyTicket() {
        unique_lock<mutex> ul(ticketsLock);
        while (tickets == 0) {
            ticketsAvailable.wait(ul);
        }
        tickets--;
    }

    void addTickets(size_t count) {
        unique_lock<mutex> ul(ticketsLock);
        bool wasEmpty = (tickets == 0);
        tickets += count;
        if (wasEmpty) ticketsAvailable.notify_all();
    }

private:
    size_t tickets;
    mutex ticketsLock;
    condition_variable_any ticketsAvailable;
};

// Usage:
// TicketBooth booth(100);
// Thread A: booth.buyTicket();      // clean!
// Thread B: booth.addTickets(10);   // clean!`,
            explanation: "The refactored class has private state (tickets, mutex, CV), takes initial tickets in the constructor, and has thread-safe public methods. Callers just call buyTicket() or addTickets(count) with no lock management."
        },
        {
            id: "ex3",
            title: "Trace Through Bridge Methods",
            difficulty: "medium",
            description: "Three cars arrive at the bridge: Car A going east, Car B going west, Car C going east. Car A arrives first. Trace through the method calls.",
            starterCode: `// Initial state:
// n_crossing_eastbound = 0
// n_crossing_westbound = 0

// Timeline:
// Time 0: Car A calls bridge.arrive_eastbound(A)
// Time 1: Car B calls bridge.arrive_westbound(B)
// Time 2: Car C calls bridge.arrive_eastbound(C)
// Time 3: Car A calls bridge.leave_eastbound(A)

// For each time step, trace through the method and state:
// What happens? What state changes? Who blocks? Who proceeds?`,
            solution: `// Time 0: Car A calls arrive_eastbound(A)
//   lock bridge_lock
//   n_crossing_westbound == 0? YES → skip while loop
//   n_crossing_eastbound++ → n_crossing_eastbound = 1
//   unlock
//   → Car A is crossing eastbound ✅

// Time 1: Car B calls arrive_westbound(B)
//   lock bridge_lock
//   n_crossing_eastbound == 1 > 0? YES → enter while loop
//   wait(bridge_lock) → SLEEPS, unlocks bridge_lock 💤
//   → Car B is blocked waiting for eastbound to clear

// Time 2: Car C calls arrive_eastbound(C)
//   lock bridge_lock
//   n_crossing_westbound == 0? YES → skip while loop
//   n_crossing_eastbound++ → n_crossing_eastbound = 2
//   unlock
//   → Car C is also crossing eastbound! ✅ (same direction OK)

// Time 3: Car A calls leave_eastbound(A)
//   lock bridge_lock
//   n_crossing_eastbound-- → n_crossing_eastbound = 1
//   n_crossing_eastbound == 0? NO → don't notify yet
//   unlock
//   → Car B is STILL sleeping (eastbound cars remain)

// Later: Car C calls leave_eastbound(C)
//   lock bridge_lock
//   n_crossing_eastbound-- → n_crossing_eastbound = 0
//   n_crossing_eastbound == 0? YES → notify_all!
//   unlock
//   → Car B wakes up! Re-acquires lock.
//     n_crossing_eastbound == 0? YES → exits while loop
//     n_crossing_westbound++ → n_crossing_westbound = 1
//     → Car B is now crossing westbound ✅`,
            explanation: "Key observations: (1) Car C can join Car A going eastbound — multiple same-direction is fine. (2) Car B must wait until ALL eastbound cars are done. (3) Only the LAST car leaving triggers notify_all(). (4) After waking, Car B re-checks the while condition before proceeding."
        },
        {
            id: "ex4",
            title: "unique_lock Scoping",
            difficulty: "medium",
            description: "What if you need to UNLOCK in the middle of a function, not just at the end? How can unique_lock handle this?",
            starterCode: `// Scenario: we want to lock, check some state, unlock,
// do some SLOW work (without holding the lock), then
// lock again to update state.
//
// With manual locking:
void processItem(mutex& m, queue<Item>& q) {
    m.lock();
    Item item = q.front();
    q.pop();
    m.unlock();

    process(item);     // slow! don't hold lock here

    m.lock();
    results.push_back(item);
    m.unlock();
}

// How would you write this with unique_lock?
// Hint: unique_lock has .unlock() and .lock() methods too!`,
            solution: `// unique_lock has manual lock()/unlock() methods as well!
void processItem(mutex& m, queue<Item>& q) {
    unique_lock<mutex> ul(m);   // auto-locks
    Item item = q.front();
    q.pop();
    ul.unlock();               // manually unlock early

    process(item);              // slow work without lock

    ul.lock();                  // manually re-lock
    results.push_back(item);
    // auto-unlocks when ul goes out of scope
}

// Even better: use SCOPING to control lifetime:
void processItem(mutex& m, queue<Item>& q) {
    Item item;
    {   // inner scope
        unique_lock<mutex> ul(m);   // auto-locks
        item = q.front();
        q.pop();
    }   // auto-unlocks here!

    process(item);              // no lock held

    {   // another scope
        unique_lock<mutex> ul(m);   // auto-locks again
        results.push_back(item);
    }   // auto-unlocks here!
}`,
            explanation: "unique_lock supports manual lock()/unlock() for mid-function unlock scenarios. Alternatively, use C++ scoping (curly braces) to control the unique_lock's lifetime — it automatically unlocks when it goes out of scope at the closing brace."
        },
        {
            id: "ex5",
            title: "Design a Monitor: Parking Garage",
            difficulty: "hard",
            description: "Design a monitor class for a parking garage with limited capacity. Cars (threads) arrive and must wait if full. When a car leaves, a waiting car can enter.",
            starterCode: `// Requirements:
// - Garage has a maximum capacity (e.g., 10 spots)
// - enter(): blocks until a spot is available, then enters
// - leave(): frees a spot and notifies waiting cars
//
// Design the ParkingGarage class:
// - What private state do you need?
// - What condition variable(s)?
// - What do enter() and leave() do?

class ParkingGarage {
    // TODO: design this monitor class
};`,
            solution: `class ParkingGarage {
public:
    ParkingGarage(size_t capacity) : maxSpots(capacity), usedSpots(0) {}

    void enter() {
        unique_lock<mutex> ul(garageLock);
        while (usedSpots >= maxSpots) {
            spotAvailable.wait(ul);     // wait until spot opens
        }
        usedSpots++;
        // Car is now parked!
    }

    void leave() {
        unique_lock<mutex> ul(garageLock);
        usedSpots--;
        spotAvailable.notify_all();     // wake waiting cars
    }

private:
    size_t maxSpots;                                // max capacity
    size_t usedSpots;                               // current occupancy
    mutex garageLock;                               // ONE mutex
    condition_variable_any spotAvailable;            // event: a spot opened
};

// 5-step CV recipe applied:
// 1. Event: "a parking spot becomes available"
// 2. State: usedSpots < maxSpots
// 3. CV: spotAvailable
// 4. Notify: leave() — when a car leaves, notify!
// 5. Wait: enter() — while full, wait for spot

// Usage:
// ParkingGarage garage(10);
// Thread: garage.enter();  // blocks if full
// Thread: garage.leave();  // frees a spot`,
            explanation: "This follows the exact same pattern as the Bridge: private state + one mutex + CVs + thread-safe methods. enter() uses the standard while-loop + wait pattern. leave() decrements and notifies. The caller never manages locks."
        },
        {
            id: "ex6",
            title: "CV Non-Copyability",
            difficulty: "easy",
            description: "Explain why this code doesn't compile and provide two different fixes.",
            starterCode: `// This doesn't compile! Why?
struct Worker {
    int id;
    condition_variable_any done;
};

vector<Worker> workers;
for (int i = 0; i < 5; i++) {
    Worker w;
    w.id = i;
    workers.push_back(w);   // ❌ COMPILE ERROR
}

// Fix 1: ???
// Fix 2: ???`,
            solution: `// WHY it fails:
// push_back() copies the Worker struct into the vector.
// But condition_variable_any has a DELETED copy constructor —
// the OS forbids duplicating synchronization primitives.
// So copying a Worker (which contains a CV) fails.

// Fix 1: Use pointers to condition variables
struct Worker {
    int id;
    condition_variable_any* done;   // pointer, not object!
};

vector<Worker> workers;
for (int i = 0; i < 5; i++) {
    Worker w;
    w.id = i;
    w.done = new condition_variable_any();
    workers.push_back(w);   // ✅ copying a pointer is fine!
}
// Don't forget to delete the CVs when done!

// Fix 2: Store Workers as pointers
vector<Worker*> workers;
for (int i = 0; i < 5; i++) {
    Worker* w = new Worker();
    w->id = i;
    workers.push_back(w);   // ✅ copying a pointer is fine!
}
// Worker itself isn't copied, just the pointer to it.`,
            explanation: "Condition variables (and mutexes) cannot be copied because the OS allocates real resources for them. Copying would create ambiguity about ownership. Use pointers to work around this — either pointers to individual CVs or pointers to structs that contain CVs."
        }
    ]
};

export default lecture15;
