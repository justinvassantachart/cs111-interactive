export const lecture17 = {
    id: 17,
    title: "Dispatching",
    subtitle: "How the OS Switches Between Threads",
    keyTakeaway: "The OS keeps a process control block (PCB) for each process and uses it to context switch between threads. To switch threads, we must save ('freeze frame') the current thread's register values — including the stack pointer — and load in the new thread's saved registers. The context switch function is written in assembly and is 'funky': you call it from one thread's stack and return from it on another thread's stack. New threads get a fake saved state so that context-switching to them 'returns' to the start of their function.",

    sections: [
        {
            id: "topic-overview",
            title: "Topic 3: Multithreading, Part 6",
            content: `We're now shifting from **using** threads to understanding how the **operating system implements** them. In Lectures 12–15 we learned how to write multithreaded programs with mutexes, condition variables, and the monitor pattern. Now we ask: **how does the OS actually run and switch between threads?** This starts a new sub-topic that will culminate in **assign5**, where you implement your own versions of \`thread\`, \`mutex\`, and \`condition_variable\`!`,
            keyPoints: [
                "Previous lectures: how to USE threads (create, synchronize, avoid bugs)",
                "This lecture: how does the OS IMPLEMENT thread switching? (dispatching)",
                "Lecture 18: how does the OS decide WHICH thread to run? (scheduling)",
                "Lecture 19: scheduling with preemption (timer interrupts)",
                "Lecture 20: implementing locks and condition variables",
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
│ (This one!)   │    │  (Next)       │    │               │    │               │
└───────────────┴────┴───────────────┴────┴───────────────┴────┴───────────────┘

assign5: implement your own version of thread, mutex and condition_variable_any!
            `
        },
        {
            id: "scheduling-dispatching-overview",
            title: "🔍 Overview: Scheduling and Dispatching",
            content: `We've learned how user programs can create new processes (\`fork\`) and spawn threads. But how does the OS manage this **internally**? When we call \`thread t(myFunc)\`, what happens under the hood?`,
            keyPoints: [
                "How does the OS track info for threads and processes? (today — PCBs)",
                "How does the OS RUN a thread and SWITCH between threads? (today — dispatching)",
                "How does the OS DECIDE which thread to run next? (next time — scheduling)",
                "Key distinction: dispatching = the MECHANISM of switching; scheduling = the POLICY of choosing"
            ],
            diagram: `
Dispatching vs. Scheduling:

┌─────────────────────────────────────────────────────────────────┐
│  DISPATCHING (Lecture 17 — today)                                │
│    "HOW do we switch between threads?"                           │
│    → The mechanism: save state, load state, switch stacks        │
│    → Context switch implementation in assembly                   │
├─────────────────────────────────────────────────────────────────┤
│  SCHEDULING (Lecture 18 — next time)                             │
│    "WHICH thread should run next?"                               │
│    → The policy: fairness, priority, round-robin, etc.           │
│    → How the OS decides who gets the CPU                         │
└─────────────────────────────────────────────────────────────────┘
            `
        },
        {
            id: "running-a-thread",
            title: "⚙️ Running a Thread",
            content: `Threads are the **unit of execution** — processes aren't executed directly, threads are. Processes are just "thread containers." A processor has one or more **cores**, and each core is a complete CPU that can execute one thread at a time.`,
            keyPoints: [
                "A process is a 'container' for threads — it's the threads that actually execute",
                "Each CPU core can run exactly ONE thread at a time",
                "Typically there are way more threads than cores (most are waiting for something)",
                "When the OS wants to run a thread, it loads its state (registers) into a core",
                "PROBLEM: once we start running a thread, the OS code is NOT running anymore!",
                "How does the OS regain control? (It can't just 'take over' — it's not executing!)"
            ],
            diagram: `
The Problem: Once a thread runs, the OS isn't running!

   CPU Core
┌────────────────────────────────┐
│  Running: Thread A             │
│  (user code executing)         │
│                                │
│  OS code is NOT running here!  │
│  How does the OS get back      │
│  control to switch threads?    │
└────────────────────────────────┘

With 1 core: only ONE thing runs at a time!
If the thread is running, the OS isn't.
If the OS is running, the thread isn't.

Key Question: How does the OS regain control?
            `
        },
        {
            id: "regaining-control",
            title: "🔄 Regaining Control: Traps and Interrupts",
            content: `The OS needs a way to get back in control after a thread starts running. There are two main categories of events that return control to the OS: **traps** (caused by the running thread) and **interrupts** (caused by external events).`,
            keyPoints: [
                "TRAPS — events caused by the current thread that need OS attention:",
                "  1. System calls (read, write, waitpid, fork, etc.)",
                "  2. Errors (illegal instruction, segfault, division by zero)",
                "  3. Page faults (accessing memory that must be loaded from disk — more later!)",
                "INTERRUPTS — events from outside the current thread:",
                "  1. Character typed at keyboard",
                "  2. Completion of a disk I/O operation",
                "  3. Timer interrupt — ensures the OS ALWAYS eventually regains control!",
                "At any of these events, the OS can decide to run a different thread"
            ],
            diagram: `
How the OS Regains Control:

  TRAPS (from the running thread):           INTERRUPTS (from outside):
  ┌────────────────────────────┐             ┌────────────────────────────┐
  │ System calls:              │             │ Hardware events:           │
  │   read(), write(),         │             │   Keyboard input           │
  │   fork(), waitpid()        │             │   Disk I/O completion      │
  │                            │             │                            │
  │ Errors:                    │             │ Timer:                     │
  │   Segfault, illegal insn   │             │   Periodic interrupt that  │
  │   Division by zero         │             │   GUARANTEES the OS gets   │
  │                            │             │   control back eventually  │
  │ Page faults:               │             │   (prevents infinite loops │
  │   Need to load memory      │             │    from hogging the CPU!)  │
  │   from disk                │             │                            │
  └────────────────┬───────────┘             └─────────────┬──────────────┘
                   │                                       │
                   └──────────────┬────────────────────────┘
                                  ▼
                     ┌────────────────────────┐
                     │  OS regains control!   │
                     │  → Can switch to a     │
                     │    different thread     │
                     └────────────────────────┘
            `
        },
        {
            id: "switching-overview",
            title: "🔀 Switching to Another Thread",
            content: `When we switch from one thread to another, we need to perform two critical operations. Think of it like pausing a movie and switching to a different one — you need to bookmark where you were, and then fast-forward the other movie to where IT left off.`,
            keyPoints: [
                "Key Idea #1: SAVE the current thread's state ('freeze frame') to resume later",
                "Key Idea #2: LOAD the new thread's saved state to resume it where it left off",
                "What state? We must remember the CPU core's REGISTER values",
                "By saving the stack pointer register (%rsp), we also keep a reference to the thread's stack",
                "The stack contains the thread's local variables, function call chain, etc.",
                "This save/load operation is called a CONTEXT SWITCH"
            ]
        },
        {
            id: "x86-refresher",
            title: "🧮 Aside: x86-64 Assembly Refresher",
            content: `To understand context switching, we need to know a bit about x86-64 registers. If you've taken CS107, this is a refresher. If not, here's what you need to know.`,
            keyPoints: [
                "A register is a 64-bit storage location INSIDE a processor core",
                "Each core has its own set of registers (not shared between cores!)",
                "Registers are like 'scratch paper' for the processor — data is moved to registers before operating on it",
                "Some registers hold function parameters and return values",
                "Special register %rsp: ALWAYS stores the address of the current top of the stack",
                "Other 'callee-saved' registers (%rbp, %rbx, %r12–%r15): must be preserved across function calls",
                "Key insight: saving %rsp also saves a reference to the entire stack!"
            ],
            diagram: `
x86-64 Register Cheat Sheet (relevant to context switching):

┌────────────────────────────────────────────────────────────────┐
│  REGISTER   │  PURPOSE                │  CONTEXT SWITCH?       │
├────────────────────────────────────────────────────────────────┤
│  %rsp       │  Stack pointer           │  Saved in thread state │
│  %rbp       │  Base/frame pointer      │  Pushed onto stack     │
│  %rbx       │  General purpose (saved) │  Pushed onto stack     │
│  %r12       │  General purpose (saved) │  Pushed onto stack     │
│  %r13       │  General purpose (saved) │  Pushed onto stack     │
│  %r14       │  General purpose (saved) │  Pushed onto stack     │
│  %r15       │  General purpose (saved) │  Pushed onto stack     │
├────────────────────────────────────────────────────────────────┤
│  %rdi       │  1st function argument   │  Not saved (caller-    │
│  %rsi       │  2nd function argument   │  saved — already       │
│  %rax       │  Return value            │  handled by normal     │
│  %rcx, %rdx │  Other caller-saved      │  function call rules)  │
└────────────────────────────────────────────────────────────────┘

Key: We only need to save the "callee-saved" registers (%rbp, %rbx, %r12–%r15)
plus the stack pointer (%rsp). The other registers are already saved by the
normal C calling convention before a function call.
            `
        },
        {
            id: "pcb-thread-state",
            title: "📦 Process and Thread State (PCB)",
            content: `The OS maintains a private **Process Control Block (PCB)** for each process. This is a data structure that stores everything the OS needs to know about a process. It lives as long as the process does.`,
            keyPoints: [
                "PCB contains: information about memory used by this process",
                "PCB contains: file descriptor table (open files/sockets)",
                "PCB contains: info about threads in this process",
                "PCB contains: other misc. accounting and info (PID, state, etc.)",
                "Every process has 1 main thread and can spawn additional threads",
                "All main info in the PCB (memory, file descriptors) is relevant to ALL threads in the process",
                "Each thread also has some of its OWN private info — this is the thread state"
            ],
            diagram: `
Process Control Block (PCB):

┌──────────────────────────────────────────────────┐
│  Process A Control Block                          │
│                                                    │
│  ┌─────────────────────────────────────────┐      │
│  │ Memory info (shared by all threads)     │      │
│  ├─────────────────────────────────────────┤      │
│  │ File descriptor table (shared)          │      │
│  ├─────────────────────────────────────────┤      │
│  │ Other accounting info (PID, etc.)       │      │
│  ├─────────────────────────────────────────┤      │
│  │ Threads:                                │      │
│  │  ┌────────┐ ┌────────┐ ┌────────┐      │      │
│  │  │ A1     │ │ A2     │ │ A3     │      │      │
│  │  │ thread │ │ thread │ │ thread │      │      │
│  │  │ state  │ │ state  │ │ state  │      │      │
│  │  │(saved  │ │(saved  │ │(saved  │      │      │
│  │  │ %rsp)  │ │ %rsp)  │ │ %rsp)  │      │      │
│  │  └────────┘ └────────┘ └────────┘      │      │
│  └─────────────────────────────────────────┘      │
└──────────────────────────────────────────────────┘

Thread state stores: the saved stack pointer (%rsp).
From %rsp, we can find the thread's stack, which stores
the rest of the saved registers.

Key: When we switch threads, we save/load thread state!
            `
        },
        {
            id: "dispatcher-concept",
            title: "🎬 The Dispatcher and Context Switching",
            content: `The **dispatcher** is OS code that runs on each core to switch between threads. It is NOT a thread itself — it's just code that performs the dispatching function. The core operation is the **context switch**.`,
            keyPoints: [
                "The dispatcher: OS code that lets a thread run, then switches to another, etc.",
                "Context switch: saving current thread state (registers) and loading a new thread's state",
                "The context switch function is FUNKY — it breaks normal function rules!",
                "You call context_switch from one function, but it RETURNS to a completely different function!",
                "If switching to a NEW thread: returns to the start of that thread's function",
                "If switching to a previously-running thread: returns to where that thread called context_switch before",
                "This works because switching stacks also switches the return address!"
            ],
            diagram: `
Context Switch — The "Funky" Function:

  Thread A (running main):                Thread B (will run other_func):
  ┌─────────────────────────────┐         ┌─────────────────────────────┐
  │ int main() {                │         │ void other_func() {         │
  │   ...                       │         │   // starts executing here  │
  │   context_switch(A, B); ────┤────┐    │   // when switched to       │
  │   // resumes HERE when      │    │    │   ...                       │
  │   // switched back          │    │    │   context_switch(B, A); ────┤──┐
  │   ...                       │    │    │   // resumes HERE when      │  │
  │ }                           │    │    │   // switched back          │  │
  └─────────────────────────────┘    │    └─────────────────────────────┘  │
                                     │                                     │
                                     └──► Call from main(), but "return"   │
                                          into other_func()!              │
                                                                          │
                                     ┌────────────────────────────────────┘
                                     └──► Call from other_func(), but
                                          "return" into main()!

  Super funky: we are calling a function from one thread's
  stack and returning from it in another thread's stack!
            `
        },
        {
            id: "context-switch-demo",
            title: "💻 Demo: context-switch.cc",
            content: `Let's look at the actual code. This demo creates two threads (main and other) and switches between them. Pay careful attention to the \`context_switch\` calls — they are called from one function but return to another!`,
            codeExample: {
                title: "context-switch.cc — Two threads switching back and forth",
                language: "cpp",
                code: `// A thread is a stack plus the saved top of the stack
typedef struct Thread {
    char stack[8192];
    char *saved_rsp;
} Thread;

Thread main_thread;
Thread other_thread;

void other_func() {
    cout << "Howdy! I am another thread." << endl;
    context_switch(other_thread, main_thread);
    cout << "We will never reach this line :(" << endl;
}

int main(int argc, char *argv[]) {
    // Initialize other_thread to run other_func
    other_thread = create_thread(other_func);

    cout << "Hello, world! I am the main thread" << endl;
    context_switch(main_thread, other_thread);
    cout << "Cool, I'm back in main()!" << endl;
    return 0;
}`,
                annotations: [
                    { match: "char stack[8192];", explanation: "Each thread gets its own stack — 8KB of space for local variables, function calls, and saved register values. This is separate from the main program's stack." },
                    { match: "char *saved_rsp;", explanation: "This stores the saved stack pointer (%rsp) when the thread is not running. From this pointer, we can find all the other saved registers (they're pushed onto the stack). This is the thread's 'freeze frame' bookmark." },
                    { match: "other_thread = create_thread(other_func);", explanation: "Creates a new thread with a FAKE saved state. The fake state makes it look like the thread was about to call other_func and then got context-switched away. So when we switch TO it, ret pops other_func's address and we start running it." },
                    { match: "context_switch(main_thread, other_thread);", explanation: "Saves main_thread's registers and loads other_thread's registers. After this call RETURNS, we are executing on other_thread's stack! So execution jumps into other_func() — even though we called context_switch from main()!" },
                    { match: "context_switch(other_thread, main_thread);", explanation: "Saves other_thread's state and loads main_thread's state. This returns us to main() — specifically, to the line AFTER where main previously called context_switch. So 'Cool, I'm back in main()!' prints." },
                    { match: "cout << \"We will never reach this line :(\" << endl;", explanation: "This line never executes because nobody ever context_switches back to other_thread after this point. main() just prints its message and returns." },
                    { match: "cout << \"Cool, I'm back in main()!\" << endl;", explanation: "This prints after we return from context_switch. The switch to other_thread ran other_func, which then switched BACK to main_thread, resuming right here." }
                ]
            },
            keyPoints: [
                "Output: 'Hello, world! I am the main thread' → 'Howdy! I am another thread.' → 'Cool, I'm back in main()!'",
                "context_switch(current, next): saves current's state, loads next's state",
                "First switch: main → other_func (other_thread is new, so it starts at the beginning)",
                "Second switch: other_func → main (main_thread resumes where it left off)",
                "The 'We will never reach this line' message never prints — no one switches back to other_thread"
            ]
        },
        {
            id: "context-switch-steps",
            title: "🔧 Context Switch: The 4-Step Algorithm",
            content: `Here's how a context switch actually works. There are exactly 4 steps. One key optimization: instead of storing ALL registers in the PCB thread state, we push them onto the thread's stack (which is unused while the thread sleeps). We only store %rsp in the thread state space.`,
            keyPoints: [
                "Step 1: Push all registers (except %rsp) onto the current thread's stack",
                "Step 2: Save the current stack pointer (%rsp) into the thread's state space in the PCB",
                "Step 3: Load the OTHER thread's saved %rsp from its state space",
                "Step 4: Pop all registers off the other thread's stack",
                "Why push on the stack? The stack is unused while the thread sleeps — free storage!",
                "We only store %rsp in the PCB — everything else is on the stack, reachable via %rsp"
            ],
            diagram: `
Context Switch: 4 Steps (switching from Thread A3 to Thread B1)

STEP 1: Push registers onto A3's stack    STEP 2: Save %rsp to A3's state
┌──────────┐                              ┌──────────┐
│ A3 Stack │                              │ A3 Stack │    PCB Thread State
│  ...     │                              │  ...     │    ┌─────────┐
│  Saved   │                              │  Saved   │    │ A3: SP ─┤──► points to
│  %rbp    │                              │  %rbp    │    │         │   top of A3
│  %rbx    │                              │  %rbx    │    │         │   stack
│  %r12    │                              │  %r12    │    └─────────┘
│  %r13    │                              │  %r13    │
│  %r14    │                              │  %r14    │
│  %r15    │ ← %rsp                       │  %r15    │ ← saved in PCB
└──────────┘                              └──────────┘

STEP 3: Load B1's saved %rsp              STEP 4: Pop registers from B1's stack
┌──────────┐                              ┌──────────┐
│ B1 Stack │    PCB Thread State          │ B1 Stack │
│  ...     │    ┌─────────┐              │  ...     │
│  Saved   │    │ B1: SP ─┤──► load      │          │ ← %rsp (moved up)
│  %rbp    │    │         │   into %rsp  │          │
│  %rbx    │    └─────────┘              │  (regs   │
│  %r12    │                              │   now in │
│  %r13    │                              │   CPU!)  │
│  %r14    │                              │          │
│  %r15    │ ← %rsp now here             └──────────┘
└──────────┘

After step 4: CPU has B1's registers, %rsp points to B1's stack.
We are now "inside" thread B1! 🎉
            `
        },
        {
            id: "context-switch-assembly",
            title: "🔩 Context Switch: x86-64 Assembly",
            content: `The context switch function MUST be written in assembly — it violates all normal C/C++ function rules (it switches to a different stack mid-function!). Here's the actual implementation. It's just 13 lines of assembly, but it's the most important code in the OS.`,
            codeExample: {
                title: "The complete context_switch implementation in x86-64 assembly",
                language: "x86asm",
                code: `context_switch:
    pushq %rbp              ; Step 1: Push callee-saved registers
    pushq %rbx              ;   onto the current thread's stack
    pushq %r12
    pushq %r13
    pushq %r14
    pushq %r15
    movq %rsp, 0x2000(%rdi) ; Step 2: Save current %rsp to thread state
    movq 0x2000(%rsi), %rsp ; Step 3: Load other thread's saved %rsp
    popq %r15               ; Step 4: Pop saved registers from
    popq %r14               ;   the other thread's stack
    popq %r13
    popq %r12
    popq %rbx
    popq %rbp
    ret                     ; Return to the OTHER thread's code!`,
                annotations: [
                    { match: "pushq %rbp", explanation: "Step 1 begins: push all callee-saved registers onto the current thread's stack. We push %rbp first (the base/frame pointer). Each pushq decrements %rsp by 8 bytes and stores the register value at the new %rsp location." },
                    { match: "pushq %r15", explanation: "Last register pushed. After all 6 pushes, %rsp has moved down 48 bytes (6 × 8). The current thread's complete execution state (these registers + the stack contents) is fully saved." },
                    { match: "movq %rsp, 0x2000(%rdi)", explanation: "Step 2: Save the current stack pointer into the thread's state. %rdi holds the first argument (pointer to 'current' Thread struct). 0x2000 = 8192 bytes, which is the offset past the 8KB stack[] array to reach the saved_rsp field." },
                    { match: "movq 0x2000(%rsi), %rsp", explanation: "Step 3: THE CRITICAL LINE! Load the other thread's saved stack pointer. %rsi holds the second argument (pointer to 'next' Thread struct). After this instruction, %rsp points to the OTHER thread's stack. We are now operating on a completely different stack!" },
                    { match: "popq %r15", explanation: "Step 4 begins: pop the saved registers from the NEW thread's stack. These are the register values that were pushed when this thread was previously switched away from. We're restoring the other thread's 'freeze frame'." },
                    { match: "popq %rbp", explanation: "Last register popped. The CPU now has all of the new thread's saved register values. The stack pointer is back to where it was before the previous context_switch pushed registers." },
                    { match: "ret", explanation: "THE MAGIC: ret pops the return address off the stack and jumps to it. But we're on the OTHER thread's stack! So this 'returns' to wherever the OTHER thread called context_switch (or, for a new thread, to the start of its function). We entered on one stack and exit on another!" }
                ]
            },
            keyPoints: [
                "Only 6 registers need to be saved — the callee-saved registers (%rbp, %rbx, %r12–%r15)",
                "Other registers (like %rax, %rdi, %rsi) are caller-saved — the C calling convention already handles them",
                "0x2000 = 8192 decimal = size of the stack[] array = offset to saved_rsp in the Thread struct",
                "%rdi = first argument (current thread), %rsi = second argument (next thread)",
                "The two movq instructions are the 'switch point' — before: current's stack, after: next's stack",
                "ret is what makes the magic work — it 'returns' into the other thread's code!"
            ]
        },
        {
            id: "return-addresses",
            title: "📌 How We Switch Code: Return Addresses",
            content: `You might wonder: the assembly switches stacks and registers, but how does that change WHAT CODE is running? The answer is beautifully simple: information about what code to resume is **already on the stack**!`,
            keyPoints: [
                "When you CALL a function (callq instruction), the CPU pushes the RETURN ADDRESS onto the stack",
                "The return address = where to resume in the calling function when this function finishes",
                "When a function finishes (ret instruction), it pops the return address and jumps to it",
                "This is stored on each thread's stack automatically — no extra work needed!",
                "So when we switch stacks: the new stack has a DIFFERENT return address",
                "ret after the context switch 'returns' to wherever the OTHER thread was executing"
            ],
            diagram: `
How Return Addresses Make Code Switching Work:

Thread A's Stack:                    Thread B's Stack:
┌────────────────────┐              ┌────────────────────┐
│  ...               │              │  ...               │
│  Return addr: X    │ ← where A    │  Return addr: Y    │ ← where B
│  (back to main()   │   should     │  (back to          │   should
│   after calling    │   resume     │   other_func()     │   resume
│   context_switch)  │              │   after calling    │
│                    │              │   context_switch)  │
│  Saved %rbp       │              │  Saved %rbp       │
│  Saved %rbx       │              │  Saved %rbx       │
│  Saved %r12       │              │  Saved %r12       │
│  Saved %r13       │              │  Saved %r13       │
│  Saved %r14       │              │  Saved %r14       │
│  Saved %r15       │ ← rsp        │  Saved %r15       │
└────────────────────┘              └────────────────────┘

context_switch does pushes on A's stack, switches to B's stack,
does pops on B's stack, then ret:
  → pops return addr Y from B's stack
  → jumps to addr Y (code in other_func!)

We entered context_switch from code in main(),
but we exit into code in other_func()!
            `
        },
        {
            id: "creating-new-threads",
            title: "🆕 Creating New Threads",
            content: `There's a chicken-and-egg problem: when a thread runs for the **first time**, it won't have a real "freeze frame" from a previous context switch. So how does context-switching to a brand new thread work?`,
            codeExample: {
                title: "create_thread — Setting up a fake 'saved state' for a new thread",
                language: "cpp",
                code: `static const int kNumRegistersToSave = 6;

Thread create_thread(void (*func)()) {
    Thread new_thread;
    void *stack_top = new_thread.stack + sizeof(new_thread.stack);

    // Make it look like this thread was about to start func,
    // and then context switched.  In other words, once
    // the saved registers are popped, ret should take us to
    // the start of func.
    *(void **)((char *)stack_top - sizeof(void *)) = (void *)func;

    // Move the stack pointer downwards by num registers to make
    // it appear like we pushed those registers on when we
    // previously context switched
    new_thread.saved_rsp = (char *)stack_top
        - sizeof(void *) - kNumRegistersToSave * sizeof(long);
    return new_thread;
}`,
                annotations: [
                    { match: "static const int kNumRegistersToSave = 6;", explanation: "We save 6 registers during context_switch: %rbp, %rbx, %r12, %r13, %r14, %r15. Each is 8 bytes (64 bits), so 48 bytes total." },
                    { match: "void *stack_top = new_thread.stack + sizeof(new_thread.stack);", explanation: "stack_top points to the TOP of the 8KB stack array. Stacks grow DOWNWARD in x86-64, so the 'top' (highest address) is where the stack starts." },
                    { match: "*(void **)((char *)stack_top - sizeof(void *)) = (void *)func;", explanation: "THE KEY TRICK: Place the function pointer (address of func) at the top of the stack, where a return address would normally be. When context_switch runs 'ret', it will pop this address and jump to func — as if we're 'returning' to the start of func!" },
                    { match: "new_thread.saved_rsp = (char *)stack_top\n        - sizeof(void *) - kNumRegistersToSave * sizeof(long);", explanation: "Set saved_rsp to point past the fake return address AND 6 fake register slots. This makes it look like we already pushed 6 registers onto this stack during a previous context_switch. When context_switch pops them, the values are garbage (uninitialized), but that's OK — the thread is new and hasn't used those registers yet." }
                ]
            },
            keyPoints: [
                "Problem: new threads have no real 'freeze frame' from a previous context switch",
                "Solution: give the thread a FAKE saved state that LOOKS like a real freeze frame",
                "Place the function pointer where the return address would normally be",
                "Add space for 6 fake register values below it",
                "Set saved_rsp to point to the bottom of this fake frame",
                "When context_switch pops registers and calls ret, it jumps to the start of func!",
                "Elegant trick: the same context_switch code works for BOTH new and existing threads"
            ],
            diagram: `
New Thread's Stack After create_thread:

   stack_top → ┌────────────────────────┐  (highest address)
               │  func (return address) │  ← ret will jump here!
               ├────────────────────────┤
               │  (fake %rbp value)     │  ← popped but ignored
               │  (fake %rbx value)     │    (thread hasn't used
               │  (fake %r12 value)     │     these registers yet)
               │  (fake %r13 value)     │
               │  (fake %r14 value)     │
               │  (fake %r15 value)     │
  saved_rsp → ├────────────────────────┤
               │                        │
               │  (rest of 8KB stack    │
               │   — unused so far)     │
               │                        │
               └────────────────────────┘  (lowest address)

When context_switch switches to this thread:
  1. Load saved_rsp into %rsp
  2. Pop 6 registers (fake values — that's OK)
  3. ret → pops func address → starts executing func!
            `
        },
        {
            id: "context-switch-practice",
            title: "🧩 Context Switch Practice Problem",
            content: `Let's trace through a more complex example to solidify your understanding. This is the kind of problem you'll see on the exam. What does this program output?`,
            codeExample: {
                title: "context-switch-practice.cc — Trace the output!",
                language: "cpp",
                code: `Thread main_thread;
Thread other_thread;

void other_func() {
    context_switch(other_thread, main_thread);
    cout << "D" << endl;
    context_switch(other_thread, main_thread);
    cout << "A" << endl;
}

int main(int argc, char *argv[]) {
    other_thread = create_thread(other_func);
    cout << "B" << endl;
    context_switch(main_thread, other_thread);
    cout << "C" << endl;
    context_switch(main_thread, other_thread);
    return 0;
}`,
                annotations: [
                    { match: "other_thread = create_thread(other_func);", explanation: "Creates other_thread with a fake saved state. Its 'return address' points to other_func. No output yet — create_thread doesn't run the thread, it just sets up the stack." },
                    { match: "cout << \"B\" << endl;", explanation: "STEP 1: We're in main(). Print 'B'. This is the first output." },
                    { match: "context_switch(main_thread, other_thread);", explanation: "STEP 2 (first call): Save main's state, load other_thread's state. Since other_thread is new, ret jumps to other_func. Execution continues at the TOP of other_func." },
                    { match: "context_switch(other_thread, main_thread);", explanation: "STEP 3 (first context_switch in other_func): Save other_thread, load main_thread. We 'return' to main() — right after where main called context_switch. So we print 'C' next." },
                    { match: "cout << \"C\" << endl;", explanation: "STEP 4: We're back in main(). Print 'C'. This is the second output." },
                    { match: "cout << \"D\" << endl;", explanation: "STEP 5: After the second context_switch from main, we resume other_func right after its first context_switch call. Print 'D'. This is the third output." },
                    { match: "return 0;", explanation: "STEP 6: After the second context_switch from main, we switch to other_func at step 5. other_func does its second context_switch back to main, and main reaches return 0. Note: 'A' never prints — no one switches back to other_func after that." }
                ]
            },
            keyPoints: [
                "Output: B, C, D (the letter A never prints!)",
                "Key insight: each context_switch saves/resumes at the CALL SITE",
                "When we switch BACK to a thread, we resume right after its last context_switch call",
                "New threads start at the beginning of their function (first time switched to)",
                "These custom threads don't run unless we EXPLICITLY context_switch to them"
            ],
            diagram: `
Execution Trace — Output: B C D

          main()                          other_func()
          ──────                          ────────────
  1. ──► print "B"
  2.     context_switch(main, other) ──►
                                    3.   context_switch(other, main) [first CS in func]
  4. ◄── print "C"                       (hits context_switch immediately)
  5.     context_switch(main, other) ──►
                                    6.   print "D"  [resumes AFTER first CS]
                                    7.   context_switch(other, main) [second CS]
  8. ◄── return 0;

  "A" never prints — main returns before anyone switches
  back to other_func a third time!

  Answer: B C D
            `
        },
        {
            id: "exam-prep",
            title: "🎯 Midterm Prep: Dispatching & Context Switching",
            content: `Dispatching and context switches are key topics for the exam. Here's what you should be able to do.`,
            keyPoints: [
                "📝 Explain what a PCB is and what it contains (memory info, FDT, thread state)",
                "📝 Describe the 4 steps of a context switch (push, save rsp, load rsp, pop)",
                "📝 Explain why context_switch must be written in assembly (switches stacks mid-function)",
                "📝 Trace through context_switch assembly: know what each instruction does",
                "📝 Explain how traps and interrupts let the OS regain control",
                "📝 Trace through programs with context_switch calls and determine the output",
                "📝 Explain how create_thread sets up a fake saved state for new threads",
                "📝 Explain why ret 'returns' to a different function after a context switch"
            ],
            diagram: `
Dispatching Exam Cheat Sheet:

┌──────────────────────────────────────────────────────────────────┐
│  CONTEXT SWITCH = save current state + load new state            │
│                                                                   │
│  4 STEPS:                                                         │
│    1. pushq callee-saved registers onto current stack            │
│    2. movq %rsp → current thread's PCB state (save rsp)          │
│    3. movq other thread's PCB state → %rsp (load rsp)            │
│    4. popq callee-saved registers from new stack                 │
│    + ret → jumps to new thread's code!                           │
│                                                                   │
│  WHY ASSEMBLY?                                                    │
│    Can't switch stacks in C/C++ — compiler assumes one stack!    │
│                                                                   │
│  NEW THREADS:                                                     │
│    create_thread puts a fake return address (func ptr) on stack  │
│    → context_switch's ret "returns" to the function's start      │
│                                                                   │
│  TRAPS vs INTERRUPTS:                                             │
│    Traps: caused by current thread (syscalls, errors, faults)    │
│    Interrupts: caused externally (keyboard, disk, TIMER)         │
│    Timer interrupt guarantees OS always regains control!          │
│                                                                   │
│  PCB CONTAINS: memory info, file descriptors, thread states      │
│  THREAD STATE: saved %rsp → rest of regs saved on stack          │
└──────────────────────────────────────────────────────────────────┘
            `
        },
        {
            id: "summary",
            title: "Lecture 17 Summary",
            content: `The OS keeps a process control block (PCB) for each process and uses it to context switch between threads. To switch, we save the current thread's register values and load the new thread's saved registers — all in 13 lines of assembly.`,
            keyPoints: [
                "PCB: a per-process data structure with memory info, FDT, and thread states",
                "Thread state stores the saved stack pointer (%rsp). Other registers saved on the stack.",
                "Context switch: push registers, save %rsp, load other %rsp, pop registers, ret",
                "ret 'returns' to the other thread's code — entering on one stack, exiting on another",
                "New threads: fake saved state makes context_switch 'return' to the function start",
                "Traps and interrupts give the OS opportunities to switch threads",
                "The dispatcher is OS code that runs context switches — not a thread itself"
            ],
            advantages: [
                "Context switch is extremely fast (just 13 assembly instructions!)",
                "Storing registers on the stack is clever — minimal PCB storage needed",
                "Same context_switch code works for both new and existing threads",
                "Timer interrupts guarantee the OS always regains control (no infinite loops!)"
            ],
            disadvantages: [
                "Context switches have overhead — thousands of them per second adds up",
                "Must be written in assembly — hard to debug, architecture-specific",
                "More context switches = less time threads spend doing useful work",
                "The 'funky' function behavior makes reasoning about correctness challenging"
            ]
        },
        {
            id: "next-time",
            title: "Coming Up Next",
            content: `Next lecture: **Scheduling** — now that we know HOW to switch threads, how does the OS decide WHICH thread to run next? We'll explore scheduling policies like FIFO, round-robin, and priority-based scheduling.`,
            keyPoints: [
                "Scheduling (Lecture 18): the POLICY of choosing which thread runs next",
                "FIFO, round-robin, priority-based, and other scheduling algorithms",
                "Fairness: how do we prevent one thread from hogging the CPU?",
                "Trade-offs: throughput vs. latency vs. fairness"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Context Switch: What Is Saved?",
            difficulty: "easy",
            description: "During a context switch in x86-64, which registers are explicitly pushed onto the stack and why? What about the other registers — why aren't they saved?",
            starterCode: `// The context_switch function pushes/pops certain registers.
// Which ones, and why?

// Registers explicitly saved during context switch:
// ???

// Registers NOT explicitly saved:
// ???

// Why the difference?`,
            solution: `// Registers explicitly saved during context switch (6 total):
// %rbp, %rbx, %r12, %r13, %r14, %r15
// These are the "callee-saved" registers. By the x86-64 calling
// convention, if a function uses these registers, it MUST restore
// them before returning. Since context_switch is a function, it
// must preserve them.

// Register saved separately (not pushed):
// %rsp — saved into the thread's state space in the PCB
// (not pushed onto the stack because it IS the stack pointer!)

// Registers NOT explicitly saved:
// %rax, %rcx, %rdx, %rdi, %rsi, %r8, %r9, %r10, %r11
// These are "caller-saved" registers. The CALLING function is
// responsible for saving these before making a function call.
// So by the time context_switch runs, the calling function has
// already saved them (or doesn't need their values anymore).
// context_switch doesn't need to worry about them.

// Key insight: the x86-64 calling convention splits the work
// between caller and callee, so context_switch only needs to
// handle the callee-saved registers!`,
            explanation: "The x86-64 calling convention divides registers into caller-saved and callee-saved. context_switch is a function, so it only needs to explicitly save callee-saved registers (%rbp, %rbx, %r12–%r15). Caller-saved registers are already handled by the calling code. %rsp is saved separately into the PCB."
        },
        {
            id: "ex2",
            title: "Trace Through context-switch.cc",
            difficulty: "medium",
            description: "Trace through the context-switch.cc program step by step. For each step, identify: what function we're in, what the output is, and what context_switch does.",
            starterCode: `Thread main_thread;
Thread other_thread;

void other_func() {
    cout << "Howdy! I am another thread." << endl;
    context_switch(other_thread, main_thread);
    cout << "We will never reach this line :(" << endl;
}

int main(int argc, char *argv[]) {
    other_thread = create_thread(other_func);
    cout << "Hello, world!  I am the main thread" << endl;
    context_switch(main_thread, other_thread);
    cout << "Cool, I'm back in main()!" << endl;
    return 0;
}

// Trace each step and state the output:`,
            solution: `// Step 1: main() starts executing.
//   create_thread(other_func) sets up other_thread's stack
//   with a fake saved state. The "return address" on the stack
//   is the address of other_func.
//   No output yet.

// Step 2: main() prints "Hello, world!  I am the main thread"
//   OUTPUT: "Hello, world!  I am the main thread"

// Step 3: main() calls context_switch(main_thread, other_thread)
//   → Push main's registers onto main's stack
//   → Save main's %rsp into main_thread.saved_rsp
//   → Load other_thread.saved_rsp into %rsp
//   → Pop fake registers from other_thread's stack
//   → ret pops the address of other_func → jump to other_func!

// Step 4: Now executing in other_func()!
//   Prints "Howdy! I am another thread."
//   OUTPUT: "Howdy! I am another thread."

// Step 5: other_func() calls context_switch(other_thread, main_thread)
//   → Push other's registers onto other's stack
//   → Save other's %rsp into other_thread.saved_rsp
//   → Load main_thread.saved_rsp into %rsp
//   → Pop main's registers from main's stack
//   → ret pops main's return address → resume in main()!

// Step 6: Back in main(), right after context_switch returned.
//   Prints "Cool, I'm back in main()!"
//   OUTPUT: "Cool, I'm back in main()!"

// Step 7: main() calls return 0;
//   Program exits. "We will never reach this line :(" never prints.

// FULL OUTPUT:
//   Hello, world!  I am the main thread
//   Howdy! I am another thread.
//   Cool, I'm back in main()!`,
            explanation: "The key is that context_switch saves the current thread's state and loads the other thread's state. For a new thread, ret jumps to the start of its function. For an existing thread, ret resumes where it previously called context_switch."
        },
        {
            id: "ex3",
            title: "Context Switch Practice: Output Tracing",
            difficulty: "medium",
            description: "What is the output of this program? Trace through each context_switch carefully.",
            starterCode: `Thread main_thread;
Thread other_thread;

void other_func() {
    context_switch(other_thread, main_thread);
    cout << "D" << endl;
    context_switch(other_thread, main_thread);
    cout << "A" << endl;
}

int main(int argc, char *argv[]) {
    other_thread = create_thread(other_func);
    cout << "B" << endl;
    context_switch(main_thread, other_thread);
    cout << "C" << endl;
    context_switch(main_thread, other_thread);
    return 0;
}

// What is the output? Trace each step.`,
            solution: `// Step 1: main() creates other_thread. No output.

// Step 2: main() prints "B"
//   OUTPUT: B

// Step 3: main() calls context_switch(main, other)
//   → Saves main state, loads other state
//   → other_thread is NEW → ret jumps to START of other_func

// Step 4: other_func() starts executing.
//   FIRST line is context_switch(other, main)!
//   → Saves other state, loads main state
//   → Resumes main() after its context_switch

// Step 5: Back in main(). Prints "C"
//   OUTPUT: C

// Step 6: main() calls context_switch(main, other) (second time)
//   → Saves main, loads other
//   → other_thread already ran before → resume where it left off
//   → It left off after the FIRST context_switch in other_func

// Step 7: other_func() resumes after first context_switch. Prints "D"
//   OUTPUT: D

// Step 8: other_func() calls context_switch(other, main) (second time)
//   → Saves other, loads main
//   → Resumes main() after its SECOND context_switch

// Step 9: main() reaches return 0; Program exits.
//   "A" never prints — no one switches back to other_func!

// FINAL OUTPUT:
// B
// C
// D`,
            explanation: "Answer: BCD. The tricky part: other_func starts with a context_switch, so it immediately switches back to main. When switched to a second time, it resumes AFTER that first context_switch and prints 'D'. 'A' never prints because main exits before switching back a third time."
        },
        {
            id: "ex4",
            title: "PCB and Thread State",
            difficulty: "medium",
            description: "For each item below, determine whether it is stored in the PCB (process-level), in the individual thread state, or on the thread's stack.",
            starterCode: `// Where is each item stored?
// Options: PCB (process-level), Thread State (PCB per-thread), Thread Stack

// 1. The process's file descriptor table
// 2. The saved %rsp when a thread is not running
// 3. The saved %rbx register when a thread is not running
// 4. Information about the process's virtual memory layout
// 5. The return address for the function a thread was executing
// 6. Local variables of a function the thread was running
// 7. The process ID (PID)`,
            solution: `// 1. File descriptor table → PCB (process-level)
//    All threads in a process share the same open files.
//    Stored once in the PCB, not per-thread.

// 2. Saved %rsp → Thread State (in PCB, per-thread)
//    Each thread has its own stack pointer.
//    Stored in the per-thread state section of the PCB.
//    This is the saved_rsp field in our Thread struct.

// 3. Saved %rbx → Thread's Stack
//    During context_switch, %rbx is pushed onto the
//    thread's stack (along with other callee-saved regs).
//    It's NOT stored in the PCB directly.

// 4. Virtual memory layout → PCB (process-level)
//    All threads share the same address space.
//    Stored once at the process level.

// 5. Return address → Thread's Stack
//    The callq instruction pushes the return address
//    onto the thread's stack. It's part of the stack
//    frame, not stored separately.

// 6. Local variables → Thread's Stack
//    Each thread has its own stack, and local variables
//    live on the stack in that function's stack frame.

// 7. Process ID → PCB (process-level)
//    The PID identifies the process. Stored once in
//    the PCB. All threads in the process share it.`,
            explanation: "Key distinction: process-level info (memory, FDT, PID) is stored once in the PCB and shared by all threads. The saved %rsp is stored per-thread in the PCB's thread state section. All other saved registers, return addresses, and local variables are stored on each thread's individual stack."
        },
        {
            id: "ex5",
            title: "Design: Setting Up a New Thread's Stack",
            difficulty: "hard",
            description: "Suppose we want to create a thread that runs a function `void greet(const char* name)` with the argument \"Alice\". How would you modify create_thread to support functions with arguments?",
            starterCode: `// Current create_thread only supports void (*func)() — no arguments.
// How would you set up the stack so that greet("Alice") runs?
//
// Hint: In x86-64, the first argument is passed in register %rdi.
// Think about what the stack and saved state need to look like
// when context_switch runs ret to start this new thread.
//
// The current fake stack layout for no-arg functions:
// stack_top:  [func address]      ← ret pops this
//             [fake %rbp]
//             [fake %rbx]
//             [fake %r12]
//             [fake %r13]
//             [fake %r14]
//             [fake %r15]         ← saved_rsp points here
//
// What needs to change to pass an argument?`,
            solution: `// KEY INSIGHT: In x86-64, the first argument to a function
// is passed in register %rdi. During context_switch, we pop
// saved register values off the stack. If we can arrange for
// the "fake %rdi" value to be the argument we want, then when
// the new thread starts, it will have the argument in %rdi!
//
// BUT WAIT: context_switch only saves callee-saved registers
// (%rbp, %rbx, %r12-%r15). %rdi is caller-saved, so it's NOT
// in the push/pop list!
//
// SOLUTION 1: Use a wrapper function
// Instead of starting the thread directly at greet(), start it
// at a wrapper that calls greet() with the argument:

static const char* saved_name;  // store arg somewhere accessible

void greet_wrapper() {
    greet(saved_name);  // call greet with the saved argument
}

// Then: create_thread(greet_wrapper);
// But this is hacky and not thread-safe!

// SOLUTION 2: Add %rdi to the saved register list
// Modify context_switch to also push/pop %rdi:
//   pushq %rdi; ... popq %rdi
// Then in create_thread, the "fake %rdi" slot on the stack
// would contain the argument value (pointer to "Alice").
// Now kNumRegistersToSave = 7.

// SOLUTION 3 (Best): Use a trampoline function
// Set up the stack so that the new thread first goes through
// a "trampoline" that sets up arguments and then calls the
// real function. This is what real OS implementations do!
// The trampoline reads the function pointer and argument from
// a known location (e.g., stored in one of the callee-saved
// registers like %r12 and %r13).

// This is a real design challenge in OS development!
// assign5 will involve thinking about similar problems.`,
            explanation: "The core challenge is that %rdi (the argument register) is not part of the callee-saved set that context_switch normally saves. Real OSes use trampoline functions: set up callee-saved registers to hold the function pointer and argument, and make the initial 'return address' point to a trampoline that moves these into the right places and calls the real function."
        }
    ]
};

export default lecture17;
