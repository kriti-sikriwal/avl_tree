# Adaptive AVL Tree for Real-Time Data Management

## Overview

The Adaptive AVL Tree for Real-Time Data Management is a C-based project that extends the traditional AVL Tree by tracking how frequently data is accessed.

A normal AVL Tree maintains balance using rotations based on the height of its left and right subtrees. This project adds an access-frequency mechanism so that the system can identify frequently searched nodes and, when possible, move them closer to the root while still maintaining the AVL balance property.

The project is designed as an academic prototype for demonstrating how a traditional data structure can adapt according to changing data-access patterns.

---

## Problem Statement

In real-time data management systems, some data may be accessed much more frequently than other data.

A traditional AVL Tree maintains structural balance, but it does not consider how frequently individual nodes are accessed.

For example, if a particular record is searched many times while another record is rarely accessed, a normal AVL Tree does not use this access information when deciding the structure of the tree.

The proposed Adaptive AVL Tree monitors access frequency and attempts to improve the position of frequently accessed nodes while preserving AVL balance.

---

## Objectives

- Maintain the height-balanced property of an AVL Tree.
- Track the access frequency of each node.
- Identify highly accessed nodes based on recent search activity.
- Adapt the tree structure when a valid AVL-preserving restructuring is possible.
- Maintain persistent data and total access frequency between program executions.

---

## Key Features

- AVL Tree insertion, searching and deletion
- Duplicate-key prevention
- LL, RR, LR and RL rotations
- Access-frequency tracking (total and per monitoring window)
- Search-cost display (number of steps taken by each search)
- Adaptive restructuring that preserves AVL balance
- Persistent data storage in a text file
- Tree reconstruction when the program starts
- Display of node access statistics

---

## How the Adaptive Mechanism Works

The system uses a monitoring window of **10 search operations** (`SEARCH_LIMIT`).

During each monitoring window:

1. Every successful search increases the node's total access frequency.
2. The same search also increases its frequency within the current monitoring window.
3. After 10 search operations, the system analyzes the nodes accessed during that window.
4. A node is considered highly accessed when its window frequency is greater than 5 (`FREQUENCY_THRESHOLD`).
5. If multiple nodes qualify, the node with the highest window frequency receives priority.
6. The system checks whether a valid AVL-preserving restructuring can improve the position of that node.
7. If the restructuring is safe, the node is rotated above its parent, moving it one level closer to the root.
8. If no valid restructuring is possible, the tree remains unchanged.
9. The monitoring window is then reset and a new 10-search window begins.

### Safety rule

Before any rotation, the program checks the result using only the stored node heights. A rotation is performed only if:

- both nodes affected by the rotation remain balanced (balance factor of -1, 0 or +1), and
- the height of the rotated subtree does not change, so no ancestor can be affected.

If either condition fails, the tree is not modified. The system never performs a restructuring that violates the AVL balance property, and BST ordering is always preserved.

---

## Access Frequency

Each AVL node maintains two frequency values:

### Total Frequency

The total frequency represents the accumulated number of successful searches for that node across program executions.

This value is stored in the persistent data file.

### Window Frequency

The window frequency represents the number of times the node has been searched during the current 10-search monitoring window.

After the monitoring window is analyzed, the window frequency is reset for the next monitoring period. It also starts at 0 every time the program starts.

Example:

```text
Key: 34 | Total: 12 | Window: 4
```

---

## Project Structure

```text
Adaptive-AVL-Tree/
├── src/
│   └── adaptive_avl.c
├── data/
│   └── avl_data.txt
├── README.md
└── .gitignore
```

---

## How to Compile and Run

From the project root:

```bash
gcc -Wall -o adaptive_avl src/adaptive_avl.c
./adaptive_avl        # Windows PowerShell: .\adaptive_avl.exe
```

The `data/` folder must exist. If `data/avl_data.txt` is missing or empty, the program starts with an empty tree.

---

## Menu

1. Insert Node
2. Search Node
3. Delete Node
4. Display Inorder
5. Display Tree
6. Display Frequencies
7. Save Data
8. Exit

---

## Data File Format

`data/avl_data.txt` stores one node per line:

```text
key totalFrequency windowFrequency
```

Example:

```text
10 4 0
20 0 0
30 4 0
40 6 0
50 6 0
```

On startup the tree is rebuilt by inserting the saved keys and restoring `totalFrequency`. Every run starts with a fresh 10-search window. The data is saved after insertion, successful search, deletion, adaptive restructuring, explicit Save, and exit.

---

## Example

Insert 10, 20, 30, 40, 50. The tree is balanced with 20 at the root and 40 at depth 2. Search 40 six times and 10 four times. The 10th search triggers the adaptive check:

```text
Node 40 found in 2 step(s). Total: 6 | Window: 6 | Searches in window: 6/10
...
================================
ADAPTIVE CHECK
================================
10 search operations completed.

Highest accessed node: 40
Window frequency: 6

Node 40 is highly accessed.
Checking for AVL-preserving restructuring...
Adaptive restructuring performed: node 40 moved one level closer to the root.

Starting new 10-search window.
```

Searching 40 again now takes **1 step instead of 2**:

```text
Node 40 found in 1 step(s). Total: 7 | Window: 1 | Searches in window: 1/10
```

The trade-off is that other nodes can move slightly deeper. In this example, node 10 now takes 3 steps instead of 2. Frequently used keys become cheaper to reach, and rarely used keys may cost a little more.

---

## Limitations

- Only the keys and frequencies are saved. The tree shape is rebuilt on each start, so adaptive restructuring applies within a run.
- A node moves at most one level per 10-search window, and only when the rotation keeps the AVL property.
- Some valid rotations are refused because they change the subtree height.
- The whole data file is rewritten after each update.

---

## Future Work

- Benchmark the average search steps with adaptation ON versus OFF on a skewed workload.
- A web-based visualizer that shows frequently accessed nodes moving up the tree.