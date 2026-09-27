import { runAurumAgent } from "../agent/gemini_agent";

async function main() {
  console.log("Testing full Gemini Agent Loop with tool calling...");
  const query = "Aaj 24K sone ka bhav kya hai aur pichle dino ke hisaab se kaisa hai?";
  const chatId = Number(process.env.TELEGRAM_TEST_CHAT_ID || 12345678);

  const result = await runAurumAgent(query, chatId);
  console.log("\n--- AGENT RESULT ---");
  console.log("Model Used:", result.modelUsed);
  console.log("Used Fallback:", result.usedFallback);
  console.log("Tools Called:", result.toolsCalled);
  console.log("Tool Outputs:", JSON.stringify(result.toolOutputs, null, 2));
  console.log("\nFinal Hindi Output:\n" + result.text);
}

main().catch(console.error);
