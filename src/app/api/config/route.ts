import { NextResponse } from 'next/server';
import { isRedditConfigured } from '@/lib/reddit';
import { isTicketmasterConfigured } from '@/lib/ticketmaster';

export async function GET() {
  return NextResponse.json({
    reddit: isRedditConfigured(),
    ticketmaster: isTicketmasterConfigured(),
  });
}
