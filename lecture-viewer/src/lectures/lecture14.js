export const lecture14 = {
    id: 14,
    title: "Condition Variables",
    subtitle: "Encoding Resource Constraints and Thread Signaling",
    keyTakeaway: "Condition variables let threads wait on an event to occur and notify other threads that an event has occurred, all without busy waiting. Use cv.wait(lock) in a while loop to sleep until a condition becomes true, and notify_all() to wake waiting threads. This is the key to solving the Dining Philosophers problem and many other concurrency patterns.",

    sections: [
        {
            id: "topic-overview",
            title: "Topic 3: Multithreading, Part 3",
            content: `We're continuing our journey through multithreading! Last time we learned about **mutexes** to prevent race conditions and encountered **deadlock** with the Dining Philosophers. Today we'll learn a new tool — **condition variables** — that lets threads communicate with each other and wait efficiently.`,
            keyPoints: [
                "Last lecture: mutexes fix race conditions, but introduce deadlock risk",
                "This lecture: condition variables — threads can WAIT for events and NOTIFY each other",
                "Solves the 'how do I wait for a resource?' problem WITHOUT busy waiting",
                "We'll fully solve the Dining Philosophers problem!",
                "Essential for assign4 and the midterm — condition variables appear on both!"
            ],
            diagram: `
Topic 3: Multithreading Roadmap:

┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Lecture 12   │ →  │  Lecture 13   │ →  │  Lecture 14   │ →  │  Lecture 15   │ →  │  Lecture 16   │
│               │    │               │    │               │    │               │    │               │
│ Multithreading│    │ Race Conds    │    │ Condition     │    │ The Monitor   │    │ Trust & Race  │
│ Introduction  │    │ and Locks     │    │ Variables     │    │ Pattern       │    │ Conditions    │
│               │    │               │    │               │    │               │    │               │
│  (Previous)   │    │  (Previous)   │    │ (This one!)   │    │  (Next)       │    │               │
└───────────────┴────┴───────────────┴────┴───────────────┴────┴───────────────┴────┴───────────────┘

assign4: implement several multithreaded programs while eliminating race conditions!
            `
        },
        {
            id: "recap-mutex-deadlock",
            title: "📋 Recap: Mutexes and Deadlock",
            content: `Quick recap from last lecture. We now have two rules for correct multithreaded programs: **no race conditions** and **no deadlock**. Let's make sure we're solid on both before adding a new tool.`,
            keyPoints: [
                "Mutex = mutual exclusion lock. Only 1 thread owns it at a time.",
                "lock(): acquire the mutex (BLOCKS if someone else has it)",
                "unlock(): release the mutex (wakes one waiting thread)",
                "Use mutexes to protect critical sections — code accessing shared data",
                "Deadlock = all threads blocked, waiting on resources held by each other",
                "Prevention: request resources in the SAME order, or limit number of competing threads"
            ],
            diagram: `
Summary So Far — Two Rules for Correct Multithreading:

┌──────────────────────────────────────────────────────────────────┐
│  RULE 1: No Race Conditions                                      │
│    → Use mutexes to protect critical sections                     │
│    → One mutex per shared resource                                │
│    → Keep critical sections as SMALL as possible                  │
│    → Always unlock on EVERY code path!                            │
├──────────────────────────────────────────────────────────────────┤
│  RULE 2: No Deadlock                                              │
│    → Request resources in the SAME order across all threads       │
│    → Limit the number of threads competing for shared resources   │
│    → If adding sleep_for() anywhere breaks it, you have a bug!    │
└──────────────────────────────────────────────────────────────────┘
            `
        },
        {
            id: "dining-recap",
            title: "🍝 Recap: The Dining Philosophers Deadlock",
            content: `Let's revisit where we left off. The Dining Philosophers program **deadlocks** when all 5 philosophers grab their left fork at the same time — creating a circular wait.`,
            codeExample: {
                title: "dining-philosophers-with-deadlock.cc — The buggy version",
                language: "cpp",
                code: `static void eat(size_t id, mutex& left, mutex& right) {
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
        philosophers[i] = thread(philosopher, i, ref(forks[i]),
            ref(forks[(i + 1) % kNumPhilosophers]));
    }
    for (thread& p: philosophers) p.join();
    return 0;
}`,
                annotations: [
                    { match: "left.lock();\n    right.lock()", explanation: "⚠️ DEADLOCK RISK: If ALL philosophers grab their left fork at the same time, each one blocks waiting for their right fork (held by their neighbor). Circular wait → deadlock!" },
                    { match: "ref(forks[(i + 1) % kNumPhilosophers])", explanation: "The modulo wraps around: philosopher 4's right fork is fork 0. This creates the CIRCULAR dependency — every fork is someone's left AND someone else's right." },
                    { match: "for (size_t i = 0; i < kNumMeals; i++)", explanation: "Each philosopher eats 3 meals, thinking between each. But they may never finish if deadlock occurs!" }
                ]
            },
            keyPoints: [
                "Deadlock: all 5 grab left fork → all wait for right fork → circular wait",
                "Solution idea: limit to at most 4 philosophers trying to eat at once",
                "With 4 competing for 5 forks, at least 1 always gets BOTH forks!",
                "We need a 'permit' system — but HOW do we wait for a permit?"
            ]
        },
        {
            id: "resource-constraints",
            title: "🎫 Encoding Resource Constraints",
            content: `To fix the Dining Philosophers, we need to **limit** how many philosophers can try to eat simultaneously. The key question: how many can try at once?`,
            keyPoints: [
                "5 philosophers, 5 forks → at most 4 should try to eat at once",
                "Why 4? With 4 competing for 5 forks, at least 1 gets both forks → progress!",
                "Alternative: limit to 2 eating at once — works but is more restrictive",
                "4 is better: less bottlenecking while still preventing deadlock",
                "Implementation: a counter of 'permits' that threads must acquire before eating"
            ],
            diagram: `
The Permit System:

Initially: permits = 4  (kNumForks - 1)

To TRY to eat:                          When DONE eating:
┌─────────────────────────┐              ┌─────────────────────┐
│ 1. Check: permits > 0?  │              │ 1. permits++        │
│    YES → permits--      │              │ 2. Continue         │
│          and proceed    │              └─────────────────────┘
│    NO  → WAIT until a   │
│          permit is      │
│          available      │
│ 2. Grab forks and eat   │
└─────────────────────────┘

WHY does this prevent deadlock?
  → At most 4 philosophers compete for 5 forks
  → By pigeonhole principle: at least 1 gets both forks
  → That philosopher eats and returns their permit
  → Another philosopher gets the permit and proceeds
  → GUARANTEED PROGRESS! No circular wait possible.
            `
        },
        {
            id: "busy-waiting-problem",
            title: "⏳ The Busy Waiting Problem",
            content: `Let's try implementing the permit system. A philosopher must call 'waitForPermission()' before eating and 'grantPermission()' when done. But our first attempt has a serious efficiency problem...`,
            codeExample: {
                title: "dining-philosophers-with-busy-waiting.cc — Works but wastes CPU!",
                language: "cpp",
                code: `static void waitForPermission(size_t& permits, mutex& permitsLock) {
    while (true) {
        permitsLock.lock();
        if (permits > 0) break;
        permitsLock.unlock();
        sleep_for(10);  // wait a little while... how long??
    }
    permits--;
    permitsLock.unlock();
}

static void grantPermission(size_t& permits, mutex& permitsLock) {
    permitsLock.lock();
    permits++;
    permitsLock.unlock();
}`,
                annotations: [
                    { match: "while (true)", explanation: "We repeatedly check if permits are available — this is a POLLING loop. We lock, check, unlock, sleep, and repeat over and over." },
                    { match: "if (permits > 0) break", explanation: "If a permit is available, we break out of the loop while still holding the lock, then decrement and unlock below." },
                    { match: "sleep_for(10)", explanation: "THIS IS THE PROBLEM: How long should we sleep? Too short → waste CPU constantly checking. Too long → we wait unnecessarily even when permits ARE available. There's no good answer!" },
                    { match: "permitsLock.lock()", explanation: "We must lock before checking 'permits' because it's shared data. Without this lock, we'd have a race condition on the permits counter." },
                    { match: "permits--", explanation: "Once we break out of the loop (permits > 0), we decrement to 'take' a permit. We still hold the lock here from the break." }
                ]
            },
            keyPoints: [
                "This is called BUSY WAITING — repeatedly checking a condition in a loop",
                "It works correctly but wastes CPU cycles on pointless checking",
                "How long should sleep_for() be? No good answer — it's always a tradeoff",
                "Too short: wastes CPU. Too long: unnecessarily delays the thread",
                "IDEAL: someone should NOTIFY us when a permit becomes available!"
            ],
            diagram: `
Busy Waiting vs. What We Want:

BUSY WAITING (bad):                      IDEAL (what we want):
┌──────────────────────────┐             ┌──────────────────────────┐
│ "Are we there yet?"      │             │ "Wake me up when a       │
│ "No."                    │             │  permit is available."   │
│ "Are we there yet?"      │             │                          │
│ "No."                    │             │        💤 zzz...         │
│ "Are we there yet?"      │             │                          │
│ "No."                    │             │ *permit returned*        │
│ "Are we there yet?"      │             │                          │
│ "YES! Go ahead."         │             │ "Hey wake up! There's    │
│                          │             │  a permit now!"          │
│ Wastes CPU time! 😡      │             │                          │
│ Pointless spinning!      │             │ Efficient! No wasted     │
└──────────────────────────┘             │ CPU cycles! 😊           │
                                         └──────────────────────────┘
            `
        },
        {
            id: "cv-intro",
            title: "📡 Condition Variables: The Solution",
            content: `A **condition variable** is a variable type that lets threads communicate events. One thread can **wait** (sleep) until another thread **notifies** it. No more busy waiting!`,
            keyPoints: [
                "condition_variable_any: a C++ type for thread-to-thread signaling",
                "wait(lock): puts the calling thread to SLEEP (no busy waiting!) until notified",
                "notify_all(): wakes up ALL threads waiting on this condition variable",
                "#include <condition_variable> to use in C++",
                "Analogy: radio station — one thread broadcasts, others tune in and listen",
                "Create one condition variable for each distinct EVENT you need to wait/signal for"
            ],
            diagram: `
Condition Variable = A Radio Station 📻

Thread A (broadcaster):                  Threads B, C, D (listeners):
┌───────────────────────────┐            ┌───────────────────────────┐
│ // Does some work...      │            │ // Need to wait for event │
│ // Event happens!         │            │ cv.wait(lock);            │
│ cv.notify_all();          │────📡────► │    💤 sleeping...          │
│ // "Attention all threads,│            │    💤 sleeping...          │
│ //  event has occurred!"  │            │    📡 "I heard the signal! │
│                           │            │       Time to wake up!"   │
└───────────────────────────┘            └───────────────────────────┘

KEY OPERATIONS:
┌──────────────────────────────────────────────────────────────────┐
│  condition_variable_any cv;     // Create the condition variable  │
│  cv.wait(lock);                 // Sleep until notified           │
│                                 //   (atomically unlocks lock)    │
│  cv.notify_all();               // Wake ALL waiting threads       │
└──────────────────────────────────────────────────────────────────┘
            `
        },
        {
            id: "cv-five-steps",
            title: "📋 The 5-Step Condition Variable Recipe",
            content: `Every time you use a condition variable, follow these 5 steps. This is a **systematic approach** — use it every time you need thread coordination. Memorize this for the exam!`,
            keyPoints: [
                "Step 1: Identify a single event to wait/notify for",
                "Step 2: Ensure there is proper shared state to check if the event has happened",
                "Step 3: Create a condition_variable_any and share it among relevant threads",
                "Step 4: Identify who NOTIFIES — have them call notify_all() when the event occurs",
                "Step 5: Identify who WAITS — have them call wait(lock) until the event occurs"
            ],
            diagram: `
The 5-Step Condition Variable Recipe:

┌──────────────────────────────────────────────────────────────────┐
│ STEP  │  QUESTION TO ASK                │  DINING PHILOSOPHERS   │
├───────┼─────────────────────────────────┼────────────────────────┤
│  1    │ What event am I waiting for?    │ "Permits are available" │
│       │                                 │                        │
│  2    │ What state tells me if the      │ permits counter > 0    │
│       │ event has happened?             │                        │
│       │                                 │                        │
│  3    │ Create a CV and share it among  │ condition_variable_any │
│       │ all relevant threads            │ permitsCV;             │
│       │                                 │                        │
│  4    │ WHO triggers the event?         │ Philosopher that       │
│       │ → They call notify_all()        │ finishes eating        │
│       │                                 │                        │
│  5    │ WHO waits for the event?        │ Philosopher that needs │
│       │ → They call wait(lock)          │ a permit to eat        │
└───────┴─────────────────────────────────┴────────────────────────┘

This recipe works for ANY condition variable scenario!
            `
        },
        {
            id: "cv-grant-permission",
            title: "Step 4: grantPermission with notify_all()",
            content: `When a philosopher finishes eating and returns their permit, they should **notify** waiting philosophers that a permit is now available. This is the "broadcaster" side.`,
            codeExample: {
                title: "grantPermission — notify when permits become available",
                language: "cpp",
                code: `static void grantPermission(size_t& permits,
    condition_variable_any& permitsCV, mutex& permitsLock) {
    permitsLock.lock();
    permits++;
    if (permits == 1) permitsCV.notify_all();
    permitsLock.unlock();
}`,
                annotations: [
                    { match: "permitsLock.lock()", explanation: "Lock before modifying the shared permits counter. This prevents race conditions on the counter itself." },
                    { match: "permits++", explanation: "Return the permit by incrementing the counter. We now have one more permit available." },
                    { match: "if (permits == 1) permitsCV.notify_all()", explanation: "We only notify when permits goes from 0→1. Why? If permits was already > 0, nobody was waiting, so notifying is pointless (but harmless — we could notify every time and it would still be correct, just slightly less efficient)." },
                    { match: "permitsLock.unlock()", explanation: "Release the lock after all modifications are complete. Waiting threads can now acquire the lock and check the permits count." }
                ]
            },
            keyPoints: [
                "Increment permits INSIDE the lock (shared data!)",
                "Notify when permits goes from 0 to 1 — that's when waiters need to know",
                "notify_all() wakes up ALL threads waiting on permitsCV",
                "Side note: notifying every time (not just when permits == 1) also works correctly!"
            ]
        },
        {
            id: "cv-wait-v1",
            title: "Step 5: waitForPermission — First Attempt",
            content: `Now for the waiting side. If no permits are available, we need to **sleep** until someone returns one. But our first attempt has a subtle but **deadly** race condition...`,
            codeExample: {
                title: "waitForPermission — BUGGY first attempt (NOT final form!)",
                language: "cpp",
                code: `// ⚠️ WARNING: This version has a race condition!
static void waitForPermission(size_t& permits,
    condition_variable_any& permitsCV, mutex& permitsLock) {
    permitsLock.lock();
    if (permits == 0) {
        permitsLock.unlock();
        permitsCV.wait();     // NOT the final form of wait()!
        permitsLock.lock();
    }
    permits--;
    permitsLock.unlock();
}`,
                annotations: [
                    { match: "permitsLock.lock()", explanation: "Lock before checking permits — it's shared data." },
                    { match: "if (permits == 0)", explanation: "No permits available, so we need to wait for one." },
                    { match: "permitsLock.unlock()", explanation: "We MUST unlock before waiting — otherwise, no one can put a permit back (they need the lock to modify permits). But THIS creates a dangerous gap..." },
                    { match: "permitsCV.wait()", explanation: "⚠️ PROBLEM: Between unlock() and wait(), another thread could return a permit AND call notify_all(). If we're not yet waiting when the notification fires, we MISS it and wait forever!" },
                    { match: "permitsLock.lock()", explanation: "After waking up, re-acquire the lock to safely modify permits." },
                    { match: "permits--", explanation: "Take a permit (decrement the counter)." }
                ]
            },
            keyPoints: [
                "KEY INSIGHT: We MUST release the lock while waiting (so someone can return a permit)",
                "BUT: if we unlock BEFORE calling wait(), there's an 'air gap' where we could miss a notification",
                "This is a classic race condition that leads to DEADLOCK",
                "A thread that isn't yet waiting on a CV won't receive notifications sent to that CV"
            ]
        },
        {
            id: "cv-air-gap",
            title: "💀 The Air Gap Problem",
            content: `Let's trace through the race condition step by step. This is the kind of scenario you need to be able to identify on the **midterm**!`,
            diagram: `
The "Air Gap" Race Condition:

Thread #1 (wants to eat)                Thread #2 (done eating)
─────────────────────────                ─────────────────────────
permitsLock.lock();
  permits == 0? YES!
  permitsLock.unlock();
                            ← AIR GAP!
                                         permitsLock.lock();
                                         permits++;    // permits = 1
                                         permits == 1? YES!
                                         permitsCV.notify_all();  ← 📡 BROADCAST!
                                         permitsLock.unlock();

  permitsCV.wait();   ← 💀 TOO LATE!
                         Thread 1 wasn't waiting yet
                         when the notification fired!
                         It missed the notification!

  ... waits FOREVER ...  ← 😵 DEADLOCK!
                           The permit IS available (permits = 1)
                           but nobody will ever notify again.

┌─────────────────────────────────────────────────────┐
│ THE PROBLEM: Between unlock() and wait(), there     │
│ is a window where a notification can be missed.     │
│ If that was the LAST notification, we wait forever! │
└─────────────────────────────────────────────────────┘
            `,
            keyPoints: [
                "Between unlock() and wait() is the 'air gap' — notifications sent during this window are LOST",
                "Thread 1 unlocks, Thread 2 swoops in, returns the permit, and notifies",
                "But Thread 1 isn't waiting yet when the notification fires!",
                "Thread 1 then calls wait() and sleeps forever — nobody will notify again",
                "This is exactly the kind of subtle bug the midterm tests you on!"
            ]
        },
        {
            id: "cv-wait-with-lock",
            title: "🔑 The Solution: wait(lock)",
            content: `Condition variables are designed exactly for this situation! The 'wait()' function takes a **mutex parameter** and atomically (1) puts us to sleep AND (2) releases the lock. No air gap!`,
            codeExample: {
                title: "waitForPermission — Fixed with wait(lock)  (still not final!)",
                language: "cpp",
                code: `// Better, but still has one more bug...
static void waitForPermission(size_t& permits,
    condition_variable_any& permitsCV, mutex& permitsLock) {
    permitsLock.lock();
    if (permits == 0) {
        permitsCV.wait(permitsLock);
    }
    permits--;
    permitsLock.unlock();
}`,
                annotations: [
                    { match: "permitsCV.wait(permitsLock)", explanation: "THIS is the key! wait(lock) atomically: (1) puts us to sleep AND (2) unlocks the mutex — all as ONE atomic operation. No air gap! When we wake up, it re-locks the mutex before returning." },
                    { match: "if (permits == 0)", explanation: "⚠️ Still using 'if' here — this is the remaining bug we need to fix (coming up next)." },
                    { match: "permits--", explanation: "When we reach here, we hold the lock and permits should be > 0... but what if multiple threads woke up and only 1 permit was returned?" }
                ]
            },
            keyPoints: [
                "cv.wait(lock) does 4 things atomically:",
                "  1. Puts the calling thread to sleep",
                "  2. Unlocks the given mutex (so others can return permits)",
                "  3. When notified, wakes up",
                "  4. Re-acquires the mutex before returning (blocks until it can)",
                "The unlock + sleep happen ATOMICALLY — no air gap possible!",
                "This is why wait() REQUIRES a mutex parameter"
            ],
            diagram: `
cv.wait(lock) — What Happens Under the Hood:

┌──────────────────────────────────────────────────────────────────┐
│  cv.wait(permitsLock) does the following:                         │
│                                                                   │
│  1. ATOMICALLY: puts this thread to sleep AND unlocks the mutex  │
│     → No air gap! They happen as ONE indivisible operation        │
│     → This ensures we can't miss a notification                   │
│                                                                   │
│  2. Thread sleeps until the CV is signaled (notify_all called)   │
│                                                                   │
│  3. Upon waking up, TRIES to re-acquire the mutex                │
│     → If mutex is locked, the thread BLOCKS here until it's free │
│     → This guarantees we hold the lock when wait() returns       │
│                                                                   │
│  4. wait() returns — we now hold the lock and can safely         │
│     check/modify shared state                                     │
└──────────────────────────────────────────────────────────────────┘

BEFORE cv.wait():  thread holds the lock
DURING cv.wait():  thread is asleep, lock is released
AFTER  cv.wait():  thread holds the lock again
            `
        },
        {
            id: "cv-overpermitting",
            title: "⚠️ Over-Permitting: The while Loop Fix",
            content: `We fixed the air gap, but there's still a bug! What happens when **multiple threads** wake up from notify_all() but only **one permit** was returned?`,
            diagram: `
The Over-Permitting Problem:

Thread #1 (waiting)      Thread #2 (waiting)      Thread #3 (done eating)
──────────────────       ──────────────────       ──────────────────
cv.wait(lock) 💤         cv.wait(lock) 💤

                                                  permits++;  // permits = 1
                                                  notify_all(); 📡

     😃 Wakes up!              😃 Wakes up!
     (re-acquires lock)        (waiting for lock)

     permits--;                
     permits = 0 ✓             
     unlock();                 
                               (acquires lock)
                               permits--;
                               permits = 0 - 1
                               = 18446744073709551615 💥
                               (unsigned overflow!)

┌─────────────────────────────────────────────────────────────────┐
│ PROBLEM: notify_all() woke up BOTH Thread 1 AND Thread 2,      │
│ but there was only 1 permit! Thread 2 'stole' a permit that     │
│ doesn't exist. We have a FAKE permit — too many philosophers    │
│ trying to eat!                                                   │
└─────────────────────────────────────────────────────────────────┘
            `,
            keyPoints: [
                "notify_all() wakes ALL waiting threads, but only 1 permit was returned",
                "First thread takes the permit (permits 1→0) ✓",
                "Second thread also decrements (permits 0→underflow) 💥",
                "We have MORE threads eating than permits allow — defeats the purpose!",
                "Solution: after waking up, CHECK AGAIN if permits are available",
                "Use a WHILE loop instead of IF — if no permits left, go back to sleep!"
            ]
        },
        {
            id: "cv-final-version",
            title: "✅ The Final Version: while + wait(lock)",
            content: `Here is the correct, final implementation. The key change: use a **while loop** instead of **if**, so that when a thread wakes up and finds no permits, it goes right back to sleep.`,
            codeExample: {
                title: "dining-philosophers-with-cv-wait.cc — The final correct version!",
                language: "cpp",
                code: `static void waitForPermission(size_t& permits,
    condition_variable_any& permitsCV, mutex& permitsLock) {
    permitsLock.lock();
    while (permits == 0) {
        permitsCV.wait(permitsLock);
    }
    permits--;
    permitsLock.unlock();
}

static void grantPermission(size_t& permits,
    condition_variable_any& permitsCV, mutex& permitsLock) {
    permitsLock.lock();
    permits++;
    if (permits == 1) permitsCV.notify_all();
    permitsLock.unlock();
}`,
                annotations: [
                    { match: "while (permits == 0)", explanation: "THE KEY FIX: Use 'while' instead of 'if'! When we wake up from wait(), we re-check the condition. If permits are STILL 0 (another thread grabbed the permit first), we wait AGAIN. We only exit the loop when permits > 0." },
                    { match: "permitsCV.wait(permitsLock)", explanation: "Atomically: sleep + unlock the mutex. When notified, re-acquire the lock. Then the while loop checks if permits > 0 again." },
                    { match: "permits--", explanation: "We only reach this line when permits > 0 (the while loop guarantees it). Safely take a permit." },
                    { match: "if (permits == 1) permitsCV.notify_all()", explanation: "When returning a permit and permits goes from 0→1, notify all waiters. They'll each wake up, re-check the while loop, and only one will get the permit." }
                ]
            },
            keyPoints: [
                "ALWAYS call wait(lock) in a WHILE loop, never an IF statement!",
                "Two reasons for the while loop:",
                "  1. Multiple threads wake up for a single resource → only one should proceed",
                "  2. Spurious wakeups — threads can wake up even WITHOUT being notified!",
                "This pattern (lock, while condition false, wait inside loop) is THE standard pattern",
                "MEMORIZE THIS PATTERN for the exam!"
            ]
        },
        {
            id: "spurious-wakeups",
            title: "👻 Spurious Wakeups",
            content: `There's actually a SECOND reason to use a while loop: **spurious wakeups**. The operating system can wake up a thread even when nobody called notify_all()! This is a known behavior of condition variables on most systems.`,
            keyPoints: [
                "Spurious wakeup = thread wakes up from wait() without being notified",
                "This is a well-known behavior of condition variables — NOT a bug in your code",
                "It can happen due to implementation details of the OS threading library",
                "The while loop protects us: if we wake up spuriously, we re-check the condition",
                "If the condition is still false (permits == 0), we go right back to sleep",
                "ALWAYS use while loops with wait() — there is NEVER a reason to use 'if' instead"
            ],
            diagram: `
Why WHILE is Always Required (Two Reasons):

Reason 1: Multiple waiters, single resource
┌─────────────────────────────────────────┐
│ Thread A and B both waiting             │
│ 1 permit returned → notify_all()        │
│ Both wake up, but only 1 can proceed    │
│ The other must wait again               │
└─────────────────────────────────────────┘

Reason 2: Spurious wakeups
┌─────────────────────────────────────────┐
│ Thread wakes up without being notified! │
│ OS can do this for internal reasons     │
│ Must re-check condition before          │
│ proceeding                              │
└─────────────────────────────────────────┘

                    EXAM RULE:
    ┌───────────────────────────────────────┐
    │  ALWAYS use:                          │
    │    while (condition_not_met) {        │
    │        cv.wait(lock);                 │
    │    }                                  │
    │                                       │
    │  NEVER use:                           │
    │    if (condition_not_met) {            │
    │        cv.wait(lock);                 │
    │    }                                  │
    └───────────────────────────────────────┘
            `
        },
        {
            id: "complete-solution",
            title: "🎉 Complete Dining Philosophers Solution",
            content: `Let's put it all together. Here's the complete, correct solution to the Dining Philosophers using condition variables to limit the number of concurrent eaters.`,
            codeExample: {
                title: "dining-philosophers-with-cv-wait.cc — Complete working solution",
                language: "cpp",
                code: `static const size_t kNumPhilosophers = 5;
static const size_t kNumForks = kNumPhilosophers;
static const size_t kNumMeals = 3;

static void waitForPermission(size_t& permits,
    condition_variable_any& permitsCV, mutex& permitsLock) {
    permitsLock.lock();
    while (permits == 0) {
        permitsCV.wait(permitsLock);
    }
    permits--;
    permitsLock.unlock();
}

static void grantPermission(size_t& permits,
    condition_variable_any& permitsCV, mutex& permitsLock) {
    permitsLock.lock();
    permits++;
    if (permits == 1) permitsCV.notify_all();
    permitsLock.unlock();
}

static void eat(size_t id, mutex& left, mutex& right,
    size_t& permits, condition_variable_any& permitsCV,
    mutex& permitsLock) {
    waitForPermission(permits, permitsCV, permitsLock);
    left.lock();
    right.lock();
    cout << oslock << id << " starts eating om nom nom nom."
         << endl << osunlock;
    sleep_for(getEatTime());
    cout << oslock << id << " all done eating."
         << endl << osunlock;
    grantPermission(permits, permitsCV, permitsLock);
    left.unlock();
    right.unlock();
}

static void philosopher(size_t id, mutex& left, mutex& right,
    size_t& permits, condition_variable_any& permitsCV,
    mutex& permitsLock) {
    for (size_t i = 0; i < kNumMeals; i++) {
        think(id);
        eat(id, left, right, permits, permitsCV, permitsLock);
    }
}

int main(int argc, const char *argv[]) {
    mutex forks[kNumForks];
    size_t permits = kNumForks - 1;
    mutex permitsLock;
    condition_variable_any permitsCV;

    thread philosophers[kNumPhilosophers];
    for (size_t i = 0; i < kNumPhilosophers; i++) {
        philosophers[i] = thread(philosopher, i, ref(forks[i]),
            ref(forks[(i + 1) % kNumPhilosophers]),
            ref(permits), ref(permitsCV), ref(permitsLock));
    }
    for (thread& p: philosophers) p.join();
    return 0;
}`,
                annotations: [
                    { match: "size_t permits = kNumForks - 1", explanation: "Start with 4 permits (5 forks - 1). At most 4 philosophers can try to eat at once, ensuring at least 1 always gets both forks." },
                    { match: "condition_variable_any permitsCV", explanation: "The condition variable shared by ALL threads. Used to signal when permits become available." },
                    { match: "waitForPermission(permits, permitsCV, permitsLock)", explanation: "Before grabbing forks, get a permit. If none available, this will SLEEP until one is returned. No busy waiting!" },
                    { match: "grantPermission(permits, permitsCV, permitsLock)", explanation: "After eating, return the permit BEFORE unlocking the forks. This lets another philosopher start trying to eat." },
                    { match: "left.lock();\n    right.lock()", explanation: "Safe to grab both forks now! Since at most 4 philosophers reach this point, at least 1 will get both forks — no deadlock." },
                    { match: "ref(permitsCV)", explanation: "Must pass the condition variable by reference — all threads must share the SAME CV object." }
                ]
            }
        },
        {
            id: "cv-key-takeaways",
            title: "🔑 Condition Variable Key Takeaways",
            content: `Let's consolidate everything. This is the material you MUST know for the midterm and assign4.`,
            keyPoints: [
                "condition_variable_any: shared variable for thread-to-thread signaling",
                "wait(lock): atomically sleep + unlock; re-lock upon waking",
                "notify_all(): wake ALL threads waiting on this CV",
                "MUST release the lock while waiting (so others can make the event happen)",
                "wait(lock) solves this: unlock + sleep atomically — no air gap",
                "ALWAYS use wait() in a WHILE loop (multiple wake-ups, spurious wakeups)",
                "Follow the 5-step recipe every time you use a condition variable"
            ],
            diagram: `
Condition Variable Cheat Sheet (Exam Day Reference!):

┌──────────────────────────────────────────────────────────────────┐
│  CREATING:                                                        │
│    condition_variable_any cv;                                    │
│    #include <condition_variable>                                 │
│                                                                   │
│  WAITING PATTERN (always use this exact pattern!):               │
│    lock.lock();                                                   │
│    while (!condition) {        // WHILE, not IF!                 │
│        cv.wait(lock);          // sleep + unlock atomically      │
│    }                                                              │
│    // ... do work (condition is now true, lock is held) ...      │
│    lock.unlock();                                                 │
│                                                                   │
│  NOTIFYING PATTERN:                                               │
│    lock.lock();                                                   │
│    // ... make the condition true ...                             │
│    cv.notify_all();            // wake all waiting threads        │
│    lock.unlock();                                                 │
│                                                                   │
│  RULES:                                                           │
│    1. wait() must be passed the lock protecting the shared state │
│    2. ALWAYS wait in a while loop                                │
│    3. Lock must be HELD when calling wait()                      │
│    4. Lock must be HELD when calling notify_all()                │
│    5. wait() unlocks and re-locks automatically                  │
└──────────────────────────────────────────────────────────────────┘
            `
        },
        {
            id: "exam-prep",
            title: "🎯 Midterm Prep: Condition Variables",
            content: `Multithreading is on the midterm! While threading is slightly less emphasized (assign4 isn't due yet), you should be confident with these concepts.`,
            keyPoints: [
                "📝 Know what a condition variable IS and what problem it solves (no busy waiting)",
                "📝 Be able to write the waiting pattern: lock → while → wait(lock) → work → unlock",
                "📝 Explain why wait(lock) takes a mutex parameter (air gap problem)",
                "📝 Explain why we use 'while' not 'if' (multiple waiters, spurious wakeups)",
                "📝 Trace through code with CVs and identify race conditions or deadlock",
                "📝 Know the 5-step CV recipe and apply it to new scenarios",
                "📝 Understand the Dining Philosophers solution end-to-end"
            ],
            diagram: `
Midterm Cheat Sheet — Condition Variables:

┌─────────────────────────────────────────────────────────────────┐
│  CONCEPT              │  KEY EXAM QUESTION                      │
├─────────────────────────────────────────────────────────────────┤
│  Busy waiting         │  Why is it bad? (wastes CPU)            │
│  vs. CV               │  CV → thread sleeps, no CPU waste       │
├─────────────────────────────────────────────────────────────────┤
│  wait(lock)           │  Why does it take a lock parameter?     │
│                       │  → must unlock atomically with sleep    │
│                       │  → prevents the "air gap" race cond.    │
├─────────────────────────────────────────────────────────────────┤
│  while vs. if         │  Why while? Two reasons:                │
│                       │  1. Multiple threads wake for 1 event   │
│                       │  2. Spurious wakeups                    │
├─────────────────────────────────────────────────────────────────┤
│  notify_all()         │  When should you call it?               │
│                       │  → When the waited-for event occurs     │
│                       │  → While holding the lock               │
├─────────────────────────────────────────────────────────────────┤
│  Dining Philosophers  │  Why 4 permits? (N-1 for N forks)      │
│                       │  How does it prevent deadlock?           │
│                       │  Trace through the full solution         │
└─────────────────────────────────────────────────────────────────┘
            `
        },
        {
            id: "summary",
            title: "Lecture 14 Summary",
            content: `We learned how condition variables solve the problem of efficient thread coordination — letting threads wait for events without busy waiting.`,
            keyPoints: [
                "Busy waiting = polling in a loop — wastes CPU, poor approach",
                "Condition variables: wait(lock) sleeps until notified — efficient!",
                "wait(lock) atomically sleeps + unlocks the mutex (no air gap)",
                "notify_all() wakes ALL waiting threads",
                "ALWAYS call wait(lock) in a WHILE loop (not IF)",
                "Dining Philosophers: use permits + CV to limit concurrent eaters → no deadlock",
                "5-step recipe: identify event, check state, create CV, add notify, add wait"
            ],
            advantages: [
                "No busy waiting — threads sleep efficiently, saving CPU",
                "Atomic unlock+sleep prevents the air gap race condition",
                "Simple API: wait(lock) and notify_all()",
                "Enables complex thread coordination patterns (used heavily in assign4)"
            ],
            disadvantages: [
                "Must remember to use while (not if) with wait()",
                "Must pass the correct lock to wait()",
                "Spurious wakeups mean you can't assume the condition is true upon wakeup",
                "Can be tricky to identify the right events and state for each CV"
            ]
        },
        {
            id: "next-time",
            title: "Coming Up Next",
            content: `Next lecture we'll learn about the **Monitor Pattern** — a clean design pattern for combining mutexes and condition variables into a single class. This is the go-to pattern for writing thread-safe data structures!`,
            keyPoints: [
                "The Monitor Pattern: packaging mutexes + CVs into a class",
                "Encapsulates all synchronization inside the object",
                "Makes thread-safe code cleaner and less error-prone",
                "Essential pattern for assign4!",
                "Preview: semaphores — a higher-level abstraction built on CVs"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Busy Waiting vs. Condition Variables",
            difficulty: "easy",
            description: "What are two problems with the busy waiting approach, and how do condition variables solve them?",
            starterCode: `// Busy waiting approach:
static void waitForPermission(size_t& permits, mutex& permitsLock) {
    while (true) {
        permitsLock.lock();
        if (permits > 0) break;
        permitsLock.unlock();
        sleep_for(10);
    }
    permits--;
    permitsLock.unlock();
}

// What are the two main problems with this approach?
// How do condition variables fix each one?`,
            solution: `// Problem 1: WASTED CPU
//   The thread constantly wakes up to check if permits > 0,
//   even when nothing has changed. This wastes CPU cycles.
//   CV fix: wait(lock) puts the thread to SLEEP. It uses
//   zero CPU until notified by another thread.

// Problem 2: ARBITRARY DELAY
//   sleep_for(10) is arbitrary. If a permit becomes available
//   1ms after we sleep, we still wait 9ms for nothing.
//   If we make the sleep shorter, we waste MORE CPU.
//   CV fix: wait(lock) wakes up IMMEDIATELY when notified.
//   No arbitrary delay — the thread learns about the event
//   as soon as it happens.

// With condition variables:
static void waitForPermission(size_t& permits,
    condition_variable_any& permitsCV, mutex& permitsLock) {
    permitsLock.lock();
    while (permits == 0) {
        permitsCV.wait(permitsLock);  // efficient sleep!
    }
    permits--;
    permitsLock.unlock();
}`,
            explanation: "Busy waiting wastes CPU by constantly checking and has an arbitrary delay between checks. Condition variables solve both: the thread sleeps (zero CPU) and wakes immediately when notified."
        },
        {
            id: "ex2",
            title: "Spot the Bug: if vs. while",
            difficulty: "medium",
            description: "This code uses 'if' instead of 'while'. Describe a scenario where this leads to incorrect behavior with 3 threads.",
            starterCode: `static void waitForPermission(size_t& permits,
    condition_variable_any& permitsCV, mutex& permitsLock) {
    permitsLock.lock();
    if (permits == 0) {          // BUG: should be 'while'!
        permitsCV.wait(permitsLock);
    }
    permits--;
    permitsLock.unlock();
}

// Scenario: Thread A and Thread B are both waiting.
// Thread C returns 1 permit and calls notify_all().
// Trace through what happens to both Thread A and B.`,
            solution: `// Thread A and Thread B are both waiting (permits = 0)
// Thread C returns 1 permit:
//   permits = 1
//   notify_all()  → wakes BOTH Thread A and Thread B
//
// Thread A wakes up first, re-acquires lock:
//   permits == 0? No (permits = 1), so skip the 'if'
//   Wait — actually A was inside wait(), so it exits.
//   Since we used 'if', we DON'T re-check the condition.
//   permits--  → permits = 0  ✓ (Thread A got the permit)
//   unlock()
//
// Thread B wakes up, re-acquires lock:
//   Since we used 'if', we DON'T re-check permits == 0.
//   We just continue past the if block.
//   permits--  → permits = 0 - 1 = underflow! 💥
//   Now permits = 18446744073709551615 (SIZE_T_MAX)
//   Thread B proceeds with a FAKE permit!
//
// FIX: Use 'while' so Thread B re-checks the condition:
//   while (permits == 0) → true → goes back to sleep ✓`,
            explanation: "With 'if', both threads proceed after being woken up, but only one permit was returned. The second thread underflows the counter. With 'while', the second thread re-checks and goes back to sleep."
        },
        {
            id: "ex3",
            title: "The Air Gap Problem",
            difficulty: "medium",
            description: "Explain why this code can lead to a missed notification and deadlock. What is the 'air gap'?",
            starterCode: `// BUGGY version:
static void waitForPermission(size_t& permits,
    condition_variable_any& permitsCV, mutex& permitsLock) {
    permitsLock.lock();
    if (permits == 0) {
        permitsLock.unlock();     // line A
        // ← what could happen here?
        permitsCV.wait();         // line B (not final form)
        permitsLock.lock();
    }
    permits--;
    permitsLock.unlock();
}

// Describe what happens if another thread returns a permit
// between line A and line B.`,
            solution: `// The "air gap" is between line A (unlock) and line B (wait).
//
// Scenario:
//   Thread 1: permitsLock.lock()
//   Thread 1: permits == 0? YES
//   Thread 1: permitsLock.unlock()     ← AIR GAP STARTS
//
//   Thread 2: permitsLock.lock()       ← swoops in!
//   Thread 2: permits++                ← permits = 1
//   Thread 2: permitsCV.notify_all()   ← sends notification!
//   Thread 2: permitsLock.unlock()
//
//   Thread 1: permitsCV.wait()         ← AIR GAP ENDS
//             Thread 1 wasn't waiting when the notification
//             was sent, so it MISSED it! 💀
//             Thread 1 now waits FOREVER.
//
// FIX: Use cv.wait(permitsLock) which atomically releases
// the lock AND starts waiting — no gap between them.
// This is the WHOLE REASON wait() takes a lock parameter!
//
// CORRECT:
//   permitsLock.lock();
//   while (permits == 0) {
//       permitsCV.wait(permitsLock);  // atomic unlock+sleep
//   }
//   permits--;
//   permitsLock.unlock();`,
            explanation: "The air gap between unlock() and wait() allows another thread to return a permit and notify BEFORE we start waiting. Since we aren't waiting yet, we miss the notification. wait(lock) fixes this by atomically unlocking and sleeping."
        },
        {
            id: "ex4",
            title: "Write a Thread-Safe Counter with CV",
            difficulty: "hard",
            description: "Implement a thread-safe counter where one thread waits until the counter reaches a target value. Use the 5-step CV recipe.",
            starterCode: `// Thread 1 increments a shared counter.
// Thread 2 waits until the counter reaches 10.
// Use the 5-step CV recipe.

int counter = 0;
mutex counterLock;
// Add condition variable and implement both functions.

void incrementer() {
    for (int i = 0; i < 10; i++) {
        sleep_for(100);  // simulate work
        // TODO: increment counter, notify if needed
    }
}

void waiter() {
    // TODO: wait until counter reaches 10
    cout << "Counter reached 10!" << endl;
}`,
            solution: `// 5-step recipe:
// 1. Event: counter reaches 10
// 2. State: counter variable (already exists)
// 3. Create CV: condition_variable_any counterCV
// 4. Notify: incrementer notifies when counter reaches 10
// 5. Wait: waiter waits until counter >= 10

int counter = 0;
mutex counterLock;
condition_variable_any counterCV;

void incrementer() {
    for (int i = 0; i < 10; i++) {
        sleep_for(100);
        counterLock.lock();
        counter++;
        if (counter == 10) counterCV.notify_all();
        counterLock.unlock();
    }
}

void waiter() {
    counterLock.lock();
    while (counter < 10) {
        counterCV.wait(counterLock);
    }
    counterLock.unlock();
    cout << "Counter reached 10!" << endl;
}

// Key points:
// - while (counter < 10) handles spurious wakeups
// - We hold the lock when checking counter AND when
//   modifying counter (both are accessing shared data)
// - notify_all() is called when the event occurs
// - wait(counterLock) atomically sleeps + unlocks`,
            explanation: "Following the 5-step recipe: the event is 'counter reaches 10', the state is the counter itself, we create a CV, the incrementer notifies, and the waiter waits in a while loop."
        },
        {
            id: "ex5",
            title: "Dining Philosophers: Why N-1 Permits?",
            difficulty: "medium",
            description: "If we have 5 philosophers and 5 forks, explain why we need exactly 4 permits (N-1). What would happen with 3 permits? What about 5?",
            starterCode: `// 5 philosophers, 5 forks
// permits = ???

// Case 1: permits = 5 (all can try to eat)
// Case 2: permits = 4 (at most 4 can try to eat)
// Case 3: permits = 3 (at most 3 can try to eat)

// For each case:
// 1. Can deadlock occur?
// 2. What is the maximum concurrency (how many eat at once)?`,
            solution: `// Case 1: permits = 5 (all can try to eat)
//   → CAN DEADLOCK! All 5 grab left fork, all wait for right.
//   → This is the ORIGINAL buggy version.
//   → Max concurrency: 2 (at most 2 can hold both forks)
//   → But sometimes 0 eat due to deadlock.

// Case 2: permits = 4 (at most 4 try to eat) ← OPTIMAL!
//   → DEADLOCK-FREE! At most 4 compete for 5 forks.
//   → By pigeonhole: at least 1 of 4 gets both forks.
//   → Max concurrency: 2 (at most 2 can hold both forks)
//   → GUARANTEED progress — at least 1 always eats.

// Case 3: permits = 3 (at most 3 try to eat)
//   → DEADLOCK-FREE! Even safer than 4 permits.
//   → But MORE restrictive — only 3 can even TRY.
//   → Max concurrency: still 2 (geometry limits this)
//   → Unnecessarily limits concurrency.

// RULE: N-1 permits for N resources is the sweet spot.
// It prevents deadlock while maximizing concurrency.
// Any fewer permits works but is overly restrictive.
// N permits doesn't prevent deadlock.`,
            explanation: "N-1 permits (4 for 5 forks) is optimal: it prevents deadlock by eliminating the circular wait (pigeonhole principle guarantees at least one thread gets both resources) while keeping concurrency as high as possible."
        },
        {
            id: "ex6",
            title: "CV Pattern Recognition",
            difficulty: "easy",
            description: "For each scenario, identify: the EVENT, the STATE, and who should WAIT vs. NOTIFY.",
            starterCode: `// Scenario A: Producer-Consumer
// Thread P produces data items and adds them to a queue.
// Thread C consumes items from the queue.
// C should wait when the queue is empty.

// Scenario B: Thread Barrier
// 5 threads each do some work, then all must wait
// until ALL threads finish before continuing.

// Scenario C: Print Server
// Multiple threads submit print jobs.
// A single printer thread processes them one at a time.
// Printer waits when no jobs are pending.

// For each: What is the EVENT? What STATE to check?
// Who WAITs? Who NOTIFYs?`,
            solution: `// Scenario A: Producer-Consumer
//   EVENT: "an item was added to the queue"
//   STATE: queue.size() > 0
//   WAIT: Consumer C — while (queue.empty()) cv.wait(lock);
//   NOTIFY: Producer P — after adding item, cv.notify_all();

// Scenario B: Thread Barrier
//   EVENT: "all threads have finished their work"
//   STATE: finishedCount == 5
//   WAIT: Each thread — while (finishedCount < 5) cv.wait(lock);
//   NOTIFY: Each thread — after finishing, increment count,
//           if (finishedCount == 5) cv.notify_all();

// Scenario C: Print Server
//   EVENT: "a print job was submitted"
//   STATE: !jobQueue.empty()
//   WAIT: Printer thread — while (jobQueue.empty()) cv.wait(lock);
//   NOTIFY: Submitter threads — after adding job, cv.notify_all();

// Notice the pattern: the WAITER checks state in a while loop,
// and the NOTIFIER modifies state and then notifies.
// This is the same pattern EVERY TIME!`,
            explanation: "In each scenario, identify who produces the event (notifier) and who consumes it (waiter). The waiter always checks state in a while loop. The notifier modifies state and calls notify_all()."
        }
    ]
};

export default lecture14;
