export const section4 = {
    id: 's4',
    type: 'section',
    title: "Multithreading & Synchronization",
    subtitle: "Section 4 — Threads, Mutexes, and the News Aggregator",
    keyTakeaway: "Threads share a process's memory space, making them lightweight but dangerous — any shared data must be protected with mutexes. A mutex declared inside a function (local scope) is a bug because each thread gets its own copy, providing zero protection.",

    sections: [
        {
            id: "overview",
            title: "Section 4 Overview",
            content: `Section 4 introduced **multithreading** — running multiple threads of execution within a single process. Unlike fork() which creates a separate process with its own address space, threads share memory. This makes them faster but also introduces **race conditions** when multiple threads access the same data. We worked on a news aggregator that downloads articles in parallel using threads.`,
            keyPoints: [
                "Threads share the same address space (heap, globals) — unlike processes",
                "std::thread creates a new thread that runs a given function",
                "thread.join() waits for a thread to finish (like waitpid for processes)",
                "Race condition: when multiple threads read/write shared data without synchronization",
                "mutex.lock() / mutex.unlock() ensures only one thread accesses critical section at a time"
            ]
        },
        {
            id: "news-aggregator",
            title: "The News Aggregator Program",
            content: `The news aggregator fetches articles from RSS feeds and lets the user search them. The sequential version downloads each article one at a time, which is slow. We converted it to use **multithreading** — each article is fetched in its own thread. However, all threads write to a shared \`database\` map, so we need a **mutex** to prevent data corruption.`,
            keyPoints: [
                "Each article is downloaded in its own thread for parallelism",
                "All threads write to a shared map<Article, vector<string>> — a race condition!",
                "A mutex must protect the shared database from concurrent writes",
                "threads are created with std::thread and stored in a vector",
                "All threads must be joined before using the database"
            ],
            codeExample: {
                title: "news-aggregator.cc — Multithreaded article fetching (with a critical bug!)",
                language: "cpp",
                code: `/* Program: news-aggregator
 * This program can be run with a specified file of RSS Feeds, and
 * will download all the articles in those feeds and allow the user
 * to do keyword searches through them.  The current version of the
 * program downloads each article sequentially, but we can use
 * multithreading to have each article downloaded in its own thread,
 * dramatically improving performance.
 */
#include <iostream>
#include <vector>
#include <map>
#include <thread>
#include <mutex>

#include "news-manager.hh"
#include "article.h"
#include "ostreamlock.h"

using namespace std;

// This function downloads the contents of a single article and adds it to the database map.
void fetchArticle(const Article& article, const NewsManager& nm, map<Article, vector<string>>& database) {
    cout << oslock << "Fetching " << article.url << "..." << endl << osunlock;
    vector<string> articleContents = nm.fetchArticleContents(article);

    mutex m;
    m.lock();
    database[article] = articleContents;
    m.unlock();
}

int main(int argc, char *argv[]) {
    // The user must specify one argument, the name of the RSSFeedList file
    if (argc != 2) {
        cerr << "ERROR: please specify an RSSFeedList" << endl;
        return 1;
    }

    // Construct our collection of article -> article words ("tokens")
    map<Article, vector<string>> database;

    // A NewsManager can get a list of articles, download a single article, and search articles
    NewsManager nm(argv[1]);

    // An article is a struct that has a title and url field
    vector<Article> articles = nm.getArticleTitlesAndURLs();
    vector<thread> articleThreads;

    for (int i = 0; i < articles.size(); i++) {
        articleThreads.push_back(thread(fetchArticle, ref(articles[i]), ref(nm),  ref(database)));
    }

    for (int i = 0; i < articles.size(); i++) {
        articleThreads[i].join();
    }

    nm.handleUserQueries(database);
    return 0;
}`,
                annotations: [
                    { match: "oslock", explanation: "oslock/osunlock are CS111-provided stream locks that prevent cout output from different threads from being interleaved. Without them, you'd see garbled output like 'FetFechtcinhging...'." },
                    { match: "nm.fetchArticleContents(article)", explanation: "Downloads the article contents from the web. This is the slow part — it blocks while waiting for the network response. Running this in threads parallelizes the downloads." },
                    { match: "mutex m;", explanation: "🐛 BUG! This mutex is declared as a LOCAL variable inside the function. Each thread gets its own copy on its own stack. Since no two threads share this mutex, it provides ZERO protection. The fix: make the mutex a global or pass it by reference." },
                    { match: "m.lock()", explanation: "Acquires the mutex. If another thread holds it, this thread blocks until it's released. But since 'm' is local, each thread has its own mutex, so nobody ever blocks — the race condition is NOT fixed!" },
                    { match: "database[article] = articleContents", explanation: "Writing to the shared map. Without proper synchronization, two threads could modify the map's internal data structure simultaneously, corrupting it. This is a race condition." },
                    { match: "ref(articles[i])", explanation: "std::ref creates a reference wrapper. Without it, the thread constructor would copy the Article, but we want to pass a reference to avoid unnecessary copies." },
                    { match: "ref(database)", explanation: "Passes the database map by reference so all threads write to the SAME map. This is what makes synchronization necessary — they all share this data." },
                    { match: "articleThreads[i].join()", explanation: "Blocks until thread i finishes. We must join all threads before using the database, otherwise we might read incomplete data. Failing to join a thread before it goes out of scope crashes the program." }
                ]
            }
        },
        {
            id: "mutex-bug",
            title: "The Local Mutex Bug",
            content: `The most important lesson from this section is the **local mutex bug**. Declaring a mutex as a local variable inside a function that's called by multiple threads means each thread gets its own private mutex on its own stack. No two threads ever contend for the same lock, so the critical section is completely unprotected. The fix is to make the mutex either a global variable or pass it by reference.`,
            keyPoints: [
                "A local mutex is useless — each thread gets its own copy",
                "Threads have independent stacks but share heap and global memory",
                "Fix #1: Make the mutex a global variable (all threads see the same one)",
                "Fix #2: Pass the mutex by reference (std::ref) to the thread function",
                "This bug compiles and runs without errors — it's a silent data corruption bug"
            ],
            codeExample: {
                title: "Local mutex (broken) vs. shared mutex (correct)",
                language: "cpp",
                code: `// ❌ BROKEN — local mutex, each thread has its own!
void fetchArticle_broken(/* ... */, map<Article, vector<string>>& database) {
    vector<string> contents = nm.fetchArticleContents(article);
    mutex m;          // ← Each thread creates its own mutex!
    m.lock();         // ← Only locking YOUR OWN mutex
    database[article] = contents;
    m.unlock();
}

// ✅ FIXED — mutex is shared (global or passed by reference)
mutex databaseMutex;  // Global — all threads see the same one

void fetchArticle_fixed(/* ... */, map<Article, vector<string>>& database) {
    vector<string> contents = nm.fetchArticleContents(article);
    databaseMutex.lock();   // ← All threads contend for SAME lock
    database[article] = contents;
    databaseMutex.unlock();
}

// ✅ ALSO FIXED — pass mutex by reference
void fetchArticle_also_fixed(/* ... */, map<Article, vector<string>>& database,
                              mutex& m) {
    vector<string> contents = nm.fetchArticleContents(article);
    m.lock();
    database[article] = contents;
    m.unlock();
}`,
                annotations: [
                    { match: "mutex m;          // ← Each thread creates its own mutex!", explanation: "Stack-allocated (local) variables are thread-private. Each thread's stack frame has its own copy of 'm'. Thread A's m.lock() doesn't block thread B because they're different mutexes." },
                    { match: "mutex databaseMutex;  // Global", explanation: "Global variables live in the data segment, which is shared by all threads. All threads see and use the SAME mutex object, so lock() actually provides mutual exclusion." },
                    { match: "mutex& m", explanation: "Passing by reference means all threads receive a reference to the SAME mutex object. This is equivalent to using a global but more modular." }
                ]
            }
        },
        {
            id: "thread-basics",
            title: "Thread Basics",
            content: `C++ threads are created with **std::thread**, joined with **.join()**, and synchronized with **std::mutex**. Unlike processes, threads share all memory except their stack. This makes inter-thread communication trivial (just use shared variables) but synchronization essential.`,
            keyPoints: [
                "std::thread t(function, arg1, arg2...) — creates and starts a new thread",
                "t.join() — blocks until thread t finishes (mandatory before destruction)",
                "Threads share: heap, global data, code segment, file descriptors",
                "Threads don't share: stack (each thread has its own call stack)",
                "mutex.lock() → critical section → mutex.unlock()",
                "Race condition = bug where outcome depends on thread scheduling order"
            ],
            diagram: `
Threads vs. Processes — Memory Sharing:

PROCESSES (fork):                    THREADS (std::thread):
┌──────────┐ ┌──────────┐          ┌─────────────────────────┐
│ Process A│ │ Process B│          │      Single Process      │
│          │ │          │          │                          │
│ ┌──────┐ │ │ ┌──────┐ │          │ ┌──────┐    ┌──────┐   │
│ │Stack │ │ │ │Stack │ │          │ │Stack │    │Stack │   │
│ │ (own)│ │ │ │ (own)│ │          │ │Thr A │    │Thr B │   │
│ └──────┘ │ │ └──────┘ │          │ └──────┘    └──────┘   │
│ ┌──────┐ │ │ ┌──────┐ │          │ ┌────────────────────┐  │
│ │ Heap │ │ │ │ Heap │ │          │ │   Shared Heap      │  │
│ │ (own)│ │ │ │ (own)│ │          │ │   (ALL threads)    │  │
│ └──────┘ │ │ └──────┘ │          │ └────────────────────┘  │
│ ┌──────┐ │ │ ┌──────┐ │          │ ┌────────────────────┐  │
│ │Global│ │ │ │Global│ │          │ │  Shared Globals    │  │
│ │(own) │ │ │ │(own) │ │          │ │  (ALL threads)     │  │
│ └──────┘ │ │ └──────┘ │          │ └────────────────────┘  │
└──────────┘ └──────────┘          └─────────────────────────┘
  Separate      Separate              Shared everything
  address       address               except stack!
  spaces        spaces
`
        },
        {
            id: "summary",
            title: "Section 4 Summary",
            content: `Section 4 showed how multithreading can dramatically improve performance (parallel downloads) but introduces subtle bugs like race conditions. The key takeaway is that any data shared between threads must be protected by a mutex — and that mutex must itself be shared (not a local variable). These concepts are the foundation for assignment 4 and the concurrency portion of the course.`,
            keyPoints: [
                "Threads share memory → great for performance, dangerous for correctness",
                "Always protect shared data with a mutex",
                "Never use a local mutex — it must be global or passed by reference",
                "Join all threads before accessing their results",
                "A race condition compiles fine and may even work sometimes — it's a silent bug"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Spot the Race Condition",
            difficulty: "medium",
            description: "In the buggy news-aggregator code, explain why the local mutex doesn't prevent the race condition on the database map.",
            hint: "Consider where local variables are stored and what memory threads share vs. don't share.",
            starterCode: `// Why doesn't this mutex protect the database?
void fetchArticle(const Article& article, const NewsManager& nm,
                  map<Article, vector<string>>& database) {
    vector<string> contents = nm.fetchArticleContents(article);
    mutex m;
    m.lock();
    database[article] = contents;
    m.unlock();
}

// Explain the bug:
// ____

// How would you fix it?
// ____`,
            solution: `// Why doesn't this mutex protect the database?
// 
// The mutex 'm' is a LOCAL variable — it's allocated on each
// thread's stack. Since each thread has its own stack, each
// thread creates its OWN private mutex.
//
// Thread A locks Thread A's mutex ← no one else cares
// Thread B locks Thread B's mutex ← no one else cares
// Both threads access database simultaneously → RACE CONDITION!
//
// Fix: make the mutex shared between all threads:
//
// Option 1: Global mutex
// static mutex databaseMutex;  // outside the function
//
// Option 2: Pass by reference
// void fetchArticle(..., mutex& m) {
//     m.lock();
//     database[article] = contents;
//     m.unlock();
// }
// // In main: mutex m; thread(fetchArticle, ..., ref(m));`,
            explanation: "Local variables live on the stack, which is thread-private. A mutex only works when all threads lock/unlock the SAME mutex object. Local mutexes are one of the most common concurrency bugs."
        }
    ]
};

export default section4;
