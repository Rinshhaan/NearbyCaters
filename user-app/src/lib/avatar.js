/**
 * AI-Generated Cartoon Character Avatar Utilities
 * Powered by DiceBear character presets
 */

export function getCartoonAvatar(seed, style = 'adventurer') {
  const safeSeed = encodeURIComponent(String(seed || 'catering-staff').trim().toLowerCase());
  return `https://api.dicebear.com/7.x/${style}/png?seed=${safeSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

export const CARTOON_AVATAR_PRESETS = [
  'https://api.dicebear.com/7.x/adventurer/png?seed=Felix&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/adventurer/png?seed=Aneka&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/adventurer/png?seed=Milo&backgroundColor=ffdfbf',
  'https://api.dicebear.com/7.x/adventurer/png?seed=Zoe&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/adventurer/png?seed=Jasper&backgroundColor=d1d4f9',
  'https://api.dicebear.com/7.x/bottts/png?seed=Spark&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/lorelei/png?seed=Rin&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/adventurer/png?seed=Leo&backgroundColor=ffdfbf',
];
