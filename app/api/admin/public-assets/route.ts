import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'];

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), 'public');
    const files = fs.readdirSync(publicDir);
    const images = files
      .filter(f => IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()))
      .sort();

    return NextResponse.json({ images: images.map(f => `/${f}`) });
  } catch (error) {
    return NextResponse.json({ images: [] });
  }
}
