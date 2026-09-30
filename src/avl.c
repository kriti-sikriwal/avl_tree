/* Adaptive AVL Tree for Real-Time Data Management */
#include <stdio.h>
#include <stdlib.h>

#define DATA_FILE "data/avl_data.txt"
#define SEARCH_LIMIT 10        /* searches per monitoring window */
#define FREQUENCY_THRESHOLD 5  /* "highly accessed" = windowFrequency > this */

typedef struct Node {
    int key, height;
    int totalFrequency, windowFrequency;
    struct Node *left, *right;
} Node;

Node *root = NULL;

int searchCount = 0;
int steps = 0;

/* ---------- AVL basics ---------- */

int max(int a, int b) { return a > b ? a : b; }
int height(Node *n) { return n ? n->height : 0; }
int getBalance(Node *n) { return n ? height(n->left) - height(n->right) : 0; }
void updateHeight(Node *n) { n->height = 1 + max(height(n->left), height(n->right)); }

Node *createNode(int key) {
    Node *n = calloc(1, sizeof(Node));
    if (!n) { printf("Memory allocation failed.\n"); exit(1); }
    n->key = key;
    n->height = 1;
    return n;
}

Node *rightRotate(Node *y) {
    Node *x = y->left;
    y->left = x->right;
    x->right = y;
    updateHeight(y);
    updateHeight(x);
    return x;
}

Node *leftRotate(Node *x) {
    Node *y = x->right;
    x->right = y->left;
    y->left = x;
    updateHeight(x);
    updateHeight(y);
    return y;
}

/* Updates height and fixes imbalance (used by insert and delete) */
Node *rebalance(Node *n) {
    updateHeight(n);
    int b = getBalance(n);
    if (b > 1) {
        if (getBalance(n->left) < 0) n->left = leftRotate(n->left);
        return rightRotate(n);
    }
    if (b < -1) {
        if (getBalance(n->right) > 0) n->right = rightRotate(n->right);
        return leftRotate(n);
    }
    return n;
}

Node *insert(Node *n, int key) {
    if (!n) return createNode(key);
    if (key < n->key) n->left = insert(n->left, key);
    else n->right = insert(n->right, key);
    return rebalance(n);
}

Node *minValueNode(Node *n) {
    while (n->left) n = n->left;
    return n;
}

Node *deleteNode(Node *n, int key) {
    if (!n) return NULL;
    if (key < n->key) n->left = deleteNode(n->left, key);
    else if (key > n->key) n->right = deleteNode(n->right, key);
    else {
        if (!n->left || !n->right) {
            Node *child = n->left ? n->left : n->right;
            free(n);
            return child;
        }
        Node *s = minValueNode(n->right);   /* inorder successor takes this node's place */
        n->key = s->key;
        n->totalFrequency = s->totalFrequency;
        n->windowFrequency = s->windowFrequency;
        n->right = deleteNode(n->right, s->key);
    }
    return rebalance(n);
}

/* Normal BST search; does NOT change any frequency */
// Node *find(int key) {
//     Node *n = root;
//     while (n && n->key != key) n = key < n->key ? n->left : n->right;
//     return n;
// }


Node *find(int key) {
    Node *n = root;
    steps = 0;
    while (n) {
        steps++;
        if (n->key == key) return n;
        n = key < n->key ? n->left : n->right;
    }
    return NULL;
}

/* Inserts a key if it is not already present; returns its node, or NULL if duplicate */
Node *addKey(int key) {
    if (find(key)) return NULL;
    root = insert(root, key);
    return find(key);
}

/* ---------- Adaptive logic ---------- */

/* Node with the largest windowFrequency (on ties, the one closer to the root wins) */
Node *findHighestFrequency(Node *n) {
    if (!n) return NULL;
    Node *best = n, *l = findHighestFrequency(n->left), *r = findHighestFrequency(n->right);
    if (l && l->windowFrequency > best->windowFrequency) best = l;
    if (r && r->windowFrequency > best->windowFrequency) best = r;
    return best;
}

void resetWindowFrequency(Node *n) {
    if (!n) return;
    n->windowFrequency = 0;
    resetWindowFrequency(n->left);
    resetWindowFrequency(n->right);
}

/* Would rotating child h above its parent p keep the tree AVL?
   After the rotation p gets children (B, C) and h gets children (A, p),
   where A = h's outer subtree, B = h's inner subtree, C = p's other subtree.
   Safe only if both nodes stay balanced AND the subtree height is unchanged,
   so no ancestor can be affected. Nothing is modified here. */
int canPromote(Node *p, Node *h) {
    Node *A = (h == p->left) ? h->left : h->right;
    Node *B = (h == p->left) ? h->right : h->left;
    Node *C = (h == p->left) ? p->right : p->left;
    int newP = 1 + max(height(B), height(C));
    return abs(height(B) - height(C)) <= 1 && abs(height(A) - newP) <= 1
           && 1 + max(height(A), newP) == height(p);
}

/* Rotates the node with 'key' above its parent only if canPromote() allows it.
   Sets *done to 1 when a rotation was performed. */
Node *promote(Node *n, int key, int *done) {
    if (!n) return NULL;
    if (n->left && n->left->key == key) {
        if (!canPromote(n, n->left)) return n;
        *done = 1;
        return rightRotate(n);
    }
    if (n->right && n->right->key == key) {
        if (!canPromote(n, n->right)) return n;
        *done = 1;
        return leftRotate(n);
    }
    if (key < n->key) n->left = promote(n->left, key, done);
    else n->right = promote(n->right, key, done);
    updateHeight(n);
    return n;
}

void saveTree(void);

void adaptiveCheck(void) {
    Node *hot = findHighestFrequency(root);
    printf("\n================================\nADAPTIVE CHECK\n================================\n");
    printf("%d search operations completed.\n\n", searchCount);

    if (hot && hot->windowFrequency > FREQUENCY_THRESHOLD) {
        int key = hot->key, done = 0;
        printf("Highest accessed node: %d\nWindow frequency: %d\n\n", key, hot->windowFrequency);
        printf("Node %d is highly accessed.\nChecking for AVL-preserving restructuring...\n", key);
        root = promote(root, key, &done);
        if (done) printf("Adaptive restructuring performed: node %d moved one level closer to the root.\n", key);
        else printf("No valid adaptive restructuring possible. Tree unchanged.\n");
    } else {
        printf("No node has window frequency > %d. Tree unchanged.\n", FREQUENCY_THRESHOLD);
    }

    resetWindowFrequency(root);
    searchCount = 0;
    saveTree();
    printf("\nStarting new %d-search window.\n", SEARCH_LIMIT);
}

/* ---------- File persistence ---------- */

void writeInorder(FILE *f, Node *n) {
    if (!n) return;
    writeInorder(f, n->left);
    fprintf(f, "%d %d %d\n", n->key, n->totalFrequency, n->windowFrequency);
    writeInorder(f, n->right);
}

void saveTree(void) {
    FILE *f = fopen(DATA_FILE, "w");
    if (!f) { printf("Could not open %s for writing (does the data folder exist?).\n", DATA_FILE); return; }
    writeInorder(f, root);
    fclose(f);
}



void loadTree(void) {
    FILE *f = fopen(DATA_FILE, "r");
    if (!f) return;                                   /* first run: start empty */
    int key, total, window;
    while (fscanf(f, "%d %d %d", &key, &total, &window) == 3) {
        Node *n = addKey(key);
        if (n) {
            n->totalFrequency = total;                /* saved window value is ignored: every run starts a fresh window */
        }
    }
    fclose(f);
}

/* ---------- Display ---------- */

void printInorder(Node *n) {
    if (!n) return;
    printInorder(n->left);
    printf("Key: %d | Total: %d | Window: %d\n", n->key, n->totalFrequency, n->windowFrequency);
    printInorder(n->right);
}

void printTree(Node *n, int level) {   /* sideways: root on the left, right subtree on top */
    if (!n) return;
    printTree(n->right, level + 1);
    printf("%*s%d\n", level * 6, "", n->key);
    printTree(n->left, level + 1);
}

/* ---------- Menu ---------- */

int readInt(const char *msg, int *x) {
    char buf[64];
    printf("%s", msg);
    if (!fgets(buf, sizeof buf, stdin)) { saveTree(); exit(0); }   /* end of input */
    if (sscanf(buf, "%d", x) != 1) { printf("Invalid input.\n"); return 0; }
    return 1;
}

int main(void) {
    int choice, key;
    loadTree();

    while (1) {
        printf("\n1. Insert Node\n2. Search Node\n3. Delete Node\n4. Display Inorder\n"
               "5. Display Tree\n6. Display Frequencies\n7. Save Data\n8. Exit\n");
        if (!readInt("Enter choice: ", &choice)) continue;

        if (choice == 1) {
            if (!readInt("Enter key to insert: ", &key)) continue;
            if (addKey(key)) { printf("Inserted %d.\n", key); saveTree(); }
            else printf("Duplicate key. Not inserted.\n");
        }
        else if (choice == 2) {
            if (!root) { printf("Tree is empty.\n"); continue; }
            if (!readInt("Enter key to search: ", &key)) continue;
            Node *n = find(key);
            if (!n) { printf("Node not found.\n"); continue; }
            n->totalFrequency++;
            n->windowFrequency++;
            searchCount++;
            // printf("Node %d found. Total: %d | Window: %d | Searches in window: %d/%d\n",
                //    key, n->totalFrequency, n->windowFrequency, searchCount, SEARCH_LIMIT);


            printf("Node %d found in %d step(s). Total: %d | Window: %d | Searches in window: %d/%d\n",
            key, steps, n->totalFrequency, n->windowFrequency, searchCount, SEARCH_LIMIT);


            saveTree();
            if (searchCount >= SEARCH_LIMIT) adaptiveCheck();
        }
        else if (choice == 3) {
            if (!root) { printf("Tree is empty.\n"); continue; }
            if (!readInt("Enter key to delete: ", &key)) continue;
            if (!find(key)) { printf("Node not found.\n"); continue; }
            root = deleteNode(root, key);
            printf("Deleted %d.\n", key);
            saveTree();
        }
        else if (choice == 4 || choice == 6) {
            if (!root) { printf("Tree is empty.\n"); continue; }
            printInorder(root);
            if (choice == 6) printf("Searches in current window: %d/%d\n", searchCount, SEARCH_LIMIT);
        }
        else if (choice == 5) {
            if (!root) printf("Tree is empty.\n");
            else printTree(root, 0);
        }
        else if (choice == 7) { saveTree(); printf("Data saved to %s.\n", DATA_FILE); }
        else if (choice == 8) { saveTree(); printf("Data saved. Goodbye!\n"); return 0; }
        else printf("Invalid choice.\n");
    }
}