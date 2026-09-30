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

- AVL Tree insertion
- AVL Tree searching
- AVL Tree deletion
- Duplicate-key prevention
- LL, RR, LR and RL rotations
- Access-frequency tracking
- Monitoring of search activity
- Adaptive restructuring
- AVL balance preservation
- Persistent data storage
- Tree reconstruction when the program starts
- Display of node access statistics

---

## How the Adaptive Mechanism Works

The system uses a monitoring window of **10 search operations**.

During each monitoring window:

1. Every successful search increases the node's total access frequency.
2. The same search also increases its frequency within the current monitoring window.
3. After 10 search operations, the system analyzes the nodes accessed during that window.
4. A node is considered highly accessed when its window frequency is greater than 5.
5. If multiple nodes qualify, the node with the highest window frequency receives priority.
6. The system checks whether a valid AVL-preserving restructuring can improve the position of that node.
7. If the restructuring is safe, the node is moved one level closer to the root.
8. If no valid restructuring is possible, the tree remains unchanged.
9. The monitoring window is then reset and a new 10-search window begins.

The system never performs a restructuring that violates the AVL balance property.

---

## Access Frequency

Each AVL node maintains two frequency values:

### Total Frequency

The total frequency represents the accumulated number of successful searches for that node across program executions.

This value is stored in the persistent data file.

### Window Frequency

The window frequency represents the number of times the node has been searched during the current 10-search monitoring window.

After the monitoring window is analyzed, the window frequency is reset for the next monitoring period.

Example:

```text
Key: 34
Total: 12
Window: 4