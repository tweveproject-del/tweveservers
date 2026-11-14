import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: '/',
      },
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'OAI-SearchBot',
          'ClaudeBot',
          'Claude-Web',
          'Anthropic-ai',
          'CCBot',
          'PerplexityBot',
          'Bytespider',
          'Google-Extended',
          'Amazonbot',
          'Meta-ExternalAgent',
          'Applebot-Extended',
        ],
        disallow: '/',
      },
    ],
  };
}
