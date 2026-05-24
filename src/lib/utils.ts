import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const SERVICE_PRICES = {
  "60 min": 590,
  "90 min": 890
};

export const MAX_CONCURRENT_BOOKINGS = 3;
