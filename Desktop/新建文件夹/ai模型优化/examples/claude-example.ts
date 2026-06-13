import { OptimizedLLMClient, LLMRequest } from '../src';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const client = OptimizedLLMClient.create(
    'viva-claude',
    process.env.VIVA_CLAUDE_API_KEY || '',
    undefined,
    process.env.VIVA_CLAUDE_API_URL || 'https://www.vivaapi.cn/v1'
  );

  // 示例1: 简单对话
  console.log('=== 示例1: 简单对话 ===');
  const response1 = await client.chat({
    model: 'claude-opus-4-8',
    messages: [{ role: 'user', content: '解释什么是人工智能？' }],
    temperature: 0.5,
  });
  console.log(response1.choices[0].message.content);
  console.log('');

  // 示例2: 多轮对话
  console.log('=== 示例2: 多轮对话 ===');
  const messages: LLMRequest['messages'] = [
    { role: 'user', content: '什么是机器学习？' },
    { role: 'assistant', content: '机器学习是人工智能的一个分支...' },
    { role: 'user', content: '它和深度学习有什么区别？' },
  ];
  const response2 = await client.chat({
    model: 'claude-opus-4-8',
    messages,
    temperature: 0.7,
    maxTokens: 2048,
  });
  console.log(response2.choices[0].message.content);
  console.log('');

  // 示例3: 高优先级请求
  console.log('=== 示例3: 高优先级请求 ===');
  const response3 = await client.chat({
    model: 'claude-opus-4-8',
    messages: [{ role: 'user', content: '请写一首关于春天的诗。' }],
    temperature: 0.9,
  }, 'high');
  console.log(response3.choices[0].message.content);

  await client.shutdown();
}

main().catch(console.error);