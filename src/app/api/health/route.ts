export async function GET() {
  return Response.json({
    status: "ok",
    storage: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    contract: Boolean(
      process.env.NEXT_PUBLIC_PERMIT_CONTRACT &&
      process.env.NEXT_PUBLIC_PAYMENT_TOKEN,
    ),
    qwen: Boolean(
      process.env.QWEN_API_KEY &&
      process.env.QWEN_MODEL &&
      process.env.QWEN_BASE_URL,
    ),
    envio: Boolean(process.env.ENVIO_GRAPHQL_URL),
    encryption: Boolean(process.env.DATA_ENCRYPTION_KEY),
    alchemy: Boolean(process.env.ALCHEMY_RPC_URL),
    kimi: Boolean(process.env.KIMI_API_KEY && process.env.KIMI_MODEL),
    cre: process.env.CRE_PROVISIONING_ENABLED === "true",
    aurora: Boolean(
      process.env.AURORA_API_KEY &&
      process.env.NEXT_PUBLIC_AURORA_DESTINATION_ASSET &&
      process.env.NEXT_PUBLIC_MONAD_CHAIN_ID === "143",
    ),
    chain:
      process.env.NEXT_PUBLIC_MONAD_CHAIN_ID === "143"
        ? "Monad mainnet"
        : "Monad testnet",
    chainId: process.env.NEXT_PUBLIC_MONAD_CHAIN_ID === "143" ? 143 : 10143,
  });
}
