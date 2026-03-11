import { runAgent } from "./src/agent";

async function test() {
  const response = await runAgent({
    sessionId: "550e8400-e29b-41d4-a716-446655440000",
    userId: "550e8400-e29b-41d4-a716-446655440001",
    messages: [
      {
        role: "user",
        content: "What time is it right now in India?",
      },
    ],
    userProfile: {
      name: "Test User",
      timezone: "Asia/Kolkata",
    },
  });

  console.log("Agent response:", response.text);
  console.log("Tools used:", response.toolsUsed);
  console.log("Tokens:", response.usage);
}

test().catch(console.error);
