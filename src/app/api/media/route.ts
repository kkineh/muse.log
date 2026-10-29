// API route for media upload and management
import { createClient, isAdmin } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { BRAIN_STORAGE_PREFIX } from '@/lib/constants';

// GET /api/media - Get all media files (admin only)
export async function GET() {
  const admin = await isAdmin();

  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('media')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/media - Upload a new media file (admin only)
export async function POST(request: Request) {
  const admin = await isAdmin();

  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const altText = formData.get('alt_text') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Generate unique filename
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(7);
  const extension = file.name.split('.').pop();
  const filename = `${timestamp}-${randomString}.${extension}`;
  const filepath = `images/${filename}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('blog-images')
    .upload(filepath, file, {
      cacheControl: '31536000', // 1 year
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message },
      { status: 500 }
    );
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from('blog-images').getPublicUrl(filepath);

  // Save metadata to database
  const { data: mediaData, error: dbError } = await supabase
    .from('media')
    .insert({
      filename: file.name,
      url: publicUrl,
      alt_text: altText || null,
      size: file.size,
      mime_type: file.type,
    })
    .select()
    .single();

  if (dbError) {
    // If DB insert fails, delete the uploaded file
    await supabase.storage.from('blog-images').remove([filepath]);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(mediaData, { status: 201 });
}

// DELETE /api/media?id=xxx - Delete a media file (admin only)
export async function DELETE(request: Request) {
  const admin = await isAdmin();

  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'Media ID is required' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Get media info
  const { data: media, error: fetchError } = await supabase
    .from('media')
    .select('url')
    .eq('id', id)
    .single();

  if (fetchError || !media) {
    return NextResponse.json(
      { error: 'Media not found' },
      { status: 404 }
    );
  }

  // Extract filepath from URL
  const url = new URL(media.url);
  const filepath = url.pathname.split('/blog-images/')[1];

  // brain 이미지는 발행 스크립트가 관리한다. Storage도 행도 지우지 않는다
  if (filepath?.startsWith(BRAIN_STORAGE_PREFIX)) {
    return NextResponse.json(
      { error: 'brain에서 관리하는 이미지입니다' },
      { status: 409 }
    );
  }

  // Delete from storage
  if (filepath) {
    await supabase.storage.from('blog-images').remove([filepath]);
  }

  // Delete from database
  const { error: deleteError } = await supabase
    .from('media')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
