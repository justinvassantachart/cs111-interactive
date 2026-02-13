export const assign0 = {
    id: 'a0',
    type: 'assignment',
    title: "Getting Started",
    subtitle: "Assignment 0 — GDB Debugging, C++ Classes, and STL Maps",
    keyTakeaway: "Assignment 0 introduces the CS111 toolchain: using GDB to find bugs, implementing a C++ class with encapsulation, and using STL maps to build data structures. The key skill is debugging systematically with breakpoints and stepping, rather than guessing.",

    sections: [
        {
            id: "overview",
            title: "Assignment 0 Overview",
            content: `Assignment 0 had three main exercises: debugging a buggy C program with **GDB**, implementing a **Movie class** in C++, and building a **movie credits** map. This assignment ensured everyone was comfortable with the development tools and C/C++ fundamentals before diving into OS-level systems programming.`,
            keyPoints: [
                "Exercise 2: Use GDB to find and diagnose a bug in buggy.c",
                "Exercise 4: Implement a Movie class with add/remove/query operations",
                "Exercise 5: Build a movie map and handle duplicate movie names",
                "Key skill: systematic debugging with GDB (break, run, next, print)",
                "Key skill: C++ class design with private data and public methods"
            ]
        },
        {
            id: "buggy-c",
            title: "Exercise 2: Debugging buggy.c",
            content: `The first coding exercise involved finding a crash in **buggy.c** using GDB. The program processes command-line arguments, printing how many blocks of BLOCK_SIZE characters each argument contains. It crashes on certain inputs, and the task was to use GDB commands (break, run, next, print) to identify the exact crashing line and the value of the loop variable.`,
            keyPoints: [
                "The crash occurs in the lastN function on the strcpy line",
                "GDB workflow: gdb ./buggy → break buggy.c:33 → run hello cs111! → next",
                "The variable i = 2 when the crash occurs (processing 'cs111!')",
                "strcpy is dangerous — it doesn't check buffer sizes",
                "GDB's 'print' command shows variable values at any point during execution"
            ],
            codeExample: {
                title: "buggy.c — A program with a subtle crash",
                language: "c",
                code: `/* File: buggy.c
 * --------------
 * For each command line argument, this program prints out the number of blocks
 * of BLOCK_SIZE characters in that argument, along with what the last block
 * is.  If an argument isn't a multiple of BLOCK_SIZE characters long, it
 * prints a message to that effect instead.  For instance, if you run
 *
 *  ./buggy hello cs111!
 *
 * It will print that hello is not a multiple of 3 characters, and will print
 * that cs111! is 2 blocks of 3 characters long, the last of which is '11!'.
 *
 * However, there is a bug in the implementation below...
 */

#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#define BLOCK_SIZE 3


/* FUNCTION: lastN
 * ------------------
 * This function takes in a string 'input' (assumed non-empty) and gets
 * just its last n characters (plus the null terminator), and copies them
 * into 'last', which is assumed to be a memory space large enough to
 * store them.  Then it returns the number of blocks of n characters
 * in 'input'.  If if the length of 'input' isn't a multiple of n,
 * this function does nothing and returns -1.
 */
int lastN(const char *input, char *last, int n) {
    if (strlen(input) % n != 0) {
        return -1;
    }

    strcpy(last, input + strlen(input) - n);
    return strlen(input) / n;
}

int main(int argc, const char *argv[]) {
    // Test on each argument specified by the user
    for (int i = 1; i < argc; i++) {
        char buf[BLOCK_SIZE + 1];
        int num_blocks_of_N = lastN(argv[i], buf, BLOCK_SIZE);
        if (num_blocks_of_N == -1) {
            printf("'%s' isn't a multiple of %d characters long\\n", argv[i], BLOCK_SIZE);
        } else {
            printf("'%s' contains %d blocks of %d characters; the last one is '%s'\\n",
                argv[i], num_blocks_of_N, BLOCK_SIZE, buf);
        }
    }

    return 0;
}`,
                annotations: [
                    { match: "BLOCK_SIZE 3", explanation: "The block size is 3 characters. Arguments whose length is a multiple of 3 will be processed; others print 'isn't a multiple' message." },
                    { match: "lastN(const char *input, char *last, int n)", explanation: "Takes a string, extracts the last n characters into 'last', and returns the total number of n-character blocks. Returns -1 if length isn't a multiple of n." },
                    { match: "strlen(input) % n != 0", explanation: "Guards against strings whose length isn't divisible by the block size. 'hello' has 5 characters, 5 % 3 ≠ 0, so it returns -1." },
                    { match: "strcpy(last, input + strlen(input) - n)", explanation: "This copies the last n characters into 'last'. The pointer arithmetic (input + strlen - n) points to n characters before the end. strcpy copies until it finds '\\0'." },
                    { match: "char buf[BLOCK_SIZE + 1]", explanation: "Buffer of size 4 (3 chars + null terminator). This is passed to lastN as the 'last' parameter." },
                    { match: "lastN(argv[i], buf, BLOCK_SIZE)", explanation: "Calls lastN for each command-line argument. With './buggy hello cs111!', argv[1]='hello' and argv[2]='cs111!'." }
                ]
            }
        },
        {
            id: "movie-class",
            title: "Exercise 4: The Movie Class",
            content: `The main exercise was implementing a **Movie** class in C++. The class stores a movie name and its cast (actor name → role mapping). It uses a \`std::map\` internally to store actor-role pairs, with methods to add, remove, and query actors. This exercise practices encapsulation and the interface/implementation separation pattern.`,
            keyPoints: [
                "Movie class has a private std::map<string, string> for actor→role mapping",
                "add_actor returns false if the actor already exists (no duplicates)",
                "remove_actor does nothing if the actor isn't in the movie (safe)",
                "get_part_for_actor returns empty string if actor not found",
                "get_num_actors and get_name are const methods — they don't modify state"
            ],
            codeExample: {
                title: "movie.hh — The Movie class interface",
                language: "cpp",
                code: `#include <string>
#include <map>

// A Movie encapsulates information about a movie like its name and its cast.
class Movie {
public:

    // Construct a Movie by specifying the movie name
    Movie(const std::string& name);

    /* This method takes in the name of an actor and their role / part in the movie.
     * If this actor is not already in the movie, it stores this information internally
     * and returns true.  If this actor is already in the movie, it should not change
     * the internal state and instead should return false.
     */
    bool add_actor(const std::string& actor_name, const std::string& part);

    /* This method takes in the name of an actor and removes them from the movie.
     * If the actor is not in the movie, this method does nothing.
     */
    void remove_actor(const std::string& actor_name);

    /* This method returns the part / role this actor has in this movie, or the empty
     * string ("") if they are not in the movie.
     */
    std::string get_part_for_actor(const std::string& actor_name);

    // Returns the number of actors currently in the movie.
    int get_num_actors() const;

    // Returns the name of the movie
    std::string get_name() const;

private:
    std::string movie_title;
    std::map<std::string, std::string> actors;
};`,
                annotations: [
                    { match: "Movie(const std::string& name)", explanation: "Constructor takes the movie name by const reference (avoids copying the string). Initializes movie_title." },
                    { match: "bool add_actor", explanation: "Returns true on success (new actor added), false if actor already exists. The 'const std::string&' parameters avoid unnecessary string copies." },
                    { match: "void remove_actor", explanation: "Returns void because removal is always 'safe' — removing a non-existent actor is a no-op, not an error." },
                    { match: "get_num_actors() const", explanation: "The 'const' means this method promises not to modify any member variables. This allows it to be called on const Movie references." },
                    { match: "std::map<std::string, std::string> actors", explanation: "Private member: maps actor names to their roles. Using std::map gives O(log n) lookup, insertion, and deletion." }
                ]
            }
        },
        {
            id: "movie-impl",
            title: "Movie Class Implementation",
            content: `The implementation uses **std::map** methods like \`contains()\`, \`erase()\`, and bracket operator \`[]\` for insertion and lookup. The key design decision is that \`add_actor\` checks for duplicates before inserting, and \`get_part_for_actor\` returns an empty string (not an error) when the actor is not found.`,
            codeExample: {
                title: "movie.cc — The Movie class implementation",
                language: "cpp",
                code: `/* This file includes the implementation of the Movie class. */

#include "movie.hh"

using namespace std;

Movie::Movie(const string& name) {
    movie_title = name;
}

bool Movie::add_actor(const string& actor_name, const string& movie_part) {
    if (actors.contains(actor_name)) {
        return false;
    }
    actors[actor_name] = movie_part;
    return true;
}

void Movie::remove_actor(const string& actor_name) {
    actors.erase(actor_name);
}

string Movie::get_part_for_actor(const string& actor_name) {
    if (actors.contains(actor_name)) {
        return actors[actor_name];
    } else {
        return "";
    }
}

int Movie::get_num_actors() const {
    return actors.size();
}

string Movie::get_name() const {
    return movie_title;
}`,
                annotations: [
                    { match: "movie_title = name", explanation: "Constructor body assigns the name parameter to the private member. Could also use an initializer list: Movie::Movie(const string& name) : movie_title(name) {}" },
                    { match: "actors.contains(actor_name)", explanation: "C++20 contains() checks if a key exists in the map. Returns true/false. This is cleaner than checking count() or find()." },
                    { match: "actors[actor_name] = movie_part", explanation: "Bracket operator inserts a new key-value pair (or overwrites if key exists). We only reach this line after confirming the actor doesn't exist yet." },
                    { match: "actors.erase(actor_name)", explanation: "Removes the entry with this key. If the key doesn't exist, erase() does nothing (no error). This is why remove_actor works safely even for nonexistent actors." },
                    { match: "actors.size()", explanation: "Returns the number of entries in the map. Since each actor has exactly one entry, this equals the number of actors." }
                ]
            }
        },
        {
            id: "moviecredits",
            title: "Exercise 5: Movie Credits Map",
            content: `The final exercise involved building a map from movie names to their cast lists, with special handling for **duplicate movie names**. If two movies share the same title but different years, the duplicate gets its year appended as "Movie (Year)". The exercise also required iterating over the map and printing each movie's cast.`,
            codeExample: {
                title: "moviecredits.cc — Building and printing a movie map",
                language: "cpp",
                code: `/* File: moviecredits.cc
 * ----------------------
 * This file constructs and prints out a map from movie names to their cast.
 */

#include <iostream>
#include <vector>
#include <map>

using namespace std;

typedef struct {
    string title;
    int year;
    vector<string> cast;
} Movie;

/* This function takes in a vector of Movie structs and an empty movie map,
 * and fills in the movie map with entries where the key is the name of the movie,
 * and the value is a vector of its cast members.  The map is populated in order
 * of the movies in the provided vector - if we later encounter a movie with the
 * same name as one we already saw, we add it to the map with its year
 * as part of its name (e.g. "Movie (Year)") to disambiguate.
 */
void build_movie_map(const vector<Movie>& movies, map<string, vector<string>>& movie_map) {
    for (int i = 0; i < movies.size(); i++) {
        Movie movie = movies[i];
        string movie_title = movies[i].title;
        if (movie_map.contains(movie_title)) { // the map exists
            movie_title = movie_title + " (" + to_string(movie.year) + ")";
        }
        movie_map[movie_title] = movie.cast;
    }
}

int main(int argc, char *argv[]) {
    // ... (argument parsing and loading omitted)

    map<string, vector<string>> movie_map;
    build_movie_map(movies, movie_map);
    cout << "Constructed map with " << movie_map.size() << " entries" << endl;

    // Print out the contents of the map, in order
    for (const auto& [movie_title, cast] : movie_map) {
        cout << "'" + movie_title + "': ";
        for (int i = 0; i < cast.size() - 1; i++) {
            cout << cast[i] + ", ";
        }
        cout << cast[cast.size() - 1] << endl;
    }

    return 0;
}`,
                annotations: [
                    { match: "typedef struct", explanation: "Defines a Movie struct with title, year, and cast vector. This is a C-style struct definition wrapped in typedef for cleaner usage." },
                    { match: "movie_map.contains(movie_title)", explanation: "Checks if this movie title already exists in the map. If it does, we have a duplicate name and need to disambiguate." },
                    { match: "movie_title + \" (\" + to_string(movie.year) + \")\"", explanation: "When a duplicate is found, append the year in parentheses. E.g., 'Movie2' becomes 'Movie2 (2002)' to distinguish from the original." },
                    { match: "movie_map[movie_title] = movie.cast", explanation: "Inserts the movie into the map. The bracket operator creates a new entry or overwrites an existing one." },
                    { match: "const auto& [movie_title, cast]", explanation: "C++17 structured bindings with auto type deduction. Iterates over the map in alphabetical order (std::map is always sorted by key)." },
                    { match: "cast[cast.size() - 1]", explanation: "Prints the last actor without a trailing comma. The loop above prints all actors except the last with ', ' after each." }
                ]
            }
        },
        {
            id: "summary",
            title: "Assignment 0 Summary",
            content: `Assignment 0 established the foundations for CS111: GDB debugging skills, C++ class design with encapsulation, and STL map usage. The Movie class demonstrates the interface/implementation pattern (movie.hh vs. movie.cc) that appears throughout the course. The moviecredits exercise practices working with maps and handling edge cases.`,
            keyPoints: [
                "GDB: break, run, next, step, print — systematic debugging beats guessing",
                "C++ classes: public interface (.hh) + private implementation (.cc)",
                "std::map: contains(), erase(), [] operator, structured binding iteration",
                "Handle edge cases: duplicate keys, missing entries, empty strings",
                "const correctness: mark methods that don't modify state as const"
            ]
        }
    ],

    exercises: [
        {
            id: "ex1",
            title: "Movie Class Edge Cases",
            difficulty: "easy",
            description: "Review the Movie class and predict the output of this test sequence.",
            hint: "Track the internal state of the actors map after each operation.",
            starterCode: `Movie m("TestMovie");
m.add_actor("Alice", "Lead");     // returns: ____
m.add_actor("Bob", "Villain");    // returns: ____
m.add_actor("Alice", "Extra");    // returns: ____
m.get_num_actors();               // returns: ____
m.get_part_for_actor("Alice");    // returns: ____
m.remove_actor("Charlie");        // (what happens?) ____
m.get_num_actors();               // returns: ____`,
            solution: `Movie m("TestMovie");
m.add_actor("Alice", "Lead");     // returns: true (new actor)
m.add_actor("Bob", "Villain");    // returns: true (new actor)
m.add_actor("Alice", "Extra");    // returns: false (Alice already exists!)
m.get_num_actors();               // returns: 2 (Alice + Bob)
m.get_part_for_actor("Alice");    // returns: "Lead" (original role preserved)
m.remove_actor("Charlie");        // (nothing — Charlie not in movie, safe no-op)
m.get_num_actors();               // returns: 2 (unchanged — Charlie wasn't there)`,
            explanation: "add_actor returns false and does NOT update the role when an actor already exists. remove_actor on a non-existent actor is a safe no-op. These behaviors are specified in the interface."
        }
    ]
};

export default assign0;
