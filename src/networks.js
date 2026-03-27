/**
 * Supported share networks for MVP.
 *
 * Phase 2 additions: Blacksky (when a client with intent URL exists),
 * Misskey, Calckey, Pixelfed, etc.
 */

export const NETWORKS = [
  {
    id: 'bluesky',
    label: 'Bluesky',
    type: 'atproto',
    intentUrl: (text) => `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`,
  },
  {
    id: 'mastodon',
    label: 'Mastodon',
    type: 'activitypub',
    // instance is required; stored in preference record
    intentUrl: (text, instance) => `${instance}/share?text=${encodeURIComponent(text)}`,
    requiresInstance: true,
  },
];

/**
 * Build a share intent URL for the given network.
 * @param {string} networkId
 * @param {string} text - share text (URL + optional message)
 * @param {object} [opts]
 * @param {string} [opts.mastodonInstance] - required for Mastodon
 * @returns {string} intent URL
 */
export function buildIntentUrl(networkId, text, opts = {}) {
  const network = NETWORKS.find((n) => n.id === networkId);
  if (!network) throw new Error(`Unknown network: ${networkId}`);
  if (network.requiresInstance && !opts.mastodonInstance) {
    throw new Error(`Network "${networkId}" requires an instance URL`);
  }
  return network.intentUrl(text, opts.mastodonInstance);
}
