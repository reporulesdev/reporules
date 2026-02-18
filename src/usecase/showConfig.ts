/**
 * Show current configuration and setup instructions
 */
export function showConfig(): void {
  console.log('━'.repeat(60));
  console.log('RepoRules Configuration');
  console.log('━'.repeat(60));
  console.log();

  // Check OPENAI_API_KEY
  const apiKey = process.env.OPENAI_API_KEY;

  console.log('Environment Variables:');
  if (apiKey) {
    // Mask API key (show first 10 and last 4 characters)
    const masked = apiKey.length > 14
      ? `${apiKey.slice(0, 10)}***${apiKey.slice(-4)}`
      : '***';
    console.log(`  OPENAI_API_KEY:  ✅ ${masked} (configured)`);
  } else {
    console.log(`  OPENAI_API_KEY:  ❌ Not set`);
  }
  console.log();

  // Display default settings
  console.log('Settings:');
  console.log('  Output Directory: .reporules (default)');
  console.log('  Model:           gpt-5.1-2025-11-13 (default)');
  console.log();

  console.log('━'.repeat(60));
  console.log();

  // Show setup instructions if API key is missing
  if (!apiKey) {
    console.log('⚠️  Required: OPENAI_API_KEY');
    console.log();
  }

  console.log('How to configure:');
  console.log('  export OPENAI_API_KEY=sk-...');
  console.log();
  console.log('  Or add to your shell profile (~/.bashrc, ~/.zshrc):');
  console.log('  echo \'export OPENAI_API_KEY=sk-...\' >> ~/.zshrc');
  console.log();
  console.log('Get your API key at: https://platform.openai.com/api-keys');
  console.log();
}
