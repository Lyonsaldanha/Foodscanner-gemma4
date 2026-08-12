// PostToolUse hook (matcher: TaskUpdate). Fires after every TaskUpdate call;
// only acts when the call marks a task "completed" — auto-commits the working
// tree so each finished atomic task gets its own git checkpoint to revert to.
const { execSync } = require("child_process");

const REPO_DIR = "C:/Users/91976/STUDY/FoodScanner";

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const toolInput = input.tool_input || {};
  if (toolInput.status !== "completed") process.exit(0);

  try {
    const status = execSync("git status --porcelain", { cwd: REPO_DIR }).toString();
    if (!status.trim()) process.exit(0);

    const taskId = toolInput.taskId || "unknown";
    const subjectRaw = typeof toolInput.subject === "string" ? toolInput.subject : "";
    const subject = subjectRaw.replace(/"/g, "'").trim();
    const message = `Checkpoint: task #${taskId}${subject ? " - " + subject : ""} completed`;

    execSync("git add -A", { cwd: REPO_DIR });
    execSync(`git commit -m "${message}" --quiet`, { cwd: REPO_DIR });
  } catch {
    // Never block the agent loop on a checkpoint-commit failure.
    process.exit(0);
  }
});
