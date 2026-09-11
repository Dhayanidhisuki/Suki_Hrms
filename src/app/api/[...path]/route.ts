/**
 * Catch-all API 404 — any /api/* path that has no specific route handler
 * lands here and gets a JSON 404 instead of the [...slug] page's HTML.
 * Without this, the app's catch-all page renders HTML with a 200 for
 * non-existent API endpoints, and client-side `res.json()` throws
 * "Unexpected token '<', "<!DOCTYPE "... is not valid JSON".
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function POST() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function PUT() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function PATCH() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
