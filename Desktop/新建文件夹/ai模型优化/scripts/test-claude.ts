import { OptimizedLLMClient } from '../src';
import * as dotenv from 'dotenv';

dotenv.config();

async function testClaude() {
  console.log('=== 测试 Viva Claude Opus 4.8 ===');
  console.log('');

  const apiKey = process.env.VIVA_CLAUDE_API_KEY || '';
  const apiUrl = process.env.VIVA_CLAUDE_API_URL || 'https://www.vivaapi.cn/v1';
  const model = process.env.VIVA_CLAUDE_MODEL || 'claude-opus-4-8';

  console.log('配置信息:');
  console.log(`  API Key: ${apiKey.substring(0, 10)}...`);
  console.log(`  API URL: ${apiUrl}`);
  console.log(`  模型: ${model}`);
  console.log('');

  try {
    const client = OptimizedLLMClient.create('viva-claude', apiKey, undefined, apiUrl);

    console.log('1. 测试连接...');
    const health = await client.healthCheck();
    console.log(`   连接状态: ${health ? '✓ 成功' : '✗ 失败'}`);

    if (!health) {
      console.log('连接失败，请检查网络或API Key');
      return;
    }

    console.log('');
    console.log('2. 测试聊天功能...');
    
    const response = await client.chat({
      model: model,
      messages: [
        { role: 'user', content: 'Hello! 你好！请用中文介绍一下你自己。' },
      ],
      temperature: 0.7,
      maxTokens: 1024,
    }, 'high');

    console.log('');
    console.log('响应结果:');
    console.log('─────────────────────────────');
    console.log(response.choices[0].message.content);
    console.log('─────────────────────────────');
    console.log('');
    console.log('使用统计:');
    console.log(`  输入 tokens: ${response.usage.prompt_tokens}`);
    console.log(`  输出 tokens: ${response.usage.completion_tokens}`);
    console.log(`  总计 tokens: ${response.usage.total_tokens}`);

    console.log('');
    console.log('=== 测试完成 ===');

    await client.shutdown();
  } catch (error: any) {
    console.error('测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testClaude().catch(console.error);