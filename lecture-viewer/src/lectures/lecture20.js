export const lecture20 = {
    id: 20,
    title: "Implementing Locks and Condition Variables",
    subtitle: "Building Synchronization Primitives from Scratch",
    keyTakeaway: "Locks consist of a locked flag and a waiting queue. To lock: if unlocked, take it; otherwise, add yourself to the queue and block. To unlock: if someone is waiting, wake them up (keep it locked); otherwise, mark it unlocked. We must disable interrupts (using IntrGuard) inside lock/unlock to prevent race conditions within the synchronization code itself. Condition variables also need a waiting queue: wait() atomically unlocks the mutex and blocks, then re-locks on wakeup. notify_one/notify_all wake blocked threads. These are exactly what you implement on assign5!",

    sections: [
        {
            id: "topic-overview",
            title: "Topic 3: Multithreading, Part 8",
            content: `This is the culmination of our multithreading implementation deep-dive! We've learned how the OS **switches** threads (dispatching), **chooses** which thread to run (scheduling), and **forces** switches with timer interrupts (preemption). Now we put it all together to build real synchronization primitives: **locks** and **condition variables**. This is exactly what you'll implement on **assign5**!`,
            keyPoints: [
                "Lecture 17 (Dispatching): the MECHANISM — HOW to switch threads (context switch)",
                "Lecture 18 (Scheduling): the POLICY — WHICH thread to run next",
                "Lecture 19 (Preemption): FORCING switches with timer interrupts + intro to lock implementation",
                "Lecture 20 (This one!): fully implementing locks and condition variables",
                "assign5: implement your own thread, mutex, and condition_variable!"
            ],
            diagram: `
Topic 3: Multithreading — Implementation Roadmap:

┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Lecture 17   │ →  │  Lecture 18   │ →  │  Lecture 19   │ →  │  Lecture 20   │
│               │    │               │    │               │    │               │
│ Dispatching   │    │ Scheduling    │    │ Preemption &  │    │ Implementing  │
│ (context      │    │ (which thread │    │ Implementing  │    │ Locks and     │
│  switching)   │    │  runs next?)  │    │ Locks (intro) │    │ Cond. Vars    │
│               │    │               │    │               │    │               │
│ (Done!)       │    │ (Done!)       │    │ (Done!)       │    │ (This one!)   │
└───────────────┴────┴───────────────┴────┴───────────────┴────┴───────────────┘

assign5: implement your own version of thread, mutex and condition_variable!
            `
        },
        {
            id: "recap-preemption",
            title: "🔄 Recap: Preemption and Interrupts",
            content: `Quick recap of the key mechanics from last lecture. On assign5, you implement a dispatcher with **Round Robin** scheduling. To force context switches after a time slice, we use a **timer interrupt**. The timer automatically **disables interrupts** before calling our handler and **re-enables** them after.`,
            keyPoints: [
                "Preemptive scheduling: threads can be kicked off the CPU after a time slice",
                "Timer interrupt fires at specified intervals → triggers a context switch",
                "Timer automatically disables interrupts before our handler runs (prevents nested interrupts)",
                "Timer automatically re-enables interrupts after our handler returns",
                "Since we context_switch IN the handler, the new thread starts with interrupts disabled!",
                "Solution for new threads: manually enable interrupts when a thread first runs (intr_enable(true))",
                "For existing threads: they resume inside the timer handler, which re-enables interrupts"
            ],
            codeExample: {
                title: "Timer interrupt handler with context switching",
                language: "cpp",
                code: `// Timer calls our handler with interrupts disabled
void timer_interrupt_handler() {
    // interrupts are OFF here (timer disabled them)
    ...
    context_switch(current_thread, new_thread);
    // When we resume here later, interrupts are still off
    // Timer will re-enable them after this function returns
}

// For a BRAND NEW thread, we must enable interrupts manually:
void other_func() {
    intr_enable(true);  // enable interrupts on first run!
    while (true) {
        cout << "Other thread here! Hello." << endl;
    }
}`,
                annotations: [
                    { match: "// interrupts are OFF here (timer disabled them)", explanation: "The timer hardware automatically disables interrupts before calling our handler. This prevents a SECOND timer interrupt from firing while we're already handling one. Without this, we'd have chaos — imagine trying to context switch while already in the middle of a context switch!" },
                    { match: "context_switch(current_thread, new_thread);", explanation: "We context switch in the MIDDLE of the handler. This means we leave the handler partway through. When we eventually switch BACK to this thread, we resume right here — still inside the handler with interrupts disabled. The timer then re-enables interrupts when the handler 'returns'." },
                    { match: "intr_enable(true);  // enable interrupts on first run!", explanation: "Critical for assign5! When a thread runs for the FIRST TIME, it doesn't resume inside a timer handler (it was never interrupted). So nobody will re-enable interrupts for it — we must do it manually. Without this line, the timer would never fire and this thread would run forever!" }
                ]
            },
            diagram: `
The Interrupt Handshake Pattern:

  Thread A (was running)              Thread B (will run)
  ────────────────────                ────────────────────

  Timer fires! Interrupts OFF
         │
         ▼
  timer_handler() {
    context_switch(A, B); ──────────►  
         │                             │
         │ (A is frozen here)          ▼
         │                        If B is EXISTING thread:
         │                          Resume in timer_handler
         │                          Timer re-enables interrupts ✓
         │                        
         │                        If B is NEW thread:
         │                          Start at thread function
         │                          Must call intr_enable(true)! ✓
         │
  }  // A resumes here when
     // switched back later

  ╔═══════════════════════════════════════════════════════╗
  ║  Pattern: Thread A disables → Thread B re-enables    ║
  ║  This "handshake" keeps interrupts balanced!          ║
  ╚═══════════════════════════════════════════════════════╝
            `
        },
        {
            id: "lock-design",
            title: "🔒 Designing a Lock: What State Do We Need?",
            content: `Now that we understand how thread dispatching and scheduling work, we can write our own **mutex implementation**! Mutexes need to **block threads** — which is functionality the dispatcher/scheduler provides. Let's think about what a lock needs.`,
            keyPoints: [
                "A lock needs to track whether it is currently LOCKED or UNLOCKED",
                "A lock needs to know WHO owns it (which thread) — useful for debugging and for mine()",
                "A lock needs a WAITING QUEUE: a list of threads that tried to lock it and are blocked",
                "These are exactly the private member variables you'll add to the Mutex class on assign5!",
                "Key operations: lock() and unlock() — both must interact with the thread dispatcher"
            ],
            diagram: `
Lock State:

┌──────────────────────────────────────────────┐
│  Mutex                                        │
│                                                │
│  ┌──────────────┐                             │
│  │ int locked   │  0 = unlocked, 1 = locked   │
│  └──────────────┘                             │
│                                                │
│  ┌──────────────────────────────────────┐     │
│  │ ThreadQueue q                        │     │
│  │                                      │     │
│  │  T3 → T7 → T2 → ...                │     │
│  │  (threads waiting to acquire lock)   │     │
│  └──────────────────────────────────────┘     │
│                                                │
│  Methods:                                      │
│    lock()   — acquire the lock (may block)    │
│    unlock() — release the lock (may wake)     │
│    mine()   — does current thread own it?     │
└──────────────────────────────────────────────┘

Think of it like a bathroom:
  - locked = 1 means someone is inside
  - The queue = people waiting in line
  - lock() = try to enter; if occupied, get in line
  - unlock() = leave; let the next person in
            `
        },
        {
            id: "naive-lock",
            title: "🔧 Lock Implementation: First Attempt (Naive)",
            content: `Let's start with a simple implementation and see what goes wrong. The logic is straightforward: if the lock is available, take it; otherwise, add yourself to the waiting queue and block.`,
            codeExample: {
                title: "Naive lock() and unlock() — no interrupt protection",
                language: "cpp",
                code: `// Instance variables
int locked = 0;
ThreadQueue q;

void Lock::lock() {
    if (!locked) {
        locked = 1;
    } else {
        q.add(currentThread);
        blockThread();  // block/switch to next ready thread
    }
}

void Lock::unlock() {
    if (q.empty()) {
        locked = 0;
    } else {
        unblockThread(q.remove());  // add to ready queue
    }
}`,
                annotations: [
                    { match: "if (!locked) {", explanation: "Check if the lock is available. If locked == 0, nobody owns it and we can take it. But DANGER: what if we get interrupted RIGHT HERE, between checking and setting locked? Another thread could also see locked == 0 and take the lock! This is a classic TOCTOU (Time-Of-Check-Time-Of-Use) race condition." },
                    { match: "locked = 1;", explanation: "Mark the lock as taken. Combined with the check above, this is a check-then-act pattern that is NOT atomic. A timer interrupt between the check and this line would allow another thread to also acquire the lock." },
                    { match: "q.add(currentThread);", explanation: "If the lock is already taken, add the current thread to the waiting queue. This thread will be woken up when the lock owner calls unlock(). The queue ensures FIFO ordering — first to wait is first to acquire." },
                    { match: "blockThread();", explanation: "Block the current thread and switch to the next ready thread. This is a dispatcher function that removes the current thread from the running state and performs a context switch. The thread will resume here when someone calls unblockThread() on it." },
                    { match: "if (q.empty()) {", explanation: "When unlocking: if nobody is waiting, just mark the lock as unlocked. Simple case." },
                    { match: "locked = 0;", explanation: "Mark the lock as available. The next thread to call lock() will find locked == 0 and acquire it." },
                    { match: "unblockThread(q.remove());", explanation: "Key insight: we DON'T set locked = 0! We keep the lock locked and pass ownership directly to the next waiting thread. This avoids a race where a third thread could sneak in and grab the lock between unlock and the woken thread's re-acquisition." }
                ]
            },
            keyPoints: [
                "lock(): if unlocked → take it; otherwise → queue yourself and block",
                "unlock(): if nobody waiting → mark unlocked; otherwise → wake next waiter (keep locked!)",
                "IMPORTANT: on unlock, we DON'T unlock then wake — we transfer ownership directly!",
                "This prevents a race where another thread grabs the lock before the waiter wakes up",
                "BUT this naive implementation has a critical bug: RACE CONDITIONS! (next section)"
            ]
        },
        {
            id: "lock-race-condition",
            title: "⚠️ Race Conditions in Our Lock!",
            content: `We can be **interrupted while executing our lock code** — for instance, say two threads try to lock at the same time. The timer could fire right between our "if (!locked)" check and the "locked = 1" update. This is the exact same type of race condition we've seen before (like the ticket-selling problem)!`,
            keyPoints: [
                "The check-then-act pattern (if !locked → locked = 1) is NOT atomic",
                "A timer interrupt between the check and the update allows another thread to also get the lock",
                "This is a TOCTOU (Time-Of-Check-Time-Of-Use) race — same pattern as the ticket-selling bug!",
                "Ironic: we have a race condition inside the thing that's supposed to PREVENT race conditions!",
                "We can't use a mutex to fix it — we're WRITING the mutex implementation!",
                "Solution: disable interrupts — on a single-core system, this guarantees no other thread will run"
            ],
            codeExample: {
                title: "Race condition scenario: two threads both acquire the lock!",
                language: "cpp",
                code: `// Thread 1                          // Thread 2
void Lock::lock() {                  void Lock::lock() {
    if (!locked) {  // sees 0           if (!locked) {  // also sees 0!
        // ← TIMER FIRES HERE!
        // Thread 2 starts running
                                            locked = 1;  // Thread 2 takes lock
                                        }
                                     }
        locked = 1;  // Thread 1 ALSO takes lock!
    }                                
}                                    

// BOTH threads think they own the lock!
// The mutex is supposed to prevent this...`,
                annotations: [
                    { match: "if (!locked) {  // sees 0", explanation: "Thread 1 checks the lock and sees it's available (locked == 0). But before it can set locked = 1, the timer fires!" },
                    { match: "// ← TIMER FIRES HERE!", explanation: "The timer interrupt fires right between the check and the update. The OS context-switches to Thread 2. Thread 1 is frozen mid-operation — it checked but hasn't acted yet." },
                    { match: "if (!locked) {  // also sees 0!", explanation: "Thread 2 runs and checks the lock. Since Thread 1 never got to set locked = 1, Thread 2 also sees locked == 0! Both threads will proceed to acquire the lock." },
                    { match: "locked = 1;  // Thread 1 ALSO takes lock!", explanation: "When Thread 1 eventually resumes, it continues from where it was interrupted and sets locked = 1. But Thread 2 already has the lock! Both threads now think they own it — mutual exclusion is violated." }
                ]
            },
            diagram: `
The "Air Gap" Bug — Another Race Condition:

What if we try to re-enable interrupts before blocking?

  void Lock::lock() {
      intr_enable(false);
      if (!locked) {
          locked = 1;
          intr_enable(true);
      } else {
          q.add(currentThread);
          intr_enable(true);   // ← RE-ENABLE HERE
          blockThread();       // ← BLOCK HERE
      }
  }

  ╔═══════════════════════════════════════════════════════════╗
  ║  DANGER: There's an "air gap" between re-enabling        ║
  ║  interrupts and blocking! In that gap:                    ║
  ║                                                           ║
  ║  1. Thread #1 holds the lock                              ║
  ║  2. Thread #2 tries to lock, adds itself to queue,        ║
  ║     re-enables interrupts                                 ║
  ║  3. Timer fires! Switch to Thread #1                      ║
  ║  4. Thread #1 unlocks, sees Thread #2 in queue,           ║
  ║     calls unblockThread(Thread #2) → added to ready queue ║
  ║  5. Thread #2 resumes and calls blockThread()             ║
  ║  6. Thread #2 is now BLOCKED forever — nobody will        ║
  ║     unblock it because it was already "unblocked"!        ║
  ╚═══════════════════════════════════════════════════════════╝

  Solution: DON'T re-enable interrupts until AFTER blocking!
            `
        },
        {
            id: "intrguard-pattern",
            title: "🛡️ The IntrGuard Pattern",
            content: `We need to disable interrupts while executing lock/unlock code. But we also need to be careful: what if the caller ALREADY disabled interrupts? If we blindly re-enable them at the end of lock(), we'd break the caller's assumption! The solution is **IntrGuard** — like unique_lock but for interrupts.`,
            codeExample: {
                title: "IntrGuard: RAII-style interrupt management (from timer.hh)",
                language: "cpp",
                code: `class IntrGuard {
    const bool old_state_;
public:
    IntrGuard() : old_state_(intr_enabled()) { intr_enable(false); }
    ~IntrGuard() { intr_enable(old_state_); }
};

// Usage — interrupts are managed automatically:
void Lock::lock() {
    IntrGuard guard;  // saves current state, disables interrupts
    // ... critical section (interrupts OFF) ...
}  // guard destroyed → restores interrupts to previous state

// Why this matters — nesting works correctly:
void importantFunc() {
    intr_enable(false);  // caller disabled interrupts
    ...
    myLock.lock();       // IntrGuard saves "false", disables (no-op)
    ...                  // IntrGuard restores "false" — stays disabled!
    intr_enable(true);   // caller re-enables when ready
}`,
                annotations: [
                    { match: "const bool old_state_;", explanation: "Saves whether interrupts were enabled or disabled BEFORE we touch them. This is the key to correct nesting — we remember what state to restore to." },
                    { match: "IntrGuard() : old_state_(intr_enabled()) { intr_enable(false); }", explanation: "Constructor: (1) record the current interrupt state, then (2) disable interrupts. If interrupts were already disabled, old_state_ will be false and we'll restore to disabled later. If they were enabled, old_state_ will be true and we'll restore to enabled." },
                    { match: "~IntrGuard() { intr_enable(old_state_); }", explanation: "Destructor: restore interrupts to whatever state they were in BEFORE the IntrGuard was created. This is RAII — the destructor runs automatically when the guard goes out of scope, even if an exception occurs. Just like how unique_lock automatically unlocks a mutex." },
                    { match: "IntrGuard guard;", explanation: "Create the guard on the stack. This immediately saves the interrupt state and disables interrupts. When 'guard' goes out of scope (end of the function), the destructor runs and restores the previous interrupt state." },
                    { match: "// IntrGuard saves \"false\", disables (no-op)", explanation: "This is the critical nesting case! Since importantFunc already disabled interrupts, IntrGuard records old_state_ = false and then disables (which is already the case — a no-op). When lock() returns, IntrGuard restores to false, keeping interrupts disabled. Without this, lock() would accidentally RE-ENABLE interrupts!" }
                ]
            },
            keyPoints: [
                "IntrGuard is RAII — like unique_lock but for interrupts instead of mutexes",
                "Constructor: save current interrupt state, then disable interrupts",
                "Destructor: restore interrupts to the saved state",
                "Key property: IntrGuard objects NEST correctly",
                "If interrupts were already off, IntrGuard keeps them off (doesn't accidentally re-enable!)",
                "You'll use IntrGuard extensively on assign5 — anywhere you touch shared thread state"
            ]
        },
        {
            id: "correct-lock",
            title: "✅ Correct Lock Implementation with IntrGuard",
            content: `Here's the correct lock implementation. We use **IntrGuard** to disable interrupts for the entire duration of lock() and unlock(). The key insight: we keep interrupts disabled even through blockThread() — this is safe because the interrupt handshake pattern ensures the next thread will re-enable them.`,
            codeExample: {
                title: "Complete, correct lock() and unlock() implementation",
                language: "cpp",
                code: `// Instance variables
int locked = 0;
ThreadQueue q;

void Lock::lock() {
    IntrGuard guard;
    if (!locked) {
        locked = 1;
    } else {
        q.add(currentThread);
        blockThread();  // block/switch to next ready thread
    }
    // IntrGuard restores interrupts here
}

void Lock::unlock() {
    IntrGuard guard;
    if (q.empty()) {
        locked = 0;
    } else {
        unblockThread(q.remove());  // add to ready queue
    }
    // IntrGuard restores interrupts here
}`,
                annotations: [
                    { match: "IntrGuard guard;", explanation: "Disable interrupts for the entire lock() operation. This prevents the timer from firing between our check (!locked) and our update (locked = 1), eliminating the race condition. The guard will restore interrupts when lock() returns — whether we took the fast path (got the lock) or the slow path (blocked and later woke up)." },
                    { match: "if (!locked) {\n        locked = 1;", explanation: "Fast path: the lock is available, so take it immediately. With interrupts disabled, no other thread can run between the check and the update, so this is safe. After setting locked = 1, the IntrGuard destructor will re-enable interrupts." },
                    { match: "q.add(currentThread);\n        blockThread();", explanation: "Slow path: the lock is taken, so (1) add ourselves to the waiting queue, then (2) block. blockThread() performs a context switch — we won't execute the next line until someone wakes us up by calling unlock(). When we DO wake up, we resume right here, and the IntrGuard destructor runs to restore interrupts." },
                    { match: "unblockThread(q.remove());  // add to ready queue", explanation: "Remove the first waiting thread from the queue and add it to the ready queue. The lock stays LOCKED — we're transferring ownership directly. The unblocked thread will eventually be scheduled, resume in lock() after its blockThread() call, and proceed with interrupts being restored by its IntrGuard." }
                ]
            },
            keyPoints: [
                "IntrGuard protects the entire lock/unlock operation from interruption",
                "Interrupts stay disabled through blockThread() — this is intentional and safe!",
                "When we context switch with interrupts off, the next thread re-enables them (interrupt handshake)",
                "When we wake up from blockThread(), we're back in lock() with the IntrGuard still on the stack",
                "The IntrGuard destructor runs when we exit lock(), restoring the previous interrupt state",
                "This is the implementation you'll write for assign5!"
            ]
        },
        {
            id: "interrupt-handshake",
            title: "🤝 The Interrupt Handshake: Why Disabled Interrupts Are OK",
            content: `You might worry: when we blockThread() inside lock(), we context switch with interrupts **disabled**. Won't the next thread run forever without timer interrupts? No! This fits the same pattern we've already seen — Thread A disables, Thread B re-enables. Let's trace through a complete scenario.`,
            keyPoints: [
                "When Thread A blocks inside lock(), interrupts are disabled (IntrGuard)",
                "Thread A's IntrGuard is still on the stack — it will restore interrupts when A resumes",
                "The next thread (Thread B) will re-enable interrupts through one of these paths:",
                "  Path 1: B resumes inside the timer handler → timer re-enables interrupts at end",
                "  Path 2: B is a new thread → B calls intr_enable(true) at the start of its function",
                "  Path 3: B resumes from its own lock() call → B's IntrGuard re-enables interrupts",
                "This 'handshake' always works: whoever disables guarantees someone else re-enables!"
            ],
            diagram: `
Complete Scenario: Thread 1 locks, Thread 2 tries to lock, Thread 1 unlocks

  Thread 1 (running)                    Thread 2 (running later)
  ──────────────────                    ────────────────────────

  lock() {                              
    IntrGuard guard;  // OFF             
    locked = 1;  // got it!              
  } // guard → interrupts ON ✓          

  // ... does work ...                  
                                        lock() {
  // Timer fires! → Thread 2 runs        IntrGuard guard;  // OFF
                                          locked == 1 → blocked!
                                          q.add(self);
                                          blockThread();
                                        ──► switches back to Thread 1

  // Thread 1 resumes in timer handler
  // Timer re-enables interrupts ✓

  unlock() {
    IntrGuard guard;  // OFF
    unblockThread(Thread 2);  // → ready queue
  } // guard → interrupts ON ✓

  // Timer fires! → Thread 2 runs
  // Thread 2 resumes after blockThread()
                                          // IntrGuard guard is still on stack
                                        } // guard → interrupts ON ✓
                                        // Thread 2 now owns the lock!

  ╔═══════════════════════════════════════════════════════════╗
  ║  Every "interrupts OFF" is matched by "interrupts ON"    ║
  ║  The system always returns to a balanced state!           ║
  ╚═══════════════════════════════════════════════════════════╝
            `
        },
        {
            id: "interrupts-global",
            title: "⚡ Interrupts: Key Rules for assign5",
            content: `Interrupts are a **global state** — not per-thread. On assign5, there are many places where interrupts can cause complications. Since we ARE the OS implementing synchronization, we can't use mutexes to protect our own code. Instead, we disable interrupts whenever we touch shared state.`,
            keyPoints: [
                "Interrupts are GLOBAL — turning them off affects the entire CPU, not just one thread",
                "We're the OS! We can't use mutexes (we're implementing them!)",
                "Therefore: disable interrupts whenever accessing shared dispatcher state",
                "Examples of shared state: the ready queue, thread state, lock queues",
                "E.g., we could be in the middle of adding to the ready queue when the timer fires and tries to REMOVE from the ready queue → corruption!",
                "We're assuming a SINGLE-CORE machine — disabling interrupts is sufficient",
                "On multi-core systems, you'd need atomic instructions (hardware support) — beyond our scope"
            ],
            codeExample: {
                title: "Where to use IntrGuard on assign5",
                language: "cpp",
                code: `// Any function that touches shared thread state needs IntrGuard!

void Thread::schedule() {
    IntrGuard guard;       // protect ready queue access
    ready_.push(this);     // add to shared ready queue
}

void Thread::yield() {
    IntrGuard guard;       // protect the redispatch
    current()->schedule(); // add current thread to ready queue
    redispatch();          // switch to next ready thread
}

static void Thread::redispatch() {
    // Must be called with interrupts ALREADY disabled!
    Thread* next = ready_.front();
    ready_.pop();
    context_switch(current_thread, next);
}

// In timer handler (interrupts already disabled by timer):
void timer_interrupt_handler() {
    // Timer disabled interrupts for us
    current()->schedule();  // put current back in ready queue
    redispatch();           // switch to next thread
}`,
                annotations: [
                    { match: "IntrGuard guard;       // protect ready queue access", explanation: "The ready queue is shared state accessed by multiple threads (and the timer handler). We must disable interrupts before touching it to prevent corruption. For example: if the timer fires while we're pushing to the queue, the handler might try to pop from the same queue!" },
                    { match: "current()->schedule();", explanation: "In yield(): the current thread adds itself to the back of the ready queue. This is safe because IntrGuard has disabled interrupts. Without protection, the timer could fire here and try to schedule the same thread, causing it to appear in the queue twice!" },
                    { match: "redispatch();          // switch to next ready thread", explanation: "redispatch() removes the next thread from the ready queue and context-switches to it. This must happen with interrupts disabled (which they are — either from IntrGuard in yield/lock, or from the timer handler which disables them automatically)." },
                    { match: "// Timer disabled interrupts for us", explanation: "The timer handler is a special case — the timer hardware automatically disables interrupts before calling our handler. So we don't need an IntrGuard here. The timer also re-enables interrupts after our handler returns." }
                ]
            }
        },
        {
            id: "yield",
            title: "🤚 Yield: Voluntary Context Switch",
            content: `Besides timer-forced switches and blocking on locks, a thread can **voluntarily** give up the CPU by calling yield(). Yield is like saying "I could keep running, but I'll be nice and let someone else have a turn." The same interrupt rules apply.`,
            keyPoints: [
                "yield() is a VOLUNTARY context switch — the thread can still run but chooses to give up the CPU",
                "Implementation: add current thread to ready queue, then redispatch to next thread",
                "Must disable interrupts (IntrGuard) to protect the ready queue",
                "Same interrupt handshake pattern: interrupts disabled during switch, re-enabled by new thread",
                "On assign5, yield() is a static method of the Thread class",
                "Yield is different from blocking: the thread goes back to the READY queue, not a wait queue"
            ],
            diagram: `
Yield vs Block vs Timer:

  ┌──────────────────────────────────────────────────────────────┐
  │  Three ways a thread stops running:                          │
  │                                                              │
  │  1. TIMER INTERRUPT (preemption)                             │
  │     Thread is forced off CPU → goes to READY queue           │
  │     "Your time is up!"                                       │
  │                                                              │
  │  2. BLOCK (e.g., lock contention, condition wait)            │
  │     Thread can't continue → goes to a WAIT QUEUE             │
  │     "I need something I can't get right now"                 │
  │     Must be explicitly woken up (unblockThread)              │
  │                                                              │
  │  3. YIELD (voluntary)                                        │
  │     Thread chooses to stop → goes to READY queue             │
  │     "I'll let someone else go — I'm being nice!"             │
  │     Will run again when it reaches front of ready queue      │
  └──────────────────────────────────────────────────────────────┘

  All three: interrupts disabled during context switch,
             re-enabled by the next thread (handshake pattern)
            `
        },
        {
            id: "condition-variable-design",
            title: "📋 Implementing Condition Variables",
            content: `Now let's implement condition variables! Like locks, condition variables need to **block threads** — so they use the same dispatcher primitives. A condition variable needs just one piece of state: a **waiting queue** of threads that called wait().`,
            keyPoints: [
                "Condition variable state: just a ThreadQueue of waiting threads",
                "wait(mutex& m): atomically unlock the mutex AND block the thread, then re-lock on wakeup",
                "notify_one(): wake up the first waiting thread (FIFO order in our implementation)",
                "notify_all(): wake up ALL waiting threads",
                "If nobody is waiting, notify_one/notify_all do nothing",
                "The 'atomically unlock and block' part is critical — same as std::condition_variable_any!"
            ],
            codeExample: {
                title: "Condition variable implementation",
                language: "cpp",
                code: `// Condition variable — instance variable
ThreadQueue waitQueue;

void Condition::wait(Mutex& m) {
    IntrGuard guard;
    waitQueue.add(currentThread);
    m.unlock();       // release the mutex
    blockThread();    // block until notified
    // When we wake up here, re-acquire the mutex:
    m.lock();
}

void Condition::notify_one() {
    IntrGuard guard;
    if (!waitQueue.empty()) {
        unblockThread(waitQueue.remove());
    }
}

void Condition::notify_all() {
    IntrGuard guard;
    while (!waitQueue.empty()) {
        unblockThread(waitQueue.remove());
    }
}`,
                annotations: [
                    { match: "ThreadQueue waitQueue;", explanation: "The only state a condition variable needs: a queue of threads waiting to be notified. Each condition variable has its own separate queue (different from any lock's queue)." },
                    { match: "waitQueue.add(currentThread);", explanation: "Add the current thread to the condition's wait queue BEFORE unlocking the mutex. This is critical for atomicity: if we unlocked first, another thread could notify between our unlock and our blocking, and we'd miss the notification (lost wakeup)!" },
                    { match: "m.unlock();       // release the mutex", explanation: "Release the mutex so other threads can enter the critical section and potentially call notify. This must happen after adding ourselves to the wait queue to prevent lost wakeups. Since interrupts are disabled (IntrGuard), no one can run between adding to queue and unlocking." },
                    { match: "blockThread();    // block until notified", explanation: "Block the current thread and switch to the next ready thread. The thread will resume here when another thread calls notify_one() or notify_all(). At this point, we're in the wait queue and the mutex is unlocked." },
                    { match: "m.lock();", explanation: "After being woken up, re-acquire the mutex before returning from wait(). This matches the semantics of std::condition_variable_any::wait() — the caller had the mutex locked before calling wait(), and it should be locked again when wait() returns. The thread may block again here if another thread holds the mutex!" },
                    { match: "if (!waitQueue.empty()) {", explanation: "Only wake someone up if there's actually a thread waiting. If nobody is waiting, notify_one does nothing — the notification is 'lost'. This is expected behavior and why we always use the 'while loop' pattern when calling wait()." },
                    { match: "while (!waitQueue.empty()) {", explanation: "For notify_all: wake up ALL waiting threads by moving each one from the wait queue to the ready queue. They won't all run simultaneously — they'll be scheduled one at a time and will each try to re-acquire the mutex in wait()." }
                ]
            },
            diagram: `
Condition Variable wait() — Step by Step:

  Thread A (holds mutex, calls wait):

  ┌─────────────────────────────────────────────────────┐
  │ 1. IntrGuard → interrupts OFF                       │
  │ 2. Add self to condition's wait queue                │
  │ 3. Unlock the mutex (others can now lock it)         │
  │ 4. blockThread() → context switch to next thread     │
  │    ════════════ SLEEPING ═══════════                 │
  │ 5. Wake up here (someone called notify)              │
  │ 6. Re-acquire the mutex (may block again!)           │
  │ 7. IntrGuard → interrupts restored                   │
  │ 8. Return from wait() — mutex is locked, we own it   │
  └─────────────────────────────────────────────────────┘

  ╔═══════════════════════════════════════════════════════╗
  ║  Why steps 2-4 must be atomic (interrupts disabled): ║
  ║  If we unlocked BEFORE adding to queue:              ║
  ║    - Another thread could notify() between unlock    ║
  ║      and our add-to-queue                            ║
  ║    - We'd miss the notification! (lost wakeup)       ║
  ║    - Same bug as the "air gap" problem in locks!     ║
  ╚═══════════════════════════════════════════════════════╝
            `
        },
        {
            id: "assign5-connection",
            title: "💻 assign5: Putting It All Together",
            content: `On assign5, you implement **Thread**, **Mutex**, and **Condition** — all the concepts from Lectures 17–20 come together! Here's what you need to implement and how the pieces connect.`,
            keyPoints: [
                "Thread class: constructor (create thread), schedule(), yield(), redispatch(), exit(), preempt_init()",
                "Mutex class: constructor, lock(), unlock(), mine() — uses Thread's blocking/unblocking",
                "Condition class: constructor, wait(), notify_one(), notify_all() — uses Mutex and Thread",
                "Mutex and Condition use PUBLIC methods from your Thread class (schedule, redispatch, etc.)",
                "New C++ feature: 'static' keyword — static methods/variables belong to the CLASS, not instances",
                "  static Thread* current() — returns the currently running thread (shared across all Thread objects)",
                "  static queue<Thread*> ready_ — ONE ready queue shared by all threads",
                "  static void yield() — called as Thread::yield(), not on a specific instance",
                "Use IntrGuard anywhere you access shared state (ready queue, thread state, lock/CV queues)"
            ],
            codeExample: {
                title: "assign5 class relationships and key methods",
                language: "cpp",
                code: `// Thread class — you implement the dispatching/scheduling
class Thread {
public:
    Thread(std::function<void()> main);  // create new thread
    void schedule();                      // add to ready queue
    static void yield();                  // voluntarily give up CPU
    static Thread* current();             // get running thread
    static void redispatch();             // switch to next ready thread
    static void exit();                   // terminate current thread
    static void preempt_init(uint64_t usec = 100'000);
private:
    static std::queue<Thread*> ready_;    // shared ready queue
};

// Mutex class — uses Thread to block/unblock
class Mutex {
public:
    void lock();    // uses blockThread (or similar)
    void unlock();  // uses unblockThread (or similar)
    bool mine();    // does current thread own this?
};

// Condition class — uses both Thread and Mutex
class Condition {
public:
    void wait(Mutex& m);   // unlock m, block, re-lock m
    void notify_one();      // wake first waiter
    void notify_all();      // wake all waiters
};`,
                annotations: [
                    { match: "Thread(std::function<void()> main);", explanation: "Creates a new thread that will run the given function. You need to allocate a stack, set up the fake saved state (just like create_thread from lecture), and add it to the ready queue. The thread won't run until the scheduler picks it." },
                    { match: "static void yield();", explanation: "Static method — called as Thread::yield(), not on a specific thread object. It adds the current thread to the ready queue and redispatches. The 'static' keyword means this method belongs to the Thread CLASS, not to any particular Thread instance." },
                    { match: "static std::queue<Thread*> ready_;", explanation: "Static member variable — there's only ONE ready queue shared across ALL Thread objects. This is because the ready queue is a system-wide concept, not per-thread. All static members must be defined once in the .cc file." },
                    { match: "bool mine();", explanation: "Returns true if the calling thread (Thread::current()) is the owner of this mutex. Used for debugging — lock() asserts you DON'T already own it, unlock() asserts you DO own it. You'll need to track the owner thread as a member variable." },
                    { match: "void wait(Mutex& m);", explanation: "The most complex method to implement! Must atomically: (1) add to wait queue, (2) unlock the mutex m, (3) block. On wakeup: (4) re-lock m. Use IntrGuard to ensure steps 1-3 happen without interruption." }
                ]
            },
            diagram: `
assign5 Architecture:

  ┌─────────────────────────────────────────────────────┐
  │  Your Code                                           │
  │                                                      │
  │  ┌──────────┐  uses  ┌──────────┐  uses  ┌────────┐│
  │  │Condition │ ────── │  Mutex   │ ────── │ Thread ││
  │  │          │        │          │        │        ││
  │  │ wait()   │        │ lock()   │        │schedule││
  │  │ notify() │        │ unlock() │        │yield() ││
  │  └──────────┘        │ mine()   │        │exit()  ││
  │                      └──────────┘        │current ││
  │                                          │redispat││
  │                                          └───┬────┘│
  │                                              │      │
  │  Provided by us:                             │      │
  │  ┌──────────────────────────────────────────┐│      │
  │  │ context_switch()  IntrGuard  timer_init()││      │
  │  │ intr_enable()     intr_enabled()         ││      │
  │  │ Stack allocation functions               ││      │
  │  └──────────────────────────────────────────┘│      │
  └─────────────────────────────────────────────────────┘

  Key: Condition depends on Mutex, Mutex depends on Thread.
  Thread depends on provided low-level primitives.
            `
        },
        {
            id: "exam-prep",
            title: "🎯 Exam Prep: Locks & Condition Variables",
            content: `Implementing locks and condition variables is a major exam topic. Here's what you need to know cold.`,
            keyPoints: [
                "📝 Describe the state a lock needs (locked flag, waiting queue)",
                "📝 Write pseudocode for lock() and unlock() with IntrGuard",
                "📝 Explain WHY we need to disable interrupts inside lock/unlock (race condition in check-then-act)",
                "📝 Explain the 'air gap' bug: why you can't re-enable interrupts before blockThread()",
                "📝 Explain the interrupt handshake: why disabled interrupts during context switch is safe",
                "📝 Explain how IntrGuard works and WHY it saves/restores state (nesting!)",
                "📝 Describe what state a condition variable needs (just a waiting queue)",
                "📝 Write pseudocode for wait(), notify_one(), notify_all()",
                "📝 Explain why wait() must atomically add-to-queue, unlock, and block",
                "📝 Explain why unlock() keeps the lock locked and transfers ownership directly",
                "📝 Explain what yield() does and how it differs from blocking"
            ],
            diagram: `
Locks & CVs Exam Cheat Sheet:

┌──────────────────────────────────────────────────────────────────┐
│  LOCK STATE: int locked + ThreadQueue of waiters                 │
│                                                                   │
│  lock():  IntrGuard. If unlocked → take it.                     │
│           Else → add to queue, blockThread.                      │
│  unlock():IntrGuard. If queue empty → locked=0.                 │
│           Else → unblockThread(first waiter). Lock stays locked! │
│                                                                   │
│  WHY IntrGuard? Race condition: timer interrupt between          │
│  check (!locked) and update (locked=1) → both threads get lock! │
│                                                                   │
│  WHY NOT re-enable before blocking? "Air gap" → lost wakeup!    │
│  Thread is unblocked but then blocks itself → stuck forever.     │
│                                                                   │
│  INTERRUPT HANDSHAKE: always balanced.                            │
│  A disables → context switch → B re-enables.                    │
│                                                                   │
│  CV STATE: ThreadQueue of waiters                                │
│  wait():  IntrGuard. Add to queue → unlock → blockThread         │
│           → (wakeup) → re-lock.                                 │
│  notify_one(): IntrGuard. Wake first waiter if any.             │
│  notify_all(): IntrGuard. Wake all waiters.                     │
│                                                                   │
│  LECTURE 20 TAKEAWAY:                                             │
│  Locks = waiting queue + redispatching to make threads sleep.    │
│  CVs also make threads sleep until notified.                     │
│  Disable interrupts (IntrGuard) to protect the implementation.   │
└──────────────────────────────────────────────────────────────────┘
            `
        },
        {
            id: "next-time",
            title: "Coming Up Next",
            content: `Next lecture: **Virtual Memory** — how does the OS manage memory? We'll explore how the OS gives each process the illusion of having its own private address space, even though physical memory is shared among all processes.`,
            keyPoints: [
                "Virtual Memory: each process sees a private, contiguous address space",
                "The OS + hardware translate virtual addresses to physical addresses",
                "This enables memory protection (processes can't access each other's memory)",
                "Also enables features like paging, swapping, and memory-mapped files",
                "A completely new topic — we're done with multithreading implementation!"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Identify the Race Conditions",
            difficulty: "easy",
            description: "Consider the naive lock implementation below (without IntrGuard). Identify ALL the places where a timer interrupt could cause a race condition or bug. For each, describe the scenario.",
            starterCode: `// Naive lock — find ALL the race conditions!
int locked = 0;
ThreadQueue q;

void Lock::lock() {
    if (!locked) {        // Line A
        locked = 1;       // Line B
    } else {
        q.add(currentThread);  // Line C
        blockThread();         // Line D
    }
}

void Lock::unlock() {
    if (q.empty()) {           // Line E
        locked = 0;            // Line F
    } else {
        unblockThread(q.remove());  // Line G
    }
}

// Identify race conditions and the scenarios that trigger them:`,
            solution: `// RACE CONDITION #1: Between Line A and Line B (in lock)
// Scenario: Thread 1 checks !locked (sees true), gets interrupted,
// Thread 2 also checks !locked (sees true), sets locked = 1.
// Thread 1 resumes and also sets locked = 1.
// Result: BOTH threads think they own the lock!

// RACE CONDITION #2: Between Line C and Line D (in lock)
// Scenario: Thread 2 adds itself to queue (Line C), gets interrupted.
// Thread 1 (the lock owner) calls unlock(), sees a thread in the
// queue, calls unblockThread() on Thread 2 → Thread 2 is now READY.
// Thread 2 resumes and calls blockThread() (Line D).
// Result: Thread 2 is blocked FOREVER — it was already unblocked
// but then blocked itself. Nobody will unblock it again!
// This is the "air gap" bug.

// RACE CONDITION #3: Between Line E and Line F/G (in unlock)
// Scenario: Thread 1 checks q.empty() (sees true), gets interrupted.
// Thread 2 calls lock(), sees locked == 1, adds itself to queue.
// Thread 1 resumes and sets locked = 0 (Line F).
// Result: Thread 2 is in the wait queue, but the lock is now
// unlocked. Thread 2 will wait forever for an unlock that
// already happened!

// RACE CONDITION #4: Concurrent access to the queue itself
// Scenario: Thread 1 is adding to q (Line C) when the timer fires.
// Thread 2 tries to remove from q (Line G). The queue's internal
// state may be inconsistent mid-modification.
// Result: Queue corruption — undefined behavior!`,
            explanation: "Without interrupt protection, ANY line in lock/unlock could be interrupted, and ANY sequence of interleaving could happen. The fix is IntrGuard, which ensures the entire lock() or unlock() operation is atomic with respect to other threads (on a single-core system)."
        },
        {
            id: "ex2",
            title: "Trace: Lock, Unlock, and the Interrupt Handshake",
            difficulty: "medium",
            description: "Trace through the following scenario step by step. At each step, state: (1) which thread is running, (2) whether interrupts are ON or OFF, (3) what action happens. Thread 1 starts running with interrupts ON.",
            starterCode: `// Two threads, one lock. Trace the execution and interrupt state.
// Thread 1 starts running, interrupts ON.

// Step 1: Thread 1 calls lock()
// Step 2: Thread 1 acquires lock (it was unlocked)
// Step 3: Thread 1 is executing critical section...
// Step 4: Timer fires! Context switch to Thread 2
// Step 5: Thread 2 calls lock()
// Step 6: Lock is taken — Thread 2 blocks
// Step 7: ??? (which thread runs? interrupt state?)
// ...continue until Thread 2 gets the lock

// For each step, state:
//   Running: Thread ?
//   Interrupts: ON / OFF
//   Action: ???`,
            solution: `// Step 1: Thread 1 calls lock()
//   Running: Thread 1
//   Interrupts: ON → OFF (IntrGuard created)
//   Action: IntrGuard disables interrupts

// Step 2: Thread 1 acquires lock
//   Running: Thread 1
//   Interrupts: OFF
//   Action: locked = 1 (lock was available)

// Step 3: Thread 1 exits lock()
//   Running: Thread 1
//   Interrupts: OFF → ON (IntrGuard destroyed, restores ON)
//   Action: IntrGuard restores previous state (ON)

// Step 4: Thread 1 in critical section, timer fires!
//   Running: Thread 1, then Thread 2
//   Interrupts: ON → OFF (timer disables)
//   Action: Timer handler runs, context_switch(T1, T2)

// Step 5: Thread 2 resumes (in timer handler)
//   Running: Thread 2
//   Interrupts: OFF → ON (timer re-enables after handler)
//   Action: Timer handler returns, interrupts re-enabled

// Step 6: Thread 2 calls lock()
//   Running: Thread 2
//   Interrupts: ON → OFF (IntrGuard created)
//   Action: IntrGuard disables interrupts

// Step 7: Lock is taken — Thread 2 blocks
//   Running: Thread 2, then switches
//   Interrupts: OFF (stays off through blockThread)
//   Action: q.add(Thread 2), blockThread() → context switch

// Step 8: Thread 1 resumes (wherever it was)
//   Running: Thread 1
//   Interrupts: OFF → ON (re-enabled by whatever mechanism)
//   Action: Thread 1 continues executing

// Step 9: Thread 1 calls unlock()
//   Running: Thread 1
//   Interrupts: ON → OFF (IntrGuard)
//   Action: unblockThread(Thread 2) → Thread 2 added to ready queue

// Step 10: Thread 1 exits unlock()
//   Running: Thread 1
//   Interrupts: OFF → ON (IntrGuard destroyed)
//   Action: Thread 2 is now in the ready queue

// Step 11: Eventually timer fires, Thread 2 runs
//   Running: Thread 2
//   Interrupts: Thread 2 resumes after blockThread() in lock()
//   Action: lock() returns, IntrGuard restores interrupts ON
//   Thread 2 now owns the lock!`,
            explanation: "The key pattern is: IntrGuard disables on entry, restores on exit. Context switches happen with interrupts OFF, and the next thread re-enables them. Every disable is matched by an enable — the system stays balanced."
        },
        {
            id: "ex3",
            title: "Implement condition_variable::wait() Pseudocode",
            difficulty: "medium",
            description: "Write the pseudocode for condition_variable::wait(Mutex& m). Think carefully about the ORDER of operations and WHY each step must happen in that order. What goes wrong if you swap any two steps?",
            starterCode: `// Instance variable: ThreadQueue waitQueue;

void Condition::wait(Mutex& m) {
    // Your pseudocode here!
    // Think about:
    // 1. What needs to happen atomically?
    // 2. In what ORDER do things happen?
    // 3. What goes wrong if we unlock BEFORE
    //    adding to the wait queue?
    // 4. When do we re-lock the mutex?
}`,
            solution: `// Correct implementation:
void Condition::wait(Mutex& m) {
    IntrGuard guard;              // 1. Disable interrupts
    waitQueue.add(currentThread); // 2. Add to wait queue
    m.unlock();                   // 3. Unlock the mutex
    blockThread();                // 4. Block (context switch)
    // --- woken up by notify ---
    m.lock();                     // 5. Re-acquire the mutex
}

// WHY THIS ORDER?
//
// Step 1 (IntrGuard) must be FIRST:
//   We need atomicity for steps 2-4. Without it, a timer
//   interrupt could mess up the ordering.
//
// Step 2 (add to queue) must be BEFORE step 3 (unlock):
//   If we unlocked first, another thread could:
//   - Lock the mutex
//   - Call notify_one()
//   - See an EMPTY wait queue (we haven't added ourselves yet!)
//   - The notification is lost!
//   Then we add ourselves and block — nobody will wake us up.
//   This is a LOST WAKEUP bug!
//
// Step 3 (unlock) must be BEFORE step 4 (block):
//   If we blocked first, we'd still hold the mutex while sleeping!
//   No other thread could lock() it, so nobody could ever call
//   notify() to wake us up. DEADLOCK!
//
// Step 5 (re-lock) must be AFTER waking up:
//   The wait() contract says the mutex is locked when we return.
//   Note: we might BLOCK AGAIN here if another thread holds
//   the mutex — that's fine and expected.`,
            explanation: "The ordering of operations in wait() is critical. The three key operations (add to queue, unlock, block) must happen in exactly this order, and steps 2-4 must be atomic (interrupts disabled). Any other ordering leads to either lost wakeups or deadlocks."
        },
        {
            id: "ex4",
            title: "The Air Gap Bug: Design a Failing Scenario",
            difficulty: "hard",
            description: "Consider the BUGGY lock implementation below where interrupts are re-enabled BEFORE blockThread(). Design a specific 2-thread scenario that demonstrates the bug. Show the exact sequence of events, including timer interrupts, that leads to a thread being stuck forever.",
            starterCode: `// BUGGY lock implementation — the "air gap":
void Lock::lock() {
    intr_enable(false);
    if (!locked) {
        locked = 1;
        intr_enable(true);
    } else {
        q.add(currentThread);
        intr_enable(true);   // BUG: re-enable before block!
        blockThread();        // air gap between these two lines
    }
}

// Design a scenario with Thread A and Thread B where
// Thread B gets permanently stuck:
//
// Initial state: Lock is unlocked. Thread A runs first.
//
// Time 0: ???
// Time 1: ???
// ...`,
            solution: `// Scenario: Thread A and Thread B, one mutex.
// Thread A starts running. Lock is unlocked.

// Time 0: Thread A calls lock()
//   → intr_enable(false), sees !locked, sets locked = 1
//   → intr_enable(true)
//   Thread A now owns the lock. Interrupts ON.

// Time 1: Timer fires! Context switch to Thread B.

// Time 2: Thread B calls lock()
//   → intr_enable(false). Interrupts OFF.
//   → Sees locked == 1 (Thread A has it)
//   → q.add(Thread B)  — Thread B added to wait queue
//   → intr_enable(true)  — Interrupts ON again
//
//   *** AIR GAP: interrupts are ON, but we haven't blocked yet! ***

// Time 3: Timer fires RIGHT HERE (in the air gap)!
//   Context switch to Thread A.

// Time 4: Thread A calls unlock()
//   → Sees Thread B in the queue
//   → unblockThread(Thread B)  — moves Thread B to READY queue
//   Thread A no longer owns the lock (transferred to Thread B)

// Time 5: Timer fires! Context switch to Thread B.
//   Thread B resumes... right at the blockThread() call!

// Time 6: Thread B calls blockThread()
//   → Thread B is now BLOCKED!
//   → But nobody will ever call unblockThread(Thread B) again
//      because it was already unblocked in Time 4!
//   → Thread B is stuck FOREVER!

// Summary:
// The air gap allowed Thread A to unblock Thread B BEFORE
// Thread B actually blocked. When Thread B finally blocks,
// the wakeup has already been consumed. Lost wakeup!
//
// Fix: Keep interrupts disabled through blockThread().
//      Use IntrGuard so interrupts are only restored
//      AFTER blockThread returns (when we wake up).`,
            explanation: "The 'air gap' between re-enabling interrupts and blocking creates a window where a wakeup (unblockThread) can arrive before the thread has actually blocked. The wakeup is 'consumed' (the thread was marked ready), but then the thread blocks anyway and nobody knows to wake it again. This is a classic lost-wakeup bug, and it's exactly why IntrGuard keeps interrupts disabled through the entire operation."
        }
    ]
};

export default lecture20;
