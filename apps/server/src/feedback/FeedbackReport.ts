import { AgentFeedbackKind, AgentFeedbackTrace } from "@t3tools/contracts";
import { resolveT3McpToolId } from "@t3tools/shared/t3McpToolPresentation";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

// Code points, as the scrubber caps them, so a valid input stays a valid report after redaction.
const FeedbackText = Schema.String.check(Schema.isMaxCodePoints(300));

/** Turns the outline of a requested report covers at least. */
export const FEEDBACK_TRACE_TURNS = 5;

const reportFields = {
  kind: AgentFeedbackKind,
  subject: Schema.String.annotate({
    description: "Zharf Code tool name, `zharf-code` command, or `general`.",
  }),
  expected: FeedbackText,
  actual: FeedbackText,
  workaround: FeedbackText.annotate({ description: "What you did instead, or empty." }),
  // Annotate before the default: an annotation after it never reaches the JSON schema.
  userRequested: Schema.Boolean.annotate({ description: "The user asked for this report." }).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(false)),
  ),
};

export const FeedbackInput = Schema.Struct({
  ...reportFields,
  turns: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))
    .annotate({
      description: "How many recent turns, counting this one, the problem spans.",
    })
    .pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),
});

export const FeedbackTrace = AgentFeedbackTrace;
export type FeedbackTrace = AgentFeedbackTrace;

const storedFields = {
  id: Schema.String,
  threadId: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  source: Schema.Literals(["mcp", "cli"]),
  sent: Schema.Boolean,
};

export const FeedbackReport = Schema.Struct({
  ...reportFields,
  ...storedFields,
  trace: Schema.NullOr(FeedbackTrace),
});

/** What `t3_feedback` answers: the report, with only the size of what its trace attached. */
export const FeedbackSubmitResult = Schema.Struct({
  ...reportFields,
  ...storedFields,
  trace: Schema.NullOr(FeedbackTrace.mapFields(Struct.omit(["entries"]))),
});

export const FEEDBACK_AWAITING_APPROVAL_NOTE =
  "The user sees this report in a card and chooses there whether to send it and whether to include the conversation. Nothing is sent until they do, and you will not learn their choice. Do not wait for it or send it another way. Call again only if the user asks to change it; that shows a new card.";

/** What `t3_feedback` answers for a requested report: shown to the user, not yet sent. */
export const FeedbackAwaitingApproval = Schema.Struct({
  status: Schema.Literal("awaiting_approval"),
  note: Schema.String,
});
export type FeedbackAwaitingApproval = typeof FeedbackAwaitingApproval.Type;

export const FEEDBACK_OFF_MESSAGE =
  "Agent feedback is off. Turn it on in Zharf Code under Settings > Labs, then try again.";

export class FeedbackOffError extends Schema.TaggedError<FeedbackOffError>()(
  "FeedbackOffError",
  {},
) {
  override get message() {
    return FEEDBACK_OFF_MESSAGE;
  }
}

export type FeedbackSource = "mcp" | "cli";

// Requested reports count when their card is shown, unprompted ones when stored.
export const MAX_REPORTS_PER_TURN = 3;
// Reports from no turn, such as `zharf-code feedback`, have no turn to count in.
export const MAX_REPORTS_OUTSIDE_TURNS_PER_HOUR = 10;

export class FeedbackLimitError extends Schema.TaggedError<FeedbackLimitError>()(
  "FeedbackLimitError",
  { scope: Schema.Literals(["turn", "hour", "cards"]) },
) {
  override get message() {
    switch (this.scope) {
      case "turn":
        return `This turn already sent ${MAX_REPORTS_PER_TURN} agent feedback reports; nothing was sent.`;
      case "cards":
        return `This turn already showed the user ${MAX_REPORTS_PER_TURN} agent feedback reports to approve; nothing was shown.`;
      case "hour":
        return `This machine already sent ${MAX_REPORTS_OUTSIDE_TURNS_PER_HOUR} agent feedback reports outside a turn in the last hour; nothing was sent.`;
    }
  }
}

export class FeedbackNotRequestedError extends Schema.TaggedError<FeedbackNotRequestedError>()(
  "FeedbackNotRequestedError",
  { source: Schema.Literals(["mcp", "cli"]) },
) {
  override get message() {
    return this.source === "cli"
      ? "Agent feedback is set to When I ask: ask your agent in a thread to send it, so you can approve what is sent."
      : "Agent feedback is set to When I ask: send a report only when the user asks for one.";
  }
}

export class FeedbackStorageError extends Schema.TaggedError<FeedbackStorageError>()(
  "FeedbackStorageError",
  { cause: Schema.Defect() },
) {
  override get message() {
    return "Could not save agent feedback.";
  }
}

/** The MCP client label `zharf-code feedback` signs in with, so its reports count as `cli`. */
export const FEEDBACK_CLI_CLIENT_LABEL = "zharf-code feedback cli";

/** Listed `zharf-code` command paths a report may name. A CLI test keeps this in step with binCli. */
export const T3_CLI_COMMANDS: ReadonlyArray<string> = [
  "zharf-code",
  "zharf-code help",
  "zharf-code serve",
  "zharf-code app",
  "zharf-code pair",
  "zharf-code auth",
  "zharf-code auth connect-device",
  "zharf-code auth connect-device approve",
  "zharf-code auth connect-device list",
  "zharf-code auth connect-device revoke",
  "zharf-code auth pairing",
  "zharf-code auth pairing create",
  "zharf-code auth pairing list",
  "zharf-code auth pairing revoke",
  "zharf-code auth session",
  "zharf-code auth session issue",
  "zharf-code auth session list",
  "zharf-code auth session revoke",
  "zharf-code environment",
  "zharf-code environment link",
  "zharf-code environment list",
  "zharf-code environment unlink",
  "zharf-code browser",
  "zharf-code browser setup",
  "zharf-code project",
  "zharf-code project add",
  "zharf-code project remove",
  "zharf-code project rename",
  "zharf-code thread",
  "zharf-code thread list",
  "zharf-code thread start",
  "zharf-code thread send",
  "zharf-code thread show",
  "zharf-code feedback",
  "zharf-code feedback list",
  "zharf-code workflow",
  "zharf-code workflow start",
  "zharf-code workflow list",
  "zharf-code workflow show",
  "zharf-code workflow resume",
  "zharf-code workflow cancel",
  "zharf-code workflow signal",
  "zharf-code workflow withdraw",
  "zharf-code workflow questions",
  "zharf-code workflow hooks",
  "zharf-code workflow store",
  "zharf-code workflow store list",
  "zharf-code workflow store set",
  "zharf-code workflow store delete",
  "zharf-code up",
  "zharf-code status",
  "zharf-code service",
  "zharf-code service install",
  "zharf-code service restart",
  "zharf-code service uninstall",
  "zharf-code service status",
  "zharf-code service protect",
  "zharf-code update",
  "zharf-code install",
  "zharf-code uninstall",
  "zharf-code theme",
  "zharf-code theme set",
  "zharf-code theme clear",
  "zharf-code theme show",
  "zharf-code trace",
  "zharf-code trace summary",
  "zharf-code doctor",
  "zharf-code policy",
  "zharf-code policy show",
  "zharf-code policy check",
  "zharf-code policy templates",
  "zharf-code policy settings",
  "zharf-code triage",
  "zharf-code connect",
  "zharf-code connect link",
  "zharf-code connect login",
  "zharf-code connect logout",
  "zharf-code connect publish",
  "zharf-code connect status",
  "zharf-code connect unlink",
];

export type FeedbackInput = typeof FeedbackInput.Type;
export type FeedbackReport = typeof FeedbackReport.Type;

export const FEEDBACK_SUBJECT_MESSAGE =
  "Set subject to the exact Zharf Code tool name, the zharf-code command, or `general`.";

// The shared resolver knows the presented tools; the prefix covers the rest, such as these.
// Codex also registers `t3-code-direct` for Zharf Code tools it keeps out of Code Mode.
const T3_PREFIX = /^(?:mcp__t3[-_]?code(?:[-_]direct)?__|t3[-_]?code(?:[-_]direct)?[.:/])/iu;

/** The bare name of a registered Zharf Code tool however a provider prefixed it, else undefined. */
export const resolveT3ToolName = (name: string, toolNames: ReadonlyArray<string>) => {
  const tool = resolveT3McpToolId(name) ?? name.replace(T3_PREFIX, "");
  if (toolNames.includes(tool)) return tool;
  // OpenCode 2 prefixes tools with `t3-code-<thread>_`, underscores and all: the longest name wins.
  if (!/^t3-code-/iu.test(name)) return undefined;
  return toolNames
    .filter((candidate) => name.endsWith(`_${candidate}`))
    .toSorted((a, b) => b.length - a.length)[0];
};

/** The stored subject, or undefined when the value names no Zharf Code tool, `zharf-code` command, or `general`. */
export const resolveFeedbackSubject = (value: string, toolNames: ReadonlyArray<string>) => {
  const subject = value.trim();
  if (subject === "general" || T3_CLI_COMMANDS.includes(subject)) return subject;
  return resolveT3ToolName(subject, toolNames);
};
