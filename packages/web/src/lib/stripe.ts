import { loadStripe } from "@stripe/stripe-js";

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null;

export const SUBSCRIPTION_PRICE = 4.99;
export const MONTHLY_TOKEN_LIMIT_USD = 4.0;
