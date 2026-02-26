export const RATE_LIMIT_PROFILES = {
  authLogin: { limit: 10, windowMs: 15 * 60 * 1000 },
  authRegister: { limit: 5, windowMs: 30 * 60 * 1000 },
  authRequestReset: { limit: 5, windowMs: 15 * 60 * 1000 },
  authReset: { limit: 10, windowMs: 30 * 60 * 1000 },

  publicSearch: { limit: 60, windowMs: 60_000 },
  publicUserProfile: { limit: 50, windowMs: 60_000 },
  publicGeocodeForward: { limit: 30, windowMs: 60_000 },
  publicGeocodeReverse: { limit: 30, windowMs: 60_000 },
  publicReviewStats: { limit: 60, windowMs: 60_000 },

  usersProfileWrite: { limit: 20, windowMs: 60_000 },
  usersSkillsWrite: { limit: 30, windowMs: 60_000 },
  usersFavoritesWrite: { limit: 40, windowMs: 60_000 },
  usersSavedSearchesWrite: { limit: 30, windowMs: 60_000 },

  transactionsRead: { limit: 80, windowMs: 60_000 },
  transactionsCreate: { limit: 12, windowMs: 60_000 },
  transactionsStateChange: { limit: 20, windowMs: 60_000 },

  chatConversationsRead: { limit: 80, windowMs: 60_000 },
  chatUnreadRead: { limit: 120, windowMs: 60_000 },
  chatMessagesWrite: { limit: 60, windowMs: 60_000 },
  chatReadWrite: { limit: 80, windowMs: 60_000 },
  chatStartWrite: { limit: 25, windowMs: 60_000 },
  chatTypingWrite: { limit: 120, windowMs: 60_000 },
  chatUploadWrite: { limit: 20, windowMs: 60_000 },

  reviewsRead: { limit: 80, windowMs: 60_000 },
  reviewsExistsBatchWrite: { limit: 30, windowMs: 60_000 },
  reviewsWrite: { limit: 20, windowMs: 60_000 },

  presencePing: { limit: 120, windowMs: 60_000 },
  chainAnchorWrite: { limit: 10, windowMs: 60_000 },
  avatarUploadWrite: { limit: 12, windowMs: 60_000 },

  paymentsTopupInit: { limit: 15, windowMs: 60_000 },
  paymentsTopupConfirm: { limit: 20, windowMs: 60_000 },
  paymentsStripeCheckout: { limit: 10, windowMs: 60_000 },
  paymentsStripeWebhook: { limit: 120, windowMs: 60_000 },

  testHealth: { limit: 20, windowMs: 60_000 },
  testCloudinary: { limit: 10, windowMs: 60_000 },
  testCheckEmail: { limit: 10, windowMs: 60_000 },
  testFixUsernameIndex: { limit: 8, windowMs: 60_000 },
};
