export type Difficulty = "Easy" | "Medium" | "Hard";
export type SubmissionStatus = "Accepted" | "Wrong Answer" | "Runtime Error" | "Time Limit Exceeded" | "Pending";

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
}

export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  description: string;
  constraints: string;
  sampleInput: string;
  sampleOutput: string;
  testCases: TestCase[];
  boilerplate: string;
  isActive: boolean;
  createdAt: string;
  submissionCount: number;
}

export interface Submission {
  id: string;
  userId: string;
  userName: string;
  problemId: string;
  problemTitle: string;
  code: string;
  language: string;
  status: SubmissionStatus;
  executionTime: string;
  submittedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  avatar?: string;
}

export const mockUsers: User[] = [
  { id: "u1", name: "Alice Johnson", email: "alice@code.io", role: "user" },
  { id: "u2", name: "Bob Smith", email: "bob@code.io", role: "user" },
  { id: "u3", name: "Charlie Davis", email: "charlie@code.io", role: "user" },
  { id: "u4", name: "Diana Patel", email: "diana@code.io", role: "user" },
  { id: "admin1", name: "Admin User", email: "admin@code.io", role: "admin" },
];

const javaBoilerplate = `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Write your code here
        
        sc.close();
    }
}`;

export const mockProblems: Problem[] = [
  {
    id: "p1",
    title: "Two Sum",
    difficulty: "Easy",
    description: `<h2>Two Sum</h2>
<p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return <strong>indices of the two numbers</strong> such that they add up to <code>target</code>.</p>
<p>You may assume that each input would have <strong>exactly one solution</strong>, and you may not use the same element twice.</p>
<p>You can return the answer in any order.</p>
<h3>Example 1:</h3>
<pre><code>Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].</code></pre>
<h3>Example 2:</h3>
<pre><code>Input: nums = [3,2,4], target = 6
Output: [1,2]</code></pre>`,
    constraints: "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.",
    sampleInput: "4\n2 7 11 15\n9",
    sampleOutput: "0 1",
    testCases: [
      { id: "tc1", input: "4\n2 7 11 15\n9", expectedOutput: "0 1" },
      { id: "tc2", input: "3\n3 2 4\n6", expectedOutput: "1 2" },
      { id: "tc3", input: "2\n3 3\n6", expectedOutput: "0 1" },
    ],
    boilerplate: javaBoilerplate,
    isActive: true,
    createdAt: "2026-05-15T10:00:00Z",
    submissionCount: 142,
  },
  {
    id: "p2",
    title: "FizzBuzz",
    difficulty: "Easy",
    description: `<h2>FizzBuzz</h2>
<p>Given an integer <code>n</code>, return a string array <code>answer</code> (<strong>1-indexed</strong>) where:</p>
<ul>
<li><code>answer[i] == "FizzBuzz"</code> if <code>i</code> is divisible by 3 and 5.</li>
<li><code>answer[i] == "Fizz"</code> if <code>i</code> is divisible by 3.</li>
<li><code>answer[i] == "Buzz"</code> if <code>i</code> is divisible by 5.</li>
<li><code>answer[i] == i</code> (as a string) if none of the above conditions are true.</li>
</ul>
<h3>Example:</h3>
<pre><code>Input: n = 15
Output: ["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]</code></pre>`,
    constraints: "1 <= n <= 10^4",
    sampleInput: "15",
    sampleOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz",
    testCases: [
      { id: "tc1", input: "5", expectedOutput: "1\n2\nFizz\n4\nBuzz" },
      { id: "tc2", input: "3", expectedOutput: "1\n2\nFizz" },
    ],
    boilerplate: javaBoilerplate,
    isActive: true,
    createdAt: "2026-05-16T14:30:00Z",
    submissionCount: 98,
  },
  {
    id: "p3",
    title: "Palindrome Check",
    difficulty: "Easy",
    description: `<h2>Palindrome Check</h2>
<p>Given a string <code>s</code>, return <code>true</code> if it is a <strong>palindrome</strong>, or <code>false</code> otherwise.</p>
<p>A string is a palindrome if it reads the same forward and backward, considering only alphanumeric characters and ignoring cases.</p>
<h3>Example 1:</h3>
<pre><code>Input: s = "A man, a plan, a canal: Panama"
Output: true</code></pre>
<h3>Example 2:</h3>
<pre><code>Input: s = "race a car"
Output: false</code></pre>`,
    constraints: "1 <= s.length <= 2 * 10^5\ns consists only of printable ASCII characters.",
    sampleInput: "A man, a plan, a canal: Panama",
    sampleOutput: "true",
    testCases: [
      { id: "tc1", input: "A man, a plan, a canal: Panama", expectedOutput: "true" },
      { id: "tc2", input: "race a car", expectedOutput: "false" },
      { id: "tc3", input: " ", expectedOutput: "true" },
    ],
    boilerplate: javaBoilerplate,
    isActive: true,
    createdAt: "2026-05-18T09:00:00Z",
    submissionCount: 76,
  },
  {
    id: "p4",
    title: "Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    description: `<h2>Longest Substring Without Repeating Characters</h2>
<p>Given a string <code>s</code>, find the length of the <strong>longest substring</strong> without repeating characters.</p>
<h3>Example 1:</h3>
<pre><code>Input: s = "abcabcbb"
Output: 3
Explanation: The answer is "abc", with the length of 3.</code></pre>
<h3>Example 2:</h3>
<pre><code>Input: s = "bbbbb"
Output: 1
Explanation: The answer is "b", with the length of 1.</code></pre>`,
    constraints: "0 <= s.length <= 5 * 10^4\ns consists of English letters, digits, symbols and spaces.",
    sampleInput: "abcabcbb",
    sampleOutput: "3",
    testCases: [
      { id: "tc1", input: "abcabcbb", expectedOutput: "3" },
      { id: "tc2", input: "bbbbb", expectedOutput: "1" },
      { id: "tc3", input: "pwwkew", expectedOutput: "3" },
    ],
    boilerplate: javaBoilerplate,
    isActive: true,
    createdAt: "2026-05-20T11:00:00Z",
    submissionCount: 54,
  },
  {
    id: "p5",
    title: "Merge Sorted Arrays",
    difficulty: "Medium",
    description: `<h2>Merge Sorted Arrays</h2>
<p>You are given two integer arrays <code>nums1</code> and <code>nums2</code>, sorted in <strong>non-decreasing order</strong>. Merge <code>nums2</code> into <code>nums1</code> as one sorted array.</p>
<p>Print the merged sorted array.</p>
<h3>Example:</h3>
<pre><code>Input:
nums1 = [1,2,3]
nums2 = [2,5,6]
Output: 1 2 2 3 5 6</code></pre>`,
    constraints: "1 <= nums1.length, nums2.length <= 200\n-10^9 <= nums1[i], nums2[j] <= 10^9",
    sampleInput: "3\n1 2 3\n3\n2 5 6",
    sampleOutput: "1 2 2 3 5 6",
    testCases: [
      { id: "tc1", input: "3\n1 2 3\n3\n2 5 6", expectedOutput: "1 2 2 3 5 6" },
      { id: "tc2", input: "1\n1\n0", expectedOutput: "1" },
    ],
    boilerplate: javaBoilerplate,
    isActive: false,
    createdAt: "2026-05-22T16:00:00Z",
    submissionCount: 31,
  },
  {
    id: "p6",
    title: "Binary Tree Level Order Traversal",
    difficulty: "Hard",
    description: `<h2>Binary Tree Level Order Traversal</h2>
<p>Given the <code>root</code> of a binary tree, return the <strong>level order traversal</strong> of its nodes' values (i.e., from left to right, level by level).</p>
<p>The tree is given as space-separated values in level order, with <code>-1</code> representing null nodes.</p>
<h3>Example:</h3>
<pre><code>Input: 3 9 20 -1 -1 15 7
Output:
3
9 20
15 7</code></pre>`,
    constraints: "The number of nodes in the tree is in the range [0, 2000].\n-1000 <= Node.val <= 1000",
    sampleInput: "3 9 20 -1 -1 15 7",
    sampleOutput: "3\n9 20\n15 7",
    testCases: [
      { id: "tc1", input: "3 9 20 -1 -1 15 7", expectedOutput: "3\n9 20\n15 7" },
      { id: "tc2", input: "1", expectedOutput: "1" },
    ],
    boilerplate: javaBoilerplate,
    isActive: false,
    createdAt: "2026-05-25T08:00:00Z",
    submissionCount: 12,
  },
];

export const mockSubmissions: Submission[] = [
  {
    id: "s1",
    userId: "u1",
    userName: "Alice Johnson",
    problemId: "p1",
    problemTitle: "Two Sum",
    code: `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        int target = sc.nextInt();
        
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < n; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                System.out.println(map.get(complement) + " " + i);
                return;
            }
            map.put(nums[i], i);
        }
        sc.close();
    }
}`,
    language: "Java",
    status: "Accepted",
    executionTime: "45ms",
    submittedAt: "2026-05-28T14:30:00Z",
  },
  {
    id: "s2",
    userId: "u2",
    userName: "Bob Smith",
    problemId: "p1",
    problemTitle: "Two Sum",
    code: `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        int target = sc.nextInt();
        
        for (int i = 0; i < n; i++) {
            for (int j = i + 1; j < n; j++) {
                if (nums[i] + nums[j] == target) {
                    System.out.println(i + " " + j);
                    return;
                }
            }
        }
        sc.close();
    }
}`,
    language: "Java",
    status: "Time Limit Exceeded",
    executionTime: "2000ms",
    submittedAt: "2026-05-28T15:10:00Z",
  },
  {
    id: "s3",
    userId: "u3",
    userName: "Charlie Davis",
    problemId: "p2",
    problemTitle: "FizzBuzz",
    code: `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        for (int i = 1; i <= n; i++) {
            if (i % 15 == 0) System.out.println("FizzBuzz");
            else if (i % 3 == 0) System.out.println("Fizz");
            else if (i % 5 == 0) System.out.println("Buzz");
            else System.out.println(i);
        }
        sc.close();
    }
}`,
    language: "Java",
    status: "Accepted",
    executionTime: "32ms",
    submittedAt: "2026-05-29T09:00:00Z",
  },
  {
    id: "s4",
    userId: "u1",
    userName: "Alice Johnson",
    problemId: "p3",
    problemTitle: "Palindrome Check",
    code: `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.nextLine().toLowerCase().replaceAll("[^a-z0-9]", "");
        String rev = new StringBuilder(s).reverse().toString();
        System.out.println(s.equals(rev));
        sc.close();
    }
}`,
    language: "Java",
    status: "Accepted",
    executionTime: "28ms",
    submittedAt: "2026-05-29T10:30:00Z",
  },
  {
    id: "s5",
    userId: "u4",
    userName: "Diana Patel",
    problemId: "p4",
    problemTitle: "Longest Substring Without Repeating Characters",
    code: `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.nextLine();
        // incomplete solution
        System.out.println(s.length());
        sc.close();
    }
}`,
    language: "Java",
    status: "Wrong Answer",
    executionTime: "25ms",
    submittedAt: "2026-05-29T14:00:00Z",
  },
  {
    id: "s6",
    userId: "u2",
    userName: "Bob Smith",
    problemId: "p2",
    problemTitle: "FizzBuzz",
    code: `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        for (int i = 1; i <= n; i++) {
            if (i % 3 == 0) System.out.println("Fizz");
            else if (i % 5 == 0) System.out.println("Buzz");
            else if (i % 15 == 0) System.out.println("FizzBuzz");
            else System.out.println(i);
        }
        sc.close();
    }
}`,
    language: "Java",
    status: "Wrong Answer",
    executionTime: "30ms",
    submittedAt: "2026-05-30T08:00:00Z",
  },
  {
    id: "s7",
    userId: "u3",
    userName: "Charlie Davis",
    problemId: "p1",
    problemTitle: "Two Sum",
    code: `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        // Runtime error - null pointer
        Scanner sc = null;
        int n = sc.nextInt();
    }
}`,
    language: "Java",
    status: "Runtime Error",
    executionTime: "0ms",
    submittedAt: "2026-05-30T11:00:00Z",
  },
  {
    id: "s8",
    userId: "u4",
    userName: "Diana Patel",
    problemId: "p3",
    problemTitle: "Palindrome Check",
    code: `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.nextLine();
        String cleaned = s.replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
        int left = 0, right = cleaned.length() - 1;
        while (left < right) {
            if (cleaned.charAt(left) != cleaned.charAt(right)) {
                System.out.println(false);
                return;
            }
            left++;
            right--;
        }
        System.out.println(true);
        sc.close();
    }
}`,
    language: "Java",
    status: "Accepted",
    executionTime: "22ms",
    submittedAt: "2026-05-30T16:00:00Z",
  },
  {
    id: "s9",
    userId: "u1",
    userName: "Alice Johnson",
    problemId: "p4",
    problemTitle: "Longest Substring Without Repeating Characters",
    code: `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.nextLine();
        Set<Character> set = new HashSet<>();
        int maxLen = 0, left = 0;
        for (int right = 0; right < s.length(); right++) {
            while (set.contains(s.charAt(right))) {
                set.remove(s.charAt(left));
                left++;
            }
            set.add(s.charAt(right));
            maxLen = Math.max(maxLen, right - left + 1);
        }
        System.out.println(maxLen);
        sc.close();
    }
}`,
    language: "Java",
    status: "Accepted",
    executionTime: "38ms",
    submittedAt: "2026-05-31T09:00:00Z",
  },
  {
    id: "s10",
    userId: "u2",
    userName: "Bob Smith",
    problemId: "p3",
    problemTitle: "Palindrome Check",
    code: `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.nextLine();
        System.out.println(s.equals(new StringBuilder(s).reverse().toString()));
        sc.close();
    }
}`,
    language: "Java",
    status: "Wrong Answer",
    executionTime: "20ms",
    submittedAt: "2026-05-31T10:30:00Z",
  },
];
