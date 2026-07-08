import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/app/dashboard/lib/dal";
import { logAdminAction } from "@/app/dashboard/lib/audit-log";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const admin = await getCurrentAdmin();
  const { id, commentId } = await params;

  try {
    const { data: comment, error: fetchError } = await supabaseAdmin
      .from("area_discussion_comments")
      .select("id,body")
      .eq("id", commentId)
      .eq("discussion_id", id)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    const { error: deleteError } = await supabaseAdmin
      .from("area_discussion_comments")
      .delete()
      .eq("id", commentId);
    if (deleteError) throw new Error(deleteError.message);

    const { data: discussion, error: countError } = await supabaseAdmin
      .from("area_discussions")
      .select("comment_count")
      .eq("id", id)
      .maybeSingle();
    if (countError) throw new Error(countError.message);

    if (discussion) {
      const { error: updateError } = await supabaseAdmin
        .from("area_discussions")
        .update({ comment_count: Math.max(0, (discussion.comment_count ?? 1) - 1) })
        .eq("id", id);
      if (updateError) throw new Error(updateError.message);
    }

    await logAdminAction({
      category: "moderation",
      action: "delete_discussion_comment",
      detail: `Deleted comment ${commentId} on discussion ${id}: "${comment.body.slice(0, 80)}"`,
      targetType: "area_discussion_comment",
      targetId: commentId,
      actorId: admin.id,
      actorLabel: admin.email,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete comment" }, { status: 500 });
  }
}
