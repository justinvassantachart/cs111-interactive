export const lecture16 = {
    id: 16,
    title: "Trust, Race Conditions and Operating Systems",
    subtitle: "How Do We Trust the Software We Rely On?",
    keyTakeaway: "Trust is often required, powerful, and dangerous. Trust emerges through assumption, inference, or substitution. A key design challenge is how we design structures — in code and in organizations — that enable us to substitute trust. Operating systems, as the root of trust for all software, provide a critical lens for examining these concepts.",

    sections: [
        {
            id: "topic-overview",
            title: "Topic 3: Multithreading, Part 5",
            content: `We've been building our multithreading toolkit over the past four lectures. Today we step back to examine a broader question: **how do we trust the software we use?** Operating systems — with their massive codebases, concurrent internals, and billions of users — provide a powerful case study.`,
            keyPoints: [
                "Lectures 12-15: threads, race conditions, mutexes, condition variables, the monitor pattern",
                "This lecture: trust in software, with operating systems as a case study",
                "Why this matters NOW: assign4 includes trust-related essay questions!",
                "Concurrency makes trust harder — bugs are non-deterministic and hard to reproduce",
                "This material connects technical concepts (race conditions) to real-world impact"
            ],
            diagram: `
Topic 3: Multithreading Roadmap:

┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Lecture 12   │ →  │  Lecture 13   │ →  │  Lecture 14   │ →  │  Lecture 15   │ →  │  Lecture 16   │
│               │    │               │    │               │    │               │    │               │
│ Multithreading│    │ Race Conds    │    │ Condition     │    │ The Monitor   │    │ Trust & Race  │
│ Introduction  │    │ and Locks     │    │ Variables     │    │ Pattern       │    │ Conditions    │
│               │    │               │    │               │    │               │    │               │
│  (Previous)   │    │  (Previous)   │    │  (Previous)   │    │  (Previous)   │    │ (This one!)   │
└───────────────┴────┴───────────────┴────┴───────────────┴────┴───────────────┴────┴───────────────┘

assign4: implement several multithreaded programs while eliminating race conditions!
            `
        },
        {
            id: "trust-and-os",
            title: "🏛️ Trust and Operating Systems",
            content: `Writing synchronization code is **hard** — it's difficult to reason about, and bugs are tricky when they're hard to reproduce. Lots of software incorporates concurrent code, and operating systems are one prominent example. The combination of concurrency and the unique properties of OSes (immense scale) provides a unique lens through which to examine how we **trust** software.`,
            keyPoints: [
                "Operating systems provide the ROOT OF TRUST for all software",
                "All applications run on top of OSes — apps are only as trustworthy as the OS beneath them",
                "OSes implement the mechanisms that applications depend on (threading, file I/O, networking)",
                "A bug in an app is bad; a bug in an OS can be CATASTROPHIC",
                "OSes have unique characteristics that amplify trust concerns: scale, users, impact, longevity"
            ],
            diagram: `
Operating Systems: The Root of Trust

┌─────────────────────────────────────────────────────────┐
│                    Your Application                      │
│              (web browser, game, editor)                  │
│                                                          │
│   "I trust the OS to correctly manage my files,          │
│    schedule my threads, and protect my memory."           │
├──────────────────────────────────────────────────────────┤
│                   Operating System                        │
│                                                          │
│   Threads, Mutexes, CVs, File I/O, Memory, Networking   │
│                                                          │
│   ⚠️ If this layer has bugs, EVERYTHING above is         │
│   potentially compromised!                               │
├──────────────────────────────────────────────────────────┤
│                      Hardware                             │
└──────────────────────────────────────────────────────────┘

Key insight: Applications are only as trustworthy as the OS they run on.
            `
        },
        {
            id: "os-scale-codebase",
            title: "📐 OS Scale: Codebase",
            content: `Operating systems are among the largest software systems ever created. As of 2020, the **Linux kernel** had over **27.8 million lines of code** across more than **66,000 files**. This massive scale makes perfect correctness essentially impossible.`,
            keyPoints: [
                "Linux kernel: >27.8M lines of code, >66K files (as of 2020)",
                "Extremely large and hard to maintain — would take ~10 years to rewrite from scratch",
                "Systems outlive their original builders",
                "Old rule of thumb (OS/360): ~1000 known bugs was 'good enough to ship'",
                "New bugs surface about as quickly as old ones are fixed",
                "Concurrent code in the kernel makes bugs especially hard to find and reproduce"
            ],
            codeExample: {
                title: "Why OS bugs are hard — concurrent code at massive scale",
                language: "cpp",
                code: `// Imagine this pattern repeated across 27.8 MILLION lines of code.
// The Linux kernel has thousands of locks protecting shared state.

// Example: simplified kernel resource allocation
static int allocate_resource(struct resource_pool *pool) {
    spin_lock(&pool->lock);
    
    if (pool->available > 0) {
        pool->available--;
        spin_unlock(&pool->lock);
        return 0;  // success
    }
    
    spin_unlock(&pool->lock);
    return -EAGAIN;  // try again later
}

// Now imagine: thousands of different resource types,
// each with their own locks, their own edge cases,
// and complex interactions between them.
// 
// A bug might only manifest when:
//   - Thread A holds lock X and requests lock Y
//   - Thread B holds lock Y and requests lock X
//   - This happens once every million executions
//   - Only on systems with >4 CPUs
//   - Only under high memory pressure
//
// THIS is why OS bugs are so hard to find and fix.`,
                annotations: [
                    { match: "spin_lock(&pool->lock)", explanation: "Kernel-level locking — similar to mutex.lock() but designed for short critical sections. If the lock is held, the CPU 'spins' (busy waits) rather than sleeping, which is faster for very brief locks." },
                    { match: "pool->available--", explanation: "Classic shared state modification inside a critical section. Without the lock, this decrement would be a race condition — multiple CPUs could read the same value and both decrement." },
                    { match: "-EAGAIN", explanation: "A standard Linux error code meaning 'resource temporarily unavailable, try again.' The kernel uses negative numbers for error codes (convention)." },
                    { match: "once every million executions", explanation: "This is the nightmare of concurrent bugs: they may be correct 999,999 times and fail once. This makes them extremely hard to reproduce and debug, especially across 27.8M lines." }
                ]
            }
        },
        {
            id: "os-scale-users-impact",
            title: "🌍 OS Scale: Users & Impact",
            content: `Operating systems have **billions** of users. As of 2023, Windows alone had over **1 billion users**. This massive user base means that even rare bugs can affect millions of people. The combination of scale (huge codebase), reach (billions of users), and privilege (root access to hardware) makes OS bugs uniquely dangerous.`,
            keyPoints: [
                "Windows: >1B users as of 2023; Android: >3B active devices",
                "A bug in an app affects that app's users; a bug in an OS affects EVERYTHING on the system",
                "Worst case: a bug allows root access — running arbitrary code with full privileges",
                "Remember readSector from assign1? Imagine if untrusted code could call it directly!",
                "OSes also have extreme LONGEVITY — users stay on old versions for years",
                "Example: Apple released a 2023 security update for the almost-10-year-old iPhone 5S",
                "Challenge: how do OS makers continue to keep old versions secure?"
            ],
            diagram: `
The Four Scales of OS Impact:

┌──────────────────────────────────────────────────────────────────┐
│  SCALE          │  WHAT IT MEANS           │  WHY IT MATTERS     │
├──────────────────────────────────────────────────────────────────┤
│  📐 Codebase    │  27.8M+ lines (Linux)    │  Bugs are           │
│                 │  66K+ files              │  INEVITABLE         │
├──────────────────────────────────────────────────────────────────┤
│  👥 Users       │  1B+ (Windows)           │  Bugs affect        │
│                 │  3B+ (Android)           │  EVERYONE            │
├──────────────────────────────────────────────────────────────────┤
│  💥 Impact      │  Root access to entire   │  Bugs can be        │
│                 │  system + all apps       │  CATASTROPHIC        │
├──────────────────────────────────────────────────────────────────┤
│  ⏳ Longevity   │  Users on old versions   │  Bugs persist       │
│                 │  for years/decades       │  INDEFINITELY        │
└──────────────────────────────────────────────────────────────────┘

Thought question: how does each scale factor affect how much we TRUST OSes?
            `
        },
        {
            id: "real-world-os-bugs",
            title: "🐛 Real-World OS Bugs",
            content: `Here are real examples of OS bugs that affected millions of users. Many of these involve **race conditions** — the exact same type of bugs we've been studying in lectures 12-15! Notice how concurrency bugs in privileged OS code can have devastating consequences.`,
            keyPoints: [
                "2011 iOS bug: set alarms didn't go off (timing/scheduling bug)",
                "2021 Windows PrintNightmare: printing software vulnerability allowed REMOTE CODE EXECUTION",
                "2017 macOS bug: allowed admin access WITHOUT A PASSWORD",
                "2022 Linux bug: root access due to a 12-YEAR-OLD vulnerability (discovered after 12 years!)",
                "2015 Android Stagefright: multimedia software vulnerability affecting 950M+ devices",
                "EternalBlue (Windows): vulnerability kept secret by NSA, leaked by hackers, led to WannaCry ransomware",
                "Common thread: many of these are concurrency bugs or privilege escalation bugs"
            ],
            codeExample: {
                title: "Race condition pattern similar to real OS vulnerabilities",
                language: "cpp",
                code: `// SIMPLIFIED example inspired by real OS privilege escalation bugs.
// This pattern is called TOCTOU: Time-Of-Check to Time-Of-Use.

// VULNERABLE version — has a race condition!
bool check_and_execute(const char *filepath, User *user) {
    // Step 1: CHECK if user has permission
    if (!has_permission(user, filepath)) {
        return false;  // access denied
    }
    
    // ⚠️ RACE CONDITION WINDOW ⚠️
    // Between the CHECK above and the USE below,
    // an attacker could swap 'filepath' to point to
    // a different, privileged file!
    
    // Step 2: USE the file (execute it with elevated privileges)
    execute_file(filepath);  // runs with OS privileges!
    return true;
}

// SAFER version — atomic check-and-use
bool check_and_execute_safe(const char *filepath, User *user) {
    // Open the file first (locks the specific file)
    int fd = open(filepath, O_RDONLY);
    if (fd < 0) return false;
    
    // Check permissions on the OPENED file descriptor
    // (not the path, which could have changed!)
    if (!has_permission_fd(user, fd)) {
        close(fd);
        return false;
    }
    
    // Execute using the file descriptor — guaranteed to be
    // the same file we checked permissions on
    execute_fd(fd);
    close(fd);
    return true;
}`,
                annotations: [
                    { match: "TOCTOU: Time-Of-Check to Time-Of-Use", explanation: "A classic race condition pattern in security-sensitive code. The 'check' and the 'use' are separate operations, and an attacker can change the state between them. This is exactly like the 'air gap' problem we saw with condition variables!" },
                    { match: "has_permission(user, filepath)", explanation: "We check permission using the file PATH. But paths are just names — what the path points to can change between this check and the next line!" },
                    { match: "RACE CONDITION WINDOW", explanation: "This gap between check and use is the vulnerability. An attacker thread could use symlinks to swap the file that 'filepath' points to. Similar to the air gap between unlock() and wait() we studied with CVs." },
                    { match: "execute_file(filepath)", explanation: "By the time we execute, the file at this path might be DIFFERENT from the file we checked permissions on! The attacker swapped it during the race window." },
                    { match: "int fd = open(filepath, O_RDONLY)", explanation: "The fix: capture a reference to the SPECIFIC file (a file descriptor), not just its name. This is like using wait(lock) to atomically combine operations." },
                    { match: "has_permission_fd(user, fd)", explanation: "Check permissions on the file descriptor, not the path. The fd always refers to the same file, even if the path changes. This eliminates the race condition." }
                ]
            }
        },
        {
            id: "what-is-trust",
            title: "🤝 What is Trust?",
            content: `Trust is to **stop questioning the dependability** of something. When we trust software, we extend our **agency** — our capacity to take actions that align with our goals — to that software. We let it become part of how we function. This is powerful and efficient, but also risky.`,
            keyPoints: [
                "Trust = stop questioning the dependability of something",
                "Efficiency/safety tradeoff: trust lowers monitoring overhead (more efficient) but increases risk",
                "Trust involves: intentions, dependence, vulnerability/risk",
                "Agency: our capacity to take actions that align with our goals",
                "Trusting software = EXTENDING our agency to that software",
                "'To trust is to let something in — to bring it inside one's practical functioning' — CT Nguyen",
                "Agential gullibility: trusting MORE than is warranted — a dangerous pitfall!"
            ],
            diagram: `
Trust = Extending Agency

┌─────────────────────────────────────────────────────────────────┐
│  WITHOUT trust in software:              WITH trust in software: │
│                                                                  │
│  "I'll manually verify                   "I trust my OS to       │
│   every file write..."                    handle file writes."   │
│  "I'll check the lock                    "I trust the mutex      │
│   implementation myself..."               implementation."       │
│  "I'll audit every line                  "I trust the compiler   │
│   of compiled code..."                    to generate correct    │
│                                           machine code."         │
│                                                                  │
│  😰 Impossible to do                     😊 Practical and        │
│     everything yourself!                    efficient!            │
│                                                                  │
│  But if that trust is                                            │
│  VIOLATED...                             😡 Betrayal! Our        │
│                                             agency is            │
│                                             compromised!         │
└─────────────────────────────────────────────────────────────────┘

Key insight: Trust is POWERFUL (enables efficiency),
             NECESSARY (can't verify everything),
             and RISKY (vulnerability if violated).
            `
        },
        {
            id: "three-paths-to-trust",
            title: "🛤️ Three Paths to Trust",
            content: `How does trust emerge? Research identifies three distinct paths. Understanding these helps us think critically about WHY we trust the software we use — and whether that trust is justified. These concepts appear directly on **assign4's essay questions**!`,
            keyPoints: [
                "1. Trust by ASSUMPTION: trust absent any evidence to warrant it",
                "   → Example: using an unknown 3rd-party library because a deadline is approaching",
                "   → Example: trusting warnings from others about danger ('look out for the car!')",
                "2. Trust by INFERENCE: trust based on evidence — past performance, reputation, institutions",
                "   → Example: trusting a brand name (weaker inference)",
                "   → Example: trusting based on past reliable performance (stronger inference)",
                "   → Example: trusting new version of software because old version worked well",
                "3. Trust by SUBSTITUTION: implementing a Plan B to partly REPLACE the need to trust",
                "   → Example: setting alarms on TWO devices in case one fails",
                "   → Example: using fake per-app emails for login, in case data is leaked",
                "   → Example: adding redundant checks in code (like checking for spurious wakeups!)"
            ],
            diagram: `
Three Paths to Trust (Paul B. de Laat):

┌─────────────────────────────────────────────────────────────────┐
│  PATH              │  BASIS           │  SOFTWARE EXAMPLE        │
├─────────────────────────────────────────────────────────────────┤
│                    │                  │                          │
│  1. ASSUMPTION     │  No evidence     │  "I'll just use this    │
│     (weakest)      │  "Just because"  │   npm package, it       │
│                    │                  │   probably works"        │
│                    │                  │                          │
├─────────────────────────────────────────────────────────────────┤
│                    │                  │                          │
│  2. INFERENCE      │  Evidence-based  │  "This library has      │
│     (stronger)     │  Past experience │   10K GitHub stars and  │
│                    │  Reputation      │   I've used it before"  │
│                    │                  │                          │
├─────────────────────────────────────────────────────────────────┤
│                    │                  │                          │
│  3. SUBSTITUTION   │  Design around   │  "I'll add my own       │
│     (strongest)    │  the need to     │   validation checks     │
│                    │  trust           │   in case the library   │
│                    │                  │   has bugs"             │
│                    │                  │                          │
└─────────────────────────────────────────────────────────────────┘

For the exam and assign4: be able to CLASSIFY examples into these 3 categories!
            `
        },
        {
            id: "earning-trust",
            title: "🏆 How OSes Earn Trust",
            content: `How do operating system makers try to earn our trust? They use a combination of strategies that map to the three paths. Understanding these strategies is important for both the exam and for thinking critically about the software you depend on.`,
            keyPoints: [
                "Bug bounty programs: pay researchers to find and report bugs (substitution)",
                "Open security programs: transparent disclosure of vulnerabilities (inference)",
                "Reputation / track record: years of reliable service builds inference-based trust",
                "Open-source software: code is publicly available for anyone to review (inference + substitution)",
                "Regular security updates: demonstrating ongoing commitment to security (inference)",
                "These strategies don't ELIMINATE bugs — they help manage the TRUST relationship"
            ],
            codeExample: {
                title: "Trust substitution in code — defensive programming patterns",
                language: "cpp",
                code: `// Trust SUBSTITUTION in practice: add YOUR OWN checks
// even when you "trust" the library or OS.

// Pattern 1: Defensive checks on shared state
void process_data(SharedBuffer& buffer, mutex& lock) {
    lock.lock();
    
    // Even if we trust the producer to set valid data,
    // we SUBSTITUTE trust with our own validation:
    if (buffer.size == 0 || buffer.data == nullptr) {
        lock.unlock();
        return;  // defensive: don't crash on bad data
    }
    
    // Process the data...
    lock.unlock();
}

// Pattern 2: Spurious wakeup handling IS trust substitution!
void wait_for_event(bool& ready, condition_variable_any& cv, 
                    mutex& lock) {
    lock.lock();
    while (!ready) {           // WHILE, not IF!
        cv.wait(lock);
        // We DON'T TRUST that waking up means ready == true
        // We SUBSTITUTE trust with re-checking the condition
    }
    // Now we KNOW ready is true (we verified it ourselves)
    lock.unlock();
}

// Pattern 3: Input validation at system boundaries
int safe_read_sector(int fd, int sectorNum, void *buf) {
    // Don't trust the caller to pass valid arguments
    if (fd < 0 || sectorNum < 0 || buf == nullptr) {
        fprintf(stderr, "safe_read_sector: invalid args\\n");
        return -1;
    }
    return diskimg_readsector(fd, sectorNum, buf);
}`,
                annotations: [
                    { match: "buffer.size == 0 || buffer.data == nullptr", explanation: "Even if we 'trust' the producer thread to set valid data, we add our own checks. This is trust substitution — we design around the need to trust by verifying ourselves." },
                    { match: "while (!ready)", explanation: "The while loop around cv.wait() is literally TRUST SUBSTITUTION! We don't trust that waking up means our condition is true (spurious wakeups exist). We substitute with re-checking. This is the connection between trust theory and our CV patterns!" },
                    { match: "We DON'T TRUST that waking up means ready == true", explanation: "This is a concrete example of trust substitution from our own code! The while loop is our 'Plan B' — if the wakeup was spurious (or another thread took our resource), we go back to sleep." },
                    { match: "fd < 0 || sectorNum < 0 || buf == nullptr", explanation: "Defensive programming: validate inputs even from 'trusted' callers. In large codebases (27.8M lines!), you can't guarantee every caller does the right thing." }
                ]
            }
        },
        {
            id: "linux-case-study",
            title: "🐧 Case Study: Linux",
            content: `Let's apply our trust framework to a real system: **Linux**. The Linux kernel has been around since 1991, has over 150,000 developers, and powers everything from Android phones to almost all supercomputers. Different groups trust Linux for different reasons and in different ways.`,
            keyPoints: [
                "Linux kernel: around since 1991, >27.8M lines, >150K developers",
                "Widely used: Android phones, 13.6% of servers, almost ALL supercomputers",
                "Three groups with different trust relationships: Users, App Developers, Linux Developers",
                "Each group trusts Linux through different combinations of assumption, inference, and substitution"
            ],
            diagram: `
Three Groups Trusting Linux:

┌─────────────────────────────────────────────────────────────────────┐
│  GROUP              │  WHY THEY TRUST        │  HOW TRUST EMERGES   │
├─────────────────────────────────────────────────────────────────────┤
│                     │                        │                      │
│  👤 USERS           │  Use Linux tools to    │  Assumption:         │
│  (Android users,    │  extend their agency   │   "never thought     │
│   server admins)    │  (smartphones, servers │    about it" or      │
│                     │   supercomputers)      │   "no other option"  │
│                     │                        │  Inference:          │
│                     │                        │   open source, many  │
│                     │                        │   eyes, previous use │
│                     │                        │  Substitution:       │
│                     │                        │   strong passwords,  │
│                     │                        │   encryption,        │
│                     │                        │   antivirus          │
├─────────────────────────────────────────────────────────────────────┤
│                     │                        │                      │
│  👩‍💻 APP DEVS        │  OS standardization    │  Assumption: rare    │
│  (build apps for    │  and tools enable      │  Inference:          │
│   Linux users)      │  efficiency; building  │   used by others,    │
│                     │  a new OS is too       │   trust Linus,       │
│                     │  costly                │   GitHub stars       │
│                     │                        │  Substitution:       │
│                     │                        │   code is open       │
│                     │                        │   source (read/fork),│
│                     │                        │   add own checks     │
│                     │                        │   (spurious wakeups!)│
├─────────────────────────────────────────────────────────────────────┤
│                     │                        │                      │
│  🔧 LINUX DEVS      │  No one person can     │  Assumption: rare    │
│  (kernel            │  build & maintain a    │  Inference:          │
│   contributors)     │  whole OS alone —      │   known in community,│
│                     │  must extend agency    │   quality of past    │
│                     │  to other developers   │   submissions        │
│                     │                        │  Substitution:       │
│                     │                        │   layered code       │
│                     │                        │   review process,    │
│                     │                        │   Linus has final    │
│                     │                        │   authority          │
└─────────────────────────────────────────────────────────────────────┘
            `
        },
        {
            id: "xz-backdoor",
            title: "💀 Agential Gullibility: The xz Backdoor",
            content: `In 2024, a **Trojan Horse** was discovered in the Linux ssh program — it would have allowed attackers to gain access to **any Linux system**. This is a textbook case of **agential gullibility** (trusting more than is warranted) within the Linux developer community. It was caught **entirely by chance**.`,
            keyPoints: [
                "Attack targeted 'xz', a compression package used by ssh for encryption",
                "SSH developers TRUSTED xz (trust by inference — long track record)",
                "An attacker posed as a legitimate open-source contributor for MULTIPLE YEARS",
                "Fake developers pressured the xz lead maintainer to accept help from the attacker",
                "The attacker was eventually given permission to MERGE CHANGES into xz",
                "The attacker also submitted changes to OSS-Fuzz (security scanner) to DISABLE checks that would have caught the backdoor!",
                "This is agential gullibility: the trust extended to this 'developer' was MORE than warranted",
                "Caught by chance by a developer who noticed ssh was running slightly slower"
            ],
            diagram: `
The xz Backdoor Attack — A Timeline of Exploited Trust:

Year 1-2: Building trust (inference)
┌─────────────────────────────────────────────────────────────┐
│  Attacker makes small, legitimate contributions to xz       │
│  Builds reputation in the open-source community             │
│  Gains trust through past performance (trust by inference)  │
└─────────────────────────────────────────────────────────────┘
                            ↓
Year 2-3: Social engineering
┌─────────────────────────────────────────────────────────────┐
│  Fake accounts pressure xz maintainer:                       │
│  "You're too slow accepting patches!"                        │
│  "Let this helpful person merge changes!"                    │
│  Maintainer eventually grants merge permissions              │
│  → AGENTIAL GULLIBILITY: trusted more than warranted        │
└─────────────────────────────────────────────────────────────┘
                            ↓
Year 3+: The attack
┌─────────────────────────────────────────────────────────────┐
│  Attacker injects backdoor into xz                           │
│  Also modifies OSS-Fuzz to DISABLE the check that           │
│  would have caught the backdoor!                             │
│  ssh depends on xz → ALL Linux systems vulnerable           │
└─────────────────────────────────────────────────────────────┘
                            ↓
Discovery: Pure luck!
┌─────────────────────────────────────────────────────────────┐
│  A developer noticed ssh was 500ms slower than usual         │
│  Investigated → found the backdoor                           │
│  If not caught: attacker could access ANY Linux system!     │
└─────────────────────────────────────────────────────────────┘

Key lesson: Even long-term trust can be exploited.
Trust substitution (code review, automated scanning) was circumvented!
            `
        },
        {
            id: "assign4-connection",
            title: "📝 Connection to Assign4",
            content: `Assign4 directly tests your understanding of trust concepts! The assignment includes essay questions about trusting code, the Google Duo race condition, and agential gullibility. Here's how the lecture concepts connect to what you'll need to write.`,
            keyPoints: [
                "assign4 questions.txt asks about trust in YOUR code — how would you convince someone to trust it?",
                "Think about: code review (substitution), testing (substitution), your reputation (inference)",
                "Questions about Google Duo race condition: a real-world concurrency bug with privacy implications",
                "You need to identify agential gullibility in the Google Duo case",
                "You need to explain how users could INFER trust in Google Duo",
                "You need to describe how users could SUBSTITUTE trust in Google Duo",
                "Key connection: the while loop for spurious wakeups IS trust substitution in code!"
            ],
            codeExample: {
                title: "assign4 code — trust concepts in your Station and Party implementations",
                language: "cpp",
                code: `// From assign4: Station class (caltrain.hh)
// You must implement thread-safe train loading.
// Notice: the assignment GIVES you a mutex but you must
// add condition variables and state.

class Station {
public:
    Station();
    
    // Called when a train arrives with available seats.
    // Does not return until train is satisfactorily loaded.
    void load_train(int available);
    
    // Invoked when a passenger arrives.
    // Does not return until a train is available.
    void wait_for_train();
    
    // Called when a passenger has boarded.
    void boarded();
    
private:
    std::mutex mutex_;
    // YOU add: condition variables, counters, etc.
    // Think: what events need to be waited on / signaled?
    // Apply the 5-step CV recipe from Lecture 14!
};

// Trust connection: How do you convince someone your
// Station implementation is correct?
//
// 1. Trust by INFERENCE:
//    - "I tested it with the provided test suite"
//    - "I used the standard CV patterns from lecture"
//
// 2. Trust by SUBSTITUTION:
//    - "I use while loops (not if) around wait()"
//    - "I added assertions to catch invariant violations"
//    - "I ran stress tests with many threads"
//
// 3. Avoid ASSUMPTION:
//    - DON'T say "it looks right to me" — that's assumption!
//    - Show evidence, not feelings.`,
                annotations: [
                    { match: "void load_train(int available)", explanation: "This function must coordinate with wait_for_train() and boarded(). Think about which events to wait/notify for. The train waits until all boarding is complete OR train is full OR no more waiting passengers." },
                    { match: "void wait_for_train()", explanation: "Passengers wait here until a train is available with seats. This is a classic CV wait pattern — you need to identify: what EVENT am I waiting for? What STATE tells me the event happened?" },
                    { match: "void boarded()", explanation: "Called by each passenger after boarding. This is a NOTIFICATION event — the train (in load_train) is waiting for all boarding passengers to call this." },
                    { match: "Trust by INFERENCE", explanation: "For the assign4 essay questions: inference-based trust means you provide EVIDENCE. Testing results, following known patterns, and code review are all forms of evidence." },
                    { match: "Trust by SUBSTITUTION", explanation: "The while loop around cv.wait() is literally trust substitution! You substitute trust in the OS's wakeup mechanism with your own re-checking of the condition." },
                    { match: "Avoid ASSUMPTION", explanation: "For the essay: 'it looks right' is trust by assumption (weakest form). The assignment wants you to think about STRONGER forms of trust." }
                ]
            }
        },
        {
            id: "trusting-software-vs-nonsoftware",
            title: "🤔 Trusting Software vs. Other Things",
            content: `Does our approach to trusting software differ from how we trust other things, services, or products? Software engineers sometimes call themselves 'engineers,' but unlike civil or mechanical engineers, software developers often don't face the same regulatory oversight, licensing requirements, or liability for failures.`,
            keyPoints: [
                "Civil engineers: licensed, regulated, personally liable for bridge failures",
                "Software engineers: generally no licensing, limited liability, rapid release cycles",
                "A bridge collapse is immediate and visible; a software vulnerability may be invisible for years",
                "The xz backdoor was hidden for YEARS before being caught by chance",
                "Key question: should software engineers face more accountability?",
                "Trust structures like code review, testing, and open source help but aren't perfect",
                "The 12-year-old Linux vulnerability shows that bugs can lurk for over a decade"
            ]
        },
        {
            id: "exam-prep",
            title: "🎯 Midterm Prep: Trust Concepts",
            content: `Trust concepts may appear on the midterm, especially in connection with the concurrency material. Make sure you can apply the trust framework to technical scenarios. The assign4 essay questions are also great practice.`,
            keyPoints: [
                "📝 Define trust: stopping questioning the dependability of something",
                "📝 Define agency: capacity to take actions aligned with our goals",
                "📝 Define agential gullibility: trusting more than is warranted",
                "📝 Name and explain the 3 paths to trust: assumption, inference, substitution",
                "📝 Give examples of each path in a software context",
                "📝 Explain why OSes are the 'root of trust' for all software",
                "📝 Connect trust substitution to CV patterns (while loop = substitution!)",
                "📝 Explain the xz backdoor as an example of agential gullibility"
            ],
            diagram: `
Midterm Cheat Sheet — Trust Concepts:

┌─────────────────────────────────────────────────────────────────┐
│  CONCEPT                │  KEY EXAM ANSWER                       │
├─────────────────────────────────────────────────────────────────┤
│  Trust                  │  Stop questioning dependability        │
│                         │  = extending agency to something       │
├─────────────────────────────────────────────────────────────────┤
│  Agential gullibility   │  Trusting MORE than warranted          │
│                         │  Ex: xz backdoor, using unknown lib    │
├─────────────────────────────────────────────────────────────────┤
│  Trust by Assumption    │  No evidence — "just because"          │
│                         │  Weakest form of trust                 │
├─────────────────────────────────────────────────────────────────┤
│  Trust by Inference     │  Based on evidence: reputation,        │
│                         │  past performance, endorsements        │
├─────────────────────────────────────────────────────────────────┤
│  Trust by Substitution  │  Design a Plan B to REPLACE need      │
│                         │  to trust. Ex: while loop with CV,     │
│                         │  redundant backups, input validation   │
├─────────────────────────────────────────────────────────────────┤
│  OS as root of trust    │  All apps run on OS; app trust ≤       │
│                         │  OS trust. OS bug = system-wide risk   │
├─────────────────────────────────────────────────────────────────┤
│  Why concurrency +      │  Non-deterministic bugs, hard to       │
│  trust is hard          │  reproduce, can lurk for years         │
├─────────────────────────────────────────────────────────────────┤
│  Trust in CV code       │  while loop = trust substitution       │
│                         │  Don't trust wakeup means condition    │
│                         │  is true; re-check it yourself!        │
└─────────────────────────────────────────────────────────────────┘
            `
        },
        {
            id: "summary",
            title: "Lecture 16 Summary",
            content: `Trust is often required, powerful, and dangerous. A key design challenge is how we design structures that enable us to **substitute** trust — both in code (while loops with CVs, defensive programming) and in organizations (code review processes, layered merge authority).`,
            keyPoints: [
                "Operating systems are the ROOT OF TRUST — apps are only as trustworthy as the OS beneath",
                "OS scale (codebase, users, impact, longevity) makes trust especially critical",
                "Trust = extending agency = letting something become part of your functioning",
                "Agential gullibility = trusting more than warranted (xz backdoor example)",
                "Three paths to trust: assumption (weakest), inference (evidence-based), substitution (Plan B)",
                "Trust substitution appears in our code: while loops with CVs, defensive checks, input validation",
                "Key takeaway: trust with great care, and design structures that substitute the need for trust"
            ],
            advantages: [
                "Trust enables efficiency — we can't verify everything ourselves",
                "Understanding trust helps write MORE ROBUST concurrent code",
                "The trust framework gives vocabulary to reason about software dependencies",
                "Trust substitution patterns (defensive programming) prevent entire classes of bugs"
            ],
            disadvantages: [
                "Trust can be exploited — the xz backdoor proves even long-term trust isn't safe",
                "Substitution has limits — code review missed the xz attack; OSS-Fuzz was circumvented",
                "OS bugs affect everything built on top — cascading trust failures",
                "Concurrency makes trust verification harder — non-deterministic behavior"
            ]
        },
        {
            id: "next-time",
            title: "Coming Up Next",
            content: `Next lecture we'll move to a new topic: **how does the OS run and switch between threads?** We'll peek under the hood at the OS mechanisms that make multithreading possible — thread scheduling, context switching, and how the OS manages the threads we've been creating with our C++ code.`,
            keyPoints: [
                "How does the OS actually implement thread scheduling?",
                "Context switching: saving and restoring thread state",
                "The OS kernel's role in managing threads",
                "This connects everything: threads (Lecture 12) + trust in the OS (this lecture) + OS internals (next)"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Classify the Trust Path",
            difficulty: "easy",
            description: "For each scenario, identify whether the trust is based on assumption, inference, or substitution. Explain your reasoning.",
            starterCode: `// Scenario A:
// A student uses a popular sorting library because
// "everyone else in the class is using it."
// Trust path: ____

// Scenario B:
// A developer adds assert() statements throughout
// their code to catch unexpected states.
// Trust path: ____

// Scenario C:
// You download a random VS Code extension without
// reading reviews because you need it right now.
// Trust path: ____

// Scenario D:
// A company chooses AWS because they've used it
// reliably for the past 5 years.
// Trust path: ____

// Scenario E:
// A programmer writes 'while (!ready)' instead of
// 'if (!ready)' before cv.wait(lock).
// Trust path: ____`,
            solution: `// Scenario A: INFERENCE
// "Everyone else uses it" = social proof, which is a form
// of evidence. You're inferring trustworthiness from the
// community's adoption. (Could also argue weak inference.)

// Scenario B: SUBSTITUTION
// Assert statements are a "Plan B" — they don't trust
// that the code is correct; they add checks that will
// catch problems if they occur. Classic substitution!

// Scenario C: ASSUMPTION
// No evidence at all — you're trusting absent any clues.
// This is the weakest form of trust and potentially
// agential gullibility.

// Scenario D: INFERENCE
// 5 years of reliable past performance is strong evidence.
// This is trust by inference based on track record.

// Scenario E: SUBSTITUTION
// The while loop substitutes the need to trust that
// a wakeup means the condition is true. Instead of
// trusting the OS's wakeup mechanism completely, you
// RE-CHECK the condition yourself. This is the
// canonical example of trust substitution in code!`,
            explanation: "The three paths to trust (assumption, inference, substitution) appear constantly in software development. Recognizing which path you're using helps you evaluate whether your trust is justified."
        },
        {
            id: "ex2",
            title: "Agential Gullibility in Software",
            difficulty: "medium",
            description: "For each scenario, explain whether agential gullibility is present and why. Think about whether the trust extended is warranted by the evidence available.",
            starterCode: `// Scenario A:
// A startup uses a tiny open-source library with 3 GitHub
// stars and no documentation for handling user payments.
// Is this agential gullibility? Why or why not?

// Scenario B:
// A team trusts their unit tests completely and ships code
// without any manual review or integration testing.
// Is this agential gullibility? Why or why not?

// Scenario C:
// A developer uses 'if' instead of 'while' with cv.wait()
// because "notify_all only gets called when the condition
// is actually true in our code."
// Is this agential gullibility? Why or why not?`,
            solution: `// Scenario A: YES — agential gullibility
// A payment-critical library with 3 stars, no docs, and no
// track record? The stakes are HIGH (handling money!) but the
// evidence of trustworthiness is MINIMAL. This is extending
// agency far beyond what the evidence warrants.
// Better: use a well-known payment library (inference) or
// add extensive validation (substitution).

// Scenario B: YES — agential gullibility
// Unit tests can't catch everything — they test individual
// units but miss integration issues, race conditions, and
// edge cases. Trusting them completely and skipping other
// verification is trusting more than warranted.
// Better: add integration tests, code review, and manual
// testing (substitution — multiple verification methods).

// Scenario C: YES — agential gullibility
// Even if notify_all is only called when the condition is
// true NOW, two problems remain:
// 1. Spurious wakeups: the OS can wake your thread without
//    notify_all being called!
// 2. Multiple waiters: if 2 threads wait and 1 resource is
//    available, both wake up but only 1 should proceed.
// Using 'if' trusts the wakeup mechanism more than warranted.
// The 'while' loop is trust SUBSTITUTION — re-checking!`,
            explanation: "Agential gullibility = trusting more than is warranted. In each case, the trust extended exceeds what the evidence supports. The fix is usually to add substitution (Plan B checks) or seek stronger inference (more evidence)."
        },
        {
            id: "ex3",
            title: "Assign4 Essay Practice: Trusting Your Own Code",
            difficulty: "medium",
            description: "Assign4 asks: 'How would you convince another CS111 student to trust your code for this assignment?' Write a thoughtful answer using the trust framework from this lecture.",
            starterCode: `// How would you convince another student to trust
// your assign4 caltrain implementation?
//
// Address all three trust paths:
//
// 1. How could they trust by INFERENCE?
//    (What evidence can you provide?)
//
// 2. How could they trust by SUBSTITUTION?
//    (What safeguards exist?)
//
// 3. Why is trust by ASSUMPTION not sufficient?
//
// Write your answer below:`,
            solution: `// INFERENCE-based trust (providing evidence):
// - "I pass all provided sanitycheck tests AND wrote
//    additional stress tests with many threads"
// - "I followed the standard CV patterns from lecture
//    (while loop + wait(lock) + notify_all)"
// - "I can explain my design and walk you through the
//    thread interactions step by step"
// - "I used Valgrind/ThreadSanitizer to check for
//    race conditions and memory errors"
//
// SUBSTITUTION-based trust (safeguards):
// - "My code uses while loops around all cv.wait() calls
//    (substitutes trust in wakeup correctness)"
// - "I added assertions to verify invariants (e.g.,
//    seats_taken <= available seats)"
// - "The code review process: you can READ my code
//    and verify the logic yourself"
// - "The test suite acts as a substitute — even if you
//    don't read the code, tests verify behavior"
//
// Why ASSUMPTION is insufficient:
// - "Just trusting that my code works because 'I wrote it'
//    is the weakest form of trust — no evidence!"
// - "I could have bugs I'm not aware of (like the
//    12-year-old Linux vulnerability)"
// - "The whole point of testing and code review is to
//    move beyond assumption to inference/substitution"`,
            explanation: "This answer directly practices the assign4 essay question. The key is using the trust vocabulary (assumption, inference, substitution) and giving concrete examples from your actual coding process."
        },
        {
            id: "ex4",
            title: "TOCTOU Race Condition Analysis",
            difficulty: "hard",
            description: "Identify the TOCTOU (Time-Of-Check to Time-Of-Use) race condition in this code and explain how it connects to trust concepts. Then fix the code.",
            starterCode: `// This code checks if a file exists, and if so, reads it.
// There is a TOCTOU race condition. Find it!

#include <sys/stat.h>
#include <stdio.h>

void read_if_exists(const char *path) {
    struct stat file_info;
    
    // CHECK: does the file exist?
    if (stat(path, &file_info) == 0) {
        // File exists! Let's read it.
        
        // USE: open and read the file
        FILE *f = fopen(path, "r");
        if (f != NULL) {
            char buffer[1024];
            fread(buffer, 1, sizeof(buffer), f);
            fclose(f);
            printf("Read: %s\\n", buffer);
        }
    }
}

// 1. Where is the TOCTOU race condition?
// 2. How does this relate to trust?
// 3. How would you fix it?`,
            solution: `// 1. THE TOCTOU RACE CONDITION:
//    Between stat() (CHECK) and fopen() (USE), another
//    process could:
//    - Delete the file → fopen fails
//    - Replace the file with a DIFFERENT file
//    - Replace it with a symlink to a sensitive file
//      (e.g., /etc/shadow → attacker reads passwords!)
//
// 2. TRUST CONNECTION:
//    - We TRUST that the file hasn't changed between
//      check and use — this is trust by ASSUMPTION!
//    - No evidence guarantees the file is the same.
//    - This is like the "air gap" between unlock() and
//      wait() in condition variables!
//    - Just like cv.wait(lock) atomically combines unlock
//      + sleep, we need to atomically combine check + use.
//
// 3. THE FIX — combine check and use:

void read_if_exists_safe(const char *path) {
    // Just TRY to open it — this is atomic!
    // Don't check first, then open (two separate operations).
    FILE *f = fopen(path, "r");
    if (f != NULL) {
        // If fopen succeeded, the file existed at the
        // moment we opened it, AND we now have a handle
        // to that specific file (not whatever path
        // points to later).
        char buffer[1024];
        size_t bytes = fread(buffer, 1, sizeof(buffer)-1, f);
        buffer[bytes] = '\\0';
        fclose(f);
        printf("Read: %s\\n", buffer);
    }
    // If fopen failed, file didn't exist — no race!
}

// KEY INSIGHT: This is the same principle as cv.wait(lock)!
// Combine the check and the action into a SINGLE atomic
// operation to eliminate the race condition window.`,
            explanation: "TOCTOU bugs are the security equivalent of the air gap problem in condition variables. The fix is the same concept: combine the check and the action into a single atomic operation. stat() then fopen() = two operations with a gap. Just fopen() = one atomic operation."
        },
        {
            id: "ex5",
            title: "Trust Analysis: Google Duo Bug (Assign4 Prep)",
            difficulty: "medium",
            description: "The Google Duo video calling app had a race condition that briefly transmitted audio/video before the callee answered. Practice analyzing this using the trust framework — this is directly relevant to assign4 questions!",
            starterCode: `// Google Duo Race Condition (simplified):
// When calling someone, the app briefly transmitted
// audio/video data BEFORE the recipient pressed "Answer."
//
// This means: the caller could hear/see the callee
// for a few seconds without their consent!
//
// Answer these questions (assign4 practice):
//
// Q1: Describe the race condition and its impact.
//
// Q2: How do Google Duo developers exhibit 
//     "agential gullibility"?
//
// Q3: How could a user INFER trust in Google Duo?
//
// Q4: How could a user SUBSTITUTE the need to 
//     trust Google Duo?`,
            solution: `// Q1: The Race Condition
// The bug was a timing issue where media streaming began
// BEFORE the call was fully answered. The "start streaming"
// and "call accepted" events were not properly synchronized.
// Impact: privacy violation — callers could hear/see the
// callee without consent. Similar to our TOCTOU pattern:
// the system "used" the media before properly "checking"
// that the call was accepted.

// Q2: Agential Gullibility by Developers
// Developers trusted that the ordering of network events
// (start streaming after answer) would always hold — but
// in concurrent systems, ordering isn't guaranteed without
// explicit synchronization! They trusted the happy path
// more than warranted, without adding proper guards
// (trust by assumption where substitution was needed).

// Q3: Inferring Trust in Google Duo
// - "Google is a large, reputable company" (brand inference)
// - "Millions of people use Duo" (social proof / inference)
// - "I've used Duo before without problems" (past performance)
// - "It's in the official Google Play Store" (institutional trust)

// Q4: Substituting Trust in Google Duo
// - Cover your camera when not actively on a call
// - Mute your microphone when not actively on a call
// - Use a physical camera shutter/cover on your device
// - Revoke camera/microphone permissions when not using Duo
// - Use a different calling app as backup
// These are all "Plan B" approaches that don't require
// trusting Duo's code to be bug-free.`,
            explanation: "This exercise directly practices the assign4 essay questions. The Google Duo bug is a real-world race condition with privacy implications — it connects the technical concepts of synchronization to the trust framework. Practice writing clear, concise answers using the trust vocabulary."
        }
    ]
};

export default lecture16;
