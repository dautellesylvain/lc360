// Stripe Payment Links
export const STRIPE_CONFIG = {
  paymentLinks: {
    monthly: 'https://buy.stripe.com/test_00w8wR2MKaCg5gu1c74ZG00',
    yearly:  'https://buy.stripe.com/test_aFaaEZ5YW7q4aAO6wr4ZG01',
  },
  amounts: {
    monthly: 15,
    yearly:  99,
  }
}

export const redirectToCheckout = (billing, uid, email) => {
  const base = billing === 'monthly'
    ? STRIPE_CONFIG.paymentLinks.monthly
    : STRIPE_CONFIG.paymentLinks.yearly

  // Passer l'uid et l'email en paramètres
  const params = new URLSearchParams()
  if (uid)   params.set('client_reference_id', uid)
  if (email) params.set('prefilled_email', email)

  window.location.href = `${base}?${params.toString()}`
}

