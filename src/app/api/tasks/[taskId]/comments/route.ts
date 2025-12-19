import { NextRequest, NextResponse } from 'next/server';
import { getTaskById, getTaskComments, createTaskComment } from '@/db/attribution/task-queries';
import type { TaskAuthorType } from '@/db/attribution/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    // Verify task exists
    const task = await getTaskById(taskId);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Get comments
    const comments = await getTaskComments(taskId);

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    const { content, authorType, authorName } = body;

    // Validate
    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (!authorType || !['CLIENT', 'AGENCY'].includes(authorType)) {
      return NextResponse.json({ error: 'Invalid author type' }, { status: 400 });
    }

    // Verify task exists
    const task = await getTaskById(taskId);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check if task is resolved
    if (task.status === 'APPROVED' || task.status === 'REJECTED') {
      return NextResponse.json(
        { error: 'Cannot add comments to resolved tasks' },
        { status: 400 }
      );
    }

    // Create comment
    const comment = await createTaskComment({
      task_id: taskId,
      author_type: authorType as TaskAuthorType,
      author_name: authorName || null,
      content: content.trim(),
    });

    return NextResponse.json({ success: true, comment });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}



